// Koszt z faktury zatwierdzony w FleetStat → komórka arkusza „Auta VBS 2025” / Total_26 (user, 25.11.2026:
// „jeżeli w FS będzie koszt, to również trzeba go wpisać do arkusza z notatką” → wybrał automat od razu).
//
// Arkusz to ręcznie prowadzony plik finansowy, więc funkcja jest ostrożna:
//  - komórkę znajduje po TREŚCI (rejestracja w wierszu pod „AUTO”, etykieta wiersza w kolumnie B), nie po
//    sztywnych numerach wierszy — układ bywa przesuwany,
//  - NIE nadpisuje, tylko DOPISUJE: pusta → `=-44,93`; liczba lub formuła → ta sama treść + `-44,93`,
//  - do notatki komórki dopisuje, skąd kwota (FV, sprzedawca, data),
//  - po zapisie czyta komórkę i sprawdza wynik; gdy się nie zgadza — przywraca poprzednią treść i zgłasza błąd,
//  - czego nie umie bezpiecznie zrobić (brak bloku auta, tekst w komórce, inny rok) — nie rusza i zwraca powód.
//
// Czysta logika + cienka warstwa I/O przez wstrzyknięte `zadanie({ url, method, data })`, żeby dało się
// puścić próbę na sucho na prawdziwym arkuszu (`naSucho: true` = sam odczyt).

const ARKUSZ_ID = "1LcbdOe8hgRaW0SGhQUMy6mzVABfYgaLZtuF39JcRJc0";
const API = `https://sheets.googleapis.com/v4/spreadsheets/${ARKUSZ_ID}`;
const INNE = "inne (dodaj komentarz)";
// Kategoria kosztu w FleetStat → etykieta wiersza w bloku auta. Czego arkusz nie ma (opony, opłaty drogowe bez
// wskazania dostawcy, kategorie własne) idzie do „inne (dodaj komentarz)” — notatka mówi, co to jest.
const WIERSZ = {
  paliwo: "Paliwo", leasing: "Leasing", wyplata: "Wypłata", zus: "ZUS + podatki", serwis: "Serwis",
  polisa: "Polisa", ubezpieczenie: "Polisa", slickshift: "SlickShift", telefon: "telefon", hotele: "Hotele",
  mandaty: "Mandaty", przyczepa: "Przyczepa", uruchomienie: "koszt uruchomienia auta", imi: "imi spisi", ocpd: "OCPD",
};

const norm = (x) => String(x ?? "").replace(/\s+/g, "").toUpperCase();
const etykieta = (x) => String(x ?? "").trim().toLowerCase();
const pl = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
const kolumna = (miesiac) => String.fromCharCode("C".charCodeAt(0) + miesiac - 1); // C = styczeń … N = grudzień

/** Wiersz (1-based) komórki dla auta i kategorii. `kolB` = wartości kolumny B od wiersza 1. Rzuca z powodem. */
function znajdzWiersz(kolB, rejestracja, kategoria) {
  const rej = norm(rejestracja);
  if (!rej) throw new Error("koszt bez rejestracji auta");
  let start = -1;
  for (let i = 0; i < kolB.length - 1; i++) {
    if (etykieta(kolB[i]) === "auto" && norm(kolB[i + 1]).includes(rej)) { start = i; break; }
  }
  if (start < 0) throw new Error(`w arkuszu nie ma bloku auta ${rejestracja}`);
  const szukana = etykieta(WIERSZ[kategoria] || INNE);
  for (let i = start + 2; i < kolB.length && etykieta(kolB[i]) !== "auto"; i++) {
    if (etykieta(kolB[i]) === szukana) return { wiersz: i + 1, etykieta: String(kolB[i]).trim(), zastepczy: !WIERSZ[kategoria] && kategoria !== "inne" };
  }
  throw new Error(`blok auta ${rejestracja} nie ma wiersza „${WIERSZ[kategoria] || INNE}”`);
}

