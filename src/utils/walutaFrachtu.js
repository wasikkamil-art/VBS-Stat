// Przeliczanie kwoty zlecenia na EUR (od 2026-10-22).
//
// PO CO: Mykola jeździ po Polsce i te zlecenia rozliczamy w złotówkach, a cała reszta
// systemu — rentowność, rankingi, dashboardy dyspozytorów, €/km, moduł FV — czyta
// WYŁĄCZNIE `cenaEur`. Zamiast przerabiać kilkanaście miejsc, przeliczamy na wejściu:
// dyspozytor wpisuje kwotę w swojej walucie, a do bazy idzie dodatkowo wartość w euro.
//
// DECYZJA (user, 2026-10-22): kurs z DATY ZAŁADUNKU. Tym samym polem filtrujemy miesiąc
// w raportach, więc fracht i jego kurs zawsze wpadają do tego samego miesiąca. Wariant
// „dzień wystawienia FV" odpadł, bo fracht byłby bez wartości do czasu wpisania faktury.
//
// Kurs ZAPISUJEMY przy frachcie i nie przeliczamy go ponownie — inaczej wartość września
// zmieniałaby się w grudniu, gdy NBP się ruszy.

// Rozszerzenie `.js` jest tu konieczne: Vite rozwiąże import i bez niego, ale skrypty
// testowe odpalają ten moduł wprost w Node (ESM), gdzie brak rozszerzenia to błąd.
import { nbpRateInfo } from "./nbp.js";

const liczba = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Czy ta kwota w ogóle wymaga przeliczenia (czyli: czy to nie są euro). */
export function wymagaPrzeliczenia(waluta) {
  return String(waluta || "EUR").toUpperCase() !== "EUR";
}

/**
 * Kwota w walucie zlecenia → EUR kursem NBP z `isoDay`.
 *
 * Zwraca `{ cenaEur, kurs, kursData }` albo `{ blad }`. NIGDY nie zwraca kwoty policzonej
 * zastępczym kursem — brak liczby jest lepszy niż liczba wzięta z sufitu, bo ta trafia
 * potem do rentowności i raportu dla dyspozytorów.
 */
export async function naEur(kwota, waluta, isoDay) {
  const kw = liczba(kwota);
  const cur = String(waluta || "EUR").toUpperCase();

  if (!kw) return { cenaEur: "", kurs: "", kursData: "" };
  if (!wymagaPrzeliczenia(cur)) return { cenaEur: String(kw), kurs: "", kursData: "" };
  if (!isoDay) return { blad: "Podaj datę załadunku — z jej dnia bierzemy kurs NBP." };

  // netto_EUR = kwota * kurs(waluta) / kurs(EUR); dla PLN kurs(PLN) = 1.
  const [waluty, euro] = await Promise.all([nbpRateInfo(cur, isoDay), nbpRateInfo("EUR", isoDay)]);
  if (!waluty || !euro) return { blad: `Nie udało się pobrać kursu NBP na ${isoDay}.` };

  const cenaEur = Math.round((kw * waluty.mid / euro.mid) * 100) / 100;
  return {
    cenaEur: String(cenaEur),
    // Zapisujemy kurs, którym faktycznie dzielimy — ile złotych za euro.
    kurs: String(Math.round((euro.mid / waluty.mid) * 10000) / 10000),
    kursData: euro.date,
  };
}

/** „1 500 PLN × kurs 4,2715 z 2026-10-21" — podpis pod kwotą, żeby było widać skąd wynik. */
export function opisPrzeliczenia(z) {
  if (!z || !wymagaPrzeliczenia(z.waluta) || !z.kurs) return "";
  const kw = liczba(z.kwota);
  if (!kw) return "";
  const kurs = String(z.kurs).replace(".", ",");
  return `${kw.toLocaleString("pl-PL")} ${String(z.waluta).toUpperCase()} · kurs ${kurs}${z.kursData ? ` z ${z.kursData}` : ""}`;
}

/**
 * Zlecenia, które mają wpisaną kwotę, ale nie mają wartości w euro — czyli kurs nie doszedł.
 * Formularz na tej podstawie blokuje zapis, zamiast wpuścić fracht bez kwoty do raportów.
 */
export function zleceniaBezKursu(lista) {
  return (lista || [])
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => liczba(z?.kwota) > 0 && !liczba(z?.cenaEur));
}
