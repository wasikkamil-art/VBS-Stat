// planerZaladunku — silnik planera załadunku 3D (czysta logika, bez Reacta i bez three.js).
//
// UKŁAD WSPÓŁRZĘDNYCH (centymetry):
//   x — wzdłuż paki, 0 = ściana przednia (kabina), paka.dl = drzwi tylne
//   y — w poprzek paki, 0 = PRAWA burta (patrząc w kierunku jazdy)
//   z — w górę, 0 = podłoga
//
// ZAŁOŻENIA, które widać w wynikach — opisane też w legendzie w UI:
//   • ładujemy i rozładowujemy OD TYŁU, więc towar na pierwszy rozładunek (R1) stoi przy drzwiach;
//   • sztuka stoi na podłodze albo CAŁĄ podstawą na innych sztukach (bez nawisów);
//   • na sztuce wolno stawiać tylko wtedy, gdy ma znacznik „można piętrować";
//   • cięższe nie staje na lżejszym (gdy obie wagi są znane);
//   • sztuki obracamy wyłącznie wokół osi pionowej (paleta nie leży na boku).
// Układanie to heurystyka — daje dobry, powtarzalny układ, nie dowód, że lepszego nie ma.

const EPS = 0.01;

/** „607x243x245" / „6,07 x 2,43 x 2,45 m" → { dl, sz, wys } w cm albo null. */
export function parsujWymiaryPaki(tekst) {
  const liczby = String(tekst || "").replace(/,/g, ".").match(/\d+(?:\.\d+)?/g);
  if (!liczby || liczby.length < 3) return null;
  let [dl, sz, wys] = liczby.slice(0, 3).map(Number);
  if (!(dl > 0 && sz > 0 && wys > 0)) return null;
  // Ktoś wpisał metry (6.07x2.43x2.45) — w kartotece pole jest opisane jako cm, ale bywa różnie.
  if (dl < 30 && sz < 30 && wys < 30) { dl *= 100; sz *= 100; wys *= 100; }
  return { dl: Math.round(dl), sz: Math.round(sz), wys: Math.round(wys) };
}

const LICZBA = "(\\d+(?:[.,]\\d+)?)";
const SEP = "(\\s*(?:cm|mm|m)?\\s*[x×*]\\s*[a-z]{0,2}\\s*)";
// Łańcuch 2–4 liczb rozdzielonych „x": wymiary, ewentualnie poprzedzone liczbą sztuk („2× 240x120x240").
const RE_LANCUCH = new RegExp(`${LICZBA}${SEP}${LICZBA}(?:${SEP}${LICZBA})?(?:${SEP}${LICZBA})?`, "i");

/** Rozdziela łańcuch liczb na liczbę sztuk i wymiary. Zwraca { szt|null, wym:[...] }. */
function rozdzielLancuch(m) {
  const num = (v) => Number(String(v).replace(",", "."));
  const liczby = [m[1], m[3], m[5], m[7]].filter(v => v != null);
  const calk = /^\d+$/.test(liczby[0]);
  if (liczby.length === 4) return { szt: calk ? num(liczby[0]) : null, wym: liczby.slice(calk ? 1 : 0, calk ? 4 : 3).map(num) };
  if (liczby.length === 3 && calk) {
    const [a, b, c] = liczby.map(num);
    // „3 x 120x80" — pierwsza liczba to sztuki, gdy jest mała, a reszta wygląda na wymiary palety
    // i albo jest jednocyfrowa, albo separator po niej jest zapisany inaczej niż następny.
    const inneSep = m[2].trim() !== m[4].trim() || m[2] !== m[4];
    if (b >= 40 && c >= 40 && (a <= 9 || (a <= 33 && inneSep))) return { szt: a, wym: [b, c] };
  }
  return { szt: null, wym: liczby.slice(0, 3).map(num) };
}

/**
 * Tekst pola `towarPalety` (jedna pozycja na linię, np. „2× 240x120x240") → lista pozycji.
 * Niczego nie zmyśla: brakujący wymiar zostaje `null` i pozycja czeka na uzupełnienie.
 * Każde przyjęte założenie (jednostka, podział wagi) ląduje w `uwagi` pozycji.
 */
