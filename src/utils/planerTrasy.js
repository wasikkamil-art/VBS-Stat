// Planer przejazdu — rozkłada trasę na jazdę, pauzy 45 min i odpoczynki dobowe
// zgodnie z 561/2006, startując od FAKTYCZNEGO stanu kierowcy (tachograf/GPS).
//
// Czysta funkcja, bez Reacta i Firebase — łatwa do testu i do ponownego użycia
// w rozliczeniu „plan kontra wykonanie" (Etap 2).
//
// Uproszczenia (świadome, opisane w UI):
//  • czas jazdy rozkładamy proporcjonalnie do kilometrów — nie znamy profilu prędkości,
//  • postoje na załadunek/rozładunek to „inna praca", więc NIE zerują licznika 4h30
//    (tak jest bezpieczniej: plan nie obieca pauzy, której nie było),
//  • odpoczynek tygodniowy tylko sygnalizujemy ostrzeżeniem — trasy dłuższe niż
//    kilka dni planuje się i tak ręcznie.

import { REGULATION } from "./czasPracy.js";   // z rozszerzeniem — plik odpalamy też node'em w testach

const MIN = 60000;

/** Stan kierowcy na starcie trasy. Wszystko w minutach; null = kierowca wypoczęty. */
export function stanZCompliance(compliance) {
  if (!compliance) return null;
  return {
    jazdaCiagla: compliance.continuousDrive || 0,
    jazdaDzis: compliance.daily?.drive || 0,
    jazdaTydzien: compliance.weekly?.drive || 0,
    dniWydluzonych: compliance.daily?.extendedDaysUsed || 0,
  };
}

const PUSTY_STAN = { jazdaCiagla: 0, jazdaDzis: 0, jazdaTydzien: 0, dniWydluzonych: 0 };

/**
 * @param {object} p
 * @param {number} p.distanceKm    — długość trasy
 * @param {number} p.drivingMin    — czysty czas jazdy w minutach (z routingu, po narzucie)
 * @param {number} p.startMs       — moment wyjazdu
 * @param {object} [p.stan]        — stan kierowcy (stanZCompliance) albo null = wypoczęty
 * @param {Array}  [p.postoje]     — [{km, minut, nazwa}] załadunki/rozładunki na trasie
 * @param {boolean} [p.pozwolNa10h] — czy wolno wydłużyć dobę do 10h (domyślnie tak, limit 2×/tydz.)
 * @returns {{odcinki:Array, etaMs:number, jazdaMin:number, przerwyMin:number, odpoczynkiMin:number,
 *            dob:number, ostrzezenia:string[]}}
 */
