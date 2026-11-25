// Raport czasu pracy kierowcy za miesiąc — STAN FAKTYCZNY z tachografu.
//
// Czysta logika, bez Firestore i bez Reacta: dostaje surowe segmenty `driverActivities`
// jednego kierowcy i oddaje rozbicie dzień po dniu. Ten sam potok co panel „Czas pracy
// kierowcy" (normalizeSegment → preferDddSegments), więc liczby nie mogą się rozjechać:
// korekta ręczna > DDD > raport ww > GPS.
//
// Czego tu celowo NIE MA: wymiaru etatu, nadgodzin, rozkładu godzin. To etap następny
// i zasady ustala użytkownik z księgową — ten plik tylko pokazuje, co zapisała karta.
//
// Doba = doba kalendarzowa czasu lokalnego przeglądarki (PL). Segment przechodzący przez
// północ jest dzielony między dwa dni.

import { normalizeSegment, preferDddSegments } from "./czasPracy";

const TYPY_PRACY = ["drive", "work", "avail"];
const DNI_TYG = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];

const dwa = (n) => String(n).padStart(2, "0");
export const kluczDnia = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${dwa(d.getMonth() + 1)}-${dwa(d.getDate())}`;
};
const hhmm = (ms) => {
  const d = new Date(ms);
  return `${dwa(d.getHours())}:${dwa(d.getMinutes())}`;
};

// Granice miesiąca w czasie lokalnym. `miesiac` 1–12.
export function graniceMiesiaca(rok, miesiac) {
  return { odMs: new Date(rok, miesiac - 1, 1).getTime(), doMs: new Date(rok, miesiac, 1).getTime() };
}

// Zakres zapytania do bazy: segment zaczęty przed 1. dniem miesiąca może w niego wchodzić
// (odpoczynek tygodniowy, zmiana przez północ), więc sięgamy 3 doby wstecz. Filtr idzie po
// `startTs` (ISO UTC), dlatego granice też w ISO.
export function zakresZapytania(rok, miesiac) {
  const { odMs, doMs } = graniceMiesiaca(rok, miesiac);
  return { odIso: new Date(odMs - 3 * 86400000).toISOString(), doIso: new Date(doMs).toISOString() };
}

// Lista miesięcy „RRRR-MM" od `odKlucz` do miesiąca z `now` włącznie, najnowszy pierwszy.
export function listaMiesiecy(odKlucz, now = new Date()) {
  const [r0, m0] = odKlucz.split("-").map(Number);
  const wynik = [];
  let r = now.getFullYear(), m = now.getMonth() + 1;
  while (r > r0 || (r === r0 && m >= m0)) {
    wynik.push(`${r}-${dwa(m)}`);
    m -= 1;
    if (m === 0) { m = 12; r -= 1; }
  }
  return wynik;
}

// Zapis karty ma w ciągu dnia krótkie przerwy (kilka–kilkanaście minut bez rekordu).
// `preferDddSegments` wycina GPS / raport ww tylko tam, gdzie LEŻY segment karty, więc w te
// szczeliny wpadały kawałki „jazdy" z GPS i dopisywały kierowcy po kilka–kilkanaście minut
// dziennie ponad to, co ma na karcie (Teper X.2026: +7 h w miesiącu). W raporcie dla
// urzędu liczy się karta: skoro zapis trwa przed szczeliną i po niej, GPS jej nie wypełnia.
// Dłuższa przerwa (ponad CISZA_KARTY_MIN) to już brak karty — tam inne źródła zostają
// i dzień jest oznaczany jako „poza tachografem".
export const CISZA_KARTY_MIN = 120;
function bezSzumuWCiszyKarty(segmenty) {
  const ddd = segmenty.filter(s => s.source === "ddd").sort((a, b) => a.startMs - b.startMs);
  if (ddd.length === 0) return segmenty;
  const bloki = [];
  for (const s of ddd) {
    const ost = bloki[bloki.length - 1];
    if (ost && s.startMs - ost[1] <= CISZA_KARTY_MIN * 60000) ost[1] = Math.max(ost[1], s.endMs);
    else bloki.push([s.startMs, s.endMs]);
  }
  return segmenty.filter(s => {
    if (s.source === "ddd" || s.source === "correction") return true;
    const srodek = (s.startMs + s.endMs) / 2;
    return !bloki.some(([a, b]) => srodek >= a && srodek < b);
  });
}

// Główna funkcja. Zwraca:
//   dni[]   — KAŻDY dzień kalendarzowy miesiąca (także bez pracy), do `now` dla bieżącego
//   suma    — minuty jazdy / innej pracy / dyspozycyjności / razem + liczba dni pracy
//   tachoDoMs — koniec ostatniego segmentu z karty (DDD) w pobranych danych, albo null
// Sumy liczone są TYLKO z karty (DDD + korekty). Pole `zrodlo` dnia: "tacho" (dzień pokryty
// zapisem karty), "mieszane" (karta urywa się w ciągu dnia, dalej widzi tylko GPS), "inne"
// (karty brak, GPS / raport ww widzi aktywność — niewliczoną), "brak" (żadnego zapisu).
// `pozaKarta` / `suma.pracaSpozaTacho` = minuty pracy widziane tylko poza kartą (informacja).
export function raportMiesiaca(surowe = [], rok, miesiac, now = new Date()) {
  const { odMs, doMs: koniecMies } = graniceMiesiaca(rok, miesiac);
  const doMs = Math.min(koniecMies, now.getTime());
  const poPriorytecie = preferDddSegments(surowe.map(s => normalizeSegment(s, now)))
    .filter(s => Number.isFinite(s.startMs) && Number.isFinite(s.endMs) && s.endMs > s.startMs);
  const segmenty = bezSzumuWCiszyKarty(poPriorytecie);

  const mapa = {};
  const dzien = (klucz) => (mapa[klucz] ||= {
    drive: 0, work: 0, avail: 0, poczatekMs: null, koniecMs: null,
    tachoMin: 0, inneMin: 0, pracaSpozaTacho: 0, korekta: false,
  });

  let tachoDoMs = null;
  for (const s of segmenty) {
    if (s.source === "ddd" && (tachoDoMs === null || s.endMs > tachoDoMs)) tachoDoMs = s.endMs;
    let a = Math.max(s.startMs, odMs);
    const e = Math.min(s.endMs, doMs);
    while (a < e) {
      const d = new Date(a);
      const polnoc = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      const b = Math.min(e, polnoc);
      const min = (b - a) / 60000;
      const D = dzien(kluczDnia(a));
      if (s.source === "ddd") D.tachoMin += min; else if (s.source !== "fillgap") D.inneMin += min;
      if (s.source === "correction") D.korekta = true;
      if (TYPY_PRACY.includes(s.type)) {
        // Decyzja użytkownika (25.11.2026): do sum idzie WYŁĄCZNIE karta kierowcy (DDD)
        // i ręczna korekta zapisu karty. Praca widziana tylko przez GPS / raport ww jest
        // liczona osobno jako informacja „poza kartą" i NIE wchodzi do żadnej sumy.
        if (s.source === "ddd" || s.source === "correction") {
          D[s.type] += min;
          if (D.poczatekMs === null || a < D.poczatekMs) D.poczatekMs = a;
          if (D.koniecMs === null || b > D.koniecMs) D.koniecMs = b;
        } else {
          D.pracaSpozaTacho += min;
        }
      }
      a = b;
    }
  }

  const dni = [];
  const suma = { drive: 0, work: 0, avail: 0, razem: 0, dniPracy: 0, dniBezZapisu: 0, pracaSpozaTacho: 0 };
  for (let t = odMs; t < doMs; ) {
    const d = new Date(t);
    const klucz = kluczDnia(t);
    const D = mapa[klucz] || null;
    const drive = Math.round(D?.drive || 0), work = Math.round(D?.work || 0), avail = Math.round(D?.avail || 0);
    const razem = drive + work + avail;
    let zrodlo = "brak";
    if (D && D.tachoMin > 0 && D.pracaSpozaTacho < 1) zrodlo = "tacho";
    else if (D && D.tachoMin > 0) zrodlo = "mieszane";
    else if (D && D.inneMin > 0) zrodlo = "inne";
    dni.push({
      data: klucz, dzienMies: d.getDate(), dzienTyg: DNI_TYG[d.getDay()], weekend: d.getDay() === 0 || d.getDay() === 6,
      drive, work, avail, razem,
      poczatek: razem > 0 && D.poczatekMs !== null ? hhmm(D.poczatekMs) : "",
      // 24:00 zamiast 00:00, gdy praca dociągnęła do północy
      koniec: razem > 0 && D.koniecMs !== null ? (kluczDnia(D.koniecMs) !== klucz ? "24:00" : hhmm(D.koniecMs)) : "",
      zrodlo, korekta: !!D?.korekta, pozaKarta: Math.round(D?.pracaSpozaTacho || 0),
    });
    suma.drive += drive; suma.work += work; suma.avail += avail; suma.razem += razem;
    suma.pracaSpozaTacho += Math.round(D?.pracaSpozaTacho || 0);
    if (razem > 0) suma.dniPracy += 1;
    if (zrodlo === "brak") suma.dniBezZapisu += 1;
    t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  }

  return { rok, miesiac, dni, suma, tachoDoMs, kartaDoKonca: tachoDoMs !== null && tachoDoMs >= koniecMies - 60000, niepelny: doMs < koniecMies };
}

// Kierowcy do raportu: każdy adres e-mail, który kiedykolwiek był w `driverHistory`
// któregokolwiek pojazdu (także archiwalnego i także kierowcy, którzy już odeszli).
// Jeden kierowca = jeden adres; nazwa i auta zbierane ze wszystkich wpisów.
export function kierowcyZFloty(vehicles = []) {
  const mapa = {};
  for (const v of vehicles) {
    for (const h of v.driverHistory || []) {
      const email = String(h.email || "").trim().toLowerCase();
      if (!email) continue;
      const k = (mapa[email] ||= { email, nazwa: "", auta: [], aktywny: false });
      const nazwa = String(h.name || "").trim();
      // Wpis bez nazwiska bywa wypełniony samym loginem — bierzemy najdłuższą nazwę ze spacją.
      if (nazwa && (!k.nazwa || (nazwa.includes(" ") && (!k.nazwa.includes(" ") || nazwa.length > k.nazwa.length)))) k.nazwa = nazwa;
      const tablica = v.plate || v.id;
      if (tablica && !k.auta.includes(tablica)) k.auta.push(tablica);
      if (!h.to) k.aktywny = true;
    }
  }
  return Object.values(mapa)
    .map(k => ({ ...k, nazwa: k.nazwa || k.email }))
    .sort((a, b) => (a.aktywny === b.aktywny ? a.nazwa.localeCompare(b.nazwa, "pl") : a.aktywny ? -1 : 1));
}

// Minuty → „123 h 05 min". Do tabeli miesięcznej; krótsza forma „7:35" do wierszy dni.
export const fmtGodz = (min) => `${Math.floor(min / 60)} h ${dwa(Math.round(min) % 60)} min`;
export const fmtKrotko = (min) => (min > 0 ? `${Math.floor(min / 60)}:${dwa(Math.round(min) % 60)}` : "—");
