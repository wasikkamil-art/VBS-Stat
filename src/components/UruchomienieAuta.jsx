// UruchomienieAuta — strona „Uruchomienie auta" (zastępuje kartę pojazdu w panelu Pojazdy; wariant A
// wybrany przez usera 19.11.2026 zamiast małego okna): lista kontrolna wydania
// (odhaczanie + wydruk do podpisu kierowcy i dyspozytora) i jednocześnie zestawienie kosztów
// uruchomienia (kwoty przy pozycjach, faktura/zdjęcie z odczytem sumy przez AI).
//
// Komponent jest PREZENTACYJNY, jak PojazdyPanel: nie importuje Firebase. Wszystko, co dotyka
// bazy, plików i AI, przychodzi w `api`:
//   wczytaj(v) → dokument | null          zapisz(v, dokument) → true/false
//   wgraj(v, plik) → { url, nazwa }       odczytaj(url, czyPdf, nazwyPozycji) → odczyt | null
//   naEur(kwota, waluta, data) → liczba | null
// Dzięki temu atrapa `podglad/pojazdy` podstawia własne `api` i niczego nie zapisuje.

import { useEffect, useMemo, useRef, useState } from "react";
import { GRUPY_URUCHOMIENIA, nowaLista, nowaPozycja, liczba, sumyUruchomienia, przeliczPozycje, wpiszOdczyt } from "../utils/uruchomienieAuta";

