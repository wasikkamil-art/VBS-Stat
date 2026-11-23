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
  "badanieDo": "termin następnego badania technicznego YYYY-MM-DD — NAJPÓŹNIEJSZY wpis; null, gdy nieczytelny lub brak",
  "ladownosc": "dopuszczalna ładowność w kg, sama liczba",
  "dmc": "pole F.2 — dopuszczalna masa całkowita w kg, sama liczba",
  "masaWlasna": "pole G — masa własna w kg, sama liczba"
}
Przepisuj DOKŁADNIE z dokumentu. Pola, którego nie widać albo nie da się pewnie odczytać, nie zgaduj — zwróć null.
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
  dodaj("inspectionExpiry", "Przegląd — ważny do", v.inspectionExpiry, data(d.badanieDo), { pokaz: fmtData, rowne: (a, b) => a === b });
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
