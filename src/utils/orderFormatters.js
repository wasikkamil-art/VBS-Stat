// Helpery formatowania zlecenia — używane przez:
//   - CopyOrderPreviewModal (kopiuj dane dla kierowcy do Signal/SMS/email)
//   - WhatsappSendPreviewModal (wysyłka template do Meta)
//   - App.jsx (inline display różnych miejsc)
//
// Wydzielone z monolitu App.jsx 2026-04-28 jako pierwszy krok TODO #5c
// (code splitting komercjalizacji — pozwala lazy load CopyOrderPreviewModal).

// ── parseGeoString ──
// "50.123, 19.456" → { lat: 50.123, lng: 19.456 } | null
// Format Atlas/widziszwszystko: string "lat,lng" (z opcjonalnymi spacjami).
// Rozszerzenie `.js` jest tu WYMAGANE: Vite rozwiąże import bez niego, ale ten moduł
// bywa ładowany też wprost przez node (skrypty raportowe i testy), a node ESM nie zgaduje.
import { zleceniaDlaRozladunku, opisLadunkuZlecenia, zleceniaFrachtu } from "./zleceniaFrachtu.js";

/**
 * Usuwa kwoty z tekstu, który zobaczy KIEROWCA.
 *
 * Prompt parsera zabrania wstawiania cen do `uwagi`, ale prompt to prośba, nie gwarancja —
 * a od 30.09.2026 model czyta kwotę frachtu, więc szansa, że przy okazji wspomni ją w uwagach,
 * wzrosła. Kierowca nie ma widzieć stawki: to informacja handlowa między spedycją a firmą.
 * Dlatego tniemy ją tutaj, na wyjściu, niezależnie od tego, co zwrócił model albo co ktoś wkleił.
 *
 * Celowo wąskie wzorce — „15 minut", „3,5 t" czy „24 h" mają zostać nietknięte.
 */
export function bezKwot(tekst) {
  if (!tekst) return "";
  return String(tekst)
    // 1150 EUR / 1 150,00 € / 2000 PLN / 500 zł
    // `\b` nie działa po „ł" — w JS bez flagi `u` granica słowa liczy tylko [A-Za-z0-9_],
    // więc „500 zł" nie było łapane. Dla polskich wariantów używamy lookaheadu na literę.
    .replace(/\d[\d\s.,]*\s*(?:EUR\b|EURO\b|€|PLN\b|zł(?![a-ząćęłńóśźż])|zl\b)/gi, "")
    // fracht/stawka/cena/kwota/wartość 1150 (bez waluty)
    .replace(/\b(?:fracht|stawka|cena|kwota|wartość|wartosc|frachtu)\s*[:=]?\s*\d[\d\s.,]*/gi, "")
    // osierocone spójniki i interpunkcja po wycięciu
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, "")
    .trim();
}

