# VBS-Stat — Zasady i podsumowanie prac

## 1. Flota pojazdów

| ID | Rejestracja | Alias |
|----|-------------|-------|
| v1 | WGM0475M | — |
| v2 | TK130EF | — |
| v3 | WGM5367K | — |
| v4 | TK314CL | — |
| v5 | WGM0507M | — |
| v6 | TK315CL | — |

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

## 4. Kursy walut (marzec 2026)

| Waluta | Kurs do EUR |
|--------|------------|
| PLN | 4.285 (dzielimy PLN / 4.285) |
| CZK | 24.21 (dzielimy CZK / 24.21) |
| EUR | 1.0 |

---

## 5. Struktura rekordu kosztu w Firebase

Dokument: `fleet/data`, pole: `fleetv2_costs` (tablica obiektów)

```json
{
  "id": "e100_mar26_v5_20260331_abc123",
  "vehicleId": "v5",
  "category": "paliwo",
  "date": "2026-03-31",
  "amountEUR": 71.47,
  "amountOriginal": 306.23,
  "currency": "PLN",
  "note": "E-100 ON 51.6L PL E100",
  "liters": 51.6
}
```

### Pola:
- **id** — unikalny, format: `{dostawca}_mar26_{vehicleId}_{data}_{random}`
- **vehicleId** — v1–v6
- **category** — `paliwo` (diesel) lub `inne` (AdBlue, parking)
- **date** — `YYYY-MM-DD`
- **amountEUR** — kwota NETTO w EUR
- **amountOriginal** — kwota NETTO w oryginalnej walucie
- **currency** — `EUR`, `PLN`, `CZK`
- **note** — format: `{Dostawca} {usługa} {litry}L {kraj/miasto} {stacja}`
- **liters** — ilość litrów (0 dla parkingu)

---

## 6. Kategorie kosztów

| Usługa w pliku | category | Uwagi |
|----------------|----------|-------|
| ON / Diesel / Olej Napedowy | `paliwo` | Główne paliwo |
| AdBlue | `inne` | Dodatek |
| Parking TIR | `inne` | Parking |
| Inne | `inne` | Pozostałe |

---

## 7. Deduplikacja przy imporcie

Klucz deduplikacji: `vehicleId::date::amountEUR::note`

Jeśli rekord o takim kluczu już istnieje — pomijamy (nie dodajemy duplikatu).

---

## 8. Metryki w TrendyTab (wykres trendów)

### Metryki sumowane (aggregacja = suma):
- Kilometry (`kmLicznik`)
- Koszty paliwa, opłaty drogowe, serwis itd.
- Przychód

### Metryki rate (aggregacja = średnia):
- **Spalanie** (`spalanie`) — L/100km, średnia po pojazdach, NIE suma
- **€/km** (`eurKm`) — koszt paliwa za kilometr, średnia po pojazdach

Rozpoznanie: `const RATE_METRICS = ["spalanie", "eurKm"]`

### €/km — zasady obliczania:
- Licznik: **tylko koszty paliwa** (category = `paliwo`), NIE wszystkie koszty
- Mianownik: `kmLicznik` (przejechane km w danym miesiącu)
- Wzór: `€/km = suma_kosztów_paliwa_netto / kmLicznik`
- Liczymy **osobno dla każdego pojazdu w miesiącu**, potem średnia

### Podsumowanie roczne (total):
- Metryki sumowane → suma 12 miesięcy
- Metryki rate → **średnia z niepustych miesięcy** (nie suma!)

---

## 9. TrendyTab — design wykresu + tabeli

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

### Precyzja pośrednia:
- Obliczenia pośrednie: `.toFixed(4)` — nie zaokrąglamy za wcześnie
- Wyświetlanie: `fmtTk` obsługuje formatowanie końcowe

---

## 10. Dane historyczne (2025 vs 2026)

