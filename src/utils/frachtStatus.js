// Helpery statusu frachtu — single source of truth.
// Wydzielone z App.jsx 2026-04-28 jako część TODO #5c (code splitting).
// Przed konsolidacją było: definicja w App.jsx (linie ~1290) + duplikat inline
// w DriverPanel + duplikat inline w GpsMapSection. Teraz jeden plik.
//
// Używane przez:
//   - App.jsx (24 read sites)
//   - GpsMapSection (filter aktywnych frachtów do mapy + skip stale)
//   - DriverPanel (active/upcoming/history split)
//   - VehicleOrdersSection, FrachtyTab, FrachtyModal i inne

// ═══════════════════════════════════════════════════════════════════════════
// computeFrachtStatus — single source of truth dla statusu rozładunku
// ═══════════════════════════════════════════════════════════════════════════
// Hierarchia priorytetów (od najwyższego):
//   1. `f.statusRozladunkuManual` (NEW po refactorze 2026-04-28) — admin świadomie
//      nadpisał (np. "problem", "rozladowano" force-close, "w_trasie" cofnięcie).
//   2. `f.statusRozladunku` LEGACY field (przed refactorem) — TRAKTOWANY JAK IMPLICIT
//      OVERRIDE. Admin lub driver kiedyś świadomie ustawił "rozladowano"/"problem".
//      Szanujemy tę decyzję nawet gdy w eventach jest nowszy cofnij — old cofnij
//      eventy mogą być testowe/stale.
//   3. Compute z eventów: najnowszy `rozladowano` (i nie cofnięty) → "rozladowano".
//      Używane GDY legacy field puste — driver kliknął, propagacja failed
//      (race condition który był przyczyną buga 2454/2026 z 2026-04-28).
//   4. Default: "w_trasie".
export function computeFrachtStatus(fracht, eventsForFracht = []) {
  if (!fracht) return "w_trasie";
  // 1. Manual override admina — wygrywa wszystko (NEW field po refactorze)
  if (fracht.statusRozladunkuManual) return fracht.statusRozladunkuManual;
  // 2. Legacy field — implicit override (admin/driver kiedyś świadomie ustawił).
  if (fracht.statusRozladunku === "rozladowano" || fracht.statusRozladunku === "problem") {
    return fracht.statusRozladunku;
  }
  // 3. Compute z driverEvents — najnowszy rozladowano vs cofnij_rozladowano.
  if (Array.isArray(eventsForFracht) && eventsForFracht.length > 0) {
    const rozEvents = eventsForFracht
      .filter(e => e && (e.type === "rozladowano" || e.type === "cofnij_rozladowano"))
      .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    if (rozEvents.length > 0 && rozEvents[0].type === "rozladowano") return "rozladowano";
  }
  // 4. Default
  return "w_trasie";
}

// Shortcut boolean — "czy rozładowany?". Używaj w filtrach gdzie potrzebny tylko bool.
export function isFrachtRozladowany(fracht, eventsForFracht = []) {
  return computeFrachtStatus(fracht, eventsForFracht) === "rozladowano";
}

// ═══════════════════════════════════════════════════════════════════════════
// isStaleUnfinished — auto-archive starych frachtów bez explicit zamknięcia
// ═══════════════════════════════════════════════════════════════════════════
// Fracht starszy niż STALE_DAYS dni (od dataZaladunku) i mający dataRozladunku
// w przeszłości (lub w ogóle brak dataRozladunku) jest traktowany jak porzucony
// /zakończony (legacy/test data nigdy nie oznaczone jako rozladowano).
//
// Bez tego: GpsMapSection wybierał trasy sprzed 14 miesięcy (bug 2026-04-28
// pokazywał trasę z lutego 2025 dla WGM 0475M). DriverPanel similarly archiwizował
// stare frachty żeby nie mieszały na liście "active".
//
// Zwraca true gdy fracht powinien być uznany za zakończony mimo że nie ma eventu.
export const STALE_DAYS = 7;

export function isStaleUnfinished(fracht, todayStr = new Date().toISOString().slice(0, 10)) {
  if (!fracht?.dataZaladunku) return false;
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 86400000).toISOString().slice(0, 10);
  if (fracht.dataZaladunku >= staleThreshold) return false; // młody fracht — nie archiwizuj
  if (!fracht.dataRozladunku) return true;
  if (fracht.dataRozladunku < todayStr) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// getMaxRouteIndex — najwyższy zdefiniowany indeks rozładunku (1..5)
// ═══════════════════════════════════════════════════════════════════════════
// Schema FrachtyModal wspiera R1-R5 (suffix "" dla R1, "2"-"5" dla pozostałych).
// Punkt liczy się jako "zdefiniowany" gdy ma którekolwiek z: kod pocztowy, miasto,
// pełny adres `dokod`, lub geo. Helper potrzebny do logiki "ostatni rozładunek"
// (np. trigger finalizeTrip CF po finalnym dotarcie_rozladunek).
export function getMaxRouteIndex(fracht) {
  if (!fracht) return 1;
  const has = (i) => {
    const sfx = i === 1 ? "" : String(i);
    return !!(
      (fracht[`dokodPocztowy${sfx}`] && String(fracht[`dokodPocztowy${sfx}`]).trim()) ||
      (fracht[`dokodMiasto${sfx}`] && String(fracht[`dokodMiasto${sfx}`]).trim()) ||
      (fracht[`dokod${sfx}`] && String(fracht[`dokod${sfx}`]).trim()) ||
      (fracht[`rozladunekGeo${sfx}`] && String(fracht[`rozladunekGeo${sfx}`]).trim())
    );
  };
  let max = 1;
  for (let i = 2; i <= 5; i++) if (has(i)) max = i;
  return max;
}
