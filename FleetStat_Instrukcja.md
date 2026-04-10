# FleetStat — Kompletna instrukcja projektu
*VBS Transport · wersja 31.03.2026*

---

## 1. PRZEGLĄD PROJEKTU

**FleetStat** to wewnętrzna aplikacja webowa do zarządzania flotą i finansami firmy transportowej VBS.

| Element | Wartość |
|---------|---------|
| URL produkcyjny | https://fleetstat.pl |
| Repo GitHub | wasikkamil-art/VBS-Stat |
| Gałąź | main |
| Framework | React (single-file App.jsx ~8000 linii) |
| Baza danych | Firebase Firestore |
| Pliki | Firebase Storage |
| Auth | Firebase Auth |
| Hosting | Vercel |
| AI | Anthropic Claude API przez /api/claude |

---

## 2. ŚRODOWISKO DEWELOPERSKIE

### Lokalizacja plików
```
~/Desktop/VBS-Stat.nosync/        ← główny folder projektu (iCloud-safe)
  src/App.jsx                      ← cały kod aplikacji (~8000 linii)
  deploy.sh                        ← skrypt deployu
  vbs-stats-firebase-adminsdk.json ← klucz Firebase SA (NIE commitować!)
  import_2025.js                   ← skrypt importu danych 2025
  records_2025.json                ← dane 2025 do importu
  node_modules/                    ← zależności

~/Desktop/App_fresh.jsx            ← AKTUALNA KOPIA App.jsx (backup)
```

### Node.js
```bash
# Zawsze używaj pełnej ścieżki NVM:
~/.nvm/versions/node/v18.20.8/bin/node
```

### Deploy
```bash
cd ~/Desktop/VBS-Stat.nosync
./deploy.sh "opis zmian"
# Następnie skopiuj backup:
cp src/App.jsx ~/Desktop/App_fresh.jsx
```

### Backup nocny
- GitHub Actions: `vbs-stat-backups`, codziennie o 00:00 PL
- Node 24, plik backup.yml

---

## 3. FIREBASE — STRUKTURA DANYCH

### Kolekcja fleet/data (główny dokument)

| Klucz | Zawartość |
|-------|-----------|
| fleetv2_vehicles | lista pojazdów |
| fleetv2_costs | koszty indywidualne (2026+) |
| fleetv2_categories | kategorie kosztów |
| fleetv2_docs | dokumenty |
| fleetv2_imi | IMI/SIPSI |
| fleetv2_rent | records miesięczne (2025 i wcześniej) |
| fleetv2_frachty | frachty (2026+) |

### Kolekcja operacyjne/
- Klucz: `{vid}_{year}_{month}` np. `v3_2026_2`
- Pola: kmLicznik, paliwoL, spalanie, cenaPaliwa, dni, srWaga

### Kolekcja sprawy/
- Osobna kolekcja (przeniesiona z fleet/data z powodu limitu 1MB)

### Źródła danych w TrendyTab
- **2025 i wcześniej** → `fleetv2_rent` (records zagregowane)
- **2026+** → `frachtyList` (fleetv2_frachty) + `costs` (fleetv2_costs)

---

## 4. FLOTA

| ID | Rejestracja | Pojazd | Status |
|----|-------------|--------|--------|
| v1 | WGM 0475M | Iveco | aktywny |
| v2 | TK 130EF | Renault Master | aktywny |
| v3 | WGM 5367K | Iveco | aktywny |
| v4 | TK 314CL / TK 760AP | Iveco Bus + przyczepa | aktywny |
| v5 | WGM 0507M | Iveco | aktywny |
| v6 | TK 315CL / TK 761AP | Iveco Bus + przyczepa | **zarchiwizowany** (sprzedaż) |

**Ważne:** v6 jest zarchiwizowany ale jego dane historyczne są widoczne w Trendy (bo logika uwzględnia wszystkie pojazdy dla danych historycznych).

---

## 5. KATEGORIE KOSZTÓW

