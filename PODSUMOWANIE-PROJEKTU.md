# FleetStat (fleetstat.pl) — Podsumowanie projektu

> Dokument do przeniesienia do nowego chatu. Zawiera pełny kontekst: architektura, pliki, API, konwencje, co zrobiono, co w planie.

---

## 1. Architektura ogólna

- **Nazwa projektu**: FleetStat (dawniej FleetOS / VBS-Stat)
- **Typ**: React SPA (monolityczny `src/App.jsx` — ~17 000 linii)
- **Framework**: React 18 + Vite 5 + Tailwind CSS 3
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **Region Firebase**: `europe-west1`
- **Hosting produkcyjny**: **Vercel** — domena `fleetstat.pl`, auto-deploy z GitHub (branch `main`)
- **Firebase Hosting**: osobne — serwuje `vbs-stats.web.app` (NIE produkcja!)
- **GitHub repo**: `wasikkamil-art/VBS-Stat`
- **JSX transform**: automatyczny (NIE importować React — Vite sam dodaje)

## 2. Kluczowe pliki

### Frontend
| Plik | Opis |
|------|------|
| `src/App.jsx` | **Główny monolityczny plik** — cała aplikacja (~17k linii) |
| `public/sw.js` | Service Worker PWA (cache v3, wyklucza hashowane pliki Vite) |
| `.npmrc` | `legacy-peer-deps=true` — fix na react-leaflet vs React 18 |
| `package.json` | Zależności: react 18, leaflet, react-leaflet 5 (nie używany bezpośrednio), recharts, xlsx, csv-parse |
| `dist/index.html` | Po buildzie — ładuje Leaflet CSS/JS z CDN (unpkg.com/leaflet@1.9.4) |
| `vite.config.js` | Konfiguracja Vite |
| `tailwind.config.js` | Tailwind |

### Backend (Cloud Functions)
| Plik | Opis |
|------|------|
| `functions/index.js` | Wszystkie Cloud Functions |
| `functions/package.json` | Zależności CF |

### Firebase
| Plik | Opis |
|------|------|
| `firebase.json` | Konfiguracja Firebase (hosting dist, functions) |
| `firestore.rules` | Reguły bezpieczeństwa Firestore |

## 3. Cloud Functions (functions/index.js)

| Funkcja | Typ | Opis |
|---------|-----|------|
| `onRoleChange` | onDocumentWritten | Synchronizacja roli użytkownika do custom claims |
| `setUserRole` | onCall | Ustawienie roli użytkownika (admin) |
| `addDriverByEmail` | onCall | Dodanie kierowcy po emailu |
| `sendFleetEmail8/14/20` | onSchedule | Automatyczne maile z raportami (8:00, 14:00, 20:00) |
| `sendFleetEmailNow` | onCall | Wyślij email natychmiast |
| `onNewChatMessage` | onDocumentCreated | Powiadomienia push o nowych wiadomościach |
| `gpsProxy` | onCall | **Proxy do Atlas API** (widziszwszystko.eu) |
| `setGpsConfig` | onCall | Zapis konfiguracji GPS (klucz API) |

## 4. Struktura App.jsx — główne komponenty (z numerami linii, przybliżone)

```
~18     firebaseConfig, db, auth, storage, functions
~198    SK (Storage Keys), SEED_VEHICLES, SEED_CATEGORIES
~266    Utility functions (uid, fmtPLN, fmtEUR, fmtDate...)
~309    Constants (PALETTE, DOC_TYPES, COVERAGE_OPTIONS, INSURANCE_TYPES, CONTRACT_TYPES)
~366    Icon components (IconTruck, IconTruckTrailer, VehicleIcon)
~377    LoginScreen
~584    ExportCostsModal
~714    SprawaFileUpload, AttachmentList
~776    exportCostsToExcel
~823    DEFAULT_TABS_BY_ROLE, ADMIN_ONLY_TABS
~832    App (główny komponent — state, sidebar, routing)
~3713   MobileChatOverlay
~3777   ChatTab
~4658   SprawyTab (+ SPRAWA_TYPY, SPRAWA_STATUSY, modals)
~5474   EmailStatusTab
~5702   GpsTab ← GŁÓWNA ZAKŁADKA GPS
~5920   geocode() — Nominatim API
~5934   getRoute() — OSRM routing API
~5952   GpsMapSection — Leaflet mapa + trasa zlecenia
~6251   GpsKilometrySection — dane CAN (przebieg, paliwo)
~6375   GpsTrasySection — historia tras z Atlas /history
~6470   GpsKartaSection — upload karty kierowcy (.ddd/.esm/.tgd/.v1b)
~6533   GpsDddSection — upload plików tachografu DDD
~6621   ASSIGNABLE_TABS
~6641   AuditLogTab
~6817   UsersTab
~7286   PaymentsTab (+ PAY_CATEGORIES, modals)
~7364   DriverPanel
~8904   PaymentsTab
~10605  ImiTab (+ ImiCard, ImiPreviewModal, ImiUploadModal)
~11154  DocsTab (+ DocStatusBadge, FilePreviewModal, BulkUploadModal, AddDocModal)
~12082  AddCostModal
~12329  RentownoscTab
~12902  TrendyTab
~13330  RentFormModal
~13457  ServisTab (+ ServiceEditForm, VehicleServicePanel)
~13832  DriverCopyRow
~13958  CzasPracyModal
~14261  VehicleEditPanel
~14790  AddVehicleModal
~14936  Utility components (PageTitle, KpiCard, FSel, MF, MInput, MSelect)
~14993  DocUploadCell
~15122  CostsImportModal
~15350  FVTab (faktury/rozliczenia)
~15756  FrachtyTab ← ZAKŁADKA FRACHTY (zlecenia transportowe)
~16272  FrachtyImportModal
~16519  FVEditModal
~16573  ZlecenieUploadBtn
~16667  GeoPickerModal
~16771  FrachtyModal ← MODAL EDYCJI FRACHTU
```

