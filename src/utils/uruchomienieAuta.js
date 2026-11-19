// uruchomienieAuta — wzorzec listy „Uruchomienie auta" i liczenie sum (czysta logika, bez Reacta).
//
// Jedna lista robi dwie rzeczy naraz (decyzja usera 19.11.2026):
//   • LISTA KONTROLNA wydania auta — dyspozytor odhacza, co jest na aucie; wydruk idzie do podpisu
//     kierowcy i dyspozytora (bez kwot);
//   • KOSZT URUCHOMIENIA — przy pozycjach stoją kwoty; do panelu Koszty ma trafiać tylko SUMA,
//     żeby nie zaśmiecać kosztów drobnicą (kamizelka, skrobaczka, zszywacz).
//
// Wzorzec przepisany z arkusza „Auta VBS 2025", karta „(auta/wymiar/wysyłka)", kolumna F.
// Kwot z kolumny G tu NIE MA — są różne dla każdego auta i wpisuje je człowiek albo AI z faktury.

export const GRUPY_URUCHOMIENIA = [
  "Dokumenty i karty",
  "Mocowanie ładunku",
  "BHP i porządek",
  "Kabina i biuro",
  "ADR",
  "Doposażenie i serwis",
  "Paliwo na start",
  "Inne",
];

// `koszt: true` = pozycja czysto kosztowa: nie ma jej czym odhaczyć przy wydaniu auta
// i nie trafia na wydruk listy kontrolnej (polisa, reklama na plandece, tankowanie).
const W = (grupa, nazwa, koszt = false) => ({ grupa, nazwa, koszt });
export const WZORZEC_URUCHOMIENIA = [
  W("Dokumenty i karty", "Polisa", true),
  W("Dokumenty i karty", "Polisa OCP", true),
  W("Dokumenty i karty", "Wypis z licencji"),
  W("Dokumenty i karty", "Karta paliwowa 1"),
  W("Dokumenty i karty", "Karta paliwowa 2"),
  W("Dokumenty i karty", "Karta paliwowa 3"),
  W("Dokumenty i karty", "Karta paliwowa 4"),
  W("Mocowanie ładunku", "Paleciak"),
  W("Mocowanie ładunku", "Pasy transportowe (6 szt.)"),
  W("Mocowanie ładunku", "Belki naburtowe (2 szt.)"),
  W("Mocowanie ładunku", "Koszt na pasy", true),
  W("Mocowanie ładunku", "Narożniki"),
  W("BHP i porządek", "Kamizelka"),
  W("BHP i porządek", "Kask"),
  W("BHP i porządek", "Buty ochronne"),
  W("BHP i porządek", "Rękawice"),
  W("BHP i porządek", "Płyn do spryskiwacza"),
  W("BHP i porządek", "Szczotka na pakę"),
  W("BHP i porządek", "Skrobaczka"),
  W("BHP i porządek", "Gaśnica 2 kg (2 szt.)"),
  W("BHP i porządek", "Miarka"),
  W("Kabina i biuro", "Lodówka"),
  W("Kabina i biuro", "Kable rozruchowe"),
  W("Kabina i biuro", "Power bank"),
  W("Kabina i biuro", "Czytnik tacho"),
  W("Kabina i biuro", "Teczka"),
  W("Kabina i biuro", "Zszywacz"),
  W("Kabina i biuro", "Pieczątka"),
  W("Kabina i biuro", "Papier do tacho"),
  W("Kabina i biuro", "Nawigacja"),
  W("Kabina i biuro", "Bezpieczniki"),
  W("Kabina i biuro", "Firanki"),
  W("Kabina i biuro", "Łańcuchy"),
  W("ADR", "Zestaw ADR"),
  W("Doposażenie i serwis", "Lampy LED"),
  W("Doposażenie i serwis", "Dodatkowy akumulator"),
  W("Doposażenie i serwis", "Wymiana opon", true),
  W("Doposażenie i serwis", "Autopasja", true),
  W("Doposażenie i serwis", "Reklama na plandece", true),
  W("Doposażenie i serwis", "Opony zimowe"),
  W("Doposażenie i serwis", "For Cargo (pasy, narożniki)", true),
  W("Paliwo na start", "Paliwo do pełna", true),
  W("Paliwo na start", "Paliwo z Wrocławia", true),
];

const losowyId = () => Math.random().toString(36).slice(2, 10);

export const nowaPozycja = (extra = {}) => ({
  id: losowyId(), grupa: "Inne", nazwa: "", koszt: false, jest: false, ilosc: "",
  kwota: "", waluta: "PLN", data: "", kwotaEur: null, kursData: "", plikUrl: "", plikNazwa: "", ...extra,
});

