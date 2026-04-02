/**
 * FleetStat Cloud Functions
 * ──────────────────────────
 * 1. onRoleChange  — Firestore trigger: kiedy admin zmieni rolę w /users/{uid},
 *                    automatycznie ustawia Custom Claim na Firebase Auth token.
 * 2. setUserRole   — Callable function: admin może ustawić rolę przez API.
 *
 * Uwaga: onNewUser (beforeUserCreated) usunięty — wymaga GCIP (płatne).
 * Nowi użytkownicy obsługiwani przez App.jsx + onRoleChange trigger.
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError }  = require("firebase-functions/v2/https");
const { initializeApp }       = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore }        = require("firebase-admin/firestore");

// Inicjalizacja Firebase Admin
initializeApp();

const VALID_ROLES = ["admin", "dyspozytor", "podglad"];

// ═══════════════════════════════════════════════════════════════
// 1. FIRESTORE TRIGGER — synchronizuje rolę z Custom Claims
//    Kiedy admin zmieni pole "role" w /users/{uid},
//    ta funkcja automatycznie aktualizuje Custom Claim.
// ═══════════════════════════════════════════════════════════════
exports.onRoleChange = onDocumentWritten(
  { document: "users/{uid}", region: "europe-west1" },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data?.after?.data();

    // Dokument usunięty — usuń claims
    if (!after) {
      try {
        await getAuth().setCustomUserClaims(uid, { role: null });
        console.log(`Claims usunięte dla ${uid}`);
      } catch (e) {
        console.error(`Błąd usuwania claims dla ${uid}:`, e);
      }
      return;
    }

    const newRole = after.role;

    // Walidacja roli
    if (!newRole || !VALID_ROLES.includes(newRole)) {
      console.warn(`Nieprawidłowa rola "${newRole}" dla ${uid}`);
      return;
    }

    // Sprawdź czy claim się zmienił (unikaj pętli)
    try {
      const userRecord = await getAuth().getUser(uid);
      const currentClaim = userRecord.customClaims?.role;

      if (currentClaim === newRole) {
        console.log(`Rola ${newRole} dla ${uid} już ustawiona, pomijam.`);
        return;
      }

      // Ustaw Custom Claim
      await getAuth().setCustomUserClaims(uid, {
        ...userRecord.customClaims,
        role: newRole,
      });

      // Zapisz timestamp wymuszający odświeżenie tokena po stronie klienta
      await getFirestore().doc(`users/${uid}`).update({
        claimsUpdatedAt: new Date().toISOString(),
      });

      console.log(`✅ Custom Claim ustawiony: ${uid} → ${newRole}`);
    } catch (e) {
      console.error(`Błąd ustawiania claims dla ${uid}:`, e);
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 2. CALLABLE FUNCTION — admin ustawia rolę przez API
//    Użycie z klienta: const setRole = httpsCallable(functions, "setUserRole");
//    await setRole({ uid: "abc123", role: "dyspozytor" });
// ═══════════════════════════════════════════════════════════════
exports.setUserRole = onCall(
  { region: "europe-west1" },
  async (request) => {
    // Sprawdź czy wywołujący jest adminem
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    }

    const callerRole = request.auth.token.role;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Tylko admin może zmieniać role.");
    }

    const { uid, role } = request.data;

    if (!uid || !role) {
      throw new HttpsError("invalid-argument", "Wymagane: uid i role.");
    }

    if (!VALID_ROLES.includes(role)) {
      throw new HttpsError("invalid-argument", `Nieprawidłowa rola. Dozwolone: ${VALID_ROLES.join(", ")}`);
    }

    // Nie pozwól adminowi usunąć sobie admina
    if (uid === request.auth.uid && role !== "admin") {
      throw new HttpsError("failed-precondition", "Nie możesz odebrać sobie roli admin.");
    }

    try {
      // Ustaw Custom Claim
      const userRecord = await getAuth().getUser(uid);
      await getAuth().setCustomUserClaims(uid, {
        ...userRecord.customClaims,
        role: role,
      });

      // Zaktualizuj też Firestore (żeby UI widział natychmiast)
      await getFirestore().doc(`users/${uid}`).set(
        { role: role, claimsUpdatedAt: new Date().toISOString() },
        { merge: true }
      );

      console.log(`✅ Admin ${request.auth.uid} zmienił rolę ${uid} → ${role}`);
      return { success: true, message: `Rola zmieniona na ${role}` };
    } catch (e) {
      console.error("Błąd setUserRole:", e);
      throw new HttpsError("internal", "Błąd zmiany roli.");
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// 3. SCHEDULED — wysyłka emaili ze statusami pojazdów
//    3x dziennie: 8:00, 14:00, 20:00 (Europe/Warsaw)
//    Odbiorcy z kolekcji Firestore: emailRecipients
// ═══════════════════════════════════════════════════════════════
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest }  = require("firebase-functions/v2/https");
const sgMail = require("@sendgrid/mail");

// Helper: pobierz dziś w formacie YYYY-MM-DD (Warsaw timezone)
function getTodayISO() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

// Helper: formatuj datę po polsku
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", timeZone: "Europe/Warsaw"
  });
}

// Helper: generuj HTML emaila
function buildEmailHTML(vehicles, frachtyList, pauzyList) {
  const todayISO = getTodayISO();

  const rows = vehicles.map(v => {
    const driverName = (v.driverHistory || []).find(d => !d.to)?.name || "—";
    const vFrachty = frachtyList
      .filter(r => r.vehicleId === v.id && r.dataZaladunku)
      .sort((a, b) => (b.dataZaladunku || "").localeCompare(a.dataZaladunku || ""));

    // Aktywny fracht
    const activeF = vFrachty.find(r => {
      if (!r.dataZaladunku || !r.dataRozladunku) return false;
      if (r.statusRozladunku === "rozladowano") return false;
      return r.dataZaladunku <= todayISO && todayISO <= r.dataRozladunku;
    });

    // Następny fracht
    const nextF = vFrachty
      .filter(r => r.dataZaladunku && r.dataZaladunku > todayISO)
      .sort((a, b) => a.dataZaladunku.localeCompare(b.dataZaladunku))[0] || null;

    // Ostatni rozładowany
    const lastDoneF = vFrachty
      .filter(r => r.dataRozladunku && r.dataRozladunku < todayISO)
      .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""))[0] || null;

    // Aktywna pauza
    const vehiclePauza = pauzyList.find(p =>
      p.vehicleId === v.id &&
      p.status !== "jazda" &&
      p.start <= todayISO &&
      p.end >= todayISO
    );

    let statusText = "";
    let statusColor = "#d97706";
    let statusBg = "#fffbeb";
    let details = "";

    if (activeF) {
      statusText = "🚛 W trasie";
      statusColor = "#15803d";
      statusBg = "#f0fdf4";
      const rozlKod = [activeF.dokod, activeF.dokod2, activeF.dokod3].filter(s => s && s.trim()).join(" / ") || "—";
      details = `Rozładunek: ${fmtDate(activeF.dataRozladunku)} · ${rozlKod}`;
    } else if (vehiclePauza) {
      const pauzaLabels = { pauza9: "Pauza 9h", pauza11: "Pauza 11h", pauza24: "Pauza 24h", pauza45: "Pauza 45h", pauzaInne: "Pauza", baza: "Baza" };
      statusText = `⏸️ ${pauzaLabels[vehiclePauza.status] || "Pauza"}`;
      statusColor = "#9333ea";
      statusBg = "#faf5ff";
      details = `Dostępny od: ${fmtDate(vehiclePauza.end)}`;
    } else if (nextF) {
      const nextZalMs = new Date(nextF.dataZaladunku + "T00:00:00").getTime();
      const todayMs = new Date(todayISO + "T00:00:00").getTime();
      const diffDays = Math.round((nextZalMs - todayMs) / 86400000);
      const zalKod = [nextF.zaladunekKod, nextF.zaladunekKod2, nextF.zaladunekKod3].filter(s => s && s.trim()).join(" / ") || "—";
      statusText = `📋 Załadunek za ${diffDays}d`;
      statusColor = "#1d4ed8";
      statusBg = "#eff6ff";
      details = `${fmtDate(nextF.dataZaladunku)} · ${zalKod}`;
    } else {
      const daysSince = lastDoneF
        ? Math.round((new Date(todayISO + "T00:00:00").getTime() - new Date(lastDoneF.dataRozladunku + "T00:00:00").getTime()) / 86400000)
        : null;
      statusText = `⏳ Wolny${daysSince ? ` · ${daysSince}d` : ""}`;
      statusColor = "#d97706";
      statusBg = "#fffbeb";
      const lastKod = lastDoneF
        ? ([lastDoneF.dokod, lastDoneF.dokod2, lastDoneF.dokod3].filter(s => s && s.trim()).join(" / ") || "—")
        : "—";
      details = lastDoneF ? `Ostatni rozł.: ${fmtDate(lastDoneF.dataRozladunku)} · ${lastKod}` : "Brak frachtów";
    }

    return `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
          <strong style="color:#111827;font-size:14px;">${v.plate}</strong>
          <br><span style="color:#9ca3af;font-size:12px;">${v.brand || ""} · ${driverName}</span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
          <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;color:${statusColor};background:${statusBg};">
            ${statusText}
          </span>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:13px;">
          ${details}
        </td>
      </tr>`;
  });

  const timeStr = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
  const dateStr = new Date().toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 32px;color:#fff;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">🚛 FleetStat — Status floty</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">${dateStr} · ${timeStr}</p>
    </div>

    <!-- PODSUMOWANIE -->
    <div style="padding:16px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:13px;color:#6b7280;">
        Pojazdów: <strong>${vehicles.length}</strong> ·
        W trasie: <strong>${rows.filter((_, i) => {
          const v = vehicles[i];
          const vf = frachtyList.filter(r => r.vehicleId === v.id && r.dataZaladunku);
          return vf.some(r => r.dataZaladunku <= todayISO && todayISO <= (r.dataRozladunku || "") && r.statusRozladunku !== "rozladowano");
        }).length}</strong> ·
        Wolnych: <strong>${vehicles.length - rows.filter((_, i) => {
          const v = vehicles[i];
          const vf = frachtyList.filter(r => r.vehicleId === v.id && r.dataZaladunku);
          return vf.some(r => r.dataZaladunku <= todayISO && todayISO <= (r.dataRozladunku || "") && r.statusRozladunku !== "rozladowano");
        }).length}</strong>
      </span>
    </div>

    <!-- TABELA -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Pojazd</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Szczegóły</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>

    <!-- FOOTER -->
    <div style="padding:16px 32px;background:#f9fafb;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9ca3af;">
        Wygenerowano automatycznie przez <a href="https://fleetstat.pl" style="color:#3b82f6;text-decoration:none;">FleetStat</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Główna funkcja wysyłki emaili
async function sendFleetStatusEmail() {
  const db = getFirestore();

  // 1. Pobierz SendGrid API key z konfiguracji
  const configSnap = await db.doc("config/email").get();
  if (!configSnap.exists() || !configSnap.data().sendgridApiKey) {
    console.error("Brak SendGrid API Key w config/email");
    return { success: false, error: "Brak konfiguracji SendGrid" };
  }
  const config = configSnap.data();
  sgMail.setApiKey(config.sendgridApiKey);

  // 2. Pobierz aktywnych odbiorców
  const recipientsSnap = await db.collection("emailRecipients").where("active", "==", true).get();
  if (recipientsSnap.empty) {
    console.log("Brak aktywnych odbiorców emaili");
    return { success: false, error: "Brak odbiorców" };
  }
  const recipients = recipientsSnap.docs.map(d => d.data().email);

  // 3. Pobierz dane floty
  const fleetSnap = await db.doc("fleet/data").get();
  if (!fleetSnap.exists()) {
    console.error("Brak danych floty");
    return { success: false, error: "Brak danych floty" };
  }
  const fleetData = fleetSnap.data();
  const vehicles = fleetData.fleetv2_vehicles || [];
  const frachtyList = fleetData.fleetv2_frachty || [];

  // 4. Pobierz pauzy
  const pauzySnap = await db.collection("pauzy").get();
  const pauzyList = pauzySnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 5. Generuj HTML
  const html = buildEmailHTML(vehicles, frachtyList, pauzyList);

  const todayPL = new Date().toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", timeZone: "Europe/Warsaw"
  });
  const timeStr = new Date().toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw"
  });

  // 6. Wyślij
  try {
    await sgMail.sendMultiple({
      to: recipients,
      from: config.senderEmail || "fleetstat@fleetstat.pl",
      subject: `🚛 FleetStat — Status floty · ${todayPL} · ${timeStr}`,
      html: html,
    });
    console.log(`✅ Email wysłany do ${recipients.length} odbiorców: ${recipients.join(", ")}`);

    // 7. Zapisz log wysyłki
    await db.collection("emailLogs").add({
      sentAt: new Date().toISOString(),
      recipients: recipients,
      vehicleCount: vehicles.length,
      status: "sent",
    });

    return { success: true, recipients: recipients.length };
  } catch (e) {
    console.error("Błąd wysyłki email:", e);
    await db.collection("emailLogs").add({
      sentAt: new Date().toISOString(),
      recipients: recipients,
      status: "error",
      error: e.message,
    });
    return { success: false, error: e.message };
  }
}

// SCHEDULER: 8:00 CET
exports.sendFleetEmail8 = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => { await sendFleetStatusEmail(); }
);

// SCHEDULER: 14:00 CET
exports.sendFleetEmail14 = onSchedule(
  { schedule: "0 14 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => { await sendFleetStatusEmail(); }
);

// SCHEDULER: 20:00 CET
exports.sendFleetEmail20 = onSchedule(
  { schedule: "0 20 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => { await sendFleetStatusEmail(); }
);

// CALLABLE: ręczna wysyłka testowa (admin)
exports.sendFleetEmailNow = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    if (request.auth.token.role !== "admin") throw new HttpsError("permission-denied", "Tylko admin.");
    return await sendFleetStatusEmail();
  }
);
