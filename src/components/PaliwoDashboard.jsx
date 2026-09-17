// Dashboard pod mapą w zakładce Paliwo — trzy kafelki w wąskiej kolumnie (~545 px).
// Mapa odpowiada GDZIE tankowali; tu jest KIEDY, PO ILE i U KOGO.
//
// Czyta te same transakcje, które widać na mapie (czyli PO filtrach: auta, karty,
// produkt, kraj) — inaczej wykres kłóciłby się z pinami obok. Świadomie NIE liczy
// z całego miesiąca; od tego jest panel „Podsumowanie miesiąca” nad mapą.
//
// Wykresy rysowane inline SVG, nie biblioteką: kolumna jest wąska i gęsta, a układ
// (słupki litrów + punkty cen na wspólnej osi dni) trudno ścisnąć w gotowy komponent.

import { useMemo } from "react";
import { FLAG } from "../utils/fuelParsers";

const eur = n => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const p3 = n => (Number(n) || 0).toLocaleString("pl-PL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const litr = n => Math.round(Number(n) || 0).toLocaleString("pl-PL") + " L";

const TANIO = "#16a34a";
const DROGO = "#dc2626";
const NEUTR = "#0071e3";

const dniWMiesiacu = m => new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();

// Kafelek — ta sama rama co reszta panelu
function Kafelek({ tytul, podtytul, children, stopka }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{tytul}</div>
      {podtytul && <div className="text-[11px] text-gray-400 mb-2">{podtytul}</div>}
      {children}
      {stopka && <div className="text-[11px] text-gray-400 mt-2 leading-relaxed">{stopka}</div>}
    </div>
  );
}

