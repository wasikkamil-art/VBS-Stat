// Frachty w podziale na spedytorów — logika wyjęta z generatora PDF (make_dashboard_*.js),
// żeby zakładka Analizy i raporty liczyły z jednego kodu. Bez Reacta i Firebase.
//
// Reguła okresu: fracht należy do miesiąca ZAŁADUNKU (potwierdzone na sześciu frachtach
// z przełomu miesiąca — zakładki kierowców liczą tak samo), z datą zlecenia jako zapasem.

export const MIES = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
export const MIES_K = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

export const KUBELKI = [
  { id: "Aga", label: "AGA", kolor: "#2563eb" },
  { id: "Aro", label: "ARO", kolor: "#ea7a17" },
  { id: "AroAga", label: "ARO-AGA", kolor: "#8b5cf6" },
];

const normName = (s) => String(s || "").trim().toLowerCase();

/** Nazwisko z pola dyspozytora → kubełek. Null, gdy pole puste albo nierozpoznane. */
export function bucketFor(name) {
  const n = normName(name);
  if (!n) return null;
  const hasAga = n.includes("aga") || n.includes("agnies");
  const hasAro = n.includes("aro") || n.includes("arek") || n.includes("arkad");
  const explicitJoint = n.includes("aro-aga") || n.includes("aga-aro") || n.includes("aga-arek") || n.includes("arek-aga");
  if (explicitJoint || (hasAga && hasAro && (n.includes("-") || n.includes("+") || n.includes("/") || n.includes(" ")))) {
    if (hasAga && hasAro) return "AroAga";
  }
  if (n.startsWith("aga") || n.includes("agnies")) return "Aga";
  if (n.startsWith("aro") || n.includes("arek") || n.includes("arkad")) return "Aro";
  return null;
}

/** Miesiąc frachtu jako "YYYY-MM" albo "" gdy brak daty. */
export function miesiacFrachtu(f) {
  return String(f?.dataZaladunku || f?.dataZlecenia || "").slice(0, 7);
}

function agg(list) {
  const zCena = list.filter(f => parseFloat(f.cenaEur));
  const eur = list.reduce((s, f) => s + (parseFloat(f.cenaEur) || 0), 0);
  const km = list.reduce((s, f) => s + (parseInt(f.kmWszystkie) || parseInt(f.kmLadowne) || 0), 0);
  return {
    fr: list.length, eur, km,
    avg: zCena.length ? eur / zCena.length : 0,
    eurkm: km ? eur / km : 0,
  };
}

/**
 * Statystyki dla dowolnego zbioru frachtów, z podziałem na kubełki i udziałami.
 * Frachty bez dyspozytora trafiają do AGA (decyzja usera 2026-06-12) — liczba
 * takich przypadków wraca w `bezDyspozytora`, żeby dało się ją pokazać w nocie.
 */
export function statystyki(frachty) {
  const kub = { Aga: [], Aro: [], AroAga: [] };
  const inni = [];
  let bezDyspozytora = 0;
  for (const f of frachty) {
    let b = bucketFor(f.dyspozytor);
    if (!b && !normName(f.dyspozytor)) { b = "Aga"; bezDyspozytora++; }
    if (b) kub[b].push(f);
    // Pole wypełnione, ale nazwiskiem spoza trójki (Karol, Przemo, „ARUŚ :D"…).
    // NIE zgadujemy, kogo oznacza — trzymamy osobno, żeby suma kubełków nie udawała
    // całości okresu. `total` zostaje sumą trzech kubełków, tak jak w raportach PDF.
    else inni.push(f);
  }
  const total = agg([...kub.Aga, ...kub.Aro, ...kub.AroAga]);
  const udzialy = (x) => ({
    ...x,
    frP: total.fr ? (x.fr / total.fr) * 100 : 0,
    eurP: total.eur ? (x.eur / total.eur) * 100 : 0,
    kmP: total.km ? (x.km / total.km) * 100 : 0,
  });
  const C = agg(kub.AroAga);
  return {
    total,
    Aga: udzialy(agg(kub.Aga)),
    Aro: udzialy(agg(kub.Aro)),
    AroAga: C.fr ? udzialy(C) : null,
    bezDyspozytora,
    inni: { ...agg(inni), nazwiska: [...new Set(inni.map(f => String(f.dyspozytor).trim()))].sort() },
    frachty: kub,
  };
}

/** Statystyki jednego miesiąca "YYYY-MM". */
export function zaMiesiac(frachty, mies) {
  return statystyki(frachty.filter(f => miesiacFrachtu(f) === mies));
}

/** Narastająco od stycznia do wskazanego miesiąca włącznie. */
export function narastajaco(frachty, rok, doMiesiaca) {
  const od = `${rok}-01`, doM = `${rok}-${String(doMiesiaca).padStart(2, "0")}`;
  return statystyki(frachty.filter(f => {
    const m = miesiacFrachtu(f);
    return m >= od && m <= doM;
  }));
}

/** Miesiące roku, w których cokolwiek jeżdżono — do listy wyboru i wykresów. */
export function miesiaceZDanymi(frachty, rok) {
  const set = new Set();
  for (const f of frachty) {
    const m = miesiacFrachtu(f);
    if (m.startsWith(String(rok))) set.add(m);
  }
  return [...set].sort();
}

/** Lata obecne w danych, malejąco. */
export function lataZDanymi(frachty) {
  const set = new Set();
  for (const f of frachty) {
    const m = miesiacFrachtu(f);
    if (m) set.add(+m.slice(0, 4));
  }
  return [...set].sort((a, b) => b - a);
}

/** Poprzedni miesiąc dla "YYYY-MM". */
export function poprzedniMiesiac(mies) {
  const [y, m] = String(mies).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Seria miesięczna jednej metryki dla wykresu/tabeli narastającej. */
export function serieMiesieczne(frachty, rok) {
  return miesiaceZDanymi(frachty, rok).map(m => ({ mies: m, ...zaMiesiac(frachty, m) }));
}
