// PlanerZaladunku — planer załadunku 3D: auto z kartoteki + lista ładunku → układ na pace,
// ręczne poprawki myszką, podsumowanie (miejsce, waga, osie) i wydruk PDF dla kierowcy/klienta.
//
// Logika układania siedzi w `utils/planerZaladunku.js` (czysta, pokryta testami
// `diagnose_planer_zaladunku.mjs`). Tutaj tylko UI i scena three.js.
//
// three.js ładujemy z CDN dopiero po wejściu w zakładkę (jak Leaflet — nie przez `import`
// z node_modules), więc nie waży nic dla reszty aplikacji.
//
// Plan żyje w `localStorage` przeglądarki (wersja robocza), NIE w Firestore — do bazy idą
// wyłącznie dane techniczne osi (`planerAuta/{vehicleId}`), bo te wpisuje się raz na auto.

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import ZlecenieUploadBtn from "./ZlecenieUploadBtn";
import {
  parsujWymiaryPaki, parsujPalety, rozwinPozycje, ulozZestaw, sprawdzMiejsce, podsumowanie, naciskiOsi,
  ostrzezeniaUkladu, przyciagnij, KOLORY_ROZL, TYPY_PALET,
} from "../utils/planerZaladunku";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
let threePromise = null;
const zaladujThree = () => (threePromise ||= import(/* @vite-ignore */ THREE_URL).catch(e => { threePromise = null; throw e; }));

const LS_KEY = "fleetstat.planerZaladunku.v1";
const PALETA = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#be185d", "#4d7c0f", "#b45309", "#475569"];
const S = 0.01; // cm → jednostki sceny (metry)
const ODSTEP = 130; // cm między autem a przyczepą w scenie (dyszel)
const PUSTA_PAKA = { dl: "", sz: "", wys: "", maxWaga: "" };
const nowyId = () => Math.random().toString(36).slice(2, 9);
const pustaPozycja = (extra = {}) => ({ id: nowyId(), nazwa: "", dl: "", sz: "", wys: "", szt: 1, waga: "", pietrowanie: false, obrot: true, rozl: 1, uwagi: [], ...extra });
const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const TECH_POLA = [
  ["rozstawOsi", "Rozstaw osi (cm)"],
  ["osDoPaki", "Oś przednia → początek paki (cm)"],
  ["masaPrzod", "Pusty: nacisk na przód (kg)"],
  ["masaTyl", "Pusty: nacisk na tył (kg)"],
  ["dopPrzod", "Dopuszczalny nacisk: przód (kg)"],
  ["dopTyl", "Dopuszczalny nacisk: tył (kg)"],
];
const WIDOKI = {
  "3d":   { theta: 0.62, phi: 1.02, etykieta: "3D" },
  gora:   { theta: 0, phi: 0.02, etykieta: "Z góry" },
  bok:    { theta: Math.PI / 2, phi: Math.PI / 2 - 0.02, etykieta: "Z boku" },
  tyl:    { theta: 0, phi: Math.PI / 2 - 0.05, etykieta: "Od drzwi" },
};

function wczytajStan() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null") || {}; } catch { return {}; }
}

const inp = "w-full px-2 py-1.5 rounded-lg text-sm outline-none border border-gray-200 focus:border-gray-400 bg-white text-gray-900";
const lbl = "block text-xs font-medium text-gray-600 mb-1";

function kolorSztuki(s, tryb, indeksPozycji) {
  return tryb === "rozl" ? (KOLORY_ROZL[s.rozl] || "#475569") : PALETA[(indeksPozycji.get(s.pozycjaId) ?? 0) % PALETA.length];
}

