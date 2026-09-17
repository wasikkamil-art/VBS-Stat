// Opłaty drogowe — skąd biorą się zmiany kosztu myta i czy dostawcy naliczają poprawnie.
// Czyta gotowe analizy z kolekcji `tollAnalysis/{YYYY-MM}`. Sierpień i lipiec policzone
// ręcznie z eksportów (pole `zrodlo: "reczna"`); od października dane mają pochodzić
// z licznika CAN (countryKmDaily) i importu transakcji — struktura dokumentu ta sama.
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, doc, getDocs, setDoc, writeBatch, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { detectAndParse, csvToAoa, txId, norm, SKIP_PLATE } from "../utils/tollParsers";
import { zbudujAnalize, krajeFrachtuDomyslne, kmZDni } from "../utils/tollAnalysis";
import { toEUR } from "../utils/nbp";

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
export default function OplatyDrogoweAnaliza({ analizy = null, isAdmin = false, vehicles = [], frachtyList = [], operacyjne = [] }) {
  const [pobrane, setPobrane] = useState(null);
  const [blad, setBlad] = useState(null);
  const [mies, setMies] = useState(null);
  const [imp, setImp] = useState(null);     // {faza, msg, szczegoly}
  const dane = analizy || pobrane;

  const wczytaj = useCallback(() => {
    getDocs(collection(db, "tollAnalysis"))
      .then(q => setPobrane(q.docs.map(d => d.data()).sort((a, b) => a.month.localeCompare(b.month))))
      .catch(e => setBlad(e?.message || String(e)));
  }, []);

  useEffect(() => { if (!analizy) wczytaj(); }, [analizy, wczytaj]);

  // ── IMPORT eksportów NegoMetal / e-TOLL ───────────────────────────────
  // Ten sam wzorzec, co import paliwa: parsujemy plik, mapujemy na flotę, przeliczamy
  // na EUR kursem NBP z dnia transakcji, deduplikujemy i dopiero wtedy zapisujemy.
  // Ponowny import tego samego pliku nie tworzy duplikatów.
  const importuj = useCallback(async (fileList) => {
    const pliki = Array.from(fileList || []);
    if (!pliki.length) return;
    setImp({ faza: "czytanie", msg: `Czytam ${pliki.length} ${pliki.length === 1 ? "plik" : "pliki"}…` });
    try {
      const XLSX = window.XLSX || await new Promise((res, rej) => {
        const sc = document.createElement("script");
        sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        sc.onload = () => res(window.XLSX);
        sc.onerror = () => rej(new Error("Nie udało się wczytać biblioteki XLSX"));
        document.head.appendChild(sc);
      });

      let surowe = [];
      const rozpoznane = [];
      for (const f of pliki) {
        let aoa;
        if (/\.csv$/i.test(f.name)) {
          aoa = csvToAoa(await f.text());          // XLSX myli się na CSV ze średnikiem
        } else {
          const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
          aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        }
        const r = detectAndParse(aoa);
        rozpoznane.push({ nazwa: f.name, rodzaj: r.kind, ile: r.rows.length });
        surowe = surowe.concat(r.rows);
      }
      if (!surowe.length) {
        setImp({ faza: "blad", msg: "Nie rozpoznałem żadnych transakcji. Czy to eksport NegoMetal (xlsx) albo e-TOLL (csv)?", szczegoly: rozpoznane });
        return;
      }

      // Mapowanie na flotę — obce rejestracje odrzucamy, ale mówimy które
      const poRej = {};
      for (const v of vehicles) { const fp = norm(v.plate); if (fp) poRej[fp] = v.id; }
      const obce = new Set();
      const nasze = surowe.filter(t => {
        if (SKIP_PLATE.test(t.plate)) { obce.add(t.plateRaw); return false; }
        const vid = poRej[t.plate];
        if (!vid) { obce.add(t.plateRaw); return false; }
        t.vehicleId = vid;
        return true;
      });
      if (!nasze.length) {
        setImp({ faza: "blad", msg: `Żadna transakcja nie pasuje do floty. Rejestracje w pliku: ${[...obce].join(", ")}`, szczegoly: rozpoznane });
        return;
      }

      // Kursy NBP — po jednym zapytaniu na parę (waluta, dzień), nie na transakcję
      setImp({ faza: "kursy", msg: `Przeliczam ${nasze.length} transakcji na EUR kursem NBP…` });
      const pary = [...new Set(nasze.filter(t => t.currency !== "EUR").map(t => `${t.currency}|${t.day}`))];
      const kursy = {};
      for (const para of pary) {
        const [cur, day] = para.split("|");
        kursy[para] = await toEUR(1, cur, day);
      }
      let bezKursu = 0;
      for (const t of nasze) {
        if (t.currency === "EUR") { t.amountEUR = t.amountLocal; continue; }
        const k = kursy[`${t.currency}|${t.day}`];
        if (k == null) { t.amountEUR = null; bezKursu++; }
        else t.amountEUR = Math.round(t.amountLocal * k * 100) / 100;
      }

      // Dedup wobec tego, co już jest w bazie
      const miesiace = [...new Set(nasze.map(t => t.month))].sort();
      setImp({ faza: "zapis", msg: `Sprawdzam duplikaty w ${miesiace.length} ${miesiace.length === 1 ? "miesiącu" : "miesiącach"}…` });
      let nowych = 0, pominietych = 0;
      for (const m of miesiace) {
        const istnieje = new Set();
        try {
          const snap = await getDocs(collection(db, "tollTransactions", m, "tx"));
          snap.forEach(d => istnieje.add(d.id));
        } catch { /* pierwszy import tego miesiąca */ }
        const doZapisu = [];
        const widziane = new Set();
        for (const t of nasze.filter(x => x.month === m)) {
          const id = txId(t);
          if (istnieje.has(id) || widziane.has(id)) { pominietych++; continue; }
          widziane.add(id);
          doZapisu.push({ id, t });
        }
        for (let i = 0; i < doZapisu.length; i += 400) {
          const batch = writeBatch(db);
          for (const { id, t } of doZapisu.slice(i, i + 400)) {
            batch.set(doc(db, "tollTransactions", m, "tx", id), { ...t, importedAt: new Date().toISOString() });
          }
          await batch.commit();
        }
        await setDoc(doc(db, "tollTransactions", m), { month: m, updatedAt: new Date().toISOString() }, { merge: true });
        nowych += doZapisu.length;
      }

      // Przeliczenie analizy dla każdego dotkniętego miesiąca
      setImp({ faza: "analiza", msg: "Przeliczam analizę…" });
      for (const m of miesiace) {
        const snap = await getDocs(collection(db, "tollTransactions", m, "tx"));
        const tx = snap.docs.map(d => d.data());

        // Kilometry: najpierw z licznika CAN (countryKmDaily), bo to twarde dane.
        let kmPerKraj = {}, zrodloKm = "";
        try {
          const dni = await getDocs(query(collection(db, "countryKmDaily"),
            where("date", ">=", `${m}-01`), where("date", "<=", `${m}-31`)));
          if (!dni.empty) {
            kmPerKraj = kmZDni(dni.docs.map(d => d.data()));
            zrodloKm = `kilometry z licznika CAN (countryKmDaily, ${dni.size} ${dni.size === 1 ? "doba" : "dni"})`;
          }
        } catch { /* brak danych dobowych */ }
        // Brak danych dobowych (mamy je dopiero od 10.09.2026) — NIE kasujemy kilometrów
        // policzonych wcześniej inną metodą. Pusty zapis zabrałby stawki €/km z lipca
        // i sierpnia, które pochodzą z tras zleceń.
        let zachowaneKm = null;
        if (!Object.keys(kmPerKraj).length) {
          const poprzednia = dane?.find(d => d.month === m);
          if (poprzednia && Object.keys(poprzednia.km || {}).length) {
            zachowaneKm = { km: poprzednia.km, stawki: poprzednia.stawki || {} };
            zrodloKm = poprzednia.metoda || "kilometry z poprzedniej analizy";
          } else {
            zrodloKm = "brak kilometrów per kraj — stawki €/km niedostępne dla tego miesiąca";
          }
        }

        const kmFloty = operacyjne
          .filter(o => o.year === +m.slice(0, 4) && o.month === +m.slice(5, 7))
          .reduce((a, o) => a + (o.kmLicznik || 0), 0);
        const frachtyM = frachtyList.filter(f =>
          String(f.dataZaladunku || f.dataZlecenia || "").slice(0, 7) === m && f.vehicleId !== "v4");

        const analiza = zbudujAnalize({
          month: m, transakcje: tx, kmPerKraj, zrodloKm, kmFloty,
          frachty: frachtyM, krajeFrachtu: krajeFrachtuDomyslne,
        });
        // Kilometry i stawki z wcześniejszej metody zostają, gdy import ich nie przyniósł.
        if (zachowaneKm) Object.assign(analiza, zachowaneKm);
        await setDoc(doc(db, "tollAnalysis", m), analiza, { merge: true });
      }

      setImp({
        faza: "ok",
        msg: `Zapisano ${nowych} ${nowych === 1 ? "transakcję" : "transakcji"}, pominięto ${pominietych} już istniejących.`,
        szczegoly: rozpoznane,
        miesiace,
        uwagi: [
          obce.size ? `Pominięte rejestracje spoza floty: ${[...obce].join(", ")}` : null,
          bezKursu ? `${bezKursu} transakcji bez kursu NBP — nie weszły do kwot w EUR` : null,
        ].filter(Boolean),
      });
      wczytaj();
    } catch (e) {
      setImp({ faza: "blad", msg: e?.message || String(e) });
    }
  }, [vehicles, frachtyList, operacyjne, wczytaj, dane]);

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
      {isAdmin && (
        <div className="rounded-xl border p-3" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer"
                   style={{ background: "#2563eb", color: "#fff" }}>
              ⬆️ Wgraj eksporty
              <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden"
                     onChange={e => { importuj(e.target.files); e.target.value = ""; }} />
            </label>
            <div className="text-[11px] text-gray-500 leading-relaxed flex-1 min-w-[220px]">
              NegoMetal (<code>.xlsx</code>) i e-TOLL (<code>.csv</code>) — można oba naraz.
              Kwoty przeliczam na EUR kursem NBP z dnia transakcji, duplikaty pomijam,
              analizę miesiąca przeliczam po zapisie.
            </div>
          </div>
          {imp && (
            <div className="mt-2 text-xs rounded-lg p-2.5" style={{
              background: imp.faza === "blad" ? "#fef2f2" : imp.faza === "ok" ? "#f0fdf4" : "#eff6ff",
              color: imp.faza === "blad" ? "#991b1b" : imp.faza === "ok" ? "#166534" : "#1e40af" }}>
              <div className="font-semibold">
                {imp.faza === "ok" ? "✅ " : imp.faza === "blad" ? "❌ " : "⏳ "}{imp.msg}
              </div>
              {imp.szczegoly?.length > 0 && (
                <div className="mt-1 text-[11px] opacity-80">
                  {imp.szczegoly.map((d, i) => (
                    <div key={i}>{d.nazwa} → {d.rodzaj === "nego" ? "NegoMetal" : d.rodzaj === "etoll" ? "e-TOLL" : "nierozpoznany"} ({d.ile})</div>
                  ))}
                </div>
              )}
              {imp.miesiace?.length > 0 && (
                <div className="mt-1 text-[11px] opacity-80">Przeliczone miesiące: {imp.miesiace.join(", ")}</div>
              )}
              {imp.uwagi?.map((u, i) => <div key={i} className="mt-1 text-[11px]">⚠️ {u}</div>)}
            </div>
          )}
        </div>
      )}

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
        {biez.zrodlo === "import" && (
          <span className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "#eff6ff", color: "#1e40af" }}>
            z importu · {biez.transakcji ? `${biez.transakcji.nego} Nego + ${biez.transakcji.etoll} e-TOLL` : "transakcje w bazie"}
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
