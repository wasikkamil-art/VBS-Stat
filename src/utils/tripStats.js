// Trip statistics — pure functions do oceniania trasy frachtu (punktualność,
// czas trasy, kilometry, średnie spalanie, ogólna ocena ok/warn/alarm).
// Wydzielone z App.jsx 2026-04-28 (TODO #5c krok 2) żeby TripSummaryPanel.jsx
// + DriverPanel.jsx mogły być lazy-loaded bez circular dependency.
//
// Eksporty:
//   - TRIP_TOLERANCE_MIN, SPALANIE_DEFAULT_NORMA, SPALANIE_DEFAULT_ALARM (consts)
//   - parsePlannedDateTime(date, time)
//   - calcTripPunctuality(plannedDate, plannedTime, actualIso)
//   - computeFuelConsumption(vehicleId, startDate, endDate, fuelEntries)
//   - classifyFuel(avgL100km, vehicle)
//   - computeTripStats(fracht, vehicle, driverEvents, fuelEntries) — główna funkcja
//   - fmtTripDuration(min)

export const TRIP_TOLERANCE_MIN = 15; // ≤15 min spóźnienia = "na czas"
export const SPALANIE_DEFAULT_NORMA = 30;   // fallback gdy pojazd nie ma ustawionego progu (l/100km)
export const SPALANIE_DEFAULT_ALARM = 38;

// Parsuje "YYYY-MM-DD" + "HH:MM" do Date (lokalny czas)
export function parsePlannedDateTime(date, time) {
  if (!date) return null;
  try {
    // Gdy brak godziny — przyjmujemy koniec dnia (23:59) jako deadline "soft"
    const t = (time && /^\d{1,2}:\d{2}$/.test(time)) ? time : "23:59";
    const d = new Date(`${date}T${t.length === 4 ? "0" + t : t}:00`);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}

// Zwraca obiekt opisujący punktualność dotarcia
//   { onTime, minutes (>0 = spóźnienie), text, status: "ok"|"late" }  lub null gdy brak danych
export function calcTripPunctuality(plannedDate, plannedTime, actualIso) {
  if (!plannedDate || !actualIso) return null;
  const planned = parsePlannedDateTime(plannedDate, plannedTime);
  const actual = new Date(actualIso);
  if (!planned || isNaN(actual.getTime())) return null;
  const diffMin = Math.round((actual - planned) / 60000);
  if (diffMin <= TRIP_TOLERANCE_MIN) {
    const early = diffMin < 0 ? ` (${Math.abs(diffMin)} min przed)` : diffMin === 0 ? "" : ` (+${diffMin} min)`;
    return { onTime: true, minutes: diffMin, text: `Na czas${early}`, status: "ok" };
  }
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return {
    onTime: false,
    minutes: diffMin,
    text: h > 0 ? `Spóźnienie ${h}h ${m}min` : `Spóźnienie ${m} min`,
    status: "late",
  };
}

// Oblicza średnie spalanie pojazdu w okresie (metoda "brimming" między pełnymi tankowaniami)
//   vehicleId, startDate ISO, endDate ISO, fuelEntries[] — zwraca { avgL100km, liters, km, tankings } lub null
export function computeFuelConsumption(vehicleId, startDate, endDate, fuelEntries) {
  if (!vehicleId || !Array.isArray(fuelEntries) || fuelEntries.length < 2) return null;
  try {
    const windowStart = new Date(startDate);
    const windowEnd = new Date(endDate);
    if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) return null;
    // rozszerz okno ±3 dni
    windowStart.setDate(windowStart.getDate() - 3);
    windowEnd.setDate(windowEnd.getDate() + 3);

    const entries = fuelEntries
      .filter(e => e.vehicleId === vehicleId && e.fullTank && !e.isAdblue && e.mileage && e.liters && e.date)
      .map(e => ({ ...e, _d: new Date(e.date), _mil: Number(e.mileage), _l: Number(e.liters) }))
      .filter(e => !isNaN(e._d.getTime()) && e._mil > 0 && e._l > 0)
      .filter(e => e._d >= windowStart && e._d <= windowEnd)
      .sort((a, b) => a._mil - b._mil);

    if (entries.length < 2) return null;
    const first = entries[0];
    const last = entries[entries.length - 1];
    const km = last._mil - first._mil;
    if (km <= 0) return null;
    // Litry: suma wszystkich tankowań od indeksu 1 (bo pierwsze = stan referencyjny)
    const liters = entries.slice(1).reduce((s, e) => s + e._l, 0);
    const avg = (liters / km) * 100;
    if (!isFinite(avg) || avg <= 0) return null;
    return {
      avgL100km: Number(avg.toFixed(2)),
      liters: Number(liters.toFixed(1)),
      km,
      tankings: entries.length,
    };
  } catch {
    return null;
  }
}

// Klasyfikuje spalanie wg progów pojazdu
//   vehicle.spalanieNorma, vehicle.spalanieAlarm → "ok" | "warn" | "alarm"
export function classifyFuel(avgL100km, vehicle) {
  if (avgL100km == null) return null;
  const norma = Number(vehicle?.spalanieNorma) || SPALANIE_DEFAULT_NORMA;
  const alarm = Number(vehicle?.spalanieAlarm) || SPALANIE_DEFAULT_ALARM;
  if (avgL100km <= norma) return "ok";
  if (avgL100km <= alarm) return "warn";
  return "alarm";
}

