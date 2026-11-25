// RaportCzasuPracy — podzakładka „Raport czasu pracy" w GPS/Monitoring.
//
// ETAP 1: STAN FAKTYCZNY. Pokazuje, co zapisał tachograf: jazda + inna praca +
// dyspozycyjność, każdy miesiąc osobno, wszyscy kierowcy (także ci, którzy odeszli).
// Widok jest TYLKO DO ODCZYTU — niczego nie zapisuje i niczego nie pozwala zmienić.
// Wymiar etatu i rozkład godzin to etap następny (zasady ustala użytkownik).
//
// Dane: `pobierz(email, odIso, doIso)` oddaje surowe segmenty `driverActivities`. Admin
// trzyma w pamięci tylko okno 45 dni tej kolekcji (koszt Firestore), więc miesiąc wstecz
// dociągamy na żądanie i pamiętamy w stanie komponentu — zmiana miesiąca tam i z powrotem
// nie czyta bazy drugi raz. Funkcja przychodzi z zewnątrz, żeby atrapa `podglad/*` mogła
// podać dane z pliku zamiast z produkcji.

import { useEffect, useMemo, useState } from "react";
import { raportMiesiaca, zakresZapytania, listaMiesiecy, kierowcyZFloty, fmtGodz, fmtKrotko } from "../utils/raportCzasuPracy";

const PIERWSZY_MIESIAC = "2026-09";
const NAZWY_MIES = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const nazwaMiesiaca = (klucz) => { const [r, m] = klucz.split("-").map(Number); return `${NAZWY_MIES[m - 1]} ${r}`; };

const ZRODLA = {
  tacho: { etykieta: "tachograf", tlo: "#ecfdf5", kolor: "#047857" },
  mieszane: { etykieta: "karta urywa się", tlo: "#fffbeb", kolor: "#92400e" },
  inne: { etykieta: "brak karty", tlo: "#fef2f2", kolor: "#b91c1c" },
  brak: { etykieta: "brak zapisu", tlo: "#f3f4f6", kolor: "#4b5563" },
};

const dataPl = (ms) => new Date(ms).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Znaczek({ zrodlo }) {
  const z = ZRODLA[zrodlo] || ZRODLA.brak;
  return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: z.tlo, color: z.kolor }}>{z.etykieta}</span>;
}

// Uwaga o jakości danych w wierszu kierowcy — to, co trzeba wiedzieć, zanim uwierzy się w sumę.
function uwagaDoRaportu(r) {
  const czesci = [];
  if (r.suma.pracaSpozaTacho >= 30) czesci.push(`GPS widzi jeszcze ${fmtKrotko(r.suma.pracaSpozaTacho)} h poza kartą (niewliczone)`);
  if (r.suma.dniBezZapisu > 0) czesci.push(`${r.suma.dniBezZapisu} dni bez żadnego zapisu`);
  return czesci.join(" · ");
}

