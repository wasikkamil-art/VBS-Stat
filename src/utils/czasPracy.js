// Czas pracy kierowcy — przepisy 561/2006 + Pakiet Mobilności.
// Wydzielone z App.jsx 2026-04-29 (TODO #5c krok 2 — pre-req dla DriverPanel
// + DriverCzasPracyDashboard lazy chunk dla kierowców mobile).
//
// Eksporty:
//   - REGULATION (consts limitów w minutach, 561/2006 + Pakiet Mobilności)
//   - ACTIVITY_TYPES (słownik typów: drive/work/avail/rest)
//   - Pure helpers: addMin, minBetween, fmtMin, fmtHM
//   - Pure logic: normalizeSegment, sumByType, continuousDriveSince,
//     lastDailyRestEnd, lastWeeklyRestEnd, preferDddSegments
//   - Główne: computeDriverCompliance(rawSegments, periodStart, now)
//             computeDriverPlan(compliance, now)

// ═══════════════════════════════════════════════════════════════════════════
// CONSTS
// ═══════════════════════════════════════════════════════════════════════════

// Wszystkie limity w minutach
export const REGULATION = {
  DAILY_DRIVE_REGULAR: 9 * 60,       // 9h dzienny regularny
  DAILY_DRIVE_EXTENDED: 10 * 60,     // 10h — max 2× w tygodniu
  EXTENDED_PER_WEEK: 2,
  CONTINUOUS_DRIVE: 4.5 * 60,        // 4h 30min bez przerwy → przerwa 45min
  BREAK_MIN: 45,                     // minimalna przerwa 45min
  BREAK_SPLIT_FIRST: 15,             // pierwsza część podzielonej
  BREAK_SPLIT_SECOND: 30,            // druga część
  WEEKLY_DRIVE: 56 * 60,             // 56h tygodniowo
  BIWEEKLY_DRIVE: 90 * 60,           // 90h w 2 kolejnych tygodniach
  DAILY_REST_REGULAR: 11 * 60,       // 11h regularny odpoczynek
  DAILY_REST_REDUCED: 9 * 60,        // 9h skrócony
  DAILY_REST_REDUCED_PER_WEEK: 3,    // max 3× między tygodniowymi
  DAILY_REST_SPLIT_FIRST: 3 * 60,    // 3h + 9h = podzielony
  DAILY_REST_SPLIT_SECOND: 9 * 60,
  WEEKLY_REST_REGULAR: 45 * 60,      // 45h regularny tygodniowy
  WEEKLY_REST_REDUCED: 24 * 60,      // 24h skrócony tygodniowy
  WEEKLY_REST_REDUCED_PER_2WEEKS: 2, // max 2× w 2 kolejne tygodnie
  MIN_WEEKLY_REST: 35 * 60,          // min 35h w każdym tygodniu
  WORK_TIME_WEEKLY_AVG: 48 * 60,     // średnio 48h/tydz w okresie rozlicz.
  RETURN_TO_BASE_DAYS: 28,           // Pakiet Mobilności: powrót co 28 dni
};

// Typy aktywności
export const ACTIVITY_TYPES = {
  drive: { label: "Jazda",          icon: "🚛", color: "#2563eb", bg: "#eff6ff" },
  work:  { label: "Inna praca",     icon: "🔧", color: "#f59e0b", bg: "#fffbeb" },
  avail: { label: "Dyspozycyjność", icon: "⏱",  color: "#64748b", bg: "#f8fafc" },
  rest:  { label: "Odpoczynek",     icon: "🛏",  color: "#22c55e", bg: "#f0fdf4" },
};

// ═══════════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function addMin(d, min) { return new Date(d.getTime() + min * 60000); }
export function minBetween(a, b) { return Math.max(0, Math.round((b - a) / 60000)); }

// Format liczby minut na "Xh Ymin" / "Ymin"
export function fmtMin(m) {
  if (m == null || !isFinite(m)) return "—";
  if (m < 0) m = 0;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (h === 0) return `${mm} min`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}min`;
}

// Format zgodny z mockupem — "0h 43min"
export function fmtHM(m) {
  if (m == null || !isFinite(m)) return "—";
  if (m < 0) m = 0;
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return `${h}h ${String(mm).padStart(2, "0")}min`;
}

// Format timestamp → "HH:MM" lub "jutro HH:MM" lub "dd.MM HH:MM"
export function fmtTimeShort(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (isToday) return hm;
  if (isTomorrow) return `jutro ${hm}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
}

// Konwertuj segment do obiektu z liczonymi polami
export function normalizeSegment(s, now) {
  const startTs = s.startTs || s.start;
  const endTs = s.endTs || s.end || (now ? now.toISOString() : null);
  const startMs = new Date(startTs).getTime();
  const endMs = new Date(endTs).getTime();
  return {
    ...s,
    startMs,
    endMs,
    durMin: Math.max(0, Math.round((endMs - startMs) / 60000)),
    type: s.type || "avail",
    isOpen: !s.endTs && !s.end,
  };
}