// GŁÓWNA funkcja — buduje pełne podsumowanie trasy
//   fracht — pełny dokument frachtu (z dataZaladunku, godzZaladunku, kmStart, kmEnd, kmWszystkie...)
//   vehicle — dokument pojazdu (z spalanieNorma, spalanieAlarm)
//   driverEvents — wszystkie driverEvents (będą filtrowane po frachtId)
//   fuelEntries — wszystkie fuelEntries (filtrowane po vehicleId + okres)
export function computeTripStats(fracht, vehicle, driverEvents = [], fuelEntries = []) {
  if (!fracht) return null;
  const f = fracht;
  const evs = driverEvents.filter(ev => ev.frachtId === f.id).sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));
  const latestOf = (type) => evs.filter(e => e.type === type).pop();
  const undoOf = (type) => evs.filter(e => e.type === `cofnij_${type}`).pop();
  const effective = (type) => {
    const ev = latestOf(type);
    const un = undoOf(type);
    if (!ev) return null;
    if (un && un.ts > ev.ts) return null;
    return ev;
  };

  const dotarcieZal = effective("dotarcie_zaladunek");
  const startRoz = effective("start_rozladunek");       // kierowca ruszył z załadunku
  const dotarcieRoz = effective("dotarcie_rozladunek"); // dotarł na rozładunek
  // Legacy/admin eventy (mogą istnieć w starych danych lub być ustawione ręcznie)
  const zaladowano = effective("zaladowano");
  const rozladowano = effective("rozladowano");

  // Punktualnosc liczymy TYLKO z eventow `dotarcie_*` (realny moment dotarcia,
  // klikniety przez kierowce w terenie albo recznie wpisany przez admina/dyspozytora).
  // Legacy eventy `zaladowano`/`rozladowano` maja `ts` = moment rejestracji statusu w panelu,
  // co dla retroaktywnych oznaczen nie odpowiada rzeczywistemu dotarciu → fałszywe spóźnienia.
  const zalTs = dotarcieZal?.value || dotarcieZal?.ts || null;
  const rozTs = dotarcieRoz?.value || dotarcieRoz?.ts || null;

  // Punktualność — liczona z dotarć (kierowca klika "dotarłem")
  const punktZal = calcTripPunctuality(f.dataZaladunku, f.godzZaladunku, zalTs);
  const punktRoz = calcTripPunctuality(f.dataRozladunku, f.godzRozladunku, rozTs);

  // Czas trasy: od momentu gdy kierowca ruszył z załadunku (start_rozladunek)
  // do momentu dotarcia na rozładunek (dotarcie_rozladunek) — czysty czas jazdy
  // Fallback: jeśli brak start_rozladunek, użyj dotarcie_zaladunek (z załadunkiem)
  let czasTrasyMin = null;
  const tStart = startRoz?.value || startRoz?.ts || zaladowano?.value || zaladowano?.ts || zalTs;
  const tEnd = dotarcieRoz?.value || dotarcieRoz?.ts || rozladowano?.value || rozladowano?.ts || rozTs;
  if (tStart && tEnd) {
    const diff = Math.round((new Date(tEnd) - new Date(tStart)) / 60000);
    if (diff > 0) czasTrasyMin = diff;
  }

  // Czas planowany: z dataZaladunku+godzZaladunku do dataRozladunku+godzRozladunku
  let czasPlanowanyMin = null;
  const planStart = parsePlannedDateTime(f.dataZaladunku, f.godzZaladunku);
  const planEnd = parsePlannedDateTime(f.dataRozladunku, f.godzRozladunku);
  if (planStart && planEnd) {
    const diff = Math.round((planEnd - planStart) / 60000);
    if (diff > 0) czasPlanowanyMin = diff;
  }

  // Kilometry
  const kmStart = Number(f.kmStart);
  const kmEnd = Number(f.kmEnd);
  const kmRzeczywiste = (isFinite(kmStart) && isFinite(kmEnd) && kmEnd > kmStart) ? (kmEnd - kmStart) : null;
  const kmPlanowane = Number(f.kmWszystkie) || null;

  // Średnia prędkość (km/h) — tylko gdy mamy oba (km i czas)
  let sredniaPredkosc = null;
  if (kmRzeczywiste && czasTrasyMin) {
    sredniaPredkosc = Math.round((kmRzeczywiste / (czasTrasyMin / 60)) * 10) / 10;
  }

  // Spalanie — w okresie trasy
  let spalanie = null;
  if (vehicle?.id && f.dataZaladunku && (f.dataRozladunku || tEnd)) {
    const endDateISO = f.dataRozladunku || new Date(tEnd).toISOString().slice(0, 10);
    const fc = computeFuelConsumption(vehicle.id, f.dataZaladunku, endDateISO, fuelEntries);
    if (fc) {
      spalanie = { ...fc, status: classifyFuel(fc.avgL100km, vehicle) };
    }
  }

  // Ocena ogólna — najgorszy ze statusów
  const statuses = [
    punktZal?.status === "late" ? "late" : null,
    punktRoz?.status === "late" ? "late" : null,
    spalanie?.status === "alarm" ? "alarm" : spalanie?.status === "warn" ? "warn" : null,
  ].filter(Boolean);
  let ocenaOgolna = "ok";
  if (statuses.includes("alarm") || statuses.filter(s => s === "late").length >= 1) ocenaOgolna = "alarm";
  else if (statuses.includes("warn")) ocenaOgolna = "warn";

  return {
    punktZal, punktRoz,
    czasTrasyMin, czasPlanowanyMin,
    kmRzeczywiste, kmPlanowane,
    sredniaPredkosc,
    spalanie,
    ocenaOgolna,
    // raw events do debugowania/diff
    _zalTs: zalTs, _rozTs: rozTs,
  };
}

// Formatter: minuty → "Xh Ymin" lub "Ymin"
export function fmtTripDuration(min) {
  if (min == null || !isFinite(min)) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
