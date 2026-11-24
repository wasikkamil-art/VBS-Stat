// Dowód rejestracyjny = główny dokument auta: po wgraniu AI czyta z niego dane, a ten moduł
// zestawia je z kartą pojazdu. Czysta logika (bez Reacta i Firebase) — da się ją sprawdzić w Node.
//
// ZASADA: nic nie zapisuje się samo. Każde pole user zatwierdza w oknie; pole już wypełnione
// inną wartością jest domyślnie ODZNACZONE, żeby odczyt AI nie nadpisał po cichu ręcznego wpisu.
// Numeru rejestracyjnego nie zmieniamy nigdy — to klucz importów paliwa i raportów; rozjazd
// oznacza raczej dowód wgrany do złego auta, więc tylko ostrzegamy.

export const PROMPT_DOWOD = `To skan lub zdjęcie polskiego dowodu rejestracyjnego pojazdu (może też być pozwolenie czasowe).
Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "czyDowod": true albo false — czy to w ogóle dowód rejestracyjny / pozwolenie czasowe,
  "rejestracja": "pole A — numer rejestracyjny",
  "vin": "pole E — numer VIN, dokładnie 17 znaków",
  "marka": "pole D.1",
  "model": "pole D.3 (nazwa handlowa)",
  "rokProdukcji": "rok produkcji (4 cyfry) albo null, gdy dokument go nie podaje",
  "pierwszaRejestracja": "pole B — data pierwszej rejestracji YYYY-MM-DD",
  "dataWydania": "pole I — data wydania dowodu YYYY-MM-DD",
  "seriaNumer": "seria i numer dowodu, np. DR/BAA 1234567",
  "badaniaWpisy": ["WSZYSTKIE daty z rubryk „TERMIN BADANIA TECHNICZNEGO” w kolejności rubryk, YYYY-MM-DD — także wpisane ODRĘCZNIE i częściowo zasłonięte pieczątką stacji kontroli"],
  "badanieDo": "NAJPÓŹNIEJSZA z dat w badaniaWpisy (to ona jest aktualnym terminem badania) YYYY-MM-DD; null, gdy żadnej nie da się pewnie odczytać",
  "ladownosc": "dopuszczalna ładowność w kg, sama liczba",
  "dmc": "pole F.2 — dopuszczalna masa całkowita w kg, sama liczba",
  "masaWlasna": "pole G — masa własna w kg, sama liczba"
}
Przepisuj DOKŁADNIE z dokumentu. Pola, którego nie widać albo nie da się pewnie odczytać, nie zgaduj — zwróć null.
Rubryk „TERMIN BADANIA TECHNICZNEGO” jest sześć; pierwsza bywa wydrukowana przy rejestracji, kolejne wypełnia odręcznie diagnosta
(obok jest pieczątka stacji z DATĄ BADANIA — to nie jest termin; terminem jest data wpisana w górnej linii rubryki). Obejrzyj wszystkie sześć.
W numerze VIN nie występują litery I, O ani Q.`;

const czysty = (x) => (x == null ? "" : String(x).trim());
const bezOdstepow = (x) => czysty(x).replace(/[\s-]/g, "").toUpperCase();
const data = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(czysty(x)) && !isNaN(Date.parse(czysty(x))) ? czysty(x) : "");
const liczba = (x) => { const n = Number(czysty(x).replace(/\s/g, "").replace(",", ".")); return czysty(x) && isFinite(n) && n > 0 ? n : null; };
const fmtData = (d) => (d ? d.split("-").reverse().join(".") : "");

/** VIN: 17 znaków, bez I/O/Q. Zły odczyt odrzucamy, zamiast proponować go do zapisu. */
export const poprawnyVin = (x) => /^[A-HJ-NPR-Z0-9]{17}$/.test(bezOdstepow(x));

/**
 * Zestawia odczyt z dowodu z kartą auta.
 * Zwraca { czyDowod, rejestracja: { zDowodu, zgodna }, pola: [...], opisDokumentu }.
 * Pole: { klucz, etykieta, teraz, zDowodu, wartosc, stan: "nowe" | "zgodne" | "rozni", domyslnie }.
 */
