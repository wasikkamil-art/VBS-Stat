// Nowy panel pojazdów (XI.2026) — lista floty po lewej, karta wybranego auta po prawej.
//
// Komponent jest CZYSTO PREZENTACYJNY: nie importuje Firebase, wszystko dostaje w propsach,
// a zapisy oddaje przez callbacki. Dzięki temu ta sama karta działa w aplikacji i w atrapie
// `podglad/pojazdy` bez stubów.
//
// Dane pojazdu to te same pola co dotąd (`fleet/data.fleetv2_vehicles`) — stare auta nie
// wymagają migracji. Nowe są tylko: `leasing` (obiekt) i dokumenty pojazdu (`docs`).
import { useMemo, useState } from "react";
import UruchomienieAuta from "./UruchomienieAuta";

// Rodzaje dokumentów pojazdu. `oferta: true` = domyślnie proponowany do dołączenia do oferty.
export const RODZAJE_DOKUMENTOW = [
  { id: "dowod",        label: "Dowód rejestracyjny",            grupa: "Rejestracja i homologacja", oferta: true },
  { id: "coc",          label: "Świadectwo zgodności (COC)",     grupa: "Rejestracja i homologacja" },
  { id: "oswiadczenie", label: "Oświadczenie do rejestracji",    grupa: "Rejestracja i homologacja" },
  { id: "cemt",         label: "Certyfikat CEMT / Euro",         grupa: "Rejestracja i homologacja", oferta: true },
  { id: "protokol",     label: "Protokół przekazania",           grupa: "Rejestracja i homologacja" },
  { id: "polisa",       label: "Polisa OC / AC",                 grupa: "Ubezpieczenia", oferta: true },
  { id: "gap",          label: "Polisa GAP",                     grupa: "Ubezpieczenia" },
  { id: "umowa",        label: "Umowa leasingu",                 grupa: "Leasing" },
  { id: "aneks",        label: "Aneks do umowy",                 grupa: "Leasing" },
  { id: "harmonogram",  label: "Harmonogram rat",                grupa: "Leasing" },
  { id: "upowaznienie", label: "Upoważnienie leasingodawcy",     grupa: "Leasing", oferta: true },
  { id: "udt",          label: "Decyzja / protokół UDT",         grupa: "Winda i UDT", oferta: true },
  { id: "winda",        label: "Dokumenty windy",                grupa: "Winda i UDT" },
  { id: "tachograf",    label: "Kalibracja tachografu",          grupa: "Tachograf" },
  { id: "gwarancja",    label: "Gwarancja / serwis",             grupa: "Serwis i gwarancje" },
  { id: "faktura",      label: "Faktura",                        grupa: "Faktury" },
  { id: "inne",         label: "Inne",                           grupa: "Inne" },
];
const RODZAJ = Object.fromEntries(RODZAJE_DOKUMENTOW.map(r => [r.id, r]));
const GRUPY = [...new Set(RODZAJE_DOKUMENTOW.map(r => r.grupa))];

const WYPOSAZENIE = {
  paleciak: "Paleciak", winda: "Winda załadunkowa", pasy: "Pasy mocujące", gasnica: "Gaśnica",
  apteczka: "Apteczka", "trójkąt": "Trójkąt ostrzegawczy", tachograf: "Tachograf cyfrowy",
  gps: "GPS / lokalizator", "chłodnia": "Agregat chłodniczy", plandeka: "Plandeka",
};

const DZIEN = 86400000;
const dniDo = (data, dzis) => {
  if (!data) return null;
  const t = Date.parse(`${data}T00:00:00`);
  return isNaN(t) ? null : Math.round((t - dzis) / DZIEN);
};
const fmtData = (d) => (d ? d.split("-").reverse().join(".") : "—");
const fmtKwota = (n, waluta) =>
  n === "" || n == null || isNaN(Number(n)) ? "—"
    : `${Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${waluta === "EUR" ? "€" : "zł"}`;

/** Wszystkie terminy auta w jednym miejscu: pola karty + dokumenty z datą ważności. */
export function terminyPojazdu(v, docs, dzis) {
  const lista = [
    { nazwa: "Przegląd techniczny", data: v.inspectionExpiry },
    { nazwa: "OC", data: v.ocExpiry },
    { nazwa: "AC", data: v.acExpiry },
    { nazwa: "GAP", data: v.gapExpiry },
    { nazwa: "UDT windy", data: v.udtExpiry },
    { nazwa: "Koniec leasingu", data: v.leasing?.koniec },
  ];
  const nastepnaRata = (v.leasing?.harmonogram || []).find(r => dniDo(r.data, dzis) >= 0);
  if (nastepnaRata) lista.push({ nazwa: `Rata leasingu nr ${nastepnaRata.lp}`, data: nastepnaRata.data, kwota: nastepnaRata.rata, waluta: v.leasing?.waluta, rata: true });
  for (const d of docs) {
    if (!d.expiryDate) continue;
    // Polisa i UDT mają już swój termin w polach karty — nie dublujemy.
    if (["polisa", "gap", "udt", "dowod"].includes(d.kind)) continue;
    lista.push({ nazwa: RODZAJ[d.kind]?.label || d.label, data: d.expiryDate });
  }
  return lista
    .filter(t => t.data)
    .map(t => ({ ...t, dni: dniDo(t.data, dzis) }))
    .sort((a, b) => a.dni - b.dni);
}

