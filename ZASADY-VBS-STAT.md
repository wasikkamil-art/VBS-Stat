# VBS-Stat (FleetStat) — Zasady, procesy i podsumowanie prac

## 1. Flota pojazdów

| ID | Rejestracja | Alias |
|----|-------------|-------|
| v1 | WGM0475M | — |
| v2 | TK130EF | — |
| v3 | WGM5367K | — |
| v4 | TK314CL | — |
| v5 | WGM0507M | — |
| v6 | TK315CL | — |

**Pomijane rejestracje (nie nasze):** OKAZICIEL3/4/5, TRUCK, TK135AM, UNIVERSAL5570

---

## 2. Źródła danych kosztów paliwa

Trzy karty paliwowe:

| Dostawca | Format pliku | Kolumna kwoty | Typ kwoty | Opis w rekordzie |
|----------|-------------|---------------|-----------|------------------|
| E-100 | CSV (`;` separator) | `Kwota` | **BRUTTO** → przeliczamy na netto | `E-100` |
| E-WAG (Eurowag) | CSV (`,` separator) | `Kwota netto` / `Kwota brutto` | Bierzemy **NETTO** | `E-WAG` |
| Andamur | XLSX | `Kwota(**)` | **BRUTTO** → przeliczamy na netto | `Andamur` |

### Zasada: ZAWSZE zapisujemy kwoty NETTO (bez VAT)

---

## 3. Stawki VAT wg kraju (do przeliczania brutto → netto)

| Kraj | VAT |
|------|-----|
| PL | 23% |
| FR | 20% |
| DE | 19% |
| BE | 21% |
| CZ | 21% |
| ES | 21% |
| LU | 17% |
| AT | 20% |
| IT | 22% |

Wzór: `netto = brutto / (1 + VAT)`

---

## 4. Kursy walut

### Zasada: kurs dzienny NBP z dnia transakcji
- API: `https://api.nbp.pl/api/exchangerates/rates/a/eur/YYYY-MM-DD/?format=json`
- Jeśli dzień wolny → NBP zwraca 404, szukamy dzień wcześniej (max -5 dni)
- Plik cache: `nbp-rates.json` — 209 kursów dziennych (cze 2025 — mar 2026)

| Waluta | Sposób przeliczenia |
|--------|-------------------|
| PLN | `amountEUR = amountPLN / kurs_NBP_z_dnia` |
| CZK | `amountEUR = amountCZK / kurs_CZK_z_dnia` |
| EUR | bez przeliczenia |

---

## 5. Struktura danych w Firebase

### Główny dokument: `fleet/data`

| Pole | Typ | Opis |
|------|-----|------|
| `fleetv2_costs` | array[1358] | Koszty (paliwo, opłaty, serwis...) |
| `fleetv2_frachty` | array[544] | Frachty |
| `fleetv2_vehicles` | array[6] | Pojazdy |
| `fleetv2_records` | array[72] | Rekordy miesięczne |
| `fleetv2_rent` | array[82] | Rentowność |
| `fleetv2_categories` | array[17] | Kategorie kosztów |
| `fleetv2_imi` | array[34] | Dane IMI |
| `fleetv2_docs` | array[0] | Dokumenty |
| `fleetv2_sprawy` | array[0] | Sprawy (przeniesione do kolekcji) |

### Kolekcje osobne:
- `operacyjne` — dane operacyjne per pojazd/miesiąc (km, litry, spalanie, cenaPaliwa)
- `sprawy` — tickety/sprawy
- `pauzy` — czas pracy kierowców
- `config` — konfiguracja (SendGrid API key)
- `emailRecipients` — odbiorcy maili
- `emailLogs` — historia wysyłek
- `rentownosc` — rentowność per pojazd/miesiąc
- `users` — użytkownicy z rolami

### Rekord kosztu:

```json
{
  "id": "e100_20260331_v5_0_sjult6",
  "vehicleId": "v5",
  "category": "paliwo",
  "date": "2026-03-31",
  "amountEUR": 71.39,
  "amountOriginal": 306.23,
  "currency": "PLN",
  "note": "E-100 ON 51.6L PL E100",
  "liters": 51.6
}
```

Pola: `id`, `vehicleId`, `category`, `date`, `amountEUR`, `amountOriginal`, `amountPLN`, `currency`, `note`, `liters`

---

## 6. Kategorie kosztów

