// Kurs NBP z dnia transakcji — wspólny dla importu paliwa i opłat drogowych.
// Wyjęte z PaliwoTab 2026-09-17, żeby oba importy przeliczały waluty tym samym kodem
// (wcześniej analiza myta liczyła kursem orientacyjnym, co nie nadaje się do księgowania).
//
// Dzień wolny → cofamy się maksymalnie 5 dni wstecz (tabela A nie wychodzi w weekendy
// i święta). PLN = 1. Konwersja: netEUR = netLocal * rate(waluta) / rate(EUR).

const fxCache = new Map();

/** Średni kurs NBP (tabela A) waluty na dzień `isoDate` (YYYY-MM-DD). Null, gdy nie udało się pobrać. */
export async function nbpRate(code, isoDate) {
  const cur = String(code || "PLN").toUpperCase();
  if (cur === "PLN") return 1;
  const key = `${cur}|${isoDate}`;
  if (fxCache.has(key)) return fxCache.get(key);
  let d = new Date(isoDate + "T12:00:00Z");
  for (let i = 0; i < 6; i++) {
    const ds = d.toISOString().slice(0, 10);
    try {
      const r = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${cur.toLowerCase()}/${ds}/?format=json`);
      if (r.ok) {
        const j = await r.json();
        const mid = j?.rates?.[0]?.mid;
        if (mid) { fxCache.set(key, mid); return mid; }
      }
    } catch { /* sieć — próbujemy dzień wcześniej */ }
    d = new Date(d.getTime() - 86400000);
  }
  fxCache.set(key, null);
  return null;
}

/**
 * Kwota w walucie lokalnej → EUR, kursem NBP z dnia transakcji.
 * Zwraca null, gdy któregoś kursu nie udało się pobrać — lepiej brak liczby
 * niż liczba policzona byle czym.
 */
export async function toEUR(amount, currency, isoDay) {
  const cur = String(currency || "EUR").toUpperCase();
  if (cur === "EUR") return amount;
  const [rc, re] = await Promise.all([nbpRate(cur, isoDay), nbpRate("EUR", isoDay)]);
  if (!rc || !re) return null;
  return (amount * rc) / re;
}
