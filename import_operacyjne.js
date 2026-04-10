const admin = require('firebase-admin');
const fs = require('fs');
const sa = require('./vbs-stats-firebase-adminsdk.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const records = JSON.parse(fs.readFileSync('./operacyjne_import.json', 'utf8'));
async function run() {
  let ok = 0, skip = 0;
  for (const r of records) {
    const id = `${r.vehicleId}_${r.year}_${r.month}`;
    const doc = { vehicleId: r.vehicleId, year: r.year, month: r.month };
    if (r.kmLicznik  != null) doc.kmLicznik  = r.kmLicznik;
    if (r.paliwoL    != null) doc.paliwoL    = r.paliwoL;
    if (r.spalanie   != null) doc.spalanie   = r.spalanie;
    if (r.cenaPaliwa != null) doc.cenaPaliwa = r.cenaPaliwa;
    if (r.dni        != null) doc.dni        = r.dni;
    try {
      await db.collection('operacyjne').doc(id).set(doc, { merge: true });
      console.log(`OK: ${id}`);
      ok++;
    } catch(e) {
      console.error(`FAIL: ${id}`, e.message);
      skip++;
    }
  }
  console.log(`\nGotowe: ${ok} wgrano, ${skip} bledow`);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
