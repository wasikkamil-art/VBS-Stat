// Ranking kierowców — wydzielony z App.jsx 2026-09-16 przy okazji zakładki „Analizy".
// Logika liczenia siedzi w utils/rankingKierowcow.js (wspólna z generatorem PDF),
// tutaj jest tylko prezentacja i wydruk.
import { useState, useMemo, useEffect } from "react";
import { buildRankingi, MIES, MIES_K } from "../utils/rankingKierowcow";

// ═══════════════════════════════════════════════════════════════════
//  RANKING KIEROWCÓW — ten sam układ co prezentacja PDF (15.09.2026)
//  Logika liczenia siedzi w utils/rankingKierowcow.js, żeby zakładka
//  i generator PDF (make_dashboard_rankingi.js) liczyły to samo.
//  „Pobierz PDF" = window.print() + @media print — bez chromium w CF.
// ═══════════════════════════════════════════════════════════════════
export default function RankingTab({ vehicles = [], frachtyList = [], costs = [], operacyjne = [], isAdmin = false }) {
  const [rok, setRok] = useState(new Date().getFullYear());
  // Ranking kosztów widzi TYLKO admin (decyzja usera 15.09) — dyspozytor i podgląd
  // dostają wersję prezentacyjną. Przełącznik zostaje, żeby admin mógł go schować
  // przed wydrukiem, gdy pokazuje zestawienie komuś z zewnątrz (to samo, co
  // BEZ_KOSZTOW=0 w generatorze PDF).
  const [pokazKoszty, setPokazKoszty] = useState(true);

  // Wydruk: klonujemy treść do kontenera bezpośrednio pod <body> i chowamy resztę
  // przez display:none. Pierwsze podejście (visibility:hidden na body *) ZOSTAWIAŁO
  // miejsce po sidebarze i nagłówku — user dostawał 12 stron zamiast 7, bo drukarka
  // dostawała dokument wysokości całej aplikacji. display:none na rodzeństwie
  // kontenera usuwa te elementy z układu i strony wracają 1:1 do sekcji.
  const drukuj = () => {
    const src = document.getElementById("ranking-print");
    if (!src) { window.print(); return; }
    const holder = document.createElement("div");
    holder.id = "ranking-portal";
    // KLASA JEST KONIECZNA: reguły tabeli są zapisane jako `.rank-tab table {...}`,
    // a klon nie dziedziczy klasy z kontenera — bez niej wydruk wychodzi bez ramek
    // i bez odstępów w komórkach (liczby zlewają się w jeden ciąg).
    holder.className = src.className;
    holder.innerHTML = src.innerHTML;
    document.body.appendChild(holder);
    // Klasa na <body> włącza reguły druku tylko na czas tego wywołania. Bez niej
    // zwykłe Cmd+P na zakładce dałoby PUSTĄ stronę (wszystko schowane, klonu brak).
    document.body.classList.add("ranking-printing");
    try { window.print(); } finally {
      document.body.classList.remove("ranking-printing");
      holder.remove();
    }
  };
  const lata = useMemo(() => {
    const set = new Set();
    (costs || []).forEach(c => { const y = Number(String(c?.date || "").slice(0, 4)); if (y) set.add(y); });
    const arr = [...set].sort((a, b) => b - a);
    return arr.length ? arr : [new Date().getFullYear()];
  }, [costs]);
  useEffect(() => { if (!lata.includes(rok)) setRok(lata[0]); }, [lata, rok]);

  const dane = useMemo(() => buildRankingi({
    frachty: frachtyList, costs, operacyjne, vehicles, rok,
    bezKosztow: !(isAdmin && pokazKoszty),
  }), [frachtyList, costs, operacyjne, vehicles, rok, isAdmin, pokazKoszty]);

  const { okres, rankings, pusty, pominieci = [] } = dane;
  const MONTHS = okres.months;
  const podpis = okres.mFrom
    ? `${MIES[okres.mFrom]} – ${MIES[okres.mTo]} ${rok}`.toLowerCase()
    : "brak rozliczonych miesięcy";

  if (pusty) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="text-3xl mb-2">🏁</div>
        <div className="font-semibold text-gray-900 mb-1">Brak danych do rankingu za {rok}</div>
        <p className="text-sm text-gray-500">
          Ranking pokazuje wyłącznie miesiące <b>rozliczone</b> — takie, które mają zaimportowane koszty
          zmienne (paliwo, leasing, wypłaty). Miesiąc z samymi frachtami dałby fikcyjny zysk.
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        #ranking-portal { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          /* wszystko poza klonem znika Z UKŁADU (nie samo „visibility") */
          body.ranking-printing > *:not(#ranking-portal) { display: none !important; }
          body.ranking-printing #ranking-portal { display: block !important; }
          .ranking-noprint { display: none !important; }
          .ranking-page {
            page-break-inside: avoid; break-inside: avoid;
            margin-bottom: 10mm !important;
            border: none !important; box-shadow: none !important;
            border-radius: 0 !important; padding: 0 !important;
          }
          /* kolory drukują się nawet przy odhaczonym „Obraz w tle" */
          #ranking-portal, #ranking-portal * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        .rank-tab table { border-collapse: collapse; width: 100%; font-size: 11.5px; }
        .rank-tab th { text-align: right; padding: 5px 6px; color: #64748b; font-weight: 600;
          border-bottom: 1.5px solid #cbd5e1; font-size: 9px; text-transform: uppercase; letter-spacing: .2px; }
        .rank-tab td { text-align: right; padding: 5px 6px; border-bottom: 1px solid #f1f5f9;
          font-variant-numeric: tabular-nums; }
        .rank-tab th.lbl, .rank-tab td.lbl { text-align: left; }
        .rank-tab td.sum, .rank-tab th.sep { border-left: 1.5px solid #cbd5e1; }
        .rank-tab td.sum { font-weight: 700; font-size: 12.5px; }
        .rank-tab tr.flota td { font-weight: 700; background: #f8fafc; border-top: 1.5px solid #cbd5e1; }
      `}</style>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 ranking-noprint">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Ranking kierowców</h2>
          <p className="text-sm text-gray-400">
            Okres rozliczony: {podpis} · {MONTHS.length} {MONTHS.length === 1 ? "miesiąc" : "miesięcy"} · kwoty netto EUR
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={pokazKoszty} onChange={e => setPokazKoszty(e.target.checked)} />
              Ranking kosztów
            </label>
          )}
          <select value={rok} onChange={e => setRok(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">
            {lata.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={drukuj}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#0071e3" }}>
            📄 Pobierz PDF
          </button>
        </div>
      </div>

      {pominieci.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#78350f" }}>
          <b>Poza rankingiem:</b> {pominieci.map(x => `${x.name} (${x.plate})`).join(", ")} — {pominieci.length === 1 ? "pojazd nie jeździł" : "pojazdy nie jeździły"} w
          {" "}{MIES[okres.mTo].toLowerCase()}, więc wynik z wcześniejszych miesięcy zaburzałby porównanie (np. spalanie z jednego miesiąca wygrywałoby cały ranking).
        </div>
      )}

      <div id="ranking-print" className="rank-tab space-y-5">
        {rankings.map(r => {
          return (
            <div key={r.key} className="ranking-page bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 mb-3 pb-3 border-b border-gray-100">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Ranking — {r.tytul.toLowerCase()}</h3>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {podpis} · {r.podtytul}{r.jednostka ? ` · ${r.jednostka}` : ""}
                    {r.mniejLepiej ? " · mniej = lepiej" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <img src="/app-fleetstat.png" alt="FleetStat" style={{ height: 22, width: "auto" }} />
                  <div className="text-[10px] text-gray-400 leading-tight">VBS Transport<br />{new Date().toLocaleDateString("pl-PL")}</div>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>#</th>
                    <th className="lbl">Kierowca</th>
                    {MONTHS.map(mo => <th key={mo}>{MIES_K[mo]}</th>)}
                    <th className="sep">{r.etykietaRazem}</th>
                    {r.pokazSrednia && <th>Śr./mc</th>}
                    {r.extraNaglowek && <th>{r.extraNaglowek}</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.wiersze.map(w => (
                    <tr key={w.vid}>
                      <td>
                        <span className="inline-block rounded-full text-center"
                          style={{ width: 18, height: 18, lineHeight: "18px", fontSize: 10, fontWeight: 700,
                            background: w.miejsce === 1 ? w.col : "#e2e8f0", color: w.miejsce === 1 ? "#fff" : "#475569" }}>
                          {w.miejsce}
                        </span>
                      </td>
                      <td className="lbl">
                        <span className="inline-block mr-2 align-middle" style={{ width: 8, height: 8, borderRadius: 2, background: w.col }} />
                        <span className="font-semibold text-gray-800">{w.name}</span>
                        <span className="text-gray-400 ml-2 text-[10px]">{w.plate}</span>
                      </td>
                      {w.wartosciTxt.map((v, i) => (
                        <td key={i} style={{ color: w.lider[i] ? w.col : (w.wartosci[i] < 0 ? "#dc2626" : undefined),
                          fontWeight: w.lider[i] ? 700 : undefined }}>{v}</td>
                      ))}
                      <td className="sum" style={{ color: w.suma < 0 ? "#dc2626" : undefined }}>{w.sumaTxt}</td>
                      {r.pokazSrednia && <td className="text-gray-500">{w.sredniaTxt}</td>}
                      {r.extraNaglowek && <td className="text-gray-500">{w.extraTxt}</td>}
                    </tr>
                  ))}
                  <tr className="flota">
                    <td />
                    <td className="lbl">FLOTA — {r.wiersze.length} kierowców</td>
                    {r.flota.wartosciTxt.map((v, i) => <td key={i}>{v}</td>)}
                    <td className="sum">{r.flota.sumaTxt}</td>
                    {r.pokazSrednia && <td>{r.flota.sredniaTxt}</td>}
                    {r.extraNaglowek && <td>{r.flota.extraTxt}</td>}
                  </tr>
                </tbody>
              </table>

              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-600 mb-2">Co widać</div>
                <ul className="space-y-1.5">
                  {r.wnioski.map((segs, i) => (
                    <li key={i} className="text-[11px] text-gray-700 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 text-blue-500">▸</span>
                      {segs.map((sg, j) => sg.b ? <b key={j} className="text-gray-900">{sg.s}</b> : <span key={j}>{sg.s}</span>)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3 pt-2 border-t border-gray-100 text-[9px] text-gray-400 leading-relaxed">
                Źródło: FleetStat — frachty i koszty z bazy, dni w trasie, km licznika oraz litry z danych
                operacyjnych. Kierowca przypisany do pojazdu wg historii kierowców. {r.opisMetody}
                {" "}Ranking obejmuje wyłącznie miesiące rozliczone (z kosztami zmiennymi), żeby wszystkie metryki liczyły ten sam czas.
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