export default function RaportCzasuPracy({ vehicles = [], pobierz, teraz }) {
  const now = useMemo(() => teraz || new Date(), [teraz]);
  const miesiace = useMemo(() => listaMiesiecy(PIERWSZY_MIESIAC, now), [now]);
  const kierowcy = useMemo(() => kierowcyZFloty(vehicles), [vehicles]);
  // Domyślnie ostatni ZAMKNIĘTY miesiąc — bieżący jest niepełny i mylił by na wejściu.
  const [miesiac, setMiesiac] = useState(() => miesiace[1] || miesiace[0]);
  const [wybrany, setWybrany] = useState(null);
  // dane[miesiac][email] = surowe segmenty | { blad }
  const [dane, setDane] = useState({});

  useEffect(() => {
    if (!miesiac || !pobierz || kierowcy.length === 0) return;
    let zywy = true;
    const [rok, m] = miesiac.split("-").map(Number);
    const { odIso, doIso } = zakresZapytania(rok, m);
    for (const k of kierowcy) {
      if (dane[miesiac]?.[k.email] !== undefined) continue;
      pobierz(k.email, odIso, doIso)
        .then(segm => { if (zywy) setDane(d => ({ ...d, [miesiac]: { ...(d[miesiac] || {}), [k.email]: segm } })); })
        .catch(e => { if (zywy) setDane(d => ({ ...d, [miesiac]: { ...(d[miesiac] || {}), [k.email]: { blad: e?.message || "błąd odczytu" } } })); });
    }
    return () => { zywy = false; };
    // `dane` celowo poza zależnościami: efekt sam je uzupełnia, a pamięć sprawdza przy starcie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miesiac, pobierz, kierowcy]);

  const wiersze = useMemo(() => {
    const [rok, m] = miesiac.split("-").map(Number);
    return kierowcy.map(k => {
      const surowe = dane[miesiac]?.[k.email];
      if (surowe === undefined) return { k, stan: "laduje" };
      if (!Array.isArray(surowe)) return { k, stan: "blad", blad: surowe.blad };
      return { k, stan: "ok", ileSegm: surowe.length, r: raportMiesiaca(surowe, rok, m, now) };
    })
      // Adres bez ani jednego segmentu w miesiącu i bez aktywnego przypisania to stary alias
      // albo kierowca sprzed okresu — nie zaśmieca tabeli. Aktywny zostaje zawsze.
      .filter(w => w.stan !== "ok" || w.ileSegm > 0 || w.k.aktywny);
  }, [dane, miesiac, kierowcy, now]);

  const szczegoly = wiersze.find(w => w.k.email === wybrany && w.stan === "ok") || null;
  const niepelny = wiersze.some(w => w.stan === "ok" && w.r.niepelny);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div>
            <div className="text-base font-bold text-gray-900">Raport czasu pracy kierowców</div>
            <div className="text-xs text-gray-500">Wyłącznie z plików karty kierowcy (DDD): jazda + inna praca + dyspozycyjność. Tylko do odczytu.</div>
          </div>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            Miesiąc
            <select value={miesiac} onChange={e => { setMiesiac(e.target.value); }}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 bg-white">
              {miesiace.map(m => <option key={m} value={m}>{nazwaMiesiaca(m)}</option>)}
            </select>
          </label>
        </div>
        {niepelny && (
          <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
            Miesiąc jeszcze trwa. Sumy sięgają tylko do ostatniego wgranego pliku karty — późniejszych dni w nich nie ma.
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 760 }}>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3 font-semibold">Kierowca</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Dni pracy</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Jazda</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Inna praca</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Dyspozycyjność</th>
                <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Razem</th>
                <th className="py-2 pl-3 font-semibold">Karta do · uwagi</th>
              </tr>
            </thead>
            <tbody>
              {wiersze.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-gray-500">Brak kierowców z adresem e-mail w historii pojazdów.</td></tr>
              )}
              {wiersze.map(w => {
                const zazn = wybrany === w.k.email;
                return (
                  <tr key={w.k.email} onClick={() => w.stan === "ok" && setWybrany(zazn ? null : w.k.email)}
                    className={`border-b border-gray-50 ${w.stan === "ok" ? "cursor-pointer hover:bg-gray-50" : ""}`}
                    style={zazn ? { background: "#f5f3ff" } : undefined}>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-gray-900">{w.k.nazwa}{!w.k.aktywny && <span className="ml-2 text-[11px] font-medium text-gray-500">(bez aktywnego auta)</span>}</div>
                      <div className="text-[11px] text-gray-500">{w.k.auta.join(", ")}</div>
                    </td>
                    {w.stan === "laduje" && <td colSpan={6} className="py-2.5 px-2 text-xs text-gray-500">Wczytuję…</td>}
                    {w.stan === "blad" && <td colSpan={6} className="py-2.5 px-2 text-xs" style={{ color: "#b91c1c" }}>Nie udało się odczytać: {w.blad}</td>}
                    {w.stan === "ok" && (<>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{w.r.suma.dniPracy}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtGodz(w.r.suma.drive)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtGodz(w.r.suma.work)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtGodz(w.r.suma.avail)}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums whitespace-nowrap font-bold text-gray-900">{fmtGodz(w.r.suma.razem)}</td>
                      <td className="py-2.5 pl-3 text-xs text-gray-600">
                        {!w.r.tachoDoMs ? <span style={{ color: "#b91c1c" }}>brak karty w tym okresie</span> : w.r.kartaDoKonca ? "cały miesiąc" : dataPl(w.r.tachoDoMs)}
                        {uwagaDoRaportu(w.r) && <div style={{ color: "#92400e" }}>{uwagaDoRaportu(w.r)}</div>}
                      </td>
                    </>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px] text-gray-500">Kliknij kierowcę, żeby zobaczyć miesiąc dzień po dniu. „Karta do” = koniec ostatniego zapisu z karty kierowcy w tym miesiącu. Czas widziany tylko przez GPS nie wchodzi do sum.</div>
      </div>

      {szczegoly && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <div className="text-sm font-bold text-gray-900">{szczegoly.k.nazwa} — {nazwaMiesiaca(miesiac)}</div>
            <div className="text-xs text-gray-600">Razem <b className="text-gray-900">{fmtGodz(szczegoly.r.suma.razem)}</b> w {szczegoly.r.suma.dniPracy} dniach</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 780 }}>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-semibold">Dzień</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Początek</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Koniec</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Jazda</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Inna praca</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Dyspoz.</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Razem</th>
                  <th className="py-2 px-2 font-semibold text-right whitespace-nowrap">Poza kartą (GPS)</th>
                  <th className="py-2 pl-3 font-semibold">Źródło</th>
                </tr>
              </thead>
              <tbody>
                {szczegoly.r.dni.map(d => (
                  <tr key={d.data} className="border-b border-gray-50" style={d.weekend ? { background: "#fafafa" } : undefined}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      <span className="tabular-nums font-semibold text-gray-900">{String(d.dzienMies).padStart(2, "0")}</span>
                      <span className="ml-1.5 text-xs" style={{ color: d.weekend ? "#b91c1c" : "#6b7280" }}>{d.dzienTyg}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{d.poczatek || "—"}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{d.koniec || "—"}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtKrotko(d.drive)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtKrotko(d.work)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-gray-700">{fmtKrotko(d.avail)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{fmtKrotko(d.razem)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap text-xs" style={{ color: d.pozaKarta > 0 ? "#92400e" : "#9ca3af" }}>{d.pozaKarta > 0 ? fmtKrotko(d.pozaKarta) : "—"}</td>
                    <td className="py-1.5 pl-3"><Znaczek zrodlo={d.zrodlo} />{d.korekta && <span className="ml-1.5 text-[11px] text-gray-500">korekta ręczna</span>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="py-2 pr-3 font-bold text-gray-900" colSpan={3}>Suma miesiąca</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{fmtKrotko(szczegoly.r.suma.drive)}</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{fmtKrotko(szczegoly.r.suma.work)}</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap font-semibold text-gray-900">{fmtKrotko(szczegoly.r.suma.avail)}</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap font-bold text-gray-900">{fmtKrotko(szczegoly.r.suma.razem)}</td>
                  <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap text-xs" style={{ color: "#92400e" }}>{szczegoly.r.suma.pracaSpozaTacho > 0 ? fmtKrotko(szczegoly.r.suma.pracaSpozaTacho) : ""}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