export function parsujPalety(tekst, { ilosc, wagaKg } = {}) {
  const linie = String(tekst || "").split(/\n|;|,\s+(?=\d+\s*[x×])/).map(s => s.trim()).filter(Boolean);
  const pozycje = [];
  for (const linia of linie) {
    const m = linia.match(RE_LANCUCH);
    if (!m) continue;
    const uwagi = [];
    const roz = rozdzielLancuch(m);
    let wym = roz.wym;
    const max = Math.max(...wym);
    if (max <= 15) { wym = wym.map(v => v * 100); uwagi.push("wymiary odczytane jako metry"); }
    else if (max >= 1000 && Math.min(...wym) >= 300) { wym = wym.map(v => v / 10); uwagi.push("wymiary odczytane jako milimetry"); }
    wym = wym.map(v => Math.round(v));
    const reszta = linia.replace(m[0], " ");
    const mSzt = reszta.match(/(\d+)\s*(?:[x×]|szt|pal|pcs|pieces|colli|kart|ep)/i) || reszta.match(/^\s*(\d+)\s*[.:)-]?\s*$/) || reszta.match(/^\s*(\d+)\s/);
    const szt = Math.max(1, Math.min(200, Math.round(roz.szt ?? (mSzt ? Number(mSzt[1]) : 1))));
    if (wym.length < 3) {
      // Wysokość bywa podana osobno: „120x80 H=160", „120x80 wys. 160".
      const mH = reszta.match(/(?:\bh|wys\w*\.?|height)\s*[=:]?\s*(\d+(?:[.,]\d+)?)/i);
      if (mH) wym.push(Math.round(Number(mH[1].replace(",", ".")) * (max <= 15 ? 100 : 1)));
      else uwagi.push("brak wysokości w zleceniu");
    }
    pozycje.push({ nazwa: "", dl: wym[0], sz: wym[1], wys: wym.length >= 3 ? wym[2] : null, szt, waga: null, uwagi });
  }
  const n = Number(ilosc);
  if (!pozycje.length && n > 0) {
    pozycje.push({ nazwa: "", dl: null, sz: null, wys: null, szt: Math.min(200, Math.round(n)), waga: null,
      uwagi: ["zlecenie podaje tylko liczbę sztuk — wpisz wymiary"] });
  }
  const kg = Number(String(wagaKg ?? "").replace(",", "."));
  const razem = pozycje.reduce((s, p) => s + p.szt, 0);
  if (kg > 0 && razem > 0) {
    const naSzt = Math.round((kg / razem) * 10) / 10;
    for (const p of pozycje) { p.waga = naSzt; p.uwagi.push(`waga ${kg} kg podzielona równo na ${razem} szt.`); }
  }
  return pozycje;
}

/** Pozycje (linie z liczbą sztuk) → pojedyncze sztuki do ułożenia. Niekompletne trafiają do `braki`. */
export function rozwinPozycje(pozycje) {
  const sztuki = [], braki = [];
  (pozycje || []).forEach((p, idx) => {
    const dl = Number(p.dl), sz = Number(p.sz), wys = Number(p.wys);
    const szt = Math.max(0, Math.min(200, Math.round(Number(p.szt) || 0)));
    if (!szt) return;
    if (!(dl > 0 && sz > 0 && wys > 0)) { braki.push({ pozycjaId: p.id, nr: idx + 1, powod: "brak wymiarów" }); return; }
    const waga = Number(p.waga) > 0 ? Number(p.waga) : null;
    for (let i = 0; i < szt; i++) {
      sztuki.push({
        id: `${p.id}#${i + 1}`, pozycjaId: p.id, nr: idx + 1, lp: i + 1,
        dl, sz, wys, waga,
        pietrowanie: !!p.pietrowanie, obrot: p.obrot !== false,
        rozl: Math.max(1, Math.min(5, Number(p.rozl) || 1)),
        // Zestaw (auto + przyczepa): wskazana przestrzeń albo null = decyduje automat.
        gdzie: p.gdzie === "" || p.gdzie == null ? null : Number(p.gdzie),
      });
    }
  });
  return { sztuki, braki };
}

