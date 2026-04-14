# VBS-Stat / FleetStat — Pełny Handoff (stan na 2026-04-14)

Dokument do przekazania kontekstu do nowego czatu. Pokrywa CAŁY projekt — od stosu technologicznego, przez wszystkie moduły, aż po planowany panel kierowcy.

---

## 1. Stos / środowisko

- **Repo:** `VBS-Stat.nosync` (git, branch `main`, push do GitHub `wasikkamil-art/VBS-Stat`)
- **Główny plik:** `src/App.jsx` — monolit React (~13 000+ linii, jeden plik)
- **Backend:** Firebase Firestore + Firebase Storage + Cloud Functions (`functions/index.js`)
- **Hosting:** Vercel (fleetstat.pl / vbs-stat.vercel.app)
- **Proxy AI:** `/api/claude` (Vercel) → Anthropic API
- **Model AI:** `claude-haiku-4-5-20251001` (parser faktur + przyszły CMR)
- **Timezone:** Europe/Warsaw (UTC+1/+2) — daty ISO składamy ręcznie, NIE `new Date().toISOString()` dla dat lokalnych
- **Firebase projekt:** `vbs-stats` (europe-west1)
- **Karta API Anthropic:** firmowa

## 2. System ról

```
admin       — pełny dostęp (Kamil: wasik.kamil@gmail.com)
dyspozytor  — edycja frachtów, kosztów, spraw
kierowca    — osobny panel mobile-first (NOWY, w budowie)
podglad     — tylko odczyt
```

Rola z Custom Claims (Auth token) + fallback Firestore `users/{uid}.role`.
Cloud Functions `setUserRole` / `onRoleChange` synchronizują claims.

**Zmienne w App:**
- `isAdmin`, `isDyspozytor`, `isKierowca`, `isPodglad`
- `canEdit = isAdmin || isDyspozytor`
- `canFinance = isAdmin || isDyspozytor`

**Zakładki per rola:** `DEFAULT_TABS_BY_ROLE` (linia ~771). Kierowca widzi tylko `["driver"]`.
`canSeeTab(id)` + `ADMIN_ONLY_TABS = ["users", "email"]`.

## 3. Dane — gdzie co leży

### Firestore (monolityczny dokument `fleet/data`)
Klucze w jednym dokumencie (historyczne, z guard `safeDbSet`):
- `fleetv2_vehicles` — pojazdy (tablica obiektów)
- `fleetv2_frachty` — zlecenia transportowe (tablica)
- `fleetv2_costs` — rejestr kosztów (tablica)
- `fleetv2_categories` — kategorie kosztów
- `fleetv2_rent` — dane rentowności
- `fleetv2_docs`, `fleetv2_imi` — dokumenty, delegowania

**WAŻNE:** `safeDbSet` + `fleetDataSafe()` w regułach Firestore blokuje zapis pustych tablic. Admin pomija guard (po ostatnim fixie). Bez tego → brak zapisu → brak danych w UI.

### Osobne kolekcje Firestore
- `payments` — faktury kosztowe (moduł Płatności)
- `pauzy` — czas pracy kierowców
- `sprawy` — sprawy/tickety
- `users` — role, allowedTabs
- `chatRooms` + `chatRooms/{id}/messages` — czat
- `auditLog` — logi aktywności (immutable, admin-only read)
- `driverEvents` — zdarzenia kierowcy (załadunek/rozładunek, NOWE)
- `emailRecipients`, `emailLogs`, `config`, `fcmTokens`, `operacyjne`

### Firebase Storage
- `payments/{ts}_{rand}_{name}` — oryginały faktur
- `sprawy/...` — załączniki spraw
- `chat/...` — załączniki czatu

## 4. Co zostało zrobione w tej sesji (14.04.2026)

