/**
 * Skrypt migracyjny: Konwertuje WSZYSTKIE Firestore Timestamp na ISO strings
 * w kolekcjach chatRooms i chatRooms/{roomId}/messages
 *
 * Naprawia problem z chronologią wiadomości na czacie — Firestore orderBy
 * sortuje po typie danych (Timestamp vs string), co psuje kolejność.
 *
 * Użycie:
 *   cd /Users/kamilwasik/Desktop/VBS-Stat.nosync
 *   node scripts/migrate-timestamps.js [--dry-run]
 *
 * --dry-run  Tylko raportuje co zostałoby zmienione, bez zapisu
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// ── Inicjalizacja Firebase Admin ──
// Używa domyślnych credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
// lub application default credentials z gcloud CLI
initializeApp({ projectId: "vbs-stats" });
const db = getFirestore();

const DRY_RUN = process.argv.includes("--dry-run");

// Helper: sprawdź czy wartość to Firestore Timestamp
function isFirestoreTimestamp(val) {
  if (!val || typeof val !== "object") return false;
  return (val instanceof Timestamp) || (typeof val.seconds === "number" && typeof val.nanoseconds === "number") || (typeof val.toDate === "function");
}

// Helper: konwertuj Firestore Timestamp na ISO string
function toISO(val) {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val.toDate === "function") return val.toDate().toISOString();
  if (typeof val.seconds === "number") return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1e6).toISOString();
  return null;
}

async function migrateMessages() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  MIGRACJA TIMESTAMPÓW — ${DRY_RUN ? "DRY RUN (bez zapisu)" : "PRODUKCJA (zapis!)"}`);
  console.log(`${"=".repeat(60)}\n`);

  let totalRooms = 0;
  let totalMessages = 0;
  let migratedMessages = 0;
  let migratedRoomFields = 0;

  // 1. Pobierz wszystkie chatRooms
  const roomsSnap = await db.collection("chatRooms").get();
  totalRooms = roomsSnap.size;
  console.log(`📦 Znaleziono ${totalRooms} pokojów czatu\n`);

  for (const roomDoc of roomsSnap.docs) {
    const roomId = roomDoc.id;
    const roomData = roomDoc.data();
    const roomName = roomData.name || roomId;
    const roomUpdates = {};

    // ── Migracja pól pokoju ──

    // lastMessageAt
    if (isFirestoreTimestamp(roomData.lastMessageAt)) {
      const iso = toISO(roomData.lastMessageAt);
      roomUpdates.lastMessageAt = iso;
      console.log(`  🔄 [${roomName}] lastMessageAt: Timestamp → ${iso}`);
    }

    // lastRead map — każda wartość może być Timestamp
    if (roomData.lastRead && typeof roomData.lastRead === "object") {
      for (const [uid, val] of Object.entries(roomData.lastRead)) {
        if (isFirestoreTimestamp(val)) {
          const iso = toISO(val);
          roomUpdates[`lastRead.${uid}`] = iso;
          console.log(`  🔄 [${roomName}] lastRead.${uid}: Timestamp → ${iso}`);
        }
      }
    }

    // typing map — wartości mogą być Timestamp
    if (roomData.typing && typeof roomData.typing === "object") {
      for (const [uid, val] of Object.entries(roomData.typing)) {
        if (isFirestoreTimestamp(val)) {
          const iso = toISO(val);
          roomUpdates[`typing.${uid}`] = iso;
          console.log(`  🔄 [${roomName}] typing.${uid}: Timestamp → ${iso}`);
        }
      }
    }

    // Zapisz zmiany pokoju
    if (Object.keys(roomUpdates).length > 0) {
      migratedRoomFields += Object.keys(roomUpdates).length;
      if (!DRY_RUN) {
        await roomDoc.ref.update(roomUpdates);
      }
    }

    // ── Migracja wiadomości w pokoju ──
    const messagesSnap = await db.collection("chatRooms").doc(roomId).collection("messages").get();
    totalMessages += messagesSnap.size;

    let roomMigrated = 0;
    const batch = db.batch();
    let batchCount = 0;

    for (const msgDoc of messagesSnap.docs) {
      const msgData = msgDoc.data();

      if (isFirestoreTimestamp(msgData.timestamp)) {
        const iso = toISO(msgData.timestamp);
        if (!DRY_RUN) {
          batch.update(msgDoc.ref, { timestamp: iso });
          batchCount++;
        }
        roomMigrated++;
        migratedMessages++;

        // Firestore batch limit = 500
        if (batchCount >= 450) {
          if (!DRY_RUN) await batch.commit();
          batchCount = 0;
        }
      }
    }

    // Commit remaining
    if (!DRY_RUN && batchCount > 0) {
      await batch.commit();
    }

    if (roomMigrated > 0 || Object.keys(roomUpdates).length > 0) {
      console.log(`  ✅ [${roomName}] ${roomMigrated}/${messagesSnap.size} wiadomości zmigrowanych, ${Object.keys(roomUpdates).length} pól pokoju`);
    } else {
      console.log(`  ⏭️  [${roomName}] ${messagesSnap.size} wiadomości — OK (brak Timestamp)`);
    }
  }

  // ── Podsumowanie ──
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  PODSUMOWANIE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Pokoje:              ${totalRooms}`);
  console.log(`  Wiadomości łącznie:  ${totalMessages}`);
  console.log(`  Wiadomości zmigr.:   ${migratedMessages}`);
  console.log(`  Pola pokojów zmigr.: ${migratedRoomFields}`);
  console.log(`  Tryb:                ${DRY_RUN ? "DRY RUN (bez zapisu)" : "PRODUKCJA"}`);
  console.log(`${"=".repeat(60)}\n`);

  if (DRY_RUN && (migratedMessages > 0 || migratedRoomFields > 0)) {
    console.log("💡 Aby wykonać migrację, uruchom bez --dry-run:");
    console.log("   node scripts/migrate-timestamps.js\n");
  }

  if (!DRY_RUN && migratedMessages === 0 && migratedRoomFields === 0) {
    console.log("🎉 Brak Firestore Timestamps do migracji — wszystko jest już ISO string!\n");
  }
}

migrateMessages().catch(err => {
  console.error("❌ Błąd migracji:", err);
  process.exit(1);
});
