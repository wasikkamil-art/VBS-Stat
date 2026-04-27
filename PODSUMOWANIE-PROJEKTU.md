# FleetStat (fleetstat.pl) — Podsumowanie projektu

> Dokument do przeniesienia do nowego chatu. Zawiera pełny kontekst: architektura, pliki, API, konwencje, co zrobiono, co w planie.

*Ostatnia aktualizacja: 2026-04-27 (duża sesja: Tracker dla zleceniodawcy + Inbound CSV widziszwszystko + Performance + Admin status kierowcy)*

---

## 0. STAN AKTUALNY (TL;DR dla nowego chatu)

**Co działa w produkcji (`fleetstat.pl`)** — stan 2026-04-27:

### 🆕 Tracker dla zleceniodawcy — publiczna strona /t/{token}
1. **Cloud Function `trackerData`** (HTTP, publiczna, CORS, region europe-west1):
   - Input: `?token=xxx` (UUID zapisany w `fracht.trackerToken`).
   - Wykrywanie 2 rozładunków (`hasR2`) po polach `dokod2/dokodMiasto2/rozladunekGeo2`.
   - Najnowszy `gpsBreadcrumbs` jako pozycja (max 1 min stara dzięki `scheduledGpsPoll`).
   - OSRM multi-waypoint dla 1 i 2 rozładunków (`pos → R1` lub `pos → R1 → R2`).
   - **ETA z tacho** — iteracyjnie uwzględnia 45 min przerwy co 4.5h jazdy + 11h odpoczynku po limicie 9h dziennie (compliance z `driverActivities` ostatnie 7 dni).
   - **activeStep 0..3 (lub 0..4 dla hasR2)**: Dojazd → Załadowano → W trasie/Rozładunek 1 → (Rozładunek 2 →) Dostarczono. Bazuje na eventach kierowcy: `dotarcie_zaladunek`, `start_rozladunek`, `dotarcie_rozladunek` (z respektem `cofnij_*`).
   - **Toggle on/off** — pole `fracht.trackerEnabled` (default true). `false` → 403 `error: "disabled"` → klient widzi „Śledzenie wyłączone".
   - **Photos respektujące `fracht.trackerShow`**: cmrZal / cmrRoz (lub cmrRozR1/cmrRozR2 dla hasR2 — split po ts drugiego `dotarcie_rozladunek`) / towar (z załadunku) / damage (uszkodzenia po rozładunku).
   - Response: nrZlecenia, vehiclePlate, vehicleMaxWeight, hasR2, activeStep, lat/lng, kmTotal/kmRemaining/percentDone, etaMs, plannedMs, plannedR1Ms, plannedR2Ms, plannedLoadMs, kmToR1/kmTotalR1/percentToR1 (gdy hasR2), photos{cmrZal/cmrRoz/cmrRozR1/cmrRozR2/towar/damage}, delayMin, breakMinutes, updatedAt.

2. **TrackerPublicView** (komponent w App.jsx, render gdy `pathname.startsWith("/t/")` w `Root`):
   - Layout: logo FleetStat na górze + karta z logo VBS po prawej (`vbs-logo.png` wyciągnięty z brand_manual str. 8 — granatowe litery + żółty element).
   - Header karty: „Zlecenie nr {nrZlecenia}" + badge auta `🚛 WGM 0475M · 3 000 kg`.
   - **Stepper dynamiczny**: 4 kroki (Dojazd → Załadowano → W trasie → Dostarczono) lub 5 (Dojazd → Załadowano → Rozładunek 1 → Rozładunek 2 → Dostarczono) gdy hasR2.
   - **Pasek postępu**: jeden % gdy 1 rozładunek; dla hasR2 dwa paski — Rozładunek 1 (jasnoniebieski) + Rozładunek 2 (ciemnoniebieski). Gdy `activeStep >= 3` pasek R1 wymuszany na 100% zielony „✅ Rozładowano" (OSRM dalej widzi km do R1, klamerka).
   - **Karty dat** zmieniają się po realizacji etapu: Załadunek → „✅ Załadowano" gdy step≥1, Rozładunek 1 → „✅ Rozładowano" gdy step≥3, Rozładunek 2 → „✅ Dostarczono" gdy step≥4 (zielone tło zamiast szarego).
   - **GPS link**: „📍 Aktualna pozycja: 50.8411, 6.1564 · Otwórz w mapach →" (Google Maps `?q=lat,lng`) — tylko dla `w_trasie`.
   - **Status banner**: na czas / opóźnienie / w trasie (zielony/pomarańczowy/niebieski). Notka „Przewidywany czas dostawy uwzględnia wymagane przerwy kierowcy" + dla hasR2 dodatkowo „czas dotarcia do rozładunku 2 może ulec zmianie — zależy od czasu rozładunku przy pierwszym adresie".
   - **Galerie zdjęć** (TrackerPhotoCard, kolejność wg drogi kierowcy, bez liczników po tytule):
     - 📄 CMR z załadunku
     - 📦 Zdjęcie towaru z załadunku
     - 📄 CMR z rozładunku (lub osobno R1 + R2 dla hasR2 — split po ts drugiego `dotarcie_rozladunek`)
     - ⚠️ Zdjęcie towaru po rozładunku (uszkodzenia, opcjonalne)
   - Polling `fetch trackerData` co 30s. „Ostatnia aktualizacja: X min temu" z `tick` co 60s.
   - Ekrany specjalne: `not_found` (link wygasł), `disabled` (Śledzenie wyłączone — nadawca zamknął dostęp), `przed_trasa` (Oczekiwanie na wyjazd), `zakonczony` (Dostawa zrealizowana).

3. **`SendTrackerLinkModal`** w FrachtyModal (przycisk **🔗 Wyślij tracker** dla zapisanych frachtów):
   - Generuje `trackerToken` (crypto.randomUUID) przy pierwszym otwarciu, persist przez `onPatch`.
   - Status włączony/wyłączony z przyciskiem Wyłącz/Włącz (ten sam token dalej działa po włączeniu).
   - 4 checkboxy „Co pokazać zleceniodawcy" (persist w `fracht.trackerShow`):
     - 📄 CMR z załadunku
     - 📦 Zdjęcie towaru z załadunku
     - 📄 CMR z rozładunku
     - ⚠️ Zdjęcie towaru po rozładunku
   - Link: `https://fleetstat.pl/t/{token}` + przyciski Kopiuj / WhatsApp zleceniodawcy / Email zleceniodawcy (mailto:).

4. **`TrackerPill`** badge w FrachtyTab (mobile + desktop) — tylko gdy `trackerToken` istnieje:
   - 🟢 Tracker (zielony) = link działa | 🔴 Tracker off (czerwony) = wyłączony.
   - Klik z confirm → toggle `trackerEnabled` przez `onUpdate`.