const fmt = (n, d = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const POLE = "w-full px-2 py-1.5 rounded-lg text-sm bg-white border border-gray-200 text-gray-900 outline-none focus:border-gray-500";

export default function UruchomienieAuta({ v, api, kierowca = null, onClose, onBrudne = () => {}, showToast = () => {}, safeHref = (u) => u }) {
  const [pozycje, setPozycje] = useState(null);       // null = jeszcze wczytujemy
  const [domyslnaData, setDomyslnaData] = useState("");
  const [zmienione, setZmienione] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [czyta, setCzyta] = useState(null);            // id pozycji albo "nowy", gdy AI czyta dokument
  const [blad, setBlad] = useState("");
  const plikRef = useRef(null);
  const celRef = useRef(null);                         // id pozycji, do której wgrywamy plik (null = AI dopasuje)

  useEffect(() => {
    let zywy = true;
    api.wczytaj(v).then(d => {
      if (!zywy) return;
      setPozycje(Array.isArray(d?.pozycje) && d.pozycje.length ? d.pozycje : nowaLista());
      setDomyslnaData(d?.domyslnaData || "");
    }).catch(e => { console.error("uruchomienie: odczyt", e); if (zywy) { setBlad("Nie udało się wczytać listy. Zamknij okno i spróbuj ponownie — żeby nie nadpisać zapisanych danych pustą listą."); } });
    return () => { zywy = false; };
  }, [v, api]);

  // Niezapisane zmiany: rodzic pyta przed zmianą auta, przeglądarka przed zamknięciem karty.
  useEffect(() => {
    onBrudne(zmienione);
    if (!zmienione) return;
    const stop = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", stop);
    return () => { window.removeEventListener("beforeunload", stop); onBrudne(false); };
  }, [zmienione, onBrudne]);

  const sumy = useMemo(() => sumyUruchomienia(pozycje || []), [pozycje]);
  const zmien = (id, pola) => { setPozycje(l => l.map(p => (p.id === id ? { ...p, ...pola, ...("kwota" in pola || "waluta" in pola || "data" in pola ? { kwotaEur: null } : {}) } : p))); setZmienione(true); };
  const usun = (id) => { setPozycje(l => l.filter(p => p.id !== id)); setZmienione(true); };
  const dodaj = (grupa) => { setPozycje(l => [...l, nowaPozycja({ grupa })]); setZmienione(true); };

  const zapisz = async () => {
    if (!pozycje || zapisuje) return false;
    setZapisuje(true);
    try {
      // Euro liczymy przy zapisie, kursem NBP z daty pozycji (albo z daty domyślnej).
      const przeliczone = await przeliczPozycje(pozycje, domyslnaData, api.naEur);
      const s = sumyUruchomienia(przeliczone);
      const ok = await api.zapisz(v, { pozycje: przeliczone, domyslnaData, sumaEur: Math.round(s.eur * 100) / 100, sumaNiepelna: s.bezKursu > 0, sumyWalut: s.wgWaluty });
      if (ok) { setPozycje(przeliczone); setZmienione(false); showToast(s.bezKursu ? `✅ Zapisano. ${s.bezKursu} poz. bez kursu — suma w euro niepełna` : "✅ Zapisano listę uruchomienia"); }
      return !!ok;
    } catch (e) {
      console.error("uruchomienie: zapis", e); showToast("❌ Nie udało się zapisać: " + (e?.message || e)); return false;
    } finally { setZapisuje(false); }
  };

  const zamknij = () => { if (!zmienione || window.confirm("Masz niezapisane zmiany. Zamknąć bez zapisu?")) onClose(); };

  const wybierzPlik = (celId) => { celRef.current = celId; plikRef.current?.click(); };
  const poWyborzePliku = async (e) => {
    const plik = e.target.files?.[0];
    e.target.value = "";
    if (!plik || !pozycje) return;
    const celId = celRef.current;
    setCzyta(celId || "nowy");
    try {
      const wgrany = await api.wgraj(v, plik);
      let odczyt = null;
      try { odczyt = await api.odczytaj(wgrany.url, plik.type === "application/pdf", pozycje.filter(p => p.nazwa).map(p => p.nazwa)); }
      catch (err) { console.error("uruchomienie: AI nie odczytało dokumentu", err); }
      const w = wpiszOdczyt(pozycje, odczyt || {}, wgrany, celId);
      setPozycje(w.pozycje); setZmienione(true);
      const p = w.pozycje.find(x => x.id === w.id);
      if (!odczyt) showToast("⚠️ Plik dopięty, ale AI nie odczytało kwoty — wpisz ją ręcznie");
      else if (liczba(odczyt.kwotaNetto) == null) showToast(`⚠️ Plik dopięty do „${p?.nazwa}", ale na dokumencie nie ma kwoty netto${odczyt.kwotaBrutto ? ` (brutto ${odczyt.kwotaBrutto})` : ""} — wpisz ją ręcznie`);
      else showToast(`✅ ${w.nowa ? "Nowa pozycja" : "Pozycja"} „${p?.nazwa}": ${p?.kwota} ${p?.waluta} netto — sprawdź z dokumentem`);
    } catch (err) {
      console.error("uruchomienie: wgranie pliku", err); showToast("❌ Nie udało się wgrać pliku: " + (err?.message || err));
    } finally { setCzyta(null); }
  };

  // Wydruk listy kontrolnej — ten sam mechanizm co Ranking i Planer: klon pod <body>, reszta display:none.
  const drukuj = () => {
    const src = document.getElementById("uruchomienie-print");
    if (!src) return;
    const holder = document.createElement("div");
    holder.id = "uruchomienie-portal"; holder.innerHTML = src.innerHTML;
    document.body.appendChild(holder); document.body.classList.add("uruchomienie-printing");
    const sprzatnij = () => { document.body.classList.remove("uruchomienie-printing"); holder.remove(); window.removeEventListener("afterprint", sprzatnij); };
    window.addEventListener("afterprint", sprzatnij);
    const obrazy = [...holder.querySelectorAll("img")];
    const gotowy = (i) => (i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }));
    Promise.race([Promise.all(obrazy.map(gotowy)), new Promise(r => setTimeout(r, 1500))]).then(() => { try { window.print(); } finally { setTimeout(sprzatnij, 500); } });
  };

  const grupy = useMemo(() => {
    const znane = GRUPY_URUCHOMIENIA.map(g => ({ g, lista: (pozycje || []).filter(p => p.grupa === g) }));
    const obce = (pozycje || []).filter(p => !GRUPY_URUCHOMIENIA.includes(p.grupa));
    if (obce.length) znane[znane.length - 1].lista.push(...obce);
    return znane;
  }, [pozycje]);
  const dzis = new Date().toLocaleDateString("pl-PL");
  const doWydruku = grupy.map(({ g, lista }) => ({ g, lista: lista.filter(p => !p.koszt && p.nazwa) })).filter(x => x.lista.length);

  return (
    <section aria-label={`Uruchomienie auta ${v.plate}`}>
      <style>{`
        #uruchomienie-portal { display: none; }
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body.uruchomienie-printing > *:not(#uruchomienie-portal) { display: none !important; }
          body.uruchomienie-printing #uruchomienie-portal { display: block !important; }
          #uruchomienie-portal, #uruchomienie-portal * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        /* Układ dopasowuje się do szerokości STRONY UruchomienieAuta (container query), nie okna przeglądarki —
           obok stoi lista aut i pasek boczny, więc szerokość okna nic nie mówi o miejscu na listę. */
        .uru-kontener { container-type: inline-size; }
        .uru-uklad { display: grid; grid-template-columns: minmax(0, 1fr) 270px; gap: 20px; align-items: start; }
        .uru-bok { position: sticky; top: 12px; }
        .uru-lista { container-type: inline-size; min-width: 0; }
        .uru-wiersz { display: grid; align-items: center; gap: 6px; grid-template-columns: 28px minmax(120px, 1.4fr) 56px 92px 68px 136px minmax(170px, 1fr) 24px; }
        @container (max-width: 760px) {
          .uru-uklad { grid-template-columns: minmax(0, 1fr); }
          .uru-bok { position: static; order: -3; }
        }
        @container (max-width: 700px) {
          .uru-wiersz { grid-template-columns: 28px minmax(110px, 1fr) 52px 88px 66px 132px 24px; }
          .uru-wiersz .uru-dok { grid-column: 2 / 7; grid-row: 2; }
        }
        @container (max-width: 520px) {
          .uru-wiersz { grid-template-columns: 28px minmax(0, 1fr) 24px; }
          .uru-wiersz > input, .uru-wiersz > select, .uru-wiersz .uru-dok { grid-column: 2; }
          .uru-wiersz > input[aria-label="Nazwa pozycji"] { grid-row: 1; }
        }
        .uru-doc { font-family: 'DM Sans', system-ui, sans-serif; color: #0f172a; font-size: 11.5px; }
        .uru-doc h1 { font-size: 19px; font-weight: 700; margin: 0; }
        .uru-doc h2 { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #334155; margin: 10px 0 3px; break-after: avoid; }
        .uru-doc table { border-collapse: collapse; width: 100%; }
        .uru-doc td { padding: 3.5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
        .uru-doc tr { break-inside: avoid; }
        .uru-kratka { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #0f172a; border-radius: 2px; text-align: center; line-height: 11px; font-size: 11px; font-weight: 700; }
      `}</style>

      <article className="bg-white rounded-2xl border border-gray-100 uru-kontener">
        <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100">
          <button type="button" onClick={zamknij} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-900 bg-gray-100">← Karta pojazdu</button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Uruchomienie auta — {v.plate}{v.plate2 && <span className="text-gray-500 font-medium"> + {v.plate2}</span>}</h2>
            <p className="text-sm text-gray-600">{[v.brand, v.year, kierowca?.name && `kierowca: ${kierowca.name}`].filter(Boolean).join(" · ")}</p>
          </div>
        </header>

        {blad && <p className="m-5 p-3 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#7f1d1d" }}>{blad}</p>}
        {!pozycje && !blad && <p className="p-8 text-center text-sm text-gray-600">Wczytuję listę…</p>}

        {pozycje && (
          <div className="uru-uklad px-5 py-4">
            <input ref={plikRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={poWyborzePliku} />
            {/* ═══ PRAWA KOLUMNA (w kodzie pierwsza, żeby na wąskim ekranie suma i przyciski były nad listą) ═══ */}
            <aside className="space-y-3 uru-bok" style={{ gridColumn: "auto" }}>
              <div className="p-3 rounded-xl" style={{ background: "#eff6ff" }}>
                <div className="text-xs text-gray-600">Wyposażenie na aucie</div>
                <div className="text-xl font-bold text-gray-900">{sumy.odhaczone} z {sumy.doOdhaczenia}</div>
                <div className="h-1.5 rounded-full mt-1.5" style={{ background: "#dbeafe" }} role="img" aria-label={`Odhaczone ${sumy.odhaczone} z ${sumy.doOdhaczenia}`}>
                  <div className="h-1.5 rounded-full" style={{ width: `${sumy.doOdhaczenia ? (sumy.odhaczone / sumy.doOdhaczenia) * 100 : 0}%`, background: "#1d4ed8" }} />
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: "#f9fafb" }}>
                <div className="text-xs text-gray-600">Koszt uruchomienia (netto)</div>
                <div className="text-xl font-bold text-gray-900">{Object.keys(sumy.wgWaluty).length ? Object.entries(sumy.wgWaluty).map(([w, k]) => `${fmt(k)} ${w}`).join(" + ") : "—"}</div>
                <div className="text-xs text-gray-700">{sumy.zKwota} poz. z kwotą</div>
              </div>
              <div className="p-3 rounded-xl" style={{ background: sumy.bezKursu ? "#fef3c7" : "#f9fafb" }}>
                <div className="text-xs text-gray-600">Razem w euro (kurs NBP)</div>
                <div className="text-xl font-bold text-gray-900">{sumy.zKwota ? `${fmt(sumy.eur)} €` : "—"}</div>
                <div className="text-xs" style={{ color: sumy.bezKursu ? "#78350f" : "#4b5563" }}>
                  {sumy.bezKursu ? `niepełna: ${sumy.bezKursu} poz. czeka na przeliczenie (zapisz; potrzebna data)` : "przeliczane przy zapisie"}
                </div>
                <div className="text-xs text-gray-600 mt-1">Do panelu Koszty trafia tylko ta suma, nie pojedyncze pozycje.</div>
              </div>
              <label className="block text-xs text-gray-700">Data zakupów do kursu NBP
                <input type="date" className={POLE + " mt-1"} value={domyslnaData} onChange={e => { setDomyslnaData(e.target.value); setPozycje(l => l.map(p => (p.data ? p : { ...p, kwotaEur: null }))); setZmienione(true); }} />
                <span className="block text-gray-600 mt-1">Dla pozycji bez własnej daty. Pozycja z własną datą liczy się kursem z tamtego dnia.</span>
              </label>
              <button type="button" onClick={zapisz} disabled={!zmienione || zapisuje} className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#111827" }}>
                {zapisuje ? "Zapisuję…" : zmienione ? "Zapisz zmiany" : "Zapisane"}
              </button>
              <button type="button" onClick={() => wybierzPlik(null)} disabled={!!czyta} className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#6d28d9" }}>
                {czyta === "nowy" ? "AI czyta dokument…" : "Wgraj fakturę lub zdjęcie — AI przypisze"}
              </button>
              <button type="button" onClick={drukuj} className="w-full px-3 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-900">Drukuj listę do podpisu</button>
            </aside>

            <div className="uru-lista" style={{ order: -2 }}>
            <p className="text-xs text-gray-600 mb-3">Kratka = pozycja jest na aucie (trafia na wydruk do podpisu). Kreska = sam koszt, bez odhaczania — przełączysz linkiem po prawej.</p>
            {grupy.map(({ g, lista }) => (
              <section key={g} className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{g}</h3>
                  <button type="button" onClick={() => dodaj(g)} className="text-xs font-semibold text-gray-800 px-2 py-1 rounded-md bg-gray-100">+ Dodaj inne</button>
                </div>
                {lista.length === 0 && <p className="text-xs text-gray-600 py-1">Brak pozycji.</p>}
                <div className="space-y-1.5">
                  {lista.map(p => (
                    <div key={p.id} className="uru-wiersz p-1.5 rounded-xl border border-gray-100" style={{ background: p.jest ? "#f0fdf4" : "#fff" }}>
                      {p.koszt
                        ? <span className="text-xs text-gray-500 text-center" title="Pozycja tylko kosztowa — nie ma jej na liście wydania">—</span>
                        : <input type="checkbox" className="w-5 h-5 mx-auto" checked={!!p.jest} onChange={e => zmien(p.id, { jest: e.target.checked })} aria-label={`${p.nazwa || "pozycja"} jest na aucie`} />}
                      <input className={POLE} placeholder="nazwa" value={p.nazwa} onChange={e => zmien(p.id, { nazwa: e.target.value })} aria-label="Nazwa pozycji" />
                      <input className={POLE} placeholder="szt." value={p.ilosc} onChange={e => zmien(p.id, { ilosc: e.target.value })} aria-label={`Ilość — ${p.nazwa}`} />
                      <input className={POLE} placeholder="netto" inputMode="decimal" value={p.kwota} onChange={e => zmien(p.id, { kwota: e.target.value })} aria-label={`Kwota netto — ${p.nazwa}`} />
                      <select className={POLE} value={p.waluta || "PLN"} onChange={e => zmien(p.id, { waluta: e.target.value })} aria-label={`Waluta — ${p.nazwa}`}><option>PLN</option><option>EUR</option></select>
                      <input type="date" className={POLE} value={p.data || ""} onChange={e => zmien(p.id, { data: e.target.value })} aria-label={`Data zakupu — ${p.nazwa}`} />
                      <div className="uru-dok flex items-center gap-1.5 min-w-0 text-xs">
                        {p.plikUrl
                          ? <a href={safeHref(p.plikUrl)} target="_blank" rel="noopener noreferrer" className="underline text-gray-900 truncate" title={p.plikNazwa}>{p.plikNazwa || "dokument"}</a>
                          : <button type="button" onClick={() => wybierzPlik(p.id)} disabled={!!czyta} className="px-2 py-1 rounded-md bg-gray-100 text-gray-800 font-medium disabled:opacity-50">{czyta === p.id ? "AI czyta…" : "+ dokument"}</button>}
                        {typeof p.kwotaEur === "number" && (p.waluta || "PLN") !== "EUR" && <span className="text-gray-600 whitespace-nowrap">= {fmt(p.kwotaEur)} €</span>}
                        <button type="button" onClick={() => zmien(p.id, { koszt: !p.koszt, jest: p.koszt ? p.jest : false })} className="ml-auto underline text-gray-600 whitespace-nowrap"
                          title={p.koszt ? "Pozycja jest tylko kosztem. Kliknij, żeby trafiła na listę wydania." : "Pozycja jest na liście wydania. Kliknij, żeby była tylko kosztem."}>
                          {p.koszt ? "dodaj do listy" : "tylko koszt"}
                        </button>
                      </div>
                      <button type="button" onClick={() => usun(p.id)} className="text-gray-600 hover:text-red-700 text-sm" aria-label={`Usuń pozycję ${p.nazwa}`}>✕</button>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            </div>
          </div>
        )}
      </article>

      {/* ═══ LISTA KONTROLNA DO WYDRUKU — bez kwot ═══ */}
      <div id="uruchomienie-print" style={{ display: "none" }}>
        <div className="uru-doc">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #0f172a", paddingBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/app-fleetstat.png" alt="FleetStat" style={{ height: 30 }} />
              <div><h1>Protokół wydania wyposażenia</h1>
                <div style={{ color: "#475569" }}>{[v.plate + (v.plate2 ? " + " + v.plate2 : ""), v.brand, v.year].filter(Boolean).join(" · ")}{v.vin ? ` · VIN ${v.vin}` : ""}</div></div>
            </div>
            <div style={{ textAlign: "right", color: "#334155" }}>{dzis}</div>
          </div>
          <div style={{ margin: "8px 0 2px" }}>Kierowca: <b>{kierowca?.name || "...................................................."}</b></div>
          {doWydruku.map(({ g, lista }) => (
            <div key={g}>
              <h2>{g}</h2>
              <table><tbody>
                {lista.map(p => (
                  <tr key={p.id}>
                    <td style={{ width: 24 }}><span className="uru-kratka">{p.jest ? "✓" : ""}</span></td>
                    <td>{p.nazwa}</td>
                    <td style={{ width: 70, color: "#475569" }}>{p.ilosc ? `${p.ilosc} szt.` : ""}</td>
                    <td style={{ width: "34%", color: "#94a3b8" }}>uwagi: </td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 34, breakInside: "avoid" }}>
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 4 }}>Wydający (dyspozytor) — data i podpis</div>
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 4 }}>Przyjmujący (kierowca) — data i podpis</div>
          </div>
          <div style={{ color: "#475569", fontSize: 9.5, marginTop: 8 }}>Kierowca potwierdza odbiór zaznaczonego wyposażenia.</div>
        </div>
      </div>
    </section>
  );
}
