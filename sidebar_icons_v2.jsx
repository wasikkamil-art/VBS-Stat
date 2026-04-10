import { useState } from "react";

const MENU_ITEMS = [
  { id: "dashboard", label: "Przegląd" },
  { id: "frachty",   label: "Frachty" },
  { id: "fv",        label: "FV / Płatności" },
  { id: "costs",     label: "Koszty" },
  { id: "vehicles",  label: "Pojazdy" },
  { id: "serwis",    label: "Serwis" },
  { id: "rent",      label: "Rentowność" },
  { id: "docs",      label: "Dokumenty" },
  { id: "imi",       label: "IMI / SIPSI" },
  { id: "users",     label: "Użytkownicy" },
  { id: "sprawy",    label: "Sprawy", badge: 2 },
];

// Kontekst nazw:
// Przegląd = Dashboard/Overview → siatka kafelków
// Frachty = Ładunki/Transport → ciężarówka z naczepą
// FV / Płatności = Faktury → dokument ze znakiem €
// Koszty = Wydatki → portfel / monety
// Pojazdy = Flota → van z kluczykiem
// Serwis = Naprawa → klucz + śrubokręt
// Rentowność = Zysk/Analiza → wykres w górę
// Dokumenty = Akta/Polisy → teczka z dokumentami
// IMI / SIPSI = Delegowanie UE → flaga EU / paszport
// Użytkownicy = Zespół → osoby
// Sprawy = CRM/Tickety → skrzynka zadań

// ═══════════════════════════════════════════
// SET A: "Fleet Pro" — transport-oriented, outline
// ═══════════════════════════════════════════
const SetA = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11h2"/>
      <path d="M13 8h4l4 4v4h-2"/>
      <circle cx="7.5" cy="17.5" r="2"/>
      <circle cx="16.5" cy="17.5" r="2"/>
      <path d="M9.5 17.5h5"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <path d="M12 8v2"/>
      <path d="M14.5 9.5c0-1.1-.9-2-2.5-2s-2.5.9-2.5 2 1.12 1.5 2.5 2 2.5.9 2.5 2-1.12 2-2.5 2-2.5-.9-2.5-2"/>
      <path d="M12 16v1"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2"/>
      <path d="M2 10h20"/>
      <path d="M6 14h3"/>
      <path d="M13 14h2"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="12" height="11" rx="2"/>
      <path d="M15 9h3l3 3v4a1 1 0 0 1-1 1h-1"/>
      <path d="M3 16h1"/>
      <circle cx="7.5" cy="17" r="2"/>
      <circle cx="17.5" cy="17" r="2"/>
      <path d="M9.5 17h6"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M9 3v6"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// SET B: "Soft Duotone" — fill + stroke, ciepłe
// ═══════════════════════════════════════════
const SetB = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="9" rx="1.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="14" y="3" width="7" height="5" rx="1.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="14" y="12" width="7" height="9" rx="1.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <rect x="3" y="16" width="7" height="5" rx="1.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M13 17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11h2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 8h4l4 4v4h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7.5" cy="17.5" r="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="16.5" cy="17.5" r="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9.5 17.5h5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="2" width="14" height="20" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 8v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14.5 9.5c0-1.1-.9-2-2.5-2s-2.5.9-2.5 2 1.12 1.5 2.5 2 2.5.9 2.5 2-1.12 2-2.5 2-2.5-.9-2.5-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 16v1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="20" height="13" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <path d="M13 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="12" height="11" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M15 9h3l3 3v4a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 16h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="7.5" cy="17" r="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="17.5" cy="17" r="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9.5 17h6" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 7L13.5 15.5 8.5 10.5 2 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="16 7 22 7 22 13" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="currentColor" opacity="0.08" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9 3v6" stroke="currentColor" strokeWidth="1.6"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
      <line x1="8" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// SET C: "Bold Rounded" — grubsze, zaokrąglone, czytelne
