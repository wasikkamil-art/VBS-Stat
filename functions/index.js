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
// SCHEDULED GPS POLL — co 5 min pobiera Atlas positionsWithCanDetails
// dla wszystkich pojazdów i aktualizuje breadcrumby + auto-detect
// driverActivities (drive/rest). Działa 24/7 niezależnie od sesji klienta.
// ═══════════════════════════════════════════════════════════════

// Helper: konwersja Atlas DateTime ({year, month, day, hour, minute, seconds, timezone})
// do unix millis. Używane w CF (backend) — odpowiednik atlasDateTimeToMs z App.jsx.
function atlasDateTimeToMsBackend(dt) {
  if (!dt) return null;
  if (typeof dt === "number") return dt > 1e12 ? dt : dt * 1000;
  if (typeof dt === "string") {
    const n = Date.parse(dt);
    return isNaN(n) ? null : n;
  }
  if (typeof dt === "object" && dt.year) {
    const y = dt.year, mo = dt.month || 1, d = dt.day || 1;
    const h = dt.hour || 0, mi = dt.minute || 0, s = dt.seconds || 0;
    const tz = (dt.timezone && String(dt.timezone)) || "UTC";
    const tzPart = tz === "UTC" || tz === "Z" ? "Z" : tz;
    const str = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}T${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}:${String(s).padStart(2,"0")}${tzPart}`;
    const n = Date.parse(str);
    return isNaN(n) ? null : n;
  }
  return null;
}

exports.scheduledGpsPoll = onSchedule(
  { schedule: "* * * * *", timeZone: "Europe/Warsaw", region: "europe-west1", timeoutSeconds: 120 },
  async () => {
    const db = getFirestore();
    const startMs = Date.now();

    // 1. Fleet vehicles
    const fleetSnap = await db.doc("fleet/data").get();
    const fleetData = fleetSnap.data() || {};
    const vehicles = fleetData.fleetv2_vehicles || [];
    if (vehicles.length === 0) { console.log("scheduledGpsPoll: brak pojazdów"); return; }

    // 2. Atlas credentials
    const configSnap = await db.doc("config/gps").get();
    const cfg = configSnap.data() || {};
    if (!cfg.username || !cfg.password) { console.error("scheduledGpsPoll: brak credentials Atlas w config/gps"); return; }

    // 3. Fetch positions z Atlas
    let positions = [];
    try {
      const url = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/positionsWithCanDetails`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64"),
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) { console.error(`scheduledGpsPoll: Atlas ${resp.status}`); return; }
      const body = await resp.json();
      const payload = body?.data || body || {};
      positions = Array.isArray(payload) ? payload
        : Array.isArray(payload?.positionList) ? payload.positionList
        : Array.isArray(payload?.historyList) ? payload.historyList
        : [];
    } catch (e) {
      console.error("scheduledGpsPoll: Atlas fetch error:", e.message);
      return;
    }
    if (positions.length === 0) { console.log("scheduledGpsPoll: pusta lista pozycji"); return; }

    const nowIso = new Date(startMs).toISOString();
    let breadcrumbsWritten = 0, segmentsOpened = 0, segmentsClosed = 0;

    // 4. Per-pozycja: match + breadcrumb + activity
    for (const pos of positions) {
      const devPlate = String(pos?.dev?.deviceName || pos?.dev?.plate || pos?.deviceName || pos?.plate || "")
        .replace(/\s+/g, "").toUpperCase();
      const vehicle = vehicles.find(v => {
        const fp = String(v.plate || "").replace(/\s+/g, "").toUpperCase();
        return fp && (fp === devPlate || devPlate.includes(fp) || fp.includes(devPlate));
      });
      if (!vehicle) continue;

      const lat = pos?.coordinate?.latitude ?? pos?.latitude;
      const lng = pos?.coordinate?.longitude ?? pos?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") continue;

      const speed = Number(pos?.speed) || 0;
      const mileage = pos?.can?.mileage?.value ?? null;
      const atlasTs = atlasDateTimeToMsBackend(pos?.dateTime) || startMs;

      // 4a. Breadcrumb (docId = ts, dedup idempotentnie)
      try {
        await db.collection("gpsBreadcrumbs").doc(vehicle.id).collection("points").doc(String(atlasTs))
          .set({ lat, lng, ts: atlasTs, speed, mileage });
        breadcrumbsWritten++;
      } catch (e) {
        console.warn(`scheduledGpsPoll: breadcrumb write ${vehicle.id}:`, e.message);
      }

      // 4b. Auto-detect driverActivity
      const activeDriver = (vehicle.driverHistory || []).find(d => !d.to);
      if (!activeDriver?.email) continue;
      const detectedType = speed > 3 ? "drive" : "rest";

      // Ostatni segment tego kierowcy (jakiegokolwiek źródła)
      let latest = null;
      try {
        const snap = await db.collection("driverActivities")
          .where("driverEmail", "==", activeDriver.email)
          .orderBy("startTs", "desc")
          .limit(1)
          .get();
        if (!snap.empty) latest = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } catch (e) {
        console.warn(`scheduledGpsPoll: query latest ${activeDriver.email}:`, e.message);
        continue;
      }

      // Jeśli latest jest OTWARTY segment manual/ddd — nie ruszaj (priorytet dowodowy)
      if (latest && !latest.endTs && (latest.source === "manual" || latest.source === "ddd")) continue;

      // Jeśli latest jest OTWARTY auto_gps tego samego typu — segment trwa (noop)
      if (latest && !latest.endTs && latest.source === "auto_gps" && latest.type === detectedType) continue;

      // Zamknij stary otwarty auto_gps jeśli typ się zmienił
      if (latest && !latest.endTs && latest.source === "auto_gps" && latest.type !== detectedType) {
        try {
          await db.collection("driverActivities").doc(latest.id).update({ endTs: nowIso });
          segmentsClosed++;
        } catch (e) {
          console.warn(`scheduledGpsPoll: close segment ${latest.id}:`, e.message);
        }
      }

      // Otwórz nowy
      try {
        await db.collection("driverActivities").add({
          driverEmail: activeDriver.email,
          driverName: activeDriver.name || activeDriver.email || "—",
          vehicleId: vehicle.id,
          type: detectedType,
          startTs: nowIso,
          endTs: null,
          source: "auto_gps",
          createdAt: nowIso,
        });
        segmentsOpened++;
      } catch (e) {
        console.warn(`scheduledGpsPoll: open segment ${activeDriver.email}:`, e.message);
      }
    }

    const durMs = Date.now() - startMs;
    console.log(`scheduledGpsPoll OK — ${positions.length} pozycji, breadcrumby ${breadcrumbsWritten}, segmenty +${segmentsOpened}/−${segmentsClosed}, ${durMs}ms`);
  }
);

