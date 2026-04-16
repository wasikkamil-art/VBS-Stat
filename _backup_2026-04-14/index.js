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
const { initializeApp }       = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore }        = require("firebase-admin/firestore");
const { getMessaging }        = require("firebase-admin/messaging");

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
      // Pokaż ostatni kod rozładunku + datę rozładunku
      const rozlKod = [activeF.dokod, activeF.dokod2, activeF.dokod3].filter(s => s && s.trim()).pop() || "—";
      const rozlDate = activeF.dataRozladunku ? fmtDate(activeF.dataRozladunku) : "";
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
      // Pokaż datę najbliższego załadunku — to jest teraz najbardziej relewantna data
      const nextKod = [nextF.zaladunekKod, nextF.zaladunekKod2, nextF.zaladunekKod3].filter(s => s && s.trim())[0]
                   || [nextF.dokod, nextF.dokod2, nextF.dokod3].filter(s => s && s.trim()).pop()
                   || "—";
      const nextDate = nextF.dataZaladunku ? fmtDate(nextF.dataZaladunku) : "";
      details = nextDate ? `Załadunek: ${nextKod} · ${nextDate}` : nextKod;
    } else {
      const daysSince = lastDoneF
        ? Math.round((new Date(todayISO + "T00:00:00").getTime() - new Date(lastDoneF.dataRozladunku + "T00:00:00").getTime()) / 86400000)
        : null;
      statusText = `⏳ Wolny${daysSince ? ` · ${daysSince}d` : ""}`;
      statusColor = "#d97706";
      statusBg = "#fffbeb";
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

  // Sortuj: W trasie → Pauza/Baza → Wolny
  const order = { trasa: 0, pauza: 1, wolny: 2 };
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