// ═══════════════════════════════════════════
const SetC = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="2"/>
      <rect x="14" y="3" width="7" height="5" rx="2"/>
      <rect x="14" y="12" width="7" height="9" rx="2"/>
      <rect x="3" y="16" width="7" height="5" rx="2"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a1 1 0 0 0 1 1h1.5"/>
      <path d="M13 8h4l4 4v4h-1.5"/>
      <circle cx="7.5" cy="17.5" r="2.5"/>
      <circle cx="17" cy="17.5" r="2.5"/>
      <path d="M10 17.5h4.5"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <path d="M9 8h6"/>
      <path d="M14 12c0-1.5-3-1.5-3 0s3 1.5 3 0"/>
      <path d="M9 17h3"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2.5"/>
      <path d="M2 10h20"/>
      <path d="M6 15h4"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="11" height="10" rx="2"/>
      <path d="M14 10h3.5l3 3v3a1 1 0 0 1-1 1h-1"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
      <path d="M9 17h6"/>
      <path d="M3 16h1.5"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M9 3v6"/>
      <line x1="7" y1="13" x2="12" y2="13"/>
      <line x1="7" y1="17" x2="10" y2="17"/>
    </svg>
  ),
};

// Icon meaning map for tooltip
const ICON_MEANING = {
  dashboard: "Siatka kafelków → przegląd wielu danych naraz",
  frachty:   "Ciężarówka z naczepą → transport ładunków",
  fv:        "Dokument ze znakiem € → faktura / płatność",
  costs:     "Karta płatnicza → wydatki / koszty",
  vehicles:  "Dostawczak z kołami → pojazdy floty",
  serwis:    "Klucz płaski → naprawa / serwis",
  rent:      "Wykres trending up → rentowność / zyski",
  docs:      "Teczka / folder → dokumenty / polisy",
  imi:       "Globus z południkami → międzynarodowe delegowanie",
  users:     "Dwie sylwetki → zespół / użytkownicy",
  sprawy:    "Kanban / tablica zadań → sprawy CRM",
};

