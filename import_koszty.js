const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, doc, getDoc, setDoc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');
const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);
const koszty = {
  v1: [0,0,0,2134.58,6688.25,6544.23,6495.12,6504.4,5815.63,6536.17,5770.17,6212.73],
  v2: [3829.61,5468.9,4816.92,3338.8,1643.53,6606.14,3900.38,4583.5,3182.68,4742.06,5957.57,5539.32],
  v3: [4842.63,6936.37,8597.37,6833.87,6837.12,7469.95,1908.82,5975.68,6193.36,5892.38,6985.63,5426.04],
  v4: [1015.07,4029.85,6607.6,5430.84,5826.0,7412.04,5587.79,6564.87,4255.45,5919.87,3948.65,5084.67],
  v5: [5935.96,5749.47,6804.97,6603.26,6721.7,7051.64,7789.93,6671.1,6219.84,5360.05,9028.21,6349.81],
  v6: [6612.2,1520.97,5293.16,6003.84,0,0,0,0,0,0,0,0],
};
async function run() {
  const snap = await getDoc(doc(db, "fleet", "data"));
  const records = snap.data().fleetv2_rent || [];
  let updated = 0;
  const newRecords = records.map(r => {
    const vk = koszty[r.vehicleId];
    if (vk && r.month >= 0 && r.month <= 11 && vk[r.month] > 0) {
      updated++;
      return { ...r, costs: { total: vk[r.month] } };
    }
    return r;
  });
  await setDoc(doc(db, "fleet", "data"), { fleetv2_rent: newRecords }, { merge: true });
  console.log("Zaktualizowano", updated, "rekordow z kosztami");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
