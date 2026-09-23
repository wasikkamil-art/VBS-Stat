// Stawki do Kalkulatora tras liczone z WŁASNYCH danych floty, nie z szacunków.
//
// Paliwo: średnia cena netto €/L per kraj z `fuelTransactions` (tylko diesel).
//   To cena PO rabatach kart — czyli tyle, ile faktycznie płacimy.
// Myto:   €/km per kraj z `tollAnalysis` (faktury NegoMetal + e-TOLL podzielone
//   przez kilometry w tym kraju).
//
// Okno: 3 ostatnie miesiące (decyzja usera 2026-09-23) — nadąża za cenami,
// a jednocześnie wygładza pojedyncze drogie tankowanie.
//
// ⚠️ Kilometry w `tollAnalysis` pochodzą z tras zleceń, więc pomijają puste
// przebiegi — stawka myta wychodzi przez to nieco ZAWYŻONA. Kalkulator liczy
// tak samo (km planowanej trasy), więc w tę stronę błędy się znoszą. Od października
// kilometry mają iść z licznika CAN (`countryKmDaily`) i wtedy to przeliczymy.

const MIN_LITROW = 150;   // poniżej tego próbka jest za mała na średnią ceny
const MIN_KM = 200;       // jw. dla myta

/** Lista N ostatnich miesięcy "YYYY-MM" wstecz od podanego (włącznie). */
function ostatnieMiesiace(doMiesiaca, n) {
  const [y, m] = doMiesiaca.split("-").map(Number);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Średnia cena diesla netto €/L per kraj z transakcji paliwowych. */
async function cenyPaliwa(db, miesiace) {
  const agg = {}; // kraj → {litry, eur, tankowan}
  for (const m of miesiace) {
    const snap = await db.collection("fuelTransactions").doc(m).collection("tx").get();
    snap.forEach(doc => {
      const t = doc.data() || {};
      if (t.product !== "on") return;                       // AdBlue nie wchodzi do ceny paliwa
      const kraj = String(t.country || "").toUpperCase();
      const litry = Number(t.liters) || 0;
      const eur = Number(t.netEUR) || 0;
      if (!kraj || litry <= 0 || eur <= 0) return;
      const a = agg[kraj] || (agg[kraj] = { litry: 0, eur: 0, tankowan: 0 });
      a.litry += litry; a.eur += eur; a.tankowan += 1;
    });
  }
  const ceny = {}, meta = {};
  for (const [kraj, a] of Object.entries(agg)) {
    if (a.litry < MIN_LITROW) continue;
    ceny[kraj] = Math.round((a.eur / a.litry) * 1000) / 1000;
    meta[kraj] = { litry: Math.round(a.litry), tankowan: a.tankowan, eur: Math.round(a.eur) };
  }
  return { ceny, meta };
}

/** €/km per kraj dla solówki i osobno dla busa (v4). */
async function stawkiMyta(db, miesiace) {
  const nego = {}, km = {}, etoll = { eur: 0, kmPL: 0 };
  let zrodel = 0;
  for (const m of miesiace) {
    const snap = await db.collection("tollAnalysis").doc(m).get();
    if (!snap.exists) continue;
    zrodel++;
    const d = snap.data() || {};
    for (const [k, v] of Object.entries(d.oplatyNego || {})) nego[k] = (nego[k] || 0) + (Number(v) || 0);
    for (const [k, v] of Object.entries(d.km || {})) km[k] = (km[k] || 0) + (Number(v) || 0);
    const e = Number(d.etollEUR) || 0;
    if (e > 0) { etoll.eur += e; etoll.kmPL += Number((d.km || {}).PL) || 0; }
  }
  const solowka = {}, bus = {}, meta = {};
  for (const [kraj, kmKraju] of Object.entries(km)) {
    if (kmKraju < MIN_KM) continue;
    // PL: do faktur NegoMetal dochodzi e-TOLL (system państwowy) — płaci go też bus.
    const oplaty = (nego[kraj] || 0) + (kraj === "PL" ? etoll.eur : 0);
    // Zero na fakturach ≠ droga za darmo (np. CH rozlicza LSVA poza NegoMetalem)
    // — wtedy NIE nadpisujemy stawki domyślnej, tylko zostawiamy kraj bez wyliczenia.
    if (oplaty <= 0) continue;
    solowka[kraj] = Math.round((oplaty / kmKraju) * 1000) / 1000;
    // Bus (v4) jest zwolniony z myta towarowego — zostaje mu tylko polski e-TOLL.
    bus[kraj] = kraj === "PL" && etoll.kmPL > 0 ? Math.round((etoll.eur / etoll.kmPL) * 1000) / 1000 : 0;
    meta[kraj] = { km: Math.round(kmKraju), eur: Math.round(oplaty) };
  }
  return { solowka, bus, meta, zrodel };
}

/**
 * Liczy komplet stawek i zwraca gotowy obiekt do zapisu w `config/kalkulatorTras.auto`.
 * Nie zapisuje niczego — zapis robi wołający (łatwiej o tryb na sucho).
 */
async function policzStawki(db, doMiesiaca, okno = 3) {
  const miesiace = ostatnieMiesiace(doMiesiaca, okno);
  const paliwo = await cenyPaliwa(db, miesiace);
  const myto = await stawkiMyta(db, miesiace);
  return {
    okno, miesiace,
    fuelPrice: paliwo.ceny,
    fuelMeta: paliwo.meta,
    tollPerKm: myto.solowka,
    tollPerKmBus: myto.bus,
    tollMeta: myto.meta,
    tollMiesiecy: myto.zrodel,
    policzoneAt: new Date().toISOString(),
  };
}

module.exports = { policzStawki, ostatnieMiesiace, MIN_LITROW, MIN_KM };
