# FleetStat (fleetstat.pl) — Podsumowanie projektu

> Dokument do przeniesienia do nowego chatu. Zawiera pełny kontekst: architektura, pliki, API, konwencje, co zrobiono, co w planie.

*Ostatnia aktualizacja: 2026-04-21*

---

## 0. STAN AKTUALNY (TL;DR dla nowego chatu)

**Co działa w produkcji (`fleetstat.pl`)**:

1. **Moduł Trip Summary** — panel podsumowania trasy (punktualność, km z CAN, średnia prędkość, spalanie) pod każdym zakończonym zleceniem. Progi spalania konfigurowane per pojazd.
2. **GPS/Monitoring — rozbudowa** — klikalna lista zleceń pod mapą, rzeczywista trasa z Atlas `/history` dla zakończonych zleceń (zielona linia), planowana z OSRM dla aktywnych (niebieska przerywana).
3. **Moduł Czas pracy kierowcy MVP** — pełny dashboard compliance zgodny z rozp. 561/2006 + Pakiet Mobilności. Auto-detection z GPS (prędkość → jazda/odpoczynek) + ręczne kliknięcia kierowcy (4 typy aktywności). Plan do przodu (kiedy przerwa, koniec dnia, odpoczynek 11h/45h, 28-dniowy powrót do bazy).
4. **Parser DDD** — Cloud Function `parseDddFile` z `readesm-js`. Upload plików `.ddd` przez admina (GPS/Monitoring → Pliki DDD) lub kierowcę (mobile, Czas pracy → dół ekranu). Sparsowane aktywności nadpisują GPS w compliance (priorytet dowodowy).

**Integracja z widziszwszystko.eu**:
- Atlas API (oficjalne, udokumentowane) — używamy: pozycje GPS, CAN details, history. Działa.
- `/rest-api/` z panelu beta — **nie używamy** (nieudokumentowane, nie mamy zgody widziszwszystko).
- Tachograf/DDD — widziszwszystko przesłał info: brak API, brak automatycznego emaila (w planach). Flow: admin pobiera DDD z ich panelu Premium → upload do FleetStat → parser robi resztę.
- **Dla 1/6 pojazdów (WGM 0475M)** już jest zainstalowany moduł do zdalnego odczytu DDD. Pozostałe 5 — sprzęt opłacony, czeka na instalację.

**Co dalej (priorytety)**:
- **Moduł Czas pracy — iteracja 2**: kompensaty za skrócone odpoczynki, alerty w banerze, timeline 7-dniowy, push notifications
- **Parser DDD — test end-to-end**: za ~28 dni gdy pierwszy plik DDD dla WGM 0475M pojawi się w panelu widziszwszystko
- **Code splitting**: App.jsx = 1.77 MB (gzip 441 KB) — dla mobile mocno
- **Integracja chat ↔ WhatsApp** (pomysł) — model Slickshift: dyspozytor pisze u nas, kierowca dostaje na WhatsApp. Szczegóły w sekcji 14.E.

---

## 1. Architektura ogólna

- **Nazwa projektu**: FleetStat (dawniej FleetOS / VBS-Stat)
- **Typ**: React SPA (monolityczny `src/App.jsx` — ~22 000 linii po dodaniu modułów Trip/Czas pracy/DDD)
- **Framework**: React 18 + Vite 5 + Tailwind CSS 3
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **Region Firebase**: `europe-west1`
- **Hosting produkcyjny**: **Vercel** — domena `fleetstat.pl`, auto-deploy z GitHub (branch `main`)
- **Firebase Hosting**: osobne — serwuje `vbs-stats.web.app` (backup, **NIE produkcja!**)
- **GitHub repo**: `wasikkamil-art/VBS-Stat`
- **JSX transform**: automatyczny (NIE importować React — Vite sam dodaje)

## 2. Kluczowe pliki

### Frontend
| Plik | Opis |
|------|------|
| `src/App.jsx` | **Główny monolityczny plik** — cała aplikacja (~22k linii) |
| `public/sw.js` | Service Worker PWA (cache v3, wyklucza hashowane pliki Vite) |
| `.npmrc` | `legacy-peer-deps=true` — fix na react-leaflet vs React 18 |
| `package.json` | react 18, leaflet, react-leaflet 5 (nie używany bezpośrednio), recharts, xlsx, csv-parse |
| `dist/index.html` | Po buildzie — ładuje Leaflet CSS/JS z CDN (unpkg.com/leaflet@1.9.4) |
| `vite.config.js` | Konfiguracja Vite |
| `tailwind.config.js` | Tailwind |
| `.gitignore` | Rozszerzony o `dist-*/` (żeby test-buildy z sandbox nie lądowały w repo) |

### Backend (Cloud Functions)
| Plik | Opis |
|------|------|
| `functions/index.js` | Wszystkie Cloud Functions (~900 linii) |
| `functions/package.json` | Zależności CF — m.in. `readesm-js` dla parsera DDD |

### Firebase
| Plik | Opis |
|------|------|
| `firebase.json` | Konfiguracja Firebase (hosting dist, functions) |
| `firestore.rules` | Reguły bezpieczeństwa Firestore |

