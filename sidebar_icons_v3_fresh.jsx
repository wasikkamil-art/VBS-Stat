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
// SET X: "Dashboard Native" — metafory z branży transportowej
// Przegląd=prędkościomierz, Frachty=trasa A→B, FV=banknot,
// Koszty=kalkulator, Pojazdy=kierownica, Serwis=diagnostyka,
// Rentowność=roślinka/wzrost, Dokumenty=segregator, IMI=paszport,
// Użytkownicy=identyfikator, Sprawy=pinezka+tablica
// ═══════════════════════════════════════════
const SetX = {
  // Przegląd → Prędkościomierz / Gauge (szybki przegląd)
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10"/>
      <path d="M12 6v2"/>
      <path d="M6 12H4"/>
      <path d="M7.8 7.8L6.3 6.3"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="M12 10l5.5-5.5"/>
      <path d="M20 12h-2"/>
    </svg>
  ),
  // Frachty → Trasa A→B z pinezkami
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="7" r="3"/>
      <circle cx="5" cy="7" r="1" fill="currentColor"/>
      <circle cx="19" cy="17" r="3"/>
      <circle cx="19" cy="17" r="1" fill="currentColor"/>
      <path d="M8 7h3c2 0 3 1 3 3v4c0 2 1 3 3 3h2"/>
    </svg>
  ),
  // FV / Płatności → Banknot/pieniądz
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M2 9h2"/>
      <path d="M20 9h2"/>
      <path d="M2 15h2"/>
      <path d="M20 15h2"/>
    </svg>
  ),
  // Koszty → Kalkulator
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <rect x="7" y="5" width="10" height="4" rx="1"/>
      <circle cx="8.5" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="12" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="15.5" cy="13" r="0.8" fill="currentColor"/>
      <circle cx="8.5" cy="17" r="0.8" fill="currentColor"/>
      <circle cx="12" cy="17" r="0.8" fill="currentColor"/>
      <rect x="14" y="16" width="3" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
  // Pojazdy → Kierownica
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="2.5"/>
      <path d="M12 3v6.5"/>
      <path d="M5.6 17.4l5.6-3.2"/>
      <path d="M18.4 17.4l-5.6-3.2"/>
    </svg>
  ),
  // Serwis → Diagnostyka OBD (wtyczka+fala)
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="8" height="8" rx="2"/>
      <path d="M5 14h4"/>
      <path d="M7 12v4"/>
      <path d="M11 14h2c1 0 2-.5 2.5-1.5L18 8"/>
      <circle cx="19" cy="6" r="2"/>
    </svg>
  ),
  // Rentowność → Roślinka/wzrost z doniczki
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20h10"/>
      <path d="M9 20v-4a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v4"/>
      <path d="M12 13V8"/>
      <path d="M8 8c0-2 2-4 4-4"/>
      <path d="M16 8c0-2-2-4-4-4"/>
      <path d="M8 8c-2 0-4-1-4-3"/>
      <path d="M16 8c2 0 4-1 4-3"/>
    </svg>
  ),
  // Dokumenty → Segregator z zakładkami
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
      <path d="M20 8h-3a1 1 0 0 1-1-1V5"/>
      <path d="M20 14h-3a1 1 0 0 1-1-1v-2"/>
      <line x1="8" y1="10" x2="13" y2="10" opacity="0.5"/>
      <line x1="8" y1="14" x2="12" y2="14" opacity="0.5"/>
    </svg>
  ),
  // IMI/SIPSI → Paszport
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M8 18h8"/>
      <line x1="4" y1="5" x2="6" y2="5" opacity="0.4"/>
      <line x1="4" y1="7" x2="6" y2="7" opacity="0.4"/>
    </svg>
  ),
  // Użytkownicy → Identyfikator / badge
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M8 18c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5"/>
      <path d="M10 1v3"/>
      <path d="M14 1v3"/>
    </svg>
  ),
  // Sprawy → Pinezka + tablica
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="8" y1="8" x2="8" y2="8.01" strokeWidth="2.5"/>
      <line x1="8" y1="12" x2="8" y2="12.01" strokeWidth="2.5"/>
      <line x1="8" y1="16" x2="8" y2="16.01" strokeWidth="2.5"/>
      <line x1="11" y1="8" x2="17" y2="8"/>
      <line x1="11" y1="12" x2="17" y2="12"/>
      <line x1="11" y1="16" x2="15" y2="16"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// SET Y: "Pill Accent" — okrągłe, miękkie, z akcentem kolorystycznym