5. **Routing `/t/*`**:
   - W `Root` na początku: `if pathname.startsWith("/t/") return <TrackerPublicView token={...} />`.
   - **`vercel.json`**: `{ "rewrites": [{ "source": "/t/:path*", "destination": "/" }] }` — wymagane dla SPA fallback (przy bezpośrednim wejściu z paska adresu Vercel zwracał 404 bez tego).

### 🆕 Inbound CSV widziszwszystko — automatyczny import raportu „Karta drogowa szczegółowa"
Po otrzymaniu pierwszego sample CSV (2026-04-27), zbudowany pełen pipeline auto-importu:

1. **DNS MX** dla `inbox.fleetstat.pl` → `mx.sendgrid.net` (priorytet 10) — dodany w panelu home.pl.
2. **SendGrid Inbound Parse** — Settings → Inbound Parse, hostname `inbox.fleetstat.pl`, destination URL `https://europe-west1-vbs-stats.cloudfunctions.net/wwReportInbound`. Spam check off, raw MIME off.
3. **Cloud Function `wwReportInbound`** (HTTP, publiczna, multipart/form-data 512MiB / 120s):
   - Parser multipart przez `busboy`.
   - CSV przez `csv-parse/sync` (kolumny: `object,type,start,end,address,distance`).
   - Match `object` (rejestracja) → `vehicle.id` (case-insensitive, strip whitespace, partial match).
   - Match driver → `vehicle.driverHistory` aktywny w dniu raportu (lub fallback najnowszy bez `to`).
   - Mapowanie typów: `Jazda → drive`, `Postój → rest`, `Brak danych → skip`, `Inna praca → work`, `Dyspozycyjność → avail`.
   - **Dedup**: usuwa istniejące `auto_gps` i `ww_csv` segmenty w przedziale (CSV ma priorytet nad GPS). Wymaga composite index `driverEmail ASC + startTs ASC` — zdeployowany.
   - Batch write 400 segmentów per commit. Source `ww_csv`. Pola: address, distanceKm, createdAt.
   - Audit log do kolekcji `auditLog` z `action: ww_csv_import, source: email_inbound`.