### Dokumentacja
| Plik | Opis |
|------|------|
| `PODSUMOWANIE-PROJEKTU.md` | **Ten plik** — architektura + stan |
| `ZASADY-VBS-STAT.md` | Zasady biznesowe (flota, koszty, VAT, kursy NBP) |
| `PODSUMOWANIE-SESJI.md` | Starszy log sesji roboczych |
| `email-widziszwszystko-DDD.md` | Template emaila do widziszwszystko z pytaniami o DDD |
| `preview-czas-pracy.html` | Zatwierdzony mockup widoku Czas pracy (do referencji) |

## 3. Cloud Functions (functions/index.js)

| Funkcja | Typ | Opis |
|---------|-----|------|
| `onRoleChange` | onDocumentWritten | Synchronizacja roli użytkownika do custom claims |
| `setUserRole` | onCall | Ustawienie roli użytkownika (admin) |
| `addDriverByEmail` | onCall | Dodanie kierowcy po emailu |
| `sendFleetEmail8/14/20` | onSchedule | Automatyczne maile z raportami (8:00, 14:00, 20:00) |
| `sendFleetEmailNow` | onCall | Wyślij email natychmiast |
| `onNewChatMessage` | onDocumentCreated | Powiadomienia push o nowych wiadomościach |
| `gpsProxy` | onCall | Proxy do Atlas API (widziszwszystko.eu) |
| `setGpsConfig` | onCall | Zapis konfiguracji GPS (klucz API) |
| **`parseDddFile`** | **onCall** | **Parser plików DDD — `readesm-js.convertToJson()` + zapis do `driverActivities`** |

## 4. Struktura App.jsx — główne komponenty

Numery linii są PRZYBLIŻONE (plik rośnie, używaj Grep zamiast twardych numerów).

```
~18     firebaseConfig, db, auth, storage, functions
~198    SK (Storage Keys), SEED_VEHICLES, SEED_CATEGORIES
~266    Utility functions (uid, fmtPLN, fmtEUR, fmtDate...)
~309    Constants (PALETTE, DOC_TYPES, COVERAGE_OPTIONS, INSURANCE_TYPES, CONTRACT_TYPES)
~361    TRIP SUMMARY HELPERS — TRIP_TOLERANCE_MIN, calcTripPunctuality,
        computeFuelConsumption, classifyFuel, computeTripStats, fmtTripDuration,
        TripTile, TripSummaryPanel
~555    CZAS PRACY KIEROWCY — REGULATION stałe (limity 561/2006),
        ACTIVITY_TYPES, normalizeSegment, sumByType, continuousDriveSince,
        preferDddSegments (priorytet DDD), computeDriverCompliance,
        computeDriverPlan, fmtTimeShort, atlasDateTimeToMs
~720    Icon components (IconTruck, IconTruckTrailer, VehicleIcon)
~731    LoginScreen
~938    ExportCostsModal
~1068   SprawaFileUpload, AttachmentList
~1130   exportCostsToExcel
~1177   DEFAULT_TABS_BY_ROLE, ADMIN_ONLY_TABS
~1186   App (główny komponent — state, sidebar, routing)
        + state driverActivities (listener onSnapshot kolekcji)
~4067   MobileChatOverlay
~4131   ChatTab
~5012   SprawyTab
~5828   EmailStatusTab
~6056   GpsTab ← z nowym selectedOrderId state + auto-detection driverActivities
~6416   VehicleOrdersSection ← NOWA (lista zleceń pod mapą, klikalna)
~6539   GpsMapSection ← trasa rzeczywista (Atlas history) vs planowana (OSRM)
~7244   GpsKilometrySection — dane CAN
~7400   GpsTrasySection — historia tras z Atlas /history
~7495   GpsCzasPracySection ← NOWA (sub-zakładka Czas pracy w GPS per pojazd)
~7952   GpsKartaSection — upload karty kierowcy
~8015   GpsDddSection ← przepisana, upload przez parseDddFile Cloud Function
~8200   ASSIGNABLE_TABS
~8220   AuditLogTab
~8400   UsersTab
~8865   PaymentsTab
~8950   DriverCzasPracyDashboard ← NOWA (mobile dashboard czasu pracy)
~9170   DriverDddUploadCard ← NOWA (upload DDD z telefonu kierowcy)
~9260   DriverPanel (główny, z dostępem do driverActivities)
~10600  ImiTab (+ ImiCard, ImiPreviewModal, ImiUploadModal)
~11700  DocsTab (+ DocStatusBadge, FilePreviewModal, BulkUploadModal, AddDocModal)
~12600  AddCostModal
~12850  RentownoscTab
~13400  TrendyTab
~13850  RentFormModal
~13975  ServisTab (+ ServiceEditForm, VehicleServicePanel)
~14350  DriverCopyRow
~14480  CzasPracyModal (stary kalendarz pauz — nie mieszać z nowym modułem Czas pracy)
~14780  VehicleEditPanel ← z nowymi polami spalanieNorma/spalanieAlarm
~15315  AddVehicleModal
~15460  Utility components (PageTitle, KpiCard, FSel, MF, MInput, MSelect)
~15517  DocUploadCell
~15650  CostsImportModal
~15875  FVTab
~16280  FrachtyTab ← przekazuje driverEvents i fuelEntries do Trip Summary
~16800  FrachtyImportModal
~17040  FVEditModal
~17100  ZlecenieUploadBtn
~17195  GeoPickerModal
~17295  FrachtyModal ← z TripSummaryPanel gdy statusRozladunku === "rozladowano"
```

