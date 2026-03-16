const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, doc, getDoc, setDoc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');
const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);

// frachty[miesiac 0-11], koszty[miesiac 0-11]
const data = {
  v1: {
    frachty: [0,0,0,3100,8150,10310,9280,6680,9000,6320,5755,8050],
    koszty:  [0,0,0,2134.58,6688.25,6544.23,6495.12,6504.4,5815.63,6536.17,5770.17,6212.73]
  },
  v2: {
    frachty: [7870,6190,5650,1130,990,11050,4280,7078.5,4020,7050,8000,4780],
    koszty:  [3829.61,5468.9,4816.92,3338.8,1643.53,6606.14,3900.38,4583.5,3182.68,4742.06,5957.57,5539.32]
  },
  v3: {
    frachty: [4930,11530,8594,10060,11200,10685,0,7720,8600,8280,9815,6100],
    koszty:  [4842.63,6936.37,8597.37,6833.87,6837.12,7469.95,1908.82,5975.68,6193.36,5892.38,6985.63,5426.04]
  },
  v4: {
    frachty: [7494,3944,6245,5870,8230,9450,7480,9580,3580,6130,1900,3900],
    koszty:  [4959.07,6330.85,6232.6,7790.84,7046,5442.04,7687.79,564.87,6805.45,1689.87,5948.65,8334.67]
  },
  v5: {
    frachty: [8250,6203,8165,11635,9420,11820,11010,7400,8930,10380,7590,8104],
    koszty:  [5935.96,5749.47,6804.97,6603.26,6721.7,7051.64,7789.93,6671.1,6219.84,5360.05,9028.21,6349.81]
  },
  v6: {
    frachty: [8950,1150,4850,9350,0,0,0,0,0,0,0,0],
    koszty:  [6612.2,1520.97,5293.16,6003.84,0,0,0,0,0,0,0,0]
  },
};

async function run() {
  // Buduj nowe rekordy
  const records = [];
  for (const [vid, d] of Object.entries(data)) {
    for (let m = 0; m < 12; m++) {
      const f = d.frachty[m] || 0;
      const k = d.koszty[m] || 0;
      if (f > 0 || k > 0) {
        records.push({
          id: `${vid}_2025_${m}`,
          vehicleId: vid,
          year: 2025,
          month: m,
          frachty: f,
          costs: { inne: k }
        });
      }
    }
  }
  await setDoc(doc(db, "fleet", "data"), { fleetv2_rent: records }, { merge: true });
  console.log("Wgrano", records.length, "rekordow");
  const totalF = records.reduce((s,r) => s+r.frachty, 0);
  const totalK = records.reduce((s,r) => s+(r.costs.inne||0), 0);
  console.log("Frachty:", Math.round(totalF), "Koszty:", Math.round(totalK), "Zysk:", Math.round(totalF-totalK));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