/** Świeża lista z wzorca — wszystko nieodhaczone, bez kwot. */
export const nowaLista = () => WZORZEC_URUCHOMIENIA.map(w => nowaPozycja(w));

/** „929,6" / „1 670,00 zł" → liczba; pusty lub nieczytelny wpis → null (nie zero!). */
export function liczba(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/\s/g, "").replace(/[^\d,.-]/g, "").replace(",", ".");  // \s łapie też twardą spację
  if (s === "" || s === "-" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Sumy do nagłówka panelu.
 * `eur` liczymy WYŁĄCZNIE z zapisanych `kwotaEur` — pozycja z kwotą, ale bez przeliczenia
 * (brak daty albo kursu) ląduje w `bezKursu` i suma w euro jest wtedy jawnie niepełna.
 */
export function sumyUruchomienia(pozycje) {
  const out = { doOdhaczenia: 0, odhaczone: 0, zKwota: 0, bezKursu: 0, eur: 0, wgWaluty: {} };
  for (const p of pozycje || []) {
    if (!p.koszt) { out.doOdhaczenia++; if (p.jest) out.odhaczone++; }
    const k = liczba(p.kwota);
    if (k == null || k === 0) continue;
    out.zKwota++;
    const w = p.waluta || "PLN";
    out.wgWaluty[w] = (out.wgWaluty[w] || 0) + k;
    if (w === "EUR") out.eur += k;
    else if (typeof p.kwotaEur === "number") out.eur += p.kwotaEur;
    else out.bezKursu++;
  }
  return out;
}

/**
 * Przelicza pozycje w walucie obcej na euro kursem z dnia zakupu (albo z `domyslnaData`,
 * gdy pozycja nie ma własnej). `naEur(kwota, waluta, data)` zwraca liczbę albo null.
 * Brak daty lub kursu = `kwotaEur: null` — nigdy kwota zastępcza.
 */
export async function przeliczPozycje(pozycje, domyslnaData, naEur) {
  const out = [];
  for (const p of pozycje) {
    const k = liczba(p.kwota), w = p.waluta || "PLN", data = p.data || domyslnaData || "";
    if (k == null || k === 0) { out.push({ ...p, kwotaEur: null, kursData: "" }); continue; }
    if (w === "EUR") { out.push({ ...p, kwotaEur: k, kursData: "" }); continue; }
    if (!data) { out.push({ ...p, kwotaEur: null, kursData: "" }); continue; }
    const eur = await naEur(k, w, data);
    out.push({ ...p, kwotaEur: typeof eur === "number" && Number.isFinite(eur) ? Math.round(eur * 100) / 100 : null, kursData: data });
  }
  return out;
}

/**
 * Dopasowanie odczytu AI do listy: wskazana pozycja bez kwoty dostaje kwotę; gdy już ma kwotę
 * (druga faktura na to samo) albo AI nie wskazało pozycji — powstaje NOWA pozycja, nic nie nadpisujemy.
 * Zwraca { pozycje, id, nowa }.
 */
export function wpiszOdczyt(pozycje, odczyt, plik, celId = null) {
  const kwota = liczba(odczyt?.kwotaNetto);
  const pola = {
    kwota: kwota == null ? "" : String(kwota).replace(".", ","),
    waluta: ["PLN", "EUR"].includes(odczyt?.waluta) ? odczyt.waluta : "PLN",
    data: /^\d{4}-\d{2}-\d{2}$/.test(odczyt?.data || "") ? odczyt.data : "",
    plikUrl: plik?.url || "", plikNazwa: plik?.nazwa || "", kwotaEur: null, kursData: "",
  };
  const norm = (s) => String(s || "").trim().toLowerCase();
  let cel = celId ? pozycje.find(p => p.id === celId) : pozycje.find(p => norm(p.nazwa) && norm(p.nazwa) === norm(odczyt?.pozycja));
  if (cel && !celId && liczba(cel.kwota)) cel = null; // nie nadpisujemy kwoty wpisanej wcześniej
  if (cel) {
    const bezDaty = pola.data ? {} : { data: cel.data };
    return { pozycje: pozycje.map(p => (p.id === cel.id ? { ...p, ...pola, ...bezDaty } : p)), id: cel.id, nowa: false };
  }
  const wzor = pozycje.find(p => norm(p.nazwa) === norm(odczyt?.pozycja));
  const nowa = nowaPozycja({ ...pola, grupa: wzor?.grupa || "Inne", koszt: wzor ? wzor.koszt : true, nazwa: odczyt?.opis || odczyt?.pozycja || plik?.nazwa || "Dokument" });
  return { pozycje: [...pozycje, nowa], id: nowa.id, nowa: true };
}
