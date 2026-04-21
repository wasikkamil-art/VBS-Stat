# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Źródła prawdy (czytaj najpierw)

- **`PODSUMOWANIE-PROJEKTU.md`** — aktualny stan projektu, moduły, numery linii w `App.jsx`, plan prac. To jest źródło prawdy; ten CLAUDE.md tylko uzupełnia.
- **`ZASADY-VBS-STAT.md`** — zasady biznesowe (VAT per kraj, kursy NBP, kategorie kosztów, dedup importów, metryki TrendyTab).
- Dokumentacja Atlas API: `api - ww-ms-atlas (1).pdf` — 12 oficjalnych endpointów widziszwszystko.

Pracujemy po polsku (user messages, commity, UI, notki); identyfikatory w kodzie po angielsku.

## Architektura — big picture

- **React 18 + Vite 5 + Tailwind 3 SPA**, monolityczny `src/App.jsx` (~22k linii). Wszystkie widoki, komponenty, helpery są w tym jednym pliku. Numery linii w PODSUMOWANIE-PROJEKTU.md są przybliżone — **używaj Grep, nie twardych offsetów**.
- **Backend = Firebase**: Firestore + Auth + Storage + Cloud Functions (region `europe-west1`). Cloud Functions w `functions/index.js` (~900 linii), zależności w `functions/package.json` (osobny `package.json` od frontu).
- **Hosting produkcyjny = Vercel** (`fleetstat.pl`), auto-deploy z GitHub `main`. Firebase Hosting (`vbs-stats.web.app`) to tylko **backup** — nie produkcja.
- **Role/routing**: `admin`, `dyspozytor`, `podglad`, `kierowca`. Kierowcy dostają mobilny `DriverPanel` zamiast sidebara. Role synchronizowane do Firebase Auth Custom Claims przez Cloud Function `onRoleChange`.
- **Stan aplikacji**: Firestore `onSnapshot` listenery w głównym `App` komponencie. Kluczowe kolekcje: `frachty`, `vehicles` (via `SK.vehicles`), `costs`, `driverEvents`, `driverActivities` (Czas pracy), `fuelEntries`, `dddFiles`, `sprawy`, `operacyjne`, `rentownosc`, `users`, `chatRooms`, `config`, `emailRecipients`, `emailLogs`, `auditLog`.

## Aktywne moduły (produkcja)

Patrz PODSUMOWANIE-PROJEKTU.md sekcje 7–9 po pełny opis:

1. **Trip Summary** — auto-capture `kmStart`/`kmEnd` z Atlas CAN przy eventach `start_rozladunek` / `dotarcie_rozladunek`; panel w 4 miejscach (FrachtyModal, FrachtyTab expanded row, DriverPanel, VehicleOrdersSection).
2. **GPS/Monitoring** — Atlas API przez Cloud Function `gpsProxy`. Mapa Leaflet z dwoma trybami trasy: zielona solidna (Atlas `/history` dla rozładowanych) vs niebieska przerywana (OSRM planowana dla aktywnych). Cache przez `lastRouteKeyRef`, żeby nie przerysowywać co 30s.
3. **Czas pracy kierowcy MVP** — stałe `REGULATION` (561/2006 + Pakiet Mobilności), `computeDriverCompliance` + `computeDriverPlan`, auto-detection GPS (speed > 3 km/h = drive), ręczne kliknięcia kierowcy, widok `GpsCzasPracySection` (admin) i `DriverCzasPracyDashboard` (mobile).
4. **Parser DDD** — Cloud Function `parseDddFile` + biblioteka `readesm-js`. Upload admin (`GpsDddSection`) albo mobile kierowcy (`DriverDddUploadCard`). **Priorytet segmentów DDD nad GPS** w compliance (funkcja `preferDddSegments`).

## Gotchy (nietypowe w tym repo)

