const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SA_PATH = path.join(process.env.HOME, 'Desktop/VBS-Stat.nosync/vbs-stats-firebase-adminsdk.json');
admin.initializeApp({ credential: admin.credential.cert(SA_PATH) });
const db = admin.firestore();

const records = JSON.parse(fs.readFileSync('/Users/kamilwasik/Desktop/VBS-Stat.nosync/records_2025.json', 'utf8'));

async function main() {
  console.log(`Importuje ${records.length} rekordow...`);
  
  // Najpierw usun stare records 2025
  const DATA_REF = db.collection('fleet').doc('data');
  const snap = await DATA_REF.get();
  const existing = snap.data()?.fleetv2_records || [];
  
  const without2025 = existing.filter(r => r.year !== 2025);
  console.log(`Stare rekordy: ${existing.length}, bez 2025: ${without2025.length}`);
  console.log(`Usuwam ${existing.length - without2025.length} rekordow 2025...`);
  
  // Polacz bez 2025 + nowe 2025
  const newRecords = [...without2025, ...records];
  console.log(`Nowa liczba rekordow: ${newRecords.length}`);
  
  // Zapisz
  await DATA_REF.update({ fleetv2_records: newRecords });
  console.log('OK - zapisano do Firebase!');
  
  // Weryfikacja
  const check = await DATA_REF.get();
  const saved = check.data()?.fleetv2_records || [];
  const saved2025 = saved.filter(r => r.year === 2025);
  console.log(`Weryfikacja: ${saved2025.length} rekordow 2025 w Firebase`);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
