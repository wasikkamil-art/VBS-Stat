// KalkulatorTras — szacunkowy koszt trasy (paliwo per kraj + myto per kraj).
//
// Dyspozytor wpisuje punkty trasy (adres → geokod Nominatim, albo "lat,lon"),
// OSRM liczy dystans + geometrię, my dzielimy trasę na kraje (próbkowany
// reverse-geocode) i wyceniamy paliwo litr-po-litrze wg krajowej ceny diesla
// oraz myto wg krajowej stawki €/km. Wynik jest SZACUNKIEM (nie 1:1) —
// stawki są edytowalne i docelowo kalibrowane o realne koszty z raportów.
//
// Faza 1 (rdzeń): geokod + OSRM + podział na kraje + koszt + mapa Leaflet.
// Faza 2 (TODO): auto-odświeżanie cen paliwa (Cloud Function → config), zapis
//   szacunków, podpięcie pod konkretny fracht.
// Faza 3 (TODO): kalibracja o 6 mc realnych tras.
//
// Wydzielone jako osobny lazy chunk — NIE puchnie App.jsx (cel code-splitting).

import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { logAction } from "../utils/logAction";

// ── Stawki domyślne (EUR). Edytowalne w UI, zapisywane do config/kalkulatorTras.
// Ceny diesla orientacyjne (lipiec 2026). Myto = efektywne €/km (blended
// płatne+bezpłatne odcinki) dla FLOTY VBS: lekka solówka ~7,2t (Iveco 70C18)
// oraz OSOBNO bus (busy zwolnione z Maut towarowego DE/PL). Wartości szacunkowe
// do potwierdzenia TollGuru — edytowalne.
const DEFAULT_RATES = {
  fuelPrice: {
    PL: 1.42, DE: 1.66, FR: 1.69, BE: 1.73, CZ: 1.44, ES: 1.48, LU: 1.40,
    AT: 1.56, IT: 1.74, NL: 1.76, SK: 1.48, HU: 1.55, SI: 1.52, CH: 1.90,
    DK: 1.75, SE: 1.65, LT: 1.42, LV: 1.45, EE: 1.48, RO: 1.40, HR: 1.45, BG: 1.38,
  },
  // Solówka lekka ~7,2t — niższa klasa niż zestaw >12t; nie wszystkie km płatne.
  tollPerKm: {
    DE: 0.13, AT: 0.20, FR: 0.08, PL: 0.05, CZ: 0.10, BE: 0.08, IT: 0.14,
    ES: 0.03, LU: 0.00, NL: 0.00, SK: 0.12, HU: 0.10, SI: 0.15, CH: 0.05,
    DK: 0.00, SE: 0.00, LT: 0.05, LV: 0.05, EE: 0.05, RO: 0.06, HR: 0.10, BG: 0.08,
  },
  // Bus — TYLKO winiety (koszt roczny/okresowy, NIE per przejazd). CZ kupowane
  // rocznie, AT/BG rzadko. Per trasa myto = 0 (winiety to koszt stały floty).
  tollPerKmBus: {
    DE: 0.00, AT: 0.00, FR: 0.00, PL: 0.00, CZ: 0.00, BE: 0.00, IT: 0.00,
    ES: 0.00, LU: 0.00, NL: 0.00, SK: 0.00, HU: 0.00, SI: 0.00, CH: 0.00,
    DK: 0.00, SE: 0.00, LT: 0.00, LV: 0.00, EE: 0.00, RO: 0.00, HR: 0.00, BG: 0.00,
  },
  defaultConsumption: 30, // L/100 km
  tankL: 200, // solówka Iveco 70C18 ~ zbiornik 100–200 L
};

