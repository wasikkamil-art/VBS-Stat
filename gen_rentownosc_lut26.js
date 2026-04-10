const admin = require('firebase-admin');
const fs = require('fs');
const sa = JSON.parse(fs.readFileSync('./vbs-stats-firebase-adminsdk.json', 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function uid() { return Math.random().toString(36).slice(2,10); }

async function run() {
  const snap = await db.doc('fleet/data').get();
  const data = snap.data() || {};

  const vehicles = data.fleetv2_vehicles || [];
  const costs    = data.fleetv2_costs || [];
  const frachty  = data.fleetv2_frachty || [];
  const rent     = data.fleetv2_rent || [];

  const YEAR = 2026;
  const MONTH = 2; // luty = index 1 (0-based) ale w danych miesiąc = 2
  const MONTH_STR = "2026-02";

  // Koszty luty 2026 per pojazd (EUR)
  const koszt = {};
  costs.forEach(c => {
    if ((c.date||"").startsWith(MONTH_STR)) {
      const v = c.vehicleId;
      const amt = parseFloat(c.amountEUR) || 0;
      koszt[v] = (koszt[v]||0) + amt;
    }
  });

  // Przychody luty 2026 per pojazd (EUR) — z frachtów po dataZaladunku
  const przychod = {};
  frachty.forEach(f => {
    const d = f.dataZaladunku || f.dataZlecenia || "";
    if (d.startsWith(MONTH_STR)) {
      const v = f.vehicleId;
      const amt = parseFloat(f.cenaEur) || 0;
      przychod[v] = (przychod[v]||0) + amt;
    }
  });

  console.log("Koszty luty 2026:", koszt);
  console.log("Przychody luty 2026:", przychod);

  // Wygeneruj wpisy rentowności — usuń stare luty 2026 i dodaj nowe
  const rentBez = rent.filter(r => !(r.year === YEAR && r.month === 1)); // month=1 = luty (0-based)

  const newEntries = vehicles
    .filter(v => !v.archived)
    .filter(v => koszt[v.id] || przychod[v.id])
    .map(v => ({
      id: uid(),
      vehicleId: v.id,
      year: YEAR,
      month: 1, // 0-based: 0=sty, 1=lut
      frachty: Math.round(przychod[v.id] || 0),
      costs: Math.round(koszt[v.id] || 0),
    }));

  console.log("\nNowe wpisy rentowności:");
  newEntries.forEach(e => {
    const v = vehicles.find(x => x.id === e.vehicleId);
    console.log(`  ${v?.plate}: frachty=${e.frachty}€ koszty=${e.costs}€ zysk=${e.frachty-e.costs}€`);
  });

  const rentFinal = [...rentBez, ...newEntries];
  await db.doc('fleet/data').update({ fleetv2_rent: rentFinal });
  console.log(`\n✅ Dodano ${newEntries.length} wpisów rentowności za luty 2026`);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