- **NIE importować `React`** — JSX transform jest automatyczny w Vite; import wywala build.
- **Leaflet przez CDN**, nie przez `import`. Dostęp: `const L = window.L;` Tag `<script>` w `index.html`. `react-leaflet@5.0.0` jest w `package.json` ale **nieużywany** (wymaga React 19) — zostawione, nie usuwać bez cleanupu `.npmrc`.
- **`.npmrc` ma `legacy-peer-deps=true`** — wymagane przez Vercel build. Nie usuwać.
- **Daty z Atlas API to obiekt** `{year, month, day, hour, minute, seconds, timezone}`, **nie** unix timestamp. Helper: `atlasDateTimeToMs`.
- **Zagnieżdżenia w Atlas**: `pos.coordinate.latitude/longitude`, `pos.can.mileage.value`, identyfikator urządzenia to `dev.deviceName` (nie `plate`).
- **Nie używamy `/rest-api/` z panelu beta widziszwszystko** — nieudokumentowane, bez zgody. Tylko oficjalne Atlas API (12 endpointów w PDF).
- **Service Worker**: `public/sw.js` cache `fleetstat-v3`, wyklucza Vite hashed files (`assets/index-*.js|css`). Przy cache issues bump wersji, user musi wyczyścić dane witryny.
- **`firestore.rules`** — custom claims z tokenu Auth; domyślnie `allow read, write: if false`. `fleetDataSafe()` blokuje zapis pustych tablic do kluczowych pól `fleet/data`.
- **`safeHref()`** — każdy dynamiczny `href=` musi przez nią przejść (blokuje `javascript:`, `data:` injection).

## Zasady danych (szczegóły w ZASADY-VBS-STAT.md)

- **Kwoty zawsze netto** (bez VAT). Konwersja per kraj: PL 23%, FR 20%, DE 19%, BE 21%, CZ 21%, ES 21%, LU 17%, AT 20%, IT 22%. Wzór: `netto = brutto / (1 + VAT)`.
- **Kursy NBP dzienne** z dnia transakcji (cache `nbp-rates.json`). Jeśli dzień wolny → szukaj wstecz max -5 dni.
- **Dedup importów**: klucz `vehicleId::date::amountEUR::note`.
- **€/km**: licznik **tylko koszty paliwa** (category=`paliwo`), nie wszystkie koszty. Mianownik `kmLicznik`. Liczone per pojazd/miesiąc, potem średnia.
- **Metryki rate** (`spalanie`, `eurKm`) — agregacja = średnia, NIE suma. Total roczny = średnia z niepustych miesięcy.
- Flota: 6 pojazdów (v1–v6). Pomijane rejestracje: OKAZICIEL3/4/5, TRUCK, TK135AM, UNIVERSAL5570.

## Komendy

```bash
# Dev (lokalnie)
npm run dev                   # Vite dev server → http://localhost:5173

# Build frontu
npm run build                 # Vite → dist/
rm -rf dist node_modules/.vite && npm run build  # czysty build gdy cache się zacina

# Deploy frontu = PUSH DO MAIN (Vercel auto-deploy)
git add <files> && git commit -m "opis" && git push
# NIE używaj `firebase deploy --only hosting` — to leci na backup vbs-stats.web.app

# Cloud Functions (osobno od frontu)
cd functions && npm install   # przy zmianie zależności functions
firebase deploy --only functions                       # wszystkie
firebase deploy --only functions:parseDddFile          # pojedyncza (szybciej)
firebase deploy --only functions:gpsProxy
firebase functions:log --only parseDddFile | tail -20  # logi

# Firestore rules
firebase use vbs-stats && firebase deploy --only firestore:rules

# Gdy git lock blokuje
rm -f .git/index.lock
```

Brak konfiguracji lintera/testów w repo — nie uruchamiaj `npm test` (nie istnieje).

Przed `git push` **zawsze pytaj użytkownika** — push triggeruje auto-deploy na produkcję.

## Konwencje kodu (obserwowane)

- Helpery globalne: `uid()`, `fmtPLN()`, `fmtEUR()`, `fmtDate()`, `fmtHM()` (Czas pracy), `fmtTimeShort()`, `logAction()`, `showToast()`.
- Firestore przez `SK` (Storage Keys) object dla głównych tablic (`SK.vehicles`, `SK.costs`, `SK.frachty`) + osobne kolekcje po nazwie.
- Mieszanka Tailwind classes + inline `style={}` — to jest okej, nie refaktoruj prewencyjnie.
- Commity po polsku lub angielsku. Zwykle krótki opis + kontekst w body.
- Utility/one-shot skrypty (`fix_*`, `import_*`, `diagnose_*`, `audit-all.js`, `migrate_*`) są w `.gitignore` — nie commituj ich nawet przypadkiem.

## Co jest "w locie" (iteracja następna)

Sekcja 14 PODSUMOWANIE-PROJEKTU.md. Priorytety: Czas pracy iteracja 2 (kompensaty, alerty, timeline 7d, push FCM), test parsera DDD na pierwszym prawdziwym pliku z WGM 0475M za ~28 dni, code splitting (`App.jsx` bundle 1.77 MB, gzip 441 KB — dla mobile za duże).