export default function PaliwoDashboard({ txs = [], month, plateOf = id => id, product = "on" }) {
  const dane = useMemo(() => {
    const ok = txs.filter(t => t.ts && t.liters > 0);
    if (!ok.length || !month) return null;

    const dni = dniWMiesiacu(month);
    const litrowRazem = ok.reduce((s, t) => s + t.liters, 0);
    const kosztRazem = ok.reduce((s, t) => s + (t.netEUR || 0), 0);
    const sredniaFloty = litrowRazem ? kosztRazem / litrowRazem : 0;

    // ── 1. Dzień po dniu ──
    const poDniach = Array.from({ length: dni }, (_, i) => ({ dzien: i + 1, l: 0, e: 0, tx: [] }));
    for (const t of ok) {
      const d = +t.ts.slice(8, 10);
      const o = poDniach[d - 1];
      if (!o) continue;
      o.l += t.liters; o.e += t.netEUR || 0; o.tx.push(t);
    }
    const maxL = Math.max(...poDniach.map(d => d.l), 1);

    // Skala cen wspólna dla obu wykresów, żeby dało się je czytać razem
    const ceny = ok.map(t => t.pricePerLNet).filter(v => v > 0);
    const cMin = ceny.length ? Math.min(...ceny) : 0;
    const cMax = ceny.length ? Math.max(...ceny) : 1;
    // Gdy wszystkie ceny są takie same (np. jedno tankowanie po filtrach), rozpiętość
    // wynosi zero — wtedy kropki lądują na środku, a nie przyklejone do dolnej krawędzi.
    const plaska = cMax - cMin < 1e-9;
    const skalaCeny = v => plaska ? 0.5 : 1 - (v - cMin) / (cMax - cMin);   // 0 = góra (drogo), 1 = dół

    // ── 2. Stacje ──
    // Średnią kraju liczymy BEZ tej stacji — inaczej stacja porównywałaby się
    // sama ze sobą i przy jednej stacji w kraju odchyłka zawsze wychodziłaby 0.
    const wKraju = {};
    for (const t of ok) {
      const cc = t.country || "??";
      const o = wKraju[cc] = wKraju[cc] || { l: 0, e: 0 };
      o.l += t.liters; o.e += t.netEUR || 0;
    }
    const stacje = {};
    for (const t of ok) {
      const nazwa = (t.station || "—").trim();
      const cc = t.country || "??";
      const k = `${cc}|${nazwa.toLowerCase()}`;
      const o = stacje[k] = stacje[k] || { nazwa, cc, l: 0, e: 0, n: 0 };
      o.l += t.liters; o.e += t.netEUR || 0; o.n++;
    }
    const listaStacji = Object.values(stacje).map(s => {
      const cena = s.l ? s.e / s.l : 0;
      const reszta = wKraju[s.cc];
      const lRes = reszta.l - s.l, eRes = reszta.e - s.e;
      const cenaKraju = lRes > 0 ? eRes / lRes : null;       // null = brak z czym porównać
      const delta = cenaKraju == null ? null : cena - cenaKraju;
      return { ...s, cena, cenaKraju, delta, nadplata: delta == null ? null : delta * s.l };
    }).sort((a, b) => (b.nadplata ?? -Infinity) - (a.nadplata ?? -Infinity));

    // ── 3. Auta ──
    const auta = {};
    for (const t of ok) {
      const o = auta[t.vehicleId] = auta[t.vehicleId] || { vid: t.vehicleId, l: 0, e: 0, tx: [] };
      o.l += t.liters; o.e += t.netEUR || 0; o.tx.push(t);
    }
    const listaAut = Object.values(auta)
      .map(a => ({ ...a, cena: a.l ? a.e / a.l : 0 }))
      .sort((a, b) => b.l - a.l);

    return { dni, poDniach, maxL, sredniaFloty, litrowRazem, kosztRazem, plaska,
      skalaCeny, cMin, cMax, listaStacji, listaAut, ile: ok.length };
  }, [txs, month]);

  if (!dane) return null;

  const { dni, poDniach, maxL, sredniaFloty, skalaCeny, cMin, cMax, plaska, listaStacji, listaAut } = dane;

  // Geometria wykresu dziennego
  const SZER = 520, WYS = 150, MARG_L = 4, MARG_P = 34, MARG_G = 8, MARG_D = 16;
  const pole = SZER - MARG_L - MARG_P;
  const wys = WYS - MARG_G - MARG_D;
  const xDnia = d => MARG_L + (pole / dni) * (d - 0.5);
  const szerSlupka = Math.max(3, pole / dni - 2.5);
  const yCeny = v => MARG_G + skalaCeny(v) * wys;

  const etykietyDni = Array.from({ length: dni }, (_, i) => i + 1).filter(d => d === 1 || d % 5 === 0);

  return (
    <div className="space-y-4">
      {/* ── 1. KIEDY I PO ILE ── */}
      <Kafelek
        tytul="⛽ Kiedy tankowali i po ile"
        podtytul={`Słupek = litry danego dnia · kropka = jedno tankowanie, wysokość to cena €/L`}
        stopka={<>
          Kropki <b style={{ color: TANIO }}>zielone</b> są tańsze, <b style={{ color: DROGO }}>czerwone</b> droższe
          od średniej floty w tym widoku (<b>{p3(sredniaFloty)} €/L</b>, przerywana linia).{" "}
          {plaska ? <>Wszystkie tankowania w tym widoku po <b>{p3(cMin)} €/L</b>.</> : <>Skala cen: {p3(cMin)}–{p3(cMax)} €/L.</>}
          {" "}Wielkość kropki = litry.
        </>}>
        <svg viewBox={`0 0 ${SZER} ${WYS}`} className="w-full" style={{ height: WYS }}>
          {/* linia średniej floty */}
          {sredniaFloty >= cMin && sredniaFloty <= cMax && (
            <line x1={MARG_L} x2={SZER - MARG_P} y1={yCeny(sredniaFloty)} y2={yCeny(sredniaFloty)}
              stroke="#c7c7cc" strokeWidth="1" strokeDasharray="3 3" />
          )}
          {/* oś cen po prawej — przy jednej cenie tylko jedna etykieta, na jej wysokości */}
          {plaska ? (
            <text x={SZER - MARG_P + 4} y={yCeny(cMin) + 3} fontSize="9" fill="#c7c7cc">{p3(cMin)}</text>
          ) : (<>
            <text x={SZER - MARG_P + 4} y={MARG_G + 4} fontSize="9" fill="#c7c7cc">{p3(cMax)}</text>
            <text x={SZER - MARG_P + 4} y={MARG_G + wys} fontSize="9" fill="#c7c7cc">{p3(cMin)}</text>
          </>)}

          {/* słupki litrów — od dołu, przygaszone, żeby nie zabijały kropek */}
          {poDniach.map(d => d.l > 0 && (
            <rect key={"s" + d.dzien} x={xDnia(d.dzien) - szerSlupka / 2}
              y={MARG_G + wys - (d.l / maxL) * wys * 0.55}
              width={szerSlupka} height={(d.l / maxL) * wys * 0.55}
              fill={NEUTR} opacity="0.13" rx="1">
              <title>{`${d.dzien}. — ${litr(d.l)}, ${eur(d.e)}`}</title>
            </rect>
          ))}

          {/* kropki cen */}
          {poDniach.flatMap(d => d.tx.filter(t => t.pricePerLNet > 0).map((t, i) => (
            <circle key={`c${d.dzien}_${i}`} cx={xDnia(d.dzien)} cy={yCeny(t.pricePerLNet)}
              r={Math.max(2, Math.min(5, Math.sqrt(t.liters) / 3.6))}
              fill={t.pricePerLNet > sredniaFloty ? DROGO : TANIO} opacity="0.75">
              <title>{`${d.dzien}. ${plateOf(t.vehicleId)} · ${FLAG[t.country] || t.country || "?"} ${t.station || ""}\n`
                + `${litr(t.liters)} po ${p3(t.pricePerLNet)} €/L = ${eur(t.netEUR)}`}</title>
            </circle>
          )))}

          {/* oś dni */}
          <line x1={MARG_L} x2={SZER - MARG_P} y1={MARG_G + wys} y2={MARG_G + wys} stroke="#e5e5ea" strokeWidth="1" />
          {etykietyDni.map(d => (
            <text key={"d" + d} x={xDnia(d)} y={WYS - 4} fontSize="9" fill="#c7c7cc" textAnchor="middle">{d}</text>
          ))}
        </svg>
      </Kafelek>

      {/* ── 2. STACJE ── */}
      <Kafelek
        tytul="🏪 Gdzie jest drogo"
        podtytul="Stacje uszeregowane po nadpłacie wobec reszty kraju"
        stopka={<>
          <b>Δ</b> = cena stacji minus średnia kraju <b>bez tej stacji</b> (inaczej stacja porównywałaby się sama ze sobą).
          <b> Nadpłata</b> = Δ × litry, czyli ile realnie kosztowało tankowanie akurat tutaj.
          „—” znaczy, że w tym kraju nie ma innych tankowań do porównania.
        </>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="text-[10px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="text-left pb-1">Stacja</th>
                <th className="text-right pb-1 px-1">Tank.</th>
                <th className="text-right pb-1 px-1">Litry</th>
                <th className="text-right pb-1 px-1">€/L</th>
                <th className="text-right pb-1 px-1">Δ</th>
                <th className="text-right pb-1">Nadpłata</th>
              </tr>
            </thead>
            <tbody>
              {listaStacji.slice(0, 8).map(s => (
                <tr key={s.cc + s.nazwa} className="border-t border-gray-100">
                  <td className="py-1 pr-1">
                    <span className="mr-1">{FLAG[s.cc] || ""}</span>
                    <span className="text-gray-900" title={s.nazwa}>
                      {s.nazwa.length > 26 ? s.nazwa.slice(0, 25) + "…" : s.nazwa}
                    </span>
                  </td>
                  <td className="py-1 px-1 text-right tabular-nums text-gray-500">{s.n}</td>
                  <td className="py-1 px-1 text-right tabular-nums text-gray-500">{litr(s.l)}</td>
                  <td className="py-1 px-1 text-right tabular-nums font-semibold">{p3(s.cena)}</td>
                  <td className="py-1 px-1 text-right tabular-nums"
                    style={{ color: s.delta == null ? "#c7c7cc" : s.delta > 0 ? DROGO : TANIO }}>
                    {s.delta == null ? "—" : (s.delta > 0 ? "+" : "") + p3(s.delta)}
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold"
                    style={{ color: s.nadplata == null ? "#c7c7cc" : s.nadplata > 0 ? DROGO : TANIO }}>
                    {s.nadplata == null ? "—" : (s.nadplata > 0 ? "+" : "") + eur(s.nadplata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listaStacji.length > 8 && (
            <div className="text-[11px] text-gray-400 mt-1">
              …i {listaStacji.length - 8} {listaStacji.length - 8 === 1 ? "stacja" : "innych stacji"} bliżej średniej.
            </div>
          )}
        </div>
      </Kafelek>

      {/* ── 3. AUTA ── */}
      <Kafelek
        tytul="🚚 Każde auto osobno"
        podtytul="Ta sama skala cen i dni co na wykresie wyżej — paski są porównywalne między sobą"
        stopka="Kropka = tankowanie, wielkość = litry, kolor względem średniej floty. Pusty pasek = auto nie tankowało w tym miesiącu (albo odfiltrowane).">
        <div className="space-y-1.5">
          {listaAut.map(a => (
            <div key={a.vid} className="flex items-center gap-2 border-t border-gray-50 pt-1.5 first:border-0 first:pt-0">
              <div className="w-[92px] shrink-0 leading-tight">
                <div className="text-[12px] font-medium text-gray-900 truncate">{plateOf(a.vid)}</div>
                <div className="text-[10px] text-gray-400 tabular-nums">{litr(a.l)}</div>
                <div className="text-[10px] text-gray-400 tabular-nums">{p3(a.cena)} €/L</div>
              </div>
              <svg viewBox={`0 0 ${SZER} 34`} className="flex-1" style={{ height: 34 }}>
                <line x1={MARG_L} x2={SZER - MARG_P} y1="17" y2="17" stroke="#f2f2f7" strokeWidth="1" />
                {a.tx.filter(t => t.pricePerLNet > 0).map((t, i) => {
                  const d = +t.ts.slice(8, 10);
                  return (
                    <circle key={i} cx={xDnia(d)} cy={4 + skalaCeny(t.pricePerLNet) * 26}
                      r={Math.max(2, Math.min(5, Math.sqrt(t.liters) / 3.6))}
                      fill={t.pricePerLNet > sredniaFloty ? DROGO : TANIO} opacity="0.75">
                      <title>{`${d}. ${FLAG[t.country] || t.country || "?"} ${t.station || ""}\n`
                        + `${litr(t.liters)} po ${p3(t.pricePerLNet)} €/L = ${eur(t.netEUR)}`}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>
          ))}
        </div>
      </Kafelek>

      <div className="text-[11px] text-gray-400 leading-relaxed px-1">
        Wszystkie trzy kafelki pokazują <b>to, co widać na mapie</b> — czyli po filtrach auta / karty / produkt / kraj
        ({product === "adblue" ? "teraz AdBlue" : "teraz diesel"}). Pełne liczby miesiąca są w „Podsumowaniu miesiąca” nad mapą.
      </div>
    </div>
  );
}