### Płatności — rozszerzenia
1. **Search/filters** — szukaj po nr FV, kliencie, NIP + zakres dat
2. **Email mobile layout** — kartowy zamiast 3-kolumnowej tabeli
3. **Pauza lokalizacja** — ostatni rozładunek zamiast hardcoded bazy
4. **Audit log** — `logAction()` helper + kolekcja `auditLog` + zakładka "Logi aktywności" (admin-only)
5. **Instance overrides (cykliczne FV)** — `instanceOverrides` na szablonie, upload + AI parse per instancja
6. **"Do uzupełnienia"** — instancje bez overrides: pomarańczowy nr FV, szare kwoty
7. **Fix overrides** — zawsze zapisuj wszystkie pola + fix `_hasOverrides`
8. **Fix załączników** — nie kopiuj pliku szablonu na instancje
9. **Windows readability** — min-width 1050px, większe fonty, ciemniejsze szare
10. **Stałe vs jednorazowe** — panel z podziałem kosztów + filtr `filterType`
11. **Dwa konta bankowe** — `bankAccount2` + labels, AI prompt rozszerzony
12. **Sprawy archiwum** — zamknięte sprawy ukryte domyślnie, przycisk "Archiwum (N)"

### Panel kierowcy — fundament
13. **Rola `kierowca`** — nowa rola w systemie, osobny layout
14. **DriverPanel** — mobile-first, lista zleceń (aktywne/nadchodzące/historia), detail z trasą
15. **Statusy załadunek/rozładunek** — przyciski z timestamp do `driverEvents`
16. **Email w driverHistory** — pole do łączenia kierowcy z pojazdem

### Fixy
17. **React.Fragment → div** — React nie importowany (JSX transform)
18. **Firestore rules** — admin pomija `fleetDataSafe()` guard (fix blokady zapisu)

## 5. Ostatnie commity

```
821d561 Vehicles: add email field to driver history for driver panel login
22eecb3 Driver panel: new 'kierowca' role with mobile-first order view
514cabb Fix: replace React.Fragment with div (React not imported)
c50aba3 Sprawy: archive closed cases — hidden by default, toggle to show
ea0dda9 Payments: support two bank accounts per invoice (PLN + EUR/USD)
30eb519 Fix: don't copy template file attachment onto recurring instances
10eb0d2 Payments: upload + AI parse for recurring instance overrides
779e859 Payments: recurring vs one-off cost breakdown panel + filter toggle
a188274 Payments list: improve table readability on Windows
c1c35bd Fix: instance overrides always save all fields (not just changed ones)
03fd0f0 Payments: rename override button to 'Uzupełnij dane z FV'
a88877f Payments list: 'do uzupełnienia' for missing invoice data on recurring
ebc5ab1 Payments: per-instance overrides for recurring invoices
f37296e Audit log: track all user actions + admin-only Logi tab
e002231 Email: show last unload code for paused vehicles instead of base code
5fe255d Email: mobile-friendly card layout for FleetStat status
c640bbb Payments: add search by invoice #, client, NIP and date range filter
```

## 6. Pułapki / zasady pracy

