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
  work:  { label: "Inna praca",     icon: "🔧", color: "#b45309", bg: "#fffbeb" },
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
//
// FIX (2026-10-21, case WGM 0507M / Volodymyr Lukashchuk — pytanie Agnieszki):
// wcześniej brany był po prostu OSTATNI rest ≥24h w lookback, bez pytania, do którego
// tygodnia należy. Volodymyr zrobił regularny 45h06 (pt 16.10 12:15 → nd 18.10 09:21),
// ruszył, przejechał ~6h i stanął jeszcze na 26h15 (nd 18.10 15:17 → pn 19.10 17:32)
// czekając na załadunek. Ten postój to NIE kolejny tygodniowy — zaczyna się w tym samym
// tygodniu kalendarzowym (pn 12.10), który swój tygodniowy już miał. Stary kod brał go
// za kotwicę, więc:
//   • deadline kolejnego tygodniowego wychodził nd 25.10 16:32 zamiast sb 24.10 09:21
//     (31h fałszywego luzu — dyspozytor planuje jazdę po terminie = mandat),
//   • nextMustBeRegular robiło się true („ostatni był skrócony 26h15"), choć ostatni
//     tygodniowy był pełny 45h06 — co przeczyło liście pauz na TYM SAMYM ekranie.
// Teraz kotwica idzie z `_weeklyRestsByWeek` — tego samego źródła prawdy, co lista
// dyspozytora i wyrównanie. Jeden tygodniowy na tydzień kalendarzowy (najdłuższy rest
// ≥24h, przypisany wg startu), więc postój po odbytym tygodniowym nie udaje kolejnego.
export function lastWeeklyRest(segments, now, lookbackDays = 21) {
  const nowMs = now.getTime();
  const lookbackMs = nowMs - lookbackDays * 24 * 3600000;
  const { byWeek } = _weeklyRestsByWeek(segments, nowMs);

  // Kandydaci = tygodniowe wybrane per tydzień kalendarzowy, przycięte do lookbacku
  // wywołującego (_weeklyRestsByWeek ma własne okno 4 tygodni, zwykle szersze).
  const wk = [...byWeek.values()]
    .filter(s => s.endMs >= lookbackMs && s.endMs <= nowMs)
    .sort((a, b) => a.endMs - b.endMs);
  if (!wk.length) return null;

  const lastWk = wk[wk.length - 1];
  const regular = wk.filter(s => s.durMin >= REGULATION.WEEKLY_REST_REGULAR);
  // Gdy ostatni kandydat pochodzi z TRWAJĄCEGO tygodnia, nie wolno ogłaszać, że
  // „ostatni tygodniowy był skrócony" — tydzień się nie skończył i dłuższy odpoczynek
  // może dopiero nadejść (zgłoszenie Agnieszki, 2026-10-23). `endMs` zostawiamy jako
  // kotwicę terminu 6×24h: to ostatni faktyczny odpoczynek ≥24h i liczenie od niego
  // jest ostrożniejsze niż cofanie się do poprzedniego tygodnia.
  const wToku = _mondayOf(lastWk.startMs) === _mondayOf(nowMs);
  return {
    endMs: lastWk.endMs,
    durMin: lastWk.durMin,
    isReduced: wToku ? false : lastWk.durMin < REGULATION.WEEKLY_REST_REGULAR,
    wToku,
    lastRegularEnd: regular.length ? regular[regular.length - 1].endMs : null,
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

// Tygodniowe odpoczynki w oknie 4 tygodni — JEDNO źródło prawdy dla wyrównania
// (weeklyRestCompensation) i dla listy pokazywanej dyspozytorowi (weeklyRestList).
// Wydzielone 2026-10-14: wcześniej logika żyła tylko wewnątrz weeklyRestCompensation,
// więc każdy drugi odczyt tych samych odpoczynków groziłby rozjazdem z kartą compliance.
function _weeklyRestsByWeek(segments, nowMs, lookbackWeeks = 4) {
  // Pre-coalesce: scal rest fragmenty oddzielone "ciszą" CSV (silnik OFF) —
  // bez tego weekend kierowcy bywa rozbity na 2-3 sub-24h fragmenty i żaden
  // nie kwalifikuje się jako weekly rest. Patrz coalesceRestGaps.
  //
  // lookbackWeeks domyślnie 4 — tyle widzi lista dyspozytora i wyrównanie. Reguły
  // z `weeklyRestRules` potrzebują szerszego okna, bo okno odstępstwa (art. 8 ust. 6
  // akapit 3) to 4 tygodnie LICZONE OD PARY SKRÓCONYCH, więc żeby ocenić parę z
  // początku widoku trzeba widzieć kilka tygodni przed nią.
  const coalesced = coalesceRestGaps(segments);
  const lookbackMs = nowMs - lookbackWeeks * 7 * 24 * 3600000;
  const inWindow = s => s.endMs >= lookbackMs && s.endMs <= nowMs;

  // Rest segments ≥ 24h kwalifikują się jako tygodniowy (mniejsze = dzienne).
  const restsBig = coalesced.filter(s => s.type === "rest" && inWindow(s) && s.durMin >= 24 * 60);
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
  // ⚠️ TYDZIEŃ W TOKU NIE JEST ROZSTRZYGNIĘTY (2026-10-23, zgłoszenie Agnieszki).
  // „Najdłuższy odpoczynek ≥24h w tygodniu" ma sens dopiero, gdy tydzień się skończył.
  // W trwającym tygodniu najdłuższy dotychczasowy odpoczynek bywa czymś zupełnie innym
  // niż tygodniowy — u Mirka blok 24h41 był dobowym z doczepioną rekompensatą, a prawdziwą
  // tygodniówkę zaczynał dopiero tego dnia. Panel ogłosił z tego „skrócony tygodniowy",
  // dorobił parę dwóch skróconych pod rząd i dług 30h41 — wszystko nieistniejące.
  // Dlatego bieżący tydzień WOLNO pokazać, ale NIE WOLNO z niego wyciągać werdyktów.
  const biezacyTydzienMs = _mondayOf(nowMs);
  return { coalesced, inWindow, byWeek, biezacyTydzienMs };
}

// Lista tygodniowych odpoczynków dla dyspozytora: same długości, od najstarszego.
// Prośba Agnieszki (14.10.2026): "zapisywało godziny tygodniowej pauzy, np. 1 pauza 30h,
// 2 pauza 28 — nie potrzeba dat". Dlatego zwracamy durMin + flagę skrócenia i nic więcej
// poza startMs, który służy wyłącznie do stabilnego sortowania i kluczy Reacta.
export function weeklyRestList(segments, nowMs) {
  const { byWeek, biezacyTydzienMs } = _weeklyRestsByWeek(segments, nowMs);
  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wk, s]) => {
      const wToku = wk === biezacyTydzienMs;
      return {
        weekStartMs: wk,
        startMs: s.startMs,
        durMin: s.durMin,
        // W trwającym tygodniu nie przesądzamy o skróceniu — dłuższy odpoczynek
        // może dopiero nadejść. UI ma to pokazać jako „w toku", nie jako skrócony.
        isReduced: wToku ? false : s.durMin < REGULATION.WEEKLY_REST_REGULAR, // < 45h
        wToku,
      };
    });
}

