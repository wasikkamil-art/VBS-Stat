# FleetStat — Kontekst Projektu (do wklejenia w nowy czat)

## Projekt
FleetStat (fleetstat.pl) — SaaS do zarządzania flotą pojazdów dla firmy VBS Transport.
Repozytorium: `wasikkamil-art/VBS-Stat` na GitHubie.

## Stack technologiczny
- **Frontend**: React 18 + Vite + Tailwind CSS (jeden plik `src/App.jsx` ~8700 linii)
- **Backend**: Firebase Cloud Functions v2 (`functions/index.js`) — Node 20, region europe-west1
- **Baza**: Firebase Firestore — główny dokument `fleet/data` z polami `fleetv2_*`
- **Hosting frontend**: Vercel (deploy: `npm run build && npx vercel --prod`)
- **Hosting functions**: Firebase (`cd functions && npm run deploy`)
- **Email**: SendGrid (domena fleetstat.pl zweryfikowana, sender: flotaVBS@fleetstat.pl)
- **DNS**: home.pl (A record → 76.76.21.21, www CNAME → cname.vercel-dns.com, SendGrid CNAMEs)
- **Backup**: GitHub Actions — nocny cron do repo `wasikkamil-art/vbs-stat-backups`, pliki `backups/YYYY-MM-DD.json`

## Struktura danych Firestore

### Dokument `fleet/data` (Storage Keys):
```
SK.vehicles   = "fleetv2_vehicles"   — pojazdy (6 szt: v1-v6)
SK.costs      = "fleetv2_costs"      — koszty (752 pozycji)
SK.categories = "fleetv2_categories" — kategorie kosztów (17)
SK.frachty    = "fleetv2_frachty"    — frachty/zlecenia (~500)
SK.docs       = "fleetv2_docs"       — dokumenty
SK.imi        = "fleetv2_imi"        — deklaracje IMI/SIPSI (34)
SK.rent       = "fleetv2_rent"       — rentowność (82)
```

### Osobne kolekcje:
- `sprawy` — sprawy/case management (orderBy dataUtworzenia desc)
- `operacyjne` — dane operacyjne (KM, paliwo, dni na pojazd/miesiąc)
- `pauzy` — pauzy/postoje kierowców
- `emailRecipients` — odbiorcy emaili statusowych
- `emailLogs` — logi wysyłki emaili
- `users/{uid}` — profile użytkowników z rolami
- `config/email` — sendgridApiKey, senderEmail

## Kluczowe mechanizmy w App.jsx

### Zapis/Odczyt danych:
- `onSnapshot(fleet/data)` — real-time listener, aktualizuje stany React
- `_pendingWrites` Set + `WRITE_COOLDOWN = 2000ms` — blokuje onSnapshot podczas zapisu (race condition prevention)
- `debouncedDbSet(key, value, 300)` → `setDoc(DATA_REF(), {[key]: value}, {merge: true})`
- **WAŻNE**: Wszystkie efekty zapisu mają guard `loaded && array.length > 0` — zapobiega nadpisaniu danych pustą tablicą przy błędzie połączenia
- Error handler onSnapshot **NIE ustawia loaded=true** — wyświetla toast zamiast tego

### Role użytkowników:
- `admin` — pełny dostęp
- `dyspozytor` — zarządzanie flotą bez finansów
- `podglad` — tylko podgląd
- Custom Claims w Firebase Auth, synchronizowane przez Cloud Function `onRoleChange`

## Zakładki aplikacji:
1. **Dashboard** — przegląd floty, statusy pojazdów, mapy tras
2. **Frachty** — zlecenia transportowe (nrZlecenia, załadunek/rozładunek, vehicleId)
3. **FV/Płatności** — faktury (tylko finance)
4. **Koszty** — wydatki z kategoriami, PLN+EUR, import/eksport Excel
5. **Pojazdy** — profil pojazdu (tablica, marka, wymiary, wyposażenie, ubezpieczenie, historia kierowców)
6. **Serwis** — przeglądy, UDT, olej, opony
7. **Rentowność** — analiza zysku per pojazd (tylko finance)
8. **Dokumenty** — zarządzanie dokumentami z datami ważności
9. **IMI/SIPSI** — deklaracje delegowania UE z AI OCR
10. **Użytkownicy** — zarządzanie (admin only)
11. **Email statusy** — konfiguracja i logi emaili statusowych (admin only)
12. **Sprawy** — case management z timeline, załącznikami, @mentions (admin/dyspozytor)

