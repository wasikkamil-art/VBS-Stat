// Kurs NBP z dnia transakcji — wspólny dla importu paliwa i opłat drogowych.
// Wyjęte z PaliwoTab 2026-09-17, żeby oba importy przeliczały waluty tym samym kodem
// (wcześniej analiza myta liczyła kursem orientacyjnym, co nie nadaje się do księgowania).
//
// Dzień wolny → cofamy się maksymalnie 5 dni wstecz (tabela A nie wychodzi w weekendy
// i święta). PLN = 1. Konwersja: netEUR = netLocal * rate(waluta) / rate(EUR).

const fxCache = new Map();

// Nieudane pobrania pamiętamy TYLKO przez chwilę. Wcześniej `null` siadał w cache na stałe:
// jeden mig sieci i do końca życia karty żadna próba dla tego dnia już nie wychodziła.
// Przy imporcie paliwa czy myta to było do przeżycia (lecą raz), ale odkąd kurs blokuje
// zapis frachtu w złotówkach, dyspozytor zostawałby z pustą kwotą aż do przeładowania strony.
// Krótkie okno chroni jednocześnie importy masowe przed zalewem ponowień.
const fxFail = new Map();
const FAIL_TTL_MS = 60_000;

/**
 * Kurs NBP wraz z DNIEM TABELI, z której pochodzi — przy weekendzie i święcie
 * cofamy się wstecz, więc dzień transakcji i dzień kursu to nie zawsze to samo.
 * Zwraca `{ mid, date }` albo `null`. Potrzebne tam, gdzie kurs zapisujemy na stałe
 * (zlecenia w PLN) i trzeba móc odtworzyć, skąd wzięła się kwota.
 */
export async function nbpRateInfo(code, isoDate) {
  const cur = String(code || "PLN").toUpperCase();
  if (cur === "PLN") return { mid: 1, date: isoDate };
  const key = `${cur}|${isoDate}`;
  if (fxCache.has(key)) return fxCache.get(key);
  const nieudane = fxFail.get(key);
  if (nieudane && Date.now() - nieudane < FAIL_TTL_MS) return null;
  let d = new Date(isoDate + "T12:00:00Z");
  for (let i = 0; i < 6; i++) {
    const ds = d.toISOString().slice(0, 10);
    try {
      const r = await fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${cur.toLowerCase()}/${ds}/?format=json`);
      if (r.ok) {
        const j = await r.json();
        const mid = j?.rates?.[0]?.mid;
        if (mid) {
          const info = { mid, date: j?.rates?.[0]?.effectiveDate || ds };
          fxCache.set(key, info);
          return info;
        }
      }
    } catch { /* sieć — próbujemy dzień wcześniej */ }
    d = new Date(d.getTime() - 86400000);
  }
  fxFail.set(key, Date.now());
  return null;
}

/** Średni kurs NBP (tabela A) waluty na dzień `isoDate` (YYYY-MM-DD). Null, gdy nie udało się pobrać. */
export async function nbpRate(code, isoDate) {
  const info = await nbpRateInfo(code, isoDate);
  return info ? info.mid : null;
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