## 5. GPS / Mapa — szczegóły techniczne

### Atlas API (widziszwszystko.eu) — OFICJALNE, UDOKUMENTOWANE
- Proxy przez Cloud Function `gpsProxy` (klucz API w Firestore `config/gps`)
- Dokumentacja: plik `api - ww-ms-atlas (1).pdf` — **12 endpointów**, żaden z nich nie daje tachografu
- Endpointy używane: `devices`, `positionsWithCanDetails`, `history`
- **Struktura odpowiedzi**:
  - Urządzenia: `data.deviceList[]`
  - Pozycje: `data.positionList[]`
  - Każda pozycja: `pos.coordinate.latitude / pos.coordinate.longitude` (zagnieżdżone)
  - Dane CAN: `pos.can.mileage.value`, `pos.can.voltage.value`, `pos.can.fuelLevel.value`
  - DateTime: obiekt `{year, month, day, hour, minute, seconds, timezone}` — **NIE unix timestamp**
  - Identyfikator urządzenia: `dev.deviceName` (nie `dev.plate`)

### `/rest-api/` z panelu beta.widziszwszystko.eu — NIE UŻYWAMY
Zauważony przy analizie Network tab ich panelu. **Nieudokumentowany, bez oficjalnej zgody = nie dotykamy.** Zachowujemy się etycznie — żadnego scrapowania ich interfejsu.

### Leaflet (mapa)
- **Załadowany przez CDN** (unpkg.com/leaflet@1.9.4) — NIE przez npm import
- Dostęp: `const L = window.L;`
- `react-leaflet@5.0.0` zainstalowany ale **NIE UŻYWANY** (wymaga React 19)
- Ikona ciężarówki: SVG `divIcon` z `L.divIcon({ html: '<svg>...</svg>' })`
- Markery trasy (uproszczone, bez kolorowych ramek):
  - Załadunek: emoji 🚩 (flaga) z drop-shadow
  - Rozładunek: emoji 📦 (paczka) z drop-shadow
- Tile layer: OpenStreetMap (darmowy)

### Trasa na mapie — dwa tryby
- **Planowana** (dla aktywnych zleceń): OSRM route, niebieska przerywana (`#3b82f6`, dashArray `10 6`)
- **Rzeczywista** (dla `statusRozladunku === "rozladowano"`): Atlas `/history` filtered by deviceId + okno czasowe trasy, **zielona solidna** (`#16a34a`)
- **Fallback** (rozładowane ale brak danych z `/history`): **jasnoniebieska przerywana** (`#60a5fa`, dashArray `8 5`) z adnotacją "Brak danych historycznych"
- Cache przez `lastRouteKeyRef` (`<frachtId>_<planned|real>`) — nie przerysowuje trasy przy refreshu pozycji

### Geokodowanie i routing (darmowe!)
- **Nominatim** (OSM): `nominatim.openstreetmap.org/search` → zamiana adres/kod pocztowy → [lat, lng]
- **OSRM**: `router.project-osrm.org/route/v1/driving/` → trasa z punktami, dystans, czas

### Auto-odświeżanie
- Pozycja pojazdu: **co 30 sekund** (fetch z Atlas API)
- Mapa NIE skacze: `initialViewSetRef` + `lastSelectedDevRef` blokują reset widoku
- Trasa zlecenia: cachowana — NIE przeliczana co 30s
- Trasy wyświetlane: tylko dla wybranego w liście (lub automatycznie aktywny fracht)

### Sub-zakładki GPS per pojazd
1. **Mapa** — pozycja live + trasa planowana/rzeczywista + lista zleceń pod spodem
2. **Kilometry** — dane CAN (przebieg, napięcie, paliwo)
3. **Trasy** — historia tras z Atlas `/history`
4. **Karta kierowcy** — upload plików karty
5. **Pliki DDD** — upload DDD przez parseDddFile Cloud Function
6. **Czas pracy** — compliance dashboard (NOWA sub-zakładka)

## 6. Struktura frachtu (zlecenia transportowe)

```javascript
{
  id, vehicleId, klient,
  dataZlecenia, dataZaladunku, dataRozladunku,
  godzZaladunku, godzRozladunku,
  // Punkty załadunku (do 3):
  zaladunekKod, zaladunekKod2, zaladunekKod3,
  zaladunekAdres, zaladunekGeo, zaladunekTelefon,
  // Punkty rozładunku (do 3):
  dokod, dokod2, dokod3,
  rozladunekAdres, rozladunekGeo, rozladunekTelefon,
  // Status:
  statusRozladunku,   // "rozladowano" = zakończony, inne = aktywny
  // Dane finansowe/logistyczne:
  cenaEur, kmPodjazd, kmLadowne, kmWszystkie,
  wagaLadunku, nrRef, nrZlecenia, nrFV,
  // NOWE dla Trip Summary:
  kmStart,  // auto-capture z CAN przy evencie start_rozladunek
  kmEnd,    // auto-capture z CAN przy evencie dotarcie_rozladunek
  urlZlecenie,
}
```

