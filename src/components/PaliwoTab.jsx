// PaliwoTab — monitoring paliwa floty: co, gdzie, jaką kartą i za ile tankowali kierowcy.
//
// ŹRÓDŁO PRAWDY = RAPORTY KART PALIWOWYCH (Eurowag / E100 / Andamur). Paliwa NIE bierzemy
// z CAN pojazdu (decyzja 2026-07-24: czujnik bez kalibracji, niespójne jednostki między
// urządzeniami) — z Atlasa pochodzą wyłącznie km (kolekcja vehicleKmMonthly, CF
// monthlyOdometerSnapshot). Litry = dokument księgowy, km = licznik.
//
// Co robi:
//   1. IMPORT — user wrzuca 3 pliki miesięczne, parser rozpoznaje format po nagłówkach,
//      normalizuje (netto! FX przez NBP z dnia transakcji), deduplikuje i zapisuje do
//      fuelTransactions/{YYYY-MM}/tx/{id}. Ponowny import tego samego pliku = 0 nowych.
//   2. GEOKOD — raporty nie mają współrzędnych; nazwa stacji/adres → Nominatim, cache
//      w kolekcji fuelStations (każda stacja pytana raz w życiu, ~1 req/s).
//   3. WIDOK — panel (KPI, wnioski, ceny per kraj, spalanie) + mapa Leaflet z pinami.
//
// Wydzielone jako osobny lazy chunk — NIE puchnie App.jsx.

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { logAction } from "../utils/logAction";
import {
  CARDS, FLAG, SKIP_PLATE, norm, detectAndParse, txId, stationQueries, stationKey,
} from "../utils/fuelParsers";

const eur = n => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const p3 = n => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const litr = n => Math.round(Number(n) || 0).toLocaleString("pl-PL") + " L";

// ══════════════════════════════════════════════════════════════════
// NBP — kurs z dnia transakcji (dzień wolny → cofnij max 5 dni wstecz).
// Cache w pamięci; PLN = 1. Konwersja: netEUR = netLocal * rate(cur) / rate(EUR).
// ══════════════════════════════════════════════════════════════════
const fxCache = new Map();