export function porownajZDowodem(v, dane) {
  const d = dane || {};
  const pola = [];
  const dodaj = (klucz, etykieta, teraz, wartosc, { pokaz = String, rowne } = {}) => {
    if (wartosc === "" || wartosc == null) return;
    const jest = czysty(teraz);
    const stan = !jest ? "nowe" : (rowne ? rowne(teraz, wartosc) : jest.toLowerCase() === String(wartosc).toLowerCase()) ? "zgodne" : "rozni";
    pola.push({ klucz, etykieta, teraz: jest ? pokaz(teraz) : "", zDowodu: pokaz(wartosc), wartosc, stan, domyslnie: stan === "nowe" });
  };

  const vin = bezOdstepow(d.vin);
  if (poprawnyVin(vin)) dodaj("vin", "VIN", v.vin, vin, { rowne: (a, b) => bezOdstepow(a) === b });
  const marka = [czysty(d.marka), czysty(d.model)].filter(Boolean).join(" ");
  // Karta bywa dokładniejsza („Iveco Daily 70C18”) niż dowód („IVECO”) — gdy jedno zawiera drugie, uznajemy za zgodne.
  dodaj("brand", "Marka i model", v.brand, marka, { rowne: (a, b) => { const x = czysty(a).toLowerCase(), y = b.toLowerCase(); return x.includes(y) || y.includes(x) || (czysty(d.marka) && x.includes(czysty(d.marka).toLowerCase())); } });
  const rok = liczba(d.rokProdukcji);
  if (rok && rok >= 1980 && rok <= 2100) dodaj("year", "Rok produkcji", v.year, rok, { rowne: (a, b) => Number(a) === b });
  // Termin badania: najpóźniejsza z odczytanych dat (AI potrafi wskazać starszy, wydrukowany wpis zamiast odręcznego —
  // zgłoszenie usera 24.11.2026, WGM 0475M: odczyt 11.12.2025 nadpisał w karcie poprawne 03.11.2026).
  const badania = [data(d.badanieDo), ...(Array.isArray(d.badaniaWpisy) ? d.badaniaWpisy.map(data) : [])].filter(Boolean).sort();
  const badanie = badania[badania.length - 1] || "";
  dodaj("inspectionExpiry", "Przegląd — ważny do", v.inspectionExpiry, badanie, { pokaz: fmtData, rowne: (a, b) => a === b });
  // Data z dowodu WCZEŚNIEJSZA niż w karcie = prawie na pewno odczytany stary wpis. Ostrzegamy przy polu.
  const pb = pola.find(p => p.klucz === "inspectionExpiry");
  if (pb && pb.stan === "rozni" && data(v.inspectionExpiry) && badanie < data(v.inspectionExpiry)) {
    pb.uwaga = "Data z dowodu jest WCZEŚNIEJSZA niż w karcie — najpewniej odczytano starszy wpis. Zostaw odznaczone, chyba że karta ma błąd.";
  }
  const lad = liczba(d.ladownosc);
  // Ładowność z dowodu ma WŁASNE pole — `maxWeight` to ładowność rzeczywista (ta z ofert i planera), wpisywana ręcznie.
  if (lad) dodaj("maxWeightDowod", "Ładowność wg dowodu (kg)", v.maxWeightDowod, String(lad), { rowne: (a, b) => Number(a) === Number(b) });

  const rej = czysty(d.rejestracja);
  const dodatki = [
    data(d.pierwszaRejestracja) && `1. rejestracja ${fmtData(data(d.pierwszaRejestracja))}`,
    liczba(d.dmc) && `DMC ${liczba(d.dmc)} kg`,
    liczba(d.masaWlasna) && `masa własna ${liczba(d.masaWlasna)} kg`,
  ].filter(Boolean).join(" · ");
  const opisDokumentu = {};
  if (czysty(d.seriaNumer)) opisDokumentu.number = czysty(d.seriaNumer);
  if (data(d.dataWydania)) opisDokumentu.issueDate = data(d.dataWydania);
  if (dodatki) opisDokumentu.notes = dodatki;

  return {
    czyDowod: d.czyDowod !== false,
    rejestracja: { zDowodu: rej, zgodna: !rej || [v.plate, v.plate2].some(p => p && bezOdstepow(p) === bezOdstepow(rej)) },
    pola, opisDokumentu,
  };
}