// Oblicz sumy aktywności w danym zakresie
export function sumByType(segments, fromMs, toMs) {
  const sums = { drive: 0, work: 0, avail: 0, rest: 0 };
  for (const s of segments) {
    const sMs = Math.max(s.startMs, fromMs);
    const eMs = Math.min(s.endMs, toMs);
    if (eMs <= sMs) continue;
    const min = Math.round((eMs - sMs) / 60000);
    sums[s.type] = (sums[s.type] || 0) + min;
  }
  return sums;
}

// Czas od ostatniej przerwy (min 45min odpoczynku lub 30min ciągłego rest/avail)
// Zwraca: minuty ciągłej jazdy od momentu ostatniej przerwy
export function continuousDriveSince(segments, now) {
  const nowMs = now.getTime();
  let cutoffMs = 0;
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.type === "rest" && s.durMin >= 45 && s.endMs <= nowMs) {
      cutoffMs = s.endMs;
      break;
    }
  }
  let total = 0;
  for (const s of segments) {
    if (s.type !== "drive") continue;
    const sMs = Math.max(s.startMs, cutoffMs);
    const eMs = Math.min(s.endMs, nowMs);
    if (eMs > sMs) total += Math.round((eMs - sMs) / 60000);
  }
  return total;
}

// Granica "doby kierowcy" — 24h cofa się od punktu obecnego lub od ostatniego 11h+ odpoczynku
export function lastDailyRestEnd(segments, now) {
  const nowMs = now.getTime();
  // Scal odpoczynki przed sprawdzeniem progu — tak jak funkcje tygodniowe
  // (lastWeeklyRest / lastActualWeeklyRestEnd). Odpoczynek dobowy przez północ jest
  // w danych DDD dzielony na dwa pod-segmenty <9h; bez koalescencji był pomijany, a
  // shift.start (i dzienne sumy) kotwiczyły na starszym odpoczynku — bug „skąd 14":
  // łapało wieczorny kawałek 07-13 (14:35→24:00, 565min) kończący się 00:00 UTC =
  // 14.07 02:00 PL, zamiast realnego 16.07 04:04 UTC.
  const coalesced = coalesceRestGaps(segments);
  for (let i = coalesced.length - 1; i >= 0; i--) {
    const s = coalesced[i];
    if (s.type === "rest" && s.durMin >= REGULATION.DAILY_REST_REDUCED && s.endMs <= nowMs) {
      return s.endMs;
    }
  }
  // fallback: cofnij 24h
  return nowMs - 24 * 3600000;
}

// Granica "tygodnia" — tydzień kalendarzowy wg 561/2006 art. 4(i):
// pn 00:00 → nd 24:00 (lokalny czas PL).
// segments zostaje w sygnaturze dla backward compat — nieużywane.
export function lastWeeklyRestEnd(segments, now) {
  const d = new Date(now.getTime());
  const day = d.getDay(); // 0=nd, 1=pn
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diffToMonday);
  return d.getTime();
}

// ── Priorytet źródeł: correction > DDD > ww_csv > manual > auto_gps ──
// Wyższy priorytet "wycina" niższy z tych samych przedziałów czasowych.
function _coverageFilter(segs) {
  const ranges = segs.map(s => [s.startMs, s.endMs]).sort((a, b) => a[0] - b[0]);
  return (s) => {
    const mid = (s.startMs + s.endMs) / 2;
    for (const [a, b] of ranges) if (mid >= a && mid < b) return true;
    return false;
  };
}