// ── Rzuty 2D do wydruku (SVG — ostre w PDF niezależnie od rozdzielczości) ──
function Rzut({ paka, ulozone, kolor, os }) {
  const gora = os === "gora";
  const W = paka.dl, H = gora ? paka.sz : paka.wys;
  const lista = [...ulozone].sort((a, b) => (gora ? a.z - b.z : b.y - a.y));
  const fs = Math.max(9, Math.min(W, H * 3) / 34);
  return (
    <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="0" y="0" width={W} height={H} fill="#f8fafc" stroke="#0f172a" strokeWidth="2.5" />
      {lista.map(s => {
        const x = s.x, y = gora ? s.y : H - s.z - s.wys, w = s.dl, h = gora ? s.sz : s.wys;
        return (
          <g key={s.id}>
            <rect x={x} y={y} width={w} height={h} fill={kolor(s)} fillOpacity={gora && s.z > 0 ? 0.95 : 0.8} stroke="#0f172a" strokeWidth="1.2" />
            <text x={x + w / 2} y={y + h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">
              {s.nr}{gora && s.z > 0 ? "↑" : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function PlanerZaladunku({ vehicles = [], canEdit = false, showToast = () => {} }) {
  const [start] = useState(wczytajStan);
  const [autoKey, setAutoKey] = useState(start.autoKey || "");
  // Jedna pozycja na przestrzeń ładunkową: samo auto = 1, auto + przyczepa = 2.
  const [pakiTxt, setPakiTxt] = useState(Array.isArray(start.pakiTxt) && start.pakiTxt.length ? start.pakiTxt : [start.pakaTxt || PUSTA_PAKA]);
  const [najpierw, setNajpierw] = useState(start.najpierw === 1 ? 1 : 0);
  const [pozycje, setPozycje] = useState(Array.isArray(start.pozycje) ? start.pozycje : []);
  const [reczne, setReczne] = useState(start.reczne || {});
  const [tryb, setTryb] = useState(start.tryb || "podloga");
  const [kolejnosc, setKolejnosc] = useState(start.kolejnosc !== false);
  const [naglowek, setNaglowek] = useState(start.naglowek || { nr: "", klient: "", uwagi: "" });
  const [kolorWg, setKolorWg] = useState(start.kolorWg || "pozycja");
  const [wybrana, setWybrana] = useState(null);
  const [widok, setWidok] = useState("3d");
  const [wklejka, setWklejka] = useState("");
  const [tech, setTech] = useState({});
  const [techOtwarte, setTechOtwarte] = useState(false);
  const [techZapis, setTechZapis] = useState("");
  const [blad3d, setBlad3d] = useState("");
  const [gotowe3d, setGotowe3d] = useState(0); // licznik, nie flaga: każde postawienie sceny od nowa musi ją też od nowa wypełnić
  const [uploadKey, setUploadKey] = useState(0);

  // ── Auta z kartoteki. Pojazd z przyczepą to JEDEN zestaw o dwóch przestrzeniach ładunkowych. ──
  const auta = useMemo(() => {
    const out = [];
    for (const v of vehicles || []) {
      if (!v?.id || v.archived) continue;
      const przestrzenie = [{ nazwa: v.plate || "Auto", wym: parsujWymiaryPaki(v.dimensions), maxWaga: v.maxWeight || "", zrodlo: v.dimensions || "" }];
      if (v.plate2) przestrzenie.push({ nazwa: `${v.plate2} (przyczepa)`, wym: parsujWymiaryPaki(v.dimensions2), maxWaga: v.maxWeight2 || "", zrodlo: v.dimensions2 || "" });
      out.push({
        key: v.id, vehicleId: v.id, przestrzenie,
        etykieta: v.plate2 ? `${v.plate} + ${v.plate2} · ${v.type || "zestaw z przyczepą"}` : [v.plate, v.brand].filter(Boolean).join(" · "),
      });
    }
    return out;
  }, [vehicles]);
  const auto = auta.find(a => a.key === autoKey) || null;
  const vehicleId = auto?.vehicleId || null;

  const wybierzAuto = (key) => {
    setAutoKey(key);
    const a = auta.find(x => x.key === key);
    setPakiTxt(a ? a.przestrzenie.map(pr => ({ dl: pr.wym?.dl ?? "", sz: pr.wym?.sz ?? "", wys: pr.wym?.wys ?? "", maxWaga: pr.maxWaga ?? "" })) : [PUSTA_PAKA]);
    setReczne({});
    setWybrana(null);
    setTech({}); setTechZapis(""); // dane osi należą do auta — nowe auto zaczyna od pustych
  };

  // Dane techniczne osi — osobny dokument per pojazd (nie fleet/data).
  useEffect(() => {
    let zywy = true;
    if (!vehicleId) return;
    getDoc(doc(db, "planerAuta", vehicleId))
      .then(s => { if (zywy && s.exists()) setTech(s.data() || {}); })
      .catch(e => console.warn("planerAuta: odczyt nieudany", e));
    return () => { zywy = false; };
  }, [vehicleId]);

  const zapiszTech = async () => {
    if (!auto?.vehicleId) return;
    const dane = {};
    for (const [k] of TECH_POLA) { const v = String(tech[k] ?? "").replace(",", "."); dane[k] = v === "" || !Number.isFinite(Number(v)) ? null : Number(v); }
    try {
      await setDoc(doc(db, "planerAuta", auto.vehicleId), { ...dane, updatedAt: new Date().toISOString() }, { merge: true });
      setTechZapis("ok"); showToast("✅ Zapisano dane osi dla " + auto.etykieta);
    } catch (e) {
      console.error("planerAuta: zapis nieudany", e);
      setTechZapis("blad"); showToast("❌ Nie udało się zapisać danych osi");
    }
  };

  // ── Przestrzenie ładunkowe i układ ──
  const przestrzenie = useMemo(() => {
    const n = (v) => Number(String(v ?? "").replace(",", "."));
    const lista = pakiTxt.map((t, i) => {
      const pk = { dl: n(t.dl), sz: n(t.sz), wys: n(t.wys) };
      return { i, nazwa: auto?.przestrzenie[i]?.nazwa || (i ? "Przyczepa" : "Auto"), paka: pk.dl > 0 && pk.sz > 0 && pk.wys > 0 ? pk : null, maxWaga: n(t.maxWaga) || null, x0: 0 };
    });
    // Położenie w scenie: auto z przodu, przyczepa za nim, całość wyśrodkowana.
    const zPaka = lista.filter(pr => pr.paka);
    let x = -(zPaka.reduce((sum, pr) => sum + pr.paka.dl, 0) + ODSTEP * Math.max(0, zPaka.length - 1)) / 2;
    for (const pr of zPaka) { pr.x0 = x; x += pr.paka.dl + ODSTEP; }
    return lista;
  }, [pakiTxt, auto]);
  const zestaw = przestrzenie.length > 1;
  const jestPaka = przestrzenie.some(pr => pr.paka);

  const { sztuki, braki } = useMemo(() => rozwinPozycje(pozycje), [pozycje]);
  const wynik = useMemo(() => ulozZestaw(przestrzenie, sztuki, { tryb, stale: reczne, kolejnosc, najpierw }), [przestrzenie, sztuki, tryb, reczne, kolejnosc, najpierw]);
  const { ulozone, nieulozone } = wynik;
  const sumy = useMemo(() => przestrzenie.map(pr => (pr.paka ? podsumowanie(pr.paka, ulozone.filter(s => s.p === pr.i), [], pr.maxWaga) : null)), [przestrzenie, ulozone]);
  // Osie liczymy dla pojazdu (przestrzeń 0). Nacisku dyszla przyczepy na hak NIE uwzględniamy.
  const osie = useMemo(() => naciskiOsi(tech, ulozone.filter(s => s.p === 0)), [tech, ulozone]);
  const ostrzezenia = useMemo(() => przestrzenie.flatMap(pr => (pr.paka ? ostrzezeniaUkladu(pr.paka, ulozone.filter(s => s.p === pr.i), { kolejnosc }) : [])), [przestrzenie, ulozone, kolejnosc]);
  const indeksPozycji = useMemo(() => new Map(pozycje.map((p, i) => [p.id, i])), [pozycje]);
  const kolor = useCallback((s) => kolorSztuki(s, kolorWg, indeksPozycji), [kolorWg, indeksPozycji]);
  const saRecze = Object.keys(reczne).length > 0;
  const wieleRozl = pozycje.some(p => Number(p.rozl) > 1);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ autoKey, pakiTxt, najpierw, pozycje, reczne, tryb, kolejnosc, naglowek, kolorWg })); } catch {}
  }, [autoKey, pakiTxt, najpierw, pozycje, reczne, tryb, kolejnosc, naglowek, kolorWg]);

  // ── Edycja listy ładunku ──
  const zmien = (id, pole, wartosc) => setPozycje(l => l.map(p => (p.id === id ? { ...p, [pole]: wartosc } : p)));
  const usun = (id) => { setPozycje(l => l.filter(p => p.id !== id)); setReczne(r => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith(id + "#")))); };
  const dodajZTekstu = (tekst, extra = {}) => {
    const nowe = parsujPalety(tekst, extra).map(p => pustaPozycja({ ...p, dl: p.dl ?? "", sz: p.sz ?? "", wys: p.wys ?? "", waga: p.waga ?? "" }));
    if (nowe.length) setPozycje(l => [...l, ...nowe]);
    return nowe.length;
  };
  const poWgraniuZlecenia = (_url, d) => {
    setUploadKey(k => k + 1); // przycisk wraca do stanu wyjściowego — można wczytać kolejne zlecenie
    if (!d || (d.nrZlecenia == null && !d.towarPalety && !d.towarIloscPalet)) { showToast("⚠️ Nie udało się odczytać ładunku ze zlecenia — wpisz ręcznie"); return; }
    const ile = dodajZTekstu(d.towarPalety, { ilosc: d.towarIloscPalet, wagaKg: d.wagaLadunku });
    setNaglowek(n => ({ ...n, nr: n.nr || d.nrZlecenia || "", klient: n.klient || d.klient || "" }));
    showToast(ile ? `✅ Wczytano ${ile} poz. ze zlecenia — sprawdź wymiary i piętrowanie` : "⚠️ Zlecenie nie podaje wymiarów ani liczby palet");
  };
  const wyczysc = () => { if (!pozycje.length || window.confirm("Usunąć cały ładunek z planu?")) { setPozycje([]); setReczne({}); setWybrana(null); setNaglowek({ nr: "", klient: "", uwagi: "" }); } };

  // Ręczna poprawka zamraża CAŁY bieżący układ — inaczej automat po każdym ruchu
  // przestawiałby pozostałe sztuki i poprawianie byłoby gonieniem własnego ogona.
  const zamrozZ = useCallback((zmiana) => {
    const stan = {};
    for (const s of ulozone) stan[s.id] = { x: s.x, y: s.y, z: s.z, obr: !!s.obr, p: s.p };
    setReczne({ ...stan, ...zmiana });
  }, [ulozone]);

  const obrocWybrana = () => {
    const s = ulozone.find(u => u.id === wybrana);
    const paka = s ? przestrzenie[s.p]?.paka : null;
    if (!s || !paka) return;
    const inne = ulozone.filter(u => u.id !== s.id && u.p === s.p);
    const p = przyciagnij(paka, inne, s.id, s.x, s.y, s.sz, s.dl, 0);
    const r = sprawdzMiejsce(paka, inne, s, p.x, p.y, s.sz, s.dl, { twarde: false, kolejnosc });
    if (!r.ok) { showToast("⚠️ Po obrocie sztuka się tu nie mieści (" + r.powod + ")"); return; }
    zamrozZ({ [s.id]: { x: p.x, y: p.y, z: r.z, obr: !s.obr, p: s.p } });
  };

  // ════════════════════════ SCENA 3D ════════════════════════
  const holderRef = useRef(null);
  const g = useRef({}); // THREE, renderer, scene, camera, grupa, orbit, meshe
  const danePrzeciagania = useRef({ przestrzenie, ulozone, kolejnosc, zamrozZ });
  useEffect(() => { danePrzeciagania.current = { przestrzenie, ulozone, kolejnosc, zamrozZ }; }, [przestrzenie, ulozone, kolejnosc, zamrozZ]);

  const rysuj = useCallback(() => {
    const c = g.current;
    if (!c.renderer) return;
    const { theta, phi, r, cel } = c.orbit;
    c.camera.position.set(cel.x + r * Math.sin(phi) * Math.cos(theta), cel.y + r * Math.cos(phi), cel.z + r * Math.sin(phi) * Math.sin(theta));
    c.camera.lookAt(cel.x, cel.y, cel.z);
    c.renderer.render(c.scene, c.camera);
  }, []);

  useEffect(() => {
    let zywy = true;
    const holder = holderRef.current;
    const sprzataj = [];
    zaladujThree().then(THREE => {
      if (!zywy || !holder) return;
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f1f5f9");
      const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
      scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      const sl = new THREE.DirectionalLight(0xffffff, 1.6); sl.position.set(6, 10, 4); scene.add(sl);
      const sl2 = new THREE.DirectionalLight(0xffffff, 0.6); sl2.position.set(-6, 4, -8); scene.add(sl2);
      const grupa = new THREE.Group(); scene.add(grupa);
      holder.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.touchAction = "none";
      g.current = { THREE, renderer, scene, camera, grupa, orbit: { ...WIDOKI["3d"], r: 12, cel: { x: 0, y: 0.8, z: 0 } }, meshe: new Map() };

      const dopasuj = () => {
        const w = holder.clientWidth || 600, h = holder.clientHeight || 420;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
        camera.aspect = w / h; camera.updateProjectionMatrix();
        rysuj();
      };
      const ro = new ResizeObserver(dopasuj); ro.observe(holder); sprzataj.push(() => ro.disconnect());
      dopasuj();

      // ── mysz: klik w sztukę = wybór + przeciąganie; klik w tło = obrót kamery; kółko = zoom ──
      const ray = new THREE.Raycaster(), mysz = new THREE.Vector2();
      let akcja = null;
      const ustawMysz = (e) => {
        const b = renderer.domElement.getBoundingClientRect();
        mysz.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
        ray.setFromCamera(mysz, camera);
      };
      const down = (e) => {
        ustawMysz(e);
        const c = g.current;
        const trafienia = ray.intersectObjects([...c.meshe.values()], false);
        renderer.domElement.setPointerCapture?.(e.pointerId);
        if (trafienia.length) {
          const mesh = trafienia[0].object, pkt = trafienia[0].point;
          setWybrana(mesh.userData.id);
          akcja = { typ: "sztuka", mesh, id: mesh.userData.id, plaszczyzna: new THREE.Plane(new THREE.Vector3(0, 1, 0), -pkt.y),
            dx: mesh.position.x - pkt.x, dz: mesh.position.z - pkt.z, start: mesh.position.clone(), ruch: false, x0: e.clientX, y0: e.clientY, wynik: null };
        } else {
          akcja = { typ: "orbita", x: e.clientX, y: e.clientY, ruch: false };
        }
      };
      const move = (e) => {
        if (!akcja) return;
        const c = g.current;
        if (akcja.typ === "orbita") {
          const dx = e.clientX - akcja.x, dy = e.clientY - akcja.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) akcja.ruch = true;
          c.orbit.theta += dx * 0.008;
          c.orbit.phi = Math.min(Math.PI / 2 - 0.02, Math.max(0.02, c.orbit.phi - dy * 0.008));
          akcja.x = e.clientX; akcja.y = e.clientY;
          rysuj();
          return;
        }
        if (!akcja.ruch && Math.abs(e.clientX - akcja.x0) + Math.abs(e.clientY - akcja.y0) < 5) return;
        akcja.ruch = true;
        ustawMysz(e);
        const pkt = new THREE.Vector3();
        if (!ray.ray.intersectPlane(akcja.plaszczyzna, pkt)) return;
        const { przestrzenie: prz, ulozone: ul, kolejnosc: kol } = danePrzeciagania.current;
        const s = ul.find(u => u.id === akcja.id);
        const pr = s ? prz[s.p] : null, pk = pr?.paka;
        if (!s || !pk) return;
        // Sztukę przesuwamy w obrębie jej przestrzeni; między autem a przyczepą przenosi pole „gdzie" przy pozycji.
        const inne = ul.filter(u => u.id !== s.id && u.p === s.p);
        const surX = (pkt.x + akcja.dx) / S - pr.x0 - s.dl / 2, surY = (pkt.z + akcja.dz) / S + pk.sz / 2 - s.sz / 2;
        const p = przyciagnij(pk, inne, s.id, surX, surY, s.dl, s.sz);
        const r = sprawdzMiejsce(pk, inne, s, p.x, p.y, s.dl, s.sz, { twarde: false, kolejnosc: kol });
        const z = r.z ?? 0;
        akcja.mesh.position.set((pr.x0 + p.x + s.dl / 2) * S, (z + s.wys / 2) * S, (p.y + s.sz / 2 - pk.sz / 2) * S);
        akcja.mesh.material.emissive.set(r.ok ? 0x000000 : 0xb91c1c);
        akcja.mesh.material.opacity = r.ok ? 1 : 0.75;
        akcja.wynik = r.ok ? { x: p.x, y: p.y, z, obr: !!s.obr, p: s.p } : null;
        rysuj();
      };
      const up = () => {
        const a = akcja; akcja = null;
        if (!a) return;
        if (a.typ === "orbita") { if (!a.ruch) setWybrana(null); return; }
        if (!a.ruch) return;
        if (a.wynik) danePrzeciagania.current.zamrozZ({ [a.id]: a.wynik });
        else { a.mesh.position.copy(a.start); a.mesh.material.emissive.set(0x000000); a.mesh.material.opacity = 1; rysuj(); }
      };
      const wheel = (e) => { e.preventDefault(); const c = g.current; c.orbit.r = Math.min(60, Math.max(2, c.orbit.r * (e.deltaY > 0 ? 1.1 : 0.9))); rysuj(); };
      const el = renderer.domElement;
      el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
      el.addEventListener("wheel", wheel, { passive: false });
      sprzataj.push(() => { el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); el.removeEventListener("wheel", wheel); });
      setGotowe3d(v => v + 1);
    }).catch(e => { console.error("Planer: three.js nie załadował się", e); if (zywy) setBlad3d("Nie udało się załadować widoku 3D (brak połączenia z CDN). Lista i wydruk z rzutami działają normalnie."); });
    return () => {
      zywy = false;
      sprzataj.forEach(f => f());
      const c = g.current;
      if (c.renderer) { c.renderer.dispose(); c.renderer.domElement.remove(); }
      g.current = {};
    };
  }, [rysuj]);

  // Kamera dopasowuje się tylko przy zmianie wymiarów (nie przy każdym ruchu sztuki).
  useEffect(() => {
    const c = g.current;
    const zPaka = przestrzenie.filter(pr => pr.paka);
    if (!gotowe3d || !c.orbit || !zPaka.length) return;
    const dl = zPaka.reduce((sum, pr) => sum + pr.paka.dl, 0) + ODSTEP * (zPaka.length - 1);
    const sz = Math.max(...zPaka.map(pr => pr.paka.sz)), wys = Math.max(...zPaka.map(pr => pr.paka.wys));
    c.orbit.cel = { x: 0, y: wys * S * 0.35, z: 0 };
    c.orbit.r = Math.max(dl, sz * 1.6, wys * 1.6) * S * (zPaka.length > 1 ? 1.45 : 1.75);
    rysuj();
  }, [gotowe3d, przestrzenie, rysuj]);

  useEffect(() => {
    const c = g.current;
    if (!gotowe3d || !c.orbit) return;
    c.orbit.theta = WIDOKI[widok].theta; c.orbit.phi = WIDOKI[widok].phi;
    rysuj();
  }, [widok, gotowe3d, rysuj]);

  // Przebudowa sceny po każdej zmianie układu.
  useEffect(() => {
    const c = g.current;
    if (!gotowe3d || !c.THREE) return;
    const { THREE, grupa } = c;
    const zwolnij = (o) => { o.geometry?.dispose?.(); if (o.material) { o.material.map?.dispose?.(); o.material.dispose?.(); } };
    grupa.traverse(zwolnij); grupa.clear(); c.meshe = new Map();
    const napis = (tekst, x, y, z, skala = 0.5, tlo = null) => {
      const cv = document.createElement("canvas");
      const miara = cv.getContext("2d"); miara.font = "bold 56px system-ui, sans-serif";
      cv.width = Math.max(256, Math.ceil(miara.measureText(tekst).width) + 48); cv.height = 96;
      const ctx = cv.getContext("2d");
      if (tlo) { ctx.fillStyle = tlo; ctx.beginPath(); ctx.roundRect(4, 8, cv.width - 8, 80, 18); ctx.fill(); }
      ctx.font = "bold 56px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = tlo ? "#fff" : "#0f172a"; ctx.fillText(tekst, cv.width / 2, 50);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: !!tlo, transparent: true }));
      sp.scale.set(skala * cv.width / 96, skala, 1); sp.position.set(x, y, z); grupa.add(sp);
    };
    for (const pr of przestrzenie) {
      const paka = pr.paka;
      if (!paka) continue;
      const L = paka.dl * S, W = paka.sz * S, H = paka.wys * S, cx = (pr.x0 + paka.dl / 2) * S;
      const podloga = new THREE.Mesh(new THREE.BoxGeometry(L, 0.04, W), new THREE.MeshLambertMaterial({ color: 0xcbd5e1 }));
      podloga.position.set(cx, -0.02, 0); grupa.add(podloga);
      const obrys = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, H, W)), new THREE.LineBasicMaterial({ color: 0x334155 }));
      obrys.position.set(cx, H / 2, 0); grupa.add(obrys);
      const sciana = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      sciana.rotation.y = Math.PI / 2; sciana.position.set(cx - L / 2, H / 2, 0); grupa.add(sciana);
      if (pr.i === 0) {
        // kabina — tylko żeby było widać, gdzie przód
        const kd = Math.min(1.6, L * 0.3);
        const kab = new THREE.Mesh(new THREE.BoxGeometry(kd, H * 0.8, W), new THREE.MeshLambertMaterial({ color: 0x475569 }));
        kab.position.set(cx - L / 2 - kd / 2 - 0.05, H * 0.4, 0); grupa.add(kab);
        napis("KABINA", cx - L / 2 - 0.5, H * 0.8 + 0.25, 0, 0.3);
      } else {
        // dyszel przyczepy
        const dyszel = new THREE.Mesh(new THREE.BoxGeometry(ODSTEP * S, 0.06, 0.12), new THREE.MeshLambertMaterial({ color: 0x475569 }));
        dyszel.position.set((pr.x0 - ODSTEP / 2) * S, 0.2, 0); grupa.add(dyszel);
      }
      // siatka co 1 m
      const pkt = [];
      for (let x = 100; x < paka.dl; x += 100) pkt.push((pr.x0 + x) * S, 0.002, -W / 2, (pr.x0 + x) * S, 0.002, W / 2);
      if (pkt.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(pkt, 3)); grupa.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x94a3b8 }))); }
      napis("DRZWI", cx + L / 2 + 0.3, 0.15, W / 2 + 0.25, 0.26);
      if (zestaw) napis(pr.nazwa, cx, H + 0.32, 0, 0.3, "rgba(51,65,85,0.92)");
    }
    for (const s of ulozone) {
      const pr = przestrzenie[s.p], paka = pr?.paka;
      if (!paka) continue;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.01, s.dl * S - 0.012), Math.max(0.01, s.wys * S - 0.006), Math.max(0.01, s.sz * S - 0.012)),
        new THREE.MeshLambertMaterial({ color: kolor(s), transparent: true, opacity: 1 }));
      m.position.set((pr.x0 + s.x + s.dl / 2) * S, (s.z + s.wys / 2) * S, (s.y + s.sz / 2 - paka.sz / 2) * S);
      m.userData.id = s.id;
      const kr = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0x0f172a }));
      m.add(kr); m.userData.kr = kr;
      grupa.add(m); c.meshe.set(s.id, m);
      napis(String(s.nr) + (wieleRozl ? ` R${s.rozl}` : ""), m.position.x, (s.z + s.wys) * S + 0.14, m.position.z, 0.26, "rgba(15,23,42,0.88)");
    }
    c.podswietl?.();
    rysuj();
  }, [gotowe3d, przestrzenie, zestaw, ulozone, kolor, wieleRozl, rysuj]);

  // Podświetlenie wybranej sztuki NIE przebudowuje sceny — przebudowa w trakcie przeciągania
  // podmieniłaby mesh, który właśnie trzyma mysz.
  useEffect(() => {
    const c = g.current;
    if (!gotowe3d || !c.meshe) return;
    c.podswietl = () => {
      for (const [id, m] of c.meshe) {
        const w = id === c.wybrana;
        m.userData.kr.material.color.set(w ? 0xfacc15 : 0x0f172a);
        m.material.emissive.set(w ? 0x3f3f00 : 0x000000);
      }
    };
    c.wybrana = wybrana;
    c.podswietl();
    rysuj();
  }, [wybrana, gotowe3d, rysuj]);

  // ── Wydruk / PDF (ten sam mechanizm co Ranking: klon pod <body>, reszta display:none) ──
  const drukuj = () => {
    const src = document.getElementById("planer-print");
    if (!src) return;
    let obraz = "";
    const c = g.current;
    if (c.renderer) {
      const zap = { ...c.orbit };
      c.orbit.theta = WIDOKI["3d"].theta; c.orbit.phi = WIDOKI["3d"].phi;
      const zaznaczona = c.wybrana; c.wybrana = null; c.podswietl?.(); // bez żółtej ramki zaznaczenia na wydruku
      rysuj();
      try { obraz = c.renderer.domElement.toDataURL("image/png"); } catch {}
      c.orbit.theta = zap.theta; c.orbit.phi = zap.phi; c.wybrana = zaznaczona; c.podswietl?.(); rysuj();
    }
    const holder = document.createElement("div");
    holder.id = "planer-portal";
    holder.innerHTML = src.innerHTML;
    const img = holder.querySelector("[data-planer-3d]");
    if (img) { if (obraz) img.src = obraz; else img.remove(); }
    document.body.appendChild(holder);
    document.body.classList.add("planer-printing");
    const sprzatnij = () => { document.body.classList.remove("planer-printing"); holder.remove(); window.removeEventListener("afterprint", sprzatnij); };
    window.addEventListener("afterprint", sprzatnij);
    // Obraz 3D i logo muszą się zdekodować przed otwarciem okna druku, inaczej PDF ma puste ramki.
    const obrazy = [...holder.querySelectorAll("img")];
    // NIE `img.decode()`: w ukrytym poddrzewie (portal ma display:none do chwili druku) potrafi
    // nie rozstrzygnąć się nigdy i okno druku nie otwierało się wcale. Czekamy na `load`
    // z limitem czasu — w najgorszym razie PDF wyjdzie bez obrazka, ale wyjdzie.
    const gotowy = (i) => (i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); }));
    const limit = new Promise(r => setTimeout(r, 1500));
    Promise.race([Promise.all(obrazy.map(gotowy)), limit]).then(() => {
      try { window.print(); } finally { setTimeout(sprzatnij, 500); }
    });
  };

  const wybranaSzt = ulozone.find(s => s.id === wybrana) || null;
  const kolejnoscZaladunku = useMemo(() => [...ulozone].sort((a, b) => a.p - b.p || a.x - b.x || a.z - b.z || a.y - b.y), [ulozone]);
  const zmienPake = (i, k, v) => setPakiTxt(l => l.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const brakWymiarow = auto ? auto.przestrzenie.filter(pr => !pr.wym) : [];
  const dzis = new Date().toLocaleDateString("pl-PL");
  const pozycjaPo = (id) => pozycje.find(p => p.id === id);

  return (
    <div>
      <style>{`
        #planer-portal { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 9mm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body.planer-printing > *:not(#planer-portal) { display: none !important; }
          body.planer-printing #planer-portal { display: block !important; }
          #planer-portal, #planer-portal * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .planer-strona { page-break-after: always; break-after: page; }
          .planer-strona:last-child { page-break-after: auto; break-after: auto; }
        }
        .planer-doc { font-family: 'DM Sans', system-ui, sans-serif; color: #0f172a; font-size: 11px; }
        .planer-doc table { border-collapse: collapse; width: 100%; }
        .planer-doc th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; color: #475569; border-bottom: 1.5px solid #94a3b8; padding: 4px 6px; }
        .planer-doc td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-variant-numeric: tabular-nums; }
        .planer-doc h1 { font-size: 20px; font-weight: 700; margin: 0; }
        .planer-doc h2 { font-size: 12px; font-weight: 700; margin: 0 0 4px; text-transform: uppercase; letter-spacing: .4px; color: #334155; }
      `}</style>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Planer załadunku 3D</h2>
          <p className="text-sm text-gray-600">Wybierz auto, dodaj ładunek — program rozłoży go na pace. Sztuki możesz przesuwać myszką.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={wyczysc} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">Nowy plan</button>
          <button onClick={drukuj} disabled={!jestPaka || !ulozone.length}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#111827" }}>
            Pobierz PDF
          </button>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {/* ═══ LEWA KOLUMNA: kroki ═══ */}
        <div className="space-y-4" style={{ minWidth: 0 }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">1 · Auto</div>
            <select value={autoKey} onChange={e => wybierzAuto(e.target.value)} className={inp} aria-label="Auto">
              <option value="">Inne auto — wymiary wpisane ręcznie</option>
              {auta.map(a => <option key={a.key} value={a.key}>{a.etykieta}{a.przestrzenie.every(pr => pr.wym) ? "" : " — brak wymiarów w kartotece"}</option>)}
            </select>
            {brakWymiarow.length > 0 && (
              <p className="text-xs mt-2" style={{ color: "#b45309" }}>
                Brak wymiarów paki w kartotece: {brakWymiarow.map(pr => pr.nazwa + (pr.zrodlo ? ` (wpisano: „${pr.zrodlo}")` : "")).join(", ")}. Wpisz je poniżej na potrzeby tego planu, a na stałe — w zakładce Pojazdy.
              </p>
            )}
            {przestrzenie.map(pr => (
              <div key={pr.i} className="mt-3">
                {zestaw && <div className="text-xs font-semibold text-gray-800 mb-1">{pr.nazwa}</div>}
                <div className="grid grid-cols-4 gap-2">
                  {[["dl", "Długość (cm)"], ["sz", "Szerokość (cm)"], ["wys", "Wysokość (cm)"], ["maxWaga", "Ładowność (kg)"]].map(([k, l]) => (
                    <label key={k}><span className={lbl}>{l}</span>
                      <input className={inp} inputMode="decimal" value={pakiTxt[pr.i]?.[k] ?? ""} onChange={e => zmienPake(pr.i, k, e.target.value)} aria-label={`${l} — ${pr.nazwa}`} /></label>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={() => setTechOtwarte(o => !o)} className="text-xs font-medium text-gray-700 underline mt-3">
              {techOtwarte ? "Ukryj dane osi" : "Dane do nacisków na osie"}{osie.brak ? " (nieuzupełnione)" : ""}
            </button>
            {techOtwarte && (
              <div className="mt-3 p-3 rounded-xl bg-gray-50">
                <p className="text-xs text-gray-600 mb-2">Z dowodu rejestracyjnego i ważenia pustego auta. Bez kompletu danych nacisków nie liczymy.</p>
                <div className="grid grid-cols-2 gap-2">
                  {TECH_POLA.map(([k, l]) => (
                    <label key={k}><span className={lbl}>{l}</span>
                      <input className={inp} inputMode="decimal" value={tech[k] ?? ""} onChange={e => { setTech(t => ({ ...t, [k]: e.target.value })); setTechZapis(""); }} /></label>
                  ))}
                </div>
                {auto?.vehicleId && canEdit ? (
                  <button onClick={zapiszTech} className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "#111827" }}>
                    Zapisz dla {auto.etykieta}{techZapis === "ok" ? " ✓" : ""}
                  </button>
                ) : <p className="text-xs text-gray-600 mt-2">Dane obowiązują tylko w tym planie (zapis na stałe: wybierz pojazd z kartoteki).</p>}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">2 · Ładunek</div>
              <ZlecenieUploadBtn key={uploadKey} frachtId="planer-zaladunku" label="Wczytaj ze zlecenia (PDF)" onUploaded={poWgraniuZlecenia} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {TYPY_PALET.map(t => (
                <button key={t.nazwa} onClick={() => setPozycje(l => [...l, pustaPozycja({ nazwa: t.nazwa, dl: t.dl, sz: t.sz })])}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">+ {t.nazwa} {t.dl}×{t.sz}</button>
              ))}
              <button onClick={() => setPozycje(l => [...l, pustaPozycja()])} className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">+ Inny wymiar</button>
            </div>

            {pozycje.length === 0 && <p className="text-sm text-gray-600 py-3">Brak ładunku. Dodaj paletę przyciskiem, wklej wymiary albo wczytaj zlecenie.</p>}
            <div className="space-y-2">
              {pozycje.map((p, i) => {
                const brak = braki.some(b => b.pozycjaId === p.id);
                return (
                  <div key={p.id} className="rounded-xl border p-2.5" style={{ borderColor: brak ? "#f59e0b" : "#e5e7eb" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: kolorWg === "rozl" ? KOLORY_ROZL[p.rozl] || "#475569" : PALETA[i % PALETA.length] }}>{i + 1}</span>
                      <input className={inp} placeholder="nazwa (opcjonalnie)" value={p.nazwa} onChange={e => zmien(p.id, "nazwa", e.target.value)} aria-label={`Nazwa pozycji ${i + 1}`} />
                      <button onClick={() => usun(p.id)} className="px-2 py-1 text-sm text-gray-600 hover:text-red-700" aria-label={`Usuń pozycję ${i + 1}`}>✕</button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[["dl", "dł. cm"], ["sz", "szer. cm"], ["wys", "wys. cm"], ["szt", "sztuk"], ["waga", "kg / szt."]].map(([k, l]) => (
                        <label key={k}><span className="block text-xs text-gray-600 mb-0.5">{l}</span>
                          <input className={inp} inputMode="decimal" value={p[k] ?? ""} onChange={e => zmien(p.id, k, e.target.value)}
                            style={(k === "dl" || k === "sz" || k === "wys") && !(Number(p[k]) > 0) ? { borderColor: "#f59e0b" } : undefined} /></label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-700">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!p.pietrowanie} onChange={e => zmien(p.id, "pietrowanie", e.target.checked)} /> można piętrować</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={p.obrot !== false} onChange={e => zmien(p.id, "obrot", e.target.checked)} /> można obracać</label>
                      <label className="flex items-center gap-1.5">rozładunek
                        <select value={p.rozl} onChange={e => zmien(p.id, "rozl", Number(e.target.value))} className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-xs">
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>R{n}</option>)}
                        </select></label>
                      {zestaw && (
                        <label className="flex items-center gap-1.5">gdzie
                          <select value={p.gdzie ?? ""} onChange={e => { zmien(p.id, "gdzie", e.target.value); setReczne({}); }} className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-xs" aria-label={`Gdzie załadować pozycję ${i + 1}`}>
                            <option value="">automat</option>
                            {przestrzenie.map(pr => <option key={pr.i} value={String(pr.i)}>{pr.nazwa}</option>)}
                          </select></label>
                      )}
                    </div>
                    {(p.uwagi || []).length > 0 && <div className="text-xs mt-1.5" style={{ color: "#b45309" }}>ⓘ {(p.uwagi || []).join(" · ")}</div>}
                  </div>
                );
              })}
            </div>

            <div className="mt-3">
              <label><span className={lbl}>Wklej wymiary (jedna pozycja w linii, np. „2× 120x80x160")</span>
                <textarea rows={2} className={inp} value={wklejka} onChange={e => setWklejka(e.target.value)} /></label>
              <button onClick={() => { const n = dodajZTekstu(wklejka); if (n) setWklejka(""); else showToast("⚠️ Nie rozpoznano wymiarów w tekście"); }}
                disabled={!wklejka.trim()} className="mt-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-800 disabled:opacity-40">Dodaj z tekstu</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">3 · Układanie i opis planu</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {[["podloga", "Najpierw podłoga"], ["zwarto", "Jak najkrócej (piętruj od razu)"]].map(([k, l]) => (
                <button key={k} onClick={() => { setTryb(k); setReczne({}); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={tryb === k ? { background: "#111827", color: "#fff", borderColor: "#111827" } : { borderColor: "#e5e7eb", color: "#374151" }}>{l}</button>
              ))}
            </div>
            {zestaw && (
              <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-gray-700">
                Automat ładuje najpierw:
                {przestrzenie.map(pr => (
                  <button key={pr.i} onClick={() => { setNajpierw(pr.i); setReczne({}); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                    style={najpierw === pr.i ? { background: "#111827", color: "#fff", borderColor: "#111827" } : { borderColor: "#e5e7eb", color: "#374151" }}>{pr.nazwa}</button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-800 mb-3">
              <input type="checkbox" checked={kolejnosc} onChange={e => { setKolejnosc(e.target.checked); setReczne({}); }} />
              Pilnuj kolejności rozładunku (R1 przy drzwiach)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className={lbl}>Nr zlecenia</span><input className={inp} value={naglowek.nr} onChange={e => setNaglowek(n => ({ ...n, nr: e.target.value }))} /></label>
              <label><span className={lbl}>Klient</span><input className={inp} value={naglowek.klient} onChange={e => setNaglowek(n => ({ ...n, klient: e.target.value }))} /></label>
            </div>
            <label className="block mt-2"><span className={lbl}>Uwagi na wydruku (np. dla kierowcy)</span>
              <textarea rows={2} className={inp} value={naglowek.uwagi} onChange={e => setNaglowek(n => ({ ...n, uwagi: e.target.value }))} /></label>
          </div>
        </div>

        {/* ═══ PRAWA KOLUMNA: 3D + wynik ═══ */}
        <div className="space-y-4" style={{ minWidth: 0 }}>
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {Object.entries(WIDOKI).map(([k, w]) => (
                <button key={k} onClick={() => setWidok(k)} className="px-2.5 py-1 rounded-lg text-xs font-semibold border"
                  style={widok === k ? { background: "#111827", color: "#fff", borderColor: "#111827" } : { borderColor: "#e5e7eb", color: "#374151" }}>{w.etykieta}</button>
              ))}
              <span className="flex-1" />
              <label className="flex items-center gap-1.5 text-xs text-gray-700">Kolor wg
                <select value={kolorWg} onChange={e => setKolorWg(e.target.value)} className="px-1.5 py-0.5 rounded border border-gray-200 bg-white text-xs">
                  <option value="pozycja">pozycji</option><option value="rozl">rozładunku</option>
                </select></label>
            </div>
            <div ref={holderRef} className="rounded-xl overflow-hidden" style={{ height: 440, background: "#f1f5f9", position: "relative" }}>
              {!jestPaka && <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600 p-6 text-center" style={{ zIndex: 1 }}>Wybierz auto albo wpisz wymiary paki.</div>}
              {blad3d && <div className="absolute inset-0 flex items-center justify-center text-sm p-6 text-center" style={{ zIndex: 1, color: "#b45309" }}>{blad3d}</div>}
            </div>
            <p className="text-xs text-gray-600 mt-2">Przeciągnij tło — obrót widoku · kółko — zbliżenie · przeciągnij sztukę — przesunięcie (przyciąga do ścian i sąsiadów).</p>
            {wybranaSzt && (
              <div className="flex flex-wrap items-center gap-3 mt-2 p-2 rounded-lg bg-gray-50 text-xs text-gray-800">
                <b>Poz. {wybranaSzt.nr}, szt. {wybranaSzt.lp}{zestaw ? ` · ${przestrzenie[wybranaSzt.p]?.nazwa}` : ""}</b>
                <span>{wybranaSzt.dl}×{wybranaSzt.sz}×{wybranaSzt.wys} cm</span>
                <span>od przedniej ściany {fmt(wybranaSzt.x)} cm · od prawej burty {fmt(wybranaSzt.y)} cm · {wybranaSzt.z > 0 ? `na wys. ${fmt(wybranaSzt.z)} cm` : "na podłodze"}</span>
                <button onClick={obrocWybrana} className="px-2 py-1 rounded-md border border-gray-300 font-semibold">Obróć 90°</button>
              </div>
            )}
            {saRecze && (
              <div className="flex flex-wrap items-center gap-3 mt-2 p-2 rounded-lg text-xs" style={{ background: "#fef3c7", color: "#78350f" }}>
                Układ poprawiony ręcznie — automat dokłada już tylko nowe sztuki.
                <button onClick={() => setReczne({})} className="px-2 py-1 rounded-md font-semibold border" style={{ borderColor: "#b45309" }}>Ułóż od nowa automatem</button>
              </div>
            )}
          </div>

          {jestPaka && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Wynik</div>
              {(nieulozone.length > 0 || braki.length > 0) && (
                <div className="p-3 rounded-xl mb-3 text-sm" style={{ background: "#fee2e2", color: "#7f1d1d" }}>
                  {nieulozone.length > 0 && <div><b>Nie mieści się: {nieulozone.length} szt.</b> — {[...new Set(nieulozone.map(s => `poz. ${s.nr} (${s.powod})`))].join(", ")}</div>}
                  {braki.length > 0 && <div>Pozycje bez kompletu wymiarów (pominięte): {braki.map(b => b.nr).join(", ")}</div>}
                </div>
              )}
              {nieulozone.length === 0 && braki.length === 0 && ulozone.length > 0 && (
                <div className="p-3 rounded-xl mb-3 text-sm font-semibold" style={{ background: "#dcfce7", color: "#14532d" }}>
                  Cały ładunek mieści się {zestaw ? "na zestawie" : "na pace"} ({ulozone.length} szt.{zestaw ? `: ${przestrzenie.map(pr => `${pr.nazwa} ${ulozone.filter(s => s.p === pr.i).length}`).join(", ")}` : ""}).
                </div>
              )}
              {wynik.zmienionoTryb && <p className="text-xs mb-3" style={{ color: "#b45309" }}>Na samej podłodze ładunek się nie mieścił — program spiętrował go ciaśniej.</p>}
              {przestrzenie.map(pr => sumy[pr.i] && (
                <div key={pr.i} className={zestaw ? "mb-4" : ""}>
                  {zestaw && <div className="text-sm font-bold text-gray-900 mb-2">{pr.nazwa}</div>}
                  <KafleSumy suma={sumy[pr.i]} />
                </div>
              ))}
              {ulozone.some(s => !s.waga) && <p className="text-xs mt-2" style={{ color: "#b45309" }}>{ulozone.filter(s => !s.waga).length} szt. bez wagi — suma kg i naciski na osie są zaniżone{zestaw ? ", a automat nie pilnuje dla nich ładowności" : ""}.</p>}

              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Naciski na osie{zestaw ? ` — ${przestrzenie[0].nazwa}` : ""}</div>
                {osie.brak ? (
                  <p className="text-sm text-gray-600">Nie liczone — brakuje danych technicznych auta ({osie.brakuje.length} z 6 pól). Uzupełnij „Dane do nacisków na osie" w kroku 1.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Kafel t="Oś przednia" w={`${fmt(osie.przod)} kg`} zle={osie.przodPrzekroczony} d={`${fmt(osie.przodPct)}% z ${fmt(osie.dopPrzod)} kg${osie.przodOdciazony ? " · ładunek odciąża przód" : ""}`} />
                    <Kafel t="Oś tylna" w={`${fmt(osie.tyl)} kg`} zle={osie.tylPrzekroczony} d={`${fmt(osie.tylPct)}% z ${fmt(osie.dopTyl)} kg`} />
                  </div>
                )}
                {zestaw && !osie.brak && <p className="text-xs mt-2" style={{ color: "#b45309" }}>Bez nacisku dyszla przyczepy na hak — realny nacisk na oś tylną jest wyższy.</p>}
              </div>

              {ostrzezenia.length > 0 && (
                <div className="mt-3 p-3 rounded-xl text-xs" style={{ background: "#fef3c7", color: "#78350f" }}>
                  <b>Uwagi do układu:</b>
                  <ul className="list-disc ml-4 mt-1">{[...new Set(ostrzezenia.map(o => `poz. ${o.nr}, szt. ${o.lp}: ${o.tekst}`))].slice(0, 8).map(x => <li key={x}>{x}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ DOKUMENT DO WYDRUKU (na ekranie ukryty; klonowany do portalu) ═══ */}
      <div id="planer-print" style={{ display: "none" }}>
        {jestPaka && (
          <div className="planer-doc">
            <div className="planer-strona">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0f172a", paddingBottom: 6, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src="/app-fleetstat.png" alt="FleetStat" style={{ height: 34 }} />
                  <div><h1>Plan załadunku</h1>
                    <div style={{ color: "#475569" }}>
                      {auto ? auto.etykieta : "Auto spoza kartoteki"}
                      {przestrzenie.filter(pr => pr.paka).map(pr => ` · ${zestaw ? pr.nazwa + ": " : "paka "}${pr.paka.dl}×${pr.paka.sz}×${pr.paka.wys} cm${pr.maxWaga ? `, ładowność ${fmt(pr.maxWaga)} kg` : ""}`).join("")}
                    </div></div>
                </div>
                <div style={{ textAlign: "right", color: "#334155" }}>
                  {naglowek.nr && <div><b>Zlecenie:</b> {naglowek.nr}</div>}
                  {naglowek.klient && <div><b>Klient:</b> {naglowek.klient}</div>}
                  <div>{dzis}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 12 }}>
                <div>
                  <h2>Widok 3D</h2>
                  <img data-planer-3d alt="" style={{ width: "100%", height: "92mm", objectFit: "contain", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, display: "block" }} />
                </div>
                <div>
                  {!zestaw && przestrzenie[0].paka && <RzutyPrzestrzeni pr={przestrzenie[0]} ulozone={ulozone} kolor={kolor} />}
                  {zestaw && przestrzenie.map(pr => sumy[pr.i] && <TabelaSumy key={pr.i} tytul={`Podsumowanie — ${pr.nazwa}`} suma={sumy[pr.i]} />)}
                  {zestaw && <OsieWiersz osie={osie} zestaw />}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: zestaw ? "1fr" : "1.25fr 1fr", gap: 12, marginTop: 8 }}>
                <div>
                  <h2>Ładunek</h2>
                  <table>
                    <thead><tr><th>Poz.</th><th>Nazwa</th><th>Wymiary cm</th><th>Szt.</th><th>kg/szt.</th><th>Piętr.</th><th>Rozł.</th>{zestaw && <th>Gdzie</th>}</tr></thead>
                    <tbody>
                      {pozycje.map((p, i) => (
                        <tr key={p.id}>
                          <td><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, marginRight: 4, background: kolorWg === "rozl" ? KOLORY_ROZL[p.rozl] : PALETA[i % PALETA.length] }} />{i + 1}</td>
                          <td>{p.nazwa || "—"}</td><td>{p.dl || "?"}×{p.sz || "?"}×{p.wys || "?"}</td><td>{p.szt}</td>
                          <td>{p.waga || "—"}</td><td>{p.pietrowanie ? "tak" : "nie"}</td><td>R{p.rozl}</td>
                          {zestaw && <td>{przestrzenie.map(pr => { const n = ulozone.filter(s => s.pozycjaId === p.id && s.p === pr.i).length; return n ? `${pr.nazwa}: ${n} szt.` : null; }).filter(Boolean).join(" · ") || "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {nieulozone.length > 0 && <div style={{ marginTop: 4, fontWeight: 700, color: "#991b1b" }}>NIE MIEŚCI SIĘ: {nieulozone.length} szt. — {[...new Set(nieulozone.map(s => `poz. ${s.nr} (${s.powod})`))].join(", ")}</div>}
                  {zestaw && naglowek.uwagi && <div style={{ marginTop: 6 }}><b>Uwagi:</b> {naglowek.uwagi}</div>}
                </div>
                {!zestaw && (
                  <div>
                    {sumy[0] && <TabelaSumy tytul="Podsumowanie" suma={sumy[0]} />}
                    <OsieWiersz osie={osie} />
                    {naglowek.uwagi && <div style={{ marginTop: 6 }}><b>Uwagi:</b> {naglowek.uwagi}</div>}
                  </div>
                )}
              </div>
            </div>
            {zestaw && (
              <div className="planer-strona">
                <h1 style={{ fontSize: 15, marginBottom: 6 }}>Rozmieszczenie — rzuty</h1>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {przestrzenie.filter(pr => pr.paka).map(pr => <div key={pr.i}><RzutyPrzestrzeni pr={pr} ulozone={ulozone} kolor={kolor} tytul={pr.nazwa} /></div>)}
                </div>
              </div>
            )}
            <div className="planer-strona">
              <h1 style={{ fontSize: 15, marginBottom: 6 }}>Kolejność załadunku — od przedniej ściany do drzwi</h1>
              <table>
                <thead><tr><th>Krok</th>{zestaw && <th>Gdzie</th>}<th>Poz.</th><th>Nazwa</th><th>Wymiary cm (dł.×szer.×wys.)</th><th>Od przedniej ściany</th><th>Od prawej burty</th><th>Poziom</th><th>Rozł.</th></tr></thead>
                <tbody>
                  {kolejnoscZaladunku.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>{zestaw && <td>{przestrzenie[s.p]?.nazwa}</td>}<td>{s.nr}</td><td>{pozycjaPo(s.pozycjaId)?.nazwa || "—"}</td>
                      <td>{s.dl}×{s.sz}×{s.wys}{s.obr ? " (obrócona)" : ""}</td>
                      <td>{fmt(s.x)} cm</td><td>{fmt(s.y)} cm</td><td>{s.z > 0 ? `na wys. ${fmt(s.z)} cm` : "podłoga"}</td><td>R{s.rozl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ color: "#475569", fontSize: 9, marginTop: 6 }}>
                „Prawa burta" = prawa strona auta patrząc w kierunku jazdy (na rzucie z góry: górna krawędź). Plan jest propozycją rozmieszczenia — o zamocowaniu ładunku i rozkładzie mas decyduje kierowca.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RzutyPrzestrzeni({ pr, ulozone, kolor, tytul = "" }) {
  const lista = ulozone.filter(s => s.p === pr.i);
  return (
    <>
      <h2>{tytul ? `${tytul} — z` : "Z"} góry (przód po lewej, drzwi po prawej)</h2>
      <Rzut paka={pr.paka} ulozone={lista} kolor={kolor} os="gora" />
      <h2 style={{ marginTop: 8 }}>{tytul ? `${tytul} — z` : "Z"} boku</h2>
      <Rzut paka={pr.paka} ulozone={lista} kolor={kolor} os="bok" />
      <div style={{ color: "#475569", fontSize: 9, marginTop: 2 }}>Liczba = numer pozycji z tabeli · ↑ = sztuka stoi na innej</div>
    </>
  );
}

const wagaTxt = (suma) => (suma.sztuk > 0 && suma.bezWagi === suma.sztuk ? "nie podano" : `${fmt(suma.waga)} kg`);

function TabelaSumy({ tytul, suma }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <h2>{tytul}</h2>
      <table><tbody>
        <tr><td>Ułożono</td><td><b>{suma.sztuk} szt.</b></td></tr>
        <tr><td>Zajęta długość paki</td><td><b>{fmt(suma.dlZajeta)} cm</b> · wolne {fmt(suma.dlWolna)} cm</td></tr>
        <tr><td>Podłoga / objętość</td><td>{fmt(suma.podlogaPct)}% / {fmt(suma.objPct)}%</td></tr>
        <tr><td>Wolne miejsca paletowe</td><td>{suma.wolneEur} (europalety 120×80 na podłogę)</td></tr>
        <tr><td>Waga ładunku</td><td><b>{wagaTxt(suma)}</b>{suma.maxWaga ? ` z ${fmt(suma.maxWaga)} kg` : ""}{suma.przeladowane ? " — PRZEKROCZONA" : ""}{suma.bezWagi && suma.bezWagi !== suma.sztuk ? ` (${suma.bezWagi} szt. bez wagi)` : ""}</td></tr>
      </tbody></table>
    </div>
  );
}

function OsieWiersz({ osie, zestaw = false }) {
  if (osie.brak) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <b>Osie pojazdu (przód / tył):</b> {fmt(osie.przod)} / {fmt(osie.tyl)} kg, dopuszczalne {fmt(osie.dopPrzod)} / {fmt(osie.dopTyl)} kg
      {osie.przodPrzekroczony || osie.tylPrzekroczony ? " — PRZEKROCZONE" : ""}{zestaw ? " (bez nacisku dyszla przyczepy)" : ""}
    </div>
  );
}

function KafleSumy({ suma }) {
  const brakWag = suma.sztuk > 0 && suma.bezWagi === suma.sztuk;
  return (
    <div className="grid grid-cols-2 gap-3 text-sm" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
      <Kafel t="Zajęta długość paki" w={`${fmt(suma.dlZajeta)} cm`} d={`wolne ${fmt(suma.dlWolna)} cm`} />
      <Kafel t="Podłoga" w={`${fmt(suma.podlogaPct)}%`} d={`wolne ${fmt(suma.wolnaPodlogaM2, 1)} m²`} />
      <Kafel t="Objętość" w={`${fmt(suma.objPct)}%`} d={`wolne ${fmt(suma.wolnaObjM3, 1)} m³`} />
      <Kafel t="Wolne miejsca paletowe" w={String(suma.wolneEur)} d="europalety 120×80 na wolną podłogę" />
      <Kafel t="Waga ładunku" w={brakWag ? "brak wag" : `${fmt(suma.waga)} kg`} zle={suma.przeladowane}
        d={brakWag ? "wpisz kg / szt. przy pozycjach" : suma.maxWaga ? (suma.przeladowane ? `PRZEKROCZONA o ${fmt(-suma.zapasWagi)} kg` : `zapas ${fmt(suma.zapasWagi)} kg z ${fmt(suma.maxWaga)}`) : "brak ładowności w kartotece"} />
      <Kafel t="Piętrowane" w={`${suma.pietrowanych} szt.`} d={`z ${suma.sztuk} ułożonych`} />
    </div>
  );
}

function Kafel({ t, w, d, zle = false }) {
  return (
    <div className="p-3 rounded-xl" style={{ background: zle ? "#fee2e2" : "#f9fafb" }}>
      <div className="text-xs text-gray-600">{t}</div>
      <div className="text-lg font-bold" style={{ color: zle ? "#991b1b" : "#111827" }}>{w}</div>
      <div className="text-xs" style={{ color: zle ? "#991b1b" : "#4b5563" }}>{d}</div>
    </div>
  );
}