const nachodzi = (a0, a1, b0, b1) => a0 < b1 - EPS && b0 < a1 - EPS;
const polePrzeciecia = (x, y, l, w, o) =>
  Math.max(0, Math.min(x + l, o.x + o.dl) - Math.max(x, o.x)) * Math.max(0, Math.min(y + w, o.y + o.sz) - Math.max(y, o.y));

/**
 * Czy sztuka `s` o rzucie l×w może stanąć w punkcie (x, y)? Wysokość `z` wynika z grawitacji
 * (podłoga albo wierzch tego, co stoi pod spodem).
 * opts.pietruj=false → tylko podłoga. opts.twarde=true → kolejność rozładunku i „cięższe na
 * lżejszym" są błędem; przy false wracają jako `ostrzezenia` (tak działa ręczne przesuwanie).
 */
export function sprawdzMiejsce(paka, ulozone, s, x, y, l, w, opts = {}) {
  const { pietruj = true, twarde = true, kolejnosc = true } = opts;
  if (x < -EPS || y < -EPS || x + l > paka.dl + EPS || y + w > paka.sz + EPS) return { ok: false, powod: "poza paką" };
  let z = 0;
  const pod = [];
  for (const o of ulozone) {
    if (o.id === s.id) continue;
    if (nachodzi(x, x + l, o.x, o.x + o.dl) && nachodzi(y, y + w, o.y, o.y + o.sz)) {
      pod.push(o);
      if (o.z + o.wys > z) z = o.z + o.wys;
    }
  }
  if (z + s.wys > paka.wys + EPS) return { ok: false, powod: "za wysoko", z };
  const ostrzezenia = [];
  if (z > EPS) {
    if (!pietruj) return { ok: false, powod: "zajęte", z };
    const podpory = pod.filter(o => Math.abs(o.z + o.wys - z) < 0.5);
    if (podpory.some(o => !o.pietrowanie)) return { ok: false, powod: "pod spodem sztuka, której nie wolno piętrować", z };
    const podparte = podpory.reduce((sum, o) => sum + polePrzeciecia(x, y, l, w, o), 0);
    if (podparte < l * w - 1) return { ok: false, powod: "brak pełnego podparcia", z };
    if (s.waga && podpory.some(o => o.waga && s.waga > o.waga + EPS)) {
      if (twarde) return { ok: false, powod: "cięższe na lżejszym", z };
      ostrzezenia.push("cięższa sztuka stoi na lżejszej");
    }
    if (kolejnosc && podpory.some(o => o.rozl < s.rozl)) {
      if (twarde) return { ok: false, powod: "stoi na towarze z wcześniejszego rozładunku", z };
      ostrzezenia.push("stoi na towarze z wcześniejszego rozładunku");
    }
  }
  if (kolejnosc) {
    // Rozładunek od tyłu: sztuka jest zastawiona, gdy w jej „pasie" bliżej drzwi stoi coś
    // z PÓŹNIEJSZEGO rozładunku. Wysokości nie liczymy — wózkiem nie sięgnie się ponad paletą.
    for (const o of ulozone) {
      if (o.id === s.id || !nachodzi(y, y + w, o.y, o.y + o.sz)) continue;
      const zastawia = o.rozl > s.rozl && o.x >= x + l - EPS;      // coś późniejszego stoi za nami
      const zastawiamy = o.rozl < s.rozl && x >= o.x + o.dl - EPS; // my stajemy za czymś wcześniejszym
      if (zastawia || zastawiamy) {
        if (twarde) return { ok: false, powod: "zastawia wcześniejszy rozładunek", z };
        ostrzezenia.push("kolejność rozładunku: towar na wcześniejszy rozładunek jest zastawiony");
        break;
      }
    }
  }
  return { ok: true, z, ostrzezenia };
}

const orientacje = (s) => (s.obrot && s.dl !== s.sz ? [[s.dl, s.sz, false], [s.sz, s.dl, true]] : [[s.dl, s.sz, false]]);