export function preferDddSegments(segments) {
  let result = segments;

  // Priorytet 0: KOREKTA — ręczna adnotacja admina (cyfrowy odpowiednik dopisku na
  // wydruku tachografu, np. "kierowca zostawił kartę w dyspozycyjności na bazie =
  // w rzeczywistości odpoczynek"). Segment source="correction" (zwykle type="rest")
  // wycina z pokrytego zakresu avail/rest ORAZ szum GPS (auto_gps/ww_csv "jazda"/
  // "praca" = dryf) — bo skoro tachograf zapisał w tym oknie dyspozycyjność, to GPS-owa
  // "jazda" jest fałszywa (ten sam szum, który DDD i tak tłumi). Przeżywa reupload DDD,
  // bo CF kasuje tylko source=="ddd" (functions/index.js).
  // SAFETY: korekta NIGDY nie wycina jazdy/pracy z TACHOGRAFU (source="ddd") — tacho-
  // prawda o prowadzeniu pojazdu jest nietykalna. Walidacja zapisu (App.jsx) i tak
  // blokuje zakres nachodzący na DDD drive/work, więc tu to obrona w głębi.
  const corr = result.filter(s => s.source === "correction");
  if (corr.length > 0) {
    const coveredByCorr = _coverageFilter(corr);
    result = result.filter(s =>
      s.source === "correction" ||
      (s.source === "ddd" && (s.type === "drive" || s.type === "work")) ||
      !coveredByCorr(s)
    );
  }

  // Priorytet 1: DDD wycina ww_csv, manual, auto_gps z pokrytych zakresów (NIE correction)
  const ddd = result.filter(s => s.source === "ddd");
  if (ddd.length > 0) {
    const coveredByDdd = _coverageFilter(ddd);
    result = result.filter(s => s.source === "ddd" || s.source === "correction" || !coveredByDdd(s));
  }

  // Priorytet 2: ww_csv wycina manual i auto_gps
  const ww = result.filter(s => s.source === "ww_csv");
  if (ww.length > 0) {
    const coveredByWw = _coverageFilter(ww);
    result = result.filter(s => {
      if (s.source === "ddd" || s.source === "correction" || s.source === "ww_csv") return true;
      return !coveredByWw(s);
    });
  }

  // Priorytet 3: manual wycina auto_gps
  const man = result.filter(s => s.source === "manual");
  if (man.length > 0) {
    const coveredByMan = _coverageFilter(man);
    result = result.filter(s => {
      if (s.source === "ddd" || s.source === "correction" || s.source === "ww_csv" || s.source === "manual") return true;
      return !coveredByMan(s);
    });
  }

  return result;
}

// Znajdź endMs ostatniego rzeczywistego weekly rest (≥45h ciągły) w lookback 14 dni.
//
// Kontekst (2026-05-11): używane do liczenia deadline kolejnego weekly rest wg
// 561/2006 art. 8.6 — "tygodniowy okres odpoczynku rozpoczyna się nie później
// niż po zakończeniu sześciu okresów 24-godzinnych od końca poprzedniego".
//
// Bez tego computeDriverPlan.weeklyRest hard-coduje deadline jako kalendarzową
// niedzielę 00:00 (bug #3+#4). Rzeczywisty deadline = lastActualEnd + 6×24h.
//
// Pre-coalesce: rest fragmenty oddzielone "ciszą" CSV są scalane (patrz
// coalesceRestGaps) — bez tego weekend Volodymyra (15h+gap+6h) nie kwalifikuje.
//
// Zwraca null jeśli brak rest≥45h w 14 dniach (nowy kierowca, brak danych) —
// caller (computeDriverPlan) powinien fallback na kalendarzową niedzielę.
export function lastActualWeeklyRestEnd(segments, now) {
  const nowMs = now.getTime();
  const lookbackMs = nowMs - 14 * 24 * 3600000;
  const coalesced = coalesceRestGaps(segments);
  let bestEndMs = null;
  for (const s of coalesced) {
    if (s.type !== "rest") continue;
    if (s.endMs < lookbackMs || s.endMs > nowMs) continue;
    if (s.durMin < REGULATION.WEEKLY_REST_REGULAR) continue; // 45h
    if (bestEndMs === null || s.endMs > bestEndMs) bestEndMs = s.endMs;
  }
  return bestEndMs;
}

// Ostatni tygodniowy odpoczynek DOWOLNEGO typu (≥24h) w lookback — wg 561/2006 art. 8.6
// deadline kolejnego tygodniowego liczy się od KAŻDEGO tygodniowego (regularnego ≥45h
// LUB skróconego 24-45h), nie tylko ≥45h. Zwraca też lastRegularEnd (ostatni ≥45h) i
// isReduced (czy ostatni był skrócony → następny musi być pełny ≥45h, reguła 2 tygodni).
// Zwraca {endMs, durMin, isReduced, lastRegularEnd} lub null. (opcja C, 2026-06-10)
export function lastWeeklyRest(segments, now, lookbackDays = 21) {
  const nowMs = now.getTime();
  const lookbackMs = nowMs - lookbackDays * 24 * 3600000;
  const coalesced = coalesceRestGaps(segments);
  let lastWk = null, lastRegEnd = null;
  for (const s of coalesced) {
    if (s.type !== "rest") continue;
    if (s.endMs < lookbackMs || s.endMs > nowMs) continue;
    if (s.durMin >= REGULATION.WEEKLY_REST_REDUCED) {        // ≥24h (regularny lub skrócony)
      if (!lastWk || s.endMs > lastWk.endMs) lastWk = { endMs: s.endMs, durMin: s.durMin };
    }
    if (s.durMin >= REGULATION.WEEKLY_REST_REGULAR) {        // ≥45h (regularny)
      if (lastRegEnd === null || s.endMs > lastRegEnd) lastRegEnd = s.endMs;
    }
  }
  if (!lastWk) return null;
  return {
    endMs: lastWk.endMs,
    durMin: lastWk.durMin,
    isReduced: lastWk.durMin < REGULATION.WEEKLY_REST_REGULAR,
    lastRegularEnd: lastRegEnd,
  };
}