const COUNTRY_NAMES = {
  PL: "Polska", DE: "Niemcy", FR: "Francja", BE: "Belgia", CZ: "Czechy",
  ES: "Hiszpania", LU: "Luksemburg", AT: "Austria", IT: "Włochy", NL: "Holandia",
  SK: "Słowacja", HU: "Węgry", SI: "Słowenia", CH: "Szwajcaria", DK: "Dania",
  SE: "Szwecja", LT: "Litwa", LV: "Łotwa", EE: "Estonia", RO: "Rumunia",
  HR: "Chorwacja", BG: "Bułgaria", GB: "W. Brytania", IE: "Irlandia",
  PT: "Portugalia", NO: "Norwegia", FI: "Finlandia", RS: "Serbia", UA: "Ukraina",
};
const cName = (cc) => COUNTRY_NAMES[cc] || cc || "nieznany";
const flag = (cc) =>
  cc && cc.length === 2
    ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
    : "🏳️";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Geokod adresu → współrzędne (Nominatim/OSM, darmowy). ──
async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { "Accept-Language": "pl" } });
    const d = await r.json();
    if (d && d[0]) return { lat: +d[0].lat, lon: +d[0].lon, label: d[0].display_name };
  } catch (e) { console.warn("[geocode] error:", e); }
  return null;
}

