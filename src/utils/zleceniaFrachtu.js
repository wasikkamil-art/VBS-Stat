// Zlecenia w obrębie jednego frachtu (od 2026-09-30).
//
// PO CO: jeden wyjazd bywa rozliczany DWOMA zleceniami. Przykład, od którego to powstało:
// jeden załadunek w Strykowie, dwa rozładunki we Francji (Senozan i Saint Sorlin), dwa
// osobne numery zlecenia od tego samego klienta i dwie kwoty (1150 + 850 EUR).
// Multistop (R1..R5) obsługiwał już dwa rozładunki, ale pola `nrZlecenia`, `nrRef`,
// `cenaEur`, `urlZlecenie` i `nrFV` były POJEDYNCZE — drugie zlecenie nie miało gdzie wejść.
//
// DECYZJA (user, 30.09.2026): to jest JEDEN fracht, nie dwa. Kilometry, pojazd, kierowca
// i tachograf dotyczą jednego przejazdu, więc rozbicie na dwa frachty liczyłoby km podwójnie
// i psuło €/km oraz rentowność. Kwota liczy się łącznie (2000 EUR = jeden fracht).
//
// ZGODNOŚĆ WSTECZ: fracht z jednym zleceniem NIE dostaje tablicy — zostaje na płaskich polach,
// dokładnie jak 730 istniejących rekordów. Tablica `zlecenia` pojawia się dopiero przy drugim
// zleceniu, a płaskie pola są wtedy utrzymywane jako LUSTRO (suma kwot, pierwszy numer), żeby
// raporty, tracker, e-maile i moduł FV czytające `fracht.cenaEur` działały bez zmian.

/** Pusty rekord zlecenia — jedno miejsce na kształt, żeby formularz i zapis się nie rozjechały. */
export function pusteZlecenie() {
  return { nr: "", ref: "", cenaEur: "", nrFV: "", dataWyslania: "", terminPlatnosci: "", urlZlecenie: "", rozladunek: "" };
}

/**
 * Znormalizowana lista zleceń frachtu — działa zarówno dla nowych (tablica),
 * jak i dla wszystkich dotychczasowych rekordów (płaskie pola).
 * Zawsze zwraca co najmniej jedną pozycję, żeby wołający nie musiał sprawdzać długości.
 */
export function zleceniaFrachtu(f) {
  if (Array.isArray(f?.zlecenia) && f.zlecenia.length) {
    return f.zlecenia.map((z) => ({ ...pusteZlecenie(), ...z }));
  }
  return [{
    ...pusteZlecenie(),
    nr: f?.nrZlecenia || "",
    ref: f?.nrRef || "",
    cenaEur: f?.cenaEur || "",
    nrFV: f?.nrFV || "",
    dataWyslania: f?.dataWyslania || "",
    terminPlatnosci: f?.terminPlatnosci || "",
    urlZlecenie: f?.urlZlecenie || "",
  }];
}

/** Czy fracht rozliczany jest więcej niż jednym zleceniem. */
export function maWieleZlecen(f) {
  return Array.isArray(f?.zlecenia) && f.zlecenia.length > 1;
}

const liczba = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Suma kwot zleceń, zaokrąglona do grosza. */
export function sumaZlecen(lista) {
  return Math.round((lista || []).reduce((s, z) => s + liczba(z?.cenaEur), 0) * 100) / 100;
}

/**
 * Przygotowuje fracht do zapisu: ustawia tablicę `zlecenia` i lustrzane pola płaskie.
 *
 * Jedno zlecenie → tablica jest USUWANA, zostają płaskie pola (rekord wygląda jak dotąd).
 * Wiele zleceń  → tablica + `cenaEur` jako SUMA, a pozostałe płaskie pola z pierwszego zlecenia.
 * Bez tego lustra fracht z dwoma zleceniami miałby w raportach kwotę jednego z nich.
 */
export function zapiszZlecenia(f, lista) {
  const czyste = (lista || [])
    .map((z) => ({ ...pusteZlecenie(), ...z }))
    .filter((z) => z.nr || z.ref || liczba(z.cenaEur) || z.urlZlecenie || z.nrFV);

  const wynik = { ...f };
  if (czyste.length <= 1) {
    const z = czyste[0] || zleceniaFrachtu(f)[0];
    delete wynik.zlecenia;
    wynik.nrZlecenia = z.nr || "";
    wynik.nrRef = z.ref || "";
    wynik.cenaEur = z.cenaEur || "";
    wynik.nrFV = z.nrFV || "";
    wynik.dataWyslania = z.dataWyslania || "";
    wynik.terminPlatnosci = z.terminPlatnosci || "";
    wynik.urlZlecenie = z.urlZlecenie || "";
    return wynik;
  }

  wynik.zlecenia = czyste;
  const pierwsze = czyste[0];
  wynik.cenaEur = String(sumaZlecen(czyste));          // ← suma, nie kwota pierwszego zlecenia
  wynik.nrZlecenia = czyste.map((z) => z.nr).filter(Boolean).join(" + ");
  wynik.nrRef = pierwsze.ref || "";
  wynik.nrFV = czyste.map((z) => z.nrFV).filter(Boolean).join(" + ");
  wynik.dataWyslania = pierwsze.dataWyslania || "";
  wynik.terminPlatnosci = pierwsze.terminPlatnosci || "";
  wynik.urlZlecenie = pierwsze.urlZlecenie || "";
  return wynik;
}

/** Etykieta zlecenia do list i nagłówków — „003427/2026" albo „003427/2026 + 003428/2026". */
export function etykietaZlecen(f) {
  const lista = zleceniaFrachtu(f);
  const numery = lista.map((z) => z.nr || z.ref).filter(Boolean);
  return numery.join(" + ");
}
