// podzielSkan — skan zbiorczy (kilka dokumentów w jednym PDF-ie) tniemy na osobne pliki.
//
// PO CO (user, 25.11.2026): biuro skanuje plik dokumentów naraz — w jednym PDF-ie bywa 6 dokumentów
// dwóch aut. Jeden wpis „Inne” z takim plikiem jest bezużyteczny: nie da się go przypisać do kafelka
// ani wysłać klientowi samej polisy. AI wskazuje, które strony tworzą który dokument, a pdf-lib
// (już ładowany z CDN do znaku wodnego) przepisuje te strony do osobnych plików — bez utraty jakości.

import { czyPdf } from "./zmniejszPdf.js";
import { zaladujPdfLib } from "./znakWodny.js";
import { promptPodzialu, promptRozpoznania, planPodzialu } from "./dowodRejestracyjny.js";

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
 * Rozpoznaje plik i — gdy to skan zbiorczy — rozkłada go na dokumenty. Zwraca [{ plik, dane }]:
 *  - zdjęcie albo jednostronicowy PDF → jeden wpis (`promptRozpoznania`),
 *  - wielostronicowy PDF → tyle wpisów, ile dokumentów wskazało AI; każdy z osobnym plikiem.
 *    Gdy AI uzna plik za jeden dokument albo podziału nie da się bezpiecznie użyć — jeden wpis z całym plikiem.
 * `dane` = gotowy odczyt AI (null tylko wtedy, gdy podział zwrócił coś nieużywalnego).
 * `zapytaj(plik, prompt, wiele)` wysyła plik do AI i zwraca sparsowany JSON — dostarcza go wołający.
 */
export async function rozpoznajPlik({ plik, rodzaje, ext, zapytaj }) {
  let lib = null, bajty = null, stron = 1;
  if (czyPdf(plik)) {
    try {
      lib = await zaladujPdfLib();
      bajty = await plik.arrayBuffer();
      stron = (await lib.PDFDocument.load(bajty)).getPageCount();
    } catch (e) { console.warn("podzielSkan: pdf-lib nie otworzył pliku — traktuję jak jeden dokument", e); stron = 1; }
  }
  if (stron < 2) return [{ plik, dane: await zapytaj(plik, promptRozpoznania(rodzaje, ext), false) }];
  const plan = planPodzialu(await zapytaj(plik, promptPodzialu(rodzaje, ext), true), stron);
  if (!plan) return [{ plik, dane: null }];
  if (plan.length === 1) return [{ plik, dane: plan[0].dane }];
  const czesci = await tnijPdf(lib, bajty, plan);
  const baza = plik.name.replace(/\.pdf$/i, "");
  return plan.map((p, i) => {
    const s = p.strony;
    const zakres = s.length === 1 ? `${s[0]}` : `${s[0]}-${s[s.length - 1]}`;
    return { plik: new File([czesci[i]], `${baza} s${zakres}.pdf`, { type: "application/pdf" }), dane: p.dane, strony: s };
  });
}
