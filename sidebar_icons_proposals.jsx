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

// ═══════════════════════════════════════════
// SVG Icons — Lucide-style (stroke-based, 20x20)
// ═══════════════════════════════════════════
const LucideIcons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1"/>
      <rect x="14" y="3" width="7" height="5" rx="1"/>
      <rect x="14" y="12" width="7" height="9" rx="1"/>
      <rect x="3" y="16" width="7" height="5" rx="1"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
      <path d="M15 18H9"/>
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10"/>
      <circle cx="17" cy="18" r="2"/>
      <circle cx="7" cy="18" r="2"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M15 9.354a4 4 0 1 0 0 5.292"/>
      <line x1="12" y1="6" x2="12" y2="7"/>
      <line x1="12" y1="17" x2="12" y2="18"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="15" height="10" rx="2"/>
      <path d="M16 10h4.5a2 2 0 0 1 1.6.8l1.4 1.75a1 1 0 0 1 .2.6V16a1 1 0 0 1-1 1h-1.7"/>
      <circle cx="6.5" cy="17" r="2"/>
      <circle cx="19.5" cy="17" r="2"/>
      <path d="M16 17h-7"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <line x1="9" y1="10" x2="15" y2="10"/>
      <line x1="12" y1="7" x2="12" y2="13"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// PROPOZYCJA 1: Lucide SVG (obrysowe, lekkie)
// ═══════════════════════════════════════════
const Proposal1Icons = LucideIcons;

// ═══════════════════════════════════════════
// PROPOZYCJA 2: Minimalistyczne liniowe (geometryczne)
// ═══════════════════════════════════════════
const MinimalIcons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="1.5"/>
      <rect x="3" y="13" width="8" height="8" rx="1.5"/>
      <rect x="13" y="13" width="8" height="8" rx="1.5"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17h1m16 0h1"/>
      <path d="M5.6 17H3V6.5A1.5 1.5 0 0 1 4.5 5h9A1.5 1.5 0 0 1 15 6.5V17h-1.6"/>
      <path d="M15 8h3l3 4v5h-2.6"/>
      <circle cx="7.5" cy="17" r="2"/>
      <circle cx="16.5" cy="17" r="2"/>
      <path d="M9.5 17h5"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="12" y2="16"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="2"/>
      <circle cx="7" cy="17" r="2"/>
      <circle cx="17" cy="17" r="2"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="7" y1="7" x2="7" y2="12"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// PROPOZYCJA 3: Filled / Dwutonowe (accent + szary)
// ═══════════════════════════════════════════
const FilledIcons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="3" width="8" height="5" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="13" y="3" width="8" height="5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="13" y="12" width="8" height="9" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="13" y="12" width="8" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="3" y="15" width="8" height="6" rx="2" fill="currentColor" opacity="0.15"/>
      <rect x="3" y="15" width="8" height="6" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" fill="currentColor" opacity="0.12"/>
      <path d="M14 18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M15 18H9"/>
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="17" cy="18" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="7" cy="18" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="currentColor" opacity="0.1"/>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="17" x2="13" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M16 8.5H10.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="6" width="13" height="11" rx="2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M15 9h3.5l3 3.5V16a1 1 0 0 1-1 1h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7" cy="17.5" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="17.5" r="2" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 17.5h7" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="4" height="10" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="16" y="7" width="4" height="13" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      <line x1="9" y1="12" x2="14" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="4" r="3" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
    </svg>
  ),
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
      <line x1="8" y1="13" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.5"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════
export default function SidebarIconsProposal() {
  const [selected, setSelected] = useState(1);
  const [activeTab, setActiveTab] = useState("frachty");

  const sets = [
    { id: 1, name: "Lucide Outline", desc: "Obrysowe, lekkie — styl Lucide/Feather. Czyste linie, profesjonalny wygląd. Najpopularniejszy styl w nowoczesnych dashboardach SaaS.", icons: Proposal1Icons, color: "#3b82f6" },
    { id: 2, name: "Minimal Line", desc: "Geometryczne, minimalistyczne — cieńsze i bardziej abstrakcyjne. Każda ikona to prosty, rozpoznawalny symbol. Nowoczesny, 'startup' feel.", icons: MinimalIcons, color: "#6366f1" },
    { id: 3, name: "Duotone Filled", desc: "Dwutonowe z delikatnym wypełnieniem. Obrys + 10-15% fill daje głębię. Najlepsza czytelność na małych rozmiarach. Premium wygląd.", icons: FilledIcons, color: "#059669" },
  ];

  const activeSet = sets.find(s => s.id === selected);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", textAlign: "center" }}>Propozycje ikon sidebar</h2>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", textAlign: "center" }}>FleetStat · Zamiana emoji/unicode na spójne SVG</p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        {sets.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{
            padding: "10px 20px", borderRadius: 10,
            border: selected === s.id ? `2px solid ${s.color}` : "2px solid #e5e7eb",
            background: selected === s.id ? s.color + "10" : "#fff",
            color: selected === s.id ? s.color : "#64748b",
            fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            {s.id}. {s.name}
          </button>
        ))}
      </div>

      {/* Description */}
      <div style={{ padding: "12px 16px", background: activeSet.color + "10", borderRadius: 10, border: `1px solid ${activeSet.color}30`, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: activeSet.color }}>{activeSet.name}</div>
        <div style={{ fontSize: 11, color: activeSet.color + "cc", marginTop: 2 }}>{activeSet.desc}</div>
      </div>

      {/* Side by side: old vs new */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0 }}>
        {/* OLD sidebar */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>Obecne ikony</div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 8px", width: 220, margin: "0 auto" }}>
            {/* Logo area */}
            <div style={{ padding: "4px 12px 16px", borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}>FleetStat</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>VBS Transport</div>
            </div>
            {MENU_ITEMS.map(item => {
              const oldIcons = { dashboard: "◈", frachty: "🚚", fv: "🧾", costs: "≡", vehicles: "⊡", serwis: "🔧", rent: "📊", docs: "🛡️", imi: "🌍", users: "👥", sprawy: "⚡" };
              const isActive = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
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
          <span style={{ fontSize: 20, color: "#d1d5db" }}>→</span>
        </div>

        {/* NEW sidebar */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: activeSet.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>Propozycja {selected}</div>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px 8px", width: 220, margin: "0 auto" }}>
            {/* Logo area */}
            <div style={{ padding: "4px 12px 16px", borderBottom: "1px solid #f3f4f6", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1d4ed8" }}>FleetStat</div>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>VBS Transport</div>
            </div>
            {MENU_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
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
              );
            })}
          </div>
        </div>
      </div>

      {/* All icons grid comparison */}
      <div style={{ marginTop: 28, padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 12, textAlign: "center" }}>Porównanie wszystkich ikon</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 8, textAlign: "center" }}>
          {MENU_ITEMS.map(item => (
            <div key={item.id}>
              <div style={{ fontSize: 8, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{item.label}</div>
              {sets.map(s => (
                <div key={s.id} style={{ padding: "8px 0", color: "#475569", display: "flex", justifyContent: "center" }}>
                  {s.icons[item.id]}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 10, fontSize: 9, color: "#94a3b8" }}>
          <span>Rząd 1: Lucide Outline</span>
          <span>Rząd 2: Minimal Line</span>
          <span>Rząd 3: Duotone Filled</span>
        </div>
      </div>
    </div>
  );
}