function najlepszeMiejsce(paka, ulozone, s, opts) {
  const xs = new Set([0]), ys = new Set([0]);
  for (const o of ulozone) { xs.add(o.x + o.dl); ys.add(o.y + o.sz); xs.add(o.x); ys.add(o.y); }
  let best = null;
  for (const [l, w, obr] of orientacje(s)) {
    for (const x of xs) {
      if (x + l > paka.dl + EPS) continue;
      for (const y of ys) {
        if (y + w > paka.sz + EPS) continue;
        const r = sprawdzMiejsce(paka, ulozone, s, x, y, l, w, opts);
        if (!r.ok) continue;
        // Klucz: jak najkrótszy ładunek (koniec sztuki jak najbliżej kabiny), potem nisko,
        // potem jak najbliżej kabiny i prawej burty.
        const klucz = [x + l, r.z, x, y];
        if (!best || porownaj(klucz, best.klucz) < 0) best = { x, y, z: r.z, l, w, obr, klucz };
      }
    }
  }
  return best;
}
const porownaj = (a, b) => { for (let i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > EPS) return a[i] - b[i]; } return 0; };

function ulozJedenPrzebieg(paka, sztuki, stale, tryb, kolejnosc, limitWagi = null, dowolne = null) {
  const ulozone = [], nieulozone = [];
  const mapa = new Map(sztuki.map(s => [s.id, s]));
  // 1) Sztuki ustawione ręcznie zostają tam, gdzie postawił je człowiek — od najniższych.
  const reczne = Object.entries(stale || {}).filter(([id]) => mapa.has(id)).sort((a, b) => (a[1].z || 0) - (b[1].z || 0));
  const wolne = new Set(sztuki.map(s => s.id));
  for (const [id, p] of reczne) {
    const s = mapa.get(id);
    const l = p.obr ? s.sz : s.dl, w = p.obr ? s.dl : s.sz;
    const r = sprawdzMiejsce(paka, ulozone, s, p.x, p.y, l, w, { twarde: false, kolejnosc });
    if (!r.ok) continue; // pozycja przestała być możliwa (np. zmieniono auto) — oddajemy automatowi
    ulozone.push({ ...s, x: p.x, y: p.y, z: r.z, dl: l, sz: w, obr: !!p.obr, reczna: true });
    wolne.delete(id);
  }
  // 2) Reszta: najpóźniejszy rozładunek idzie pierwszy (pod kabinę), w grupie od największych.
  const kolejka = sztuki.filter(s => wolne.has(s.id)).sort((a, b) =>
    (kolejnosc ? b.rozl - a.rozl : 0) || (b.dl * b.sz - a.dl * a.sz) || (b.wys - a.wys) || ((b.waga || 0) - (a.waga || 0)));
  let masa = ulozone.reduce((sum, s) => sum + (s.waga || 0), 0);
  for (const s of kolejka) {
    // Zestaw: sztuka bez wskazanej przestrzeni nie wchodzi tam, gdzie przekroczyłaby ładowność —
    // spróbuje w następnej. Sztuki przypisane ręcznie wchodzą zawsze (i wtedy świeci ostrzeżenie).
    if (limitWagi && dowolne?.has(s.id) && masa + (s.waga || 0) > limitWagi + EPS) { nieulozone.push({ ...s, powod: "przekroczyłaby ładowność" }); continue; }
    let m = tryb === "podloga" ? najlepszeMiejsce(paka, ulozone, s, { pietruj: false, kolejnosc }) : null;
    if (!m) m = najlepszeMiejsce(paka, ulozone, s, { pietruj: true, kolejnosc });
    if (m) { ulozone.push({ ...s, x: m.x, y: m.y, z: m.z, dl: m.l, sz: m.w, obr: m.obr, reczna: false }); masa += s.waga || 0; }
    else nieulozone.push({ ...s, powod: s.wys > paka.wys ? "wyższa niż paka" : (Math.min(s.dl, s.sz) > paka.sz || Math.max(s.dl, s.sz) > Math.max(paka.dl, paka.sz)) ? "nie mieści się wymiarem" : "brak miejsca" });
  }
  return { ulozone, nieulozone };
}

