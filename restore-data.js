/**
 * Skrypt przywracania danych z backupu do Firestore
 * Uruchom: node restore-data.js
 *
 * Przywraca TYLKO nadpisane pola: vehicles, costs, categories, docs, imi
 * NIE nadpisuje: frachty, rent, records (te przetrwały)
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

// Firebase config — taki sam jak w App.jsx
const firebaseConfig = {
  apiKey: "AIzaSyAYOBelFMTVSNQphCHaGsO9mEkFLOwmFXI",
  authDomain: "vbs-stat.firebaseapp.com",
  projectId: "vbs-stat",
  storageBucket: "vbs-stat.firebasestorage.app",
  messagingSenderId: "424408180232",
  appId: "1:424408180232:web:8f89a58b05bf5a4c5e2844"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restore() {
  // Wczytaj backup
  const backupPath = path.join(__dirname, "2026-04-02.json");
  if (!fs.existsSync(backupPath)) {
    // Spróbuj z uploads
    const altPath = path.join(__dirname, "..", "uploads", "2026-04-02.json");
    if (!fs.existsSync(altPath)) {
      console.error("❌ Nie znaleziono pliku backupu! Skopiuj 2026-04-02.json do folderu VBS-Stat.nosync");
      process.exit(1);
    }
    var data = JSON.parse(fs.readFileSync(altPath, "utf8"));
  } else {
    var data = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  }

  console.log("📦 Backup wczytany:");
  console.log(`   vehicles:   ${(data.fleetv2_vehicles || []).length} pojazdów`);
  console.log(`   costs:      ${(data.fleetv2_costs || []).length} kosztów`);
  console.log(`   categories: ${(data.fleetv2_categories || []).length} kategorii`);
  console.log(`   docs:       ${(data.fleetv2_docs || []).length} dokumentów`);
  console.log(`   imi:        ${(data.fleetv2_imi || []).length} rekordów IMI`);
  console.log("");

  // Przywróć TYLKO nadpisane pola (merge: true nie nadpisze istniejących)
  const fieldsToRestore = {
    fleetv2_vehicles: data.fleetv2_vehicles || [],
    fleetv2_costs: data.fleetv2_costs || [],
    fleetv2_categories: data.fleetv2_categories || [],
    fleetv2_docs: data.fleetv2_docs || [],
    fleetv2_imi: data.fleetv2_imi || [],
  };

  console.log("🔄 Przywracanie danych do Firestore...");

  const dataRef = doc(db, "fleet", "data");
  await setDoc(dataRef, fieldsToRestore, { merge: true });

  console.log("✅ Dane przywrócone pomyślnie!");
  console.log("   Przywrócono: vehicles, costs, categories, docs, imi");
  console.log("   Nienaruszone: frachty, rent, records (te przetrwały)");
  console.log("");
  console.log("🔃 Odśwież teraz stronę FleetStat");

  process.exit(0);
}

restore().catch(err => {
  console.error("❌ Błąd:", err.message);
  process.exit(1);
});