// ── Reverse-geocode punktu → kod kraju ISO2 (zoom=3 = poziom kraju, lżejsze). ──
async function reverseCountry(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&addressdetails=1&lat=${lat}&lon=${lon}`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    return d?.address?.country_code ? d.address.country_code.toUpperCase() : null;
  } catch (e) { console.warn("[reverseCountry] error:", e); return null; }
}

// ── OSRM: dystans + geometria trasy (własna kopia, komponent samodzielny). ──
async function osrmRoute(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const coords = waypoints.map((p) => `${p.lon},${p.lat}`).join(";");
  try {
    const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data = await resp.json();
    if (data?.routes?.[0]) {
      const route = data.routes[0];
      return {
        coordinates: route.geometry.coordinates.map((c) => [c[1], c[0]]), // [lat,lon]
        distance: route.distance, // metry
        duration: route.duration, // sekundy
      };
    }
  } catch (e) { console.warn("[OSRM] error:", e); }
  return null;
}

// Haversine — długość odcinka w km.
function segKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── Podział trasy na kraje: próbkuj ~14 punktów, reverse-geocode każdy,
//    przypisz odcinki do najbliższego próbkowanego kraju, zsumuj km. ──
async function countrySplit(geometry, totalKm, onProgress) {
  const N = geometry.length;
  if (N < 2) return { perCountry: {}, unknownKm: 0 };
  const SAMPLES = Math.min(14, N);
  const idxs = [];
  for (let i = 0; i < SAMPLES; i++) idxs.push(Math.round((i * (N - 1)) / (SAMPLES - 1)));

  const cache = new Map();
  const sampleCC = [];
  for (let s = 0; s < idxs.length; s++) {
    const [lat, lon] = geometry[idxs[s]];
    const key = `${lat.toFixed(1)},${lon.toFixed(1)}`;
    let cc = cache.get(key);
    if (cc === undefined) {
      cc = await reverseCountry(lat, lon);
      cache.set(key, cc);
      await sleep(1100); // uprzejmość wobec Nominatim (max ~1 req/s)
    }
    sampleCC.push(cc);
    onProgress && onProgress(s + 1, idxs.length);
  }

  // Każdy odcinek [i,i+1] → kraj najbliższego próbkowanego indeksu.
  const perCountry = {};
  let unknownKm = 0;
  let rawTotal = 0;
  const rawByCountry = {};
  for (let i = 0; i < N - 1; i++) {
    const mid = i + 0.5;
    let best = 0, bestD = Infinity;
    for (let s = 0; s < idxs.length; s++) {
      const d = Math.abs(idxs[s] - mid);
      if (d < bestD) { bestD = d; best = s; }
    }
    const cc = sampleCC[best] || "??";
    const km = segKm(geometry[i], geometry[i + 1]);
    rawByCountry[cc] = (rawByCountry[cc] || 0) + km;
    rawTotal += km;
  }
  // Skaluj haversine-sumę do realnego dystansu OSRM (haversine zaniża zakręty).
  const scale = rawTotal > 0 ? totalKm / rawTotal : 1;
  for (const [cc, km] of Object.entries(rawByCountry)) {
    const scaled = km * scale;
    if (cc === "??") unknownKm += scaled;
    else perCountry[cc] = (perCountry[cc] || 0) + scaled;
  }
  return { perCountry, unknownKm };
}

const fmtEUR = (n) => (n == null ? "—" : n.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €");
const fmtEUR2 = (n) => (n == null ? "—" : n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
const fmtDatePL = (iso) => { try { return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return iso; } };

// Flota VBS = solówki 2-osiowe (Iveco 70C18 ~7,2t) — myto zawsze w tej klasie.
const VEHICLE_TYPE = "2AxlesTruck";


export default function KalkulatorTras({ vehicles = [], operacyjne = [], eurRate = null, canEdit = false, showToast = () => {}, currentUser = null }) {
  const [waypoints, setWaypoints] = useState([]); // {id,label,lat,lon}
  const [addInput, setAddInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [consumption, setConsumption] = useState(DEFAULT_RATES.defaultConsumption);
  const [consBasis, setConsBasis] = useState("wartość domyślna 30 L/100"); // skąd wzięte spalanie
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState(null); // {done,total}
  const [result, setResult] = useState(null); // {distanceKm,durationH,perCountry,unknownKm,rows,fuelTotal,tollTotal,grand}
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null); // data ostatniej aktualizacji cen (ISO) lub null = domyślne
  const [tollKeyInput, setTollKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const layerRef = useRef(null);

  // ── Wczytaj stawki z configu (merge nad domyślnymi). ──
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "kalkulatorTras"));
        if (snap.exists()) {
          const d = snap.data();
          setRates({
            fuelPrice: { ...DEFAULT_RATES.fuelPrice, ...(d.fuelPrice || {}) },
            tollPerKm: { ...DEFAULT_RATES.tollPerKm, ...(d.tollPerKm || {}) },
            tollPerKmBus: { ...DEFAULT_RATES.tollPerKmBus, ...(d.tollPerKmBus || {}) },
            defaultConsumption: d.defaultConsumption || DEFAULT_RATES.defaultConsumption,
            tankL: d.tankL || DEFAULT_RATES.tankL,
          });
          if (d.defaultConsumption) setConsumption(d.defaultConsumption);
          if (d.updatedAt) setRatesUpdatedAt(d.updatedAt);
        }
      } catch (e) { console.warn("[kalkulator] config load:", e); }
    })();
  }, []);

  // ── Wybór pojazdu → średnie spalanie z danych operacyjnych. ──
  const onPickVehicle = (id) => {
    setVehicleId(id);
    if (!id) { setConsBasis("wpisane ręcznie"); return; }
    const ops = operacyjne.filter((o) => o.vehicleId === id && o.spalanie > 0);
    const vName = vehicles.find((v) => v.id === id)?.name || vehicles.find((v) => v.id === id)?.plate || "pojazd";
    if (ops.length) {
      const avg = ops.reduce((s, o) => s + o.spalanie, 0) / ops.length;
      setConsumption(Math.round(avg * 10) / 10);
      setConsBasis(`średnia z ${ops.length} mies. danych operacyjnych (${vName})`);
    } else {
      setConsBasis(`brak danych operacyjnych dla ${vName} — wartość domyślna`);
    }
  };

  // ── Mapa Leaflet — rysuj trasę + markery po obliczeniu. ──
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current) return;
    if (!mapObjRef.current) {
      mapObjRef.current = L.map(mapRef.current, { scrollWheelZoom: false }).setView([52, 15], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 18,
      }).addTo(mapObjRef.current);
    }
    const map = mapObjRef.current;
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!result?.geometry) return;
    const group = L.layerGroup();
    L.polyline(result.geometry, { color: "#2563eb", weight: 4, opacity: 0.85 }).addTo(group);
    waypoints.forEach((w, i) => {
      L.marker([w.lat, w.lon]).addTo(group).bindTooltip(`${i + 1}. ${w.label}`, { direction: "top" });
    });
    group.addTo(map);
    layerRef.current = group;
    try { map.fitBounds(L.polyline(result.geometry).getBounds(), { padding: [30, 30] }); } catch { /* pusto */ }
    setTimeout(() => map.invalidateSize(), 100);
  }, [result, waypoints]);

  const addWaypoint = async () => {
    const q = addInput.trim();
    if (!q) return;
    // "lat,lon" — bezpośrednie współrzędne
    const m = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
      setWaypoints((p) => [...p, { id: Math.random().toString(36).slice(2), label: `${m[1]}, ${m[2]}`, lat: +m[1], lon: +m[2] }]);
      setAddInput("");
      return;
    }
    setGeocoding(true);
    const g = await geocode(q);
    setGeocoding(false);
    if (!g) { showToast("❌ Nie znaleziono adresu: " + q); return; }
    const short = g.label.split(",").slice(0, 3).join(",");
    setWaypoints((p) => [...p, { id: Math.random().toString(36).slice(2), label: short, lat: g.lat, lon: g.lon }]);
    setAddInput("");
  };

  const removeWaypoint = (id) => setWaypoints((p) => p.filter((w) => w.id !== id));

  const compute = async () => {
    if (waypoints.length < 2) { showToast("Dodaj co najmniej 2 punkty trasy"); return; }
    if (!vehicleId) { showToast("Wybierz pojazd — bez niego spalanie jest zmyślone"); return; }
    setComputing(true);
    setResult(null);
    setProgress(null);
    try {
      const route = await osrmRoute(waypoints);
      if (!route) { showToast("❌ OSRM nie zwrócił trasy"); setComputing(false); return; }
      const distanceKm = route.distance / 1000;
      setProgress({ done: 0, total: 14 });
      const { perCountry, unknownKm } = await countrySplit(route.coordinates, distanceKm, (done, total) => setProgress({ done, total }));

      // ── Klasa auta: bus vs solówka → inna tabela myta + inny profil PTV ──
      const selVeh = vehicles.find((v) => v.id === vehicleId);
      const isBus = selVeh?.type === "Bus";
      const tollTable = isBus ? rates.tollPerKmBus : rates.tollPerKm;

      // ── Myto: PTV Developer (oficjalne stawki UE, per kraj) — tylko dla solówek.
      //    Bus = winiety (koszt roczny) → per trasa 0, więc PTV nie wołamy.
      let tollByCountry = null; // {cc: EUR} gdy PTV zadziała
      let tollSource = "flat";
      if (!isBus) {
        try {
          const call = httpsCallable(functions, "tollProxy");
          const res = (await call({ waypoints: waypoints.map((w) => ({ lat: w.lat, lng: w.lon })), profile: "EUR_TRUCK_7_49T" })).data;
          if (res?.success && res.perCountry) { tollByCountry = res.perCountry; tollSource = "ptv"; }
        } catch (e) { console.warn("[kalkulator] tollProxy:", e?.message || e); }
      }

      const cons = parseFloat(consumption) || DEFAULT_RATES.defaultConsumption;
      const avgFuel = Object.values(rates.fuelPrice).reduce((a, b) => a + b, 0) / Object.values(rates.fuelPrice).length;
      const rows = [];
      let fuelTotal = 0, tollTotal = 0;
      const entries = Object.entries(perCountry).sort((a, b) => b[1] - a[1]);
      if (unknownKm > 0.5) entries.push(["??", unknownKm]);
      for (const [cc, km] of entries) {
        const liters = (km * cons) / 100;
        const price = cc === "??" ? avgFuel : (rates.fuelPrice[cc] ?? avgFuel);
        const fuelCost = liters * price;
        // Myto: TollGuru per kraj jeśli dostępne, inaczej flat-rate km × stawka klasy auta.
        const tollCost = tollByCountry
          ? (tollByCountry[cc] || 0)
          : (cc === "??" ? 0 : km * (tollTable[cc] ?? 0));
        fuelTotal += fuelCost;
        tollTotal += tollCost;
        rows.push({ cc, km, liters, price, fuelCost, tollCost });
      }
      // TollGuru może zwrócić myto dla kraju, którego nie wykrył podział km — dolicz do sumy.
      if (tollByCountry) {
        const seen = new Set(entries.map(([cc]) => cc));
        for (const [cc, eur] of Object.entries(tollByCountry)) {
          if (!seen.has(cc) && eur > 0) { tollTotal += eur; rows.push({ cc, km: 0, liters: 0, price: 0, fuelCost: 0, tollCost: eur }); }
        }
      }
      setResult({
        geometry: route.coordinates,
        distanceKm,
        durationH: route.duration / 3600,
        rows,
        fuelTotal,
        tollTotal,
        grand: fuelTotal + tollTotal,
        cons,
        consBasis,
        tollSource,
        isBus,
        vehName: selVeh?.name || selVeh?.plate || "",
        hasUnknown: unknownKm > 0.5,
      });
    } catch (e) {
      console.error("[kalkulator] compute:", e);
      showToast("❌ Błąd obliczeń: " + (e?.message || e));
    } finally {
      setComputing(false);
      setProgress(null);
    }
  };

  const saveRates = async () => {
    setSavingRates(true);
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "config", "kalkulatorTras"), {
        fuelPrice: rates.fuelPrice,
        tollPerKm: rates.tollPerKm,
        defaultConsumption: rates.defaultConsumption,
        tankL: rates.tankL,
        vehicleType: VEHICLE_TYPE,
        updatedAt: now,
        updatedBy: currentUser?.email || null,
      }, { merge: true });
      setRatesUpdatedAt(now);
      logAction("update", "config", { section: "kalkulatorTras" });
      showToast("✅ Stawki zapisane");
    } catch (e) {
      console.error("[kalkulator] saveRates:", e);
      showToast("❌ Nie udało się zapisać stawek");
    } finally { setSavingRates(false); }
  };

  // ── Admin: zapis klucza TollGuru przez CF (klient nie czyta klucza). ──
  const saveTollKey = async () => {
    const k = tollKeyInput.trim();
    if (!k) { showToast("Wklej klucz API PTV"); return; }
    setSavingKey(true);
    try {
      await httpsCallable(functions, "setTollKey")({ apiKey: k });
      setTollKeyInput("");
      showToast("✅ Klucz PTV zapisany — myto pójdzie z oficjalnych stawek");
    } catch (e) {
      console.error("[kalkulator] setTollKey:", e);
      showToast("❌ Nie udało się zapisać klucza (tylko admin)");
    } finally { setSavingKey(false); }
  };

  const grandPLN = result && eurRate ? result.grand * eurRate : null;
  // Kraje pokazywane w edytorze stawek — te z domyślnych + ewentualne z configu.
  const editorCountries = Object.keys(DEFAULT_RATES.fuelPrice);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Kalkulator tras</h2>
      <p className="text-sm text-gray-400 mb-5">Szacunkowy koszt trasy — paliwo per kraj + myto. Wynik orientacyjny, nie 1:1.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Panel wejścia ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Trasa</h3>

          <div className="space-y-2 mb-3">
            {waypoints.map((w, i) => (
              <div key={w.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-semibold shrink-0">{i + 1}</span>
                <span className="flex-1 truncate text-gray-700" title={w.label}>{w.label}</span>
                <button onClick={() => removeWaypoint(w.id)} className="text-gray-300 hover:text-red-500 shrink-0" title="Usuń">✕</button>
              </div>
            ))}
            {waypoints.length === 0 && <p className="text-xs text-gray-400">Brak punktów. Dodaj miasto/adres albo „lat, lon".</p>}
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addWaypoint(); }}
              placeholder="Kielce  ·  Berlin  ·  50.87, 20.63"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button onClick={addWaypoint} disabled={geocoding} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 disabled:opacity-50">
              {geocoding ? "…" : "+ Dodaj"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="text-xs text-gray-500">
              Pojazd
              <select value={vehicleId} onChange={(e) => onPickVehicle(e.target.value)} className="mt-1 w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-700">
                <option value="">— wybierz pojazd —</option>
                {vehicles.filter((v) => !v.archived).map((v) => <option key={v.id} value={v.id}>{v.name || v.plate || v.id}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Spalanie L/100
              <input type="number" step="0.1" value={consumption} onChange={(e) => { setConsumption(e.target.value); setConsBasis("wpisane ręcznie"); }} className="mt-1 w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-700" />
            </label>
          </div>

          <button onClick={compute} disabled={computing || waypoints.length < 2 || !vehicleId} className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {computing ? (progress ? `Analizuję kraje… ${progress.done}/${progress.total}` : "Liczę trasę…")
              : !vehicleId ? "Wybierz pojazd, żeby policzyć"
              : "Oblicz koszt trasy"}
          </button>
          {computing && progress && <p className="text-[11px] text-gray-400 mt-2 text-center">Reverse-geocode punktów trasy (Nominatim, ~1/s)</p>}
        </div>

        {/* ── Mapa ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-1.5 overflow-hidden">
          <div ref={mapRef} style={{ width: "100%", height: 300, borderRadius: 12 }} />
        </div>
      </div>

      {/* ── Wynik ── */}
      {result && (
        <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-4">
            <div>
              <span className="text-2xl font-bold text-gray-900">{fmtEUR(result.grand)}</span>
              {grandPLN != null && <span className="text-sm text-gray-400 ml-2">≈ {grandPLN.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} zł</span>}
              <span className="text-xs text-gray-400 ml-2">szacunek</span>
            </div>
            <div className="text-sm text-gray-500">
              {result.distanceKm.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} km · {result.durationH.toFixed(1)} h · {result.cons} L/100
            </div>
            {result.tollSource === "ptv"
              ? <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-medium">myto: PTV oficjalne</span>
              : <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium">myto: szacunek flat-rate</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5">Kraj</th>
                  <th className="text-right font-medium">km</th>
                  <th className="text-right font-medium">Litry</th>
                  <th className="text-right font-medium">€/L</th>
                  <th className="text-right font-medium">Paliwo</th>
                  <th className="text-right font-medium">Myto</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.cc} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700">{flag(r.cc)} {cName(r.cc)}</td>
                    <td className="text-right text-gray-600">{r.km.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}</td>
                    <td className="text-right text-gray-600">{r.liters.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}</td>
                    <td className="text-right text-gray-400">{r.price.toFixed(2)}</td>
                    <td className="text-right text-gray-700">{fmtEUR2(r.fuelCost)}</td>
                    <td className="text-right text-gray-700">{r.tollCost > 0 ? fmtEUR2(r.tollCost) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold text-gray-800">
                  <td className="pt-2">Razem</td>
                  <td className="pt-2 text-right">{result.distanceKm.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}</td>
                  <td></td><td></td>
                  <td className="pt-2 text-right">{fmtEUR2(result.fuelTotal)}</td>
                  <td className="pt-2 text-right">{fmtEUR2(result.tollTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {result.hasUnknown && <p className="text-[11px] text-amber-500 mt-2">⚠️ Część trasy bez rozpoznanego kraju — wyceniona średnią ceną paliwa, bez myta.</p>}

          {/* ── Podstawa wyliczeń (na czym opiera się szacunek) ── */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">⛽ Paliwo — jak liczone</div>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Osobno dla każdego kraju: <b>km w kraju × spalanie ({result.cons} L/100) × cena diesla tego kraju</b>.<br />
                Spalanie: {result.consBasis}.<br />
                Ceny diesla: {ratesUpdatedAt
                  ? <>stan na <b>{fmtDatePL(ratesUpdatedAt)}</b> (z tabeli stawek poniżej)</>
                  : <>wartości <b>domyślne</b> (orientacyjne, stan lipiec 2026)</>}.
                To jedna cena „bieżąca" na kraj — <b>nie</b> kurs z konkretnego dnia trasy. Aktualizowana ręcznie (Faza 2: auto-odświeżanie).
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-2">
                🛣️ Myto — jak liczone
                {result.tollSource === "ptv"
                  ? <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">PTV · oficjalne</span>
                  : <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">szacunek · flat-rate</span>}
              </div>
              {result.tollSource === "ptv" ? (
                <p className="text-[11px] leading-relaxed text-gray-500">
                  <b>Oficjalne stawki PTV Developer</b> — myto per kraj wg realnych taryf operatorów (Toll Collect, e-TOLL, ASFA…) i geometrii płatnych dróg, dla klasy solówka 3,5–7,49 t. Liczy też Polskę.<br />
                  Kwoty spoza EUR przeliczone zgrubnym kursem.
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-gray-500">
                  <b>km w kraju × stawka €/km tego kraju</b> — <b>fallback</b>, bo PTV niedostępne (brak klucza / błąd API).<br />
                  Klasa: {result.isBus
                    ? <><b>BUS</b> — tylko winiety (koszt <b>roczny/okresowy</b>, nie per trasa; CZ rocznie, AT/BG rzadko) → myto per trasa <b>= 0</b>.</>
                    : <><b>solówka lekka ~7,2 t</b> — myto towarowe wg oficjalnych stawek; wartości orientacyjne — realne liczy PTV powyżej.</>}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edytor stawek ── */}
      <div className="mt-5 bg-white rounded-2xl border border-gray-100 p-5">
        <button onClick={() => setRatesOpen((o) => !o)} className="w-full flex items-center justify-between text-sm font-semibold text-gray-700">
          <span>Stawki (ceny diesla €/L · myto €/km per kraj){ratesUpdatedAt ? <span className="ml-2 font-normal text-gray-400">· stan {fmtDatePL(ratesUpdatedAt)}</span> : <span className="ml-2 font-normal text-gray-400">· wartości domyślne</span>}</span>
          <span className="text-gray-400">{ratesOpen ? "▲" : "▼"}</span>
        </button>
        {ratesOpen && (
          <div className="mt-4">
            {canEdit && (
              <div className="mb-4 rounded-xl bg-blue-50/50 border border-blue-100 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-1">🔑 Klucz PTV Developer (realne myto)</div>
                <p className="text-[11px] text-gray-500 mb-2">
                  Załóż konto na <b>developer.myptv.com</b> (Free Plan, bez karty) → wygeneruj klucz → wklej tutaj. Myto liczy się z <b>oficjalnych stawek UE</b> (w tym Polska). Klucz zapisuje się bezpiecznie (przez serwer, nie w przeglądarce).
                </p>
                <div className="flex gap-2">
                  <input type="password" value={tollKeyInput} onChange={(e) => setTollKeyInput(e.target.value)} placeholder="klucz PTV Developer" autoComplete="off"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100" />
                  <button onClick={saveTollKey} disabled={savingKey} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50">
                    {savingKey ? "…" : "Zapisz klucz"}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Poniższe stawki €/km działają jako <b>fallback</b>, gdy PTV jest niedostępne.</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left font-medium py-1.5">Kraj</th>
                    <th className="text-right font-medium">Diesel €/L</th>
                    <th className="text-right font-medium">Myto €/km (fallback)</th>
                  </tr>
                </thead>
                <tbody>
                  {editorCountries.map((cc) => (
                    <tr key={cc} className="border-b border-gray-50">
                      <td className="py-1 text-gray-700">{flag(cc)} {cName(cc)}</td>
                      <td className="text-right">
                        <input type="number" step="0.01" disabled={!canEdit} value={rates.fuelPrice[cc] ?? ""}
                          onChange={(e) => setRates((r) => ({ ...r, fuelPrice: { ...r.fuelPrice, [cc]: parseFloat(e.target.value) || 0 } }))}
                          className="w-20 px-2 py-1 rounded border border-gray-200 text-right text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                      </td>
                      <td className="text-right">
                        <input type="number" step="0.01" disabled={!canEdit} value={rates.tollPerKm[cc] ?? ""}
                          onChange={(e) => setRates((r) => ({ ...r, tollPerKm: { ...r.tollPerKm, [cc]: parseFloat(e.target.value) || 0 } }))}
                          className="w-20 px-2 py-1 rounded border border-gray-200 text-right text-sm disabled:bg-gray-50 disabled:text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canEdit && (
              <div className="mt-4 flex justify-end">
                <button onClick={saveRates} disabled={savingRates} className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm disabled:opacity-50">
                  {savingRates ? "Zapisuję…" : "Zapisz stawki"}
                </button>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-3">Ceny i myto to wartości orientacyjne — dostrój je o realne koszty z raportów. Faza 2: auto-odświeżanie cen paliwa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
