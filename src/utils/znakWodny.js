// Znak wodny na dokumentach pojazdu — nakładany NA STAŁE przed wgraniem (decyzja usera 23.11.2026:
// logo VBS + data, na stałe przy wgrywaniu, także pliki już wgrane, tylko dokumenty pojazdu; czysty
// oryginał zostaje w Storage pod `oryginalPath` — widoczna i rozsyłana jest zawsze kopia ze znakiem).
// Linki do tych plików idą do klientów w ofercie, więc kopia ma mówić, czyja jest i z kiedy.
//
// PDF: pdf-lib dopisuje napis jako warstwę wektorową — tekst dokumentu, podpisy i rozmiar zostają.
//      Gdy pdf-lib nie umie otworzyć pliku (np. PDF zaszyfrowany), strony są przerysowywane na
//      obrazy razem ze znakiem (jak przy zmniejszaniu skanów) — treść ta sama, ale bez warstwy tekstu.
// Zdjęcia (JPG/PNG/WebP): napis rysowany na canvasie.
// CSV/XLSX i inne: znaku nie da się nałożyć — `czyDaSieOznaczyc` zwraca false.
//
// pdf-lib (525 kB) ładowane z CDN na żądanie, przypięte SRI — bez nowej zależności npm.
import { czyPdf, rasteryzujPdf } from "./zmniejszPdf.js";

const SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const SRI = "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";

/** Logo w znaku wodnym — ten sam plik co na trackerze (`public/vbs-logo.png`, 1371×479, przezroczyste tło). */
const LOGO_URL = "/vbs-logo.png";
const LOGO_PROPORCJE = 479 / 1371;
const KAT = 30;            // stopnie, znak biegnie ukośnie w górę
const KRYCIE_LOGO = 0.22;  // widoczne na wzorzystym tle dowodu, a tekst pod spodem nadal czytelny (także dla AI)
const KRYCIE_DATY = 0.32;

const czyZdjecie = (plik) => /^image\/(jpe?g|png|webp)$/i.test(plik?.type || "") || /\.(jpe?g|png|webp)$/i.test(plik?.name || "");
export const czyDaSieOznaczyc = (plik) => czyPdf(plik) || czyZdjecie(plik);

/** Data w znaku: „23.11.2026" (dzień wgrania dokumentu). */
export function dataZnaku(kiedy = new Date()) {
  const d = new Date(kiedy);
  const t = isNaN(d) ? new Date() : d;
  return `${String(t.getDate()).padStart(2, "0")}.${String(t.getMonth() + 1).padStart(2, "0")}.${t.getFullYear()}`;
}
/** Opis znaku zapisywany przy dokumencie (pole `znakWodny`). */
export const tekstZnaku = (kiedy) => `logo VBS · ${dataZnaku(kiedy)}`;

/**
 * Wymiary jednego znaku (logo + data pod spodem) i siatka punktów zaczepienia na stronie w×h.
 * Wspólne dla PDF, canvasa i skryptu, który oznaczał stare pliki — wszędzie ten sam układ.
 */
export function ukladZnaku(w, h) {
  const szer = Math.min(w, h) / 4.2, wys = szer * LOGO_PROPORCJE, data = wys * 0.42;
  const dx = szer * 1.9, dy = (wys + data) * 3.4;
  const punkty = [];
  for (let rzad = 0, y = -h * 0.3; y < h * 1.3; y += dy, rzad++) {
    for (let x = -w * 0.3 - (rzad % 2 ? dx / 2 : 0); x < w * 1.3; x += dx) punkty.push([x, y]);
  }
  return { szer, wys, data, punkty };
}

