const { initializeApp } = require('./node_modules/firebase/app/dist/index.cjs.js');
const { getFirestore, collection, getDocs, query, where, writeBatch, doc } = require('./node_modules/firebase/firestore/dist/index.cjs.js');

const app = initializeApp({ apiKey: "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ", authDomain: "vbs-stats.firebaseapp.com", projectId: "vbs-stats" });
const db = getFirestore(app);

const data = [
  {vehicleId:"v3",rok:2025,miesiac:1,frachty:4930},
  {vehicleId:"v3",rok:2025,miesiac:2,frachty:11530},
  {vehicleId:"v3",rok:2025,miesiac:3,frachty:8594},
  {vehicleId:"v3",rok:2025,miesiac:4,frachty:10060},
  {vehicleId:"v3",rok:2025,miesiac:5,frachty:11200},
  {vehicleId:"v3",rok:2025,miesiac:6,frachty:10685},
  {vehicleId:"v3",rok:2025,miesiac:7,frachty:0},
  {vehicleId:"v3",rok:2025,miesiac:8,frachty:7720},
  {vehicleId:"v3",rok:2025,miesiac:9,frachty:8600},
  {vehicleId:"v3",rok:2025,miesiac:10,frachty:8280},
  {vehicleId:"v3",rok:2025,miesiac:11,frachty:9815},
  {vehicleId:"v3",rok:2025,miesiac:12,frachty:6100},
  {vehicleId:"v6",rok:2025,miesiac:1,frachty:8950},
  {vehicleId:"v6",rok:2025,miesiac:2,frachty:1150},
  {vehicleId:"v6",rok:2025,miesiac:3,frachty:4850},
  {vehicleId:"v6",rok:2025,miesiac:4,frachty:9350},
  {vehicleId:"v2",rok:2025,miesiac:1,frachty:7870},
  {vehicleId:"v2",rok:2025,miesiac:2,frachty:6190},
  {vehicleId:"v2",rok:2025,miesiac:3,frachty:5650},
  {vehicleId:"v2",rok:2025,miesiac:4,frachty:1130},
  {vehicleId:"v2",rok:2025,miesiac:5,frachty:990},
  {vehicleId:"v2",rok:2025,miesiac:6,frachty:11050},
  {vehicleId:"v2",rok:2025,miesiac:7,frachty:4280},
  {vehicleId:"v2",rok:2025,miesiac:8,frachty:7078.5},
  {vehicleId:"v2",rok:2025,miesiac:9,frachty:4020},
  {vehicleId:"v2",rok:2025,miesiac:10,frachty:7050},
  {vehicleId:"v2",rok:2025,miesiac:11,frachty:8000},
  {vehicleId:"v2",rok:2025,miesiac:12,frachty:4780},
  {vehicleId:"v5",rok:2025,miesiac:1,frachty:8250},
  {vehicleId:"v5",rok:2025,miesiac:2,frachty:6203},
  {vehicleId:"v5",rok:2025,miesiac:3,frachty:8165},
  {vehicleId:"v5",rok:2025,miesiac:4,frachty:11635},
  {vehicleId:"v5",rok:2025,miesiac:5,frachty:9420},
  {vehicleId:"v5",rok:2025,miesiac:6,frachty:11820},
  {vehicleId:"v5",rok:2025,miesiac:7,frachty:11010},
  {vehicleId:"v5",rok:2025,miesiac:8,frachty:7400},
  {vehicleId:"v5",rok:2025,miesiac:9,frachty:8930},
  {vehicleId:"v5",rok:2025,miesiac:10,frachty:10380},
  {vehicleId:"v5",rok:2025,miesiac:11,frachty:7590},
  {vehicleId:"v5",rok:2025,miesiac:12,frachty:8104},
  {vehicleId:"v1",rok:2025,miesiac:4,frachty:3100},
  {vehicleId:"v1",rok:2025,miesiac:5,frachty:8150},
  {vehicleId:"v1",rok:2025,miesiac:6,frachty:10310},
  {vehicleId:"v1",rok:2025,miesiac:7,frachty:9280},
  {vehicleId:"v1",rok:2025,miesiac:8,frachty:6680},
  {vehicleId:"v1",rok:2025,miesiac:9,frachty:9000},
  {vehicleId:"v1",rok:2025,miesiac:10,frachty:6320},
  {vehicleId:"v1",rok:2025,miesiac:11,frachty:5755},
  {vehicleId:"v1",rok:2025,miesiac:12,frachty:8050},
  {vehicleId:"v4",rok:2025,miesiac:1,frachty:3550},
  {vehicleId:"v4",rok:2025,miesiac:2,frachty:3944},
  {vehicleId:"v4",rok:2025,miesiac:3,frachty:6245},
  {vehicleId:"v4",rok:2025,miesiac:4,frachty:5870},
  {vehicleId:"v4",rok:2025,miesiac:5,frachty:8230},
  {vehicleId:"v4",rok:2025,miesiac:6,frachty:9450},
  {vehicleId:"v4",rok:2025,miesiac:7,frachty:7480},
  {vehicleId:"v4",rok:2025,miesiac:8,frachty:9580},
  {vehicleId:"v4",rok:2025,miesiac:9,frachty:3580},
  {vehicleId:"v4",rok:2025,miesiac:10,frachty:6130},
  {vehicleId:"v4",rok:2025,miesiac:11,frachty:1900},
  {vehicleId:"v4",rok:2025,miesiac:12,frachty:3900},
];

async function run() {
  const snap = await getDocs(query(collection(db, "rentownosc"), where("rok", "==", 2025)));
  console.log("Stare rekordy 2025:", snap.size);
  if (snap.size > 0) {
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(doc(db, "rentownosc", d.id)));
    await batch.commit();
    console.log("Usunieto stare rekordy");
  }
  const batch2 = writeBatch(db);
  data.forEach(r => batch2.set(doc(collection(db, "rentownosc")), r));
  await batch2.commit();
  console.log("Wgrano", data.length, "rekordow");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