- **Jeden plik `src/App.jsx`** — używać `grep`/`Grep` do nawigacji
- **Timezone:** NIGDY `new Date().toISOString().slice(0,10)` dla dat lokalnych. Składać ręcznie.
- **Verify syntax:** `node -e "const fs=require('fs');const src=fs.readFileSync('src/App.jsx','utf8');require('esbuild').transformSync(src,{loader:'jsx'});console.log('OK')"`
- **React:** NIE MA `import React` — używa JSX transform. `React.Fragment` → `<div>` lub `<>`.
- **Firestore fleet/data:** guard `safeDbSet` + `fleetDataSafe()` — nie nadpisuj pustymi tablicami. Admin pomija guard.
- **Commit convention:** tytuł + bullet points + `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- **Push po każdej zmianie.** Vercel auto-deploy.
- **Cloud Functions:** deploy z terminala: `firebase deploy --only functions`
- **Firestore rules:** deploy: `firebase deploy --only firestore:rules`

## 7. PLANOWANY: Panel kierowcy — pełna specyfikacja

### Architektura
Kierowca po zalogowaniu widzi **kompletnie osobny layout** (bez sidebaru). Bazowy `DriverPanel` już istnieje (commit `22eecb3`), ale wymaga rozbudowy.

### Przypisanie kierowcy do pojazdu
W `driverHistory` na pojeździe (`fleetv2_vehicles[].driverHistory[]`) — wpis z polem `email` pasującym do `user.email`. Panel szuka:
```js
vehicles.find(v => (v.driverHistory || []).some(d => !d.to && d.email === user.email))
```

### Co kierowca WIDZI (tylko swoje auto):
1. **Zlecenia (frachty)** — trasy, daty, klient, km, waga — BEZ cen EUR, BEZ stawki €/km, BEZ przychodu
2. **Pojazd** — dane techniczne, przebieg — tylko swoje auto
3. **Serwis** — tylko serwisy swojego auta
4. **Spalanie / statystyki eksploatacyjne** (nowy widok do zrobienia)
5. **CMR** — upload zdjęcia → przetworzenie na skan → załącznik do zlecenia
6. **Czas pracy** — swoje pauzy
7. **Czat z dyspozytorem**

### Czego kierowca NIE WIDZI:
- Ceny za km, przychody, koszty, rentowność, faktury, płatności
- Inne auta i ich kierowców
- Sprawy, ustawienia systemu, użytkowników

### Zarządzanie kierowcami (admin panel)
- Osobna sekcja (nie razem z dyspozytor/podgląd)
- Przypisanie kierowcy do auta (po emailu)
- Widok raportów kierowcy (załadunki, rozładunki, CMR-y z `driverEvents`)

### Statusy zlecenia — flow
1. Dyspozytor tworzy fracht w panelu biurowym
2. Kierowca widzi go w swoim panelu
3. Kierowca klika "Potwierdzam załadunek" → timestamp do `driverEvents`
4. Kierowca klika "Potwierdzam rozładunek" → timestamp do `driverEvents`
5. Kierowca robi zdjęcie CMR → upload + przetworzenie na skan → załącznik
6. Dyspozytor widzi potwierdzenia + CMR w swoim panelu

### Problemy do rozwiązania
- **Frachty w `fleet/data`** — monolityczny dokument, kierowca nie może go edytować (brak `canEdit`). Zdarzenia kierowcy idą do `driverEvents` (osobna kolekcja). Trzeba zsynchronizować z frachtem (np. Cloud Function lub admin widok).
- **CMR processing** — zdjęcie z telefonu → image processing (contrast, crop, perspective) → czysty skan. Może Canvas API w przeglądarce lub Cloud Function z Sharp/ImageMagick.
- **GPS** — przygotowana architektura pod `widziszwszystko.pl` API (na końcu)

### Kolejność implementacji
1. Rozbudowa DriverPanel — zakładki (zlecenia, pojazd, serwis, czas pracy)
2. Zarządzanie kierowcami w panelu admin
3. Upload CMR z przetworzeniem na skan
4. Synchronizacja driverEvents → frachty (widok admin)
5. Czat kierowca ↔ dyspozytor
6. Integracja GPS (widziszwszystko.pl)

## 8. Otwarte zadania (nie zlecone, propozycje)

- **Dashboard płatności** — statystyki, wykresy (user zapisał na liście)
- **Export faktur do Excela** (user zapisał na liście)
- **Kompresja zdjęć przed uploadem** (oszczędność Storage)
- **Budget alert na GCP**
- **Backup Firestore**

## 9. Kontekst użytkownika

- **Imię:** Kamil (wasik.kamil@gmail.com) — admin
- **Styl:** polski, zwięzły, bez punktuacji, liczy się efekt
- **Workflow:** zmiana → push → sprawdź na produkcji → feedback
- **Urządzenia:** MacBook Air + Windows (dyspozytor) + iPhone 17 Pro (email)
- **GPS firma:** widziszwszystko.pl (niedługo montaż na pierwszym aucie)

---

**Stan na:** 2026-04-14, commit `821d561` na `main`.
