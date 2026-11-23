// Znak wodny nakładany W CHWILI POBRANIA dokumentu pojazdu (decyzja usera 23.11.2026: w aplikacji plik ma
// mieć logo VBS z datą pobrania, a w dzienniku ma zostać ślad, kto go pobrał; linki w ofertach dla klientów
// zostają przy stałej kopii ze znakiem z dnia wgrania).
//
// Układ znaku to KOPIA `src/utils/znakWodny.js` (ukladZnaku + znakNaDokumenciePdf) — front jest ESM i nie
// trafia do paczki funkcji, więc kodu nie da się współdzielić. Zmieniasz wygląd znaku → zmień w obu miejscach.
const fs = require("fs");
const path = require("path");
const pdfLib = require("pdf-lib");

const LOGO = fs.readFileSync(path.join(__dirname, "..", "assets", "vbs-logo.png"));
const LOGO_PROPORCJE = 479 / 1371;
const KAT = 30;
const KRYCIE_LOGO = 0.22;
const KRYCIE_DATY = 0.32;

/** Dzisiejsza data w Polsce: „23.11.2026". */
const dataPobrania = (kiedy = new Date()) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit", year: "numeric" }).format(kiedy);

function ukladZnaku(w, h) {
  const szer = Math.min(w, h) / 4.2, wys = szer * LOGO_PROPORCJE, data = wys * 0.42;
  const dx = szer * 1.9, dy = (wys + data) * 3.4;
  const punkty = [];
  for (let rzad = 0, y = -h * 0.3; y < h * 1.3; y += dy, rzad++) {
    for (let x = -w * 0.3 - (rzad % 2 ? dx / 2 : 0); x < w * 1.3; x += dx) punkty.push([x, y]);
  }
  return { szer, wys, data, punkty };
}

async function znakNaDokumenciePdf(pdf, tekstDaty) {
  const { StandardFonts, rgb, degrees } = pdfLib;
  const logo = await pdf.embedPng(LOGO);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cos = Math.cos(KAT * Math.PI / 180), sin = Math.sin(KAT * Math.PI / 180);
  for (const strona of pdf.getPages()) {
    const { width: w, height: h } = strona.getSize();
    const u = ukladZnaku(w, h);
    const px = (u.szer - font.widthOfTextAtSize(tekstDaty, u.data)) / 2, py = -u.data * 1.05;
    for (const [x, y] of u.punkty) {
      strona.drawImage(logo, { x, y, width: u.szer, height: u.wys, rotate: degrees(KAT), opacity: KRYCIE_LOGO });
      strona.drawText(tekstDaty, { x: x + px * cos - py * sin, y: y + px * sin + py * cos, size: u.data, font, color: rgb(0.18, 0.19, 0.57), opacity: KRYCIE_DATY, rotate: degrees(KAT) });
    }
  }
}

/** Rodzaj pliku po rozszerzeniu: "pdf" | "jpg" | "png" | null (nie da się oznaczyć po stronie serwera). */
function rodzajPliku(nazwa) {
  const ext = String(nazwa || "").split(".").pop().toLowerCase();
  return ext === "pdf" ? "pdf" : (ext === "jpg" || ext === "jpeg") ? "jpg" : ext === "png" ? "png" : null;
}

/**
 * Zwraca PDF (Buffer) ze znakiem wodnym z datą `tekstDaty`. PDF zostaje PDF-em (warstwa wektorowa na
 * wierzchu, treść nietknięta); zdjęcie JPG/PNG trafia na jedną stronę PDF — po stronie serwera nie mamy
 * biblioteki do rysowania po obrazach, a PDF ze zdjęciem i znakiem spełnia ten sam cel.
 */
async function oznaczDoPobrania(bufor, rodzaj, tekstDaty) {
  let pdf;
  if (rodzaj === "pdf") pdf = await pdfLib.PDFDocument.load(bufor);
  else if (rodzaj === "jpg" || rodzaj === "png") {
    pdf = await pdfLib.PDFDocument.create();
    const obraz = rodzaj === "jpg" ? await pdf.embedJpg(bufor) : await pdf.embedPng(bufor);
    const skala = 842 / Math.max(obraz.width, obraz.height);
    const strona = pdf.addPage([obraz.width * skala, obraz.height * skala]);
    strona.drawImage(obraz, { x: 0, y: 0, width: obraz.width * skala, height: obraz.height * skala });
  } else throw new Error("na ten rodzaj pliku nie da się nałożyć znaku wodnego");
  await znakNaDokumenciePdf(pdf, tekstDaty);
  return Buffer.from(await pdf.save());
}

/** Bezpieczna nazwa pliku do nagłówka Content-Disposition. */
const nazwaPliku = (etykieta) => (String(etykieta || "dokument").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L")
  .replace(/[^A-Za-z0-9 ._()-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "dokument");

module.exports = { dataPobrania, rodzajPliku, oznaczDoPobrania, nazwaPliku };