| Rok | Źródło danych operacyjnych | Źródło kosztów |
|-----|---------------------------|----------------|
| 2025 | Obiekt `r` (rekord miesięczny pojazdu) | `r.costs.paliwo`, `r.costs.droga` itd. |
| 2026 | Obiekt `op` (operacje) | `fleetv2_costs` z Firebase (filtrowane po vehicleId + miesiąc) |

### €/km dla 2025:
```javascript
fuelCost = r?.costs?.paliwo || 0
eurKm = fuelCost / r.kmLicznik
```

### €/km dla 2026:
```javascript
fuelCost = costs.filter(c => c.vehicleId === vid
  && c.date.startsWith(monthStr)
  && c.category === "paliwo")
  .reduce((s, c) => s + (parseFloat(c.amountEUR) || 0), 0)
eurKm = fuelCost / op.kmLicznik
```

---

## 11. Pliki w projekcie

| Plik | Opis |
|------|------|
| `src/App.jsx` | Główna aplikacja React (TrendyTab ~linie 5340-5470) |
| `serviceAccountKey.json` | Klucz Firebase Admin SDK |
| `import-fuel-march.json` | E-100 dane marzec (29 rekordów) |
| `import-fuel-march.js` | Skrypt importu E-100 ✅ uruchomiony |
| `import-ewag-march.json` | E-WAG dane marzec (87 rekordów) |
| `import-ewag-march.js` | Skrypt importu E-WAG ✅ uruchomiony |
| `import-andamur-march.json` | Andamur dane marzec (9 rekordów) |
| `import-andamur-march.js` | Skrypt importu Andamur ✅ uruchomiony |
| `fix-netto-march.js` | Skrypt korekty E-100 i Andamur brutto→netto ✅ uruchomiony |

---

## 12. Proces importu nowych kosztów (checklist)

1. Otrzymaj plik CSV/XLSX od dostawcy
2. Zidentyfikuj kolumnę kwoty — netto czy brutto?
3. Jeśli brutto → przelicz na netto (VAT wg kraju tankowania)
4. Mapuj rejestracje na vehicleId (v1–v6)
5. Klasyfikuj: diesel → `paliwo`, AdBlue/parking → `inne`
6. Przelicz waluty obce → EUR (aktualny średni kurs miesiąca)
7. Wygeneruj JSON z rekordami
8. Uruchom skrypt importu z deduplikacją
9. Zweryfikuj w aplikacji

---

## 13. Komendy (terminal)

Projekt: `~/Desktop/VBS-Stat.nosync`

```bash
# Build aplikacji (zawsze na Macu, nie w sandbox)
cd ~/Desktop/VBS-Stat.nosync && npm run build

# Deploy na produkcję (Vercel — auto z GitHub po pushu na main)
# Vercel buduje automatycznie — fleetstat.pl
cd ~/Desktop/VBS-Stat.nosync && git add src/App.jsx && git commit -m "opis zmian" && git push

# Firebase Hosting (backup, vbs-stats.web.app) — opcjonalnie
# cd ~/Desktop/VBS-Stat.nosync && npm run build && firebase deploy --only hosting --project vbs-stats

# Dev server
cd ~/Desktop/VBS-Stat.nosync && npm run dev

# Import kosztów (przykład)
cd ~/Desktop/VBS-Stat.nosync && node import-fuel-march.js

# Korekta netto
cd ~/Desktop/VBS-Stat.nosync && node fix-netto-march.js
```

**ZASADA: Zawsze podawaj gotową komendę do terminala — użytkownik kopiuje i wkleja.**

---

## 14. Uwagi

- Koszty 2025 — **prawdopodobnie też brutto** (do weryfikacji w przyszłości, jeśli dane 2025 też pochodziły z tych samych kart)
- Kurs walut — ustalany raz na miesiąc (średni NBP), marzec 2026: PLN 4.285, CZK 24.21
- UNIVERSAL5570 w pliku E-WAG — to nie nasz pojazd, pomijamy przy imporcie
- Build aplikacji — robimy lokalnie na Macu (sandbox nie obsługuje arm64)
- **Zawsze podawaj gotową komendę** — nie każ użytkownikowi samemu wymyślać