**Priorytet geokodowania**: geo (najdokładniejsze) → adres → kod pocztowy

## 7. Trip Summary — podsumowanie trasy (NOWY MODUŁ)

### Kolekcja `frachty` rozszerzona
Nowe pola per fracht: `kmStart`, `kmEnd` (auto z CAN), Trip Summary liczony w locie z `driverEvents`.

### Pojazd rozszerzony (`VehicleEditPanel`)
Nowe pola w sekcji "Dane techniczne":
- `spalanieNorma` — norma l/100km
- `spalanieAlarm` — próg alarmu l/100km
- Fallback gdy puste: 30/38 l/100km (rozsądne dla ciągników; dla Solo ~14/17)

### Komponent `TripSummaryPanel`
Warianty: `"full"` (admin), `"compact"` (expanded row FrachtyTab), `"driver"` (bez spalania).

Metryki:
- **Punktualność załadunku/rozładunku** — tolerancja ≤15 min = "Na czas", powyżej = "Spóźnienie X min"
- **Czas trasy** — od eventu `start_rozladunek` do `dotarcie_rozladunek` (czyste minuty jazdy)
- **Kilometry rzeczywiste** — z CAN: `kmEnd - kmStart` vs plan (OSRM `kmWszystkie`)
- **Średnia prędkość** — km/h
- **Spalanie** — z `fuelEntries` (pełne tankowania w oknie ±3 dni od trasy) vs progi pojazdu

Ocena ogólna: `ok`/`warn`/`alarm` (najgorszy status sub-metryk wygrywa).

### Auto-capture km z CAN w DriverPanel
W `updateFrachtStatus`:
- Event `start_rozladunek` → pobierz `pos.can.mileage.value` z Atlas → zapisz jako `kmStart`
- Event `dotarcie_rozladunek` → pobierz → zapisz jako `kmEnd`
- Fallback ręczny: pola edytowalne w DriverPanel w obu kafelkach (gdy CAN nie zwrócił) — source `manual_kmStart` / `manual_kmEnd`

### Placement
- `FrachtyModal` — full panel pod "Dane biurowe"
- `FrachtyTab` expanded row — compact panel
- `DriverPanel` (mobile, po rozładunku) — wariant "driver" bez spalania
- `VehicleOrdersSection` (pod mapą GPS) — full panel w expanded accordion
- `FrachtyTab` lista — pigułka oceny (OK/Uwaga/Alarm) inline przy każdym zakończonym zleceniu

## 8. Moduł Czas pracy kierowcy (NOWY MODUŁ)

### Kolekcja Firestore `driverActivities`
Schema:
```javascript
{
  id,
  driverEmail: string,        // email kierowcy z vehicles.driverHistory
  driverCardNumber?: string,  // dla segmentów z DDD
  driverName?: string,        // dla segmentów z DDD
  vehicleId: string,
  type: "drive" | "work" | "avail" | "rest",
  startTs: ISO string,
  endTs: ISO string | null,   // null = segment otwarty (trwa)
  source: "auto_gps" | "manual" | "ddd" | "fracht_event",
  dddFileId?: string,         // referencja do dddFiles gdy source=ddd
  createdAt: ISO string,
}
```

Listener w App.jsx: `const [driverActivities, setDriverActivities] = useState([])` + `onSnapshot(collection(db, "driverActivities"))`.

### Stałe `REGULATION` (rozp. 561/2006 + Pakiet Mobilności)
```
DAILY_DRIVE_REGULAR: 9h (540 min)
DAILY_DRIVE_EXTENDED: 10h (600 min) — max 2× w tygodniu
CONTINUOUS_DRIVE: 4.5h (270 min) — po tym wymagana przerwa 45 min
WEEKLY_DRIVE: 56h (3360 min)
BIWEEKLY_DRIVE: 90h (5400 min)
DAILY_REST_REGULAR: 11h (660 min)
DAILY_REST_REDUCED: 9h (540 min) — max 3× między tygodniowymi odpoczynkami
WEEKLY_REST_REGULAR: 45h (2700 min)
WEEKLY_REST_REDUCED: 24h (1440 min) — max 2× w 2 kolejnych tygodniach, wymaga kompensaty
WORK_TIME_WEEKLY_AVG: 48h (2880 min) — średnia w okresie rozliczeniowym
RETURN_TO_BASE_DAYS: 28 — Pakiet Mobilności
```

### Typy aktywności (`ACTIVITY_TYPES`)
| ID | Label | Icon | Color |
|----|-------|------|-------|
| `drive` | Jazda | 🚛 | #2563eb (niebieski) |
| `work` | Inna praca | 🔧 | #f59e0b (żółty) |
| `avail` | Dyspozycyjność | ⏱ | #64748b (szary) |
| `rest` | Odpoczynek | 🛏 | #22c55e (zielony) |