/**
 * Układa sztuki na pace.
 * tryb: "podloga" — najpierw podłoga, piętrowanie dopiero gdy jej zabraknie (domyślnie);
 *       "zwarto"  — piętruje od razu, żeby ładunek zajął jak najkrótszy odcinek paki.
 * stale: { [idSztuki]: { x, y, z, obr } } — pozycje ustawione ręcznie, których automat nie rusza.
 */
export function uloz(paka, sztuki, { tryb = "podloga", stale = {}, kolejnosc = true, limitWagi = null, dowolne = null } = {}) {
  if (!paka || !(paka.dl > 0 && paka.sz > 0 && paka.wys > 0)) return { ulozone: [], nieulozone: sztuki.map(s => ({ ...s, powod: "brak wymiarów paki" })), tryb };
  const a = ulozJedenPrzebieg(paka, sztuki, stale, tryb, kolejnosc, limitWagi, dowolne);
  if (tryb === "podloga" && a.nieulozone.length) {
    // „Najpierw podłoga" bywa zachłanne: pierwsze sztuki zajmują podłogę, ostatnim brakuje
    // miejsca. Gdy coś zostało, sprawdzamy układ zwarty i bierzemy ten, który mieści więcej.
    const b = ulozJedenPrzebieg(paka, sztuki, stale, "zwarto", kolejnosc, limitWagi, dowolne);
    if (b.nieulozone.length < a.nieulozone.length) return { ...b, tryb: "zwarto", zmienionoTryb: true };
  }
  return { ...a, tryb };
}

/**
 * Układa ładunek na ZESTAW: kilka przestrzeni ładunkowych (auto + przyczepa), każda z własnymi
 * wymiarami, ładownością i własnymi drzwiami (kolejność rozładunku liczy się w każdej osobno).
 * przestrzenie: [{ paka: {dl,sz,wys}|null, maxWaga: kg|null }]
 * Sztuka z `gdzie` = indeks trafia tylko tam. Reszta wypełnia przestrzenie po kolei, zaczynając
 * od `najpierw`; czego pierwsza nie przyjmie (miejsce albo ładowność), próbuje następna.
 * Każda ułożona i nieułożona sztuka dostaje `p` = indeks przestrzeni (nieułożona: ostatniej próbowanej).
 */
export function ulozZestaw(przestrzenie, sztuki, { tryb = "podloga", stale = {}, kolejnosc = true, najpierw = 0 } = {}) {
  const n = przestrzenie.length;
  const kolej = przestrzenie.map((_, i) => i).sort((a, b) => (a === najpierw ? -1 : 0) - (b === najpierw ? -1 : 0) || a - b);
  // Sztuka ustawiona ręcznie należy do przestrzeni, w której ją postawiono.
  const cel = (s) => (s.gdzie != null && s.gdzie >= 0 && s.gdzie < n ? s.gdzie : (stale[s.id] && (stale[s.id].p ?? 0) < n ? (stale[s.id].p ?? 0) : null));
  let wolne = sztuki.filter(s => cel(s) == null);
  const ulozone = [], nieulozone = [];
  let zmienionoTryb = false;
  kolej.forEach((pi, k) => {
    const pr = przestrzenie[pi];
    const przypisane = sztuki.filter(s => cel(s) === pi);
    if (!pr.paka) { nieulozone.push(...przypisane.map(s => ({ ...s, p: pi, powod: "brak wymiarów paki" }))); return; }
    const staleTu = Object.fromEntries(Object.entries(stale).filter(([, v]) => (v.p ?? 0) === pi));
    const w = uloz(pr.paka, [...przypisane, ...wolne], {
      tryb, stale: staleTu, kolejnosc,
      limitWagi: n > 1 && Number(pr.maxWaga) > 0 ? Number(pr.maxWaga) : null,
      dowolne: new Set(wolne.map(s => s.id)),
    });
    if (w.zmienionoTryb) zmienionoTryb = true;
    const proba = wolne; wolne = [];
    ulozone.push(...w.ulozone.map(s => ({ ...s, p: pi })));
    const idWolnych = new Set(proba.map(s => s.id));
    const ostatnia = k === kolej.length - 1;
    const dalej = [];
    for (const s of w.nieulozone) {
      if (idWolnych.has(s.id) && !ostatnia) dalej.push(sztuki.find(x => x.id === s.id));
      else nieulozone.push({ ...s, p: pi });
    }
    wolne = dalej;
  });
  // Zostały tylko wtedy, gdy ostatnia przestrzeń nie ma wymiarów.
  nieulozone.push(...wolne.map(s => ({ ...s, p: kolej[kolej.length - 1], powod: "brak wymiarów paki" })));
  return { ulozone, nieulozone, tryb, zmienionoTryb };
}

