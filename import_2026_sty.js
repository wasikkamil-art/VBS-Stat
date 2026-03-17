const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, doc, getDoc, setDoc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');
const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);
const newRecords = [{"id": "v3_2026_0", "vehicleId": "v3", "year": 2026, "month": 0, "frachty": 5980.0, "costs": {"paliwo": 1248.89, "leasing": 1342.29, "wyplata": 1495.3, "zus": 400.0, "polisa": 105.11, "nego": 187.38, "etoll": 27.42, "slickshift": 15.0, "telefon": 10.0, "uruchomienie": 250.0, "imi": 13.0, "ocpd": 104.0}}, {"id": "v1_2026_0", "vehicleId": "v1", "year": 2026, "month": 0, "frachty": 5520.0, "costs": {"paliwo": 1767.8, "leasing": 1461.79, "wyplata": 2136.14, "zus": 400.0, "polisa": 85.11, "nego": 622.61, "etoll": 93.39, "inne": 99.72, "slickshift": 15.0, "telefon": 10.0, "mandaty": 750.0, "uruchomienie": 250.0, "imi": 13.0}}, {"id": "v5_2026_0", "vehicleId": "v5", "year": 2026, "month": 0, "frachty": 9750.0, "costs": {"paliwo": 1639.69, "leasing": 1461.79, "wyplata": 2392.48, "zus": 400.0, "polisa": 82.78, "nego": 653.73, "etoll": 48.19, "inne": 53.7, "slickshift": 15.0, "telefon": 10.0, "uruchomienie": 250.0, "imi": 13.0}}, {"id": "v4_2026_0", "vehicleId": "v4", "year": 2026, "month": 0, "frachty": 5270.0, "costs": {"paliwo": 1446.22, "wyplata": 2032.0, "polisa": 132.32, "nego": 2.5, "etoll": 88.42, "inne": 24.46, "slickshift": 15.0, "telefon": 10.0, "leasing": 665.0, "uruchomienie": 250.0, "imi": 13.0}}, {"id": "v2_2026_0", "vehicleId": "v2", "year": 2026, "month": 0, "frachty": 3360.0, "costs": {"paliwo": 1040.08, "wyplata": 1200, "serwis": 518.0, "polisa": 147.92, "nego": 9.41, "inne": 750.0, "slickshift": 15.0, "telefon": 10.0, "mandaty": 1068.0, "leasing": 110.0, "uruchomienie": 250.0, "imi": 13.0}}];
async function run() {
  const snap = await getDoc(doc(db, "fleet", "data"));
  const existing = snap.data().fleetv2_rent || [];
  const filtered = existing.filter(r => r.year !== 2026);
  const combined = [...filtered, ...newRecords];
  await setDoc(doc(db, "fleet", "data"), { fleetv2_rent: combined }, { merge: true });
  const f = newRecords.reduce((s,r) => s+r.frachty, 0);
  const k = newRecords.reduce((s,r) => s+Object.values(r.costs).reduce((a,b)=>a+b,0), 0);
  console.log("Wgrano 2026 sty:", newRecords.length, "aut | F:", Math.round(f), "K:", Math.round(k), "Z:", Math.round(f-k));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
