// zmniejszPdf — ciężkie skany PDF przepisujemy na lżejsze PRZED wgraniem.
//
// PO CO (zgłoszenie usera 23.11.2026, „chcę dodać dowód rejestracyjny i się nie da"): skaner biurowy
// zapisał jednostronicowy dowód jako bezstratny obraz 3504×2546 → 45,6 MB. Storage przyjmuje pliki
// do 25 MB (`storage.rules`), więc wgranie kończyło się odmową z komunikatem „storage/unauthorized".
// Podniesienie limitu nie wystarczy: skaner AI przyjmuje PDF do ok. 32 MB, a link do takiego pliku
// w ofercie dla klienta waży tyle co film.
//
// JAK: pdf.js rysuje każdą stronę na canvasie (dłuższy bok 2200 px ≈ 190 DPI dla A4), zapisujemy ją
// jako JPG i składamy z tych JPG-ów nowy PDF. Warstwa tekstowa znika — dlatego ruszamy TYLKO pliki
// ponad limit (inaczej i tak by nie weszły), a to w praktyce same skany, które tekstu nie mają.
//
// pdf.js (1,4 MB z workerem) ładujemy z CDN dopiero przy ciężkim pliku — jak heic2any i Leaflet,
// bez dokładania do bundla i bez nowej zależności npm. Skrypt główny przypina SRI; workera nie da
// się przypiąć atrybutem, więc pobieramy go sami, sprawdzamy sumę i uruchamiamy z Blob URL.

const WERSJA = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";
const SRI_GLOWNY = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
const SRI_WORKER = "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2";

/** Limit z `storage.rules` (maxMB(25)) — z zapasem na nagłówki. */
export const LIMIT_PLIKU = 24.5 * 1024 * 1024;
const MAKS_STRON = 40;
const DLUZSZY_BOK = 2200;

export const czyPdf = (plik) => /pdf/i.test(plik?.type || "") || /\.pdf$/i.test(plik?.name || "");
export const fmtMB = (bajty) => `${(bajty / 1024 / 1024).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB`;

let ladowanie = null;
const zaladuj = () => ladowanie || (ladowanie = (async () => {
  if (!window.pdfjsLib) {
    await new Promise((ok, zle) => {
      const s = document.createElement("script");
      s.src = `${WERSJA}/pdf.min.js`; s.integrity = SRI_GLOWNY; s.crossOrigin = "anonymous";
      s.onload = ok; s.onerror = () => zle(new Error("nie udało się pobrać czytnika PDF"));
      document.head.appendChild(s);
    });
  }
  const kod = await (await fetch(`${WERSJA}/pdf.worker.min.js`)).arrayBuffer();
  const suma = new Uint8Array(await crypto.subtle.digest("SHA-384", kod));
  if (`sha384-${btoa(String.fromCharCode(...suma))}` !== SRI_WORKER) throw new Error("czytnik PDF: niezgodna suma kontrolna");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([kod], { type: "text/javascript" }));
  return window.pdfjsLib;
})().catch((e) => { ladowanie = null; throw e; }));

/** Składa PDF z gotowych JPG-ów: strony = [{ jpg: Uint8Array, px: [w, h], pt: [w, h] }]. */
export function pdfZJpg(strony) {
  const enc = new TextEncoder();
  const czesci = []; const offsety = []; let dlugosc = 0;
  const dopisz = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; czesci.push(b); dlugosc += b.length; };
  const obiekt = (nr, tresc, strumien) => {
    offsety[nr] = dlugosc;
    dopisz(`${nr} 0 obj\n${tresc}\n`);
    if (strumien) { dopisz("stream\n"); dopisz(strumien); dopisz("\nendstream\n"); }
    dopisz("endobj\n");
  };
  dopisz("%PDF-1.4\n%âãÏÓ\n");
  // Numeracja: 1 katalog, 2 drzewo stron, potem na każdą stronę trójka: strona, treść, obraz.
  const nrStrony = (i) => 3 + i * 3;
  obiekt(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obiekt(2, `<< /Type /Pages /Kids [${strony.map((_, i) => `${nrStrony(i)} 0 R`).join(" ")}] /Count ${strony.length} >>`);
  strony.forEach((s, i) => {
    const n = nrStrony(i);
    const [w, h] = s.pt.map(x => x.toFixed(2));
    const tresc = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
    obiekt(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
    obiekt(n + 1, `<< /Length ${tresc.length} >>`, tresc);
    obiekt(n + 2, `<< /Type /XObject /Subtype /Image /Width ${s.px[0]} /Height ${s.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${s.jpg.length} >>`, s.jpg);
  });
  const ile = 3 + strony.length * 3;
  const xref = dlugosc;
  dopisz(`xref\n0 ${ile}\n0000000000 65535 f \n`);
  for (let n = 1; n < ile; n++) dopisz(`${String(offsety[n]).padStart(10, "0")} 00000 n \n`);
  dopisz(`trailer\n<< /Size ${ile} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(czesci, { type: "application/pdf" });
}

/**
 * Zwraca lżejszy PDF (ta sama nazwa) albo TEN SAM plik, gdy zmniejszanie nic nie dało.
 * Rzuca wyjątek, gdy pliku nie da się przeczytać — wołający decyduje, co dalej.
 */
export async function zmniejszPdf(plik) {
  const pdfjs = await zaladuj();
  const pdf = await pdfjs.getDocument({ data: await plik.arrayBuffer() }).promise;
  try {
    if (pdf.numPages > MAKS_STRON) throw new Error(`plik ma ${pdf.numPages} stron — za dużo, żeby zmniejszyć w przeglądarce`);
    const strony = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const strona = await pdf.getPage(i);
      const bazowy = strona.getViewport({ scale: 1 });
      const widok = strona.getViewport({ scale: DLUZSZY_BOK / Math.max(bazowy.width, bazowy.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(widok.width); canvas.height = Math.round(widok.height);
      await strona.render({ canvasContext: canvas.getContext("2d"), viewport: widok }).promise;
      const blob = await new Promise((ok, zle) => canvas.toBlob(b => (b ? ok(b) : zle(new Error("nie udało się zapisać strony"))), "image/jpeg", 0.82));
      strony.push({ jpg: new Uint8Array(await blob.arrayBuffer()), px: [canvas.width, canvas.height], pt: [bazowy.width, bazowy.height] });
      canvas.width = canvas.height = 0; // Safari trzyma pamięć canvasa, dopóki go nie wyzerujemy
    }
    const wynik = pdfZJpg(strony);
    return wynik.size < plik.size ? new File([wynik], plik.name, { type: "application/pdf" }) : plik;
  } finally {
    pdf.destroy();
  }
}
