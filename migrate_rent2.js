const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, collection, getDocs, doc, setDoc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');
const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, "rentownosc"));
  const records = [];
  snap.forEach(d => {
    const r = d.data();
    records.push({
      id: d.id,
      vehicleId: r.vehicleId,
      year: r.rok,
      month: r.miesiac - 1,
      frachty: r.frachty || 0,
      costs: {}
    });
  });
  console.log("Znaleziono", records.length, "rekordow");
  await setDoc(doc(db, "fleet", "data"), { fleetv2_rent: records }, { merge: true });
  console.log("Zapisano do fleet/data -> fleetv2_rent");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
