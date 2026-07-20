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
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const beforeRole = before?.role || null;
    const afterRole = after?.role || null;

    // Audit log: każda zmiana roli zapisana (kto/kiedy/co). Pominę jeśli rola się nie zmieniła.
    if (beforeRole !== afterRole) {
      try {
        await getFirestore().collection("auditLog").add({
          action: "role_change",
          ts: new Date().toISOString(),
          targetUid: uid,
          targetEmail: after?.email || before?.email || null,
          before: beforeRole,
          after: afterRole,
          source: "onRoleChange_trigger",
        });
      } catch (e) {
        console.warn(`auditLog write failed for ${uid}:`, e.message);
      }
    }

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
// Resend REST API — wysyłka email (zastąpiło @sendgrid/mail; trial SendGrid wygasł
// 1.06.2026 → wszystkie wysyłki 401 Unauthorized). Node 20 ma globalny fetch.
// Batch endpoint: 1..100 wiadomości jednym żądaniem, każda z własnym `to`
// (odbiorcy nie widzą się nawzajem — jak stare sgMail.sendMultiple).
async function sendEmailsResend(apiKey, messages) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(messages),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

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
// Status rozładunku — parytet z frontendem (src/utils/frachtStatus.js computeFrachtStatus).
// CommonJS CF nie importuje ESM utila → port inline. Hierarchia: statusRozladunkuManual
// (admin override) > statusRozladunku legacy > najnowszy driverEvent rozladowano (nie
// cofnięty) > w_trasie. Bez tego email czytał tylko puste `statusRozladunku` → auta
// rozładowane (ręcznie lub przez kierowcę) pokazywały się błędnie jako "W trasie".
function isFrachtRozladowanyCF(fracht, events = []) {
  if (!fracht) return false;
  if (fracht.statusRozladunkuManual) return fracht.statusRozladunkuManual === "rozladowano";
  if (fracht.statusRozladunku === "rozladowano") return true;
  if (Array.isArray(events) && events.length > 0) {
    const roz = events
      .filter(e => e && (e.type === "rozladowano" || e.type === "cofnij_rozladowano"))
      .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    if (roz.length > 0 && roz[0].type === "rozladowano") return true;
  }
  return false;
}

