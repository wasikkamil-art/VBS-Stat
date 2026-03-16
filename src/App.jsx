import { useState, useEffect, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

// ─── FIREBASE CONFIG ────────────────────────────────────────────────────────
// 👇 WKLEJ TUTAJ SWÓJ firebaseConfig z Firebase Console
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// ─── STORAGE HELPERS (per-user, per-key documents) ───────────────────────────
// Każdy klucz to osobny dokument: fleet/{uid}/{key}
// Omija limit 1MB na dokument i izoluje dane per użytkownik

const firebaseConfig = {
  apiKey:            "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ",
  authDomain:        "vbs-stats.firebaseapp.com",
  projectId:         "vbs-stats",
  storageBucket:     "vbs-stats.firebasestorage.app",
  messagingSenderId: "331217061974",
  appId:             "1:331217061974:web:375c8931f0cda74ec413f7",
  measurementId:     "G-EJTBVPYH1X",
};

const app = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ─── STORAGE (Firebase Firestore) ────────────────────────────────────────────
// Dane w jednym dokumencie fleet/data (merge strategy)

const DATA_REF = () => doc(db, "fleet", "data");

async function dbGet(key) {
  try {
    const snap = await getDoc(DATA_REF());
    if (!snap.exists()) return null;
    const val = snap.data()[key];
    return val !== undefined ? val : null;
  } catch (e) {
    console.error("dbGet error", e);
    return null;
  }
}

async function dbSet(key, value) {
  try {
    await setDoc(DATA_REF(), { [key]: value }, { merge: true });
  } catch (e) {
    console.error("dbSet error", e);
  }
}

const SK = { vehicles: "fleetv2_vehicles", costs: "fleetv2_costs", categories: "fleetv2_categories", docs: "fleetv2_docs", imi: "fleetv2_imi", rent: "fleetv2_rent", frachty: "fleetv2_frachty" };

// ─── SEED DATA ─────────────────────────────────────────────────────────────────
const SEED_VEHICLES = [
  { id: "v1", plate: "WGM 0475M", plate2: "", type: "Solo", brand: "Iveco", year: 2021,
    equipment: ["paleciak", "winda", "pasy", "gasnica", "apteczka", "trójkąt", "tachograf"],
    customEquipment: [],
    dimensions: "607x243x245", dimensions2: "", loadingType: "Bok, tył, góra", maxWeight: "3000", maxWeight2: "",
    driverHistory: [{ id: "dh1", name: "Jan Kowalski", phone: "", from: "2024-01-01", to: "" }] },
  { id: "v2", plate: "TK 130EF",  plate2: "", type: "Bus",  brand: "Renault Master", year: 2020,
    equipment: ["pasy", "gasnica", "apteczka", "trójkąt", "tachograf"],
    customEquipment: [],
    dimensions: "460x220x230", dimensions2: "", loadingType: "Bok, tył", maxWeight: "820", maxWeight2: "",
    driverHistory: [{ id: "dh2", name: "Adam Nowak", phone: "", from: "2023-06-01", to: "" }] },
  { id: "v3", plate: "WGM 5367K", plate2: "", type: "Solo", brand: "Iveco", year: 2022,
    equipment: ["paleciak", "winda", "pasy", "gasnica", "apteczka", "trójkąt", "tachograf", "gps"],
    customEquipment: [],
    dimensions: "620x245x260", dimensions2: "", loadingType: "Bok, tył, góra", maxWeight: "3000", maxWeight2: "",
    driverHistory: [{ id: "dh3", name: "Piotr Wiśniewski", phone: "", from: "2022-03-15", to: "" }] },
  { id: "v4", plate: "TK 314CL", plate2: "TK 760AP", type: "Bus", brand: "Iveco Bus + Przyczepa", year: 2020,
    equipment: ["pasy", "gasnica", "apteczka", "trójkąt", "tachograf"],
    customEquipment: [],
    dimensions: "420x225x245", dimensions2: "640x245x250", loadingType: "Bok", maxWeight: "895", maxWeight2: "2100",
    driverHistory: [{ id: "dh4", name: "Mirosław Teper", phone: "530127238", from: "2023-01-01", to: "" }] },
  { id: "v5", plate: "WGM 0507M", plate2: "", type: "Solo", brand: "Iveco", year: 2025,
    equipment: ["gasnica", "apteczka", "trojkat", "tachograf"],
    customEquipment: [],
    dimensions: "", dimensions2: "", loadingType: "Bok", maxWeight: "", maxWeight2: "",
    driverHistory: [] },
  { id: "v6", plate: "TK 315CL", plate2: "TK 761AP", type: "Bus", brand: "Iveco Bus + Przyczepa", year: 2020,
    equipment: ["pasy", "gasnica", "apteczka", "trojkat", "tachograf"],
    customEquipment: [],
    dimensions: "420x225x245", dimensions2: "640x245x250", loadingType: "Bok", maxWeight: "895", maxWeight2: "2100",
    driverHistory: [{ id: "dh6", name: "Marcin Gieliniewski", phone: "", from: "2025-01-01", to: "2025-06-30" }] },
];

const SEED_CATEGORIES = [
  { id: "paliwo",        label: "Paliwo",        color: "#f59e0b", icon: "⛽" },
  { id: "leasing",       label: "Leasing",        color: "#6366f1", icon: "🏦" },
  { id: "naprawa",       label: "Naprawa",        color: "#ef4444", icon: "🔧" },
  { id: "ubezpieczenie", label: "Ubezpieczenie",  color: "#10b981", icon: "🛡️" },
  { id: "opony",         label: "Opony",          color: "#3b82f6", icon: "🔄" },
  { id: "myto",          label: "Myto / Opłaty",  color: "#8b5cf6", icon: "🛣️" },
  { id: "inne",          label: "Inne",           color: "#94a3b8", icon: "📋" },
];

const SEED_COSTS = [
  { id: "c1", vehicleId: "v1", category: "paliwo",        amountPLN: 3200, amountEUR: null, currency: "PLN", date: "2026-02-05", note: "Tankowanie DE+PL", liters: 480 },
  { id: "c2", vehicleId: "v2", category: "leasing",       amountPLN: 2800, amountEUR: null, currency: "PLN", date: "2026-02-01", note: "Rata lutowa" },
  { id: "c3", vehicleId: "v3", category: "naprawa",       amountPLN: 1450, amountEUR: null, currency: "PLN", date: "2026-02-12", note: "Wymiana sprzęgła" },
  { id: "c4", vehicleId: "v1", category: "paliwo",        amountPLN: 3100, amountEUR: null, currency: "PLN", date: "2026-03-03", note: "Tankowanie NL", liters: 460 },
  { id: "c5", vehicleId: "v3", category: "leasing",       amountPLN: 3400, amountEUR: null, currency: "PLN", date: "2026-03-01", note: "Rata marcowa" },
  { id: "c6", vehicleId: "v2", category: "ubezpieczenie", amountPLN: 620,  amountEUR: null, currency: "PLN", date: "2026-03-08", note: "OC marzec" },
  { id: "c7", vehicleId: "v1", category: "naprawa",       amountPLN: 880,  amountEUR: null, currency: "PLN", date: "2026-03-07", note: "Przegląd + olej" },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmtPLN(n) { return Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł"; }
function fmtEUR(n) { return Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
function fmtDate(d) { try { return new Date(d).toLocaleDateString("pl-PL"); } catch { return d; } }

// ─── SERVICE HELPERS ────────────────────────────────────────────────────────
function serviceStatus(daysLeft) {
  if (daysLeft === null) return null;
  if (daysLeft < 0)   return "expired";
  if (daysLeft <= 14) return "critical";
  if (daysLeft <= 30) return "warning";
  return "ok";
}
function serviceStatusBadge(daysLeft, label) {
  const s = serviceStatus(daysLeft);
  if (!s) return null;
  const styles = {
    expired:  { bg:"#fef2f2", color:"#dc2626", text:`⚠ ${label} — wygasło` },
    critical: { bg:"#fef2f2", color:"#dc2626", text:`🔴 ${label} — ${daysLeft}d` },
    warning:  { bg:"#fffbeb", color:"#d97706", text:`🟡 ${label} — ${daysLeft}d` },
    ok:       { bg:"#f0fdf4", color:"#16a34a", text:`🟢 ${label} — ${daysLeft}d` },
  }[s];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:styles.bg, color:styles.color }}>{styles.text}</span>;
}
function kmStatus(kmLeft) {
  if (kmLeft === null) return null;
  if (kmLeft <= 0)    return "expired";
  if (kmLeft <= 500)  return "critical";
  if (kmLeft <= 1500) return "warning";
  return "ok";
}
function kmStatusBadge(kmLeft, label) {
  const s = kmStatus(kmLeft);
  if (!s) return null;
  const styles = {
    expired:  { bg:"#fef2f2", color:"#dc2626", text:`⚠ ${label} — przekroczono` },
    critical: { bg:"#fef2f2", color:"#dc2626", text:`🔴 ${label} — ${kmLeft} km` },
    warning:  { bg:"#fffbeb", color:"#d97706", text:`🟡 ${label} — ${kmLeft} km` },
    ok:       { bg:"#f0fdf4", color:"#16a34a", text:`🟢 ${label} — ${kmLeft} km` },
  }[s];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:styles.bg, color:styles.color }}>{styles.text}</span>;
}

const PALETTE = ["#f59e0b","#6366f1","#ef4444","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4"];

const DEFAULT_EQUIPMENT = [
  { id: "paleciak",    label: "Paleciak" },
  { id: "winda",       label: "Winda załadunkowa" },
  { id: "pasy",        label: "Pasy mocujące" },
  { id: "gasnica",     label: "Gaśnica" },
  { id: "apteczka",    label: "Apteczka" },
  { id: "trójkąt",     label: "Trójkąt ostrzegawczy" },
  { id: "tachograf",   label: "Tachograf cyfrowy" },
  { id: "gps",         label: "GPS / lokalizator" },
  { id: "chłodnia",    label: "Agregat chłodniczy" },
  { id: "plandeka",    label: "Plandeka" },
];

const DOC_TYPES = [
  { id: "oc",        label: "OC",               icon: "🛡️",  color: "#3b82f6", group: "Ubezpieczenia" },
  { id: "ac",        label: "AC",               icon: "🚗",  color: "#6366f1", group: "Ubezpieczenia" },
  { id: "gap",       label: "GAP",              icon: "📊",  color: "#8b5cf6", group: "Ubezpieczenia" },
  { id: "nnw",       label: "NNW",              icon: "🏥",  color: "#ec4899", group: "Ubezpieczenia" },
  { id: "assistance",label: "Assistance",       icon: "🆘",  color: "#f97316", group: "Ubezpieczenia" },
  { id: "cargo",     label: "Ubezp. ładunku",   icon: "📦",  color: "#14b8a6", group: "Ubezpieczenia" },
  { id: "licencja",  label: "Licencja transp.", icon: "📜",  color: "#f59e0b", group: "Licencje" },
  { id: "zezwolenie",label: "Zezwolenie PL/EU", icon: "🌍",  color: "#10b981", group: "Licencje" },
  { id: "przeglad",  label: "Przegląd tech.",   icon: "🔩",  color: "#6b7280", group: "Badania" },
  { id: "tachlegalizacja", label: "Legalizacja tachografu", icon: "⏱️", color: "#ef4444", group: "Badania" },
  { id: "prawo_jazdy",label: "Prawo jazdy",     icon: "🪪",  color: "#0ea5e9", group: "Kierowca" },
  { id: "karta_kierowcy",label: "Karta kierowcy",icon: "💳", color: "#64748b", group: "Kierowca" },
  { id: "inne",      label: "Inne",             icon: "📋",  color: "#9ca3af", group: "Inne" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
function LoginScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Nieprawidłowy email lub hasło");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9fb", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:40, width:360, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:40 }}>🚛</div>
          <h1 style={{ fontFamily:"DM Sans,sans-serif", fontWeight:700, fontSize:24, margin:"8px 0 4px" }}>FleetOS</h1>
          <p style={{ color:"#6b7280", fontSize:14 }}>Zarządzanie flotą</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}
              placeholder="twoj@email.com"
            />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>Hasło</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}
              placeholder="••••••••"
            />
          </div>
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", color:"#dc2626", fontSize:13, marginBottom:16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:"100%", padding:"12px", background:"#f59e0b", border:"none", borderRadius:8, fontWeight:700, fontSize:15, color:"#fff", cursor:"pointer" }}>
            {loading ? "Logowanie..." : "Zaloguj się"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT — auth wrapper
// ═══════════════════════════════════════════════════════════════════════════════
export default function Root() {
  const [user, setUser]         = useState(undefined); // undefined = loading
  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);
  if (user === undefined) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8f9fb",fontSize:32}}>🚛</div>;
  if (!user) return <LoginScreen />;
  return <App user={user} />;
}


