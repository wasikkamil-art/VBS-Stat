const admin = require("firebase-admin");

if (!admin.apps.length) {
  const sa = require("./serviceAccountKey.json");
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

// VAT rates by country
const VAT = { PL: 0.23, FR: 0.20, DE: 0.19, BE: 0.21, CZ: 0.21, ES: 0.21, LU: 0.17, AT: 0.20, IT: 0.22 };
const PLN_EUR = 4.285;
const CZK_EUR = 24.21;

// Andamur city → country mapping
const ANDAMUR_CITY_COUNTRY = {
  "Champfleury": "FR",
  "Saint Etienne De Montluc": "FR",
  "Clermont Ferrand II": "FR",
  "Gexa": "ES",
  "Villatoro": "ES",
  "Lasarte": "ES"
};

function getCountryFromE100Note(note) {
  // E-100 notes have format: "E-100 ON 51.6L PL E100" or "E-100 AdBlue 12.0L PL Pieprzyk" or "E-100 Parking TIR PL ..."
  const m = note.match(/E-100\s+\S+\s+\S+\s+(\w{2})\s/);
  if (m) return m[1];
  // try: "E-100 Parking TIR PL"
  const m2 = note.match(/E-100\s+Parking\s+TIR\s+(\w{2})\s/);
  if (m2) return m2[1];
  return null;
}

function getCountryFromAndamurNote(note) {
  // "Andamur Diesel 45.4L Champfleury" or "Andamur AdBlue 12.8L Saint Etienne De Montluc"
  for (const [city, country] of Object.entries(ANDAMUR_CITY_COUNTRY)) {
    if (note.includes(city)) return country;
  }
  return null;
}

async function main() {
  const docRef = db.collection("fleet").doc("data");
  const snap = await docRef.get();
  if (!snap.exists) { console.error("❌ Dokument fleet/data nie istnieje!"); return; }

  const costs = snap.data().fleetv2_costs || [];
  console.log(`📊 Łącznie kosztów w bazie: ${costs.length}`);

  let e100Updated = 0, andamurUpdated = 0;
  let e100DiffEur = 0, andamurDiffEur = 0;

  for (const c of costs) {
    const note = c.note || "";

    // Only March 2026 records
    if (!(c.date || "").startsWith("2026-03")) continue;

    // --- E-100 ---
    if (note.startsWith("E-100")) {
      const country = getCountryFromE100Note(note);
      if (!country || !VAT[country]) {
        console.warn(`  ⚠️ E-100 nie rozpoznano kraju: "${note}"`);
        continue;
      }
      const vatRate = VAT[country];
      const oldEur = c.amountEUR;
      const oldOrig = c.amountOriginal;

      // Calculate netto from brutto original
      const nettoOrig = parseFloat((oldOrig / (1 + vatRate)).toFixed(2));

      let nettoEur;
      if (c.currency === "PLN") {
        nettoEur = parseFloat((nettoOrig / PLN_EUR).toFixed(2));
      } else if (c.currency === "CZK") {
        nettoEur = parseFloat((nettoOrig / CZK_EUR).toFixed(2));
      } else {
        nettoEur = nettoOrig;
      }

      c.amountOriginal = nettoOrig;
      c.amountEUR = nettoEur;
      e100DiffEur += (oldEur - nettoEur);
      e100Updated++;
      console.log(`  E-100 ${c.vehicleId} ${c.date} ${country}: ${oldEur}€ → ${nettoEur}€ (${oldOrig} → ${nettoOrig} ${c.currency})`);
    }

    // --- Andamur ---
    if (note.startsWith("Andamur")) {
      const country = getCountryFromAndamurNote(note);
      if (!country || !VAT[country]) {
        console.warn(`  ⚠️ Andamur nie rozpoznano kraju: "${note}"`);
        continue;
      }
      const vatRate = VAT[country];
      const oldEur = c.amountEUR;

      // Andamur is always EUR
      const nettoEur = parseFloat((oldEur / (1 + vatRate)).toFixed(2));

      c.amountOriginal = nettoEur;
      c.amountEUR = nettoEur;
      andamurDiffEur += (oldEur - nettoEur);
      andamurUpdated++;
      console.log(`  Andamur ${c.vehicleId} ${c.date} ${country}: ${oldEur}€ → ${nettoEur}€`);
    }
  }

  console.log(`\n📝 Zaktualizowano: E-100 = ${e100Updated}, Andamur = ${andamurUpdated}`);
  console.log(`💰 Różnica (brutto-netto): E-100 = -${e100DiffEur.toFixed(2)}€, Andamur = -${andamurDiffEur.toFixed(2)}€`);

  if (e100Updated + andamurUpdated === 0) {
    console.log("✅ Nic do aktualizacji");
    return;
  }

  await docRef.update({ fleetv2_costs: costs });
  console.log(`\n✅ Zapisano! Wszystkie kwoty E-100 i Andamur są teraz netto.`);
}

main().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