// Przegląd=oko, Frachty=paczka+strzałka, FV=stempel,
// Koszty=monety, Pojazdy=kluczyk, Serwis=śruba+klucz,
// Rentowność=waga/balans, Dokumenty=tarcza/polisa, IMI=flaga EU,
// Użytkownicy=drzewko org, Sprawy=dzwonek/alert
// ═══════════════════════════════════════════
const SetY = {
  // Przegląd → Oko (podgląd / widok ogólny)
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  // Frachty → Paczka ze strzałką (wysyłka)
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.5 9.4l-9-5.19"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  // FV → Stempel / pieczątka (zatwierdzenie FV)
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16"/>
      <rect x="6" y="14" width="12" height="4" rx="1"/>
      <path d="M9 14V9a3 3 0 0 1 6 0v5"/>
      <circle cx="12" cy="6" r="1.5" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
  // Koszty → Monety (stos)
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="10" cy="17" rx="6" ry="3"/>
      <path d="M4 17v-3c0 1.66 2.69 3 6 3s6-1.34 6-3v3"/>
      <ellipse cx="10" cy="11" rx="6" ry="3"/>
      <path d="M16 11v3"/>
      <path d="M4 11V8c0 1.66 2.69 3 6 3s6-1.34 6-3v3"/>
      <ellipse cx="14" cy="6" rx="6" ry="3"/>
    </svg>
  ),
  // Pojazdy → Kluczyk samochodowy
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5"/>
      <circle cx="8" cy="8" r="2"/>
      <path d="M13 8h7"/>
      <path d="M20 8v3"/>
      <path d="M17 8v2"/>
    </svg>
  ),
  // Serwis → Dwa klucze skrzyżowane
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l5.5-5.5"/>
      <path d="M14.5 3.5a4.5 4.5 0 0 1 6 6L16 14l-6-6 4.5-4.5z"/>
      <path d="M20 4l-3.5 3.5"/>
      <path d="M3 21l7-7"/>
      <path d="M14 14l3 3c1 1 1 2.5 0 3.5s-2.5 1-3.5 0l-3-3"/>
    </svg>
  ),
  // Rentowność → Waga / balans (zysk vs koszty)
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/>
      <path d="M3 7l4 7h0a5 5 0 0 0 10 0h0l4-7"/>
      <path d="M3 7l9-1 9 1"/>
      <path d="M7 14a2.5 2.5 0 0 0 5 0"/>
      <path d="M12 14a2.5 2.5 0 0 0 5 0"/>
    </svg>
  ),
  // Dokumenty → Tarcza / polisa (ochrona)
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  // IMI/SIPSI → Flaga (regulacje międzynarodowe)
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V4"/>
      <path d="M4 4c3-2 6 0 8-2 2 2 5 0 8 2v9c-3-2-6 0-8 2-2-2-5 0-8-2"/>
    </svg>
  ),
  // Użytkownicy → Drzewko org (hierarchia)
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="5" rx="1.5"/>
      <rect x="2" y="16" width="6" height="5" rx="1.5"/>
      <rect x="16" y="16" width="6" height="5" rx="1.5"/>
      <path d="M12 7v4"/>
      <path d="M5 16v-3h14v3"/>
      <path d="M12 11v0"/>
    </svg>
  ),
  // Sprawy → Dzwonek / powiadomienie (wymaga uwagi)
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      <circle cx="18" cy="4" r="3" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
};