| Klucz w kodzie | Nazwa | Uwagi |
|----------------|-------|-------|
| paliwo | Paliwo | |
| leasing | Leasing | |
| wyplata | Wypłata | |
| zus | ZUS + podatek | |
| serwis | Serwis | |
| nego | Nego + E-toll | zagregowane razem |
| etoll | Autostrady + Myto | |
| hotele | Hotele | |
| telefon | Telefon | |
| mandaty | Mandaty | |
| przyczepa | Przyczepa leasing | tylko v4, v6 |
| ocpd | OCPD + polisa + IMI + SIPSI | 1500 EUR/mies flota, dzielone proporcjonalnie do frachtów |
| inne | Inne | |

---

## 6. ROLE UŻYTKOWNIKÓW

| Rola | Uprawnienia |
|------|-------------|
| Admin | pełny dostęp, wszystkie moduły |
| Dispatcher (ARO — Agnieszka) | frachty, sprawy, FV/Płatności, widok operacyjny |
| View | tylko odczyt |

---

## 7. MODUŁY APLIKACJI

### Frachty
- Lista frachtów per pojazd, per rok/miesiąc
- Pola: dataZlecenia, dataZaladunku, dataRozladunku, skad, dokod, klient, cenaEur, kmPodjazd, kmLadowne, wagaKg, dyspozytor, nrFV, statusFV, urlFV, urlZlecenie
- **WAŻNE:** `cenaEur` wpisana przez dyspozytora NIE jest nadpisywana przez AI przy wgrywaniu FV
- Kwalifikacja do miesiąca: po `dataZaladunku` (fallback: `dataZlecenia`)

### FV / Płatności
- Widok wszystkich frachtów z statusem FV
- Upload FV (PDF) → AI parsuje: nrFV, klient, dataWyslania, terminPlatnosci (ale NIE cenaEur)
- Status: nie_wyslana, wyslana, zaplacona, przeterminowana

### Koszty
- Koszty indywidualne per pojazd
- Export do Excel z filtrem
- Inline edycja, bulk zmiana kategorii

### Rentowność
- Tab 1: Flota — przegląd (tabela zysk per pojazd per miesiąc)
- Tab 2: Pojazd — dane operacyjne (km, paliwo, spalanie)
- Tab 3: Trendy (wykres Recharts + tabela YoY)

### Trendy / YoY
- Wykres LineChart (Recharts)
- Tabela porównania rok do roku: 12 kart miesięcznych + klamry Q1-Q4 + H1-H2
- Tryb: Flota total / Per pojazd
- Metryki: Frachty, Koszty, Zysk, KM licznik, Paliwo L, Spalanie L/100, EUR/km, Dni w trasie

### Sprawy (CRM)
- Typy spraw, statusy, chronologia zdarzeń z załącznikami
- Załączniki: PDF, JPG, PNG, DOC, DOCX
- @mentions z notification badges, przypomnienia
- Pole Przypisani (użytkownicy przypisani do sprawy)
- EUR/PLN konwersja

### Pojazdy
- Lista aktywnych i zarchiwizowanych
- Archiwizacja z modalem wyboru powodu (zamiast usuwania)

### Serwis
- Wpisy serwisowe per pojazd

### IMI / SIPSI
- Rejestr IMI i SIPSI

---

## 8. WAŻNE REGUŁY TECHNICZNE

### Ochrona danych przed nadpisaniem
```javascript
// W DocUploadCell — AI NIE nadpisuje cenaEur:
// if (parsed.cenaEur != null) fields.cenaEur = String(parsed.cenaEur); // ZAKOMENTOWANE
```

### Zabezpieczenie przed pustym zapisem
```javascript
// useEffect z zapisem do Firebase musi mieć guard:
useEffect(() => {
  if (loaded && rentRecords.length > 0) dbSet(SK.rent, rentRecords);
}, [rentRecords, loaded]);
// NIGDY bez .length > 0 — puste array nadpisałoby dane!
```

