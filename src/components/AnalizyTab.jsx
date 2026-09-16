// Analizy — jedno miejsce na materiały, które wcześniej powstawały ręcznie ze skryptów.
// Etap 1 (16.09.2026): szkielet z trzema odnogami + przeniesione Rankingi.
// Dwie pozostałe czekają na dane — opis stanu jest w samych sekcjach, żeby nikt nie
// zgadywał, czy to jeszcze nie działa, czy już się zepsuło.
import { useState } from "react";
import RankingTab from "./RankingTab";

const ODNOGI = [
  { id: "rankingi",     label: "🏁 Rankingi kierowców", rola: "wszyscy" },
  { id: "nego",         label: "🛣️ Opłaty drogowe",     rola: "dyspozytor" },
  { id: "dyspozytorzy", label: "📊 Dyspozytorzy",        rola: "admin" },
];

function Wkrotce({ tytul, opis, punkty, blokada }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl">🚧</div>
        <div>
          <h3 className="text-base font-bold text-gray-900">{tytul}</h3>
          <div className="text-sm text-gray-500 mt-0.5">{opis}</div>
        </div>
      </div>
      <ul className="text-sm text-gray-700 space-y-1.5 mb-4 ml-1">
        {punkty.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-blue-500 font-bold">▸</span><span>{p}</span>
          </li>
        ))}
      </ul>
      {blokada && (
        <div className="text-xs rounded-xl p-3 border" style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
          <b>Czego brakuje:</b> {blokada}
        </div>
      )}
    </div>
  );
}

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
        <Wkrotce
          tytul="Opłaty drogowe — NegoMetal i e-TOLL"
          opis="Skąd biorą się zmiany kosztu myta i czy dostawcy naliczają poprawnie"
          punkty={[
            "Rozbicie opłat na kraje, miesiąc do miesiąca, z kwotą zmiany dla każdego z nich",
            "Stawka €/km per kraj — kontrola, czy taryfa stoi w miejscu, gdy rachunek rośnie",
            "Kilometry per kraj z licznika CAN (zbierane od 16.09.2026 do countryKmDaily)",
            "Sprawdzenie, czy każda opłata ma pokrycie w realnym przejeździe pojazdu",
          ]}
          blokada={"transakcji NegoMetal nie ma jeszcze w bazie — dziś są tylko w plikach eksportu z portalu. " +
                   "Potrzebny import do Firestore, tak jak przy tankowaniach. Do tego czasu analiza powstaje ręcznie ze skryptu."}
        />
      )}

      {aktywny === "dyspozytorzy" && (
        <Wkrotce
          tytul="Dashboard dyspozytorów"
          opis="Frachty w podziale na spedytorów, z porównaniem do poprzedniego miesiąca"
          punkty={[
            "Liczba frachtów, obrót, średni fracht, kilometry i €/km dla każdego kubełka",
            "Udziały procentowe i przesunięcie między miesiącami",
            "Wnioski liczone z danych, nie wpisywane ręcznie",
          ]}
          blokada={null}
        />
      )}
    </div>
  );
}
