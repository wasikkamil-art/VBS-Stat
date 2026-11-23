// Znak wodny na dokumentach pojazdu — nakładany NA STAŁE przed wgraniem (decyzja usera 23.11.2026:
// treść „firma + data", na stałe przy wgrywaniu, także pliki już wgrane, tylko dokumenty pojazdu).
// Linki do tych plików idą do klientów w ofercie, więc kopia ma mówić, czyja jest i z kiedy.
//
// PDF: pdf-lib dopisuje napis jako warstwę wektorową — tekst dokumentu, podpisy i rozmiar zostają.
//      Gdy pdf-lib nie umie otworzyć pliku (np. PDF zaszyfrowany), strony są przerysowywane na
//      obrazy razem ze znakiem (jak przy zmniejszaniu skanów) — treść ta sama, ale bez warstwy tekstu.
// Zdjęcia (JPG/PNG/WebP): napis rysowany na canvasie.
// CSV/XLSX i inne: znaku nie da się nałożyć — `czyDaSieOznaczyc` zwraca false.
//
// pdf-lib (525 kB) ładowane z CDN na żądanie, przypięte SRI — bez nowej zależności npm.
import { czyPdf, rasteryzujPdf } from "./zmniejszPdf";

const SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const SRI = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";

/** Nazwa w znaku wodnym — jedno miejsce do zmiany. */
export const ZNAK_FIRMA = "VBS";
const KAT = 30;          // stopnie, napis biegnie ukośnie w górę
const KRYCIE = 0.26;     // widoczny także na wzorzystym tle dowodu, a tekst pod spodem nadal czytelny

const czyZdjecie = (plik) => /^image\/(jpe?g|png|webp)$/i.test(plik?.type || "") || /\.(jpe?g|png|webp)$/i.test(plik?.name || "");
export const czyDaSieOznaczyc = (plik) => czyPdf(plik) || czyZdjecie(plik);

/** Treść znaku: „VBS · 23.11.2026" (data wgrania dokumentu). */
export function tekstZnaku(kiedy = new Date()) {
  const d = new Date(kiedy);
  const t = isNaN(d) ? new Date() : d;
  return `${ZNAK_FIRMA} · ${String(t.getDate()).padStart(2, "0")}.${String(t.getMonth() + 1).padStart(2, "0")}.${t.getFullYear()}`;
}

/** Siatka punktów zaczepienia napisów — wspólna dla PDF i canvasa (co drugi rząd przesunięty). */
export function siatkaZnaku(w, h, szerNapisu, rozmiar) {
  const dx = szerNapisu * 1.7, dy = rozmiar * 8;
  const punkty = [];
  for (let rzad = 0, y = -h * 0.3; y < h * 1.3; y += dy, rzad++) {
    for (let x = -w * 0.3 - (rzad % 2 ? dx / 2 : 0); x < w * 1.3; x += dx) punkty.push([x, y]);
  }
  return punkty;
}

/** Rysuje znak na canvasie (zdjęcia oraz strony PDF przerysowywane na obrazy). */
export function rysujZnak(ctx, w, h, tekst) {
  const rozmiar = Math.max(14, Math.round(Math.min(w, h) / 24));
  ctx.save();
  ctx.font = `700 ${rozmiar}px Helvetica, Arial, sans-serif`;
  ctx.fillStyle = `rgba(55, 65, 81, ${KRYCIE})`;
  ctx.textBaseline = "middle";
  const szer = ctx.measureText(tekst).width;
  for (const [x, y] of siatkaZnaku(w, h, szer, rozmiar)) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-KAT * Math.PI / 180); ctx.fillText(tekst, 0, 0); ctx.restore();
  }
  ctx.restore();
}

let ladowanie = null;
const zaladuj = () => ladowanie || (ladowanie = new Promise((ok, zle) => {
  if (window.PDFLib) return ok(window.PDFLib);
  const s = document.createElement("script");
  s.src = SRC; s.integrity = SRI; s.crossOrigin = "anonymous";
  s.onload = () => (window.PDFLib ? ok(window.PDFLib) : zle(new Error("pdf-lib niedostępne")));
  s.onerror = () => { ladowanie = null; zle(new Error("nie udało się pobrać narzędzia do znaku wodnego")); };
  document.head.appendChild(s);
}));

async function znakNaPdf(plik, tekst) {
  const { PDFDocument, StandardFonts, rgb, degrees } = await zaladuj();
  const pdf = await PDFDocument.load(await plik.arrayBuffer());
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const strona of pdf.getPages()) {
    const { width: w, height: h } = strona.getSize();
    const rozmiar = Math.max(9, Math.min(w, h) / 24);
    const szer = font.widthOfTextAtSize(tekst, rozmiar);
    for (const [x, y] of siatkaZnaku(w, h, szer, rozmiar)) {
      strona.drawText(tekst, { x, y, size: rozmiar, font, color: rgb(0.22, 0.25, 0.32), opacity: KRYCIE, rotate: degrees(KAT) });
    }
  }
  return new File([await pdf.save()], plik.name, { type: "application/pdf" });
}

async function znakNaZdjeciu(plik, tekst) {
  const obraz = await createImageBitmap(plik);
  const canvas = document.createElement("canvas");
  canvas.width = obraz.width; canvas.height = obraz.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(obraz, 0, 0);
  obraz.close?.();
  rysujZnak(ctx, canvas.width, canvas.height, tekst);
  const png = /png/i.test(plik.type) || /\.png$/i.test(plik.name);
  const blob = await new Promise((ok, zle) => canvas.toBlob(b => (b ? ok(b) : zle(new Error("nie udało się zapisać zdjęcia"))), png ? "image/png" : "image/jpeg", 0.9));
  canvas.width = canvas.height = 0;
  return new File([blob], png ? plik.name : plik.name.replace(/\.(webp|jpe?g)$/i, "") + ".jpg", { type: blob.type });
}

/** Zwraca NOWY plik ze znakiem wodnym. Rzuca wyjątek, gdy się nie da — wołający decyduje, co dalej. */
export async function nalozZnakWodny(plik, tekst = tekstZnaku()) {
  if (czyPdf(plik)) {
    try { return await znakNaPdf(plik, tekst); }
    catch (e) {
      console.warn("znak wodny: pdf-lib nie otworzył pliku, przerysowuję strony", e);
      return rasteryzujPdf(plik, (ctx, w, h) => rysujZnak(ctx, w, h, tekst));
    }
  }
  if (czyZdjecie(plik)) return znakNaZdjeciu(plik, tekst);
  throw new Error("na ten rodzaj pliku nie da się nałożyć znaku wodnego");
}
