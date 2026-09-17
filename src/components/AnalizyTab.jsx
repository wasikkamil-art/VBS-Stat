// Analizy — jedno miejsce na materiały, które wcześniej powstawały ręcznie ze skryptów:
// rankingi kierowców, opłaty drogowe (NegoMetal + e-TOLL) i dashboard dyspozytorów.
import { useState } from "react";
import RankingTab from "./RankingTab";
import DyspozytorzyAnaliza from "./DyspozytorzyAnaliza";
import OplatyDrogoweAnaliza from "./OplatyDrogoweAnaliza";

const ODNOGI = [
  { id: "rankingi",     label: "🏁 Rankingi kierowców", rola: "wszyscy" },
  { id: "nego",         label: "🛣️ Opłaty drogowe",     rola: "dyspozytor" },
  { id: "dyspozytorzy", label: "📊 Dyspozytorzy",        rola: "admin" },
];

export default function AnalizyTab({ vehicles = [], frachtyList = [], costs = [], operacyjne = [], isAdmin = false, role = "podglad" }) {
  const [widok, setWidok] = useState("rankingi");

  // Podział wg decyzji usera (16.09.2026): dyspozytorzy widzą opłaty drogowe,
  // bo planują trasy i koszt myta jest ich sprawą. Dashboard dyspozytorów ocenia
  // ICH pracę, więc zostaje u admina. Podgląd ma same rankingi kierowców.
  const widoczne = ODNOGI.filter(o =>
    o.rola === "wszyscy" ||
    (o.rola === "admin" && isAdmin) ||
    (o.rola === "dyspozytor" && (isAdmin || role === "dyspozytor"))
  );
  const aktywny = widoczne.some(o => o.id === widok) ? widok : "rankingi";

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Analizy</h2>
        <div className="text-sm text-gray-500 mt-0.5">
          Zestawienia liczone z danych w bazie — te same, które wcześniej powstawały jako PDF-y
        </div>
      </div>

      {widoczne.length > 1 && (
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: "#f3f4f6" }}>
          {widoczne.map(o => (
            <button key={o.id} onClick={() => setWidok(o.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: aktywny === o.id ? "#fff" : "transparent",
                       color: aktywny === o.id ? "#111827" : "#9ca3af",
                       boxShadow: aktywny === o.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}

      {aktywny === "rankingi" && (
        <RankingTab vehicles={vehicles} frachtyList={frachtyList} costs={costs}
                    operacyjne={operacyjne} isAdmin={isAdmin} />
      )}

      {aktywny === "nego" && (
        <OplatyDrogoweAnaliza isAdmin={isAdmin} vehicles={vehicles}
                              frachtyList={frachtyList} operacyjne={operacyjne} />
      )}

      {aktywny === "dyspozytorzy" && <DyspozytorzyAnaliza frachtyList={frachtyList} />}
    </div>
  );
}