### Główne funkcje
- **`computeDriverCompliance(segments, periodStart, now)`** — zwraca pełen obiekt compliance:
  - `daily` (drive, work, avail, rest, limit, extendedDaysUsed)
  - `weekly` (drive, workTime, limit)
  - `biweekly` (drive, limit)
  - `continuousDrive` (od ostatniej przerwy)
  - `period28` (daysPassed, daysLeft, deadlineMs)
  - `currentStateType` (obecny segment otwarty)
  - `hasDdd` + `sources` (breakdown)
- **`computeDriverPlan(compliance, now)`** — planuje do przodu:
  - `nextBreak` (driveMinToGo, atMs, endMs, 45 min)
  - `endOfDay` (driveMinToGo, atMs, dailyLimit)
  - `dailyRest` (startMs, endMs, 11h)
  - `weeklyRest` (startMs, endMs, 45h)
  - `returnToBase` (deadlineMs, daysLeft)
- **`preferDddSegments(segments)`** — gdy są segmenty DDD, filtruje GPS/manual w tych zakresach (priorytet tachografu)

### Auto-detection z GPS (w GpsTab)
Co 30s przy odświeżaniu pozycji:
1. Dla każdego pojazdu z aktywnym kierowcą (`vehicle.driverHistory.find(d => !d.to)`)
2. Sprawdź prędkość w `gpsPositions`: `speed > 3 km/h` = `drive`, inaczej = `rest`
3. Znajdź ostatni otwarty segment (`endTs: null`) dla tego kierowcy
4. Jeśli typ się zmienił + segment ma `source: "auto_gps"` — zamknij stary, otwórz nowy
5. Segmenty `manual` i `ddd` NIE są nadpisywane przez automat (priorytet kierowcy/tachografu)

Rate-limit: max raz na 25s przez `autoDetectRef`.

### Ręczne kliknięcia kierowcy (DriverPanel)
4 przyciski: Jazda / Inna praca / Dyspozycyjność / Odpoczynek.
Handler `setActivity(type)`:
1. Zamknij ostatni otwarty segment tego kierowcy (jeśli istnieje, inny typ)
2. Dodaj nowy segment z `source: "manual"`

### Widoki

**`GpsCzasPracySection`** — admin, sub-zakładka ⏱️ Czas pracy w GPS/Monitoring per pojazd:
- Nagłówek z pojazdem, kierowcą, badge źródła (`✓ Dane z tachografu` / `Auto-wykrywanie GPS`), okres 28-dni
- 4 KPI live: Status, Do przerwy, Jazda dzisiaj, Powrót do bazy
- Plan do przodu — 5 kart (przerwa 45, koniec dnia, odp. 11h, odp. 45h, powrót do bazy)
- Sumy dnia — 4 kafelki po typie aktywności
- Limity compliance — 5 pasków progresu (dzienna/ciągła/tygodniowa/dwutygodniowa/czas pracy)
- Historia 24h — lista segmentów z oznaczeniem źródła

**`DriverCzasPracyDashboard`** — mobile, dostępny z panelu kierowcy → zakładka Czas pracy:
- Status aktualny z pulsującą kropką
- Duży licznik do przerwy (zmienia kolor: żółty → czerwony → alarm)
- Dzisiaj — 4 kafelki KPI
- Plan do przodu — 5 kart
- Okres 28-dniowy + sub-limity
- 4 przyciski akcji
- `DriverDddUploadCard` (NOWE) — upload pliku .ddd z telefonu z drag&drop

## 9. Parser DDD (NOWY MODUŁ)

### Cloud Function `parseDddFile` (onCall, europe-west1)
Auth: admin lub dyspozytor.
Input: `{ storagePath, originalFileName }`
Flow:
1. Pobierz plik z Firebase Storage
2. `readesm-js.convertToJson(arrayBuffer)` → surowy JSON z blokami
3. `extractDddMetadata(parsed)` — wyciąga:
   - `fileType`: "card" / "vu" / "unknown"
   - `cardNumber`, `driverFirstName`, `driverSurname`, `driverName`
   - `vehicleVrn` (rejestracja)
   - `cardValidityBegin`, `cardExpiryDate`
   - `periodStart`, `periodEnd` (zakres danych)
4. `extractDddActivities(parsed, context)` — wyciąga segmenty aktywności z dokładnością do sekundy, mapuje typy tachografu (0/1/2/3) na nasze (`rest`/`avail`/`work`/`drive`)
5. Zapisuje metadane do kolekcji `dddFiles`
6. Zapisuje aktywności do `driverActivities` z `source: "ddd"` + `dddFileId` (w batchach po 400)
7. Zwraca `{ success, fileId, metadata, activitiesCount }`

### Kolekcja `dddFiles`
```javascript
{
  id,
  storagePath,
  originalFileName,
  uploadedBy: email,
  uploadedAt: ISO,
  fileSize: bytes,
  fileType, cardNumber, driverName, vehicleVrn,
  periodStart, periodEnd,
  blockCount, activitiesCount,
  parseStatus: "success" | "error",
}
```

### UI uploadu
- **Admin**: `GpsDddSection` (GPS/Monitoring → 💾 Pliki DDD per pojazd)
  - Drag&drop, instrukcja skąd pobrać plik (widziszwszystko Premium → Harmonogramy DDD → Pliki .ddd)
  - Live lista plików przez `onSnapshot(dddFiles)`
  - Każda karta: typ, kierowca, pojazd, zakres dat, status, liczba aktywności