// ═══════════════════════════════════════════
export default function SidebarIconsV2() {
  const [selected, setSelected] = useState("A");
  const [activeTab, setActiveTab] = useState("frachty");
  const [hoveredItem, setHoveredItem] = useState(null);

  const sets = [
    { id: "A", name: "Fleet Outline", desc: "Czyste linie, jednolita grubość 1.7px. Profesjonalny styl SaaS. Ciężarówka, karta, wykres — każda ikona jednoznacznie pasuje do nazwy.", icons: SetA, accent: "#3b82f6" },
    { id: "B", name: "Soft Duotone", desc: "Obrys + delikatne wypełnienie 10-12%. Większa czytelność na małych rozmiarach. Miękki, premium wygląd przy zachowaniu przejrzystości.", icons: SetB, accent: "#6366f1" },
    { id: "C", name: "Bold Rounded", desc: "Grubsza linia 2px, zaokrąglone rogi. Wyraziste i czytelne nawet na niskiej rozdzielczości. Najbardziej zdecydowany charakter.", icons: SetC, accent: "#059669" },
  ];

  const activeSet = sets.find(s => s.id === selected);
  const oldIcons = { dashboard: "◈", frachty: "🚚", fv: "🧾", costs: "≡", vehicles: "⊡", serwis: "🔧", rent: "📊", docs: "🛡️", imi: "🌍", users: "👥", sprawy: "⚡" };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", textAlign: "center" }}>Ikony sidebar — spójne z nazwami</h2>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px", textAlign: "center" }}>Każda ikona jednoznacznie odpowiada funkcji modułu</p>

      {/* Set selector */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {sets.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{
            padding: "10px 20px", borderRadius: 10, cursor: "pointer",
            border: selected === s.id ? `2px solid ${s.accent}` : "2px solid #e5e7eb",
            background: selected === s.id ? s.accent + "10" : "#fff",
            color: selected === s.id ? s.accent : "#64748b",
            fontWeight: 600, fontSize: 13,
          }}>
            {s.id}. {s.name}
          </button>
        ))}
      </div>

      {/* Description */}
      <div style={{ padding: "10px 16px", background: activeSet.accent + "0d", borderRadius: 10, border: `1px solid ${activeSet.accent}25`, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: activeSet.accent }}>{activeSet.name}</div>
        <div style={{ fontSize: 11, color: activeSet.accent + "bb", marginTop: 2 }}>{activeSet.desc}</div>
      </div>

      {/* Side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 0 }}>
        {/* OLD */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>Obecne (miks emoji + unicode)</div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 8px", width: 220, margin: "0 auto" }}>
            <div style={{ padding: "4px 12px 14px", borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}>FleetStat</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>VBS Transport</div>
            </div>
            {MENU_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
                  borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                  background: isActive ? "#f3f4f6" : "transparent",
                  color: isActive ? "#111827" : "#6b7280",
                  fontWeight: isActive ? 600 : 400, fontSize: 13,
                }}>
                  <span style={{ width: 20, textAlign: "center", fontSize: 14, opacity: 0.7 }}>{oldIcons[item.id]}</span>
                  {item.label}
                  {item.badge ? <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>{item.badge}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18, color: "#d1d5db" }}>→</span>
        </div>

        {/* NEW */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: activeSet.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>Propozycja {selected}: {activeSet.name}</div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 8px", width: 220, margin: "0 auto" }}>
            <div style={{ padding: "4px 12px 14px", borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}>FleetStat</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>VBS Transport</div>
            </div>
            {MENU_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              const isHovered = hoveredItem === item.id;
              return (
                <div key={item.id} style={{ position: "relative" }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}>
                  <button onClick={() => setActiveTab(item.id)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
                    borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive ? "#f3f4f6" : "transparent",
                    color: isActive ? "#111827" : "#6b7280",
                    fontWeight: isActive ? 600 : 400, fontSize: 13,
                  }}>
                    <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", opacity: isActive ? 0.9 : 0.55 }}>
                      {activeSet.icons[item.id]}
                    </span>
                    {item.label}
                    {item.badge ? <span style={{ marginLeft: "auto", background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99 }}>{item.badge}</span> : null}
                  </button>
                  {/* Tooltip */}
                  {isHovered && (
                    <div style={{
                      position: "absolute", left: "105%", top: "50%", transform: "translateY(-50%)",
                      background: "#1e293b", color: "#fff", fontSize: 10, padding: "5px 10px",
                      borderRadius: 6, whiteSpace: "nowrap", zIndex: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}>
                      {ICON_MEANING[item.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Icon legend table */}
      <div style={{ marginTop: 28, background: "#f8fafc", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 14, textAlign: "center" }}>Ikona ↔ Znaczenie — dlaczego ta ikona pasuje</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 6 }}>
          {MENU_ITEMS.map(item => (
            <div key={item.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "#94a3b8", marginBottom: 6, fontWeight: 600, lineHeight: 1.3 }}>{item.label}</div>
              {/* All 3 sets stacked */}
              {[SetA, SetB, SetC].map((s, si) => (
                <div key={si} style={{ padding: "6px 0", color: "#475569", display: "flex", justifyContent: "center", borderBottom: si < 2 ? "1px solid #f1f5f9" : "none" }}>
                  {s[item.id]}
                </div>
              ))}
              {/* Meaning */}
              <div style={{ fontSize: 7, color: "#94a3b8", marginTop: 6, lineHeight: 1.3 }}>
                {ICON_MEANING[item.id].split("→")[0].trim()}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 12, fontSize: 9, color: "#94a3b8" }}>
          <span style={{ color: "#3b82f6" }}>● Rząd 1: Fleet Outline</span>
          <span style={{ color: "#6366f1" }}>● Rząd 2: Soft Duotone</span>
          <span style={{ color: "#059669" }}>● Rząd 3: Bold Rounded</span>
        </div>
      </div>
    </div>
  );
}