/** Ostrzeżenia dla całego układu (po ręcznych poprawkach automat ich nie pilnuje twardo). */
export function ostrzezeniaUkladu(paka, ulozone, { kolejnosc = true } = {}) {
  const wynik = [];
  const rosnaco = [...ulozone].sort((a, b) => a.z - b.z);
  const dotad = [];
  for (const s of rosnaco) {
    const r = sprawdzMiejsce(paka, dotad, s, s.x, s.y, s.dl, s.sz, { twarde: false, kolejnosc: false });
    for (const o of r.ostrzezenia || []) wynik.push({ id: s.id, nr: s.nr, lp: s.lp, tekst: o });
    dotad.push(s);
  }
  if (kolejnosc) {
    for (const s of ulozone) {
      const blok = ulozone.find(o => o.id !== s.id && o.rozl > s.rozl && nachodzi(s.y, s.y + s.sz, o.y, o.y + o.sz) &&
        (o.x >= s.x + s.dl - EPS || (Math.abs(o.z - (s.z + s.wys)) < 0.5 && nachodzi(s.x, s.x + s.dl, o.x, o.x + o.dl))));
      if (blok) wynik.push({ id: s.id, nr: s.nr, lp: s.lp, tekst: `R${s.rozl} zastawione towarem na R${blok.rozl}` });
    }
  }
  return wynik;
}

/** Wolne miejsca na europalety dokładane zachłannie w to, co zostało na podłodze. */
function miejscaZachlannie(paka, ulozone, limit) {
  const stan = [...ulozone], wynik = [];
  while (wynik.length < limit) {
    const s = { id: `__eur${wynik.length}`, dl: 120, sz: 80, wys: 1, obrot: true, rozl: 1, pietrowanie: false, waga: null };
    const m = najlepszeMiejsce(paka, stan, s, { pietruj: false, kolejnosc: false });
    if (!m) break;
    const r = { x: m.x, y: m.y, dl: m.l, sz: m.w };
    stan.push({ ...s, ...r, z: 0 }); wynik.push(r);
  }
  return wynik;
}

/** Siatka wzorcowa pustej paki: k rzędów palet wzdłuż, reszta długości rzędami w poprzek. */
function siatkaRzedowa(paka) {
  const wzdluz = Math.floor(paka.sz / 80), wPoprzek = Math.floor(paka.sz / 120);
  let bestK = 0, best = -1;
  for (let k = 0; k * 120 <= paka.dl; k++) {
    const n = k * wzdluz + Math.floor((paka.dl - k * 120) / 80) * wPoprzek;
    if (n > best) { best = n; bestK = k; }
  }
  const sloty = [];
  for (let i = 0; i < bestK; i++) for (let j = 0; j < wzdluz; j++) sloty.push({ x: i * 120, y: j * 80, dl: 120, sz: 80 });
  const reszta = Math.floor((paka.dl - bestK * 120) / 80);
  for (let r = 0; r < reszta; r++) for (let j = 0; j < wPoprzek; j++) sloty.push({ x: bestK * 120 + r * 80, y: j * 120, dl: 80, sz: 120 });
  return sloty;
}

/**
 * Wolne miejsca paletowe (europalety 120×80 na podłodze) przy obecnym układzie — jako prostokąty
 * do narysowania na podłodze. Bierzemy lepszy z dwóch wyników: dokładania zachłannego i siatki
 * rzędowej bez zajętych pól (zachłanne samo gubi miejsce: naczepa 13,6 m dałaby 33 zamiast 34).
 * Dla pustej paki to po prostu jej pojemność w europaletach.
 */
