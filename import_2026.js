const admin = require('firebase-admin');
const fs = require('fs');

const sa = JSON.parse(fs.readFileSync('./vbs-stats-firebase-adminsdk.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const data = JSON.parse(fs.readFileSync('./import_2026_data.json', 'utf8'));

function uid() { return Math.random().toString(36).slice(2,10); }

async function run() {
  const snap = await db.doc('fleet/data').get();
  const existing = snap.data() || {};

  // 1. Usuń frachty 2026
  const frachtyAll = existing.fleetv2_frachty || [];
  const frachtyBez26 = frachtyAll.filter(r => {
    const rok = (r.dataZlecenia || r.dataZaladunku || '').slice(0,4);
    return rok !== '2026';
  });
  console.log(`Frachty: ${frachtyAll.length} total → usuwam ${frachtyAll.length - frachtyBez26.length} z 2026`);

  // 2. Dodaj nowe frachty 2026
  const frachtyNowe = data.frachty.map(f => ({ ...f, id: uid() }));
  const frachtyFinal = [...frachtyBez26, ...frachtyNowe];
  console.log(`Frachty po imporcie: ${frachtyFinal.length} (dodano ${frachtyNowe.length})`);

  // 3. Usuń koszty 2026
  const kosztAll = existing.fleetv2_costs || [];
  const kosztBez26 = kosztAll.filter(c => {
    const rok = (c.date || '').slice(0,4);
    return rok !== '2026';
  });
  console.log(`Koszty: ${kosztAll.length} total → usuwam ${kosztAll.length - kosztBez26.length} z 2026`);

  // 4. Dodaj nowe koszty 2026
  const kosztNowe = data.koszty.map(k => ({ ...k, id: uid() }));
  const kosztFinal = [...kosztBez26, ...kosztNowe];
  console.log(`Koszty po imporcie: ${kosztFinal.length} (dodano ${kosztNowe.length})`);

  // 5. Zapisz
  await db.doc('fleet/data').update({
    fleetv2_frachty: frachtyFinal,
    fleetv2_costs: kosztFinal,
  });

  console.log('\n✅ Import zakończony!');
  console.log(`  Frachty 2026: ${frachtyNowe.length}`);
  console.log(`  Koszty 2026: ${kosztNowe.length}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