## Cloud Functions (functions/index.js):
1. **onRoleChange** — Firestore trigger: sync roli z Custom Claims
2. **setUserRole** — callable: admin ustawia rolę
3. **sendFleetEmail8/14/20** — scheduled 3x dziennie (8:00, 14:00, 20:00 CET)
   - `buildEmailHTML()` generuje tabelę statusów pojazdów
   - Statusy: W trasie 🚛, Pauza/Baza ⏸/🏠, Planowany 📋, Wolny ⏳
   - Filtruje nieaktywne >30 dni
   - Baza pokazuje "PL 25-611 Kielce"
   - Layout 800px, kolumny 35%/18%/47%

## Pojazdy w systemie (6 szt):
| ID | Tablica | Typ | Marka | Wymiary |
|----|---------|-----|-------|---------|
| v1 | WGM 0475M | Solo | Iveco | 607x243x245 |
| v2 | TK 130EF | Bus | Renault Master | 460x220x230 |
| v3 | WGM 5367K | Solo | Iveco | 620x245x260 |
| v4 | TK 314CL | Bus | Iveco | 420x225x245 |
| v5 | WGM 0507M | Solo | Iveco | — |
| v6 | TK 315CL | Bus | Iveco | 420x225x245 |

## Co zostało zrobione w ostatnich sesjach:

### SendGrid + Email:
- Skonfigurowano SendGrid z weryfikacją domeny fleetstat.pl (DKIM, DMARC)
- Utworzono `config/email` i `emailRecipients` w Firestore
- Sender: flotaVBS@fleetstat.pl
- Template emaila: szeroki (800px), sortowanie statusów, filtracja nieaktywnych >30 dni, info o przyczepie dla Bus, kod bazy "PL 25-611 Kielce"

### Sprawy tab:
- Sortowanie: otwarta > w_toku > wstrzymana > zamknięta/wygrana/przegrana
- Naprawiono zapis (addDoc z toast feedback)
- Naprawiono usuwanie (deleteDoc z confirm)
- Sync editData z useEffect

### Krytyczny bug (NAPRAWIONY):
- **Problem**: Błędy QUIC protocol powodowały error w onSnapshot → `loaded=true` bez danych → efekty zapisu nadpisywały dane pustymi tablicami
- **Skutek**: `fleetv2_vehicles`, `fleetv2_costs`, `fleetv2_categories` zostały nadpisane `[]`
- **Fix**: Dodano guard `length > 0` do WSZYSTKICH efektów zapisu + error handler nie ustawia już `loaded=true`
- **Fix jest wdrożony na Vercel**

### DNS fleetstat.pl (home.pl):
```
A      fleetstat.pl              → 76.76.21.21
CNAME  www.fleetstat.pl          → cname.vercel-dns.com
CNAME  em3921.fleetstat.pl       → u64817387.wl138.sendgrid.net
CNAME  s1._domainkey.fleetstat.pl → s1.domainkey.u64817387.wl138.sendgrid.net
CNAME  s2._domainkey.fleetstat.pl → s2.domainkey.u64817387.wl138.sendgrid.net
TXT    _dmarc.fleetstat.pl       → v=DMARC1; p=none;
```

## DO ZROBIENIA (pending):
1. **PRZYWRÓCIĆ DANE** — uruchomić `node restore-data.js` w folderze projektu (backup `2026-04-02.json` → Firestore). Przywraca: vehicles, costs, categories, docs, imi
2. Przetestować email po przywróceniu danych
3. Opcjonalnie: rozdzielić App.jsx na mniejsze komponenty (8700 linii to za dużo)