// ═══════════════════════════════════════════════════════════════
// SCHEDULED HISTORY SYNC — raz dziennie o 3:00 pobiera z Atlas /history
// gęste dane wczorajszego dnia (zwykle zsynchronizowane w nocy) i
// uzupełnia breadcrumby. Scheduled poll co minutę daje 1440 punktów/dobę;
// Atlas /history może mieć ich wielokrotnie więcej (co zmianę speed/RPM).
// Dedup po docId = timestamp → wielokrotne runy bez duplikatów.
// ═══════════════════════════════════════════════════════════════
exports.scheduledHistorySync = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Europe/Warsaw", region: "europe-west1", timeoutSeconds: 540 },
  async () => {
    const db = getFirestore();
    const startMs = Date.now();

    // Wczoraj (Europe/Warsaw). Bierzemy "Y-m-d" lokalnie, potem konwertujemy na UTC zakres.
    const yesterdayWarsaw = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
    yesterdayWarsaw.setDate(yesterdayWarsaw.getDate() - 1);
    const year = yesterdayWarsaw.getFullYear();
    const month = yesterdayWarsaw.getMonth() + 1;
    const day = yesterdayWarsaw.getDate();
    const dayStartMs = Date.parse(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+02:00`);
    const dayEndMs = dayStartMs + 24 * 3600 * 1000;

    // Fleet + credentials
    const fleetSnap = await db.doc("fleet/data").get();
    const vehicles = fleetSnap.data()?.fleetv2_vehicles || [];
    if (vehicles.length === 0) { console.log("scheduledHistorySync: brak pojazdów"); return; }

    const configSnap = await db.doc("config/gps").get();
    const cfg = configSnap.data() || {};
    if (!cfg.username || !cfg.password) { console.error("scheduledHistorySync: brak credentials"); return; }

    // Fetch /history dla roku+miesiąca
    let items = [];
    try {
      const url = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/history?year=${year}&month=${month}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64"),
        },
        signal: AbortSignal.timeout(60000),
      });
      if (!resp.ok) { console.error(`scheduledHistorySync: Atlas ${resp.status}`); return; }
      const body = await resp.json();
      const payload = body?.data || body || {};
      items = Array.isArray(payload) ? payload
        : Array.isArray(payload?.positionList) ? payload.positionList
        : Array.isArray(payload?.historyList) ? payload.historyList
        : [];
    } catch (e) {
      console.error("scheduledHistorySync: Atlas fetch error:", e.message);
      return;
    }
    if (items.length === 0) {
      console.log(`scheduledHistorySync: Atlas /history zwróciło pusto dla ${year}-${month}`);
      return;
    }

    let totalAdded = 0;
    for (const vehicle of vehicles) {
      const vPlate = String(vehicle.plate || "").replace(/\s+/g, "").toUpperCase();
      if (!vPlate || !vehicle.id) continue;

      // Filter punkty dla tego pojazdu + wczorajszego dnia
      const matches = [];
      for (const p of items) {
        const pPlate = String(p?.dev?.deviceName || p?.dev?.plate || p?.deviceName || p?.plate || "")
          .replace(/\s+/g, "").toUpperCase();
        if (pPlate && !(pPlate === vPlate || pPlate.includes(vPlate) || vPlate.includes(pPlate))) continue;

        const lat = p?.coordinate?.latitude ?? p?.latitude;
        const lng = p?.coordinate?.longitude ?? p?.longitude;
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        const ts = atlasDateTimeToMsBackend(p?.dateTime);
        if (!ts || ts < dayStartMs || ts >= dayEndMs) continue;

        matches.push({
          ts, lat, lng,
          speed: Number(p?.speed) || 0,
          mileage: p?.can?.mileage?.value ?? null,
        });
      }

      if (matches.length === 0) continue;

      // Batch write (Firestore limit 500 per batch, zostawiamy zapas na 450)
      const col = db.collection("gpsBreadcrumbs").doc(vehicle.id).collection("points");
      for (let i = 0; i < matches.length; i += 450) {
        const batch = db.batch();
        matches.slice(i, i + 450).forEach(m => {
          const ref = col.doc(String(m.ts));
          // merge:true — jeśli scheduledGpsPoll już zapisał ten ts, zachowaj wartości
          batch.set(ref, { lat: m.lat, lng: m.lng, ts: m.ts, speed: m.speed, mileage: m.mileage, source: "atlas_history" }, { merge: true });
        });
        await batch.commit();
      }
      totalAdded += matches.length;
      console.log(`scheduledHistorySync: ${vehicle.plate} (${vehicle.id}) — ${matches.length} punktów`);
    }
    const durMs = Date.now() - startMs;
    console.log(`scheduledHistorySync OK — łącznie ${totalAdded} punktów wczoraj (${year}-${month}-${day}), ${durMs}ms`);
  }
);

// ═══════════════════════════════════════════════════════════════
// DAILY BACKUP — eksport fleet/data + driverEvents do GCS bucket
// 3:00 CET, 30d retention. Druga warstwa obrony obok PITR (7d).
// Po incident 2026-04-30 (10 frachtów wyparowało przez array race
// condition) — backup pozwala zrekonstruować konkretne pola sprzed
// problemu, nawet gdy PITR wygasł.
// ═══════════════════════════════════════════════════════════════
exports.dailyBackup = onSchedule(
  { schedule: "0 3 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    try {
      // 1. fleet/data — głowny dokument (pojazdy, frachty, koszty, kategorie, docs, imi, rent)
      const fleetSnap = await db.doc("fleet/data").get();
      const fleetData = fleetSnap.data() || {};
      const fleetCount = (fleetData.fleetv2_frachty || []).length;
      const vehCount = (fleetData.fleetv2_vehicles || []).length;
      const fleetFile = bucket.file(`backups/${ts}_fleet-data.json`);
      await fleetFile.save(JSON.stringify(fleetData), { contentType: "application/json" });
      console.log(`✓ fleet backup: ${fleetCount} frachtów, ${vehCount} pojazdów → ${fleetFile.name}`);

      // 2. driverEvents — ostatnie 90 dni (krytyczne dla audytu trasy)
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
      const evSnap = await db.collection("driverEvents").where("ts", ">=", cutoff).get();
      const events = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const evFile = bucket.file(`backups/${ts}_driverEvents-90d.json`);
      await evFile.save(JSON.stringify(events), { contentType: "application/json" });
      console.log(`✓ driverEvents backup: ${events.length} eventów (90d)`);

      // 3. auditLog — ostatnie 30 dni (po incident — żeby śledzić kto co zrobił)
      const auditCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      const auditSnap = await db.collection("auditLog").where("ts", ">=", auditCutoff).get();
      const audit = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const auditFile = bucket.file(`backups/${ts}_auditLog-30d.json`);
      await auditFile.save(JSON.stringify(audit), { contentType: "application/json" });
      console.log(`✓ auditLog backup: ${audit.length} wpisów (30d)`);

      // 4. Cleanup — usuń backupy starsze niż 30 dni
      const [files] = await bucket.getFiles({ prefix: "backups/" });
      const cleanupCutoff = Date.now() - 30 * 86400000;
      let deleted = 0;
      for (const f of files) {
        const created = new Date(f.metadata.timeCreated).getTime();
        if (created < cleanupCutoff) {
          await f.delete();
          deleted++;
        }
      }
      console.log(`✓ Cleanup: usunięto ${deleted} starych backupów (>30d)`);

      // 5. Audit trail — zapisz w Firestore meta o backup (do monitoring)
      await db.collection("backupLog").add({
        ts: new Date().toISOString(),
        fleetCount,
        vehCount,
        eventsCount: events.length,
        auditCount: audit.length,
        cleanedOldBackups: deleted,
        status: "ok",
      });
    } catch (e) {
      console.error("dailyBackup error:", e);
      try {
        await db.collection("backupLog").add({
          ts: new Date().toISOString(),
          status: "error",
          error: e.message,
        });
      } catch {}
    }
  }
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

// ═══════════════════════════════════════════════════════════════
// TRACKER DATA — publiczny endpoint dla trackera klienta
//   Token w URL jest jedyną formą autoryzacji (losowy UUID).
//   Zwraca: nr zlecenia, % trasy, km do celu, ETA uwzględniającą
//   wymagane przerwy kierowcy (rozp. 561/2006 — uproszczone).
// ═══════════════════════════════════════════════════════════════

function parseGeoStringBackend(geo) {
  if (!geo || typeof geo !== "string") return null;
  const [latStr, lngStr] = geo.split(",").map(s => s.trim());
  const lat = Number(latStr), lng = Number(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

async function geocodeAddress(query) {
  if (!query || !String(query).trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(String(query))}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "FleetStat/1.0 (fleetstat.pl)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function osrmRoute(from, to) {
  return osrmMultiRoute([from, to]);
}

// Multi-waypoint routing — np. pos → R1 → R2 (przez R1 jako waypoint).
// Zwraca sumaryczny dystans i czas dla całej trasy.
async function osrmMultiRoute(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (points.some(p => !p || typeof p.lat !== "number" || typeof p.lng !== "number")) return null;
  try {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const r = data?.routes?.[0];
    if (!r) return null;
    return { distanceKm: r.distance / 1000, durationMin: r.duration / 60 };
  } catch {
    return null;
  }
}

function normalizeSegmentBackend(s, nowIso) {
  const startTs = s.startTs || s.start;
  const endTs = s.endTs || s.end || nowIso;
  const startMs = new Date(startTs).getTime();
  const endMs = new Date(endTs).getTime();
  return {
    type: s.type || "avail",
    source: s.source || "unknown",
    startMs,
    endMs,
    durMin: Math.max(0, Math.round((endMs - startMs) / 60000)),
  };
}

// Oblicza: continuousDrive (min od ostatniej przerwy >= 45min rest)
//          dailyDrive (min od ostatniego >= 9h rest / fallback 24h w tył).
function computeTrackerCompliance(rawSegments, now) {
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const segments = rawSegments
    .map(s => normalizeSegmentBackend(s, nowIso))
    .sort((a, b) => a.startMs - b.startMs);

  let contCutoff = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.type === "rest" && s.durMin >= 45 && s.endMs <= nowMs) {
      contCutoff = s.endMs;
      break;
    }
  }
  let continuousDrive = 0;
  for (const s of segments) {
    if (s.type !== "drive") continue;
    const sMs = Math.max(s.startMs, contCutoff);
    const eMs = Math.min(s.endMs, nowMs);
    if (eMs > sMs) continuousDrive += Math.round((eMs - sMs) / 60000);
  }

  let dailyCutoff = nowMs - 24 * 3600000;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.type === "rest" && s.durMin >= 540 && s.endMs <= nowMs) {
      dailyCutoff = s.endMs;
      break;
    }
  }
  let dailyDrive = 0;
  for (const s of segments) {
    if (s.type !== "drive") continue;
    const sMs = Math.max(s.startMs, dailyCutoff);
    const eMs = Math.min(s.endMs, nowMs);
    if (eMs > sMs) dailyDrive += Math.round((eMs - sMs) / 60000);
  }

  return { continuousDrive, dailyDrive };
}

// ETA z uwzględnieniem przerw. Dodaje 45min przerwę po każdych 4.5h jazdy,
// oraz 11h odpoczynek po osiągnięciu dziennego limitu 9h jazdy.
function calcEtaWithBreaks(startMs, driveMinutes, continuousDrive, dailyDrive) {
  const CONT_LIMIT = 270;
  const BREAK = 45;
  const DAILY_LIMIT = 540;
  const DAILY_REST = 11 * 60;

  let now = startMs;
  let remaining = Math.max(0, driveMinutes);
  let contLeft = Math.max(0, CONT_LIMIT - continuousDrive);
  let dailyLeft = Math.max(0, DAILY_LIMIT - dailyDrive);
  let totalBreaks = 0;
  let iter = 0;

  while (remaining > 0 && iter < 100) {
    iter++;
    if (dailyLeft <= 0) {
      now += DAILY_REST * 60000;
      totalBreaks += DAILY_REST;
      dailyLeft = DAILY_LIMIT;
      contLeft = CONT_LIMIT;
      continue;
    }
    if (contLeft <= 0) {
      now += BREAK * 60000;
      totalBreaks += BREAK;
      contLeft = CONT_LIMIT;
      continue;
    }
    const canDrive = Math.min(remaining, contLeft, dailyLeft);
    now += canDrive * 60000;
    remaining -= canDrive;
    contLeft -= canDrive;
    dailyLeft -= canDrive;
  }

  return { etaMs: now, breakMinutes: totalBreaks };
}

exports.trackerData = onRequest(
  { region: "europe-west1", cors: true, timeoutSeconds: 30 },
  async (req, res) => {
    try {
      const token = String(req.query.token || "").trim();
      if (!token || token.length < 16) {
        return res.status(400).json({ error: "missing_token" });
      }

      const db = getFirestore();

      // 1. Dane fleet — frachty są array w fleet/data.fleetv2_frachty
      const fleetSnap = await db.doc("fleet/data").get();
      const fleetData = fleetSnap.data() || {};
      const frachtyList = fleetData.fleetv2_frachty || [];
      const vehicles = fleetData.fleetv2_vehicles || [];

      const fracht = frachtyList.find(f => f && f.trackerToken === token);
      if (!fracht) return res.status(404).json({ error: "not_found" });

      // Tracker może być ręcznie wyłączony przez spedytora (fracht.trackerEnabled === false).
      // Brak pola = domyślnie włączony (backward compat dla istniejących trackerów).
      if (fracht.trackerEnabled === false) {
        return res.status(403).json({ error: "disabled" });
      }

      const nrZlecenia = fracht.nrZlecenia || fracht.nrRef || (fracht.id || "").slice(0, 8) || "—";

      // Rejestracja pojazdu + ładowność do wyświetlenia w nagłówku trackera
      const vehicleForDisplay = vehicles.find(v => v && v.id === fracht.vehicleId);
      const vehiclePlate = (vehicleForDisplay?.plate || "").trim() || null;
      const mw1 = parseInt(vehicleForDisplay?.maxWeight) || 0;
      const mw2 = parseInt(vehicleForDisplay?.maxWeight2) || 0;
      const vehicleMaxWeight = mw1 + mw2 > 0 ? (mw1 + mw2) : null;

      // Czy są dwa rozładunki — potrzebne do activeStep (5 kroków vs 4)
      const hasR2 = !!(
        (fracht.dokodPocztowy2 && String(fracht.dokodPocztowy2).trim()) ||
        (fracht.dokodMiasto2 && String(fracht.dokodMiasto2).trim()) ||
        (fracht.dokod2 && String(fracht.dokod2).trim()) ||
        (fracht.rozladunekGeo2 && String(fracht.rozladunekGeo2).trim())
      );

      // Jedno query driverEvents — używane do: (a) activeStep, (b) zdjęcia do galerii
      let events = [];
      try {
        const eventsSnap = await db.collection("driverEvents").where("frachtId", "==", fracht.id).get();
        events = eventsSnap.docs.map(e => e.data());
      } catch (e) {
        console.warn("trackerData: events query failed:", e.message);
      }

      // Round-trip linker: czy fracht jest częścią kółka? Jeśli tak, dorzuć info o partnerze.
      // (linkedFrachtId set → ja jestem powrotem, partner = etap1 oryginał;
      //  inny fracht ma linkedFrachtId === my id → ja jestem etap1, partner = powrót)
      let linkedInfo = null;
      const linkedId = fracht.linkedFrachtId
        || frachtyList.find(o => o && o.linkedFrachtId === fracht.id)?.id;
      if (linkedId) {
        const linked = frachtyList.find(o => o && o.id === linkedId);
        if (linked) {
          let linkedRozladowano = linked.statusRozladunkuManual === "rozladowano"
            || linked.statusRozladunku === "rozladowano";
          if (!linkedRozladowano) {
            try {
              const linkedEvSnap = await db.collection("driverEvents").where("frachtId", "==", linkedId).get();
              const linkedEvts = linkedEvSnap.docs.map(e => e.data());
              const lastRoz = linkedEvts.filter(e => e.type === "rozladowano").sort((a,b) => (b.ts||"").localeCompare(a.ts||""))[0];
              const lastRozUndo = linkedEvts.filter(e => e.type === "cofnij_rozladowano").sort((a,b) => (b.ts||"").localeCompare(a.ts||""))[0];
              if (lastRoz && (!lastRozUndo || lastRoz.ts > lastRozUndo.ts)) linkedRozladowano = true;
            } catch (e) { console.warn("trackerData linked events:", e.message); }
          }
          linkedInfo = {
            role: fracht.linkedFrachtId ? "etap1" : "etap2",
            // role = co partner reprezentuje względem aktualnego frachta
            from: linked.zaladunekKod || linked.zaladunekMiasto || "—",
            to: linked.dokod || linked.dokodMiasto || "—",
            dataZaladunku: linked.dataZaladunku || null,
            dataRozladunku: linked.dataRozladunku || null,
            status: linkedRozladowano ? "zakonczony" : "w_trasie",
            nrZlecenia: linked.nrZlecenia || linked.nrRef || null,
          };
        }
      }

      // Aktywny krok:
      //   Dla 1 rozładunku (0..3): Dojazd, Załadowano, W trasie, Dostarczono
      //   Dla 2 rozładunków (0..4): Dojazd, Załadowano, Rozładunek 1, Rozładunek 2, Dostarczono
      let activeStep = 0;
      {
        const effective = (type) => {
          const ev = events.filter(e => e.type === type).sort((a, b) => (a.ts || "").localeCompare(b.ts || "")).pop();
          const un = events.filter(e => e.type === `cofnij_${type}`).sort((a, b) => (a.ts || "").localeCompare(b.ts || "")).pop();
          if (!ev) return null;
          if (un && un.ts > ev.ts) return null;
          return ev;
        };
        const dotarcieZal = !!effective("dotarcie_zaladunek");
        const startRoz = !!effective("start_rozladunek");
        const dotarcieRoz = !!effective("dotarcie_rozladunek");
        const rozladowano = !!effective("rozladowano") || fracht.statusRozladunku === "rozladowano";
        if (hasR2) {
          // 5-stopniowy: 0 Dojazd, 1 Załadowano, 2 W trasie do R1, 3 Po R1 / W trasie do R2, 4 Dostarczono
          if (rozladowano) activeStep = 4;
          else if (dotarcieRoz) activeStep = 3; // dotarł do R1, teraz jedzie do R2
          else if (startRoz) activeStep = 2;
          else if (dotarcieZal) activeStep = 1;
          else activeStep = 0;
        } else {
          if (rozladowano || dotarcieRoz) activeStep = 3;
          else if (startRoz) activeStep = 2;
          else if (dotarcieZal) activeStep = 1;
          else activeStep = 0;
        }
      }

      // Zdjęcia — tylko te kategorie, które admin zaznaczył w trackerShow.
      // Dla 2 rozładunków (hasR2): CMR rozładunkowe rozdzielone na R1/R2 wg ts
      // drugiego eventu 'dotarcie_rozladunek' (kierowca klika 2x — pierwszy = R1).
      const show = fracht.trackerShow || {};
      const photos = {};
      if (show.cmrZal || show.cmrRoz || show.towar || show.damage) {
        let phaseR2StartTs = null;
        if (hasR2) {
          const dotRozSorted = events.filter(e => e.type === "dotarcie_rozladunek")
            .sort((a, b) => ((a.value || a.ts) || "").localeCompare((b.value || b.ts) || ""));
          const dotRoz2 = dotRozSorted[1];
          if (dotRoz2) phaseR2StartTs = dotRoz2.value || dotRoz2.ts;
        }

        const urls = { cmrZal: [], cmrRoz: [], cmrRozR1: [], cmrRozR2: [], towar: [], damage: [] };
        for (const e of events) {
          if (!e.photoUrl) continue;
          if (e.type === "cmr_zaladunek_photo") {
            urls.cmrZal.push(e.photoUrl);
          } else if (e.type === "cmr_rozladunek_photo" || e.type === "cmr_photo") {
            if (hasR2) {
              const evTs = e.value || e.ts || "";
              if (phaseR2StartTs && evTs >= phaseR2StartTs) urls.cmrRozR2.push(e.photoUrl);
              else urls.cmrRozR1.push(e.photoUrl);
            } else {
              urls.cmrRoz.push(e.photoUrl);
            }
          } else if (e.type === "towar_photo") {
            urls.towar.push(e.photoUrl);
          } else if (e.type === "towar_damage_photo") {
            urls.damage.push(e.photoUrl);
          }
        }
        if (show.cmrZal && urls.cmrZal.length) photos.cmrZal = urls.cmrZal;
        if (show.cmrRoz) {
          if (hasR2) {
            if (urls.cmrRozR1.length) photos.cmrRozR1 = urls.cmrRozR1;
            if (urls.cmrRozR2.length) photos.cmrRozR2 = urls.cmrRozR2;
          } else if (urls.cmrRoz.length) {
            photos.cmrRoz = urls.cmrRoz;
          }
        }
        if (show.towar && urls.towar.length) photos.towar = urls.towar;
        if (show.damage && urls.damage.length) photos.damage = urls.damage;
      }

      // 2. Planowane czasy (Europe/Warsaw) — hasR2 już wyznaczone wcześniej
      const toMs = (date, time) => {
        if (!date) return null;
        const t = time || "00:00";
        const p = Date.parse(`${date}T${t}:00+02:00`);
        return isNaN(p) ? null : p;
      };
      const plannedR1Ms = toMs(fracht.dataRozladunku, fracht.godzRozladunku);
      const plannedR2Ms = hasR2 ? toMs(fracht.dataRozladunku2, fracht.godzRozladunku2) : null;
      // Końcowa dostawa = ostatni rozładunek (R2 jeśli istnieje, inaczej R1)
      const plannedMs = hasR2 ? (plannedR2Ms || plannedR1Ms) : plannedR1Ms;
      const plannedLoadMs = toMs(fracht.dataZaladunku, fracht.godzZaladunku);

      // 3. Quick return — zakończone
      if (fracht.statusRozladunku === "rozladowano") {
        return res.json({
          nrZlecenia,
          vehiclePlate,
          vehicleMaxWeight,
          status: "zakonczony",
          activeStep: hasR2 ? 4 : 3,
          hasR2,
          plannedMs,
          plannedR1Ms,
          plannedR2Ms,
          plannedLoadMs,
          photos,
          updatedAt: Date.now(),
        });
      }

      const vehicleId = fracht.vehicleId;
      if (!vehicleId) return res.status(400).json({ error: "no_vehicle" });

      // 4. Latest breadcrumb (max 1 min stara dzięki scheduledGpsPoll)
      const bsnap = await db.collection("gpsBreadcrumbs").doc(vehicleId)
        .collection("points").orderBy("ts", "desc").limit(1).get();
      let pos = null;
      if (!bsnap.empty) {
        const d = bsnap.docs[0].data();
        if (typeof d.lat === "number" && typeof d.lng === "number") {
          pos = { lat: d.lat, lng: d.lng, ts: d.ts };
        }
      }

      // 5. Destinations — R1 (zawsze) + R2 (jeśli hasR2)
      let destR1 = parseGeoStringBackend(fracht.rozladunekGeo);
      if (!destR1) {
        const q = [fracht.rozladunekAdres, fracht.dokodPocztowy, fracht.dokodMiasto]
          .filter(Boolean).join(", ");
        destR1 = await geocodeAddress(q || fracht.dokod);
      }
      if (!destR1) return res.status(500).json({ error: "no_destination" });

      let destR2 = null;
      if (hasR2) {
        destR2 = parseGeoStringBackend(fracht.rozladunekGeo2);
        if (!destR2) {
          const q = [fracht.rozladunekAdres2, fracht.dokodPocztowy2, fracht.dokodMiasto2]
            .filter(Boolean).join(", ");
          destR2 = await geocodeAddress(q || fracht.dokod2);
        }
      }

      // 6. Brak pozycji — jeszcze nie wyjechał
      if (!pos) {
        return res.json({
          nrZlecenia,
          vehiclePlate,
          vehicleMaxWeight,
          status: "przed_trasa",
          activeStep,
          hasR2,
          plannedMs,
          plannedR1Ms,
          plannedR2Ms,
          plannedLoadMs,
          percentDone: 0,
          photos,
          updatedAt: Date.now(),
        });
      }

      // 7. Start Z1 — geo → fallback geocode (dla % trasy)
      let start = parseGeoStringBackend(fracht.zaladunekGeo);
      if (!start) {
        const q = [fracht.zaladunekAdres, fracht.zaladunekKodPocztowy, fracht.zaladunekMiasto]
          .filter(Boolean).join(", ");
        start = await geocodeAddress(q || fracht.zaladunekKod);
      }

      // 8. Routing — dla multi-rozładunku przez R1 jako waypoint do R2 (cel końcowy).
      // Gdy kierowca juz zrealizowal R1 (activeStep >= 3), pomijamy go w waypoints —
      // inaczej OSRM liczy detour wstecz przez R1 i daje fałszywy duzy dystans
      // (np. 1400 km zamiast realnych 10 km gdy auto stoi tuz przed R2).
      const finalDest = hasR2 && destR2 ? destR2 : destR1;
      const r1AlreadyDone = hasR2 && activeStep >= 3;
      const waypoints = hasR2 && destR2
        ? (r1AlreadyDone ? [pos, destR2] : [pos, destR1, destR2])
        : [pos, destR1];
      const routeCurrent = await osrmMultiRoute(waypoints);
      if (!routeCurrent) return res.status(500).json({ error: "osrm_failed" });

      let kmTotal = routeCurrent.distanceKm;
      if (start) {
        const totalWp = hasR2 && destR2 ? [start, destR1, destR2] : [start, destR1];
        const routeTotal = await osrmMultiRoute(totalWp);
        if (routeTotal && routeTotal.distanceKm > 0) kmTotal = routeTotal.distanceKm;
      }
      const kmRemaining = routeCurrent.distanceKm;
      const kmDone = Math.max(0, kmTotal - kmRemaining);
      const percentDone = kmTotal > 0 ? Math.min(100, Math.round((kmDone / kmTotal) * 100)) : 0;

      // Dla 2 rozładunków: osobne km i % do R1 (żeby klient widział postęp
      // dotarcia do pierwszego punktu, niezależnie od finalnego celu w R2).
      let kmToR1 = null, kmTotalR1 = null, percentToR1 = null;
      if (hasR2 && destR2) {
        // Jeśli activeStep ≥ 3 → R1 jest już zrealizowany (kierowca pojechał do R2).
        // OSRM nadal liczy odległość do R1 ale to wprowadza w błąd — auto już go
        // minęło i jedzie do R2. Wymuszamy 100% / 0 km zamiast surowej kalkulacji.
        if (activeStep >= 3) {
          kmToR1 = 0;
          percentToR1 = 100;
          // kmTotalR1 zostaje obliczone niżej dla porównania (jeśli start dostępny)
          if (start) {
            const routeTotalR1 = await osrmMultiRoute([start, destR1]);
            if (routeTotalR1 && routeTotalR1.distanceKm > 0) {
              kmTotalR1 = Math.round(routeTotalR1.distanceKm);
            }
          }
        } else {
          const routeToR1 = await osrmMultiRoute([pos, destR1]);
          if (routeToR1) {
            kmToR1 = Math.round(routeToR1.distanceKm);
            if (start) {
              const routeTotalR1 = await osrmMultiRoute([start, destR1]);
              if (routeTotalR1 && routeTotalR1.distanceKm > 0) {
                kmTotalR1 = Math.round(routeTotalR1.distanceKm);
                const doneR1 = Math.max(0, kmTotalR1 - kmToR1);
                percentToR1 = Math.min(100, Math.round((doneR1 / kmTotalR1) * 100));
              }
            }
          }
        }
      }

      // 9. Compliance kierowcy (ostatnie 7 dni segmentów driverActivities)
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const activeDriver = (vehicle?.driverHistory || []).find(d => !d.to);

      let continuousDrive = 0, dailyDrive = 0;
      if (activeDriver?.email) {
        try {
          const cutoffIso = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
          const asnap = await db.collection("driverActivities")
            .where("driverEmail", "==", activeDriver.email)
            .where("startTs", ">=", cutoffIso)
            .orderBy("startTs", "asc")
            .get();
          const segments = asnap.docs.map(d => ({ id: d.id, ...d.data() }));
          const c = computeTrackerCompliance(segments, new Date());
          continuousDrive = c.continuousDrive;
          dailyDrive = c.dailyDrive;
        } catch (e) {
          console.warn("trackerData: compliance query failed:", e.message);
        }
      }

      // 10. ETA z przerwami
      const { etaMs, breakMinutes } = calcEtaWithBreaks(
        Date.now(),
        routeCurrent.durationMin,
        continuousDrive,
        dailyDrive
      );

      const delayMin = plannedMs ? Math.round((etaMs - plannedMs) / 60000) : null;

      return res.json({
        nrZlecenia,
        vehiclePlate,
        vehicleMaxWeight,
        status: "w_trasie",
        activeStep,
        hasR2,
        lat: pos.lat,
        lng: pos.lng,
        kmTotal: Math.round(kmTotal),
        kmRemaining: Math.round(kmRemaining),
        kmDone: Math.round(kmDone),
        percentDone,
        kmToR1,
        kmTotalR1,
        percentToR1,
        etaMs,
        plannedMs,
        plannedR1Ms,
        plannedR2Ms,
        plannedLoadMs,
        delayMin,
        breakMinutes,
        positionTs: pos.ts,
        photos,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error("trackerData error:", e);
      return res.status(500).json({ error: "internal", message: e.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// WW REPORT INBOUND — webhook SendGrid Inbound Parse
// Odbiera email z widziszwszystko (raport "Karta drogowa szczegółowa")
// → parsuje CSV załącznik → wstawia segmenty do driverActivities z
// source: "ww_csv". CSV ma priorytet nad auto_gps (zastępuje istniejące
// segmenty auto_gps w tym samym przedziale czasu).
//
// Endpoint: https://europe-west1-vbs-stats.cloudfunctions.net/wwReportInbound
// SendGrid posyła POST multipart/form-data z polami: from, subject, text,
// attachments (count) i attachment1, attachment2, ... (pliki binarne).
// ═══════════════════════════════════════════════════════════════
const Busboy = require("busboy");
const { parse: csvParse } = require("csv-parse/sync");

function parseMultipartReq(req) {
  return new Promise((resolve, reject) => {
    const csvFiles = [];
    const fields = {};
    const busboy = Busboy({ headers: req.headers });
    busboy.on("field", (name, val) => { fields[name] = val; });
    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];
      file.on("data", chunk => chunks.push(chunk));
      file.on("end", () => {
        const filename = info.filename || "";
        if (filename.toLowerCase().endsWith(".csv")) {
          csvFiles.push({ filename, content: Buffer.concat(chunks).toString("utf8") });
        }
      });
      file.on("error", reject);
    });
    busboy.on("finish", () => resolve({ csvFiles, fields }));
    busboy.on("error", reject);
    if (req.rawBody) busboy.end(req.rawBody);
    else req.pipe(busboy);
  });
}

// Mapowanie typów segmentu z widziszwszystko na nasze
const WW_TYPE_MAP = {
  "Jazda": "drive",
  "Postój": "rest",
  "Postoj": "rest",
  "Brak danych": null,    // ignoruj — to są szumy
  "Inna praca": "work",
  "Praca": "work",
  "Dyspozycyjność": "avail",
  "Dyspozycyjnosc": "avail",
};

async function importWWForVehicle(db, vehicles, plate, segments) {
  const cleanPlate = String(plate || "").replace(/\s+/g, "").toUpperCase();
  if (!cleanPlate) return { plate, error: "empty_plate", imported: 0, replaced: 0, skipped: segments.length };

  const vehicle = vehicles.find(v => {
    const vp = String(v.plate || "").replace(/\s+/g, "").toUpperCase();
    return vp && (vp === cleanPlate || vp.includes(cleanPlate) || cleanPlate.includes(vp));
  });
  if (!vehicle) return { plate, error: "vehicle_not_found", imported: 0, replaced: 0, skipped: segments.length };

  // Zakres dat dla całego raportu (do dedupu z istniejącymi segmentami)
  const validStarts = segments.map(s => Date.parse(s.start)).filter(t => !isNaN(t));
  const validEnds = segments.map(s => Date.parse(s.end)).filter(t => !isNaN(t));
  if (validStarts.length === 0) return { plate: vehicle.plate, error: "no_valid_dates", imported: 0, replaced: 0, skipped: segments.length };

  const startMs = Math.min(...validStarts);
  const endMs = Math.max(...validEnds);
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();

  // Znajdź kierowcę dla tego okresu (driverHistory aktywny w dacie raportu)
  const reportDay = startIso.slice(0, 10); // YYYY-MM-DD
  const driver = (vehicle.driverHistory || []).find(d => {
    const from = (d.from || "0000-00-00").slice(0, 10);
    const to = (d.to || "9999-12-31").slice(0, 10);
    return from <= reportDay && (!d.to || to >= reportDay);
  }) || (vehicle.driverHistory || []).find(d => !d.to);

  if (!driver?.email) {
    return { plate: vehicle.plate, error: "no_driver_for_period", imported: 0, replaced: 0, skipped: segments.length, period: { from: startIso, to: endIso } };
  }

  // Dedup — usuń istniejące auto_gps i ww_csv segmenty w przedziale (CSV wygrywa)
  let replaced = 0;
  try {
    const existingSnap = await db.collection("driverActivities")
      .where("driverEmail", "==", driver.email)
      .where("startTs", ">=", startIso)
      .where("startTs", "<=", endIso)
      .get();
    const toDelete = existingSnap.docs.filter(d => {
      const data = d.data();
      return data.source === "auto_gps" || data.source === "ww_csv";
    });
    for (let i = 0; i < toDelete.length; i += 400) {
      const batch = db.batch();
      toDelete.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    replaced = toDelete.length;
  } catch (e) {
    console.warn(`[wwInbound] delete existing failed for ${plate}:`, e.message);
  }

  // Wstaw nowe segmenty (CSV → driverActivities)
  let imported = 0, skipped = 0;
  const nowIso = new Date().toISOString();
  for (let i = 0; i < segments.length; i += 400) {
    const batch = db.batch();
    for (const seg of segments.slice(i, i + 400)) {
      const type = WW_TYPE_MAP[String(seg.type || "").trim()];
      if (!type) { skipped++; continue; }
      const sMs = Date.parse(seg.start);
      const eMs = Date.parse(seg.end);
      if (isNaN(sMs) || isNaN(eMs) || eMs <= sMs) { skipped++; continue; }
      const ref = db.collection("driverActivities").doc();
      batch.set(ref, {
        driverEmail: driver.email,
        driverName: driver.name || driver.email,
        vehicleId: vehicle.id,
        type,
        startTs: new Date(sMs).toISOString(),
        endTs: new Date(eMs).toISOString(),
        source: "ww_csv",
        address: (seg.address || "").trim() || null,
        distanceKm: parseFloat(seg.distance) || 0,
        createdAt: nowIso,
      });
      imported++;
    }
    await batch.commit();
  }

  return {
    plate: vehicle.plate,
    driverEmail: driver.email,
    period: { from: startIso, to: endIso },
    imported,
    replaced,
    skipped,
  };
}

async function processWWCsv(db, vehicles, file) {
  let rows;
  try {
    // Toleruj BOM, skip empty, columns z nagłówka
    rows = csvParse(file.content.replace(/^\uFEFF/, ""), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    return { file: file.filename, error: "csv_parse_failed", message: e.message };
  }
  if (rows.length === 0) return { file: file.filename, imported: 0, skipped: 0 };

  // Wymagane kolumny
  const sample = rows[0];
  const needed = ["object", "type", "start", "end"];
  for (const c of needed) {
    if (!(c in sample)) return { file: file.filename, error: "missing_column", column: c, sample: Object.keys(sample) };
  }

  // Group po pojeździe
  const byObject = new Map();
  for (const r of rows) {
    const obj = String(r.object || "").trim();
    if (!obj) continue;
    if (!byObject.has(obj)) byObject.set(obj, []);
    byObject.get(obj).push(r);
  }

  let imp = 0, rep = 0, skp = 0;
  const perVehicle = [];
  for (const [plate, segments] of byObject.entries()) {
    const r = await importWWForVehicle(db, vehicles, plate, segments);
    imp += r.imported || 0;
    rep += r.replaced || 0;
    skp += r.skipped || 0;
    perVehicle.push(r);
  }
  return { file: file.filename, imported: imp, replaced: rep, skipped: skp, vehicles: perVehicle };
}

exports.wwReportInbound = onRequest(
  { region: "europe-west1", timeoutSeconds: 120, memory: "512MiB", cors: false },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");
    const ct = req.headers["content-type"] || "";
    if (!ct.includes("multipart/form-data")) {
      return res.status(400).json({ error: "expected_multipart" });
    }
    try {
      const { csvFiles, fields } = await parseMultipartReq(req);
      console.log(`[wwInbound] from=${fields.from || "?"} subject="${(fields.subject || "").slice(0, 60)}" csvFiles=${csvFiles.length}`);

      if (csvFiles.length === 0) {
        return res.json({ ok: true, warning: "no_csv_attachment" });
      }

      const db = getFirestore();
      const fleetSnap = await db.doc("fleet/data").get();
      const vehicles = fleetSnap.data()?.fleetv2_vehicles || [];

      const results = [];
      for (const file of csvFiles) {
        results.push(await processWWCsv(db, vehicles, file));
      }

      const totalImported = results.reduce((s, r) => s + (r.imported || 0), 0);
      const totalReplaced = results.reduce((s, r) => s + (r.replaced || 0), 0);

      // Audit log
      try {
        await db.collection("auditLog").add({
          action: "ww_csv_import",
          ts: new Date().toISOString(),
          source: "email_inbound",
          from: fields.from || null,
          subject: fields.subject || null,
          imported: totalImported,
          replaced: totalReplaced,
          results,
        });
      } catch (e) { console.warn("[wwInbound] auditLog failed:", e.message); }

      console.log(`[wwInbound] OK imported=${totalImported} replaced=${totalReplaced}`);
      return res.json({ ok: true, imported: totalImported, replaced: totalReplaced, results });
    } catch (e) {
      console.error("[wwInbound] error:", e);
      return res.status(500).json({ error: "internal", message: e.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════
// TRIP FINALIZATION — auto-off Tracker + email do zleceniodawcy
//   Trigger: onCall przez DriverPanel po finalnym dotarcie_rozladunek
//   Idempotentny (sprawdza fracht.tripFinalizedAt przed akcją)
// ═══════════════════════════════════════════════════════════════

function getMaxRouteIndex(fracht) {
  const has = (i) => {
    const sfx = i === 1 ? "" : String(i);
    return !!(
      (fracht[`dokodPocztowy${sfx}`] && String(fracht[`dokodPocztowy${sfx}`]).trim()) ||
      (fracht[`dokodMiasto${sfx}`] && String(fracht[`dokodMiasto${sfx}`]).trim()) ||
      (fracht[`dokod${sfx}`] && String(fracht[`dokod${sfx}`]).trim()) ||
      (fracht[`rozladunekGeo${sfx}`] && String(fracht[`rozladunekGeo${sfx}`]).trim())
    );
  };
  let max = 1;
  for (let i = 2; i <= 5; i++) if (has(i)) max = i;
  return max;
}

function computeTripStats(fracht, events) {
  const kmStart = Number(fracht.kmStart);
  const kmEnd = Number(fracht.kmEnd);
  const kmTotal = isFinite(kmStart) && isFinite(kmEnd) && kmEnd > kmStart
    ? kmEnd - kmStart
    : null;

  const maxR = getMaxRouteIndex(fracht);

  // Ostatni dotarcie_rozladunek — backward compat: dla maxR=1 akceptujemy r==null lub r===1
  const lastDotarcieRoz = events
    .filter(e => e.type === "dotarcie_rozladunek" && (
      maxR === 1 ? (e.r == null || e.r === 1) : e.r === maxR
    ))
    .sort((a, b) => (a.ts || "").localeCompare(b.ts || ""))
    .pop();

  const firstDotarcieZal = events
    .filter(e => e.type === "dotarcie_zaladunek")
    .sort((a, b) => (a.ts || "").localeCompare(b.ts || ""))
    .shift();

  let tripDurationMin = null;
  if (firstDotarcieZal?.ts && lastDotarcieRoz?.ts) {
    const diffMs = new Date(lastDotarcieRoz.ts).getTime() - new Date(firstDotarcieZal.ts).getTime();
    if (diffMs > 0) tripDurationMin = Math.round(diffMs / 60000);
  }

  let punctualityMin = null;
  let punctualityText = null;
  if (lastDotarcieRoz?.ts) {
    const sfx = maxR === 1 ? "" : String(maxR);
    const plannedDate = fracht[`dataRozladunku${sfx}`];
    const plannedTime = fracht[`godzRozladunku${sfx}`];
    if (plannedDate) {
      const t = plannedTime || "00:00";
      const plannedMs = Date.parse(`${plannedDate}T${t}:00+02:00`);
      if (!isNaN(plannedMs)) {
        const actualMs = new Date(lastDotarcieRoz.ts).getTime();
        const diffMin = Math.round((actualMs - plannedMs) / 60000);
        punctualityMin = diffMin;
        if (Math.abs(diffMin) <= 15) punctualityText = "Na czas";
        else if (diffMin > 0) punctualityText = `${diffMin} min spóźnienia`;
        else punctualityText = `${Math.abs(diffMin)} min wcześniej`;
      }
    }
  }

  return {
    kmTotal,
    tripDurationMin,
    punctualityMin,
    punctualityText,
    rozladunekTs: lastDotarcieRoz?.ts || null,
    zaladunekTs: firstDotarcieZal?.ts || null,
    maxR,
  };
}

function fmtTripDurationServer(min) {
  if (min == null || min < 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

// Helper — render sekcję adresów (Z1+ewent. Z2, R1+ewent. R2-R5)
function buildAddressSection(fracht, esc) {
  const renderPoint = (label, kod, miasto, adres, telefon, data /*, godz - usunięte na user request */) => {
    const parts = [kod, miasto].filter(Boolean).map(esc).join(" ");
    if (!parts && !adres && !data) return "";
    const dateStr = data ? esc(data) : "";
    return `
      <div style="margin-bottom:8px;">
        <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:2px;">${label}</div>
        <div style="font-size:14px; color:#1e293b; font-weight:600;">${parts || "—"}</div>
        ${adres ? `<div style="font-size:12px; color:#475569;">${esc(adres)}</div>` : ""}
        ${telefon ? `<div style="font-size:12px; color:#475569;">tel: ${esc(telefon)}</div>` : ""}
        ${dateStr ? `<div style="font-size:11px; color:#94a3b8; margin-top:2px;">${dateStr}</div>` : ""}
      </div>`;
  };
  let html = "";
  // Załadunek Z1
  html += renderPoint("Załadunek 1", fracht.zaladunekKod, fracht.zaladunekMiasto, fracht.zaladunekAdres, fracht.zaladunekTelefon, fracht.dataZaladunku, fracht.godzZaladunku);
  // Z2 (opcjonalny)
  if (fracht.zaladunekKod2 || fracht.zaladunekMiasto2) {
    html += renderPoint("Załadunek 2", fracht.zaladunekKod2, fracht.zaladunekMiasto2, fracht.zaladunekAdres2, fracht.zaladunekTelefon2, fracht.dataZaladunku2, fracht.godzZaladunku2);
  }
  // Rozładunki R1-R5 — zawsze z cyferką (Rozładunek 1, 2, ...)
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    if (!fracht[`dokod${sfx}`] && !fracht[`dokodMiasto${sfx}`]) continue;
    html += renderPoint(`Rozładunek ${i}`, fracht[`dokod${sfx}`], fracht[`dokodMiasto${sfx}`], fracht[`rozladunekAdres${sfx}`], fracht[`rozladunekTelefon${sfx}`], fracht[`dataRozladunku${sfx}`], fracht[`godzRozladunku${sfx}`]);
  }
  return html;
}

// Helper — render sekcję dokumentów/zdjęć z events (max 6 per typ).
// Respektuje content flags: cmrZal, cmrRoz, towar, damage. Jeśli wszystko false/empty, zwraca "".
function buildCmrSection(events, esc, content = {}) {
  if (!Array.isArray(events) || events.length === 0) return "";
  const cmrZal = (content.cmrZal !== false) ? events.filter(e => e.type === "cmr_zaladunek_photo" && e.photoUrl).slice(0, 6) : [];
  const cmrRoz = (content.cmrRoz !== false) ? events.filter(e => (e.type === "cmr_rozladunek_photo" || e.type === "cmr_photo") && e.photoUrl).slice(0, 6) : [];
  const towar  = (content.towar) ? events.filter(e => e.type === "towar_photo" && e.photoUrl).slice(0, 6) : [];
  const damage = (content.damage) ? events.filter(e => e.type === "towar_damage_photo" && e.photoUrl).slice(0, 6) : [];
  if (cmrZal.length === 0 && cmrRoz.length === 0 && towar.length === 0 && damage.length === 0) return "";

  // URL safe-encoding: tylko `"` (żeby zamknąć attr) — NIE escape `&` na `&amp;`
  // bo niektóre klienty mailowe trzymają `&amp;` literalnie i token w URL ginie → 404.
  const safeUrl = (url) => String(url).replace(/"/g, "%22");
  const renderLinks = (label, items) => {
    if (items.length === 0) return "";
    const links = items.map((e, i) => `<a href="${safeUrl(e.photoUrl)}" style="color:#3b82f6; text-decoration:none; margin-right:8px;">📄 ${label} ${i + 1}</a>`).join("");
    return `<div style="margin-bottom:6px;">${links}</div>`;
  };

  return `
    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px; margin-top:12px;">
      <div style="font-size:11px; color:#92400e; font-weight:700; text-transform:uppercase; margin-bottom:8px;">📄 Dokumenty i zdjęcia</div>
      ${renderLinks("CMR załadunek", cmrZal)}
      ${renderLinks("CMR rozładunek", cmrRoz)}
      ${renderLinks("Towar (załadunek)", towar)}
      ${renderLinks("Uszkodzenia", damage)}
    </div>`;
}

function buildTripSummaryEmailHTML(fracht, vehicle, stats, opts = {}) {
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const { partner, partnerStats, partnerRole, events = [], partnerEvents = [] } = opts;
  // partnerRole: "etap1" | "etap2" — co partner reprezentuje względem fracht.
  // Etap 1 = oryginał (wyjazd), Etap 2 = powrotny.
  // events / partnerEvents — driver events do sekcji CMR (zdjęcia).
  // emailContent — flags z fracht: { adresy, cmrZal, cmrRoz, towar, damage }. Defaults gdy brak.
  const content = opts.emailContent || { adresy: true, cmrZal: true, cmrRoz: true, towar: false, damage: false };
  const showAdresy = content.adresy !== false;

  const nrZlecenia = esc(fracht.nrZlecenia || fracht.nrRef || "—");
  const klient = esc(fracht.klient || fracht.zleceniodawcaFirma || "—");
  const plate = esc(vehicle?.plate || "—");

  const fromCity = esc(fracht.zaladunekMiasto || fracht.zaladunekKod || "—");
  const sfx = stats.maxR === 1 ? "" : String(stats.maxR);
  const toCity = esc(fracht[`dokodMiasto${sfx}`] || fracht[`dokod${sfx}`] || "—");

  const kmTotal = stats.kmTotal != null ? `${stats.kmTotal} km` : "—";
  const tripDuration = stats.tripDurationMin != null ? fmtTripDurationServer(stats.tripDurationMin) : "—";
  const punctuality = esc(stats.punctualityText || "—");

  // Round-trip — render obu etapów + sumy
  if (partner && partnerStats) {
    const isCurrentReturn = partnerRole === "etap1"; // partner = etap1 → ja jestem powrotem (etap2)
    const etap1Fracht = isCurrentReturn ? partner : fracht;
    const etap1Stats = isCurrentReturn ? partnerStats : stats;
    const etap2Fracht = isCurrentReturn ? fracht : partner;
    const etap2Stats = isCurrentReturn ? stats : partnerStats;

    const sumKm = (etap1Stats.kmTotal || 0) + (etap2Stats.kmTotal || 0);
    const sumDurationMin = (etap1Stats.tripDurationMin || 0) + (etap2Stats.tripDurationMin || 0);

    const etap1Events = (partnerRole === "etap1") ? partnerEvents : events;
    const etap2Events = (partnerRole === "etap1") ? events : partnerEvents;

    const renderEtap = (label, f, s, evts, color) => {
      const fSfx = s.maxR === 1 ? "" : String(s.maxR);
      const fFrom = esc(f.zaladunekMiasto || f.zaladunekKod || "—");
      const fTo = esc(f[`dokodMiasto${fSfx}`] || f[`dokod${fSfx}`] || "—");
      const fNr = esc(f.nrZlecenia || f.nrRef || "—");
      const fKm = s.kmTotal != null ? `${s.kmTotal} km` : "—";
      const fDur = s.tripDurationMin != null ? fmtTripDurationServer(s.tripDurationMin) : "—";
      const fPunct = esc(s.punctualityText || "—");
      return `
    <div style="background:${color}; border-radius:8px; padding:16px; margin-bottom:12px;">
      <div style="font-size:11px; color:#64748b; font-weight:700; margin-bottom:4px;">${label} — zlecenie #${fNr}</div>
      <div style="font-size:16px; color:#1e293b; font-weight:600; margin-bottom:8px;">${fFrom} → ${fTo}</div>
      ${showAdresy ? buildAddressSection(f, esc) : ""}
      <div style="font-size:13px; color:#475569; margin-top:8px;">${fKm} · ${fDur} · ${fPunct}</div>
      ${buildCmrSection(evts, esc, content)}
    </div>`;
    };

    return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>Kółko zakończone — ${nrZlecenia}</title></head>
<body style="font-family: Arial, sans-serif; background:#f8f9fb; margin:0; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align:center; margin-bottom:16px;">
      <img src="https://fleetstat.pl/vbs-logo.png" alt="VBS Transport" style="max-width:180px; height:auto; display:inline-block;">
    </div>
    <h1 style="font-size:20px; color:#1e293b; margin:0 0 8px 0;">🔄 Kółko zakończone ✅</h1>
    <p style="color:#64748b; margin:0 0 20px 0;">Trasa okrężna dla <strong>${klient}</strong> została zrealizowana.<br>Pojazd: <strong>${plate}</strong></p>

    ${renderEtap("ETAP 1 (wyjazd)", etap1Fracht, etap1Stats, etap1Events, "#eff6ff")}
    ${renderEtap("ETAP 2 (powrót)", etap2Fracht, etap2Stats, etap2Events, "#faf5ff")}

    <div style="background:#f1f5f9; border-radius:8px; padding:16px; margin-top:16px;">
      <div style="font-size:11px; color:#64748b; font-weight:700; margin-bottom:8px;">SUMA CAŁEGO KÓŁKA</div>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:6px 0; color:#64748b;">Łączne kilometry</td>
          <td style="padding:6px 0; text-align:right; font-weight:600; color:#1e293b;">${sumKm > 0 ? `${sumKm} km` : "—"}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#64748b;">Łączny czas trasy</td>
          <td style="padding:6px 0; text-align:right; font-weight:600; color:#1e293b;">${sumDurationMin > 0 ? fmtTripDurationServer(sumDurationMin) : "—"}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center;">
      Wiadomość wygenerowana automatycznie przez FleetStat<br>
      <a href="https://fleetstat.pl" style="color:#3b82f6; text-decoration:none;">fleetstat.pl</a>
    </p>
  </div>
</body>
</html>`;
  }

  // Pojedyncza trasa (nie round-trip)
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>Trasa zakończona — ${nrZlecenia}</title></head>
<body style="font-family: Arial, sans-serif; background:#f8f9fb; margin:0; padding:20px;">
  <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:12px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align:center; margin-bottom:16px;">
      <img src="https://fleetstat.pl/vbs-logo.png" alt="VBS Transport" style="max-width:180px; height:auto; display:inline-block;">
    </div>
    <h1 style="font-size:20px; color:#1e293b; margin:0 0 8px 0;">Trasa zakończona ✅</h1>
    <p style="color:#64748b; margin:0 0 20px 0;">Zlecenie nr <strong>${nrZlecenia}</strong> dla <strong>${klient}</strong> zostało zrealizowane.</p>

    <div style="background:#f1f5f9; border-radius:8px; padding:16px; margin-bottom:16px;">
      <div style="font-size:13px; color:#64748b; margin-bottom:12px;">Pojazd: ${plate}</div>
      ${showAdresy ? buildAddressSection(fracht, esc) : ""}
    </div>

    ${buildCmrSection(events, esc, content)}

    <p style="font-size:12px; color:#94a3b8; margin-top:24px; text-align:center;">
      Wiadomość wygenerowana automatycznie przez FleetStat<br>
      <a href="https://fleetstat.pl" style="color:#3b82f6; text-decoration:none;">fleetstat.pl</a>
    </p>
  </div>
</body>
</html>`;
}

exports.finalizeTrip = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Wymagane logowanie.");

    // args:
    //   frachtId — wymagany
    //   force    — bypass email idempotency (manual resend przez dyspo)
    //   source   — "auto" (DriverPanel post-dotarcie_rozladunek) | "manual" (admin button)
    const { frachtId, force = false, source = "auto" } = request.data || {};
    if (!frachtId || typeof frachtId !== "string") {
      throw new HttpsError("invalid-argument", "Brak frachtId");
    }

    const db = getFirestore();
    const fleetRef = db.doc("fleet/data");
    const fleetSnap = await fleetRef.get();
    if (!fleetSnap.exists) throw new HttpsError("not-found", "Brak fleet/data");

    const fleetData = fleetSnap.data() || {};
    const frachtyList = fleetData.fleetv2_frachty || [];
    const fracht = frachtyList.find(f => f && f.id === frachtId);
    if (!fracht) throw new HttpsError("not-found", "Fracht nie znaleziony");

    // Email idempotency: blokuj tylko gdy email już wysłany I caller nie wymaga force.
    // (Auto trigger po dotarcie_rozladunek przekazuje force=false → block jest OK żeby
    //  klient nie dostał drugiego maila przy cofnij+ponowny click.
    //  Manual button dyspo przekazuje force=true → bypass żeby resend działał po fail-auto
    //  lub gdy klient prosi o duplikat. tripFinalizedAt NIE blokuje — to idempotency
    //  trackerOff, niezależna od email.)
    if (fracht.tripEmailSentAt && !force) {
      console.log(`[finalizeTrip] Email already sent, skip (source=${source}): ${frachtId}`);
      return {
        ok: true,
        emailSent: false,
        alreadySent: true,
        previousSentAt: fracht.tripEmailSentAt,
      };
    }

    const eventsSnap = await db.collection("driverEvents").where("frachtId", "==", frachtId).get();
    const events = eventsSnap.docs.map(d => d.data());
    const vehicles = fleetData.fleetv2_vehicles || [];
    const vehicle = vehicles.find(v => v && v.id === fracht.vehicleId);
    const stats = computeTripStats(fracht, events);
    const nowIso = new Date().toISOString();

    // ════════════════════════════════════════════════════════════════════════
    // ROUND-TRIP detection — czy fracht jest częścią kółka (linkedFrachtId)?
    // ════════════════════════════════════════════════════════════════════════
    // Auto trigger po dotarcie_rozladunek: jeśli partner istnieje I jeszcze nie
    // zakończony → CZEKAMY (nie wysyłamy email). Email wyjdzie dopiero gdy oba
    // etapy ukończone — wtedy 1 email z podsumowaniem CAŁEGO kółka.
    // Manual (force=true): omija waiting, wysyła z dostępnymi danymi.
    const linkedId = fracht.linkedFrachtId
      || frachtyList.find(o => o && o.linkedFrachtId === fracht.id)?.id;
    const linkedFracht = linkedId ? frachtyList.find(o => o && o.id === linkedId) : null;
    const partnerRole = fracht.linkedFrachtId ? "etap1" : "etap2";
    let partnerStats = null;
    let partnerRozladowano = false;
    let partnerEvents = [];

    if (linkedFracht) {
      try {
        const partnerEvSnap = await db.collection("driverEvents").where("frachtId", "==", linkedId).get();
        partnerEvents = partnerEvSnap.docs.map(d => d.data());
      } catch (e) { console.warn("[finalizeTrip] partner events query:", e.message); }

      partnerRozladowano = linkedFracht.statusRozladunkuManual === "rozladowano"
        || linkedFracht.statusRozladunku === "rozladowano";
      if (!partnerRozladowano) {
        const lastRoz = partnerEvents.filter(e => e.type === "rozladowano").sort((a,b) => (b.ts||"").localeCompare(a.ts||""))[0];
        const lastRozUndo = partnerEvents.filter(e => e.type === "cofnij_rozladowano").sort((a,b) => (b.ts||"").localeCompare(a.ts||""))[0];
        if (lastRoz && (!lastRozUndo || lastRoz.ts > lastRozUndo.ts)) partnerRozladowano = true;
      }
      partnerStats = computeTripStats(linkedFracht, partnerEvents);

      // Auto trigger waiting: nadal trackerOff aktualnego, NIE wysyłamy email
      if (!partnerRozladowano && source === "auto") {
        console.log(`[finalizeTrip] Round-trip — partner ${linkedId} not unloaded, waiting (source=auto): ${frachtId}`);
        const newFrachtyList = frachtyList.map(f =>
          f && f.id === frachtId
            ? { ...f, trackerEnabled: false, tripFinalizedAt: f.tripFinalizedAt || nowIso }
            : f
        );
        await fleetRef.update({ fleetv2_frachty: newFrachtyList });
        await db.collection("emailLogs").add({
          sentAt: nowIso, type: "trip_summary_waiting", frachtId, source,
          status: "waiting_partner", linkedFrachtId: linkedId,
        });
        return { ok: true, emailSent: false, reason: "waiting_for_partner", linkedFrachtId: linkedId };
      }
    }

    const isRoundTripFinal = !!(linkedFracht && partnerRozladowano);

    // Helper — write fleet/data. Plus przy round-trip success: synchronizuje
    // tripEmailSentAt/tripEmailRecipient na PARTNERA też (idempotency block dla obu).
    const updateFracht = async (extraPatch = {}, syncPartner = false) => {
      const newFrachtyList = frachtyList.map(f => {
        if (!f) return f;
        if (f.id === frachtId) {
          return { ...f, trackerEnabled: false, tripFinalizedAt: f.tripFinalizedAt || nowIso, ...extraPatch };
        }
        if (syncPartner && linkedId && f.id === linkedId) {
          return { ...f, ...extraPatch };
        }
        return f;
      });
      await fleetRef.update({ fleetv2_frachty: newFrachtyList });
    };

    const recipientEmail = (fracht.zleceniodawcaEmail || "").trim();
    if (!recipientEmail) {
      console.log(`[finalizeTrip] No zleceniodawcaEmail (source=${source}): ${frachtId}`);
      await updateFracht();
      await db.collection("emailLogs").add({
        sentAt: nowIso, type: "trip_summary", frachtId, source, status: "skipped_no_recipient",
      });
      return { ok: true, emailSent: false, reason: "no_recipient" };
    }

    const configSnap = await db.doc("config/email").get();
    if (!configSnap.exists || !configSnap.data().sendgridApiKey) {
      console.error("[finalizeTrip] No SendGrid config");
      await updateFracht();
      await db.collection("emailLogs").add({
        sentAt: nowIso, type: "trip_summary", frachtId, source, recipients: [recipientEmail],
        status: "error", error: "no_sendgrid_config",
      });
      return { ok: true, emailSent: false, reason: "no_sendgrid_config" };
    }
    const config = configSnap.data();
    sgMail.setApiKey(config.sendgridApiKey);

    // emailContent flags z fracht (z defaults gdy legacy/brak)
    const emailContent = (fracht.emailContent && typeof fracht.emailContent === "object")
      ? fracht.emailContent
      : { adresy: true, cmrZal: true, cmrRoz: true, towar: false, damage: false };

    const html = buildTripSummaryEmailHTML(fracht, vehicle, stats,
      isRoundTripFinal
        ? { partner: linkedFracht, partnerStats, partnerRole, events, partnerEvents, emailContent }
        : { events, emailContent }
    );
    const nrZlecenia = fracht.nrZlecenia || fracht.nrRef || "—";
    const subject = isRoundTripFinal
      ? `🔄 Kółko zakończone — ${nrZlecenia}${linkedFracht.nrZlecenia ? ` + ${linkedFracht.nrZlecenia}` : ""}`
      : `🚛 Trasa zakończona — ${nrZlecenia}`;

    try {
      await sgMail.send({
        to: recipientEmail,
        from: config.senderEmail || "fleetstat@fleetstat.pl",
        subject,
        html,
      });
      console.log(`[finalizeTrip] Email sent to ${recipientEmail} (source=${source}, roundTrip=${isRoundTripFinal}): ${frachtId}`);
      // Round-trip: tripEmailSentAt na obu frachtach (idempotency block dla partnera też,
      // żeby gdy partner kliknie "Wyślij podsumowanie" manual nie wysłał drugiego maila).
      await updateFracht({ tripEmailSentAt: nowIso, tripEmailRecipient: recipientEmail }, isRoundTripFinal);
      await db.collection("emailLogs").add({
        sentAt: nowIso,
        type: isRoundTripFinal ? "round_trip_summary" : "trip_summary",
        frachtId, source, recipients: [recipientEmail], status: "sent",
        ...(isRoundTripFinal && { linkedFrachtId: linkedId }),
      });
      return { ok: true, emailSent: true, sentAt: nowIso, recipient: recipientEmail, roundTrip: isRoundTripFinal };
    } catch (e) {
      console.error(`[finalizeTrip] Email send failed (source=${source}): ${e.message}`);
      // Tracker auto-off mimo to (admin może retry mailem; trasa zakończona niezależnie)
      await updateFracht();
      await db.collection("emailLogs").add({
        sentAt: nowIso, type: "trip_summary", frachtId, source, recipients: [recipientEmail],
        status: "error", error: e.message,
      });
      return { ok: true, emailSent: false, reason: "send_failed", error: e.message };
    }
  }
);