// ── REGUŁY SKRÓCONYCH TYGODNIOWYCH (art. 8 ust. 6 i 6b) ──────────────────────
//
// Dodane 2026-10-22 na prośbę usera po pytaniu Agnieszki. Do tej pory panel liczył
// WYŁĄCZNIE dług wyrównania i deadline 6×24h — stała `WEEKLY_REST_REDUCED_PER_2WEEKS`
// leżała w `REGULATION` nieużywana, więc dyspozytor nie dostawał żadnego ostrzeżenia
// o dwóch skróconych pod rząd ani o obowiązku z ust. 6b akapit 2.
//
// Numeracja sprawdzona 22.10.2026 w tekście skonsolidowanym na EUR-Lex
// (CELEX:02006R0561-20200820):
//   • ust. 6 akapit 1 — w 2 kolejnych tygodniach: 2 regularne ALBO 1 regularny
//     + 1 skrócony ≥24h. Dwa skrócone pod rząd łamią tę regułę...
//   • ust. 6 akapit 3 — ...CHYBA że zadziała odstępstwo: międzynarodowy przewóz
//     RZECZY, oba skrócone rozpoczęte poza państwem siedziby i poza państwem
//     zamieszkania kierowcy (akapit 4), a w 4 kolejnych tygodniach ≥4 tygodniowe,
//     z czego ≥2 regularne.
//   • ust. 6b akapit 2 — po dwóch kolejnych skróconych wg akapitu 3 NASTĘPNY
//     tygodniowy musi być POPRZEDZONY odpoczynkiem-rekompensatą za OBA skrócenia.
//
// ⚠️ CZEGO TA FUNKCJA NIE ROZSTRZYGA, i to świadomie:
//   1. Czy odstępstwo w ogóle przysługuje — wymaga wiedzy, gdzie kierowca ROZPOCZĄŁ
//      oba skrócone (poza PL i poza krajem zamieszkania). Kraju nie ma w DDD; dałoby
//      się go wyciągnąć z `countryKmDaily`, ale to okno ~41 dni i osobne źródło.
//      Zwracamy fakty, UI pyta człowieka.
//   2. Które z okien 4 tygodni jest „tym" oknem. Przepis mówi „w ciągu kolejnych
//      czterech tygodni", nie wskazując kotwicy. Dla pary skróconych istnieją 3 okna
//      ją zawierające i u Volodymyra dają różne wyniki (1 albo 2 regularne), więc
//      ogłaszanie jednego wyniku jako „naruszenie" byłoby zmyślaniem wykładni.
//      Zwracamy WSZYSTKIE okna + minimum, decyzja należy do człowieka.
// Dlatego pola nazywają się `...Info` / `minRegularIn4wk`, a nie `violation`.
export function weeklyRestRules(segments, nowMs, { lookbackWeeks = 12, reportWeeks = 5 } = {}) {
  const { byWeek, biezacyTydzienMs } = _weeklyRestsByWeek(segments, nowMs, lookbackWeeks);
  const coalesced = coalesceRestGaps(segments);
  const target = REGULATION.WEEKLY_REST_REGULAR;

  // Kolejny poniedziałek przez setDate, NIE przez +7×24h — doba zmiany czasu ma
  // 23 lub 25 godzin, a zmiana wypada 25.10.2026, czyli dokładnie teraz.
  const nextMonday = (ms) => { const d = new Date(ms); d.setDate(d.getDate() + 7); return d.getTime(); };

  // `wToku` = tydzień jeszcze trwa, więc jego najdłuższy odpoczynek NIE jest jeszcze
  // tygodniowym. Taki tydzień pokazujemy, ale nie bierze udziału w żadnym werdykcie:
  // nie tworzy pary skróconych, nie wymusza „następny musi być regularny" i nie liczy
  // się jako pewny element okna 4 tygodni. Patrz komentarz w `_weeklyRestsByWeek`.
  const weeks = [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([wk, s]) => {
    const wToku = wk === biezacyTydzienMs;
    return {
      weekStartMs: wk, startMs: s.startMs, endMs: s.endMs, durMin: s.durMin,
      isReduced: wToku ? false : s.durMin < target,
      wToku,
    };
  });
  // Tygodnie zamknięte — tylko z nich wolno orzekać.
  const zamkniete = weeks.filter(w => !w.wToku);
  // Kształt MUSI być identyczny jak w zwrotce na końcu — UI czyta olderPairsCount
  // wprost. Brak tego pola wyszedł w kontrakcie dla kierowcy z jednym segmentem.
  if (!weeks.length) return { weeks: [], pairs: [], olderPairsCount: 0, nextMustBeRegular: false,
                              biezacyTydzienMs, tydzienWToku: false };

  // Ciągła lista tygodni kalendarzowych — tydzień BEZ odpoczynku ≥24h też się liczy
  // (jako zero tygodniowych w oknie), więc nie można iterować po samej tablicy `weeks`.
  const calendar = [];
  for (let w = weeks[0].weekStartMs, guard = 0; w <= _mondayOf(nowMs) && guard < 60; w = nextMonday(w), guard++) {
    calendar.push(w);
  }
  const restOfWeek = new Map(weeks.map(w => [w.weekStartMs, w]));

  // Okno jest WIARYGODNE tylko wtedy, gdy wszystkie 4 tygodnie leżą w danych, a nie
  // wystają przed początek lookbacku. Bez tego para z początku okna dostawała okna
  // obcięte i „0 regularnych" było artefaktem zasięgu, nie stanem faktycznym —
  // dokładnie to wyszło przy pierwszym przebiegu na wszystkich 5 kierowcach.
  const firstKnownWeek = calendar[0];
  const windowStats = (startWeekMs) => {
    const i = calendar.indexOf(startWeekMs);
    if (i < 0) return null;
    const win = calendar.slice(i, i + 4);
    if (win.length < 4) return null;
    const rests = win.map(w => restOfWeek.get(w)).filter(Boolean);
    return {
      fromWeekMs: win[0], toWeekMs: win[3],
      restCount: rests.length,
      regularCount: rests.filter(r => !r.isReduced).length,
      // true gdy okno zaczyna się na pierwszym znanym tygodniu — dane mogą być ucięte
      truncated: win[0] === firstKnownWeek,
      // true gdy okno obejmuje tydzień, który jeszcze trwa — jego odpoczynek może
      // się jeszcze wydłużyć, więc liczba regularnych w tym oknie nie jest ostateczna
      unfinished: win.includes(biezacyTydzienMs),
    };
  };

  const pairs = [];
  for (let i = 1; i < zamkniete.length; i++) {
    const a = zamkniete[i - 1], b = zamkniete[i];
    if (b.weekStartMs !== nextMonday(a.weekStartMs)) continue; // nie sąsiednie tygodnie
    if (!a.isReduced || !b.isReduced) continue;

    const owedTotalMin = (target - a.durMin) + (target - b.durMin);

    // 3 okna 4-tygodniowe zawierające oba tygodnie pary: start w a-2, a-1, a
    const windows = [];
    let cursor = a.weekStartMs;
    for (let back = 0; back < 3; back++) {
      const st = windowStats(cursor);
      if (st) windows.unshift(st);
      const idx = calendar.indexOf(cursor);
      if (idx <= 0) break;
      cursor = calendar[idx - 1];
    }
    const solid = windows.filter(w => !w.truncated && !w.unfinished);
    const minRegularIn4wk = solid.length ? Math.min(...solid.map(w => w.regularCount)) : null;
    const maxRegularIn4wk = solid.length ? Math.max(...solid.map(w => w.regularCount)) : null;

    // ust. 6b akapit 2 — rekompensata za OBA skrócenia musi poprzedzać następny tygodniowy
    // Tylko tydzień ZAMKNIĘTY może być „następnym tygodniowym". Gdyby brać tydzień
    // w toku, orzekalibyśmy o obowiązku z ust. 6b akapit 2 na podstawie odpoczynku,
    // który jeszcze nie jest tygodniowym — a obowiązek jest wtedy po prostu OTWARTY.
    const next = zamkniete.find(w => w.weekStartMs > b.weekStartMs) || null;
    const carrier = coalesced.find(s =>
      s.type === "rest" &&
      s.startMs >= b.endMs &&
      (!next || s.endMs <= next.startMs) &&
      s.durMin >= REGULATION.DAILY_REST_REDUCED &&
      (s.durMin - REGULATION.DAILY_REST_REGULAR) >= owedTotalMin
    ) || null;

    pairs.push({
      firstWeekMs: a.weekStartMs, secondWeekMs: b.weekStartMs,
      firstDurMin: a.durMin, secondDurMin: b.durMin,
      owedTotalMin,
      windows, minRegularIn4wk, maxRegularIn4wk,
      nextWeeklyStartMs: next ? next.startMs : null,
      // null = następnego tygodniowego jeszcze nie było, więc obowiązek jest OTWARTY,
      // a nie naruszony. UI musi te dwa stany rozróżniać.
      compensationBeforeNext: next ? Boolean(carrier) : null,
      carrierStartMs: carrier ? carrier.startMs : null,
    });
  }

  // Pokazujemy tylko pary z horyzontu, który dyspozytor i tak widzi na liście pauz.
  // Para z sierpnia jest historią, na którą nikt już nic nie poradzi, a zaśmieca kartę.
  const reportFromMs = nowMs - reportWeeks * 7 * 24 * 3600000;
  const recent = pairs.filter(p => p.secondWeekMs >= _mondayOf(reportFromMs));

  // „Następny musi być regularny" wynika z OSTATNIEGO ZAMKNIĘTEGO tygodnia. Tydzień
  // w toku nie przesądza niczego — jego odpoczynek może jeszcze urosnąć do regularnego.
  const last = zamkniete[zamkniete.length - 1];
  return {
    weeks,
    pairs: recent,
    olderPairsCount: pairs.length - recent.length,
    nextMustBeRegular: Boolean(last && last.isReduced),
    // Tydzień, który jeszcze trwa — UI mówi wprost, że ocena jest niepełna.
    biezacyTydzienMs,
    tydzienWToku: weeks.some(w => w.wToku),
  };
}