function buildEmailHTML(vehicles, frachtyList, pauzyList, eventsByFracht = {}) {
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
      if (isFrachtRozladowanyCF(r, eventsByFracht[r.id])) return false;
      return r.dataZaladunku <= todayISO && todayISO <= r.dataRozladunku;
    });

    // Następny fracht (przyszły załadunek)
    const nextF = vFrachty
      .filter(r => r.dataZaladunku && r.dataZaladunku > todayISO && !isFrachtRozladowanyCF(r, eventsByFracht[r.id]))
      .sort((a, b) => a.dataZaladunku.localeCompare(b.dataZaladunku))[0] || null;

    // Ostatni rozładowany fracht
    const lastDoneF = vFrachty
      .filter(r => isFrachtRozladowanyCF(r, eventsByFracht[r.id]) || (r.dataRozladunku && r.dataRozladunku < todayISO))
      .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""))[0] || null;

    // Aktywna pauza
    const vehiclePauza = pauzyList.find(p =>
      p.vehicleId === v.id &&
      p.status !== "jazda" &&
      p.start <= todayISO &&
      p.end >= todayISO
    );

    // Pauza zaplanowana w przyszłości (najwcześniejsza)
    const futurePauza = pauzyList
      .filter(p => p.vehicleId === v.id && p.status !== "jazda" && p.start > todayISO)
      .sort((a, b) => a.start.localeCompare(b.start))[0] || null;

    // Smart baza — kierowca rozładował się + ma zaplanowaną bazę → JEST już na bazie
    // (logika z UI commit 3c7392a). Tylko dla status="baza" (pauza9/11/24/45 to konkretne odpoczynki).
    const isCurrentlyAtBaza = !vehiclePauza
      && futurePauza?.status === "baza"
      && lastDoneF?.dataRozladunku && lastDoneF.dataRozladunku <= todayISO
      && (!nextF || futurePauza.start <= nextF.dataZaladunku);

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

    // Etykieta ostatniego rozładunku w ciągu R1..R5 (patrz getMaxRouteIndex).
    // Wcześniej lista urywała się na `dokod3` → auta z 4-5 stopami pokazywały zły cel.
    const lastDokod = (f) => {
      let out = null;
      for (let i = 1; i <= 5; i++) {
        const sfx = i === 1 ? "" : String(i);
        const kod = [f[`dokodPocztowy${sfx}`], f[`dokodMiasto${sfx}`]].filter(s => s && String(s).trim()).join(" ").trim()
          || (f[`dokod${sfx}`] || "").trim();
        if (kod) out = kod;
      }
      return out;
    };

    if (activeF) {
      statusText = "🚛 W trasie";
      statusColor = "#15803d";
      statusBg = "#f0fdf4";
      statusType = "trasa";
      // Pokaż OSTATNI rozładunek w ciągu (jeśli po aktywnym jest nextF — tam auto jedzie na końcu)
      const pendingFrachty = vFrachty
        .filter(r => !isFrachtRozladowanyCF(r, eventsByFracht[r.id]) && r.dataRozladunku && r.dataRozladunku >= todayISO)
        .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""));
      const lastPending = pendingFrachty[0] || activeF;
      const rozlKod = lastDokod(lastPending) || "—";
      const rozlDate = lastPending.dataRozladunku ? fmtDate(lastPending.dataRozladunku) : "";
      details = rozlDate ? `${rozlKod} · ${rozlDate}` : rozlKod;
    } else if (vehiclePauza || isCurrentlyAtBaza) {
      // Smart baza: gdy auto rozładowane + ma future pauzę baza, traktuj jako pauzę aktywną
      const effectivePauza = vehiclePauza || futurePauza;
      const pauzaLabels = { pauza9: "Pauza 9h", pauza11: "Pauza 11h", pauza24: "Pauza 24h", pauza45: "Pauza 45h", pauzaInne: "Pauza", baza: "Baza" };
      statusText = effectivePauza.status === "baza" ? "🏠 Baza" : `⏸️ ${pauzaLabels[effectivePauza.status] || "Pauza"}`;
      statusColor = effectivePauza.status === "baza" ? "#0369a1" : "#9333ea";
      statusBg = effectivePauza.status === "baza" ? "#f0f9ff" : "#faf5ff";
      statusType = "pauza";
      const BAZA_KOD = "PL 25-611 Kielce";
      // Dla statusu "baza" → kod bazy; dla pauzy w trasie → ostatni kod rozładunku
      let locationKod = BAZA_KOD;
      if (effectivePauza.status !== "baza") {
        // Weź kod z ostatniego rozładowanego frachtu (tam kierowca faktycznie stoi)
        const refF = lastDoneF || activeF;
        if (refF) {
          locationKod = lastDokod(refF) || BAZA_KOD;
        }
      }
      details = `Dostępny od: ${fmtDate(effectivePauza.end)} · ${locationKod}`;
    } else if (nextF) {
      // Załadunek zaplanowany = traktuj jako "W trasie" (auto nie jest dostępne)
      statusText = "🚛 W trasie";
      statusColor = "#15803d";
      statusBg = "#f0fdf4";
      statusType = "trasa";
      // Pokaż OSTATNI rozładunek z przyszłych frachtów (tam auto jedzie na końcu)
      const futureFrachty = vFrachty
        .filter(r => !isFrachtRozladowanyCF(r, eventsByFracht[r.id]) && r.dataRozladunku && r.dataRozladunku >= todayISO)
        .sort((a, b) => (b.dataRozladunku || "").localeCompare(a.dataRozladunku || ""));
      const lastFuture = futureFrachty[0] || nextF;
      const nextKod = lastDokod(lastFuture) || "—";
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
        ? (lastDokod(lastDoneF) || "—")
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
        <td style="padding:16px 24px;border-bottom:1px solid #f0f0f2;">
          <div style="font-size:15px;font-weight:700;color:#1d1d1f;line-height:1.35;margin-bottom:6px;word-break:break-word;">
            ${vehicleInfo || v.type || "—"}
          </div>
          <div style="font-size:13px;color:#6e6e73;line-height:1.45;word-break:break-word;">
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
<body style="margin:0;padding:28px 14px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #ececed;box-shadow:0 10px 30px rgba(0,0,0,0.06),0 2px 6px rgba(0,0,0,0.04);">

    <!-- LOGO VBS -->
    <div style="text-align:center;padding:26px 20px 0 20px;">
      <img src="https://fleetstat.pl/vbs-logo.png" alt="VBS Transport" style="max-width:170px;height:auto;display:inline-block;">
    </div>

    <!-- HEADER -->
    <div style="padding:22px 36px 26px;margin-top:16px;text-align:center;border-top:1px solid #f0f0f2;border-bottom:1px solid #f0f0f2;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;">
        <tr>
          <td style="vertical-align:middle;padding-right:18px;">
            <img src="https://fleetstat.pl/logodologowania.png" alt="FleetStat" width="140" style="display:block;width:140px;height:auto;">
          </td>
          <td style="vertical-align:middle;padding-left:18px;border-left:2px solid #e5e7eb;font-size:19px;font-weight:700;color:#1d1d1f;">Status floty</td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:13px;color:#86868b;">${dateStr} · ${timeStr}</p>
    </div>

    <!-- PODSUMOWANIE -->
    <div style="padding:16px 32px;text-align:center;background:#fafafa;border-bottom:1px solid #f0f0f2;">
      <span style="font-size:13px;color:#6e6e73;">
        W trasie: <strong style="color:#1d1d1f;">${activeVehicles.filter(d => d.statusType === "trasa").length}</strong> &nbsp;·&nbsp;
        Pauza/Baza: <strong style="color:#1d1d1f;">${activeVehicles.filter(d => d.statusType === "pauza").length}</strong>
      </span>
    </div>

    <!-- LISTA POJAZDÓW -->
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>

    <!-- FOOTER -->
    <div style="padding:18px 32px;background:#fafafa;text-align:center;border-top:1px solid #f0f0f2;">
      <p style="margin:0;font-size:11px;color:#86868b;">
        Wygenerowano automatycznie przez <a href="https://fleetstat.pl" style="color:#0071e3;text-decoration:none;">FleetStat</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Główna funkcja wysyłki emaili
async function sendFleetStatusEmail() {
  const db = getFirestore();

  // 1. Pobierz klucz API email z konfiguracji (Resend; klucz re_... trzymany w polu
  //    sendgridApiKey dla zgodności z istniejącym panelem, resendApiKey opcjonalnie).
  const configSnap = await db.doc("config/email").get();
  const config = configSnap.exists ? configSnap.data() : {};
  const apiKey = config.resendApiKey || config.sendgridApiKey;
  if (!apiKey) {
    console.error("Brak klucza API email w config/email");
    return { success: false, error: "Brak konfiguracji email" };
  }

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

  // 4b. Pobierz driverEvents → status rozładunku (parytet z frontendem). Email nie może
  //     polegać tylko na statusRozladunkuManual — trasy zamknięte przez kierowcę mają
  //     status wyłącznie w eventach. Grupuj per frachtId (kolekcja mała, ~250 dok.).
  const eventsSnap = await db.collection("driverEvents").get();
  const eventsByFracht = {};
  eventsSnap.docs.forEach(d => {
    const e = d.data();
    if (!e.frachtId) return;
    (eventsByFracht[e.frachtId] = eventsByFracht[e.frachtId] || []).push(e);
  });

  // 5. Generuj HTML
  const html = buildEmailHTML(vehicles, frachtyList, pauzyList, eventsByFracht);

  const todayPL = new Date().toLocaleDateString("pl-PL", {
    day: "numeric", month: "long", timeZone: "Europe/Warsaw"
  });
  const timeStr = new Date().toLocaleTimeString("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw"
  });

  // 6. Wyślij
  try {
    const from = config.senderEmail || "flotaVBS@fleetstat.pl";
    const subject = `🚛 FleetStat — Status floty · ${todayPL} · ${timeStr}`;
    // Osobny mail na każdego odbiorcę (batch) — odbiorcy nie widzą się nawzajem.
    await sendEmailsResend(apiKey, recipients.map(r => ({ from, to: [r], subject, html })));
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

    const authHeader = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

    // 3a. Fetch device list (mapowanie deviceId → deviceName).
    // Atlas zmienił format response ~28.04.2026 — positions teraz mają tylko `deviceId`
    // zamiast zagnieżdżonego `dev.deviceName`. Trzymamy lookup po obu.
    const deviceMap = {};
    try {
      const devUrl = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/devices`;
      const devResp = await fetch(devUrl, {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": authHeader },
        signal: AbortSignal.timeout(10000),
      });
      if (devResp.ok) {
        const devBody = await devResp.json();
        const devList = devBody?.deviceList || devBody?.data?.deviceList || [];
        for (const d of devList) {
          if (d?.deviceId) deviceMap[String(d.deviceId)] = String(d.deviceName || d.plate || "");
        }
      } else {
        console.warn(`scheduledGpsPoll: /devices ${devResp.status}`);
      }
    } catch (e) {
      console.warn("scheduledGpsPoll: /devices fetch error:", e.message);
    }

    // 3b. Fetch positions z Atlas
    let positions = [];
    try {
      const url = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/positionsWithCanDetails`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": authHeader },
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
      const devNameFromMap = pos?.deviceId ? deviceMap[String(pos.deviceId)] : "";
      const devPlate = String(pos?.dev?.deviceName || pos?.dev?.plate || pos?.deviceName || pos?.plate || devNameFromMap || "")
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

    const authHeader = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

    // Cache deviceId → deviceName (Atlas zmienił format ~28.04.2026)
    const deviceMap = {};
    try {
      const devUrl = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/devices`;
      const devResp = await fetch(devUrl, {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": authHeader },
        signal: AbortSignal.timeout(10000),
      });
      if (devResp.ok) {
        const devBody = await devResp.json();
        const devList = devBody?.deviceList || devBody?.data?.deviceList || [];
        for (const d of devList) {
          if (d?.deviceId) deviceMap[String(d.deviceId)] = String(d.deviceName || d.plate || "");
        }
      }
    } catch (e) {
      console.warn("scheduledHistorySync: /devices fetch error:", e.message);
    }

    // Fetch /history dla roku+miesiąca
    let items = [];
    try {
      const url = `https://widziszwszystko.eu/atlas/${cfg.group}/${cfg.username}/history?year=${year}&month=${month}`;
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "Authorization": authHeader },
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
        const devNameFromMap = p?.deviceId ? deviceMap[String(p.deviceId)] : "";
        const pPlate = String(p?.dev?.deviceName || p?.dev?.plate || p?.deviceName || p?.plate || devNameFromMap || "")
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
// CLOSE STALE DRIVER ACTIVITIES — auto-close segmentów otwartych >24h
// 1:00 CET codziennie. Bug 2026-05-04: kierowca/admin kliknął "Jazda"
// w driver app i zapomniał zamknąć — segment rósł 5 dni → 121h fałszywej jazdy.
// Auto-close ustawia endTs = startTs + 5 min (token close — segment nie liczy czasu).
// ═══════════════════════════════════════════════════════════════
exports.closeStaleActivities = onSchedule(
  { schedule: "0 1 * * *", timeZone: "Europe/Warsaw", region: "europe-west1" },
  async () => {
    const db = getFirestore();
    const cutoff24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    try {
      // Wszystkie open segments (endTs == null)
      const snap = await db.collection("driverActivities").where("endTs", "==", null).get();
      let closed = 0;
      for (const doc of snap.docs) {
        const a = doc.data();
        if (!a.startTs || a.startTs >= cutoff24h) continue; // świeży, OK
        // Token close: endTs = startTs + 5 min (segment nie liczy realnego czasu jazdy)
        const tokenEnd = new Date(new Date(a.startTs).getTime() + 5 * 60 * 1000).toISOString();
        await doc.ref.update({
          endTs: tokenEnd,
          autoClosedAt: new Date().toISOString(),
          autoCloseReason: "stale_>24h_no_close",
        });
        closed++;
        console.log(`[closeStaleActivities] Closed ${doc.id}: ${a.driverEmail} ${a.type} from ${a.startTs}`);
      }
      console.log(`[closeStaleActivities] Total closed: ${closed} (z ${snap.size} open)`);
      if (closed > 0) {
        await db.collection("auditLog").add({
          ts: new Date().toISOString(),
          action: "auto_close_stale",
          module: "driverActivities",
          details: { count: closed, totalOpen: snap.size },
        });
      }
    } catch (e) {
      console.error("[closeStaleActivities] error:", e.message);
    }
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
//         → readesm-js.convertToJson → ekstrakcja → dddFiles (Firestore)
//
// UWAGA: dane DDD NIE trafiają do driverActivities (live state Czas pracy).
//   DDD = archive snapshot per kierowca (do 365 dni historii). Wpisanie
//   do driverActivities zaburzyłoby compliance bieżącego tygodnia.
//   Surowe segmenty + summary zapisane w dddFiles, raport per kierowca
//   generowany w UI z compact daily ribbons.
//
// readesm-js v1.x zwraca obiekt z kluczami top-level per block class
// (Identification, CardDriverActivity, CardVehiclesUsed, ...) — NIE
// tablicę `blocks[]` jak zakładała poprzednia implementacja.
// ═══════════════════════════════════════════════════════════════

// TimeReal / BcdDate → ISO string (fallback gdy readesm-js zwraca raw)
function timeRealToIso(tr) {
  if (!tr) return null;
  if (typeof tr === "string") return tr;
  if (typeof tr === "number") return new Date(tr * 1000).toISOString();
  if (tr.timestamp) return new Date(tr.timestamp * 1000).toISOString();
  if (tr.date instanceof Date) return tr.date.toISOString();
  if (tr.year && tr.month) {
    try { return new Date(tr.year, (tr.month || 1) - 1, tr.day || 1).toISOString(); }
    catch { return null; }
  }
  return null;
}

// Wyciąga metadane karty kierowcy / pliku VU
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

  const appId = parsed.DriverCardApplicationIdentification;
  if (appId?.typeOfTachographCardId === "Driver Card") {
    meta.fileType = "card";
  } else if (parsed.VuOverview || parsed.VuIdentification) {
    meta.fileType = "vu";
  }

  const ident = parsed.Identification;
  if (ident) {
    meta.cardNumber = ident.cardNumber || null;
    if (ident.cardHolderName) {
      meta.driverFirstName = ident.cardHolderName.firstNames || null;
      meta.driverSurname = ident.cardHolderName.surname || null;
      meta.driverName = [meta.driverFirstName, meta.driverSurname].filter(Boolean).join(" ") || null;
    }
    meta.cardValidityBegin = typeof ident.cardValidityBegin === "string"
      ? ident.cardValidityBegin : timeRealToIso(ident.cardValidityBegin);
    meta.cardExpiryDate = typeof ident.cardExpiryDate === "string"
      ? ident.cardExpiryDate : timeRealToIso(ident.cardExpiryDate);
  }

  // VRN: VuOverview (pliki VU) → CardVehiclesUsed last record (karta kierowcy)
  if (parsed.VuOverview?.vehicleRegistrationNumber) {
    const vrn = parsed.VuOverview.vehicleRegistrationNumber;
    meta.vehicleVrn = vrn?.vehicleRegistrationNumber || (typeof vrn === "string" ? vrn : null);
  } else {
    const recs = parsed.CardVehiclesUsed?.CardVehicleRecord?.records;
    if (Array.isArray(recs) && recs.length > 0) {
      meta.vehicleVrn = recs[recs.length - 1]?.registration?.vehicleRegistrationNumber || null;
    }
  }

  // periodStart/End — z dailyRecords keys (deterministyczne, daty już ISO)
  const dailyRecords = parsed.CardDriverActivity?.CardActivityDailyRecord?.dailyRecords;
  if (dailyRecords && typeof dailyRecords === "object") {
    const dates = Object.keys(dailyRecords).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (dates.length > 0) {
      meta.periodStart = dates[0];
      meta.periodEnd = dates[dates.length - 1];
    }
  }

  return meta;
}

// Lista pojazdów używanych przez kierowcę (CardVehiclesUsed)
// Każdy record: { vehicleVrn, vehicleId, country, from, to, odometerBegin, odometerEnd }
function extractDddVehicleRecords(parsed, vehicles = []) {
  const records = parsed?.CardVehiclesUsed?.CardVehicleRecord?.records;
  if (!Array.isArray(records)) return [];
  const plateToId = new Map();
  for (const v of vehicles) {
    const p = String(v.plate || "").replace(/\s+/g, "").toUpperCase();
    if (p && v.id) plateToId.set(p, v.id);
  }
  const out = [];
  for (const vr of records) {
    const vrn = vr?.registration?.vehicleRegistrationNumber || null;
    if (!vrn) continue;
    const m = String(vr.vehicleUse || "").match(/From (\d{4}-\d{2}-\d{2})[^T]*To (\d{4}-\d{2}-\d{2})/);
    const odoBegin = parseInt(String(vr.vehicleOdometerBegin || "").replace(/[^\d]/g, ""), 10);
    const odoEnd = parseInt(String(vr.vehicleOdometerEnd || "").replace(/[^\d]/g, ""), 10);
    out.push({
      vehicleVrn: vrn,
      vehicleId: plateToId.get(vrn.replace(/\s+/g, "").toUpperCase()) || null,
      country: vr?.registration?.vehicleRegistrationNation || null,
      from: m ? m[1] : null,
      to: m ? m[2] : null,
      odometerBegin: Number.isFinite(odoBegin) ? odoBegin : null,
      odometerEnd: Number.isFinite(odoEnd) ? odoEnd : null,
    });
  }
  return out;
}

// Buduje raport dzienny: compact segments (do narysowania 24h ribbon w UI)
// + sumy minut per dzień + km + total summary.
//
// Format compact (fromMin/durMin zamiast ISO timestamps) żeby cały dokument
// dddFiles zmieścił się w limicie Firestore 1 MB. Dla pliku 365-dniowego
// ~4500 segmentów × ~30 bytes = ~140 KB.
//
// Mapowanie kodów tachografu → naszych typów:
//   activityCode 0 = break/rest → "rest"
//   activityCode 1 = available  → "avail"
//   activityCode 2 = work       → "work"
//   activityCode 3 = driving    → "drive"
//
// Czas Gen2 tachografu jest w UTC. Lokalny PL = UTC+1 zima / UTC+2 lato.
function computeDddDailyReport(parsed, vehicles = [], downloadCutoff = null) {
  const typeMap = { 0: "rest", 1: "avail", 2: "work", 3: "drive" };
  const dailyRecords = parsed?.CardDriverActivity?.CardActivityDailyRecord?.dailyRecords;
  const dailyTotals = {};

  // Map: data → który pojazd kierowca prowadził (z CardVehiclesUsed)
  const vehicleRecords = extractDddVehicleRecords(parsed, vehicles);
  const vehicleByDate = {};
  for (const vr of vehicleRecords) {
    if (!vr.from || !vr.to || !vr.vehicleVrn) continue;
    let cur = new Date(vr.from + "T00:00:00Z");
    const end = new Date(vr.to + "T00:00:00Z");
    while (cur <= end) {
      const day = cur.toISOString().slice(0, 10);
      if (!vehicleByDate[day]) {
        vehicleByDate[day] = { vehicleVrn: vr.vehicleVrn, vehicleId: vr.vehicleId };
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  // Walk daily activity records
  if (dailyRecords && typeof dailyRecords === "object") {
    for (const [day, rec] of Object.entries(dailyRecords)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const segs = rec?.ActivityChangeInfo?.records;
      if (!Array.isArray(segs)) continue;

      const veh = vehicleByDate[day] || { vehicleVrn: null, vehicleId: null };
      const slot = {
        drive: 0, work: 0, rest: 0, avail: 0, km: 0,
        vehicleVrn: veh.vehicleVrn,
        vehicleId: veh.vehicleId,
        segments: [],
      };

      for (const r of segs) {
        const type = typeMap[r.activityCode];
        if (!type) continue;
        const fromStr = r.from;
        const durStr = r.duration;
        if (!fromStr || !durStr) continue;
        const [fH, fM] = fromStr.split(":").map(Number);
        const [dH, dM] = durStr.split(":").map(Number);
        if (![fH, fM, dH, dM].every(Number.isFinite)) continue;
        const fromMin = fH * 60 + fM;
        const durMin = dH * 60 + dM;
        if (durMin === 0) continue;
        slot[type] += durMin;
        slot.segments.push({ type, fromMin, durMin });
      }

      dailyTotals[day] = slot;
    }
  }

  // km per dzień z vehicleRecords (single-day records — typowe dla kart)
  for (const vr of vehicleRecords) {
    if (vr.from && vr.from === vr.to && vr.odometerBegin != null && vr.odometerEnd != null) {
      const day = vr.from;
      const km = vr.odometerEnd - vr.odometerBegin;
      if (km <= 0) continue;
      if (!dailyTotals[day]) {
        dailyTotals[day] = { drive: 0, work: 0, rest: 0, avail: 0, km: 0,
                             vehicleVrn: vr.vehicleVrn, vehicleId: vr.vehicleId, segments: [] };
      }
      dailyTotals[day].km += km;
      if (!dailyTotals[day].vehicleVrn) dailyTotals[day].vehicleVrn = vr.vehicleVrn;
      if (!dailyTotals[day].vehicleId) dailyTotals[day].vehicleId = vr.vehicleId;
    }
  }

  // Fix dnia POBRANIA karty: readesm-js rozciąga ostatnią (otwartą) czynność dnia
  // do północy (fromMin+durMin = 1440). Dla dnia zgrania to fałsz — karta przestała
  // rejestrować w momencie pobrania (~godzina z nazwy pliku C_YYYYMMDD_HHMM), nie o 24:00.
  // Bez tego dzień pobrania pokazywał np. 18h34 jazdy (13h+ phantom) → false compliance.
  // Urywamy TYLKO gdy ostatni segment realnie sięga północy i cutoff mieści się w nim.
  if (downloadCutoff && dailyTotals[downloadCutoff.day]) {
    const slot = dailyTotals[downloadCutoff.day];
    const segs = slot.segments;
    if (segs.length) {
      const last = segs[segs.length - 1];
      const lastEnd = last.fromMin + last.durMin;
      if (lastEnd >= 1440 && downloadCutoff.min > last.fromMin && downloadCutoff.min < lastEnd) {
        const trimmedDur = downloadCutoff.min - last.fromMin;
        slot[last.type] -= (last.durMin - trimmedDur);
        last.durMin = trimmedDur;
      }
    }
  }

  // Total summary
  const summary = {
    totalDriveMin: 0, totalWorkMin: 0, totalRestMin: 0, totalAvailMin: 0,
    totalKm: 0, daysWorked: 0, daysWithCard: 0, vehiclesUsed: [],
  };
  const vrnSet = new Set();
  let totalSegments = 0;
  for (const day of Object.keys(dailyTotals)) {
    const d = dailyTotals[day];
    summary.totalDriveMin += d.drive;
    summary.totalWorkMin += d.work;
    summary.totalRestMin += d.rest;
    summary.totalAvailMin += d.avail;
    summary.totalKm += d.km;
    summary.daysWithCard++;
    if (d.drive > 0) summary.daysWorked++;
    if (d.vehicleVrn) vrnSet.add(d.vehicleVrn);
    totalSegments += d.segments.length;
  }
  summary.vehiclesUsed = Array.from(vrnSet);

  return { dailyTotals, vehicleRecords, summary, totalSegments };
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

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError("not-found", `Plik nie istnieje: ${storagePath}`);
    }
    const [buffer] = await file.download();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // readesm-js czasem rzuca RangeError przy końcowym BlockParseError, ale
    // parsed obiekt zawiera już większość bloków. Próbujemy czytać dalej.
    let parsed;
    try {
      const { convertToJson } = require("readesm-js");
      parsed = convertToJson(arrayBuffer);
    } catch (e) {
      console.warn(`[DDD parse] readesm-js threw (continuing if parsed partial): ${e.message}`);
    }
    if (!parsed) {
      throw new HttpsError("internal", "Nie udało się sparsować pliku DDD.");
    }

    const db = getFirestore();
    const fleetSnap = await db.doc("fleet/data").get();
    const vehicles = fleetSnap.data()?.fleetv2_vehicles || [];

    const metadata = extractDddMetadata(parsed);
    // Czas pobrania karty z nazwy pliku (C_YYYYMMDD_HHMM_...) — do urwania ostatniej
    // czynności dnia pobrania (readesm rozciąga ją do północy → fałszywa jazda).
    // Godzina jest w tej samej strefie co segmenty (UTC tachografu).
    const fname = originalFileName || storagePath.split("/").pop() || "";
    const dlMatch = fname.match(/^[A-Za-z]_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})/);
    const downloadCutoff = dlMatch
      ? { day: `${dlMatch[1]}-${dlMatch[2]}-${dlMatch[3]}`, min: (+dlMatch[4]) * 60 + (+dlMatch[5]) }
      : null;
    const { dailyTotals, vehicleRecords, summary, totalSegments } =
      computeDddDailyReport(parsed, vehicles, downloadCutoff);

    // Zapisz dokument z pełnymi danymi raportu w jednym dddFiles document
    const dddDoc = {
      storagePath,
      originalFileName: originalFileName || storagePath.split("/").pop(),
      uploadedBy: request.auth.token.email || request.auth.uid,
      uploadedAt: new Date().toISOString(),
      fileSize: buffer.length,
      ...metadata,
      activitiesCount: totalSegments,
      vehicleRecords,
      dailyTotals,
      summary,
      parseStatus: "success",
    };
    const dddRef = await db.collection("dddFiles").add(dddDoc);

    console.log(`[DDD parse] OK fileId=${dddRef.id} type=${metadata.fileType} segments=${totalSegments} days=${summary.daysWithCard} drive=${summary.totalDriveMin}min km=${summary.totalKm}`);

    // ── 2026-05-08: DDD → driverActivities (compliance live, decyzja zrewidowana 2026-05-05).
    // Pakiet Mobilności wymaga compliance opartego na danych tachografu.
    // GPS/CSV są źródłem live (gdy kierowca w trasie), DDD = nadrzędne źródło prawdy gdy wraca do bazy.
    // preferDddSegments w czasPracy.js wycinka GPS/CSV w zakresach pokrytych przez DDD.
    let activitiesWritten = 0;
    let driverEmail = null;
    let matchMethod = null;

    // Priorytet 1: po cardNumber (deterministyczne, niezależne od pisowni nazwiska)
    const targetCard = (metadata.cardNumber || "").trim();
    if (targetCard) {
      outerCard: for (const v of vehicles) {
        for (const d of (v.driverHistory || [])) {
          if (d?.cardNumber && String(d.cardNumber).trim() === targetCard && d?.email) {
            driverEmail = d.email;
            matchMethod = "cardNumber";
            break outerCard;
          }
        }
      }
    }

    // Priorytet 2 (fallback): po nazwie (case-insensitive trim)
    if (!driverEmail && metadata.driverName) {
      const targetName = metadata.driverName.trim().toLowerCase();
      outerName: for (const v of vehicles) {
        for (const d of (v.driverHistory || [])) {
          if (d?.name?.trim().toLowerCase() === targetName && d?.email) {
            driverEmail = d.email;
            matchMethod = "name";
            break outerName;
          }
        }
      }
    }

    if (!driverEmail) {
      console.warn(`[DDD parse] No driverEmail found for cardNumber=${targetCard}, name=${metadata.driverName} — skipping driverActivities write`);
    } else {
      console.log(`[DDD parse] Matched driver by ${matchMethod}: ${driverEmail}`);
      // Reupload safety: usuń stare segmenty source=ddd dla tego kierowcy w zakresie pliku.
      // Single-field query (driverEmail) — composite filter w JS, żeby uniknąć wymogu
      // composite index w Firestore. Per kierowca segmenty są małą collection (~5000 max).
      if (metadata.periodStart && metadata.periodEnd) {
        const startISO = new Date(metadata.periodStart + "T00:00:00Z").toISOString();
        const endISO = new Date(metadata.periodEnd + "T23:59:59.999Z").toISOString();
        const oldSnap = await db.collection("driverActivities")
          .where("driverEmail", "==", driverEmail)
          .get();
        const toDelete = oldSnap.docs.filter(d => {
          const data = d.data();
          return data.source === "ddd" && data.startTs >= startISO && data.startTs <= endISO;
        });
        if (toDelete.length > 0) {
          let delBatch = db.batch();
          let delCount = 0;
          for (const d of toDelete) {
            delBatch.delete(d.ref);
            delCount++;
            if (delCount % 400 === 0) {
              await delBatch.commit();
              delBatch = db.batch();
            }
          }
          if (delCount % 400 !== 0) await delBatch.commit();
          console.log(`[DDD parse] Replaced ${toDelete.length} old DDD activities for ${driverEmail} ${metadata.periodStart}→${metadata.periodEnd}`);
        }
      }

      // Insert nowe segmenty z source=ddd
      let batch = db.batch();
      let writeCount = 0;
      for (const [day, slot] of Object.entries(dailyTotals)) {
        const vehicleId = slot.vehicleId || null;
        for (const seg of slot.segments) {
          const startMs = Date.UTC(
            +day.slice(0,4), +day.slice(5,7) - 1, +day.slice(8,10),
            Math.floor(seg.fromMin / 60), seg.fromMin % 60, 0
          );
          const endMs = startMs + seg.durMin * 60000;
          const ref = db.collection("driverActivities").doc();
          batch.set(ref, {
            driverEmail,
            driverName: metadata.driverName,
            vehicleId,
            type: seg.type,
            startTs: new Date(startMs).toISOString(),
            endTs: new Date(endMs).toISOString(),
            source: "ddd",
            dddFileId: dddRef.id,
            distanceKm: 0,
            address: null,
            createdAt: new Date().toISOString(),
          });
          writeCount++;
          activitiesWritten++;
          if (writeCount >= 400) {
            await batch.commit();
            batch = db.batch();
            writeCount = 0;
          }
        }
      }
      if (writeCount > 0) await batch.commit();
      console.log(`[DDD parse] Wrote ${activitiesWritten} segments to driverActivities (source=ddd, driver=${driverEmail})`);
    }

    return {
      success: true,
      fileId: dddRef.id,
      metadata,
      activitiesCount: totalSegments,
      activitiesWritten,
      driverEmail,
      summary,
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

      // Ile rozładunków (R1..R5) — steruje liczbą kroków steppera (maxR + 3).
      // `hasR2` zostaje w odpowiedzi dla wstecznej zgodności: Service Worker może
      // jeszcze serwować starą wersję frontu, która zna tylko R1+R2.
      const maxR = getMaxRouteIndex(fracht);
      const hasR2 = maxR > 1;
      const sfxR = (i) => (i === 1 ? "" : String(i));

      // UWAGA: numeracja stopów bywa DZIURAWA — w produkcji zdarza się fracht
      // z wypełnionym R1, R3, R4 i pustym R2 (dyspozytor pominął slot).
      // `stopIdx` = tylko realnie wypełnione sloty, z zachowanym prawdziwym `r`
      // (bo eventy kierowcy niosą ten indeks). Klientowi pokazujemy numerację
      // sekwencyjną `pos` (1,2,3), żeby publiczny tracker nie wyglądał na zepsuty.
      const slotFilled = (i) => {
        const s = sfxR(i);
        return !!(
          (fracht[`dokodPocztowy${s}`] && String(fracht[`dokodPocztowy${s}`]).trim()) ||
          (fracht[`dokodMiasto${s}`] && String(fracht[`dokodMiasto${s}`]).trim()) ||
          (fracht[`dokod${s}`] && String(fracht[`dokod${s}`]).trim()) ||
          (fracht[`rozladunekGeo${s}`] && String(fracht[`rozladunekGeo${s}`]).trim())
        );
      };
      const stopIdx = [];
      for (let i = 1; i <= maxR; i++) if (slotFilled(i)) stopIdx.push(i);
      if (!stopIdx.length) stopIdx.push(1);
      const nStops = stopIdx.length;
      // prawdziwy `r` → pozycja 1..nStops (do mapowania na kroki steppera)
      const posOf = (r) => stopIdx.indexOf(r) + 1;

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

      // Dotarcia per stop (R1..maxR). Nowe eventy niosą `r`; legacy (bez `r`)
      // przypisujemy chronologicznie — n-te dotarcie = n-ty rozładunek.
      const arrivalTs = {};   // { 1: ts, 2: ts, ... } — tylko stopy z potwierdzonym dotarciem
      {
        const sortTs = (a, b) => ((a.value || a.ts) || "").localeCompare((b.value || b.ts) || "");
        const arrivals = events.filter(e => e.type === "dotarcie_rozladunek").sort(sortTs);
        const undos = events.filter(e => e.type === "cofnij_dotarcie_rozladunek").sort(sortTs);
        const legacy = arrivals.filter(e => e.r == null);
        for (const [pos0, i] of stopIdx.entries()) {
          let ev = arrivals.filter(e => e.r === i).pop();
          // legacy fallback: bez `r` — bierz kolejne dotarcie wg pozycji stopu
          if (!ev && legacy.length) ev = legacy[pos0] || null;
          if (!ev) continue;
          const un = undos.filter(u => (u.r == null || u.r === i)).pop();
          if (un && (un.value || un.ts) > (ev.value || ev.ts)) continue;
          arrivalTs[i] = ev.value || ev.ts;
        }
      }

      // Aktywny krok — stepper ma maxR + 3 pozycje:
      //   0 Dojazd do załadunku, 1 Załadowano, 2 W trasie do R1,
      //   2+k po dotarciu na k-ty rozładunek, maxR+2 Dostarczono
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
        const rozladowano = !!effective("rozladowano") || fracht.statusRozladunku === "rozladowano";
        const arrivedCount = Object.keys(arrivalTs).length;
        // "Dostarczono" (maxR+2) TYLKO po rozładowano. Samo dotarcie na ostatni stop
        // zatrzymuje się na kroku tego stopu (maxR+1) — inaczej klient widziałby
        // "Dostarczono" zanim kierowca faktycznie rozładował.
        // Wyjątek maxR=1: stepper nie ma osobnego kroku "Rozładunek 1", więc dotarcie
        // od zawsze awansuje do "Dostarczono" (zachowane dla zgodności).
        const capArrived = nStops > 1 ? nStops + 1 : nStops + 2;
        if (rozladowano) activeStep = nStops + 2;
        else if (arrivedCount > 0) activeStep = Math.min(capArrived, 2 + arrivedCount);
        else if (startRoz) activeStep = 2;
        else if (dotarcieZal) activeStep = 1;
        else activeStep = 0;
      }

      // Zdjęcia — tylko te kategorie, które admin zaznaczył w trackerShow.
      // Dla 2 rozładunków (hasR2): CMR rozładunkowe rozdzielone na R1/R2 wg ts
      // drugiego eventu 'dotarcie_rozladunek' (kierowca klika 2x — pierwszy = R1).
      const show = fracht.trackerShow || {};
      const photos = {};
      if (show.cmrZal || show.cmrRoz || show.towar || show.damage) {
        // Przypisanie CMR-a do stopu: jawne `r` na evencie, a dla legacy (bez `r`)
        // chronologicznie — zdjęcie należy do ostatniego stopu, na który już dotarł.
        const stopOfPhoto = (e) => {
          if (e.r != null && stopIdx.includes(e.r)) return e.r;
          const t = e.value || e.ts || "";
          let s = 1;
          for (const i of stopIdx) if (arrivalTs[i] && t >= arrivalTs[i]) s = i;
          return s;
        };

        const urls = { cmrZal: [], cmrRoz: [], towar: [], damage: [] };
        const cmrRozPerStop = {}; // { 1: [...], 2: [...], ... }
        for (const e of events) {
          if (!e.photoUrl) continue;
          if (e.type === "cmr_zaladunek_photo") {
            urls.cmrZal.push(e.photoUrl);
          } else if (e.type === "cmr_rozladunek_photo" || e.type === "cmr_photo") {
            if (hasR2) {
              const s = stopOfPhoto(e);
              (cmrRozPerStop[s] = cmrRozPerStop[s] || []).push(e.photoUrl);
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
            // cmrRozR1..cmrRozR5 — stary front czyta tylko R1/R2, nowy iteruje po maxR
            for (const i of stopIdx) {
              if (cmrRozPerStop[i]?.length) photos[`cmrRozR${i}`] = cmrRozPerStop[i];
            }
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
      // Stopy R1..maxR — jedno źródło dla steppera, kart dat i galerii CMR.
      const stops = [];
      for (const [pos0, i] of stopIdx.entries()) {
        const s = sfxR(i);
        stops.push({
          r: i,               // prawdziwy indeks slotu (eventy kierowcy niosą ten numer)
          pos: pos0 + 1,      // numer do pokazania klientowi (bez dziur)
          plannedMs: toMs(fracht[`dataRozladunku${s}`], fracht[`godzRozladunku${s}`]),
          miasto: (fracht[`dokodMiasto${s}`] || fracht[`dokod${s}`] || "").trim() || null,
          firma: (fracht[`rozladunekFirma${s}`] || "").trim() || null,
          arrivedTs: arrivalTs[i] || null,
        });
      }
      const plannedR1Ms = stops[0]?.plannedMs ?? null;
      const plannedR2Ms = hasR2 ? (stops[1]?.plannedMs ?? null) : null;
      // Końcowa dostawa = ostatni rozładunek z ustawionym terminem (fallback: R1)
      const plannedMs = [...stops].reverse().find(s => s.plannedMs)?.plannedMs ?? plannedR1Ms;
      const plannedLoadMs = toMs(fracht.dataZaladunku, fracht.godzZaladunku);

      // 3. Quick return — zakończone
      if (fracht.statusRozladunku === "rozladowano") {
        return res.json({
          nrZlecenia,
          vehiclePlate,
          vehicleMaxWeight,
          status: "zakonczony",
          activeStep: nStops + 2,
          hasR2,
          maxR,
          stops,
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

      // Cele R2..maxR (R1 wyżej). dest[i] = null gdy nie udało się zgeokodować —
      // taki stop wypada z trasy, ale zostaje na stepperze.
      const dest = { 1: destR1 };
      for (const i of stopIdx.filter(x => x > 1)) {
        const s = sfxR(i);
        let d = parseGeoStringBackend(fracht[`rozladunekGeo${s}`]);
        if (!d) {
          const q = [fracht[`rozladunekAdres${s}`], fracht[`dokodPocztowy${s}`], fracht[`dokodMiasto${s}`]]
            .filter(Boolean).join(", ");
          d = await geocodeAddress(q || fracht[`dokod${s}`]);
        }
        dest[i] = d || null;
      }
      const destR2 = dest[2] || null;

      // 6. Brak pozycji — jeszcze nie wyjechał
      if (!pos) {
        return res.json({
          nrZlecenia,
          vehiclePlate,
          vehicleMaxWeight,
          status: "przed_trasa",
          activeStep,
          hasR2,
          maxR,
          stops,
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

      // 8. Routing — trasa prowadzi przez wszystkie JESZCZE NIE zaliczone stopy.
      // Zaliczone pomijamy, inaczej OSRM liczy detour wstecz i daje fałszywy dystans
      // (np. 1400 km zamiast realnych 10 km gdy auto stoi tuz przed kolejnym punktem).
      // Stop zaliczony = ma potwierdzone dotarcie ALBO activeStep minął jego krok.
      // UWAGA: krok liczymy z POZYCJI stopu, nie z surowego `r` — numeracja bywa dziurawa.
      const stopDone = (i) => !!arrivalTs[i] || activeStep >= 2 + posOf(i);
      const pendingIdx = [];
      for (const i of stopIdx) if (dest[i] && !stopDone(i)) pendingIdx.push(i);
      // Gdy wszystkie zaliczone (a fracht jeszcze nie zamknięty) — celuj w ostatni stop
      const routeIdx = pendingIdx.length ? pendingIdx : [stopIdx[stopIdx.length - 1]].filter(i => dest[i]);
      const allIdx = [];
      for (const i of stopIdx) if (dest[i]) allIdx.push(i);

      const waypoints = [pos, ...routeIdx.map(i => dest[i])];
      const routeCurrent = await osrmMultiRoute(waypoints.length > 1 ? waypoints : [pos, destR1]);
      if (!routeCurrent) return res.status(500).json({ error: "osrm_failed" });

      let kmTotal = routeCurrent.distanceKm;
      if (start) {
        const totalWp = [start, ...allIdx.map(i => dest[i])];
        const routeTotal = await osrmMultiRoute(totalWp);
        if (routeTotal && routeTotal.distanceKm > 0) kmTotal = routeTotal.distanceKm;
      }
      const kmRemaining = routeCurrent.distanceKm;
      const kmDone = Math.max(0, kmTotal - kmRemaining);
      const percentDone = kmTotal > 0 ? Math.min(100, Math.round((kmDone / kmTotal) * 100)) : 0;

      // Dla 2 rozładunków: osobne km i % do R1 (żeby klient widział postęp
      // dotarcia do pierwszego punktu, niezależnie od finalnego celu w R2).
      // Postęp do NAJBLIŻSZEGO oczekującego stopu — działa dla dowolnej liczby
      // rozładunków. Stare pola kmToR1/percentToR1 zostają niżej dla starego frontu.
      let nextStopIdx = null, kmToNext = null, kmTotalNext = null, percentToNext = null;
      if (nStops > 1 && pendingIdx.length) {
        nextStopIdx = pendingIdx[0];
        const target = dest[nextStopIdx];
        const routeToNext = await osrmMultiRoute([pos, target]);
        if (routeToNext) {
          kmToNext = Math.round(routeToNext.distanceKm);
          // Baza odniesienia: poprzedni zaliczony stop, a dla pierwszego — załadunek
          const prevIdx = [...allIdx].filter(i => i < nextStopIdx).pop() || null;
          const origin = prevIdx ? dest[prevIdx] : start;
          if (origin) {
            const routeLeg = await osrmMultiRoute([origin, target]);
            if (routeLeg && routeLeg.distanceKm > 0) {
              kmTotalNext = Math.round(routeLeg.distanceKm);
              percentToNext = Math.min(100, Math.round((Math.max(0, kmTotalNext - kmToNext) / kmTotalNext) * 100));
            }
          }
        }
      }

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
        maxR,
        stops,
        nextStopIdx,
        nextStopPos: nextStopIdx ? posOf(nextStopIdx) : null,
        kmToNext,
        kmTotalNext,
        percentToNext,
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
// "Postój" / "Postoj" obsługiwane przez heurystykę długości — patrz mapWwPostojToType
const WW_TYPE_MAP = {
  "Jazda": "drive",
  "Brak danych": null,    // ignoruj — to są szumy
  "Inna praca": "work",
  "Praca": "work",
  "Dyspozycyjność": "avail",
  "Dyspozycyjnosc": "avail",
};

// CSV widziszwszystko nie rozróżnia rest/work/avail dla "Postój" (per pojazd, brak tachografu).
// Heurystyka E (2026-05-08): konserwatywne — postoje >=45min strzelamy jako rest.
// CSV nie ma pewności co kierowca robił podczas postoju (sen, czekanie, "?"),
// więc bezpieczniej założyć rest niż avail. DDD (gdy kierowca wgra) nadpisze
// avail tam gdzie kierowca świadomie wcisnął "?" na tachografie (preferDddSegments).
// - ≥45min → rest
// - <45min → work (krótka pauza/manewr)
function mapWwPostojToType(durMs) {
  const durMin = durMs / 60000;
  if (durMin >= 45) return "rest";
  return "work";
}

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
      const segType = String(seg.type || "").trim();
      const sMs = Date.parse(seg.start);
      const eMs = Date.parse(seg.end);
      if (isNaN(sMs) || isNaN(eMs) || eMs <= sMs) { skipped++; continue; }
      let type;
      if (segType === "Postój" || segType === "Postoj") {
        type = mapWwPostojToType(eMs - sMs);
      } else {
        type = WW_TYPE_MAP[segType];
      }
      if (!type) { skipped++; continue; }
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

// Auto-detect separator z headera. Widziszwszystko ma 2 raporty:
// - "Karta drogowa" (auto-email codzienny) — separator "," , per kierowca, 4 typy
// - "Czas pracy" (manual download) — separator ";", per pojazd, 3 typy + address
function detectWwDelimiter(content) {
  const firstLine = content.split(/\r?\n/)[0] || "";
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

async function processWWCsv(db, vehicles, file) {
  let rows;
  try {
    // Toleruj BOM, skip empty, columns z nagłówka, auto-detect separator (",", ";")
    const content = file.content.replace(/^\uFEFF/, "");
    const delimiter = detectWwDelimiter(content);
    rows = csvParse(content, {
      delimiter,
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
    const config = configSnap.exists ? configSnap.data() : {};
    const apiKey = config.resendApiKey || config.sendgridApiKey;
    if (!apiKey) {
      console.error("[finalizeTrip] No email API config");
      await updateFracht();
      await db.collection("emailLogs").add({
        sentAt: nowIso, type: "trip_summary", frachtId, source, recipients: [recipientEmail],
        status: "error", error: "no_email_config",
      });
      return { ok: true, emailSent: false, reason: "no_email_config" };
    }

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
      // Resend domyślnie NIE przepisuje linków (brak click-tracking) → token Firebase
      // Storage w URL zostaje nienaruszony (przy SendGrid trzeba było to wyłączać ręcznie,
      // inaczej redirect gubił token → 404 u klienta).
      await sendEmailsResend(apiKey, [{
        from: config.senderEmail || "flotaVBS@fleetstat.pl",
        to: [recipientEmail],
        subject,
        html,
      }]);
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