/** Nowa treść komórki po dopisaniu kosztu `eur` (dodatnia kwota; w arkuszu koszty są ujemne). */
function nowaTresc(stara, eur) {
  const kw = pl(eur);
  if (stara == null || stara === "") return `=-${kw}`;
  if (typeof stara === "number") return `=${pl(stara)}-${kw}`;
  const s = String(stara).trim();
  if (s.startsWith("=")) return `${s}-${kw}`;
  throw new Error(`w komórce jest tekst („${s.slice(0, 30)}”), nie liczba — nie dopisuję`);
}

// ── Serwis: ryczałt jako minimum (user, 25.11.2026) ──
// „Przyjąłem ryczałt na serwis wszędzie -150 € miesięcznie, bo nie miałem wiedzy o serwisach — jeżeli naprawy
// z faktur przekroczą 150 €, kwota ma rosnąć powyżej 150 € z notatkami.” Czyli koszt serwisu w miesiącu to
// WIĘKSZA z kwot: ryczałt albo suma faktur. Zapis w komórce: `=MIN(<ryczałt>;-(<faktura>+<faktura>…))` —
// to, co stało w komórce (np. `-150` albo `=-150*4/18`), zostaje nietknięte jako pierwszy argument.
// Arkusz ma polskie ustawienia: przecinek dziesiętny, średnik między argumentami.
const RYCZALT = /^=MIN\((.+);-\(([\d,+]+)\)\)$/;
const suma = (wyrazenie) => wyrazenie.split("+").reduce((a, x) => a + Number(x.replace(",", ".")), 0);

/** Nowa treść i oczekiwana wartość komórki „Serwis”. `przed` = { tresc, wartosc }. */
function serwisZRyczaltem(przed, eur) {
  const kw = pl(eur);
  const stara = przed.tresc;
  if (typeof stara === "string" && stara.trim() && !stara.trim().startsWith("=")) throw new Error(`w komórce jest tekst („${stara.slice(0, 30)}”), nie liczba — nie dopisuję`);
  const m = typeof stara === "string" ? RYCZALT.exec(stara.trim()) : null;
  if (m) {
    const bylo = suma(m[2]), razem = Math.round((bylo + eur) * 100) / 100;
    // Jeśli komórka pokazywała mniej niż -suma faktur, to wygrywał ryczałt i jego wartość to właśnie `przed.wartosc`.
    const ryczalt = przed.wartosc < -bylo - 0.005 ? przed.wartosc : null;
    return { tresc: `=MIN(${m[1]};-(${m[2]}+${kw}))`, po: ryczalt == null ? -razem : Math.min(ryczalt, -razem), faktury: razem, ryczalt };
  }
  const pierwszy = stara == null || stara === "" ? "0" : typeof stara === "number" ? pl(stara) : String(stara).trim().slice(1);
  return { tresc: `=MIN(${pierwszy};-(${kw}))`, po: Math.min(przed.wartosc, -eur), faktury: eur, ryczalt: przed.wartosc };
}

function notatkaKosztu(k, eur) {
  const d = String(k.date || "").split("-").reverse().join(".");
  return ["FleetStat", k.nrFaktury && `FV ${k.nrFaktury}`, k.sprzedawca, d, `${pl(eur)} € netto`, k.category && `kat. ${k.category}`].filter(Boolean).join(" · ");
}

/**
 * Wpisuje koszt do arkusza. `koszt` = dokument z kolekcji `costs`, `rejestracja` = tablica auta.
 * Zwraca { komorka, przed, po, tresc, notatka } albo rzuca Error z czytelnym powodem.
 */