4. **`preferDddSegments`** rozszerzone — priorytet **DDD > ww_csv > manual > auto_gps**. Wyższe źródło wycina niższe z tych samych przedziałów czasowych.
5. **Adres odbiorczy w widziszwszystko**: `imports@inbox.fleetstat.pl` — dodany jako Dodatkowy email #2, do wyboru w raportach cyklicznych.
6. **Test end-to-end OK**: 8 segmentów (z 9-wierszowego CSV, 1 „Brak danych" pominięty) zaimportowanych do `driverActivities`.

### 🆕 Performance — kasowanie wahań ładowania (1s vs 30s na iPhone)
1. **Service Worker v3 → v4** (`public/sw.js`): hashed assets Vite (assets/*-HASH.js|css|woff2) **cache first** (były bypass cache). index.html jako stale-while-revalidate. Bundle ładuje się **instant z 2-giego otwarcia**.
2. **Firestore IndexedDB persistence** (`initializeFirestore` z `persistentLocalCache + persistentMultipleTabManager`) — dane lokalnie, instant przy ponownym otwarciu, sync w tle, działa offline. Fallback do `getFirestore()` gdy IndexedDB niedostępny (Safari prywatne, niektóre webview).
3. **`<link rel="preconnect">`** w index.html — handshake z `firestore.googleapis.com`, `firebaseinstallations`, `identitytoolkit`, `firebaseappcheck` + dns-prefetch dla storage/cloudfunctions. Skraca pierwszy fetch o 200-500 ms.

### 🆕 Admin FrachtyTab expanded row — Status kierowcy z chronologią per faza
- Eventy CMR/foto/uwagi **wcięte pod swoim nagłówkiem** (Załadunek/Rozładunek), bez sztucznych boksów „FAZA ZAŁADUNKU".
- Mały bullet 6×6 px (vs 10×10 px głównych eventów), wcięcie 28 px.
- **Split per faza po `dotarcie_rozladunek.ts`** (NIE po `start_rozladunek.ts` — kierowca często robi zdjęcia/CMR w trakcie jazdy do rozładunku, to wciąż faza załadunkowa).
- **Dla 2 rozładunków** (`hasR2`): osobne sekcje „Rozładunek 1" / „Rozładunek 2", każda z własnym planem (`dataRozladunku` / `dataRozladunku2`). Eventy podzielone wg ts drugiego `dotarcie_rozladunek` (kierowca klika 2x — pierwszy = R1, drugi = R2). Edycja czasu dotarcia: dla R1 i pojedynczego rozładunku jak wcześniej (manualEv form), R2 read-only (TODO: rozszerzyć).
- Nagłówki: dla 1 rozładunku „Rozładunek", dla hasR2 — „Rozładunek 1" + „Rozładunek 2".

### Moduły GPS/Monitoring (działa 24/7 — bez zmian od 24.04)
1. **`scheduledGpsPoll` Cloud Function** (cron `* * * * *` — co 1 minutę): fetch Atlas `positionsWithCanDetails` → `gpsBreadcrumbs/{vehicleId}/points/{ts}` + auto-detect driverActivities. Jedyny producent `auto_gps`.
2. **`scheduledHistorySync` Cloud Function** (cron `0 3 * * *` — 3:00 CET): nocny sync Atlas `/history` → uzupełnia breadcrumby.
3. **`cleanupBreadcrumbs` Cloud Function** (cron `30 2 * * *`): kasuje punkty > 7 dni.
4. **Firestore composite indexes**: `driverActivities (driverEmail ASC + startTs DESC)` + `(driverEmail ASC + startTs ASC)` (drugi dla wwReportInbound dedup).

### GpsTrasySection — czytelność (bez zmian od 24.04)
- Czas faktycznej jazdy (speed > 3, gap < 15 min) zamiast doby. Pasek: km · hh:mm → hh:mm · Jazda · Postoje · pkt GPS.
- Markery Start/Koniec jako kolorowe kropki 18 px z labelem czasu pod spodem (bez liter S/K — czyste).
- OSRM map-matching dla wizualu, km z raw haversine, sanity check (matched > 3× raw → fallback raw), outlier filter > 200 km/h.

### GpsMapSection (Mapa online) — bez zmian od 24.04
- Ikona pojazdu: kółko ze strzałką wg `course/heading/bearing` Atlas; pamięć widoku (localStorage `gpsMapView`); breadcrumb 24h jako kropki canvas; outlier filter > 200 km/h.

### DriverPanel (mobile kierowcy) — bez zmian od 24.04
- CMR załadunek + rozładunek multi-foto z badge i delete; zdjęcia towaru/uszkodzeń bez `capture="environment"` (galeria + aparat).

### FrachtyModal — rozbudowa (bez zmian od 24.04 + nowe „Wyślij tracker")
- „📋 Kopiuj dane" → CopyOrderPreviewModal (Z1+Z2+R1-R5 bez km/ceny).
- „🔗 Wyślij tracker" → SendTrackerLinkModal (NOWE, sekcja powyżej).
- „📱 Wyślij na WhatsApp" → WhatsappSendPreviewModal (gdy kierowca ma whatsappNumber).

### GeoPickerModal, Banner „Nowa wersja", GpsCzasPracySection manual, FrachtyTab fix SUMA, GpsMapSection buildPlanned multi-stop — bez zmian od 24.04.

### Moduły GPS/Monitoring (nowe, działa 24/7)
1. **`scheduledGpsPoll` Cloud Function** (cron `* * * * *` — co 1 minutę, Europe/Warsaw): fetch Atlas `positionsWithCanDetails` dla floty → zapis do `gpsBreadcrumbs/{vehicleId}/points/{ts}` + auto-detect driverActivities (speed > 3 km/h = drive, else rest). Działa 24/7 niezależnie od sesji. **Jedyny producent auto_gps segmentów** — client-side auto-detect WYŁĄCZONY.
2. **`scheduledHistorySync` Cloud Function** (cron `0 3 * * *` — 3:00 CET): pobiera Atlas `/history` wczorajszego dnia, uzupełnia breadcrumby o gęstsze punkty (batch write, dedup po docId=ts). **UWAGA**: na 2026-04-24 Atlas `/history` dla WGM 0475M zwraca pusto → `scheduledHistorySync` czeka na ich sync.
3. **`cleanupBreadcrumbs` Cloud Function** (cron `30 2 * * *` — 2:30 CET): kasuje punkty `gpsBreadcrumbs` starsze niż 7 dni. Storage bounded.
4. **Firestore composite index** dla `driverActivities (driverEmail ASC + startTs DESC)` — `firestore.indexes.json` + `firebase.json`. Potrzebny bo scheduledGpsPoll query latest segment per kierowca.
5. **Firestore rules** — dodane reguły: `driverActivities`, `dddFiles`, `gpsBreadcrumbs` (wcześniej blokowała reguła domyślna `allow: if false`).

### GpsMapSection (Mapa online) — rozbudowa
- **Ikona pojazdu**: kółko ze strzałką obróconą o `course/heading/bearing` z Atlas (gdy jedzie), kółko z kropką gdy stoi. Znacznie czystsze od SVG ciężarówki.
- **Pamięć widoku** (localStorage `gpsMapView`): zapisuje lat/lng/zoom przy moveend/zoomend. Po reloadzie mapa otwiera się z zapamiętanego widoku (nie Polska zoom 7).
- **Breadcrumb trail 24h jako KROPKI** (L.circleMarker canvas renderer, r=3px, #0ea5e9) — BEZ polyline, BEZ map-matching. Gęste kropki wyglądają jak linia, rzadkie jako punkty. Bez zygzaków i bez "siatki" przy nakładaniu się przejazdów.
- **Outlier filter**: punkty wymagające prędkości > 200 km/h między sąsiadami są odrzucane (błędy GPS).

### GpsTrasySection (Trasy per dzień) — przepisany
- Source **primary**: nasz `gpsBreadcrumbs` (Firestore query dla wybranego dnia). Fallback: Atlas `/history` dla dat > 7 dni (retention).
- **OSRM map-matching** (`/match/v1/driving/`) — snap-to-road z parametrami: `radiuses=200m`, `gaps=ignore`, `tidy=true`, dedup stacjonarnych punktów.
- **Km z raw haversine** (NIE z OSRM distance — tam znajdowaliśmy 4000-11000 km przy rozjazdach matchingu). Sanity check: odrzucamy matched geometry gdy > 3× raw haversine.
- Stats: km, czas, godzina start/koniec, liczba punktów. Markery start (zielony ▶) i koniec (czerwony ■).

### DriverPanel (mobile kierowcy) — zdjęcia
- **CMR załadunek + rozładunek** — zmienione z pojedynczego na **wiele zdjęć (multi)**. Badge "CMR 1", "CMR 2" z godziną + delete per zdjęcie.
- **Zdjęcia towaru + uszkodzeń** — już wcześniej multi, teraz bez `capture="environment"` → możliwość wyboru z galerii (nie tylko aparat).
- Wszędzie `accept="image/*" multiple` + loop w onChange.
- Legacy `cmr_photo` wyświetlany jako jeden z cmrRozPhotos (backward compat).

### FrachtyModal — rozbudowa
- **Przycisk "📋 Kopiuj dane"** (fioletowy, między Anuluj a WhatsApp) — otwiera `CopyOrderPreviewModal` z textarea, gdzie user może edytować przed skopiowaniem.
- Format `formatOrderForDriverCopy(fracht, vehicles)`: bogaty format (Z1+Z2+R1-R5 per osobno z GPS/tel/adresy, towar, uwagi, zleceniodawca). **BEZ km i ceny** (info wewnętrzne, nie dla kierowcy).
- `navigator.clipboard.writeText()` + fallback `execCommand`. Toast "Skopiowano".

### GeoPickerModal — poprawiony workflow
- Przy NOWYM wyborze (brak `initialGeo`): mapa auto-panuje do adresu **ale NIE stawia pinezki**. User MUSI kliknąć w mapę. `Zapisz lokalizację` disabled dopóki pinezka nie postawiona.
- **Akceptuje wklejone koordy Google Maps** (`50.027385, 19.942322` / `50.027385,19.942322` / ze spacją). Input robi się zielony, przycisk zmienia się na "📍 Ustaw pinezkę". Klik stawia pin bezpośrednio.
- Tip pod inputem: "W Google Maps prawym na punkt → kopiuj → wklej tutaj".

### Banner "Nowa wersja dostępna"
- Po deploy Vercel polling co 5 min (pierwsze po 30s): fetch `/` → ekstrakcja hash bundla → porównanie z załadowanym. Różnica → niebieski banner u góry "🔄 Nowa wersja FleetStat dostępna [Odśwież teraz] [Później]".
- Działa w obu: admin + DriverPanel mobile. `env(safe-area-inset-top)` dla iOS notch.

### GpsCzasPracySection — manual entry segmentów
- Przycisk "＋ Dodaj ręcznie" w nagłówku Historii aktywności. Inline form: typ (drive/work/avail/rest), start, koniec (datetime-local), submit → addDoc z `source: "manual"`. Segmenty manual nie są nadpisywane przez auto-detection (priorytet DDD > manual > auto_gps).
- Dodany bo scheduledGpsPoll startowało 23.04 o 13:36 — wcześniejsze jazdy (10:42-12:49) nie były wykryte. Seedowane ręcznie przez admin SDK + UI żeby user mógł w przyszłości uzupełniać luki.

### FrachtyTab — fix SUMA
- Kolumna **€/KM Ł** w wierszu SUMA liczyła z `totalKmWszAll` (kmWszystkie || kmLadowne) → mylnie równała się €/KM W. Teraz `avgEurKmLad = totalCena / totalKmLad` — prawdziwa średnia za km ładowny.

### GpsMapSection — buildPlanned (naprawiony multi-stop)
- Wcześniej: R2-R5 brane tylko po `dokod2/3` jako string, Nominatim geocodował losowo (przykład "Hiszpania zamiast Kielce"). Z2 i R4/R5 w ogóle pomijane.
- Teraz: `pickBest(geo, adres, kodPocztowy, miasto, compatKod)` — priorytet geo, fallback pełny string "adres, kod miasto", ostatecznie compat. Wszystkie R1-R5 + Z1-Z2 honorują geo.
- Null-guard po każdym `await buildPlanned/buildReal` (przed `addTo(map)`) — zapobiega TypeError "Cannot read properties of null (reading 'addLayer')" gdy user zmieni zakładkę.

**Integracja z widziszwszystko.eu — stan 2026-04-27**:
- Atlas API (oficjalne, 12 endpointów) — używamy nadal: `devices`, `positionsWithCanDetails`, `/history`. Działa.
- `/rest-api/` z panelu beta — **nie dotykamy** (nieudokumentowany, bez zgody; w memory `feedback_widziszwszystko_ethics.md`).
- ✅ **Raport cykliczny „Karta drogowa Szczegółowa"** — pełen pipeline auto-importu wdrożony (DNS MX + SendGrid Inbound + CF `wwReportInbound`). Adres `imports@inbox.fleetstat.pl`. Pierwszy test: 8 segmentów zaimportowanych do `driverActivities` z source `ww_csv`.
- Widziszwszystko email support potwierdził: brak i nie planują API do DDD.
- Panel widziszwszystko: Premium → Harmonogramy DDD → konfiguracja login/hasło dla API tachografu (VDO/TIS-Web/etc.) — żeby auto-pobierać DDD. Po skonfigurowaniu pliki trafiają do widziszwszystko → admin ręcznie pobiera → upload do FleetStat → `parseDddFile`.

**Co dalej (priorytety)**:
- **Tracker R2 fine-tuning** — gdy kierowca zacznie używać workflow z 2 rozładunkami, sprawdzić czy split po ts drugiego `dotarcie_rozladunek` działa poprawnie dla CMR rozładunkowych. Ewentualnie rozszerzyć DriverPanel o osobne przyciski „Dotarł na R1" / „Dotarł na R2" — nowe typy `dotarcie_rozladunek_1`/`dotarcie_rozladunek_2`. Migracja istniejących `dotarcie_rozladunek` → `_1`.
- **DDD** — pierwszy plik za ~28 dni (harmonogramy DDD widziszwszystko). Test end-to-end parsera + dostosowanie heurystyk `findBlock()` w `readesm-js`.
- **WhatsApp** — Firebase Secrets do ustawienia (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN) + webhook URL w Meta Dev Console + zatwierdzenie szablonu `zlecenia_przydzielone`.
- **Czas pracy iter. 2** — kompensaty (skrócone odpoczynki + deadline), alerty banner (< 30 min do przerwy), timeline 7-dniowy (kolorowe paski 24h), push FCM 30 min przed obowiązkową przerwą.
- **Code splitting**: App.jsx dalej bundle ~1.95 MB (gzip ~485 KB) — dla mobile dalej za duże mimo SW cache-first. Plan: `vite manualChunks` (vendor/charts/xlsx) + lazy load rzadkich tabów (TrendyTab, RentownoscTab, AuditLogTab, ImiTab).

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

Plik: `functions/index.js` (~1220 linii). Używa Firebase Secrets (`defineSecret` z `firebase-functions/params`).

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
| **`sendWhatsappMessage`** | **onCall** | **Wysyłka wiadomości WhatsApp do kierowcy. Input: `{driverUid, type, content, frachtId}`. Typy: text/location/template. Zapisuje do `chatRooms/whatsapp_{driverUid}/messages`.** |
| **`whatsappWebhook`** | **onRequest** | **Publiczny webhook Meta (GET = verify, POST = events). HMAC X-Hub-Signature-256. Odbiera wiadomości/statusy od kierowców, dedup po wamid, zapis do chatRooms.** |

### Firebase Secrets (WhatsApp)
Zdefiniowane przez `defineSecret()` w functions/index.js:
```
WHATSAPP_TOKEN       — stały token dostępu do WhatsApp Business Cloud API
WHATSAPP_PHONE_ID    — Phone Number ID: 1056038134263202
WHATSAPP_APP_SECRET  — App Secret (do weryfikacji HMAC webhook)
WHATSAPP_VERIFY_TOKEN — dowolny string verify token (ustawiony przez nas)
```
**⚠️ WAŻNE**: Secrety muszą być ustawione przez CLI zanim functions będą działać:
```bash
firebase functions:secrets:set WHATSAPP_TOKEN
firebase functions:secrets:set WHATSAPP_PHONE_ID
firebase functions:secrets:set WHATSAPP_APP_SECRET
firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN
firebase deploy --only functions:sendWhatsappMessage,functions:whatsappWebhook
```
Numer kierowcy: `+48792096709` (numer firmowy FleetStat do WhatsApp Business).
API version: `v25.0` (Meta Graph API).

### Stałe WhatsApp w functions/index.js
```javascript
const WA_API_VERSION = "v25.0";
const WA_ROOM_PREFIX = "whatsapp_";  // prefix dla chatRooms
```

### Helpery WhatsApp w functions/index.js
- `callWhatsappApi(phoneId, token, payload)` — POST do Meta Graph API z error logging
- `ensureWhatsappRoom(driverUid, driverData)` — tworzy doc chatRooms jeśli nie istnieje

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
~17100  ZlecenieUploadBtn ← AI parsing prompt zwraca split pola + dane zleceniodawcy
~17195  GeoPickerModal
~17295  FrachtyModal v2 ← redesign Z1/Z2/R1-R5, Zleceniodawca, splitKM, TripSummaryPanel, WhatsApp preview
~19xxx  WhatsappSendPreviewModal ← podgląd wiadomości WA przed wysyłką
~19xxx  formatOrderForWhatsapp ← helper formatujący zlecenie do tekstu WA
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
  id, vehicleId, klient, dyspozytor,
  dataZlecenia, skad, urlZlecenie,
  // ── ZAŁADUNEK Z1 ──
  zaladunekKodPocztowy, zaladunekMiasto,
  zaladunekKod,       // compat: auto = zaladunekKodPocztowy + " " + zaladunekMiasto
  zaladunekAdres, zaladunekGeo, zaladunekTelefon,
  dataZaladunku, godzZaladunku,
  // ── ZAŁADUNEK Z2 ──
  zaladunekKodPocztowy2, zaladunekMiasto2,
  zaladunekKod2,      // compat
  zaladunekAdres2, zaladunekGeo2, zaladunekTelefon2,
  dataZaladunku2, godzZaladunku2,
  // ── ROZŁADUNEK R1 ──
  dokodPocztowy, dokodMiasto,
  dokod,              // compat: auto = dokodPocztowy + " " + dokodMiasto
  rozladunekAdres, rozladunekGeo, rozladunekTelefon,
  dataRozladunku, godzRozladunku,
  // ── ROZŁADUNEK R2 ──
  dokodPocztowy2, dokodMiasto2, dokod2,
  rozladunekAdres2, rozladunekGeo2, rozladunekTelefon2,
  dataRozladunku2, godzRozladunku2,
  // ── ROZŁADUNEK R3 ──
  dokodPocztowy3, dokodMiasto3, dokod3,
  rozladunekAdres3, rozladunekGeo3, rozladunekTelefon3,
  dataRozladunku3, godzRozladunku3,
  // ── ROZŁADUNEK R4 ──
  dokodPocztowy4, dokodMiasto4, dokod4,
  rozladunekAdres4, rozladunekGeo4, rozladunekTelefon4,
  dataRozladunku4, godzRozladunku4,
  // ── ROZŁADUNEK R5 ──
  dokodPocztowy5, dokodMiasto5, dokod5,
  rozladunekAdres5, rozladunekGeo5, rozladunekTelefon5,
  dataRozladunku5, godzRozladunku5,
  // ── ZLECENIODAWCA (NOWE) ──
  zleceniodawcaFirma, zleceniodawcaOsoba,
  zleceniodawcaTelefon, zleceniodawcaEmail,
  // ── TOWAR ──
  nrRef, nrZlecenia, towarOpis, towarIloscPalet, towarPalety,
  zaladunekTyp, wagaLadunku, uwagi,
  // ── FINANSE / BIURO ──
  cenaEur, kmPodjazd, kmLadowne, kmWszystkie,
  nrFV, dataWyslania, terminPlatnosci,
  // ── STATUS ──
  statusRozladunku,   // "rozladowano" = zakończony, inne = aktywny
  // ── TRIP SUMMARY ──
  kmStart,  // auto-capture z CAN przy evencie start_rozladunek
  kmEnd,    // auto-capture z CAN przy evencie dotarcie_rozladunek
}
```

### Backward compat (splitKM)
Stare rekordy mają `zaladunekKod = "PL 44-100 Gliwice"` (połączony string). FrachtyModal przy otwarciu wywołuje `splitKM(s)` który rozbija na `[kodPocztowy, miasto]`. Pola compat (`zaladunekKod`, `dokod`, `dokod2`, `dokod3`) są auto-synchronizowane przez `set()` przy każdej zmianie pól split.

### Adresy w innych miejscach (FrachtyTab, mapy itp.)
Większość miejsc w kodzie czyta `zaladunekKod` / `dokod` (compat). Geo-picking przekazuje teraz pełny adres: `${adres}, ${kodPocztowy} ${miasto}` do Nominatim — lepsza precyzja.

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

## 13. Co zostało zrobione (chronologicznie)

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
20. ✅ **FrachtyModal — fix prod**: pola dla 2. rozładunku (adres, geo, telefon, data, godz) — były niewidoczne
21. ✅ **WhatsApp Business Cloud API** — Cloud Functions `sendWhatsappMessage` + `whatsappWebhook` wdrożone (firebase deploy). Dane uwierzytelniające jako Firebase Secrets. API v25.0. HMAC X-Hub-Signature-256 na webhook.
22. ✅ **Meta template `zlecenia_przydzielone`** — Polski, kategoria Utility, 3 parametry (kierowca, opis, data). Statusowo "W trakcie sprawdzania" przez Meta.
23. ✅ **WhatsappSendPreviewModal + formatOrderForWhatsapp** — podgląd wiadomości przed wysyłką, przycisk w FrachtyModal gdy kierowca ma numer WA
24. ✅ **FrachtyModal v2 — pełny redesign** (2026-04-23):
    - Karta Z1 + opcjonalna Z2 (załadunek): osobne pola kod pocztowy, miasto, adres, geo, telefon, data, godzina
    - Karty R1–R5 (rozładunek): identyczna struktura, progressive disclosure (＋ dodaj)
    - Sekcja **Zleceniodawca**: firma, osoba kontaktowa, telefon, email (do trackera)
    - `splitKM()` — backward compat: rozbija stare `"PL 44-100 Gliwice"` → `["PL 44-100", "Gliwice"]`
    - `set()` auto-synchronizuje compat pola `zaladunekKod` / `dokod` z pól split
    - Geo picker: adres = `"${adres}, ${kodPocztowy} ${miasto}"` — lepsza precyzja Nominatim
    - AI PDF parsing prompt zaktualizowany — zwraca split pola + dane zleceniodawcy
25. ✅ **Fix duplicate style attribute w ChatTab context menu** (2026-04-23) — dwa `style={}` na divie, drugi nadpisywał pierwszy → tło i ramka menu nie renderowały się.
26. ✅ **GpsMapSection buildPlanned — fix multi-stop geo** (2026-04-23) — wcześniej R2-R5 brane tylko po `dokod2/3` jako string do Nominatim (losowe trafienia, przykład "Hiszpania zamiast Kielce"). Teraz `pickBest(geo, adres, kodPocztowy, miasto, compatKod)` honoruje wszystkie R1-R5 + Z1-Z2 geo. Null-guard po `await` zapobiega crash'om gdy user zmieni zakładkę.
27. ✅ **GpsTrasySection — rewrite z primary `gpsBreadcrumbs`** (2026-04-23, 2026-04-24): query Firestore dla wybranego dnia, fallback Atlas `/history` gdy breadcrumbów brak (> 7 dni). OSRM `/match/v1/driving/` z `radiuses=200m, gaps=ignore, tidy=true, dedup stacjonarnych`. Km z raw haversine (NIE z OSRM distance). Sanity check: gdy matched > 3× raw → fallback raw. Outlier filter: > 200 km/h między sąsiadami = punkt odrzucany.
28. ✅ **GPS breadcrumb collection `gpsBreadcrumbs/{vehicleId}/points/{ts}`** (2026-04-23): zapis przez client (60s throttle) + CF `scheduledGpsPoll` co 1 min. Render jako KROPKI (L.circleMarker canvas renderer) na Mapie online — bez polyline, bez map-matching, gęstość pokazuje postoje. W zakładce Trasy — polyline z map-matching.
29. ✅ **Cloud Functions — GPS 24/7** (2026-04-23, 2026-04-24):
    - `scheduledGpsPoll` (cron `* * * * *`, było `*/2`, potem `*/5` — finalnie co minuta) — Atlas positionsWithCanDetails → breadcrumb + driverActivity. Jedyny producent auto_gps. Client-side auto-detect WYŁĄCZONY (return; early w useEffect).
    - `scheduledHistorySync` (cron `0 3 * * *`) — nocny fetch Atlas `/history` wczoraj → uzupełnia breadcrumby (dedup docId=ts). Obecnie zwraca pusto dla WGM 0475M (ich sync delay).
    - `cleanupBreadcrumbs` (cron `30 2 * * *`) — kasuje punkty > 7 dni, batch 450 per commit.
30. ✅ **Firestore indexes + rules** (2026-04-23, 2026-04-24):
    - `firestore.indexes.json` — composite index `driverActivities (driverEmail + startTs DESC)`. Bez niego scheduledGpsPoll padał `FAILED_PRECONDITION`.
    - Rules: dodane reguły dla `driverActivities`, `dddFiles`, `gpsBreadcrumbs` (wcześniej błąd `permission-denied`).
    - `.gitignore` — whitelist `!firestore.indexes.json` (catch-all `*.json` wcześniej blokował).
31. ✅ **GpsCzasPracySection — UI manual entry segmentów** (2026-04-23) — przycisk "＋ Dodaj ręcznie" w Historii aktywności, form: type/start/end, submit → addDoc z `source: "manual"`. Nie nadpisywane przez auto-detection. Dla uzupełniania luk (przed startem server-side pollingu / gdy ktoś był offline).
32. ✅ **Seed 23.04 driverActivities via admin SDK** (2026-04-23) — 3 segmenty z widziszwszystko panel (rest 02:40-10:42, drive 10:42-12:49 136.94km, rest 12:49-13:32) wprowadzone skryptem jednorazowym.
33. ✅ **DriverPanel multi-foto** (2026-04-23) — CMR załadunek/rozładunek zmienione z single na multi (cmrZalPhotos[], cmrRozPhotos[]). Wszędzie `accept="image/*" multiple` + loop (usunięty `capture="environment"` → wybór galerii + aparat). Legacy `cmr_photo` wyświetlany w rozładunku (backward compat).
34. ✅ **FrachtyModal — przycisk "Kopiuj dane"** (2026-04-24) — fioletowy, między Anuluj a WhatsApp. Otwiera `CopyOrderPreviewModal` z textarea (edytowalne). Format `formatOrderForDriverCopy(fracht, vehicles)`: Z1+Z2+R1-R5 per osobno z GPS/tel/adresy, towar, uwagi, zleceniodawca. BEZ km i ceny (info wewnętrzne). `navigator.clipboard.writeText()` + fallback.
35. ✅ **GeoPickerModal — nie stawia automatycznie pinezki** (2026-04-24) — przy nowym wyborze pan do adresu ale pinezka ukryta dopóki user nie kliknie/nie przeciągnie. Save disabled do czasu pinezki. Dodatkowo: akceptuje wklejone koordy Google Maps (`50.027, 19.942` etc.) — input robi się zielony, przycisk "📍 Ustaw pinezkę" stawia pin bezpośrednio.
36. ✅ **Banner "Nowa wersja dostępna"** (2026-04-24) — polling co 5 min (+ 30s po starcie) fetch `/` → porównanie hash bundla Vite. Jeśli różny → niebieski banner u góry z "Odśwież teraz" / "Później". Działa na admin + DriverPanel (env safe-area-inset-top).
37. ✅ **GpsMapSection — ikona strzałki + pamięć widoku** (2026-04-24):
    - Ikona: kółko ze strzałką obracaną o `course/heading/bearing` z Atlas (gdy jedzie), kółko z kropką gdy stoi. Zamiast SVG ciężarówki.
    - Pamięć widoku: localStorage `gpsMapView` — lat/lng/zoom. Zapis na moveend/zoomend. Reload = zapamiętany widok zamiast Polska 7.
38. ✅ **FrachtyTab — fix €/KM Ł w SUMA** (2026-04-24) — używał `totalKmWszAll` (= kmWszystkie || kmLadowne), mylnie równał się €/KM W. Teraz osobno `avgEurKmLad = totalCena / totalKmLad`.
39. ✅ **Widziszwszystko: raport cykliczny Karta drogowa** (2026-04-24) — user skonfigurował w panelu widziszwszystko (Raporty → Raporty cykliczne → Karta drogowa Szczegółowa, codziennie, CSV, PL, email). **Czeka na pierwszy sample jutro** — parser + import do FleetStat po dostaniu pliku.
40. ✅ **Tracker dla zleceniodawcy — pełen pipeline** (2026-04-27):
    - **CF `trackerData`** (HTTP, publiczna, CORS, 30s): token w URL → fracht → najnowszy `gpsBreadcrumbs` → OSRM multi-waypoint → ETA z tacho compliance (45 min co 4.5h, 11h po limicie 9h). Zwraca activeStep, hasR2, vehiclePlate, vehicleMaxWeight, percentToR1, plannedR1Ms/plannedR2Ms, photos{cmrZal/cmrRoz/cmrRozR1/cmrRozR2/towar/damage}.
    - **TrackerPublicView** w App.jsx (renderowany gdy `pathname.startsWith("/t/")` w `Root` — bypass auth): logo FleetStat + VBS, badge auta z plate+ładownością, stepper 4 lub 5 kroków (hasR2), pasek % (jeden lub dwa: R1+R2), karty dat zmieniające się na „✅ Załadowano/Rozładowano/Dostarczono" gdy etap done, GPS link Google Maps, status banner (na czas/opóźnienie), notki o tacho i niepewności R2, polling 30s.
    - **`vercel.json`** rewrite `/t/:path*` → `/` (SPA fallback dla bezpośrednich wejść).
    - **CF `wwReportInbound`** (HTTP, publiczna, multipart/form-data, 512 MiB / 120s): odbiera POST od SendGrid Inbound Parse (DNS MX `inbox.fleetstat.pl` → `mx.sendgrid.net`), parsuje CSV przez `csv-parse/sync`, match `object` (rejestracja) → vehicle, match driver z `driverHistory`, dedup po `auto_gps`/`ww_csv` w przedziale, batch write 400 segmentów. Pierwszy test 2026-04-27: 8 segmentów zaimportowanych z 9-wierszowego CSV (1 „Brak danych" pominięty).
    - **`preferDddSegments`** rozszerzone — priorytet **DDD > ww_csv > manual > auto_gps**.
    - **Composite index** `driverActivities (driverEmail ASC + startTs ASC)` dla dedup query (drugi obok DESC).
    - **`SendTrackerLinkModal`** (przycisk „🔗 Wyślij tracker" w FrachtyModal): generuje `trackerToken` (UUID), zapis do `fracht.trackerToken` przez `onPatch`, status włączony/wyłączony (`fracht.trackerEnabled`), 4 checkboxy (cmrZal/towar/cmrRoz/damage → `fracht.trackerShow`), opcje wysyłki: kopiuj link / WhatsApp zleceniodawcy (`wa.me`) / email zleceniodawcy (`mailto:`).
    - **`TrackerPill`** (badge w FrachtyTab mobile + desktop) — 🟢 Tracker / 🔴 Tracker off, klik z confirm → toggle.
    - **Logo VBS** wyciągnięte z `brand_manual.pdf` str. 8 (PyMuPDF, 1371×479 px @ 300 DPI) → `public/vbs-logo.png`.
41. ✅ **Performance fix iOS — wahania ładowania (1s vs 30s)** (2026-04-27):
    - **SW v3 → v4**: hashed assets Vite (assets/*-HASH.js|css|woff2) **cache first** (były bypass cache). index.html jako stale-while-revalidate. Bundle ładuje się **instant z 2-giego otwarcia**.
    - **Firestore IndexedDB persistence** (`initializeFirestore` z `persistentLocalCache + persistentMultipleTabManager`) — fallback do `getFirestore()` przy braku IndexedDB.
    - **`<link rel="preconnect">`** dla `firestore.googleapis.com`, `firebaseinstallations`, `identitytoolkit`, `firebaseappcheck` + dns-prefetch dla storage/cloudfunctions w `index.html`.
42. ✅ **Admin FrachtyTab — Status kierowcy chronologicznie per faza** (2026-04-27):
    - Eventy CMR/foto/uwagi wcięte pod swoim nagłówkiem (Załadunek/Rozładunek), bez sztucznych boksów „FAZA". Bullet 6×6 px, wcięcie 28 px.
    - Split fazowy po `dotarcie_rozladunek.ts` (NIE po `start_rozladunek.ts` — zdjęcia w trakcie jazdy do rozładunku zostają w fazie załadunkowej).
    - Dla `hasR2` (frachty z 2 rozładunkami): osobne sekcje „Rozładunek 1" + „Rozładunek 2", split eventów po ts drugiego `dotarcie_rozladunek` (kierowca klika 2x).

## 14. Co w planie (NASTĘPNE ZADANIA)

### A. WhatsApp — dokończenie (PRIORYTET)
Stan: Cloud Functions wdrożone, `WhatsappSendPreviewModal` w UI, template `zlecenia_przydzielone` złożony do Meta.

**Do zrobienia**:
1. Ustawić Firebase Secrets (wymagane do działania functions):
   ```bash
   firebase functions:secrets:set WHATSAPP_TOKEN      # stały token z Meta
   firebase functions:secrets:set WHATSAPP_PHONE_ID   # 1056038134263202
   firebase functions:secrets:set WHATSAPP_APP_SECRET # z Meta App → App Secret
   firebase functions:secrets:set WHATSAPP_VERIFY_TOKEN # dowolny string
   firebase deploy --only functions:sendWhatsappMessage,functions:whatsappWebhook
   ```
2. Skonfigurować **Webhook URL w Meta Developer Console**:
   - URL: `https://europe-west1-vbs-stats.cloudfunctions.net/whatsappWebhook`
   - Verify token: ten sam co WHATSAPP_VERIFY_TOKEN
   - Subskrybować: `messages`, `message_deliveries`, `message_reads`
3. Poczekać na zatwierdzenie template `zlecenia_przydzielone` przez Meta (24-48h)
4. Przetestować wysyłkę: FrachtyModal → "Wyślij na WhatsApp" (dostępne gdy `record.id` istnieje i kierowca ma `whatsappNumber`)

**Numer firmowy**: `+48792096709` (numer FleetStat przypisany do WhatsApp Business Cloud API).

**Template `zlecenia_przydzielone`** (Utility, PL):
```
Zlecenie przydzielone - {{1}}
Trasa: {{2}}
Data zaladunku: {{3}}
Szczegoly w aplikacji FleetStat.
```

**Schema wiadomości w `chatRooms/whatsapp_{driverUid}/messages`**:
```javascript
{
  id, text, sender: "dispatcher"|"driver",
  ts: ISO, channel: "whatsapp",
  wamid?: string,      // Meta message ID (do dedup)
  status?: "sent"|"delivered"|"read"|"failed",
  type: "text"|"location"|"template"|"media"|"other",
}
```

### B. Moduł Czas pracy — iteracja 2
- **Kompensaty** — auto-wykrywanie skróconych odpoczynków (9h zamiast 11h, 24h zamiast 45h) + deadline nadrobienia
- **Alerty w banerze** — gdy kierowca < 30 min do wymagalnej przerwy, czerwony banner w panelu mobile i admina
- **Timeline 7-dniowy** — kolorowe paski 24h per dzień (z zatwierdzonego mockupu `preview-czas-pracy.html`)
- **Push notifications** — Cloud Function wysyła FCM 30 min przed obligatoryjną przerwą

### C. Parser DDD — dopracowanie
- Test end-to-end na pierwszym prawdziwym pliku z WGM 0475M (za ~28 dni)
- Dostosowanie heurystyk `findBlock()` do struktury jaką zwraca `readesm-js` dla prawdziwego DDD
- Obsługa Smart Tachograph Gen2v2 jeśli stara biblioteka nie obsłuży

### D. Tracker dla zleceniodawcy
- Dane zleceniodawcy są już w modelu frachtu (`zleceniodawcaFirma`, `zleceniodawcaEmail` itp.)
- Potrzebna: publiczna strona trackera (bez logowania) z pozycją pojazdu na mapie
- Wysyłka linku na email/WhatsApp zleceniodawcy

### E. Z roadmapy ZASADY-VBS-STAT.md
- **Code splitting App.jsx** — bundle 1.81 MB (gzip ~450 KB), dla mobile za duże
- Rate limiting na /api/claude
- Weryfikacja kosztów sty–maj 2025 (netto/brutto)
- Migracja Firestore Timestamp w czatach (fix chronologii wiadomości)

### F. Pozostałe TODO — zgłoszone 2026-04-27

1. ~~**Pole „nazwa firmy" w formularzu zlecenia**~~ — ✅ ZROBIONE 2026-04-27 (commit `1038850`). Pola `zaladunekFirma`/`zaladunekFirma2`/`rozladunekFirma`/`rozladunekFirma2..5` w FrachtyModal, AI parser schema (Claude wyciąga z PDF), `formatOrderForDriverCopy` dokleja firmę do daty Z#/R#. Równolegle: usunięty header (`🚛 ZLECENIE`, `Pojazd:`, `Klient:`) i sekcja `🏢 ZLECENIODAWCA` z formatu kierowcy + walidacja sklejonych adresów (`1. ... 2. ...`).

2. **Tracker auto-off po rozładunku + email podsumowania trasy** — po finalnym rozładunku (`dotarcie_rozladunek` lub `dotarcie_rozladunek_2` przy hasR2) Tracker `/t/{token}` ma się sam wyłączać (toggle off w `TrackerPill`), równolegle wysyłka email do zleceniodawcy z podsumowaniem trasy: km, czas, zdjęcia (CMR zał/roz, towar, uszkodzenia), status końcowy. Łączy się z istniejącym `SendTrackerLinkModal`/`trackerData` CF.

3. **Model „giełda wolnych pojazdów"** — przygotować strukturę danych do wprowadzania aut innych firm (zewnętrzni przewoźnicy z wolną przestrzenią ładunkową). Kierunek: marketplace/giełda. Do przemyślenia: kolekcja Firestore (osobna od `vehicles` żeby nie mieszać floty własnej z zewnętrzną?), role i widoczność (kto może dodawać/przeglądać), kontakty do przewoźnika, cykl życia ogłoszenia.

4. **AI chat dla zakładki „Czas pracy"** — asystent dyspozytora z wiedzą wyłącznie o tachografie + regulaminie 561/2006 + Pakiecie Mobilności (refusal poza tematem).
   - **Stack**: istniejący `/api/claude` endpoint (Vercel, `ANTHROPIC_API_KEY`). Model: **Claude Haiku 4.5** ($1/M in, $5/M out). Koszt: ~$0.001/zapytanie; user szacuje 30 zapytań/tydzień ≈ $0.12/mc. Balans Anthropic Console: 25 USD (wystarczy na lata przy tym wolumenie).
   - **Kontekst per zapytanie** (~5k tok): wybrany kierowca + 30 dni segmentów (priorytet źródeł: DDD > ww_csv > manual > auto_gps) + wynik `computeDriverCompliance` + `computeDriverPlan` + meta o źródle (Claude musi wiedzieć że GPS ≠ tacho prawda).
   - **System prompt**: zakres = czas pracy / 561/2006 / Pakiet Mobilności; refusal pattern; format odpowiedzi po polsku z odniesieniami do reguł.
   - **Prompt caching**: system prompt + reguły 561 → 5-min TTL, kolejne zapytania ~90% taniej input.
   - **Decyzje otwarte** (zanim implementacja):
     a) Dostęp: tylko admin/dyspozytor (`GpsCzasPracySection`) czy też kierowca (`DriverCzasPracyDashboard`)
     b) Selekcja: jeden kierowca per chat czy multi-kierowca (np. „kto z chłopaków ma najmniej do nadrobienia?")
   - **Pre-req**: włączyć Auto-reload w Anthropic Console Settings → Billing (obecnie disabled — ryzyko że API zatrzyma się przy 0).

## 15. Znane problemy / uwagi

- **Duplicate "style" attribute** warning w JSX (linia ~5479) — kontekst menu czatu ma dwa atrybuty `style`. Nie blokuje builda — do poprawienia przy okazji.
- **Chunk size warning** — `index-*.js` = 1.81 MB (gzip ~450 KB). Dla mobile trochę dużo — code splitting w planach.
- `react-leaflet@5.0.0` zainstalowany ale nieużywany — zostawiony, usunięcie wymaga `.npmrc` cleanup.
- Vercel build wymaga `.npmrc` z `legacy-peer-deps=true`.
- **Parser DDD** — `readesm-js` z 2020, może nie obsługiwać Gen2v2 (2023+) tachografów — dostosujemy na pierwszym prawdziwym pliku.
- **Czas pracy kierowcy MVP** — MVP bazuje na prędkości GPS, może być niedokładne dla krótkich postojów (<2 min) — dopiero DDD daje pełną precyzję.
- **WhatsApp Firebase Secrets** — functions `sendWhatsappMessage` i `whatsappWebhook` są wdrożone, ale nie działają dopóki nie ustawisz secrets przez CLI (patrz sekcja 3 i 14.A).
- **WhatsApp template** — `zlecenia_przydzielone` złożony do Meta, status "W trakcie sprawdzania". Stary template `nowe_zlecenie` (Marketing, EN) jest Active ale droższy.

## 16. Zmienne środowiskowe / konfiguracja

- **Firebase config**: hardcoded w App.jsx (apiKey publiczny — normalne dla Firebase web)
- **Atlas GPS API key**: w Firestore `config/gps` → `{ group, username, password }`
- **Atlas API URL**: `https://widziszwszystko.eu/atlas/{group}/{username}/{endpoint}`
- **Nominatim**: publiczny, darmowy, bez klucza
- **OSRM**: publiczny, darmowy, bez klucza
- **Vercel**: auto-deploy z GitHub, konfiguracja w panelu Vercel
- **SendGrid API key**: Firestore `config/email`
- **WhatsApp (Firebase Secrets — do ustawienia przez CLI)**:
  - `WHATSAPP_TOKEN` — stały token dostępu (permanent token z Meta)
  - `WHATSAPP_PHONE_ID` — `1056038134263202`
  - `WHATSAPP_APP_SECRET` — App Secret z Meta Developer Console → App → Basic Settings
  - `WHATSAPP_VERIFY_TOKEN` — dowolny string (np. `fleetstat_wa_verify_2026`)
- **Konfiguracja WhatsApp w Firestore** `konfiguracja/whatsapp`: `{ identyfikatorNumeruTelefonu, nazwaSzablon, znak, wabaId }` (dane pomocnicze, główne credentiale w Secrets)

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

*Zaktualizowano: 2026-04-24 (duża sesja — punkty 25-39: GPS 24/7 CF, breadcrumby jako kropki, Trasy z map-matching, multi-foto CMR, Kopiuj dane, banner update, GeoPicker akceptuje wklejone koordy, ikona strzałka, SUMA €/KM Ł fix, raport cykliczny widziszwszystko w drodze)*
