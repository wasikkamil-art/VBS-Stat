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
export function zbudujAnalize({ month, transakcje = [], kmPerKraj = {}, zrodloKm, kmFloty = 0, frachty = [], krajeFrachtu, dniZKm = null, pomijanePojazdy = [], kmPominiete = {} }) {
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

  // Solówki i busy rozliczamy osobno. Bus nie płaci myta zagranicznego w ogóle (wrzesień 2026:
  // 0 € NegoMetalu na wszystkich krajach), płaci wyłącznie polski e-TOLL — więc wrzucony do
  // jednego worka tylko zaciemnia obraz: dokłada kilometry bez opłat i opłaty bez kilometrów
  // zagranicznych. Sumę floty zostawiamy na końcu, żeby rachunek dalej się domykał.
  const bus = new Set(pomijanePojazdy);
  const jestBus = (t) => bus.has(t.vehicleId);
  const sumaEUR = (arr) => r2(arr.reduce((a, t) => a + (t.amountEUR || 0), 0));
  const grupy = {
    solo: {
      sumaNego: sumaEUR(nego.filter(t => !jestBus(t))),
      etollEUR: sumaEUR(etoll.filter(t => !jestBus(t))),
      etollKm: r1(etoll.filter(t => !jestBus(t)).reduce((a, t) => a + (t.km || 0), 0)),
      km: r1(Object.values(kmPerKraj).reduce((a, b) => a + b, 0)),
    },
    bus: {
      sumaNego: sumaEUR(nego.filter(jestBus)),
      etollEUR: sumaEUR(etoll.filter(jestBus)),
      etollKm: r1(etoll.filter(jestBus).reduce((a, t) => a + (t.km || 0), 0)),
      km: r1(Object.values(kmPominiete).reduce((a, b) => a + b, 0)),
      pojazdy: pomijanePojazdy,
    },
  };

  const etollPLN = etoll.reduce((a, t) => a + t.amountLocal, 0);
  const etollKm = etoll.reduce((a, t) => a + (t.km || 0), 0);
  const etollEUR = r2(etoll.reduce((a, t) => a + (t.amountEUR || 0), 0));

  // Stawka €/km liczona tylko tam, gdzie przebieg jest na tyle duży, że wskaźnik coś znaczy.
  //
  // Licznik musi pochodzić z TEGO SAMEGO okna co mianownik. Gdy kilometry są tylko za część
  // miesiąca (`dniZKm`), bierzemy opłaty wyłącznie z tych dni — inaczej stawka jest zawyżona
  // dokładnie o to, czego w mianowniku brakuje. Kwoty w `oplatyNego` zostają za CAŁY miesiąc,
  // bo to rachunek do zaksięgowania, nie wskaźnik.
  const okno = dniZKm?.length ? new Set(dniZKm) : null;
  const negoDoStawek = okno ? nego.filter(t => okno.has(t.day)) : nego;
  const oplatyDoStawek = {};
  for (const t of negoDoStawek) {
    if (t.amountEUR == null) continue;
    oplatyDoStawek[t.country] = (oplatyDoStawek[t.country] || 0) + t.amountEUR;
  }
  const stawki = {};
  for (const [cc, km] of Object.entries(kmPerKraj)) {
    if (km > 200) stawki[cc] = Math.round(((oplatyDoStawek[cc] || 0) / km) * 1000) / 1000;
  }
  // Opłaty w tym samym oknie, z którego liczona jest stawka. Rozbicie zmiany rachunku
  // („ile z kilometrów, ile ze stawki") musi liczyć się z TEJ pozycji, nie z `oplatyNego`,
  // bo inaczej dzieli kwotę za cały miesiąc przez przebieg z jego części i wychodzą bzdury.
  // Gdy okna nie ma (km z tras zleceń), jest to po prostu kopia `oplatyNego`.
  const oplatyStawkowe = Object.fromEntries(Object.entries(oplatyDoStawek).map(([k, v]) => [k, r2(v)]));

  const stawkiPodstawa = {
    dni: okno ? okno.size : null,
    od: okno ? dniZKm[0] : null,
    do: okno ? dniZKm[dniZKm.length - 1] : null,
    pominietePojazdy: pomijanePojazdy,
    kmPominiete: Object.fromEntries(Object.entries(kmPominiete).map(([k, v]) => [k, r1(v)])),
    oplatyWOknie: r2(Object.values(oplatyDoStawek).reduce((a, b) => a + b, 0)),
  };

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
    oplatyStawkowe,
    stawkiPodstawa,
    grupy,
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

/**
 * Km per kraj z dokumentów countryKmDaily danego miesiąca (suma po pojazdach i dniach).
 *
 * `pomijajVid` wyrzuca pojazdy, które z definicji nie płacą myta (u nas busy). Bez tego
 * ich kilometry siedzą w mianowniku stawki €/km przy zerowych opłatach i zaniżają wynik:
 * we wrześniu 2026 bus v4 wniósł 1 711 z 3 063 niemieckich kilometrów, nie płacąc ani euro.
 *
 * Zwraca też `dni` — zbiór dat, dla których kilometry w ogóle istnieją. Stawkę wolno liczyć
 * tylko z opłat z tych samych dni, inaczej dzielimy rachunek za cały miesiąc przez przebieg
 * z jego części (wrzesień 2026: opłaty za 30 dni, kilometry za 21).
 */
export function kmZDni(dokumentyDobowe = [], pomijajVid = []) {
  const pomijaj = new Set(pomijajVid);
  const km = {};
  const kmPominiete = {};
  const dni = new Set();
  for (const d of dokumentyDobowe) {
    if (d.date) dni.add(d.date);
    for (const [vid, perKraj] of Object.entries(d.vehicles || {})) {
      const cel = pomijaj.has(vid) ? kmPominiete : km;
      for (const [cc, v] of Object.entries(perKraj)) {
        if (cc === "??") continue;
        cel[cc] = (cel[cc] || 0) + v;
      }
    }
  }
  return { km, kmPominiete, dni: [...dni].sort() };
}