export function zaplanujPrzejazd({ distanceKm, drivingMin, startMs, stan = null, postoje = [], pozwolNa10h = true }) {
  const s = { ...PUSTY_STAN, ...(stan || {}) };
  const ostrzezenia = [];
  const odcinki = [];
  if (!(drivingMin > 0) || !(distanceKm > 0) || !isFinite(startMs)) {
    return { odcinki, etaMs: startMs, jazdaMin: 0, przerwyMin: 0, odpoczynkiMin: 0, dob: 0, ostrzezenia: ["brak danych trasy"] };
  }

  const kmNaMin = distanceKm / drivingMin;
  const kolejnePostoje = [...postoje].filter(p => p && p.minut > 0).sort((a, b) => (a.km || 0) - (b.km || 0));

  let t = startMs;
  let km = 0;                 // przejechane km
  let zostaloJazdy = drivingMin;
  let przerwyMin = 0, odpoczynkiMin = 0, dob = 0;

  const limitDobowy = () => (pozwolNa10h && s.dniWydluzonych < REGULATION.EXTENDED_PER_WEEK)
    ? REGULATION.DAILY_DRIVE_EXTENDED : REGULATION.DAILY_DRIVE_REGULAR;

  const dodaj = (typ, minut, extra = {}) => {
    if (minut <= 0) return;
    odcinki.push({ typ, odMs: t, doMs: t + minut * MIN, minut, kmOd: Math.round(km), kmDo: Math.round(km), ...extra });
    t += minut * MIN;
  };

  // Postój w punkcie startowym (załadunek) — zanim ruszymy, żeby nie tworzyć
  // sztucznego odcinka jazdy „0 min".
  for (const p0 of kolejnePostoje.filter(x => (x.km || 0) < 1)) {
    dodaj("postoj", p0.minut, { powod: p0.nazwa || "postój" });
    kolejnePostoje.splice(kolejnePostoje.indexOf(p0), 1);
  }

  let bezpiecznik = 0;
  while (zostaloJazdy > 0.01) {
    if (++bezpiecznik > 500) { ostrzezenia.push("plan przerwany — trasa zbyt długa na automatyczne rozpisanie"); break; }

    // Ile wolno jechać do najbliższej bariery: pauza 45 min / koniec doby / koniec trasy
    const doPauzy = REGULATION.CONTINUOUS_DRIVE - s.jazdaCiagla;
    const doKoncaDoby = limitDobowy() - s.jazdaDzis;

    if (doKoncaDoby <= 0.01) {
      // Doba wyjeżdżona → odpoczynek dobowy (regularny 11h).
      dodaj("odpoczynek", REGULATION.DAILY_REST_REGULAR, { powod: `wyjeżdżone ${(limitDobowy() / 60).toFixed(0)} h jazdy w dobie` });
      odpoczynkiMin += REGULATION.DAILY_REST_REGULAR;
      dob += 1;
      if (s.jazdaDzis > REGULATION.DAILY_DRIVE_REGULAR) s.dniWydluzonych += 1;
      s.jazdaDzis = 0; s.jazdaCiagla = 0;
      continue;
    }
    if (doPauzy <= 0.01) {
      dodaj("pauza", REGULATION.BREAK_MIN, { powod: "4 h 30 min jazdy ciągłej" });
      przerwyMin += REGULATION.BREAK_MIN;
      s.jazdaCiagla = 0;
      continue;
    }

    // Postój na załadunek/rozładunek wypadający w tym odcinku jazdy
    const najblizszyPostoj = kolejnePostoje.find(p => p.km > km + 0.001);
    const doPostoju = najblizszyPostoj ? Math.max(0, (najblizszyPostoj.km - km) / kmNaMin) : Infinity;

    const jedz = Math.min(doPauzy, doKoncaDoby, zostaloJazdy, doPostoju);
    if (jedz > 0.01) {
      const kmOd = km;
      km += jedz * kmNaMin;
      odcinki.push({ typ: "jazda", odMs: t, doMs: t + jedz * MIN, minut: jedz, kmOd: Math.round(kmOd), kmDo: Math.round(km) });
      t += jedz * MIN;
      s.jazdaCiagla += jedz; s.jazdaDzis += jedz; s.jazdaTydzien += jedz;
      zostaloJazdy -= jedz;
    }

    if (najblizszyPostoj && Math.abs(km - najblizszyPostoj.km) < 0.5) {
      // Załadunek/rozładunek = inna praca. Licznika 4h30 NIE zeruje (patrz nagłówek).
      dodaj("postoj", najblizszyPostoj.minut, { powod: najblizszyPostoj.nazwa || "postój" });
      kolejnePostoje.splice(kolejnePostoje.indexOf(najblizszyPostoj), 1);
    }
  }

  if (s.jazdaTydzien > REGULATION.WEEKLY_DRIVE) {
    ostrzezenia.push(`tygodniowy limit jazdy 56 h przekroczony (${(s.jazdaTydzien / 60).toFixed(1)} h) — trasa wymaga drugiego kierowcy albo przesunięcia`);
  }
  if (dob >= 5) ostrzezenia.push("trasa dłuższa niż 5 dób — dojdzie odpoczynek tygodniowy, zaplanuj go ręcznie");

  return {
    odcinki,
    etaMs: t,
    jazdaMin: drivingMin,
    przerwyMin,
    odpoczynkiMin,
    dob,
    ostrzezenia,
  };
}

/** Pozycja na trasie (lat/lon) dla danego kilometra — do pinezek pauz na mapie. */
export function punktNaTrasie(geometry, distanceKm, km) {
  if (!Array.isArray(geometry) || geometry.length < 2 || !(distanceKm > 0)) return null;
  const udzial = Math.min(1, Math.max(0, km / distanceKm));
  const i = Math.min(geometry.length - 1, Math.round(udzial * (geometry.length - 1)));
  const p = geometry[i];
  return Array.isArray(p) ? { lat: p[1], lon: p[0] } : null;
}

/** Porównanie ETA z oknem rozładunku. Zwraca minuty zapasu (ujemne = spóźnienie). */
export function zapasDoOkna(etaMs, dataRozladunku, godzRozladunku) {
  if (!dataRozladunku) return null;
  const t = `${dataRozladunku}T${godzRozladunku || "23:59"}:00`;
  const okno = new Date(t).getTime();
  if (!isFinite(okno)) return null;
  return Math.round((okno - etaMs) / MIN);
}
