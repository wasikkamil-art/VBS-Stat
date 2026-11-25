// podzielSkan — skan zbiorczy (kilka dokumentów w jednym PDF-ie) tniemy na osobne pliki.
//
// PO CO (user, 25.11.2026): biuro skanuje plik dokumentów naraz — w jednym PDF-ie bywa 6 dokumentów
// dwóch aut. Jeden wpis „Inne” z takim plikiem jest bezużyteczny: nie da się go przypisać do kafelka
// ani wysłać klientowi samej polisy. AI wskazuje, które strony tworzą który dokument, a pdf-lib
// (już ładowany z CDN do znaku wodnego) przepisuje te strony do osobnych plików — bez utraty jakości.

import { czyPdf } from "./zmniejszPdf.js";
import { zaladujPdfLib } from "./znakWodny.js";
import { promptPodzialu, planPodzialu } from "./dowodRejestracyjny.js";

/** Tnie PDF wg planu. `lib` = pdf-lib (przeglądarka albo Node). Zwraca tablicę Uint8Array w kolejności planu. */
export async function tnijPdf(lib, bajty, plan) {
  const zrodlo = await lib.PDFDocument.load(bajty);
  const czesci = [];
  for (const { strony } of plan) {
    const nowy = await lib.PDFDocument.create();
    (await nowy.copyPages(zrodlo, strony.map(n => n - 1))).forEach(s => nowy.addPage(s));
    czesci.push(await nowy.save());
  }
  return czesci;
}

/**
 * Rozkłada plik na dokumenty. Zwraca:
 *  - null — to nie jest wielostronicowy PDF albo nie udało się go bezpiecznie podzielić (wgrywaj w całości),
 *  - [{ plik, dane }] — jeden wpis, gdy AI uznało plik za jeden dokument (`plik` = ten sam plik),
 *    albo kilka wpisów z osobnymi plikami. `dane` = gotowy odczyt AI (drugi raz czytać nie trzeba).
 * `zapytaj(plik, prompt)` wysyła plik do AI i zwraca sparsowany JSON — dostarcza go wołający.
 */
export async function rozlozSkan({ plik, rodzaje, zapytaj }) {
  if (!czyPdf(plik)) return null;
  const lib = await zaladujPdfLib();
  const bajty = await plik.arrayBuffer();
  const stron = (await lib.PDFDocument.load(bajty)).getPageCount();
  if (stron < 2) return null;
  const plan = planPodzialu(await zapytaj(plik, promptPodzialu(rodzaje)), stron);
  if (!plan) return null;
  if (plan.length === 1) return [{ plik, dane: plan[0].dane }];
  const czesci = await tnijPdf(lib, bajty, plan);
  const baza = plik.name.replace(/\.pdf$/i, "");
  return plan.map((p, i) => {
    const s = p.strony;
    const zakres = s.length === 1 ? `${s[0]}` : `${s[0]}-${s[s.length - 1]}`;
    return { plik: new File([czesci[i]], `${baza} s${zakres}.pdf`, { type: "application/pdf" }), dane: p.dane, strony: s };
  });
}