// Wyrównanie za skrócone tygodniowe odpoczynki (Pakiet Mobilności, art. 8 ust. 6).
// Kierowca może skrócić tygodniowy odpoczynek do 24h (zamiast 45h regularnego).
// Brakujące godziny (45h - actual) muszą być wyrównane przed końcem trzeciego
// tygodnia następującego po danym tygodniu (art. 8 ust. 6), a samo wyrównanie
// wykorzystuje się JEDNORAZOWO (en bloc) dołączone do innego odpoczynku
// trwającego co najmniej 9 godzin (art. 8 ust. 6b).
export function weeklyRestCompensation(segments, nowMs) {
  const { coalesced, inWindow, byWeek, biezacyTydzienMs } = _weeklyRestsByWeek(segments, nowMs);
  const weeklyStarts = new Set([...byWeek.values()].map(s => s.startMs));

  const targetMin = 45 * 60; // 2700 min = 45h regularny tygodniowy

  // Długi trzymamy OSOBNO per skrócenie, nie jako jedną sumę — art. 8 ust. 6b
  // wymaga odebrania wyrównania "jednorazowo" (en bloc), więc brakujące 3h25
  // musi pokryć JEDEN odpoczynek z taką nadwyżką, a nie trzy po godzinie.
  const debts = [];
  for (const [wk, s] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    // Z tygodnia, który jeszcze trwa, NIE naliczamy długu — dopóki tydzień się nie
    // skończył, najdłuższy dotychczasowy odpoczynek nie jest jeszcze tygodniowym
    // i „skrócenie" bywa fikcją (u Mirka 23.10 dobowy z rekompensatą udawał skrócony
    // tygodniowy i generował dług 30h41). Dług pojawi się po zamknięciu tygodnia,
    // jeśli rzeczywiście zabraknie godzin.
    if (wk === biezacyTydzienMs) continue;
    if (s.durMin < targetMin) {
      debts.push({
        owedMin: targetMin - s.durMin,
        fromMs: s.endMs,                       // wyrównanie musi nastąpić PO skróceniu
        // Termin: koniec trzeciego tygodnia NASTĘPUJĄCEGO po tygodniu skrócenia
        // (art. 8 ust. 6) = poniedziałek 00:00 cztery tygodnie po tygodniu skrócenia.
        deadlineMs: wk + 4 * 7 * 24 * 3600000,
        paid: false,
      });
    }
  }

  // FIX (2026-09-11, case WGM 0507M / Volodymyr): wyrównanie odbiera się przez
  // KAŻDY odpoczynek ≥9h, nie tylko przez tygodniowy dłuższy niż 45h (art. 8 ust. 6b:
  // "dołączone do innego okresu odpoczynku trwającego co najmniej dziewięć godzin").
  // Wcześniej kod uznawał wyłącznie nadwyżkę ponad 45h w odpoczynku tygodniowym →
  // kierowca, który oddał brakujące godziny przedłużonym odpoczynkiem dziennym,
  // w nieskończoność widniał jako zadłużony.
  // Zdolność wyrównawcza nośnika:
  //   • odpoczynek tygodniowy (wybrany dla swojego tygodnia) → nadwyżka ponad 45h
  //   • każdy inny odpoczynek ≥9h                            → nadwyżka ponad 11h
  //     (11h = regularny dzienny; dopiero to, co ponad niego, jest "doczepione")
  const carriers = coalesced
    .filter(s => s.type === "rest" && inWindow(s) && s.durMin >= REGULATION.DAILY_REST_REDUCED)
    .sort((a, b) => a.startMs - b.startMs);

  for (const s of carriers) {
    const isWeekly = weeklyStarts.has(s.startMs);
    let capacity = isWeekly
      ? s.durMin - targetMin
      : s.durMin - REGULATION.DAILY_REST_REGULAR;
    if (capacity <= 0) continue;
    // FIFO: najstarszy niespłacony dług powstały PRZED tym odpoczynkiem.
    // Każdy dług pokrywany w CAŁOŚCI albo wcale (en bloc).
    for (const d of debts) {
      if (d.paid || d.fromMs > s.startMs) continue;
      if (capacity >= d.owedMin) {
        capacity -= d.owedMin;
        d.paid = true;
      }
    }
  }

  const unpaid = debts.filter(d => !d.paid);
  const owedMin = unpaid.reduce((acc, d) => acc + d.owedMin, 0);
  return {
    owedMin,
    deadlineMs: unpaid.length ? Math.min(...unpaid.map(d => d.deadlineMs)) : null,
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
    // Lista tygodniowych pauz dla dyspozytora (prośba Agnieszki, 14.10.2026).
    // To samo źródło co weeklyRestComp — patrz _weeklyRestsByWeek.
    weeklyRests: weeklyRestList(segments, nowMs),
    // Reguły art. 8 ust. 6 / 6b — dwa skrócone pod rząd, okno odstępstwa, rekompensata
    // przed następnym tygodniowym. Patrz weeklyRestRules (świadomie bez werdyktu).
    weeklyRestRules: weeklyRestRules(segments, nowMs),
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
        // Ostatni kandydat pochodzi z tygodnia, który jeszcze trwa — plan ma o tym
        // powiedzieć wprost, zamiast twierdzić, że tygodniowy „był skrócony".
        lastWToku: lw?.wToku ?? false,
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
      // Ostatni odpoczynek ≥24h pochodzi z tygodnia, który jeszcze trwa — nie wiadomo
      // jeszcze, czy to tygodniowy, więc nie żądamy pełnego 45h, ale mówimy wprost dlaczego.
      lastWToku: wrStatus.lastWToku || false,
    },
    returnToBase,
  };
}