// ═══════════════════════════════════════════
// SET Z: "Micro Illustration" — drobne ilustracje, unikalne kształty
// Przegląd=dashboard z igłą, Frachty=kontener, FV=paragon z haczykiem,
// Koszty=portfel, Pojazdy=tablica rejestracyjna, Serwis=olej+klucz,
// Rentowność=diamenty/klejnot, Dokumenty=szuflada, IMI=samolot+dokument,
// Użytkownicy=kółka ludzi, Sprawy=checkbox lista
// ═══════════════════════════════════════════
const SetZ = {
  // Przegląd → Mini dashboard z igłą (gauge)
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M3 9h18"/>
      <path d="M9 9v12"/>
      <circle cx="15" cy="15" r="2.5"/>
      <path d="M15 13l1.5-1.5"/>
    </svg>
  ),
  // Frachty → Kontener morski / cargo
  frachty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="12" rx="1.5"/>
      <path d="M2 7l3-4h14l3 4"/>
      <line x1="8" y1="7" x2="8" y2="19"/>
      <line x1="16" y1="7" x2="16" y2="19"/>
      <line x1="2" y1="13" x2="22" y2="13"/>
    </svg>
  ),
  // FV → Paragon z haczykiem ✓
  fv: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12a2 2 0 0 1 2 2v17l-3-2-3 2-3-2-3 2-3-2-3 2V4a2 2 0 0 1 2-2z"/>
      <path d="M9 10l2 2 4-4"/>
      <line x1="9" y1="16" x2="15" y2="16" opacity="0.4"/>
    </svg>
  ),
  // Koszty → Portfel
  costs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2"/>
      <path d="M2 6l7-3h6l7 3"/>
      <path d="M17 12.5h3v3h-3a1.5 1.5 0 0 1 0-3z"/>
    </svg>
  ),
  // Pojazdy → Tablica rejestracyjna
  vehicles: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="2.5"/>
      <circle cx="5.5" cy="12" r="1" fill="currentColor"/>
      <circle cx="18.5" cy="12" r="1" fill="currentColor"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="10" x2="15" y2="10" opacity="0.35"/>
      <line x1="9" y1="14" x2="15" y2="14" opacity="0.35"/>
    </svg>
  ),
  // Serwis → Kanister oleju
  serwis: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8h6v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V8z"/>
      <path d="M9 4h2v4H9z"/>
      <path d="M7 12h6"/>
      <path d="M13 11l4-4"/>
      <path d="M15 9l2-1"/>
    </svg>
  ),
  // Rentowność → Diament / klejnot (wartość)
  rent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 7-10 12L2 10z"/>
      <path d="M2 10h20"/>
      <path d="M12 22L6 10l3-7"/>
      <path d="M12 22l6-12-3-7"/>
    </svg>
  ),
  // Dokumenty → Szuflada / archiwum
  docs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 12h5l2 2h4l2-2h5"/>
      <line x1="10" y1="7" x2="14" y2="7" opacity="0.4"/>
    </svg>
  ),
  // IMI/SIPSI → Samolot / podróż międzynarodowa
  imi: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.8 19.2L16 11l3.5-3.5C20.3 6.7 21 5 20 4s-2.7.3-3.5 1.1L13 8.6 5 6.8l-1.5 1.5L10 12l-3 3H4l-2 2 4.5 1.5L8 22l2-2v-3l3-3 3.5 6.5 1.5-1.5z"/>
    </svg>
  ),
  // Użytkownicy → Kółka ludzi (zespół)
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3"/>
      <circle cx="5" cy="19" r="3"/>
      <circle cx="19" cy="19" r="3"/>
      <line x1="9.5" y1="7" x2="6.5" y2="16.5"/>
      <line x1="14.5" y1="7" x2="17.5" y2="16.5"/>
      <line x1="8" y1="19" x2="16" y2="19"/>
    </svg>
  ),
  // Sprawy → Checkbox lista (do odhaczenia)
  sprawy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="4" height="4" rx="1"/>
      <polyline points="4 7 5 8 7 6"/>
      <line x1="10" y1="7" x2="21" y2="7"/>
      <rect x="3" y="13" width="4" height="4" rx="1"/>
      <line x1="10" y1="15" x2="21" y2="15"/>
      <line x1="10" y1="21" x2="18" y2="21" opacity="0.35"/>
      <rect x="3" y="19" width="4" height="4" rx="1" opacity="0.35"/>
    </svg>
  ),
};

// Opisy ikon
const MEANINGS = {
  X: {
    dashboard: "Prędkościomierz → szybki rzut oka na dane",
    frachty: "Trasa A → B → transport między punktami",
    fv: "Banknot → faktura, pieniądz",
    costs: "Kalkulator → obliczanie kosztów",
    vehicles: "Kierownica → prowadzenie pojazdów",
    serwis: "Diagnostyka OBD → sprawdzanie stanu",
    rent: "Roślinka → wzrost, zysk",
    docs: "Segregator z zakładkami → akta",
    imi: "Paszport → dokument międzynarodowy",
    users: "Identyfikator → badge pracownika",
    sprawy: "Tablica + pinezki → kanban",
  },
  Y: {
    dashboard: "Oko → podgląd, overview",
    frachty: "Paczka 3D → ładunek cargo",
    fv: "Pieczątka → zatwierdzenie FV",
    costs: "Stos monet → pieniądze, wydatki",
    vehicles: "Kluczyk → dostęp do auta",
    serwis: "Skrzyżowane klucze → narzędzia",
    rent: "Waga → balans zysku vs kosztów",
    docs: "Tarcza + ✓ → ochrona/polisa",
    imi: "Flaga → regulacje krajowe",
    users: "Drzewko org → hierarchia zespołu",
    sprawy: "Dzwonek → powiadomienie, alert",
  },
  Z: {
    dashboard: "Mini dashboard → kafelek z gauge",
    frachty: "Kontener cargo → ładunek",
    fv: "Paragon + ✓ → zapłacona faktura",
    costs: "Portfel → pieniądze w środku",
    vehicles: "Tablica rejestracyjna → identyfikacja",
    serwis: "Kanister oleju → obsługa techniczna",
    rent: "Diament → wartość, zysk",
    docs: "Szuflada/archiwum → przechowywanie",
    imi: "Samolot → podróże międzynarodowe",
    users: "Trójkąt osób → zespół",
    sprawy: "Checklista → zadania do zrobienia",
  },
};