export function wolneMiejscaEur(paka, ulozone, limit = 66) {
  const a = miejscaZachlannie(paka, ulozone, limit);
  const b = siatkaRzedowa(paka).filter(sl => !ulozone.some(o => nachodzi(sl.x, sl.x + sl.dl, o.x, o.x + o.dl) && nachodzi(sl.y, sl.y + sl.sz, o.y, o.y + o.sz)));
  return b.length > a.length ? b : a;
}
export const wolneEuropalety = (paka, ulozone, limit = 66) => wolneMiejscaEur(paka, ulozone, limit).length;
export const miejscaEuropalet = (paka) => wolneMiejscaEur(paka, []).length;

/** Liczby do panelu podsumowania. `maxWaga` w kg (ładowność z kartoteki) albo null. */
export function podsumowanie(paka, ulozone, nieulozone = [], maxWaga = null) {
  const dlZajeta = ulozone.reduce((m, s) => Math.max(m, s.x + s.dl), 0);
  const podloga = ulozone.filter(s => s.z < EPS).reduce((sum, s) => sum + s.dl * s.sz, 0);
  const objetosc = ulozone.reduce((sum, s) => sum + s.dl * s.sz * s.wys, 0);
  const bezWagi = ulozone.filter(s => !s.waga).length;
  const waga = ulozone.reduce((sum, s) => sum + (s.waga || 0), 0);
  const polePaki = paka.dl * paka.sz, objPaki = polePaki * paka.wys;
  const max = Number(maxWaga) > 0 ? Number(maxWaga) : null;
  const miejscaEur = miejscaEuropalet(paka);
  const wolne = wolneMiejscaEur(paka, ulozone).slice(0, miejscaEur);
  return {
    sztuk: ulozone.length, nieulozonych: nieulozone.length,
    pietrowanych: ulozone.filter(s => s.z > EPS).length,
    dlZajeta, dlWolna: Math.max(0, paka.dl - dlZajeta),
    podlogaM2: podloga / 1e4, podlogaPct: polePaki ? (podloga / polePaki) * 100 : 0,
    wolnaPodlogaM2: Math.max(0, polePaki - podloga) / 1e4,
    objM3: objetosc / 1e6, objPct: objPaki ? (objetosc / objPaki) * 100 : 0, wolnaObjM3: Math.max(0, objPaki - objetosc) / 1e6,
    waga, bezWagi, maxWaga: max,
    wagaPct: max ? (waga / max) * 100 : null,
    zapasWagi: max ? max - waga : null,
    przeladowane: max ? waga > max + EPS : false,
    // Miejsca paletowe = europalety 120×80 na podłodze: ile mieści pusta paka i ile zostaje po załadunku.
    // Miejsca paletowe: pojemność pustej paki i to, co zostaje po załadunku (wraz z prostokątami do rysunku).
    miejscaEur, wolneEur: wolne.length, wolneMiejsca: wolne,
    // LDM = metry długości paki (tak podają je ogłoszenia) — decyzja usera 10.11.2026.
    ldmPaki: paka.dl / 100, ldmZajete: dlZajeta / 100, ldmWolne: Math.max(0, paka.dl - dlZajeta) / 100,
  };
}

/**
 * Sposób załadunku jednej przestrzeni — porządkuje to, co wpisał człowiek, i składa opis.
 * z: { tyl, bokL, bokP, gora, winda, windaKg, wysokosc }. Tył jest domyślnie dostępny
 * (planer i tak zakłada drzwi z tyłu); reszty nie zgadujemy — brak zaznaczenia = nie.
 */
export function sposobZaladunku(z) {
  const w = z || {};
  const liczba = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
  const d = { tyl: w.tyl !== false, bokL: !!w.bokL, bokP: !!w.bokP, gora: !!w.gora, winda: !!w.winda, windaKg: w.winda ? liczba(w.windaKg) : null, wysokosc: liczba(w.wysokosc) };
  const strony = [];
  if (d.tyl) strony.push("tył");
  if (d.bokL && d.bokP) strony.push("oba boki"); else if (d.bokL) strony.push("bok lewy"); else if (d.bokP) strony.push("bok prawy");
  if (d.gora) strony.push("góra");
  const sprzet = d.winda ? `winda${d.windaKg ? ` do ${d.windaKg} kg` : ""}` : "bez windy — wózek widłowy";
  const czesci = [strony.length ? `załadunek: ${strony.join(", ")}` : "załadunek: nie podano", sprzet];
  if (d.wysokosc) czesci.push(`podłoga ${d.wysokosc} cm nad ziemią`);
  return { ...d, strony, sprzet, opis: czesci.join(" · ") };
}

