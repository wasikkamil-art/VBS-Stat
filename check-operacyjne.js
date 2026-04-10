const admin = require("firebase-admin");
if (!admin.apps.length) {
  const sa = require("./serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function main() {
  const snap = await db.collection("operacyjne").get();
  console.log(`Łącznie rekordów operacyjne: ${snap.size}\n`);

  const rows = [];
  snap.forEach(doc => {
    const d = doc.data();
    if (d.year === 2026 && d.month <= 3) {
      rows.push({ id: doc.id, ...d });
    }
  });

  rows.sort((a,b) => a.month - b.month || a.vehicleId.localeCompare(b.vehicleId));

  console.log("=== 2026 sty-mar: cenaPaliwa i paliwoL ===");
  for (const r of rows) {
    console.log(`  ${r.vehicleId} ${r.year}-${String(r.month).padStart(2,"0")} | cenaPaliwa: ${r.cenaPaliwa ?? "BRAK"} | paliwoL: ${r.paliwoL ?? "BRAK"} | kmLicznik: ${r.kmLicznik ?? "BRAK"}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
