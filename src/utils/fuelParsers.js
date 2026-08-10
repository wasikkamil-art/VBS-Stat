// Parsery raportów kart paliwowych (Eurowag / E100 / Andamur) — CZYSTA LOGIKA.
//
// Wydzielone z PaliwoTab.jsx świadomie: zero importów Firebase/React, więc da się to
// odpalić w node i przetestować na prawdziwych plikach (patrz diagnose_paliwo_parsers.mjs).
// To najbardziej wrażliwa część modułu paliwa — błąd w parserze = błędne litry i spalanie.
//
// Wejście każdego parsera: arkusz jako tablica tablic (AoA) — tak jak zwraca
// XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }).
// Wyjście: surowe transakcje; FX/dopasowanie do floty robi już komponent.

export const CARDS = {
  eurowag: { name: "Eurowag", color: "#2563eb" },
  e100:    { name: "E100",    color: "#16a34a" },
  andamur: { name: "Andamur", color: "#ea580c" },
};

// VAT per kraj — brutto→netto tam, gdzie raport nie podaje netto (E100, Andamur).
// Zgodne z ZASADY-VBS-STAT.md.
export const VAT = {
  PL: 0.23, DE: 0.19, FR: 0.20, ES: 0.21, CZ: 0.21, BE: 0.21, LU: 0.17, AT: 0.20,
  IT: 0.22, HU: 0.27, RO: 0.19, BG: 0.20, PT: 0.23, NL: 0.21, SK: 0.20, SI: 0.22,
  CH: 0.081, DK: 0.25, SE: 0.25, LT: 0.21, LV: 0.21, EE: 0.22, HR: 0.25,
};

export const FLAG = {
  PL: "🇵🇱", DE: "🇩🇪", FR: "🇫🇷", ES: "🇪🇸", CZ: "🇨🇿", BE: "🇧🇪", LU: "🇱🇺", AT: "🇦🇹",
  IT: "🇮🇹", HU: "🇭🇺", RO: "🇷🇴", BG: "🇧🇬", PT: "🇵🇹", NL: "🇳🇱", SK: "🇸🇰", SI: "🇸🇮",
  CH: "🇨🇭", DK: "🇩🇰", SE: "🇸🇪", LT: "🇱🇹", LV: "🇱🇻", EE: "🇪🇪", HR: "🇭🇷",
};

// Rejestracje poza flotą (prywatne / na okaziciela / benzynowe / przyczepa).
export const SKIP_PLATE = /^(OKAZICIEL|TRUCK|UNIVERSAL|TK760AP)/i;

export const norm = s => String(s || "").replace(/\s+/g, "").toUpperCase();

// ── Produkt z opisu artykułu/usługi. Benzyna i opłaty odrzucane. ──
export function productOf(text) {
  const t = String(text || "").toLowerCase();
  if (t.includes("adblue") || t.includes("adblu")) return "adblue";
  if (t.includes("benzyn") || t.includes("ba 95") || t.includes("95 e10")) return "benzyna";
  if (t.includes("diesel") || t.includes("napedow") || t.includes("napędow") || t.trim() === "on") return "on";
  return "inne";
}

const cell = (row, i) => (row && i >= 0 && row[i] !== undefined ? row[i] : "");

export const numOf = v => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
};

// Data z komórki: XLSX z cellDates daje Date, CSV/JSON może dać "31.03.2026 21:49:42"
// albo "2026-06-30 22:15:11". Zwraca ISO "YYYY-MM-DDTHH:mm" (czas lokalny) albo null.
export function tsOf(v) {
  let d = null;
  if (v instanceof Date && !isNaN(v)) d = v;
  else {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T]?(\d{2})?:?(\d{2})?/);
    if (m) d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    else {
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?/);
      if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    }
  }
  if (!d || isNaN(d)) return null;
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Indeks kolumny po fragmencie nagłówka
const colIdx = (hdr, ...frags) => hdr.findIndex(h => {
  const s = String(h || "").toLowerCase();
  return frags.some(f => s.includes(f));
});