## 5. GPS / Mapa — szczegóły techniczne

### Atlas API (widziszwszystko.eu)
- Proxy przez Cloud Function `gpsProxy` (klucz API w Firestore `fleet/gpsConfig`)
- Endpointy: `devices`, `positionsWithCanDetails`, `history`
- **Struktura odpowiedzi**:
  - Urządzenia: `data.deviceList[]` (nie surowa tablica)
  - Pozycje: `data.positionList[]`
  - Każda pozycja: `pos.coordinate.latitude / pos.coordinate.longitude` (zagnieżdżone, NIE płaskie)
  - Dane CAN: `pos.can.mileage.value`, `pos.can.voltage.value` itd.
  - DateTime: obiekt `{year, month, day, hour, minute, seconds, timezone}` — NIE unix timestamp
  - Identyfikator urządzenia: `dev.deviceName` (nie `dev.plate`)

### Leaflet (mapa)
- **Załadowany przez CDN** (unpkg.com/leaflet@1.9.4) — NIE przez npm import
- Dostęp: `const L = window.L;`
- `react-leaflet@5.0.0` jest zainstalowany ale **NIE UŻYWANY** (wymaga React 19)
- Ikona ciężarówki: SVG `divIcon` z `L.divIcon({ html: '<svg>...</svg>' })`
- Tile layer: OpenStreetMap (darmowy)

### Geokodowanie i routing (darmowe!)
- **Nominatim** (OSM): `nominatim.openstreetmap.org/search` → zamiana adres/kod pocztowy → [lat, lng]
- **OSRM**: `router.project-osrm.org/route/v1/driving/` → trasa z punktami, dystans, czas
- Funkcje: `geocode(query)` i `getRoute(waypoints)` w App.jsx

### Auto-odświeżanie
- Pozycja pojazdu: **co 30 sekund** (fetch z Atlas API)
- Mapa NIE skacze: `initialViewSetRef` + `lastSelectedDevRef` blokują reset widoku
- Trasa zlecenia: cachowana po `lastRouteFrachtIdRef` — NIE przeliczana co 30s
- Trasy wyświetlane: **tylko aktywne** (filtr `statusRozladunku !== "rozladowano"`)

### Pod-zakładki GPS per pojazd
1. **Mapa** — pozycja live + trasa aktywnego zlecenia
2. **Kilometry** — dane CAN (przebieg, napięcie, paliwo)
3. **Trasy** — historia tras z Atlas /history
4. **Karta kierowcy** — upload plików karty (.ddd, .esm, .tgd, .v1b)
5. **Pliki DDD** — upload plików tachografu

## 6. Struktura frachtu (zlecenia transportowe)

```javascript
{
  id, vehicleId, klient,
  dataZlecenia, dataZaladunku, dataRozladunku,
  godzZaladunku, godzRozladunku,
  // Punkty załadunku (do 3):
  zaladunekKod, zaladunekKod2, zaladunekKod3,    // kody pocztowe np. "PL44-100"
  zaladunekAdres,                                  // pełny adres
  zaladunekGeo,                                    // "lat,lng" string
  zaladunekTelefon,
  // Punkty rozładunku (do 3):
  dokod, dokod2, dokod3,
  rozladunekAdres,
  rozladunekGeo,
  rozladunekTelefon,
  // Status:
  statusRozladunku,   // "rozladowano" = zakończony, inne = aktywny
  // Dane finansowe:
  cenaEur, kmPodjazd, kmLadowne, kmWszystkie,
  // ... inne pola
}
```

**Priorytet geokodowania**: geo (najdokładniejsze) → adres → kod pocztowy

## 7. Deployment

### Produkcja (fleetstat.pl)
1. `npm run build` (Vite → dist/)
2. `git add . && git commit && git push`
3. Vercel automatycznie buduje i deployuje z `main`
4. **NIE używać `firebase deploy`** — to trafia na vbs-stats.web.app

