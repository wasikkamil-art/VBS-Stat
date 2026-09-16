// Dashboard dyspozytorów — to samo, co raport PDF, tylko liczone na żywo.
// Dwa ujęcia: pojedynczy miesiąc (z porównaniem do poprzedniego) i narastająco
// od stycznia. Logika w utils/dyspozytorzy.js — wspólna z generatorem.
import { useState, useMemo } from "react";
import {
  KUBELKI, MIES, zaMiesiac, narastajaco, serieMiesieczne,
  miesiaceZDanymi, lataZDanymi, poprzedniMiesiac,
} from "../utils/dyspozytorzy";

const eur0 = (n) => Math.round(n).toLocaleString("pl-PL") + " €";
const num = (n) => Math.round(n).toLocaleString("pl-PL");
const pl2 = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pl1 = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nazwaMies = (m) => MIES[+String(m).slice(5, 7) - 1] + " " + String(m).slice(0, 4);

// `jednostka`: "%" dla zmiany procentowej, " pkt%" dla różnicy udziałów, "" dla sztuk.
// Bez tego „−63,4" nie mówi, czy to procent, punkt procentowy, czy liczba frachtów.
function Kpi({ etykieta, wartosc, zmiana, jednostka = "", calkowita = false, opis }) {
  const jest = zmiana !== undefined && zmiana !== null && isFinite(zmiana);
  return (
    <div className="rounded-xl border border-gray-200 p-3" style={{ background: "#f8fafc" }}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{etykieta}</div>
      <div className="text-xl font-bold text-gray-900 mt-0.5">{wartosc}</div>
      {jest ? (
        <div className="text-[11px] font-semibold mt-0.5" style={{ color: zmiana >= 0 ? "#16a34a" : "#dc2626" }}>
          {zmiana >= 0 ? "▲ +" : "▼ "}{calkowita ? Math.round(zmiana) : pl1(zmiana)}{jednostka}
          {opis && <span className="text-gray-400 font-normal"> {opis}</span>}
        </div>
      ) : (
        opis ? <div className="text-[11px] text-gray-400 mt-0.5">{opis}</div> : null
      )}
    </div>
  );
}