| Usługa w pliku | category | Uwagi |
|----------------|----------|-------|
| ON / Diesel / Olej Napedowy | `paliwo` | Główne paliwo |
| AdBlue | `inne` | Dodatek |
| Parking TIR | `inne` | Parking |
| Opłaty drogowe | `oplaty` | |
| Leasing | `leasing` | |
| Naprawa / serwis | `naprawa` | |
| OCP/D | `ocpd` | Ubezpieczenie |
| Telefon | `telefon` | |
| Hotele | `hotele` | |
| Mandaty | `mandaty` | |
| Wypłata | `wyplata` | |
| ZUS | `zus` | |
| Pozostałe | `inne` | |

---

## 7. Deduplikacja przy imporcie

Klucz deduplikacji: `vehicleId::date::amountEUR::note`

Jeśli rekord o takim kluczu już istnieje — pomijamy (nie dodajemy duplikatu).

---

## 8. KPI Dashboard (Koszty)

5 kafelków w siatce `grid-cols-5`:

1. **Łącznie EUR** — suma kosztów netto w EUR
2. **Wpisów** — ilość rekordów kosztów
3. **Najdroższe auto** — pojazd z najwyższymi kosztami
4. **Główna kategoria** — kategoria z najwyższymi kosztami
5. **Śr. cena paliwa** — średnia cena €/L (ważona litrami)

### Obliczanie średniej ceny paliwa (€/L):
Dwa źródła danych (nie podwójnie liczone):
- **A)** Rekordy kosztów z polem `liters > 0` (importy cze 2025+)
- **B)** Kolekcja `operacyjne` z `cenaPaliwa` × `paliwoL` (starsze miesiące)
- Miesiące pokryte przez źródło A są pomijane w źródle B (`coveredMonths`)
- Wzór: `avgEurPerL = sumEUR / sumLiters`

---

## 9. Metryki w TrendyTab (wykres trendów)

### Metryki sumowane (aggregacja = suma):
- Kilometry (`kmLicznik`), koszty paliwa, opłaty drogowe, serwis, przychód

### Metryki rate (aggregacja = średnia):
- **Spalanie** (`spalanie`) — L/100km, średnia po pojazdach, NIE suma
- **€/km** (`eurKm`) — koszt paliwa za kilometr, średnia po pojazdach

### €/km — zasady obliczania:
- Licznik: **tylko koszty paliwa** (category = `paliwo`), NIE wszystkie koszty
- Mianownik: `kmLicznik` (przejechane km w danym miesiącu)
- Wzór: `€/km = suma_kosztów_paliwa_netto / kmLicznik`
- Liczymy **osobno dla każdego pojazdu w miesiącu**, potem średnia

### Podsumowanie roczne (total):
- Metryki sumowane → suma 12 miesięcy
- Metryki rate → **średnia z niepustych miesięcy** (nie suma!)

---

## 10. TrendyTab — design wykresu + tabeli

### Wykres (Recharts LineChart):
- `scale="band"` na XAxis — punkty wyśrodkowane w bandach
- XAxis: `tick={false}`, `height={4}` — ukryte etykiety miesięcy
- Tooltip: `cursor={false}` (bez linii pionowej)
- Margin right = `TOTAL_COL` (80px) — miejsce na kolumnę totalu
- CHART_LEFT = 10px

### Tabela pod wykresem:
- CSS Grid: `repeat(12, 1fr) ${TOTAL_COL}px`
- Wiersz nagłówkowy: nazwy miesięcy (sty, lut, mar...)
- Wiersz roku bieżącego: niebieskie tło (`#eff6ff`)
- Wiersz roku poprzedniego: szare tło (`#f8fafc`)
- Wiersz delta (Δ): różnica rok do roku, zielony (+) / czerwony (−)
- Total na końcu (kolumna 13): suma lub średnia (wg typu metryki)

### Formatowanie wartości (`fmtTk`):
- `0` → `"—"`
- `≥ 1000` → `"X.Xk"` (np. 12500 → "12.5k")
- Rate metrics: `< 1` → 2 miejsca po przecinku, `≥ 1` → 1 miejsce
- Inne: integer lub 1 miejsce

---

## 11. Dane historyczne (zakres i źródła)

| Okres | Źródło kosztów | Kursy walut | Status |
|-------|---------------|-------------|--------|
| Sty–Maj 2025 | Stare dane (nietknięte) | Kurs miesięczny | Prawdopodobnie brutto — do weryfikacji |
| Cze 2025–Mar 2026 | Nowy import (3 karty) | Kurs dzienny NBP | ✅ Netto, zweryfikowane |

Import obejmuje: 1358 rekordów (266 starych + 1100 nowych - 8 duplikatów)

### €/km dla 2025 (stare dane):
```javascript
fuelCost = r?.costs?.paliwo || 0
eurKm = fuelCost / r.kmLicznik
```