- **Kierowca**: `DriverDddUploadCard` w DriverCzasPracyDashboard
  - Mobile-friendly, duży przycisk file picker
  - Natychmiastowy feedback zielony/czerwony banner z rezultatem
  - Obsługiwane: `.ddd`, `.esm`, `.tgd`, `.v1b`

### Biblioteka `readesm-js` v1.0.12
Zainstalowana w `functions/package.json`. Port JavaScript z sourceforge readesm.
Export `convertToJson(ArrayBuffer)`.
**Uwagi**:
- Biblioteka starsza (2020), może nie obsługiwać Smart Tachograph Gen2v2 (2023+) idealnie
- `findBlock()` w parserze używa heurystyk (className + charakterystyczne pola) — jak pierwszy rzeczywisty plik wpadnie, łatwo dostosujemy

## 10. Deployment

### Produkcja (fleetstat.pl)
1. `npm run build` (Vite → `dist/`) — opcjonalne, Vercel sam buduje
2. `git add . && git commit && git push` (branch `main`)
3. Vercel automatycznie buduje i deployuje
4. **NIE używać `firebase deploy --only hosting`** — to trafia na vbs-stats.web.app (backup)

### Cloud Functions (osobno od frontendu!)
```bash
# Wszystkie functions
firebase deploy --only functions

# Pojedyncza funkcja (szybciej)
firebase deploy --only functions:parseDddFile
firebase deploy --only functions:gpsProxy
```

### Service Worker
- `public/sw.js` cache name: `fleetstat-v3`
- Wyklucza Vite hashed files: `assets/index-*.js|css`
- Przy problemach z cache: bump version, user musi wyczyścić dane witryny

### Vercel
- Wymaga `.npmrc` z `legacy-peer-deps=true`
- Auto-deploy z GitHub na push do `main`

## 11. Konwencje kodu

- **Monolityczny plik** — wszystko w `src/App.jsx`
- **Inline styles** + **Tailwind CSS** (mieszane)
- **JSX transform** — NIE importować React
- **Firebase v10** — modularny import (`getFirestore`, `collection`, `doc`...)
- **Leaflet przez CDN** — `window.L`, NIE `import L from 'leaflet'`
- **Funkcje pomocnicze**: `uid()`, `fmtPLN()`, `fmtEUR()`, `fmtDate()`, `logAction()`, `fmtHM()` (Czas pracy), `fmtTimeShort()`
- **Toast**: `showToast(message)` — wyświetla notyfikację
- **Firestore collections**: przez SK object (`SK.vehicles`, `SK.costs`, `SK.frachty`...) + osobne kolekcje (`driverEvents`, `driverActivities`, `fuelEntries`, `dddFiles`, `operacyjne`, `pauzy`, `sprawy`, `chatRooms`, `fcmTokens`, `auditLog`, `rentownosc`, `users`, `config`, `emailRecipients`, `emailLogs`)
- **Role**: `admin`, `dyspozytor`, `podglad`, `kierowca`
- **Commit message**: po polsku lub angielsku

## 12. Stan integracji z widziszwszystko (stan na 2026-04-21)

### Atlas API — używamy
Dokumentacja oficjalna w pliku `api - ww-ms-atlas (1).pdf`. 12 endpointów (6 + 6 w wariancie `/shares/`). Autoryzacja: base64(password) w headerze Authorization. Nasze Cloud Function `gpsProxy` obsługuje wszystkie metody auth.

### Moduł Harmonogramy DDD (Premium) — aktywny u nas
- **WGM 0475M**: urządzenie ma moduł do zdalnego odczytu DDD — zamontowane
- **Pozostałe 5 pojazdów**: sprzęt opłacony, czeka na instalację (pojazdy wracają do bazy)
- Konfiguracja harmonogramów pobierania plików DDD w panelu widziszwszystko (auto co 28 dni dla karty, co 90 dni dla tachografu)

### Potwierdzona odpowiedź od widziszwszystko (2026-04-21)
| Pytanie | Odpowiedź |
|---------|-----------|
| Automatyczne wysyłanie DDD na email | ❌ **Nie ma, ale w planach** (cron + moduł "listonosz") |
| API do pobierania DDD | ❌ **Nie ma i nie planują** |
| Sprzęt do zdalnego odczytu | ⚠️ Tylko 1 z 6 pojazdów (resztę zainstalujemy) |

### Flow dla plików DDD (aktualny)
```
Tachograf w pojeździe
  ↓ (zdalnie, harmonogram widziszwszystko — automat)
Serwer widziszwszystko (panel Premium → Harmonogramy DDD → Pliki .ddd)
  ↓ (admin pobiera ręcznie: "Pokaż pliki" → "Pobierz")
Plik .ddd lokalnie
  ↓ (upload przez FleetStat → GPS/Monitoring → Pliki DDD lub panel kierowcy)
Firebase Storage → Cloud Function parseDddFile → readesm-js
  ↓
driverActivities (z source="ddd", priorytet nad GPS)
```

## 13. Co zostało zrobione (chronologicznie — 2026-04-21)

