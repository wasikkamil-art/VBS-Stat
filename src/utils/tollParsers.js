// Parsery eksportów opłat drogowych: NegoMetal (xlsx) i e-TOLL (csv).
// Czysty moduł — bez Reacta i Firebase, żeby dało się go przetestować na plikach.
// Wzorzec ten sam co fuelParsers.js: surowe wiersze → znormalizowane transakcje → dedup po txId.

export const SKIP_PLATE = /^(OKAZICIEL|TRUCK|UNIVERSAL|TK760AP)/i;

/** Rejestracja bez spacji, wielkimi literami.
 *  KONIECZNE: eksport NegoMetalu niesie dwie pisownie tego samego auta —
 *  sieci CZ Myto, NL RDW i PL A1 zwracają „WGM0507M", reszta „WGM 0507M". */
export const norm = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();

const num = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

/** Dowolny format daty z eksportów → "YYYY-MM-DDTHH:MM". Null, gdy nie da się odczytać. */
export function tsOf(v) {
  let d = null;
  if (v instanceof Date && !isNaN(v)) d = v;
  else if (typeof v === "number" && v > 20000 && v < 80000) {
    // numer seryjny Excela (dni od 1899-12-30) — tak NegoMetal zwraca daty
    d = new Date(Math.round((v - 25569) * 86400000));
  } else {
    const s = String(v ?? "").trim();
    let m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T]?(\d{2})?:?(\d{2})?/);          // 31.08.2026 16:50
    if (m) d = new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    else {
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2})?:?(\d{2})?/);              // 2026-08-31 16:50
      if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    }
  }
  if (!d || isNaN(d)) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const colIdx = (hdr, ...frags) => hdr.findIndex(h => {
  const s = String(h || "").toLowerCase();
  return frags.some(f => s.includes(f));
});
const cell = (row, i) => (i >= 0 && row ? row[i] : "");

/**
 * NegoMetal — eksport transakcji z portalu (xlsx).
 * Pierwsze wiersze to podsumowania per auto i waluta (kolumna Network pusta) — pomijamy,
 * bo inaczej policzylibyśmy każdą kwotę dwa razy.
 */
export function parseNego(aoa) {
  const hi = aoa.findIndex(r => r.some(c => String(c).toLowerCase().includes("numberplate")));
  if (hi < 0) return [];
  const h = aoa[hi];
  const I = {
    plate: colIdx(h, "numberplate"), net: colIdx(h, "network"),
    inGate: colIdx(h, "entrance gate"), outGate: colIdx(h, "exit gate"),
    inDay: colIdx(h, "entrance day"), outDay: colIdx(h, "exit day"),
    cur: colIdx(h, "currency"), amt: colIdx(h, "amount"),
    dev: colIdx(h, "device id"),
  };
  const out = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r || !r.length) continue;
    const network = String(cell(r, I.net) || "").trim();
    if (!network || network === "None") continue;                    // wiersz podsumowania
    const ts = tsOf(cell(r, I.inDay)) || tsOf(cell(r, I.outDay));
    const amount = num(cell(r, I.amt));
    if (!ts || amount == null) continue;
    const [cc, siec] = network.split("|").map(s => s.trim());
    out.push({
      source: "nego",
      plateRaw: String(cell(r, I.plate) || "").trim(),
      plate: norm(cell(r, I.plate)),
      ts, day: ts.slice(0, 10), month: ts.slice(0, 7),
      country: String(cc || "").toUpperCase().slice(0, 2),
      network: siec || network,
      section: [cell(r, I.inGate), cell(r, I.outGate)].map(x => String(x || "").trim()).filter(Boolean).join(" → "),
      km: null,
      currency: String(cell(r, I.cur) || "EUR").toUpperCase(),
      amountLocal: Math.abs(amount),
      unpaidLocal: 0,
      deviceId: String(cell(r, I.dev) || "").trim(),
    });
  }
  return out;
}

/**
 * e-TOLL — eksport „historia przejazdy" (csv, separator średnik, liczby z przecinkiem).
 * Kwota NALEŻNA jest podstawą, nie uiszczona: nieuiszczone rozlicza VAT-Polska,
 * więc koszt i tak nas obciąża (ustalenie z 2026-09-15).
 */