### Cloud Functions
```bash
firebase deploy --only functions
```

### Service Worker
- `public/sw.js` cache name: `fleetstat-v3`
- Wyklucza Vite hashed files: `assets/index-*.js|css`
- Przy problemach z cache: bump version, użytkownik musi wyczyścić dane witryny

## 8. Konwencje kodu

- **Monolityczny plik** — wszystko w `src/App.jsx`
- **Inline styles** + **Tailwind CSS** (mieszane)
- **JSX transform** — NIE importować React
- **Firebase v10** — modularny import (`getFirestore`, `collection`, `doc`...)
- **Leaflet przez CDN** — `window.L`, NIE `import L from 'leaflet'`
- **Funkcje pomocnicze**: `uid()`, `fmtPLN()`, `fmtEUR()`, `fmtDate()`, `logAction()`
- **Toast**: `showToast(message)` — wyświetla notyfikację
- **Firestore collections**: through SK object (`SK.vehicles`, `SK.costs`, `SK.frachty`...)
- **Role**: `admin`, `dyspozytor`, `kierowca`
- **Commit message**: po polsku lub angielsku, z `Co-Authored-By: Claude`

## 9. Co zostało zrobione (chronologicznie)

1. ✅ Rozszerzenie dokumentów o ubezpieczenia i umowy (DOC_TYPES, coverage, contract)
2. ✅ AI prompt w BulkUploadModal — auto-match nowych pól
3. ✅ Fix: fileData do Firebase Storage (zamiast Firestore 1MB limit)
4. ✅ Reorganizacja sidebar — grupa "Pojazdy" z podgrupami
5. ✅ Przeniesienie GPS z Email do grupy Pojazdy
6. ✅ Cloud Function `gpsProxy` — proxy do Atlas API
7. ✅ GPS dashboard z zakładkami per pojazd (Mapa, Kilometry, Trasy, Karta, DDD)
8. ✅ Mapa live z ikoną ciężarówki SVG
9. ✅ Auto-trasa zlecenia (geokodowanie Nominatim + routing OSRM)
10. ✅ Fix: mapa nie skacze przy auto-refresh
11. ✅ Fix: panel trasy nie miga (cache + filtr aktywnych fracht)
12. ✅ Usunięcie zbędnych markerów (czerwone/zielone kółka) z mapy tras

## 10. Co jest w planie (NASTĘPNE ZADANIA)

### A. Podsumowanie trasy (Trip Statistics) ← PRIORYTET
Panel pod każdym zleceniem z metrykami ukończonej trasy:
- **Punktualność**: planowana vs rzeczywista data/godzina załadunku i rozładunku
- **Czas trasy**: rzeczywisty czas od załadunku do rozładunku
- **Kilometry**: przejechane km (z CAN bus / Atlas API)
- **Spalanie**: średnie zużycie paliwa (zakres do ustalenia z użytkownikiem)
- **Porównanie**: planowana trasa vs rzeczywista (km, czas)
- **Status oceny**: na czas / opóźniony / za wysokie spalanie

Dane źródłowe:
- Daty/godziny z frachtu: `dataZaladunku`, `godzZaladunku`, `dataRozladunku`, `godzRozladunku`
- Kilometry z CAN: `pos.can.mileage.value` (Atlas API)
- Trasa planowana: OSRM (km, czas)
- Trasa rzeczywista: Atlas `/history` endpoint

### B. Parser plików DDD/tachograf
- Biblioteki: `readesm-js` lub `tachoparser`
- Odczyt danych z karty kierowcy i tachografu
- Kalendarz czasu pracy wg rozporządzenia 561/2006

### C. Porównanie trasy planowanej vs rzeczywistej
- Nałożenie obu tras na mapę
- Wykrywanie odchyleń od trasy

## 11. Znane problemy / uwagi

- **Duplicate "style" attribute** warning w JSX (linia ~4574) — kontekst menu czatu ma dwa atrybuty `style` na jednym elemencie. Nie blokuje builda ale warto naprawić.
- **Chunk size warning** — `index-*.js` > 500KB (1.7MB). W przyszłości warto podzielić na lazy-loaded chunks.
- `react-leaflet@5.0.0` zainstalowany ale nieużywany — zostawiony, bo usunięcie go wymaga `.npmrc` cleanup. Nie przeszkadza.
- Vercel build wymaga `.npmrc` z `legacy-peer-deps=true`

## 12. Zmienne środowiskowe / konfiguracja

- **Firebase config**: hardcoded w App.jsx (~linia 18)
- **Atlas GPS API key**: w Firestore `fleet/gpsConfig` → `atlasApiKey`
- **Atlas API URL**: `https://api.widziszwszystko.eu/api/v1/`
- **Nominatim**: publiczny, darmowy, bez klucza
- **OSRM**: publiczny, darmowy, bez klucza
- **Vercel**: auto-deploy z GitHub, konfiguracja w panelu Vercel

---

*Wygenerowano: 2026-04-20*