// Sugerowana data powrotu do bazy wg tachografu (dla ręcznego pola tachoCardStart).
//
// Filozofia (user 2026-06-10): regularny 45h tygodniowy odpoczynek kierowca robi
// "w połowie pracy", w trasie. WYRAŹNIE dłuższy odpoczynek (domyślnie ≥56h) =
// kierowca był na bazie/w domu → naturalna kotwica 28-dniowego powrotu do bazy.
//
// Zwraca endMs (moment WYJAZDU z bazy — koniec długiego odpoczynku, spójne z
// semantyką tachoStart "kiedy wyjeżdża") + durMin ostatniego takiego odpoczynku,
// albo null. Pomija synthetic fillgap (cisza CSV ≠ pewny odpoczynek na bazie) —
// liczymy tylko realne segmenty (DDD/ww_csv/manual). To TYLKO sugestia: caller
// wstawia ją w pole, ale user zatwierdza ręcznie (tacho = świętość).
export function suggestBaseReturnFromRest(segments, now = new Date(), thresholdMin = 56 * 60, lookbackDays = 35) {
  const nowMs = now.getTime();
  const lookbackMs = nowMs - lookbackDays * 24 * 3600000;
  const real = [...segments]
    .filter(s => s.source !== "fillgap" && !s.synthetic)
    .sort((a, b) => a.startMs - b.startMs);
  const coalesced = coalesceRestGaps(real);
  let best = null;
  for (const s of coalesced) {
    if (s.type !== "rest") continue;
    if (s.endMs < lookbackMs || s.endMs > nowMs) continue;
    if (s.durMin < thresholdMin) continue;
    if (!best || s.endMs > best.endMs) best = { endMs: s.endMs, durMin: s.durMin };
  }
  return best;
}

// Wypełnij luki MIĘDZY znanymi segmentami synthetic rest ("fillgap").
//
// Kontekst (2026-05-11): user feedback — "szare pola w UI POWINNY być liczone
// jako przerwa, nie powinno być traktowane jako inne". Filozofia rozszerzona:
// CSV "milczy" gdy silnik OFF → samochód stoi → kierowca odpoczywa (benefit-of-doubt).
//
// Wpływ na metryki (wszystkie dostają już "wypełnione" segmenty):
// - sumByType: rest sums większe o łączny czas gap'ów; drive/work/avail bez zmian
// - lastDailyRestEnd: znajduje rest end tam gdzie wcześniej fallback (now-24h)
// - continuousDrive: synthetic rest ≥45min resetuje cutoff (kierowca miał przerwę)
// - weeklyRestCompensation: synthetic rest między 2 real rest → coalesce w 1 segment ≥45h
// - current state: bez wpływu (synthetic NIE jest current — ostatni real zostaje)
//
// Scope: wypełniamy TYLKO wewnętrzne gap'y (między 2 znanymi segmentami).
// NIE dorzucamy nic przed pierwszym (nieznana historia) ani po ostatnim (current).
// NIE wypełniamy gdy segmenty nakładają się (curr.endMs >= next.startMs).
//
// Synthetic segments oznaczone source="fillgap" + synthetic=true (audyt + UI badge).
export function fillGapsAsRest(segments) {
  if (segments.length < 2) return segments;
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    result.push(curr);
    const next = sorted[i + 1];
    if (!next) break;
    if (curr.endMs >= next.startMs) continue; // overlap lub touching → brak gap
    const gapStart = curr.endMs;
    const gapEnd = next.startMs;
    const gapDurMin = Math.round((gapEnd - gapStart) / 60000);
    if (gapDurMin <= 0) continue;
    result.push({
      startMs: gapStart,
      endMs: gapEnd,
      startTs: new Date(gapStart).toISOString(),
      endTs: new Date(gapEnd).toISOString(),
      durMin: gapDurMin,
      type: "rest",
      source: "fillgap",
      synthetic: true,
      isOpen: false,
    });
  }
  return result;
}