function App({ user }) {
  const [tab, setTab]               = useState("dashboard");
  const [vehicles, setVehicles]     = useState([]);
  const [costs, setCosts]           = useState([]);
  const [categories, setCategories] = useState([]);
  const [docs, setDocs]             = useState([]);
  const [imiRecords, setImiRecords] = useState([]);
  const [rentRecords, setRentRecords] = useState([]);
  const [frachtyList, setFrachtyList] = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [toast, setToast]           = useState(null);
  const [eurRate, setEurRate]       = useState(null);
  const [eurRateDate, setEurRateDate] = useState(null);
  const [eurLoading, setEurLoading] = useState(true);

  const [showAddCost, setShowAddCost]         = useState(false);
  const [showAddVehicle, setShowAddVehicle]   = useState(false);
  const [editVehicleId, setEditVehicleId]     = useState(null);
  const [filterVehicle, setFilterVehicle]     = useState("all");
  const [filterCat, setFilterCat]             = useState("all");
  const [filterMonth, setFilterMonth]         = useState("all");

  // ── LOAD ──
  useEffect(() => {
    (async () => {
      const v  = await dbGet(SK.vehicles);
      const c  = await dbGet(SK.costs);
      const ca = await dbGet(SK.categories);
      const d  = await dbGet(SK.docs);
      const im = await dbGet(SK.imi);
      const rn = await dbGet(SK.rent);
      const fr = await dbGet(SK.frachty);
      setVehicles(v  || SEED_VEHICLES);
      setCosts(c     || SEED_COSTS);
      setCategories(ca || SEED_CATEGORIES);
      setDocs(d || []);
      setImiRecords(im || []);
      setRentRecords(rn || []);
      setFrachtyList(fr || []);
      setLoaded(true);
    })();
  }, []);

  // ── PERSIST ──
  useEffect(() => { if (loaded) dbSet(SK.vehicles, vehicles); },    [vehicles, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.costs, costs); },          [costs, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.categories, categories); },[categories, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.docs, docs); },            [docs, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.imi, imiRecords); },       [imiRecords, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.rent, rentRecords); },     [rentRecords, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.frachty, frachtyList); },  [frachtyList, loaded]);
  useEffect(() => { if (loaded) dbSet(SK.frachty, frachtyList); },  [frachtyList, loaded]);

  // ── EUR RATE (NBP API) ──
  useEffect(() => {
    (async () => {
      try {
        setEurLoading(true);
        const res  = await fetch("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json");
        const data = await res.json();
        setEurRate(data.rates[0].mid);
        setEurRateDate(data.rates[0].effectiveDate);
      } catch {
        setEurRate(4.25);
        setEurRateDate("kurs zastępczy");
      } finally {
        setEurLoading(false);
      }
    })();
  }, []);

  const toEUR = (pln) => eurRate ? pln / eurRate : null;
  const toPLN = (eur) => eurRate ? eur * eurRate : null;

  // ── ACTIONS ──
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const addCost      = (entry) => { setCosts((p) => [...p, { ...entry, id: uid() }]); showToast("✅ Koszt zapisany"); setShowAddCost(false); };
  const deleteCost   = (id)    => { setCosts((p) => p.filter((c) => c.id !== id)); showToast("Usunięto wpis"); };
  const addVehicle   = (v)     => { setVehicles((p) => [...p, { ...v, id: uid(), driverHistory: v.driverHistory || [] }]); showToast("🚛 Pojazd dodany"); setShowAddVehicle(false); };
  const delVehicle   = (id)    => { setVehicles((p) => p.filter((v) => v.id !== id)); setCosts((p) => p.filter((c) => c.vehicleId !== id)); showToast("Pojazd usunięty"); };
  const updateVehicle= (updated) => { setVehicles((p) => p.map((v) => v.id === updated.id ? updated : v)); showToast("✅ Zmiany zapisane"); setEditVehicleId(null); };
  const addCategory  = (cat)   => setCategories((p) => [...p, cat]);

  const catById  = (id) => categories.find((c) => c.id === id);
  const catColor = (id) => catById(id)?.color || "#94a3b8";
  const catLabel = (id) => { const c = catById(id); return c ? `${c.icon} ${c.label}` : id; };

  // current active driver for a vehicle
  const currentDriver = (v) => {
    const hist = v.driverHistory || [];
    return hist.find((d) => !d.to) || hist[hist.length - 1] || null;
  };

  // ── GET PLN VALUE ──
  const getPLN = (c) => c.currency === "EUR" ? (toPLN(c.amountEUR) || 0) : (c.amountPLN || 0);

  // ── STATS ──
  const stats = useMemo(() => {
    const rate      = eurRate || 4.25;
    const totalPLN  = costs.reduce((s, c) => s + getPLN(c), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthPLN  = costs.filter((c) => c.date?.startsWith(thisMonth)).reduce((s, c) => s + getPLN(c), 0);

    const byVehicle = vehicles.map((v) => {
      const vc = costs.filter((c) => c.vehicleId === v.id);
      const hist = v.driverHistory || [];
      const active = hist.find((d) => !d.to) || hist[hist.length - 1];
      return { ...v, total: vc.reduce((s, c) => s + getPLN(c), 0), count: vc.length, activeDriver: active?.name || "—" };
    });

    const byCategory = categories.map((cat) => ({
      ...cat,
      total: costs.filter((c) => c.category === cat.id).reduce((s, c) => s + getPLN(c), 0),
    })).filter((c) => c.total > 0);

    const monthMap = {};
    costs.forEach((c) => {
      const m = c.date?.slice(0, 7); if (!m) return;
      if (!monthMap[m]) monthMap[m] = { month: m, total: 0 };
      monthMap[m].total += getPLN(c);
    });
    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

    return { totalPLN, monthPLN, byVehicle, byCategory, monthly, rate };
  }, [costs, vehicles, categories, eurRate]);

  // ── FILTERED COSTS ──
  const filteredCosts = useMemo(() => costs.filter((c) => {
    if (filterVehicle !== "all" && c.vehicleId !== filterVehicle) return false;
    if (filterCat     !== "all" && c.category  !== filterCat)     return false;
    if (filterMonth   !== "all" && !c.date?.startsWith(filterMonth)) return false;
    return true;
  }).sort((a, b) => b.date?.localeCompare(a.date)), [costs, filterVehicle, filterCat, filterMonth]);

  const months = useMemo(() => {
    const s = new Set(costs.map((c) => c.date?.slice(0, 7)).filter(Boolean));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [costs]);

  const filteredTotal = filteredCosts.reduce((s, c) => s + getPLN(c), 0);

  // ── LOADING ──
  if (!loaded) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-base">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      Ładowanie danych…
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", color: "#111827" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{ background: "#111827", color: "#fff" }}>
          {toast}
        </div>
      )}

      {/* MODALS */}
      {showAddCost && (
        <AddCostModal
          vehicles={vehicles} categories={categories}
          eurRate={eurRate} eurRateDate={eurRateDate} eurLoading={eurLoading}
          toPLN={toPLN} toEUR={toEUR}
          onSave={addCost} onClose={() => setShowAddCost(false)}
          onAddCategory={addCategory}
        />
      )}
      {showAddVehicle && <AddVehicleModal onSave={addVehicle} onClose={() => setShowAddVehicle(false)} />}

      <div className="flex min-h-screen">

        {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 py-7 px-4 sticky top-0 h-screen">
          <div className="px-2 mb-8">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold">F</div>
              <span className="font-bold text-base text-gray-900">FleetOS</span>
            </div>
            <div className="text-xs text-gray-400 pl-9">Zarządzanie flotą</div>
          </div>

          <nav className="space-y-0.5 flex-1">
            {[
              { id: "dashboard", icon: "◈",  label: "Przegląd" },
              { id: "frachty",   icon: "🚚",  label: "Frachty" },
              { id: "costs",     icon: "≡",   label: "Koszty" },
              { id: "vehicles",  icon: "⊡",   label: "Pojazdy" },
              { id: "serwis",    icon: "🔧",  label: "Serwis" },
              { id: "rent",      icon: "📊",  label: "Rentowność" },
              { id: "docs",      icon: "🛡️",  label: "Dokumenty" },
              { id: "imi",       icon: "🌍",  label: "IMI / SIPSI" },
            ].map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-all"
                style={{
                  background:  tab === item.id ? "#f3f4f6" : "transparent",
                  color:       tab === item.id ? "#111827" : "#6b7280",
                  fontWeight:  tab === item.id ? 600 : 400,
                }}>
                <span className="text-base w-5 text-center opacity-70">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* EUR BADGE */}
          <div className="mx-1 mb-4 px-3 py-3 rounded-xl" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
            <div className="text-xs text-amber-600 font-medium mb-0.5">Kurs EUR/PLN · NBP</div>
            {eurLoading
              ? <div className="text-xs text-amber-400">Pobieranie…</div>
              : <>
                  <div className="font-bold text-amber-800 text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>1 € = {eurRate?.toFixed(4)} zł</div>
                  <div className="text-xs text-amber-500 mt-0.5">{eurRateDate}</div>
                </>
            }
          </div>

          <div className="space-y-2 px-1">
            <button onClick={() => setShowAddCost(true)}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "#111827" }}>
              + Dodaj koszt
            </button>
            <button onClick={() => setShowAddVehicle(true)}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:bg-gray-100"
              style={{ background: "#f3f4f6", color: "#374151" }}>
              + Dodaj pojazd
            </button>
            <div style={{ borderTop:"1px solid #f3f4f6", paddingTop:8, marginTop:4 }}>
              <div className="text-xs text-gray-400 px-1 mb-1 truncate">{user?.email}</div>
              <button onClick={() => signOut(auth)}
                className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:bg-red-50"
                style={{ color: "#ef4444", background: "transparent" }}>
                🚪 Wyloguj
              </button>
            </div>
          </div>
        </aside>

        {/* ── MAIN ──────────────────────────────────────────────────────── */}
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 overflow-y-auto">

          {/* Mobile header */}
          <div className="flex md:hidden items-center justify-between mb-5">
            <span className="font-bold text-lg text-gray-900">FleetOS</span>
            <div className="flex gap-1">
              {[["dashboard","◈"],["costs","≡"],["vehicles","⊡"],["docs","🛡️"],["imi","🌍"]].map(([id,icon]) => (
                <button key={id} onClick={() => setTab(id)}
                  className="w-9 h-9 rounded-lg text-sm flex items-center justify-center transition-all"
                  style={{ background: tab === id ? "#111827" : "#f3f4f6", color: tab === id ? "#fff" : "#6b7280" }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* ══ DASHBOARD ═══════════════════════════════════════════════════ */}
          {tab === "dashboard" && (
            <div>
              <PageTitle>Przegląd floty</PageTitle>

              {!eurLoading && (
                <div className="flex flex-wrap items-center gap-2 mb-5 px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                  <span>💱</span>
                  <span>Kurs NBP ({eurRateDate}): <strong>1 € = {eurRate?.toFixed(4)} zł</strong></span>
                  <span className="ml-auto text-xs text-amber-500 hidden sm:block">Kwoty EUR przeliczane automatycznie</span>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <KpiCard label="Łączne koszty"  value={fmtEUR(stats.totalPLN / stats.rate)}  sub={fmtPLN(stats.totalPLN)} accent="#111827" />
                <KpiCard label="Ten miesiąc"    value={fmtEUR(stats.monthPLN / stats.rate)}  sub={fmtPLN(stats.monthPLN)} accent="#f59e0b" />
                <KpiCard label="Pojazdy"        value={`${vehicles.length} szt.`} sub="w bazie" accent="#6366f1" />
                <KpiCard label="Wpisy kosztów"  value={`${costs.length} szt.`}    sub="wszystkie" accent="#10b981" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">
                <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-gray-100">
                  <div className="text-sm font-semibold text-gray-700 mb-4">Koszty miesięczne</div>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={stats.monthly} barSize={20}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", fontSize: "12px", fontFamily: "DM Sans" }}
                        formatter={(v) => [fmtPLN(v), "Koszty"]} />
                      <Bar dataKey="total" fill="#111827" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
                  <div className="text-sm font-semibold text-gray-700 mb-4">Struktura kosztów</div>
                  {stats.byCategory.length > 0 ? (
                    <div className="flex gap-4 items-center">
                      <ResponsiveContainer width={100} height={100}>
                        <PieChart>
                          <Pie data={stats.byCategory} cx={45} cy={45} innerRadius={27} outerRadius={46} dataKey="total" strokeWidth={0}>
                            {stats.byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {stats.byCategory.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                              <span className="text-xs text-gray-500 truncate">{c.icon} {c.label}</span>
                            </div>
                            <span className="text-xs font-semibold text-gray-800 whitespace-nowrap">{fmtPLN(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <div className="text-sm text-gray-400 mt-2">Brak danych</div>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-50">
                  <span className="text-sm font-semibold text-gray-700">Koszty per pojazd</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.byVehicle.sort((a, b) => b.total - a.total).map((v) => {
                    const pct = stats.totalPLN > 0 ? (v.total / stats.totalPLN) * 100 : 0;
                    return (
                      <div key={v.id} className="px-5 py-4">
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            <span className="font-normal text-gray-500 tracking-wide text-sm">{v.plate}</span>
                            <span className="text-xs text-gray-400 ml-2">{v.brand} · {v.activeDriver}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-gray-900">{fmtEUR(v.total / stats.rate)}</div>
                            <div className="text-xs text-gray-400">{fmtPLN(v.total)}</div>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "#111827" }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-gray-400">{v.count} wpisów</span>
                          <span className="text-xs text-gray-400">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ KOSZTY ══════════════════════════════════════════════════════ */}
          {tab === "costs" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <PageTitle>Rejestr kosztów</PageTitle>
                <button onClick={() => setShowAddCost(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#111827" }}>
                  + Dodaj koszt
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <FSel value={filterVehicle} onChange={setFilterVehicle}
                  options={[{ value: "all", label: "Wszystkie pojazdy" }, ...vehicles.map((v) => ({ value: v.id, label: v.plate }))]} />
                <FSel value={filterCat} onChange={setFilterCat}
                  options={[{ value: "all", label: "Wszystkie kategorie" }, ...categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))]} />
                <FSel value={filterMonth} onChange={setFilterMonth}
                  options={[{ value: "all", label: "Wszystkie miesiące" }, ...months.map((m) => ({ value: m, label: m }))]} />
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <span className="text-sm text-gray-500">Suma ({filteredCosts.length} wpisów)</span>
                <div>
                  <span className="font-bold text-gray-900">{fmtEUR(filteredTotal / stats.rate)}</span>
                  <span className="text-xs text-gray-400 ml-2">{fmtPLN(filteredTotal)}</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="hidden md:grid grid-cols-12 px-5 py-3 border-b border-gray-50 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <span className="col-span-2">Data</span>
                  <span className="col-span-2">Pojazd</span>
                  <span className="col-span-2">Kategoria</span>
                  <span className="col-span-3">Opis</span>
                  <span className="col-span-2 text-right">Kwota</span>
                  <span className="col-span-1"></span>
                </div>
                {filteredCosts.map((c, i) => {
                  const v      = vehicles.find((vv) => vv.id === c.vehicleId);
                  const amtPLN = getPLN(c);
                  const amtEUR = c.currency === "EUR" ? c.amountEUR : toEUR(c.amountPLN);
                  return (
                    <div key={c.id}
                      className="md:grid md:grid-cols-12 flex flex-wrap gap-y-1 px-5 py-3.5 items-center border-b border-gray-50 hover:bg-gray-50 transition-colors text-sm"
                      style={{ borderBottomColor: i === filteredCosts.length - 1 ? "transparent" : undefined }}>
                      <span className="col-span-2 text-gray-400 text-xs w-full md:w-auto" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtDate(c.date)}</span>
                      <span className="col-span-2 font-medium text-gray-800 text-xs">{v?.plate || "?"}</span>
                      <div className="col-span-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: catColor(c.category) + "18", color: catColor(c.category) }}>
                          {catLabel(c.category)}
                        </span>
                      </div>
                      <span className="col-span-3 text-gray-400 text-xs truncate">{c.note || "—"}{c.liters ? ` · ${c.liters} L` : ""}</span>
                      <div className="col-span-2 text-right">
                        <div className="font-semibold text-gray-900 text-sm">{fmtEUR(amtPLN / stats.rate)}</div>
                        {amtEUR != null && <div className="text-xs text-gray-400">{fmtPLN(amtPLN)}</div>}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => deleteCost(c.id)}
                          className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-xs">✕</button>
                      </div>
                    </div>
                  );
                })}
                {filteredCosts.length === 0 && (
                  <div className="px-5 py-10 text-center text-gray-400 text-sm">Brak wyników dla wybranych filtrów</div>
                )}
              </div>
            </div>
          )}

          {/* ══ POJAZDY ═════════════════════════════════════════════════════ */}
          {tab === "vehicles" && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <PageTitle>Flota pojazdów</PageTitle>
                <button onClick={() => setShowAddVehicle(true)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#111827" }}>
                  + Dodaj pojazd
                </button>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {vehicles.map((v) => {
                  const vc      = costs.filter((c) => c.vehicleId === v.id);
                  const total   = vc.reduce((s, c) => s + getPLN(c), 0);
                  const topCat  = categories.map((cat) => ({
                    ...cat, t: vc.filter((c) => c.category === cat.id).reduce((s, c) => s + getPLN(c), 0),
                  })).sort((a, b) => b.t - a.t)[0];
                  const hist    = v.driverHistory || [];
                  const active  = hist.find((d) => !d.to) || null;
                  const isEditing = editVehicleId === v.id;

                  return (
                    <div key={v.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      {/* ── VEHICLE HEADER ── */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
                            {v.plate2 ? "🚌" : "🚛"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-normal text-gray-500 tracking-wide text-sm">{v.plate}</span>
                              {v.plate2 && (
                                <>
                                  <span className="text-gray-300 text-xs">+</span>
                                  <span className="font-normal tracking-wide text-sm" style={{ color: "#6366f1" }}>{v.plate2}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "#eef2ff", color: "#6366f1" }}>przyczepa</span>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{v.brand} · {v.year} · {v.type}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditVehicleId(isEditing ? null : v.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                            style={{
                              background: isEditing ? "#111827" : "#f3f4f6",
                              color: isEditing ? "#fff" : "#6b7280",
                            }}>
                            {isEditing ? "Zamknij" : "✏️ Edytuj"}
                          </button>
                          <button onClick={() => delVehicle(v.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-xs">✕</button>
                        </div>
                      </div>

                      {/* ── STATS ROW ── */}
                      <div className="grid grid-cols-3 divide-x divide-gray-50 border-b border-gray-50">
                        <div className="px-4 py-3">
                          <div className="text-xs text-gray-400 mb-0.5">Łączne koszty</div>
                          <div className="font-bold text-gray-900 text-sm">{fmtEUR(total / stats.rate)}</div>
                          <div className="text-xs text-gray-400">{fmtPLN(total)}</div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="text-xs text-gray-400 mb-0.5">Wpisów</div>
                          <div className="font-bold text-gray-900 text-sm">{vc.length}</div>
                        </div>
                        <div className="px-4 py-3">
                          <div className="text-xs text-gray-400 mb-0.5">Rodzaj</div>
                          <div className="text-xs font-medium text-gray-700 leading-tight">
                            {v.type}{v.plate2 ? " + Przyczepa" : ""}
                            {(v.equipment||[]).includes("winda") ? " + winda" : ""}
                            {(v.equipment||[]).includes("paleciak") ? " + paleciak" : ""}
                          </div>
                        </div>
                      </div>

                      {/* ── TECH SPECS ── */}
                      <div className="px-5 py-3 border-b border-gray-50">
                        <div className="grid grid-cols-1 gap-1.5">
                          <div className={`grid gap-x-4 gap-y-1.5 ${v.plate2 ? "grid-cols-2" : "grid-cols-2"}`}>
                            {v.dimensions && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-20 flex-shrink-0">{v.plate2 ? `${v.plate} wym.` : "Wymiary"}</span>
                                <span className="text-xs font-medium text-gray-700" style={{ fontFamily: "'DM Mono', monospace" }}>{v.dimensions}</span>
                              </div>
                            )}
                            {v.maxWeight && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-20 flex-shrink-0">{v.plate2 ? `${v.plate} waga` : "Max waga"}</span>
                                <span className="text-xs font-medium text-gray-700">{v.maxWeight} kg</span>
                              </div>
                            )}
                          </div>
                          {v.plate2 && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1.5 mt-0.5 border-t border-dashed border-gray-100">
                              {v.dimensions2 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs w-20 flex-shrink-0" style={{ color: "#6366f1" }}>{v.plate2} wym.</span>
                                  <span className="text-xs font-medium text-gray-700" style={{ fontFamily: "'DM Mono', monospace" }}>{v.dimensions2}</span>
                                </div>
                              )}
                              {v.maxWeight2 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs w-20 flex-shrink-0" style={{ color: "#6366f1" }}>{v.plate2} waga</span>
                                  <span className="text-xs font-medium text-gray-700">{v.maxWeight2} kg</span>
                                </div>
                              )}
                            </div>
                          )}
                          {v.loadingType && (
                            <div className="flex items-center gap-2 pt-1">
                              <span className="text-xs text-gray-400 w-20 flex-shrink-0">Załadunek</span>
                              <span className="text-xs font-medium text-gray-700">{v.loadingType}</span>
                            </div>
                          )}
                        </div>
                        {/* WYPOSAŻENIE */}
                        {((v.equipment?.length > 0) || (v.customEquipment?.length > 0)) && (
                          <div className="mt-2.5 pt-2.5 border-t border-gray-50">
                            <div className="text-xs text-gray-400 mb-1.5">Wyposażenie</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(v.equipment || []).map((id) => {
                                const eq = DEFAULT_EQUIPMENT.find((e) => e.id === id);
                                return eq ? (
                                  <span key={id} className="px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ background: "#f3f4f6", color: "#374151" }}>
                                    {eq.label}
                                  </span>
                                ) : null;
                              })}
                              {(v.customEquipment || []).map((item, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ background: "#eff6ff", color: "#3b82f6" }}>
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── SERVICE & INSURANCE PANEL ── */}
                      <VehicleServicePanel vehicle={v} />

                      {/* ── CURRENT DRIVER ── */}
                      <DriverCopyRow vehicle={v} active={active} />

                      {/* ── EDIT PANEL ── */}
                      {isEditing && (
                        <VehicleEditPanel
                          vehicle={v}
                          onSave={updateVehicle}
                          onClose={() => setEditVehicleId(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          )}

          {/* ══ DOKUMENTY ══════════════════════════════════════════════════ */}
          {tab === "docs" && (
            <DocsTab
              docs={docs} vehicles={vehicles}
              onAdd={(d) => setDocs((p) => [...p, { ...d, id: uid() }])}
              onDelete={(id) => setDocs((p) => p.filter((d) => d.id !== id))}
              onEdit={(id, data) => setDocs((p) => p.map((d) => d.id === id ? { ...d, ...data } : d))}
            />
          )}

          {tab === "rent" && (
            <RentownoscTab
              vehicles={vehicles}
              records={rentRecords}
              onAdd={(r) => setRentRecords(p => [...p, { ...r, id: uid() }])}
              onUpdate={(id, data) => setRentRecords(p => p.map(r => r.id === id ? { ...r, ...data } : r))}
              onDelete={(id) => setRentRecords(p => p.filter(r => r.id !== id))}
            />
          )}

          {tab === "serwis" && (
            <ServisTab vehicles={vehicles} onUpdateVehicle={updateVehicle} />
          )}

          {tab === "frachty" && (
            <FrachtyTab
              frachtyList={frachtyList}
              vehicles={vehicles}
              onAdd={(r) => setFrachtyList(p => [{ ...r, id: uid() }, ...p])}
              onDelete={(id) => setFrachtyList(p => p.filter(r => r.id !== id))}
              onUpdate={(id, data) => setFrachtyList(p => p.map(r => r.id === id ? { ...r, ...data } : r))}
            />
          )}
          {tab === "frachty" && (
            <FrachtyTab
              frachtyList={frachtyList}
              vehicles={vehicles}
              onAdd={(r) => setFrachtyList(p => [{ ...r, id: uid() }, ...p])}
              onDelete={(id) => setFrachtyList(p => p.filter(r => r.id !== id))}
              onUpdate={(id, data) => setFrachtyList(p => p.map(r => r.id === id ? { ...r, ...data } : r))}
            />
          )}
          {tab === "imi" && (
            <ImiTab
              imiRecords={imiRecords}
              vehicles={vehicles}
              onAdd={(r) => setImiRecords(p => [...p, { ...r, id: uid() }])}
              onDelete={(id) => setImiRecords(p => p.filter(r => r.id !== id))}
            />
          )}

        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-100 flex px-3 py-2 gap-1">
        {[["dashboard","◈","Przegląd"],["frachty","🚚","Frachty"],["costs","≡","Koszty"],["vehicles","⊡","Pojazdy"],["serwis","🔧","Serwis"],["rent","📊","Rentow."],["docs","🛡️","Dok."],["imi","🌍","IMI"]].map(([id,icon,label]) => (
          <button key={id} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all"
            style={{ color: tab === id ? "#111827" : "#9ca3af", background: tab === id ? "#f3f4f6" : "transparent" }}>
            <span className="text-base">{icon}</span>
            <span className="text-xs">{label}</span>
          </button>
        ))}
        <button onClick={() => setShowAddCost(true)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg"
          style={{ color: "#fff", background: "#111827" }}>
          <span className="text-base">＋</span>
          <span className="text-xs">Dodaj</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMI / SIPSI TAB
// ═══════════════════════════════════════════════════════════════════════════════
const EU_COUNTRIES = [
  "Austria","Belgia","Bułgaria","Chorwacja","Cypr","Czechy","Dania","Estonia",
  "Finlandia","Francja","Grecja","Hiszpania","Holandia","Irlandia","Litwa",
  "Luksemburg","Łotwa","Malta","Niemcy","Polska","Portugalia","Rumunia",
  "Słowacja","Słowenia","Szwecja","Węgry","Włochy","Norwegia","Szwajcaria","UK",
];

function ImiTab({ imiRecords, vehicles, onAdd, onDelete }) {
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview]       = useState(null); // record to show full card
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterDriver, setFilterDriver]   = useState("");

  const filtered = imiRecords.filter(r => {
    if (filterCountry !== "all" && r.country !== filterCountry) return false;
    if (filterDriver && !(r.driverName||"").toLowerCase().includes(filterDriver.toLowerCase())) return false;
    return true;
  }).sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));

  const countries = [...new Set(imiRecords.map(r => r.country).filter(Boolean))];

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">IMI / SIPSI</h2>
          <p className="text-sm text-gray-400 mt-0.5">Delegowanie kierowców do krajów UE · {imiRecords.length} wpisów</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background:"#111827" }}>
          🤖 Wgraj dokument IMI
        </button>
      </div>

      {/* FILTERS */}
      {imiRecords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 outline-none bg-white text-gray-700">
            <option value="all">Wszystkie kraje</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700"><option value="">Wszyscy kierowcy</option>{[...new Set(imiRecords.map(r => r.driverName).filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      )}

      {/* RECORDS LIST */}
      <div className="space-y-3">
        {filtered.map(r => (
          <ImiCard key={r.id} record={r} vehicles={vehicles}
            onPreview={() => setPreview(r)}
            onDelete={() => onDelete(r.id)} />
        ))}
      </div>

      {imiRecords.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🌍</div>
          <div className="font-semibold text-gray-500 mb-1">Brak wpisów IMI/SIPSI</div>
          <div className="text-sm">Wgraj dokument — AI odczyta wszystkie dane automatycznie</div>
        </div>
      )}

      {showUpload && (
        <ImiUploadModal
          vehicles={vehicles}
          existingRecords={imiRecords}
          onSave={(r) => { onAdd(r); }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {preview && (
        <ImiPreviewModal record={preview} vehicles={vehicles} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function ImiCard({ record: r, vehicles, onPreview, onDelete }) {
  const vehicle = vehicles.find(v => v.id === r.vehicleId);
  const isActive = r.dateTo && new Date(r.dateTo) >= new Date();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-50"
        style={{ background: isActive ? "#f0fdf4" : "#f9fafb" }}>
        <span className="text-2xl">🌍</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{r.driverName || "—"}</span>
            {r.country && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background:"#eff6ff", color:"#1a3c8f" }}>🏳️ {r.country}</span>
            )}
            {isActive
              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:"#f0fdf4", color:"#16a34a" }}>● Aktywne</span>
              : r.dateTo && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:"#f3f4f6", color:"#9ca3af" }}>Zakończone</span>
            }
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {r.dateFrom && r.dateTo ? `${fmtDate(r.dateFrom)} — ${fmtDate(r.dateTo)}` : r.dateFrom ? `od ${fmtDate(r.dateFrom)}` : ""}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onPreview}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-gray-100"
            style={{ borderColor:"#e5e7eb", color:"#374151" }}>👁 Podgląd / Drukuj</button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-xs">✕</button>
        </div>
      </div>
      {/* info row — tylko kierowca, kraj, daty */}
      <div className="grid grid-cols-3 divide-x divide-gray-50 text-xs">
        <div className="px-4 py-2.5">
          <div className="text-gray-400 mb-0.5">Kierowca</div>
          <div className="font-medium text-gray-700">{r.driverName||"—"}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-gray-400 mb-0.5">Kraj delegowania</div>
          <div className="font-medium text-gray-700">{r.country||"—"}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-gray-400 mb-0.5">Okres</div>
          <div className="font-medium text-gray-700">
            {r.dateFrom && r.dateTo ? `${fmtDate(r.dateFrom)} — ${fmtDate(r.dateTo)}` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}


function buildImiHtml(r) {
  const fmtD = (d) => {
    if (!d) return "";
    const [y,m,day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  const period = (r.dateFrom && r.dateTo) ? `${fmtD(r.dateFrom)} - ${fmtD(r.dateTo)}` : (r.dateFrom ? fmtD(r.dateFrom) : "");
  const ops = [r.operationType, r.carriageType].filter(Boolean).join("<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Road Transport - Posting Declaration</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background:#fff; padding:24px; max-width:780px; margin:0 auto; }
  h1 { color:#1a3c8f; font-size:20px; font-weight:bold; text-align:center; margin-bottom:18px; line-height:1.3; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:0 24px; }
  .section { margin-bottom:10px; }
  .section-title { font-weight:bold; font-size:12px; text-align:center; border-bottom:2px solid #1a3c8f; padding-bottom:4px; margin-bottom:8px; }
  .row { display:flex; align-items:flex-start; margin-bottom:5px; gap:4px; }
  .lbl { color:#555; min-width:140px; flex-shrink:0; font-size:10.5px; }
  .val { color:#1a3c8f; font-size:10.5px; font-weight:500; }
  .plates-section { margin-top:14px; border-top:2px solid #1a3c8f; padding-top:8px; }
  .plates-title { font-weight:bold; font-size:12px; margin-bottom:5px; }
  .plates-val { color:#1a3c8f; font-size:10.5px; }
  .footer { margin-top:18px; font-size:9px; color:#666; border-top:1px solid #ddd; padding-top:6px; }
  @media print { body { padding:12px; } }
</style>
</head>
<body>
<h1>Road Transport - Posting<br>Declaration</h1>

<div class="grid2">
  <!-- LEFT: Posting information -->
  <div class="section">
    <div class="section-title">Posting information</div>
    <div class="row"><span class="lbl">a.1 Country of posting</span><span class="val">${r.country||""}</span></div>
    <div class="row"><span class="lbl">a.2 Period of posting</span><span class="val">${period}</span></div>
    <div class="row"><span class="lbl">a.3 Type of operation(s)</span><span class="val">${(r.operationType||"").replace(/\n/g,"<br>")}</span></div>
    <div class="row"><span class="lbl">a.4 Type of carriage(s)</span><span class="val">${r.carriageType||""}</span></div>
  </div>

  <!-- RIGHT: Company information -->
  <div class="section">
    <div class="section-title">Company information</div>
    <div class="row"><span class="lbl">e.1 Name</span><span class="val">${r.employer||""}</span></div>
    <div class="row"><span class="lbl">e.2 Email Address</span><span class="val">${r.employerEmail||""}</span></div>
    <div class="row"><span class="lbl">e.4 National company register number</span><span class="val">${r.employerVat||""}</span></div>
    <div class="row"><span class="lbl">e.6 Country of registration</span><span class="val">${r.employerCountry||""}</span></div>
    <div class="row"><span class="lbl">e.7 Address</span><span class="val">${(r.employerAddress||"").replace(/\n/g,"<br>")}</span></div>
  </div>
</div>

<!-- Declaration Details full width -->
<div class="section">
  <div class="section-title">Declaration Details</div>
  <div class="grid2">
    <div>
      <div class="row"><span class="lbl">b.1 Number of the declaration</span><span class="val">${r.delegationNumber||""}</span></div>
      <div class="row"><span class="lbl">b.2 Last update</span><span class="val">${r.lastUpdate||""}</span></div>
      <div class="row"><span class="lbl">b.3 Submission date</span><span class="val">${r.submissionDate||""}</span></div>
    </div>
  </div>
</div>

<div class="grid2">
  <!-- Driver Information -->
  <div class="section">
    <div class="section-title">Driver Information</div>
    <div class="row"><span class="lbl">c.1 Name</span><span class="val">${r.driverName||""}</span></div>
    <div class="row"><span class="lbl">c.3 Driving licence</span><span class="val">${r.driverLicence||""}</span></div>
    <div class="row"><span class="lbl">c.5 Address of residence</span><span class="val">${(r.driverAddress||"").replace(/\n/g,"<br>")}</span></div>
    <div class="row"><span class="lbl">c.6 Start date of employment contract</span><span class="val">${r.driverBirth||""}</span></div>
    <div class="row"><span class="lbl">c.7 Applicable law employment contract</span><span class="val">${r.driverNationality||""}</span></div>
  </div>

  <!-- Transport Manager Information -->
  <div class="section">
    <div class="section-title">Transport Manager Information</div>
    <div class="row"><span class="lbl">f.1 Name</span><span class="val">${r.managerName||""}</span></div>
    <div class="row"><span class="lbl">f.2 Email Address</span><span class="val">${r.managerEmail||""}</span></div>
    <div class="row"><span class="lbl">f.3 Phone number</span><span class="val">${r.managerPhone||""}</span></div>
    <div class="row"><span class="lbl">f.4 Professional Address</span><span class="val">${(r.managerAddress||"").replace(/\n/g,"<br>")}</span></div>
  </div>
</div>

<div class="grid2">
  <!-- Driver Identification Document -->
  <div class="section">
    <div class="section-title">Driver Identification Document</div>
    <div class="row"><span class="lbl">d.1 Document type</span><span class="val">${r.driverDocType||""}</span></div>
    <div class="row"><span class="lbl">d.2 Number</span><span class="val">${r.driverDocNumber||""}</span></div>
    <div class="row"><span class="lbl">d.5 Issuing country</span><span class="val">${r.driverDocCountry||""}</span></div>
  </div>

  <!-- Contact Person -->
  <div class="section">
    <div class="section-title">Contact Person</div>
    <div class="row"><span class="lbl">g.1 Name</span><span class="val">${r.contactName||""}</span></div>
    <div class="row"><span class="lbl">g.2 Email Address</span><span class="val">${r.contactEmail||""}</span></div>
    <div class="row"><span class="lbl">g.3 Phone number</span><span class="val">${r.contactPhone||""}</span></div>
    <div class="row"><span class="lbl">g.4 Address</span><span class="val">${r.contactAddress||""}</span></div>
  </div>
</div>

<!-- Number plates -->
<div class="plates-section">
  <div class="plates-title">Number plate(s) of the motor vehicle(s)</div>
  <div class="plates-val">${r.vehiclePlate||""}</div>
</div>

<div class="footer">Information about the data can be found here: https://postingdeclaration.eu/help</div>
</body>
</html>`;
}

function ImiPreviewModal({ record: r, vehicles, onClose }) {
  const html = buildImiHtml(r);
  const [opened, setOpened] = useState(false);

  const [showPrintView, setShowPrintView] = useState(false);

  const openInNewTab = () => setShowPrintView(true);

  // FULLSCREEN PRINT VIEW
  if (showPrintView) return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background:"#fff" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0 no-print"
        style={{ background:"#111827" }}>
        <span className="text-sm font-semibold text-white">🖨 Gotowy do druku — użyj Ctrl+P lub ⌘P</span>
        <div className="flex gap-2">
          <button
            onClick={() => { window.print(); }}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-gray-900 bg-amber-400 hover:bg-amber-300 transition-all">
            🖨 Drukuj / Zapisz PDF
          </button>
          <button onClick={() => setShowPrintView(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white border border-gray-600">
            ← Wróć
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <iframe
          srcDoc={html}
          className="w-full h-full"
          style={{ border:"none", minHeight:"calc(100vh - 52px)" }}
          title="IMI Print"
        />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)" }}>
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"92vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-sm font-bold text-gray-900">Road Transport - Posting Declaration</div>
            <div className="text-xs text-gray-400">{r.driverName} · {r.country} · {r.dateFrom && r.dateTo ? `${fmtDate(r.dateFrom)} — ${fmtDate(r.dateTo)}` : ""}</div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs ml-3 flex-shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <iframe
            srcDoc={html}
            className="w-full h-full rounded-xl border border-gray-100"
            style={{ minHeight:480 }}
            title="IMI Preview"
          />
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={openInNewTab}
            className="w-full py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-2"
            style={{ background:"#111827" }}>
            🖨 Otwórz widok drukowania → Ctrl+P / PDF
          </button>
          {opened && (
            <p className="text-xs text-center text-gray-400 mt-2">
              Użyj <strong>Ctrl+P</strong> (lub ⌘P) i wybierz <strong>„Zapisz jako PDF"</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


function ImiUploadModal({ vehicles, existingRecords, onSave, onClose }) {
  const [queue, setQueue] = useState([]);
  const [started, setStarted] = useState(false);
  const fileRef = useRef();

  const AI_PROMPT = `Extract all fields from this Road Transport - Posting Declaration and return JSON:
{
  "country": "a.1 Country of posting",
  "dateFrom": "a.2 start date YYYY-MM-DD",
  "dateTo": "a.2 end date YYYY-MM-DD",
  "operationType": "a.3 Type of operation(s)",
  "carriageType": "a.4 Type of carriage(s)",
  "delegationNumber": "b.1 Number of the declaration",
  "lastUpdate": "b.2 Last update",
  "submissionDate": "b.3 Submission date",
  "employer": "e.1 Name",
  "employerEmail": "e.2 Email Address",
  "employerVat": "e.4 National company register number",
  "employerCountry": "e.6 Country of registration",
  "employerAddress": "e.7 Address",
  "driverName": "c.1 Name",
  "driverLicence": "c.3 Driving licence",
  "driverAddress": "c.5 Address of residence",
  "driverBirth": "c.6 Start date of employment contract",
  "driverNationality": "c.7 Applicable law employment contract",
  "managerName": "f.1 Name",
  "managerEmail": "f.2 Email Address",
  "managerPhone": "f.3 Phone number",
  "managerAddress": "f.4 Professional Address",
  "driverDocType": "d.1 Document type",
  "driverDocNumber": "d.2 Number",
  "driverDocCountry": "d.5 Issuing country",
  "contactName": "g.1 Name",
  "contactEmail": "g.2 Email Address",
  "contactPhone": "g.3 Phone number",
  "contactAddress": "g.4 Address",
  "vehiclePlate": "all number plates comma separated"
}
Use null for missing fields.`;

  const AI_SYSTEM = `You are an expert at reading Road Transport Posting Declaration documents (IMI/SIPSI).
Extract ALL fields exactly as they appear. Return ONLY clean JSON, no text before or after.`;

  const isDuplicate = (parsed) => {
    return existingRecords.some(r => {
      if (parsed.delegationNumber && r.delegationNumber &&
          parsed.delegationNumber.trim() === r.delegationNumber.trim()) return true;
      if (parsed.driverName && r.driverName && parsed.country && r.country &&
          parsed.driverName.trim().toLowerCase() === r.driverName.trim().toLowerCase() &&
          parsed.country.trim().toLowerCase() === r.country.trim().toLowerCase() &&
          parsed.dateFrom === r.dateFrom && parsed.dateTo === r.dateTo) return true;
      return false;
    });
  };

  const analyzeFile = async (item) => {
    const { fileData, fileType, id } = item;
    const base64 = fileData.split(",")[1];
    const isPdf  = fileType === "application/pdf";

    const msgContent = isPdf
      ? [{ type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }, { type:"text", text:AI_PROMPT }]
      : [{ type:"image",    source:{ type:"base64", media_type:fileType, data:base64 } },            { type:"text", text:AI_PROMPT }];

    const res  = await fetch("/api/claude", {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, system:AI_SYSTEM, messages:[{ role:"user", content:msgContent }] }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error ${res.status}: ${errText.slice(0,200)}`);
    }
    const resp = await res.json();
    if (resp.error) throw new Error(resp.error.message || "API error");
    const txt  = resp.content?.map(c=>c.text||"").join("").trim().replace(/```json|```/g,"").trim();
    if (!txt) throw new Error("Pusta odpowiedź AI");
    let parsed;
    try { parsed = JSON.parse(txt); }
    catch(e) { throw new Error("Błąd parsowania JSON: " + txt.slice(0,100)); }
    return parsed;
  };

  const readFile = (file) => new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.readAsDataURL(file);
  });

  const addFiles = async (files) => {
    const allowed = ["application/pdf","image/jpeg","image/png","image/jpg","image/webp"];
    const items = [];
    for (const file of [...files]) {
      if (!allowed.includes(file.type) || file.size > 15*1024*1024) continue;
      const fileData = await readFile(file);
      items.push({ id: uid(), fileName: file.name, fileType: file.type, fileData, status:"pending" });
    }
    if (!items.length) return;
    setQueue(q => [...q, ...items]);
    setStarted(true);
    // process sequentially to avoid rate limits
    for (const item of items) {
      setQueue(q => q.map(x => x.id===item.id ? {...x, status:"analyzing"} : x));
      try {
        const parsed = await analyzeFile(item);
        if (isDuplicate(parsed)) {
          setQueue(q => q.map(x => x.id===item.id
            ? {...x, status:"duplicate", result: parsed}
            : x));
        } else {
          const record = {
            ...parsed,
            id: item.id,
            vehicleId: vehicles[0]?.id || "",
            createdAt: new Date().toISOString(),
            fileName: item.fileName,
          };
          onSave(record);
          setQueue(q => q.map(x => x.id===item.id ? {...x, status:"saved", result:parsed} : x));
        }
      } catch(e) {
        setQueue(q => q.map(x => x.id===item.id ? {...x, status:"error", error:String(e)} : x));
      }
    }
  };

  const handleDrop = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); };
  const allDone = queue.length > 0 && queue.every(x => ["saved","duplicate","error"].includes(x.status));
  const savedCount = queue.filter(x => x.status==="saved").length;
  const dupCount   = queue.filter(x => x.status==="duplicate").length;
  const errCount   = queue.filter(x => x.status==="error").length;

  const StatusIcon = ({ status }) => {
    if (status==="pending")   return <span className="text-gray-400 text-lg">⏸</span>;
    if (status==="analyzing") return <span className="text-lg animate-spin inline-block">⏳</span>;
    if (status==="saved")     return <span className="text-lg">✅</span>;
    if (status==="duplicate") return <span className="text-lg">♻️</span>;
    if (status==="error")     return <span className="text-lg">❌</span>;
    return null;
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background:"rgba(0,0,0,0.4)", backdropFilter:"blur(4px)" }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ fontFamily:"'DM Sans',sans-serif", maxHeight:"90vh" }}>

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">🌍 Import IMI/SIPSI</h3>
            <p className="text-xs text-gray-400 mt-0.5">Wiele plików naraz · AI odczytuje i zapisuje automatycznie</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* DROP ZONE */}
          <div
            onDrop={handleDrop} onDragOver={e=>e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="w-full py-8 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 cursor-pointer hover:bg-gray-50 transition-all"
            style={{ borderColor:"#d1d5db" }}>
            <input ref={fileRef} type="file" accept=".pdf,image/*" multiple
              onChange={e=>addFiles(e.target.files)} className="hidden" />
            <span className="text-3xl">📂</span>
            <span className="text-sm font-semibold text-gray-600">Przeciągnij pliki lub kliknij</span>
            <span className="text-xs text-gray-400">PDF, JPG, PNG · wiele plików naraz · maks. 15 MB/plik</span>
            <span className="text-xs text-gray-300">RAR/ZIP: wypakuj najpierw i wrzuć pliki PDF</span>
          </div>

          {/* QUEUE */}
          {queue.length > 0 && (
            <div className="space-y-2">
              {queue.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{
                    background: item.status==="saved"?"#f0fdf4": item.status==="duplicate"?"#fffbeb": item.status==="error"?"#fef2f2":"#f9fafb",
                    borderColor: item.status==="saved"?"#bbf7d0": item.status==="duplicate"?"#fde68a": item.status==="error"?"#fecaca":"#e5e7eb"
                  }}>
                  <StatusIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{item.fileName}</div>
                    <div className="text-xs mt-0.5" style={{
                      color: item.status==="saved"?"#16a34a": item.status==="duplicate"?"#d97706": item.status==="error"?"#dc2626":"#9ca3af"
                    }}>
                      {item.status==="pending"   && "Oczekuje…"}
                      {item.status==="analyzing" && "🤖 AI analizuje…"}
                      {item.status==="saved"     && `Zapisano · ${item.result?.driverName||""} · ${item.result?.country||""}`}
                      {item.status==="duplicate" && `Duplikat — pominięto · ${item.result?.driverName||""} (${item.result?.country||""} ${item.result?.dateFrom||""})`}
                      {item.status==="error"     && `❌ ${item.error || "Błąd odczytu"}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUMMARY */}
          {allDone && (
            <div className="rounded-xl p-4 space-y-1" style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0" }}>
              <div className="text-sm font-bold text-green-800">✅ Przetwarzanie zakończone</div>
              {savedCount>0 && <div className="text-xs text-green-700">• {savedCount} {savedCount===1?"dokument zapisany":"dokumenty zapisane"}</div>}
              {dupCount>0   && <div className="text-xs text-amber-600">• {dupCount} duplikat{dupCount===1?"":"y"} pominięt{dupCount===1?"y":"e"}</div>}
              {errCount>0   && <div className="text-xs text-red-500">• {errCount} błąd{errCount===1?"":"y"} — wgraj ręcznie</div>}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: allDone?"#111827":"#f3f4f6", color: allDone?"#fff":"#374151" }}>
            {allDone ? "Gotowe — zamknij" : "Anuluj"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// DOCS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function DocStatusBadge({ expiryDate }) {
  const d = daysUntil(expiryDate);
  if (d === null) return null;
  if (d < 0)   return <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background:"#fef2f2",color:"#dc2626" }}>⚠ Wygasło</span>;
  if (d <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background:"#fef2f2",color:"#dc2626" }}>🔴 {d} dni</span>;
  if (d <= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background:"#fffbeb",color:"#d97706" }}>🟡 {d} dni</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background:"#f0fdf4",color:"#16a34a" }}>🟢 {d} dni</span>;
}

function FilePreviewModal({ file, onClose }) {
  if (!file) return null;
  const isPdf = file.fileType === "application/pdf";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-screen flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-900 truncate">{file.fileName}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs ml-3 flex-shrink-0">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center" style={{ minHeight:400 }}>
          {isPdf
            ? <iframe src={file.fileData} className="w-full rounded-lg" style={{ height:520, border:"none" }} title={file.fileName} />
            : <img src={file.fileData} alt={file.fileName} className="max-w-full max-h-96 rounded-xl object-contain shadow" />
          }
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <a href={file.fileData} download={file.fileName}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white"
            style={{ background:"#111827" }}>
            ⬇ Pobierz
          </a>
        </div>
      </div>
    </div>
  );
}

function DocsTab({ docs, vehicles, onAdd, onDelete, onEdit }) {
  const [showAdd, setShowAdd]       = useState(false);
  const [editDoc, setEditDoc]           = useState(null);
  const [preview, setPreview]           = useState(null);
  const [filterV, setFilterV]           = useState("all");
  const [filterG, setFilterG]           = useState("all");
  const [showReminders, setShowReminders] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const filtered = docs.filter(d => {
    if (filterV !== "all" && d.vehicleId !== filterV) return false;
    const dt = DOC_TYPES.find(t => t.id === d.type);
    if (filterG !== "all" && dt?.group !== filterG) return false;
    return true;
  }).sort((a,b) => {
    const da = daysUntil(a.expiryDate) ?? 9999;
    const db = daysUntil(b.expiryDate) ?? 9999;
    return da - db;
  });

  const expiredCount = docs.filter(d => (daysUntil(d.expiryDate) ?? 1) < 0).length;
  const soon30       = docs.filter(d => { const x=daysUntil(d.expiryDate); return x!==null&&x>=0&&x<=30; }).length;
  const soon60       = docs.filter(d => { const x=daysUntil(d.expiryDate); return x!==null&&x>30&&x<=60; }).length;
  const groups       = [...new Set(DOC_TYPES.map(t => t.group))];

  // reminders: all docs with expiryDate, sorted
  const reminders = docs
    .filter(d => d.expiryDate)
    .map(d => ({
      ...d,
      days: daysUntil(d.expiryDate),
      vehicle: vehicles.find(v => v.id === d.vehicleId),
      dt: DOC_TYPES.find(t => t.id === d.type) || DOC_TYPES.at(-1),
    }))
    .sort((a,b) => a.days - b.days);

  const DocRow = ({ doc }) => {
    const dt = DOC_TYPES.find(t => t.id === doc.type) || DOC_TYPES.at(-1);
    const d  = daysUntil(doc.expiryDate);
    const isExpired = d !== null && d < 0;
    const isUrgent  = d !== null && d >= 0 && d <= 30;
    const hasFile   = !!doc.fileData;
    return (
      <div className="bg-white rounded-xl border flex gap-3 px-4 py-3 transition-all hover:shadow-sm"
        style={{ borderColor: isExpired?"#fecaca": isUrgent?"#fde68a":"#e5e7eb" }}>
        {/* icon */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5"
          style={{ background: dt.color+"18" }}>{dt.icon}</div>
        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{dt.label}</span>
            {doc.label && <span className="text-xs text-gray-400">· {doc.label}</span>}
            <DocStatusBadge expiryDate={doc.expiryDate} />
            {hasFile && (
              <button onClick={() => setPreview(doc)}
                className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 hover:opacity-80 transition-all"
                style={{ background:"#eff6ff", color:"#3b82f6" }}>
                {doc.fileType==="application/pdf" ? "📄" : "🖼️"} {doc.fileName || "Plik"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {doc.issueDate   && <span className="text-xs text-gray-400">Wystawiony: {fmtDate(doc.issueDate)}</span>}
            {doc.expiryDate  && <span className="text-xs font-medium text-gray-600">Ważny do: {fmtDate(doc.expiryDate)}</span>}
            {doc.insurer     && <span className="text-xs text-gray-400">🏢 {doc.insurer}</span>}
            {doc.policyNumber&& <span className="text-xs text-gray-400" style={{fontFamily:"'DM Mono',monospace"}}>#{doc.policyNumber}</span>}
            {doc.cost        && <span className="text-xs text-gray-400">💰 {Number(doc.cost).toLocaleString("pl-PL")} zł</span>}
          </div>
          {doc.notes && <div className="text-xs text-gray-400 mt-0.5 truncate italic">{doc.notes}</div>}
          {/* reminders */}
          {doc.reminders?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {doc.reminders.map((r,i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{ background:"#f5f3ff", color:"#7c3aed" }}>
                  🔔 {r.daysBefore} dni przed
                  {r.note && <span className="text-purple-300 font-normal">· {r.note}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => setEditDoc(doc)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all text-xs">✏️</button>
          <button onClick={() => onDelete(doc.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all text-xs">✕</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dokumenty & Ubezpieczenia</h2>
          <p className="text-sm text-gray-400 mt-0.5">{docs.length} dokumentów · {docs.filter(d=>d.fileData).length} z plikiem</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowBulkUpload(true)}
            className="px-3 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50 flex items-center gap-1.5"
            style={{ borderColor:"#e5e7eb", color:"#374151" }}>
            🤖 Wgraj z AI
          </button>
          <button onClick={() => setShowReminders(true)}
            className="relative px-3 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-gray-50"
            style={{ borderColor:"#e5e7eb", color:"#374151" }}>
            🔔 Przypomnienia
            {(expiredCount+soon30) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center font-bold"
                style={{ background:"#dc2626", fontSize:10 }}>{expiredCount+soon30}</span>
            )}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background:"#111827" }}>
            + Dodaj dokument
          </button>
        </div>
      </div>

      {/* ALERT STRIP */}
      {(expiredCount>0||soon30>0||soon60>0) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {expiredCount>0 && <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626"}}>⚠️ <strong>{expiredCount}</strong> {expiredCount===1?"dokument wygasł":"dokumenty wygasły"}</div>}
          {soon30>0      && <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{background:"#fef9c3",border:"1px solid #fde047",color:"#854d0e"}}>🔴 <strong>{soon30}</strong> wygasa w ciągu 30 dni</div>}
          {soon60>0      && <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{background:"#fffbeb",border:"1px solid #fde68a",color:"#92400e"}}>🟡 <strong>{soon60}</strong> wygasa w ciągu 60 dni</div>}
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={filterV} onChange={e=>setFilterV(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 outline-none bg-white text-gray-700">
          <option value="all">Wszystkie pojazdy</option>
          {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate}{v.plate2?` / ${v.plate2}`:""}</option>)}
        </select>
        <select value={filterG} onChange={e=>setFilterG(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 outline-none bg-white text-gray-700">
          <option value="all">Wszystkie typy</option>
          {groups.map(g=><option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* DOC LIST grouped by vehicle */}
      {vehicles.map(v => {
        const vDocs = filtered.filter(d => d.vehicleId === v.id);
        if (!vDocs.length) return null;
        return (
          <div key={v.id} className="mb-6">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{fontFamily:"'DM Mono',monospace"}}>
                {v.plate}{v.plate2?` / ${v.plate2}`:""}
              </span>
              <span className="text-xs text-gray-400">· {v.brand} {v.year}</span>
              <span className="text-xs text-gray-300">({vDocs.length})</span>
            </div>
            <div className="space-y-2">
              {vDocs.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </div>
          </div>
        );
      })}

      {/* docs without vehicle */}
      {(() => {
        const orphans = filtered.filter(d => !vehicles.find(v => v.id === d.vehicleId));
        if (!orphans.length) return null;
        return (
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Inne / bez pojazdu</div>
            <div className="space-y-2">{orphans.map(doc => <DocRow key={doc.id} doc={doc} />)}</div>
          </div>
        );
      })()}

      {docs.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">🛡️</div>
          <div className="font-semibold text-gray-500 mb-1">Brak dokumentów</div>
          <div className="text-sm">Kliknij „Dodaj dokument" — możesz też wgrać plik PDF lub zdjęcie</div>
        </div>
      )}

      {/* REMINDERS PANEL */}
      {showReminders && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background:"rgba(0,0,0,0.35)", backdropFilter:"blur(4px)" }}>
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-screen overflow-y-auto"
            style={{ fontFamily:"'DM Sans',sans-serif" }}>
            <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-base font-bold text-gray-900">🔔 Przypomnienia</h3>
              <button onClick={() => setShowReminders(false)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {reminders.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Brak dokumentów z datą ważności</p>}
              {reminders.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: r.days<0?"#fef2f2": r.days<=30?"#fef9c3": r.days<=60?"#fffbeb":"#f9fafb",
                           border: `1px solid ${r.days<0?"#fecaca":r.days<=30?"#fde047":r.days<=60?"#fde68a":"#e5e7eb"}` }}>
                  <span className="text-xl">{r.dt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.dt.label}{r.label?` · ${r.label}`:""}</div>
                    <div className="text-xs text-gray-500">{r.vehicle?.plate||"—"} · ważny do {fmtDate(r.expiryDate)}</div>
                    {r.reminders?.map((rem,i) => (
                      <div key={i} className="text-xs mt-0.5" style={{color:"#7c3aed"}}>🔔 {rem.daysBefore} dni przed{rem.note?` · ${rem.note}`:""}</div>
                    ))}
                  </div>
                  <DocStatusBadge expiryDate={r.expiryDate} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD */}
      {showBulkUpload && (
        <BulkUploadModal
          vehicles={vehicles}
          onSave={(docs) => { docs.forEach(d => onAdd(d)); setShowBulkUpload(false); }}
          onClose={() => setShowBulkUpload(false)}
        />
      )}

      {/* ADD / EDIT MODAL */}
      {(showAdd || editDoc) && (
        <AddDocModal
          vehicles={vehicles} doc={editDoc}
          onSave={(data) => {
            if (editDoc) { onEdit(editDoc.id, data); setEditDoc(null); }
            else { onAdd(data); setShowAdd(false); }
          }}
          onClose={() => { setShowAdd(false); setEditDoc(null); }}
        />
      )}

      {/* FILE PREVIEW */}
      {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK UPLOAD MODAL — multi-file + AI extraction
// ═══════════════════════════════════════════════════════════════════════════════
function BulkUploadModal({ vehicles, onSave, onClose }) {
  const [queue, setQueue]   = useState([]); // [{id, fileName, fileType, fileData, status, extracted, edited}]
  const [saving, setSaving] = useState(false);
  const dropRef  = useRef();
  const fileRef  = useRef();

  const readFile = (file) => new Promise((res) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.readAsDataURL(file);
  });

  const addFiles = async (files) => {
    const allowed = ["application/pdf","image/jpeg","image/png","image/jpg","image/webp"];
    const items = [];
    for (const file of files) {
      if (!allowed.includes(file.type)) continue;
      if (file.size > 8 * 1024 * 1024) continue;
      const fileData = await readFile(file);
      items.push({ id: uid(), fileName: file.name, fileType: file.type, fileData, status: "pending", extracted: null, edited: null });
    }
    setQueue(q => [...q, ...items]);
    // kick off AI extraction for each
    items.forEach(item => extractWithAI(item));
  };

  const extractWithAI = async (item) => {
    setQueue(q => q.map(x => x.id===item.id ? {...x, status:"analyzing"} : x));
    try {
      const isPdf = item.fileType === "application/pdf";
      const mediaType = item.fileType;
      const base64 = item.fileData.split(",")[1];

      const systemPrompt = `Jesteś asystentem do rozpoznawania dokumentów transportowych i ubezpieczeniowych.
Analizujesz obrazy/PDF i zwracasz JSON z polami dokumentu.
Zawsze odpowiadaj TYLKO czystym JSON bez żadnego tekstu przed ani po.
Typy dokumentów (pole "type"): oc, ac, gap, nnw, assistance, cargo, licencja, zezwolenie, przeglad, tachlegalizacja, prawo_jazdy, karta_kierowcy, inne
Format daty: YYYY-MM-DD`;

      const userPrompt = `Przeanalizuj ten dokument i zwróć JSON z następującymi polami (jeśli nieznane, użyj null):
{
  "type": "typ dokumentu z listy",
  "label": "krótki opis np. OC Warta 2025",
  "issueDate": "data wystawienia YYYY-MM-DD lub null",
  "expiryDate": "data ważności YYYY-MM-DD lub null",
  "insurer": "nazwa ubezpieczyciela / organu lub null",
  "policyNumber": "numer polisy/dokumentu lub null",
  "cost": "kwota w PLN jako liczba lub null",
  "notes": "krótka notatka lub null",
  "confidence": "high/medium/low"
}`;

      const contentParts = isPdf
        ? [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: userPrompt }
          ]
        : [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: userPrompt }
          ];

      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: contentParts }],
        }),
      });
      if (!res.ok) { const e = await res.text(); throw new Error(`API ${res.status}: ${e.slice(0,200)}`); }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "API error");
      const text = data.content?.map(c => c.text||"").join("").trim();
      if (!text) throw new Error("Pusta odpowiedź AI");
      const clean = text.replace(/```json|```/g,"").trim();
      let parsed;
      try { parsed = JSON.parse(clean); } catch(e) { throw new Error("JSON parse error: " + clean.slice(0,100)); }

      const extracted = {
        vehicleId:    vehicles[0]?.id || "",
        type:         parsed.type         || "inne",
        label:        parsed.label        || "",
        issueDate:    parsed.issueDate     || "",
        expiryDate:   parsed.expiryDate    || "",
        insurer:      parsed.insurer       || "",
        policyNumber: parsed.policyNumber  || "",
        cost:         parsed.cost ? String(parsed.cost) : "",
        notes:        parsed.notes         || "",
        confidence:   parsed.confidence    || "low",
        reminders:    [],
        fileData:     item.fileData,
        fileName:     item.fileName,
        fileType:     item.fileType,
      };
      setQueue(q => q.map(x => x.id===item.id ? {...x, status:"done", extracted, edited:{...extracted}} : x));
    } catch(e) {
      setQueue(q => q.map(x => x.id===item.id ? {...x, status:"error"} : x));
    }
  };

  const updateEdited = (id, field, val) => {
    setQueue(q => q.map(x => x.id===id ? {...x, edited:{...x.edited,[field]:val}} : x));
  };

  const removeItem = (id) => setQueue(q => q.filter(x => x.id!==id));

  const handleDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const readyItems = queue.filter(x => x.status==="done" && x.edited);
  const allDone    = queue.length > 0 && queue.every(x => x.status==="done" || x.status==="error");

  const handleSaveAll = () => {
    setSaving(true);
    onSave(readyItems.map(x => ({ ...x.edited, id: x.id })));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background:"rgba(0,0,0,0.45)", backdropFilter:"blur(5px)" }}>
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ fontFamily:"'DM Sans',sans-serif", maxHeight:"92vh" }}>

        {/* HEADER */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">🤖 Wgraj dokumenty z AI</h3>
            <p className="text-xs text-gray-400 mt-0.5">AI automatycznie odczyta dane — Ty potwierdzasz przed zapisem</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* DROP ZONE */}
          <div ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="w-full py-10 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 cursor-pointer transition-all hover:bg-gray-50"
            style={{ borderColor:"#d1d5db" }}>
            <input ref={fileRef} type="file" accept=".pdf,image/*" multiple onChange={e => addFiles(e.target.files)} className="hidden" />
            <span className="text-4xl">📂</span>
            <span className="text-sm font-semibold text-gray-600">Przeciągnij pliki tutaj lub kliknij</span>
            <span className="text-xs text-gray-400">PDF, JPG, PNG · maks. 8 MB / plik · wiele plików naraz</span>
          </div>

          {/* QUEUE */}
          {queue.map(item => {
            const dt = DOC_TYPES.find(t => t.id === item.edited?.type) || DOC_TYPES.at(-1);
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                {/* file header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50"
                  style={{ background: item.status==="error" ? "#fef2f2" : item.status==="analyzing" ? "#f5f3ff" : "#f9fafb" }}>
                  <span className="text-xl">{item.fileType==="application/pdf" ? "📄" : "🖼️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{item.fileName}</div>
                    <div className="text-xs mt-0.5">
                      {item.status==="pending"   && <span className="text-gray-400">Oczekuje…</span>}
                      {item.status==="analyzing" && <span style={{color:"#7c3aed"}}>🤖 AI analizuje…</span>}
                      {item.status==="done"      && <span style={{color:"#16a34a"}}>✓ Odczytano · pewność: <strong>{item.extracted?.confidence}</strong></span>}
                      {item.status==="error"     && <span style={{color:"#dc2626"}}>⚠ Błąd — wypełnij ręcznie</span>}
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>

                {/* editable fields */}
                {(item.status==="done" || item.status==="error") && item.edited && (
                  <div className="px-4 py-4 grid grid-cols-2 gap-3">
                    {/* pojazd */}
                    <div className="col-span-2">
                      <MF label="Pojazd">
                        <MSelect value={item.edited.vehicleId} onChange={v => updateEdited(item.id,"vehicleId",v)}>
                          <option value="">— bez pojazdu —</option>
                          {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}{v.plate2?` / ${v.plate2}`:""} · {v.brand}</option>)}
                        </MSelect>
                      </MF>
                    </div>
                    {/* typ */}
                    <div className="col-span-2">
                      <MF label="Typ dokumentu">
                        <div className="flex flex-wrap gap-1.5">
                          {DOC_TYPES.map(t => (
                            <button key={t.id} onClick={() => updateEdited(item.id,"type",t.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: item.edited.type===t.id ? t.color+"20" : "#f3f4f6",
                                border: `1.5px solid ${item.edited.type===t.id ? t.color : "#e5e7eb"}`,
                                color: item.edited.type===t.id ? t.color : "#6b7280",
                              }}>{t.icon} {t.label}</button>
                          ))}
                        </div>
                      </MF>
                    </div>
                    <MF label="Opis"><MInput value={item.edited.label} onChange={v=>updateEdited(item.id,"label",v)} placeholder="np. OC Warta 2025" /></MF>
                    <MF label="Ubezpieczyciel"><MInput value={item.edited.insurer} onChange={v=>updateEdited(item.id,"insurer",v)} placeholder="np. PZU" /></MF>
                    <MF label="Wystawiony"><MInput type="date" value={item.edited.issueDate} onChange={v=>updateEdited(item.id,"issueDate",v)} /></MF>
                    <MF label="Ważny do"><MInput type="date" value={item.edited.expiryDate} onChange={v=>updateEdited(item.id,"expiryDate",v)} /></MF>
                    <MF label="Nr polisy"><MInput value={item.edited.policyNumber} onChange={v=>updateEdited(item.id,"policyNumber",v)} placeholder="POL/..." /></MF>
                    <MF label="Koszt (zł)"><MInput type="number" value={item.edited.cost} onChange={v=>updateEdited(item.id,"cost",v)} /></MF>
                  </div>
                )}

                {/* analyzing spinner */}
                {item.status==="analyzing" && (
                  <div className="px-4 py-6 flex items-center justify-center gap-3 text-sm text-purple-600">
                    <span className="animate-spin text-xl">⏳</span> Odczytuję dokument…
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* FOOTER */}
        {queue.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {readyItems.length} z {queue.length} gotowych do zapisu
            </span>
            <button
              onClick={handleSaveAll}
              disabled={readyItems.length===0 || saving || !allDone}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
              style={{ background:"#111827" }}>
              {saving ? "Zapisywanie…" : `Zapisz ${readyItems.length} dokumentów`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: ADD / EDIT DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════════
function AddDocModal({ vehicles, doc, onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    vehicleId:    doc?.vehicleId    || vehicles[0]?.id || "",
    type:         doc?.type         || "oc",
    label:        doc?.label        || "",
    issueDate:    doc?.issueDate    || today,
    expiryDate:   doc?.expiryDate   || "",
    insurer:      doc?.insurer      || "",
    policyNumber: doc?.policyNumber || "",
    cost:         doc?.cost         || "",
    notes:        doc?.notes        || "",
    fileData:     doc?.fileData     || null,
    fileName:     doc?.fileName     || "",
    fileType:     doc?.fileType     || "",
    reminders:    doc?.reminders    || [],
  });
  const [uploading, setUploading]   = useState(false);
  const [newRemDays, setNewRemDays] = useState("30");
  const [newRemNote, setNewRemNote] = useState("");
  const fileRef = useRef();
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const groups = [...new Set(DOC_TYPES.map(t => t.group))];

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf","image/jpeg","image/png","image/jpg","image/webp"];
    if (!allowed.includes(file.type)) { alert("Dozwolone formaty: PDF, JPG, PNG"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Maks. rozmiar pliku: 5 MB"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      set("fileData", ev.target.result);
      set("fileName", file.name);
      set("fileType", file.type);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const addReminder = () => {
    const days = parseInt(newRemDays);
    if (!days || days < 1) return;
    set("reminders", [...form.reminders, { daysBefore: days, note: newRemNote.trim() }]);
    setNewRemDays("30");
    setNewRemNote("");
  };

  const removeReminder = (i) => set("reminders", form.reminders.filter((_,idx) => idx !== i));

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background:"rgba(0,0,0,0.35)", backdropFilter:"blur(4px)" }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-y-auto"
        style={{ fontFamily:"'DM Sans',sans-serif", maxHeight:"95vh" }}>
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold text-gray-900">{doc ? "Edytuj dokument" : "Nowy dokument"}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Pojazd */}
          <MF label="Pojazd">
            <MSelect value={form.vehicleId} onChange={v => set("vehicleId", v)}>
              <option value="">— bez pojazdu —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}{v.plate2?` / ${v.plate2}`:""} · {v.brand}</option>)}
            </MSelect>
          </MF>

          {/* Typ */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Typ dokumentu</div>
            {groups.map(group => (
              <div key={group} className="mb-3">
                <div className="text-xs text-gray-400 mb-1.5">{group}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DOC_TYPES.filter(t => t.group === group).map(dt => (
                    <button key={dt.id} onClick={() => set("type", dt.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all"
                      style={{
                        background: form.type===dt.id ? dt.color+"18" : "#f9fafb",
                        border: `1.5px solid ${form.type===dt.id ? dt.color : "#e5e7eb"}`,
                        color: form.type===dt.id ? dt.color : "#6b7280",
                      }}>
                      <span>{dt.icon}</span>{dt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Opis + daty */}
          <MF label="Własny opis (opcjonalnie)">
            <MInput placeholder="np. OC Warta 2025/2026" value={form.label} onChange={v => set("label", v)} />
          </MF>
          <div className="grid grid-cols-2 gap-3">
            <MF label="Data wystawienia"><MInput type="date" value={form.issueDate} onChange={v => set("issueDate", v)} /></MF>
            <MF label="Ważny do ⚠️"><MInput type="date" value={form.expiryDate} onChange={v => set("expiryDate", v)} /></MF>
          </div>

          {/* Ubezpieczyciel / nr polisy / koszt */}
          <div className="grid grid-cols-2 gap-3">
            <MF label="Ubezpieczyciel / organ"><MInput placeholder="np. Warta, PZU, WORD" value={form.insurer} onChange={v => set("insurer", v)} /></MF>
            <MF label="Nr polisy / dokumentu"><MInput placeholder="np. POL/123456" value={form.policyNumber} onChange={v => set("policyNumber", v)} /></MF>
          </div>
          <MF label="Koszt (zł)"><MInput type="number" placeholder="np. 1200" value={form.cost} onChange={v => set("cost", v)} /></MF>
          <MF label="Notatki"><MInput placeholder="dodatkowe informacje..." value={form.notes} onChange={v => set("notes", v)} /></MF>

          {/* PLIK */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">📎 Załącznik</div>
            {form.fileData ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
                <span className="text-2xl">{form.fileType==="application/pdf" ? "📄" : "🖼️"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{form.fileName}</div>
                  <div className="text-xs text-gray-400">{form.fileType}</div>
                </div>
                <button onClick={() => { set("fileData",null); set("fileName",""); set("fileType",""); }}
                  className="text-xs text-red-400 hover:text-red-600 font-medium">Usuń</button>
              </div>
            ) : (
              <div>
                <input ref={fileRef} type="file" accept=".pdf,image/*" onChange={handleFile} className="hidden" />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all hover:bg-gray-50"
                  style={{ borderColor:"#d1d5db", color:"#9ca3af" }}>
                  {uploading
                    ? <><span className="text-2xl">⏳</span><span className="text-sm">Ładowanie…</span></>
                    : <><span className="text-2xl">📂</span><span className="text-sm font-medium text-gray-500">Kliknij aby wybrać plik</span><span className="text-xs">PDF, JPG, PNG · maks. 5 MB</span></>
                  }
                </button>
              </div>
            )}
          </div>

          {/* PRZYPOMNIENIA */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🔔 Przypomnienia</div>
            {form.reminders.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.reminders.map((r,i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl border"
                    style={{ background:"#f5f3ff", borderColor:"#ddd6fe" }}>
                    <span className="text-sm">🔔</span>
                    <span className="text-xs font-semibold text-purple-700">{r.daysBefore} dni przed wygaśnięciem</span>
                    {r.note && <span className="text-xs text-purple-400 flex-1 truncate">· {r.note}</span>}
                    <button onClick={() => removeReminder(i)} className="text-xs text-purple-300 hover:text-red-400 ml-auto">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <MF label="Dni przed">
                <MSelect value={newRemDays} onChange={v => setNewRemDays(v)}>
                  {["7","14","30","60","90"].map(d => <option key={d} value={d}>{d} dni</option>)}
                </MSelect>
              </MF>
              <div className="flex-1">
                <MF label="Notatka (opcjonalnie)">
                  <MInput placeholder="np. odnowić OC" value={newRemNote} onChange={v => setNewRemNote(v)} />
                </MF>
              </div>
              <button onClick={addReminder}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0 mb-0.5"
                style={{ background:"#7c3aed" }}>
                + Dodaj
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Przypomnienia widoczne w panelu 🔔 gdy zbliża się termin.</p>
          </div>
        </div>

        <div className="px-6 pb-6 sticky bottom-0 bg-white pt-2 border-t border-gray-50">
          <button onClick={() => onSave(form)} disabled={!form.type}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
            style={{ background:"#111827" }}>
            {doc ? "Zapisz zmiany" : "Dodaj dokument"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: ADD COST
// ═══════════════════════════════════════════════════════════════════════════════
function AddCostModal({ vehicles, categories, eurRate, eurRateDate, eurLoading, toPLN, toEUR, onSave, onClose, onAddCategory }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    vehicleId: vehicles[0]?.id || "",
    category:  categories[0]?.id || "",
    currency:  "PLN",
    amountPLN: "",
    amountEUR: "",
    date:      today,
    note:      "",
    liters:    "",
  });
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat]         = useState({ label: "", icon: "📋", color: PALETTE[0] });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleAmountChange = (field, val) => {
    if (field === "amountPLN") {
      set("amountPLN", val);
      if (eurRate && val !== "") set("amountEUR", (parseFloat(val || 0) / eurRate).toFixed(2));
      else set("amountEUR", "");
    } else {
      set("amountEUR", val);
      if (eurRate && val !== "") set("amountPLN", (parseFloat(val || 0) * eurRate).toFixed(2));
      else set("amountPLN", "");
    }
  };

  const handleSaveNewCat = () => {
    if (!newCat.label.trim()) return;
    const id = newCat.label.toLowerCase().replace(/\s+/g, "_") + "_" + Math.random().toString(36).slice(2, 5);
    onAddCategory({ id, label: newCat.label.trim(), icon: newCat.icon || "📋", color: newCat.color });
    set("category", id);
    setShowNewCat(false);
    setNewCat({ label: "", icon: "📋", color: PALETTE[0] });
  };

  const handleSave = () => {
    if (!form.vehicleId || (!form.amountPLN && !form.amountEUR)) return;
    onSave({
      vehicleId: form.vehicleId,
      category:  form.category,
      currency:  form.currency,
      amountPLN: form.amountPLN ? parseFloat(form.amountPLN) : (toPLN(parseFloat(form.amountEUR)) || 0),
      amountEUR: form.amountEUR ? parseFloat(form.amountEUR) : (toEUR(parseFloat(form.amountPLN)) || null),
      date:      form.date,
      note:      form.note,
      liters:    form.liters ? parseFloat(form.liters) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-y-auto"
        style={{ fontFamily: "'DM Sans', sans-serif", maxHeight: "95vh" }}>

        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold text-gray-900">Nowy koszt</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all text-xs">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* POJAZD */}
          <MF label="Pojazd">
            <MSelect value={form.vehicleId} onChange={(v) => set("vehicleId", v)}>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate} – {v.brand}</option>)}
            </MSelect>
          </MF>

          {/* KATEGORIA */}
          <MF label="Kategoria">
            <div className="flex gap-2">
              <div className="flex-1">
                <MSelect value={form.category} onChange={(v) => set("category", v)}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                </MSelect>
              </div>
              <button onClick={() => setShowNewCat((p) => !p)}
                className="px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  border:     `1px solid ${showNewCat ? "#111827" : "#e5e7eb"}`,
                  color:      showNewCat ? "#fff" : "#6b7280",
                  background: showNewCat ? "#111827" : "#fff",
                }}>
                {showNewCat ? "Anuluj" : "+ Nowa"}
              </button>
            </div>
          </MF>

          {/* INLINE NEW CATEGORY */}
          {showNewCat && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dodaj nową kategorię</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <MF label="Nazwa kategorii">
                    <MInput placeholder="np. Myjnia" value={newCat.label} onChange={(v) => setNewCat((p) => ({ ...p, label: v }))} />
                  </MF>
                </div>
                <MF label="Ikona (emoji)">
                  <MInput placeholder="🚿" value={newCat.icon} onChange={(v) => setNewCat((p) => ({ ...p, icon: v }))} />
                </MF>
              </div>
              <MF label="Kolor">
                <div className="flex gap-2 flex-wrap mt-1">
                  {PALETTE.map((col) => (
                    <button key={col} onClick={() => setNewCat((p) => ({ ...p, color: col }))}
                      className="w-6 h-6 rounded-full transition-all"
                      style={{ background: col, outline: newCat.color === col ? `2px solid ${col}` : "none", outlineOffset: "2px", opacity: newCat.color === col ? 1 : 0.5 }} />
                  ))}
                </div>
              </MF>
              <button onClick={handleSaveNewCat} disabled={!newCat.label.trim()}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-30 transition-all"
                style={{ background: "#111827" }}>
                Dodaj kategorię
              </button>
            </div>
          )}

          {/* DATA */}
          <MF label="Data operacji">
            <MInput type="date" value={form.date} onChange={(v) => set("date", v)} />
          </MF>

          {/* WALUTA TOGGLE */}
          <MF label="Waluta wprowadzania">
            <div className="flex gap-2">
              {["PLN", "EUR"].map((cur) => (
                <button key={cur} onClick={() => { set("currency", cur); set("amountPLN",""); set("amountEUR",""); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all"
                  style={{
                    background: form.currency === cur ? "#111827" : "#fff",
                    color:      form.currency === cur ? "#fff" : "#6b7280",
                    border:     `1px solid ${form.currency === cur ? "#111827" : "#e5e7eb"}`,
                  }}>
                  {cur === "PLN" ? "🇵🇱 PLN (zł)" : "🇪🇺 EUR (€)"}
                </button>
              ))}
            </div>
          </MF>

          {/* KWOTY */}
          <div className="grid grid-cols-2 gap-3">
            <MF label="Kwota w złotych (zł)">
              <MInput type="number" placeholder="0.00" value={form.amountPLN}
                onChange={(v) => handleAmountChange("amountPLN", v)}
                highlight={form.currency === "PLN"} />
            </MF>
            <MF label={`Kwota EUR${!eurLoading && eurRate ? ` (1€ = ${eurRate.toFixed(2)} zł)` : ""}`}>
              <MInput type="number" placeholder="0.00" value={form.amountEUR}
                onChange={(v) => handleAmountChange("amountEUR", v)}
                highlight={form.currency === "EUR"} />
            </MF>
          </div>
          {!eurLoading && (
            <p className="text-xs text-gray-400 -mt-2">
              💱 Kurs NBP z dnia {eurRateDate} · przeliczanie obustronnie automatyczne
            </p>
          )}

          {/* LITRY */}
          <MF label="Litry (opcjonalnie, dla paliwa)">
            <MInput type="number" placeholder="np. 450" value={form.liters} onChange={(v) => set("liters", v)} />
          </MF>

          {/* OPIS */}
          <MF label="Opis / notatka">
            <MInput placeholder="np. tankowanie DE–PL" value={form.note} onChange={(v) => set("note", v)} />
          </MF>
        </div>

        <div className="px-6 pb-6 sticky bottom-0 bg-white pt-2 border-t border-gray-50">
          <button onClick={handleSave}
            disabled={!form.vehicleId || (!form.amountPLN && !form.amountEUR)}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
            style={{ background: "#111827" }}>
            Zapisz koszt
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER COPY ROW
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SERWIS TAB
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// RENTOWNOŚĆ TAB
// ═══════════════════════════════════════════════════════════════════════════════

const RENT_COSTS = [
  { id: "paliwo",     label: "Paliwo",              icon: "⛽" },
  { id: "leasing",    label: "Leasing",              icon: "🏦" },
  { id: "wyplata",    label: "Wypłata kierowcy",     icon: "👤" },
  { id: "zus",        label: "ZUS + podatki",        icon: "📋" },
  { id: "serwis",     label: "Serwis",               icon: "🔧" },
  { id: "polisa",     label: "Polisa / OC / AC",     icon: "🛡️" },
  { id: "etoll",      label: "E-toll / Autostrady",  icon: "🛣️" },
  { id: "mandaty",    label: "Mandaty",              icon: "⚠️" },
  { id: "hotele",     label: "Hotele",               icon: "🏨" },
  { id: "nego",       label: "Nego",                 icon: "🤝" },
  { id: "imi",        label: "IMI / SIPSI",          icon: "🌍" },
  { id: "telefon",    label: "Telefon",              icon: "📱" },
  { id: "inne",       label: "Inne",                 icon: "📦" },
];

const MONTHS_PL = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

function rentKey(vehicleId, year, month) { return `${vehicleId}_${year}_${month}`; }

function RentownoscTab({ vehicles, records, onAdd, onUpdate, onDelete }) {
  const [view, setView]           = useState("flota");    // flota | pojazd | trendy
  const [selVehicle, setSelVehicle] = useState(null);
  const [selYear, setSelYear]     = useState(new Date().getFullYear());
  const [showForm, setShowForm]   = useState(false);
  const [editRecord, setEditRecord] = useState(null);     // record being edited
  const [formVehicle, setFormVehicle] = useState("");
  const [formYear, setFormYear]   = useState(new Date().getFullYear());
  const [formMonth, setFormMonth] = useState(new Date().getMonth());

  const years = [2024, 2025, 2026];

  // find record for vehicle+year+month
  const getRecord = (vid, y, m) => records.find(r => r.vehicleId === vid && r.year === y && r.month === m) || null;

  const totalFrachty = (vid, y) => MONTHS_PL.reduce((s,_,m) => { const r = getRecord(vid,y,m); return s + (r?.frachty||0); }, 0);
  const totalKoszt   = (vid, y) => MONTHS_PL.reduce((s,_,m) => { const r = getRecord(vid,y,m); return s + RENT_COSTS.reduce((cs,c) => cs + (r?.costs?.[c.id]||0), 0); }, 0);
  const totalZysk    = (vid, y) => totalFrachty(vid,y) - totalKoszt(vid,y);

  const fleetFrachty = (y) => vehicles.reduce((s,v) => s + totalFrachty(v.id,y), 0);
  const fleetKoszt   = (y) => vehicles.reduce((s,v) => s + totalKoszt(v.id,y), 0);
  const fleetZysk    = (y) => fleetFrachty(y) - fleetKoszt(y);

  const openAdd = (vid, y, m) => {
    const existing = getRecord(vid, y, m);
    setEditRecord(existing || null);
    setFormVehicle(vid || (vehicles[0]?.id || ""));
    setFormYear(y || selYear);
    setFormMonth(m !== undefined ? m : new Date().getMonth());
    setShowForm(true);
  };

  const zyskColor = (z) => z > 0 ? "#16a34a" : z < 0 ? "#dc2626" : "#9ca3af";
  const zyskBg   = (z) => z > 0 ? "#f0fdf4" : z < 0 ? "#fef2f2" : "#f9fafb";
  const fmt      = (n) => (n||0).toLocaleString("pl-PL", { minimumFractionDigits:0, maximumFractionDigits:0 }) + " €";
  const fmtS     = (n) => (n > 0 ? "+" : "") + fmt(n);

  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📊 Rentowność floty</h2>
          <p className="text-sm text-gray-400 mt-0.5">Przychody · Koszty · Zysk per pojazd</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {years.map(y => (
              <button key={y} onClick={() => setSelYear(y)}
                className="px-3 py-1.5 text-xs font-semibold transition-all"
                style={{ background: selYear===y ? "#111827" : "#fff", color: selYear===y ? "#fff" : "#6b7280" }}>
                {y}
              </button>
            ))}
          </div>
          <button onClick={() => openAdd("", selYear, new Date().getMonth())}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: "#111827" }}>
            + Dodaj wpis
          </button>
        </div>
      </div>

      {/* SUB-NAV */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background:"#f3f4f6" }}>
        {[["flota","🚛 Flota — przegląd"],["pojazd","📋 Pojazd — szczegół"],["trendy","📈 Trendy"]].map(([id,label]) => (
          <button key={id} onClick={() => setView(id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: view===id ? "#fff" : "transparent", color: view===id ? "#111827" : "#9ca3af",
                     boxShadow: view===id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── VIEW 1: FLOTA ── */}
      {view === "flota" && (
        <div className="space-y-3">
          {/* Fleet summary row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[["Przychody floty", fleetFrachty(selYear), "#3b82f6"],
              ["Koszty floty",   fleetKoszt(selYear),   "#ef4444"],
              ["Zysk floty",     fleetZysk(selYear),    zyskColor(fleetZysk(selYear))]
            ].map(([lbl, val, color]) => (
              <div key={lbl} className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                <div className="text-xs text-gray-400 mb-1">{lbl} {selYear}</div>
                <div className="text-lg font-bold" style={{ color }}>{fmt(val)}</div>
              </div>
            ))}
          </div>

          {/* Per-vehicle table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 px-5 py-3 border-b border-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span className="col-span-3">Pojazd</span>
              <span className="col-span-2 text-right">Frachty</span>
              <span className="col-span-2 text-right">Koszty</span>
              <span className="col-span-2 text-right">Zysk</span>
              <span className="col-span-2 text-right">Marża</span>
              <span className="col-span-1"></span>
            </div>
            {vehicles.map(v => {
              const f = totalFrachty(v.id, selYear);
              const k = totalKoszt(v.id, selYear);
              const z = f - k;
              const marza = f > 0 ? (z / f * 100) : 0;
              const hasData = records.some(r => r.vehicleId === v.id && r.year === selYear);
              return (
                <div key={v.id} className="grid grid-cols-12 px-5 py-3.5 border-b border-gray-50 items-center hover:bg-gray-50 transition-colors">
                  <div className="col-span-3">
                    <div className="font-semibold text-sm text-gray-900" style={{ fontFamily:"'DM Mono',monospace" }}>{v.plate}</div>
                    <div className="text-xs text-gray-400">{v.brand}</div>
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium text-gray-700">{f > 0 ? fmt(f) : <span className="text-gray-300">—</span>}</div>
                  <div className="col-span-2 text-right text-sm font-medium text-gray-700">{k > 0 ? fmt(k) : <span className="text-gray-300">—</span>}</div>
                  <div className="col-span-2 text-right text-sm font-bold" style={{ color: zyskColor(z) }}>{hasData ? fmtS(z) : <span className="text-gray-300">—</span>}</div>
                  <div className="col-span-2 text-right">
                    {f > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: zyskBg(z), color: zyskColor(z) }}>
                        {marza.toFixed(1)}%
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button onClick={() => { setSelVehicle(v.id); setView("pojazd"); }}
                      className="w-6 h-6 rounded flex items-center justify-center text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-all text-xs" title="Szczegół">▶</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Month grid for current year */}
          <div className="mt-6">
            <div className="text-sm font-semibold text-gray-700 mb-3">Zysk miesięczny per pojazd — {selYear}</div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 700 }}>
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-400 w-28">Pojazd</th>
                    {MONTHS_PL.map(m => <th key={m} className="text-center py-2.5 font-semibold text-gray-400 px-1" style={{ minWidth:60 }}>{m.slice(0,3)}</th>)}
                    <th className="text-right px-4 py-2.5 font-semibold text-gray-400">Rok</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map(v => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-gray-800" style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{v.plate}</td>
                      {MONTHS_PL.map((_,mi) => {
                        const r = getRecord(v.id, selYear, mi);
                        if (!r) return (
                          <td key={mi} className="text-center py-2 px-1">
                            <button onClick={() => openAdd(v.id, selYear, mi)}
                              className="w-full h-7 rounded-lg border-2 border-dashed border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-gray-300 hover:text-amber-400 text-xs">+</button>
                          </td>
                        );
                        const f = r.frachty || 0;
                        const k = RENT_COSTS.reduce((s,c) => s + (r.costs?.[c.id]||0), 0);
                        const z = f - k;
                        return (
                          <td key={mi} className="text-center py-2 px-1">
                            <button onClick={() => openAdd(v.id, selYear, mi)}
                              className="w-full h-7 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                              style={{ background: zyskBg(z), color: zyskColor(z) }}>
                              {z >= 0 ? "+" : ""}{(z/1000).toFixed(1)}k
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-right px-4 py-2 font-bold text-sm" style={{ color: zyskColor(totalZysk(v.id,selYear)) }}>
                        {records.some(r=>r.vehicleId===v.id&&r.year===selYear) ? fmtS(totalZysk(v.id,selYear)) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr style={{ background:"#f9fafb" }}>
                    <td className="px-4 py-2.5 font-bold text-gray-700 text-xs">SUMA</td>
                    {MONTHS_PL.map((_,mi) => {
                      const z = vehicles.reduce((s,v) => { const r=getRecord(v.id,selYear,mi); if(!r) return s; const f=r.frachty||0; const k=RENT_COSTS.reduce((cs,c)=>cs+(r.costs?.[c.id]||0),0); return s+f-k; }, 0);
                      const hasAny = vehicles.some(v => getRecord(v.id,selYear,mi));
                      return <td key={mi} className="text-center py-2.5 px-1 font-bold text-xs" style={{ color: hasAny ? zyskColor(z) : "#d1d5db" }}>{hasAny ? (z>=0?"+":"")+Math.round(z/1000)+"k" : "—"}</td>;
                    })}
                    <td className="text-right px-4 py-2.5 font-bold text-sm" style={{ color: zyskColor(fleetZysk(selYear)) }}>{fmtS(fleetZysk(selYear))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: POJAZD SZCZEGÓŁ ── */}
      {view === "pojazd" && (
        <div>
          {/* Vehicle selector */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {vehicles.map(v => (
              <button key={v.id} onClick={() => setSelVehicle(v.id)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
                style={{ background: selVehicle===v.id ? "#111827" : "#fff",
                         color: selVehicle===v.id ? "#fff" : "#374151",
                         borderColor: selVehicle===v.id ? "#111827" : "#e5e7eb" }}>
                {v.plate}
              </button>
            ))}
          </div>

          {selVehicle && (() => {
            const v = vehicles.find(vv => vv.id === selVehicle);
            const yearData = MONTHS_PL.map((lbl, mi) => {
              const r = getRecord(selVehicle, selYear, mi);
              const f = r?.frachty || 0;
              const k = r ? RENT_COSTS.reduce((s,c) => s + (r.costs?.[c.id]||0), 0) : 0;
              return { lbl: lbl.slice(0,3), frachty: f, koszty: k, zysk: f-k, hasData: !!r };
            });
            const annualF = yearData.reduce((s,d)=>s+d.frachty,0);
            const annualK = yearData.reduce((s,d)=>s+d.koszty,0);
            const annualZ = annualF - annualK;

            // Cost breakdown summed for year
            const costBreakdown = RENT_COSTS.map(c => ({
              ...c,
              total: MONTHS_PL.reduce((_,__,mi) => { const r=getRecord(selVehicle,selYear,mi); return _ + (r?.costs?.[c.id]||0); }, 0)
            })).filter(c => c.total > 0).sort((a,b) => b.total - a.total);

            const maxBar = Math.max(...yearData.map(d => Math.max(d.frachty, d.koszty)), 1);

            return (
              <div className="space-y-4">
                {/* KPI cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="text-xs text-gray-400 mb-1">Frachty {selYear}</div>
                    <div className="text-lg font-bold text-blue-600">{fmt(annualF)}</div>
                  </div>
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="text-xs text-gray-400 mb-1">Koszty {selYear}</div>
                    <div className="text-lg font-bold text-red-500">{fmt(annualK)}</div>
                  </div>
                  <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100">
                    <div className="text-xs text-gray-400 mb-1">Zysk {selYear}</div>
                    <div className="text-lg font-bold" style={{ color: zyskColor(annualZ) }}>{fmtS(annualZ)}</div>
                  </div>
                </div>

                {/* Monthly bar chart */}
                <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                  <div className="text-sm font-semibold text-gray-700 mb-4">Przychód vs Koszty — miesięcznie</div>
                  <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                    {yearData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group cursor-pointer" onClick={() => openAdd(selVehicle, selYear, i)}>
                        <div className="w-full flex flex-col justify-end gap-px relative" style={{ height: 110 }}>
                          {d.hasData ? (
                            <>
                              <div className="w-full rounded-t transition-all" style={{ height: Math.max(2, d.frachty/maxBar*100)+'%', background:"#3b82f6", opacity:0.85 }} title={`Frachty: ${fmt(d.frachty)}`} />
                              <div className="w-full rounded-t transition-all" style={{ height: Math.max(2, d.koszty/maxBar*100)+'%', background:"#ef444460" }} title={`Koszty: ${fmt(d.koszty)}`} />
                            </>
                          ) : (
                            <div className="w-full rounded-t border-2 border-dashed border-gray-200 group-hover:border-amber-300 transition-all" style={{ height:"100%" }} />
                          )}
                        </div>
                        <div className="text-xs text-gray-400" style={{ fontSize:9 }}>{d.lbl}</div>
                        {d.hasData && (
                          <div className="text-xs font-bold" style={{ color: zyskColor(d.zysk), fontSize:9 }}>
                            {d.zysk >= 0 ? "+" : ""}{Math.round(d.zysk/1000)}k
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span><span className="inline-block w-3 h-2 rounded mr-1" style={{ background:"#3b82f6" }}></span>Frachty</span>
                    <span><span className="inline-block w-3 h-2 rounded mr-1" style={{ background:"#ef444460" }}></span>Koszty</span>
                    <span className="text-gray-300 text-xs ml-2">Kliknij miesiąc aby dodać/edytować</span>
                  </div>
                </div>

                {/* Cost breakdown */}
                {costBreakdown.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Struktura kosztów {selYear}</div>
                    <div className="space-y-2">
                      {costBreakdown.map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="w-5 text-base">{c.icon}</span>
                          <span className="text-xs text-gray-600 w-36 flex-shrink-0">{c.label}</span>
                          <div className="flex-1 h-2 rounded-full" style={{ background:"#f3f4f6" }}>
                            <div className="h-2 rounded-full transition-all" style={{ width: Math.max(2, c.total/annualK*100)+'%', background:"#6366f1" }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-20 text-right">{fmt(c.total)}</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{annualK>0?(c.total/annualK*100).toFixed(0):"0"}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly detail table */}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-50 text-sm font-semibold text-gray-700">Szczegół miesięczny</div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-50">
                        <th className="text-left px-5 py-2 font-semibold text-gray-400">Miesiąc</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-400">Frachty</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-400">Koszty</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-400">Zysk</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-400">KM</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-400">Dni</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS_PL.map((lbl, mi) => {
                        const r = getRecord(selVehicle, selYear, mi);
                        const f = r?.frachty || 0;
                        const k = r ? RENT_COSTS.reduce((s,c)=>s+(r.costs?.[c.id]||0),0) : 0;
                        const z = f - k;
                        return (
                          <tr key={mi} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openAdd(selVehicle, selYear, mi)}>
                            <td className="px-5 py-2.5 font-medium text-gray-700">{lbl}</td>
                            <td className="text-right px-3 py-2.5 text-blue-600 font-medium">{f > 0 ? fmt(f) : <span className="text-gray-200">—</span>}</td>
                            <td className="text-right px-3 py-2.5 text-gray-600">{k > 0 ? fmt(k) : <span className="text-gray-200">—</span>}</td>
                            <td className="text-right px-3 py-2.5 font-bold" style={{ color: r ? zyskColor(z) : "#d1d5db" }}>{r ? fmtS(z) : "—"}</td>
                            <td className="text-right px-3 py-2.5 text-gray-400">{r?.kmLicznik ? r.kmLicznik.toLocaleString("pl-PL") : <span className="text-gray-200">—</span>}</td>
                            <td className="text-right px-3 py-2.5 text-gray-400">{r?.dni || <span className="text-gray-200">—</span>}</td>
                            <td className="px-3 py-2.5">
                              {r && <button onClick={e=>{e.stopPropagation();onDelete(r.id);}} className="w-5 h-5 flex items-center justify-center text-gray-200 hover:text-red-400 rounded transition-all">✕</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
          {!selVehicle && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
              Wybierz pojazd powyżej
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 3: TRENDY ── */}
      {view === "trendy" && (
        <div className="space-y-4">
          {/* YoY comparison */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <div className="text-sm font-semibold text-gray-700 mb-4">Frachty floty — rok do roku</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 600 }}>
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="text-left px-2 py-2 text-gray-400 font-semibold">Miesiąc</th>
                    {years.map(y => <th key={y} className="text-right px-2 py-2 text-gray-400 font-semibold">{y}</th>)}
                    <th className="text-right px-2 py-2 text-gray-400 font-semibold">Zmiana 25→26</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS_PL.map((lbl, mi) => {
                    const vals = years.map(y => vehicles.reduce((s,v) => { const r=getRecord(v.id,y,mi); return s+(r?.frachty||0); }, 0));
                    const diff = vals[1] > 0 && vals[2] > 0 ? ((vals[2]-vals[1])/vals[1]*100) : null;
                    return (
                      <tr key={mi} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-2.5 font-medium text-gray-700">{lbl}</td>
                        {vals.map((val,i) => <td key={i} className="text-right px-2 py-2.5 font-medium text-gray-700">{val > 0 ? fmt(val) : <span className="text-gray-300">—</span>}</td>)}
                        <td className="text-right px-2 py-2.5 font-bold" style={{ color: diff===null?"#d1d5db":diff>=0?"#16a34a":"#dc2626" }}>
                          {diff !== null ? (diff>=0?"+":"")+diff.toFixed(1)+"%" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background:"#f9fafb" }}>
                    <td className="px-2 py-2.5 font-bold text-gray-700">ROK</td>
                    {years.map(y => <td key={y} className="text-right px-2 py-2.5 font-bold text-blue-600">{fmt(fleetFrachty(y))}</td>)}
                    <td className="text-right px-2 py-2.5 font-bold">
                      {fleetFrachty(2025) > 0 && fleetFrachty(2026) > 0 ? (
                        <span style={{ color: fleetFrachty(2026)>=fleetFrachty(2025)?"#16a34a":"#dc2626" }}>
                          {((fleetFrachty(2026)-fleetFrachty(2025))/fleetFrachty(2025)*100).toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-vehicle YoY */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <div className="text-sm font-semibold text-gray-700 mb-4">Zysk roczny per pojazd</div>
            <div className="space-y-3">
              {vehicles.map(v => {
                const zyski = years.map(y => ({ y, z: totalZysk(v.id,y), f: totalFrachty(v.id,y) }));
                const maxF = Math.max(...zyski.map(x=>x.f), 1);
                return (
                  <div key={v.id} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-700 w-24 flex-shrink-0" style={{ fontFamily:"'DM Mono',monospace", fontSize:11 }}>{v.plate}</span>
                    <div className="flex-1 flex gap-1 items-end" style={{ height:28 }}>
                      {zyski.map(({y,z,f}) => (
                        <div key={y} className="flex-1 flex flex-col justify-end" style={{ height:28 }} title={`${y}: frachty ${fmt(f)}, zysk ${fmtS(z)}`}>
                          {f > 0 && <div className="rounded transition-all" style={{ height: Math.max(4,f/maxF*24)+'px', background: z>=0?"#3b82f6":"#ef4444", opacity:0.8 }} />}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {zyski.map(({y,z,f}) => (
                        <span key={y} className="text-xs font-semibold w-20 text-right" style={{ color: f>0 ? zyskColor(z) : "#d1d5db" }}>
                          {f > 0 ? fmtS(z) : "—"}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3">
              {years.map((y,i) => <span key={y} className="text-xs text-gray-400">{y}</span>)}
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <RentFormModal
          vehicles={vehicles}
          record={editRecord}
          initVehicle={formVehicle}
          initYear={formYear}
          initMonth={formMonth}
          onSave={(data) => {
            if (editRecord) onUpdate(editRecord.id, data);
            else onAdd(data);
            setShowForm(false); setEditRecord(null);
          }}
          onClose={() => { setShowForm(false); setEditRecord(null); }}
        />
      )}
    </div>
  );
}

function RentFormModal({ vehicles, record, initVehicle, initYear, initMonth, onSave, onClose }) {
  const [vehicleId, setVehicleId] = useState(record?.vehicleId || initVehicle || vehicles[0]?.id || "");
  const [year,      setYear]      = useState(record?.year  ?? initYear);
  const [month,     setMonth]     = useState(record?.month ?? initMonth);
  const [frachty,   setFrachty]   = useState(record?.frachty  || "");
  const [costs,     setCosts]     = useState(record?.costs    || {});
  const [kmGoogle,  setKmGoogle]  = useState(record?.kmGoogle  || "");
  const [kmLicznik, setKmLicznik] = useState(record?.kmLicznik || "");
  const [litry,     setLitry]     = useState(record?.litry     || "");
  const [dni,       setDni]       = useState(record?.dni       || "");
  const [iloscFr,   setIloscFr]   = useState(record?.iloscFr   || "");
  const [note,      setNote]      = useState(record?.note      || "");

  const setC = (id, val) => setCosts(p => ({ ...p, [id]: val === "" ? undefined : Number(val) }));

  const totalKoszty = RENT_COSTS.reduce((s,c) => s + (Number(costs[c.id]) || 0), 0);
  const zysk = (Number(frachty)||0) - totalKoszty;

  const handleSave = () => {
    if (!vehicleId || frachty === "") return;
    onSave({ vehicleId, year, month, frachty: Number(frachty), costs,
             kmGoogle: Number(kmGoogle)||undefined, kmLicznik: Number(kmLicznik)||undefined,
             litry: Number(litry)||undefined, dni: Number(dni)||undefined,
             iloscFr: Number(iloscFr)||undefined, note });
  };

  const zyskColor = (z) => z > 0 ? "#16a34a" : z < 0 ? "#dc2626" : "#9ca3af";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight:"90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="font-bold text-gray-900">
            {record ? "✏️ Edytuj wpis" : "➕ Nowy wpis rentowności"}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Vehicle + period */}
          <div className="grid grid-cols-3 gap-3">
            <MF label="Pojazd">
              <select value={vehicleId} onChange={e=>setVehicleId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400">
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate}</option>)}
              </select>
            </MF>
            <MF label="Rok">
              <select value={year} onChange={e=>setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400">
                {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </MF>
            <MF label="Miesiąc">
              <select value={month} onChange={e=>setMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400">
                {MONTHS_PL.map((m,i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </MF>
          </div>

          {/* Frachty */}
          <div className="rounded-2xl p-4" style={{ background:"#eff6ff", border:"1.5px solid #bfdbfe" }}>
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">💰 Przychód</div>
            <MF label="Frachty (EUR)">
              <MInput type="number" value={frachty} onChange={setFrachty} placeholder="np. 9750" />
            </MF>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <MF label="Ilość frachtów"><MInput type="number" value={iloscFr} onChange={setIloscFr} placeholder="np. 12" /></MF>
              <MF label="Dni pracy"><MInput type="number" value={dni} onChange={setDni} placeholder="np. 22" /></MF>
            </div>
          </div>

          {/* Costs */}
          <div className="rounded-2xl p-4" style={{ background:"#fef2f2", border:"1.5px solid #fecaca" }}>
            <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">📉 Koszty (EUR)</div>
            <div className="grid grid-cols-2 gap-2">
              {RENT_COSTS.map(c => (
                <MF key={c.id} label={`${c.icon} ${c.label}`}>
                  <MInput type="number" value={costs[c.id] ?? ""} onChange={val => setC(c.id, val)} placeholder="0" />
                </MF>
              ))}
            </div>
          </div>

          {/* KM + paliwo */}
          <div className="rounded-2xl p-4" style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb" }}>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">📏 Dane eksploatacyjne</div>
            <div className="grid grid-cols-2 gap-3">
              <MF label="KM google"><MInput type="number" value={kmGoogle} onChange={setKmGoogle} placeholder="np. 8500" /></MF>
              <MF label="KM licznik"><MInput type="number" value={kmLicznik} onChange={setKmLicznik} placeholder="np. 8750" /></MF>
              <MF label="Litry paliwa"><MInput type="number" value={litry} onChange={setLitry} placeholder="np. 1340" /></MF>
            </div>
          </div>

          <MF label="Notatka (opcjonalnie)">
            <MInput value={note} onChange={setNote} placeholder="np. Urlop w połowie miesiąca..." />
          </MF>
        </div>

        {/* Footer with live summary */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl" style={{ background:"#f9fafb" }}>
            <span className="text-xs text-gray-500">Frachty: <strong className="text-blue-600">{Number(frachty||0).toLocaleString("pl-PL")} €</strong></span>
            <span className="text-xs text-gray-500">Koszty: <strong className="text-red-500">{totalKoszty.toLocaleString("pl-PL")} €</strong></span>
            <span className="text-xs font-bold" style={{ color: zyskColor(zysk) }}>
              Zysk: {zysk >= 0 ? "+" : ""}{zysk.toLocaleString("pl-PL")} €
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!vehicleId || frachty === ""}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-40"
              style={{ background:"#111827" }}>
              ✅ Zapisz
            </button>
            <button onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
              style={{ background:"#e5e7eb", color:"#374151" }}>
              Anuluj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServisTab({ vehicles, onUpdateVehicle }) {
  const [editId, setEditId] = useState(null);
  const today = new Date();

  const daysUntilD = (d) => d ? Math.ceil((new Date(d) - today) / 86400000) : null;

  const getVehicleAlerts = (v) => {
    const alerts = [];
    const push = (label, days, type="date") => {
      if (days === null) return;
      const urgent = type==="date" ? days <= 30 : days <= 1500;
      const warn   = type==="date" ? days <= 60 : days <= 3000;
      alerts.push({ label, days, type, urgent, warn });
    };

    push("OC",          daysUntilD(v.ocExpiry));
    push("AC",          daysUntilD(v.acExpiry));
    push("Przegląd",    daysUntilD(v.inspectionExpiry));
    push("UDT ważność", daysUntilD(v.udtExpiry));
    push("UDT przegląd",daysUntilD(v.udtNextDate));

    const currKm = Number(v.currentKm) || 0;
    // warranty
    if (v.warrantyActive !== false && v.warrantyServiceEvery) {
      const purKm = Number(v.warrantyPurchaseKm) || 0;
      const evKm  = Number(v.warrantyServiceEvery);
      const nextKm = purKm + Math.ceil((currKm - purKm + 1) / evKm) * evKm;
      push("Serwis gwar.", nextKm - currKm, "km");
    }
    // own
    if (v.lastOilServiceKm && v.oilServiceEveryKm) {
      const nextKm = Number(v.lastOilServiceKm) + Number(v.oilServiceEveryKm);
      push("Serwis olej.", nextKm - currKm, "km");
    }
    return alerts;
  };

  const sortedVehicles = [...vehicles].sort((a, b) => {
    const aAlerts = getVehicleAlerts(a);
    const bAlerts = getVehicleAlerts(b);
    const aUrgent = aAlerts.filter(x => x.urgent).length;
    const bUrgent = bAlerts.filter(x => x.urgent).length;
    if (bUrgent !== aUrgent) return bUrgent - aUrgent;
    return aAlerts.filter(x=>x.warn).length < bAlerts.filter(x=>x.warn).length ? 1 : -1;
  });

  const totalAlerts = vehicles.reduce((s, v) => s + getVehicleAlerts(v).filter(x=>x.urgent).length, 0);

  const StatusPill = ({ alert: a }) => {
    const expired = a.type==="date" ? a.days < 0 : a.days <= 0;
    const bg = expired || a.urgent ? "#fef2f2" : a.warn ? "#fffbeb" : "#f0fdf4";
    const cl = expired || a.urgent ? "#dc2626"  : a.warn ? "#d97706" : "#16a34a";
    const icon = expired ? "⚠" : a.urgent ? "🔴" : a.warn ? "🟡" : "🟢";
    const val = a.type === "km"
      ? (a.days <= 0 ? "przekroczono" : `${a.days.toLocaleString("pl-PL")} km`)
      : (a.days < 0  ? "wygasło" : `${a.days} dni`);
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-xl"
        style={{ background: bg, border:`1px solid ${bg==="#f0fdf4"?"#bbf7d0":bg==="#fffbeb"?"#fde68a":"#fecaca"}` }}>
        <span className="text-xs font-semibold text-gray-700">{icon} {a.label}</span>
        <span className="text-xs font-bold" style={{ color: cl }}>{val}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🔧 Serwis & Terminarz</h2>
          <p className="text-sm text-gray-400 mt-0.5">OC · AC · Przeglądy · UDT · Olej</p>
        </div>
        {totalAlerts > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#dc2626" }}>
            ⚠️ {totalAlerts} {totalAlerts===1?"pilny termin":"pilne terminy"}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {sortedVehicles.map(v => {
          const alerts  = getVehicleAlerts(v);
          const urgent  = alerts.filter(x => x.urgent || x.days < 0).length;
          const currKm  = Number(v.currentKm) || 0;
          const isEdit  = editId === v.id;

          return (
            <div key={v.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm"
              style={{ borderColor: urgent > 0 ? "#fecaca" : "#e5e7eb" }}>

              {/* HEADER */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50"
                style={{ background: urgent > 0 ? "#fef9f9" : "#fafafa" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{v.plate2 ? "🚌" : "🚛"}</span>
                  <div>
                    <span className="font-bold text-sm text-gray-900" style={{ fontFamily:"'DM Mono',monospace" }}>
                      {v.plate}{v.plate2 ? ` / ${v.plate2}` : ""}
                    </span>
                    <div className="text-xs text-gray-400">{v.brand} · {v.year}</div>
                  </div>
                  {urgent > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background:"#dc2626" }}>
                      {urgent} pilne
                    </span>
                  )}
                </div>
                <button onClick={() => setEditId(isEdit ? null : v.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: isEdit?"#111827":"#f3f4f6", color: isEdit?"#fff":"#6b7280" }}>
                  {isEdit ? "Zamknij" : "✏️ Edytuj"}
                </button>
              </div>

              {!isEdit && (
                <div className="px-5 py-4">
                  {alerts.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">
                      Brak danych serwisowych — kliknij ✏️ Edytuj aby uzupełnić
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {alerts.map((a, i) => <StatusPill key={i} alert={a} />)}
                      {currKm > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                          style={{ background:"#f3f4f6" }}>
                          <span className="text-xs font-semibold text-gray-500">🏁 Przebieg</span>
                          <span className="text-xs font-bold text-gray-700">{currKm.toLocaleString("pl-PL")} km</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* INLINE EDIT */}
              {isEdit && (
                <ServiceEditForm vehicle={v}
                  onSave={(updated) => { onUpdateVehicle(updated); setEditId(null); }}
                  onClose={() => setEditId(null)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServiceEditForm({ vehicle, onSave, onClose }) {
  const [v, setV] = useState({
    ocExpiry:             vehicle.ocExpiry             || "",
    acExpiry:             vehicle.acExpiry             || "",
    inspectionExpiry:     vehicle.inspectionExpiry     || "",
    udtNumber:            vehicle.udtNumber            || "",
    udtExpiry:            vehicle.udtExpiry            || "",
    udtNextDate:          vehicle.udtNextDate          || "",
    udtLiftName:          vehicle.udtLiftName          || "",
    warrantyActive:       vehicle.warrantyActive !== false,
    warrantyKmLimit:      vehicle.warrantyKmLimit      || "",
    warrantyServiceEvery: vehicle.warrantyServiceEvery || "",
    warrantyPurchaseKm:   vehicle.warrantyPurchaseKm   || "",
    currentKm:            vehicle.currentKm            || "",
    lastOilServiceKm:     vehicle.lastOilServiceKm     || "",
    oilServiceEveryKm:    vehicle.oilServiceEveryKm    || "",
  });
  const set = (k, val) => setV(p => ({ ...p, [k]: val }));
  const hasUdt = (vehicle.equipment||[]).includes("winda");

  // live preview calculations
  const currKm      = Number(v.currentKm) || 0;
  const warNextKm   = v.warrantyActive && v.warrantyServiceEvery && v.warrantyPurchaseKm
    ? (() => { const p=Number(v.warrantyPurchaseKm),e=Number(v.warrantyServiceEvery); return p+Math.ceil((currKm-p+1)/e)*e; })()
    : null;
  const ownNextKm   = v.lastOilServiceKm && v.oilServiceEveryKm
    ? Number(v.lastOilServiceKm) + Number(v.oilServiceEveryKm) : null;

  return (
    <div className="px-5 py-5 space-y-5 border-t border-gray-100">

      {/* UBEZPIECZENIA + PRZEGLĄD */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background:"#f8faff", border:"1.5px solid #e0e7ff" }}>
        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">🛡️ Ubezpieczenia & Przegląd</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="OC — ważny do"><MInput type="date" value={v.ocExpiry} onChange={val=>set("ocExpiry",val)} /></MF>
          <MF label="AC — ważny do"><MInput type="date" value={v.acExpiry} onChange={val=>set("acExpiry",val)} /></MF>
          <MF label="Przegląd — ważny do"><MInput type="date" value={v.inspectionExpiry} onChange={val=>set("inspectionExpiry",val)} /></MF>
        </div>
      </div>

      {/* UDT */}
      {hasUdt && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background:"#fdf4ff", border:"1.5px solid #e9d5ff" }}>
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">🏗️ UDT — Winda</div>
          <div className="grid grid-cols-2 gap-3">
            <MF label="Nazwa / typ windy"><MInput value={v.udtLiftName} onChange={val=>set("udtLiftName",val)} placeholder="np. Zepro 1500 kg" /></MF>
            <MF label="Nr ewidencyjny UDT"><MInput value={v.udtNumber} onChange={val=>set("udtNumber",val)} placeholder="UDT/W/..." /></MF>
            <MF label="Data badania (ważność)"><MInput type="date" value={v.udtExpiry} onChange={val=>set("udtExpiry",val)} /></MF>
            <MF label="Następny przegląd UDT"><MInput type="date" value={v.udtNextDate} onChange={val=>set("udtNextDate",val)} /></MF>
          </div>
        </div>
      )}

      {/* AKTUALNY PRZEBIEG */}
      <div className="rounded-2xl p-4" style={{ background:"#f9fafb", border:"1.5px solid #e5e7eb" }}>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">🏁 Aktualny przebieg</div>
        <MF label="Aktualny przebieg (KM)">
          <MInput type="number" value={v.currentKm} onChange={val=>set("currentKm",val)} placeholder="np. 245000" />
        </MF>
      </div>

      {/* SERWIS — GWARANCJA */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0" }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-green-700 uppercase tracking-wider">🔑 Serwis gwarancyjny</div>
          <button onClick={() => set("warrantyActive", !v.warrantyActive)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: v.warrantyActive?"#dcfce7":"#f3f4f6", color: v.warrantyActive?"#16a34a":"#9ca3af", border:`1.5px solid ${v.warrantyActive?"#86efac":"#e5e7eb"}` }}>
            {v.warrantyActive ? "✓ Aktywna" : "Nieaktywna"}
          </button>
        </div>
        {v.warrantyActive && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <MF label="Limit KM gwarancji"><MInput type="number" value={v.warrantyKmLimit} onChange={val=>set("warrantyKmLimit",val)} placeholder="np. 100 000" /></MF>
              <MF label="Co ile KM serwis"><MInput type="number" value={v.warrantyServiceEvery} onChange={val=>set("warrantyServiceEvery",val)} placeholder="np. 15 000" /></MF>
              <MF label="KM przy zakupie"><MInput type="number" value={v.warrantyPurchaseKm} onChange={val=>set("warrantyPurchaseKm",val)} placeholder="np. 0" /></MF>
            </div>
            {warNextKm && currKm > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background:"#dcfce7" }}>
                <span>📍 Następny serwis gwar.:</span>
                <strong>{warNextKm.toLocaleString("pl-PL")} km</strong>
                <span className="text-gray-500">({(warNextKm - currKm).toLocaleString("pl-PL")} km do serwisu)</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* SERWIS WŁASNY */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background:"#fffbeb", border:"1.5px solid #fde68a" }}>
        <div className="text-xs font-bold text-amber-700 uppercase tracking-wider">🛢️ Serwis własny (po gwarancji)</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="KM przy ostatnim serwisie"><MInput type="number" value={v.lastOilServiceKm} onChange={val=>set("lastOilServiceKm",val)} placeholder="np. 230 000" /></MF>
          <MF label="Co ile KM serwis"><MInput type="number" value={v.oilServiceEveryKm} onChange={val=>set("oilServiceEveryKm",val)} placeholder="np. 15 000" /></MF>
        </div>
        {ownNextKm && currKm > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background:"#fef9c3" }}>
            <span>📍 Następny serwis własny:</span>
            <strong>{ownNextKm.toLocaleString("pl-PL")} km</strong>
            <span className="text-gray-500">
              {ownNextKm - currKm <= 0 ? "⚠ przekroczono!" : `(${(ownNextKm - currKm).toLocaleString("pl-PL")} km do serwisu)`}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onSave({ ...vehicle, ...v })}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all active:scale-95"
          style={{ background:"#111827" }}>
          ✅ Zapisz
        </button>
        <button onClick={onClose}
          className="px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all"
          style={{ background:"#e5e7eb", color:"#374151" }}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

function VehicleServicePanel({ vehicle: v }) {
  const today = new Date();
  const daysUntilDate = (d) => d ? Math.ceil((new Date(d) - today) / 86400000) : null;

  // insurance & inspection
  const ocDays   = daysUntilDate(v.ocExpiry);
  const acDays   = daysUntilDate(v.acExpiry);
  const insDays  = daysUntilDate(v.inspectionExpiry);
  // UDT
  const udtDays  = daysUntilDate(v.udtExpiry);
  const udtNext  = daysUntilDate(v.udtNextDate);
  // warranty oil service
  const warActive = v.warrantyActive !== false && v.warrantyKmLimit;
  const currKm    = Number(v.currentKm) || 0;
  const warLimit  = Number(v.warrantyKmLimit) || 0;
  const warLeft   = warActive ? (warLimit - currKm) : null;
  const warServiceEvery = Number(v.warrantyServiceEvery) || 0;
  const warPurchaseKm   = Number(v.warrantyPurchaseKm) || 0;
  const warNextKm = warServiceEvery
    ? warPurchaseKm + Math.ceil((currKm - warPurchaseKm) / warServiceEvery) * warServiceEvery
    : null;
  const warKmLeft = warNextKm ? (warNextKm - currKm) : null;
  // own oil service
  const lastSvcKm  = Number(v.lastOilServiceKm) || 0;
  const svcEveryKm = Number(v.oilServiceEveryKm) || 0;
  const nextSvcKm  = (lastSvcKm && svcEveryKm) ? lastSvcKm + svcEveryKm : null;
  const ownKmLeft  = nextSvcKm ? (nextSvcKm - currKm) : null;
  // months service
  const lastSvcDate     = v.lastOilServiceDate;
  const svcEveryMonths  = Number(v.oilServiceEveryMonths) || 0;
  let monthsDays = null;
  if (lastSvcDate && svcEveryMonths) {
    const next = new Date(lastSvcDate);
    next.setMonth(next.getMonth() + svcEveryMonths);
    monthsDays = Math.ceil((next - today) / 86400000);
  }

  const hasAny = ocDays!==null || acDays!==null || insDays!==null || udtDays!==null || udtNext!==null ||
    warKmLeft!==null || ownKmLeft!==null || monthsDays!==null || (warActive && warLeft!==null);

  if (!hasAny) return null;

  const alertCount = [
    ocDays, acDays, insDays, udtDays, udtNext
  ].filter(d => d !== null && d <= 30).length +
  [warKmLeft, ownKmLeft].filter(d => d !== null && d <= 1500).length +
  (monthsDays !== null && monthsDays <= 30 ? 1 : 0);

  return (
    <div className="px-5 py-3 border-t border-gray-50">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status serwisowy</span>
        {alertCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ background:"#dc2626", fontSize:10 }}>
            {alertCount}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ocDays  !== null && serviceStatusBadge(ocDays,  "OC")}
        {acDays  !== null && serviceStatusBadge(acDays,  "AC")}
        {insDays !== null && serviceStatusBadge(insDays, "Przegląd")}
        {udtDays !== null && serviceStatusBadge(udtDays, "UDT ważność")}
        {udtNext !== null && serviceStatusBadge(udtNext, "UDT przegląd")}
        {warActive && warLeft !== null && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: warLeft<=0?"#fef2f2": warLeft<=5000?"#fffbeb":"#f0fdf4",
                     color:      warLeft<=0?"#dc2626": warLeft<=5000?"#d97706":"#16a34a" }}>
            {warLeft<=0 ? "⚠ Gwarancja — wygasła KM" : `🔑 Gwarancja — ${warLeft.toLocaleString("pl-PL")} km do końca`}
          </span>
        )}
        {warKmLeft !== null && kmStatusBadge(warKmLeft, "Serwis gwar.")}
        {ownKmLeft !== null && kmStatusBadge(ownKmLeft, "Serwis olej.")}
        {monthsDays !== null && serviceStatusBadge(monthsDays, "Serwis mies.")}
        {currKm > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background:"#f3f4f6", color:"#6b7280" }}>
            🏁 {Number(currKm).toLocaleString("pl-PL")} km
          </span>
        )}
      </div>
    </div>
  );
}

function DriverCopyRow({ vehicle: v, active }) {
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const [offerText, setOfferText] = useState("");

  const buildOffer = () => {
    const eq = [
      ...(v.equipment || []).map(id => DEFAULT_EQUIPMENT.find(e => e.id === id)?.label).filter(Boolean),
      ...(v.customEquipment || []),
    ];
    const plate  = v.plate2 ? `${v.plate} / ${v.plate2}` : v.plate;
    const dims   = v.plate2
      ? `${v.dimensions || "—"} (${v.plate}) / ${v.dimensions2 || "—"} (${v.plate2})`
      : (v.dimensions || "—");
    const weight = v.plate2
      ? `${v.maxWeight || "—"} kg (${v.plate}) / ${v.maxWeight2 || "—"} kg (${v.plate2})`
      : `${v.maxWeight || "—"} kg`;
    return [
      `🚛 ${v.brand} ${v.year}`,
      `📋 Rejestracja: ${plate}`,
      `👤 Kierowca: ${active.name}`,
      active.phone ? `📞 Tel: ${active.phone}` : null,
      `📦 Rodzaj: ${v.type}${v.plate2 ? " + Przyczepa" : ""}`,
      v.loadingType ? `🔄 Załadunek: ${v.loadingType}` : null,
      `📐 Wymiary: ${dims}`,
      `⚖️ Max waga: ${weight}`,
      eq.length > 0 ? `🔧 Wyposażenie: ${eq.join(", ")}` : null,
    ].filter(Boolean).join("\n");
  };

  const copyOffer = () => {
    if (!active) return;
    const lines = buildOffer();
    setOfferText(lines);

    const fallbackCopy = (text) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(lines).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }).catch(() => {
          fallbackCopy(lines);
          setCopied(true);
          setTimeout(() => { setCopied(false); setShowText(true); }, 2500);
        });
      } else {
        fallbackCopy(lines);
        setShowText(true);
      }
    } catch (_) {
      setShowText(true);
    }
  };

  return (
    <>
      <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 mb-0.5">Aktualny kierowca</div>
          {active
            ? <div className="flex items-center gap-2 flex-wrap">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-900">{active.name}</span>
                {active.phone && (
                  <span className="text-xs text-gray-400" style={{ fontFamily: "'DM Mono', monospace" }}>{active.phone}</span>
                )}
                <span className="text-xs text-gray-400">podjął {fmtDate(active.from)}</span>
              </div>
            : <div className="text-sm text-gray-400 italic">Brak przypisanego kierowcy</div>
          }
        </div>
        {active && (
          <button onClick={copyOffer}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              background: copied ? "#f0fdf4" : "#f3f4f6",
              color:      copied ? "#16a34a" : "#374151",
              border:     `1.5px solid ${copied ? "#86efac" : "#e5e7eb"}`,
            }}>
            {copied ? "✓ Skopiowano!" : "📋 Kopiuj ofertę"}
          </button>
        )}
      </div>

      {/* FALLBACK MODAL — gdy clipboard zablokowany */}
      {showText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-900">Oferta — zaznacz i skopiuj</span>
              <button onClick={() => setShowText(false)}
                className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
            </div>
            <div className="px-5 py-4">
              <textarea readOnly value={offerText} rows={10}
                onFocus={(e) => e.target.select()}
                className="w-full text-xs rounded-xl p-3 outline-none resize-none"
                style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", fontFamily: "'DM Mono', monospace", color: "#111827", lineHeight: "1.7" }} />
              <p className="text-xs text-gray-400 mt-2 text-center">Kliknij w pole → Ctrl+A → Ctrl+C</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VEHICLE EDIT PANEL (inline, inside vehicle card)
// ═══════════════════════════════════════════════════════════════════════════════
function VehicleEditPanel({ vehicle, onSave, onClose }) {
  const [v, setV] = useState({
    ...vehicle,
    plate2:          vehicle.plate2          || "",
    equipment:       vehicle.equipment       || [],
    customEquipment: vehicle.customEquipment || [],
    dimensions:      vehicle.dimensions      || "",
    dimensions2:     vehicle.dimensions2     || "",
    loadingType:     vehicle.loadingType     || "",
    maxWeight:       vehicle.maxWeight       || "",
    maxWeight2:      vehicle.maxWeight2      || "",
    driverHistory: (vehicle.driverHistory || []).map((d) => ({ ...d })),
    // Insurance
    ocExpiry:        vehicle.ocExpiry        || "",
    acExpiry:        vehicle.acExpiry        || "",
    // Inspection
    inspectionExpiry: vehicle.inspectionExpiry || "",
    // UDT
    udtNumber:       vehicle.udtNumber       || "",
    udtExpiry:       vehicle.udtExpiry       || "",
    udtNextDate:     vehicle.udtNextDate     || "",
    udtLiftName:     vehicle.udtLiftName     || "",
    // Oil service - warranty
    warrantyKmLimit:    vehicle.warrantyKmLimit    || "",
    warrantyServiceEvery: vehicle.warrantyServiceEvery || "",
    warrantyPurchaseKm: vehicle.warrantyPurchaseKm || "",
    warrantyActive:     vehicle.warrantyActive !== false,
    // Oil service - post-warranty
    currentKm:          vehicle.currentKm          || "",
    lastOilServiceKm:   vehicle.lastOilServiceKm   || "",
    lastOilServiceDate: vehicle.lastOilServiceDate || "",
    oilServiceEveryKm:  vehicle.oilServiceEveryKm  || "",
    oilServiceEveryMonths: vehicle.oilServiceEveryMonths || "",
  });
  const [newEqInput, setNewEqInput] = useState("");
  const setF  = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const setDH = (hist)   => setV((p) => ({ ...p, driverHistory: hist }));

  const addDriver = () => {
    // close active driver if exists
    const hist = v.driverHistory.map((d) =>
      !d.to ? { ...d, to: new Date().toISOString().split("T")[0] } : d
    );
    setDH([...hist, { id: uid(), name: "", from: new Date().toISOString().split("T")[0], to: "" }]);
  };

  const updateDriver = (id, field, val) => {
    setDH(v.driverHistory.map((d) => d.id === id ? { ...d, [field]: val } : d));
  };

  const removeDriver = (id) => setDH(v.driverHistory.filter((d) => d.id !== id));

  const handleSave = () => {
    if (!v.plate.trim()) return;
    onSave(v);
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      {/* ── DANE POJAZDU ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dane pojazdu</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Rejestracja (główna)">
            <MInput value={v.plate} onChange={(val) => setF("plate", val.toUpperCase())} placeholder="WGM 0000X" />
          </MF>
          <MF label="Rejestracja przyczepy (opcjonalnie)">
            <MInput value={v.plate2} onChange={(val) => setF("plate2", val.toUpperCase())} placeholder="np. TK 760AP" />
          </MF>
          <MF label="Rok">
            <MInput type="number" value={v.year} onChange={(val) => setF("year", val)} />
          </MF>
          <MF label="Typ pojazdu">
            <MSelect value={v.type} onChange={(val) => setF("type", val)}>
              {["Solo","Bus","Zestaw","Chłodnia","Plandeka","Inny"].map((t) => <option key={t}>{t}</option>)}
            </MSelect>
          </MF>
          <div className="col-span-2">
            <MF label="Marka / Model">
              <MInput value={v.brand} onChange={(val) => setF("brand", val)} placeholder="np. MAN TGX" />
            </MF>
          </div>
        </div>
      </div>

      {/* ── WYPOSAŻENIE ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Wyposażenie</div>

        {/* DEFAULT EQUIPMENT CHECKBOXES */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {DEFAULT_EQUIPMENT.map((eq) => {
            const checked = v.equipment.includes(eq.id);
            return (
              <button key={eq.id}
                onClick={() => setF("equipment", checked
                  ? v.equipment.filter((e) => e !== eq.id)
                  : [...v.equipment, eq.id]
                )}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all"
                style={{
                  background: checked ? "#f0fdf4" : "#f9fafb",
                  border: `1.5px solid ${checked ? "#86efac" : "#e5e7eb"}`,
                  color: checked ? "#166534" : "#6b7280",
                }}>
                <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: checked ? "#22c55e" : "#e5e7eb" }}>
                  {checked && <span className="text-white text-xs leading-none">✓</span>}
                </div>
                {eq.label}
              </button>
            );
          })}
        </div>

        {/* CUSTOM EQUIPMENT TAGS */}
        {v.customEquipment.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {v.customEquipment.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe" }}>
                {item}
                <button onClick={() => setF("customEquipment", v.customEquipment.filter((_, idx) => idx !== i))}
                  className="hover:text-red-400 transition-colors ml-0.5">✕</button>
              </span>
            ))}
          </div>
        )}

        {/* ADD CUSTOM */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Dodaj własne wyposażenie..."
            value={newEqInput}
            onChange={(e) => setNewEqInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newEqInput.trim()) {
                setF("customEquipment", [...v.customEquipment, newEqInput.trim()]);
                setNewEqInput("");
              }
            }}
            className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
            style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", color: "#111827" }}
          />
          <button
            onClick={() => {
              if (newEqInput.trim()) {
                setF("customEquipment", [...v.customEquipment, newEqInput.trim()]);
                setNewEqInput("");
              }
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: "#111827" }}>
            + Dodaj
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Możesz też wpisać i nacisnąć Enter</p>
      </div>

      {/* ── DANE TECHNICZNE ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dane techniczne</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Wymiary — pojazd (cm)">
            <MInput value={v.dimensions} onChange={(val) => setF("dimensions", val)} placeholder="607x243x245" />
          </MF>
          <MF label="Max waga — pojazd (kg)">
            <MInput type="number" value={v.maxWeight} onChange={(val) => setF("maxWeight", val)} placeholder="3000" />
          </MF>
          {v.plate2 && (
            <>
              <MF label={`Wymiary — przyczepa (${v.plate2})`}>
                <MInput value={v.dimensions2} onChange={(val) => setF("dimensions2", val)} placeholder="640x245x250" />
              </MF>
              <MF label="Max waga — przyczepa (kg)">
                <MInput type="number" value={v.maxWeight2} onChange={(val) => setF("maxWeight2", val)} placeholder="2100" />
              </MF>
            </>
          )}
          <div className="col-span-2">
            <MF label="Rodzaj załadunku">
              <MInput value={v.loadingType} onChange={(val) => setF("loadingType", val)} placeholder="np. Bok, tył, góra" />
            </MF>
          </div>
        </div>
      </div>

      {/* ── HISTORIA KIEROWCÓW ── */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Historia kierowców</div>
          <button onClick={addDriver}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
            style={{ background: "#111827", color: "#fff" }}>
            + Dodaj kierowcę
          </button>
        </div>

        {v.driverHistory.length === 0 && (
          <div className="text-xs text-gray-400 italic py-2">Brak kierowców — dodaj pierwszego</div>
        )}

        <div className="space-y-3">
          {v.driverHistory.map((d, idx) => {
            const isActive = !d.to;
            return (
              <div key={d.id} className="rounded-xl p-3 relative"
                style={{ background: isActive ? "#f0fdf4" : "#fff", border: `1px solid ${isActive ? "#bbf7d0" : "#e5e7eb"}` }}>
                {/* Status badge */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-400" : "bg-gray-300"}`} />
                    <span className="text-xs font-medium" style={{ color: isActive ? "#059669" : "#9ca3af" }}>
                      {isActive ? "Aktualny kierowca" : `Poprzedni (${idx + 1})`}
                    </span>
                  </div>
                  <button onClick={() => removeDriver(d.id)}
                    className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-400 transition-all text-xs">✕</button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <MF label="Imię i nazwisko">
                      <MInput
                        value={d.name}
                        onChange={(val) => updateDriver(d.id, "name", val)}
                        placeholder="np. Jan Kowalski"
                      />
                    </MF>
                    <MF label="Telefon">
                      <MInput
                        value={d.phone || ""}
                        onChange={(val) => updateDriver(d.id, "phone", val)}
                        placeholder="np. +48 600 000 000"
                      />
                    </MF>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MF label="Podjęcie auta">
                      <MInput type="date" value={d.from} onChange={(val) => updateDriver(d.id, "from", val)} />
                    </MF>
                    <MF label={isActive ? "Zdanie auta (puste = aktywny)" : "Zdanie auta"}>
                      <MInput
                        type="date"
                        value={d.to}
                        onChange={(val) => updateDriver(d.id, "to", val)}
                      />
                    </MF>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SAVE */}
        <div className="flex gap-2 mt-4">
          <button onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: "#111827" }}>
            Zapisz zmiany
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:bg-gray-200"
            style={{ background: "#e5e7eb", color: "#374151" }}>
            Anuluj
          </button>
        </div>
      </div>

      {/* ── UBEZPIECZENIA & PRZEGLĄD ── */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🛡️ Ubezpieczenia & Przegląd</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="OC — ważny do">
            <MInput type="date" value={v.ocExpiry} onChange={val=>setF("ocExpiry",val)} />
          </MF>
          <MF label="AC — ważny do">
            <MInput type="date" value={v.acExpiry} onChange={val=>setF("acExpiry",val)} />
          </MF>
          <MF label="Przegląd techniczny — ważny do">
            <MInput type="date" value={v.inspectionExpiry} onChange={val=>setF("inspectionExpiry",val)} />
          </MF>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={()=>{ if(!v.plate.trim()) return; onSave(v); }}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background:"#111827" }}>Zapisz zmiany</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200" style={{ background:"#e5e7eb", color:"#374151" }}>Anuluj</button>
        </div>
      </div>

      {/* ── UDT WINDY ── */}
      {(v.equipment||[]).includes("winda") && (
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🏗️ UDT — Winda załadunkowa</div>
          <div className="grid grid-cols-2 gap-3">
            <MF label="Nazwa / typ windy">
              <MInput value={v.udtLiftName} onChange={val=>setF("udtLiftName",val)} placeholder="np. Zepro 1500 kg" />
            </MF>
            <MF label="Nr ewidencyjny UDT">
              <MInput value={v.udtNumber} onChange={val=>setF("udtNumber",val)} placeholder="np. UDT/W/12345" />
            </MF>
            <MF label="Data badania UDT (ważność)">
              <MInput type="date" value={v.udtExpiry} onChange={val=>setF("udtExpiry",val)} />
            </MF>
            <MF label="Data następnego przeglądu UDT">
              <MInput type="date" value={v.udtNextDate} onChange={val=>setF("udtNextDate",val)} />
            </MF>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={()=>{ if(!v.plate.trim()) return; onSave(v); }}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
              style={{ background:"#111827" }}>Zapisz zmiany</button>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200" style={{ background:"#e5e7eb", color:"#374151" }}>Anuluj</button>
          </div>
        </div>
      )}

      {/* ── SERWIS OLEJOWY — GWARANCJA ── */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🔧 Serwis olejowy — Gwarancja</div>
          <button onClick={()=>setF("warrantyActive",!v.warrantyActive)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{ background: v.warrantyActive?"#f0fdf4":"#f3f4f6", color: v.warrantyActive?"#16a34a":"#9ca3af", border:`1.5px solid ${v.warrantyActive?"#86efac":"#e5e7eb"}` }}>
            {v.warrantyActive ? "✓ Aktywna" : "Nieaktywna"}
          </button>
        </div>
        {v.warrantyActive && (
          <div className="grid grid-cols-2 gap-3">
            <MF label="KM przy zakupie">
              <MInput type="number" value={v.warrantyPurchaseKm} onChange={val=>setF("warrantyPurchaseKm",val)} placeholder="np. 0" />
            </MF>
            <MF label="Limit KM gwarancji">
              <MInput type="number" value={v.warrantyKmLimit} onChange={val=>setF("warrantyKmLimit",val)} placeholder="np. 100000" />
            </MF>
            <MF label="Co ile KM serwis gwarancyjny">
              <MInput type="number" value={v.warrantyServiceEvery} onChange={val=>setF("warrantyServiceEvery",val)} placeholder="np. 15000" />
            </MF>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={()=>{ if(!v.plate.trim()) return; onSave(v); }}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background:"#111827" }}>Zapisz zmiany</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200" style={{ background:"#e5e7eb", color:"#374151" }}>Anuluj</button>
        </div>
      </div>

      {/* ── SERWIS OLEJOWY — PO GWARANCJI ── */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🛢️ Serwis olejowy — Własny</div>
        <div className="grid grid-cols-2 gap-3">
          <MF label="Aktualny przebieg (KM)">
            <MInput type="number" value={v.currentKm} onChange={val=>setF("currentKm",val)} placeholder="np. 245000" />
          </MF>
          <MF label="KM przy ostatnim serwisie">
            <MInput type="number" value={v.lastOilServiceKm} onChange={val=>setF("lastOilServiceKm",val)} placeholder="np. 230000" />
          </MF>
          <MF label="Data ostatniego serwisu">
            <MInput type="date" value={v.lastOilServiceDate} onChange={val=>setF("lastOilServiceDate",val)} />
          </MF>
          <MF label="Co ile KM serwis">
            <MInput type="number" value={v.oilServiceEveryKm} onChange={val=>setF("oilServiceEveryKm",val)} placeholder="np. 15000" />
          </MF>
          <MF label="Co ile miesięcy serwis">
            <MInput type="number" value={v.oilServiceEveryMonths} onChange={val=>setF("oilServiceEveryMonths",val)} placeholder="np. 12" />
          </MF>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={()=>{ if(!v.plate.trim()) return; onSave(v); }}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
            style={{ background:"#111827" }}>Zapisz zmiany</button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200" style={{ background:"#e5e7eb", color:"#374151" }}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL: ADD VEHICLE
// ═══════════════════════════════════════════════════════════════════════════════
function AddVehicleModal({ onSave, onClose }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ plate: "", plate2: "", brand: "", type: "Solo", year: new Date().getFullYear(), equipment: [], customEquipment: [], dimensions: "", dimensions2: "", loadingType: "", maxWeight: "", maxWeight2: "", driverName: "", driverPhone: "", driverFrom: today });
  const [newEqInput, setNewEqInput] = useState("");
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const toggleEq = (id) => set("equipment", form.equipment.includes(id)
    ? form.equipment.filter((e) => e !== id)
    : [...form.equipment, id]
  );
  const addCustomEq = () => {
    if (newEqInput.trim()) { set("customEquipment", [...form.customEquipment, newEqInput.trim()]); setNewEqInput(""); }
  };

  const handleSave = () => {
    if (!form.plate.trim()) return;
    const driverHistory = form.driverName
      ? [{ id: uid(), name: form.driverName, phone: form.driverPhone || "", from: form.driverFrom, to: "" }]
      : [];
    onSave({ plate: form.plate, plate2: form.plate2, brand: form.brand, type: form.type, year: Number(form.year), equipment: form.equipment, customEquipment: form.customEquipment, dimensions: form.dimensions, dimensions2: form.dimensions2, loadingType: form.loadingType, maxWeight: form.maxWeight, maxWeight2: form.maxWeight2, driverHistory });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Nowy pojazd</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs">✕</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MF label="Rejestracja (główna)"><MInput placeholder="WGM 0000X" value={form.plate} onChange={(v) => set("plate", v.toUpperCase())} /></MF>
            <MF label="Rejestracja przyczepy"><MInput placeholder="np. TK 760AP" value={form.plate2} onChange={(v) => set("plate2", v.toUpperCase())} /></MF>
            <MF label="Rok"><MInput type="number" value={form.year} onChange={(v) => set("year", v)} /></MF>
            <MF label="Typ pojazdu">
              <MSelect value={form.type} onChange={(v) => set("type", v)}>
                {["Solo","Bus","Zestaw","Chłodnia","Plandeka","Inny"].map((t) => <option key={t}>{t}</option>)}
              </MSelect>
            </MF>
          </div>
          <MF label="Marka / Model"><MInput placeholder="np. MAN TGX" value={form.brand} onChange={(v) => set("brand", v)} /></MF>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Wyposażenie</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {DEFAULT_EQUIPMENT.map((eq) => {
                const checked = form.equipment.includes(eq.id);
                return (
                  <button key={eq.id} onClick={() => toggleEq(eq.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all"
                    style={{
                      background: checked ? "#f0fdf4" : "#f9fafb",
                      border: `1.5px solid ${checked ? "#86efac" : "#e5e7eb"}`,
                      color: checked ? "#166534" : "#6b7280",
                    }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: checked ? "#22c55e" : "#e5e7eb" }}>
                      {checked && <span className="text-white text-xs leading-none">✓</span>}
                    </div>
                    {eq.label}
                  </button>
                );
              })}
            </div>
            {form.customEquipment.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.customEquipment.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe" }}>
                    {item}
                    <button onClick={() => set("customEquipment", form.customEquipment.filter((_, idx) => idx !== i))}
                      className="hover:text-red-400 transition-colors">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" placeholder="Inne wyposażenie..." value={newEqInput}
                onChange={(e) => setNewEqInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomEq(); }}
                className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", color: "#111827" }} />
              <button onClick={addCustomEq} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: "#111827" }}>+ Dodaj</button>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Dane techniczne (opcjonalnie)</div>
            <div className="grid grid-cols-2 gap-3">
              <MF label="Wymiary — pojazd (cm)"><MInput placeholder="607x243x245" value={form.dimensions} onChange={(v) => set("dimensions", v)} /></MF>
              <MF label="Max waga — pojazd (kg)"><MInput type="number" placeholder="3000" value={form.maxWeight} onChange={(v) => set("maxWeight", v)} /></MF>
              {form.plate2 && (
                <>
                  <MF label="Wymiary — przyczepa (cm)"><MInput placeholder="640x245x250" value={form.dimensions2} onChange={(v) => set("dimensions2", v)} /></MF>
                  <MF label="Max waga — przyczepa (kg)"><MInput type="number" placeholder="2100" value={form.maxWeight2} onChange={(v) => set("maxWeight2", v)} /></MF>
                </>
              )}
              <div className="col-span-2">
                <MF label="Rodzaj załadunku"><MInput placeholder="np. Bok, tył, góra" value={form.loadingType} onChange={(v) => set("loadingType", v)} /></MF>
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kierowca startowy (opcjonalnie)</div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MF label="Imię i nazwisko kierowcy">
                  <MInput placeholder="np. Jan Kowalski" value={form.driverName} onChange={(v) => set("driverName", v)} />
                </MF>
                <MF label="Telefon">
                  <MInput placeholder="+48 600 000 000" value={form.driverPhone || ""} onChange={(v) => set("driverPhone", v)} />
                </MF>
              </div>
              <MF label="Podjęcie auta">
                <MInput type="date" value={form.driverFrom} onChange={(v) => set("driverFrom", v)} />
              </MF>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={handleSave} disabled={!form.plate}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-30"
            style={{ background: "#111827" }}>
            Dodaj do floty
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED UI ─────────────────────────────────────────────────────────────────
function PageTitle({ children }) {
  return <h1 className="text-xl font-bold text-gray-900 mb-5">{children}</h1>;
}
function KpiCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="text-xs text-gray-400 font-medium mb-1.5">{label}</div>
      <div className="font-bold text-gray-900 text-lg leading-tight">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
      <div className="h-0.5 mt-3 rounded-full" style={{ background: accent, width: "36%", opacity: 0.7 }} />
    </div>
  );
}
function FSel({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg text-sm outline-none appearance-none cursor-pointer"
      style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#374151", minWidth: "140px", fontFamily: "'DM Sans', sans-serif" }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function MF({ label, children }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function MInput({ type = "text", placeholder, value, onChange, highlight }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
      style={{
        background: "#f9fafb",
        border: `1.5px solid ${highlight ? "#111827" : "#e5e7eb"}`,
        fontFamily: "'DM Sans', sans-serif",
        color: "#111827",
      }} />
  );
}
function MSelect({ value, onChange, children }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none appearance-none"
      style={{ background: "#f9fafb", border: "1.5px solid #e5e7eb", fontFamily: "'DM Sans', sans-serif", color: "#111827" }}>
      {children}
    </select>
  );
}

function FrachtyTab({ frachtyList, vehicles, onAdd, onDelete, onUpdate }) {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const fmt = (n) => n ? parseFloat(n).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2}) : "-";
  const monthFreights = (vid) => frachtyList.filter(r => {
    if (r.vehicleId !== vid) return false;
    if (!r.dataZlecenia) return false;
    const d = new Date(r.dataZlecenia);
    return d.getFullYear() === filterYear && d.getMonth() === filterMonth;
  }).sort((a,b) => (a.dataZlecenia||"").localeCompare(b.dataZlecenia||""));
  const editRecord = editId ? frachtyList.find(r => r.id === editId) : null;
  if (!selectedVehicle) {
    const totalAll = frachtyList.reduce((s,r) => s + (parseFloat(r.cenaEur)||0), 0);
    const totalKm = frachtyList.reduce((s,r) => s + (parseInt(r.kmLadowne)||0), 0);
    return (
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div><h2 className="text-xl font-bold text-gray-900">Frachty</h2><p className="text-sm text-gray-400 mt-0.5">{frachtyList.length} wpisow lacznie</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[["Frachtow",frachtyList.length,"#6366f1"],["Lacznie EUR",fmt(totalAll),"#16a34a"],["KM ladowne",totalKm.toLocaleString("pl-PL"),"#0ea5e9"],["Pojazdow",vehicles.length,"#f59e0b"]].map(([label,value,color]) => (
            <div key={label} className="rounded-xl p-3 border border-gray-100 bg-white"><div className="text-xs text-gray-400 mb-1">{label}</div><div className="text-lg font-bold" style={{color}}>{value}</div></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map(v => {
            const vf = frachtyList.filter(r => r.vehicleId === v.id);
            const suma = vf.reduce((s,r) => s + (parseFloat(r.cenaEur)||0), 0);
            const km = vf.reduce((s,r) => s + (parseInt(r.kmLadowne)||0), 0);
            return (
              <div key={v.id} onClick={() => setSelectedVehicle(v.id)} className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div><div className="font-bold text-gray-900 text-base">{v.plate}</div><div className="text-xs text-gray-400">{v.brand} · {v.year}</div></div>
                  <div className="text-2xl">{v.plate2 ? "🚌" : "🚛"}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50">
                  <div><div className="text-xs text-gray-400">Frachtow</div><div className="font-bold text-gray-900">{vf.length}</div></div>
                  <div><div className="text-xs text-gray-400">Przychod</div><div className="font-bold text-green-700 text-sm">{fmt(suma)}</div></div>
                  <div><div className="text-xs text-gray-400">KM lad.</div><div className="font-bold text-blue-600 text-sm">{km.toLocaleString("pl-PL")}</div></div>
                </div>
                <div className="mt-3 text-xs text-gray-400 text-right">kliknij aby zobaczyc frachty →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const v = vehicles.find(v => v.id === selectedVehicle);
  const rows = monthFreights(selectedVehicle);
  const totalCena = rows.reduce((s,r) => s + (parseFloat(r.cenaEur)||0), 0);
  const totalKmLad = rows.reduce((s,r) => s + (parseInt(r.kmLadowne)||0), 0);
  const totalKmWsz = rows.reduce((s,r) => s + (parseInt(r.kmWszystkie)||0), 0);
  const avgEurKm = totalKmLad > 0 ? (totalCena/totalKmLad).toFixed(2) : "-";
  const miesiaceL = ["Styczniu","Lutym","Marcu","Kwietniu","Maju","Czerwcu","Lipcu","Sierpniu","Wrzesniu","Pazdzierniku","Listopadzie","Grudniu"];
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button onClick={() => setSelectedVehicle(null)} className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 border border-gray-200">← Powrot</button>
        <div className="flex-1"><h2 className="text-xl font-bold text-gray-900">{v?.plate} · Frachty</h2><p className="text-sm text-gray-400">{v?.brand} · {v?.year}</p></div>
        <button onClick={() => { setEditId(null); setShowForm(true); }} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#111827"}}>+ Dodaj fracht</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700">
          {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex gap-1 flex-wrap">
          {["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paz","Lis","Gru"].map((m,i) => (
            <button key={i} onClick={() => setFilterMonth(i)} className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all" style={{background:filterMonth===i?"#111827":"#f3f4f6",color:filterMonth===i?"#fff":"#6b7280"}}>{m}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[["Frachtow",rows.length,"#6366f1"],["Przychod EUR",fmt(totalCena),"#16a34a"],["KM ladowne",totalKmLad.toLocaleString("pl-PL"),"#0ea5e9"],["Sr. EUR/km",avgEurKm,"#f59e0b"]].map(([label,value,color]) => (
          <div key={label} className="rounded-xl p-3 border border-gray-100 bg-white"><div className="text-xs text-gray-400 mb-1">{label}</div><div className="text-lg font-bold" style={{color}}>{value}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 uppercase bg-gray-50">
              {["#","Data zlec.","Data zal.","Data rozl.","Skad","Zaladunek","Rozladunek","Klient","Cena EUR","KM podj.","KM lad.","KM wsz.","EUR/km lad.","EUR/km wsz.","Waga kg","Dyspozytor","Nr FV","Wyslano FV","Termin pl.","Uwagi",""].map(h => <th key={h} className="px-2 py-2.5 text-left whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={21} className="text-center py-10 text-gray-400">Brak frachtow w {miesiaceL[filterMonth]} {filterYear}</td></tr>}
            {rows.map((r,idx) => {
              const eurKmLad = r.kmLadowne && r.cenaEur ? (parseFloat(r.cenaEur)/parseInt(r.kmLadowne)).toFixed(2) : "-";
              const eurKmWsz = r.kmWszystkie && r.cenaEur ? (parseFloat(r.cenaEur)/parseInt(r.kmWszystkie)).toFixed(2) : "-";
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="px-2 py-2 text-gray-400">{idx+1}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.dataZlecenia||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.dataZaladunku||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.dataRozladunku||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.skad||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.zaladunekKod||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.dokod||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap max-w-24 truncate">{r.klient||"-"}</td>
                  <td className="px-2 py-2 text-right font-semibold text-green-700 whitespace-nowrap">{r.cenaEur ? fmt(r.cenaEur) : "-"}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{r.kmPodjazd||"-"}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{r.kmLadowne||"-"}</td>
                  <td className="px-2 py-2 text-right text-gray-600">{r.kmWszystkie||"-"}</td>
                  <td className="px-2 py-2 text-right text-amber-600 font-medium">{eurKmLad}</td>
                  <td className="px-2 py-2 text-right text-blue-600 font-medium">{eurKmWsz}</td>
                  <td className="px-2 py-2 text-gray-500">{r.wagaLadunku||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.dyspozytor||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.nrFV||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.dataWyslania||"-"}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-gray-500">{r.terminPlatnosci||"-"}</td>
                  <td className="px-2 py-2 text-gray-500 max-w-24 truncate">{r.uwagi||""}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(r.id); setShowForm(true); }} className="px-2 py-1 rounded text-xs bg-gray-100 hover:bg-gray-200">ed.</button>
                      <button onClick={() => { if(window.confirm("Usunac?")) onDelete(r.id); }} className="px-2 py-1 rounded text-xs bg-red-50 hover:bg-red-100 text-red-500">x</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                <td colSpan={8} className="px-2 py-2.5 text-gray-700 text-xs uppercase">SUMA</td>
                <td className="px-2 py-2.5 text-right text-green-700">{fmt(totalCena)}</td>
                <td></td>
                <td className="px-2 py-2.5 text-right text-blue-700">{totalKmLad.toLocaleString("pl-PL")}</td>
                <td className="px-2 py-2.5 text-right text-blue-700">{totalKmWsz.toLocaleString("pl-PL")}</td>
                <td className="px-2 py-2.5 text-right text-amber-600">{avgEurKm}</td>
                <td colSpan={8}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showForm && <FrachtyModal record={editRecord} vehicles={vehicles} defaultVehicleId={selectedVehicle} onSave={(data) => { if(editId) onUpdate(editId,data); else onAdd(data); setShowForm(false); setEditId(null); }} onClose={() => { setShowForm(false); setEditId(null); }} />}
    </div>
  );
}

function FrachtyModal({ record, vehicles, onSave, onClose, defaultVehicleId="" }) {
  const empty = {dataZlecenia:"",dataZaladunku:"",dataRozladunku:"",godzZaladunku:"",godzRozladunku:"",skad:"",zaladunekKod:"",dokod:"",klient:"",cenaEur:"",kmPodjazd:"",kmLadowne:"",kmWszystkie:"",wagaLadunku:"",dyspozytor:"",nrFV:"",dataWyslania:"",terminPlatnosci:"",uwagi:"",vehicleId:defaultVehicleId};
  const [f, setF] = useState(record ? {...empty,...record} : empty);
  const set = (k,v) => setF(prev => { const next={...prev,[k]:v}; const pod=parseInt(next.kmPodjazd)||0; const lad=parseInt(next.kmLadowne)||0; next.kmWszystkie=pod+lad>0?String(pod+lad):""; return next; });
  const eurKmLad = f.kmLadowne && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmLadowne)).toFixed(2) : null;
  const eurKmWsz = f.kmWszystkie && f.cenaEur ? (parseFloat(f.cenaEur)/parseInt(f.kmWszystkie)).toFixed(2) : null;
  const inp = "w-full text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-gray-400";
  const lbl = "text-xs font-semibold text-gray-500 mb-1 block";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.4)"}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{maxHeight:"92vh"}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-base font-bold text-gray-900">{record ? "Edytuj fracht" : "Nowy fracht"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">x</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div><label className={lbl}>Pojazd</label><select value={f.vehicleId} onChange={e => set("vehicleId",e.target.value)} className={inp}><option value="">wybierz pojazd</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} {v.brand}</option>)}</select></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={lbl}>Data zlecenia</label><input type="date" value={f.dataZlecenia} onChange={e => set("dataZlecenia",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data zaladunku</label><input type="date" value={f.dataZaladunku} onChange={e => set("dataZaladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data rozladunku</label><input type="date" value={f.dataRozladunku} onChange={e => set("dataRozladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Godz. zaladunku</label><input type="time" value={f.godzZaladunku} onChange={e => set("godzZaladunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Godz. rozladunku</label><input type="time" value={f.godzRozladunku} onChange={e => set("godzRozladunku",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className={lbl}>Skad</label><input placeholder="PL 25-650" value={f.skad} onChange={e => set("skad",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Zaladunek</label><input placeholder="DE 67304" value={f.zaladunekKod} onChange={e => set("zaladunekKod",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Rozladunek</label><input placeholder="FR 93000" value={f.dokod} onChange={e => set("dokod",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className={lbl}>Klient</label><input placeholder="nazwa klienta" value={f.klient} onChange={e => set("klient",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Dyspozytor</label><input placeholder="imie dyspozytora" value={f.dyspozytor} onChange={e => set("dyspozytor",e.target.value)} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lbl}>Cena EUR</label><input type="number" placeholder="0.00" value={f.cenaEur} onChange={e => set("cenaEur",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM podjazd</label><input type="number" placeholder="0" value={f.kmPodjazd} onChange={e => set("kmPodjazd",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM ladowne</label><input type="number" placeholder="0" value={f.kmLadowne} onChange={e => set("kmLadowne",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>KM wszystkie (auto)</label><input readOnly value={f.kmWszystkie} className={inp+" bg-gray-50 text-gray-400"} /></div>
          </div>
          {(eurKmLad||eurKmWsz) && <div className="flex gap-4 text-sm">{eurKmLad && <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 font-semibold">EUR/km lad: {eurKmLad}</span>}{eurKmWsz && <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold">EUR/km wsz: {eurKmWsz}</span>}</div>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className={lbl}>Waga (kg)</label><input type="number" placeholder="0" value={f.wagaLadunku} onChange={e => set("wagaLadunku",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Nr FV</label><input placeholder="F/01/2026" value={f.nrFV} onChange={e => set("nrFV",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Data wyslania FV</label><input type="date" value={f.dataWyslania} onChange={e => set("dataWyslania",e.target.value)} className={inp} /></div>
            <div><label className={lbl}>Termin platnosci</label><input type="date" value={f.terminPlatnosci} onChange={e => set("terminPlatnosci",e.target.value)} className={inp} /></div>
          </div>
          <div><label className={lbl}>Uwagi</label><textarea rows={2} placeholder="dodatkowe informacje..." value={f.uwagi} onChange={e => set("uwagi",e.target.value)} className={inp+" resize-none"} /></div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Anuluj</button>
          <button onClick={() => { if(!f.vehicleId){alert("Wybierz pojazd");return;} if(!f.cenaEur){alert("Wpisz cene EUR");return;} onSave(f); }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"#111827"}}>{record ? "Zapisz zmiany" : "Dodaj fracht"}</button>
        </div>
      </div>
    </div>
  );
}