export function parseEtoll(aoa) {
  const hi = aoa.findIndex(r => r.some(c => String(c).toLowerCase().includes("odcinek płatny")));
  if (hi < 0) return [];
  const h = aoa[hi];
  const I = {
    ts: colIdx(h, "data przejazdu"), sec: colIdx(h, "odcinek"),
    typ: colIdx(h, "typ transakcji"), plate: colIdx(h, "numer rejestracyjny"),
    km: colIdx(h, "dystans"), nalezna: colIdx(h, "należna", "nalezna"),
    nieuiszcz: colIdx(h, "nieuiszczona"), dev: colIdx(h, "id biznesowe"),
  };
  const out = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i]; if (!r || !r.length) continue;
    const ts = tsOf(cell(r, I.ts));
    const amount = num(cell(r, I.nalezna));
    if (!ts || amount == null) continue;
    out.push({
      source: "etoll",
      plateRaw: String(cell(r, I.plate) || "").trim(),
      plate: norm(cell(r, I.plate)),
      ts, day: ts.slice(0, 10), month: ts.slice(0, 7),
      country: "PL",
      network: "e-TOLL",
      section: String(cell(r, I.sec) || "").trim(),
      km: num(cell(r, I.km)) ?? null,
      currency: "PLN",
      amountLocal: Math.abs(amount),
      unpaidLocal: Math.abs(num(cell(r, I.nieuiszcz)) ?? 0),
      deviceId: String(cell(r, I.dev) || "").trim(),
    });
  }
  return out;
}

/** Identyfikator transakcji — ponowny import tego samego pliku nie tworzy duplikatów. */
export function txId(t) {
  const base = [t.source, t.plate, t.ts, t.country, t.network, Math.round(t.amountLocal * 100), t.currency]
    .join("|").replace(/[^A-Za-z0-9|+.\-_]/g, "_");
  // Firestore: id dokumentu do 1500 bajtów, ale trzymamy krótko i stabilnie
  return base.slice(0, 180);
}

/** Rozpoznaje rodzaj pliku i parsuje. `aoa` = wiersze z XLSX/CSV. */
export function detectAndParse(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) return { kind: null, rows: [] };
  const plaskie = aoa.slice(0, 15).map(r => (r || []).join(" ").toLowerCase()).join(" ");
  if (plaskie.includes("numberplate") && plaskie.includes("network")) {
    return { kind: "nego", rows: parseNego(aoa) };
  }
  if (plaskie.includes("odcinek płatny") || plaskie.includes("kwota należna")) {
    return { kind: "etoll", rows: parseEtoll(aoa) };
  }
  return { kind: null, rows: [] };
}

/** CSV z średnikiem i cudzysłowami → wiersze. XLSX myli się na tym formacie, więc czytamy sami. */
export function csvToAoa(text) {
  const czysty = String(text || "").replace(/^﻿/, "");
  return czysty.trim().split(/\r?\n/).map(linia => {
    const pola = []; let biezace = "", wCudzyslowie = false;
    for (let i = 0; i < linia.length; i++) {
      const z = linia[i];
      if (z === '"') { if (wCudzyslowie && linia[i + 1] === '"') { biezace += '"'; i++; } else wCudzyslowie = !wCudzyslowie; }
      else if (z === ";" && !wCudzyslowie) { pola.push(biezace); biezace = ""; }
      else biezace += z;
    }
    pola.push(biezace);
    return pola;
  });
}

export const KRAJ = {
  DE: "Niemcy", FR: "Francja", ES: "Hiszpania", PL: "Polska", BE: "Belgia", NL: "Holandia",
  AT: "Austria", CZ: "Czechy", CH: "Szwajcaria", IT: "Włochy", PT: "Portugalia",
  LU: "Luksemburg", HU: "Węgry", SK: "Słowacja", SI: "Słowenia", HR: "Chorwacja",
  RS: "Serbia", BG: "Bułgaria", RO: "Rumunia", DK: "Dania",
};
