// heicNaJpg — zdjęcia z iPhone'a (HEIC/HEIF) zamieniamy na JPG PRZED wgraniem.
// Chrome i Firefox nie wyświetlają HEIC: link do takiego pliku nie otwiera zdjęcia, tylko je pobiera
// (zgłoszenie usera 20.11.2026, „Do zrobienia na bazie"). Biblioteka waży 1,3 MB, więc ładujemy ją
// z CDN dopiero wtedy, gdy ktoś faktycznie wybierze HEIC — tak jak Leaflet, bez dokładania do bundla.
// Suma SRI przypina dokładnie tę wersję pliku; podmieniony plik przeglądarka odrzuci.

const SRC = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
const SRI = "sha384-OTofQ0MEeiSgh62havBcemCIK0gqj809wX6UA0uPISNMRnR6NZyCdGzX3SbLrgwL";

export const czyHeic = (plik) => /image\/hei[cf]/i.test(plik?.type || "") || /\.hei[cf]$/i.test(plik?.name || "");

let ladowanie = null;
const zaladuj = () => ladowanie || (ladowanie = new Promise((ok, zle) => {
  if (window.heic2any) return ok(window.heic2any);
  const s = document.createElement("script");
  s.src = SRC; s.integrity = SRI; s.crossOrigin = "anonymous";
  s.onload = () => (window.heic2any ? ok(window.heic2any) : zle(new Error("heic2any niedostępne")));
  s.onerror = () => { ladowanie = null; zle(new Error("nie udało się pobrać konwertera HEIC")); };
  document.head.appendChild(s);
}));

// Zwraca plik JPG; gdy to nie HEIC — ten sam plik. Błąd konwersji rzuca wyjątek:
// wołający decyduje, czy wgrać oryginał (lepiej mieć plik do pobrania niż żaden).
export async function naJpgJesliHeic(plik) {
  if (!czyHeic(plik)) return plik;
  const heic2any = await zaladuj();
  const wynik = await heic2any({ blob: plik, toType: "image/jpeg", quality: 0.85 });
  const blob = Array.isArray(wynik) ? wynik[0] : wynik;
  return new File([blob], plik.name.replace(/\.hei[cf]$/i, "") + ".jpg", { type: "image/jpeg" });
}

export const czyObraz = (nazwaLubTyp) => /^image\/(jpe?g|png|webp|gif)/i.test(nazwaLubTyp || "") || /\.(jpe?g|png|webp|gif)$/i.test(nazwaLubTyp || "");
