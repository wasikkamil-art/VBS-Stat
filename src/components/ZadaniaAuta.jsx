// ZadaniaAuta — okno „Do zrobienia na bazie" otwierane z kafelka Przeglądu: prace przy aucie
// (opony, olej, naprawy) z terminem, odhaczaniem, zdjęciami/dokumentami i chronologią zdarzeń.
//
// Układ = wariant A wybrany przez usera 20.11.2026: duże okno z TABELĄ jak w Excelu. Kto i kiedy dodał
// oraz kto i kiedy zrobił widać w kolumnach, bez zakładek; odhaczone zadanie ZOSTAJE w tabeli
// (wyszarzone, na dole). Chronologia pod przyciskiem nad tabelą.
//
// Komponent PREZENTACYJNY (jak UruchomienieAuta): nie importuje Firebase. Lista przychodzi
// w `zadania` (żywy nasłuch z App), a zapisy w `api`:
//   dodaj(v, { tytul, opis, termin }) → zadanie | null     edytuj(z, pola) → true/false
//   oznacz(z, czyZrobione) → true/false                     usun(z) → true/false
//   wgraj(z, plik) → true/false
// `osoby` = [{ email, nazwa }] osób z biura do wyboru w „Powiadom e-mailem"; `ja` = e-mail zalogowanego.
// Termin jest obowiązkowy, a jego zmiana wymaga notatki „dlaczego" (ustalenia usera 20.11.2026).

import { useEffect, useMemo, useRef, useState } from "react";
import { PODPOWIEDZI_ZADAN, TYPY_ZDARZEN, czyPoTerminie, dzisIso, podzielZadania, chronologiaZadan, ostatniaZmianaTerminu } from "../utils/zadaniaAuta";
import { czyObraz } from "../utils/heicNaJpg";