// ═══════════════════════════════════════════
export default function SidebarIconsV3() {
  const [selected, setSelected] = useState("X");
  const [activeTab, setActiveTab] = useState("frachty");
  const [hoveredItem, setHoveredItem] = useState(null);

  const sets = [
    { id: "X", name: "Dashboard Native", desc: "Metafory z branży: prędkościomierz, trasa A→B, banknot, kalkulator, kierownica, diagnostyka, roślinka wzrostu, segregator, paszport.", icons: SetX, accent: "#e65100" },
    { id: "Y", name: "Pill Accent", desc: "Alternatywne skojarzenia: oko (podgląd), paczka 3D, pieczątka, monety, kluczyk, waga (balans), tarcza (polisa), flaga, dzwonek.", icons: SetY, accent: "#7c3aed" },
    { id: "Z", name: "Micro Illustration", desc: "Unikalne ilustracje: mini dashboard, kontener, paragon, portfel, tablica rejestracyjna, kanister, diament, szuflada, samolot, checklista.", icons: SetZ, accent: "#0891b2" },
  ];

  const activeSet = sets.find(s => s.id === selected);
  const oldIcons = { dashboard: "◈", frachty: "🚚", fv: "🧾", costs: "≡", vehicles: "⊡", serwis: "🔧", rent: "📊", docs: "🛡️", imi: "🌍", users: "👥", sprawy: "⚡" };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", textAlign: "center" }}>Ikony sidebar v3 — zupełnie nowe metafory</h2>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px", textAlign: "center" }}>Każdy zestaw to inne skojarzenie wizualne, spójne z nazwą modułu</p>

      {/* Set selector */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {sets.map(s => (
          <button key={s.id} onClick={() => setSelected(s.id)} style={{
            padding: "10px 20px", borderRadius: 10, cursor: "pointer",
            border: selected === s.id ? `2px solid ${s.accent}` : "2px solid #e5e7eb",
            background: selected === s.id ? s.accent + "12" : "#fff",
            color: selected === s.id ? s.accent : "#64748b",
            fontWeight: 600, fontSize: 13,
          }}>
            {s.id}. {s.name}
          </button>
        ))}
      </div>

      <div style={{ padding: "10px 16px", background: activeSet.accent + "0d", borderRadius: 10, border: `1px solid ${activeSet.accent}25`, marginBottom: 20, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: activeSet.accent }}>{activeSet.name}</div>
        <div style={{ fontSize: 11, color: activeSet.accent + "bb", marginTop: 2 }}>{activeSet.desc}</div>
      </div>

      {/* Side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 0 }}>
        {/* OLD */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>Obecne</div>
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

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 18, color: "#d1d5db" }}>→</span>
        </div>

        {/* NEW */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: activeSet.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, textAlign: "center" }}>{activeSet.name}</div>
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
                  {isHovered && (
                    <div style={{
                      position: "absolute", left: "105%", top: "50%", transform: "translateY(-50%)",
                      background: "#1e293b", color: "#fff", fontSize: 10, padding: "5px 10px",
                      borderRadius: 6, whiteSpace: "nowrap", zIndex: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}>
                      {MEANINGS[selected][item.id]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comparison grid */}
      <div style={{ marginTop: 28, background: "#f8fafc", borderRadius: 12, border: "1px solid #e5e7eb", padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 14, textAlign: "center" }}>Wszystkie zestawy obok siebie</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 6 }}>
          {MENU_ITEMS.map(item => (
            <div key={item.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7.5, color: "#94a3b8", marginBottom: 8, fontWeight: 600, lineHeight: 1.3 }}>{item.label}</div>
              {/* Old */}
              <div style={{ padding: "5px 0", fontSize: 14, opacity: 0.5, borderBottom: "1px dashed #e5e7eb" }}>{oldIcons[item.id]}</div>
              {/* X, Y, Z */}
              {[SetX, SetY, SetZ].map((s, si) => (
                <div key={si} style={{ padding: "7px 0", color: "#475569", display: "flex", justifyContent: "center", borderBottom: si < 2 ? "1px solid #f1f5f9" : "none" }}>
                  {s[item.id]}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 12, fontSize: 9, color: "#94a3b8" }}>
          <span style={{ opacity: 0.5 }}>Rząd 1: Obecne (emoji)</span>
          <span style={{ color: "#e65100" }}>● X: Dashboard Native</span>
          <span style={{ color: "#7c3aed" }}>● Y: Pill Accent</span>
          <span style={{ color: "#0891b2" }}>● Z: Micro Illustration</span>
        </div>
      </div>
    </div>
  );
}