export function parseEurowag(aoa) {
  const hi = aoa.findIndex(r => r.some(c => String(c).toLowerCase().includes("tablica rejestracyjna")));
  if (hi < 0) return [];
  const h = aoa[hi];
  const I = {
    usluga: colIdx(h, "usługa", "usluga"), ts: colIdx(h, "data i godzina"),
    plate: colIdx(h, "tablica"), art: colIdx(h, "artykuł", "artykul"),
    net: colIdx(h, "kwota netto"), gross: colIdx(h, "kwota brutto"),
    cur: colIdx(h, "waluta"), qty: colIdx(h, "ilość", "ilosc"),
    country: colIdx(h, "kraj"), loc: colIdx(h, "lokalizacja"),
  };
  const out = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r || !r.length) continue;
    if (String(cell(r, I.usluga)).toUpperCase() !== "FUEL") continue;    // OTHER = opłata za kartę
    const product = productOf(cell(r, I.art));
    if (product !== "on" && product !== "adblue") continue;
    const liters = numOf(cell(r, I.qty)), net = numOf(cell(r, I.net));
    const ts = tsOf(cell(r, I.ts));
    if (!liters || net == null || !ts) continue;
    out.push({
      card: "eurowag", plateRaw: cell(r, I.plate), ts, product, liters: Math.abs(liters),
      country: String(cell(r, I.country) || "").toUpperCase().slice(0, 2),
      station: String(cell(r, I.loc) || "").trim(), address: "",
      currency: String(cell(r, I.cur) || "EUR").toUpperCase(),
      netLocal: Math.abs(net), grossLocal: Math.abs(numOf(cell(r, I.gross)) ?? net),
    });
  }
  return out;
}

export function parseE100(aoa) {
  const hi = aoa.findIndex(r => r.some(c => String(c).toLowerCase().includes("numer samochodu")));
  if (hi < 0) return [];
  const h = aoa[hi];
  const I = {
    date: colIdx(h, "data"), time: colIdx(h, "czas"), plate: colIdx(h, "numer samochodu"),
    country: colIdx(h, "kraj"), addr: colIdx(h, "adres"), brand: colIdx(h, "brand"),
    station: colIdx(h, "stacja"), qty: colIdx(h, "ilość", "ilosc"),
    amount: colIdx(h, "kwota"), cur: colIdx(h, "waluta"), service: colIdx(h, "usługa", "usluga"),
  };
  const out = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r || !r.length) continue;
    const product = productOf(cell(r, I.service));
    if (product !== "on" && product !== "adblue") continue;
    const liters = numOf(cell(r, I.qty)), gross = numOf(cell(r, I.amount));
    const ts = tsOf(`${cell(r, I.date)} ${cell(r, I.time)}`);
    const country = String(cell(r, I.country) || "").toUpperCase().slice(0, 2);
    if (!liters || gross == null || !ts) continue;
    out.push({
      card: "e100", plateRaw: cell(r, I.plate), ts, product, liters: Math.abs(liters), country,
      station: [cell(r, I.brand), cell(r, I.station)].filter(Boolean).join(" ").trim(),
      address: String(cell(r, I.addr) || "").trim(),
      currency: String(cell(r, I.cur) || "EUR").toUpperCase(),
      grossLocal: Math.abs(gross), netLocal: Math.abs(gross) / (1 + (VAT[country] ?? 0.21)),
    });
  }
  return out;
}

