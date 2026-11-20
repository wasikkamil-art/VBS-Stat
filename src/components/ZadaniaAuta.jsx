// ZadaniaAuta — okno „Do zrobienia na bazie" otwierane z kafelka Przeglądu: prace przy aucie
// (opony, olej, naprawy) z terminem, odhaczaniem, zdjęciami/dokumentami i chronologią zdarzeń.
//
// Komponent PREZENTACYJNY (jak UruchomienieAuta): nie importuje Firebase. Lista przychodzi
// w `zadania` (żywy nasłuch z App), a zapisy w `api`:
//   dodaj(v, { tytul, opis, termin }) → zadanie | null     edytuj(z, pola) → true/false
//   oznacz(z, czyZrobione) → true/false                     usun(z) → true/false
//   wgraj(z, plik) → true/false

import { useEffect, useMemo, useRef, useState } from "react";
import { PODPOWIEDZI_ZADAN, TYPY_ZDARZEN, czyPoTerminie, dzisIso, podzielZadania, chronologiaZadan } from "../utils/zadaniaAuta";

const POLE = "px-2.5 py-2 rounded-lg text-sm bg-white border border-gray-300 text-gray-900 outline-none focus:border-gray-600";
const fmtDzien = (iso) => { if (!iso) return ""; const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}.${m}.${y}`; };
const fmtChwila = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
const ktoKrotko = (email) => (email || "").split("@")[0] || "—";

export default function ZadaniaAuta({ v, zadania, api, naBazie = false, onClose, safeHref = (u) => u }) {
  const [widok, setWidok] = useState("otwarte");            // otwarte | zrobione | chronologia
  const [tytul, setTytul] = useState("");
  const [termin, setTermin] = useState("");
  const [opis, setOpis] = useState("");
  const [pliki, setPliki] = useState([]);
  const [zajete, setZajete] = useState("");                 // "nowe" albo id zadania w trakcie zapisu
  const [edycja, setEdycja] = useState(null);               // { id, tytul, termin, opis }
  const plikNowyRef = useRef(null);
  const plikRef = useRef(null);
  const celRef = useRef(null);

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const dzis = dzisIso();
  const { otwarte, zrobione } = useMemo(() => podzielZadania(zadania), [zadania]);
  const os = useMemo(() => chronologiaZadan(zadania), [zadania]);

  const dodaj = async (e) => {
    e.preventDefault();
    if (!tytul.trim() || zajete) return;
    setZajete("nowe");
    try {
      const nowe = await api.dodaj(v, { tytul, opis, termin });
      if (nowe) {
        for (const p of pliki) await api.wgraj(nowe, p);
        setTytul(""); setTermin(""); setOpis(""); setPliki([]);
        if (plikNowyRef.current) plikNowyRef.current.value = "";
        setWidok("otwarte");
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
    if (!z || !edycja.tytul.trim()) return;
    zRobota(z.id, async () => { if (await api.edytuj(z, { tytul: edycja.tytul, termin: edycja.termin, opis: edycja.opis })) setEdycja(null); });
  };

  const wiersz = (z) => {
    const poTerminie = czyPoTerminie(z, dzis);
    const zrobioneJuz = z.status === "zrobione";
    const wEdycji = edycja?.id === z.id;
    return (
      <li key={z.id} className="py-3 flex gap-3" style={{ borderTop: "1px solid #f3f4f6", opacity: zajete === z.id ? 0.55 : 1 }}>
        <input type="checkbox" checked={zrobioneJuz} disabled={!!zajete}
          onChange={() => zRobota(z.id, () => api.oznacz(z, !zrobioneJuz))}
          aria-label={zrobioneJuz ? `Cofnij wykonanie: ${z.tytul}` : `Oznacz jako zrobione: ${z.tytul}`}
          className="mt-1 flex-shrink-0" style={{ width: 18, height: 18, accentColor: "#15803d" }} />
        <div className="flex-1 min-w-0">
          {wEdycji ? (
            <div className="space-y-2">
              <input className={`${POLE} w-full`} value={edycja.tytul} onChange={e => setEdycja({ ...edycja, tytul: e.target.value })} aria-label="Nazwa zadania" />
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-600">Termin
                  <input type="date" className={`${POLE} ml-2`} value={edycja.termin} onChange={e => setEdycja({ ...edycja, termin: e.target.value })} />
                </label>
              </div>
              <textarea className={`${POLE} w-full`} rows={2} placeholder="Opis (opcjonalnie)" value={edycja.opis} onChange={e => setEdycja({ ...edycja, opis: e.target.value })} />
              <div className="flex gap-2">
                <button type="button" onClick={zapiszEdycje} disabled={!edycja.tytul.trim() || !!zajete}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: "#111827" }}>Zapisz</button>
                <button type="button" onClick={() => setEdycja(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100">Anuluj</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`text-sm font-semibold ${zrobioneJuz ? "text-gray-600 line-through" : "text-gray-900"}`}>{z.tytul}</span>
                {z.termin && !zrobioneJuz && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={poTerminie ? { background: "#fef2f2", color: "#b91c1c" } : { background: "#f3f4f6", color: "#374151" }}>
                    {poTerminie ? "po terminie · " : "do "}{fmtDzien(z.termin)}
                  </span>
                )}
                {zrobioneJuz && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#15803d" }}>
                    zrobione {fmtDzien(z.zrobioneAt)} · {ktoKrotko(z.zrobioneBy)}
                  </span>
                )}
              </div>
              {z.opis && <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap break-words">{z.opis}</p>}
              {(z.zalaczniki || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {z.zalaczniki.map(a => (
                    <a key={a.id} href={safeHref(a.url)} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded-lg underline truncate" style={{ background: "#eff6ff", color: "#1d4ed8", maxWidth: 220 }}>
                      {a.nazwa || "plik"}
                    </a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                <button type="button" onClick={() => wybierzPlik(z)} disabled={!!zajete} className="font-semibold text-gray-700 hover:text-gray-900">+ zdjęcie / dokument</button>
                <button type="button" onClick={() => setEdycja({ id: z.id, tytul: z.tytul, termin: z.termin || "", opis: z.opis || "" })} disabled={!!zajete} className="font-semibold text-gray-700 hover:text-gray-900">Edytuj</button>
                <button type="button" onClick={() => zRobota(z.id, () => api.usun(z))} disabled={!!zajete} className="font-semibold text-red-700 hover:text-red-900">Usuń</button>
                <span className="text-gray-600 ml-auto">dodał(a) {ktoKrotko(z.createdBy)} · {fmtDzien(z.createdAt)}</span>
              </div>
            </>
          )}
        </div>
      </li>
    );
  };

  const zakladka = (id, etykieta, ile) => (
    <button type="button" role="tab" aria-selected={widok === id} onClick={() => setWidok(id)}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
      style={widok === id ? { background: "#111827", color: "#fff" } : { background: "#f3f4f6", color: "#374151" }}>
      {etykieta}{ile != null ? ` · ${ile}` : ""}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-3 md:p-6 overflow-y-auto"
      style={{ background: "rgba(17,24,39,0.45)" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Do zrobienia na bazie — ${v.plate}`}
        className="bg-white rounded-2xl w-full flex flex-col" style={{ maxWidth: 640, maxHeight: "calc(100vh - 24px)" }}>

        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div>
            <div className="text-base font-bold text-gray-900">Do zrobienia na bazie</div>
            <div className="text-xs text-gray-600 mt-0.5">
              {v.plate}{v.brand ? ` · ${v.brand}` : ""} · {naBazie ? "auto jest na bazie" : "auto poza bazą — lista czeka na powrót"}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="text-gray-600 hover:text-gray-900 text-xl leading-none px-1">×</button>
        </div>

        <form onSubmit={dodaj} className="px-5 py-3 space-y-2" style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
          <div className="flex flex-wrap gap-2">
            <input className={`${POLE} flex-1`} style={{ minWidth: 180 }} placeholder="Co jest do zrobienia? np. zmiana opon"
              value={tytul} onChange={e => setTytul(e.target.value)} aria-label="Nowe zadanie" maxLength={120} />
            <input type="date" className={POLE} value={termin} onChange={e => setTermin(e.target.value)} aria-label="Termin wykonania" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PODPOWIEDZI_ZADAN.map(p => (
              <button key={p} type="button" onClick={() => setTytul(p)}
                className="text-xs px-2 py-1 rounded-full bg-white border border-gray-300 text-gray-700 hover:border-gray-600">{p}</button>
            ))}
          </div>
          <textarea className={`${POLE} w-full`} rows={2} placeholder="Opis (opcjonalnie) — co dokładnie, gdzie, części"
            value={opis} onChange={e => setOpis(e.target.value)} aria-label="Opis zadania" />
          <div className="flex flex-wrap items-center gap-2">
            <input ref={plikNowyRef} type="file" multiple accept="image/*,application/pdf" className="text-xs text-gray-700 flex-1" style={{ minWidth: 180 }}
              onChange={e => setPliki(Array.from(e.target.files || []))} aria-label="Zdjęcie lub dokument do zadania" />
            <button type="submit" disabled={!tytul.trim() || !!zajete}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#111827" }}>
              {zajete === "nowe" ? "Zapisuję…" : "Dodaj"}
            </button>
          </div>
        </form>

        <div className="px-5 pt-3 flex gap-2" role="tablist">
          {zakladka("otwarte", "Do zrobienia", otwarte.length)}
          {zakladka("zrobione", "Zrobione", zrobione.length)}
          {zakladka("chronologia", "Chronologia")}
        </div>

        <div className="px-5 pb-4 pt-2 overflow-y-auto" style={{ minHeight: 140 }}>
          {widok === "otwarte" && (otwarte.length
            ? <ul>{otwarte.map(wiersz)}</ul>
            : <p className="text-sm text-gray-600 py-6 text-center">Nic do zrobienia przy tym aucie.</p>)}
          {widok === "zrobione" && (zrobione.length
            ? <ul>{zrobione.map(wiersz)}</ul>
            : <p className="text-sm text-gray-600 py-6 text-center">Jeszcze nic nie odhaczono.</p>)}
          {widok === "chronologia" && (os.length
            ? <ol>
                {os.map(h => (
                  <li key={`${h.zadanieId}-${h.id}`} className="py-2 flex gap-3 text-xs" style={{ borderTop: "1px solid #f3f4f6" }}>
                    <span className="text-gray-600 flex-shrink-0" style={{ width: 118 }}>{fmtChwila(h.ts)}</span>
                    <span className="flex-1 min-w-0 text-gray-800 break-words">
                      <strong>{TYPY_ZDARZEN[h.typ] || h.typ}</strong> — {h.tytul}{h.opis ? <span className="text-gray-600"> ({h.opis})</span> : null}
                    </span>
                    <span className="text-gray-600 flex-shrink-0">{ktoKrotko(h.kto)}</span>
                  </li>
                ))}
              </ol>
            : <p className="text-sm text-gray-600 py-6 text-center">Brak zdarzeń.</p>)}
        </div>

        <input ref={plikRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={poWyborzePliku} />
      </div>
    </div>
  );
}
