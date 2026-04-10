const admin = require("firebase-admin");
const sa = require("./serviceAccountKey.json");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// Usuwa undefined z obiektu (Firestore ich nie akceptuje)
function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

async function run() {
  const docRef = db.collection("fleet").doc("data");
  const doc = await docRef.get();
  const data = doc.data();
  let costs = data.fleetv2_costs || [];

  console.log("═══ 1. NAPRAWIAM UJEMNE KWOTY ═══");
  let fixedCount = 0;
  costs = costs.map(c => {
    if ((c.amountEUR || 0) < 0) {
      console.log(`  FIX: ${c.date} | ${c.vehicleId} | ${c.amountEUR}€ → ${Math.abs(c.amountEUR).toFixed(2)}€ | ${c.note}`);
      fixedCount++;
      return clean({
        ...c,
        amountEUR: Math.abs(c.amountEUR),
        amountPLN: c.amountPLN != null ? Math.abs(c.amountPLN) : null,
        amountOriginal: c.amountOriginal != null ? Math.abs(c.amountOriginal) : null,
      });
    }
    return clean(c);
  });
  console.log(`  Naprawiono: ${fixedCount} rekordów`);

  // 2. Zapis naprawionych kosztów
  console.log("\n═══ 2. ZAPISUJĘ NAPRAWIONE KOSZTY ═══");
  await docRef.update({ fleetv2_costs: costs });
  console.log(`  ✅ Zapisano ${costs.length} rekordów`);

  // 3. Weryfikacja
  console.log("\n═══ 3. WERYFIKACJA ═══");
  const negAfter = costs.filter(c => (c.amountEUR || 0) < 0);
  console.log(`  Ujemne po naprawie: ${negAfter.length}`);

  console.log("\n✅ GOTOWE");
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