1. ✅ Rozszerzenie dokumentów o ubezpieczenia i umowy (DOC_TYPES, coverage, contract)
2. ✅ AI prompt w BulkUploadModal — auto-match nowych pól
3. ✅ Fix: fileData do Firebase Storage (zamiast Firestore 1MB limit)
4. ✅ Reorganizacja sidebar — grupa "Pojazdy" z podgrupami
5. ✅ Przeniesienie GPS z Email do grupy Pojazdy
6. ✅ Cloud Function `gpsProxy` — proxy do Atlas API
7. ✅ GPS dashboard z zakładkami per pojazd
8. ✅ Mapa live z ikoną ciężarówki SVG
9. ✅ Auto-trasa zlecenia (Nominatim + OSRM)
10. ✅ Fix: mapa nie skacze przy auto-refresh
11. ✅ Panel trasy nie miga (cache + filtr aktywnych)
12. ✅ Usunięcie zbędnych markerów z mapy
13. ✅ **Trip Summary** — pełny moduł z auto-capture km z CAN, progami spalania per pojazd, panelem w 4 miejscach + fallback ręczny w DriverPanel
14. ✅ **GPS mapa — rzeczywista trasa z Atlas /history** dla rozładowanych, planowana OSRM dla aktywnych, fallback jasnoniebieski
15. ✅ **VehicleOrdersSection** — lista zleceń pojazdu pod mapą z klikalnym accordion
16. ✅ **Moduł Czas pracy kierowcy MVP** — stałe rozp. 561/2006, compliance engine, plan do przodu, auto-detection GPS, ręczne kliknięcia, widoki admin+mobile
17. ✅ **Parser DDD end-to-end** — Cloud Function parseDddFile z readesm-js, UI uploadu dla admina i kierowcy, priorytet DDD nad GPS w compliance
18. ✅ Cleanup diagnostyki Atlas API (etyka — nie scrapujemy ich rest-api bez zgody)
19. ✅ `.gitignore` rozszerzony o `dist-*/`

## 14. Co w planie (NASTĘPNE ZADANIA)

### A. Moduł Czas pracy — iteracja 2
- **Kompensaty** — auto-wykrywanie skróconych odpoczynków (9h zamiast 11h, 24h zamiast 45h) + deadline nadrobienia (np. do najbliższego regularnego odpoczynku)
- **Alerty w banerze** — gdy kierowca < 30 min do wymagalnej przerwy, czerwony banner w panelu mobile i w panelu admina
- **Timeline 7-dniowy** — kolorowe paski 24h per dzień (z zatwierdzonego mockupu `preview-czas-pracy.html`)
- **Push notifications** — Cloud Function wysyła FCM 30 min przed obligatoryjną przerwą

### B. Parser DDD — dopracowanie
- Test end-to-end na pierwszym prawdziwym pliku z WGM 0475M (za ~28 dni)
- Dostosowanie heurystyk `findBlock()` do struktury jaką zwraca `readesm-js` dla prawdziwego DDD
- Obsługa Smart Tachograph Gen2v2 jeśli stara biblioteka nie obsłuży

### C. Porównanie trasy planowanej vs rzeczywistej (visual)
- Nałożenie obu tras na mapie (planowana + historia Atlas) — już częściowo jest (przełączanie), ale chcemy OBOK siebie
- Wykrywanie odchyleń od trasy (zjazd, objazd)

### D. Z roadmapy ZASADY-VBS-STAT.md
- SendGrid na Cloud Functions
- **Code splitting App.jsx** — bundle 1.77 MB, dla mobile za duży
- Rate limiting na /api/claude
- Weryfikacja kosztów sty–maj 2025 (netto/brutto)
- Migracja Firestore Timestamp w czatach (fix chronologii wiadomości)

### E. Integracja czatu z WhatsApp (pomysł — model Slickshift)
**Cel**: Dyspozytor pisze w FleetStat chat → kierowca dostaje wiadomość na WhatsApp; odpowiedź kierowcy z WhatsApp wraca do FleetStat chat. Identyczny model jak obecnie używany Slickshift.

**Stack**: WhatsApp Business Cloud API (Meta, oficjalne) — bezpośrednio lub przez BSP (Twilio/360dialog).

**Architektura**:
- Cloud Function `whatsappWebhook` (HTTPS, publiczna) — odbiera wiadomości od Meta, mapuje `from` (numer telefonu) → kierowca (`users` / `vehicles.driverHistory`) → zapis do odpowiedniego `chatRooms`
- Cloud Function `sendWhatsappMessage` (onCall) — dyspozytor wysyła wiadomość → CF woła Meta Graph API → dostarczenie na telefon kierowcy
- Rozszerzenie schematu wiadomości w `chatRooms` o `channel: "whatsapp" | "app"` + `deliveryStatus`
- Templatki do wiadomości inicjujących (np. "Nowe zlecenie #{{1}}, załadunek {{2}} o {{3}}") — wymaga aprobaty Meta

**Koszty** (dla floty 6 pojazdów):
- Cloud API: 1000 service conversations/mies darmo, potem ~0,02 EUR/rozmowa → praktycznie 0
- Twilio (jeśli wybierzemy): +~0,005 USD/msg + opłaty Meta — droższe ale prostszy setup