export function parseGeoString(geo) {
  if (!geo || typeof geo !== "string") return null;
  const [latStr, lngStr] = geo.split(",").map(s => s.trim());
  const lat = Number(latStr), lng = Number(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// ── unloadStops ──
// Rozkłada płaskie pola R1..R5 (`dokodPocztowy`, `dokodMiasto`, `rozladunekAdres`,
// suffix "" dla R1 i "2".."5" dla reszty) na listę punktów rozładunku.
// Zwraca TYLKO stopy które mają jakikolwiek adres — więc długość tablicy = liczba
// realnych rozładunków. Jedno źródło prawdy dla WhatsAppa, kopiowania i list w App.jsx.
export function unloadStops(fracht) {
  if (!fracht) return [];
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    const kod = fracht[`dokodPocztowy${sfx}`];
    const miasto = fracht[`dokodMiasto${sfx}`];
    const adres = fracht[`rozladunekAdres${sfx}`];
    const legacy = fracht[`dokod${sfx}`];
    const full = [adres, [kod, miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const addr = (full || legacy || "").trim();
    if (!addr) continue;
    out.push({
      i, addr,
      krotki: ([kod, miasto].filter(Boolean).join(" ") || legacy || "").trim(),
      geo: fracht[`rozladunekGeo${sfx}`],
      tel: fracht[`rozladunekTelefon${sfx}`],
      data: fracht[`dataRozladunku${sfx}`],
      godz: fracht[`godzRozladunku${sfx}`],
      firma: fracht[`rozladunekFirma${sfx}`],
    });
  }
  return out;
}

// ── allDokody ──
// Krótkie etykiety "dokąd" dla wszystkich stopów (R1..R5) — do list i tabel.
// Zastępuje rozsiane po kodzie `[f.dokod, f.dokod2, f.dokod3]` (ucinało R4/R5).
export function allDokody(fracht) {
  return unloadStops(fracht).map(s => s.krotki).filter(Boolean);
}

// ── formatOrderForDriverCopy ──
// Bogaty tekstowy format zlecenia gotowy do wklejenia kierowcy w Signal/SMS/email
// (poza WhatsApp który używa templatu Meta — patrz formatOrderForWhatsapp).
//
// Format dla kierowcy — TYLKO niezbędne info: BEZ numeru zlecenia, BEZ klienta,
// BEZ vehicle (driver wie co prowadzi), BEZ zleceniodawcy, BEZ cen/marży.
// Obsługuje: pełne Z1+Z2 + R1-R5 z GPS/telefonami/firmą per punkt.
export function formatOrderForDriverCopy(fracht /* , vehicles = [] */) {
  if (!fracht) return "";
  const fmtD = (d) => d ? d.split("-").reverse().join(".") : "—";
  const fmtT = (t) => t || "—";
  const lines = [];

  // ZAŁADUNEK — Z1 i Z2
  const zalPunkty = [];
  const z1full = [fracht.zaladunekAdres, [fracht.zaladunekKodPocztowy, fracht.zaladunekMiasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (z1full || fracht.zaladunekKod) zalPunkty.push({
    idx: "Z1", addr: z1full || fracht.zaladunekKod || "",
    geo: fracht.zaladunekGeo, tel: fracht.zaladunekTelefon,
    data: fracht.dataZaladunku, godz: fracht.godzZaladunku,
    firma: fracht.zaladunekFirma,
  });
  const z2full = [fracht.zaladunekAdres2, [fracht.zaladunekKodPocztowy2, fracht.zaladunekMiasto2].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (z2full || fracht.zaladunekKod2) zalPunkty.push({
    idx: "Z2", addr: z2full || fracht.zaladunekKod2 || "",
    geo: fracht.zaladunekGeo2, tel: fracht.zaladunekTelefon2,
    data: fracht.dataZaladunku2, godz: fracht.godzZaladunku2,
    firma: fracht.zaladunekFirma2,
  });

  if (zalPunkty.length > 0) {
    lines.push("📍 ZAŁADUNEK");
    zalPunkty.forEach(p => {
      const firmaSuffix = p.firma ? ` — ${p.firma}` : "";
      lines.push(`🚩 ${p.idx} — ${fmtD(p.data)} ${fmtT(p.godz)}${firmaSuffix}`);
      if (p.addr) lines.push(`   ${p.addr}`);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`   GPS: ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`);
      if (p.tel) lines.push(`   Tel: ${p.tel}`);
      lines.push("");
    });
  }

  // ROZŁADUNEK — R1 do R5
  const rozPunkty = [];
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    const kodPocztowy = fracht[`dokodPocztowy${sfx}`];
    const miasto = fracht[`dokodMiasto${sfx}`];
    const adres = fracht[`rozladunekAdres${sfx}`];
    const kodCompat = fracht[`dokod${sfx}`];
    const full = [adres, [kodPocztowy, miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const addr = full || kodCompat || "";
    if (!addr) continue;
    rozPunkty.push({
      idx: `R${i}`, addr,
      geo: fracht[`rozladunekGeo${sfx}`],
      tel: fracht[`rozladunekTelefon${sfx}`],
      data: fracht[`dataRozladunku${sfx}`],
      godz: fracht[`godzRozladunku${sfx}`],
      firma: fracht[`rozladunekFirma${sfx}`],
    });
  }

  if (rozPunkty.length > 0) {
    lines.push("📦 ROZŁADUNEK");
    rozPunkty.forEach((p, i) => {
      const firmaSuffix = p.firma ? ` — ${p.firma}` : "";
      lines.push(`📦 ${p.idx} — ${fmtD(p.data)} ${fmtT(p.godz)}${firmaSuffix}`);
      if (p.addr) lines.push(`   ${p.addr}`);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`   GPS: ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`);
      if (p.tel) lines.push(`   Tel: ${p.tel}`);
      // Przy kilku zleceniach na jeden wyjazd dopisujemy, ILE zostawić w tym punkcie.
      // Numeru zlecenia kierowcy nie podajemy (kopia celowo go nie zawiera) — liczy się ładunek.
      zleceniaDlaRozladunku(fracht, i + 1).forEach(z => {
        const opis = opisLadunkuZlecenia(z);
        if (opis) lines.push(`   ⬇ Zostawić: ${opis}`);
      });
      lines.push("");
    });
  }

  // TOWAR
  // Przy kilku zleceniach pola `towarIloscPalet` i `wagaLadunku` frachtu pochodzą z PIERWSZEGO
  // zlecenia (tak je wypełnia parser), więc pokazywałyby kierowcy część ładunku jako całość —
  // np. 1063 kg, gdy w aucie jedzie 1763 kg. Gdy zlecenia niosą własne liczby, sumujemy je.
  const lista = zleceniaFrachtu(fracht);
  const wielo = Array.isArray(fracht?.zlecenia) && fracht.zlecenia.length > 1;
  const suma = (pole) => lista.reduce((s, z) => s + (parseFloat(String(z?.[pole] ?? "").replace(",", ".")) || 0), 0);
  const sumaPalet = wielo ? suma("palety") : 0;
  const sumaWagi = wielo ? suma("waga") : 0;

  const towarLines = [];
  const ilosc = sumaPalet || fracht.towarIloscPalet;
  if (ilosc || fracht.towarOpis) {
    towarLines.push([ilosc, fracht.towarOpis].filter(Boolean).join(" × ") || fracht.towarOpis || `${ilosc} sztuk`);
  }
  if (fracht.towarPalety && !wielo) towarLines.push(`Palety: ${fracht.towarPalety}`);
  const waga = sumaWagi || fracht.wagaLadunku;
  if (waga) towarLines.push(`Waga: ${waga} kg${wielo && sumaWagi ? " (razem)" : ""}`);
  if (fracht.zaladunekTyp) towarLines.push(`Załadunek: ${fracht.zaladunekTyp}`);
  if (towarLines.length) {
    lines.push("🧰 TOWAR");
    towarLines.forEach(t => lines.push(`   ${t}`));
    lines.push("");
  }

  const uwagiCzyste = bezKwot(fracht.uwagi);
  if (uwagiCzyste) {
    lines.push("📋 UWAGI");
    lines.push(`   ${uwagiCzyste}`);
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── formatOrderForWhatsapp ──
// Format dla wysyłki do kierowcy przez WhatsApp Cloud API. Zwraca obiekt z
// `body` (treść tekstowa, sygnowana dyspozytorem) + `pickup`/`delivery`
// (pinezki GPS). 4 wiadomości w sumie (text + 2 pinezki + opcjonalny system reminder).
//
// UWAGA: WhatsApp template wymaga zatwierdzenia przez Meta, więc body nie ma
// emoji w nagłówku (bezpieczne dla Cloud API).
export function formatOrderForWhatsapp(fracht) {
  if (!fracht) return { body: "", pickup: null, delivery: null };
  const fmtD = (d) => d ? d.split("-").reverse().join(".") : "—";
  const fmtT = (t) => t || "—";
  const addrZal = (fracht.zaladunekAdres || [fracht.zaladunekKod, fracht.zaladunekKod2, fracht.zaladunekKod3].filter(Boolean).join(" / ") || "").trim();
  const addrRoz = (fracht.rozladunekAdres || allDokody(fracht).join(" / ") || "").trim();
  const pickupGeo = parseGeoString(fracht.zaladunekGeo);
  const deliveryGeo = parseGeoString(fracht.rozladunekGeo);

  const lines = [];
  lines.push(`🚛 Nowe zlecenie${fracht.nrRef ? ` #${fracht.nrRef}` : ""}`);
  lines.push("");
  lines.push(`📍 ZAŁADUNEK — ${fmtD(fracht.dataZaladunku)} ${fmtT(fracht.godzZaladunku)}`);
  if (addrZal) lines.push(addrZal);
  if (pickupGeo) lines.push(`GPS: ${pickupGeo.lat.toFixed(5)}, ${pickupGeo.lng.toFixed(5)}`);
  if (fracht.zaladunekTelefon) lines.push(`Tel: ${fracht.zaladunekTelefon}`);
  lines.push("");
  // Rozładunki R1..R5 — kierowca musi widzieć wszystkie stopy, nie tylko pierwszy.
  // Pinezka `delivery` zostaje na R1 (następny cel nawigacji); kolejne stopy mają GPS w treści.
  const rozStops = unloadStops(fracht);
  const multi = rozStops.length > 1;
  (rozStops.length ? rozStops : [{ i: 1, addr: addrRoz, geo: fracht.rozladunekGeo, tel: fracht.rozladunekTelefon, data: fracht.dataRozladunku, godz: fracht.godzRozladunku, firma: fracht.rozladunekFirma }])
    .forEach(p => {
      const naglowek = multi ? `📍 ROZŁADUNEK ${p.i}/${rozStops.length}` : "📍 ROZŁADUNEK";
      lines.push(`${naglowek} — ${fmtD(p.data)} ${fmtT(p.godz)}${p.firma ? ` — ${p.firma}` : ""}`);
      if (p.addr) lines.push(p.addr);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`GPS: ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`);
      if (p.tel) lines.push(`Tel: ${p.tel}`);
      lines.push("");
    });

  const towarParts = [];
  if (fracht.towarIloscPalet) towarParts.push(`${fracht.towarIloscPalet} ${fracht.towarOpis || "palet"}`);
  else if (fracht.towarOpis) towarParts.push(fracht.towarOpis);
  if (fracht.towarPalety) towarParts.push(fracht.towarPalety);
  if (towarParts.length) lines.push(`📦 ${towarParts.join(", ")}`);
  if (fracht.zaladunekTyp) lines.push(`Załadunek: ${fracht.zaladunekTyp}`);
  if (fracht.wagaLadunku) lines.push(`Waga: ${fracht.wagaLadunku} kg`);
  const uwagiWa = bezKwot(fracht.uwagi);
  if (uwagiWa) { lines.push(""); lines.push(`ℹ️ ${uwagiWa}`); }

  return {
    body: lines.join("\n").trim(),
    pickup: pickupGeo ? { ...pickupGeo, name: "Załadunek", address: addrZal || null } : null,
    delivery: deliveryGeo ? { ...deliveryGeo, name: "Rozładunek", address: addrRoz || null } : null,
  };
}

// ── punktyTrasyZFrachtu ──
// Punkty trasy do Kalkulatora tras: załadunki Z1/Z2 + rozładunki R1..R5, w kolejności.
// `geo` (lat,lon) wygrywa nad adresem; bez geo zostaje tekst do geokodowania.
export function punktyTrasyZFrachtu(f) {
  if (!f) return [];
  const out = [];
  const dodaj = (label, adres, kod, miasto, geo) => {
    const g = parseGeoString(geo);
    const tekst = [adres, kod, miasto].filter(Boolean).join(", ");
    if (!g && !tekst) return;
    out.push({
      label: `${label}: ${tekst || `${g.lat}, ${g.lng}`}`,
      lat: g?.lat ?? null, lon: g?.lng ?? null,
      szukaj: tekst, adres, kod, miasto,
    });
  };
  dodaj("Załadunek", f.zaladunekAdres, f.zaladunekKodPocztowy, f.zaladunekMiasto, f.zaladunekGeo);
  dodaj("Załadunek 2", f.zaladunekAdres2, f.zaladunekKodPocztowy2, f.zaladunekMiasto2, f.zaladunekGeo2);
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    dodaj(`Rozładunek${sfx ? " " + sfx : ""}`, f[`rozladunekAdres${sfx}`], f[`dokodPocztowy${sfx}`], f[`dokodMiasto${sfx}`], f[`rozladunekGeo${sfx}`]);
  }
  return out;
}