let logoBajty = null;
const pobierzLogo = () => logoBajty || (logoBajty = fetch(LOGO_URL).then(async (r) => {
  if (!r.ok) throw new Error(`logo do znaku wodnego: błąd ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}).catch((e) => { logoBajty = null; throw e; }));

/** Rysuje znak na canvasie (zdjęcia oraz strony PDF przerysowywane na obrazy). `logo` = ImageBitmap. */
export function rysujZnak(ctx, w, h, logo, tekstDaty) {
  const u = ukladZnaku(w, h);
  ctx.save();
  ctx.font = `700 ${u.data}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "top"; ctx.textAlign = "center";
  for (const [x, y] of u.punkty) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-KAT * Math.PI / 180);
    ctx.globalAlpha = KRYCIE_LOGO; ctx.drawImage(logo, 0, -u.wys, u.szer, u.wys);
    ctx.globalAlpha = KRYCIE_DATY; ctx.fillStyle = "#2e3192"; ctx.fillText(tekstDaty, u.szer / 2, u.data * 0.25);
    ctx.restore();
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

/**
 * Nakłada znak na otwarty dokument pdf-lib. Wydzielone, żeby ten sam kod działał w przeglądarce
 * i w Node (`lib` = moduł pdf-lib, `logoPng` = bajty logo).
 */
export async function znakNaDokumenciePdf(lib, pdf, logoPng, tekstDaty) {
  const { StandardFonts, rgb, degrees } = lib;
  const logo = await pdf.embedPng(logoPng);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cos = Math.cos(KAT * Math.PI / 180), sin = Math.sin(KAT * Math.PI / 180);
  for (const strona of pdf.getPages()) {
    const { width: w, height: h } = strona.getSize();
    const u = ukladZnaku(w, h);
    // Data wyśrodkowana pod logo — przesunięcie liczone w układzie obróconym o KAT.
    const px = (u.szer - font.widthOfTextAtSize(tekstDaty, u.data)) / 2, py = -u.data * 1.05;
    for (const [x, y] of u.punkty) {
      strona.drawImage(logo, { x, y, width: u.szer, height: u.wys, rotate: degrees(KAT), opacity: KRYCIE_LOGO });
      strona.drawText(tekstDaty, { x: x + px * cos - py * sin, y: y + px * sin + py * cos, size: u.data, font, color: rgb(0.18, 0.19, 0.57), opacity: KRYCIE_DATY, rotate: degrees(KAT) });
    }
  }
}

async function znakNaPdf(plik, tekstDaty) {
  const lib = await zaladuj();
  const pdf = await lib.PDFDocument.load(await plik.arrayBuffer());
  await znakNaDokumenciePdf(lib, pdf, await pobierzLogo(), tekstDaty);
  return new File([await pdf.save()], plik.name, { type: "application/pdf" });
}

const logoBitmapa = async () => createImageBitmap(new Blob([await pobierzLogo()], { type: "image/png" }));

async function znakNaZdjeciu(plik, tekstDaty) {
  const [obraz, logo] = await Promise.all([createImageBitmap(plik), logoBitmapa()]);
  const canvas = document.createElement("canvas");
  canvas.width = obraz.width; canvas.height = obraz.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(obraz, 0, 0);
  obraz.close?.();
  rysujZnak(ctx, canvas.width, canvas.height, logo, tekstDaty);
  const png = /png/i.test(plik.type) || /\.png$/i.test(plik.name);
  const blob = await new Promise((ok, zle) => canvas.toBlob(b => (b ? ok(b) : zle(new Error("nie udało się zapisać zdjęcia"))), png ? "image/png" : "image/jpeg", 0.9));
  canvas.width = canvas.height = 0;
  return new File([blob], png ? plik.name : plik.name.replace(/\.(webp|jpe?g)$/i, "") + ".jpg", { type: blob.type });
}

/** Zwraca NOWY plik ze znakiem wodnym (logo VBS + data `kiedy`). Rzuca wyjątek, gdy się nie da. */
export async function nalozZnakWodny(plik, kiedy = new Date()) {
  const tekstDaty = dataZnaku(kiedy);
  if (czyPdf(plik)) {
    try { return await znakNaPdf(plik, tekstDaty); }
    catch (e) {
      console.warn("znak wodny: pdf-lib nie otworzył pliku, przerysowuję strony", e);
      const logo = await logoBitmapa();
      return rasteryzujPdf(plik, (ctx, w, h) => rysujZnak(ctx, w, h, logo, tekstDaty));
    }
  }
  if (czyZdjecie(plik)) return znakNaZdjeciu(plik, tekstDaty);
  throw new Error("na ten rodzaj pliku nie da się nałożyć znaku wodnego");
}