// Andamur: brak kraju w raporcie → bierzemy ze słownika stacji (zasilanego geokodem),
// domyślnie ES. Kolumna „Godzina" to czas EKSPORTU pliku, NIE transakcji — świadomie jej
// NIE używamy: przy ponownym eksporcie zmieniłaby się i rozsypała klucz dedup.
export function parseAndamur(aoa, stationCountry = {}) {
  const hi = aoa.findIndex(r => r.some(c => String(c).toLowerCase().trim() === "stacja"));
  if (hi < 0) return [];
  const h = aoa[hi];
  const I = {
    station: colIdx(h, "stacja"), plate: colIdx(h, "rejestracyjny"), date: colIdx(h, "data"),
    fuel: colIdx(h, "paliwo"), qty: colIdx(h, "litry"), amount: colIdx(h, "kwota"),
  };
  const out = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r || !r.length) continue;
    const product = productOf(cell(r, I.fuel));
    if (product !== "on" && product !== "adblue") continue;
    const liters = numOf(cell(r, I.qty)), gross = numOf(cell(r, I.amount));
    const ts = tsOf(cell(r, I.date));
    if (!liters || gross == null || !ts) continue;
    const station = String(cell(r, I.station) || "").trim();
    // Kraj z cache stacji (zasilanego reverse-geokodem przy imporcie), bez sztywnego "ES".
    // Gdy nieznany → null; właściwy kraj+VAT ustawia confirmImport po geokodzie (patrz PaliwoTab).
    const country = stationCountry[station.toLowerCase()] || null;
    out.push({
      card: "andamur", plateRaw: cell(r, I.plate), ts, product, liters: Math.abs(liters),
      country, station, address: "", currency: "EUR",
      grossLocal: Math.abs(gross), netLocal: Math.abs(gross) / (1 + (VAT[country] ?? 0.21)),
    });
  }
  return out;
}

export function detectAndParse(aoa, stationCountry = {}) {
  const flat = aoa.slice(0, 12).flat().map(c => String(c).toLowerCase()).join(" | ");
  if (flat.includes("tablica rejestracyjna")) return { kind: "eurowag", rows: parseEurowag(aoa) };
  if (flat.includes("numer samochodu")) return { kind: "e100", rows: parseE100(aoa) };
  if (flat.includes("moje zużycie") || (flat.includes("stacja") && flat.includes("litry")))
    return { kind: "andamur", rows: parseAndamur(aoa, stationCountry) };
  return { kind: null, rows: [] };
}

// ── Klucz dedup: ta sama transakcja z tego samego raportu = ten sam dokument ──
export function txId(t) {
  return `${t.card}_${norm(t.plate || t.plateRaw)}_${t.ts}_${t.liters}_${Math.round(t.grossLocal * 100)}`
    .replace(/[/.#$[\]]/g, "-");
}

// ══════════════════════════════════════════════════════════════════
// GEOKOD — kandydaci zapytań do Nominatim (od najbardziej precyzyjnego)
// ══════════════════════════════════════════════════════════════════
const BRANDS = ["eurowag", "tp24", "andamur", "orlen", "shell", "avia", "repsol", "mol", "omv",
  "total", "esso", "agip", "eni", "bp", "q8", "circle k", "lukoil", "galp", "prio", "moya", "gexa"];

export function stationQueries(t) {
  const out = [];
  if (t.address) {
    const a = t.address.replace(/\s+/g, " ").trim().replace(/,+$/, "");
    out.push(a, a.split(",")[0]);
  }
  let s = t.station || "";
  if (s.includes(" - ")) s = s.split(" - ").slice(1).join(" - ");       // "Eurowag - Gorzyczki"
  s = s.replace(new RegExp(`\\b(${BRANDS.join("|")})\\b`, "gi"), " ")
       .replace(/\b[A-Z]{2}\d{2,6}\b/g, " ")                           // kody stacji E100
       .replace(/\b(I{1,3}|IV)\b\s*$/i, " ")                           // "Zaragoza II"
       .replace(/[,\s]+/g, " ").trim().replace(/^[-–]|[-–]$/g, "").trim();
  if (s) out.push(s, s.split("/")[0].trim(), s.split("–")[0].trim());
  return [...new Set(out)].filter(q => q && q.length > 2);
}

export const stationKey = t => `${t.country || "XX"}__${(t.station || t.address || "").toLowerCase()}`
  .replace(/[/.#$[\]]/g, "-").slice(0, 400);
