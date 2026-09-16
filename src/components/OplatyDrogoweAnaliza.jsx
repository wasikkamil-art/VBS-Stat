// Opłaty drogowe — skąd biorą się zmiany kosztu myta i czy dostawcy naliczają poprawnie.
// Czyta gotowe analizy z kolekcji `tollAnalysis/{YYYY-MM}`. Sierpień i lipiec policzone
// ręcznie z eksportów (pole `zrodlo: "reczna"`); od października dane mają pochodzić
// z licznika CAN (countryKmDaily) i importu transakcji — struktura dokumentu ta sama.
import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const MIES = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const KRAJ = { DE: "Niemcy", FR: "Francja", ES: "Hiszpania", PL: "Polska", BE: "Belgia",
  NL: "Holandia", AT: "Austria", CZ: "Czechy", CH: "Szwajcaria", IT: "Włochy",
  PT: "Portugalia", LU: "Luksemburg", HU: "Węgry", SK: "Słowacja" };

const eur0 = (n) => Math.round(n).toLocaleString("pl-PL") + " €";
const num = (n) => Math.round(n).toLocaleString("pl-PL");
const pl1 = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pl2 = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pl3 = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const nazwaMies = (m) => MIES[+String(m).slice(5, 7) - 1] + " " + String(m).slice(0, 4);
const sgn = (n) => (n >= 0 ? "+" : "") + Math.round(n).toLocaleString("pl-PL");