### Fracht kwalifikacja do miesiąca
```javascript
(f.dataZaladunku || f.dataZlecenia || "").startsWith(monthStr)
```

### Źródła danych Trendy
```javascript
// 2026+ → z frachtyList / costs (live dane)
// 2025 i wcześniej → z records (fleetv2_rent, zagregowane)
const frachtyVal = year >= 2026
  ? frachtyList.filter(...).reduce(...)
  : (r?.frachty || 0);
```

### Auto-wylogowanie
- Po 10 minutach nieaktywności

### Trendy — zarchiwizowane pojazdy
- `activeVehs = vehicles` (wszystkie, BEZ filtra !archived)
- Konieczne dla poprawnych danych historycznych

---

## 9. DANE 2025 — IMPORT

### Źródło
Plik Excel: `Auta_VBS_2025__13_.xlsx`
- Arkusze per kierowca: Siergiej 25, Volodym 25, Mirek 25, V Iwanski 25, Miki 25, Andrii 25, Marcin G 25
- Arkusz sumy floty: Total25
- Arkusz nego/etoll: nego + e-toll

### Struktura importu
72 rekordy w `fleetv2_rent` (6 pojazdów × 12 miesięcy):
```json
{
  "vehicleId": "v3",
  "year": 2025,
  "month": 0,
  "frachty": 4930,
  "costs": {
    "paliwo": 1923.79,
    "leasing": 1356.57,
    "wyplata": 1399.93,
    "zus": 400,
    "serwis": 150,
    "nego": 215.73,
    "telefon": 10,
    "ocpd": 333.26,
    "inne": 10
  }
}
```

**Uwaga:** `month` jest 0-indexed (styczeń = 0, grudzień = 11)

### Wyniki 2025
| Metryka | Wartość |
|---------|---------|
| Frachty | 442 464 EUR |
| Koszty | 378 809 EUR |
| Zysk | ~64 000 EUR |

### OCPD/polisa/IMI/SIPSI
- 1500 EUR/mies dla całej floty
- Dzielone proporcjonalnie do frachtów rocznych per pojazd

---

## 10. SKRYPTY NODE.JS — WZORCE

### Podstawowy skrypt Firebase
```javascript
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(
    '/Users/kamilwasik/Desktop/VBS-Stat.nosync/vbs-stats-firebase-adminsdk.json'
  )
});
const db = admin.firestore();

// Musi być uruchamiany z folderu VBS-Stat.nosync:
// cd ~/Desktop/VBS-Stat.nosync
// ~/.nvm/versions/node/v18.20.8/bin/node skrypt.js
```

### Edycja danych w fleet/data
```javascript
const ref = db.collection('fleet').doc('data');
ref.get().then(snap => {
  const data = snap.data();
  // ... modyfikuj data ...
  return ref.update({ fleetv2_rent: nowaLista });
}).then(() => {
  console.log('OK');
  process.exit(0);
});
```

### Przed importem danych — zmiana Firebase Rules
```
// Tymczasowo (TYLKO na czas importu):
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

// Po imporcie — przywróć:
allow read, write: if request.auth != null;
```

---

## 11. ZMIANA KODU — WORKFLOW

### Standardowy workflow
```bash
# 1. Stwórz kopię roboczą
cp ~/Desktop/App_fresh.jsx /tmp/App_work.jsx

# 2. Wprowadź zmiany skryptem Python
python3 << 'PYEOF'
with open('/tmp/App_work.jsx', 'rb') as f:
    data = f.read()
# ... zmiany ...
with open('/tmp/App_work.jsx', 'wb') as f:
    f.write(data)
PYEOF

# 3. Wgraj i deployuj
cp /tmp/App_work.jsx ~/Desktop/VBS-Stat.nosync/src/App.jsx
cd ~/Desktop/VBS-Stat.nosync
./deploy.sh "opis zmian"

# 4. Zaktualizuj backup
cp src/App.jsx ~/Desktop/App_fresh.jsx
```