async function nbpRate(code, isoDate) {
  const cur = String(code || "PLN").toUpperCase();
  if (cur === "PLN") return 1;
  const key = `${cur}|${isoDate}`;
  if (fxCache.has(key)) return fxCache.get(key);
  let d = new Date(isoDate + "T12:00:00Z");
  for (let i = 0; i < 6; i++) {
    const ds = d.toISOString().slice(0, 10);
    try {
      const r = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${cur.toLowerCase()}/${ds}/?format=json`);
      if (r.ok) {
        const j = await r.json();
        const mid = j?.rates?.[0]?.mid;
        if (mid) { fxCache.set(key, mid); return mid; }
      }
    } catch { /* sieć — próbujemy dzień wcześniej */ }
    d = new Date(d.getTime() - 86400000);
  }
  fxCache.set(key, null);
  return null;
}

// ══════════════════════════════════════════════════════════════════
// GEOKOD stacji (Nominatim) z trwałym cache w kolekcji fuelStations.
// ══════════════════════════════════════════════════════════════════
async function geocodeStations(txs, onProgress) {
  const uniq = new Map();
  for (const t of txs) if (!uniq.has(stationKey(t))) uniq.set(stationKey(t), t);
  const result = new Map();
  let done = 0;
  for (const [key, t] of uniq) {
    const ref = doc(db, "fuelStations", key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      result.set(key, snap.data());
    } else {
      let found = null;
      for (const q of stationQueries(t)) {
        try {
          const cc = t.country ? `&countrycodes=${t.country.toLowerCase()}` : "";
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}${cc}`);
          const j = await r.json();
          if (j?.[0]) {
            found = { lat: +j[0].lat, lng: +j[0].lon, query: q, match: String(j[0].display_name || "").slice(0, 120) };
            break;
          }
        } catch { /* następny kandydat */ }
        await new Promise(res => setTimeout(res, 1100));               // limit Nominatim: 1 req/s
      }
      const payload = found || { lat: null, lng: null, failed: true, station: t.station || t.address || "" };
      await setDoc(ref, { ...payload, country: t.country || null, updatedAt: new Date().toISOString() }, { merge: true });
      result.set(key, payload);
      if (found) await new Promise(res => setTimeout(res, 1100));
    }
    done++;
    onProgress?.(done, uniq.size);
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════
// KOMPONENT
// ══════════════════════════════════════════════════════════════════
// Jeden wiersz filtra: podpis wymiaru po lewej, kontrolki po prawej. Osobne wiersze
// (z separatorem) zamiast wszystkiego w jednym rzędzie — auto ≠ karta ≠ produkt ≠ kraj.
function FilterRow({ label, action, children }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold">{label}</span>
        {action || null}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export default function PaliwoTab({ vehicles = [], canEdit = false, showToast = () => {}, currentUser }) {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [txs, setTxs] = useState([]);
  const [kmMonthly, setKmMonthly] = useState({});
  const [loading, setLoading] = useState(true);

  const [showImport, setShowImport] = useState(false);
  const [importState, setImportState] = useState(null);   // {files, rows, dupes, phase, progress}

  const [fCars, setFCars] = useState(new Set());
  const [fCards, setFCards] = useState(new Set(Object.keys(CARDS)));
  const [product, setProduct] = useState("on");
  const [country, setCountry] = useState("all");
  const [labelMode, setLabelMode] = useState("price");
  const [kmEdit, setKmEdit] = useState({});

  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);

  const activeVehicles = useMemo(() => vehicles.filter(v => !v.archived), [vehicles]);
  const plateOf = id => activeVehicles.find(v => v.id === id)?.plate || vehicles.find(v => v.id === id)?.plate || id;

  // ── Lista miesięcy ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "fuelTransactions"));
        const ms = snap.docs.map(d => d.id).sort().reverse();
        setMonths(ms);
        setMonth(prev => prev || ms[0] || "");
      } catch (e) { console.warn("[Paliwo] months:", e); }
      setLoading(false);
    })();
  }, []);

  // ── Transakcje + km wybranego miesiąca ──
  useEffect(() => {
    if (!month) { setTxs([]); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "fuelTransactions", month, "tx"));
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const kmDoc = await getDoc(doc(db, "vehicleKmMonthly", month));
        if (!alive) return;
        setTxs(rows);
        setKmMonthly(kmDoc.exists() ? (kmDoc.data().vehicles || {}) : {});
        setFCars(new Set([...new Set(rows.map(r => r.vehicleId))].filter(Boolean)));
      } catch (e) {
        console.warn("[Paliwo] load:", e);
        showToast("❌ Nie udało się wczytać danych paliwa");
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtrowanie ──
  const filtered = useMemo(() => txs.filter(t =>
    (fCars.size === 0 || fCars.has(t.vehicleId)) &&
    fCards.has(t.card) && t.product === product &&
    (country === "all" || t.country === country)
  ), [txs, fCars, fCards, product, country]);

  const totals = useMemo(() => {
    const l = filtered.reduce((s, t) => s + (t.liters || 0), 0);
    const e = filtered.reduce((s, t) => s + (t.netEUR || 0), 0);
    return { l, e, n: filtered.length, avg: l ? e / l : 0 };
  }, [filtered]);

  const byCountry = useMemo(() => {
    const m = {};
    for (const t of filtered) {
      const o = m[t.country] = m[t.country] || { l: 0, e: 0, n: 0 };
      o.l += t.liters; o.e += t.netEUR; o.n++;
    }
    return Object.entries(m).map(([cc, o]) => ({ cc, ...o, p: o.l ? o.e / o.l : 0 }))
      .sort((a, b) => b.l - a.l);
  }, [filtered]);

  const byVehicle = useMemo(() => {
    const m = {};
    for (const t of filtered) {
      const o = m[t.vehicleId] = m[t.vehicleId] || { l: 0, e: 0, n: 0 };
      o.l += t.liters; o.e += t.netEUR; o.n++;
    }
    return Object.entries(m).map(([vid, o]) => {
      const kmRec = kmMonthly[vid];
      const km = kmRec?.km || null;
      return { vid, ...o, km, kmSource: kmRec?.source || null,
        l100: km ? o.l / km * 100 : null, eurKm: km ? o.e / km : null };
    }).sort((a, b) => b.l - a.l);
  }, [filtered, kmMonthly]);

  // ── Wnioski (te same reguły co w makiecie, liczone z danych) ──
  const insights = useMemo(() => {
    const out = [];
    if (!filtered.length) return out;
    const big = byCountry.filter(c => c.l >= 100).sort((a, b) => a.p - b.p);
    if (big.length > 1) {
      const cheap = big[0];
      const ranked = big.map(c => ({ ...c, imp: c.l * (c.p - cheap.p) })).sort((a, b) => b.imp - a.imp);
      const top = ranked[0];
      if (top.imp > 0) {
        out.push(["🔴", `Największa dźwignia: <b>${top.cc}</b> — ${litr(top.l)} po <b>${p3(top.p)} €/L</b> `
          + `(${Math.round(top.l / totals.l * 100)}% litrów), o ${p3(top.p - cheap.p)} €/L drożej niż najtańszy `
          + `<b>${cheap.cc} ${p3(cheap.p)}</b>. Nadpłata vs ${cheap.cc}: <b>${eur(top.imp)}</b>.`]);
        const move = Math.min(300, Math.round(top.l * 0.25));
        out.push(["💡", `Gdyby <b>${move} L</b> z ${top.cc} udało się zatankować w ${cheap.cc} — `
          + `<b>−${eur(move * (top.p - cheap.p))}</b> na tej samej ilości paliwa.`]);
      }
    }
    // karta droższa od alternatywy w tym samym kraju
    const perCC = {};
    for (const t of filtered) {
      const c = perCC[t.country] = perCC[t.country] || {};
      const o = c[t.card] = c[t.card] || { l: 0, e: 0 };
      o.l += t.liters; o.e += t.netEUR;
    }
    let best = null;
    for (const [cc, cards] of Object.entries(perCC)) {
      const arr = Object.entries(cards).filter(([, o]) => o.l >= 40)
        .map(([k, o]) => ({ k, p: o.e / o.l, l: o.l })).sort((a, b) => a.p - b.p);
      if (arr.length < 2) continue;
      const gain = (arr[arr.length - 1].p - arr[0].p) * arr[arr.length - 1].l;
      if (!best || gain > best.gain) best = { cc, cheap: arr[0], exp: arr[arr.length - 1], gain };
    }
    if (best) out.push(["💳", `W <b>${best.cc}</b> karta <b>${CARDS[best.exp.k].name}</b> jest droższa od `
      + `<b>${CARDS[best.cheap.k].name}</b> o ${p3(best.exp.p - best.cheap.p)} €/L — na ${litr(best.exp.l)} `
      + `to <b>${eur(best.gain)}</b> różnicy.`]);
    // najgorsze pojedyncze tankowanie względem średniej kraju
    const ccAvg = Object.fromEntries(byCountry.map(c => [c.cc, c.p]));
    const dev = filtered.map(t => ({ t, d: (t.pricePerLNet || 0) - (ccAvg[t.country] || 0) }))
      .sort((a, b) => b.d - a.d)[0];
    if (dev && dev.d > 0.05) out.push(["⚠️", `Najgorsze tankowanie: <b>${dev.t.ts.slice(8, 10)}.${dev.t.ts.slice(5, 7)}</b> `
      + `${dev.t.plate}, ${dev.t.station} (${dev.t.country}) — ${p3(dev.t.pricePerLNet)} €/L, o <b>+${p3(dev.d)}</b> `
      + `powyżej średniej kraju. Koszt odchyłki: ${eur(dev.d * dev.t.liters)}.`]);
    // spalanie — kto odstaje (vs ŚREDNIA POZOSTAŁYCH, nie vs minimum)
    if (product === "on" && country === "all") {
      const sp = byVehicle.filter(v => v.l100).sort((a, b) => b.l100 - a.l100);
      if (sp.length > 1) {
        const w = sp[0], rest = sp.slice(1);
        const avg = rest.reduce((a, x) => a + x.l100, 0) / rest.length;
        if (w.l100 > avg) {
          const over = (w.l100 - avg) / 100 * w.km;
          out.push(["⛽", `Spalanie: <b>${plateOf(w.vid)} ${w.l100.toFixed(1)} L/100</b> vs średnia pozostałych `
            + `${avg.toFixed(1)} (${rest.map(x => `${plateOf(x.vid)} ${x.l100.toFixed(1)}`).join(" · ")}). `
            + `Nadwyżka na jego ${Math.round(w.km).toLocaleString("pl-PL")} km: `
            + `<b>${Math.round(over)} L ≈ ${eur(over * (w.e / w.l))}</b>.`]);
        }
      }
      const noKm = byVehicle.filter(v => !v.km);
      if (noKm.length) out.push(["📐", `Brak km za ten miesiąc: ${noKm.map(v => plateOf(v.vid)).join(", ")} — `
        + `spalanie nieliczone. Wpisz km z raportu w tabeli poniżej.`]);
      const ad = txs.filter(t => t.product === "adblue" && (fCars.size === 0 || fCars.has(t.vehicleId)));
      if (ad.length) {
        const al = ad.reduce((s, t) => s + t.liters, 0), ae = ad.reduce((s, t) => s + t.netEUR, 0);
        out.push(["🧪", `AdBlue osobno: <b>${litr(al)}</b> za ${eur(ae)} (${p3(ae / al)} €/L), ${ad.length} transakcji `
          + `— ${(al / totals.l * 100).toFixed(1)}% litrów diesla.`]);
      }
    }
    return out;
  }, [filtered, byCountry, byVehicle, totals, product, country, txs, fCars]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════════════
  // MAPA
  // ══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || mapObj.current) return;
    const m = L.map(mapRef.current, { zoomControl: true }).setView([48.5, 8], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: "© OpenStreetMap · CARTO", maxZoom: 19 }).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    m.on("zoomend", () => {
      const el = mapRef.current;
      if (el) el.classList.toggle("paliwo-nolbl", m.getZoom() < 6);
    });
    mapObj.current = m;
    setTimeout(() => m.invalidateSize(), 120);
    return () => { try { m.remove(); } catch { /* noop */ } mapObj.current = null; };
  }, []);

  useEffect(() => {
    const L = window.L, m = mapObj.current, layer = layerRef.current;
    if (!L || !m || !layer) return;
    layer.clearLayers();
    const pts = filtered.filter(t => t.lat && t.lng);
    const jitter = {};
    for (const t of pts) {
      const k = `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
      const n = (jitter[k] = (jitter[k] || 0) + 1) - 1;
      const lat = t.lat + (n ? 0.035 * Math.cos(n * 2.2) : 0);
      const lng = t.lng + (n ? 0.05 * Math.sin(n * 2.2) : 0);
      const color = CARDS[t.card]?.color || "#666";
      const mk = L.circleMarker([lat, lng], {
        radius: 5 + Math.sqrt(t.liters) * 0.9, color: "#fff", weight: 1.5,
        fillColor: color, fillOpacity: 0.82,
      }).addTo(layer);
      mk.bindPopup(
        `<div style="font:13px/1.5 -apple-system,sans-serif;min-width:190px">`
        + `<div style="font-weight:600;margin-bottom:4px">${t.station || "—"}</div>`
        + `<table style="font-size:12.5px;width:100%">`
        + `<tr><td style="color:#6e6e73">Data</td><td style="text-align:right">${String(t.ts).replace("T", " ")}</td></tr>`
        + `<tr><td style="color:#6e6e73">Auto</td><td style="text-align:right"><b>${t.plate}</b></td></tr>`
        + `<tr><td style="color:#6e6e73">Karta</td><td style="text-align:right">${CARDS[t.card]?.name || t.card}</td></tr>`
        + `<tr><td style="color:#6e6e73">Produkt</td><td style="text-align:right">${t.product === "on" ? "Diesel" : "AdBlue"}</td></tr>`
        + `<tr><td style="color:#6e6e73">Litry</td><td style="text-align:right"><b>${String(t.liters).replace(".", ",")} L</b></td></tr>`
        + `<tr><td style="color:#6e6e73">Cena netto</td><td style="text-align:right"><b>${p3(t.pricePerLNet)} €/L</b></td></tr>`
        + `<tr><td style="color:#6e6e73">Kwota netto</td><td style="text-align:right">${eur(t.netEUR)}</td></tr>`
        + `<tr><td style="color:#6e6e73">Zapłacono</td><td style="text-align:right">${String(t.grossLocal).replace(".", ",")} ${t.currency} brutto</td></tr>`
        + `<tr><td style="color:#6e6e73">Kraj</td><td style="text-align:right">${FLAG[t.country] || ""} ${t.country}</td></tr>`
        + `</table></div>`);
      if (labelMode !== "none") {
        const txt = labelMode === "price" ? p3(t.pricePerLNet) : `${Math.round(t.liters)} L`;
        mk.bindTooltip(
          `<span style="background:#fff;border:1.5px solid ${color};border-radius:8px;padding:1px 5px;`
          + `font:600 11px/1.5 -apple-system,sans-serif;color:#1d1d1f;white-space:nowrap;`
          + `box-shadow:0 1px 4px rgba(0,0,0,.18)">${txt}</span>`,
          { permanent: true, direction: "top", offset: [0, -4], className: "paliwo-pin" });
      }
      mk._txid = t.id;
    }
    if (pts.length) {
      try { m.fitBounds(L.latLngBounds(pts.map(t => [t.lat, t.lng])).pad(0.12)); } catch { /* noop */ }
    }
    const el = mapRef.current;
    if (el) el.classList.toggle("paliwo-nolbl", m.getZoom() < 6);
  }, [filtered, labelMode]);

  const flyTo = t => {
    const m = mapObj.current;
    if (!m || !t.lat) return;
    m.setView([t.lat, t.lng], 9);
    layerRef.current?.eachLayer(l => { if (l._txid === t.id) l.openPopup(); });
  };

  // ══════════════════════════════════════════════════════════════════
  // IMPORT
  // ══════════════════════════════════════════════════════════════════
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setImportState({ phase: "parsing", files: files.map(f => f.name) });
    try {
      const XLSX = window.XLSX || await new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = () => res(window.XLSX);
        s.onerror = () => rej(new Error("Nie udało się wczytać biblioteki XLSX"));
        document.head.appendChild(s);
      });

      // Kraje stacji Andamur znane z wcześniejszych geokodów (żeby VAT był poprawny)
      const stationCountry = {};
      try {
        const cached = await getDocs(collection(db, "fuelStations"));
        cached.forEach(d => {
          const x = d.data();
          if (x.station && x.country) stationCountry[String(x.station).toLowerCase()] = x.country;
        });
      } catch { /* brak cache = domyślne */ }

      let raw = [];
      const detected = [];
      for (const f of files) {
        const ab = await f.arrayBuffer();
        const wb = XLSX.read(ab, { type: "array", cellDates: true });
        let kind = null, rows = [];
        for (const sn of wb.SheetNames) {
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
          const r = detectAndParse(aoa, stationCountry);
          if (r.rows.length) { kind = r.kind; rows = r.rows; break; }
          if (r.kind && !kind) kind = r.kind;
        }
        detected.push({ name: f.name, kind, count: rows.length });
        raw = raw.concat(rows);
      }
      if (!raw.length) {
        setImportState({ phase: "error", detected, msg: "Nie rozpoznałem żadnych transakcji. Czy to raporty Eurowag / E100 / Andamur?" });
        return;
      }

      // Dopasowanie do floty + odrzucenie obcych rejestracji
      const skipped = [];
      let mapped = [];
      for (const t of raw) {
        const pr = norm(t.plateRaw);
        if (!pr || SKIP_PLATE.test(pr)) { skipped.push(pr || "(brak)"); continue; }
        const v = activeVehicles.find(x => norm(x.plate) && (norm(x.plate) === pr
          || pr.includes(norm(x.plate)) || norm(x.plate).includes(pr)));
        if (!v) { skipped.push(pr); continue; }
        mapped.push({ ...t, vehicleId: v.id, plate: v.plate });
      }

      // FX → netto EUR (NBP z dnia transakcji)
      setImportState({ phase: "fx", detected, total: mapped.length });
      const fxMissing = [];
      for (const t of mapped) {
        const day = t.ts.slice(0, 10);
        if (t.currency === "EUR") { t.netEUR = Math.round(t.netLocal * 100) / 100; }
        else {
          const [rc, re] = await Promise.all([nbpRate(t.currency, day), nbpRate("EUR", day)]);
          if (!rc || !re) { fxMissing.push(`${t.currency} ${day}`); t.netEUR = null; }
          else t.netEUR = Math.round(t.netLocal * rc / re * 100) / 100;
        }
        t.netLocal = Math.round(t.netLocal * 100) / 100;
        t.grossLocal = Math.round(t.grossLocal * 100) / 100;
        t.liters = Math.round(t.liters * 100) / 100;
        t.pricePerLNet = t.netEUR && t.liters ? Math.round(t.netEUR / t.liters * 1000) / 1000 : null;
        t.month = t.ts.slice(0, 7);
        t.id = txId(t);
      }
      mapped = mapped.filter(t => t.netEUR != null);

      // Dedup względem bazy — per miesiąc, żeby nie czytać całej kolekcji
      setImportState({ phase: "dedup", detected, total: mapped.length });
      const byMonth = {};
      for (const t of mapped) (byMonth[t.month] = byMonth[t.month] || []).push(t);
      const existing = new Set();
      for (const m of Object.keys(byMonth)) {
        const snap = await getDocs(collection(db, "fuelTransactions", m, "tx"));
        snap.forEach(d => existing.add(`${m}/${d.id}`));
      }
      const fresh = mapped.filter(t => !existing.has(`${t.month}/${t.id}`));
      const dupes = mapped.length - fresh.length;

      setImportState({
        phase: "preview", detected, fresh, dupes, skipped: [...new Set(skipped)], fxMissing: [...new Set(fxMissing)],
        summary: Object.entries(byMonth).map(([m, arr]) => ({
          month: m, n: arr.length,
          liters: arr.filter(t => t.product === "on").reduce((s, t) => s + t.liters, 0),
          eur: arr.reduce((s, t) => s + (t.netEUR || 0), 0),
        })).sort((a, b) => a.month.localeCompare(b.month)),
      });
    } catch (e) {
      console.error("[Paliwo] import:", e);
      setImportState({ phase: "error", msg: e?.message || "Błąd parsowania" });
    }
  };

  const confirmImport = async () => {
    const st = importState;
    if (!st?.fresh?.length) return;
    try {
      setImportState({ ...st, phase: "geocoding", progress: [0, 0] });
      const geo = await geocodeStations(st.fresh, (d, tot) =>
        setImportState(s => ({ ...s, phase: "geocoding", progress: [d, tot] })));

      setImportState(s => ({ ...s, phase: "saving" }));
      const monthsTouched = new Set();
      for (let i = 0; i < st.fresh.length; i += 400) {
        const batch = writeBatch(db);
        for (const t of st.fresh.slice(i, i + 400)) {
          const g = geo.get(stationKey(t)) || {};
          monthsTouched.add(t.month);
          batch.set(doc(db, "fuelTransactions", t.month, "tx", t.id), {
            card: t.card, vehicleId: t.vehicleId, plate: t.plate, ts: t.ts, month: t.month,
            country: t.country || null, station: t.station || "", address: t.address || "",
            product: t.product, liters: t.liters, currency: t.currency,
            netLocal: t.netLocal, grossLocal: t.grossLocal, netEUR: t.netEUR,
            pricePerLNet: t.pricePerLNet, lat: g.lat ?? null, lng: g.lng ?? null,
            importedAt: new Date().toISOString(), importedBy: currentUser?.email || null,
          });
        }
        await batch.commit();
      }
      for (const m of monthsTouched) {
        await setDoc(doc(db, "fuelTransactions", m), { month: m, updatedAt: new Date().toISOString() }, { merge: true });
      }
      logAction("import", "fuelTransactions", { count: st.fresh.length, months: [...monthsTouched] });
      showToast(`✅ Zaimportowano ${st.fresh.length} tankowań${st.dupes ? ` (pominięto ${st.dupes} duplikatów)` : ""}`);
      setImportState(null);
      setShowImport(false);
      const ms = [...new Set([...months, ...monthsTouched])].sort().reverse();
      setMonths(ms);
      setMonth(m => (monthsTouched.has(m) ? m : [...monthsTouched].sort().reverse()[0]) || m);
      // wymuś przeładowanie widoku wybranego miesiąca
      const target = [...monthsTouched].sort().reverse()[0];
      if (target) {
        const snap = await getDocs(collection(db, "fuelTransactions", target, "tx"));
        setTxs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      console.error("[Paliwo] save:", e);
      showToast("❌ Zapis nie udał się: " + (e?.message || ""));
      setImportState(s => ({ ...s, phase: "preview" }));
    }
  };

  // ── Ręczne km z raportu panelu (źródło nadrzędne, CF tego nie nadpisze) ──
  const saveKm = async (vid) => {
    const val = parseFloat(String(kmEdit[vid] ?? "").replace(",", "."));
    if (!isFinite(val) || val <= 0) { showToast("❌ Podaj km jako liczbę"); return; }
    try {
      const cur = (await getDoc(doc(db, "vehicleKmMonthly", month))).data() || {};
      const vs = { ...(cur.vehicles || {}) };
      vs[vid] = { ...(vs[vid] || {}), km: Math.round(val * 100) / 100, plate: plateOf(vid),
        source: "report", note: "wpisane ręcznie z raportu panelu", updatedBy: currentUser?.email || null };
      await setDoc(doc(db, "vehicleKmMonthly", month), { month, vehicles: vs, updatedAt: new Date().toISOString() }, { merge: true });
      setKmMonthly(vs);
      setKmEdit(p => ({ ...p, [vid]: "" }));
      logAction("update", "vehicleKmMonthly", { month, vehicleId: vid, km: val });
      showToast("✅ km zapisane");
    } catch (e) { showToast("❌ " + (e?.message || "Nie zapisano")); }
  };

  const toggle = (setter, set, key) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  const chip = (active, onClick, label, color) => (
    <button key={label} onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
      style={active
        ? { background: color || "#0071e3", borderColor: color || "#0071e3", color: "#fff" }
        : { background: "#fafafa", borderColor: "#e5e5ea", color: "#6e6e73" }}>
      {label}
    </button>
  );

  const monthLabel = m => {
    if (!m) return "—";
    const NM = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
    return `${NM[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
  };

  return (
    <div className="space-y-4">
      <style>{`
        .paliwo-nolbl .leaflet-tooltip.paliwo-pin { display: none; }
        .leaflet-tooltip.paliwo-pin { background: transparent; border: 0; box-shadow: none; padding: 0; }
      `}</style>

      {/* ── Nagłówek ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] uppercase tracking-wide text-gray-400">VBS Transport · flota</div>
          <h2 className="text-lg font-semibold text-gray-900">⛽ Paliwo</h2>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm">
          {months.length === 0 && <option value="">brak danych</option>}
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => { setShowImport(true); setImportState(null); }}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: "#0071e3" }}>
            📥 Importuj raporty kart
          </button>
        )}
      </div>

      {/* ── IMPORT ── */}
      {showImport && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">📥 Import raportów kart paliwowych</h3>
            <button onClick={() => { setShowImport(false); setImportState(null); }}
              className="text-sm text-gray-400 hover:text-gray-600">Zamknij ✕</button>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Wrzuć raporty miesięczne — <b>Eurowag</b> (EW_Export), <b>E100</b> (transaction-…) i <b>Andamur</b> (MOJE ZUŻYCIE).
            Można wszystkie naraz; format rozpoznaję po nagłówkach. Kwoty przeliczam na <b>netto w EUR</b> kursem NBP z dnia
            transakcji. Ten sam plik wgrany dwa razy nie zrobi duplikatów.
          </p>
          <input type="file" multiple accept=".xlsx,.xls,.csv"
            onChange={e => handleFiles(e.target.files)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700" />

          {importState?.phase === "parsing" && <div className="text-sm text-gray-500">⏳ Czytam pliki…</div>}
          {importState?.phase === "fx" && <div className="text-sm text-gray-500">💱 Pobieram kursy NBP z dni transakcji ({importState.total} pozycji)…</div>}
          {importState?.phase === "dedup" && <div className="text-sm text-gray-500">🔍 Sprawdzam duplikaty…</div>}
          {importState?.phase === "geocoding" && (
            <div className="text-sm text-gray-500">
              📍 Geokoduję stacje {importState.progress?.[0]}/{importState.progress?.[1]} — nowe pytam Nominatim (1/s), znane biorę z cache…
            </div>
          )}
          {importState?.phase === "saving" && <div className="text-sm text-gray-500">💾 Zapisuję…</div>}
          {importState?.phase === "error" && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3">❌ {importState.msg}</div>
          )}

          {importState?.detected && (
            <div className="text-xs text-gray-600 space-y-1">
              {importState.detected.map(d => (
                <div key={d.name}>
                  {d.kind ? `✅ ${CARDS[d.kind]?.name || d.kind}` : "❓ nierozpoznany"} — {d.name} ({d.count} transakcji)
                </div>
              ))}
            </div>
          )}

          {importState?.phase === "preview" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr><th className="text-left px-3 py-2">Miesiąc</th><th className="text-right px-3 py-2">Transakcji</th>
                      <th className="text-right px-3 py-2">Litry ON</th><th className="text-right px-3 py-2">Netto</th></tr>
                  </thead>
                  <tbody>
                    {importState.summary.map(s => (
                      <tr key={s.month} className="border-t border-gray-100">
                        <td className="px-3 py-2">{monthLabel(s.month)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.n}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{litr(s.liters)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{eur(s.eur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <div>➕ Nowych do zapisania: <b>{importState.fresh.length}</b>
                  {importState.dupes > 0 && <> · 🔁 duplikatów pominiętych: <b>{importState.dupes}</b></>}</div>
                {importState.skipped?.length > 0 && (
                  <div>⏭️ Pominięte rejestracje (poza flotą): {importState.skipped.join(", ")}</div>
                )}
                {importState.fxMissing?.length > 0 && (
                  <div className="text-amber-700">⚠️ Brak kursu NBP dla: {importState.fxMissing.join(", ")} — te pozycje pominięte.</div>
                )}
              </div>
              <button onClick={confirmImport} disabled={!importState.fresh.length}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                style={{ background: "#0071e3" }}>
                Zapisz {importState.fresh.length} tankowań →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── WIDOK: panel + mapa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(340px,400px)_1fr] gap-4">
        {/* PANEL */}
        <div className="space-y-4">
          {/* Filtry — KAŻDY WYMIAR OSOBNO (auta / karty / produkt / kraj), bo to są
              cztery różne pytania i chipy obok siebie zlewały się w jedną kaszę. */}
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {(() => {
              const allCars = [...new Set(txs.map(t => t.vehicleId))].filter(Boolean);
              const allOn = fCars.size === allCars.length;
              return (
                <FilterRow label="Auto" action={allCars.length > 1 && (
                  <button onClick={() => setFCars(new Set(allOn ? [] : allCars))}
                    className="text-[11px] text-blue-600 hover:underline">
                    {allOn ? "wyczyść" : "wszystkie"}
                  </button>
                )}>
                  {allCars.map(vid => chip(fCars.has(vid), () => toggle(setFCars, fCars, vid), plateOf(vid)))}
                </FilterRow>
              );
            })()}

            <FilterRow label="Karta paliwowa" action={fCards.size < Object.keys(CARDS).length && (
              <button onClick={() => setFCards(new Set(Object.keys(CARDS)))}
                className="text-[11px] text-blue-600 hover:underline">wszystkie</button>
            )}>
              {Object.entries(CARDS).map(([k, v]) =>
                chip(fCards.has(k), () => toggle(setFCards, fCards, k), v.name, v.color))}
            </FilterRow>

            <FilterRow label="Produkt">
              {chip(product === "on", () => setProduct("on"), "Diesel")}
              {chip(product === "adblue", () => setProduct("adblue"), "AdBlue")}
            </FilterRow>

            <FilterRow label="Kraj" action={country !== "all" && (
              <button onClick={() => setCountry("all")}
                className="text-[11px] text-blue-600 hover:underline">wszystkie</button>
            )}>
              <select value={country} onChange={e => setCountry(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-gray-200 bg-gray-50 text-xs">
                <option value="all">Wszystkie kraje</option>
                {[...new Set(txs.filter(t => t.product === product).map(t => t.country))].filter(Boolean).sort()
                  .map(cc => <option key={cc} value={cc}>{FLAG[cc] || ""} {cc}</option>)}
              </select>
            </FilterRow>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 gap-2">
            {[[litr(totals.l), product === "on" ? "litry diesla" : "litry AdBlue"],
              [eur(totals.e), "koszt netto"],
              [totals.l ? p3(totals.avg) + " €/L" : "—", "średnia cena"],
              [String(totals.n), "tankowań"]].map(([a, b]) => (
              <div key={b} className="bg-white rounded-2xl border border-gray-100 p-3">
                <div className="text-lg font-semibold text-gray-900 tracking-tight">{a}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-gray-400">{b}</div>
              </div>
            ))}
          </div>

          {/* Wnioski */}
          {insights.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 pt-3 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Wnioski</div>
              <div className="divide-y divide-gray-100 mt-1">
                {insights.map(([ico, html], i) => (
                  <div key={i} className="px-4 py-2.5 flex gap-2 text-[12.5px] text-gray-700 leading-snug">
                    <span className="shrink-0">{ico}</span>
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ceny per kraj */}
          {byCountry.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Ceny per kraj (netto)</div>
              <table className="w-full text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-wide text-gray-400">
                  <tr><th className="text-left pb-1.5">Kraj</th><th className="text-right pb-1.5">Litry</th>
                    <th className="pb-1.5 w-16"></th><th className="text-right pb-1.5">€/L</th><th className="text-right pb-1.5">Koszt</th></tr>
                </thead>
                <tbody>
                  {(() => {
                    const mx = Math.max(...byCountry.map(c => c.l), 1);
                    const ps = byCountry.map(c => c.p);
                    const mn = Math.min(...ps), mxp = Math.max(...ps);
                    return byCountry.map(c => (
                      <tr key={c.cc} className="border-t border-gray-100">
                        <td className="py-1">{FLAG[c.cc] || ""} {c.cc}</td>
                        <td className="py-1 text-right tabular-nums">{Math.round(c.l)}</td>
                        <td className="py-1">
                          <div className="h-1.5 rounded bg-gray-100">
                            <div className="h-1.5 rounded" style={{ width: `${c.l / mx * 100}%`, background: "#0071e3", opacity: 0.85 }} />
                          </div>
                        </td>
                        <td className="py-1 text-right tabular-nums font-semibold"
                          style={{ color: c.p === mn ? "#16a34a" : c.p === mxp ? "#dc2626" : "#1d1d1f" }}>{p3(c.p)}</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">{Math.round(c.e)} €</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {/* Auta: litry / km / spalanie */}
          {byVehicle.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Auta — litry, km, spalanie</div>
              <table className="w-full text-[12.5px]">
                <thead className="text-[10.5px] uppercase tracking-wide text-gray-400">
                  <tr><th className="text-left pb-1.5">Auto</th><th className="text-right pb-1.5">Litry</th>
                    <th className="text-right pb-1.5">km</th><th className="text-right pb-1.5">L/100</th>
                    <th className="text-right pb-1.5">€/km</th></tr>
                </thead>
                <tbody>
                  {byVehicle.map(v => (
                    <tr key={v.vid} className="border-t border-gray-100">
                      <td className="py-1">{plateOf(v.vid)}</td>
                      <td className="py-1 text-right tabular-nums">{Math.round(v.l)}</td>
                      <td className="py-1 text-right tabular-nums">
                        {v.km
                          ? <span title={v.kmSource === "report" ? "z raportu panelu (dokładne)"
                              : v.kmSource === "snapshot" ? "snapshot licznika (dokładne)" : "delta Atlas (±1%)"}>
                              {Math.round(v.km).toLocaleString("pl-PL")}
                              {v.kmSource !== "report" && v.kmSource !== "snapshot" && <span className="text-gray-400">*</span>}
                            </span>
                          : canEdit
                            ? <span className="inline-flex gap-1">
                                <input value={kmEdit[v.vid] ?? ""} onChange={e => setKmEdit(p => ({ ...p, [v.vid]: e.target.value }))}
                                  placeholder="km" className="w-16 px-1.5 py-0.5 border border-gray-200 rounded text-right text-[11px]" />
                                <button onClick={() => saveKm(v.vid)} className="text-[11px] text-blue-600">✔</button>
                              </span>
                            : "—"}
                      </td>
                      <td className="py-1 text-right tabular-nums font-semibold">{v.l100 ? v.l100.toFixed(1) : "—"}</td>
                      <td className="py-1 text-right tabular-nums text-gray-500">{v.eurKm ? v.eurKm.toFixed(3) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                km z raportu panelu albo ze snapshotu licznika (CF, 1. dnia miesiąca o 00:05).
                <b>*</b> = delta z Atlas API, zaniża ~1–4%. Puste pole = wpisz km z raportu.
              </div>
            </div>
          )}

          {/* Lista tankowań */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">
              Tankowania ({filtered.length})
            </div>
            {loading && <div className="text-sm text-gray-400 py-3">⏳ Wczytuję…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-gray-400 py-3">
                Brak danych. {canEdit ? "Wrzuć raporty kart przyciskiem u góry." : "Poproś admina o import raportów."}
              </div>
            )}
            <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {[...filtered].sort((a, b) => (a.ts < b.ts ? 1 : -1)).map(t => (
                <button key={t.id} onClick={() => flyTo(t)}
                  className="w-full text-left py-2 grid grid-cols-[44px_1fr_auto] gap-2 items-center hover:bg-gray-50">
                  <div className="text-[11px] text-gray-400 tabular-nums leading-tight">
                    {t.ts.slice(8, 10)}.{t.ts.slice(5, 7)}<br />{t.ts.slice(11)}
                  </div>
                  <div className="text-[12.5px] truncate">
                    <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                      style={{ background: CARDS[t.card]?.color }} />
                    {FLAG[t.country] || ""} {t.station || "—"}
                    <span className="block text-[11px] text-gray-400">{t.plate}{!t.lat && " · brak lokalizacji"}</span>
                  </div>
                  <div className="text-right text-[12.5px] tabular-nums">
                    {p3(t.pricePerLNet)} €/L
                    <span className="block text-[10.5px] text-gray-400">
                      {Math.round(t.liters)} L · {Math.round(t.netEUR)} €
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MAPA */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden relative min-h-[420px]">
          <div className="absolute z-[500] top-3 left-3 flex gap-1.5 items-center bg-white/95 backdrop-blur border border-gray-100 rounded-xl px-2.5 py-2 shadow-sm">
            <span className="text-[11px] text-gray-400 mr-1">Etykiety:</span>
            {chip(labelMode === "price", () => setLabelMode("price"), "€/L")}
            {chip(labelMode === "liters", () => setLabelMode("liters"), "litry")}
            {chip(labelMode === "none", () => setLabelMode("none"), "bez")}
          </div>
          <div className="absolute z-[500] bottom-4 left-3 bg-white/95 backdrop-blur border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
            <div className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Karta</div>
            {Object.entries(CARDS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-[11.5px] text-gray-700">
                <span className="w-2 h-2 rounded-full" style={{ background: v.color }} />{v.name}
              </div>
            ))}
            <div className="text-[10.5px] uppercase tracking-wide text-gray-400 font-semibold mt-2">Wielkość = litry</div>
          </div>
          <div ref={mapRef} className="w-full h-full min-h-[420px]" style={{ height: "calc(100vh - 220px)" }} />
        </div>
      </div>
    </div>
  );
}
