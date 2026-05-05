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

# Lint (od 2026-04-28 — TODO #5a komercjalizacji)
npm run lint                  # ESLint v9, flat config (eslint.config.mjs)
npm run lint:fix              # auto-fix gdzie możliwe
npm run lint:src              # tylko src/ (szybciej)

# Gdy git lock blokuje
rm -f .git/index.lock
```

**Lint config**:
- `eslint.config.mjs` (flat config v9) + `jsconfig.json` (`checkJs: true`).
- 3 sekcje: src/ (React+browser), functions/ (Node CommonJS), api/ (Node ESM).
- `react-hooks/rules-of-hooks` = error (real bugs); inne hooks v7 reguły = warn (false positives w monolicie). `no-unused-vars` = warn (allow leading `_`). `allowEmptyCatch: true` (124 try/catch w kodzie, intentional silent catches).
- **Cel**: 0 errors zawsze (build green); warnings to backlog do stopniowego cleanup.
- Znane debt: 3 lokacje hooks po conditional return / w IIFE → `eslint-disable` z komentarzem TODO refactor (Root, VehicleOrdersSection, YoY IIFE).

**Husky hooks (od 2026-04-28 — TODO #5b komercjalizacji)**:
- `.husky/pre-commit` — `npx lint-staged` → ESLint --fix na zmienionych plikach `*.{js,jsx,mjs}`. Auto-fix gdzie można, **blokuje commit gdy errory**. Warnings przechodzą.
- `.husky/pre-push` — `npm run lint` + `npm run build` → catch regresji których lint-staged przepuścił (np. usunięty plik z importem gdzie indziej). Blokuje broken main → produkcję.
- Po `npm install` `prepare: husky` script automatycznie inicjalizuje hooks dla nowych klonujących.
- Lint-staged config: `package.json` → `"lint-staged": { "*.{js,jsx,mjs}": "eslint --fix" }`.

**Smoke E2E (od 2026-04-29 — TODO #5d komercjalizacji)**:
- Playwright + Chromium (mobile + desktop) — `playwright.config.js`
- `tests/smoke/` — 3 specfile: login, tracker, lazy-chunks (~9 testów łącznie, ~14s)
- Testy chodzą przeciw produkcji `https://fleetstat.pl` (read-only smoke). NIE wymaga local dev server.
- `npm run test:e2e` — wszystkie testy / `--ui` interactive / `--headed` widoczna przeglądarka
- **NIE w pre-push hook** — testy zależą od internetu i prod, byłyby flaky. Uruchamiaj ręcznie przed dużym deploy.
- Cel: złapać regresje typu (1) bug Tracker multi-stop (kmRem 1364 zamiast 10), (2) mobile keyboard login fix (autoCapitalize), (3) lazy chunks działają (DriverPanel nie ładuje się na login screen).
- Test Pixel 5 + Desktop Chrome (mobile-chrome, desktop-chrome projekty).

Testów unit/integration brak — nie uruchamiaj `npm test` (nie istnieje).

Przed `git push` **na main** zawsze pytaj użytkownika — to triggeruje Vercel auto-deploy na produkcję. Push do remote feature branch (`origin <branch>`) to tylko backup, można robić proaktywnie po każdej sesji (patrz Backup workflow).

## Backup workflow

Folder pracy `*.nosync` jest **wykluczony z iCloud sync** (konwencja iCloud Drive: extension `.nosync` blokuje synchronizację). Bez świadomej dyscypliny utrata MacBooka = utrata danych.

**Po każdej sesji** (lub gdy długa sesja, lub gdy user zgłasza że limit się kończy):
1. `git status -sb` — sprawdź ile niepushed commits
2. `git push -u origin <branch>` — backup do remote feature branch (NIE bezpośrednio na main)
3. Merge do main przez PR robisz manualnie gdy chcesz deploy (Vercel auto-deploy po merge)

**Zabezpieczone przez `git push`** ✅: kod, dokumentacja (`PODSUMOWANIE-PROJEKTU.md`, `SESJA-LOG.md`, `CLAUDE.md`, `ZASADY-VBS-STAT.md`), Cloud Functions, configs w repo.

**TYLKO LOKALNIE** ⚠️ (do osobnego backupu):
- Memory Claude `~/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory/` — 60 KB, 14 plików (preferencje + recovery procedures + TODO context). **Backup: `./scripts/backup-claude-memory.sh`** (versioned snapshot do iCloud `FleetStat-backup/memory/YYYY-MM-DD/`, retention 30 dni). TBD Krok 2b: launchd auto-run codziennie 22:00.
- `.env.local` — Firebase / Anthropic credentials (backup razem ze skryptem `backup-claude-memory.sh` → `FleetStat-backup/env/.env.local`)
- `.git/config` — zawiera GitHub PAT w plain text
- `node_modules/`, `dist/`, `.vite/` — odtwarzalne z `npm install` + `npm run build`, NIE backupować
- `2026-*.json`, `import-*.json`, `frachty_*.json` — dane historyczne migracji (jednorazowe, ale warto skopiować raz)

**Time Machine + external SSD** (~$80-150) = najmocniejszy fail-safe — backup wszystkiego automat, point-in-time recovery. Rekomendowane gdy nie ma się dyscypliny push'a.

**Security PAT**: GitHub Personal Access Token siedzi w `.git/config` w plain text. Jeśli MacBook utracony, PAT wycieknie do publicznego transcript chatu (np. przez `git remote -v`), lub komputer jest udostępniony — natychmiast:
```bash
# 1. GitHub Settings → Developer settings → Personal access tokens → Revoke stary
# 2. Wygeneruj nowy PAT (scope: repo, workflow)
# 3. Zaktualizuj remote:
git remote set-url origin https://{NEW_PAT}@github.com/wasikkamil-art/VBS-Stat.git
```

## Konwencje kodu (obserwowane)

- Helpery globalne: `uid()`, `fmtPLN()`, `fmtEUR()`, `fmtDate()`, `fmtHM()` (Czas pracy), `fmtTimeShort()`, `logAction()`, `showToast()`.
- Firestore przez `SK` (Storage Keys) object dla głównych tablic (`SK.vehicles`, `SK.costs`, `SK.frachty`) + osobne kolekcje po nazwie.
- Mieszanka Tailwind classes + inline `style={}` — to jest okej, nie refaktoruj prewencyjnie.
- Commity po polsku lub angielsku. Zwykle krótki opis + kontekst w body.
- Utility/one-shot skrypty (`fix_*`, `import_*`, `diagnose_*`, `audit-all.js`, `migrate_*`) są w `.gitignore` — nie commituj ich nawet przypadkiem.

## Co jest "w locie" (iteracja następna)

Sekcja 14 PODSUMOWANIE-PROJEKTU.md. Priorytety: Czas pracy iteracja 2 (kompensaty, alerty, timeline 7d, push FCM), test parsera DDD na pierwszym prawdziwym pliku z WGM 0475M za ~28 dni, code splitting (`App.jsx` bundle 1.77 MB, gzip 441 KB — dla mobile za duże).