// ── Pozostałe dokumenty pojazdu (kalibracja tachografu, polisa, UDT, CEMT…) ──
// Zgłoszenie usera 23.11.2026: po wgraniu zaświadczenia z kalibracji tachografu aplikacja nie zaczytała
// daty ani ważności — odczyt działał tylko dla dowodu. Tu AI czyta trzy rzeczy wspólne dla każdego
// dokumentu: numer, datę wystawienia i termin ważności; trafiają do OPISU DOKUMENTU (nie do karty auta),
// a dokument z datą ważności sam pojawia się w „Terminach” i w mailu z terminami.

export const promptDokumentu = (rodzaj) => `To skan lub zdjęcie dokumentu pojazdu ciężarowego. Rodzaj wg użytkownika: „${rodzaj || "inny dokument"}”.
Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "numer": "numer dokumentu (np. numer zaświadczenia, zlecenia, polisy, decyzji, certyfikatu) albo null",
  "dataDokumentu": "data wystawienia / wykonania YYYY-MM-DD albo null",
  "waznyDo": "termin ważności albo data następnej czynności YYYY-MM-DD albo null",
  "rejestracja": "numer rejestracyjny pojazdu z dokumentu albo null",
  "vin": "numer VIN z dokumentu albo null"
}
Wskazówki do pola waznyDo:
- zaświadczenie z kalibracji / sprawdzenia tachografu: „Data nast. kalibracji” (Next calibration date); dataDokumentu = data kalibracji,
- polisa OC/AC/GAP: koniec okresu ubezpieczenia,
- decyzja lub protokół UDT: termin następnego badania,
- certyfikat, zezwolenie, upoważnienie: data, do której jest ważne.
Przepisuj DOKŁADNIE z dokumentu. Jeśli dokument nie podaje terminu ważności, zwróć null — NIE wyliczaj go samodzielnie.`;

/** Zestawia odczyt z opisem dokumentu `d`. Ten sam kształt wyniku co `porownajZDowodem`. */
export function porownajZDokumentem(v, d, dane) {
  const x = dane || {};
  const pola = [];
  const dodaj = (klucz, etykieta, wartosc, pokaz = String) => {
    if (!wartosc) return;
    const jest = czysty(d?.[klucz]);
    const stan = !jest ? "nowe" : jest.toLowerCase() === String(wartosc).toLowerCase() ? "zgodne" : "rozni";
    pola.push({ klucz, etykieta, teraz: jest ? pokaz(jest) : "", zDowodu: pokaz(wartosc), wartosc, stan, domyslnie: stan === "nowe" });
  };
  dodaj("number", "Numer dokumentu", czysty(x.numer));
  dodaj("issueDate", "Data dokumentu", data(x.dataDokumentu), fmtData);
  dodaj("expiryDate", "Ważny do", data(x.waznyDo), fmtData);
  const rej = czysty(x.rejestracja), vin = bezOdstepow(x.vin);
  // Auto rozpoznajemy po REJESTRACJI (spacje i myślniki bez znaczenia); VIN jest zapasem, gdy dokument rejestracji
  // nie podaje. Zgłoszenie usera 23.11.2026 (WGM 0475M): rejestracja zgodna, a okno straszyło „innym autem” i pokazywało
  // dwie takie same rejestracje — bo różnił się VIN (w karcie …C5R…, w zaświadczeniu …C1R…). To osobna, spokojniejsza
  // uwaga (`vinRozny`): auto to samo, ale jeden z numerów VIN ma błąd i trzeba sprawdzić kartę.
  const rejOk = [v.plate, v.plate2].some(p => p && bezOdstepow(p) === bezOdstepow(rej));
  const vinOk = !poprawnyVin(vin) || !v.vin || bezOdstepow(v.vin) === vin;
  return {
    czyDowod: true,
    rejestracja: rej ? { zDowodu: rej, zgodna: rejOk } : { zDowodu: `VIN ${vin}`, zgodna: vinOk },
    vinRozny: rej && rejOk && !vinOk ? { zDokumentu: vin, wKarcie: bezOdstepow(v.vin) } : null,
    pola, opisDokumentu: {},
  };
}

