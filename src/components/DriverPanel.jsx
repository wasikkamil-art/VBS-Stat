// DriverPanel — kompletny panel kierowcy mobile (1932 linii) + 3 helpery wewnętrzne:
//   - DriverCzasPracyDashboard (203 linii) — czas pracy live
//   - DriverDddUploadCard (94 linii) — upload pliku DDD z karty kierowcy
//   - PlanRow (14 linii) — kafelek wiersza planu czasu pracy
//
// Wydzielone z monolitu App.jsx 2026-04-29 (TODO #5c krok 2). Lazy-loadowane
// przez App.jsx (lazy + Suspense) — kierowca pobiera tylko ten chunk + main core,
// admin nie pobiera w ogóle (oszczędność 2k+ linii kodu w bundle adminskim).

import { useState, useEffect, useRef, useMemo } from "react";
import { addDoc, collection, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { db, auth, storage, functions } from "../firebase";
import { logAction } from "../utils/logAction";
import { isFrachtRozladowany, isStaleUnfinished, getMaxRouteIndex, hasZaladunekActive } from "../utils/frachtStatus";
import {
  REGULATION, ACTIVITY_TYPES,
  fmtHM, fmtTimeShort,
  computeDriverCompliance, computeDriverPlan,
} from "../utils/czasPracy";
import TripSummaryPanel from "./TripSummaryPanel";

function DriverCzasPracyDashboard({ user, vehicle, driverActivities = [], showToast }) {
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Manualna zmiana stanu
  const setActivity = async (type) => {
    try {
      // Zamknij ostatni otwarty segment tego kierowcy
      const mine = driverActivities
        .filter(a => a.driverEmail === user.email)
        .sort((a, b) => (b.startTs || "").localeCompare(a.startTs || ""));
      const openSeg = mine.find(a => !a.endTs);
      const nowIso = new Date().toISOString();
      if (openSeg) {
        if (openSeg.type === type) { showToast("⚙ Stan bez zmian"); return; }
        await updateDoc(doc(db, "driverActivities", openSeg.id), { endTs: nowIso });
      }
      await addDoc(collection(db, "driverActivities"), {
        driverEmail: user.email,
        vehicleId: vehicle?.id || null,
        type,
        startTs: nowIso,
        endTs: null,
        source: "manual",
      });
      showToast(`✅ ${ACTIVITY_TYPES[type]?.label || type}`);
    } catch (e) {
      console.error("setActivity error", e);
      showToast("❌ Błąd zapisu");
    }
  };

  const mySegs = driverActivities.filter(a => a.driverEmail === user.email);
  // Powrót do bazy = osobne ręczne pole tachoCardStart (ustawiane przez admina
  // w zakładce Tacho), NIEZALEŻNE od przeglądu "kiedy wyjeżdża". Brak daty →
  // period28 null → blok ukryty (kierowca NIE widzi błędnego "0 dni / dziś powrót"
  // liczonego od najstarszego segmentu). Decyzja user 2026-06-10: tacho = świętość.
  const periodStart = vehicle?.tachoCardStart || null;

  const compliance = computeDriverCompliance(mySegs, periodStart, new Date());
  const plan = computeDriverPlan(compliance);
  const currentMeta = ACTIVITY_TYPES[compliance.currentStateType] || null;

  // Status color dla licznika do przerwy
  const breakLeft = Math.max(0, REGULATION.CONTINUOUS_DRIVE - compliance.continuousDrive);
  const breakStatus = breakLeft < 30 ? "alarm" : breakLeft < 60 ? "warn" : "ok";
  const breakPalette = {
    ok:    { bg: "#fffbeb", border: "#fde68a", text: "#92400e", fill: "#f59e0b" },
    warn:  { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c", fill: "#ef4444" },
    alarm: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", fill: "#dc2626" },
  }[breakStatus];

  return (
    <div style={{ padding: 0 }}>
      {/* STATUS AKTUALNY */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: `2px solid ${currentMeta?.color || "#e5e7eb"}` }}>
        <div className="flex items-center gap-3">
          <div style={{ width: 12, height: 12, borderRadius: 6, background: currentMeta?.color || "#9ca3af", animation: "pulse 2s infinite" }}></div>
          <div className="flex-1">
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Status aktualny</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
              {currentMeta ? `${currentMeta.icon} ${currentMeta.label.toUpperCase()}` : "— BRAK STANU"}
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {compliance.current?.isOpen ? `od ${fmtTimeShort(compliance.current.startMs)} (${fmtHM(compliance.current.durMin)})` : "Kliknij przycisk poniżej żeby rozpocząć"}
            </div>
          </div>
        </div>
      </div>

      {/* LICZNIK DO PRZERWY */}
      <div style={{ background: breakPalette.bg, border: `2px solid ${breakPalette.border}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: breakPalette.text, textTransform: "uppercase", letterSpacing: 0.5 }}>⏰ Do obowiązkowej przerwy 45 min</div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: breakPalette.text, lineHeight: 1.1, marginBottom: 8, fontVariantNumeric: "tabular-nums" }}>
          {fmtHM(breakLeft)}
        </div>
        <div style={{ height: 8, background: "rgba(0,0,0,0.05)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
          <div style={{
            height: "100%", borderRadius: 4, background: breakPalette.fill,
            width: `${Math.min(100, Math.round((compliance.continuousDrive / REGULATION.CONTINUOUS_DRIVE) * 100))}%`,
          }}></div>
        </div>
        <div className="flex items-center justify-between" style={{ fontSize: 11, color: breakPalette.text }}>
          <span>Jazda ciągła: {fmtHM(compliance.continuousDrive)} / {fmtHM(REGULATION.CONTINUOUS_DRIVE)}</span>
          <span style={{ fontWeight: 700 }}>Przerwa ok. {plan ? fmtTimeShort(plan.nextBreak.atMs) : "—"}</span>
        </div>
      </div>

      {/* DZISIAJ - 4 KPI */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>🗓️ Dzisiaj</div>
          <div style={{ fontSize: 10, color: "#9ca3af" }}>od {fmtTimeShort(compliance.daily.start)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
          {Object.entries(ACTIVITY_TYPES).map(([key, meta]) => (
            <div key={key} style={{ textAlign: "center", padding: 6, borderRadius: 8, background: meta.bg }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: meta.color, margin: "0 auto 4px" }}></div>
              <div style={{ fontSize: 9, color: "#6b7280" }}>{meta.label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{fmtHM(compliance.daily[key])}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, marginBottom: 4 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
            <span style={{ color: "#6b7280" }}>Limit jazdy dziennej</span>
            <span style={{ fontWeight: 700, color: "#374151" }}>{fmtHM(compliance.daily.drive)} / {fmtHM(compliance.daily.limit)}</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#3b82f6", width: `${Math.min(100, Math.round((compliance.daily.drive / compliance.daily.limit) * 100))}%` }}></div>
          </div>
        </div>
      </div>

      {/* PLAN DO PRZODU */}
      {plan && (
        <div style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "1px solid #c7d2fe", borderRadius: 16, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6d28d9", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>📅 Plan do przodu</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PlanRow emoji="⏸" bg="#fffbeb" border="#fde68a" color="#92400e" title="Przerwa 45 min"
              sub={`za ${fmtHM(plan.nextBreak.driveMinToGo)} · ${fmtTimeShort(plan.nextBreak.atMs)} → ${fmtTimeShort(plan.nextBreak.endMs)}`} />
            <PlanRow emoji="🛑" bg="#eff6ff" border="#bfdbfe" color="#1e3a8a" title="Koniec jazdy dziennej"
              sub={`limit ${fmtHM(plan.endOfDay.dailyLimit)} · ${fmtTimeShort(plan.endOfDay.atMs)}`} />
            <PlanRow emoji="🛏" bg="#f0fdf4" border="#bbf7d0" color="#14532d" title="Odpoczynek dzienny 11h"
              sub={`${fmtTimeShort(plan.dailyRest.startMs)} → ${fmtTimeShort(plan.dailyRest.endMs)}`} />
            <PlanRow emoji="🛌" bg="#f5f3ff" border="#c7d2fe" color="#4c1d95" title="Odpoczynek tygodniowy 45h"
              sub={`${fmtTimeShort(plan.weeklyRest.startMs)} → ${fmtTimeShort(plan.weeklyRest.endMs)}`} />
            {plan.returnToBase && (
              <PlanRow emoji="🏠" bg="#fef2f2" border="#fecaca" color="#7f1d1d" title="Powrót do bazy"
                sub={`za ${plan.returnToBase.daysLeft} dni · deadline ${new Date(plan.returnToBase.deadlineMs).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}`} />
            )}
          </div>
        </div>
      )}

      {/* 28-dniowy okres */}
      {compliance.period28 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 12, border: "1px solid #e5e7eb" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>🛣️ Okres 28-dniowy</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>start: {new Date(compliance.period28.startMs).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}</div>
          </div>
          <div className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: "#6b7280" }}>Dzień {compliance.period28.daysPassed} / {REGULATION.RETURN_TO_BASE_DAYS}</span>
            <span style={{ fontWeight: 700, color: "#7c3aed" }}>{compliance.period28.daysLeft} dni do powrotu</span>
          </div>
          <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #7c3aed, #a855f7)", borderRadius: 4, width: `${Math.min(100, Math.round(((REGULATION.RETURN_TO_BASE_DAYS - compliance.period28.daysLeft) / REGULATION.RETURN_TO_BASE_DAYS) * 100))}%` }}></div>
          </div>
          {/* Mini sublimity */}
          {[
            { label: "Jazda tygodniowa", val: compliance.weekly.drive, max: compliance.weekly.limit, color: "#3b82f6" },
            { label: "Jazda dwutygodniowa", val: compliance.biweekly.drive, max: compliance.biweekly.limit, color: "#3b82f6" },
            { label: "Czas pracy (48h/tydz śr.)", val: compliance.weekly.workTime, max: REGULATION.WORK_TIME_WEEKLY_AVG, color: "#f59e0b" },
          ].map(l => (
            <div key={l.label} style={{ marginBottom: 4 }}>
              <div className="flex items-center justify-between" style={{ fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: "#6b7280" }}>{l.label}</span>
                <span style={{ fontWeight: 600, color: "#374151" }}>{fmtHM(l.val)} / {fmtHM(l.max)}</span>
              </div>
              <div style={{ height: 3, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: l.color, width: `${Math.min(100, Math.round((l.val / l.max) * 100))}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PRZYCISKI AKCJI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setActivity("drive")}
          style={{ padding: "14px 12px", borderRadius: 12, border: "none", background: ACTIVITY_TYPES.drive.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🚛 Jazda
        </button>
        <button onClick={() => setActivity("work")}
          style={{ padding: "14px 12px", borderRadius: 12, border: "none", background: ACTIVITY_TYPES.work.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🔧 Inna praca
        </button>
        <button onClick={() => setActivity("avail")}
          style={{ padding: "14px 12px", borderRadius: 12, border: "none", background: ACTIVITY_TYPES.avail.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ⏱ Dyspozycyjność
        </button>
        <button onClick={() => setActivity("rest")}
          style={{ padding: "14px 12px", borderRadius: 12, border: "none", background: ACTIVITY_TYPES.rest.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          🛏 Odpoczynek
        </button>
      </div>

      <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginBottom: 8 }}>
        Auto-wykrywanie z GPS działa w tle. Kliknięcia tutaj nadpisują automat.
      </div>

      {/* ═══ Upload DDD z karty kierowcy ═══ */}
      <DriverDddUploadCard user={user} vehicle={vehicle} showToast={showToast} />
    </div>
  );
}

// Komponent uploadu DDD w panelu kierowcy (mobile)
function DriverDddUploadCard({ user, vehicle, showToast }) {
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setLastResult(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `driverDdd/${Date.now()}_${safeName}`;
      const sRef = storageRef(storage, storagePath);
      await uploadBytes(sRef, file);
      showToast("📤 Plik wgrany, parsuję...");

      const parseDddFile = httpsCallable(functions, "parseDddFile");
      const res = await parseDddFile({ storagePath, originalFileName: file.name });
      const data = res?.data;
      if (data?.success) {
        const m = data.metadata || {};
        setLastResult({
          ok: true,
          driverName: m.driverName || "—",
          cardNumber: m.cardNumber || null,
          activitiesCount: data.activitiesCount || 0,
          periodStart: m.periodStart,
          periodEnd: m.periodEnd,
          fileType: m.fileType,
        });
        showToast(`✅ Sparsowano: ${data.activitiesCount} aktywności`);
      }
    } catch (e) {
      console.error("upload DDD error", e);
      setLastResult({ ok: false, error: e?.message || "Błąd uploadu" });
      showToast("❌ " + (e?.message || "błąd uploadu").slice(0, 60));
    }
    setUploading(false);
  };

  const fmtDate = (ts) => {
    if (!ts) return "—";
    try { return new Date(ts).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
    catch { return ts; }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginTop: 12, border: "1px solid #e5e7eb" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        💾 Wgraj plik DDD z karty
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, lineHeight: 1.5 }}>
        Masz plik <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 3, fontSize: 10 }}>.ddd</code> z karty kierowcy? (np. z aplikacji czytnika kart, Bluetooth czytnika albo emailem z biura)
        Wrzuć go tutaj — system wyciągnie wszystkie Twoje aktywności z dokładnością do sekundy.
      </div>
      <label style={{
        display: "block", padding: "12px", borderRadius: 12, border: "2px dashed #c7d2fe",
        background: uploading ? "#f3f4f6" : "#f5f3ff", textAlign: "center", cursor: uploading ? "wait" : "pointer",
      }}>
        <div style={{ fontSize: 22, marginBottom: 2 }}>{uploading ? "⏳" : "📎"}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9" }}>
          {uploading ? "Wgrywam i parsuję..." : "Wybierz plik DDD z telefonu"}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
          Obsługiwane: .ddd · .esm · .tgd · .v1b
        </div>
        <input type="file" accept=".ddd,.DDD,.esm,.ESM,.tgd,.v1b" disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
          style={{ display: "none" }} />
      </label>

      {lastResult && lastResult.ok && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>
            ✅ Plik sparsowany
          </div>
          <div style={{ fontSize: 11, color: "#166534", lineHeight: 1.6 }}>
            <div>👤 {lastResult.driverName}{lastResult.cardNumber && ` · #${lastResult.cardNumber}`}</div>
            {lastResult.periodStart && <div>📅 {fmtDate(lastResult.periodStart)} → {fmtDate(lastResult.periodEnd)}</div>}
            <div>📊 {lastResult.activitiesCount} aktywności dodanych do Twojego compliance</div>
          </div>
        </div>
      )}
      {lastResult && !lastResult.ok && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", marginBottom: 2 }}>
            ❌ Błąd parsowania
          </div>
          <div style={{ fontSize: 11, color: "#991b1b" }}>{lastResult.error}</div>
        </div>
      )}
    </div>
  );
}

// Pomocniczy wiersz planu
function PlanRow({ emoji, bg, border, color, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 8, borderRadius: 10, background: "#fff", border: `1px solid ${border}` }}>
      <div style={{ width: 24, height: 24, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color }}>{title}</div>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{sub}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  PANEL KIEROWCY — mobile-first, osobny layout
// ═══════════════════════════════════════════════════════════════════
export default function DriverPanel({ user, vehicle, frachty, pauzy, operacyjne = [], driverEvents = [], driverActivities = [], fuelEntries = [], driverDocs = [], showToast, onUpdateFracht = () => {} }) {
  const [selectedFracht, setSelectedFracht] = useState(null);
  const [driverTab, setDriverTab] = useState("home"); // "home" | "zlecenia" | "pojazd" | "serwis" | "spalanie" | "czas" | "dokumenty" | "mapa"
  const [fuelView, setFuelView] = useState("list"); // "list" | "form" | "stats"
  const [fuelForm, setFuelForm] = useState({ date: new Date().toISOString().slice(0,10), liters: "", mileage: "", station: "", cardNr: "", pricePerL: "", country: "PL", currency: "PLN", fullTank: true, isAdblue: false, adblueL: "" });
  const [docView, setDocView] = useState("list"); // "list" | "form"
  const [docForm, setDocForm] = useState({ description: "", type: "paragon", photoFile: null, photoPreview: null });
  const [docUploading, setDocUploading] = useState(false);
  const [driverZoom, setDriverZoom] = useState(() => {
    try { return localStorage.getItem("fleetstat_driver_zoom") || "normal"; } catch { return "normal"; }
  }); // "normal" | "large"
  const zoomScale = driverZoom === "large" ? 1.25 : 1;

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date();

  // Helpery statusu — z src/utils/frachtStatus.js (po konsolidacji 2026-04-28 #5c krok 2).
  // Lokalny `isFrachtRozladowano` shortcut zwraca tylko bool dla pojedynczego frachtu.
  const isFrachtRozladowano = (f) => isFrachtRozladowany(f, driverEvents.filter(e => e.frachtId === f.id));
  // isStaleUnfinished przyjmuje todayStr jako 2nd arg — przekazujemy nasze (DriverPanel scope).

  // Podział na aktywne / przyszłe / historia.
  // WAZNE: klasyfikacja "active vs history" opiera sie WYLACZNIE na fakcie
  // rozladowania (isFrachtRozladowano) lub auto-archive (isStaleUnfinished).
  // NIE uzywamy `dataRozladunku` (data PLANOWANA) jako wyznacznika zamkniecia —
  // kierowca moze byc spozniony i jeszcze w trasie, mimo ze plan juz minal.
  const active = frachty
    .filter(f => {
      if (isFrachtRozladowano(f)) return false;
      if (!f.dataZaladunku) return false;
      if (isStaleUnfinished(f)) return false; // auto-archive stare frachty bez statusu (>STALE_DAYS)
      return f.dataZaladunku <= todayStr;
    })
    // Sort DESC po dataZaladunku — najnowszy aktywny na pierwszym miejscu (mobile tile)
    .sort((a, b) => (b.dataZaladunku || "").localeCompare(a.dataZaladunku || ""));
  const upcoming = frachty
    .filter(f => {
      if (isFrachtRozladowano(f)) return false;
      return f.dataZaladunku && f.dataZaladunku > todayStr;
    })
    // Sort ASC po dataZaladunku — najbliższy nadchodzący pierwszy
    .sort((a, b) => (a.dataZaladunku || "").localeCompare(b.dataZaladunku || ""));
  const history = frachty.filter(f =>
    isFrachtRozladowano(f) || isStaleUnfinished(f)
  );

  const formatKody = (f) => {
    const zal = [f.zaladunekKod, f.zaladunekKod2, f.zaladunekKod3].filter(s => s && s.trim()).join(" / ");
    const roz = [f.dokod, f.dokod2, f.dokod3].filter(s => s && s.trim()).join(" / ");
    return { zal: zal || "—", roz: roz || "—" };
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }); }
    catch { return d; }
  };

  const fmtDateFull = (d) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return d; }
  };

  const daysUntil = (d) => d ? Math.ceil((new Date(d) - today) / 86400000) : null;

  // Cofnięcie statusu (załadunek / rozładunek)
  const undoFrachtStatus = async (fracht, field, r = null) => {
    if (!window.confirm(field === "zaladowano" ? "Cofnąć potwierdzenie załadunku?" : "Cofnąć potwierdzenie rozładunku?")) return;
    try {
      const eventData = {
        type: `cofnij_${field}`,
        frachtId: fracht.id,
        vehicleId: vehicle?.id,
        driverEmail: user.email,
        driverName: user.displayName || user.email,
        ts: new Date().toISOString(),
      };
      if (r != null) eventData.r = r;
      await addDoc(collection(db, "driverEvents"), eventData);
      logAction(`cofnij_${field}`, "driverEvents", { frachtId: fracht.id, r });
      showToast("↩️ Cofnięto potwierdzenie");
    } catch (e) {
      console.error("undo error", e);
      showToast("❌ Błąd cofania");
    }
  };

  // Pomocnicza: ręczny zapis km do frachtu (fallback gdy CAN nie zadziałał / korekta)
  const saveManualKm = async (fracht, field, raw) => {
    const num = Number(String(raw).replace(",", "."));
    if (!isFinite(num) || num <= 0) {
      showToast("❌ Podaj prawidłowy stan licznika");
      return;
    }
    // Jeśli wartość się nie zmieniła — nie rób nic
    if (Number(fracht[field]) === num) return;
    try {
      // Frachty są w tablicy fleet/data.fleetv2_frachty — zapisuj przez setFrachtyList
      onUpdateFracht(fracht.id, { [field]: num });
      logAction(`manual_${field}`, "frachty", { frachtId: fracht.id, km: num });
      showToast("✅ Zapisano stan licznika");
    } catch (e) {
      console.error("saveManualKm error", e);
      showToast("❌ Błąd zapisu");
    }
  };

  // Pomocnicza: pobierz aktualny przebieg z CAN dla danego pojazdu (Atlas API)
  // Zwraca km (number) lub null gdy nie udało się odczytać
  const captureCanMileage = async () => {
    if (!vehicle?.plate) return null;
    try {
      const gpsProxy = httpsCallable(functions, "gpsProxy");
      const res = await gpsProxy({ endpoint: "positionsWithCanDetails" });
      const positions = res?.data?.data?.positionList || res?.data?.data || [];
      if (!Array.isArray(positions)) return null;
      const plate = (vehicle.plate || "").replace(/\s+/g, "").toUpperCase();
      const match = positions.find(p => {
        const pPlate = ((p.plate || p.deviceName || p.name || "") + "").replace(/\s+/g, "").toUpperCase();
        return pPlate && (pPlate === plate || pPlate.includes(plate) || plate.includes(pPlate));
      });
      const km = Number(match?.can?.mileage?.value);
      return isFinite(km) && km > 0 ? km : null;
    } catch (e) {
      console.warn("CAN mileage capture failed:", e?.message || e);
      return null;
    }
  };

  // Aktualizacja statusu frachtu (+ auto-capture km z CAN przy załadunku/rozładunku)
  const updateFrachtStatus = async (fracht, field, value, r = null) => {
    try {
      const eventData = {
        type: field,
        frachtId: fracht.id,
        vehicleId: vehicle?.id,
        value,
        driverEmail: user.email,
        driverName: user.displayName || user.email,
        ts: new Date().toISOString(),
      };
      // Multi-stop rozładunek: r=1 dla R1, r=2 dla R2. null gdy single-stop lub legacy event.
      if (r != null) eventData.r = r;
      await addDoc(collection(db, "driverEvents"), eventData);
      logAction(field, "driverEvents", { frachtId: fracht.id, vehicleId: vehicle?.id });
      // PO REFACTORZE 2026-04-28: NIE propagujemy już statusu do `statusRozladunku`.
      // Status jest computed z driverEvents (single source of truth) przez helper
      // `computeFrachtStatus`. Driver tworzy event `rozladowano` lub `cofnij_rozladowano`,
      // a admin/home tile/filtry odczytują computed status. To eliminuje race condition
      // który był przyczyną buga 2026-04-28 (fracht 2454/2026 — kierowca skończył trasę,
      // event istniał w Firestore, ale dropdown w admin tabeli nadal pokazywał W trasie
      // bo propagacja była nadpisywana przez stale React state w admin panelu).
      const toastMap = {
        zaladowano: "✅ Załadunek potwierdzony",
        rozladowano: "✅ Rozładunek potwierdzony",
        dotarcie_zaladunek: "📍 Dotarcie zapisane",
        start_rozladunek: "🚛 Start zapisany",
        dotarcie_rozladunek: "📍 Dotarcie zapisane",
      };
      if (toastMap[field]) showToast(toastMap[field]);

      // Auto-capture km z CAN — w momentach gdy licznik ma sens:
      //   start_rozladunek   → kmStart  (kierowca rusza z załadunku = pełny przebieg przed jazdą)
      //   dotarcie_rozladunek → kmEnd   (kierowca dotarł na rozładunek = koniec jazdy)
      const kmFieldMap = { start_rozladunek: "kmStart", dotarcie_rozladunek: "kmEnd" };
      const kmField = kmFieldMap[field];
      if (kmField) {
        (async () => {
          const km = await captureCanMileage();
          if (km == null) return;
          // Nie nadpisuj ręcznie wpisanej wartości (kierowca mógł już skorygować)
          if (fracht[kmField] && Math.abs(Number(fracht[kmField]) - km) < 5) return;
          try {
            // Frachty w tablicy fleet/data.fleetv2_frachty — zapisuj przez setFrachtyList parent
            onUpdateFracht(fracht.id, { [kmField]: km });
            logAction(`can_${kmField}`, "frachty", { frachtId: fracht.id, km });
          } catch (e) {
            console.warn(`${kmField} save failed:`, e?.message || e);
          }
        })();
      }

      // Trip finalization — po finalnym dotarcie_rozladunek (ostatni R w hierarchii)
      // wywołaj CF finalizeTrip (idempotent): auto-off Tracker + email do zleceniodawcy.
      // Nie blokujemy UX kierowcy — IIFE async + silent failover (admin może ręcznie
      // wyłączyć tracker z TrackerPill jeśli CF się nie powiedzie).
      if (field === "dotarcie_rozladunek") {
        const eventR = r == null ? 1 : r;
        const maxR = getMaxRouteIndex(fracht);
        if (eventR === maxR && !fracht.tripFinalizedAt) {
          (async () => {
            try {
              const finalizeTripCall = httpsCallable(functions, "finalizeTrip");
              const res = await finalizeTripCall({ frachtId: fracht.id });
              if (res?.data?.emailSent) {
                showToast("📧 Podsumowanie wysłane do zleceniodawcy");
              }
            } catch (e) {
              console.warn("finalizeTrip failed:", e?.message || e);
            }
          })();
        }
      }
    } catch (e) {
      console.error("driverEvent error", e);
      showToast("❌ Błąd zapisu");
    }
  };

  // ── Upload zdjęcia (towar / CMR) ──
  const uploadDriverPhoto = async (type, file, r = null) => {
    if (!file || !selectedFracht) return;
    try {
      const path = `driverPhotos/${selectedFracht.id}/${type}_${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const eventType = type === "towar" ? "towar_photo"
        : type === "cmr_zaladunek" ? "cmr_zaladunek_photo"
        : type === "cmr_rozladunek" ? "cmr_rozladunek_photo"
        : type === "cmr" ? "cmr_photo"
        : `${type}_photo`;
      const eventData = {
        type: eventType,
        frachtId: selectedFracht.id,
        vehicleId: vehicle?.id,
        photoUrl: url,
        driverEmail: user.email,
        driverName: user.displayName || user.email,
        ts: new Date().toISOString(),
      };
      // Multi-stop CMR: r=1 dla R1, r=2 dla R2 (tylko dla cmr_rozladunek_photo gdy hasR2).
      if (r != null) eventData.r = r;
      await addDoc(collection(db, "driverEvents"), eventData);
      showToast(type.includes("cmr") ? "✅ Zdjęcie CMR dodane" : "✅ Zdjęcie towaru dodane");
      return url;
    } catch (e) {
      console.error("Photo upload error:", e);
      showToast("❌ Błąd wysyłania zdjęcia");
      return null;
    }
  };

  // ── Helper: oblicz opóźnienie (planowane vs faktyczne) ──
  const calcDelay = (plannedDate, plannedTime, actualTs) => {
    if (!plannedDate || !actualTs) return null;
    const planned = new Date(`${plannedDate}T${plannedTime || "23:59"}:00`);
    const actual = new Date(actualTs);
    const diffMin = Math.round((actual - planned) / 60000);
    if (diffMin <= 0) return { onTime: true, text: "Na czas", diffMin };
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return { onTime: false, text: h > 0 ? `Opóźnienie ${h}h ${m}min` : `Opóźnienie ${m}min`, diffMin };
  };

  // ── Helper: badge opóźnienia ──
  const renderDelayBadge = (delay) => {
    if (!delay) return null;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
        background: delay.onTime ? "#f0fdf4" : delay.diffMin > 120 ? "#fef2f2" : "#fffbeb",
        color: delay.onTime ? "#15803d" : delay.diffMin > 120 ? "#dc2626" : "#d97706",
      }}>
        {delay.onTime ? "✅" : "⏰"} {delay.text}
      </span>
    );
  };

  // ── Helper: usuń zdjęcie kierowcy ──
  const deleteDriverPhoto = async (eventId) => {
    if (!window.confirm("Usunąć to zdjęcie?")) return;
    try {
      await deleteDoc(doc(db, "driverEvents", eventId));
      showToast("🗑️ Zdjęcie usunięte");
    } catch (e) {
      console.error("Delete photo error:", e);
      showToast("❌ Błąd usuwania");
    }
  };

  // ── Helper: zapisz uwagi kierowcy ──
  const saveDriverNote = async (fracht, type, text, r = null) => {
    if (!fracht || !text?.trim()) return;
    try {
      // Znajdź istniejący event uwagi (per R# gdy r podane) i zaktualizuj lub utwórz nowy
      const existing = driverEvents.find(e =>
        e.frachtId === fracht.id && e.type === type
        && (r == null ? (e.r == null || e.r === 1) : e.r === r)
      );
      if (existing?.id) {
        await updateDoc(doc(db, "driverEvents", existing.id), { note: text.trim(), ts: new Date().toISOString() });
      } else {
        const eventData = {
          type,
          frachtId: fracht.id,
          vehicleId: vehicle?.id,
          note: text.trim(),
          driverEmail: user.email,
          driverName: user.displayName || user.email,
          ts: new Date().toISOString(),
        };
        if (r != null) eventData.r = r;
        await addDoc(collection(db, "driverEvents"), eventData);
      }
      showToast("✅ Uwagi zapisane");
    } catch (e) {
      console.error("Save note error:", e);
      showToast("❌ Błąd zapisu uwag");
    }
  };

  // ── Helper: status step (potwierdź/cofnij z datą) ──
  const renderStatusStep = (isDone, label, event, enabled, onConfirm, onUndo) => (
    <div style={{padding: 12, borderRadius: 12, marginBottom: 8, opacity: enabled ? 1 : 0.4,
      background: isDone ? "#f0fdf4" : "#f8fafc", border: `1px solid ${isDone ? "#bbf7d0" : "#e5e7eb"}`}}>
      <div className="flex items-center justify-between">
        <div>
          <div style={{fontSize: 13, fontWeight: 600, color: isDone ? "#15803d" : "#374151"}}>
            {isDone ? "✅" : "⏳"} {label}
          </div>
          {event && <div style={{fontSize: 12, color: "#6b7280", marginTop: 2}}>
            {new Date(event.value || event.ts).toLocaleString("pl-PL", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
          </div>}
        </div>
        {enabled && !isDone && (
          <button onClick={onConfirm}
            style={{padding: "8px 16px", borderRadius: 10, border: "none", background: "#3b82f6", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"}}>
            Potwierdź
          </button>
        )}
        {isDone && onUndo && (
          <button onClick={onUndo}
            style={{padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af", fontSize: 11, fontWeight: 500, cursor: "pointer"}}>
            ↩ Cofnij
          </button>
        )}
      </div>
    </div>
  );

  // ── Detail view (zlecenie) — wg mockupu ──
  if (selectedFracht) {
    const f = selectedFracht;
    const kody = formatKody(f);
    // Sprawdź driverEvents dla tego frachtu (uwzględnij cofnięcia)
    const myEvents = driverEvents.filter(ev => ev.frachtId === f.id).sort((a,b) => (a.ts||"").localeCompare(b.ts||""));
    // Multi-stop detection — fracht ma 2 rozładunki gdy są pola dla R2
    const hasR2 = !!(f.dataRozladunku2 || (f.dokod2 && String(f.dokod2).trim()) || (f.rozladunekAdres2 && String(f.rozladunekAdres2).trim()));

    const zalEvent = myEvents.filter(e => e.type === "zaladowano").pop();
    const zalUndo = myEvents.filter(e => e.type === "cofnij_zaladowano").pop();
    const rozEvent = myEvents.filter(e => e.type === "rozladowano").pop();
    const rozUndo = myEvents.filter(e => e.type === "cofnij_rozladowano").pop();
    const towarPhotos = myEvents.filter(e => e.type === "towar_photo");
    const towarDmgPhotos = myEvents.filter(e => e.type === "towar_damage_photo");
    const cmrZalPhotos = myEvents.filter(e => e.type === "cmr_zaladunek_photo");
    // cmr_photo = stary format (legacy, sprzed rozbicia na załadunek/rozładunek) — traktujemy jak rozładunek.
    // Dla hasR2: r==null lub r===1 → R1, r===2 → R2 (backward compat: legacy bez r = R1).
    const cmrRozPhotos = myEvents.filter(e => (e.type === "cmr_rozladunek_photo" || e.type === "cmr_photo") && (e.r == null || e.r === 1));
    const cmrR2Photos = hasR2 ? myEvents.filter(e => e.type === "cmr_rozladunek_photo" && e.r === 2) : [];
    // Nowe statusy
    const dotarcieZalEvent = myEvents.filter(e => e.type === "dotarcie_zaladunek").pop();
    const dotarcieZalUndo = myEvents.filter(e => e.type === "cofnij_dotarcie_zaladunek").pop();
    const startRozEvent = myEvents.filter(e => e.type === "start_rozladunek").pop();
    const startRozUndo = myEvents.filter(e => e.type === "cofnij_start_rozladunek").pop();
    // dotarcie_rozladunek: r==null lub r===1 → R1, r===2 → R2 (backward compat).
    const dotarcieRozEvent = myEvents.filter(e => e.type === "dotarcie_rozladunek" && (e.r == null || e.r === 1)).pop();
    const dotarcieRozUndo = myEvents.filter(e => e.type === "cofnij_dotarcie_rozladunek" && (e.r == null || e.r === 1)).pop();
    const dotarcieR2Event = hasR2 ? myEvents.filter(e => e.type === "dotarcie_rozladunek" && e.r === 2).pop() : null;
    const dotarcieR2Undo = hasR2 ? myEvents.filter(e => e.type === "cofnij_dotarcie_rozladunek" && e.r === 2).pop() : null;
    // Cofnięcie anuluje jeśli nowsze. Po refactorze 2026-04-28 driver flow nie
    // emit'uje już eventu `zaladowano` (zastąpiony przez dotarcie_zaladunek + start_rozladunek)
    // — `hasZaladunekActive` pokrywa wszystkie warianty + legacy backward compat.
    const hasZal = hasZaladunekActive(myEvents) || !!f._driverZaladowano;
    const hasRoz = isFrachtRozladowany(f, myEvents);
    const hasDotarcieZal = !!dotarcieZalEvent && (!dotarcieZalUndo || dotarcieZalEvent.ts > dotarcieZalUndo.ts);
    const hasStartRoz = !!startRozEvent && (!startRozUndo || startRozEvent.ts > startRozUndo.ts);
    const hasDotarcieRoz = !!dotarcieRozEvent && (!dotarcieRozUndo || dotarcieRozEvent.ts > dotarcieRozUndo.ts);
    const hasDotarcieR2 = hasR2 && !!dotarcieR2Event && (!dotarcieR2Undo || dotarcieR2Event.ts > dotarcieR2Undo.ts);
    // Uwagi kierowcy — per R# w hasR2
    const uwagiZalEvent = myEvents.filter(e => e.type === "uwagi_zaladunek").pop();
    const uwagiRozEvent = myEvents.filter(e => e.type === "uwagi_rozladunek" && (e.r == null || e.r === 1)).pop();
    const uwagiR2Event = hasR2 ? myEvents.filter(e => e.type === "uwagi_rozladunek" && e.r === 2).pop() : null;
    const hasCmrZal = cmrZalPhotos.length > 0;
    const hasCmrRoz = cmrRozPhotos.length > 0;
    const hasCmrR2 = cmrR2Photos.length > 0;

    // Round-trip linker: znajdź drugi etap kółka (jeśli istnieje)
    const roundTripPartner = (() => {
      if (f.linkedFrachtId) {
        const orig = frachty.find(o => o.id === f.linkedFrachtId);
        if (orig) return { fracht: orig, role: "powrót", partnerRole: "etap 1 (oryginał)" };
      }
      const ret = frachty.find(o => o && o.linkedFrachtId === f.id);
      if (ret) return { fracht: ret, role: "etap 1", partnerRole: "etap 2 (powrót)" };
      return null;
    })();
    const partnerEvents = roundTripPartner ? driverEvents.filter(e => e.frachtId === roundTripPartner.fracht.id) : [];
    const partnerDone = roundTripPartner ? isFrachtRozladowany(roundTripPartner.fracht, partnerEvents) : false;

    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: 40, zoom: driverZoom === "large" ? 1.2 : 1 }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
        <div className="max-w-lg mx-auto p-4">
          <button onClick={() => setSelectedFracht(null)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 py-2"
            style={{ minHeight: 44 }}>
            ← Powrót
          </button>

          {/* Round-trip banner: gdy fracht jest częścią kółka */}
          {roundTripPartner && (
            <div onClick={() => setSelectedFracht(roundTripPartner.fracht)}
              style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 12, marginBottom: 12, cursor: "pointer" }}>
              <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700, marginBottom: 4 }}>
                🔄 KÓŁKO — jesteś w {roundTripPartner.role === "powrót" ? "etapie 2 (powrotnym)" : "etapie 1 (oryginalnym)"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#581c87" }}>
                {partnerDone ? "✅" : "⏳"} {roundTripPartner.partnerRole}: {(roundTripPartner.fracht.zaladunekKod || "—").split(" ").slice(0,2).join(" ")} → {(roundTripPartner.fracht.dokod || "—").split(" ").slice(0,2).join(" ")}
              </div>
              <div style={{ fontSize: 11, color: "#7e22ce", marginTop: 4, fontWeight: 500 }}>
                → kliknij żeby przełączyć na drugi etap
              </div>
            </div>
          )}

          {/* ═══ HEADER ═══ */}
          <div style={{background: "linear-gradient(135deg, #1e293b, #334155)", borderRadius: 16, padding: 20, marginBottom: 16}}>
            <div className="flex items-center justify-between" style={{marginBottom: 4}}>
              {f.nrRef && <span style={{color: "#94a3b8", fontSize: 12, fontWeight: 600}}>REF: {f.nrRef}</span>}
              <span style={{fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: hasRoz ? "rgba(34,197,94,0.2)" : hasZal ? "rgba(59,130,246,0.2)" : "rgba(251,191,36,0.2)",
                color: hasRoz ? "#4ade80" : hasZal ? "#60a5fa" : "#fbbf24"}}>
                {hasRoz ? "Rozładowano" : hasZal ? "W trasie" : "Oczekuje"}
              </span>
            </div>
            <div style={{color: "#fff", fontSize: 13, marginTop: 4}}>{f.klient || "—"}</div>
          </div>

          {/* ═══ TRASA ═══ */}
          <div style={{background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", marginBottom: 16}}>
            {/* Załadunek */}
            <div style={{padding: "16px 16px 12px", borderBottom: "1px solid #f3f4f6"}}>
              <div className="flex items-center gap-2" style={{marginBottom: 8}}>
                <div style={{width: 10, height: 10, borderRadius: "50%", background: "#3b82f6", border: "2px solid #bfdbfe"}}></div>
                <span style={{fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 0.5}}>Załadunek</span>
              </div>
              <div style={{paddingLeft: 18}}>
                <div style={{fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 2}}>{kody.zal}</div>
                {f.zaladunekAdres && <div style={{fontSize: 13, color: "#6b7280", marginBottom: 2}}>{f.zaladunekAdres}</div>}
                <div style={{fontSize: 13, color: "#374151", fontWeight: 600}}>
                  {fmtDate(f.dataZaladunku)}{f.godzZaladunku ? ` · ${f.godzZaladunku}` : ""}
                </div>
                {f.zaladunekTelefon && (
                  <a href={`tel:${f.zaladunekTelefon}`} style={{fontSize: 13, color: "#3b82f6", textDecoration: "none", display: "block", marginTop: 4}}>
                    📞 {f.zaladunekTelefon}
                  </a>
                )}
                {f.zaladunekGeo && (() => {
                  const [lat,lng] = f.zaladunekGeo.split(",").map(Number);
                  return (
                    <div style={{marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe"}}>
                      <div style={{fontSize: 11, color: "#6b7280", marginBottom: 4}}>📍 Współrzędne GPS</div>
                      <div style={{fontSize: 18, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5, fontFamily: "monospace"}}>
                        {lat?.toFixed(5)}, {lng?.toFixed(5)}
                      </div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${f.zaladunekGeo}&travelmode=driving`}
                        target="_blank" rel="noopener noreferrer"
                        style={{display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
                          padding: "10px 16px", borderRadius: 10, background: "#3b82f6", color: "#fff",
                          fontSize: 14, fontWeight: 600, textDecoration: "none"}}>
                        🧭 Nawiguj do załadunku
                      </a>
                    </div>
                  );
                })()}
              </div>
            </div>
            {/* Rozładunek */}
            <div style={{padding: "12px 16px 16px"}}>
              <div className="flex items-center gap-2" style={{marginBottom: 8}}>
                <div style={{width: 10, height: 10, borderRadius: "50%", background: "#10b981", border: "2px solid #a7f3d0"}}></div>
                <span style={{fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5}}>Rozładunek</span>
              </div>
              <div style={{paddingLeft: 18}}>
                <div style={{fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 2}}>{kody.roz}</div>
                {f.rozladunekAdres && <div style={{fontSize: 13, color: "#6b7280", marginBottom: 2}}>{f.rozladunekAdres}</div>}
                <div style={{fontSize: 13, color: "#374151", fontWeight: 600}}>
                  {fmtDate(f.dataRozladunku)}{f.godzRozladunku ? ` · ${f.godzRozladunku}` : ""}
                </div>
                {f.rozladunekTelefon && (
                  <a href={`tel:${f.rozladunekTelefon}`} style={{fontSize: 13, color: "#3b82f6", textDecoration: "none", display: "block", marginTop: 4}}>
                    📞 {f.rozladunekTelefon}
                  </a>
                )}
                {f.rozladunekGeo && (() => {
                  const [lat,lng] = f.rozladunekGeo.split(",").map(Number);
                  return (
                    <div style={{marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0"}}>
                      <div style={{fontSize: 11, color: "#6b7280", marginBottom: 4}}>📍 Współrzędne GPS</div>
                      <div style={{fontSize: 18, fontWeight: 700, color: "#1e293b", letterSpacing: 0.5, fontFamily: "monospace"}}>
                        {lat?.toFixed(5)}, {lng?.toFixed(5)}
                      </div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${f.rozladunekGeo}&travelmode=driving`}
                        target="_blank" rel="noopener noreferrer"
                        style={{display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8,
                          padding: "10px 16px", borderRadius: 10, background: "#10b981", color: "#fff",
                          fontSize: 14, fontWeight: 600, textDecoration: "none"}}>
                        🧭 Nawiguj do rozładunku
                      </a>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ═══ TOWAR ═══ */}
          {(f.wagaLadunku || f.towarIloscPalet || f.towarPalety || f.towarOpis) && (
            <div style={{background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: 16, marginBottom: 16}}>
              <div style={{fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12}}>Towar</div>
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: (f.towarPalety || f.towarOpis) ? 12 : 0}}>
                {f.towarIloscPalet && (
                  <div style={{padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                    <div style={{fontSize: 11, color: "#9ca3af"}}>Ilość palet</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "#111827"}}>{f.towarIloscPalet}</div>
                  </div>
                )}
                {f.wagaLadunku && (
                  <div style={{padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                    <div style={{fontSize: 11, color: "#9ca3af"}}>Waga łączna</div>
                    <div style={{fontSize: 18, fontWeight: 700, color: "#111827"}}>{f.wagaLadunku} kg</div>
                  </div>
                )}
              </div>
              {f.towarPalety && (
                <div>
                  <div style={{fontSize: 11, color: "#9ca3af", marginBottom: 6}}>Wymiary</div>
                  {f.towarPalety.split("\n").filter(Boolean).map((line, i) => (
                    <div key={i} style={{padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9", marginBottom: 4, fontSize: 13, color: "#374151", fontWeight: 500}}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {f.towarOpis && !f.towarPalety && (
                <div style={{fontSize: 13, color: "#374151"}}>{f.towarOpis}</div>
              )}
              {f.zaladunekTyp && (
                <div style={{marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 13, color: "#92400e", fontWeight: 500}}>
                  Załadunek: {f.zaladunekTyp}
                </div>
              )}
            </div>
          )}

          {/* ═══ UWAGI ═══ */}
          {f.uwagi && (
            <div style={{background: "#fffbeb", borderRadius: 12, border: "1px solid #fde68a", padding: "12px 16px", marginBottom: 16}}>
              <div style={{fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4}}>Uwagi</div>
              <div style={{fontSize: 13, color: "#78350f"}}>{f.uwagi}</div>
            </div>
          )}

          {/* ═══ KAFELEK 1: ZAŁADUNEK ═══ */}
          {(() => { const zalDelay = calcDelay(f.dataZaladunku, f.godzZaladunku, dotarcieZalEvent?.value || dotarcieZalEvent?.ts); return (
          <div style={{background: "#fff", borderRadius: 16, border: "2px solid #bfdbfe", padding: 16, marginBottom: 12}}>
            <div className="flex items-center justify-between" style={{marginBottom: 8}}>
              <div style={{fontSize: 13, fontWeight: 700, color: "#1d4ed8"}}>📦 ZAŁADUNEK</div>
              <span style={{fontSize: 11, color: "#9ca3af"}}>{fmtDate(f.dataZaladunku)}{f.godzZaladunku ? ` · ${f.godzZaladunku}` : ""}</span>
            </div>
            {hasDotarcieZal && zalDelay && (
              <div style={{marginBottom: 10}}>{renderDelayBadge(zalDelay)}</div>
            )}

            {/* 1. Dotarcie na załadunek */}
            {renderStatusStep(hasDotarcieZal, "Dotarcie na załadunek", dotarcieZalEvent, !false, () => updateFrachtStatus(f, "dotarcie_zaladunek", new Date().toISOString()), () => undoFrachtStatus(f, "dotarcie_zaladunek"))}

            {/* 2. Zdjęcia towaru */}
            {hasDotarcieZal && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8}}>📸 Zdjęcia towaru</div>
                {towarPhotos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {towarPhotos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#15803d",
                            fontWeight: 500, textDecoration: "none"}}>
                          📸 {i + 1} · {p.ts ? new Date(p.ts).toLocaleString("pl-PL", {hour:"2-digit",minute:"2-digit"}) : ""}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #d1d5db", background: "#fff",
                  color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {towarPhotos.length > 0 ? "Dodaj kolejne zdjęcie" : "Dodaj zdjęcia towaru"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("towar", file); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}

            {/* 3. CMR załadunek — wiele zdjęć, z galerii lub aparatu */}
            {hasDotarcieZal && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: hasCmrZal ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasCmrZal ? "#bbf7d0" : "#e5e7eb"}`}}>
                <div style={{fontSize: 13, fontWeight: 600, color: hasCmrZal ? "#15803d" : "#374151", marginBottom: 8}}>
                  {hasCmrZal ? "✅" : "📄"} CMR załadunek {cmrZalPhotos.length > 1 && <span style={{fontSize: 11, color: "#6b7280", fontWeight: 400}}>({cmrZalPhotos.length})</span>}
                </div>
                {cmrZalPhotos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {cmrZalPhotos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#eef2ff", border: "1px solid #c7d2fe", fontSize: 12, color: "#4338ca",
                            fontWeight: 500, textDecoration: "none"}}>
                          📄 CMR {i + 1} · {p.ts ? new Date(p.ts).toLocaleString("pl-PL", {hour:"2-digit",minute:"2-digit"}) : ""}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #d1d5db", background: "#fff",
                  color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {cmrZalPhotos.length > 0 ? "Dodaj kolejne CMR" : "Dodaj CMR załadunek"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("cmr_zaladunek", file); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}

            {/* 4. Uwagi kierowcy — załadunek */}
            {hasDotarcieZal && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6}}>📝 Uwagi — załadunek</div>
                <textarea
                  defaultValue={uwagiZalEvent?.note || ""}
                  placeholder="Wpisz uwagi z załadunku..."
                  onBlur={(e) => { if (e.target.value !== (uwagiZalEvent?.note || "")) saveDriverNote(f, "uwagi_zaladunek", e.target.value); }}
                  style={{width: "100%", fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
                    background: "#fff", resize: "vertical", minHeight: 60, fontFamily: "inherit"}} />
                {uwagiZalEvent?.ts && <div style={{fontSize: 11, color: "#9ca3af", marginTop: 4}}>
                  Zapisane: {new Date(uwagiZalEvent.ts).toLocaleString("pl-PL", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                </div>}
              </div>
            )}

            {/* 5. Start do rozładunku */}
            {hasDotarcieZal && renderStatusStep(hasStartRoz, "Start do rozładunku", startRozEvent, hasCmrZal, () => updateFrachtStatus(f, "start_rozladunek", new Date().toISOString()), () => undoFrachtStatus(f, "start_rozladunek"))}

            {/* 6. Stan licznika przy starcie (fallback gdy CAN nie zadziałał) */}
            {hasStartRoz && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4}}>🔢 Stan licznika — start trasy</div>
                <div style={{fontSize: 11, color: "#9ca3af", marginBottom: 8}}>
                  {f.kmStart ? "📡 Odczyt z CAN — skoryguj jeśli nieprawidłowy" : "⚠️ Auto nie zapisało — wpisz ręcznie"}
                </div>
                <input
                  type="number"
                  step="1"
                  defaultValue={f.kmStart || ""}
                  placeholder="np. 234567"
                  onBlur={(e) => { if (e.target.value) saveManualKm(f, "kmStart", e.target.value); }}
                  style={{width: "100%", fontSize: 16, padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e5e7eb", background: "#fff", fontFamily: "inherit", boxSizing: "border-box"}} />
              </div>
            )}
          </div>); })()}

          {/* ═══ KAFELEK 2: ROZŁADUNEK (single-stop lub R1) ═══ */}
          {(() => {
            const rozDelay = calcDelay(f.dataRozladunku, f.godzRozladunku, dotarcieRozEvent?.value || dotarcieRozEvent?.ts);
            const r1Param = hasR2 ? 1 : null;
            const sectionTitle = hasR2 ? "📦 ROZŁADUNEK 1" : "📦 ROZŁADUNEK";
            return (
          <div style={{background: "#fff", borderRadius: 16, border: `2px solid ${hasStartRoz ? "#a7f3d0" : "#e5e7eb"}`, padding: 16, opacity: hasStartRoz ? 1 : 0.4}}>
            <div className="flex items-center justify-between" style={{marginBottom: 8}}>
              <div style={{fontSize: 13, fontWeight: 700, color: "#059669"}}>{sectionTitle}</div>
              <span style={{fontSize: 11, color: "#9ca3af"}}>{fmtDate(f.dataRozladunku)}{f.godzRozladunku ? ` · ${f.godzRozladunku}` : ""}</span>
            </div>
            {hasR2 && (f.rozladunekAdres || f.dokod) && (
              <div style={{fontSize: 12, color: "#6b7280", marginBottom: 8, paddingLeft: 2}}>{f.rozladunekAdres || f.dokod}</div>
            )}
            {hasDotarcieRoz && rozDelay && (
              <div style={{marginBottom: 10}}>{renderDelayBadge(rozDelay)}</div>
            )}

            {/* 1. Dotarcie na rozładunek */}
            {renderStatusStep(hasDotarcieRoz, hasR2 ? "Dotarcie na rozładunek 1" : "Dotarcie na rozładunek", dotarcieRozEvent, hasStartRoz, () => updateFrachtStatus(f, "dotarcie_rozladunek", new Date().toISOString(), r1Param), () => undoFrachtStatus(f, "dotarcie_rozladunek", r1Param))}

            {/* 1b. Stan licznika — koniec trasy. TYLKO dla single-stop. Dla hasR2 licznik jest na R2 (ostatnim stopie). */}
            {!hasR2 && hasDotarcieRoz && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4}}>🔢 Stan licznika — koniec trasy</div>
                <div style={{fontSize: 11, color: "#9ca3af", marginBottom: 8}}>
                  {f.kmEnd ? "📡 Odczyt z CAN — skoryguj jeśli nieprawidłowy" : "⚠️ Auto nie zapisało — wpisz ręcznie"}
                  {f.kmStart && f.kmEnd && Number(f.kmEnd) > Number(f.kmStart) && (
                    <span style={{color: "#15803d", fontWeight: 600}}> · Trasa: {Number(f.kmEnd) - Number(f.kmStart)} km</span>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  defaultValue={f.kmEnd || ""}
                  placeholder="np. 234789"
                  onBlur={(e) => { if (e.target.value) saveManualKm(f, "kmEnd", e.target.value); }}
                  style={{width: "100%", fontSize: 16, padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e5e7eb", background: "#fff", fontFamily: "inherit", boxSizing: "border-box"}} />
              </div>
            )}

            {/* 2. CMR rozładunek (R1 gdy hasR2) — wiele zdjęć */}
            {hasDotarcieRoz && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: hasCmrRoz ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasCmrRoz ? "#bbf7d0" : "#e5e7eb"}`}}>
                <div style={{fontSize: 13, fontWeight: 600, color: hasCmrRoz ? "#15803d" : "#374151", marginBottom: 8}}>
                  {hasCmrRoz ? "✅" : "📄"} CMR rozładunek{hasR2 ? " 1" : ""} {cmrRozPhotos.length > 1 && <span style={{fontSize: 11, color: "#6b7280", fontWeight: 400}}>({cmrRozPhotos.length})</span>}
                </div>
                {cmrRozPhotos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {cmrRozPhotos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#eef2ff", border: "1px solid #c7d2fe", fontSize: 12, color: "#4338ca",
                            fontWeight: 500, textDecoration: "none"}}>
                          📄 CMR {i + 1} · {p.ts ? new Date(p.ts).toLocaleString("pl-PL", {hour:"2-digit",minute:"2-digit"}) : ""}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #d1d5db", background: "#fff",
                  color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {cmrRozPhotos.length > 0 ? "Dodaj kolejne CMR" : `Dodaj CMR rozładunek${hasR2 ? " 1" : ""}`}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("cmr_rozladunek", file, r1Param); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}

            {/* 3. Uwagi kierowcy — rozładunek (R1 gdy hasR2) */}
            {hasDotarcieRoz && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6}}>📝 Uwagi — rozładunek{hasR2 ? " 1" : ""}</div>
                <textarea
                  defaultValue={uwagiRozEvent?.note || ""}
                  placeholder={hasR2 ? "Wpisz uwagi z rozładunku 1..." : "Wpisz uwagi z rozładunku..."}
                  onBlur={(e) => { if (e.target.value !== (uwagiRozEvent?.note || "")) saveDriverNote(f, "uwagi_rozladunek", e.target.value, r1Param); }}
                  style={{width: "100%", fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
                    background: "#fff", resize: "vertical", minHeight: 60, fontFamily: "inherit"}} />
                {uwagiRozEvent?.ts && <div style={{fontSize: 11, color: "#9ca3af", marginTop: 4}}>
                  Zapisane: {new Date(uwagiRozEvent.ts).toLocaleString("pl-PL", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                </div>}
              </div>
            )}

            {/* 4. Zdjęcie uszkodzonego towaru — TYLKO dla single-stop. Dla hasR2 damage photos są na R2 (ostatnim stopie) */}
            {!hasR2 && hasDotarcieRoz && (
              <div style={{padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4}}>📸 Zdjęcie uszkodzeń <span style={{fontSize: 11, color: "#9ca3af", fontWeight: 400}}>(opcjonalne)</span></div>
                {towarDmgPhotos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {towarDmgPhotos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#dc2626",
                            fontWeight: 500, textDecoration: "none"}}>
                          ⚠️ Uszkodzenie {i + 1}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #fecaca", background: "#fff",
                  color: "#9ca3af", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {towarDmgPhotos.length > 0 ? "Dodaj kolejne zdjęcie uszkodzenia" : "Dodaj zdjęcia uszkodzenia"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("towar_damage", file); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}
          </div>); })()}

          {/* ═══ KAFELEK 3: ROZŁADUNEK 2 (tylko dla multi-stop hasR2) ═══ */}
          {hasR2 && (() => {
            const r2Delay = calcDelay(f.dataRozladunku2, f.godzRozladunku2, dotarcieR2Event?.value || dotarcieR2Event?.ts);
            const r2Enabled = hasDotarcieRoz; // R2 odblokowane gdy R1 dotarcie zrobione
            return (
          <div style={{background: "#fff", borderRadius: 16, border: `2px solid ${r2Enabled ? "#a7f3d0" : "#e5e7eb"}`, padding: 16, opacity: r2Enabled ? 1 : 0.4, marginTop: 16}}>
            <div className="flex items-center justify-between" style={{marginBottom: 8}}>
              <div style={{fontSize: 13, fontWeight: 700, color: "#059669"}}>📦 ROZŁADUNEK 2</div>
              <span style={{fontSize: 11, color: "#9ca3af"}}>{fmtDate(f.dataRozladunku2)}{f.godzRozladunku2 ? ` · ${f.godzRozladunku2}` : ""}</span>
            </div>
            {(f.rozladunekAdres2 || f.dokod2) && (
              <div style={{fontSize: 12, color: "#6b7280", marginBottom: 8, paddingLeft: 2}}>{f.rozladunekAdres2 || f.dokod2}</div>
            )}
            {hasDotarcieR2 && r2Delay && (
              <div style={{marginBottom: 10}}>{renderDelayBadge(r2Delay)}</div>
            )}

            {/* 1. Dotarcie na rozładunek 2 */}
            {renderStatusStep(hasDotarcieR2, "Dotarcie na rozładunek 2", dotarcieR2Event, r2Enabled, () => updateFrachtStatus(f, "dotarcie_rozladunek", new Date().toISOString(), 2), () => undoFrachtStatus(f, "dotarcie_rozladunek", 2))}

            {/* 1b. Stan licznika — koniec trasy (na ostatnim stopie) */}
            {hasDotarcieR2 && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4}}>🔢 Stan licznika — koniec trasy</div>
                <div style={{fontSize: 11, color: "#9ca3af", marginBottom: 8}}>
                  {f.kmEnd ? "📡 Odczyt z CAN — skoryguj jeśli nieprawidłowy" : "⚠️ Auto nie zapisało — wpisz ręcznie"}
                  {f.kmStart && f.kmEnd && Number(f.kmEnd) > Number(f.kmStart) && (
                    <span style={{color: "#15803d", fontWeight: 600}}> · Trasa: {Number(f.kmEnd) - Number(f.kmStart)} km</span>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  defaultValue={f.kmEnd || ""}
                  placeholder="np. 234789"
                  onBlur={(e) => { if (e.target.value) saveManualKm(f, "kmEnd", e.target.value); }}
                  style={{width: "100%", fontSize: 16, padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #e5e7eb", background: "#fff", fontFamily: "inherit", boxSizing: "border-box"}} />
              </div>
            )}

            {/* 2. CMR rozładunek 2 */}
            {hasDotarcieR2 && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: hasCmrR2 ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasCmrR2 ? "#bbf7d0" : "#e5e7eb"}`}}>
                <div style={{fontSize: 13, fontWeight: 600, color: hasCmrR2 ? "#15803d" : "#374151", marginBottom: 8}}>
                  {hasCmrR2 ? "✅" : "📄"} CMR rozładunek 2 {cmrR2Photos.length > 1 && <span style={{fontSize: 11, color: "#6b7280", fontWeight: 400}}>({cmrR2Photos.length})</span>}
                </div>
                {cmrR2Photos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {cmrR2Photos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#eef2ff", border: "1px solid #c7d2fe", fontSize: 12, color: "#4338ca",
                            fontWeight: 500, textDecoration: "none"}}>
                          📄 CMR {i + 1} · {p.ts ? new Date(p.ts).toLocaleString("pl-PL", {hour:"2-digit",minute:"2-digit"}) : ""}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #d1d5db", background: "#fff",
                  color: "#6b7280", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {cmrR2Photos.length > 0 ? "Dodaj kolejne CMR" : "Dodaj CMR rozładunek 2"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("cmr_rozladunek", file, 2); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}

            {/* 3. Uwagi kierowcy — rozładunek 2 */}
            {hasDotarcieR2 && (
              <div style={{padding: 12, borderRadius: 12, marginBottom: 8, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6}}>📝 Uwagi — rozładunek 2</div>
                <textarea
                  defaultValue={uwagiR2Event?.note || ""}
                  placeholder="Wpisz uwagi z rozładunku 2..."
                  onBlur={(e) => { if (e.target.value !== (uwagiR2Event?.note || "")) saveDriverNote(f, "uwagi_rozladunek", e.target.value, 2); }}
                  style={{width: "100%", fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
                    background: "#fff", resize: "vertical", minHeight: 60, fontFamily: "inherit"}} />
                {uwagiR2Event?.ts && <div style={{fontSize: 11, color: "#9ca3af", marginTop: 4}}>
                  Zapisane: {new Date(uwagiR2Event.ts).toLocaleString("pl-PL", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
                </div>}
              </div>
            )}

            {/* 4. Zdjęcie uszkodzonego towaru (na ostatnim stopie = R2) */}
            {hasDotarcieR2 && (
              <div style={{padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9"}}>
                <div style={{fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4}}>📸 Zdjęcie uszkodzeń <span style={{fontSize: 11, color: "#9ca3af", fontWeight: 400}}>(opcjonalne)</span></div>
                {towarDmgPhotos.length > 0 && (
                  <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                    {towarDmgPhotos.map((p, i) => (
                      <div key={p.id || i} style={{display: "flex", alignItems: "center", gap: 2}}>
                        <a href={p.photoUrl} target="_blank" rel="noopener noreferrer"
                          style={{display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                            background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#dc2626",
                            fontWeight: 500, textDecoration: "none"}}>
                          ⚠️ Uszkodzenie {i + 1}
                        </a>
                        {p.id && <button onClick={() => deleteDriverPhoto(p.id)}
                          style={{background: "none", border: "none", color: "#d1d5db", fontSize: 14, cursor: "pointer", padding: "4px"}}>✕</button>}
                      </div>
                    ))}
                  </div>
                )}
                <label style={{display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "10px", borderRadius: 10, border: "1px dashed #fecaca", background: "#fff",
                  color: "#9ca3af", fontSize: 13, fontWeight: 500, cursor: "pointer"}}>
                  📷 {towarDmgPhotos.length > 0 ? "Dodaj kolejne zdjęcie uszkodzenia" : "Dodaj zdjęcia uszkodzenia"}
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) { await uploadDriverPhoto("towar_damage", file); }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}
          </div>); })()}

          {/* ═══ ZAKOŃCZ TRASĘ — przycisk Rozładowano (final action kierowcy) ═══ */}
          {(() => {
            // Single-stop: dotarcie do R1 wystarczy. Multi-stop: dotarcie do R2 (ostatni stop).
            const canClose = hasR2 ? hasDotarcieR2 : hasDotarcieRoz;
            if (!canClose) return null;
            // Sprawdzenie kompletności CMR (warning gdy brak)
            const cmrComplete = hasR2 ? (hasCmrRoz && hasCmrR2) : hasCmrRoz;
            if (hasRoz) {
              // Już zakończona — pokaż status + przycisk cofnij
              return (
                <div style={{marginTop: 16, padding: 14, borderRadius: 12, background: "#f0fdf4", border: "2px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                  <div style={{fontSize: 15, fontWeight: 700, color: "#15803d"}}>✅ Trasa zakończona</div>
                  <button onClick={() => undoFrachtStatus(f, "rozladowano")}
                    style={{padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer"}}>
                    ↩️ Cofnij
                  </button>
                </div>
              );
            }
            return (
              <button onClick={async () => {
                const msg = !cmrComplete
                  ? `⚠️ Brak CMR rozładunku${hasR2 ? " (R1 lub R2)" : ""} — kontynuować zamykanie trasy mimo to?`
                  : "Zamknąć trasę i oznaczyć jako rozładowane?";
                if (!window.confirm(msg)) return;
                await updateFrachtStatus(f, "rozladowano", new Date().toISOString());
              }} style={{
                marginTop: 16, width: "100%", padding: 16, borderRadius: 12,
                fontSize: 16, fontWeight: 700, color: "#fff",
                background: cmrComplete ? "#15803d" : "#d97706",
                border: "none", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}>
                ✅ Zakończ trasę — Rozładowano
                {!cmrComplete && <div style={{fontSize: 11, fontWeight: 500, marginTop: 4, opacity: 0.9}}>⚠️ Brak CMR rozładunku</div>}
              </button>
            );
          })()}

          {/* ═══ PODSUMOWANIE TRASY (tylko po rozładunku, wariant kierowcy) ═══ */}
          {hasRoz && (
            <TripSummaryPanel
              fracht={f}
              vehicle={vehicle}
              driverEvents={driverEvents}
              fuelEntries={fuelEntries}
              variant="driver"
            />
          )}
        </div>
      </div>
    );
  }

  // ── Main view — Dashboard z kafelkami ──
  const driverName = (vehicle?.driverHistory || []).find(d => !d.to)?.name || user.displayName || user.email;

  // Najbliższy urgent serwis
  const serwisAlert = (() => {
    if (!vehicle) return null;
    const checks = [
      ["OC", vehicle.ocExpiry], ["AC", vehicle.acExpiry],
      ["Przegląd", vehicle.inspectionExpiry], ["UDT", vehicle.udtExpiry],
    ].filter(([,d]) => d).map(([l,d]) => ({ label: l, days: daysUntil(d) })).filter(a => a.days !== null && a.days <= 60);
    checks.sort((a,b) => a.days - b.days);
    return checks[0] || null;
  })();

  // Średnie spalanie (z fuelEntries FULL lub fallback na operacyjne)
  const avgSpalanie = (() => {
    const fulls = [...fuelEntries].filter(e => e.fullTank && e.mileage > 0).sort((a,b) => a.mileage - b.mileage);
    if (fulls.length >= 2) {
      const tL = fulls.slice(1).reduce((s,e) => s + (e.liters||0), 0);
      const tK = fulls[fulls.length-1].mileage - fulls[0].mileage;
      if (tK > 0) return ((tL / tK) * 100).toFixed(1);
    }
    const w = operacyjne.filter(o => o.spalanie > 0);
    return w.length > 0 ? (w.reduce((s,o) => s + o.spalanie, 0) / w.length).toFixed(1) : null;
  })();

  const renderFrachtCard = (f) => {
    const kody = formatKody(f);
    const myEvts = driverEvents.filter(ev => ev.frachtId === f.id);
    const isDone = isFrachtRozladowany(f, myEvts) || (f.dataRozladunku && f.dataRozladunku < todayStr);
    const hasZal = hasZaladunekActive(myEvts) || f._driverZaladowano;
    const hasRoz = isDone;
    return (
      <div key={f.id} onClick={() => setSelectedFracht(f)}
        style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", cursor: "pointer", marginBottom: 8 }}>
        <div style={{ background: isDone ? "#f0fdf4" : hasZal ? "#eff6ff" : "#fffbeb", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: isDone ? "#15803d" : hasZal ? "#2563eb" : "#92400e" }}>
              {isDone ? "✅ Zakończone" : hasZal ? "🚛 W trasie" : "📋 Oczekuje"}
            </span>
            {/* Round-trip badge: pokaż 🔄 gdy fracht jest częścią kółka */}
            {(() => {
              const isReturn = !!f.linkedFrachtId && frachty.some(o => o.id === f.linkedFrachtId);
              const hasReturn = frachty.some(o => o && o.linkedFrachtId === f.id);
              if (!isReturn && !hasReturn) return null;
              return (
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#f3e8ff", color: "#7e22ce", fontWeight: 700 }}>
                  🔄 {isReturn ? "powrót" : "kółko"}
                </span>
              );
            })()}
          </div>
          {f.nrRef && <span style={{ fontSize: 11, color: "#9ca3af" }}>{f.nrRef}</span>}
        </div>
        <div style={{ padding: "12px 16px" }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }}></div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{kody.zal.split(" / ")[0]}</span>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>{fmtDate(f.dataZaladunku)}{f.godzZaladunku ? ` · ${f.godzZaladunku}` : ""}</span>
          </div>
          <div style={{ width: 1, height: 10, background: "#e5e7eb", marginLeft: 3 }}></div>
          <div className="flex items-center gap-2">
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0 }}></div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{kody.roz.split(" / ")[0]}</span>
            <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: "auto" }}>{fmtDate(f.dataRozladunku)}{f.godzRozladunku ? ` · ${f.godzRozladunku}` : ""}</span>
          </div>
        </div>
        {(f.towarIloscPalet || f.wagaLadunku || f.zaladunekTyp) && (
          <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {f.towarIloscPalet && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#f3f4f6", color: "#6b7280" }}>{f.towarIloscPalet} palet</span>}
            {f.wagaLadunku && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#f3f4f6", color: "#6b7280" }}>{f.wagaLadunku} kg</span>}
            {f.zaladunekTyp && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#f3f4f6", color: "#6b7280" }}>{f.zaladunekTyp}</span>}
          </div>
        )}
      </div>
    );
  };

  // ── Ekran sub-view (nie home) ──
  if (driverTab !== "home") {
    const subTitles = { zlecenia: "Zlecenia", pojazd: "Pojazd", serwis: "Serwis", spalanie: "Tankowania", czas: "Czas pracy", dokumenty: "Dokumenty", mapa: "Mapa" };
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", paddingTop: "env(safe-area-inset-top, 0px)", zoom: driverZoom === "large" ? 1.2 : 1 }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
        <div className="max-w-lg mx-auto p-4">
          <button onClick={() => setDriverTab("home")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-3 py-2" style={{ minHeight: 44 }}>← Powrót</button>
          <div className="text-lg font-bold text-gray-900 mb-4">{subTitles[driverTab] || driverTab}</div>

          {/* ZLECENIA */}
          {driverTab === "zlecenia" && (
            <div>
              {active.length > 0 && (<><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aktywne ({active.length})</div>{active.map(f => renderFrachtCard(f))}</>)}
              {upcoming.length > 0 && (<><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Nadchodzące ({upcoming.length})</div>{upcoming.map(f => renderFrachtCard(f))}</>)}
              {history.length > 0 && (<><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Historia ({history.length})</div>{history.slice(0, 10).map(f => renderFrachtCard(f))}{history.length > 10 && <div className="text-xs text-gray-400 text-center mt-2">…i {history.length - 10} więcej</div>}</>)}
              {active.length === 0 && upcoming.length === 0 && history.length === 0 && (
                <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-3">🛣️</div><div className="font-medium">Brak zleceń</div></div>
              )}
            </div>
          )}

          {/* POJAZD */}
          {driverTab === "pojazd" && vehicle && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4"><div className="text-3xl">🚛</div><div><div className="text-lg font-bold text-gray-900">{vehicle.plate}</div>{vehicle.plate2 && <div className="text-sm text-gray-500">Przyczepa: {vehicle.plate2}</div>}</div></div>
                <div className="grid grid-cols-2 gap-3">
                  {[["Marka",vehicle.brand],["Typ",vehicle.type],["Rok",vehicle.year],["Wymiary",vehicle.dimensions],["Ładowność",vehicle.maxWeight?`${vehicle.maxWeight} kg`:null],["VIN",vehicle.vin],["Przebieg",vehicle.currentKm?`${Number(vehicle.currentKm).toLocaleString("pl-PL")} km`:null]].filter(([,v])=>v).map(([l,v])=>(
                    <div key={l} className="p-3 rounded-lg bg-gray-50 border border-gray-100"><div className="text-xs text-gray-400">{l}</div><div className="text-sm font-semibold text-gray-800">{v}</div></div>
                  ))}
                </div>
              </div>
              {((vehicle.equipment||[]).length>0||(vehicle.customEquipment||[]).length>0) && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Wyposażenie</div>
                  <div className="flex flex-wrap gap-2">{[...(vehicle.equipment||[]),...(vehicle.customEquipment||[])].map(eq=>(<span key={eq} className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{eq}</span>))}</div>
                </div>
              )}
            </div>
          )}

          {/* SERWIS */}
          {driverTab === "serwis" && vehicle && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Terminy i przeglądy</div>
                <div className="space-y-2">
                  {[["OC",vehicle.ocExpiry],["AC",vehicle.acExpiry],["Przegląd techniczny",vehicle.inspectionExpiry],["UDT ważność",vehicle.udtExpiry],["UDT przegląd",vehicle.udtNextDate],["GAP",vehicle.gapExpiry]].filter(([,d])=>d).map(([label,date])=>{
                    const days=daysUntil(date);const urgent=days!==null&&days<=30;const warn=days!==null&&days<=60;
                    return(<div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background:urgent?"#fef2f2":warn?"#fffbeb":"#f9fafb"}}><span className="text-sm text-gray-700">{label}</span><div className="text-right"><span className="text-sm font-semibold" style={{color:urgent?"#dc2626":warn?"#d97706":"#374151"}}>{fmtDateFull(date)}</span>{days!==null&&<span className="ml-2 text-xs" style={{color:urgent?"#dc2626":warn?"#d97706":"#9ca3af"}}>({days>0?`za ${days} dni`:days===0?"dziś!":`${Math.abs(days)} dni temu`})</span>}</div></div>);
                  })}
                </div>
              </div>
              {(vehicle.lastOilServiceKm||vehicle.oilServiceEveryKm)&&(
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Serwis olejowy</div>
                  <div className="grid grid-cols-2 gap-3">
                    {vehicle.lastOilServiceKm&&<div className="p-3 rounded-lg bg-gray-50 border border-gray-100"><div className="text-xs text-gray-400">Ostatni serwis</div><div className="text-sm font-semibold text-gray-800">{Number(vehicle.lastOilServiceKm).toLocaleString("pl-PL")} km</div></div>}
                    {vehicle.oilServiceEveryKm&&<div className="p-3 rounded-lg bg-gray-50 border border-gray-100"><div className="text-xs text-gray-400">Następny co</div><div className="text-sm font-semibold text-gray-800">{Number(vehicle.oilServiceEveryKm).toLocaleString("pl-PL")} km</div></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPALANIE / TANKOWANIA */}
          {driverTab === "spalanie" && vehicle && (() => {
            const FUEL_COUNTRIES = ["PL","DE","NL","BE","FR","CZ","AT","IT","ES","LU","DK","SE","HU","SK","LT","LV","RO","BG","HR","SI"];
            const countryFlag = (c) => ({PL:"\u{1F1F5}\u{1F1F1}",DE:"\u{1F1E9}\u{1F1EA}",NL:"\u{1F1F3}\u{1F1F1}",BE:"\u{1F1E7}\u{1F1EA}",FR:"\u{1F1EB}\u{1F1F7}",CZ:"\u{1F1E8}\u{1F1FF}",AT:"\u{1F1E6}\u{1F1F9}",IT:"\u{1F1EE}\u{1F1F9}",ES:"\u{1F1EA}\u{1F1F8}",LU:"\u{1F1F1}\u{1F1FA}",DK:"\u{1F1E9}\u{1F1F0}",SE:"\u{1F1F8}\u{1F1EA}",HU:"\u{1F1ED}\u{1F1FA}",SK:"\u{1F1F8}\u{1F1F0}",LT:"\u{1F1F1}\u{1F1F9}",LV:"\u{1F1F1}\u{1F1FB}",RO:"\u{1F1F7}\u{1F1F4}",BG:"\u{1F1E7}\u{1F1EC}",HR:"\u{1F1ED}\u{1F1F7}",SI:"\u{1F1F8}\u{1F1EE}"})[c]||c;
            const sorted = [...fuelEntries].sort((a,b) => (b.date||"").localeCompare(a.date||"") || (b.mileage||0)-(a.mileage||0));
            const totalL = fuelEntries.reduce((s,e) => s + (e.liters||0), 0);
            const byMileage = [...fuelEntries].filter(e => e.mileage > 0).sort((a,b) => b.mileage - a.mileage);
            const totalKm = byMileage.length >= 2 ? byMileage[0].mileage - byMileage[byMileage.length-1].mileage : 0;
            // Spalanie z tankowań FULL
            const fulls = [...fuelEntries].filter(e => e.fullTank && e.mileage > 0).sort((a,b) => a.mileage - b.mileage);
            const avgFuel = (() => {
              if (fulls.length < 2) return null;
              const tL = fulls.slice(1).reduce((s,e) => s + (e.liters||0), 0);
              const tK = fulls[fulls.length-1].mileage - fulls[0].mileage;
              return tK > 0 ? ((tL / tK) * 100).toFixed(1) : null;
            })();
            // Submit fuel entry
            const submitFuel = async () => {
              if (!fuelForm.liters || !fuelForm.mileage) { showToast("Podaj litry i przebieg"); return; }
              try {
                const now = new Date();
                const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                await addDoc(collection(db, "fuelEntries"), {
                  vehicleId: vehicle.id,
                  driverEmail: user.email,
                  date: fuelForm.date,
                  liters: parseFloat(fuelForm.liters),
                  mileage: parseInt(fuelForm.mileage),
                  station: fuelForm.station || "",
                  cardNr: fuelForm.cardNr || "",
                  pricePerL: fuelForm.pricePerL ? parseFloat(fuelForm.pricePerL) : null,
                  country: fuelForm.country || "PL",
                  currency: fuelForm.currency || "EUR",
                  fullTank: !!fuelForm.fullTank,
                  isAdblue: !!fuelForm.isAdblue,
                  adblueL: fuelForm.adblueL ? parseFloat(fuelForm.adblueL) : 0,
                  createdAt: ts,
                });
                showToast("Tankowanie zapisane");
                setFuelForm(f => ({ ...f, liters: "", mileage: "", station: "", pricePerL: "", adblueL: "", isAdblue: false, currency: f.country === "PL" ? "PLN" : "EUR" }));
                setFuelView("list");
              } catch (err) {
                console.error("fuelEntry save error", err);
                showToast("Błąd zapisu: " + err.message);
              }
            };
            // Delete fuel entry
            const deleteFuel = async (id) => {
              if (!window.confirm("Usunąć to tankowanie?")) return;
              try {
                await deleteDoc(doc(db, "fuelEntries", id));
                showToast("Usunięto");
              } catch (err) { showToast("Błąd: " + err.message); }
            };
            // Format date DD.MM.YYYY
            const fmtD = (d) => { if (!d) return "—"; const [y,m,day] = d.split("-"); return `${day}.${m}.${y}`; };

            return (
              <div>
                {/* SUMMARY CARDS */}
                {(() => {
                  const totalAdblue = fuelEntries.reduce((s,e) => s + (e.adblueL||0), 0);
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderTop: "3px solid #059669" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>{totalL > 0 ? totalL.toLocaleString("pl-PL") : "—"}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>Diesel L</div>
                      </div>
                      <div style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderTop: "3px solid #2563eb" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#2563eb" }}>{totalAdblue > 0 ? totalAdblue.toLocaleString("pl-PL") : "—"}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>AdBlue L</div>
                      </div>
                      <div style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderTop: "3px solid #7c3aed" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#7c3aed" }}>{totalKm > 0 ? totalKm.toLocaleString("pl-PL") : "—"}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>km</div>
                      </div>
                    </div>
                  );
                })()}

                {/* TAB BAR: Lista / Statystyki */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[["list","Lista"],["stats","Statystyki"]].map(([k,l]) => (
                    <button key={k} onClick={() => setFuelView(k)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                      background: fuelView === k ? "#2563eb" : "#f1f5f9", color: fuelView === k ? "#fff" : "#64748b",
                    }}>{l}</button>
                  ))}
                </div>

                {/* ── LIST VIEW ── */}
                {fuelView === "list" && (
                  <div>
                    {sorted.length === 0 && (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>⛽</div>
                        <div style={{ fontSize: 14 }}>Brak tankowań</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Dodaj pierwsze tankowanie</div>
                      </div>
                    )}
                    {sorted.map(e => (
                      <div key={e.id} style={{
                        background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <div style={{ textAlign: "center", minWidth: 42 }}>
                          <div style={{ fontSize: 20 }}>{countryFlag(e.country)}</div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{fmtD(e.date)}</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>
                            {(e.liters||0).toLocaleString("pl-PL")} L
                            {e.fullTank && <span style={{ fontSize: 9, background: "#dbeafe", color: "#1d4ed8", padding: "1px 5px", borderRadius: 6, marginLeft: 5, verticalAlign: "middle" }}>FULL</span>}
                            {e.isAdblue && <span style={{ fontSize: 9, background: "#e0f2fe", color: "#0369a1", padding: "1px 5px", borderRadius: 6, marginLeft: 5, verticalAlign: "middle" }}>AdBlue</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {e.station || "—"}
                            {e.adblueL > 0 && !e.isAdblue && <span style={{ color: "#0284c7", marginLeft: 6 }}>+{e.adblueL}L AdBlue</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{e.mileage ? e.mileage.toLocaleString("pl-PL")+" km" : ""}</div>
                          {e.pricePerL > 0 && <div style={{ fontSize: 10, color: "#94a3b8" }}>{e.pricePerL.toFixed(e.currency === "EUR" ? 3 : 2)} {e.currency || (e.country === "PL" ? "PLN" : "EUR")}/L</div>}
                        </div>
                        <button onClick={() => deleteFuel(e.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#d1d5db", padding: 4 }} title="Usuń">✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── STATS VIEW ── */}
                {fuelView === "stats" && (() => {
                  // Grupuj fuelEntries wg miesiąca YYYY-MM
                  const byMonth = {};
                  fuelEntries.forEach(e => {
                    const ym = (e.date || "").slice(0, 7);
                    if (!ym) return;
                    if (!byMonth[ym]) byMonth[ym] = { diesel: 0, adblue: 0, minKm: Infinity, maxKm: 0, count: 0 };
                    const m = byMonth[ym];
                    if (!e.isAdblue) m.diesel += (e.liters || 0);
                    if (e.isAdblue) m.adblue += (e.liters || 0);
                    m.adblue += (e.adblueL || 0); // adblue dolane przy dieslu
                    if (e.mileage > 0) { m.minKm = Math.min(m.minKm, e.mileage); m.maxKm = Math.max(m.maxKm, e.mileage); }
                    m.count++;
                  });
                  const months = Object.entries(byMonth).sort((a,b) => b[0].localeCompare(a[0]));

                  return (
                    <div>
                      {months.length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                          <div style={{ fontSize: 13 }}>Dodaj tankowania aby zobaczyć statystyki</div>
                        </div>
                      )}
                      {months.map(([ym, m]) => {
                        const [y, mo] = ym.split("-");
                        const label = new Date(+y, +mo - 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
                        const km = m.maxKm > m.minKm ? m.maxKm - m.minKm : 0;
                        return (
                          <div key={ym} style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 10, textTransform: "capitalize" }}>{label}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                              <div style={{ padding: "10px 6px", borderRadius: 10, background: "#f0fdf4", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>{m.diesel > 0 ? m.diesel.toLocaleString("pl-PL") : "—"}</div>
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Diesel L</div>
                              </div>
                              <div style={{ padding: "10px 6px", borderRadius: 10, background: "#e0f2fe", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#0284c7" }}>{m.adblue > 0 ? m.adblue.toLocaleString("pl-PL") : "—"}</div>
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>AdBlue L</div>
                              </div>
                              <div style={{ padding: "10px 6px", borderRadius: 10, background: "#f5f3ff", textAlign: "center" }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{km > 0 ? km.toLocaleString("pl-PL") : "—"}</div>
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>km</div>
                              </div>
                            </div>
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>{m.count} tankowań{km > 0 ? ` · ${m.minKm.toLocaleString("pl-PL")} → ${m.maxKm.toLocaleString("pl-PL")} km` : ""}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── FORM VIEW ── */}
                {fuelView === "form" && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>Nowe tankowanie</div>
                    {/* Date */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Data tankowania *</label>
                      <input type="date" value={fuelForm.date} onChange={e => setFuelForm(f => ({...f, date: e.target.value}))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                    </div>
                    {/* Liters + Mileage */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Litry *</label>
                        <input type="number" placeholder="np. 400" value={fuelForm.liters} onChange={e => setFuelForm(f => ({...f, liters: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Przebieg km *</label>
                        <input type="number" placeholder="np. 845230" value={fuelForm.mileage} onChange={e => setFuelForm(f => ({...f, mileage: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                      </div>
                    </div>
                    {/* Station */}
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Stacja paliw</label>
                      <input type="text" placeholder="np. Shell Wrocław A4" value={fuelForm.station} onChange={e => setFuelForm(f => ({...f, station: e.target.value}))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                    </div>
                    {/* Card + Price */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Nr karty</label>
                        <input type="text" placeholder="EW-4821" value={fuelForm.cardNr} onChange={e => setFuelForm(f => ({...f, cardNr: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Cena/L</label>
                        <input type="number" step="0.01" placeholder="np. 5.89" value={fuelForm.pricePerL} onChange={e => setFuelForm(f => ({...f, pricePerL: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                      </div>
                    </div>
                    {/* Country + Currency */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Kraj</label>
                        <select value={fuelForm.country} onChange={e => { const c = e.target.value; setFuelForm(f => ({...f, country: c, currency: c === "PL" ? "PLN" : "EUR"})); }}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}>
                          {FUEL_COUNTRIES.map(c => <option key={c} value={c}>{countryFlag(c)} {c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Waluta</label>
                        <select value={fuelForm.currency} onChange={e => setFuelForm(f => ({...f, currency: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}>
                          {["EUR","PLN","CZK","HUF","SEK","DKK","RON","BGN","HRK","GBP"].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* AdBlue toggle + liters */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", marginBottom: 6 }}>
                      <div onClick={() => setFuelForm(f => ({...f, isAdblue: !f.isAdblue}))}
                        style={{ width: 48, height: 26, borderRadius: 13, cursor: "pointer", background: fuelForm.isAdblue ? "#0284c7" : "#cbd5e1", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 2, left: fuelForm.isAdblue ? 24 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}/>
                      </div>
                      <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>To jest AdBlue (nie diesel)</span>
                    </div>
                    {!fuelForm.isAdblue && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "#0284c7", display: "block", marginBottom: 3 }}>AdBlue litry (opcjonalnie)</label>
                        <input type="number" placeholder="np. 50" value={fuelForm.adblueL} onChange={e => setFuelForm(f => ({...f, adblueL: e.target.value}))}
                          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #bae6fd", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f0f9ff", boxSizing: "border-box" }}/>
                      </div>
                    )}
                    {/* Full tank toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", marginBottom: 10 }}>
                      <div onClick={() => setFuelForm(f => ({...f, fullTank: !f.fullTank}))}
                        style={{ width: 48, height: 26, borderRadius: 13, cursor: "pointer", background: fuelForm.fullTank ? "#2563eb" : "#cbd5e1", position: "relative", transition: "background 0.2s" }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", position: "absolute", top: 2, left: fuelForm.fullTank ? 24 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}/>
                      </div>
                      <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>Do pełna (FULL)</span>
                    </div>
                    {/* Submit */}
                    <button onClick={submitFuel} style={{
                      width: "100%", padding: "13px", background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                      color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer"
                    }}>Zapisz tankowanie</button>
                    <button onClick={() => setFuelView("list")} style={{
                      width: "100%", padding: "10px", marginTop: 8, background: "transparent",
                      color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer"
                    }}>Anuluj</button>
                  </div>
                )}

                {/* FAB — Dodaj tankowanie (tylko na liście) */}
                {fuelView === "list" && (
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <button onClick={() => setFuelView("form")} style={{
                      background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", border: "none", borderRadius: 14,
                      padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,99,235,0.3)"
                    }}>+ Dodaj tankowanie</button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* CZAS PRACY */}
          {driverTab === "czas" && (() => {
            const STATUSY = [
              { id: "jazda",    label: "Jazda",       color: "#15803d", bg: "#f0fdf4" },
              { id: "pauza9",   label: "Pauza 9h",    color: "#b45309", bg: "#fffbeb" },
              { id: "pauza11",  label: "Pauza 11h",   color: "#c2410c", bg: "#fff7ed" },
              { id: "pauza24",  label: "Pauza 24h",   color: "#dc2626", bg: "#fef2f2" },
              { id: "pauza45",  label: "Pauza 45h",   color: "#9333ea", bg: "#faf5ff" },
              { id: "pauzaInne",label: "Pauza inne",  color: "#0369a1", bg: "#f0f9ff" },
              { id: "baza",     label: "Baza",        color: "#6b7280", bg: "#f3f4f6" },
            ];
            const stInfo = (id) => STATUSY.find(s => s.id === id) || { label: id, color: "#6b7280", bg: "#f3f4f6" };

            // Bieżący miesiąc
            const now = new Date();
            const curY = now.getFullYear();
            const curM = now.getMonth(); // 0-based
            const fmtYM = (y,m) => `${y}-${String(m+1).padStart(2,"0")}`;
            const curYM = fmtYM(curY, curM);
            const monthLabel = new Date(curY, curM).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

            // Rozwiń wpisy na poszczególne dni
            const dayMap = {}; // "YYYY-MM-DD" → entry
            pauzy.forEach(e => {
              if (!e.start || !e.end) return;
              const s = new Date(e.start + "T00:00:00");
              const en = new Date(e.end + "T00:00:00");
              for (let d = new Date(s); d <= en; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().slice(0,10);
                dayMap[ds] = e;
              }
            });

            // Auto-fill: dni od tachoStart do dziś bez wpisu w pauzy → Jazda
            const todayISO = now.toISOString().slice(0,10);
            if (vehicle && vehicle.tachoStart) {
              const tStart = new Date(vehicle.tachoStart + "T00:00:00");
              const tEnd = new Date(todayISO + "T00:00:00");
              for (let d = new Date(tStart); d <= tEnd; d.setDate(d.getDate() + 1)) {
                const ds = d.toISOString().slice(0,10);
                if (!dayMap[ds]) {
                  dayMap[ds] = { status: "jazda", start: ds, end: ds, _auto: true };
                }
              }
            }

            // Policz dni w bieżącym miesiącu wg statusu
            const daysInMonth = new Date(curY, curM + 1, 0).getDate();
            const statusCounts = {};
            let totalDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
              const ds = fmtYM(curY, curM) + "-" + String(d).padStart(2,"0");
              const entry = dayMap[ds];
              if (entry) {
                const st = entry.status || "jazda";
                statusCounts[st] = (statusCounts[st] || 0) + 1;
                totalDays++;
              }
            }

            // Znajdź aktualny status (dziś)
            const todayEntry = dayMap[todayISO];
            const todaySt = todayEntry ? stInfo(todayEntry.status) : null;

            // Lista wpisów w tym miesiącu (oryginalne wpisy, nie rozwinięte)
            const monthEntries = pauzy
              .filter(p => p.start && p.start.startsWith(curYM) || p.end && p.end.startsWith(curYM))
              .sort((a,b) => (b.start||"").localeCompare(a.start||""));

            // Mini kalendarz
            const firstDow = (new Date(curY, curM, 1).getDay() + 6) % 7;

            // Tacho — 28-dniowy cykl
            const tachoData = (() => {
              if (!vehicle || !vehicle.tachoStart) return null;
              const [ty,tm,td] = vehicle.tachoStart.split("-").map(Number);
              const tachoStart = new Date(ty, tm-1, td);
              const todayD = new Date(); todayD.setHours(0,0,0,0);
              const daysSince = Math.round((todayD - tachoStart) / 86400000);
              const daysLeft = 28 - daysSince;
              const stopDate = new Date(tachoStart); stopDate.setDate(stopDate.getDate() + 28);
              const stopStr = stopDate.toLocaleDateString("pl-PL", {day:"2-digit", month:"2-digit"});
              const isRed = daysLeft < 5;
              const isYellow = daysLeft >= 5 && daysLeft < 10;
              return { daysSince, daysLeft, stopStr, isRed, isYellow,
                bg: isRed ? "#fef2f2" : isYellow ? "#fffbeb" : "#f0fdf4",
                color: isRed ? "#b91c1c" : isYellow ? "#92400e" : "#15803d",
                icon: isRed ? "🔴" : isYellow ? "🟡" : "🟢",
              };
            })();

            return (
              <div>
                {/* ── Nowy inteligentny dashboard czasu pracy (na bazie driverActivities) ── */}
                <DriverCzasPracyDashboard
                  user={user}
                  vehicle={vehicle}
                  driverActivities={driverActivities}
                  showToast={showToast}
                />

                {/* ── Stare: kalendarz pauz ręcznych + tacho ── */}
                {/* Tacho */}
                {tachoData && (
                  <div style={{
                    background: tachoData.bg, borderRadius: 14, padding: "14px 16px", marginBottom: 12,
                    border: `1.5px solid ${tachoData.color}22`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{tachoData.icon}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: tachoData.color }}>
                            {tachoData.daysLeft > 0 ? `Tacho: ${tachoData.daysLeft} dni` : tachoData.daysLeft === 0 ? "Tacho: dziś powrót!" : `Tacho: przekroczone o ${Math.abs(tachoData.daysLeft)} dni!`}
                          </div>
                          <div style={{ fontSize: 11, color: tachoData.color, opacity: 0.7 }}>do {tachoData.stopStr}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: tachoData.color }}>{tachoData.daysSince}/28</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 8, background: "#fff", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min((tachoData.daysSince / 28) * 100, 100)}%`, height: "100%", borderRadius: 6, background: tachoData.color, transition: "width 0.3s" }}/>
                    </div>
                  </div>
                )}

                {/* Aktualny status */}
                <div style={{
                  background: todaySt ? todaySt.bg : "#f9fafb",
                  borderRadius: 14, padding: "14px 16px", marginBottom: 12,
                  border: `2px solid ${todaySt ? todaySt.color : "#e5e7eb"}`,
                }}>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>Dzisiaj</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: todaySt ? todaySt.color : "#9ca3af" }}>
                    {todaySt ? todaySt.label : "Brak statusu"}
                  </div>
                  {todayEntry && todayEntry.note && (
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{todayEntry.note}</div>
                  )}
                  {todayEntry && todayEntry.startTime && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Start: {todayEntry.startTime}{todayEntry.hours > 0 ? ` · ${todayEntry.hours}h` : ""}</div>
                  )}
                </div>

                {/* Statystyki miesiąca */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10, textTransform: "capitalize" }}>{monthLabel}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).map(([st, cnt]) => {
                      const info = stInfo(st);
                      return (
                        <div key={st} style={{
                          padding: "8px 10px", borderRadius: 10, background: info.bg,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: info.color }}>{info.label}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: info.color }}>{cnt}d</span>
                        </div>
                      );
                    })}
                  </div>
                  {totalDays > 0 && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, textAlign: "right" }}>
                      Razem: {totalDays} dni z {daysInMonth}
                    </div>
                  )}
                  {totalDays === 0 && (
                    <div style={{ textAlign: "center", padding: "12px 0", color: "#9ca3af", fontSize: 12 }}>Brak wpisów w tym miesiącu</div>
                  )}
                </div>

                {/* Mini kalendarz */}
                <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
                    {["Pn","Wt","Śr","Cz","Pt","Sb","Nd"].map(d => (
                      <div key={d} style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, paddingBottom: 4 }}>{d}</div>
                    ))}
                    {Array.from({length: firstDow}).map((_,i) => <div key={`e${i}`}/>)}
                    {Array.from({length: daysInMonth}).map((_,i) => {
                      const d = i + 1;
                      const ds = fmtYM(curY, curM) + "-" + String(d).padStart(2,"0");
                      const entry = dayMap[ds];
                      const info = entry ? stInfo(entry.status) : null;
                      const isToday = ds === todayISO;
                      return (
                        <div key={d} style={{
                          width: "100%", aspectRatio: "1", borderRadius: 8, display: "flex",
                          alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: isToday ? 800 : 500,
                          background: info ? info.bg : "transparent",
                          color: info ? info.color : "#cbd5e1",
                          border: isToday ? "2px solid #1e293b" : "none",
                        }}>{d}</div>
                      );
                    })}
                  </div>
                  {/* Legenda */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {STATUSY.filter(s => statusCounts[s.id]).map(s => (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }}/>
                        <span style={{ fontSize: 9, color: "#64748b" }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lista wpisów */}
                {monthEntries.length > 0 && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>Wpisy</div>
                    {monthEntries.map((p,i) => {
                      const info = stInfo(p.status);
                      const fmtD = (d) => { if (!d) return ""; const [y,m,day] = d.split("-"); return `${day}.${m}`; };
                      const range = p.start === p.end ? fmtD(p.start) : `${fmtD(p.start)} – ${fmtD(p.end)}`;
                      return (
                        <div key={p.id||i} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                          borderBottom: i < monthEntries.length - 1 ? "1px solid #f1f5f9" : "none",
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: info.color, flexShrink: 0 }}/>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: info.color }}>{info.label}</span>
                            {p.note && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>{p.note}</span>}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{range}</div>
                            {p.startTime && <div style={{ fontSize: 10, color: "#94a3b8" }}>{p.startTime}{p.hours > 0 ? ` · ${p.hours}h` : ""}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* DOKUMENTY */}
          {driverTab === "dokumenty" && (() => {
            const DOC_TYPES = [
              { id: "paragon", label: "Paragon", icon: "🧾" },
              { id: "faktura", label: "Faktura", icon: "📄" },
              { id: "mandat", label: "Mandat", icon: "⚠️" },
              { id: "serwis", label: "Serwis / Naprawa", icon: "🔧" },
              { id: "opony", label: "Opony", icon: "🔄" },
              { id: "mycie", label: "Mycie", icon: "🚿" },
              { id: "parking", label: "Parking", icon: "🅿️" },
              { id: "autostrada", label: "Autostrada / Myto", icon: "🛣️" },
              { id: "hotel", label: "Hotel / Nocleg", icon: "🏨" },
              { id: "inne", label: "Inne", icon: "📋" },
            ];
            const typeInfo = (id) => DOC_TYPES.find(t => t.id === id) || { label: id, icon: "📋" };
            const sorted = [...driverDocs].sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
            const fmtD = (d) => { if (!d) return "—"; const parts = d.split(/[-T ]/); return parts.length >= 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d; };

            const submitDoc = async () => {
              if (!docForm.description.trim()) { showToast("Podaj opis dokumentu"); return; }
              setDocUploading(true);
              try {
                let photoUrl = null;
                if (docForm.photoFile) {
                  const path = `driverDocs/${user.email}/${docForm.type}_${Date.now()}_${docForm.photoFile.name}`;
                  const sRef = storageRef(storage, path);
                  await uploadBytes(sRef, docForm.photoFile);
                  photoUrl = await getDownloadURL(sRef);
                }
                const now = new Date();
                const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
                await addDoc(collection(db, "driverDocs"), {
                  driverEmail: user.email,
                  driverName: user.displayName || user.email,
                  vehicleId: vehicle?.id || null,
                  type: docForm.type,
                  description: docForm.description.trim(),
                  photoUrl: photoUrl,
                  createdAt: ts,
                });
                showToast("Dokument zapisany");
                setDocForm({ description: "", type: "paragon", photoFile: null, photoPreview: null });
                setDocView("list");
              } catch (err) {
                console.error("driverDoc save error", err);
                showToast("Błąd: " + err.message);
              } finally { setDocUploading(false); }
            };

            const deleteDocEntry = async (d) => {
              if (!window.confirm("Usunąć ten dokument?")) return;
              try {
                await deleteDoc(doc(db, "driverDocs", d.id));
                showToast("Usunięto");
              } catch (err) { showToast("Błąd: " + err.message); }
            };

            return (
              <div>
                {/* LIST VIEW */}
                {docView === "list" && (
                  <div>
                    {sorted.length === 0 && (
                      <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                        <div style={{ fontSize: 14 }}>Brak dokumentów</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Dodaj paragon, fakturę lub inny dokument</div>
                      </div>
                    )}
                    {sorted.map(d => {
                      const ti = typeInfo(d.type);
                      return (
                        <div key={d.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ fontSize: 24, minWidth: 32, textAlign: "center" }}>{ti.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{d.description}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                                <span style={{ background: "#f1f5f9", padding: "1px 6px", borderRadius: 6, fontSize: 10, fontWeight: 600, color: "#475569" }}>{ti.label}</span>
                                <span style={{ marginLeft: 8 }}>{fmtD(d.createdAt)}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {d.photoUrl && (
                                <a href={d.photoUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 18, textDecoration: "none" }} title="Zobacz zdjęcie">📷</a>
                              )}
                              <button onClick={() => deleteDocEntry(d)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#d1d5db", padding: 4 }} title="Usuń">✕</button>
                            </div>
                          </div>
                          {d.photoUrl && (
                            <div style={{ marginTop: 8 }}>
                              <img src={d.photoUrl} alt="Zdjęcie dokumentu" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }}/>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Dodaj dokument button */}
                    <div style={{ textAlign: "center", marginTop: 16 }}>
                      <button onClick={() => setDocView("form")} style={{
                        background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff", border: "none", borderRadius: 14,
                        padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,0.3)"
                      }}>+ Dodaj dokument</button>
                    </div>
                  </div>
                )}

                {/* FORM VIEW */}
                {docView === "form" && (
                  <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 14 }}>Nowy dokument</div>

                    {/* Type selector — chip grid */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Typ dokumentu</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {DOC_TYPES.map(t => (
                          <button key={t.id} onClick={() => setDocForm(f => ({...f, type: t.id}))}
                            style={{
                              padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: docForm.type === t.id ? "2px solid #7c3aed" : "1.5px solid #e2e8f0",
                              background: docForm.type === t.id ? "#f5f3ff" : "#fff",
                              color: docForm.type === t.id ? "#7c3aed" : "#475569",
                            }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Opis *</label>
                      <input type="text" placeholder="np. Faktura za wymianę opon, Mandat DE..." value={docForm.description}
                        onChange={e => setDocForm(f => ({...f, description: e.target.value}))}
                        style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 15, color: "#1e293b", background: "#f8fafc", boxSizing: "border-box" }}/>
                    </div>

                    {/* Photo */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Zdjęcie (opcjonalnie)</label>
                      {docForm.photoPreview ? (
                        <div style={{ position: "relative" }}>
                          <img src={docForm.photoPreview} alt="Podgląd" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, border: "1px solid #e2e8f0" }}/>
                          <button onClick={() => setDocForm(f => ({...f, photoFile: null, photoPreview: null}))}
                            style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: 14, cursor: "pointer" }}>✕</button>
                        </div>
                      ) : (
                        <label style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          padding: "20px", border: "2px dashed #d1d5db", borderRadius: 12, cursor: "pointer",
                          background: "#fafafa", color: "#64748b", fontSize: 13, fontWeight: 500,
                        }}>
                          <span style={{ fontSize: 24 }}>📷</span> Zrób zdjęcie lub wybierz z galerii
                          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setDocForm(f => ({...f, photoFile: file, photoPreview: URL.createObjectURL(file)}));
                              }
                              e.target.value = "";
                            }}/>
                        </label>
                      )}
                    </div>

                    {/* Submit */}
                    <button onClick={submitDoc} disabled={docUploading} style={{
                      width: "100%", padding: "13px",
                      background: docUploading ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #8b5cf6)",
                      color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: docUploading ? "wait" : "pointer",
                    }}>{docUploading ? "Wysyłanie..." : "Zapisz dokument"}</button>
                    <button onClick={() => { setDocView("list"); setDocForm({ description: "", type: "paragon", photoFile: null, photoPreview: null }); }} style={{
                      width: "100%", padding: "10px", marginTop: 8, background: "transparent",
                      color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>Anuluj</button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* MAPA — placeholder */}
          {driverTab === "mapa" && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🗺️</div>
              <div className="font-medium">Wkrótce — integracja GPS</div>
            </div>
          )}

          {!vehicle && driverTab !== "zlecenia" && (
            <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-3">🚛</div><div className="font-medium">Brak przypisanego pojazdu</div></div>
          )}
        </div>
      </div>
    );
  }

  // ── HOME — Dashboard z kafelkami ──
  const firstActive = active[0] || upcoming[0];
  const firstKody = firstActive ? formatKody(firstActive) : null;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#f8f9fb", minHeight: "100vh", zoom: driverZoom === "large" ? 1.2 : 1 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>

      {/* HEADER */}
      <div style={{background: "linear-gradient(135deg, #1e293b, #334155)", paddingTop: "max(env(safe-area-inset-top, 0px), 12px)"}} className="px-4 pb-5 pt-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white text-lg font-bold">FleetStat</div>
              <div className="text-gray-300 text-sm">{driverName}</div>
            </div>
            <div className="text-right">
              {vehicle ? (
                <div className="text-white text-sm font-medium">{vehicle.plate}{vehicle.plate2 ? ` + ${vehicle.plate2}` : ""}</div>
              ) : (
                <div className="text-yellow-300 text-sm">Brak pojazdu</div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => {
                  const next = driverZoom === "normal" ? "large" : "normal";
                  setDriverZoom(next);
                  try { localStorage.setItem("fleetstat_driver_zoom", next); } catch {}
                }}
                  className="text-xs text-gray-400 hover:text-gray-200"
                  style={{padding: "2px 6px", borderRadius: 6, background: driverZoom === "large" ? "rgba(255,255,255,0.15)" : "transparent"}}>
                  {driverZoom === "large" ? "🔍 Aa−" : "🔍 Aa+"}
                </button>
                <button onClick={() => { logAction("logout", "auth", { reason: "manual" }); signOut(auth); }}
                  className="text-xs text-gray-400 hover:text-gray-200">Wyloguj</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {!vehicle && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 text-center">
            <div className="text-2xl mb-2">🚛</div>
            <div className="text-sm font-semibold text-yellow-800">Brak przypisanego pojazdu</div>
            <div className="text-xs text-yellow-600 mt-1">Skontaktuj się z dyspozytorem</div>
          </div>
        )}

        {/* ═══ KAFELEK: ZLECENIA (full width, duży) ═══ */}
        <div onClick={() => setDriverTab("zlecenia")}
          style={{ background: "#fff", borderRadius: 20, border: "1px solid #e5e7eb", overflow: "hidden", cursor: "pointer", marginBottom: 12 }}>
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #3b82f6, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📋</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Zlecenia</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {active.length > 0 ? `${active.length} aktywne` : ""}
                  {active.length > 0 && upcoming.length > 0 ? " · " : ""}
                  {upcoming.length > 0 ? `${upcoming.length} nadchodzące` : ""}
                  {active.length === 0 && upcoming.length === 0 ? "Brak zleceń" : ""}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 20, color: "#d1d5db" }}>›</div>
          </div>
          {/* Mini preview aktywnego zlecenia */}
          {firstActive && firstKody && (
            <div style={{ padding: "0 20px 16px" }}>
              <div style={{ padding: "10px 14px", borderRadius: 12,
                background: active.length > 0 ? "#f0fdf4" : "#eff6ff",
                border: `1px solid ${active.length > 0 ? "#bbf7d0" : "#bfdbfe"}` }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: active.length > 0 ? "#15803d" : "#2563eb" }}>
                    {active.length > 0 ? "🚛 W trasie" : "📋 Nadchodzące"}
                  </span>
                  {firstActive.nrRef && <span style={{ fontSize: 11, color: "#9ca3af" }}>{firstActive.nrRef}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }}></div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{firstKody.zal.split(" / ")[0]}</span>
                  <span style={{ color: "#d1d5db", fontSize: 12 }}>→</span>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }}></div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{firstKody.roz.split(" / ")[0]}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>{fmtDate(firstActive.dataRozladunku)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ SIATKA KAFELKÓW (2 kolumny) ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { id: "serwis", icon: "🔧", label: "Serwis", gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
              sub: serwisAlert ? `${serwisAlert.label} za ${serwisAlert.days}d` : "Terminy OK",
              subStyle: serwisAlert && serwisAlert.days <= 30 ? { background: "#fef2f2", color: "#dc2626" } : null },
            { id: "dokumenty", icon: "📄", label: "Dokumenty", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", sub: driverDocs.length > 0 ? `${driverDocs.length} dokumentów` : "Paragony, faktury" },
            { id: "spalanie", icon: "⛽", label: "Tankowania", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
              sub: fuelEntries.length > 0 ? `${fuelEntries.length} tankowań` : "Dodaj tankowanie" },
            { id: "czas", icon: "⏱", label: "Czas pracy", gradient: "linear-gradient(135deg, #10b981, #059669)",
              sub: (() => {
                const todayISO = new Date().toISOString().slice(0,10);
                const todayP = pauzy.find(p => p.start && p.end && p.start <= todayISO && p.end >= todayISO);
                if (todayP) { const labels = {jazda:"Jazda",pauza9:"Pauza 9h",pauza11:"Pauza 11h",pauza24:"Pauza 24h",pauza45:"Pauza 45h",baza:"Baza"}; return labels[todayP.status] || todayP.status; }
                if (active.length > 0) return "Jazda";
                return "Pauzy, jazda";
              })() },
            { id: "mapa", icon: "🗺️", label: "Mapa", gradient: "linear-gradient(135deg, #ec4899, #db2777)", sub: "Wkrótce" },
            { id: "pojazd", icon: "🚛", label: "Pojazd", gradient: "linear-gradient(135deg, #64748b, #475569)", sub: vehicle ? vehicle.brand || vehicle.type : "—" },
          ].map(t => (
            <div key={t.id} onClick={() => setDriverTab(t.id)}
              style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: t.gradient,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{t.label}</div>
              <div style={{ fontSize: 11, fontWeight: t.subStyle ? 600 : 400, padding: "2px 8px", borderRadius: 8,
                background: t.subStyle?.background || "transparent", color: t.subStyle?.color || "#9ca3af" }}>{t.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