### €/km dla 2026 (nowe dane):
```javascript
fuelCost = costs.filter(c => c.vehicleId === vid
  && c.date.startsWith(monthStr)
  && c.category === "paliwo")
  .reduce((s, c) => s + (parseFloat(c.amountEUR) || 0), 0)
eurKm = fuelCost / op.kmLicznik
```

---

## 12. Domyślne widoki (filtry)

Wszystkie zakładki otwierają się na **bieżącym roku + bieżącym miesiącu**:

| Zakładka | Domyślny rok | Domyślny miesiąc |
|----------|-------------|------------------|
| Koszty | `new Date().getFullYear()` | `YYYY-MM` |
| FV/Płatności | `new Date().getFullYear()` | `MM` (zero-padded) |
| Frachty (overview) | `new Date().getFullYear()` | `MM` (zero-padded) |
| Frachty (per auto) | `new Date().getFullYear()` | `getMonth()` (0-indexed) |

---

## 13. Deployment

### Produkcja: Vercel → fleetstat.pl
- Auto-deploy z GitHub po `git push` na `main`
- IP: 76.76.21.21
- `git push` = deploy

### Backup: Firebase Hosting → vbs-stats.web.app
- Projekt Firebase: `vbs-stats`
- Deploy: `firebase deploy --only hosting --project vbs-stats`

### GitHub Actions backup:
- Plik: `.github/workflows/backup.yml`
- Cron: `0 22 * * *` (22:00 UTC = 00:00 PL)
- Repo backup: `wasikkamil-art/vbs-stat-backups`
- Uwaga: GitHub dodaje kilka minut jitteru do crona

---

## 14. Bezpieczeństwo

### Firestore Rules:
- Custom Claims z tokena Auth (szybkie, bezpieczne)
- Role: `admin`, `dyspozytor`, zwykły user
- Ochrona `fleetDataSafe()` — blokuje zapis pustych tablic do kluczowych pól
- Domyślna reguła: `allow read, write: if false` (blokuje wszystko niezdefiniowane)
- Config/email — tylko admin

### Walidacja URL:
- Funkcja `safeHref()` w App.jsx — blokuje `javascript:` i `data:` injection
- Wszystkie dynamiczne `href=` używają `safeHref()`

### .gitignore (chroni przed commitowaniem):
- `serviceAccountKey.json`, `sa.json`, `*-adminsdk*.json`
- `*.json` (poza package.json, package-lock.json, manifest.json)
- `*.csv`, `*.xlsx` — pliki źródłowe importów
- `.env`, `.env*.local`
- `firebase.json`
- Skrypty jednorazowe: `fix_*.js`, `import-*.js`, `diagnose*.js`, `audit-all.js` itd.

### SendGrid:
- API key przechowywany w Firestore `config/email` (dostęp: tylko admin)
- Nie jest hardcoded w kodzie
- Docelowo przenieść na Cloud Functions

### Firebase config (apiKey w App.jsx):
- To jest **normalne** dla Firebase web apps — klucz jest publiczny z założenia
- Bezpieczeństwo zapewniają Firestore Rules (nie klucz API)

### Skrypty admin:
- Pliki z `firebase-admin` przeniesione **poza `src/`** — Vite ich nie bundluje
- Lokalizacja: główny katalog projektu (`~/Desktop/VBS-Stat.nosync/`)

---

## 15. Audyt — wykonane naprawy (kwiecień 2026)

### Dane:
- ✅ 4 ujemne kwoty (korekty E-100) → zamienione na wartości bezwzględne
- ✅ Duplikat operacyjne v1 2026-03 → usunięty (zostawiony wpis z srWaga=3500)
- ✅ Marzec 2026 €/L=1.688 → poprawne (wzrost cen rynkowych)
- ✅ 0 duplikatów kosztów, 0 brakujących pól krytycznych

### Kod:
- ✅ Poprawione literówki setterów (setRzypomnienieData → setPrzypomnienieData)
- ✅ Null-safe sort: `(b.date||"").localeCompare(a.date||"")`
- ✅ Walidacja URL (safeHref)
- ✅ Skrypty admin przeniesione z src/

### Bezpieczeństwo:
- ✅ .gitignore wzmocniony
- ✅ serviceAccountKey.json nie w repo
- ✅ Firestore rules solidne

---

## 16. Pliki w projekcie

