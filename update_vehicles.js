const admin = require('firebase-admin');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('./vbs-stats-firebase-adminsdk.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const UPDATES = JSON.parse(fs.readFileSync('./vehicle_updates.json', 'utf8'));

async function run() {
  console.log('Pobieram pojazdy z Firebase...');
  const snap = await db.doc('fleet/data').get();
  const data = snap.data() || {};
  const vehicles = data.fleetv2_vehicles || [];

  console.log(`Znaleziono ${vehicles.length} pojazdów w bazie`);

  let updated = 0;
  const newVehicles = vehicles.map(v => {
    const patch = UPDATES[v.id];
    if (!patch) return v;
    console.log(`  ✅ ${v.id} (${v.plate}) — aktualizuję ${Object.keys(patch).length} pól`);
    updated++;
    return { ...v, ...patch };
  });

  if (updated === 0) {
    console.log('❌ Żaden pojazd nie pasuje do ID z pliku updates');
    process.exit(1);
  }

  await db.doc('fleet/data').update({ fleetv2_vehicles: newVehicles });
  console.log(`\n✅ Zaktualizowano ${updated} pojazdów`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
