// safeHref — sanityzacja dynamicznych href= przeciw URL injection
// (`javascript:`, `data:`, etc). Każdy `<a href={dynamicUrl}>` w aplikacji powinien
// przejść przez ten helper.
//
// Wydzielone z App.jsx 2026-04-29 (TODO #5c krok 6) — używane w 10+ miejscach
// w App.jsx + lazy-loaded komponentach (FrachtyModal, etc).
//
// Zwraca "#" gdy URL jest puste/nieprawidłowe lub używa niebezpiecznego protokołu.
// Akceptuje tylko `http:` i `https:`. Względne URL-e są normalizowane do origin.

export const safeHref = (url) => {
  if (!url || typeof url !== "string") return "#";
  try {
    const parsed = new URL(url, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? url : "#";
  } catch { return "#"; }
};
