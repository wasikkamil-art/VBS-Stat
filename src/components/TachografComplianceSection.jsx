// TachografComplianceSection — admin sub-zakładka "Tachograf" w GPS/Monitoring tab.
// Layout w stylu Webfleet (4 sekcje: Bieżący stan, Czas odpoczynku, Zmiana, Bieżący tydzień).
// Stworzony 2026-05-04 jako alternatywa dla GpsCzasPracySection — stary widok zostaje
// nienaruszony, ten jest opt-in (zakładka obok). Lazy-loadowane.

import { useState, useEffect } from "react";

import {
  REGULATION, ACTIVITY_TYPES,
  fmtHM, fmtTimeShort,
  computeDriverCompliance, computeDriverPlan,
  suggestBaseReturnFromRest,
} from "../utils/czasPracy";

export default function TachografComplianceSection({ device, position, driverActivities = [], multiDayView = null, onUpdateVehicle, showToast }) {
  const [, forceTick] = useState(0);

  // Tick co 30s żeby liczniki live się odświeżały (countdownów do przerwy/odpoczynku)
  useEffect(() => {
    const t = setInterval(() => forceTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const vehicle = device?.fleetVehicle;
  const activeDriver = (vehicle?.driverHistory || []).find(d => !d.to);
  const driverEmail = activeDriver?.email;
  const driverName = activeDriver?.name || driverEmail || "—";

  if (!vehicle || !driverEmail) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="text-4xl mb-3">👤</div>
        <div className="text-sm text-gray-600">Brak aktywnego kierowcy przypisanego do tego pojazdu.</div>
        <div className="text-xs text-gray-400 mt-2">Dodaj kierowcę w panelu edycji pojazdu (sekcja Historia kierowców).</div>
      </div>
    );
  }

  const mySegs = driverActivities.filter(a => a.driverEmail === driverEmail);
  // Kotwica 28-dniowego "Powrót do bazy" = OSOBNE ręczne pole tachoCardStart
  // ("data wg tachografu / włożenia karty"), NIEZALEŻNE od vehicle.tachoStart
  // (przegląd "kiedy wyjeżdża"). Decyzja user 2026-06-10: tacho = świętość,
  // przegląd = podgląd → dwa niezależne liczniki. Brak daty → period28 = null
  // → UI pokazuje prompt do wpisania, NIE błędny licznik od najstarszego segmentu.
  const periodStart = vehicle?.tachoCardStart || null;

  const handleTachoCardChange = async (dateStr) => {
    if (!onUpdateVehicle || !vehicle?.id) return;
    try {
      await onUpdateVehicle({ tachoCardStart: dateStr || null });
      showToast?.(dateStr ? "✅ Data tacho zapisana" : "✅ Data tacho wyczyszczona");
    } catch (e) {
      console.error("[handleTachoCardChange]", e);
      showToast?.("⚠️ Błąd zapisu daty tacho");
    }
  };

  const compliance = computeDriverCompliance(mySegs, periodStart, new Date());
  const plan = computeDriverPlan(compliance);

  // Sugestie daty dla pola tachoCardStart (user 2026-06-10): (1) z tachografu —
  // koniec ostatniego odpoczynku ≥56h = prawdopodobnie wyjazd z bazy; (2) z
  // przeglądu — ręczna data "kiedy wyjeżdża". Klik tylko WSTAWIA propozycję,
  // user zatwierdza (tacho = świętość).
  const tachoSuggestion = suggestBaseReturnFromRest(compliance.segments, new Date(), 56 * 60);
  const przegladSuggestion = vehicle?.tachoStart || null;
  const msToDateInput = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const ddmm = (ms) => {
    const d = new Date(ms);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  // Długie odpoczynki (≥48h) czytelniej w dniach: "8d 12h" zamiast "204h 28min".
  const fmtDur = (min) => {
    if (min >= 48 * 60) {
      const d = Math.floor(min / (24 * 60));
      const h = Math.round((min % (24 * 60)) / 60);
      return h ? `${d}d ${h}h` : `${d}d`;
    }
    return fmtHM(min);
  };
  const suggestionChips = (tachoSuggestion || przegladSuggestion) ? (
    <div className="flex items-center flex-wrap gap-1.5 mt-2">
      <span className="text-[10px] text-gray-400">💡 Sugestie:</span>
      {tachoSuggestion && (
        <button type="button" onClick={() => handleTachoCardChange(msToDateInput(tachoSuggestion.endMs))}
          title="Koniec ostatniego długiego odpoczynku (≥56h) = prawdopodobnie wyjazd z bazy"
          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all">
          ⏱️ Tacho: {ddmm(tachoSuggestion.endMs)} · {fmtDur(tachoSuggestion.durMin)}
        </button>
      )}
      {przegladSuggestion && (
        <button type="button" onClick={() => handleTachoCardChange(przegladSuggestion)}
          title="Ręczna data wyjazdu z przeglądu (kiedy wyjeżdża)"
          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all">
          📋 Z przeglądu: {przegladSuggestion.split("-").slice(1).reverse().join(".")}
        </button>
      )}
    </div>
  ) : null;

  const currentMeta = ACTIVITY_TYPES[compliance.currentStateType] || null;
  const speed = Number(position?.speed) || 0;
  const nowMs = Date.now();

  // ── Helpery prezentacyjne ──

  const fmtCountdown = (toMs) => {
    if (!toMs || toMs <= nowMs) return "teraz";
    return fmtHM((toMs - nowMs) / 60000);
  };

  const fmtDateTime = (ms) => {
    if (!ms) return "—";
    const d = new Date(ms);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    if (isToday) return `${hh}:${min}`;
    if (isTomorrow) return `jutro ${hh}:${min}`;
    return `${dd}.${mm}, ${hh}:${min}`;
  };

  // Pasek progresu (val/max) z kolorystyką progową
  const Bar = ({ val, max, color = "green" }) => {
    const pct = Math.min(100, Math.round(((val || 0) / Math.max(max, 1)) * 100));
    const fills = { blue: "#3b82f6", yellow: "#f59e0b", red: "#ef4444", green: "#22c55e", violet: "#7c3aed" };
    return (
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fills[color] }}></div>
      </div>
    );
  };

  // Kolor paska zależny od progu wyczerpania limitu (val do max)
  const remainingColor = (remaining, total) => {
    const pct = (remaining / total) * 100;
    if (pct < 15) return "red";
    if (pct < 35) return "yellow";
    return "green";
  };

  // ── Obliczenia derived ──

  const currentlyResting = compliance.currentStateType === "rest" && compliance.current?.isOpen;
  const totalWorkToday = compliance.daily.drive + compliance.daily.work + compliance.daily.avail;
  const dailyDriveRemaining = Math.max(0, compliance.daily.limit - compliance.daily.drive);
  const continuousDriveRemaining = Math.max(0, REGULATION.CONTINUOUS_DRIVE - compliance.continuousDrive);
  const weeklyDriveRemaining = Math.max(0, compliance.weekly.effectiveDriveLimit - compliance.weekly.drive);

  // Czas zakończenia obecnego odpoczynku (jeśli rest open + min 11h od startu)
  const restEndMs = currentlyResting
    ? compliance.current.startMs + REGULATION.DAILY_REST_REGULAR * 60000
    : null;

  // Następny tygodniowy odpoczynek — z plan (już mamy)
  const weeklyRestStartMs = plan?.weeklyRest?.startMs || null;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: "#dbeafe", color: "#1e40af" }}>📋</div>
            <div>
              <div className="text-sm font-bold text-gray-900">{vehicle.plate} · {driverName}</div>
              <div className="text-xs text-gray-400">Tachograf compliance · 561/2006 + Pakiet Mobilności</div>
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
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 1: BIEŻĄCY STAN                              */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Bieżący stan</div>

        {/* Aktywność z timestampem startu */}
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-50">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: currentMeta?.bg || "#f3f4f6" }}>
            {currentMeta?.icon || "—"}
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-semibold text-gray-500 uppercase">Aktywność</div>
            <div className="text-base font-bold text-gray-900">
              {currentMeta ? `${currentMeta.label}` : "—"}
              {compliance.current?.isOpen && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  od {fmtTimeShort(compliance.current.startMs)} ({fmtHM((nowMs - compliance.current.startMs) / 60000)})
                </span>
              )}
            </div>
            {speed > 0 && <div className="text-xs text-gray-500 mt-0.5">{Math.round(speed)} km/h</div>}
          </div>
        </div>

        {/* Pozostały czas jazdy z paskiem */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Pozostały czas jazdy
            </span>
            <span className="text-gray-500 tabular-nums">
              <strong className="text-gray-900">{fmtHM(dailyDriveRemaining)}</strong>
              <span className="text-gray-400 ml-1">/ {fmtHM(compliance.daily.limit)}</span>
            </span>
          </div>
          <Bar val={dailyDriveRemaining} max={compliance.daily.limit} color={remainingColor(dailyDriveRemaining, compliance.daily.limit)} />
        </div>

        {/* Grid: 4 mini-karty (Całkowity czas pracy, Jazda, Inna praca, Tryb czuwania) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg" style={{ background: "#f8fafc" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
              <span className="text-[10px] font-semibold text-slate-600">Całkowity czas pracy</span>
            </div>
            <div className="text-base font-bold text-slate-900 tabular-nums">{fmtHM(totalWorkToday)}</div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: ACTIVITY_TYPES.drive.bg }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_TYPES.drive.color }}></span>
              <span className="text-[10px] font-semibold text-blue-700">Jazda</span>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: ACTIVITY_TYPES.drive.color }}>{fmtHM(compliance.daily.drive)}</div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: ACTIVITY_TYPES.work.bg }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_TYPES.work.color }}></span>
              <span className="text-[10px] font-semibold text-amber-700">Inna praca</span>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: ACTIVITY_TYPES.work.color }}>{fmtHM(compliance.daily.work)}</div>
          </div>

          <div className="p-3 rounded-lg" style={{ background: ACTIVITY_TYPES.avail.bg }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: ACTIVITY_TYPES.avail.color }}></span>
              <span className="text-[10px] font-semibold text-slate-600">Tryb czuwania</span>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: ACTIVITY_TYPES.avail.color }}>{fmtHM(compliance.daily.avail)}</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 2: CZAS ODPOCZYNKU                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Czas odpoczynku</div>

        <div className="space-y-4">
          {/* Następna przerwa (po max 4.5h jazdy ciągłej → 45min) */}
          <div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#fffbeb" }}>⏸</div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Następna przerwa</div>
                <div className="text-sm font-bold text-gray-900">
                  {currentlyResting ? "Na przerwie" : `Po ${fmtHM(continuousDriveRemaining)} jazdy`}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {plan?.nextBreak ? `45 min o ${fmtTimeShort(plan.nextBreak.atMs)}` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Czas odpoczynku dziennego (countdown gdy rest open) */}
          <div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#f0fdf4" }}>🛏</div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Odpoczynek dzienny (11h)</div>
                {currentlyResting && restEndMs ? (
                  <>
                    <div className="text-sm font-bold text-gray-900">
                      do {fmtDateTime(restEndMs)}
                    </div>
                    <div className="text-[11px] text-green-700 mt-0.5">
                      Pozostało {fmtCountdown(restEndMs)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-bold text-gray-900">
                      {plan?.dailyRest ? `${fmtDateTime(plan.dailyRest.startMs)} → ${fmtDateTime(plan.dailyRest.endMs)}` : "—"}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Najwcześniej za {fmtCountdown(plan?.dailyRest?.startMs)}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Czas następnego tygodniowego odpoczynku */}
          <div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#f5f3ff" }}>🛌</div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Tygodniowy odpoczynek (45h)</div>
                <div className="text-sm font-bold text-gray-900">
                  {weeklyRestStartMs ? fmtDateTime(weeklyRestStartMs) : "—"}
                </div>
                <div className="text-[11px] text-violet-700 mt-0.5">
                  {weeklyRestStartMs ? `Pozostało ${fmtCountdown(weeklyRestStartMs)}` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 3: ZMIANA                                    */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Zmiana</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Rozpoczęcie zmiany</span>
            </div>
            <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtDateTime(compliance.shift.startMs)}</div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Najpóźniejszy koniec zmiany</span>
            </div>
            <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtDateTime(compliance.shift.latestEndMs)}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              +{compliance.shift.shiftHours}h od rozpoczęcia
              {compliance.shift.canReduce
                ? <span className="ml-1 text-gray-400">(z ~9h skróconym odp.)</span>
                : <span className="ml-1 text-amber-600 font-semibold">(brak skróceń — 11h regularny)</span>}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Najwcześniejszy start następnej</span>
            </div>
            <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtDateTime(compliance.shift.nextStartMs)}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              +{compliance.shift.nextRestHours}h {compliance.shift.canReduce ? "skróconego" : "regularnego"} odpoczynku
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 4: BIEŻĄCY TYDZIEŃ                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">Bieżący tydzień</div>

        {/* Pozostały czas jazdy w tygodniu z paskiem */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              Pozostały czas jazdy
            </span>
            <span className="text-gray-500 tabular-nums">
              <strong className="text-gray-900">{fmtHM(weeklyDriveRemaining)}</strong>
              <span className="text-gray-400 ml-1">/ {fmtHM(compliance.weekly.effectiveDriveLimit)}</span>
            </span>
          </div>
          <Bar val={weeklyDriveRemaining} max={compliance.weekly.effectiveDriveLimit} color={remainingColor(weeklyDriveRemaining, compliance.weekly.effectiveDriveLimit)} />
          {compliance.weekly.effectiveDriveLimit < REGULATION.WEEKLY_DRIVE && (
            <div className="text-[10px] text-amber-700 mt-1">
              ℹ Limit pomniejszony przez biweekly cap 90h (poprzedni tydzień: {fmtHM(REGULATION.BIWEEKLY_DRIVE - compliance.weekly.effectiveDriveLimit)} jazdy)
            </div>
          )}
        </div>

        {/* Wydłużenia dziennego czasu jazdy (badges 10h × N) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Wydłużenia dziennego czasu jazdy</span>
              <span className="text-[10px] text-gray-400 ml-auto">{compliance.weekly.extendedDailyDrives} / {compliance.weekly.extendedDailyDrivesAllowed}</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: compliance.weekly.extendedDailyDrivesAllowed }).map((_, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${i < compliance.weekly.extendedDailyDrives ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                  10h
                </span>
              ))}
              {compliance.weekly.extendedDailyDrives === 0 && <span className="text-[11px] text-gray-400 italic ml-1 self-center">brak</span>}
            </div>
          </div>

          {/* Zmniejszone dzienne odpoczynki (badges <11h × N) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span className="text-[10px] font-semibold text-gray-500 uppercase">Zmniejszone dzienne odpoczynki</span>
              <span className="text-[10px] text-gray-400 ml-auto">{compliance.weekly.reducedDailyRests} / {compliance.weekly.reducedDailyRestsAllowed}</span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: compliance.weekly.reducedDailyRestsAllowed }).map((_, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${i < compliance.weekly.reducedDailyRests ? "bg-green-100 text-green-800 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                  &lt;11h
                </span>
              ))}
              {compliance.weekly.reducedDailyRests === 0 && <span className="text-[11px] text-gray-400 italic ml-1 self-center">brak</span>}
            </div>
          </div>
        </div>

        {/* Powrót do bazy (28 dni) — osobne ręczne pole tachoCardStart, NIEZALEŻNE od przeglądu */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              Powrót do bazy (Pakiet Mobilności, 28 dni)
            </span>
            {compliance.period28 && (
              <span className="text-gray-500 tabular-nums">
                <strong className="text-gray-900">{compliance.period28.daysLeft} dni</strong>
                <span className="text-gray-400 ml-1">/ {REGULATION.RETURN_TO_BASE_DAYS}</span>
              </span>
            )}
          </div>
          {compliance.period28 ? (
            <>
              <div className="mt-1">
                <Bar val={REGULATION.RETURN_TO_BASE_DAYS - compliance.period28.daysLeft} max={REGULATION.RETURN_TO_BASE_DAYS} color={compliance.period28.daysLeft < 7 ? "red" : compliance.period28.daysLeft < 14 ? "yellow" : "violet"} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5 gap-2">
                <span>Deadline: {fmtDateTime(compliance.period28.deadlineMs)}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-gray-400">wg karty:</span>
                  <input type="date" value={vehicle.tachoCardStart}
                    onChange={e => handleTachoCardChange(e.target.value)}
                    className="text-[11px] outline-none bg-transparent text-gray-700 border border-gray-200 rounded px-1 py-0.5"
                    style={{ fontFamily: "'DM Sans', sans-serif" }} />
                  <button onClick={() => handleTachoCardChange("")}
                    className="text-gray-400 hover:text-red-400 transition-all">Reset</button>
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg" style={{ background: "#faf5ff", border: "1.5px dashed #e9d5ff" }}>
              <span className="text-[11px] text-violet-700 flex-shrink-0">⏱️ Data wg tachografu (włożenie karty / ostatni powrót):</span>
              <input type="date"
                onChange={e => handleTachoCardChange(e.target.value)}
                className="flex-1 text-xs outline-none bg-transparent text-violet-900 min-w-0"
                style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
          )}
          {suggestionChips}
          <div className="text-[10px] text-gray-400 mt-1.5 italic">Niezależne od daty wyjazdu w przeglądzie — własny licznik tachografu.</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 5: ZMNIEJSZONE TYGODNIOWE CZASY ODPOCZYNKÓW  */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
          Zmniejszone tygodniowe czasy odpoczynków
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
            <span className="text-[10px] font-semibold text-gray-500 uppercase">Wyrównanie (Pakiet Mobilności art. 8.6)</span>
          </div>
          {compliance.weeklyRestComp.owedMin > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-amber-700 tabular-nums">
                  {Math.floor(compliance.weeklyRestComp.owedMin / 60)}h {compliance.weeklyRestComp.owedMin % 60}min
                </span>
                <span className="text-[11px] text-gray-500">do oddania</span>
              </div>
              {compliance.weeklyRestComp.deadlineMs && (
                <div className="text-[11px] text-amber-700 mt-1">
                  ⚠ Deadline wyrównania: {fmtDateTime(compliance.weeklyRestComp.deadlineMs)}
                </div>
              )}
              <div className="text-[11px] text-gray-500 mt-1.5">
                Wyrównanie przez dłuższy odpoczynek (&gt;45h tygodniowy lub doczepiony do dziennego).
              </div>
            </>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-green-700 tabular-nums">—</span>
              <span className="text-[11px] text-gray-500">brak skróconych tygodniowych odpoczynków do wyrównania</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 6: PLAN DO PRZODU (auto)                     */}
      {/* ═══════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
          📅 Plan do przodu (auto)
        </div>
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

      {/* ═══════════════════════════════════════════════════ */}
      {/* SEKCJA 7: TIMELINE WIELODNIOWY (z range pickerem)    */}
      {/* ═══════════════════════════════════════════════════ */}
      {/* Komponent przekazany jako prop z App.jsx (MultiDayActivityView) — */}
      {/* zachowuje pełen widget z wyborem zakresu dat, sumami okresu i listą dni. */}
      {multiDayView}

    </div>
  );
}
