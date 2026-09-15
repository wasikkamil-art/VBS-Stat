// Rankingi kierowców — CZYSTA LOGIKA (zero React, zero Firebase).
//
// Przeniesione 1:1 z generatora `make_dashboard_rankingi.js`, którym od 15.09.2026
// robimy prezentację PDF. Dzięki wydzieleniu tutaj zakładka „Ranking" w aplikacji
// i PDF liczą DOKŁADNIE to samo — jak w `fuelParsers.js`, gdzie ta sama decyzja
// pozwoliła testować parsery na prawdziwych plikach w node.
//
// Wejście: tablice z fleet/data (frachty, koszty), kolekcja `operacyjne`, pojazdy.
// Wyjście: gotowe struktury do wyrenderowania — wartości surowe (do pasków)
// i sformatowane (do tabel), plus wnioski jako segmenty {s, b} zamiast HTML-a,
// żeby komponent nie musiał sięgać po dangerouslySetInnerHTML.

export const MIES = ["", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
export const MIES_K = ["", "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

// Kolory kierowców — stała kolejność, żeby ten sam kierowca miał ten sam kolor
// między odświeżeniami (paski, kropki przy nazwisku, podświetlenie lidera miesiąca).
const PALETA = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#db2777", "#0891b2"];

export const eur = (n, d = 0) => Number(n || 0).toLocaleString("pl-PL",
  { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });
export const dec = (n, d = 1) => Number(n || 0).toLocaleString("pl-PL",
  { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" });

// Miesiąc jest „rozliczony", gdy ma choć jeden koszt zmienny — ta sama reguła co
// `isSettled` w RentownoscTab. Bez tego wrzesień z samymi frachtami pokazałby
// fikcyjny zysk (frachty są kompletne od razu, koszty dochodzą po zamknięciu).
const KAT_ROZLICZONE = ["paliwo", "leasing", "wyplata"];

export function zakresRozliczony(costs, rok) {
  const set = new Set();
  for (const c of costs || []) {
    if (c?.date && KAT_ROZLICZONE.includes(c.category)) set.add(String(c.date).slice(0, 7));
  }
  let mTo = 0;
  for (let m = 1; m <= 12; m++) if (set.has(`${rok}-${String(m).padStart(2, "0")}`)) mTo = m;
  let mFrom = mTo ? 13 : 0;
  for (let m = 1; m <= mTo; m++) if (set.has(`${rok}-${String(m).padStart(2, "0")}`)) { mFrom = m; break; }
  return { mFrom: mFrom || 0, mTo };
}

// Kierowca = pojazd (w 2026 nikt nie zmieniał auta). Bierzemy aktywny wpis
// z driverHistory, a gdy go brak — ostatni zamknięty; w ostateczności rejestrację.
function kierowcaPojazdu(v) {
  const hist = Array.isArray(v.driverHistory) ? v.driverHistory : [];
  const aktywny = hist.find(d => d && !d.to);
  const ostatni = hist.length ? hist[hist.length - 1] : null;
  const nazwa = (aktywny?.name || ostatni?.name || "").trim();
  return ladnaNazwa(nazwa) || v.plate || v.id;
}

// driverHistory bywa zasilana loginem zamiast imieniem („volodymyr.lukashuchuk"),
// a ranking ma pokazywać człowieka, nie handle. Zamieniamy kropki/podkreślenia
// na spacje i podnosimy pierwsze litery — tylko gdy nazwa wygląda na login.
function ladnaNazwa(n) {
  const s = String(n || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  if (s.includes(" ") && /[A-ZŁŚŻŹĆĄĘÓŃ]/.test(s)) return s;
  return s.split("@")[0].split(/[._-]+/).filter(Boolean)
    .map(w => w.charAt(0).toLocaleUpperCase("pl") + w.slice(1)).join(" ");
}

const skrot = (nazwa) => {
  const cz = String(nazwa).trim().split(/\s+/);
  return cz.length > 1 ? cz[cz.length - 1] : cz[0] || "—";
};

export function buildRankingi({ frachty = [], costs = [], operacyjne = [], vehicles = [],
  rok = new Date().getFullYear(), mFrom, mTo, bezKosztow = true } = {}) {

  const auto = zakresRozliczony(costs, rok);
  const OD = mFrom || auto.mFrom, DO = mTo || auto.mTo;
  if (!OD || !DO || DO < OD) return { okres: { mFrom: 0, mTo: 0, months: [] }, rankings: [], pusty: true };
  const MONTHS = [];
  for (let m = OD; m <= DO; m++) MONTHS.push(m);

  // Do rankingu wchodzą pojazdy, które w okresie w ogóle jeździły — inaczej auto
  // odstawione (TK 130EF) wisiałoby na ostatnim miejscu z samymi zerami.
  const P = {};
  (vehicles || []).forEach((v, i) => {
    const nazwa = kierowcaPojazdu(v);
    P[v.id] = {
      vid: v.id, plate: v.plate || v.id, name: nazwa, short: skrot(nazwa),
      col: PALETA[i % PALETA.length], m: {},
    };
    MONTHS.forEach(mo => { P[v.id].m[mo] = { fr: 0, obrot: 0, koszt: 0, dni: 0, km: 0, litry: 0 }; });
  });

  const wMiesiacu = (data) => {
    const s = String(data || "");
    if (!s.startsWith(String(rok))) return 0;
    const mo = Number(s.slice(5, 7));
    return mo >= OD && mo <= DO ? mo : 0;
  };

  for (const f of frachty) {
    const mo = wMiesiacu(f.dataZaladunku || f.dataZlecenia);
    if (!mo || !P[f.vehicleId]) continue;
    P[f.vehicleId].m[mo].fr++;
    P[f.vehicleId].m[mo].obrot += parseFloat(f.cenaEur) || 0;
  }
  for (const c of costs) {
    const mo = wMiesiacu(c.date);
    if (!mo || !P[c.vehicleId]) continue;
    P[c.vehicleId].m[mo].koszt += Math.abs(Number(c.amountEUR ?? 0));
  }
  for (const x of operacyjne) {
    const mo = Number(x?.month);
    if (Number(x?.year) !== rok || mo < OD || mo > DO || !P[x?.vehicleId]) continue;
    const b = P[x.vehicleId].m[mo];
    b.dni = Number(x.dni ?? x.iloscDni ?? 0) || 0;
    b.km = Number(x.kmLicznik || 0);
    b.litry = Number(x.paliwoL || 0);
  }

  const sumaPola = (p, pole) => MONTHS.reduce((s, mo) => s + p.m[mo][pole], 0);
  // Do rankingu wchodzą tylko auta czynne w OSTATNIM miesiącu okresu. Bez tego
  // pojazd odstawiony w styczniu (TK 130EF) wygrywałby ranking spalania wynikiem
  // z jednego miesiąca i zaniżał wiersz FLOTA w każdej tabeli.
  const czynny = p => { const b = p.m[DO]; return b.fr > 0 || b.km > 0 || b.dni > 0; };
  const wszyscy = Object.values(P);
  const ZAWODNICY = wszyscy.filter(czynny);
  const pominieci = wszyscy
    .filter(p => !czynny(p) && MONTHS.some(mo => p.m[mo].fr > 0 || p.m[mo].km > 0 || p.m[mo].dni > 0))
    .map(p => ({ vid: p.vid, plate: p.plate, name: p.name }));
  if (!ZAWODNICY.length) return { okres: { mFrom: OD, mTo: DO, months: MONTHS }, rankings: [], pominieci, pusty: true };

  function oblicz(o) {
    const { val, mniejLepiej = false, razem = null, razemFloty = null, sumaMcFn = null } = o;
    const wiersze = ZAWODNICY.map(p => {
      const wartosci = MONTHS.map(mo => val(p, mo));
      const suma = razem ? razem(p) : wartosci.reduce((a, b) => a + b, 0);
      const niepuste = wartosci.filter(v => Number.isFinite(v));
      return { p, wartosci, suma, srednia: niepuste.length ? niepuste.reduce((a, b) => a + b, 0) / niepuste.length : 0 };
    }).sort((a, b) => mniejLepiej ? a.suma - b.suma : b.suma - a.suma);
    const lepszy = (a, b) => mniejLepiej ? a < b : a > b;
    const liderMc = MONTHS.map((mo, i) => {
      const best = wiersze.reduce((acc, w) => (acc === null || lepszy(w.wartosci[i], acc) ? w.wartosci[i] : acc), null);
      return wiersze.filter(w => w.wartosci[i] === best).map(w => w.p.vid);
    });
    const sumaMc = MONTHS.map((mo, i) => sumaMcFn ? sumaMcFn(wiersze, i) : wiersze.reduce((s, w) => s + (w.wartosci[i] || 0), 0));
    const razemFlota = razemFloty ? razemFloty(wiersze) : wiersze.reduce((s, w) => s + w.suma, 0);
    return { wiersze, liderMc, sumaMc, razemFlota };
  }

  // Wnioski jako segmenty {s, b} — komponent renderuje <b> tam, gdzie b === true.
  function wnioski(o, dane) {
    const { fmt, fmtRazem, pokazSrednia = true, mniejLepiej = false, slowa = {} } = o;
    const { wiersze, sumaMc } = dane;
    const SL = Object.assign(mniejLepiej
      ? { lider: "ma najniższy wynik okresu —", mcLepszy: "Najniższy miesiąc floty", mcGorszy: "najwyższy" }
      : { lider: "wygrywa okres —", mcLepszy: "Najmocniejszy miesiąc floty", mcGorszy: "najsłabszy" }, slowa);
    const wszystkie = wiersze.flatMap(w => w.wartosci);
    const najlepsza = mniejLepiej ? Math.min(...wszystkie) : Math.max(...wszystkie);
    const najgorsza = mniejLepiej ? Math.max(...wszystkie) : Math.min(...wszystkie);
    const ktoNaj = wiersze.find(w => w.wartosci.includes(najlepsza));
    const ktoNajg = wiersze.find(w => w.wartosci.includes(najgorsza));
    const kiedyNaj = MONTHS[ktoNaj.wartosci.indexOf(najlepsza)];
    const kiedyNajg = MONTHS[ktoNajg.wartosci.indexOf(najgorsza)];
    const zw = wiersze[0], os = wiersze[wiersze.length - 1];
    const polowa = Math.ceil(MONTHS.length / 2);
    const trend = wiersze.map(w => {
      const a = w.wartosci.slice(0, polowa).reduce((x, y) => x + y, 0) / polowa;
      const b = w.wartosci.slice(polowa).reduce((x, y) => x + y, 0) / Math.max(1, MONTHS.length - polowa);
      return { w, a, b, d: mniejLepiej ? a - b : b - a };
    }).sort((x, y) => y.d - x.d);
    const g = trend[0], s2 = trend[trend.length - 1];
    const najlepszyMcIdx = sumaMc.indexOf(mniejLepiej ? Math.min(...sumaMc) : Math.max(...sumaMc));
    const najgorszyMcIdx = sumaMc.indexOf(mniejLepiej ? Math.max(...sumaMc) : Math.min(...sumaMc));
    const okresy = MONTHS.length > 1
      ? `druga część okresu (${MIES_K[MONTHS[polowa]] || MIES_K[MONTHS[MONTHS.length - 1]]}–${MIES_K[MONTHS[MONTHS.length - 1]]}) wobec pierwszej (${MIES_K[MONTHS[0]]}–${MIES_K[MONTHS[polowa - 1]]})`
      : "okres";

    const L = [];
    L.push([{ s: zw.p.name, b: 1 }, { s: ` ${SL.lider} ` }, { s: fmtRazem(zw.suma), b: 1 },
      { s: pokazSrednia ? ` (średnio ${fmt(zw.srednia)} na miesiąc)` : "" },
      { s: `. Ostatni ${os.p.short} z ${fmtRazem(os.suma)}; dystans ${fmtRazem(Math.abs(zw.suma - os.suma))}.` }]);
    L.push([{ s: "Najlepszy pojedynczy miesiąc: " }, { s: `${ktoNaj.p.short} / ${MIES[kiedyNaj]}`, b: 1 },
      { s: ` — ${fmt(najlepsza)}. Najsłabszy: ` }, { s: `${ktoNajg.p.short} / ${MIES[kiedyNajg]}`, b: 1 },
      { s: ` — ${fmt(najgorsza)}.` }]);
    if (MONTHS.length > 1) {
      const wszyscyGorzej = trend.every(t => t.d < 0), wszyscyLepiej = trend.every(t => t.d > 0);
      L.push([{ s: `Forma w czasie — ${okresy}: ` },
        { s: wszyscyGorzej ? "pogorszenie u wszystkich" : wszyscyLepiej ? "poprawa u wszystkich" : "najmocniej poprawił się ", b: 1 },
        { s: wszyscyGorzej || wszyscyLepiej ? `. Najmocniej ` : "" },
        { s: g.w.p.short, b: 1 }, { s: ` (${fmt(g.a)} → ${fmt(g.b)}), ` },
        { s: wszyscyGorzej ? "najłagodniej " : "najsłabiej " }, { s: s2.w.p.short, b: 1 },
        { s: ` (${fmt(s2.a)} → ${fmt(s2.b)}).` }]);
    }
    L.push([{ s: `${SL.mcLepszy}: ` }, { s: MIES[MONTHS[najlepszyMcIdx]], b: 1 },
      { s: ` — ${fmt(sumaMc[najlepszyMcIdx])}; ${SL.mcGorszy} ` }, { s: MIES[MONTHS[najgorszyMcIdx]], b: 1 },
      { s: ` — ${fmt(sumaMc[najgorszyMcIdx])}.` }]);
    return L;
  }

  function zbuduj(o) {
    const dane = oblicz(o);
    const { fmt = v => eur(v), fmtRazem = v => eur(v), fmtSr = null,
      pokazSrednia = true, etykietaRazem = "Razem", extra = null } = o;
    const fSr = fmtSr || fmt;
    return {
      key: o.key, tytul: o.tytul, jednostka: o.jednostka, podtytul: o.podtytul,
      mniejLepiej: !!o.mniejLepiej, etykietaRazem, pokazSrednia, opisMetody: o.opisMetody || "",
      extraNaglowek: extra?.naglowek || null,
      wiersze: dane.wiersze.map((w, idx) => ({
        miejsce: idx + 1, vid: w.p.vid, name: w.p.name, short: w.p.short, plate: w.p.plate, col: w.p.col,
        wartosci: w.wartosci, wartosciTxt: w.wartosci.map(fmt),
        lider: dane.liderMc.map(l => l.includes(w.p.vid)),
        suma: w.suma, sumaTxt: fmtRazem(w.suma), sredniaTxt: fSr(w.srednia),
        extraTxt: extra ? extra.val(w) : null,
      })),
      flota: {
        wartosciTxt: dane.sumaMc.map(fmt), suma: dane.razemFlota, sumaTxt: fmtRazem(dane.razemFlota),
        sredniaTxt: fSr(dane.razemFlota / MONTHS.length),
        extraTxt: extra ? extra.valFloty(dane.wiersze) : null,
      },
      wnioski: wnioski(o, dane),
    };
  }

  const SPEC_FRACHT_DZIEN = {
    key: "frachtDzien", tytul: "Fracht na dzień w trasie", jednostka: "EUR netto / dzień",
    podtytul: "ile wartości frachtów przypada na jeden dzień pracy",
    val: (p, mo) => p.m[mo].dni ? p.m[mo].obrot / p.m[mo].dni : 0,
    fmt: v => eur(v), fmtRazem: v => eur(v) + " €",
    etykietaRazem: "Średnio na dzień", pokazSrednia: false,
    razem: p => sumaPola(p, "dni") ? sumaPola(p, "obrot") / sumaPola(p, "dni") : 0,
    razemFloty: ws => {
      const o = ws.reduce((s, w) => s + sumaPola(w.p, "obrot"), 0);
      const d = ws.reduce((s, w) => s + sumaPola(w.p, "dni"), 0);
      return d ? o / d : 0;
    },
    sumaMcFn: (ws, i) => {
      const mo = MONTHS[i];
      const o = ws.reduce((s, w) => s + w.p.m[mo].obrot, 0);
      const d = ws.reduce((s, w) => s + w.p.m[mo].dni, 0);
      return d ? o / d : 0;
    },
    extra: {
      naglowek: "Dni", val: w => dec(sumaPola(w.p, "dni"), 1),
      valFloty: ws => dec(ws.reduce((s, w) => s + sumaPola(w.p, "dni"), 0), 1),
    },
    opisMetody: "Wskaźnik nie jest sumą — to kwota frachtów okresu podzielona przez dni w trasie okresu (wiersz floty tak samo, z sum floty). Odporny na to, że jedni jeżdżą więcej dni niż drudzy: mierzy wartość jednego dnia pracy, a nie wolumen.",
  };

  const rankings = [
    zbuduj({
      key: "dni", tytul: "Dni w trasie", jednostka: "dni", podtytul: "ile dni każdy kierowca spędził w trasie",
      val: (p, mo) => p.m[mo].dni, fmt: v => dec(v, 1), fmtRazem: v => dec(v, 1) + " dni",
      opisMetody: "„Dni w trasie” to wiersz „Ilość dni” z arkusza Total_26; wartości ułamkowe biorą się z dni dzielonych na przełomie miesięcy.",
    }),
    zbuduj({
      key: "frachty", tytul: "Frachty", jednostka: "EUR netto", podtytul: "wartość ładunków obsłużonych w miesiącu",
      val: (p, mo) => p.m[mo].obrot, fmt: v => eur(v), fmtRazem: v => eur(v) + " €",
      opisMetody: "Kwoty netto z pola cenaEur, przypisanie do miesiąca po dacie załadunku (fallback: data zlecenia).",
    }),
    zbuduj({
      key: "zysk", tytul: "Zysk", jednostka: "EUR netto", podtytul: "obrót minus wszystkie koszty pojazdu",
      val: (p, mo) => p.m[mo].obrot - p.m[mo].koszt, fmt: v => eur(v), fmtRazem: v => eur(v) + " €",
      opisMetody: "Zysk zawiera koszty, na które kierowca nie ma wpływu (leasing, ZUS, polisy), a auta różnią się nimi — pojazd bez raty leasingowej ma z tego powodu wyższą marżę.",
    }),
    zbuduj({
      key: "liczba", tytul: "Liczba frachtów", jednostka: "sztuki", podtytul: "ile ładunków obsłużył każdy kierowca",
      val: (p, mo) => p.m[mo].fr, fmt: v => dec(v, v % 1 ? 1 : 0), fmtSr: v => dec(v, 1), fmtRazem: v => eur(v),
    }),
    ...(bezKosztow ? [] : [zbuduj({
      key: "koszty", tytul: "Koszty", jednostka: "EUR netto", podtytul: "wszystkie koszty przypisane do pojazdu",
      mniejLepiej: true,
      slowa: { lider: "ma najniższe koszty okresu —", mcLepszy: "Najtańszy miesiąc floty", mcGorszy: "najdroższy" },
      val: (p, mo) => p.m[mo].koszt, fmt: v => eur(v), fmtRazem: v => eur(v) + " €",
      extra: {
        naglowek: "€ / dzień",
        val: w => eur(sumaPola(w.p, "dni") ? w.suma / sumaPola(w.p, "dni") : 0),
        valFloty: ws => {
          const d = ws.reduce((s, w) => s + sumaPola(w.p, "dni"), 0);
          return eur(d ? ws.reduce((s, w) => s + w.suma, 0) / d : 0);
        },
      },
      opisMetody: "Sama suma kosztów premiuje tego, kto mniej jeździł — dlatego obok jest kolumna €/dzień. Dopiero ona mówi, czy niższy koszt to oszczędność, czy po prostu mniej dni w trasie.",
    })]),
    zbuduj({
      key: "spalanie", tytul: "Spalanie", jednostka: "L / 100 km", podtytul: "zużycie paliwa na 100 km",
      mniejLepiej: true,
      slowa: { lider: "pali najmniej —", mcLepszy: "Najoszczędniejszy miesiąc floty", mcGorszy: "najbardziej paliwożerny" },
      val: (p, mo) => p.m[mo].km ? p.m[mo].litry / p.m[mo].km * 100 : 0,
      fmt: v => dec(v, 1), fmtRazem: v => dec(v, 2) + " L",
      etykietaRazem: "Śr. okresu", pokazSrednia: false,
      razem: p => sumaPola(p, "km") ? sumaPola(p, "litry") / sumaPola(p, "km") * 100 : 0,
      razemFloty: ws => {
        const l = ws.reduce((s, w) => s + sumaPola(w.p, "litry"), 0);
        const k = ws.reduce((s, w) => s + sumaPola(w.p, "km"), 0);
        return k ? l / k * 100 : 0;
      },
      sumaMcFn: (ws, i) => {
        const mo = MONTHS[i];
        const l = ws.reduce((s, w) => s + w.p.m[mo].litry, 0);
        const k = ws.reduce((s, w) => s + w.p.m[mo].km, 0);
        return k ? l / k * 100 : 0;
      },
      extra: {
        naglowek: "Litry okresu", val: w => eur(sumaPola(w.p, "litry")),
        valFloty: ws => eur(ws.reduce((s, w) => s + sumaPola(w.p, "litry"), 0)),
      },
      opisMetody: "Spalania nie da się zsumować, więc kolumna okresu to litry ÷ km × 100 z sum całego okresu (nie średnia z miesięcy). Auta są różne (ciągnik vs bus), więc ranking pokazuje różnicę, a nie ocenia styl jazdy. Liczone z litrów z kart paliwowych i km licznika (raport ww).",
    }),
    zbuduj(SPEC_FRACHT_DZIEN),
  ];

  return { okres: { mFrom: OD, mTo: DO, months: MONTHS }, rankings, pominieci, pusty: false };
}
