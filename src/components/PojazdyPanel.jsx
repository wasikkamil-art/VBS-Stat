// Nowy panel pojazdów (XI.2026) — lista floty po lewej, karta wybranego auta po prawej.
//
// Komponent jest CZYSTO PREZENTACYJNY: nie importuje Firebase, wszystko dostaje w propsach,
// a zapisy oddaje przez callbacki. Dzięki temu ta sama karta działa w aplikacji i w atrapie
// `podglad/pojazdy` bez stubów.
//
// Dane pojazdu to te same pola co dotąd (`fleet/data.fleetv2_vehicles`) — stare auta nie
// wymagają migracji. Nowe są tylko: `leasing` (obiekt) i dokumenty pojazdu (`docs`).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import UruchomienieAuta from "./UruchomienieAuta";
import { porownajZDowodem, porownajZDokumentem, opisZRozpoznania, czyjDokument, polaKartyZDokumentu, pojazdZDokumentu, kosztZFaktury, podzielKwote, dokumentFirmowyZOdczytu, RODZAJE_Z_POLEM_KARTY } from "../utils/dowodRejestracyjny";
import { pierwszaRataLeasingu } from "../utils/leasing";

// Rodzaje dokumentów pojazdu. `oferta: true` = domyślnie proponowany do dołączenia do oferty.
export const RODZAJE_DOKUMENTOW = [
  { id: "dowod",        label: "Dowód rejestracyjny",            grupa: "Rejestracja i homologacja", oferta: true },
  { id: "coc",          label: "Świadectwo zgodności (COC)",     grupa: "Rejestracja i homologacja" },
  { id: "oswiadczenie", label: "Oświadczenie do rejestracji",    grupa: "Rejestracja i homologacja" },
  { id: "cemt",         label: "Certyfikat CEMT / Euro",         grupa: "Rejestracja i homologacja", oferta: true },
  { id: "protokol",     label: "Protokół przekazania",           grupa: "Rejestracja i homologacja" },
  { id: "badanie",      label: "Badanie techniczne — zaświadczenie", grupa: "Rejestracja i homologacja" },
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
  { id: "gasnica",      label: "Przegląd gaśnicy",               grupa: "Serwis i gwarancje" },
  { id: "faktura",      label: "Faktura",                        grupa: "Faktury" },
  { id: "inne",         label: "Inne",                           grupa: "Inne" },
];
const RODZAJ = Object.fromEntries(RODZAJE_DOKUMENTOW.map(r => [r.id, r]));
const GRUPY = [...new Set(RODZAJE_DOKUMENTOW.map(r => r.grupa))];
// Kolejność na liście = kolejność rodzajów powyżej: dowód rejestracyjny (główny dokument auta) zawsze pierwszy.
const KOLEJNOSC = Object.fromEntries(RODZAJE_DOKUMENTOW.map((r, i) => [r.id, i]));
const wKolejnosci = (lista) => [...lista].sort((a, b) => (KOLEJNOSC[a.kind] ?? 99) - (KOLEJNOSC[b.kind] ?? 99));

const WYPOSAZENIE = {
  paleciak: "Paleciak", winda: "Winda załadunkowa", pasy: "Pasy mocujące", gasnica: "Gaśnica",
  apteczka: "Apteczka", "trójkąt": "Trójkąt ostrzegawczy", tachograf: "Tachograf cyfrowy",
  gps: "GPS / lokalizator", "chłodnia": "Agregat chłodniczy", plandeka: "Plandeka",
};

// Kolory z logo VBS — nagłówek karty auta (granat + żółty akcent). Granat na jasnym tle: kontrast 10:1.
const KOLOR = { granat: "#2e3192", zolty: "#fdb913", tlo: "#eef0fb", ramka: "#d9dcf3" };

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
    { nazwa: `OC przyczepy${v.plate2 ? ` ${v.plate2}` : ""}`, data: v.plate2 ? v.ocExpiry2 : "" },
    { nazwa: "AC", data: v.acExpiry },
    { nazwa: "GAP", data: v.gapExpiry },
    { nazwa: "UDT windy", data: v.udtExpiry },
    { nazwa: "Gaśnica", data: v.gasnicaExpiry },
    { nazwa: "Koniec leasingu", data: v.leasing?.koniec },
  ];
  const nastepnaRata = (v.leasing?.harmonogram || []).find(r => dniDo(r.data, dzis) >= 0);
  if (nastepnaRata) lista.push({ nazwa: `Rata leasingu nr ${nastepnaRata.lp}`, data: nastepnaRata.data, kwota: nastepnaRata.rata, waluta: v.leasing?.waluta, rata: true });
  for (const d of docs) {
    if (!d.expiryDate) continue;
    // Polisa, UDT, badanie i gaśnica mają już swój termin w polach karty — nie dublujemy.
    if (RODZAJE_Z_POLEM_KARTY.includes(d.kind)) continue;
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
  oko: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  wgraj: <><path d="M12 16V5" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
  skan: <><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M7 12h10" /></>,
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

/**
 * Pole karty auta zmieniane wprost na karcie: wartość + „ustaw / zmień" → pole → Zapisz.
 * Używane dla „We flocie od" (data) i „Ładowność rzeczywista" (liczba kg, wpisywana ręcznie przez biuro).
 */
function PoleNaKarcie({ wartosc, pokaz, typ = "text", nazwa, pusto = "nie ustawiono", ustaw = "ustaw", onZapisz }) {
  const [edycja, setEdycja] = useState(false);
  const [nowa, setNowa] = useState(wartosc || "");
  const [zapis, setZapis] = useState(false);
  if (!edycja) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {wartosc ? pokaz(wartosc) : <span className="text-gray-500 font-normal">{pusto}</span>}
        {onZapisz && (
          <button type="button" onClick={() => { setNowa(wartosc || ""); setEdycja(true); }} aria-label={`${wartosc ? "Zmień" : "Ustaw"}: ${nazwa}`}
            className="text-xs font-medium px-1.5 py-0.5 rounded-md" style={{ color: KOLOR.granat, background: KOLOR.tlo }}>{wartosc ? "zmień" : ustaw}</button>
        )}
      </span>
    );
  }
  return (
    <form className="flex flex-wrap items-center gap-1.5" onSubmit={async (e) => { e.preventDefault(); setZapis(true); const ok = await onZapisz(String(nowa).trim()); setZapis(false); if (ok !== false) setEdycja(false); }}>
      <input type={typ} value={nowa} onChange={e => setNowa(e.target.value)} aria-label={nazwa} autoFocus min={typ === "number" ? 0 : undefined} step={typ === "number" ? 1 : undefined}
        className="px-2 py-1 rounded-lg bg-white border border-gray-300" style={{ fontSize: 16, width: typ === "number" ? 110 : undefined }} />
      <button type="submit" disabled={zapis} className="px-2 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ background: KOLOR.granat }}>{zapis ? "…" : "Zapisz"}</button>
      <button type="button" onClick={() => setEdycja(false)} className="px-2 py-1 rounded-lg text-xs font-medium text-gray-700 bg-gray-100">Anuluj</button>
    </form>
  );
}

/**
 * Sekcja karty auta w dwóch postaciach: kafelek (gdy nic nie wybrano) albo pełna zawartość z przyciskiem powrotu
 * (gdy wybrano właśnie ją). Pozostałe sekcje w tym czasie nie renderują się wcale.
 */