// `analizy` pozwala podać dane z zewnątrz zamiast czytać kolekcję — używane
// w podglądzie bez logowania, a docelowo gdyby App miał już te dane u siebie.
export default function OplatyDrogoweAnaliza({ analizy = null }) {
  const [pobrane, setPobrane] = useState(null);
  const [blad, setBlad] = useState(null);
  const [mies, setMies] = useState(null);
  const dane = analizy || pobrane;

  useEffect(() => {
    if (analizy) return;
    let zyje = true;
    getDocs(collection(db, "tollAnalysis"))
      .then(q => { if (zyje) setPobrane(q.docs.map(d => d.data()).sort((a, b) => a.month.localeCompare(b.month))); })
      .catch(e => { if (zyje) setBlad(e?.message || String(e)); });
    return () => { zyje = false; };
  }, [analizy]);

  const aktMies = useMemo(() => {
    if (!dane?.length) return null;
    return mies && dane.some(d => d.month === mies) ? mies : dane[dane.length - 1].month;
  }, [dane, mies]);

  const biez = dane?.find(d => d.month === aktMies) || null;
  const poprz = useMemo(() => {
    if (!dane || !aktMies) return null;
    const i = dane.findIndex(d => d.month === aktMies);
    return i > 0 ? dane[i - 1] : null;
  }, [dane, aktMies]);

  if (blad) return <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-red-600">
    Nie udało się wczytać analiz: {blad}
  </div>;
  if (!dane) return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">Wczytywanie…</div>;
  if (!dane.length) return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">
    Brak zapisanych analiz opłat drogowych.
  </div>;

  const razem = biez.sumaNego + (biez.etollEUR || 0);
  const razemP = poprz ? poprz.sumaNego + (poprz.etollEUR || 0) : null;
  const naTys = biez.kmFloty ? (razem / biez.kmFloty) * 1000 : null;
  const naTysP = poprz?.kmFloty ? (razemP / poprz.kmFloty) * 1000 : null;

  const kraje = [...new Set([...Object.keys(biez.oplatyNego || {}), ...Object.keys(poprz?.oplatyNego || {})])]
    .map(cc => ({ cc, b: biez.oplatyNego?.[cc] || 0, p: poprz?.oplatyNego?.[cc] || 0 }))
    .map(x => ({ ...x, d: x.b - x.p }))
    .sort((a, b) => b.d - a.d);

  const krajeKm = [...new Set([...Object.keys(biez.km || {}), ...Object.keys(poprz?.km || {})])]
    .filter(cc => (biez.km?.[cc] || 0) > 200 || (poprz?.km?.[cc] || 0) > 200)
    .sort((a, b) => (biez.km?.[b] || 0) - (biez.km?.[a] || 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={aktMies} onChange={e => setMies(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          {dane.map(d => <option key={d.month} value={d.month}>{nazwaMies(d.month)}</option>)}
        </select>
        {biez.zrodlo === "reczna" && (
          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "#fffbeb", color: "#92400e" }}>
            analiza policzona ręcznie z eksportów
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ["Opłaty drogowe", eur0(razem), razemP ? (razem / razemP - 1) * 100 : null, "%", poprz ? `vs ${eur0(razemP)}` : null],
          ["Przebieg floty", num(biez.kmFloty) + " km", poprz?.kmFloty ? (biez.kmFloty / poprz.kmFloty - 1) * 100 : null, "%", null],
          ["Koszt na 1 000 km", naTys ? pl1(naTys) + " €" : "–", naTysP ? (naTys / naTysP - 1) * 100 : null, "%", null],
          ["Stawka w Niemczech", biez.stawki?.DE ? pl3(biez.stawki.DE) + " €/km" : "–", null, "", poprz?.stawki?.DE ? `poprzednio ${pl3(poprz.stawki.DE)}` : null],
        ].map(([etykieta, wartosc, zmiana, jedn, opis], i) => (
          <div key={i} className="rounded-xl border border-gray-200 p-3" style={{ background: "#f8fafc" }}>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{etykieta}</div>
            <div className="text-xl font-bold text-gray-900 mt-0.5">{wartosc}</div>
            {zmiana !== null && zmiana !== undefined && isFinite(zmiana) ? (
              <div className="text-[11px] font-semibold mt-0.5" style={{ color: zmiana >= 0 ? "#dc2626" : "#16a34a" }}>
                {zmiana >= 0 ? "▲ +" : "▼ "}{pl1(zmiana)}{jedn}{opis && <span className="text-gray-400 font-normal"> {opis}</span>}
              </div>
            ) : (opis && <div className="text-[11px] text-gray-400 mt-0.5">{opis}</div>)}
          </div>
        ))}
      </div>

      {/* opłaty per kraj */}
      <div className="rounded-xl border border-gray-200 p-3 bg-white">
        <div className="font-bold text-sm text-gray-900 mb-2">
          Opłaty per kraj <span className="font-normal text-gray-500">· NegoMetal, EUR</span>
        </div>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-left py-1 text-[10px] uppercase text-gray-500 font-semibold">Kraj</th>
              {poprz && <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">{MIES[+poprz.month.slice(5, 7) - 1]}</th>}
              <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-700 font-semibold">{MIES[+biez.month.slice(5, 7) - 1]}</th>
              {poprz && <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">Zmiana</th>}
            </tr>
          </thead>
          <tbody>
            {kraje.filter(k => k.b > 3 || k.p > 3).map(k => (
              <tr key={k.cc} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td className="py-1 text-gray-700">{KRAJ[k.cc] || k.cc}</td>
                {poprz && <td className="text-right py-1 px-1.5 tabular-nums text-gray-500">{eur0(k.p)}</td>}
                <td className="text-right py-1 px-1.5 tabular-nums text-gray-900 font-semibold">{eur0(k.b)}</td>
                {poprz && <td className="text-right py-1 px-1.5 tabular-nums font-semibold"
                  style={{ color: k.d >= 0 ? "#dc2626" : "#16a34a" }}>{sgn(k.d)} €</td>}
              </tr>
            ))}
            <tr style={{ borderTop: "1.5px solid #cbd5e1", background: "#f8fafc" }}>
              <td className="py-1 font-bold text-gray-900">NegoMetal razem</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums">{eur0(poprz.sumaNego)}</td>}
              <td className="text-right py-1 px-1.5 tabular-nums font-bold">{eur0(biez.sumaNego)}</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums font-bold">{sgn(biez.sumaNego - poprz.sumaNego)} €</td>}
            </tr>
            <tr style={{ borderTop: "1px solid #f1f5f9" }}>
              <td className="py-1 text-gray-700">e-TOLL (Polska)</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums text-gray-500">{eur0(poprz.etollEUR || 0)}</td>}
              <td className="text-right py-1 px-1.5 tabular-nums text-gray-900 font-semibold">{eur0(biez.etollEUR || 0)}</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums font-semibold"
                style={{ color: (biez.etollEUR || 0) - (poprz.etollEUR || 0) >= 0 ? "#dc2626" : "#16a34a" }}>
                {sgn((biez.etollEUR || 0) - (poprz.etollEUR || 0))} €</td>}
            </tr>
            <tr style={{ borderTop: "1.5px solid #cbd5e1", background: "#f8fafc" }}>
              <td className="py-1 font-bold text-gray-900">RAZEM</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums font-bold">{eur0(razemP)}</td>}
              <td className="text-right py-1 px-1.5 tabular-nums font-bold">{eur0(razem)}</td>
              {poprz && <td className="text-right py-1 px-1.5 tabular-nums font-bold">{sgn(razem - razemP)} €</td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* stawki i kilometry */}
      <div className="rounded-xl border border-gray-200 p-3 bg-white">
        <div className="font-bold text-sm text-gray-900 mb-0.5">
          Stawka €/km per kraj <span className="font-normal text-gray-500">· opłaty ÷ kilometry trasy</span>
        </div>
        <div className="text-xs text-gray-500 mb-2">
          Jeśli stawka stoi w miejscu, a rachunek rośnie, to zmieniły się kierunki — nie taryfa.
        </div>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-left py-1 text-[10px] uppercase text-gray-500 font-semibold">Kraj</th>
              {poprz && <>
                <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">km</th>
                <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-500 font-semibold">€/km</th>
              </>}
              <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-700 font-semibold">km</th>
              <th className="text-right py-1 px-1.5 text-[10px] uppercase text-gray-700 font-semibold">€/km</th>
            </tr>
          </thead>
          <tbody>
            {krajeKm.map(cc => {
              const sb = biez.stawki?.[cc], sp = poprz?.stawki?.[cc];
              const wazny = cc === "DE";
              return (
                <tr key={cc} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td className={"py-1 " + (wazny ? "font-bold text-gray-900" : "text-gray-700")}>{KRAJ[cc] || cc}</td>
                  {poprz && <>
                    <td className="text-right py-1 px-1.5 tabular-nums text-gray-500">{num(poprz.km?.[cc] || 0)}</td>
                    <td className="text-right py-1 px-1.5 tabular-nums text-gray-500">
                      {sp === undefined ? "–" : sp < 0.0005 ? "bez opłat" : pl3(sp)}</td>
                  </>}
                  <td className="text-right py-1 px-1.5 tabular-nums text-gray-800">{num(biez.km?.[cc] || 0)}</td>
                  <td className={"text-right py-1 px-1.5 tabular-nums " + (wazny ? "font-bold text-gray-900" : "text-gray-800")}>
                    {sb === undefined ? "–" : sb < 0.0005 ? <span style={{ color: "#16a34a" }}>bez opłat</span> : pl3(sb)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* kontrola e-TOLL */}
      {biez.etoll && (
        <div className="rounded-xl border p-3" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
          <div className="font-bold text-sm mb-1" style={{ color: "#15803d" }}>Kontrola e-TOLL</div>
          <div className="text-xs text-gray-700 leading-relaxed">
            <b>{num(biez.etoll.przejazdy)}</b> przejazdów, <b>{num(biez.etoll.km)} km</b>, <b>{pl2(biez.etoll.pln)} PLN</b> należne.
            Stawka <b>{pl3(biez.etoll.plnPerKm)} PLN/km</b> wobec taryfy urzędowej <b>{pl2(biez.etoll.taryfaPlnPerKm)} PLN/km</b> —
            {Math.abs(biez.etoll.plnPerKm - biez.etoll.taryfaPlnPerKm) < 0.01
              ? <b style={{ color: "#15803d" }}> zgodna</b>
              : <b style={{ color: "#dc2626" }}> odbiega</b>}.
            Duplikatów: <b>{biez.etoll.duplikaty}</b>.
            {biez.etoll.nieuiszczonePLN > 0 && <> Nieuiszczone: <b>{pl2(biez.etoll.nieuiszczonePLN)} PLN</b>.</>}
          </div>
        </div>
      )}

      {/* struktura zleceń */}
      {biez.struktura && (
        <div className="rounded-xl border border-gray-200 p-3 bg-white">
          <div className="font-bold text-sm text-gray-900 mb-2">
            Struktura zleceń <span className="font-normal text-gray-500">· udział tras dotykających kraju</span>
          </div>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
            <tbody>
              {[
                ["Frachty (bez busa)", biez.struktura.frachty, poprz?.struktura?.frachty],
                ["Dotykają Niemiec", biez.struktura.dotykaDE, poprz?.struktura?.dotykaDE],
                ["Dotykają Francji / Hiszpanii", biez.struktura.dotykaFRES, poprz?.struktura?.dotykaFRES],
              ].map(([nazwa, b, p], i) => {
                const pb = biez.struktura.frachty ? (b / biez.struktura.frachty) * 100 : 0;
                const pp = poprz?.struktura?.frachty ? (p / poprz.struktura.frachty) * 100 : null;
                return (
                  <tr key={i} style={{ borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                    <td className="py-1 text-gray-700">{nazwa}</td>
                    {poprz && <td className="text-right py-1 px-1.5 tabular-nums text-gray-500">
                      {p}{i > 0 && pp !== null ? ` (${pl1(pp)}%)` : ""}</td>}
                    <td className="text-right py-1 px-1.5 tabular-nums text-gray-900 font-semibold">
                      {b}{i > 0 ? ` (${pl1(pb)}%)` : ""}</td>
                    {poprz && i > 0 && pp !== null && (
                      <td className="text-right py-1 px-1.5 tabular-nums font-semibold"
                          style={{ color: pb - pp >= 0 ? "#dc2626" : "#16a34a" }}>
                        {(pb - pp >= 0 ? "+" : "") + pl1(pb - pp)} pkt%</td>
                    )}
                    {poprz && i === 0 && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[11px] text-gray-400 leading-relaxed">
        {biez.uwaga}
        {biez.frachtowPominietych > 0 && <> Pominięto {biez.frachtowPominietych} {biez.frachtowPominietych === 1 ? "fracht" : "frachty"},
          których trasa wychodzi poza zakres eksportu — ich kilometry nie weszłyby razem z odpowiadającymi im opłatami.</>}
      </div>
    </div>
  );
}
