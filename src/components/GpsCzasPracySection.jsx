// GpsCzasPracySection — admin sub-zakładka „Czas pracy" w GPS/Monitoring tab.
// Pokazuje compliance kierowcy live (segmenty z driverActivities, plan do przodu,
// timeline 7-dniowy, alerty 561/2006 + Pakiet Mobilności), z ręcznym ustawianiem
// stanów dla admina (drive/work/avail/rest, source: "manual").
//
// Wydzielone z monolitu App.jsx 2026-04-29 (TODO #5c krok 4). Lazy-loadowane —
// admin pobiera ten chunk dopiero gdy otworzy zakładkę „Czas pracy" w GPS, nie
// przy każdym wejściu na fleetstat.pl.

import { useState, useEffect, useRef, useMemo } from "react";
import { addDoc, collection, updateDoc, doc } from "firebase/firestore";

import { db } from "../firebase";
import {
  REGULATION, ACTIVITY_TYPES,
  fmtHM, fmtTimeShort,
  computeDriverCompliance, computeDriverPlan,
} from "../utils/czasPracy";

export default function GpsCzasPracySection({ device, position, driverActivities = [], showToast }) {
  const [, forceTick] = useState(0);
  const [showWeek, setShowWeek] = useState(false); // rozwiniety timeline 7-dniowy
  // Manualne wpisywanie segmentu (uzupełnianie luk / przed startem systemu)
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [mfStart, setMfStart] = useState("");
  const [mfEnd, setMfEnd] = useState("");
  const [mfType, setMfType] = useState("drive");
  const [mfSaving, setMfSaving] = useState(false);
  // Tick co 30s żeby liczniki live się odświeżały
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const vehicle = device?.fleetVehicle;
  const activeDriver = (vehicle?.driverHistory || []).find(d => !d.to);
  const driverEmail = activeDriver?.email;
  const driverName = activeDriver?.name || driverEmail || "—";

  const submitManualSegment = async () => {
    if (!mfStart || !mfEnd) { showToast?.("Wypełnij start i koniec"); return; }
    const sMs = new Date(mfStart).getTime();
    const eMs = new Date(mfEnd).getTime();
    if (!isFinite(sMs) || !isFinite(eMs)) { showToast?.("Nieprawidłowe daty"); return; }
    if (eMs <= sMs) { showToast?.("Koniec musi być po starcie"); return; }
    if (!vehicle || !driverEmail) { showToast?.("Brak pojazdu lub kierowcy"); return; }
    setMfSaving(true);
    try {
      await addDoc(collection(db, "driverActivities"), {
        driverEmail,
        driverName,
        vehicleId: vehicle.id,
        type: mfType,
        startTs: new Date(sMs).toISOString(),
        endTs: new Date(eMs).toISOString(),
        source: "manual",
        createdAt: new Date().toISOString(),
      });
      showToast?.(`Dodano segment: ${ACTIVITY_TYPES[mfType]?.label || mfType}`);
      setMfStart(""); setMfEnd(""); setMfType("drive");
      setManualFormOpen(false);
    } catch (e) {
      showToast?.("Błąd zapisu: " + (e?.message || "").slice(0, 60));
    }
    setMfSaving(false);
  };

  if (!vehicle || !driverEmail) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-3">👤</div>
        <div className="text-sm text-gray-600">Brak aktywnego kierowcy przypisanego do tego pojazdu.</div>
        <div className="text-xs text-gray-400 mt-2">Dodaj kierowcę w panelu edycji pojazdu (sekcja Historia kierowców).</div>
      </div>
    );
  }

  // Segmenty dla tego kierowcy
  const mySegs = driverActivities.filter(a => a.driverEmail === driverEmail);

  // periodStart — znajdź ostatni segment rozpoczynający 28-dniowy okres (uproszczenie MVP: najstarszy segment tego kierowcy w bazie)
  const periodStart = (() => {
    if (mySegs.length === 0) return null;
    const sorted = [...mySegs].sort((a, b) => (a.startTs || "").localeCompare(b.startTs || ""));
    return sorted[0]?.startTs;
  })();

  const compliance = computeDriverCompliance(mySegs, periodStart, new Date());
  const plan = computeDriverPlan(compliance);

  const currentMeta = ACTIVITY_TYPES[compliance.currentStateType] || null;
  const speed = Number(position?.speed) || 0;

  // Progress bar helper
  const Bar = ({ val, max, color = "blue" }) => {
    const pct = Math.min(100, Math.round((val / max) * 100));
    const fills = { blue: "#3b82f6", yellow: "#f59e0b", red: "#ef4444", green: "#22c55e", violet: "#7c3aed" };
    return (
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fills[color] }}></div>
      </div>
    );
  };

  // Kolor dla paska jazdy ciągłej (ostrzeżenie im bliżej 4.5h)
  const continuousColor = compliance.continuousDrive > REGULATION.CONTINUOUS_DRIVE ? "red"
    : compliance.continuousDrive > REGULATION.CONTINUOUS_DRIVE * 0.85 ? "yellow"
    : "blue";

  // Kolor dla paska czasu pracy (48h/tydz średnia, jazda + inna praca)
  const workTimeColor = compliance.weekly.workTime > REGULATION.WORK_TIME_WEEKLY_AVG ? "red"
    : compliance.weekly.workTime > REGULATION.WORK_TIME_WEEKLY_AVG * 0.85 ? "yellow"
    : "blue";

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#ede9fe", color: "#7c3aed" }}>🚛</div>
            <div>
              <div className="text-sm font-bold text-gray-900">{vehicle.plate} · {driverName}</div>
              <div className="text-xs text-gray-400">{vehicle.brand} {vehicle.year} · Atlas device #{device?.deviceId || device?.id}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {compliance.hasDdd ? (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
                ✓ Dane z tachografu (DDD)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
                Auto-wykrywanie GPS
              </span>
            )}
            {compliance.period28 && (
              <div className="text-right">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Okres 28-dniowy</div>
                <div className="text-xs text-gray-600 font-semibold">
                  Dzień {compliance.period28.daysPassed} / {REGULATION.RETURN_TO_BASE_DAYS}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 1: 4 KPI LIVE */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</span>
            {currentMeta && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: currentMeta.color }}></span>}
          </div>
          <div className="text-xl font-extrabold text-gray-900 mb-0.5">
            {currentMeta ? `${currentMeta.icon} ${currentMeta.label.toUpperCase()}` : "—"}
          </div>
          <div className="text-xs text-gray-500">
            {compliance.current?.isOpen ? `od ${fmtTimeShort(compliance.current.startMs)}` : "brak aktywności"}
            {speed > 0 && ` · ${Math.round(speed)} km/h`}
          </div>
        </div>

        {/* Do przerwy */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Do przerwy</div>
          <div className="text-xl font-extrabold text-amber-900 tabular-nums mb-1">
            {fmtHM(Math.max(0, REGULATION.CONTINUOUS_DRIVE - compliance.continuousDrive))}
          </div>
          <Bar val={compliance.continuousDrive} max={REGULATION.CONTINUOUS_DRIVE} color={continuousColor} />
          <div className="text-[11px] text-gray-500 mt-1">
            45 min o {plan ? fmtTimeShort(plan.nextBreak.atMs) : "—"}
          </div>
        </div>

        {/* Jazda dzisiaj */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Jazda dzisiaj</div>
          <div className="text-xl font-extrabold text-gray-900 tabular-nums mb-1">
            {fmtHM(compliance.daily.drive)} <span className="text-xs text-gray-400 font-normal">/ {fmtHM(compliance.daily.limit)}</span>
          </div>
          <Bar val={compliance.daily.drive} max={compliance.daily.limit} color="blue" />
          <div className="text-[11px] text-gray-500 mt-1">
            Koniec ok. {plan ? fmtTimeShort(plan.endOfDay.atMs) : "—"}
          </div>
        </div>

        {/* Powrót do bazy */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1">Powrót do bazy</div>
          <div className="text-xl font-extrabold text-gray-900 tabular-nums mb-1">
            {compliance.period28 ? compliance.period28.daysLeft : "—"} <span className="text-xs text-gray-400 font-normal">dni</span>
          </div>
          <Bar
            val={compliance.period28 ? REGULATION.RETURN_TO_BASE_DAYS - compliance.period28.daysLeft : 0}
            max={REGULATION.RETURN_TO_BASE_DAYS}
            color="violet"
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Deadline: {compliance.period28 ? new Date(compliance.period28.deadlineMs).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" }) : "—"}
          </div>
        </div>
      </div>

      {/* ROW 2: Plan do przodu + sumy dnia */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
        {/* Plan do przodu */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="text-sm font-bold text-gray-900 mb-3">📅 Plan do przodu (auto)</div>
          {plan ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#fef3c7" }}>⏸</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-900">Przerwa 45 min</div>
                  <div className="text-[11px] text-amber-700">
                    za {fmtHM(plan.nextBreak.driveMinToGo)} · {fmtTimeShort(plan.nextBreak.atMs)} → {fmtTimeShort(plan.nextBreak.endMs)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#dbeafe" }}>🛑</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-blue-900">Koniec jazdy dziennej</div>
                  <div className="text-[11px] text-blue-700">
                    limit {fmtHM(plan.endOfDay.dailyLimit)} · {fmtTimeShort(plan.endOfDay.atMs)}
                    {plan.endOfDay.extendedAllowed && compliance.daily.extendedDaysUsed === 0 && " (+10h dozwolone 2×/tydz)"}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#dcfce7" }}>🛏</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-green-900">Odpoczynek dzienny 11h</div>
                  <div className="text-[11px] text-green-700">
                    {fmtTimeShort(plan.dailyRest.startMs)} → {fmtTimeShort(plan.dailyRest.endMs)}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#f5f3ff", border: "1px solid #c7d2fe" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#ede9fe" }}>🛌</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-violet-900">Odpoczynek tygodniowy 45h</div>
                  <div className="text-[11px] text-violet-700">
                    {fmtTimeShort(plan.weeklyRest.startMs)} → {fmtTimeShort(plan.weeklyRest.endMs)}
                  </div>
                </div>
              </div>
              {plan.returnToBase && (
                <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#fee2e2" }}>🏠</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-red-900">Powrót do bazy</div>
                    <div className="text-[11px] text-red-700">
                      do {new Date(plan.returnToBase.deadlineMs).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })} · za {plan.returnToBase.daysLeft} dni
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">Brak danych do wyznaczenia planu</div>
          )}
        </div>

        {/* Sumy dzisiejszego dnia */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="text-sm font-bold text-gray-900 mb-3">🗓️ Dzisiaj (od ostatniego odpoczynku)</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(ACTIVITY_TYPES).map(([key, meta]) => (
              <div key={key} className="p-3 rounded-lg" style={{ background: meta.bg }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: meta.color }}></span>
                  <span className="text-[10px] font-semibold text-gray-500">{meta.label}</span>
                </div>
                <div className="text-base font-bold" style={{ color: meta.color }}>{fmtHM(compliance.daily[key])}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-gray-500">
            Okres: {fmtTimeShort(compliance.daily.start)} → teraz
          </div>
        </div>
      </div>

      {/* ROW 2.5: Timeline dzienny + rozwijany 7-dniowy */}
      {(() => {
        // Helper: suma segmentow przycietych do okna [dayStart, dayEnd]
        const sumDay = (dayStart, dayEnd) => {
          const sums = { drive: 0, work: 0, avail: 0, rest: 0 };
          compliance.segments.forEach(s => {
            const start = Math.max(s.startMs, dayStart);
            const end = Math.min(s.endMs, dayEnd);
            if (end > start) {
              const mins = Math.round((end - start) / 60000);
              if (s.type in sums) sums[s.type] += mins;
            }
          });
          return sums;
        };

        // Pasek 24h z kolorowymi segmentami
        const DayBar = ({ dayStart, dayEnd, height = 22 }) => {
          const dayDur = dayEnd - dayStart;
          const clips = compliance.segments
            .filter(s => s.endMs > dayStart && s.startMs < dayEnd)
            .map(s => ({
              type: s.type,
              startMs: Math.max(s.startMs, dayStart),
              endMs: Math.min(s.endMs, dayEnd),
              isOpen: s.isOpen,
            }))
            .sort((a, b) => a.startMs - b.startMs);
          return (
            <div style={{ height, position: "relative", background: "#f3f4f6", borderRadius: 6, overflow: "hidden" }}>
              {clips.map((c, i) => {
                const meta = ACTIVITY_TYPES[c.type] || { label: c.type, color: "#9ca3af" };
                const left = ((c.startMs - dayStart) / dayDur) * 100;
                const width = ((c.endMs - c.startMs) / dayDur) * 100;
                return (
                  <div key={i}
                    style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${left}%`, width: `${width}%`,
                      background: meta.color,
                    }}
                    title={`${meta.label} · ${fmtTimeShort(c.startMs)}${c.isOpen ? " → teraz" : ` → ${fmtTimeShort(c.endMs)}`}`}
                  />
                );
              })}
            </div>
          );
        };

        // Dzisiaj (od 00:00 do 24:00)
        const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
        const todayEnd = todayStart + 86400000;
        const todaySums = sumDay(todayStart, todayEnd);

        // 7 dni wstecz (bez dzisiejszego)
        const past7Days = (() => {
          const days = [];
          const names = ["Nd","Pon","Wt","Śr","Cz","Pt","Sob"];
          for (let i = 1; i <= 7; i++) {
            const d = new Date(todayStart);
            d.setDate(d.getDate() - i);
            const s = d.getTime();
            const e = s + 86400000;
            const label = `${names[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}`;
            days.push({ start: s, end: e, label, sums: sumDay(s, e) });
          }
          return days;
        })();

        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="text-sm font-bold text-gray-900">📊 Timeline aktywności — dziś</div>
              <div className="flex gap-3 text-[10px] text-gray-500">
                {Object.entries(ACTIVITY_TYPES).map(([k, m]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                    {m.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Pasek dzisiejszego dnia */}
            <DayBar dayStart={todayStart} dayEnd={todayEnd} height={24} />

            {/* Os godzin */}
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
              <span>00</span><span>03</span><span>06</span><span>09</span><span>12</span>
              <span>15</span><span>18</span><span>21</span><span>24</span>
            </div>

            {/* Sumy dzisiejszego dnia */}
            <div className="mt-3 flex gap-4 text-[11px] text-gray-600 flex-wrap">
              <span>🚛 Jazda <strong>{fmtHM(todaySums.drive)}</strong></span>
              <span>🔧 Praca <strong>{fmtHM(todaySums.work)}</strong></span>
              <span>⏱ Dysp. <strong>{fmtHM(todaySums.avail)}</strong></span>
              <span>🛏 Odp. <strong>{fmtHM(todaySums.rest)}</strong></span>
            </div>

            {/* Toggle 7 dni wstecz */}
            <button onClick={() => setShowWeek(s => !s)}
              className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              {showWeek ? "▲ Zwiń historię 7 dni" : "▼ Pokaż 7 dni wstecz"}
            </button>

            {showWeek && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                {past7Days.map(day => (
                  <div key={day.start}>
                    <div className="flex items-center justify-between text-[11px] mb-1 flex-wrap gap-2">
                      <span className="font-semibold text-gray-700">{day.label}</span>
                      <span className="text-gray-400 tabular-nums">
                        Jazda {fmtHM(day.sums.drive)} · Praca {fmtHM(day.sums.work)} · Dysp. {fmtHM(day.sums.avail)} · Odp. {fmtHM(day.sums.rest)}
                      </span>
                    </div>
                    <DayBar dayStart={day.start} dayEnd={day.end} height={18} />
                  </div>
                ))}
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono pt-1">
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ROW 3: Limity szczegółowe */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-sm font-bold text-gray-900 mb-3">Limity compliance</div>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Jazda dzienna</span>
              <span className="font-bold text-blue-700">{fmtHM(compliance.daily.drive)} / {fmtHM(compliance.daily.limit)} <span className="text-gray-400 font-normal">(10h wykorzystane {compliance.daily.extendedDaysUsed}/{compliance.daily.extendedDaysAllowed})</span></span>
            </div>
            <Bar val={compliance.daily.drive} max={compliance.daily.limit} color="blue" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Jazda ciągła (do przerwy 45min)</span>
              <span className="font-bold" style={{ color: continuousColor === "red" ? "#b91c1c" : continuousColor === "yellow" ? "#a16207" : "#1d4ed8" }}>
                {fmtHM(compliance.continuousDrive)} / {fmtHM(REGULATION.CONTINUOUS_DRIVE)}
              </span>
            </div>
            <Bar val={compliance.continuousDrive} max={REGULATION.CONTINUOUS_DRIVE} color={continuousColor} />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Jazda tygodniowa (bieżący tydzień)</span>
              <span className="font-bold text-blue-700">{fmtHM(compliance.weekly.drive)} / {fmtHM(compliance.weekly.limit)}</span>
            </div>
            <Bar val={compliance.weekly.drive} max={compliance.weekly.limit} color="blue" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Jazda dwutygodniowa</span>
              <span className="font-bold text-blue-700">{fmtHM(compliance.biweekly.drive)} / {fmtHM(compliance.biweekly.limit)}</span>
            </div>
            <Bar val={compliance.biweekly.drive} max={compliance.biweekly.limit} color="blue" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Czas pracy (48h/tydz śr., jazda + inna praca)</span>
              <span className="font-bold" style={{ color: workTimeColor === "red" ? "#b91c1c" : workTimeColor === "yellow" ? "#a16207" : "#1d4ed8" }}>{fmtHM(compliance.weekly.workTime)} / {fmtHM(REGULATION.WORK_TIME_WEEKLY_AVG)}</span>
            </div>
            <Bar val={compliance.weekly.workTime} max={REGULATION.WORK_TIME_WEEKLY_AVG} color={workTimeColor} />
          </div>
        </div>
      </div>

      {/* Historia aktywności */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-bold text-gray-900">Historia aktywności (ostatnie 24h)</div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-[11px] text-gray-400">Auto-GPS + kierowca + ręcznie</div>
            <button onClick={() => setManualFormOpen(v => !v)} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
              {manualFormOpen ? "✕ anuluj" : "＋ Dodaj ręcznie"}
            </button>
          </div>
        </div>
        {manualFormOpen && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-xs font-semibold text-blue-900 mb-2">Uzupełnij lukę w historii — segment dla {driverName}</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">Typ</label>
                <select value={mfType} onChange={e => setMfType(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs">
                  {Object.entries(ACTIVITY_TYPES).map(([id, meta]) => (
                    <option key={id} value={id}>{meta.icon} {meta.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">Start</label>
                <input type="datetime-local" value={mfStart} onChange={e => setMfStart(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">Koniec</label>
                <input type="datetime-local" value={mfEnd} onChange={e => setMfEnd(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs" />
              </div>
              <button disabled={mfSaving} onClick={submitManualSegment} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400">
                {mfSaving ? "Zapisuję…" : "Zapisz segment"}
              </button>
            </div>
            <div className="text-[10px] text-gray-500 mt-2">Segment ręczny nie jest nadpisywany przez auto-detection GPS (priorytet: DDD &gt; ręczny &gt; GPS).</div>
          </div>
        )}
        {(() => {
          const nowMs = Date.now();
          const from = nowMs - 24 * 3600000;
          const items = compliance.segments
            .filter(s => s.endMs > from)
            .sort((a, b) => b.startMs - a.startMs);
          if (items.length === 0) {
            return <div className="text-xs text-gray-400 italic text-center py-4">Brak aktywności w ostatnich 24h</div>;
          }
          return (
            <div className="space-y-1">
              {items.slice(0, 20).map(s => {
                const meta = ACTIVITY_TYPES[s.type] || { label: s.type, color: "#6b7280" };
                const srcLabel = s.source === "auto_gps" ? "auto GPS" : s.source === "manual" ? "kierowca ręcznie" : s.source === "fracht_event" ? "fracht event" : (s.source || "—");
                return (
                  <div key={s.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-50">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }}></span>
                    <span className="font-mono text-gray-500 w-28 flex-shrink-0">
                      {fmtTimeShort(s.startMs)} – {s.isOpen ? "teraz" : fmtTimeShort(s.endMs)}
                    </span>
                    <span className="font-semibold text-gray-700 flex-shrink-0">{meta.label}</span>
                    <span className="text-gray-400 flex-shrink-0">{fmtHM(s.durMin)}</span>
                    <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{srcLabel}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

