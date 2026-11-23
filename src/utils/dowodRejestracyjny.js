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
  if (lad) dodaj("maxWeight", "Ładowność (kg)", v.maxWeight, String(lad), { rowne: (a, b) => Number(a) === Number(b) });

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