const POLE = "px-2.5 py-2 rounded-lg text-sm bg-white border border-gray-300 text-gray-900 outline-none focus:border-gray-600";
const TH = "text-left text-xs font-semibold text-gray-700 px-3 py-2 whitespace-nowrap";
const TD = "px-3 py-2.5 align-top text-sm";
const fmtDzien = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}.${m}.${y}`; };
const fmtChwila = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const ktoKrotko = (email) => (email || "").split("@")[0] || "—";

export default function ZadaniaAuta({ v, zadania, api, osoby = [], ja = "", naBazie = false, onClose, safeHref = (u) => u }) {
  const [tytul, setTytul] = useState("");
  const [termin, setTermin] = useState("");
  const [opis, setOpis] = useState("");
  const [pliki, setPliki] = useState([]);
  const [powiadom, setPowiadom] = useState(() => (ja ? [ja.toLowerCase()] : []));
  const tytulRef = useRef(null);
  const przelacz = (lista, email) => (lista.includes(email) ? lista.filter(e => e !== email) : [...lista, email]);
  const wyborOsob = (lista, ustaw, idPrefix) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-700">
      <span className="font-semibold">Powiadom e-mailem:</span>
      {osoby.length ? osoby.map(o => (
        <label key={o.email} className="flex items-center gap-1 cursor-pointer" htmlFor={`${idPrefix}-${o.email}`}>
          <input id={`${idPrefix}-${o.email}`} type="checkbox" checked={lista.includes(o.email)} onChange={() => ustaw(przelacz(lista, o.email))} />
          {o.nazwa}
        </label>
      )) : <span className="text-gray-600">brak listy osób</span>}
    </div>
  );
  const [zajete, setZajete] = useState("");                 // "nowe" albo id zadania w trakcie zapisu
  const [edycja, setEdycja] = useState(null);               // { id, tytul, termin, opis }
  const [pokazOs, setPokazOs] = useState(false);            // chronologia zdarzeń
  const [podglad, setPodglad] = useState(null);             // załącznik-zdjęcie otwarty w podglądzie
  const plikNowyRef = useRef(null);
  const plikRef = useRef(null);
  const celRef = useRef(null);

  useEffect(() => {
    const esc = (e) => { if (e.key !== "Escape") return; if (podglad) setPodglad(null); else onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, podglad]);

  const dzis = dzisIso();
  const { otwarte, zrobione } = useMemo(() => podzielZadania(zadania), [zadania]);
  const os = useMemo(() => chronologiaZadan(zadania), [zadania]);
  const wiersze = [...otwarte, ...zrobione];
  const poTerminieIle = otwarte.filter(z => czyPoTerminie(z, dzis)).length;

  const dodaj = async (e) => {
    e.preventDefault();
    if (!tytul.trim() || !termin || zajete) return;
    setZajete("nowe");
    try {
      const nowe = await api.dodaj(v, { tytul, opis, termin, powiadom });
      if (nowe) {
        for (const p of pliki) await api.wgraj(nowe, p);
        setTytul(""); setTermin(""); setOpis(""); setPliki([]);
        if (plikNowyRef.current) plikNowyRef.current.value = "";
      }
    } finally { setZajete(""); }
  };

  const zRobota = async (id, fn) => { if (zajete) return; setZajete(id); try { await fn(); } finally { setZajete(""); } };

  const wybierzPlik = (z) => { celRef.current = z; plikRef.current?.click(); };
  const poWyborzePliku = (e) => {
    const lista = Array.from(e.target.files || []);
    const z = celRef.current;
    e.target.value = "";
    if (!z || !lista.length) return;
    zRobota(z.id, async () => { for (const p of lista) await api.wgraj(z, p); });
  };

  const zapiszEdycje = () => {
    const z = zadania.find(x => x.id === edycja.id);
    if (!z || !edycjaGotowa(z)) return;
    zRobota(z.id, async () => { if (await api.edytuj(z, { tytul: edycja.tytul, termin: edycja.termin, opis: edycja.opis, powod: edycja.powod, powiadom: edycja.powiadom })) setEdycja(null); });
  };

  const terminZmieniony = (z) => !!edycja && edycja.termin !== (z.termin || "");
  const edycjaGotowa = (z) => !!edycja.tytul.trim() && !!edycja.termin && (!terminZmieniony(z) || !!edycja.powod.trim());

  const zalacznik = (a) => {
    const styl = { background: "#eff6ff", color: "#1d4ed8", maxWidth: 150 };
    const klasa = "text-xs px-2 py-1 rounded-lg underline truncate block text-left";
    return czyObraz(a.nazwa)
      ? <button key={a.id} type="button" onClick={() => setPodglad(a)} className={klasa} style={styl} title={a.nazwa}>{a.nazwa || "zdjęcie"}</button>
      : <a key={a.id} href={safeHref(a.url)} target="_blank" rel="noopener noreferrer" className={klasa} style={styl} title={a.nazwa}>{a.nazwa || "plik"}</a>;
  };

  const wiersz = (z) => {
    const poTerminie = czyPoTerminie(z, dzis);
    const zrobioneJuz = z.status === "zrobione";
    const wEdycji = edycja?.id === z.id;
    const zmianaT = ostatniaZmianaTerminu(z);
    return (
      <tr key={z.id} style={{ borderTop: "1px solid #e5e7eb", background: zrobioneJuz ? "#f9fafb" : "#fff", opacity: zajete === z.id ? 0.55 : 1 }}>
        <td className={TD} style={{ width: 40 }}>
          <input type="checkbox" checked={zrobioneJuz} disabled={!!zajete}
            onChange={() => zRobota(z.id, () => api.oznacz(z, !zrobioneJuz))}
            aria-label={zrobioneJuz ? `Cofnij wykonanie: ${z.tytul}` : `Oznacz jako zrobione: ${z.tytul}`}
            style={{ width: 18, height: 18, accentColor: "#15803d" }} />
        </td>
        <td className={TD} style={{ minWidth: 240 }}>
          {wEdycji ? (
            <div className="space-y-2">
              <input className={`${POLE} w-full`} value={edycja.tytul} onChange={e => setEdycja({ ...edycja, tytul: e.target.value })} aria-label="Nazwa zadania" />
              <textarea className={`${POLE} w-full`} rows={2} placeholder="Opis (opcjonalnie)" value={edycja.opis} onChange={e => setEdycja({ ...edycja, opis: e.target.value })} aria-label="Opis" />
              {wyborOsob(edycja.powiadom, (l) => setEdycja({ ...edycja, powiadom: l }), `e-${z.id}`)}
            </div>
          ) : (
            <>
              <div className={`font-semibold ${zrobioneJuz ? "text-gray-600 line-through" : "text-gray-900"}`}>{z.tytul}</div>
              {z.opis && <div className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{z.opis}</div>}
              <div className="text-xs text-gray-600 mt-0.5">
                {(z.powiadom || []).length ? `Maile: ${z.powiadom.map(ktoKrotko).join(", ")}` : "Maile: nikt nie jest powiadamiany"}
              </div>
            </>
          )}
        </td>
        <td className={TD} style={{ minWidth: 150, maxWidth: 230 }}>
          {wEdycji ? (
            <div className="space-y-2">
              <input type="date" className={POLE} value={edycja.termin} onChange={e => setEdycja({ ...edycja, termin: e.target.value })} aria-label="Termin" />
              {terminZmieniony(z) && (
                <textarea className={`${POLE} w-full`} rows={2} value={edycja.powod} onChange={e => setEdycja({ ...edycja, powod: e.target.value })}
                  placeholder="Dlaczego zmieniasz termin? (wymagane)" aria-label="Powód zmiany terminu" maxLength={300}
                  style={edycja.powod.trim() ? undefined : { borderColor: "#b91c1c" }} />
              )}
            </div>
          ) : (
            <>
              {!z.termin ? <span className="text-gray-600">—</span>
                : poTerminie ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "#fef2f2", color: "#b91c1c" }}>po terminie · {fmtDzien(z.termin)}</span>
                : <span className={zrobioneJuz ? "text-gray-600" : "text-gray-900"}>{fmtDzien(z.termin)}</span>}
              {zmianaT && (
                <div className="text-xs text-gray-700 mt-1 break-words">
                  zmieniony z {zmianaT.z ? fmtDzien(zmianaT.z) : "braku"} · {ktoKrotko(zmianaT.kto)}, {fmtChwila(zmianaT.ts)}
                  <div className="text-gray-600">„{zmianaT.powod}”</div>
                </div>
              )}
            </>
          )}
        </td>
        <td className={`${TD} whitespace-nowrap`}>
          <div className="text-gray-900">{ktoKrotko(z.createdBy)}</div>
          <div className="text-xs text-gray-600">{fmtChwila(z.createdAt)}</div>
        </td>
        <td className={`${TD} whitespace-nowrap`}>
          {zrobioneJuz ? (
            <>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#15803d" }}>{ktoKrotko(z.zrobioneBy)}</span>
              <div className="text-xs text-gray-600 mt-0.5">{fmtChwila(z.zrobioneAt)}</div>
            </>
          ) : <span className="text-gray-600">—</span>}
        </td>
        <td className={TD}>
          <div className="flex flex-col gap-1 items-start">
            {(z.zalaczniki || []).map(zalacznik)}
            <button type="button" onClick={() => wybierzPlik(z)} disabled={!!zajete} className="text-xs font-semibold text-gray-700 hover:text-gray-900 whitespace-nowrap">+ zdjęcie / dokument</button>
          </div>
        </td>
        <td className={`${TD} whitespace-nowrap text-xs`}>
          {wEdycji ? (
            <div className="flex flex-col gap-1 items-start">
              <button type="button" onClick={zapiszEdycje} disabled={!edycjaGotowa(z) || !!zajete} className="px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: "#111827" }}>Zapisz</button>
              <button type="button" onClick={() => setEdycja(null)} className="px-3 py-1.5 rounded-lg font-semibold text-gray-700 bg-gray-100">Anuluj</button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 items-start">
              <button type="button" onClick={() => setEdycja({ id: z.id, tytul: z.tytul, termin: z.termin || "", opis: z.opis || "", powod: "", powiadom: z.powiadom || [] })} disabled={!!zajete} className="font-semibold text-gray-700 hover:text-gray-900">Edytuj</button>
              <button type="button" onClick={() => zRobota(z.id, () => api.usun(z))} disabled={!!zajete} className="font-semibold text-red-700 hover:text-red-900">Usuń</button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 md:p-6 overflow-y-auto"
      style={{ background: "rgba(17,24,39,0.45)" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Do zrobienia na bazie — ${v.plate}`}
        className="bg-white rounded-2xl w-full flex flex-col" style={{ maxWidth: 1180 }}>

        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <div className="text-base font-bold text-gray-900">Do zrobienia na bazie — {v.plate}</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {v.brand ? `${v.brand} · ` : ""}{naBazie ? "auto jest na bazie" : "auto poza bazą — lista czeka na powrót"}
              {" · "}do zrobienia: {otwarte.length}{poTerminieIle ? `, po terminie: ${poTerminieIle}` : ""} · zrobione: {zrobione.length}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button" onClick={() => setPokazOs(x => !x)} aria-expanded={pokazOs}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={pokazOs ? { background: "#111827", color: "#fff" } : { background: "#f3f4f6", color: "#374151" }}>
              Chronologia · {os.length}
            </button>
            <button type="button" onClick={onClose} aria-label="Zamknij" className="text-gray-600 hover:text-gray-900 text-xl leading-none px-1">×</button>
          </div>
        </div>

        {pokazOs && (
          <div className="px-5 py-3 overflow-y-auto" style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa", maxHeight: 260 }}>
            {os.length ? (
              <ol>
                {os.map(h => (
                  <li key={`${h.zadanieId}-${h.id}`} className="py-1.5 flex gap-3 text-xs">
                    <span className="text-gray-600 flex-shrink-0" style={{ width: 118 }}>{fmtChwila(h.ts)}</span>
                    <span className="text-gray-900 flex-shrink-0" style={{ width: 90 }}>{ktoKrotko(h.kto)}</span>
                    <span className="flex-1 min-w-0 text-gray-800 break-words">
                      <strong>{TYPY_ZDARZEN[h.typ] || h.typ}</strong> — {h.tytul}{h.opis ? <span className="text-gray-600"> ({h.opis})</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-gray-600">Brak zdarzeń.</p>}
          </div>
        )}

        <form onSubmit={dodaj} className="px-5 py-3 space-y-2" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div className="flex flex-wrap gap-2 items-center">
            <input ref={tytulRef} className={`${POLE} flex-1`} style={{ minWidth: 200 }} placeholder="Co jest do zrobienia? np. zmiana opon"
              value={tytul} onChange={e => setTytul(e.target.value)} aria-label="Nowe zadanie" maxLength={120} />
            <input className={`${POLE} flex-1`} style={{ minWidth: 200 }} placeholder="Opis (opcjonalnie) — co dokładnie, części"
              value={opis} onChange={e => setOpis(e.target.value)} aria-label="Opis zadania" />
            <label className="text-xs text-gray-700 flex items-center gap-1.5">Termin (wymagany)
              <input type="date" required min={dzis} className={POLE} value={termin} onChange={e => setTermin(e.target.value)} aria-label="Termin wykonania" />
            </label>
            <button type="submit" disabled={!tytul.trim() || !termin || !!zajete}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#111827" }}>
              {zajete === "nowe" ? "Zapisuję…" : "+ Dodaj"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {PODPOWIEDZI_ZADAN.map(p => (
              <button key={p} type="button" onClick={() => setTytul(p)}
                className="text-xs px-2 py-1 rounded-full bg-white border border-gray-300 text-gray-700 hover:border-gray-600">{p}</button>
            ))}
            <button type="button" onClick={() => { setTytul(""); tytulRef.current?.focus(); }}
              className="text-xs px-2 py-1 rounded-full bg-white border border-dashed border-gray-500 text-gray-700 hover:border-gray-800">Inne — wpisz własne</button>
            <input ref={plikNowyRef} type="file" multiple accept="image/*,.heic,.heif,application/pdf" className="text-xs text-gray-700 ml-auto"
              onChange={e => setPliki(Array.from(e.target.files || []))} aria-label="Zdjęcie lub dokument do zadania" />
          </div>
          {wyborOsob(powiadom, setPowiadom, "n")}
          <p className="text-xs text-gray-600">
            Zaznaczone osoby dostają maila od razu po dodaniu, po każdej zmianie terminu i codziennie o 7:00 (pon–pt), dopóki zadanie nie zostanie odhaczone.
          </p>
        </form>

        <div className="overflow-x-auto pb-3">
          {wiersze.length ? (
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th className={TH}><span className="sr-only">Zrobione</span></th>
                  <th className={TH}>Zadanie</th>
                  <th className={TH}>Termin</th>
                  <th className={TH}>Dodał(a)</th>
                  <th className={TH}>Zrobił(a)</th>
                  <th className={TH}>Zdjęcia i dokumenty</th>
                  <th className={TH}><span className="sr-only">Akcje</span></th>
                </tr>
              </thead>
              <tbody>{wiersze.map(wiersz)}</tbody>
            </table>
          ) : <p className="text-sm text-gray-600 py-10 text-center">Nic do zrobienia przy tym aucie. Dodaj pierwsze zadanie powyżej.</p>}
        </div>

        <input ref={plikRef} type="file" multiple accept="image/*,.heic,.heif,application/pdf" className="hidden" onChange={poWyborzePliku} />
      </div>

      {podglad && (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-4" style={{ background: "rgba(17,24,39,0.9)", zIndex: 60 }}
          role="dialog" aria-modal="true" aria-label={`Podgląd: ${podglad.nazwa}`} onMouseDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) setPodglad(null); }}>
          <img src={safeHref(podglad.url)} alt={podglad.nazwa || "zdjęcie"} style={{ maxWidth: "100%", maxHeight: "calc(100vh - 90px)", borderRadius: 8 }} />
          <div className="mt-3 flex items-center gap-4 text-sm text-white">
            <span className="truncate" style={{ maxWidth: 320 }}>{podglad.nazwa}</span>
            <a href={safeHref(podglad.url)} target="_blank" rel="noopener noreferrer" className="underline">Otwórz w nowej karcie</a>
            <button type="button" onClick={() => setPodglad(null)} className="px-3 py-1.5 rounded-lg font-semibold bg-white text-gray-900">Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}
