// Przyciemnianie koloru POD TEKST, w momencie rysowania.
//
// Po co: kolory kategorii kosztów są danymi, nie kodem. Kategorie wbudowane mają
// kolor w `App.jsx`, ale te dodane przez użytkownika trzymają go w Firestore
// (zasiany z `PALETTE` przy zakładaniu). Część z nich jest zbyt jasna na tekst —
// emerald #10b981 daje na białym 2,54:1 przy wymaganych 4,5:1.
//
// Dlaczego nie migracja danych: kolor kategorii to decyzja użytkownika, tak samo
// jak kolory marek kart paliwowych. Przepisanie bazy zmieniłoby też kropki przy
// nazwach i serie na wykresach, gdzie reguła kontrastu tekstu nie obowiązuje.
// Dlatego dane zostają nietknięte, a przyciemniamy wyłącznie w miejscu, gdzie
// kolor trafia na tekst. Kropka, pasek i wykres dostają wartość oryginalną.
//
// Użycie:
//   <span style={{ color: tekstowy(kat.color) }}>Leasing</span>   // ciemny, czytelny
//   <span style={{ background: kat.color }} />                     // oryginalny

const PROG_AA = 4.5;

function kanal(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function naRgb(hex) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminancja([r, g, b]) {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

// Kontrast dwóch kolorów wg WCAG 2.1 (1.4.3). Symetryczny.
export function kontrast(hexA, hexB) {
  const a = naRgb(hexA), b = naRgb(hexB);
  if (!a || !b) return 21;
  const la = luminancja(a), lb = luminancja(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbNaHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslNaHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}

// Kolor nałożony na tło z przezroczystością — odpowiednik tego, co faktycznie
// widzi oko, gdy w CSS stoi `background: "#10b981" + "18"`. Potrzebne, bo chipy
// kategorii mają tło liczone z WŁASNEGO koloru, więc tekst kontrastuje
// z delikatnym tintem, nie z czystą bielą.
export function zmieszaj(hex, tlo = "#ffffff", alfa = 1) {
  const a = naRgb(hex), b = naRgb(tlo);
  if (!a || !b) return tlo;
  const m = a.map((v, i) => Math.round(v * alfa + b[i] * (1 - alfa)));
  return "#" + m.map(v => v.toString(16).padStart(2, "0")).join("");
}

// Alfa zapisana w CSS jako dwucyfrowy sufiks hex (np. "18" w `kolor + "18"`).
export const alfaZSufiksu = (sufiks) => parseInt(sufiks, 16) / 255;

const pamiec = new Map();

// Zwraca ten sam kolor, jeśli już spełnia AA na podanym tle; w przeciwnym razie
// obniża jasność (HSL) krokami po 0,5%, zachowując odcień i nasycenie, aż próg
// zostanie osiągnięty. Odcień się nie zmienia, więc kategoria pozostaje
// rozpoznawalna — „zielony” nadal jest zielony, tylko ciemniejszy.
export function tekstowy(hex, tlo = "#ffffff", prog = PROG_AA) {
  const rgb = naRgb(hex);
  if (!rgb) return hex;                       // nie hex (np. gradient) — oddajemy bez zmian
  const klucz = `${hex}|${tlo}|${prog}`;
  if (pamiec.has(klucz)) return pamiec.get(klucz);

  let wynik = hex;
  if (kontrast(hex, tlo) < prog) {
    const [h, s] = rgbNaHsl(rgb);
    let [, , l] = rgbNaHsl(rgb);
    wynik = "#000000";
    for (let i = 0; i < 220 && l >= 0; i++, l -= 0.005) {
      const kandydat = hslNaHex(h, s, l);
      if (kontrast(kandydat, tlo) >= prog) { wynik = kandydat; break; }
    }
  }
  pamiec.set(klucz, wynik);
  return wynik;
}