**Blokery/setup** (główny tradeoff — to nie jest "1 dzień pracy"):
- Weryfikacja Meta Business Account (dni–tygodnie)
- Aprobata templatek (każda nowa templatka osobno, zwykle 24-48h)
- Numer telefonu firmy dedykowany do Cloud API — **po podpięciu przestaje działać w zwykłym WhatsApp Business App** (decyzja: nowy numer czy port obecnego?)
- 24h "service window" — po odpowiedzi kierowcy masz 24h na wolne wiadomości, potem znów templatka

**Decyzje do podjęcia przed startem**:
1. Cloud API bezpośrednio czy przez Twilio/BSP?
2. Który numer firmowy przeznaczyć?
3. Lista template'ów (nowe zlecenie, zmiana godziny, pytanie dyspozytora, potwierdzenie rozładunku...)

## 15. Znane problemy / uwagi

- **Duplicate "style" attribute** warning w JSX (linia ~5270) — kontekst menu czatu ma dwa atrybuty `style`. Nie blokuje builda.
- **Chunk size warning** — `index-*.js` = 1.77 MB (gzip 441 KB). Dla mobile trochę dużo — iteracja na code splitting w planach.
- `react-leaflet@5.0.0` zainstalowany ale nieużywany — zostawiony, usunięcie wymaga `.npmrc` cleanup.
- Vercel build wymaga `.npmrc` z `legacy-peer-deps=true`.
- **Parser DDD** — `readesm-js` z 2020, może nie obsługiwać Gen2v2 (2023+) tachografów — dostosujemy na pierwszym prawdziwym pliku.
- **Czas pracy kierowcy MVP** — MVP bazuje na prędkości GPS, może być niedokładne dla krótkich postojów (<2 min) — dopiero DDD daje pełną precyzję.

## 16. Zmienne środowiskowe / konfiguracja

- **Firebase config**: hardcoded w App.jsx (apiKey publiczny — normalne dla Firebase web)
- **Atlas GPS API key**: w Firestore `config/gps` → `{ group, username, password }`
- **Atlas API URL**: `https://widziszwszystko.eu/atlas/{group}/{username}/{endpoint}`
- **Nominatim**: publiczny, darmowy, bez klucza
- **OSRM**: publiczny, darmowy, bez klucza
- **Vercel**: auto-deploy z GitHub, konfiguracja w panelu Vercel
- **SendGrid API key**: Firestore `config/email`

## 17. Flota (6 pojazdów)

| ID | Rejestracja | Typ | Marka | Ma moduł DDD? |
|----|-------------|-----|-------|---------------|
| v1 | **WGM 0475M** | Solo | Iveco 2021 | ✅ TAK (test jutro) |
| v2 | TK 130EF | Bus | Renault Master 2020 | ⏳ sprzęt opłacony, czeka na instalację |
| v3 | WGM 5367K | ? | ? | ⏳ sprzęt opłacony |
| v4 | TK 314CL | ? | ? | ⏳ sprzęt opłacony |
| v5 | WGM 0507M | ? | ? | ⏳ sprzęt opłacony |
| v6 | TK 315CL | ? | ? | ⏳ sprzęt opłacony |

**Pomijane rejestracje (nie nasze):** OKAZICIEL3/4/5, TRUCK, TK135AM, UNIVERSAL5570

## 18. Kluczowe komendy (kopiuj-wklej)

```bash
# Build lokalny (Mac — sprawdzenie składni)
cd ~/Desktop/VBS-Stat.nosync && npm run build

# Czysty build (gdy Vite cache się zacina)
cd ~/Desktop/VBS-Stat.nosync && rm -rf dist node_modules/.vite && npm run build

# Deploy frontendu (Vercel — auto po push)
cd ~/Desktop/VBS-Stat.nosync && git add . && git commit -m "opis" && git push

# Deploy Cloud Functions
cd ~/Desktop/VBS-Stat.nosync && firebase deploy --only functions

# Deploy pojedynczej Cloud Function (szybciej)
cd ~/Desktop/VBS-Stat.nosync && firebase deploy --only functions:parseDddFile

# Deploy Firestore rules
cd ~/Desktop/VBS-Stat.nosync && firebase use vbs-stats && firebase deploy --only firestore:rules

# Logi Cloud Function
firebase functions:log --only parseDddFile | tail -20
firebase functions:log --only gpsProxy | tail -20

# Dev server (lokalnie)
cd ~/Desktop/VBS-Stat.nosync && npm run dev

# Gdy git lock file blokuje
rm -f .git/index.lock
```

## 19. Role i użytkownicy

- **Admin**: Kamil (wasik.kamil@gmail.com) — pełny dostęp
- **Dyspozytor**: dostęp do frachtów, spraw, czatu, GPS
- **Podgląd**: tylko odczyt
- **Kierowca**: osobny panel mobile (DriverPanel)

Użytkownicy w Firestore `users/{uid}` z polem `role`. Cloud Function `onRoleChange` synchronizuje rolę z Firebase Auth Custom Claims.

---

*Wygenerowano: 2026-04-21 (pełna aktualizacja po sesjach Trip Summary, GPS, Czas pracy, DDD Parser)*