// ── Wgrywanie bez wybierania rodzaju (user, 24.11.2026) ──
// „Nie chcę mieć listy wyboru, jaki dokument wgrywam — AI musi to rozczytać i przypisać do kafelka,
// a człowiek potwierdza: klika Zapisz, sprawdza i może coś poprawić.” AI wskazuje rodzaj z NASZEJ listy
// i czyta dane wspólne dla każdego dokumentu; `rozpoznanyDokument` robi z tego propozycję do okna.

export const promptRozpoznania = (rodzaje) => `To skan lub zdjęcie dokumentu dotyczącego pojazdu ciężarowego firmy transportowej.
Rozpoznaj, co to za dokument, i odczytaj z niego dane. Odpowiedz TYLKO w formacie JSON (bez markdown):
{
  "rodzaj": "DOKŁADNIE jeden identyfikator z listy poniżej",
  "tytul": "krótka nazwa dokumentu po polsku, do 60 znaków, np. „Polisa OC/AC PZU 2026/2027” albo „Kalibracja tachografu 10.2026”",
  "numer": "numer dokumentu (polisy, zaświadczenia, decyzji, umowy, faktury) albo null",
  "dataDokumentu": "data wystawienia / zawarcia / wykonania YYYY-MM-DD albo null",
  "waznyDo": "termin ważności albo data następnej czynności YYYY-MM-DD albo null",
  "rejestracja": "numer rejestracyjny pojazdu, którego dokument dotyczy, albo null",
  "vin": "numer VIN z dokumentu albo null",
  "polisa": { "oc": true/false, "ac": true/false, "gap": true/false } — tylko dla polis: które ubezpieczenia obejmuje; inaczej null,
  "nrEwidencyjnyUdt": "numer ewidencyjny urządzenia z decyzji / protokołu UDT albo null"
}
Lista rodzajów (identyfikator — znaczenie):
${rodzaje.map(r => `- ${r.id} — ${r.label}`).join("\n")}
Wskazówki:
- dowód rejestracyjny albo pozwolenie czasowe → dowod; zaświadczenie o przeprowadzonym badaniu technicznym → badanie,
- polisa lub certyfikat ubezpieczenia OC / AC / NNW pojazdu → polisa; ubezpieczenie GAP → gap,
- legalizacja / przegląd gaśnicy → gasnica; kalibracja lub sprawdzenie tachografu → tachograf,
- gdy nic nie pasuje albo nie masz pewności → inne (nie zgaduj).
Wskazówki do pola waznyDo: polisa — koniec okresu ubezpieczenia; kalibracja tachografu — „Data nast. kalibracji”;
UDT — termin następnego badania; badanie techniczne — termin następnego badania; gaśnica — data następnego przeglądu;
certyfikat, zezwolenie, upoważnienie — data, do której jest ważne. Umowa leasingu, faktura, protokół: null.
Przepisuj DOKŁADNIE z dokumentu. Czego nie widać, nie zgaduj — zwróć null. Terminu ważności NIE wyliczaj samodzielnie.`;

/** Rodzaje, których termin i numer mają własne pola w karcie auta. */
export const RODZAJE_Z_POLEM_KARTY = ["polisa", "gap", "udt", "dowod", "badanie", "gasnica"];

/**
 * Propozycja opisu dokumentu z odczytu AI: { kind, label, number, issueDate, expiryDate, notes }.
 * `znane` = lista identyfikatorów rodzajów; nieznany rodzaj ląduje w „inne”.
 */
