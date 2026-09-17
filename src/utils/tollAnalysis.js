// Budowa dokumentu `tollAnalysis/{YYYY-MM}` z zaimportowanych transakcji.
// Czysta funkcja — dostaje gotowe dane, nie sięga do Firestore ani do sieci.
//
// Struktura wyniku jest ta sama, co przy analizach wgranych ręcznie we wrześniu 2026,
// żeby widok nie musiał rozróżniać, skąd wzięły się liczby. Różnicę niesie pole
// `zrodlo` ("import" vs "reczna") i `metoda` (skąd pochodzą kilometry).

const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {object} p
 * @param {string} p.month                 "YYYY-MM"
 * @param {Array}  p.transakcje            transakcje z tollParsers, już przeliczone na EUR (pole amountEUR)
 * @param {object} p.kmPerKraj             {DE: 6985, FR: 6615, …} — z countryKmDaily albo z tras zleceń
 * @param {string} p.zrodloKm              opis pochodzenia kilometrów (trafia do `metoda`)
 * @param {number} p.kmFloty               przebieg z liczników (operacyjne)
 * @param {Array}  p.frachty               frachty miesiąca (do struktury zleceń), bez busa
 * @param {function} p.krajeFrachtu        fracht → Set kodów krajów
 */
export function zbudujAnalize({ month, transakcje = [], kmPerKraj = {}, zrodloKm, kmFloty = 0, frachty = [], krajeFrachtu }) {
  const nego = transakcje.filter(t => t.source === "nego");
  const etoll = transakcje.filter(t => t.source === "etoll");

  // Opłaty per kraj — tylko NegoMetal; e-TOLL trzymamy osobno, bo to system państwowy
  // z własną taryfą i własną kontrolą (km są w danych, więc stawkę da się sprawdzić wprost).
  const oplatyNego = {};
  for (const t of nego) {
    if (t.amountEUR == null) continue;
    oplatyNego[t.country] = r2((oplatyNego[t.country] || 0) + t.amountEUR);
  }
  const sumaNego = r2(Object.values(oplatyNego).reduce((a, b) => a + b, 0));

  const etollPLN = etoll.reduce((a, t) => a + t.amountLocal, 0);
  const etollKm = etoll.reduce((a, t) => a + (t.km || 0), 0);
  const etollEUR = r2(etoll.reduce((a, t) => a + (t.amountEUR || 0), 0));

  // Stawka €/km liczona tylko tam, gdzie przebieg jest na tyle duży, że wskaźnik coś znaczy.
  const stawki = {};
  for (const [cc, km] of Object.entries(kmPerKraj)) {
    if (km > 200) stawki[cc] = Math.round(((oplatyNego[cc] || 0) / km) * 1000) / 1000;
  }

  const struktura = frachty.length ? {
    frachty: frachty.length,
    dotykaDE: frachty.filter(f => krajeFrachtu(f).has("DE")).length,
    dotykaFRES: frachty.filter(f => { const k = krajeFrachtu(f); return k.has("FR") || k.has("ES"); }).length,
  } : null;

  // Duplikaty w eksporcie e-TOLL: ten sam pojazd, czas i odcinek. Zdarzają się
  // pojedynczo i chcemy o nich wiedzieć, a nie wygładzać ich po cichu.
  const klucze = new Set(), duple = new Set();
  for (const t of etoll) {
    const k = `${t.plate}|${t.ts}|${t.section}`;
    if (klucze.has(k)) duple.add(k); else klucze.add(k);
  }

  return {
    month,
    zrodlo: "import",
    metoda: zrodloKm,
    oplatyNego,
    sumaNego,
    etollEUR,
    km: Object.fromEntries(Object.entries(kmPerKraj).map(([k, v]) => [k, r1(v)])),
    stawki,
    kmFloty,
    ...(struktura ? { struktura } : {}),
    ...(etoll.length ? {
      etoll: {
        przejazdy: etoll.length,
        km: r1(etollKm),
        pln: r2(etollPLN),
        plnPerKm: etollKm ? Math.round((etollPLN / etollKm) * 1000) / 1000 : null,
        taryfaPlnPerKm: 0.41,
        nieuiszczonePLN: r2(etoll.reduce((a, t) => a + (t.unpaidLocal || 0), 0)),
        duplikaty: duple.size,
      },
    } : {}),
    transakcji: { nego: nego.length, etoll: etoll.length },
    updatedAt: new Date().toISOString(),
  };
}

/** Kraje, których dotyka trasa frachtu — po prefiksie kodu pocztowego. */
export function krajeFrachtuDomyslne(f) {
  const ZNANE = new Set(["DE", "FR", "ES", "PL", "BE", "NL", "AT", "CZ", "CH", "IT", "PT", "LU", "HU", "SK"]);
  const out = new Set();
  for (const p of [f.zaladunekKod, f.zaladunekKod2, f.zaladunekKod3, f.dokod, f.dokod2, f.dokod3].filter(Boolean)) {
    const s = String(p).trim().toUpperCase();
    const m = s.match(/^([A-Z]{1,2})[\s-]/);
    if (m && ZNANE.has(m[1])) out.add(m[1]);
    else if (/^\d{2}-\d{3}/.test(s)) out.add("PL");
    else if (s.startsWith("F ")) out.add("FR");
  }
  return out;
}

/** Km per kraj z dokumentów countryKmDaily danego miesiąca (suma po pojazdach i dniach). */
export function kmZDni(dokumentyDobowe = []) {
  const out = {};
  for (const d of dokumentyDobowe) {
    for (const perKraj of Object.values(d.vehicles || {})) {
      for (const [cc, km] of Object.entries(perKraj)) {
        if (cc === "??") continue;
        out[cc] = (out[cc] || 0) + km;
      }
    }
  }
  return out;
}