function SekcjaKarty({ id, wybrana, onWybierz, tytul, licznik, opis, znaczek, akcja, children }) {
  if (!wybrana) {
    return (
      <button type="button" onClick={() => onWybierz(id)} aria-label={`Otwórz: ${tytul}`}
        className="w-full text-left bg-white rounded-xl border overflow-hidden hover:shadow-md focus-visible:shadow-md transition-shadow" style={{ borderColor: KOLOR.ramka }}>
        <span aria-hidden="true" className="block" style={{ height: 3, background: KOLOR.granat }} />
        <span className="block px-4 py-3">
          <span className="flex items-baseline gap-2">
            <span className="flex-1 text-sm font-bold" style={{ color: KOLOR.granat }}>{tytul}</span>
            {licznik != null && <span className="text-sm font-semibold text-gray-900">{licznik}</span>}
          </span>
          <span className="flex items-center gap-2 mt-1.5" style={{ minHeight: 22 }}>
            <span className="flex-1 min-w-0 truncate text-xs text-gray-600">{opis}</span>
            {znaczek}
          </span>
          <span className="block mt-2 text-xs font-medium" style={{ color: KOLOR.granat }}>Otwórz →</span>
        </span>
      </button>
    );
  }
  if (wybrana !== id) return null;
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ background: "#fafbff", borderBottom: `1px solid ${KOLOR.ramka}` }}>
        <button type="button" onClick={() => onWybierz(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-800 bg-white border border-gray-200 hover:bg-gray-50">
          <span aria-hidden="true">←</span> Wróć
        </button>
        <h3 className="flex-1 text-sm font-bold" style={{ color: KOLOR.granat }}>{tytul}{licznik != null && <span className="font-medium text-gray-500"> ({licznik})</span>}</h3>
        {akcja}
      </div>
      <div className="px-5 py-5">{children}</div>
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

function EdycjaDokumentu({ d, onZapisz, onAnuluj, onOryginal }) {
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
      <div className="sm:col-span-6 flex flex-wrap items-center justify-end gap-2">
        {onOryginal && d.oryginalPath && (
          <button type="button" onClick={() => onOryginal(d)} className="mr-auto text-xs font-medium text-gray-700 underline">Pobierz oryginał bez znaku wodnego</button>
        )}
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

/**
 * Podgląd dokumentu w aplikacji — plik ze znakiem wodnym (samo logo, bez daty) przygotowany przez serwer.
 * `podglad`: { doc, stan: "laduje" | "gotowe" | "blad", url?, znak?, blad? }.
 */
function OknoPodgladu({ podglad, onClose, onPobierz }) {
  const d = podglad.doc;
  return (
    <div className="fixed inset-0 z-40 flex items-stretch sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={`Podgląd: ${d.label}`} className="w-full sm:max-w-5xl bg-white sm:rounded-2xl shadow-2xl flex flex-col" style={{ height: "min(100vh, 92vh)" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <h3 className="flex-1 min-w-0 text-sm font-bold text-gray-900 truncate">{d.label}</h3>
          {podglad.stan === "gotowe" && (
            <a href={podglad.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 whitespace-nowrap">Otwórz w nowej karcie</a>
          )}
          {onPobierz && (
            <button type="button" onClick={() => onPobierz(d)} className="inline-flex items-center gap-1 text-xs font-semibold text-white px-3 py-1.5 rounded-lg whitespace-nowrap" style={{ background: "#111827" }}>
              <Ikona d={I.pobierz} /> Pobierz
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Zamknij podgląd" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-sm">✕</button>
        </div>
        <div className="flex-1 min-h-0 bg-gray-100">
          {podglad.stan === "laduje" && <p className="p-6 text-sm text-gray-700" role="status">Przygotowuję podgląd…</p>}
          {podglad.stan === "blad" && <p className="m-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">Nie udało się przygotować podglądu: {podglad.blad}</p>}
          {podglad.stan === "gotowe" && (podglad.znak
            // `#toolbar=0` chowa w przeglądarkowym czytniku PDF przyciski pobierania i druku — pobranie ma iść przez
            // „Pobierz” (data + wpis w dzienniku). To wygoda, nie zabezpieczenie: podgląd i tak jest w dzienniku.
            ? <iframe src={`${podglad.url}#toolbar=0&navpanes=0`} title={`Podgląd: ${d.label}`} className="w-full h-full border-0" />
            : <p className="p-6 text-sm text-gray-700">Tego pliku nie da się pokazać w oknie (np. arkusz CSV). Użyj „Otwórz w nowej karcie”.</p>)}
        </div>
      </div>
    </div>
  );
}

// Pliki, na które da się nałożyć znak wodny, a go nie mają (nakładanie przy wgrywaniu się nie udało).
const bezZnaku = (docs) => docs.filter(d => d.fileUrl && !d.znakWodny && /\.(pdf|jpe?g|png|webp)$/i.test(d.fileName || d.storagePath || ""));

/** Jeden przycisk do wgrywania: bez wyboru rodzaju — dokument rozpoznaje AI, a człowiek zatwierdza. */
function PrzyciskWgraj({ onPliki, wgrywam, ciemny }) {
  return (
    <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ${wgrywam ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
      style={ciemny ? { background: "#111827", color: "#fff" } : { background: KOLOR.zolty, color: "#1f2937" }}>
      <Ikona d={I.wgraj} /> {wgrywam ? "Wgrywam…" : "Wgraj dokument"}
      <input type="file" multiple className="sr-only" accept=".pdf,image/*,.heic,.heif,.csv,.xlsx" disabled={wgrywam}
        onChange={(e) => { const pliki = [...e.target.files]; e.target.value = ""; if (pliki.length) onPliki(pliki); }} />
    </label>
  );
}

// Gdzie w karcie auta widać dokument danej grupy (poza kafelkiem „Dokumenty”, w którym jest każdy).
const KAFELEK_GRUPY = { "Ubezpieczenia": "Ubezpieczenie i UDT", "Winda i UDT": "Ubezpieczenie i UDT", "Leasing": "Leasing", "Tachograf": "Serwis, gwarancja i tachograf", "Serwis i gwarancje": "Serwis, gwarancja i tachograf" };
const CZYTELNY = /\.(pdf|jpe?g|png|webp)$/i;
const BIALE = { background: "#fff" };

/**
 * Świeżo wgrany dokument: AI rozpoznało rodzaj i odczytało dane, człowiek sprawdza, poprawia i klika „Zapisz”.
 * `pozycja`: { doc, stan: "czytam" | "gotowe" | "blad" | "reczne", dane?, daneDowodu?, blad? }.
 * Formularz jest edytowalny w każdym stanie poza „czytam” — przy błędzie AI dane wpisuje się ręcznie.
 */
function OknoRozpoznania({ karta, pojazdy, pozycja, zostalo, onZapisz, onPonow, onClose }) {
  const { doc: d, stan, dane, daneDowodu } = pozycja;
  // Auto dokumentu: to z rejestracji odczytanej przez AI (skan zbiorczy bywa z kilku aut), inaczej to,
  // przy którym plik leży. User może je zmienić — dokument przejdzie wtedy na kartę wybranego auta.
  const aktywne = useMemo(() => pojazdy.filter(x => !x.archived), [pojazdy]);
  const zOdczytu = useMemo(() => (stan === "gotowe" ? pojazdZDokumentu(aktywne, daneDowodu || dane) : null), [aktywne, stan, dane, daneDowodu]);
  const [autoId, setAutoId] = useState(null);
  const v = aktywne.find(x => x.id === (autoId ?? zOdczytu?.id ?? d.vehicleId)) || karta;
  const start = useMemo(() => (stan === "gotowe" ? opisZRozpoznania(d, dane, RODZAJE_DOKUMENTOW.map(r => r.id)) : { kind: "inne", label: d.label || "", number: "", issueDate: "", expiryDate: "", notes: "" }), [d, stan, dane]);
  const [f, setF] = useState(null);
  const opis = f ?? start;
  const ustaw = (k) => (e) => setF({ ...opis, [k]: e.target.value });
  const czyj = useMemo(() => (stan === "gotowe" ? czyjDokument(v, daneDowodu || dane) : null), [v, stan, dane, daneDowodu]);
  const zDowodu = opis.kind === "dowod" && daneDowodu ? porownajZDowodem(v, daneDowodu) : null;
  const pola = zDowodu ? zDowodu.pola : polaKartyZDokumentu(v, opis, dane);
  const [wybrane, setWybrane] = useState({}); // klucz → true/false; brak wpisu = domyślne z propozycji
  const zaznaczone = (p) => p.stan !== "zgodne" && (wybrane[p.klucz] ?? p.domyslnie);
  const doKarty = pola.filter(zaznaczone);
  const [zapis, setZapis] = useState(false);
  const zapisz = async (e) => {
    e.preventDefault();
    if (!opis.label.trim()) return;
    setZapis(true);
    // Przy dowodzie numer i data wydania z odczytu uzupełniają opis tylko tam, gdzie user nic nie wpisał.
    const zDow = zDowodu ? Object.fromEntries(Object.entries(zDowodu.opisDokumentu).filter(([k]) => !String(opis[k] || "").trim())) : {};
    const ok = await onZapisz(v, { ...opis, ...zDow, label: opis.label.trim(), number: (zDow.number || opis.number).trim(), notes: (zDow.notes || opis.notes).trim() }, Object.fromEntries(doKarty.map(p => [p.klucz, p.wartosc])));
    setZapis(false);
    if (ok !== false) onClose();
  };
  const grupa = RODZAJ[opis.kind]?.grupa || "Inne";
  const kafelki = ["Dokumenty", KAFELEK_GRUPY[grupa], opis.expiryDate && "Terminy i przypomnienia"].filter(Boolean);
  const STAN = { nowe: ["#dcfce7", "#166534", "puste w karcie"], zgodne: ["#f3f4f6", "#374151", "zgodne"], rozni: ["#fef3c7", "#92400e", "inna wartość w karcie"] };
  const tytul = `Nowy dokument — ${v.plate}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <form onSubmit={zapisz} role="dialog" aria-label={tytul} className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="flex-1 text-base font-bold text-gray-900 min-w-0 truncate">{tytul}</h3>
          {zostalo > 0 && <span className="text-xs text-gray-600 whitespace-nowrap">w kolejce jeszcze {zostalo}</span>}
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-sm">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <p className="text-xs text-gray-600 mb-3 truncate">Plik: <span className="text-gray-900">{d.fileName || d.label}</span></p>
          {stan === "czytam" && <p className="text-sm text-gray-700" role="status">Rozpoznaję dokument… to trwa kilkanaście sekund.</p>}
          {stan === "blad" && (
            <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              Nie udało się rozpoznać dokumentu: {pozycja.blad}. Plik jest wgrany — wybierz rodzaj i wpisz dane ręcznie albo spróbuj ponownie.
            </div>
          )}
          {stan === "reczne" && <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">Tego typu pliku (arkusz, CSV) aplikacja nie czyta — wybierz rodzaj i uzupełnij opis ręcznie.</p>}
          {stan === "gotowe" && (
            <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: KOLOR.tlo, border: `1px solid ${KOLOR.ramka}`, color: KOLOR.granat }}>
              {start.kind === "inne" ? <>Nie rozpoznałem rodzaju tego dokumentu — <b>wybierz go poniżej</b>.</> : <>Rozpoznano: <b>{RODZAJ[start.kind]?.label}</b>. Sprawdź dane i popraw, jeśli trzeba.</>}
            </p>
          )}
          {czyj && czyj.zDokumentu && !czyj.zgodna && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              Uwaga: dokument jest wystawiony na <b>{czyj.zDokumentu}</b>, a wybrane auto to <b>{v.plate}</b>. Sprawdź pole „Auto” poniżej, zanim cokolwiek zapiszesz.
            </p>
          )}
          {stan !== "czytam" && v.id !== karta.id && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Ten dokument dotyczy <b>{v.plate}</b>, nie otwartej karty {karta.plate} — zapisze się przy <b>{v.plate}</b>.
            </p>
          )}
          {czyj?.vinRozny && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              To dokument tego auta (rejestracja się zgadza), ale <b>VIN jest inny niż w karcie</b>: w dokumencie{" "}
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{czyj.vinRozny.zDokumentu}</span>, w karcie{" "}
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{czyj.vinRozny.wKarcie}</span>.
            </p>
          )}
          {stan !== "czytam" && (
            <>
              <div className="grid sm:grid-cols-6 gap-2">
                <label className="text-xs text-gray-600 sm:col-span-6">Auto
                  <select value={v.id} onChange={(e) => { setAutoId(e.target.value); setWybrane({}); }} className={POLE} style={BIALE}>
                    {(aktywne.some(x => x.id === v.id) ? aktywne : [v, ...aktywne]).map(x => <option key={x.id} value={x.id}>{x.plate}{x.plate2 ? ` + ${x.plate2}` : ""}{x.brand ? ` · ${x.brand}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600 sm:col-span-3">Rodzaj dokumentu
                  <select value={opis.kind} onChange={ustaw("kind")} className={POLE} style={BIALE}>
                    {GRUPY.map(g => <optgroup key={g} label={g}>{RODZAJE_DOKUMENTOW.filter(r => r.grupa === g).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</optgroup>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600 sm:col-span-3">Opis
                  <input type="text" required value={opis.label} onChange={ustaw("label")} className={POLE} style={BIALE} />
                </label>
                <label className="text-xs text-gray-600 sm:col-span-2">Numer
                  <input type="text" value={opis.number} onChange={ustaw("number")} className={POLE} style={BIALE} />
                </label>
                <label className="text-xs text-gray-600 sm:col-span-2">Data dokumentu
                  <input type="date" value={opis.issueDate} onChange={ustaw("issueDate")} className={POLE} style={BIALE} />
                </label>
                <label className="text-xs text-gray-600 sm:col-span-2">Ważny do
                  <input type="date" value={opis.expiryDate} onChange={ustaw("expiryDate")} className={POLE} style={BIALE} />
                </label>
                <label className="text-xs text-gray-600 sm:col-span-6">Uwagi
                  <input type="text" value={opis.notes} onChange={ustaw("notes")} className={POLE} style={BIALE} />
                </label>
              </div>
              <p className="text-xs text-gray-600 mt-3">Po zapisaniu dokument będzie w kafelkach: <b className="text-gray-900">{kafelki.join(" · ")}</b>.</p>
              {opis.kind === "dowod" && !daneDowodu && <p className="text-xs text-amber-900 mt-2">Dane auta z dowodu (VIN, przegląd, rok) odczytasz po zapisaniu — przycisk „Odczytaj dane” przy dokumencie.</p>}
              {pola.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-700 mt-4 mb-1">Do karty auta — zaznacz, co zapisać</p>
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {pola.map(p => {
                      const [tlo, kolor, tekst] = STAN[p.stan];
                      return (
                        <li key={p.klucz}>
                          <label className={`flex items-start gap-3 px-3 py-2.5 ${p.stan === "zgodne" ? "" : "cursor-pointer"}`}>
                            <input type="checkbox" className="mt-1" disabled={p.stan === "zgodne"} checked={zaznaczone(p)} onChange={() => setWybrane(w => ({ ...w, [p.klucz]: !zaznaczone(p) }))} aria-label={`Zapisz w karcie: ${p.etykieta}`} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs text-gray-500">{p.etykieta}</span>
                              <span className="block text-sm font-medium text-gray-900 break-words">{p.zDowodu}</span>
                              {p.stan === "rozni" && <span className="block text-xs text-gray-600">w karcie teraz: {p.teraz}</span>}
                              {p.uwaga && <span className="block text-xs font-medium text-red-800 mt-0.5">{p.uwaga}</span>}
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tlo, color: kolor }}>{tekst}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {stan === "blad" && <button type="button" onClick={onPonow} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-800 bg-gray-100 mr-auto">Spróbuj ponownie</button>}
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">{stan === "czytam" ? "Zamknij" : "Zostaw w „Inne”"}</button>
          {stan !== "czytam" && (
            <button type="submit" disabled={zapis} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: KOLOR.granat }}>
              {zapis ? "Zapisuję…" : doKarty.length ? `Zapisz (+ ${doKarty.length} w karcie)` : "Zapisz"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Wspólna rama okien potwierdzenia ze skanu (koszt z faktury, dokument firmowy). */
function RamaOkna({ tytul, zostalo, onClose, onSubmit, stopka, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <form onSubmit={onSubmit} role="dialog" aria-label={tytul} className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="flex-1 text-base font-bold text-gray-900 min-w-0 truncate">{tytul}</h3>
          {zostalo > 0 && <span className="text-xs text-gray-600 whitespace-nowrap">w kolejce jeszcze {zostalo}</span>}
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-sm">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-gray-100">{stopka}</div>
      </form>
    </div>
  );
}

function PlikZeSkanu({ pozycja, safeHref }) {
  const url = safeHref ? safeHref(pozycja.doc.podgladUrl) : pozycja.doc.podgladUrl;
  return (
    <p className="text-xs text-gray-600 mb-3">Plik: <span className="text-gray-900">{pozycja.doc.fileName}</span>
      {url && <> · <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: KOLOR.granat }}>otwórz, żeby sprawdzić</a></>}
    </p>
  );
}

const fmtLiczba = (n) => Number(n).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Faktura ze skanu → koszt w panelu „Koszty” (user, 25.11.2026). Pliku faktury NIE zapisujemy — zostaje numer,
 * sprzedawca i data. Admin sprawdza kwotę, kategorię (AI tylko podpowiada) i auta: jedno, kilka albo wszystkie,
 * kwota dzieli się po równo („auta były dwa na warsztacie, ale nie wiadomo, ile części na które”).
 */
function OknoKosztu({ pojazdy, kategorie, pozycja, zostalo, onKurs, onKoszty, onZapisz, onClose, safeHref }) {
  const aktywne = useMemo(() => pojazdy.filter(x => !x.archived), [pojazdy]);
  const start = useMemo(() => kosztZFaktury(pozycja.dane, aktywne, kategorie), [pozycja, aktywne, kategorie]);
  const [f, setF] = useState(start);
  const ustaw = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const przelacz = (id) => setF(p => ({ ...p, auta: p.auta.includes(id) ? p.auta.filter(x => x !== id) : [...p.auta, id] }));
  const netto = Number(String(f.netto).replace(",", "."));
  const czesci = netto > 0 && f.auta.length ? podzielKwote(netto, f.auta.length) : [];
  // Kurs NBP z dnia faktury — pokazujemy go, zanim admin zapisze (ten sam kurs policzy zapis).
  const [kurs, setKurs] = useState({ klucz: "", wynik: null });
  const kluczKursu = `${f.waluta}|${f.data}`;
  useEffect(() => {
    if (!onKurs || !f.data || !/^[A-Z]{3}$/.test(f.waluta)) return undefined;
    let zywy = true;
    onKurs(f.waluta, f.data).then(w => { if (zywy) setKurs({ klucz: kluczKursu, wynik: w || "brak" }); }).catch(() => { if (zywy) setKurs({ klucz: kluczKursu, wynik: "brak" }); });
    return () => { zywy = false; };
  }, [onKurs, f.waluta, f.data, kluczKursu]);
  const k = kurs.klucz === kluczKursu ? kurs.wynik : null;
  const naEur = k && k !== "brak" ? k.naEur : null;
  const juzSa = onKoszty ? onKoszty(f.numer.trim()) : [];
  const [zapis, setZapis] = useState(false);
  const mozna = netto > 0 && f.auta.length > 0 && f.data && f.numer.trim() && naEur;
  const zapisz = async (e) => {
    e.preventDefault();
    if (!mozna) return;
    setZapis(true);
    const ok = await onZapisz({ ...f, netto, numer: f.numer.trim(), sprzedawca: f.sprzedawca.trim(), opis: f.opis.trim() });
    setZapis(false);
    if (ok !== false) onClose();
  };
  return (
    <RamaOkna tytul="Faktura ze skanu — koszt do zatwierdzenia" zostalo={zostalo} onClose={onClose} onSubmit={zapisz}
      stopka={<>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">Pomiń — nie dodawaj kosztu</button>
        <button type="submit" disabled={zapis || !mozna} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: KOLOR.granat }}>
          {zapis ? "Zapisuję…" : f.auta.length > 1 ? `Dodaj koszt do ${f.auta.length} aut` : "Dodaj koszt"}
        </button>
      </>}>
      <PlikZeSkanu pozycja={pozycja} safeHref={safeHref} />
      <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: KOLOR.tlo, border: `1px solid ${KOLOR.ramka}`, color: KOLOR.granat }}>
        To faktura — po zatwierdzeniu trafi do <b>Kosztów</b> w miesiącu z daty faktury. <b>Plik faktury nie zostanie zapisany</b> (zostaje numer, sprzedawca i data).
      </p>
      {juzSa.length > 0 && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          Faktura <b>{f.numer}</b> ma już koszt w aplikacji ({juzSa.length} {juzSa.length === 1 ? "wpis" : "wpisy"}). Zapis doda go drugi raz — pomiń, jeśli to ta sama faktura.
        </p>
      )}
      <div className="grid sm:grid-cols-6 gap-2">
        <label className="text-xs text-gray-600 sm:col-span-3">Sprzedawca
          <input type="text" value={f.sprzedawca} onChange={ustaw("sprzedawca")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Numer faktury
          <input type="text" required value={f.numer} onChange={ustaw("numer")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-2">Data faktury
          <input type="date" required value={f.data} onChange={ustaw("data")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-2">Kwota netto
          <input type="text" inputMode="decimal" required value={f.netto} onChange={ustaw("netto")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-2">Waluta
          <select value={f.waluta} onChange={ustaw("waluta")} className={POLE} style={BIALE}>
            {[...new Set(["PLN", "EUR", f.waluta])].map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Kategoria kosztu <span className="text-gray-500">(podpowiedź — zmień, jeśli trzeba)</span>
          <select value={f.kategoria} onChange={ustaw("kategoria")} className={POLE} style={BIALE}>
            {kategorie.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Za co
          <input type="text" value={f.opis} onChange={ustaw("opis")} className={POLE} style={BIALE} />
        </label>
      </div>
      <p className="text-xs text-gray-600 mt-2">
        {start.brutto ? `Brutto na fakturze: ${fmtLiczba(start.brutto)} ${start.waluta}. ` : ""}
        {f.waluta === "EUR" ? "Faktura w euro — bez przeliczania."
          : k === "brak" ? <span className="text-red-800 font-medium">Nie udało się pobrać kursu NBP z {fmtData(f.data)} — bez kursu nie zapiszę.</span>
          : naEur && netto > 0 ? <>Kurs NBP EUR z {fmtData(k.kursData)}: {String(k.kursEur).replace(".", ",")} → <b className="text-gray-900">{fmtLiczba(netto * naEur)} € netto</b>.</>
          : "Pobieram kurs NBP z dnia faktury…"}
      </p>
      <div className="flex items-baseline gap-3 mt-4 mb-1">
        <p className="flex-1 text-xs font-semibold text-gray-700">Auta, na które idzie koszt{f.auta.length > 1 && " — kwota dzieli się po równo"}</p>
        <button type="button" onClick={() => setF(p => ({ ...p, auta: aktywne.map(x => x.id) }))} className="text-xs font-medium underline" style={{ color: KOLOR.granat }}>wszystkie</button>
        <button type="button" onClick={() => setF(p => ({ ...p, auta: [] }))} className="text-xs font-medium underline text-gray-700">żadne</button>
      </div>
      {f.auta.length === 0 && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">Na fakturze nie ma rejestracji auta z floty — zaznacz, na które auta przypisać koszt.</p>}
      <ul className="grid sm:grid-cols-2 gap-x-3 rounded-xl border border-gray-100 px-3 py-1">
        {aktywne.map(x => {
          const i = f.auta.indexOf(x.id);
          return (
            <li key={x.id}>
              <label className="flex items-center gap-2 py-1.5 cursor-pointer text-sm">
                <input type="checkbox" checked={i >= 0} onChange={() => przelacz(x.id)} aria-label={`Koszt na auto ${x.plate}`} />
                <span className="flex-1 text-gray-900">{x.plate}</span>
                {i >= 0 && czesci[i] != null && <span className="text-xs text-gray-600 whitespace-nowrap">{fmtLiczba(czesci[i])} {f.waluta}{naEur && f.waluta !== "EUR" ? ` · ${fmtLiczba(czesci[i] * naEur)} €` : ""}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </RamaOkna>
  );
}

/** Dokument firmy ze skanu (umowa, licencja, OC przewoźnika…) → „Dok. firmowe”. Zatwierdza admin. */
function OknoFirmowe({ rodzaje, pozycja, zostalo, onZapisz, onClose, safeHref }) {
  const start = useMemo(() => dokumentFirmowyZOdczytu(pozycja.dane, rodzaje, pozycja.doc.fileName), [pozycja, rodzaje]);
  const [f, setF] = useState(start);
  const ustaw = (k) => (e) => setF(p => ({ ...p, [k]: e.target.value }));
  const [zapis, setZapis] = useState(false);
  const grupy = [...new Set(rodzaje.map(r => r.group || "Inne"))];
  const zapisz = async (e) => {
    e.preventDefault();
    if (!f.label.trim()) return;
    setZapis(true);
    const ok = await onZapisz(pozycja.doc, { ...f, label: f.label.trim(), number: f.number.trim(), kontrahent: f.kontrahent.trim(), notes: f.notes.trim() });
    setZapis(false);
    if (ok !== false) onClose();
  };
  return (
    <RamaOkna tytul="Dokument firmowy ze skanu" zostalo={zostalo} onClose={onClose} onSubmit={zapisz}
      stopka={<>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">Pomiń — nie zapisuj</button>
        <button type="submit" disabled={zapis} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: KOLOR.granat }}>{zapis ? "Zapisuję…" : "Zapisz w „Dok. firmowych”"}</button>
      </>}>
      <PlikZeSkanu pozycja={pozycja} safeHref={safeHref} />
      <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: KOLOR.tlo, border: `1px solid ${KOLOR.ramka}`, color: KOLOR.granat }}>
        To dokument <b>firmy</b>, nie konkretnego auta — po zatwierdzeniu trafi do zakładki <b>Dok. firmowe</b>{start.type !== "inne" && <> jako <b>{rodzaje.find(r => r.id === start.type)?.label}</b></>}.
      </p>
      <div className="grid sm:grid-cols-6 gap-2">
        <label className="text-xs text-gray-600 sm:col-span-3">Rodzaj
          <select value={f.type} onChange={ustaw("type")} className={POLE} style={BIALE}>
            {grupy.map(g => <optgroup key={g} label={g}>{rodzaje.filter(r => (r.group || "Inne") === g).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</optgroup>)}
          </select>
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Nazwa
          <input type="text" required value={f.label} onChange={ustaw("label")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Kontrahent / wystawca
          <input type="text" value={f.kontrahent} onChange={ustaw("kontrahent")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Numer
          <input type="text" value={f.number} onChange={ustaw("number")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Data dokumentu
          <input type="date" value={f.issueDate} onChange={ustaw("issueDate")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-3">Ważny do
          <input type="date" value={f.expiryDate} onChange={ustaw("expiryDate")} className={POLE} style={BIALE} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-6">Uwagi
          <input type="text" value={f.notes} onChange={ustaw("notes")} className={POLE} style={BIALE} />
        </label>
      </div>
    </RamaOkna>
  );
}

function ListaDokumentow({ docs, canEdit, onDodaj, wgrywam, onUsun, onEdytuj, onOdczytaj, onOryginal, onPobierz, onPodglad, safeHref, pusto = "Brak dokumentów przy tym aucie." }) {
  const [edytowany, setEdytowany] = useState(null);
  const [podglad, setPodglad] = useState(null);
  const pokazPodglad = async (d) => {
    setPodglad({ doc: d, stan: "laduje" });
    try { const w = await onPodglad(d); setPodglad(p => (p?.doc.id === d.id ? { doc: d, stan: "gotowe", url: safeHref ? safeHref(w.url) : w.url, znak: w.znak } : p)); }
    catch (e) { console.error("podgląd dokumentu", e); setPodglad(p => (p?.doc.id === d.id ? { doc: d, stan: "blad", blad: e?.message || String(e) } : p)); }
  };
  const [pobierany, setPobierany] = useState(null);
  const doOznaczenia = bezZnaku(docs);
  const wGrupach = GRUPY.map(g => [g, wKolejnosci(docs.filter(d => (RODZAJ[d.kind]?.grupa || "Inne") === g))]).filter(([, l]) => l.length);
  return (
    <div>
      {podglad && <OknoPodgladu podglad={podglad} onClose={() => setPodglad(null)} onPobierz={onPobierz} />}
      {docs.length === 0 && pusto && <p className="text-sm text-gray-500 mb-3">{pusto}</p>}
      {wGrupach.map(([grupa, lista]) => (
        <div key={grupa} className="mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{grupa}</div>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {lista.map(d => (
              <li key={d.id}>
                <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-gray-400 flex-shrink-0"><Ikona d={I.plik} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {d.label}
                    {d.kind === "dowod" && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-md align-middle" style={{ background: "#dbeafe", color: "#1e40af" }}>główny dokument</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {[d.number && `nr ${d.number}`, d.issueDate && `z ${fmtData(d.issueDate)}`, d.expiryDate && `ważne do ${fmtData(d.expiryDate)}`, d.notes].filter(Boolean).join(" · ") || RODZAJ[d.kind]?.label}
                  </div>
                </div>
                {d.fileUrl && onPodglad && (
                  <button type="button" onClick={() => pokazPodglad(d)} className="flex items-center gap-1 text-xs font-medium text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100" aria-label={`Podgląd: ${d.label}`}>
                    <Ikona d={I.oko} /> Podgląd
                  </button>
                )}
                {d.fileUrl && onPobierz
                  ? <button type="button" disabled={pobierany === d.id} onClick={async () => { setPobierany(d.id); try { await onPobierz(d); } finally { setPobierany(null); } }}
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50 disabled:opacity-60" aria-label={`Pobierz: ${d.label}`}>
                      <Ikona d={I.pobierz} /> {pobierany === d.id ? "Przygotowuję…" : "Pobierz"}
                    </button>
                  : d.fileUrl
                  ? <a href={safeHref ? safeHref(d.fileUrl) : d.fileUrl} target="_blank" rel="noopener noreferrer" download
                      className="flex items-center gap-1 text-xs font-medium text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50" aria-label={`Pobierz: ${d.label}`}>
                      <Ikona d={I.pobierz} /> Pobierz
                    </a>
                  : <span className="text-xs text-gray-500 px-2">bez pliku</span>}
                {canEdit && onOdczytaj && d.fileUrl && /\.(pdf|jpe?g|png|webp)$/i.test(d.fileName || d.storagePath || "") && (
                  <button type="button" onClick={() => onOdczytaj(d)} className="flex items-center gap-1 text-xs font-medium text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100" aria-label={`Odczytaj dane z dokumentu: ${d.label}`}>
                    <Ikona d={I.skan} /> Odczytaj dane
                  </button>
                )}
                {canEdit && onEdytuj && (
                  <button type="button" onClick={() => setEdytowany(e => e === d.id ? null : d.id)} aria-label={`Edytuj opis: ${d.label}`} aria-pressed={edytowany === d.id} className="text-gray-400 hover:text-gray-900 p-1.5"><Ikona d={I.olowek} /></button>
                )}
                {canEdit && onUsun && (
                  <button type="button" onClick={() => onUsun(d)} aria-label={`Usuń: ${d.label}`} className="text-gray-400 hover:text-red-700 p-1.5"><Ikona d={I.kosz} /></button>
                )}
                </div>
                {edytowany === d.id && <EdycjaDokumentu d={d} onZapisz={onEdytuj} onAnuluj={() => setEdytowany(null)} onOryginal={onOryginal} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {canEdit && onDodaj && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <PrzyciskWgraj onPliki={onDodaj} wgrywam={wgrywam} ciemny />
          <p className="w-full text-xs text-gray-500">Rodzaju nie wybierasz — aplikacja sama rozpozna dokument, odczyta numer, datę i termin ważności i pokaże wszystko do sprawdzenia. Zapisuje się dopiero po Twoim „Zapisz”.</p>
          <p className="w-full text-xs text-gray-500">„Podgląd” pokazuje dokument z logo VBS (bez daty). „Pobierz” daje plik z logo i datą pobrania; jedno i drugie zapisuje się w dzienniku. Czysty oryginał zostaje w pamięci — do pobrania przez ołówek przy dokumencie.</p>
          {doOznaczenia.length > 0 && (
            <p className="w-full text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Bez znaku wodnego: {doOznaczenia.map(d => d.label).join(", ")}. Usuń taki dokument i wgraj go ponownie — znak nakłada się przy wgrywaniu.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Dane auta odczytane z dowodu rejestracyjnego — do zatwierdzenia pole po polu.
 * `odczyt`: { doc, stan: "czytam" | "gotowe" | "blad", dane?, blad? }.
 */
function OknoDanychZDowodu({ v, odczyt, onZapisz, onPonow, onClose }) {
  // Dowód rejestracyjny zasila KARTĘ AUTA; każdy inny dokument — własny opis (numer, data, ważność).
  const zDowodu = odczyt.doc?.kind === "dowod";
  const wynik = useMemo(() => (odczyt.stan !== "gotowe" ? null : zDowodu ? porownajZDowodem(v, odczyt.dane) : porownajZDokumentem(v, odczyt.doc, odczyt.dane)), [v, odczyt, zDowodu]);
  const [wybrane, setWybrane] = useState(null);
  const [zapis, setZapis] = useState(false);
  const zaznaczone = wybrane ?? new Set((wynik?.pola || []).filter(p => p.domyslnie).map(p => p.klucz));
  const przelacz = (k) => { const n = new Set(zaznaczone); if (n.has(k)) n.delete(k); else n.add(k); setWybrane(n); };
  const doZapisu = (wynik?.pola || []).filter(p => p.stan !== "zgodne" && zaznaczone.has(p.klucz));
  // Opis dokumentu uzupełniamy tylko tam, gdzie jest pusty — ręcznego wpisu nie ruszamy.
  const opis = Object.fromEntries(Object.entries(wynik?.opisDokumentu || {}).filter(([k]) => !odczyt.doc?.[k]));
  const zapisz = async () => {
    setZapis(true);
    const wybranePola = Object.fromEntries(doZapisu.map(p => [p.klucz, p.wartosc]));
    const ok = zDowodu ? await onZapisz(wybranePola, opis) : await onZapisz({}, wybranePola);
    setZapis(false);
    if (ok !== false) onClose();
  };
  const gdzie = zDowodu ? "w karcie" : "przy dokumencie";
  const STAN = { nowe: ["#dcfce7", "#166534", `puste ${gdzie}`], zgodne: ["#f3f4f6", "#374151", "zgodne"], rozni: ["#fef3c7", "#92400e", `inna wartość ${gdzie}`] };
  const tytul = zDowodu ? `Dane z dowodu rejestracyjnego — ${v.plate}` : `Dane z dokumentu — ${odczyt.doc?.label || ""}`;
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div role="dialog" aria-label={tytul} className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 min-w-0 truncate">{tytul}</h3>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 text-sm">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {odczyt.stan === "czytam" && <p className="text-sm text-gray-700" role="status">Czytam dokument… to trwa kilkanaście sekund.</p>}
          {odczyt.stan === "blad" && (
            <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Nie udało się odczytać dokumentu: {odczyt.blad}. Plik jest wgrany — dane możesz wpisać ręcznie (ołówek przy dokumencie).
            </div>
          )}
          {wynik && !wynik.czyDowod && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">Ten plik nie wygląda na dowód rejestracyjny — sprawdź, czy wgrałeś właściwy dokument.</p>
          )}
          {wynik && !wynik.rejestracja.zgodna && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              Uwaga: dokument jest wystawiony na <b>{wynik.rejestracja.zDowodu}</b>, a to karta auta <b>{v.plate}</b>. Sprawdź, czy to dokument tego pojazdu, zanim cokolwiek zapiszesz.
            </p>
          )}
          {wynik?.vinRozny && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              To dokument tego auta (rejestracja się zgadza), ale <b>VIN jest inny niż w karcie</b>: w dokumencie{" "}
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{wynik.vinRozny.zDokumentu}</span>, w karcie{" "}
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{wynik.vinRozny.wKarcie}</span>. Sprawdź z dowodem rejestracyjnym, który numer jest poprawny.
            </p>
          )}
          {wynik && (wynik.pola.length === 0 ? <p className="text-sm text-gray-600">{zDowodu ? "Nie odczytałem z tego pliku żadnych danych do karty auta." : "Nie znalazłem w tym pliku numeru, daty ani terminu ważności."}</p> : (
            <>
              <p className="text-xs text-gray-600 mb-2">Zaznacz, co zapisać {zDowodu ? "w karcie auta" : "przy dokumencie"}. Nic nie zapisuje się samo; pola, które mają już inną wartość, są odznaczone.{!zDowodu && " Dokument z datą ważności pojawi się w „Terminach” i w mailu z terminami."}</p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {wynik.pola.map(p => {
                  const [tlo, kolor, tekst] = STAN[p.stan];
                  return (
                    <li key={p.klucz}>
                      <label className={`flex items-start gap-3 px-3 py-2.5 ${p.stan === "zgodne" ? "" : "cursor-pointer"}`}>
                        <input type="checkbox" className="mt-1" disabled={p.stan === "zgodne"} checked={p.stan !== "zgodne" && zaznaczone.has(p.klucz)} onChange={() => przelacz(p.klucz)} aria-label={`Zapisz: ${p.etykieta}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs text-gray-500">{p.etykieta}</span>
                          <span className="block text-sm font-medium text-gray-900 break-words">{p.zDowodu}</span>
                          {p.stan === "rozni" && <span className="block text-xs text-gray-600">{gdzie} teraz: {p.teraz}</span>}
                          {p.uwaga && <span className="block text-xs font-medium text-red-800 mt-0.5">{p.uwaga}</span>}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: tlo, color: kolor }}>{tekst}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {Object.keys(opis).length > 0 && (
                <p className="text-xs text-gray-600 mt-3">Przy dokumencie zapiszę też: {[opis.number && `nr ${opis.number}`, opis.issueDate && `wydany ${fmtData(opis.issueDate)}`, opis.notes].filter(Boolean).join(" · ")}.</p>
              )}
            </>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {odczyt.stan === "blad" && <button type="button" onClick={onPonow} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-800 bg-gray-100 mr-auto">Spróbuj ponownie</button>}
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100">{wynik ? "Nie zapisuj" : "Zamknij"}</button>
          {wynik && (doZapisu.length > 0 || Object.keys(opis).length > 0) && (
            <button type="button" onClick={zapisz} disabled={zapis} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#111827" }}>
              {zapis ? "Zapisuję…" : !doZapisu.length ? "Zapisz opis dokumentu" : zDowodu ? `Zapisz w karcie (${doZapisu.length})` : `Zapisz przy dokumencie (${doZapisu.length})`}
            </button>
          )}
        </div>
      </div>
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

function KartaPojazdu({ v, docs, dzis, canEdit, renderEdycja, renderSerwis, onArchiwizuj, onPrzywroc, onDodajDokumenty, onUsunDokument, onEdytujDokument, onZapiszLeasing, onOdczytajDowod, onZapiszZDowodu, onPobierzOryginal, onPobierzDokument, onPodgladDokumentu, onZapiszPole, onRozpoznajDokument, onZapiszRozpoznany, onWgrajDokumenty, pojazdy, kategorieKosztow, rodzajeFirmowe, onKursKosztu, onKosztyFaktury, onZapiszKoszt, onZapiszFirmowy, isAdmin, uruchomienie, onBrudne, showToast, safeHref }) {
  const [oferta, setOferta] = useState(false);
  const mozePole = canEdit && onZapiszPole && !v.archived;
  const [sekcja, setSekcja] = useState(null); // która sekcja karty jest otwarta; null = kafelki
  const sk = { wybrana: sekcja, onWybierz: setSekcja };
  const [odczyt, setOdczyt] = useState(null);
  const mozeCzytacDowod = canEdit && onOdczytajDowod && onZapiszZDowodu && !v.archived;
  const czytajDowod = async (d) => {
    setOdczyt({ doc: d, stan: "czytam" });
    try { const dane = await onOdczytajDowod({ ...d, rodzajOpis: RODZAJ[d.kind]?.label || "" }); setOdczyt(o => (o?.doc.id === d.id ? { doc: d, stan: "gotowe", dane } : o)); }
    catch (e) { console.error("odczyt dowodu", e); setOdczyt(o => (o?.doc.id === d.id ? { doc: d, stan: "blad", blad: e?.message || String(e) } : o)); }
  };
  // Wgrywanie bez wyboru rodzaju: pliki idą do kolejki, AI czyta każdy, a okno pokazuje je po kolei do zatwierdzenia.
  const mozeWgrywac = canEdit && onDodajDokumenty && onZapiszRozpoznany && !v.archived;
  const [kolejka, setKolejka] = useState([]);
  const [wgrywam, setWgrywam] = useState(false);
  const wKolejce = (id, zmiana) => setKolejka(k => k.map(p => (p.doc.id === id ? { ...p, ...zmiana } : p)));
  const rozpoznaj = async (d) => {
    if (!onRozpoznajDokument || !d.fileUrl || !CZYTELNY.test(d.fileName || "")) { wKolejce(d.id, { stan: "reczne" }); return; }
    wKolejce(d.id, { stan: "czytam", blad: "" });
    try { const w = await onRozpoznajDokument(d, RODZAJE_DOKUMENTOW.map(r => ({ id: r.id, label: r.label }))); wKolejce(d.id, { stan: "gotowe", dane: w.dane, daneDowodu: w.daneDowodu || null }); }
    catch (e) { console.error("rozpoznanie dokumentu", e); wKolejce(d.id, { stan: "blad", blad: e?.message || String(e) }); }
  };
  const wgrajPliki = async (pliki) => {
    setWgrywam(true);
    try {
      const rodzaje = RODZAJE_DOKUMENTOW.map(r => ({ id: r.id, label: r.label }));
      const wgrane = (await (onWgrajDokumenty ? onWgrajDokumenty(v, pliki, rodzaje) : onDodajDokumenty(v, pliki, { kind: "inne" }))) || [];
      // Faktura i dokument firmowy przychodzą już rozpoznane i bez zapisu (`typ`) — czekają tylko na decyzję admina.
      setKolejka(k => [...k, ...wgrane.map(d => (d.typ ? { doc: d, stan: "gotowe", dane: d.rozpoznanie } : { doc: d, stan: "czytam" }))]);
      wgrane.filter(d => !d.typ).forEach(rozpoznaj);
    } finally { setWgrywam(false); }
  };
  const [uruchom, setUruchom] = useState(false);
  const [edycjaLeasingu, setEdycjaLeasingu] = useState(false);
  const mozeLeasing = canEdit && onZapiszLeasing && !v.archived;
  const [edycja, setEdycja] = useState(false);
  const kierowca = (v.driverHistory || []).find(d => !d.to) || null;
  const terminy = terminyPojazdu(v, docs, dzis);
  const wyp = [...(v.equipment || []).map(id => WYPOSAZENIE[id] || id), ...(v.customEquipment || [])];
  const L = v.leasing;
  // Dokumenty danej grupy pokazujemy też w „ich” kafelku (polisy przy ubezpieczeniu, umowa przy leasingu…).
  const dokumentyW = (...grupy) => {
    const lista = docs.filter(d => grupy.includes(RODZAJ[d.kind]?.grupa));
    if (!lista.length) return null;
    return (
      <div className="mt-5">
        <ListaDokumentow docs={lista} canEdit={canEdit} safeHref={safeHref} pusto=""
          onOdczytaj={mozeCzytacDowod ? czytajDowod : null} onOryginal={canEdit ? onPobierzOryginal : null} onPobierz={onPobierzDokument} onPodglad={onPodgladDokumentu}
          onUsun={onUsunDokument} onEdytuj={onEdytujDokument} />
      </div>
    );
  };
  // „Uruchomienie auta" to pełna strona ZAMIAST karty (nie okno) — lista aut po lewej zostaje.
  if (uruchom && uruchomienie) {
    return <UruchomienieAuta v={v} api={uruchomienie} kierowca={kierowca} onClose={() => setUruchom(false)} onBrudne={onBrudne} showToast={showToast} safeHref={safeHref} />;
  }
  return (
    <article className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div aria-hidden="true" style={{ height: 4, background: `linear-gradient(90deg, ${KOLOR.granat} 0%, ${KOLOR.granat} 70%, ${KOLOR.zolty} 70%, ${KOLOR.zolty} 100%)` }} />
      <header className="flex flex-wrap items-start gap-3 px-5 py-4" style={{ background: KOLOR.tlo, borderBottom: `1px solid ${KOLOR.ramka}` }}>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold" style={{ color: KOLOR.granat }}>{v.plate}{v.plate2 && <span className="text-gray-500 font-medium"> + {v.plate2}</span>}</h2>
          <p className="text-sm text-gray-700">{[v.brand, v.year, v.type].filter(Boolean).join(" · ")}{v.archived && " · w archiwum"}</p>
          <p className="text-sm text-gray-700 mt-0.5">{kierowca ? <>Kierowca: <span className="text-gray-900 font-medium">{kierowca.name}</span>{kierowca.phone && ` · ${kierowca.phone}`}</> : "Bez przypisanego kierowcy"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOferta(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: KOLOR.granat }}>
            <Ikona d={I.kopiuj} /> Kopiuj ofertę
          </button>
          {canEdit && uruchomienie && (
            <button type="button" onClick={() => setUruchom(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-900" style={{ border: `1px solid ${KOLOR.ramka}` }}>
              Uruchomienie auta
            </button>
          )}
          {mozeWgrywac && <PrzyciskWgraj onPliki={wgrajPliki} wgrywam={wgrywam} />}
          {canEdit && renderEdycja && !v.archived && (
            <button type="button" onClick={() => setEdycja(e => !e)} aria-pressed={edycja} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={edycja ? { background: KOLOR.granat, color: "#fff" } : { background: "#fff", color: "#1f2937", border: `1px solid ${KOLOR.ramka}` }}>
              <Ikona d={I.olowek} /> {edycja ? "Zamknij edycję" : "Edytuj"}
            </button>
          )}
          {canEdit && v.archived && onPrzywroc && (
            <button type="button" onClick={() => onPrzywroc(v)} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-800 bg-gray-100">Przywróć z archiwum</button>
          )}
        </div>
      </header>

      {/* Wartości netto tu nie ma (user, 23.11.2026: nieistotna dla dyspozytora) — zostaje w „Edytuj". */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3 px-5 py-5">
        <Fakt etykieta="Wymiary skrzyni (cm)">{v.dimensions}</Fakt>
        <Fakt etykieta="Ładowność rzeczywista"><PoleNaKarcie wartosc={v.maxWeight} pokaz={(x) => `${x} kg`} typ="number" nazwa="Ładowność rzeczywista (kg)" pusto="nie wpisano" ustaw="wpisz" onZapisz={mozePole ? (x) => onZapiszPole(v, { maxWeight: x }) : null} /></Fakt>
        <Fakt etykieta="Ładowność wg dowodu">{v.maxWeightDowod ? `${v.maxWeightDowod} kg` : ""}</Fakt>
        {/* Waga auta gotowego do jazdy po naszych modyfikacjach (paliwo, belki, paleciak…). Zmienia tylko admin. */}
        <Fakt etykieta="Aktualna waga auta"><PoleNaKarcie wartosc={v.wagaAktualna} pokaz={(x) => `${x} kg`} typ="number" nazwa="Aktualna waga auta (kg)" pusto="nie wpisano" ustaw="wpisz" onZapisz={mozePole && isAdmin ? (x) => onZapiszPole(v, { wagaAktualna: x }) : null} /></Fakt>
        <Fakt etykieta="Załadunek">{v.loadingType}</Fakt>
        {v.plate2 && <Fakt etykieta={`Przyczepa ${v.plate2} (cm)`}>{v.dimensions2}</Fakt>}
        {v.plate2 && <Fakt etykieta="Ładowność przyczepy">{v.maxWeight2 ? `${v.maxWeight2} kg` : ""}</Fakt>}
        <Fakt etykieta="We flocie od">
          {/* Auto z leasingiem: data bierze się sama z pierwszej raty i nie jest edytowana ręcznie. */}
          {pierwszaRataLeasingu(L)
            ? <span>{fmtData(v.fleetJoinDate || pierwszaRataLeasingu(L))} <span className="text-xs font-normal text-gray-500">· 1. rata leasingu</span></span>
            : <PoleNaKarcie wartosc={v.fleetJoinDate} pokaz={fmtData} typ="date" nazwa="We flocie od" ustaw="ustaw datę" onZapisz={mozePole ? (x) => onZapiszPole(v, { fleetJoinDate: x }) : null} />}
        </Fakt>
        {v.archived && <Fakt etykieta="W archiwum od">{[v.archivedDate && fmtData(v.archivedDate), v.archivedReason].filter(Boolean).join(" · ")}</Fakt>}
        <div className="col-span-2 sm:col-span-4"><Fakt etykieta="VIN"><span style={{ fontFamily: "'DM Mono', monospace" }}>{v.vin}</span></Fakt></div>
        <div className="col-span-2 sm:col-span-4">
          <div className="text-xs text-gray-500 mb-1">Wyposażenie</div>
          {wyp.length ? <div className="flex flex-wrap gap-1.5">{wyp.map(w => <span key={w} className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-800">{w}</span>)}</div> : <div className="text-sm font-medium text-gray-900">—</div>}
        </div>
      </div>

      {edycja && renderEdycja && <div className="border-t border-gray-100">{renderEdycja(v, () => setEdycja(false))}</div>}

      {/* Sekcje karty jako KAFELKI (user, 24.11.2026): najpierw wybór, dopiero kliknięcie wchodzi w zawartość. */}
      <div className={sekcja ? "border-t border-gray-100" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-3 px-5 py-5 border-t border-gray-100"} style={sekcja ? undefined : { background: "#fafbff" }}>
      <SekcjaKarty id="terminy" {...sk} tytul="Terminy i przypomnienia" licznik={terminy.length}
        opis={terminy[0] ? terminy[0].nazwa : "Brak wpisanych terminów"} znaczek={terminy[0] ? <Znaczek dni={terminy[0].dni} /> : null}>
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
      </SekcjaKarty>

      <SekcjaKarty id="leasing" {...sk} tytul="Leasing" opis={L ? [L.umowa, L.rata ? `rata ${fmtKwota(L.rata, L.waluta)}` : ""].filter(Boolean).join(" · ") : "Brak danych leasingu"}
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
        {!edycjaLeasingu && dokumentyW("Leasing")}
      </SekcjaKarty>

      <SekcjaKarty id="dokumenty" {...sk} tytul="Dokumenty" licznik={docs.length} opis={docs.length ? "Podgląd, pobieranie, wgrywanie" : "Brak dokumentów — wgraj pierwszy"}>
        <ListaDokumentow docs={docs} canEdit={canEdit} safeHref={safeHref}
          onDodaj={mozeWgrywac ? wgrajPliki : null} wgrywam={wgrywam}
          onOdczytaj={mozeCzytacDowod ? czytajDowod : null} onOryginal={canEdit ? onPobierzOryginal : null} onPobierz={onPobierzDokument} onPodglad={onPodgladDokumentu}
          onUsun={onUsunDokument} onEdytuj={onEdytujDokument} />
      </SekcjaKarty>

      <SekcjaKarty id="ubezpieczenie" {...sk} tytul="Ubezpieczenie i UDT" opis={[v.ocExpiry && `OC do ${fmtData(v.ocExpiry)}`, v.udtExpiry && `UDT do ${fmtData(v.udtExpiry)}`].filter(Boolean).join(" · ") || "Polisy i winda"}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3">
          <Fakt etykieta="Polisa OC">{v.ocNumber}</Fakt>
          <Fakt etykieta="Składka OC">{v.ocAmount ? fmtKwota(v.ocAmount) : ""}</Fakt>
          <Fakt etykieta="Polisa AC">{v.acNumber}</Fakt>
          {v.plate2 && <Fakt etykieta={`Polisa OC — przyczepa ${v.plate2}`}>{[v.ocNumber2, v.ocExpiry2 && `do ${fmtData(v.ocExpiry2)}`].filter(Boolean).join(" · ")}</Fakt>}
          <Fakt etykieta="Całość polis">{v.caloscPolis ? fmtKwota(v.caloscPolis) : ""}</Fakt>
          <Fakt etykieta="Nr ewidencyjny UDT">{v.udtNumber}</Fakt>
          <div className="col-span-2 sm:col-span-3"><Fakt etykieta="Winda">{v.udtLiftName}</Fakt></div>
        </div>
        {dokumentyW("Ubezpieczenia", "Winda i UDT")}
      </SekcjaKarty>

      {renderSerwis && <SekcjaKarty id="serwis" {...sk} tytul="Serwis, gwarancja i tachograf" opis="Przeglądy olejowe, gwarancja, tachograf">{renderSerwis(v)}{dokumentyW("Tachograf", "Serwis i gwarancje")}</SekcjaKarty>}

      <SekcjaKarty id="kierowcy" {...sk} tytul="Historia kierowców" licznik={(v.driverHistory || []).length} opis={kierowca ? `Obecnie: ${kierowca.name}` : "Bez przypisanego kierowcy"}>
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
      </SekcjaKarty>
      </div>

      {canEdit && onArchiwizuj && !v.archived && (
        <div className="border-t border-gray-100 px-5 py-3 text-right">
          <button type="button" onClick={() => onArchiwizuj(v)} className="text-xs font-medium text-gray-600 hover:text-red-700">Przenieś do archiwum lub usuń…</button>
        </div>
      )}

      {odczyt && <OknoDanychZDowodu key={`${odczyt.doc.id}-${odczyt.stan}`} v={v} odczyt={odczyt} onClose={() => setOdczyt(null)}
        onPonow={() => czytajDowod(odczyt.doc)} onZapisz={(patch, opis) => onZapiszZDowodu(v, patch, odczyt.doc, opis)} />}
      {kolejka[0] && (() => {
        const p = kolejka[0], dalej = () => setKolejka(k => k.slice(1)), zostalo = kolejka.length - 1;
        if (p.doc.typ === "koszt") return <OknoKosztu key={p.doc.id} pojazdy={pojazdy || [v]} kategorie={kategorieKosztow || []} pozycja={p} zostalo={zostalo} onKurs={onKursKosztu} onKoszty={onKosztyFaktury} onZapisz={onZapiszKoszt} onClose={dalej} safeHref={safeHref} />;
        if (p.doc.typ === "firma") return <OknoFirmowe key={p.doc.id} rodzaje={rodzajeFirmowe || []} pozycja={p} zostalo={zostalo} onZapisz={onZapiszFirmowy} onClose={dalej} safeHref={safeHref} />;
        return <OknoRozpoznania key={`${p.doc.id}-${p.stan}`} karta={v} pojazdy={pojazdy || [v]} pozycja={p} zostalo={zostalo}
          onClose={dalej} onPonow={() => rozpoznaj(p.doc)} onZapisz={(auto, opis, patch) => onZapiszRozpoznany(auto, p.doc, opis, patch)} />;
      })()}
      {oferta && <OknoOferty v={v} kierowca={kierowca} docs={docs} onClose={() => setOferta(false)} showToast={showToast} />}
    </article>
  );
}

export default function PojazdyPanel({ vehicles = [], vehicleDocs = [], canEdit = false, dzis, renderEdycja, renderSerwis, onArchiwizuj, onPrzywroc, onDodajPojazd, onDodajDokumenty, onUsunDokument, onEdytujDokument, onZapiszLeasing, onOdczytajDowod, onZapiszZDowodu, onPobierzOryginal, onPobierzDokument, onPodgladDokumentu, onZapiszPole, onRozpoznajDokument, onZapiszRozpoznany, onWgrajDokumenty, kategorieKosztow, rodzajeFirmowe, onKursKosztu, onKosztyFaktury, onZapiszKoszt, onZapiszFirmowy, isAdmin = false, uruchomienie, showToast, safeHref }) {
  const teraz = useMemo(() => dzis ?? new Date().setHours(0, 0, 0, 0), [dzis]);
  const [archiwum, setArchiwum] = useState(false);
  const [szukaj, setSzukaj] = useState("");
  const [wybrany, setWybrany] = useState(null);
  // Niezapisane zmiany na stronie „Uruchomienie auta" — pytamy, zanim zmiana auta je wyrzuci.
  const brudne = useRef(false);
  // Lista terminów jest na dole strony — po kliknięciu terminu przewijamy do karty auta.
  const gora = useRef(null);
  const onBrudne = useCallback((b) => { brudne.current = b; }, []);
  const moznaZmienic = () => !brudne.current || window.confirm("Masz niezapisane zmiany w uruchomieniu auta. Przejść bez zapisu?");

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

      <div ref={gora} className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
        <aside className="bg-white rounded-2xl border border-gray-100 p-3 lg:sticky lg:top-4">
          <input type="search" value={szukaj} onChange={e => setSzukaj(e.target.value)} placeholder="Szukaj: rejestracja, kierowca" aria-label="Szukaj pojazdu"
            className="w-full px-3 py-2 rounded-lg text-sm bg-gray-50 border border-gray-200 mb-2" />
          <div className="flex gap-1 mb-2" role="tablist">
            {[[false, `Aktywne (${vehicles.length - ileArch})`], [true, `Archiwum (${ileArch})`]].map(([a, opis]) => (
              <button key={String(a)} type="button" role="tab" aria-selected={archiwum === a} onClick={() => { if (moznaZmienic()) { setArchiwum(a); setWybrany(null); } }}
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
                  <button type="button" onClick={() => { if (moznaZmienic()) setWybrany(v.id); }} aria-current={wybr ? "true" : undefined}
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
              renderEdycja={renderEdycja} renderSerwis={renderSerwis} onArchiwizuj={onArchiwizuj} onPrzywroc={onPrzywroc} onDodajDokumenty={onDodajDokumenty} onUsunDokument={onUsunDokument} onEdytujDokument={onEdytujDokument} onZapiszLeasing={onZapiszLeasing} onOdczytajDowod={onOdczytajDowod} onZapiszZDowodu={onZapiszZDowodu} onPobierzOryginal={onPobierzOryginal} onPobierzDokument={onPobierzDokument} onPodgladDokumentu={onPodgladDokumentu} onZapiszPole={onZapiszPole} onRozpoznajDokument={onRozpoznajDokument} onZapiszRozpoznany={onZapiszRozpoznany} onWgrajDokumenty={onWgrajDokumenty} pojazdy={vehicles} kategorieKosztow={kategorieKosztow} rodzajeFirmowe={rodzajeFirmowe} onKursKosztu={onKursKosztu} onKosztyFaktury={onKosztyFaktury} onZapiszKoszt={onZapiszKoszt} onZapiszFirmowy={onZapiszFirmowy} isAdmin={isAdmin} uruchomienie={uruchomienie} onBrudne={onBrudne} showToast={showToast} safeHref={safeHref} />
          : <div className="bg-white rounded-2xl border border-gray-100 p-8 text-sm text-gray-500">Wybierz pojazd z listy.</div>}
      </div>

      {/* Terminy całej floty — na dole strony (user, 23.11.2026: „nie chcę u góry tych przypomnień”);
          to samo zestawienie biuro dostaje mailem w poniedziałki i czwartki (CF `terminyFlotyMail`). */}
      {flotaTerminy.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 mt-4">
          <Sekcja tytul="Najbliższe terminy we flocie (60 dni)" licznik={flotaTerminy.length} domyslnieOtwarta={flotaTerminy.some(t => t.dni <= 30)}>
            <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
              {flotaTerminy.map((t, i) => (
                <li key={i}>
                  <button type="button" onClick={() => { if (moznaZmienic()) { setArchiwum(false); setWybrany(t.id); gora.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}
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
    </div>
  );
}