| Plik | Opis |
|------|------|
| `src/App.jsx` | Główna aplikacja React (~9000 linii) |
| `src/frachty_component.js` | Komponent frachtów |
| `serviceAccountKey.json` | Klucz Firebase Admin SDK (nie w repo!) |
| `nbp-rates.json` | Cache kursów dziennych NBP (209 kursów) |
| `import-all-costs.js` | Import zbiorczy 3 kart (cze 2025–mar 2026) |
| `fetch-nbp-rates.js` | Pobieranie kursów NBP |
| `fix-netto-march.js` | Korekta brutto→netto marzec |
| `fix-audit-issues.js` | Naprawa ujemnych kwot |
| `audit-all.js` | Skrypt pełnego audytu |
| `diagnose*.js` | Skrypty diagnostyczne |
| `gen_rentownosc_lut26.js` | Generator rentowności |
| `reimport_frachty_2026.js` | Reimport frachtów |
| `delete_frachty_2026.js` | Usuwanie frachtów |
| `.github/workflows/backup.yml` | Automatyczny backup GitHub Actions |
| `ZASADY-VBS-STAT.md` | Ten plik — dokumentacja projektu |

---

## 17. Komendy (terminal)

Projekt: `~/Desktop/VBS-Stat.nosync`

```bash
# Build aplikacji (zawsze na Macu, nie w sandbox)
cd ~/Desktop/VBS-Stat.nosync && npm run build

# Build z czyszczeniem cache Vite (gdy zmiany nie widać)
cd ~/Desktop/VBS-Stat.nosync && rm -rf dist node_modules/.vite && npm run build

# Deploy na produkcję (Vercel — auto z GitHub po pushu na main)
cd ~/Desktop/VBS-Stat.nosync && git add src/App.jsx && git commit -m "opis zmian" && git push

# Firebase Hosting (backup, vbs-stats.web.app) — opcjonalnie
cd ~/Desktop/VBS-Stat.nosync && npm run build && firebase deploy --only hosting --project vbs-stats

# Dev server
cd ~/Desktop/VBS-Stat.nosync && npm run dev

# Import kosztów
cd ~/Desktop/VBS-Stat.nosync && node import-all-costs.js

# Audyt danych
cd ~/Desktop/VBS-Stat.nosync && node audit-all.js

# Diagnostyka
cd ~/Desktop/VBS-Stat.nosync && node diagnose4.js
```

**ZASADA: Zawsze podawaj gotową komendę do terminala — użytkownik kopiuje i wkleja.**

---

## 18. Proces importu nowych kosztów (checklist)

1. Otrzymaj pliki CSV/XLSX od dostawców (E-100, E-WAG, Andamur)
2. Umieść pliki w katalogu projektu
3. Zidentyfikuj kolumnę kwoty — netto czy brutto?
4. Pobierz kursy dzienne NBP: `node fetch-nbp-rates.js`
5. Uruchom import: `node import-all-costs.js`
   - E-100: brutto → netto (VAT wg kraju), PLN → EUR (kurs dzienny)
   - E-WAG: już netto, PLN/CZK → EUR (kurs dzienny)
   - Andamur: brutto → netto (VAT wg kraju), EUR
6. Skrypt: usuwa stare koszty w pokrytych miesiącach, dodaje nowe, deduplikuje
7. Zweryfikuj w aplikacji na fleetstat.pl

---

## 19. Uwagi

- Koszty sty–maj 2025 — stare dane, nietknięte, prawdopodobnie brutto (do weryfikacji)
- Build aplikacji — robimy lokalnie na Macu (sandbox nie obsługuje arm64)
- Vite cache — czasem trzeba `rm -rf dist node_modules/.vite` przed buildem
- **Zawsze podawaj gotową komendę** — nie każ użytkownikowi samemu wymyślać

---

## 20. TODO na przyszłość

- **Push notifications (PWA)** — powiadomienia na telefon z FleetStat (FCM + Service Worker + manifest.json). Przypomnienia o serwisie, brakujących danych, terminach itp.
- **SendGrid na Cloud Functions** — przenieść obsługę maili z frontendu na backend
- **Rate limiting na /api/claude** — ochrona przed nadmiernym zużyciem API
- **npm audit** — regularne sprawdzanie podatności w zależnościach
- **Weryfikacja kosztów sty–maj 2025** — czy stare dane są netto czy brutto
- **Panel kierowcy z funkcją skanowania CMR** — osobny widok/panel dla kierowców z możliwością robienia zdjęć dokumentów (CMR, listy przewozowe) telefonem. Zdjęcie przetwarzane w przeglądarce (Canvas API) na formę skanu: zwiększenie kontrastu, binaryzacja, usunięcie cieni, auto-crop. Zapisywane w Firebase Storage, widoczne dla admina/dyspozytora. Opcjonalnie OCR (rozpoznawanie tekstu).
