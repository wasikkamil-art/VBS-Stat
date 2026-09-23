// „Plan kontra wykonanie" — porównanie planu z Kalkulatora tras z tym, jak kurs
// poszedł naprawdę (Etap 2 planera).
//
// ŚWIADOMIE BEZ OCENY KIEROWCY (decyzja usera 2026-09-23): pokazujemy fakty i
// różnice, nie stawiamy stopni. Liczy Cloud Function przy zamykaniu kursu —
// tutaj tylko czytamy `realizacjeTras/{frachtId}` i dajemy przycisk przeliczenia.

import { useState, useEffect, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const fmtHm = (min) => (min == null ? "—" : `${Math.floor(min / 60)} h${min % 60 ? " " + Math.round(min % 60) + " min" : ""}`);
const fmtCzas = (iso) => (iso ? new Date(iso).toLocaleString("pl-PL", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

const IKONA = { km: "📏", dojazd: "🕐", jazda: "🚚", pauzy: "⏸️", postoj: "🅿️", paliwo: "⛽" };

export default function RozliczenieTrasyPanel({ frachtId, canEdit = false, showToast = () => {} }) {
  const [dane, setDane] = useState(null);
  const [plan, setPlan] = useState(null);
  const [laduje, setLaduje] = useState(true);
  const [liczy, setLiczy] = useState(false);
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);

  const wczytaj = async () => {
    try {
      const [r, p] = await Promise.all([
        getDoc(doc(db, "realizacjeTras", frachtId)),
        getDoc(doc(db, "planyTras", frachtId)),
      ]);
      setDane(r.exists() ? r.data() : null);
      setPlan(p.exists() ? p.data() : null);
    } catch (e) {
      console.warn("[rozliczenie] wczytaj:", e);
    } finally { setLaduje(false); }
  };
  useEffect(() => { wczytaj();   }, [frachtId]);

  // Ślad przejazdu na mapie (zamrożony przy zamykaniu kursu — breadcrumbs żyją 7 dni)
  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !dane?.slad?.length) return;
    if (!mapObjRef.current) {
      mapObjRef.current = L.map(mapRef.current, { scrollWheelZoom: false }).setView([52, 15], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 18 }).addTo(mapObjRef.current);
    }
    const map = mapObjRef.current;
    const linia = L.polyline(dane.slad, { color: "#059669", weight: 4, opacity: 0.85 }).addTo(map);
    const grupa = L.layerGroup().addTo(map);
    for (const p of dane.fakt?.postoje || []) {
      if (!p.lat || !p.lng) continue;
      L.circleMarker([p.lat, p.lng], {
        radius: p.minut >= 180 ? 9 : 6, color: "#fff", weight: 2,
        fillColor: p.minut >= 180 ? "#7c3aed" : "#f59e0b", fillOpacity: 0.95,
      }).addTo(grupa).bindTooltip(`postój ${fmtHm(p.minut)} · ${fmtCzas(new Date(p.odMs).toISOString())}`, { direction: "top" });
    }
    try { map.fitBounds(linia.getBounds(), { padding: [25, 25] }); } catch { /* pusto */ }
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.removeLayer(linia); map.removeLayer(grupa); };
  }, [dane]);

  const przelicz = async () => {
    setLiczy(true);
    try {
      const fn = httpsCallable(functions, "rozliczTraseNow", { timeout: 300000 });
      await fn({ frachtId });
      await wczytaj();
      showToast("✅ Rozliczenie przeliczone");
    } catch (e) {
      console.error("[rozliczenie] przelicz:", e);
      showToast("❌ Nie udało się przeliczyć: " + (e?.message || e));
    } finally { setLiczy(false); }
  };

  if (laduje) return null;

  if (!dane && !plan) {
    return canEdit ? (
      <div className="pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-400">
          📊 Plan kontra wykonanie — brak zapisanego planu dla tego zlecenia.
          Plan zapisuje się w Kalkulatorze tras (przycisk „Zaplanuj trasę" wyżej) PRZED wyjazdem.
        </div>
      </div>
    ) : null;
  }

  const f = dane?.fakt || {};
  const p = dane?.plan || plan || {};
  const wiersze = [
    { etykieta: "Kilometry", plan: p.km ? `${p.km} km` : "—", fakt: f.km ? `${f.km} km` : "—", zrodlo: f.kmZrodlo },
    { etykieta: "Czas jazdy", plan: fmtHm(p.jazdaMin), fakt: fmtHm(f.jazdaMin), zrodlo: f.zrodloCzasu },
    { etykieta: "Dojazd", plan: fmtCzas(p.etaAt), fakt: fmtCzas(f.dojazdAt), zrodlo: f.dojazdAt ? "zdarzenie kierowcy" : null },
    { etykieta: "Pauzy ≥45 min", plan: p.pauz ?? "—", fakt: f.pauz ?? "—", zrodlo: null },
    { etykieta: "Paliwo", plan: p.litry ? `${p.litry} L` : "—", fakt: f.litry ? `${f.litry} L · ${f.paliwoEUR} €` : "—", zrodlo: f.tankowan ? `${f.tankowan} tankowań kartą` : "brak tankowań w oknie kursu" },
  ];

  return (
    <div className="pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-semibold text-gray-800">📊 Plan kontra wykonanie</h3>
        <div className="flex items-center gap-2">
          {dane?.policzoneAt && <span className="text-[11px] text-gray-400">policzone {fmtCzas(dane.policzoneAt)}</span>}
          {canEdit && (
            <button type="button" onClick={przelicz} disabled={liczy}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs disabled:opacity-50">
              {liczy ? "Liczę…" : "🔄 Przelicz"}
            </button>
          )}
        </div>
      </div>

      {!dane ? (
        <div className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Plan jest zapisany, ale kurs nie został jeszcze rozliczony. Rozliczenie robi się samo przy zamknięciu kursu
          {canEdit && <> — albo kliknij „Przelicz"</>}.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5">Metryka</th>
                  <th className="text-right font-medium">Plan</th>
                  <th className="text-right font-medium">Wykonanie</th>
                  <th className="text-left font-medium pl-3">Skąd</th>
                </tr>
              </thead>
              <tbody>
                {wiersze.map((w) => (
                  <tr key={w.etykieta} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-700">{w.etykieta}</td>
                    <td className="text-right text-gray-500">{w.plan}</td>
                    <td className="text-right font-medium text-gray-800">{w.fakt}</td>
                    <td className="pl-3 text-[11px] text-gray-400">{w.zrodlo || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Różnice wobec planu</div>
            {dane.odchylenia?.length ? (
              <ul className="space-y-1">
                {dane.odchylenia.map((o, i) => (
                  <li key={i} className="text-xs text-gray-700 flex gap-2">
                    <span>{IKONA[o.typ] || "•"}</span><span>{o.tekst}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-emerald-700">Brak istotnych różnic — kurs poszedł zgodnie z planem.</div>
            )}
          </div>

          {dane.slad?.length > 0 && (
            <div className="mt-3">
              <div ref={mapRef} className="w-full h-64 rounded-xl overflow-hidden border border-gray-100" />
              <div className="mt-1 text-[11px] text-gray-400">
                Zielona linia — trasa faktycznie przejechana ({dane.punktowGps} punktów GPS).
                Kropki — postoje dłuższe niż 20 min (fioletowe: ponad 3 h).
              </div>
            </div>
          )}

          {dane.braki?.length > 0 && (
            <div className="mt-2 text-[11px] text-amber-700">
              {dane.braki.map((b, i) => <div key={i}>⚠️ {b}</div>)}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-400">
            Zestawienie pokazuje różnice, nie ocenia kierowcy. Kilometry z licznika pojazdu, czas jazdy i pauzy
            z tachografu (albo z GPS, gdy karta jeszcze nie zgrana).
          </div>
        </>
      )}
    </div>
  );
}