### Ważne zasady przy edycji kodu
- Zawsze pracuj na `/tmp/App_work.jsx`, nie bezpośrednio na `src/App.jsx`
- Używaj `data.replace(old, new, 1)` z unikalnymi stringami
- Sprawdź liczbę linii po zmianie (`data.count(b'\n')`)
- Zawsze rób backup `App_fresh.jsx` po udanym deploy

---

## 12. ZNANE PROBLEMY I ROZWIĄZANIA

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| CORS przy upload FV | Wywołanie api.anthropic.com z przeglądarki | Używaj /api/claude (Vercel function) |
| AI zmienia cenaEur | Parsowanie FV przez Claude | Zakomentowana linia w DocUploadCell |
| Dane 2025 niezgodne | Dwa źródła danych | records w fleetv2_rent dla 2025, frachtyList/costs dla 2026 |
| Zarchiwizowane pojazdy w Trendy | Filtr !archived | activeVehs = vehicles (wszystkie) |
| Firebase limit 1MB | Duży dokument fleet/data | Sprawy przeniesione do osobnej kolekcji sprawy/ |
| iCloud sync konflikty | iCloud Desktop sync | Folder .nosync omija iCloud |

---

## 13. PENDING — DO ZROBIENIA

| Priorytet | Feature | Opis |
|-----------|---------|------|
| WYSOKI | Marzec 2026 koszty + operacyjne | Uzupełnić dane za marzec |
| WYSOKI | Panel Podsumowania | Dedykowany widok finansowy |
| ŚREDNI | Ekran logowania | Nowy design z logo SVG (słupki+droga+złota strzałka) |
| ŚREDNI | PWA ikony | icon-192.png, icon-512.png |
| ŚREDNI | srWaga z frachtów | Automatyczne liczenie z wagaLadunku |
| NISKI | GPS API | Integracja z telematyką (po wyborze systemu) |
| NISKI | Email powiadomienia | Resend.com, powiadomienia@fleetstat.pl |
| NISKI | Audit log frachtów | Historia zmian: kto/kiedy/co zmienił |
| NISKI | Środowisko testowe | Osobny Firebase projekt |

---

## 14. DANE DOSTĘPOWE

| Zasób | Lokalizacja |
|-------|-------------|
| Firebase SA key | ~/Desktop/VBS-Stat.nosync/vbs-stats-firebase-adminsdk.json |
| Firebase Console | console.firebase.google.com → projekt vbs-stats |
| Vercel | vercel.com → projekt VBS-Stat |
| GitHub | github.com/wasikkamil-art/VBS-Stat |
| GitHub Backups | github.com/wasikkamil-art/vbs-stat-backups |
| Domena | fleetstat.pl (home.pl → Vercel DNS) |

### DNS fleetstat.pl
```
A    @    76.76.21.21
CNAME www  c7f6079a1bd51546.vercel-dns-017.com
```

---

## 15. PRACA Z CLAUDE (AI)

### Jak dawać zadania
1. Opisz co ma się zmienić i dlaczego
2. Pokaż screenshot jeśli to błąd wizualny
3. Wklej output terminala jeśli to błąd
4. Powiedz jaki jest oczekiwany rezultat

### Co Claude robi automatycznie
- Pisze skrypty Python do edycji App.jsx
- Generuje skrypty Node.js do operacji Firebase
- Buduje pliki Excel do weryfikacji/importu danych
- Analizuje dane z Firebase i plików Excel

### Czego Claude NIE robi bez Twojego potwierdzenia
- Nie deployuje bez komendy z terminala
- Nie zmienia Firebase Rules
- Nie importuje danych do Firebase
- Nie usuwa danych

### Wzorzec rozmowy dla nowej sesji
Powiedz Claude na początku:
> "Kontynuujemy pracę nad FleetStat. App.jsx ma X linii, backup na ~/Desktop/App_fresh.jsx"

---

*Dokument wygenerowany: 31.03.2026*