/**
 * Naciski na osie pojazdu dwuosiowego (belka podparta w dwóch punktach).
 * tech (cm / kg): rozstawOsi, osDoPaki (od osi przedniej do przedniej ściany paki; ujemne,
 * gdy paka zaczyna się przed osią), masaPrzod / masaTyl (naciski pustego auta z kierowcą),
 * dopPrzod / dopTyl (dopuszczalne z dowodu rej.). Bez kompletu danych zwraca `brak` —
 * nie zgadujemy parametrów technicznych.
 */
export function naciskiOsi(tech, ulozone) {
  const t = tech || {};
  const pola = ["rozstawOsi", "osDoPaki", "masaPrzod", "masaTyl", "dopPrzod", "dopTyl"];
  const brakuje = pola.filter(k => t[k] === "" || t[k] == null || !Number.isFinite(Number(t[k])));
  if (brakuje.length) return { brak: true, brakuje };
  const WB = Number(t.rozstawOsi);
  if (!(WB > 0)) return { brak: true, brakuje: ["rozstawOsi"] };
  const bezWagi = ulozone.filter(s => !s.waga).length;
  const W = ulozone.reduce((sum, s) => sum + (s.waga || 0), 0);
  const moment = ulozone.reduce((sum, s) => sum + (s.waga || 0) * (Number(t.osDoPaki) + s.x + s.dl / 2), 0);
  const tylLad = W ? moment / WB : 0;
  const przodLad = W - tylLad;
  const przod = Number(t.masaPrzod) + przodLad, tyl = Number(t.masaTyl) + tylLad;
  return {
    brak: false, bezWagi, wagaLadunku: W,
    srodekX: W ? moment / W - Number(t.osDoPaki) : null,
    przod, tyl, przodLad, tylLad,
    dopPrzod: Number(t.dopPrzod), dopTyl: Number(t.dopTyl),
    przodPct: (przod / Number(t.dopPrzod)) * 100, tylPct: (tyl / Number(t.dopTyl)) * 100,
    przodPrzekroczony: przod > Number(t.dopPrzod) + EPS, tylPrzekroczony: tyl > Number(t.dopTyl) + EPS,
    // Odciążona oś przednia = gorsze kierowanie; sygnalizujemy, gdy ładunek ją odciąża.
    przodOdciazony: przodLad < -EPS,
  };
}

/** Przyciąganie ręcznie przesuwanej sztuki do ścian i krawędzi sąsiadów (w cm). */
export function przyciagnij(paka, ulozone, id, x, y, l, w, prog = 8) {
  const kx = [0, paka.dl - l], ky = [0, paka.sz - w];
  for (const o of ulozone) {
    if (o.id === id) continue;
    kx.push(o.x + o.dl, o.x - l, o.x, o.x + o.dl - l);
    ky.push(o.y + o.sz, o.y - w, o.y, o.y + o.sz - w);
  }
  const snap = (v, kand) => { let b = v, d = prog; for (const k of kand) { const dd = Math.abs(k - v); if (dd < d) { d = dd; b = k; } } return b; };
  const sx = Math.min(Math.max(0, snap(x, kx)), Math.max(0, paka.dl - l));
  const sy = Math.min(Math.max(0, snap(y, ky)), Math.max(0, paka.sz - w));
  return { x: Math.round(sx), y: Math.round(sy) };
}

export const KOLORY_ROZL = { 1: "#2563eb", 2: "#16a34a", 3: "#d97706", 4: "#9333ea", 5: "#dc2626" };
export const TYPY_PALET = [
  { nazwa: "Europaleta", dl: 120, sz: 80 },
  { nazwa: "Przemysłowa", dl: 120, sz: 100 },
  { nazwa: "Półpaleta", dl: 80, sz: 60 },
  { nazwa: "120×120", dl: 120, sz: 120 },
];