async function wpiszKoszt({ koszt, rejestracja, zadanie, naSucho = false }) {
  const eur = Number(koszt.amountEUR);
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(koszt.date || ""));
  if (!(eur > 0)) throw new Error("koszt bez kwoty w euro");
  if (!m) throw new Error("koszt bez poprawnej daty");
  if (m[1] !== "2026") throw new Error(`arkusz Total_26 obejmuje rok 2026, a koszt jest z ${m[1]}`);
  const zakladka = "Total_26";
  const kolB = ((await zadanie({ url: `${API}/values/${encodeURIComponent(`${zakladka}!B1:B400`)}?valueRenderOption=UNFORMATTED_VALUE` })).values || []).map(w => w[0] ?? "");
  const cel = znajdzWiersz(kolB, rejestracja, koszt.category);
  const a1 = `${kolumna(Number(m[2]))}${cel.wiersz}`;
  const zakres = encodeURIComponent(`${zakladka}!${a1}`);
  const czytaj = async () => {
    const r = await zadanie({ url: `${API}?ranges=${zakres}&fields=${encodeURIComponent("sheets(properties.sheetId,data.rowData.values(userEnteredValue,effectiveValue,note))")}` });
    const kom = r.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0] || {};
    const u = kom.userEnteredValue || {};
    return {
      sheetId: r.sheets?.[0]?.properties?.sheetId,
      tresc: u.formulaValue ?? u.numberValue ?? u.stringValue ?? "",
      wartosc: kom.effectiveValue?.numberValue ?? (kom.effectiveValue ? NaN : 0),
      notatka: kom.note || "",
    };
  };
  const przed = await czytaj();
  if (Number.isNaN(przed.wartosc)) throw new Error(`komórka ${a1} nie ma wartości liczbowej — nie dopisuję`);
  const serwis = etykieta(cel.etykieta) === "serwis" ? serwisZRyczaltem(przed, eur) : null;
  const tresc = serwis ? serwis.tresc : nowaTresc(przed.tresc, eur);
  const dopisek = notatkaKosztu(koszt, eur) + (cel.zastepczy ? " (brak osobnego wiersza w arkuszu)" : "")
    + (serwis ? ` · faktury razem ${pl(serwis.faktury)} €${serwis.ryczalt ? `, ryczałt ${pl(-serwis.ryczalt)} € — liczy się większa kwota` : ""}` : "");
  const notatka = przed.notatka ? `${przed.notatka}\n${dopisek}` : dopisek;
  const oczekiwane = serwis ? serwis.po : przed.wartosc - eur;
  const wynik = { komorka: `${zakladka}!${a1}`, wiersz: cel.etykieta, przed: przed.wartosc, po: Math.round(oczekiwane * 100) / 100, trescPrzed: przed.tresc, tresc, notatka };
  if (naSucho) return wynik;

  const zapisz = (t, n) => Promise.all([
    zadanie({ url: `${API}/values/${zakres}?valueInputOption=USER_ENTERED`, method: "PUT", data: { values: [[t]] } }),
  ]).then(() => zadanie({ url: `${API}:batchUpdate`, method: "POST", data: { requests: [{ updateCells: {
    range: { sheetId: przed.sheetId, startRowIndex: cel.wiersz - 1, endRowIndex: cel.wiersz, startColumnIndex: Number(m[2]) + 1, endColumnIndex: Number(m[2]) + 2 },
    rows: [{ values: [{ note: n }] }], fields: "note",
  } }] } }));
  await zapisz(tresc, notatka);
  const po = await czytaj();
  if (!(Math.abs(po.wartosc - wynik.po) < 0.011)) {
    // Wynik inny niż oczekiwany (np. arkusz źle zrozumiał formułę) — wracamy do stanu sprzed zapisu.
    await zapisz(przed.tresc, przed.notatka);
    throw new Error(`po zapisie komórka ${a1} miała ${po.wartosc} zamiast ${wynik.po} — przywróciłem poprzednią treść`);
  }
  return wynik;
}

module.exports = { wpiszKoszt, znajdzWiersz, nowaTresc, serwisZRyczaltem, notatkaKosztu, ARKUSZ_ID };