function Znaczek({ dni }) {
  if (dni == null) return null;
  const [tlo, kolor, tekst] =
    dni < 0 ? ["#fee2e2", "#991b1b", `${-dni} dni po terminie`]
    : dni <= 30 ? ["#fef3c7", "#92400e", dni === 0 ? "dziś" : `za ${dni} dni`]
    : ["#f3f4f6", "#374151", dni > 365 ? `za ${Math.round(dni / 30.4)} mies.` : `za ${dni} dni`];
  return <span className="text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tlo, color: kolor }}>{tekst}</span>;
}

function Ikona({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
}
const I = {
  plik: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  pobierz: <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
  strzalka: <path d="m6 9 6 6 6-6" />,
  kopiuj: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  olowek: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  kosz: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
};

function Sekcja({ tytul, licznik, domyslnieOtwarta = false, children, akcja }) {
  const [otwarta, setOtwarta] = useState(domyslnieOtwarta);
  return (
    <section className="border-t border-gray-100">
      <div className="flex items-center gap-2 px-5">
        <button type="button" onClick={() => setOtwarta(o => !o)} aria-expanded={otwarta}
          className="flex-1 flex items-center gap-2 py-3.5 text-left text-sm font-semibold text-gray-900">
          <span className="transition-transform" style={{ transform: otwarta ? "rotate(0deg)" : "rotate(-90deg)" }}><Ikona d={I.strzalka} /></span>
          {tytul}
          {licznik != null && <span className="text-xs font-medium text-gray-500">({licznik})</span>}
        </button>
        {otwarta && akcja}
      </div>
      {otwarta && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function Fakt({ etykieta, children }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-gray-500">{etykieta}</div>
      <div className="text-sm font-medium text-gray-900 break-words">{children || "—"}</div>
    </div>
  );
}

/** Treść oferty: dane podstawowe + wybrane dokumenty jako linki. */
export function zbudujOferte(v, kierowca, wybraneDokumenty) {
  const wyp = [...(v.equipment || []).map(id => WYPOSAZENIE[id] || id), ...(v.customEquipment || [])];
  const rej = v.plate2 ? `${v.plate} / ${v.plate2}` : v.plate;
  const wym = v.plate2 ? `${v.dimensions || "—"} (${v.plate}) / ${v.dimensions2 || "—"} (${v.plate2})` : (v.dimensions || "—");
  const waga = v.plate2 ? `${v.maxWeight || "—"} kg (${v.plate}) / ${v.maxWeight2 || "—"} kg (${v.plate2})` : `${v.maxWeight || "—"} kg`;
  const wiersze = [
    `${v.brand || ""} ${v.year || ""}`.trim(),
    `📋 Rejestracja: ${rej}`,
    kierowca ? `👤 Kierowca: ${kierowca.name}` : null,
    kierowca?.phone ? `📞 Tel: ${kierowca.phone}` : null,
    `📦 Rodzaj: ${v.type || "—"}${v.plate2 ? " + Przyczepa" : ""}`,
    v.loadingType ? `🔄 Załadunek: ${v.loadingType}` : null,
    `📐 Wymiary: ${wym}`,
    `⚖️ Max waga: ${waga}`,
    wyp.length ? `🔧 Wyposażenie: ${wyp.join(", ")}` : null,
  ].filter(Boolean);
  if (wybraneDokumenty.length) {
    wiersze.push("", "📎 Dokumenty:");
    for (const d of wybraneDokumenty) wiersze.push(`• ${d.label}${d.expiryDate ? ` (ważne do ${fmtData(d.expiryDate)})` : ""}: ${d.fileUrl || "brak pliku"}`);
  }
  return wiersze.join("\n");
}

function OknoOferty({ v, kierowca, docs, onClose, showToast }) {
  const zPlikiem = docs.filter(d => d.fileUrl);
  const [wybrane, setWybrane] = useState(() => new Set(zPlikiem.filter(d => RODZAJ[d.kind]?.oferta).map(d => d.id)));
  const tekst = zbudujOferte(v, kierowca, zPlikiem.filter(d => wybrane.has(d.id)));
  const przelacz = (id) => setWybrane(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const kopiuj = async () => {
    try { await navigator.clipboard.writeText(tekst); showToast?.("Oferta skopiowana"); onClose(); }
    catch { showToast?.("Nie udało się skopiować — zaznacz tekst i skopiuj ręcznie"); }
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label="Oferta pojazdu" className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">Oferta — {v.plate}</h3>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-sm">✕</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 p-5 overflow-y-auto">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Dołącz dokumenty</div>
            {zPlikiem.length === 0 && <p className="text-sm text-gray-500">To auto nie ma jeszcze wgranych plików.</p>}
            <ul className="space-y-1">
              {zPlikiem.map(d => (
                <li key={d.id}>
                  <label className="flex items-start gap-2 text-sm text-gray-800 py-1 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={wybrane.has(d.id)} onChange={() => przelacz(d.id)} />
                    <span>{d.label}{d.expiryDate && <span className="text-gray-500"> · do {fmtData(d.expiryDate)}</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
            {wybrane.size > 0 && (
              <p className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Link otwiera plik każdemu, kto go dostanie — bez logowania. Dołączaj tylko to, co klient ma zobaczyć.
              </p>
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Podgląd tekstu</div>
            <textarea readOnly value={tekst} rows={14} aria-label="Treść oferty"
              className="w-full text-xs rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-800" style={{ fontFamily: "'DM Mono', monospace" }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">Anuluj</button>
          <button type="button" onClick={kopiuj} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#111827" }}>Kopiuj ofertę</button>
        </div>
      </div>
    </div>
  );
}

const POLE = "block w-full mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200";

/**
 * Harmonogram z pliku CSV leasingodawcy: `Lp.;Data płatności;Kapitał;Odsetki;Rata leasingowa netto`.
 * Wiersz nagłówka i wiersz „SUMA RAT” są pomijane. Zwraca [] gdy plik nie ma ani jednej raty.
 */
export function parsujHarmonogramCsv(tekst) {
  const liczba = (x) => Number(String(x || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
  return String(tekst || "").split(/\r?\n/).map(l => l.split(/[;\t]/).map(k => k.trim()))
    .filter(k => /^\d+$/.test(k[0]) && /^\d{4}-\d{2}-\d{2}$/.test(k[1] || ""))
    .map(k => ({ lp: Number(k[0]), data: k[1], kapital: liczba(k[2]), odsetki: liczba(k[3]), rata: liczba(k[4]) }))
    .filter(r => r.rata > 0);
}

function EdycjaDokumentu({ d, onZapisz, onAnuluj }) {
  const [f, setF] = useState({ label: d.label || "", kind: d.kind || "inne", number: d.number || "", issueDate: d.issueDate || "", expiryDate: d.expiryDate || "", notes: d.notes || "" });
  const [zapis, setZapis] = useState(false);
  const ustaw = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const zapisz = async (e) => {
    e.preventDefault();
    if (!f.label.trim()) return;
    setZapis(true);
    const ok = await onZapisz(d, { ...f, label: f.label.trim(), number: f.number.trim(), notes: f.notes.trim() });
    setZapis(false);
    if (ok !== false) onAnuluj();
  };
  return (
    <form onSubmit={zapisz} className="grid sm:grid-cols-6 gap-2 px-3 py-3 bg-gray-50">
      <label className="text-xs text-gray-600 sm:col-span-4">Opis
        <input type="text" required value={f.label} onChange={ustaw("label")} className={POLE} style={{ background: "#fff" }} />
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Rodzaj
        <select value={f.kind} onChange={ustaw("kind")} className={POLE} style={{ background: "#fff" }}>
          {GRUPY.map(g => <optgroup key={g} label={g}>{RODZAJE_DOKUMENTOW.filter(r => r.grupa === g).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Numer
        <input type="text" value={f.number} onChange={ustaw("number")} className={POLE} style={{ background: "#fff" }} />
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Data dokumentu
        <input type="date" value={f.issueDate} onChange={ustaw("issueDate")} className={POLE} style={{ background: "#fff" }} />
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Ważny do
        <input type="date" value={f.expiryDate} onChange={ustaw("expiryDate")} className={POLE} style={{ background: "#fff" }} />
      </label>
      <label className="text-xs text-gray-600 sm:col-span-6">Uwagi
        <input type="text" value={f.notes} onChange={ustaw("notes")} className={POLE} style={{ background: "#fff" }} />
      </label>
      <div className="sm:col-span-6 flex justify-end gap-2">
        <button type="button" onClick={onAnuluj} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-200">Anuluj</button>
        <button type="submit" disabled={zapis} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#111827" }}>{zapis ? "Zapisuję…" : "Zapisz"}</button>
      </div>
    </form>
  );
}

const PUSTY_LEASING = { umowa: "", finansujacy: "", waluta: "PLN", zawarta: "", koniec: "", liczbaRat: "", rata: "", oplataWstepna: "", wykup: "", harmonogram: [] };

function EdycjaLeasingu({ leasing, onZapisz, onAnuluj, onUsun, showToast }) {
  const [f, setF] = useState({ ...PUSTY_LEASING, ...(leasing || {}) });
  const [zapis, setZapis] = useState(false);
  const ustaw = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const wczytajCsv = async (e) => {
    const plik = e.target.files?.[0]; e.target.value = "";
    if (!plik) return;
    const raty = parsujHarmonogramCsv(await plik.text());
    if (!raty.length) { showToast?.("Nie znalazłem rat w tym pliku — oczekuję CSV: Lp.;Data płatności;Kapitał;Odsetki;Rata"); return; }
    // Rata „typowa” = najczęstsza kwota (pierwsza bywa powiększona o koszt finansowania).
    const ile = {}; for (const r of raty) ile[r.rata] = (ile[r.rata] || 0) + 1;
    const typowa = Number(Object.entries(ile).sort((a, b) => b[1] - a[1])[0][0]);
    setF(p => ({ ...p, harmonogram: raty, liczbaRat: raty.length, rata: typowa }));
    showToast?.(`Wczytano ${raty.length} rat z pliku`);
  };
  const zapisz = async (e) => {
    e.preventDefault();
    setZapis(true);
    const kwota = (x) => (x === "" || x == null || isNaN(Number(String(x).replace(",", "."))) ? "" : Number(String(x).replace(",", ".")));
    const ok = await onZapisz({
      umowa: String(f.umowa).trim(), finansujacy: String(f.finansujacy).trim(), waluta: f.waluta === "EUR" ? "EUR" : "PLN",
      zawarta: f.zawarta || "", koniec: f.koniec || "", liczbaRat: kwota(f.liczbaRat), rata: kwota(f.rata),
      oplataWstepna: kwota(f.oplataWstepna), wykup: kwota(f.wykup), harmonogram: f.harmonogram || [],
    });
    setZapis(false);
    if (ok !== false) onAnuluj();
  };
  return (
    <form onSubmit={zapisz} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <label className="text-xs text-gray-600 col-span-2">Numer umowy<input type="text" required value={f.umowa} onChange={ustaw("umowa")} className={POLE} /></label>
      <label className="text-xs text-gray-600 col-span-2">Finansujący<input type="text" value={f.finansujacy} onChange={ustaw("finansujacy")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Waluta
        <select value={f.waluta} onChange={ustaw("waluta")} className={POLE}><option value="PLN">zł</option><option value="EUR">EUR</option></select>
      </label>
      <label className="text-xs text-gray-600">Rata netto<input type="number" step="0.01" min="0" value={f.rata} onChange={ustaw("rata")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Liczba rat<input type="number" step="1" min="0" value={f.liczbaRat} onChange={ustaw("liczbaRat")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Opłata wstępna<input type="number" step="0.01" min="0" value={f.oplataWstepna} onChange={ustaw("oplataWstepna")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Zawarta<input type="date" value={f.zawarta} onChange={ustaw("zawarta")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Koniec umowy<input type="date" value={f.koniec} onChange={ustaw("koniec")} className={POLE} /></label>
      <label className="text-xs text-gray-600">Wykup<input type="number" step="0.01" min="0" value={f.wykup} onChange={ustaw("wykup")} className={POLE} /></label>
      <div className="text-xs text-gray-600 flex flex-col justify-end">
        Harmonogram: {(f.harmonogram || []).length ? `${f.harmonogram.length} rat` : "brak"}
        <label className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-800 bg-gray-100 cursor-pointer">
          Wczytaj z CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={wczytajCsv} />
        </label>
      </div>
      <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center gap-2 pt-1">
        {leasing && onUsun && <button type="button" onClick={onUsun} className="text-xs font-medium text-gray-600 hover:text-red-700 mr-auto">Usuń dane leasingu…</button>}
        <span className="flex-1" />
        <button type="button" onClick={onAnuluj} className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">Anuluj</button>
        <button type="submit" disabled={zapis} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#111827" }}>{zapis ? "Zapisuję…" : "Zapisz leasing"}</button>
      </div>
    </form>
  );
}

function ListaDokumentow({ docs, canEdit, onDodaj, onUsun, onEdytuj, safeHref }) {
  const [edytowany, setEdytowany] = useState(null);
  const [rodzaj, setRodzaj] = useState("dowod");
  const [waznyDo, setWaznyDo] = useState("");
  const [opis, setOpis] = useState("");
  const wGrupach = GRUPY.map(g => [g, docs.filter(d => (RODZAJ[d.kind]?.grupa || "Inne") === g)]).filter(([, l]) => l.length);
  return (
    <div>
      {docs.length === 0 && <p className="text-sm text-gray-500 mb-3">Brak dokumentów przy tym aucie.</p>}
      {wGrupach.map(([grupa, lista]) => (
        <div key={grupa} className="mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{grupa}</div>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {lista.map(d => (
              <li key={d.id}>
                <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-gray-400 flex-shrink-0"><Ikona d={I.plik} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{d.label}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {[d.number && `nr ${d.number}`, d.issueDate && `z ${fmtData(d.issueDate)}`, d.expiryDate && `ważne do ${fmtData(d.expiryDate)}`, d.notes].filter(Boolean).join(" · ") || RODZAJ[d.kind]?.label}
                  </div>
                </div>
                {d.fileUrl
                  ? <a href={safeHref ? safeHref(d.fileUrl) : d.fileUrl} target="_blank" rel="noopener noreferrer" download
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50" aria-label={`Pobierz: ${d.label}`}>
                      <Ikona d={I.pobierz} /> Pobierz
                    </a>
                  : <span className="text-xs text-gray-500 px-2">bez pliku</span>}
                {canEdit && onEdytuj && (
                  <button type="button" onClick={() => setEdytowany(e => e === d.id ? null : d.id)} aria-label={`Edytuj opis: ${d.label}`} aria-pressed={edytowany === d.id} className="text-gray-400 hover:text-gray-900 p-1.5"><Ikona d={I.olowek} /></button>
                )}
                {canEdit && onUsun && (
                  <button type="button" onClick={() => onUsun(d)} aria-label={`Usuń: ${d.label}`} className="text-gray-400 hover:text-red-700 p-1.5"><Ikona d={I.kosz} /></button>
                )}
                </div>
                {edytowany === d.id && <EdycjaDokumentu d={d} onZapisz={onEdytuj} onAnuluj={() => setEdytowany(null)} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {canEdit && onDodaj && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <label className="text-xs text-gray-600">Rodzaj
            <select value={rodzaj} onChange={e => setRodzaj(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200">
              {GRUPY.map(g => <optgroup key={g} label={g}>{RODZAJE_DOKUMENTOW.filter(r => r.grupa === g).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="text-xs text-gray-600">Ważny do (opcjonalnie)
            <input type="date" value={waznyDo} onChange={e => setWaznyDo(e.target.value)} className="block mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200" />
          </label>
          <label className="text-xs text-gray-600 flex-1" style={{ minWidth: 160 }}>Opis (opcjonalnie)
            <input type="text" value={opis} onChange={e => setOpis(e.target.value)} placeholder="domyślnie nazwa pliku" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200" />
          </label>
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: "#111827" }}>
            <Ikona d={I.plus} /> Dodaj pliki
            <input type="file" multiple className="sr-only" accept=".pdf,image/*,.csv,.xlsx"
              onChange={e => { const pliki = [...e.target.files]; if (pliki.length) onDodaj(pliki, { kind: rodzaj, expiryDate: waznyDo, label: opis.trim() }); e.target.value = ""; setWaznyDo(""); setOpis(""); }} />
          </label>
        </div>
      )}
    </div>
  );
}

function Harmonogram({ leasing, dzis }) {
  const raty = leasing?.harmonogram || [];
  if (!raty.length) return <p className="text-sm text-gray-500">Brak harmonogramu.</p>;
  const nastepna = raty.find(r => dniDo(r.data, dzis) >= 0);
  return (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50 text-gray-600">
          <tr><th className="text-left font-medium px-3 py-2">Nr</th><th className="text-left font-medium px-3 py-2">Termin</th><th className="text-right font-medium px-3 py-2">Kapitał</th><th className="text-right font-medium px-3 py-2">Odsetki</th><th className="text-right font-medium px-3 py-2">Rata netto</th></tr>
        </thead>
        <tbody>
          {raty.map(r => (
            <tr key={r.lp} className="border-t border-gray-100" style={r === nastepna ? { background: "#eff6ff", fontWeight: 600 } : dniDo(r.data, dzis) < 0 ? { color: "#6b7280" } : undefined}>
              <td className="px-3 py-1.5">{r.lp}</td><td className="px-3 py-1.5">{fmtData(r.data)}</td>
              <td className="px-3 py-1.5 text-right">{fmtKwota(r.kapital, leasing.waluta)}</td>
              <td className="px-3 py-1.5 text-right">{fmtKwota(r.odsetki, leasing.waluta)}</td>
              <td className="px-3 py-1.5 text-right">{fmtKwota(r.rata, leasing.waluta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KartaPojazdu({ v, docs, dzis, canEdit, renderEdycja, renderSerwis, onArchiwizuj, onPrzywroc, onDodajDokumenty, onUsunDokument, onEdytujDokument, onZapiszLeasing, uruchomienie, showToast, safeHref }) {
  const [oferta, setOferta] = useState(false);
  const [uruchom, setUruchom] = useState(false);
  const [edycjaLeasingu, setEdycjaLeasingu] = useState(false);
  const mozeLeasing = canEdit && onZapiszLeasing && !v.archived;
  const [edycja, setEdycja] = useState(false);
  const kierowca = (v.driverHistory || []).find(d => !d.to) || null;
  const terminy = terminyPojazdu(v, docs, dzis);
  const wyp = [...(v.equipment || []).map(id => WYPOSAZENIE[id] || id), ...(v.customEquipment || [])];
  const L = v.leasing;
  return (
    <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <header className="flex flex-wrap items-start gap-3 px-5 py-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900">{v.plate}{v.plate2 && <span className="text-gray-500 font-medium"> + {v.plate2}</span>}</h2>
          <p className="text-sm text-gray-600">{[v.brand, v.year, v.type].filter(Boolean).join(" · ")}{v.archived && " · w archiwum"}</p>
          <p className="text-sm text-gray-600 mt-0.5">{kierowca ? <>Kierowca: <span className="text-gray-900 font-medium">{kierowca.name}</span>{kierowca.phone && ` · ${kierowca.phone}`}</> : "Bez przypisanego kierowcy"}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOferta(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#111827" }}>
            <Ikona d={I.kopiuj} /> Kopiuj ofertę
          </button>
          {canEdit && uruchomienie && (
            <button type="button" onClick={() => setUruchom(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-900">
              Uruchomienie auta
            </button>
          )}
          {canEdit && renderEdycja && !v.archived && (
            <button type="button" onClick={() => setEdycja(e => !e)} aria-pressed={edycja} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={edycja ? { background: "#111827", color: "#fff" } : { background: "#f3f4f6", color: "#1f2937" }}>
              <Ikona d={I.olowek} /> {edycja ? "Zamknij edycję" : "Edytuj"}
            </button>
          )}
          {canEdit && v.archived && onPrzywroc && (
            <button type="button" onClick={() => onPrzywroc(v)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-800 bg-gray-100">Przywróć z archiwum</button>
          )}
        </div>
      </header>

      {uruchom && uruchomienie && <UruchomienieAuta v={v} api={uruchomienie} kierowca={kierowca} onClose={() => setUruchom(false)} showToast={showToast} safeHref={safeHref} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3 px-5 pb-5">
        <Fakt etykieta="Wymiary skrzyni (cm)">{v.dimensions}</Fakt>
        <Fakt etykieta="Ładowność">{v.maxWeight ? `${v.maxWeight} kg` : ""}</Fakt>
        <Fakt etykieta="Załadunek">{v.loadingType}</Fakt>
        <Fakt etykieta="Wartość netto">{v.wartoscNet ? fmtKwota(v.wartoscNet, v.wartoscWaluta) : ""}</Fakt>
        {v.plate2 && <Fakt etykieta={`Przyczepa ${v.plate2} (cm)`}>{v.dimensions2}</Fakt>}
        {v.plate2 && <Fakt etykieta="Ładowność przyczepy">{v.maxWeight2 ? `${v.maxWeight2} kg` : ""}</Fakt>}
        <Fakt etykieta="We flocie od">{v.fleetJoinDate ? fmtData(v.fleetJoinDate) : ""}</Fakt>
        {v.archived && <Fakt etykieta="W archiwum od">{[v.archivedDate && fmtData(v.archivedDate), v.archivedReason].filter(Boolean).join(" · ")}</Fakt>}
        <div className="col-span-2 sm:col-span-4"><Fakt etykieta="VIN"><span style={{ fontFamily: "'DM Mono', monospace" }}>{v.vin}</span></Fakt></div>
        <div className="col-span-2 sm:col-span-4">
          <div className="text-xs text-gray-500 mb-1">Wyposażenie</div>
          {wyp.length ? <div className="flex flex-wrap gap-1.5">{wyp.map(w => <span key={w} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-800">{w}</span>)}</div> : <div className="text-sm font-medium text-gray-900">—</div>}
        </div>
      </div>

      {edycja && renderEdycja && <div className="border-t border-gray-100">{renderEdycja(v, () => setEdycja(false))}</div>}

      <Sekcja tytul="Terminy i przypomnienia" licznik={terminy.length} domyslnieOtwarta>
        {terminy.length === 0 ? <p className="text-sm text-gray-500">Brak wpisanych terminów.</p> : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {terminy.map((t, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 text-gray-900">{t.nazwa}{t.kwota != null && <span className="text-gray-500"> · {fmtKwota(t.kwota, t.waluta)}</span>}</span>
                <span className="text-gray-600">{fmtData(t.data)}</span>
                <Znaczek dni={t.dni} />
              </li>
            ))}
          </ul>
        )}
      </Sekcja>

      <Sekcja tytul="Leasing" licznik={L ? null : 0}
        akcja={mozeLeasing && !edycjaLeasingu ? <button type="button" onClick={() => setEdycjaLeasingu(true)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100"><Ikona d={L ? I.olowek : I.plus} /> {L ? "Edytuj leasing" : "Dodaj leasing"}</button> : null}>
        {edycjaLeasingu ? (
          <EdycjaLeasingu leasing={L} showToast={showToast} onAnuluj={() => setEdycjaLeasingu(false)}
            onZapisz={(nowy) => onZapiszLeasing(v, nowy)}
            onUsun={async () => { if (await onZapiszLeasing(v, null) !== false) setEdycjaLeasingu(false); }} />
        ) : !L ? <p className="text-sm text-gray-500">Brak danych leasingu.</p> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3 mb-4">
              <Fakt etykieta="Umowa">{L.umowa}</Fakt>
              <Fakt etykieta="Finansujący">{L.finansujacy}</Fakt>
              <Fakt etykieta="Rata netto">{fmtKwota(L.rata, L.waluta)}</Fakt>
              <Fakt etykieta="Koniec umowy">{fmtData(L.koniec)}</Fakt>
              <Fakt etykieta="Zawarta">{fmtData(L.zawarta)}</Fakt>
              <Fakt etykieta="Liczba rat">{L.liczbaRat}</Fakt>
              <Fakt etykieta="Opłata wstępna">{fmtKwota(L.oplataWstepna, L.waluta)}</Fakt>
              <Fakt etykieta="Wykup">{L.wykup ? fmtKwota(L.wykup, L.waluta) : ""}</Fakt>
            </div>
            <Harmonogram leasing={L} dzis={dzis} />
          </>
        )}
      </Sekcja>

      <Sekcja tytul="Dokumenty" licznik={docs.length}>
        <ListaDokumentow docs={docs} canEdit={canEdit} safeHref={safeHref}
          onDodaj={onDodajDokumenty ? (pliki, meta) => onDodajDokumenty(v, pliki, meta) : null}
          onUsun={onUsunDokument} onEdytuj={onEdytujDokument} />
      </Sekcja>

      <Sekcja tytul="Ubezpieczenie i UDT">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
          <Fakt etykieta="Polisa OC">{v.ocNumber}</Fakt>
          <Fakt etykieta="Składka OC">{v.ocAmount ? fmtKwota(v.ocAmount) : ""}</Fakt>
          <Fakt etykieta="Polisa AC">{v.acNumber}</Fakt>
          <Fakt etykieta="Całość polis">{v.caloscPolis ? fmtKwota(v.caloscPolis) : ""}</Fakt>
          <Fakt etykieta="Nr ewidencyjny UDT">{v.udtNumber}</Fakt>
          <div className="col-span-2 sm:col-span-3"><Fakt etykieta="Winda">{v.udtLiftName}</Fakt></div>
        </div>
      </Sekcja>

      {renderSerwis && <Sekcja tytul="Serwis, gwarancja i tachograf">{renderSerwis(v)}</Sekcja>}

      <Sekcja tytul="Historia kierowców" licznik={(v.driverHistory || []).length}>
        {(v.driverHistory || []).length === 0 ? <p className="text-sm text-gray-500">Brak wpisów.</p> : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {[...v.driverHistory].reverse().map(d => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-3 px-3 py-2 text-sm">
                <span className="flex-1 text-gray-900">{d.name}</span>
                <span className="text-gray-600">{fmtData(d.from)} – {d.to ? fmtData(d.to) : "obecnie"}</span>
              </li>
            ))}
          </ul>
        )}
      </Sekcja>

      {canEdit && onArchiwizuj && !v.archived && (
        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <button type="button" onClick={() => onArchiwizuj(v)} className="text-xs font-medium text-gray-600 hover:text-red-700">Przenieś do archiwum lub usuń…</button>
        </div>
      )}

      {oferta && <OknoOferty v={v} kierowca={kierowca} docs={docs} onClose={() => setOferta(false)} showToast={showToast} />}
    </article>
  );
}

export default function PojazdyPanel({ vehicles = [], vehicleDocs = [], canEdit = false, dzis, renderEdycja, renderSerwis, onArchiwizuj, onPrzywroc, onDodajPojazd, onDodajDokumenty, onUsunDokument, onEdytujDokument, onZapiszLeasing, uruchomienie, showToast, safeHref }) {
  const teraz = useMemo(() => dzis ?? new Date().setHours(0, 0, 0, 0), [dzis]);
  const [archiwum, setArchiwum] = useState(false);
  const [szukaj, setSzukaj] = useState("");
  const [wybrany, setWybrany] = useState(null);

  const docsWg = useMemo(() => {
    const m = {};
    for (const d of vehicleDocs) (m[d.vehicleId] ||= []).push(d);
    return m;
  }, [vehicleDocs]);

  const widoczne = vehicles.filter(v => !!v.archived === archiwum)
    .filter(v => !szukaj.trim() || `${v.plate} ${v.plate2 || ""} ${v.brand || ""} ${(v.driverHistory || []).find(d => !d.to)?.name || ""}`.toLowerCase().includes(szukaj.trim().toLowerCase()));
  const aktywny = widoczne.find(v => v.id === wybrany) || widoczne[0] || null;

  // Najbliższe terminy całej floty — to są „przypomnienia”.
  const flotaTerminy = useMemo(() => vehicles.filter(v => !v.archived)
    .flatMap(v => terminyPojazdu(v, docsWg[v.id] || [], teraz).filter(t => !t.rata).map(t => ({ ...t, plate: v.plate, id: v.id })))
    .filter(t => t.dni <= 60).sort((a, b) => a.dni - b.dni), [vehicles, docsWg, teraz]);

  const ileArch = vehicles.filter(v => v.archived).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-900 flex-1">Flota pojazdów</h1>
        {canEdit && onDodajPojazd && (
          <button type="button" onClick={onDodajPojazd} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#111827" }}>
            <Ikona d={I.plus} /> Dodaj pojazd
          </button>
        )}
      </div>

      {flotaTerminy.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 mb-4">
          <Sekcja tytul="Najbliższe terminy we flocie (60 dni)" licznik={flotaTerminy.length} domyslnieOtwarta={flotaTerminy.some(t => t.dni <= 30)}>
            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {flotaTerminy.map((t, i) => (
                <li key={i}>
                  <button type="button" onClick={() => { setArchiwum(false); setWybrany(t.id); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 text-left text-sm hover:bg-gray-50">
                    <span className="font-semibold text-gray-900 whitespace-nowrap">{t.plate}</span>
                    <span className="flex-1 text-gray-700 truncate">{t.nazwa}</span>
                    <Znaczek dni={t.dni} />
                  </button>
                </li>
              ))}
            </ul>
          </Sekcja>
        </div>
      )}

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white rounded-2xl border border-gray-100 p-3 lg:sticky lg:top-4">
          <input type="search" value={szukaj} onChange={e => setSzukaj(e.target.value)} placeholder="Szukaj: rejestracja, kierowca" aria-label="Szukaj pojazdu"
            className="w-full px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200 mb-2" />
          <div className="flex gap-1 mb-2" role="tablist">
            {[[false, `Aktywne (${vehicles.length - ileArch})`], [true, `Archiwum (${ileArch})`]].map(([a, opis]) => (
              <button key={String(a)} type="button" role="tab" aria-selected={archiwum === a} onClick={() => { setArchiwum(a); setWybrany(null); }}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium" style={archiwum === a ? { background: "#111827", color: "#fff" } : { background: "#f3f4f6", color: "#374151" }}>{opis}</button>
            ))}
          </div>
          <ul className="space-y-1">
            {widoczne.map(v => {
              const najblizszy = terminyPojazdu(v, docsWg[v.id] || [], teraz).filter(t => !t.rata)[0];
              const kier = (v.driverHistory || []).find(d => !d.to);
              const wybr = aktywny?.id === v.id;
              const kropka = !najblizszy ? "#d1d5db" : najblizszy.dni < 0 ? "#dc2626" : najblizszy.dni <= 30 ? "#d97706" : "#16a34a";
              return (
                <li key={v.id}>
                  <button type="button" onClick={() => setWybrany(v.id)} aria-current={wybr ? "true" : undefined}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={wybr ? { background: "#eff6ff", boxShadow: "inset 0 0 0 1.5px #2563eb" } : undefined}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: kropka }} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-gray-900">{v.plate}</span>
                      <span className="block text-xs text-gray-600 truncate">{kier?.name || v.brand || "—"}</span>
                    </span>
                    <span className="text-xs text-gray-500">{(docsWg[v.id] || []).length || ""}</span>
                  </button>
                </li>
              );
            })}
            {widoczne.length === 0 && <li className="text-sm text-gray-500 px-3 py-4">Brak pojazdów.</li>}
          </ul>
        </aside>

        {aktywny
          ? <KartaPojazdu key={aktywny.id} v={aktywny} docs={docsWg[aktywny.id] || []} dzis={teraz} canEdit={canEdit}
              renderEdycja={renderEdycja} renderSerwis={renderSerwis} onArchiwizuj={onArchiwizuj} onPrzywroc={onPrzywroc} onDodajDokumenty={onDodajDokumenty} onUsunDokument={onUsunDokument} onEdytujDokument={onEdytujDokument} onZapiszLeasing={onZapiszLeasing} uruchomienie={uruchomienie} showToast={showToast} safeHref={safeHref} />
          : <div className="bg-white rounded-2xl border border-gray-100 p-8 text-sm text-gray-500">Wybierz pojazd z listy.</div>}
      </div>
    </div>
  );
}