export function opisZRozpoznania(d, dane, znane) {
  const x = dane || {};
  return {
    kind: znane.includes(x.rodzaj) ? x.rodzaj : "inne",
    label: czysty(x.tytul).slice(0, 80) || czysty(d?.label),
    number: czysty(x.numer), issueDate: data(x.dataDokumentu), expiryDate: data(x.waznyDo), notes: "",
  };
}

/** Czy dokument dotyczy tego auta: { zDokumentu, zgodna, przyczepa } + osobna uwaga o VIN-ie. */
export function czyjDokument(v, dane) {
  const x = dane || {};
  const rej = czysty(x.rejestracja), vin = bezOdstepow(x.vin);
  const pasuje = (p) => !!p && !!rej && bezOdstepow(p) === bezOdstepow(rej);
  const rejOk = pasuje(v.plate) || pasuje(v.plate2);
  const vinOk = !poprawnyVin(vin) || !v.vin || bezOdstepow(v.vin) === vin;
  return {
    zDokumentu: rej || (poprawnyVin(vin) ? `VIN ${vin}` : ""),
    zgodna: rej ? rejOk : vinOk,
    przyczepa: pasuje(v.plate2) && !pasuje(v.plate),
    vinRozny: rej && rejOk && !vinOk ? { zDokumentu: vin, wKarcie: bezOdstepow(v.vin) } : null,
  };
}

/**
 * Pola KARTY AUTA wynikające z dokumentu — liczone z tego, co user ma aktualnie w oknie (`opis`),
 * więc poprawka numeru albo daty w formularzu od razu zmienia propozycję do karty.
 * Ten sam kształt pola co w `porownajZDowodem`. Odnowienie (data późniejsza niż w karcie) jest domyślnie
 * zaznaczone razem z numerem; data wcześniejsza — odznaczona.
 */
export function polaKartyZDokumentu(v, opis, dane) {
  const x = dane || {};
  const pola = [];
  const termin = data(opis.expiryDate), numer = czysty(opis.number);
  const para = (kluczNr, kluczData, nazwa, nr = numer) => {
    const stara = data(v[kluczData]);
    const odnowienie = !!termin && (!stara || termin > stara);
    if (termin) {
      const stan = !stara ? "nowe" : stara === termin ? "zgodne" : "rozni";
      const p = { klucz: kluczData, etykieta: `${nazwa} — ważne do`, teraz: fmtData(stara), zDowodu: fmtData(termin), wartosc: termin, stan, domyslnie: odnowienie };
      if (stan === "rozni" && !odnowienie) p.uwaga = "Data z dokumentu jest WCZEŚNIEJSZA niż w karcie — to raczej starszy dokument. Zostaw odznaczone.";
      pola.push(p);
    }
    if (kluczNr && nr) {
      const jest = czysty(v[kluczNr]);
      const stan = !jest ? "nowe" : bezOdstepow(jest) === bezOdstepow(nr) ? "zgodne" : "rozni";
      pola.push({ klucz: kluczNr, etykieta: `${nazwa} — numer`, teraz: jest, zDowodu: nr, wartosc: nr, stan, domyslnie: !jest || odnowienie });
    }
  };
  if (opis.kind === "polisa") {
    const z = x.polisa || {};
    if (czyjDokument(v, x).przyczepa) para("ocNumber2", "ocExpiry2", `OC przyczepy ${v.plate2}`);
    else {
      if (z.oc || (!z.ac && !z.gap)) para("ocNumber", "ocExpiry", "OC");
      if (z.ac) para("acNumber", "acExpiry", "AC");
      if (z.gap) para(null, "gapExpiry", "GAP");
    }
  } else if (opis.kind === "gap") para(null, "gapExpiry", "GAP");
  else if (opis.kind === "udt") para("udtNumber", "udtExpiry", "UDT windy", czysty(x.nrEwidencyjnyUdt));
  else if (opis.kind === "badanie") para(null, "inspectionExpiry", "Przegląd techniczny");
  else if (opis.kind === "gasnica") para(null, "gasnicaExpiry", "Gaśnica");
  return pola;
}
