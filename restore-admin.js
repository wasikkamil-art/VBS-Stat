/**
 * Przywracanie danych z backupu do Firestore (Firebase Admin SDK)
 *
 * Wymagania: plik service account JSON w tym samym folderze
 * Uruchom: node restore-admin.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Szukaj service account file
const saFiles = [
  "vbs-stats-firebase-adminsdk.json",
  "sa.json",
  "serviceAccount.json",
  "service-account.json"
];

let saPath = null;
for (const f of saFiles) {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) { saPath = p; break; }
}

if (!saPath) {
  console.error("❌ Nie znaleziono pliku service account!");
  console.error("   Pobierz go z Firebase Console → Project Settings → Service Accounts → Generate New Private Key");
  console.error("   Zapisz jako 'vbs-stats-firebase-adminsdk.json' w folderze projektu");
  process.exit(1);
}

console.log("🔑 Service account:", path.basename(saPath));

const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function restore() {
  // Wczytaj backup
  const backupPath = path.join(__dirname, "2026-04-02.json");
  if (!fs.existsSync(backupPath)) {
    console.error("❌ Nie znaleziono pliku 2026-04-02.json w folderze projektu!");
    console.error("   Skopiuj go tutaj z folderu uploads lub pobierz z repo backupów");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(backupPath, "utf8"));

  console.log("📦 Backup wczytany:");
  console.log(`   vehicles:   ${(data.fleetv2_vehicles || []).length} pojazdów`);
  console.log(`   costs:      ${(data.fleetv2_costs || []).length} kosztów`);
  console.log(`   categories: ${(data.fleetv2_categories || []).length} kategorii`);
  console.log(`   docs:       ${(data.fleetv2_docs || []).length} dokumentów`);
  console.log(`   imi:        ${(data.fleetv2_imi || []).length} rekordów IMI`);
  console.log("");

  // Przywróć nadpisane pola
  const fieldsToRestore = {
    fleetv2_vehicles: data.fleetv2_vehicles || [],
    fleetv2_costs: data.fleetv2_costs || [],
    fleetv2_categories: data.fleetv2_categories || [],
    fleetv2_docs: data.fleetv2_docs || [],
    fleetv2_imi: data.fleetv2_imi || [],
  };

  console.log("🔄 Przywracanie danych do Firestore...");

  await db.doc("fleet/data").set(fieldsToRestore, { merge: true });

  console.log("✅ Dane przywrócone pomyślnie!");
  console.log("   Przywrócono: vehicles, costs, categories, docs, imi");
  console.log("   Nienaruszone: frachty, rent, records");
  console.log("");
  console.log("🔃 Odśwież teraz stronę FleetStat");

  process.exit(0);
}

restore().catch(err => {
  console.error("❌ Błąd:", err.message);
  process.exit(1);
});