/** Tabela metryk dla jednego okresu — układ jak w raporcie PDF. */
function TabelaOkresu({ stat, tytul, podtytul }) {
  const kub = KUBELKI.filter(k => stat[k.id]);
  const wiersze = [
    ["Liczba frachtów", (x) => num(x.fr), num(stat.total.fr)],
    ["└ udział %", (x) => pl1(x.frP) + "%", "100%"],
    ["Suma EUR", (x) => eur0(x.eur), eur0(stat.total.eur)],
    ["└ udział %", (x) => pl1(x.eurP) + "%", "100%"],
    ["Średni fracht", (x) => eur0(x.avg), eur0(stat.total.avg)],
    ["Suma km", (x) => num(x.km), num(stat.total.km)],
    ["└ udział %", (x) => pl1(x.kmP) + "%", "100%"],
    ["EUR / km", (x) => pl2(x.eurkm), pl2(stat.total.eurkm)],
  ];
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-white">
      <div className="font-bold text-sm text-gray-900 mb-0.5">{tytul}</div>
      {podtytul && <div className="text-xs text-gray-500 mb-2">{podtytul}</div>}
      <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className="text-left py-1 text-[10px] uppercase text-gray-500 font-semibold">Metryka</th>
            {kub.map(k => (
              <th key={k.id} className="text-right py-1 px-1.5 text-[10px] uppercase font-semibold" style={{ color: k.kolor }}>{k.label}</th>
            ))}
            <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-700 font-bold">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {wiersze.map(([nazwa, fn, tot], i) => {
            const pod = String(nazwa).startsWith("└");
            return (
              <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td className={"py-1 " + (pod ? "pl-3 text-gray-400 text-[10px]" : "text-gray-700")}>{nazwa}</td>
                {kub.map(k => (
                  <td key={k.id} className={"text-right py-1 px-1.5 tabular-nums " + (pod ? "text-gray-400 text-[10px]" : "text-gray-800")}>
                    {fn(stat[k.id])}
                  </td>
                ))}
                <td className={"text-right py-1 px-1.5 tabular-nums font-semibold " + (pod ? "text-gray-400 text-[10px]" : "text-gray-900")}
                    style={{ background: "#f8fafc" }}>{tot}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Nota({ stat }) {
  if (!stat.inni.fr && !stat.bezDyspozytora) return null;
  return (
    <div className="text-[11px] text-gray-500 leading-relaxed mt-2">
      {stat.bezDyspozytora > 0 && (
        <>Frachtów bez wpisanego dyspozytora: <b>{stat.bezDyspozytora}</b> (doliczone do AGA). </>
      )}
      {stat.inni.fr > 0 && (
        <>Poza podziałem: <b>{stat.inni.fr}</b> {stat.inni.fr === 1 ? "fracht" : "frachtów"} za <b>{eur0(stat.inni.eur)}</b> —
          pole dyspozytora wypełnione nazwiskiem spoza trójki ({stat.inni.nazwiska.join(", ")}).
          Te pozycje nie wchodzą do udziałów.</>
      )}
    </div>
  );
}

export default function DyspozytorzyAnaliza({ frachtyList = [] }) {
  const lata = useMemo(() => lataZDanymi(frachtyList), [frachtyList]);
  const [rok, setRok] = useState(() => lataZDanymi(frachtyList)[0] || new Date().getFullYear());
  const [tryb, setTryb] = useState("miesiac");

  const miesiace = useMemo(() => miesiaceZDanymi(frachtyList, rok), [frachtyList, rok]);
  const [mies, setMies] = useState(null);
  const aktMies = mies && miesiace.includes(mies) ? mies : miesiace[miesiace.length - 1];

  const stat = useMemo(() => (aktMies ? zaMiesiac(frachtyList, aktMies) : null), [frachtyList, aktMies]);
  const poprz = useMemo(() => (aktMies ? zaMiesiac(frachtyList, poprzedniMiesiac(aktMies)) : null), [frachtyList, aktMies]);
  const ostatniMies = aktMies ? +aktMies.slice(5, 7) : 12;
  const ytd = useMemo(() => narastajaco(frachtyList, rok, ostatniMies), [frachtyList, rok, ostatniMies]);
  const seria = useMemo(() => serieMiesieczne(frachtyList, rok), [frachtyList, rok]);

  if (!aktMies || !stat) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">
      Brak frachtów w wybranym roku.
    </div>;
  }

  const dObrot = poprz.total.eur ? (stat.total.eur / poprz.total.eur - 1) * 100 : null;
  const dFr = stat.total.fr - poprz.total.fr;
  const dAro = stat.Aro.eurP - poprz.Aro.eurP;
  const dAga = stat.Aga.eurP - poprz.Aga.eurP;
  const okresYtd = `styczeń – ${MIES[ostatniMies - 1]} ${rok}`;

  return (
    <div className="space-y-4">
      {/* sterowanie */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f3f4f6" }}>
          {[["miesiac", "Miesiąc"], ["ytd", "Narastająco"]].map(([id, label]) => (
            <button key={id} onClick={() => setTryb(id)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: tryb === id ? "#fff" : "transparent", color: tryb === id ? "#111827" : "#9ca3af",
                       boxShadow: tryb === id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>
        {lata.length > 1 && (
          <select value={rok} onChange={e => { setRok(+e.target.value); setMies(null); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
            {lata.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <select value={aktMies} onChange={e => setMies(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {miesiace.map(m => <option key={m} value={m}>{nazwaMies(m)}</option>)}
        </select>
        {tryb === "ytd" && <span className="text-xs text-gray-500">narastająco do: {MIES[ostatniMies - 1]}</span>}
      </div>

      {tryb === "miesiac" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi etykieta={`Obrót — ${MIES[ostatniMies - 1]}`} wartosc={eur0(stat.total.eur)}
                 zmiana={dObrot} jednostka="%" opis={`vs ${eur0(poprz.total.eur)}`} />
            <Kpi etykieta="Frachty" wartosc={stat.total.fr} zmiana={dFr} calkowita
                 opis={`vs ${poprz.total.fr}`} />
            <Kpi etykieta="Udział ARO · obrót" wartosc={pl1(stat.Aro.eurP) + "%"} zmiana={dAro} jednostka=" pkt%" />
            <Kpi etykieta="Udział AGA · obrót" wartosc={pl1(stat.Aga.eurP) + "%"} zmiana={dAga} jednostka=" pkt%" />
          </div>
          <TabelaOkresu stat={stat} tytul={nazwaMies(aktMies)} podtytul={`${stat.total.fr} frachtów`} />
          <Nota stat={stat} />
          {poprz.total.fr > 0 && (
            <TabelaOkresu stat={poprz} tytul={nazwaMies(poprzedniMiesiac(aktMies))}
                          podtytul={`${poprz.total.fr} frachtów · kontekst porównawczy`} />
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Kpi etykieta="Obrót narastająco" wartosc={eur0(ytd.total.eur)} opis={okresYtd} />
            <Kpi etykieta="Frachty" wartosc={ytd.total.fr} opis={`śr. ${eur0(ytd.total.avg)} za fracht`} />
            <Kpi etykieta="Udział ARO · obrót" wartosc={pl1(ytd.Aro.eurP) + "%"} opis={eur0(ytd.Aro.eur)} />
            <Kpi etykieta="Udział AGA · obrót" wartosc={pl1(ytd.Aga.eurP) + "%"} opis={eur0(ytd.Aga.eur)} />
          </div>
          <TabelaOkresu stat={ytd} tytul={okresYtd} podtytul={`${ytd.total.fr} frachtów narastająco`} />
          <Nota stat={ytd} />

          <div className="rounded-xl border border-gray-200 p-3 bg-white">
            <div className="font-bold text-sm text-gray-900 mb-2">Miesiąc po miesiącu <span className="font-normal text-gray-500">· udział w obrocie</span></div>
            <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="text-left py-1 text-[10px] uppercase text-gray-500 font-semibold">Miesiąc</th>
                  <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">Frachty</th>
                  <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">Obrót</th>
                  {KUBELKI.map(k => (
                    <th key={k.id} className="text-right py-1 px-1.5 text-[10px] uppercase font-semibold" style={{ color: k.kolor }}>{k.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seria.map(s => (
                  <tr key={s.mies} style={{ borderTop: "1px solid #f1f5f9", background: s.mies === aktMies ? "#eff6ff" : "transparent" }}>
                    <td className="py-1 text-gray-700">{MIES[+s.mies.slice(5, 7) - 1]}</td>
                    <td className="text-right py-1 px-1.5 tabular-nums text-gray-800">{s.total.fr}</td>
                    <td className="text-right py-1 px-1.5 tabular-nums text-gray-800">{eur0(s.total.eur)}</td>
                    {KUBELKI.map(k => (
                      <td key={k.id} className="text-right py-1 px-1.5 tabular-nums"
                          style={{ color: s[k.id] ? k.kolor : "#d1d5db" }}>
                        {s[k.id] ? pl1(s[k.id].eurP) + "%" : "–"}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #cbd5e1", background: "#f8fafc" }}>
                  <td className="py-1 font-bold text-gray-900">RAZEM</td>
                  <td className="text-right py-1 px-1.5 tabular-nums font-bold">{ytd.total.fr}</td>
                  <td className="text-right py-1 px-1.5 tabular-nums font-bold">{eur0(ytd.total.eur)}</td>
                  {KUBELKI.map(k => (
                    <td key={k.id} className="text-right py-1 px-1.5 tabular-nums font-bold" style={{ color: ytd[k.id] ? k.kolor : "#d1d5db" }}>
                      {ytd[k.id] ? pl1(ytd[k.id].eurP) + "%" : "–"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="text-[11px] text-gray-400 leading-relaxed">
        Źródło: frachty z bazy, kwoty netto EUR, przypisanie do miesiąca po dacie załadunku (zapasowo po dacie zlecenia).
        Kubełkowanie: warianty „Aga/Agnieszka" → AGA, „Aro/Arek/Arkadiusz" → ARO, pole z oboma nazwiskami → ARO-AGA.
      </div>
    </div>
  );
}