// Scal rest segmenty oddzielone "ciszą" (brak segmentu drive/work/avail pomiędzy).
//
// Kontekst (2026-05-11): CSV widziszwszystko nie raportuje fragmentów gdy silnik
// wyłączony. Skutek: weekend kierowcy (auto stoi 48h) widać jako 2-3 rest fragmenty
// rozdzielone ~24h gap'ami; żaden nie kwalifikuje się samodzielnie jako weekly rest
// (≥45h) → false alert "brak weekly rest" w computeDriverCompliance.
//
// Filozofia (spójna z mapWwPostojToType — postoje≥45min jako rest, fix 5bc3a66):
// gap między rest segmentami = kontynuacja rest dopóki brak sprzecznego dowodu.
// NIE scala przez drive/work (faktyczna przerwa rest) ani przez avail (formalnie
// przerywa rest wg 561/2006).
//
// Test case (Volodymyr WGM 0475M, weekend 9-11.05.2026):
//   Wejście: rest 15h13min (ww_csv) + gap 24h + rest 6h45min (auto_gps)
//   Wyjście: rest 45h58min (1 segment, coalesced=true) → kwalifikuje jako weekly rest.
export function coalesceRestGaps(segments) {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  const result = [];
  for (const s of sorted) {
    const last = result[result.length - 1];
    if (last && last.type === "rest" && s.type === "rest") {
      // Brak segmentu drive/work/avail pomiędzy → 1 ciągły rest
      last.endMs = Math.max(last.endMs, s.endMs);
      last.durMin = Math.max(0, Math.round((last.endMs - last.startMs) / 60000));
      last.coalesced = true;
      last.coalescedSources = [...(last.coalescedSources || [last.source]), s.source];
    } else {
      result.push({ ...s });
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// TACHOGRAF VIEW HELPERS (Webfleet style)
// ═══════════════════════════════════════════════════════════════════════════

// Najpóźniejszy moment zakończenia bieżącej zmiany (Pakiet Mobilności).
// Okres 24h od końca poprzedniego odpoczynku = shift + dailyRest.
// - Z 9h skróconym odpoczynkiem: shift max 15h (kierowca ma reduced rest dostępne, max 3x/tyg)
// - Z 11h regularnym odpoczynkiem: shift max 13h
// canReduceDailyRest = czy kierowca jeszcze ma dostępne skrócenia dziennego odpoczynku
export function shiftLatestEndMs(shiftStartMs, canReduceDailyRest = true) {
  const shiftHours = canReduceDailyRest ? 15 : 13;
  return shiftStartMs + shiftHours * 3600000;
}

// Najwcześniejszy moment rozpoczęcia kolejnej zmiany.
// - Z 9h skróconym odpoczynkiem (jeśli dostępny)
// - Z 11h regularnym odpoczynkiem (jeśli wykorzystane wszystkie 3 skrócenia)
export function nextShiftEarliestStartMs(shiftEndMs, canReduceDailyRest = true) {
  const restMin = canReduceDailyRest ? REGULATION.DAILY_REST_REDUCED : REGULATION.DAILY_REST_REGULAR;
  return shiftEndMs + restMin * 60000;
}

// Limit jazdy w bieżącym tygodniu uwzględniający 90h biweekly cap (art. 6 ust. 2 561/2006).
// = min(WEEKLY_DRIVE, BIWEEKLY_DRIVE - drive_w_poprzednim_tygodniu)
export function effectiveWeeklyDriveLimit(segments, weekStartMs) {
  const prevWeekStart = weekStartMs - 7 * 24 * 3600000;
  const prevWeekSums = sumByType(segments, prevWeekStart, weekStartMs);
  const remaining = REGULATION.BIWEEKLY_DRIVE - prevWeekSums.drive;
  return Math.min(REGULATION.WEEKLY_DRIVE, Math.max(0, remaining));
}

// Poniedziałek 00:00 (lokalnie) tygodnia zawierającego dany ms — tydzień wg 561/2006
// art. 4(i): pn 00:00 → nd 24:00. Klucz grupowania tygodniowych odpoczynków.
function _mondayOf(ms) {
  const d = new Date(ms);
  const dow = (d.getDay() + 6) % 7; // 0=poniedziałek … 6=niedziela
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

// Wyrównanie za skrócone tygodniowe odpoczynki (Pakiet Mobilności, art. 8 ust. 6).
// Kierowca może skrócić tygodniowy odpoczynek do 24h (zamiast 45h regularnego).
// Brakujące godziny (45h - actual) muszą być wyrównane w ciągu 3 kolejnych
// tygodni — przez dłuższy odpoczynek tygodniowy (>45h) lub dzienny.
// Algorytm FIFO: najstarsze skrócenie najpierw kompensowane przez nadmiar.
export function weeklyRestCompensation(segments, nowMs) {
  // Pre-coalesce: scal rest fragmenty oddzielone "ciszą" CSV (silnik OFF) —
  // bez tego weekend kierowcy bywa rozbity na 2-3 sub-24h fragmenty i żaden
  // nie kwalifikuje się jako weekly rest. Patrz coalesceRestGaps.
  const coalesced = coalesceRestGaps(segments);
  const lookbackMs = nowMs - 4 * 7 * 24 * 3600000; // 4 tygodnie wstecz
  // Rest segments ≥ 24h kwalifikują się jako tygodniowy (mniejsze = dzienne).
  const restsBig = coalesced.filter(s =>
    s.type === "rest" &&
    s.endMs >= lookbackMs &&
    s.endMs <= nowMs &&
    s.durMin >= 24 * 60
  );
  // FIX (bug zawyżania, 2026-06-12): JEDEN tygodniowy odpoczynek na tydzień
  // kalendarzowy (pn–nd). Wcześniej KAŻDY rest ≥24h liczył się jako osobny
  // tygodniowy → dwa długie odpoczynki w jednym tygodniu = podwójny dług
  // (niemożliwe wg 561/2006: jeden tygodniowy/tydzień). Reguła: tygodniowy danego
  // tygodnia = NAJDŁUŻSZY rest ≥24h przypisany do tygodnia wg startu odpoczynku.
  const byWeek = new Map();
  for (const s of restsBig) {
    const wk = _mondayOf(s.startMs);
    const cur = byWeek.get(wk);
    if (!cur || s.durMin > cur.durMin) byWeek.set(wk, s);
  }
  const weeklyRests = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);

  const targetMin = 45 * 60; // 2700 min = 45h regularny tygodniowy
  let owedMin = 0;
  let oldestShortenedEnd = null;

  weeklyRests.forEach(s => {
    if (s.durMin < targetMin) {
      // Skrócony — dodaj do brakujących
      owedMin += targetMin - s.durMin;
      if (oldestShortenedEnd === null) oldestShortenedEnd = s.endMs;
    } else if (s.durMin > targetMin) {
      // Wydłużony powyżej 45h — kompensuje brakujące (FIFO)
      const extraMin = s.durMin - targetMin;
      const used = Math.min(extraMin, owedMin);
      owedMin -= used;
      if (owedMin === 0) oldestShortenedEnd = null;
    }
  });

  return {
    owedMin,
    deadlineMs: oldestShortenedEnd ? oldestShortenedEnd + 3 * 7 * 24 * 3600000 : null,
  };
}

// Liczba zmniejszonych odpoczynków dziennych (≥9h, <11h) w bieżącym tygodniu.
// Limit: max 3 między dwoma odpoczynkami tygodniowymi (art. 8 ust. 4).
export function reducedDailyRestsThisWeek(segments, weekStartMs, nowMs) {
  return segments.filter(s =>
    s.type === "rest" &&
    s.durMin >= REGULATION.DAILY_REST_REDUCED &&
    s.durMin < REGULATION.DAILY_REST_REGULAR &&
    s.startMs >= weekStartMs &&
    s.startMs < nowMs
  ).length;
}

// Liczba "wydłużonych" dni jazdy (>9h, ≤10h) w bieżącym tygodniu.
// Limit: max 2 razy w tygodniu (art. 6 ust. 1).
export function extendedDailyDrivesThisWeek(segments, weekStartMs, nowMs) {
  let count = 0;
  const dayMs = 24 * 3600000;
  for (let t = weekStartMs; t < nowMs; t += dayMs) {
    const dSums = sumByType(segments, t, Math.min(t + dayMs, nowMs));
    if (dSums.drive > 9 * 60) count++;
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// GŁÓWNE FUNKCJE: computeDriverCompliance + computeDriverPlan
// ═══════════════════════════════════════════════════════════════════════════

// segments: tablica surowych segmentów {startTs, endTs, type, ...}
// periodStart: ISO date stringu startu 28-dniowego okresu
// now: Date (aktualny moment)
// Zwraca obiekt z limitami + planem do przodu
export function computeDriverCompliance(rawSegments = [], periodStart = null, now = new Date()) {
  const allSegments = rawSegments
    .map(s => normalizeSegment(s, now))
    .sort((a, b) => a.startMs - b.startMs);
  // Priorytet DDD — odfiltrowujemy GPS/manual tam gdzie mamy tachograf
  const filteredByPriority = preferDddSegments(allSegments);
  // Wypełnij wewnętrzne gap'y synthetic rest (user feedback 2026-05-11:
  // szare pola w UI = przerwa, benefit-of-doubt kierowcy). Patrz fillGapsAsRest.
  const segments = fillGapsAsRest(filteredByPriority);

  const nowMs = now.getTime();
  const current = segments[segments.length - 1] || null;

  // Zakres "doby kierowcy" — od ostatniego odpoczynku dziennego
  const dayStart = lastDailyRestEnd(segments, now);
  const daySums = sumByType(segments, dayStart, nowMs);

  // Zakres tygodniowy — tydzień kalendarzowy 561/2006 art. 4(i): pn 00:00 → nd 24:00
  const weekStart = lastWeeklyRestEnd(segments, now);
  const weekSums = sumByType(segments, weekStart, nowMs);

  // Dwutygodniowy — 2 kolejne tygodnie kalendarzowe (Pakiet Mobilności art. 6.3):
  // poprzedni poniedziałek 00:00 → teraz. setDate cofa o 7 dni bezpiecznie na DST.
  const biweekStart = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d.getTime();
  })();
  const biweekSums = sumByType(segments, biweekStart, nowMs);

  // Jazda ciągła od ostatniej przerwy
  const continuousDrive = continuousDriveSince(segments, now);

  // 28-dniowy okres od periodStart
  const period28 = (() => {
    if (!periodStart) return null;
    const startMs = new Date(periodStart).getTime();
    if (!isFinite(startMs)) return null;
    const deadlineMs = startMs + REGULATION.RETURN_TO_BASE_DAYS * 24 * 3600000;
    const daysPassed = Math.floor((nowMs - startMs) / (24 * 3600000));
    const daysLeft = Math.max(0, REGULATION.RETURN_TO_BASE_DAYS - daysPassed);
    return { startMs, deadlineMs, daysPassed, daysLeft };
  })();

  // Liczba użytych 10h dni w bieżącym tygodniu (jazda >= 9h 01min)
  let extendedDaysUsed = 0;
  {
    const dayMs = 24 * 3600000;
    for (let t = weekStart; t < nowMs; t += dayMs) {
      const dSums = sumByType(segments, t, Math.min(t + dayMs, nowMs));
      if (dSums.drive > 9 * 60) extendedDaysUsed++;
    }
  }

  // Czas pracy w tym tygodniu (drive + work) dla średniej 48h
  const weekWorkTime = weekSums.drive + weekSums.work;

  // Stan aktualny
  const currentStateType = current?.isOpen ? current.type : null;

  // Statystyki źródeł danych
  const sourceStats = allSegments.reduce((acc, s) => {
    acc[s.source || "unknown"] = (acc[s.source || "unknown"] || 0) + 1;
    return acc;
  }, {});
  const hasDdd = (sourceStats.ddd || 0) > 0;

  return {
    now: nowMs,
    segments,
    current,
    currentStateType,
    continuousDrive,
    daily: {
      drive: daySums.drive,
      work: daySums.work,
      avail: daySums.avail,
      rest: daySums.rest,
      limit: REGULATION.DAILY_DRIVE_REGULAR,
      limitExtended: REGULATION.DAILY_DRIVE_EXTENDED,
      extendedDaysUsed,
      extendedDaysAllowed: REGULATION.EXTENDED_PER_WEEK,
      start: dayStart,
    },
    // NEW: zmiana (Pakiet Mobilności — okres pracy max 13h regularny / 15h ze skróconym odpoczynkiem)
    shift: (() => {
      const reducedRestsUsed = reducedDailyRestsThisWeek(segments, weekStart, nowMs);
      const canReduce = reducedRestsUsed < REGULATION.DAILY_REST_REDUCED_PER_WEEK;
      const latestEndMs = shiftLatestEndMs(dayStart, canReduce);
      return {
        startMs: dayStart,
        latestEndMs,
        nextStartMs: nextShiftEarliestStartMs(latestEndMs, canReduce),
        canReduce,
        shiftHours: canReduce ? 15 : 13,
        nextRestHours: canReduce ? 9 : 11,
      };
    })(),
    weekly: {
      drive: weekSums.drive,
      work: weekSums.work,
      workTime: weekWorkTime,
      limit: REGULATION.WEEKLY_DRIVE,
      limitWorkTime: REGULATION.WORK_TIME_WEEKLY_AVG,
      start: weekStart,
      // NEW: efektywny limit z biweekly cap + countery dni
      effectiveDriveLimit: effectiveWeeklyDriveLimit(segments, weekStart),
      reducedDailyRests: reducedDailyRestsThisWeek(segments, weekStart, nowMs),
      reducedDailyRestsAllowed: REGULATION.DAILY_REST_REDUCED_PER_WEEK,
      extendedDailyDrives: extendedDailyDrivesThisWeek(segments, weekStart, nowMs),
      extendedDailyDrivesAllowed: REGULATION.EXTENDED_PER_WEEK,
    },
    biweekly: {
      drive: biweekSums.drive,
      limit: REGULATION.BIWEEKLY_DRIVE,
      start: biweekStart,
    },
    weeklyRestComp: weeklyRestCompensation(segments, nowMs),
    // NEW (fix #3+#4): endMs ostatniego rzeczywistego weekly rest (≥45h) w lookback 14d.
    // Używane przez computeDriverPlan do liczenia deadline kolejnego weekly rest
    // wg 561/2006 art. 8.6 (zamiast hard-coded niedziela kalendarzowa). null = fallback.
    lastActualWeeklyRestEnd: lastActualWeeklyRestEnd(segments, now),
    // NEW (2026-06-10, opcja C): pełna reguła tygodniowego. lastEnd = ostatni ≥24h
    // (kotwica deadline 6×24h), lastRegularEnd = ostatni ≥45h, nextMustBeRegular =
    // true gdy ostatni tygodniowy był skrócony (→ następny musi być pełny ≥45h).
    weeklyRestStatus: (() => {
      const lw = lastWeeklyRest(segments, now);
      return {
        lastEnd: lw?.endMs ?? null,
        lastDurMin: lw?.durMin ?? null,
        lastWasReduced: lw?.isReduced ?? false,
        lastRegularEnd: lw?.lastRegularEnd ?? null,
        nextMustBeRegular: lw ? lw.isReduced : false,
      };
    })(),
    period28,
    sources: sourceStats,
    hasDdd,
  };
}

// ── PLAN DO PRZODU — co i kiedy powinno się wydarzyć ──
export function computeDriverPlan(compliance, now = new Date()) {
  if (!compliance) return null;
  const nowMs = now.getTime();

  // 1. Następna obligatoryjna przerwa 45 min — gdy jazda ciągła osiągnie 4h 30min
  const driveToBreak = Math.max(0, REGULATION.CONTINUOUS_DRIVE - compliance.continuousDrive);
  const nextBreakMs = nowMs + driveToBreak * 60000;
  const breakEndMs = nextBreakMs + REGULATION.BREAK_MIN * 60000;

  // 2. Koniec jazdy dziennej — gdy osiągniemy limit 9h (lub 10h jeśli dozwolone)
  const canExtend = compliance.daily.extendedDaysUsed < compliance.daily.extendedDaysAllowed;
  const dailyLimit = canExtend ? compliance.daily.limitExtended : compliance.daily.limit;
  const driveToDailyEnd = Math.max(0, dailyLimit - compliance.daily.drive);
  // Uwzględnij pośrednią przerwę (jeśli jazda > 4.5h, dodaj 45min)
  const willNeedBreak = driveToDailyEnd > driveToBreak;
  const endOfDayMs = nowMs + driveToDailyEnd * 60000 + (willNeedBreak ? REGULATION.BREAK_MIN * 60000 : 0);

  // 3. Odpoczynek dzienny 11h (lub 9h jeśli skrócony)
  const dailyRestEndMs = endOfDayMs + REGULATION.DAILY_REST_REGULAR * 60000;

  // 4. Odpoczynek tygodniowy — wg 561/2006 art. 8.6:
  // "Tygodniowy okres odpoczynku rozpoczyna się nie później niż po zakończeniu
  // sześciu okresów 24-godzinnych od końca poprzedniego tygodniowego okresu odpoczynku."
  // KLUCZOWE (opcja C, 2026-06-10): poprzedni tygodniowy to KAŻDY ≥24h (regularny LUB
  // skrócony), nie tylko ≥45h. Deadline = weeklyRestStatus.lastEnd + 6×24h.
  // mustBeRegular = ostatni był skrócony → następny musi być pełny ≥45h (reguła 2 tyg.).
  // Fallback (brak tygodniowego w lookback — nowy kierowca / brak danych): kalendarzowo.
  const wrStatus = compliance.weeklyRestStatus || {};
  const weeklyAnchorMs = wrStatus.lastEnd ?? compliance.lastActualWeeklyRestEnd;
  let weeklyRestStartMs;
  if (weeklyAnchorMs) {
    weeklyRestStartMs = weeklyAnchorMs + 6 * 24 * 3600000;
  } else {
    const weekStartDate = new Date(compliance.weekly.start);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(0, 0, 0, 0);
    weeklyRestStartMs = weekEndDate.getTime();
  }
  const weeklyRestEndMs = weeklyRestStartMs + REGULATION.WEEKLY_REST_REGULAR * 60000;

  // 5. Powrót do bazy
  const returnToBase = compliance.period28 ? {
    deadlineMs: compliance.period28.deadlineMs,
    daysLeft: compliance.period28.daysLeft,
  } : null;

  return {
    nextBreak: {
      driveMinToGo: driveToBreak,
      atMs: nextBreakMs,
      endMs: breakEndMs,
      durationMin: REGULATION.BREAK_MIN,
    },
    endOfDay: {
      driveMinToGo: driveToDailyEnd,
      atMs: endOfDayMs,
      extendedAllowed: canExtend,
      dailyLimit,
    },
    dailyRest: {
      startMs: endOfDayMs,
      endMs: dailyRestEndMs,
      durationMin: REGULATION.DAILY_REST_REGULAR,
    },
    weeklyRest: {
      startMs: weeklyRestStartMs,
      endMs: weeklyRestEndMs,
      durationMin: REGULATION.WEEKLY_REST_REGULAR,
      mustBeRegular: wrStatus.nextMustBeRegular || false,
      lastRegularEnd: wrStatus.lastRegularEnd ?? null,
      lastWasReduced: wrStatus.lastWasReduced || false,
      lastDurMin: wrStatus.lastDurMin ?? null,
    },
    returnToBase,
  };
}
