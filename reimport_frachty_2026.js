const admin = require('firebase-admin');
const fs = require('fs');
const sa = JSON.parse(fs.readFileSync('./vbs-stats-firebase-adminsdk.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const FRACHTY = JSON.parse(fs.readFileSync('./frachty_2026_final.json', 'utf8'));
function uid() { return Math.random().toString(36).slice(2,10); }
async function run() {
  const snap = await db.doc('fleet/data').get();
  const existing = snap.data() || {};
  const bez26 = (existing.fleetv2_frachty||[]).filter(r => (r.dataZlecenia||r.dataZaladunku||'').slice(0,4) !== '2026');
  console.log(`Usuwam ${(existing.fleetv2_frachty||[]).length - bez26.length} frachtów 2026`);
  const final = [...bez26, ...FRACHTY.map(f => ({...f, id: uid()}))];
  await db.doc('fleet/data').update({ fleetv2_frachty: final });
  console.log(`✅ Wgrano ${FRACHTY.length} frachtów 2026`);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
