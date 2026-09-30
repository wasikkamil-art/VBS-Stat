// Linki do PDF-ów zlecenia w listach frachtów.
//
// PO CO: fracht rozliczany kilkoma zleceniami ma kilka dokumentów, a listy pokazywały tylko
// `fracht.urlZlecenie` — czyli lustro PIERWSZEGO zlecenia. Drugi PDF był z listy nieosiągalny
// (zgłoszone 30.09.2026: „jak klikam otwórz to wyskakuje tylko pierwsze zlecenie").
//
// Przy jednym zleceniu wygląda i zachowuje się dokładnie jak dotąd — jeden przycisk.

import { safeHref } from "../utils/safeHref";
import { zleceniaFrachtu, maWieleZlecen } from "../utils/zleceniaFrachtu";

export default function ZlecenieLinki({ fracht, label = "📄 Otwórz", compact = false }) {
  const klasa = compact
    ? "h-8 px-2 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100"
    : "text-xs px-2 py-1 rounded-lg font-medium transition-all hover:bg-blue-100";
  const styl = compact ? undefined : { background: "#f0fdf4", color: "#15803d" };

  if (!maWieleZlecen(fracht)) {
    if (!fracht?.urlZlecenie) return null;
    return (
      <a href={safeHref(fracht.urlZlecenie)} target="_blank" rel="noopener noreferrer"
        className={klasa} style={styl}>{label}</a>
    );
  }

  // Kilka zleceń — po przycisku na każdy dokument. Numerujemy pozycją, a nie numerem zlecenia,
  // bo ten bywa pusty, a przycisk musi być klikalny i rozróżnialny mimo to.
  const lista = zleceniaFrachtu(fracht);
  const zPlikiem = lista.map((z, i) => ({ ...z, poz: i + 1 })).filter((z) => z.urlZlecenie);
  if (!zPlikiem.length) return null;

  return (
    <>
      {zPlikiem.map((z) => (
        <a key={z.poz} href={safeHref(z.urlZlecenie)} target="_blank" rel="noopener noreferrer"
          className={klasa} style={styl}
          title={`Zlecenie ${z.poz}${z.nr ? ` — ${z.nr}` : ""}${z.cenaEur ? ` · ${z.cenaEur} EUR` : ""}`}>
          📄 {z.poz}
        </a>
      ))}
    </>
  );
}
