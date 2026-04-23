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

const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError }  = require("firebase-functions/v2/https");
const { defineSecret }        = require("firebase-functions/params");
const { initializeApp }       = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore }        = require("firebase-admin/firestore");
const { getMessaging }        = require("firebase-admin/messaging");
const { getStorage }          = require("firebase-admin/storage");
const crypto                  = require("crypto");

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
// 2b. CALLABLE — admin dodaje kierowcę po emailu
//     Szuka UID w Firebase Auth, ustawia rolę kierowca + tworzy/aktualizuje Firestore
// ═══════════════════════════════════════════════════════════════
exports.addDriverByEmail = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    const callerRole = request.auth.token.role;
    if (callerRole !== "admin") throw new HttpsError("permission-denied", "Tylko admin.");

    const { email, displayName } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "Wymagany email.");

    try {
      // Szukaj użytkownika w Firebase Auth po emailu
      let userRecord;
      try {
        userRecord = await getAuth().getUserByEmail(email.trim().toLowerCase());
      } catch (e) {
        // Użytkownik nie istnieje w Auth — zwróć błąd
        throw new HttpsError("not-found", `Konto ${email} nie istnieje w Firebase Auth. Najpierw załóż konto w konsoli Firebase.`);
      }

      const uid = userRecord.uid;

      // Ustaw Custom Claims
      await getAuth().setCustomUserClaims(uid, {
        ...userRecord.customClaims,
        role: "kierowca",
      });

      // Utwórz/aktualizuj dokument w Firestore
      await getFirestore().doc(`users/${uid}`).set({
        email: email.trim().toLowerCase(),
        role: "kierowca",
        displayName: displayName || userRecord.displayName || email.split("@")[0],
        claimsUpdatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`✅ Admin ${request.auth.uid} dodał kierowcę: ${email} (uid: ${uid})`);
      return { success: true, uid, email, displayName: displayName || userRecord.displayName || email.split("@")[0] };
    } catch (e) {
      if (e.code) throw e; // re-throw HttpsError
      console.error("Błąd addDriverByEmail:", e);
      throw new HttpsError("internal", "Błąd dodawania kierowcy.");
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

  // Oblicz statusy osobno, żeby mieć dostęp do danych w podsumowaniu
  const vehicleData = vehicles.filter(v => !v.archived).map(v => {
    const driverName = (v.driverHistory || []).find(d => !d.to)?.name || "—";
    const vFrachty = frachtyList
      .filter(r => r.vehicleId === v.id && r.dataZaladunku)
      .sort((a, b) => (b.dataZaladunku || "").localeCompare(a.dataZaladunku || ""));

    // Aktywny fracht — w trasie
    const activeF = vFrachty.find(r => {
      if (!r.dataZaladunku || !r.dataRozladunku) return false;
      if (r.statusRozladunku === "rozladowano") return false;
      return r.dataZaladunku <= todayISO && todayISO <= r.dataRozladunku;
    });

    // Następny fracht (przyszły załadunek)
    const nextF = vFrachty
      .filter(r => r.dataZaladunku && r.dataZaladunku > todayISO && r.statusRozladunku !== "rozladowano")
      .sort((a, b) => a.dataZaladunku.localeCompare(b.dataZaladunku))[0] || null;

    // Ostatni rozładowany fracht
    const lastDoneF = vFrachty
      .filter(r => r.statusRozladunku === "rozladowano" || (r.dataRozladunku && r.dataRozladunku < todayISO))
      .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""))[0] || null;

    // Aktywna pauza
    const vehiclePauza = pauzyList.find(p =>
      p.vehicleId === v.id &&
      p.status !== "jazda" &&
      p.start <= todayISO &&
      p.end >= todayISO
    );

    // Info o pojeździe — typ, wymiary, wyposażenie
    const hasWinda = (v.equipment || []).includes("winda");
    const hasPrzyczepa = v.plate2 && v.plate2.trim() !== "";
    const typeLabel = hasPrzyczepa ? `${v.type || "Bus"} + Przyczepa` : (v.type || "");
    const dims = v.dimensions || "";
    const dims2 = v.dimensions2 || "";
    const dimsLabel = hasPrzyczepa && dims && dims2
      ? `${dims} + ${dims2}`
      : dims;
    const vehicleInfo = [typeLabel, dimsLabel, hasWinda ? "Winda" : ""].filter(Boolean).join(" · ");
    const plate2 = v.plate2 ? ` + ${v.plate2}` : "";

    let statusText = "";
    let statusColor = "#d97706";
    let statusBg = "#fffbeb";
    let statusType = "wolny";
    let details = "";

    if (activeF) {
      statusText = "🚛 W trasie";
      statusColor = "#15803d";
      statusBg = "#f0fdf4";
      statusType = "trasa";
      // Pokaż OSTATNI rozładunek w ciągu (jeśli po aktywnym jest nextF — tam auto jedzie na końcu)
      const pendingFrachty = vFrachty
        .filter(r => r.statusRozladunku !== "rozladowano" && r.dataRozladunku && r.dataRozladunku >= todayISO)
        .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""));
      const lastPending = pendingFrachty[0] || activeF;
      const rozlKod = [lastPending.dokod, lastPending.dokod2, lastPending.dokod3].filter(s => s && s.trim()).pop() || "—";
      const rozlDate = lastPending.dataRozladunku ? fmtDate(lastPending.dataRozladunku) : "";
      details = rozlDate ? `${rozlKod} · ${rozlDate}` : rozlKod;
    } else if (vehiclePauza) {
      const pauzaLabels = { pauza9: "Pauza 9h", pauza11: "Pauza 11h", pauza24: "Pauza 24h", pauza45: "Pauza 45h", pauzaInne: "Pauza", baza: "Baza" };
      statusText = vehiclePauza.status === "baza" ? "🏠 Baza" : `⏸️ ${pauzaLabels[vehiclePauza.status] || "Pauza"}`;
      statusColor = vehiclePauza.status === "baza" ? "#0369a1" : "#9333ea";
      statusBg = vehiclePauza.status === "baza" ? "#f0f9ff" : "#faf5ff";
      statusType = "pauza";
      const BAZA_KOD = "PL 25-611 Kielce";
      // Dla statusu "baza" → kod bazy; dla pauzy w trasie → ostatni kod rozładunku
      let locationKod = BAZA_KOD;
      if (vehiclePauza.status !== "baza") {
        // Weź kod z ostatniego rozładowanego frachtu (tam kierowca faktycznie stoi)
        const refF = lastDoneF || activeF;
        if (refF) {
          locationKod = [refF.dokod, refF.dokod2, refF.dokod3].filter(s => s && s.trim()).pop() || BAZA_KOD;
        }
      }
      details = `Dostępny od: ${fmtDate(vehiclePauza.end)} · ${locationKod}`;
    } else if (nextF) {
      // Załadunek zaplanowany = traktuj jako "W trasie" (auto nie jest dostępne)
      statusText = "🚛 W trasie";
      statusColor = "#15803d";
      statusBg = "#f0fdf4";
      statusType = "trasa";
      // Pokaż OSTATNI rozładunek z przyszłych frachtów (tam auto jedzie na końcu)
      const futureFrachty = vFrachty
        .filter(r => r.statusRozladunku !== "rozladowano" && r.dataRozladunku && r.dataRozladunku >= todayISO)
        .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""));
      const lastFuture = futureFrachty[0] || nextF;
      const nextKod = [lastFuture.dokod, lastFuture.dokod2, lastFuture.dokod3].filter(s => s && s.trim()).pop() || "—";
      const nextDate = lastFuture.dataRozladunku ? fmtDate(lastFuture.dataRozladunku) : "";
      details = nextDate ? `${nextKod} · ${nextDate}` : nextKod;
    } else {
      const daysSince = lastDoneF
        ? Math.round((new Date(todayISO + "T00:00:00").getTime() - new Date(lastDoneF.dataRozladunku + "T00:00:00").getTime()) / 86400000)
        : null;
      statusText = `🔴 DO PODJĘCIA${daysSince ? ` · ${daysSince}d` : ""}`;
      statusColor = "#dc2626";
      statusBg = "#fef2f2";
      statusType = "wolny";
      // Pokaż ostatni kod rozładunku + datę rozładunku
      const lastKod = lastDoneF
        ? ([lastDoneF.dokod, lastDoneF.dokod2, lastDoneF.dokod3].filter(s => s && s.trim()).pop() || "—")
        : "—";
      const lastDate = lastDoneF?.dataRozladunku ? fmtDate(lastDoneF.dataRozladunku) : "";
      details = lastDoneF ? (lastDate ? `${lastKod} · ${lastDate}` : lastKod) : "Brak frachtów";
    }

    return { v, driverName, vehicleInfo, plate2, statusText, statusColor, statusBg, statusType, details };
  });

  // Filtruj: ukryj pojazdy "wolny" powyżej 30 dni
  const INACTIVE_DAYS = 30;
  const activeVehicles = vehicleData.filter(d => {
    if (d.statusType !== "wolny") return true;
    // Sprawdź ile dni wolny
    const match = d.statusText.match(/(\d+)d/);
    const days = match ? parseInt(match[1]) : 0;
    return days < INACTIVE_DAYS;
  });

  // Sortuj: DO PODJĘCIA (wolny) na górze → W trasie → Pauza/Baza
  const order = { wolny: 0, trasa: 1, pauza: 2 };
  activeVehicles.sort((a, b) => (order[a.statusType] ?? 9) - (order[b.statusType] ?? 9));

  // Layout kartowy (mobile-friendly): 1 wiersz per pojazd, w środku nazwa + plakietka + detale.
  // Rezygnujemy z tabeli 3-kolumnowej bo na iPhone łamała kolumny i plakietka nachodziła na tekst.
  const rows = activeVehicles.map(({ v, vehicleInfo, plate2, statusText, statusColor, statusBg, details }) => {
    return `
      <tr>
        <td style="padding:14px 20px;border-bottom:1px solid #f3f4f6;">
          <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.35;margin-bottom:6px;word-break:break-word;">
            ${vehicleInfo || v.type || "—"}
          </div>
          <div style="font-size:13px;color:#6b7280;line-height:1.45;word-break:break-word;">
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;color:${statusColor};background:${statusBg};white-space:nowrap;vertical-align:middle;margin-right:8px;">
              ${statusText}
            </span>
            ${details}
          </div>
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
  <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- HEADER -->
    <div style="background:linear-gradient(135deg,#1e293b,#334155);padding:28px 36px;color:#fff;">
      <h1 style="margin:0;font-size:22px;font-weight:700;">🚛 FleetStat — Status floty</h1>
      <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">${dateStr} · ${timeStr}</p>
    </div>

    <!-- PODSUMOWANIE -->
    <div style="padding:16px 32px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:13px;color:#6b7280;">
        W trasie: <strong>${activeVehicles.filter(d => d.statusType === "trasa").length}</strong> ·
        Pauza/Baza: <strong>${activeVehicles.filter(d => d.statusType === "pauza").length}</strong>
      </span>
    </div>

    <!-- LISTA POJAZDÓW -->
    <table style="width:100%;border-collapse:collapse;">
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
  if (!configSnap.exists || !configSnap.data().sendgridApiKey) {
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
  if (!fleetSnap.exists) {
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

// ═══════════════════════════════════════════════════════════════
// CLEANUP GPS BREADCRUMBS — kasuje punkty starsze niż 7 dni
// Raz dziennie o 2:30 CET. Chroni przed niekontrolowanym wzrostem storage.
// ═══════════════════════════════════════════════════════════════
exports.cleanupBreadcrumbs = onSchedule(
  { schedule: "30 2 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => {
    const db = getFirestore();
    const cutoffMs = Date.now() - 7 * 24 * 3600 * 1000;
    let totalDeleted = 0;
    try {
      const vehicleDocs = await db.collection("gpsBreadcrumbs").listDocuments();
      for (const vehRef of vehicleDocs) {
        const snap = await vehRef.collection("points").where("ts", "<", cutoffMs).get();
        if (snap.empty) continue;
        // Firestore batch limit 500 operacji — tnij na chunki
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = db.batch();
          docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        totalDeleted += docs.length;
        console.log(`cleanupBreadcrumbs: vehicle ${vehRef.id} — skasowano ${docs.length}`);
      }
      console.log(`cleanupBreadcrumbs: łącznie skasowano ${totalDeleted} punktów starszych niż 7 dni`);
    } catch (e) {
      console.error("cleanupBreadcrumbs error:", e);
    }
  }
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

// ═══════════════════════════════════════════════════════════════
// 4. PUSH NOTIFICATIONS — nowa wiadomość w czacie
//    Trigger: nowy dokument w chatRooms/{roomId}/messages
//    Wysyła push do wszystkich członków pokoju OPRÓCZ nadawcy
// ═══════════════════════════════════════════════════════════════
exports.onNewChatMessage = onDocumentCreated(
  { document: "chatRooms/{roomId}/messages/{msgId}", region: "europe-west1" },
  async (event) => {
    const msgData = event.data?.data();
    if (!msgData) { console.log("❌ No message data"); return; }

    const roomId = event.params.roomId;
    const senderId = msgData.senderId;
    const senderName = msgData.senderName || msgData.senderEmail?.split("@")[0] || "Ktoś";
    const text = msgData.deleted ? "Wiadomość usunięta" : (msgData.text || "📎 Plik");

    console.log(`📨 New msg in room ${roomId} from ${senderName} (${senderId}): "${text.slice(0, 50)}"`);

    const db = getFirestore();

    // 1. Pobierz dane pokoju (członkowie, nazwa)
    const roomSnap = await db.doc(`chatRooms/${roomId}`).get();
    if (!roomSnap.exists) { console.log("❌ Room not found:", roomId); return; }
    const room = roomSnap.data();
    const roomName = room.name || "Czat";
    const members = room.members || [];

    console.log(`📋 Room "${roomName}" type=${room.type} members=[${members.join(", ")}]`);

    // 2. Pobierz FCM tokeny członków (oprócz nadawcy)
    const recipientUids = members.filter(uid => uid !== senderId);
    if (recipientUids.length === 0) { console.log("⚠️ No recipients (sender is only member)"); return; }

    console.log(`👥 Recipients: [${recipientUids.join(", ")}]`);

    // Pobierz WSZYSTKIE tokeny dla odbiorców (wiele urządzeń per user)
    const allTokenSnaps = await db.collection("fcmTokens")
      .where("uid", "in", recipientUids.slice(0, 30))
      .get();
    const tokens = allTokenSnaps.docs
      .filter(d => d.data().token)
      .map(d => ({ docId: d.id, uid: d.data().uid, token: d.data().token, platform: d.data().platform || "unknown" }));

    console.log(`🔑 Found ${tokens.length} tokens: ${tokens.map(t => `${t.platform}(${t.token.slice(0,8)}...)`).join(", ")}`);

    if (tokens.length === 0) { console.log("⚠️ No FCM tokens found for recipients"); return; }

    // 3. Wyślij push notifications (DATA-ONLY — iOS Safari PWA wymaga tego)
    const pushTitle = room.type === "dm" ? senderName : `${roomName}`;
    const pushBody = room.type === "dm" ? text : `${senderName}: ${text}`;
    const messaging = getMessaging();
    const results = await Promise.allSettled(
      tokens.map(({ token }) =>
        messaging.send({
          token,
          // BEZ notification — data-only message wymusza obsługę przez Service Worker push event
          data: {
            title: pushTitle,
            body: pushBody,
            roomId,
            senderId,
            type: "chat",
            icon: "/icon-192.png",
          },
          webpush: {
            headers: { Urgency: "high", TTL: "86400" },
          },
        })
      )
    );

    // 4. Loguj wyniki per token
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`✅ Push OK → ${tokens[i].platform} (${tokens[i].token.slice(0,8)}...)`);
      } else {
        console.log(`❌ Push FAIL → ${tokens[i].platform} (${tokens[i].token.slice(0,8)}...): ${r.reason?.code || r.reason?.message || r.reason}`);
      }
    });

    // 5. Usuń nieaktywne tokeny
    const failedDocIds = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.code === "messaging/registration-token-not-registered") {
        failedDocIds.push(tokens[i].docId);
      }
    });
    if (failedDocIds.length > 0) {
      console.log(`🗑️ Removing ${failedDocIds.length} invalid tokens`);
      await Promise.all(failedDocIds.map(id => db.doc(`fcmTokens/${id}`).delete()));
    }

    const sent = results.filter(r => r.status === "fulfilled").length;
    console.log(`📊 Push sent: ${sent}/${tokens.length} for room ${roomName}`);
  }
);

// ═══════════════════════════════════════════════════════════════
// 5. GPS PROXY — Atlas API (widziszwszystko.eu)
//    Callable function: pośredniczy w zapytaniach do API GPS.
//    Credentiale w Firestore: config/gps
//    Dostępne endpointy: devices, positions, positionsWithCanDetails, history
// ═══════════════════════════════════════════════════════════════
const ATLAS_BASE = "https://widziszwszystko.eu/atlas";
const ATLAS_ALLOWED = ["devices", "positions", "positionsWithDistance", "positionsWithCanDistance", "positionsWithCanDetails", "history"];

exports.gpsProxy = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    // Auth check — must be logged in
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz byc zalogowany.");
    }
    const callerRole = request.auth.token.role;
    if (!["admin", "dyspozytor"].includes(callerRole)) {
      throw new HttpsError("permission-denied", "Brak dostepu do GPS.");
    }

    const { endpoint, params } = request.data || {};
    if (!endpoint || !ATLAS_ALLOWED.includes(endpoint)) {
      throw new HttpsError("invalid-argument", `Nieprawidlowy endpoint. Dozwolone: ${ATLAS_ALLOWED.join(", ")}`);
    }

    // Get GPS credentials from Firestore config (or fallback defaults)
    const db = getFirestore();
    let group, username, password;
    const configSnap = await db.doc("config/gps").get();
    if (configSnap.exists && configSnap.data().group) {
      ({ group, username, password } = configSnap.data());
    } else {
      // Fallback — auto-create config in Firestore for future use
      group = "vbs"; username = "vbs"; password = "Vbs7";
      await db.doc("config/gps").set({ group, username, password, updatedAt: new Date().toISOString(), autoCreated: true });
      console.log("GPS config auto-created in Firestore");
    }

    // Build URL
    let url = `${ATLAS_BASE}/${group}/${username}/${endpoint}`;

    // For history endpoint, add year/month params
    if (endpoint === "history" && params) {
      const qp = new URLSearchParams();
      if (params.year) qp.set("year", params.year);
      if (params.month) qp.set("month", params.month);
      if (params.device) qp.set("device", params.device);
      const qs = qp.toString();
      if (qs) url += `?${qs}`;
    }

    // Try multiple auth methods (API docs are ambiguous)
    const authVariants = [
      { name: "base64-pass", headers: { "Authorization": Buffer.from(password).toString("base64") } },
      { name: "basic-user-pass", headers: { "Authorization": "Basic " + Buffer.from(`${username}:${password}`).toString("base64") } },
      { name: "basic-pass", headers: { "Authorization": "Basic " + Buffer.from(password).toString("base64") } },
      { name: "query-pass", headers: {}, querySuffix: `${url.includes("?") ? "&" : "?"}=${password}` },
    ];

    // If specific auth method is known (saved from previous success), use only that
    const knownAuth = request.data?.authMethod;
    const tryVariants = knownAuth
      ? authVariants.filter(v => v.name === knownAuth)
      : authVariants;

    const results = [];
    for (const variant of tryVariants) {
      const tryUrl = url + (variant.querySuffix || "");
      try {
        console.log(`GPS Proxy: trying ${variant.name} -> ${tryUrl}`);
        const resp = await fetch(tryUrl, {
          method: "GET",
          headers: { "Accept": "application/json", ...variant.headers },
          signal: AbortSignal.timeout(15000),
        });

        const body = await resp.text();
        results.push({ method: variant.name, status: resp.status, bodyPreview: body.slice(0, 500) });

        if (resp.ok) {
          let data;
          try { data = JSON.parse(body); } catch { data = body; }
          console.log(`GPS Proxy OK with ${variant.name}: ${endpoint}`);
          return { success: true, data, endpoint, authMethod: variant.name, timestamp: new Date().toISOString() };
        }
      } catch (e) {
        results.push({ method: variant.name, error: e.message });
      }
    }

    // All failed — return diagnostic info
    console.error("GPS Proxy: all auth methods failed", JSON.stringify(results));
    return { success: false, error: "Wszystkie metody auth zawiodly", diagnostics: results, url, endpoint };
  }
);

// ── GPS CONFIG SETUP (one-time admin callable) ──
exports.setGpsConfig = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musisz byc zalogowany.");
    if (request.auth.token.role !== "admin") throw new HttpsError("permission-denied", "Tylko admin.");

    const { group, username, password } = request.data || {};
    if (!group || !username || !password) {
      throw new HttpsError("invalid-argument", "Wymagane: group, username, password.");
    }

    await getFirestore().doc("config/gps").set({
      group, username, password,
      updatedAt: new Date().toISOString(),
      updatedBy: request.auth.uid,
    });

    console.log(`GPS config updated by ${request.auth.uid}`);
    return { success: true };
  }
);

// ═══════════════════════════════════════════════════════════════
// PARSER DDD — odczyt plików .ddd z tachografu / karty kierowcy
//   Trigger: onCall (client wywołuje po uploadzie do Storage)
//   Flow: client → Storage → wywołuje parseDddFile → Cloud Function
//         → pobiera plik → readesm-js.convertToJson → Firestore
// ═══════════════════════════════════════════════════════════════

// Helper: znajduje blok po nazwie klasy lub wybranych polach
function findBlock(blocks, predicate) {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    try { if (predicate(b)) return b; } catch {}
  }
  return null;
}

// Helper: konwertuje TimeReal / BcdDate z readesm-js na ISO string
function timeRealToIso(tr) {
  if (!tr) return null;
  // Różne formaty jakie zwraca readesm-js
  if (typeof tr === "string") return tr;
  if (typeof tr === "number") return new Date(tr * 1000).toISOString();
  if (tr.timestamp) return new Date(tr.timestamp * 1000).toISOString();
  if (tr.date && tr.date instanceof Date) return tr.date.toISOString();
  if (tr.year && tr.month) {
    try {
      return new Date(tr.year, (tr.month || 1) - 1, tr.day || 1).toISOString();
    } catch {}
  }
  return null;
}

// Helper: wyciąga metadane ze sparsowanego DDD
function extractDddMetadata(parsed) {
  const meta = {
    fileType: "unknown",
    cardNumber: null,
    driverFirstName: null,
    driverSurname: null,
    driverName: null,
    vehicleVrn: null,
    cardValidityBegin: null,
    cardExpiryDate: null,
    periodStart: null,
    periodEnd: null,
  };
  if (!parsed) return meta;

  const blocks = parsed.blocks || [];

  // Identification — plik karty kierowcy
  const ident = findBlock(blocks, b =>
    (b.className && /Identification/i.test(b.className)) ||
    (b.cardNumber && b.cardHolderName));
  if (ident) {
    meta.fileType = "card";
    meta.cardNumber = ident.cardNumber || null;
    if (ident.cardHolderName) {
      meta.driverFirstName = ident.cardHolderName.firstName || ident.cardHolderName.holderFirstNames || null;
      meta.driverSurname = ident.cardHolderName.surname || ident.cardHolderName.holderSurname || null;
      meta.driverName = [meta.driverFirstName, meta.driverSurname].filter(Boolean).join(" ") || null;
    }
    meta.cardValidityBegin = timeRealToIso(ident.cardValidityBegin);
    meta.cardExpiryDate = timeRealToIso(ident.cardExpiryDate);
  }

  // VuOverview — plik pamięci tachografu (vehicle unit)
  const vu = findBlock(blocks, b =>
    (b.className && /VuOverview/i.test(b.className)) ||
    b.vehicleRegistrationNumber || b.vehicleIdentificationNumber);
  if (vu) {
    if (meta.fileType === "unknown") meta.fileType = "vu";
    meta.vehicleVrn = vu.vehicleRegistrationNumber?.vehicleRegistrationNumber ||
                      vu.vehicleRegistrationNumber || null;
    if (typeof meta.vehicleVrn === "object") meta.vehicleVrn = null;
  }

  // Zakres dat — z CardDriverActivity lub VuActivities
  const activity = findBlock(blocks, b =>
    (b.className && /DriverActivity|VuActivities/i.test(b.className)));
  if (activity) {
    meta.periodStart = timeRealToIso(activity.activityPointerOldestDayRecord) ||
                       timeRealToIso(activity.oldestDayRecord);
    meta.periodEnd = timeRealToIso(activity.activityPointerNewestDayRecord) ||
                     timeRealToIso(activity.newestDayRecord);
  }

  return meta;
}

// Helper: wyciąga segmenty aktywności ze sparsowanego DDD
// Mapowanie typów tachografu → naszych:
//   0 = rest       → "rest"
//   1 = available  → "avail"
//   2 = work       → "work"
//   3 = driving    → "drive"
function extractDddActivities(parsed, context = {}) {
  const activities = [];
  if (!parsed) return activities;
  const blocks = parsed.blocks || [];

  const typeMap = { 0: "rest", 1: "avail", 2: "work", 3: "drive" };

  // Szukamy CardDriverActivity → cardActivityDailyRecords → changeInfo[]
  const cardActivity = findBlock(blocks, b =>
    b.cardActivityDailyRecords || (b.className && /CardDriverActivity/i.test(b.className)));
  if (cardActivity?.cardActivityDailyRecords) {
    const records = cardActivity.cardActivityDailyRecords.subblocks ||
                    cardActivity.cardActivityDailyRecords.items ||
                    cardActivity.cardActivityDailyRecords || [];
    for (const rec of Array.isArray(records) ? records : []) {
      const dayDate = timeRealToIso(rec.activityRecordDate || rec.dayDate);
      const changes = rec.activityChangeInfos || rec.changes || rec.changeInfo || [];
      if (!Array.isArray(changes) || changes.length === 0) continue;
      // Zamień listę zmian stanu → segmenty
      for (let i = 0; i < changes.length; i++) {
        const ch = changes[i];
        const nextCh = changes[i + 1];
        const type = typeMap[ch.activity ?? ch.type] || "avail";
        const startMinutes = ch.timeOfChange ?? ch.minute ?? 0;
        const endMinutes = nextCh ? (nextCh.timeOfChange ?? nextCh.minute ?? 1440) : 1440;
        if (dayDate && endMinutes > startMinutes) {
          const startTs = new Date(new Date(dayDate).getTime() + startMinutes * 60000).toISOString();
          const endTs = new Date(new Date(dayDate).getTime() + endMinutes * 60000).toISOString();
          activities.push({
            driverCardNumber: context.cardNumber || null,
            driverName: context.driverName || null,
            type,
            startTs,
            endTs,
            source: "ddd",
            dddFileId: context.dddFileId || null,
          });
        }
      }
    }
  }

  // TODO: Dla plików VU (pamięć tachografu) też możemy wyciągać aktywności,
  // ale struktura jest inna — dodamy gdy zobaczymy pierwszy prawdziwy plik

  return activities;
}

exports.parseDddFile = onCall(
  { region: "europe-west1", memory: "512MiB", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Musisz byc zalogowany.");
    }
    const callerRole = request.auth.token.role;
    if (!["admin", "dyspozytor"].includes(callerRole)) {
      throw new HttpsError("permission-denied", "Brak dostepu do parsera DDD.");
    }

    const { storagePath, originalFileName } = request.data || {};
    if (!storagePath) {
      throw new HttpsError("invalid-argument", "Wymagany: storagePath");
    }

    console.log(`[DDD parse] Starting for ${storagePath}`);

    // Pobierz plik ze Storage
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", `Plik nie istnieje: ${storagePath}`);
    }

    const [buffer] = await file.download();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Parsuj przez readesm-js
    let parsed;
    try {
      const { convertToJson } = require("readesm-js");
      parsed = convertToJson(arrayBuffer);
    } catch (e) {
      console.error("[DDD parse] readesm-js error:", e);
      throw new HttpsError("internal", `Blad parsowania DDD: ${e.message}`);
    }

    // Wyciągnij metadane i aktywności
    const metadata = extractDddMetadata(parsed);
    const db = getFirestore();

    // Zapisz dokument pliku
    const dddDoc = {
      storagePath,
      originalFileName: originalFileName || storagePath.split("/").pop(),
      uploadedBy: request.auth.token.email || request.auth.uid,
      uploadedAt: new Date().toISOString(),
      fileSize: buffer.length,
      ...metadata,
      blockCount: (parsed?.blocks || []).length,
      parseStatus: "success",
    };
    const dddRef = await db.collection("dddFiles").add(dddDoc);

    const activities = extractDddActivities(parsed, {
      cardNumber: metadata.cardNumber,
      driverName: metadata.driverName,
      dddFileId: dddRef.id,
    });

    // Zapisz aktywności w batchach (max 500 per batch)
    const batchSize = 400;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = db.batch();
      for (const act of activities.slice(i, i + batchSize)) {
        const ref = db.collection("driverActivities").doc();
        batch.set(ref, { ...act, createdAt: new Date().toISOString() });
      }
      await batch.commit();
    }

    // Uaktualnij dokument o liczbę aktywności
    await dddRef.update({ activitiesCount: activities.length });

    console.log(`[DDD parse] Saved ${activities.length} activities, fileId=${dddRef.id}, type=${metadata.fileType}`);

    return {
      success: true,
      fileId: dddRef.id,
      metadata,
      activitiesCount: activities.length,
    };
  }
);

// ═══════════════════════════════════════════════════════════════
// WHATSAPP BUSINESS CLOUD API — wysyłka i odbiór wiadomości
//   sendWhatsappMessage — onCall, admin/dyspozytor wysyła do kierowcy
//   whatsappWebhook     — onRequest, Meta push (incoming + delivery status)
// ═══════════════════════════════════════════════════════════════

const WHATSAPP_TOKEN          = defineSecret("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID       = defineSecret("WHATSAPP_PHONE_ID");
const WHATSAPP_APP_SECRET     = defineSecret("WHATSAPP_APP_SECRET");
const WHATSAPP_VERIFY_TOKEN   = defineSecret("WHATSAPP_VERIFY_TOKEN");

const WA_API_VERSION = "v25.0";
const WA_ROOM_PREFIX = "whatsapp_"; // chatRooms/whatsapp_{driverUid}

// Helper — wywołanie Graph API z payloadem
async function callWhatsappApi(phoneId, token, payload) {
  const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await resp.text();
  let data;
  try { data = JSON.parse(body); } catch { data = { raw: body }; }
  if (!resp.ok) {
    const errMsg = data?.error?.message || `HTTP ${resp.status}`;
    const errCode = data?.error?.code || resp.status;
    const errType = data?.error?.type || "";
    const errDetails = data?.error?.error_data?.details || "";
    const fbtrace = data?.error?.fbtrace_id || "";
    // Log błąd Mety do GCP Logging — bez dump'owania całego HTML jeśli dostaliśmy stronę
    const rawPreview = typeof data?.raw === "string" ? data.raw.slice(0, 200) + "..." : null;
    console.error("[WA send] Meta API error", {
      status: resp.status,
      code: errCode,
      type: errType,
      message: errMsg,
      details: errDetails,
      fbtrace,
      ...(rawPreview ? { rawPreview } : {}),
    });
    const fullMsg = errDetails ? `${errMsg} — ${errDetails}` : errMsg;
    throw new HttpsError("internal", `WhatsApp API (${errCode}): ${fullMsg}`, { code: errCode, type: errType });
  }
  return data;
}

// Helper — zapewnia że pokój kierowcy istnieje (shared dla wszystkich dyspozytorów)
async function ensureWhatsappRoom(driverUid, driverData) {
  const db = getFirestore();
  const roomId = `${WA_ROOM_PREFIX}${driverUid}`;
  const roomRef = db.doc(`chatRooms/${roomId}`);
  const snap = await roomRef.get();
  if (!snap.exists) {
    await roomRef.set({
      id: roomId,
      type: "whatsapp",
      channel: "whatsapp",
      name: driverData?.displayName || driverData?.email || "Kierowca",
      driverUid,
      driverEmail: driverData?.email || null,
      whatsappNumber: driverData?.whatsappNumber || null,
      members: [driverUid], // dyspozytorzy widzą przez type==="whatsapp"
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: "",
    });
  }
  return roomRef;
}

// ── sendWhatsappMessage — onCall ──
// Request data:
//   { driverUid, type: "text"|"location"|"template", content: {...}, frachtId? }
// type="text":     content = { body: "...", signature?: "Agnieszka Wrona" }
// type="location": content = { latitude, longitude, name?, address? }
// type="template": content = { templateName, languageCode, components: [...] }
exports.sendWhatsappMessage = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 30,
    secrets: [WHATSAPP_TOKEN, WHATSAPP_PHONE_ID],
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Musisz być zalogowany.");
    const callerRole = request.auth.token.role;
    if (!["admin", "dyspozytor"].includes(callerRole)) {
      throw new HttpsError("permission-denied", "Tylko admin/dyspozytor może wysyłać wiadomości.");
    }

    const { driverUid, type, content, frachtId } = request.data || {};
    if (!driverUid || !type || !content) {
      throw new HttpsError("invalid-argument", "Wymagane: driverUid, type, content.");
    }
    if (!["text", "location", "template"].includes(type)) {
      throw new HttpsError("invalid-argument", `Nieprawidłowy typ: ${type}`);
    }

    const db = getFirestore();
    const driverSnap = await db.doc(`users/${driverUid}`).get();
    if (!driverSnap.exists) throw new HttpsError("not-found", "Kierowca nie istnieje.");
    const driver = driverSnap.data();
    const toNumber = driver.whatsappNumber;
    if (!toNumber) throw new HttpsError("failed-precondition", "Kierowca nie ma przypisanego numeru WhatsApp.");

    // Pobierz nadawcę
    const senderSnap = await db.doc(`users/${request.auth.uid}`).get();
    const sender = senderSnap.exists ? senderSnap.data() : {};
    const senderName = sender.displayName || sender.name || (sender.email || "").split("@")[0] || "Dyspozytor";

    // Zbuduj payload Meta
    let payload;
    let previewText = "";
    if (type === "text") {
      // Dyspozytor podpisuje treść na początku: *Imię Nazwisko:*\n{body}
      const rawBody = content.body || "";
      const useSignature = content.signature !== false; // default true
      const finalBody = useSignature ? `*${senderName}:*\n${rawBody}` : rawBody;
      payload = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body: finalBody, preview_url: true },
      };
      previewText = rawBody.slice(0, 80);
    } else if (type === "location") {
      const lat = Number(content.latitude);
      const lng = Number(content.longitude);
      if (isNaN(lat) || isNaN(lng)) throw new HttpsError("invalid-argument", "latitude/longitude muszą być liczbami.");
      payload = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "location",
        location: {
          latitude: lat,
          longitude: lng,
          ...(content.name ? { name: content.name } : {}),
          ...(content.address ? { address: content.address } : {}),
        },
      };
      previewText = `📍 ${content.name || "Lokalizacja"}`;
    } else if (type === "template") {
      if (!content.templateName) throw new HttpsError("invalid-argument", "templateName wymagane.");
      payload = {
        messaging_product: "whatsapp",
        to: toNumber,
        type: "template",
        template: {
          name: content.templateName,
          language: { code: content.languageCode || "pl" },
          ...(content.components ? { components: content.components } : {}),
        },
      };
      previewText = `📋 ${content.templateName}`;
    }

    // Wyślij przez Graph API
    const apiResp = await callWhatsappApi(
      WHATSAPP_PHONE_ID.value(),
      WHATSAPP_TOKEN.value(),
      payload
    );
    const wamid = apiResp?.messages?.[0]?.id || null;

    // Zapewnij pokój i zapisz wiadomość
    const roomRef = await ensureWhatsappRoom(driverUid, { ...driver, uid: driverSnap.id });
    const now = new Date().toISOString();
    const msgRef = roomRef.collection("messages").doc();
    const msgDoc = {
      id: msgRef.id,
      channel: "whatsapp",
      direction: "outbound",
      type,
      senderId: request.auth.uid,
      senderName,
      senderEmail: sender.email || null,
      timestamp: now,
      waMessageId: wamid,
      deliveryStatus: "sent",
      ...(type === "text" ? { text: content.body || "", signed: true } : {}),
      ...(type === "location" ? { location: { latitude: Number(content.latitude), longitude: Number(content.longitude), name: content.name || null, address: content.address || null } } : {}),
      ...(type === "template" ? { template: { name: content.templateName, language: content.languageCode || "pl" } } : {}),
      ...(frachtId ? { frachtId } : {}),
    };
    await msgRef.set(msgDoc);
    await roomRef.update({
      lastMessageAt: now,
      lastMessagePreview: previewText,
      lastSender: sender.email || request.auth.uid,
    });

    return { success: true, wamid, messageId: msgRef.id, roomId: roomRef.id };
  }
);

// ── whatsappWebhook — onRequest (HTTPS) ──
// GET  → weryfikacja Meta (hub.challenge)
// POST → przychodzące wiadomości + statusy dostawy
exports.whatsappWebhook = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 30,
    secrets: [WHATSAPP_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN],
    cors: false,
  },
  async (req, res) => {
    try {
      // ── GET: weryfikacja webhooka przez Metę ──
      if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];
        if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN.value()) {
          console.log("[WA webhook] verified");
          return res.status(200).send(challenge);
        }
        console.warn("[WA webhook] verify failed", { mode, token: token ? "***" : null });
        return res.status(403).send("Forbidden");
      }

      if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
      }

      // ── Weryfikacja HMAC X-Hub-Signature-256 ──
      const signature = req.get("x-hub-signature-256") || "";
      const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
      const expected = "sha256=" + crypto
        .createHmac("sha256", WHATSAPP_APP_SECRET.value())
        .update(rawBody)
        .digest("hex");
      if (signature !== expected) {
        console.warn("[WA webhook] signature mismatch");
        return res.status(401).send("Invalid signature");
      }

      const body = req.body || {};
      const db = getFirestore();

      // Meta webhook struktura: entry[0].changes[0].value
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value || {};

          // ── messages[]: przychodzące od kierowcy ──
          for (const msg of value.messages || []) {
            const from = msg.from; // numer WhatsApp bez +
            const wamid = msg.id;
            const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Znajdź kierowcę po numerze
            const driversSnap = await db.collection("users")
              .where("whatsappNumber", "==", from)
              .limit(1)
              .get();
            if (driversSnap.empty) {
              console.warn(`[WA webhook] nieznany numer ${from}`);
              continue;
            }
            const driverDoc = driversSnap.docs[0];
            const driver = { uid: driverDoc.id, ...driverDoc.data() };
            const roomRef = await ensureWhatsappRoom(driver.uid, driver);

            // Dedup po wamid
            const existing = await roomRef.collection("messages").where("waMessageId", "==", wamid).limit(1).get();
            if (!existing.empty) continue;

            const msgRef = roomRef.collection("messages").doc();
            const base = {
              id: msgRef.id,
              channel: "whatsapp",
              direction: "inbound",
              senderId: driver.uid,
              senderName: driver.displayName || driver.email || from,
              timestamp: ts,
              waMessageId: wamid,
              deliveryStatus: "delivered",
            };
            let previewText = "";

            if (msg.type === "text") {
              await msgRef.set({ ...base, type: "text", text: msg.text?.body || "" });
              previewText = (msg.text?.body || "").slice(0, 80);
            } else if (msg.type === "location") {
              await msgRef.set({
                ...base, type: "location",
                location: { latitude: msg.location?.latitude, longitude: msg.location?.longitude, name: msg.location?.name || null, address: msg.location?.address || null },
              });
              previewText = "📍 Lokalizacja";
            } else if (["image", "document", "audio", "video", "voice"].includes(msg.type)) {
              const media = msg[msg.type] || {};
              await msgRef.set({
                ...base, type: msg.type,
                media: { mediaId: media.id, mimeType: media.mime_type, caption: media.caption || null, filename: media.filename || null },
              });
              previewText = msg.type === "image" ? "🖼️ Zdjęcie" :
                           msg.type === "document" ? `📄 ${media.filename || "Dokument"}` :
                           msg.type === "audio" || msg.type === "voice" ? "🎤 Głosówka" :
                           msg.type === "video" ? "🎥 Film" : `📎 ${msg.type}`;
            } else {
              await msgRef.set({ ...base, type: msg.type, raw: msg });
              previewText = `📎 ${msg.type}`;
            }

            await roomRef.update({
              lastMessageAt: ts,
              lastMessagePreview: previewText,
              lastSender: driver.email || driver.uid,
            });
          }

          // ── statuses[]: delivery status updates ──
          for (const st of value.statuses || []) {
            const wamid = st.id;
            const status = st.status; // sent | delivered | read | failed
            const ts = st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : new Date().toISOString();

            // Log KAŻDY status — szczególnie błędy dostarczenia od Mety
            console.log("[WA webhook] status update", {
              wamid: wamid?.slice(-20),
              status,
              recipient: st.recipient_id,
              ts,
              ...(st.errors?.[0] ? {
                errorCode: st.errors[0].code,
                errorTitle: st.errors[0].title,
                errorMessage: st.errors[0].message,
                errorDetails: st.errors[0].error_data?.details,
              } : {}),
            });

            // Znajdź wiadomość po wamid — skanujemy pokoje WhatsApp
            const roomsSnap = await db.collection("chatRooms").where("channel", "==", "whatsapp").get();
            let found = false;
            for (const roomDoc of roomsSnap.docs) {
              const msgsSnap = await roomDoc.ref.collection("messages")
                .where("waMessageId", "==", wamid)
                .limit(1)
                .get();
              if (!msgsSnap.empty) {
                await msgsSnap.docs[0].ref.update({
                  deliveryStatus: status,
                  [`deliveryTimes.${status}`]: ts,
                  ...(status === "failed" && st.errors?.[0] ? { deliveryError: st.errors[0] } : {}),
                });
                found = true;
                break;
              }
            }
            if (!found) {
              console.warn("[WA webhook] status: wamid nie znaleziony w bazie", { wamid: wamid?.slice(-20), status, roomsScanned: roomsSnap.size });
            }
          }
        }
      }

      return res.status(200).send("OK");
    } catch (e) {
      console.error("[WA webhook] error:", e);
      // 200 mimo błędu — Meta nie retryuje bez sensu
      return res.status(200).send("ERR");
    }
  }
);
