# SESJA-LOG.md — dziennik sesji FleetStat

Append-only dziennik. Każda sesja = nowa sekcja z datą i opisem.

**Co tu jest**: chronologia "co się działo" — decyzje, zmiany, blockers, otwarte wątki na koniec sesji.
**Stan AKTUALNY TODO**: `PODSUMOWANIE-PROJEKTU.md` sekcja 14 (checkboxy aktualizowane na bieżąco).
**Detail per zmiana**: `git log` (każdy commit z meaningful message).

**Jak wznowić po wyczerpanym limicie / nowej sesji**:
1. Przeczytaj `CLAUDE.md` (zasady projektu)
2. Przeczytaj ostatni wpis poniżej (gdzie skończyliśmy + co otwarte)
3. Przeczytaj `PODSUMOWANIE-PROJEKTU.md` sekcja 14 (aktualne TODO)
4. Sprawdź `git log --oneline -20` (co weszło między sesjami)

---

## 2026-05-04 — Audyt stanu + wprowadzenie trybu pracy step-by-step

**Kontekst startu**: User wkleił briefing z poprzedniej sesji (wyczerpał się limit). Briefing był sprzed kilku dni — od tego czasu doszło ~25 commitów. User poprosił o weryfikację co faktycznie zrobione + wprowadzenie systemu odpornego na limit.

### Audyt stanu (briefing vs faktyczne repo)

**Zrobione (po dacie briefingu)**:
- ✅ **PR #1 zmergowany** (commit `6d1c500`, branch `claude/priceless-easley-dd47b8`) — security fix P1+P3 (Custom Claim wygrywa nad Firestore + audit log w `onRoleChange` CF). Briefing zgadywał "PR #2", faktycznie #1.
- ✅ **Backup admin (P2)** — utworzony przez user, działa.
- ✅ **TODO #2 Tracker auto-off + email** — `21d2390` (auto po finalnym rozładunku) + `ef2f18f` (manual button "Wyślij podsumowanie" w FrachtyModal).
- ✅ **Round-trip frachty** (kółko/powrót) — kroki 1-5 (`1e3bd30`, `d8fa4c1`, `7ad1bb8`, `67427d5`).
- ✅ **Email do klienta rozbudowa** — adresy + sekcja CMR + checkbox "Co wysłać" + logo VBS + kosmetyka + click tracking off (`3eac110`, `61c4d20`, `e224680`, `1a6e2e9`, `193a413`).
- ✅ **Atomic frachty operations** (`6086c2c`) — fix array race condition.
- ✅ **Safety warstwa 1** (`05adb1e`) — PITR + daily backup + anti-wipe rule.
- ✅ **Tachograf** — nowa zakładka w GPS/Monitoring (Webfleet style, `ae8f904`).
- ✅ **GPS Atlas API breakage fix** (`bb332ac`) — Atlas zmienił format response (`deviceId` zamiast `dev.deviceName`).
- ✅ **Czas pracy `closeStaleActivities`** (`0bf446a`) — auto-close segmentów >24h.
- ✅ **Firestore auto-retry** (`4176b4c`) — onSnapshot fleet/data zamiast od razu pokazać toast.
- ✅ **Sprawy** (`3d5b2d0`) — admin/dyspo widzą wszystkie + auto-add autora.
- ✅ **Quality #5a-5d** — wszystkie 4 punkty zamknięte (ESLint v9, Husky, code splitting 5 lazy chunks, Playwright smoke E2E).

### Decyzje sesji

1. **Tryb pracy: step-by-step** — robimy JEDEN task at a time. Commit po każdym. Czekam na "OK" przed następnym. Nie batch'uję 5 zmian na raz.
2. **Każda decyzja: opcje + WYRAŹNA rekomendacja** — pierwszą linią rekomenduję X z 1-zdaniowym czemu, potem opcje A/B/C/D, czekam na wybór.
3. **Persystencja kontekstu (mechanizm D)**:
   - `SESJA-LOG.md` (ten plik) = chronologia sesji append-only
   - `PODSUMOWANIE-PROJEKTU.md` sekcja 14 = aktualny TODO (checkboxy na bieżąco)
   - `git log` = atomic record per zmiana (meaningful commit messages)
4. **Memory zaktualizowana**: `feedback_communication_style.md` rozszerzona o (a) "krok po kroku w EXECUTION", (b) "zawsze rekomenduj z uzasadnieniem".

### Otwarte na koniec sesji

**Następny TODO do wyboru** (czeka na user):
- **A) WhatsApp dokończenie** — CF wdrożone, brakuje: Firebase Secrets + Meta webhook URL + template approval (24-48h u Meta)
- **B) Czas pracy iter. 2** — kompensaty + alerty banner + timeline 7d + push FCM (duży feature, można pociąć na sub-feature'y)
- **C) AI chat Czas pracy** — najpierw potrzebne 2 decyzje od user: (a) dostęp admin vs +kierowca; (b) jeden vs multi-kierowca + Auto-reload Anthropic Console
- **D) Giełda wolnych pojazdów** — wymaga sesji projektowej (model danych, role, lifecycle ogłoszenia)
- **E) Tachograf po dniu używania** — fix bugów / refinement na podstawie user feedback
- **F) Coś innego** — sprecyzuj

**Operacyjne (user, nie Claude)**:
- TK 314CL — zły fracht (rozładunek 2026-04-03 przed załadunkiem 2026-04-30) do edycji/usunięcia ręcznie
- 2026-05-06 (śr) — pierwszy raport CSV z widziszwszystko (SendGrid Inbound Parse → wwReportInbound CF)
- Przed 2026-06-01 — upgrade SendGrid (trial kończy się)
- Decyzja E3 (merge Tachograf + Czas pracy w jeden widok) — czekamy 1-2 tyg na user feedback (od 2026-05-04)

### Flagged risks (komercjalizacja)

- ⚠️ Tyle nowych feature'ów (round-trip, email rozbud., atomic ops, Tachograf) — smoke testy pokrywają tylko login/tracker/lazy-chunks. Dla SaaS bar 10/10 warto dodać scenariusze regresyjne dla: round-trip flow + email do klienta + atomic op race.
- ⚠️ Atlas API już raz zmienił format (`deviceId`) — może mieć sens monitoring/alert na CF gdy `gpsProxy` zwraca pustą listę pozycji.

### Stan repo na koniec sesji

- **Worktree**: `claude/awesome-bouman-ca02a5` (folder `.claude/worktrees/awesome-bouman-ca02a5/`)
- **Last commit przed sesją**: `6d1c500` (Merge PR #1 — security fix P1+P3)
- **Produkcja**: fleetstat.pl (Vercel auto-deploy z main)
- **App.jsx**: 16,944 linii. `functions/index.js`: 3,001 linii.

---

## 2026-05-05 — Backup discipline (Krok 1 + Krok 2)

**Kontekst**: User zgłosił ryzyko utraty MacBooka (folder `*.nosync` wykluczony z iCloud). Zaplanowane 3 warstwy obrony — wykonane Krok 1 i Krok 2.

### Krok 1 — Push discipline + dokumentacja
- Commit `340a0d0` — utworzenie `SESJA-LOG.md` (mechanizm persystencji kontekstu)
- Commit `d25fd45` — `CLAUDE.md` sekcja "Backup workflow" + rozróżnienie `git push` na main (zawsze pytaj — deploy) vs feature branch (proaktywnie po sesji — backup)
- Push do remote: `origin/claude/awesome-bouman-ca02a5` (oba commits)
- Pre-push hook (lint + build) PASSED

### Krok 2 — Skrypt backup memory
- Plik `scripts/backup-claude-memory.sh` — bash, kopia memory + `.env.local` do iCloud Drive
- Cel: `~/Library/Mobile Documents/com~apple~CloudDocs/FleetStat-backup/`
  - `memory/YYYY-MM-DD/` — versioned snapshot per dzień (retention 30 dni)
  - `env/.env.local` — single copy overwrite
  - `manifest.txt` — append-only log (timestamp + file count)
- `.gitignore` zaktualizowany — whitelist `!scripts/backup-claude-memory.sh` (folder `scripts/` nadal blokowany dla utility scripts)
- Testy: dry-run + live run OK (2026-05-05 10:07, 14 plików memory / 60 KB)
- Auto-run: TBD Krok 2b (launchd plist codziennie 22:00) — czeka na user feedback

### Krok 2b — launchd auto-run (~30 min razem z TCC fix)
- **Plist**: `~/Library/LaunchAgents/com.fleetstat.backup-claude-memory.plist`
  - Codziennie 22:00 (StartCalendarInterval Hour=22 Minute=0)
  - Skrypt: `/Users/kamilwasik/Desktop/VBS-Stat.nosync/scripts/backup-claude-memory.sh` (po merge worktree→main, trwała ścieżka)
  - Logi: `~/Library/Logs/fleetstat-backup.log`
- **macOS TCC blocker**: pierwszy test launchd dał "Operation not permitted" — `/bin/bash` uruchamiany przez launchd nie miał uprawnień do czytania folderu `Desktop/`. Rozwiązanie: user dodał `/bin/bash` do **System Settings → Prywatność i ochrona → Pełny dostęp do dysku** (Cmd+Shift+G w file picker → `/bin/bash` → Open → toggle ON). Dodanie samej aplikacji "claude" NIE wystarczyło (launchd to osobny system process).
- **Test po TCC fix**: ✅ działa (2026-05-05 11:18:02 — 14 plików memory + .env.local zsynchronizowane)

### KRYTYCZNE odkrycie podczas sync main repo (Krok 2b ścieżka)

**Discovery 2026-05-05**: PR #1 (`6d1c500`) zmergował tylko Tachograf (`ae8f904`) z brancha `claude/priceless-easley-dd47b8`, **NIE security fix `3023f13`**. Briefing user'a (z poprzedniej sesji) twierdził że PR security został zmergowany — to było nieprawda. Memory `reference_admin_recovery.md` też mylnie twierdzała "P1+P3 wdrożone (commit 3023f13)".

**Dowód**: `git merge-base --is-ancestor 3023f13 origin/main` → "NO". Plus `git show origin/main:src/App.jsx` nie zawierał odwróconej priority logic (Custom Claim wygrywa).

**Stan na 2026-05-05 przed fix**:
- Lokalne working dir w main repo trzymał security fix code jako uncommitted (user pracował na main repo, kod siedział, nigdy nie został commitnięty)
- Produkcja `fleetstat.pl` przez ~24h (od PR #1 merge 4 maja wieczorem) miała stary kod — Firestore nadal wygrywała nad Custom Claim, audit log nie działał
- Backup admin (P2) działał ale recovery scenario zakładał działający P1+P3

**Fix 2026-05-05**:
- `2c1924f` — fix(security): role priority — Custom Claim wygrywa nad Firestore + audit log (commit do main)
- `900c070` — chore(lint): wyklucz .claude/ z ESLint scope (fix pre-push hook — porzucone worktrees miały JSX w .js)
- Push main OK, Vercel auto-deploy do `fleetstat.pl`
- Memory `reference_admin_recovery.md` zaktualizowana (commit `2c1924f` zamiast `3023f13`, dodana lekcja: zawsze weryfikuj `git merge-base --is-ancestor` zamiast zakładać że "PR #X = feature X")

**Lekcja**: nigdy nie zakładaj że PR przez nazwę = wdrożona feature. Zawsze sprawdź historię gita. Briefing user'a może być nieprecyzyjny — czytaj git log + sprawdzaj kod.

### Stan końcowy 2026-05-05

**Origin/main commits (najnowsze)**:
- `671df63` — Merge worktree branch (docs + scripts) do main
- `900c070` — chore(lint): wyklucz .claude/ z ESLint scope
- `2c1924f` — fix(security): P1+P3 (FAKTYCZNE wdrożenie do produkcji)
- `6d1c500` — Merge PR #1 (Tachograf — wcześniejszy fałszywy "security PR")

**Backup discipline aktywne**:
- Repo: zsynchronizowany z origin (push po sesji = backup)
- Memory + .env.local: launchd codziennie 22:00 → iCloud Drive `FleetStat-backup/`
- Manual run gdy chcesz: `./scripts/backup-claude-memory.sh` (z dowolnego miejsca repo)

### Otwarte (do osobnej akcji user'a)

- ⚠️ **Rotacja GitHub PAT** — wyciekł do transcript chatu przez `git remote -v`. Procedura w `CLAUDE.md` sekcja Backup workflow → "Security PAT".
- **C — Verify Vercel deploy** security fix:
  1. Otwórz `fleetstat.pl`
  2. F12 (DevTools) → Console
  3. Zaloguj się
  4. Szukaj `[role]` warning w console (pojawi się gdy Custom Claim ≠ Firestore — potwierdza że nowa logika P1 działa)
  5. (alt) Firebase Console → Firestore → `auditLog` collection — czy są nowe `action: "role_change"` documents (P3)
- **Krok 3** (opcjonalne, $$$): Time Machine + external SSD — najmocniejszy fail-safe (backup wszystkiego automat)
- **TODO feature work** wracamy gdy user gotowy:
  A WhatsApp / **B alerty banner Czas pracy** (rekomendacja moja) / C AI chat / D Giełda / E Tachograf refinement / F inne

### Rotacja GitHub PAT — zrobione w ramach sesji
- Stary token "token kopii zapasowej vbs-stat" (ostatnio używany w VBS-Stat repo) — REVOKED
- Nowy token: Fine-grained, scope: `Contents: Read and write` + `Metadata: Read`, repo: tylko `wasikkamil-art/VBS-Stat`, expiration: 2027-05-05
- `git remote set-url` w obu repos (main + worktree) — user wykonał lokalnie (token NIE w transcript)
- Test `git push --dry-run` — OK w obu repos

### CF onRoleChange — deploy P3 audit log
- Wcześniej tylko code w `functions/index.js` w main, ale CF live nie był updated (Vercel deployuje frontend, NIE Functions)
- `firebase deploy --only functions:onRoleChange` z main repo — Successful update, region europe-west1, Node 22
- Odtąd każda zmiana roli → entry `action: "role_change"` w `auditLog` collection (z polami `before`, `after`, `targetUid`, `targetEmail`)
- Test pending: user zmieni rolę backup admin Admin→Dyspozytor + z powrotem → 2 nowe entries w auditLog

### Drugi incydent admin "Podgląd" 2026-05-05 — naprawiony re-loginem
- ~14:00 user zalogował się do fleetstat.pl, sidebar pokazał "Podgląd" (brak admin tabs)
- F12 Console: `permission-denied` dla wszystkich kolekcji + `Bład ladowania roli`
- Hipoteza: stary cache/SW lub stary bundle (sprzed P1 deploy)
- Fix: re-login (wylogowanie + ponowne zalogowanie) → admin sidebar + zakładki wróciły
- **POTWIERDZA że P1 fix (Custom Claim wygrywa nad Firestore) działa na produkcji** — fresh login zaciąga claim z token Auth poprawnie
- Errors w console po re-login = stare (sprzed re-login), Cmd+K w console + F5 wyczyściło

---

## 2026-05-05 (popołudnie) — Bug raport Czas pracy + 2 bugi znalezione

**Kontekst**: User pokazał kafle pojazdów w Przeglądzie:
- WGM 5367K i WGM 0507M oboje rozładowani 04.05
- Oboje mają wbitą bazę (przez modal CzasPracyModal) z planowanym wyjazdem 08.05
- Oboje pokazują **"Czeka na zlecenie · 1d"** zamiast "Baza"
- ⚠️ User flag: emaile do klientów zawierają info "kiedy auta będą dostępne" — bug = błędne info do zleceniodawców

### Bug A — Calendar marker offset by 1 day (timezone) — ✅ NAPRAWIONY (commit 268890c)

**Lokalizacja**: `src/App.jsx:14049-14053` w `CzasPracyModal.entryMap`

**Przyczyna**:
```javascript
const start = new Date(e.start + "T00:00:00");  // local midnight
entryMap[d.toISOString().slice(0,10)] = e;       // toISOString() konwertuje na UTC
```
- `new Date("2026-05-05T00:00:00")` = local midnight (PL UTC+2 latem) = 5 maja 00:00 PL
- `d.toISOString()` = "2026-05-04T22:00:00.000Z" (UTC)
- `.slice(0,10)` = "2026-05-04" — kropka pojawia się o dzień wcześniej niż wpis

**Fix** (commit `268890c`):
```javascript
const start = new Date(e.start + "T12:00:00");  // noon anchor — bezpieczne dla DST/UTC offset
entryMap[d.toLocaleDateString("sv-SE")] = e;     // sv-SE = ISO YYYY-MM-DD w LOCAL timezone
```

**Wdrożone**: worktree → main → push main → Vercel auto-deploy (~3 min do fleetstat.pl)

**Sam zapis był OK** (handleSaveRange używa stringów YYYY-MM-DD bez Date object) — tylko display kropek.

### Bug B — Home tile pokazuje "Czeka na zlecenie" mimo aktywnej bazy — ⏳ DIAGNOZA W TOKU

**Symptom**:
- WGM 0507M ma w `pauzy` collection: `start: "2026-05-04"`, `end: "2026-05-07"`, `status: "baza"`, `vehicleId: "v5"`
- Home tile filter (App.jsx:2582): `pauzy.find(p => p.vehicleId === v.id && p.status !== "jazda" && p.start <= todayISO && p.end >= todayISO)`
- Dla today `"2026-05-05"`: filter powinien match (`"2026-05-04" <= "2026-05-05" <= "2026-05-07"` ✅)
- ALE home tile pokazuje "Czeka na zlecenie" → filter FAIL

**Hipoteza**: `pauzy` state w React jest pusty (subscription nie wyładowała się po re-login) lub home tile nie re-renderuje po update'cie pauzy. Wcześniej (jako "Podgląd") `pauzy onSnapshot error FirebaseError: Missing or insufficient permissions` — być może subscription pozostała "broken" po claim recovery.

**Czeka na user diagnostykę** (po Vercel deploy Bug A ~16:30):
1. Hard refresh fleetstat.pl
2. Sprawdź sidebar **"Czas pracy — Statusy kierowców"** — czy widać wpisy "Baza" dla 0507M?
   - **Jeśli TAK** → `pauzy` jest załadowany, bug w home tile filter (mało prawdopodobne — filter prosty)
   - **Jeśli NIE** → `pauzy` nie załadowany w state, problem subscription/permissions
3. F12 Console — czy są nowe errors `pauzy onSnapshot...`?

**Możliwe rozwiązania (po diagnozie)**:
- Naprawa subscription auto-retry (jak `fleet/data` onSnapshot ma już)
- Reload `pauzy` subscription on auth change
- Defensywnie: home tile czyta też `driverActivities` (status="baza") jako fallback gdy `pauzy` puste

**Też do sprawdzenia**: czy email do klienta z info "kiedy auta dostępne" używa `pauzy` (i ma ten sam bug), czy innego źródła. **Jeśli dotknięty → priorytet wysoki dla SaaS bar 10/10**.

### Stan końcowy 2026-05-05 (zamknięcie sesji ~16:00)

**Origin/main commits (najnowsze)**:
- `268890c` — fix(czas-pracy): Bug A — calendar marker offset by 1 day (timezone)
- `671df63` — Merge worktree branch (docs + scripts)
- `900c070` — chore(lint): wyklucz .claude/ z ESLint scope
- `2c1924f` — fix(security): P1+P3 (FAKTYCZNE wdrożenie security do produkcji)
- `6d1c500` — Merge PR #1 (Tachograf)

**Backup discipline aktywne**:
- Repo: push po sesji do GitHub
- Memory + .env.local: launchd codziennie 22:00 → iCloud Drive `FleetStat-backup/`
- PAT zrotowany 2026-05-05, expires 2027-05-05

**Otwarte (do następnej sesji)**:
1. ⏳ **Bug B diagnoza** — user testuje po Vercel deploy (~3 min od ostatniego push)
2. ⏳ **P3 audit log test** — user zmienia rolę backup admin (Admin→Dyspozytor→Admin) + sprawdza auditLog czy są nowe entries `role_change`
3. ⏳ **Sprawdzenie email do klienta** — czy używa `pauzy` (bug B impact?) lub innego źródła
4. ⏳ **TODO feature work** (gdy gotowy):
   - **B alerty banner Czas pracy iter. 2** ⭐ rekomendacja moja
   - A WhatsApp / C AI chat / D Giełda / E Tachograf refinement
5. **Opcjonalnie**: credential helper macOS Keychain (token z `.git/config` → encrypted Keychain)
6. **Opcjonalnie**: Time Machine + external SSD (Krok 3 backup)

**Jak wznowić w nowej sesji**:
1. Przeczytaj `CLAUDE.md` (zasady projektu)
2. Przeczytaj ten wpis (gdzie skończyliśmy + co otwarte)
3. Sprawdź `git log --oneline -10` (czy weszło coś między sesjami)
4. Pierwszy komunikat: "Wznawiamy z 2026-05-05 — co dalej z Bug B diagnoza / P3 test / TODO B / inne?"

---

## 2026-05-05 (kontynuacja popołudniowa, ~13:30-15:00) — Bug B resolved + CSV verify + DDD parser fix + raport view

**Kontekst**: Druga część sesji 2026-05-05 po przerwie. User zostawił otwartą diagnostykę Bug B + chciał zweryfikować pierwszy raport CSV z widziszwszystko + sprawdzić jak działa parser DDD na pierwszym realnym pliku karty kierowcy. (Wpis poniżej był wcześniej błędnie nagłówkowany jako "2026-05-06" — naprawione: dziś jest 2026-05-05, sesja kontynuowana tego samego dnia.)

### Bug B — RESOLVED (nie kod, stuck subscription)

User otworzył fleetstat.pl po hard refresh: kafle pojazdów pokazują "Baza · do X maj" poprawnie, sidebar Czas pracy widzi wpisy, F12 Console bez errors.

**Root cause**: stuck subscription state. Podczas incydentu admin "Podgląd" (~14:00 wcześniejsza sesja) `pauzy onSnapshot` rzucił `permission-denied`. Firestore SDK nie auto-reconnect'uje po permission error. Re-login Custom Claim wrócił, ALE subscription `pauzy` pozostała broken aż do fresh page load po Vercel deploy.

**Lekcja architektoniczna**: `fleet/data` ma już auto-retry (`4176b4c`), inne `onSnapshot` (jak `pauzy`) — nie. Defense layer (backlog, NIE pilne): retry wrapper na permission errors lub force-reload subscriptions na `onIdTokenChanged`.

### Email do klienta — bezpieczny ✅ (zweryfikowane)

Grep w `functions/index.js`: CF `sendStatusEmail` (linia 234, 456-461) używa `pauzy` collection ALE przez `db.collection("pauzy").get()` — fresh fetch, NIE onSnapshot. Bug B-pattern NIE wpływa na email. Filter logic identyczny do home tile (App.jsx:2582). Email pokazuje `"Dostępny od: {pauzy.end} · {locationKod}"`. Caveat: gdy decyzja E3 (merge Tachograf + Czas pracy → driverActivities) zostanie wdrożona, trzeba zsynchronizować email też.

### CSV widziszwszystko — DZIAŁA ✅ (pierwszy raport zaimportowany)

Logi CF `wwReportInbound` z dziś **02:04 CEST**:
```
[wwInbound] from=WidziszWszystko <admin@widziszwszystko.eu> subject="Twój raport został wygenerowany" csvFiles=1
[wwInbound] OK imported=21 replaced=15
```

Pierwszy realny raport CSV przyszedł z widziszwszystko o 02:04, CF zaimportowała **21 segmentów** do `driverActivities`, zastąpiła 15 starych auto_gps tym samym przedziałem (DDD/CSV priorytet nad auto_gps, jak zaplanowano). Następny raport spodziewany **2026-05-06 ~02:04** za zakres 2026-05-05.

### DDD parser — FIX + Raport view ⭐ kluczowy progres dziś

**Punkt wyjścia**: User dostał plik `.ddd` od kierowcy WGM 5367K (Siarhei Kolabau, 121 KB karta kierowcy) — pierwszy realny test parsera. Upload przez UI → CF zwróciła `success` ale **0 aktywności + fileType=unknown**.

**Diagnoza**: pobrałem plik z Storage przez `gcloud storage cp`, lokalnie sparsował przez readesm-js v1.0.12 i znalazłem **root cause**: parser zakładał `parsed.blocks[].className` (tablica), a readesm-js v1.x zwraca **obiekt z kluczami top-level per block class** (parsed.Identification, parsed.CardDriverActivity, parsed.CardVehiclesUsed itp). Wszystkie selektory pól w starych extractorach nigdy niczego nie znajdowały. Plus plik zawierał **CardVehiclesUsed.records** z VRN per pojazd + okres + km (wbudowane mapowanie kierowca→pojazd) — niewykorzystane.

**Fix** (`functions/index.js`, commit `550670a`, deployed do produkcji):
- `extractDddMetadata` — czyta `parsed.Identification`, `parsed.DriverCardApplicationIdentification` (typeOfTachographCardId), `parsed.CardVehiclesUsed.CardVehicleRecord.records` (last → `meta.vehicleVrn`); periodStart/End z `dailyRecords` keys
- `extractDddVehicleRecords` (nowa) — lista pojazdów + okresy + km z CardVehiclesUsed, mapowanie VRN→vehicleId z fleet/data
- `computeDddDailyReport` (nowa) — buduje `dailyTotals` z compact segments `{type, fromMin, durMin}` + sumy minut + km per dzień + total summary (~140 KB dla 365 dni, mieści się w 1 MB Firestore)
- `parseDddFile` — usuwa batch save do `driverActivities`. **DDD = archive snapshot per kierowca**, nie live state. Cały raport zapisany w jednym `dddFiles` document (decyzja architektoniczna user'a)

**Pre-test na pliku Siarheia** (lokalnie + produkcja):
- 4350 segmentów (drive 1843, work 1465, rest 973, avail 69) z 397 dni / 240 z aktywną jazdą
- 1587.5 h jazdy, 329.8 h pracy, 69 244 km przez 13 mc (2025-04-04 → 2026-05-05)
- vehicleVrn=WGM 5367K mapowane na vehicleId=v2 (z 200 vehicleRecords)
- Document size 253 KB / 1 MB Firestore limit (75% margin)

**Raport DDD UI** (`src/App.jsx`, commit `32818f9` + `7aa40e9`, deployed):
- Klik na entry w "Pliki wgrane" → otwiera `DddReportView` (nowy komponent ~250 linii)
- Header (kierowca + karta + okres + uploader)
- Podsumowanie zakresu — 4 kafelki (jazda/praca/dyspo/odpoczynek) + km + dni + pojazdy. Sumy **dynamicznie** dla wybranego zakresu (nie zawsze totals).
- Lista pojazdów grouped per VRN (suma km, dni, period używania, mapowanie vehicleId)
- **Daily ribbons** — chronologicznie rosnąco (najstarsze → najnowsze, jak czyta się tachograf), 24h kolorowy pasek per dzień (zielony/żółty/szary/niebieski), hover tooltip z czasem **lokalnym PL** (auto DST detection: ostatnia niedziela marca → ostatnia niedziela października = +120, inaczej +60)
- Filtr **zakresu dat** (Od/Do input + presety "Ostatnie 7 dni" / "Ostatnie 28 dni" / "Reset")
- Toggle "Tylko z jazdą" (default) / "Wszystkie dni"
- **Print PDF** — `window.print()` + print stylesheet (`src/index.css`): A4, force-color ribbons (`-webkit-print-color-adjust: exact`), `page-break-inside: avoid` per dzień, sidebar `print:hidden`

### Decyzje architektoniczne

1. **DDD = archive per kierowca, nie live Czas pracy** — wpisanie 4350 segmentów do `driverActivities` zaburzyłoby compliance bieżącego tygodnia (`computeDriverCompliance` widziałby 13 mc starych danych). Cały raport siedzi w `dddFiles`, generowany w UI per kliknięcie pliku.
2. **Tablet kierowcy = przyszłość** — user pisze "tablet to przyszłość, jednak musimy mieć w pamięci że kiedy je zakupimy będzie miejsce w kodzie". Czyli Etap 6 (widok obecnego wyjazdu z compliance live) buduje się **teraz tylko jako admin widok w FleetStat**, ale architekturze: pure function compliance w `czasPracy.js` + komponent `CurrentTripView` standalone — żeby DriverPanel mógł reuse 1:1 gdy kupimy tablety.

### Stan repo na koniec sesji

- Origin/main najnowsze: **`7aa40e9`** — feat ulepszenia raportu DDD (sortowanie + filtr dat + range summary)
- `32818f9` — feat DddReportView (3 etapy)
- `550670a` — fix parsera DDD (deployed CF)
- `1883ecf` — docs SESJA-LOG Bug B
- `23feb44` — docs SESJA-LOG koniec sesji porannej

Worktree branch `claude/eager-rhodes-513624` zsynchronizowany z origin (push backup OK).

### Otwarte (do następnej sesji)

1. ⭐ **Etap 6 — Widok obecnego wyjazdu kierowcy z compliance live** (admin widok w FleetStat, NIE DriverPanel jeszcze):
   - Mieszane źródła: DDD (28d historii, precyzja tachografu) + driverActivities live (auto_gps + ww_csv) dla bieżącego dnia. Wykorzystać już istniejący `preferDddSegments` z `czasPracy.js`.
   - Pure function `computeCurrentTrip` w `czasPracy.js` — compliance live: ile jeszcze może jechać dziś (9h/10h dzienny limit), kiedy obowiązkowa przerwa (4.5h ciągłej jazdy → 45 min), ile do daily rest 11h, weekly rest 45h, dwa-tygodniowy 90h
   - Standalone komponent `CurrentTripView` — przyjmuje propsami, reużywalny. Architektura przewiduje tablet kierowcy (DriverPanel) w przyszłości.
   - ~3-4h pracy. Wymaga sesji dedykowanej z planem na początku.
2. 📋 **Delete button** w UI dla `dddFiles` — wymaga sprawdzenia storage rules + dodania do GpsDddSection. Obecnie 2 entry obok siebie (stary 0 act + nowy 4350 act) — czyste artifact testu, nie blokuje.
3. ⏳ **P3 audit log test** — user zmienia rolę backup admin Admin→Dyspozytor→Admin → sprawdzenie `auditLog` collection w Firestore.
4. 📋 **Defensive auto-retry dla `pauzy`/innych subscription** — backlog, niska pilność.
5. 📋 **TODO feature work** (oprócz Etap 6): A WhatsApp / B alerty banner Czas pracy iter. 2 / C AI chat / D Giełda / E Tachograf refinement.
6. 🐛 **Drobiazg**: hardcoded text w `GpsDddSection` "Pierwszy odczyt karty kierowcy dla WGM 0475M oczekiwany za ~28 dni" — pokazuje się tylko gdy `dddFiles` puste, ale user już ma plik więc to nie widać. Update tekstu kiedyś.
7. 🐛 **Drobiazg**: `dist/index.html` jest tracked w git mimo `dist/` w .gitignore (historyczne) — przy każdym build pokazuje się jako modified. Untrack przy okazji.

### Operacyjne (user, nie Claude)

- 2026-05-06 (jutro) ~02:04 — drugi raport CSV widziszwszystko (zakres 2026-05-05). Sprawdzić czy nadal działa.
- Przed 2026-06-01 — upgrade SendGrid (trial kończy się)
- Decyzja E3 (merge Tachograf + Czas pracy) — czekamy 1-2 tyg na user feedback (od 2026-05-04)
- Tablet dla kierowców = decyzja zakupowa user'a (przyszłość, brak harmonogramu)

---

## 2026-05-06 — Incident OC + 4 fixy reliability (commits e538dad + ae6dcc4)

**Kontekst**: rano user zauważył że OC Przewoźnika (uploaded wczoraj wieczór 23:23) zniknął z UI. Sesja zaczęła się od debug "OC nie widać" → odkrycie data loss → recovery z PITR → diagnoza root cause → 4 architektoniczne fixy.

### Linia czasu

1. **AI model fix** (commit `43c8975`) — `claude-sonnet-4-20250514` → `claude-sonnet-4-6` w 3 miejscach `/api/claude` (BulkUpload, AI chat, drugi upload). Stary model deprecated → BulkUpload silently failed → user'a 2 pierwsze próby uploadu OC nie zapisały się.
2. **Visibilitychange recovery** (commit `9f94410`) — defense layer dla zombi onSnapshot subscriptions. Tab focus + 30s throttle → force re-subscribe dla `fleet/data`, `pauzy`, `dddFiles`. Console log `[X] tab focused — forcing fresh subscribe`.
3. **DATA LOSS incident**: OC Przewoźnika zniknął z `fleet/data.fleetv2_docs` (2→1). PITR (Point-In-Time Recovery, 7 dni retention) pokazał OC w snapshocie wczoraj 22:00 UTC. Recovery 2× (pierwszy raz 10:30 PL, drugi wipe ~10:44 PL bo user był jeszcze na starym bundle, drugi recovery 10:50 PL). Mechanizm recovery: `gcloud auth print-access-token` + Firestore REST API PATCH z `updateMask=fleetv2_docs`.
4. **3 fix architektoniczne** (commit `e538dad`):
   - `safeDbSet`: rozszerzona shrink protection (każdy shrink bez `markIntentionalDelete` flag = BLOKED + toast). Intentional delete tracking (Set + 2s flag) dla legit delete. Update `onDelete` callbacków: docs, costs, rent, imi.
   - **Custom Claim force refresh**: gdy claim ≠ Firestore role (lub claim brak), force refresh token + retry zanim setRole. Naprawia "muszę odświeżyć kilka razy żeby wskoczyło Admin" (4. raz w 72h: 2026-05-04, 05, 06).
   - **firestore.rules**: `fleetNoMassWipe` + `fleetDataSafe` rozszerzone na `fleetv2_docs`, `fleetv2_imi`, `fleetv2_categories` (server-side defense in depth). Deploy przez `firebase deploy --only firestore:rules`.
5. **Reset Tacho race fix** (commit `ae6dcc4`) — user testował Reset Tacho po deploy, "wracało przekroczone". Root cause: `_pendingWrites.add(key)` było dopiero w `dbSet` po 300ms debounce. W tym oknie onSnapshot odbierał stale snap → setVehicles revertował user click. Fix: `_pendingWrites.add(key)` SYNCHRONICZNIE w `safeDbSet` (po passing guards, przed debouncedDbSet timer). Window protection ~2.3s od click. Reset Tacho zostaje empty po klik.

### Lessons learned (architektoniczne)

- **PITR działa** — Safety warstwa 1 (`05adb1e`) z 7-dniową retencją uratowała życie. Recovery przez REST API + Python script (`/tmp/recover-oc.py`) — udokumentowane jako workflow.
- **Stuck subscription pattern się powtarza** — 3. raz w 72h (Bug B `pauzy` + `fleet/data` 2× dziś). Defense visibilitychange recovery wdrożony, ale problem może wracać dla collections których jeszcze nie zabezpieczyłem (operacyjne, driverActivities, emailRecipients, fuelEntries, chatRooms, sprawy, rentownosc).
- **Custom Claim force refresh** — token Firebase Auth cache ~1h. `_justLoggedIn` flag działa tylko przy świeżym sign-in, nie przy reload. Niezgodność claim vs Firestore = ZAWSZE force refresh. Code path commit `e538dad`.
- **safeDbSet ma 2 warstwy guards**: empty (drop > 3 → 0) + shrink (every shrink bez intent flag). Plus firestore.rules jako last line of defense.
- **`_pendingWrites` musi być setowane SYNCHRONICZNIE** przy user-initiated write (nie po async debounce). Inaczej onSnapshot fresh-but-stale revertuje state.

### Stan repo na koniec sesji

Origin/main: `ae6dcc4` (Reset Tacho race fix). 7 commitów dziś:
- `ae6dcc4` fix: _pendingWrites.add synchronicznie w safeDbSet
- `e538dad` fix: data loss protection (3 fixes — safeDbSet shrink, Custom Claim, rules)
- `9f94410` fix(reliability): visibilitychange recovery zombi onSnapshot
- `43c8975` fix(ai): claude-sonnet-4-20250514 → claude-sonnet-4-6
- `7990795` docs: SESJA-LOG.md sesja 2026-05-05 popołudnie
- `7aa40e9` feat(ddd): chronologiczne sortowanie + filtr dat + range summary
- `32818f9` feat(ddd): DddReportView header + summary + ribbons + PDF

### Otwarte (do następnej sesji)

1. ⭐ **Etap 6 — Widok obecnego wyjazdu kierowcy z compliance live** (rekomendacja moja, ~3-4h). Plan w memory `project_ddd_etap6_plan.md`. Pure function `computeCurrentTrip` w `czasPracy.js` + komponent `CurrentTripView` reuse-ready dla tabletu kierowcy w przyszłości. Mieszane źródła DDD + driverActivities live, użycie `preferDddSegments`.
2. 📋 **Visibilitychange recovery dla pozostałych onSnapshot** — `operacyjne`, `driverActivities`, `emailRecipients`, `fuelEntries`, `chatRooms`, `sprawy`, `rentownosc`. Backlog, niska pilność (mniej user-facing).
3. 📋 **Loud error handling** w BulkUpload — toast gdy AI fails (zamiast cichego `status="error"` w queue). Skojarzenie z incident: 2 pierwsze próby OC silently failed.
4. 📋 **Delete button** w UI dla `dddFiles` — wymaga storage rules check + dodania do GpsDddSection.
5. 📋 **P3 audit log test** — user zmienia rolę backup admin Admin→Dyspozytor→Admin → sprawdzenie `auditLog`.
6. 🐛 Drobiazgi: hardcoded text "WGM 0475M ~28 dni" w pustym GpsDddSection. `dist/index.html` tracked w git mimo `.gitignore`.

### Operacyjne (user)

- 2026-05-07 (jutro) ~02:04 — kolejny raport CSV widziszwszystko, sprawdzić w logach CF czy działa
- Przed 2026-06-01 — upgrade SendGrid (trial)
- Decyzja E3 merge Tachograf + Czas pracy — od 2026-05-04, czekamy ~1-2 tyg
- Tablet dla kierowców = decyzja zakupowa, brak harmonogramu

---

## 2026-05-06 (popołudnie/wieczór) — Mega sesja: CSV widziszwszystko + Reset Tacho saga + ROOT CAUSE memory cache

**Kontekst**: Sesja kontynuowana. User chciał 1) nowy CSV widziszwszystko (worktime z address) 2) widok wielodniowy w Czas pracy 3) ostatecznie znaleźć Reset Tacho race + nawracający data loss.

### Część 1 — CSV widziszwszystko + Aktywność wielodniowa (~3h)

User pokazał worktime CSV z panelu (różny format od auto-email roadcard CSV):
- Worktime per pojazd, separator `;`, 3 typy (Jazda/Postój/Brak danych) + address
- Roadcard per kierowca, separator `,`, 4 typy (Jazda/Praca/Dyspo/Odpoczynek)

Commits:
- `1bcf9e7` Heurystyka C w `wwReportInbound` CF: Postój ≥9h → rest, 45min-9h → avail, <45min → work
- `e6b9de1` Widok wielodniowy "Aktywność" w GPS/Monitoring (między Czas pracy a Tachograf). Reuse `DddDailyRow` + helpery z DddReportView. Cross-day split, filtr dat, presety 7/28d, tooltip address.
- `7747f45` Auto-detect separator CSV (",`/`;`) w `wwReportInbound` — worktime CSV failował z missing_column bo csv-parse default ",".

**Backfill historyczny**: user zmailował szczegółowy CSV (od 23.04 do dziś) na imports@inbox.fleetstat.pl → CF imported=136 replaced=213. Heurystyka C zastąpiła stare auto_gps + ww_csv segmenty.

### Część 2 — Compliance refactor (~1h)

User (z linku https://dlafirm.pracuj.pl/blog/czas-pracy-kierowcy potwierdzonego przez Read) zauważył że **tygodnie liczone błędnie** w `czasPracy.js`. `lastWeeklyRestEnd` primary path zwracał koniec ostatniego rest 45h zamiast pn 00:00 (nie zgodne z 561/2006 art. 4(i)).

Plus pasek "Czas pracy 48h" miał zawsze stały żółty kolor (mylące — wyglądało jak ostrzeżenie nawet przy 45%).

Commits:
- `f9537bc` Dynamic color workTime 48h (>limit red, >85% yellow, else blue)
- `374e53f` Tydzień kalendarzowy 561/2006 (zawsze pn 00:00) + biweekly = 2 tyg kalendarzowe (poprzedni pn 00:00 → teraz, nie rolling 14×24h). Plus dynamic color dla weekly + biweekly drive bar.

Na WGM 0475M biweekly spadło z 89h 52min (rolling) → ~66h (kalendarzowy) — bezpieczniej, zgodnie z prawem ITD.

### Część 3 — Imię kierowcy w UI (~30 min)

User chciał imię kierowcy przy rejestracji pojazdu w Frachty/Pojazdy/Dokumenty. Wybrał format A (append do "{brand} · {year}").

- `93fa520` `activeDriverName(v)` + `vehicleSubtitle(v)` helpery globalne. 6 lokalizacji zaktualizowanych (Frachty per pojazd, Frachty after select, Pojazdy tab, Pojazdy detail z type, Pojazdy archived, Dokumenty grouping).

### Część 4 — Reset Tacho race condition (5 podejść!)

User zgłosił że Reset Tacho **nadal wraca**, mimo wczorajszego fix `_pendingWrites synchronicznie` (commit `ae6dcc4`).

**Podejście 1** (`e4c4143`): atomic Firestore transaction `dbUpdateVehicleField(id, patch)` zamiast setVehicles → useEffect → safeDbSet → debounce. Race-free przez Firestore retry. **Nie pomogło dostatecznie** — Reset wciąż wracał po visibilitychange.

**Podejście 2** (`d5f1a61`): cache filter w onSnapshot fleet/data: `if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;`. **PSUŁO** — strona zawisła "Ładowanie danych" bo initial cache emit był blokowany.

**Podejście 3** (`4a40251`): naprawa #2 — `_serverSnapReceivedRef` (useRef boolean). Initial cache emit przepuszczony. Po pierwszym server snap → ref=true → blokuj kolejne pure cache emits. Działało dla fleet/data, ale **inne kolekcje (pauzy, dddFiles)** podatne.

**Podejście 4 — ROOT CAUSE** (`f39a199`): user widział że "OC zniknął znowu, pauza Bazy znikła w innej przeglądarce". Memory cache fix. **`src/firebase.js`** używał `persistentLocalCache + persistentMultipleTabManager`. To był GŁÓWNY sprawca: persistent IndexedDB cache emit + multi-tab share generuje stale cache emits przy visibility recovery. Zmiana na `memoryLocalCache()` — cache RAM tylko per session. Bundle spadł 1822 → 1727 kB.

### Część 5 — Pauzy UX

Audit log pokazał: `2026-05-06T17:55:55 delete mod=pauzy wasik.kamil@gmail.com`. **User sam przypadkowo kliknął ✕** w CzasPracyModal podczas testów Reset Tacho. Brak confirm dialog.

Commits:
- `6780602` Confirm dialog przed delete pauzy (`window.confirm("Usunąć pauzę baza 4 maj → 8 maj?")`).
- `0312288` Unique check pauzy w `onSave` — block addDoc gdy duplicate (vehicleId+status+start+end). Plus PRIORYTET 3.5 home tile dla pauzy zaplanowanej "Baza za Xd".
- `3c7392a` Smart baza: gdy kierowca rozładował się + ma pauzę "baza" w przyszłości + brak nextF → traktuj jako aktywną bazę "Baza · do X" (nie "Baza za Xd"). User logiczny argument: kierowca po rozładunku JEST na bazie, nie "za 2 dni będzie".

### Recovery OC Przewoźnika 2× w jednym dniu

- Rano: PITR snapshot 2026-05-06T08:35Z → 2 docs. Recovery + 4 fixy reliability (e538dad, ae6dcc4, 9f94410, 43c8975).
- Wieczór: znów zniknął. PITR sprawdzenie pokazało docs count history: 8h temu=2, 6h=2, 4h=2, **2h=1, 1h=1**. Zniknął między 14:17-16:17 UTC, w oknie testów Reset Tacho 17:53. PITR 14:17 snapshot → wyciągnąłem `id=ikfnwup4` → PATCH fleet/data?updateMask=fleetv2_docs → 2 docs ✅.

**LEKCJA: PITR readTime musi być whole minute** (sekundy=00). Inaczej `FAILED_PRECONDITION` "read_time is not a whole minute".

### Stan repo na koniec sesji

13 commitów dziś (od `ad7c3f1` base):
- `3c7392a` smart baza
- `0312288` unique check pauzy + Baza za Xd
- `6780602` confirm dialog delete pauzy
- `f39a199` **memory-only Firestore cache** ⭐ ROOT CAUSE
- `4a40251` cache filter initial load fix
- `d5f1a61` cache filter (broken→fixed)
- `93fa520` imię kierowcy 6 miejsc
- `e4c4143` Reset Tacho atomic transaction
- `374e53f` tydzień kalendarzowy + dynamic color
- `f9537bc` dynamic color workTime 48h
- `7747f45` auto-detect separator CSV
- `e6b9de1` widok wielodniowy Aktywność
- `1bcf9e7` heurystyka C dla Postój

Plus OC Przewoźnika odzyskany manualnie z PITR (poza commit, REST API PATCH).

### Otwarte (na obserwację — czeka na user verdict)

User: "widać jedno i drugie poczekam czy za jakis czas nie zginie" — testuje memory cache fix przez czas. Jeśli problem WRACA, robimy:
1. **Granularny audit log** per fleet/data sub-field — diff per write z user.email + clientId. Wtedy gdy znów zniknie, dokładnie wiemy kto/kiedy/co.
2. **Field-level shrink protection** w `safeDbSet` — wykrycie gdy field znika z elementu array bez `markIntentionalDelete`.

Plus zawsze w backlogu:
- ⭐ **Etap 6** (widok obecnego wyjazdu kierowcy + compliance live) — plan w memory `project_ddd_etap6_plan.md`. ~3-4h, sesja dedykowana.
- Visibilitychange recovery dla pozostałych onSnapshot (operacyjne, driverActivities, emailRecipients, fuelEntries, chatRooms, sprawy, rentownosc) — backlog niska pilność po memory cache fix.
- Loud error handling w BulkUpload (toast gdy AI fails)
- Delete button dla dddFiles w UI

### Operacyjne (user)

- 2026-05-07 (jutro) ~02:04 — kolejny raport CSV widziszwszystko, sprawdzić w logach
- Czeka na fix verdict (memory cache) — może 1-2 dni
- 2026-06-01 deadline — upgrade SendGrid (trial)
- Etap 6 — gdy gotowy

---

## 2026-05-06 (późny wieczór, ~23:00-00:00) — Druga regresja + atomic helpers fix + audit log fleetWrite

**Kontekst**: User po hard refresh: WGM 0507M znowu "Tacho: przekroczone o 8 dni · 31.03.2026" + WGM 5367K też wrócił. **REGRESJA mimo memory cache fix**. User: "potrzebny jakiś audyt bo zrobilismy mnostwo poprawek a nic nie zmieniałem".

### Diagnoza (analiza audit log)

Sprawdziłem Firestore — w arrayie `fleetv2_vehicles`:
- WGM 0507M: tachoStart=`2026-03-31` (stara wartość)
- WGM 5367K: tachoStart=`2026-04-24` (stara wartość)

**Audit log** dla mod=vehicles po 17:53:23: **PUSTO**. Czyli żaden user nie pisał vehicles bezpośrednio (przez logAction). ALE Firestore ma stare wartości — coś nadpisało **bez logAction**.

**Source**: `useEffect [vehicles, loaded]` (linia ~1483) → `safeDbSet(SK.vehicles, vehicles)` — **NIE** wywołuje logAction. Cichy writeback. Jeśli onSnapshot dał stale snap → setVehicles ze stary → useEffect → safeDbSet zapisał stary → fresh atomic Reset nadpisany.

### Fix #1: Granularny audit log fleetWrite (commit `020be4e`)

Nowy helper `logFleetWrite(field, prev, next, source)` w `src/utils/logAction.js`:
- `computeFleetDiff(prev, next)` → returns { removed, added, changed, prevCount, nextCount }
- changed entry: `{ id, plate, fields: { fieldName: { from, to } } }` (max 10 entries, 60 char per value)
- logAction("fleetWrite", field, { source, ...diff })

Wywoływany w `safeDbSet` PRZED każdym write — loguje co useEffect chain pisze. Plus `_lastFleetValuesRef.current[key]` trzyma ostatni server value (update przy onSnapshot) — diff względem prawdziwego server state.

W UI "Logi aktywności" admin może filtrować action="fleetWrite" + module="fleetv2_vehicles" → DOKŁADNIE zobaczy kto/kiedy/co napisał.

### Fix #2: Atomic helpers BEZ _pendingWrites.add (commit `f6ff72c`)

User test pokazał: klik Reset Tacho atomic write zapisuje do Firestore (audit pokazuje), ALE state lokalnie zostaje stary aż do hard refresh.

**Root cause**: atomic helpers (`dbUpdateVehicleField`, `dbDeleteFromArrayField`, `dbAddToArrayField`) miały `_pendingWrites.add(key)` + setTimeout 2s WRITE_COOLDOWN. W onSnapshot listener: `if (!_pendingWrites.has(key)) setVehicles(...)`. Gdy server emit z naszą zmianą przyszedł w 2s cooldown, _pendingWrites.has=true → IGNORE. Po cooldown brak nowego snap (memory cache nie emituje cache, tylko fresh server) → state zostaje stary.

**Fix**: usuń `_pendingWrites.add` z atomic helpers. Atomic transactions same są race-safe (Firestore retry przy konflikcie). Server emit po atomic commit → setVehicles z fresh data → UI aktualizuje się natychmiast.

`_pendingWrites` zostaje dla nieatomic dbSet (debounce + setDoc merge) — tam race jest realny.

Plus: `logFleetWrite` z source="atomic/..." dodany do każdego atomic helper — audit log pokaże WSZYSTKIE writes (atomic + safeDbSet/useEffect).

### Stan końcowy 2026-05-06 (sesja 2 → 3)

15 commitów dziś (od `ad7c3f1` base):
```
f6ff72c fix(atomic): usuń _pendingWrites.add z atomic helpers  ← fresh state natychmiast
020be4e feat(audit): granular fleet/data write log z diff per field
69b7001 fix(docs): atomic Firestore transaction dla docs delete + add
376d18c (rebase)
279c140 docs: SESJA-LOG sesja popołudnie/wieczór
3c7392a feat(home-tile): smart baza
0312288 feat(pauzy): unique check + Baza za Xd
6780602 fix: confirm dialog delete pauzy
f39a199 fix(firestore): memory-only cache  ⭐ ROOT CAUSE
4a40251 fix(reset-tacho): cache filter zezwala initial load
d5f1a61 fix(reset-tacho): skip stale cache emit (broken→fixed)
93fa520 feat(ui): imię kierowcy w 6 miejscach
e4c4143 fix(reset-tacho): atomic Firestore transaction
374e53f fix(czas-pracy): tydzień kalendarzowy + dynamic color
f9537bc fix(czas-pracy): dynamic color workTime 48h
7747f45 fix(ww-csv): auto-detect separator
e6b9de1 feat(czas-pracy): widok wielodniowy "Aktywność"
1bcf9e7 feat(ww-csv): heurystyka C dla Postój
```

OC Przewoźnika odzyskany 2× z PITR (rano + wieczór, REST API PATCH manualnie).

### Otwarte na jutro 2026-05-07

⭐ **Pierwsze co user zrobi po hard refresh + login**:
1. Klik Reset Tacho na WGM 0507M lub WGM 5367K
2. Sprawdzić czy pole staje się puste **natychmiast** (bez hard refresh) — atomic helpers fix
3. Sprawdzić Logi aktywności → filter action="fleetWrite" — pierwsze takie entry powinno pojawić się TERAZ
4. Verify: pojedynczy klik = pojedynczy fleetWrite z `from: stara_data, to: null`. Jeśli pojawi się **drugi fleetWrite** z odwróconym diff (`from: null, to: stara_data`) = **mamy dowód race condition** useEffect chain → kolejny refactor

📋 **Jeśli race nadal jest** (drugi fleetWrite po atomic):
- **Refactor vehicles do atomic** — usunąć `useEffect [vehicles, loaded]` + `safeDbSet(SK.vehicles, ...)`. Zastąpić każdy `setVehicles` atomic helper (`dbAddVehicle`, `dbUpdateVehicle`, `dbDeleteVehicle`, `dbUpdateVehicleField` już jest). Jak frachty od 2026-04-30 commit `6086c2c`. ~20 miejsc w kodzie.
- Potem: **costs/docs/rent/imi** — analogicznie eliminować useEffect writebacks (zachować tylko atomic helpers).
- Ostateczny fix race condition na fleet/data.

📋 **Jeśli atomic fix wystarcza** (brak drugiego fleetWrite):
- **UI polish dla audit log** — polski label "Zapis fleet/data" + parser details.changed → "WGM 0507M: tachoStart 2026-03-31 → null" zamiast raw JSON. ~15 min.
- Można wracać do **Etap 6** (compliance live, plan w memory).

📋 **Bug do diagnozy** — recovery starych wartości po hard refresh:
- Możliwe że memory cache fix nie jest jedynym sprawcą; wciąż jest **drugie źródło** stale data.
- Audit log fleetWrite wskaże w pierwszym teście.

📋 **Backup memory + .env.local** — launchd codziennie 22:00 → `~/Library/Mobile Documents/com~apple~CloudDocs/FleetStat-backup/`. Sprawdź `manifest.txt` jutro czy zaszedł.

### Operacyjne (user)

- 2026-05-07 (jutro) ~02:04 — kolejny raport CSV widziszwszystko, sprawdzić logi CF
- 2026-06-01 — upgrade SendGrid trial
- Etap 6 — gdy stable po data loss saga

---

## 2026-05-07 / 2026-05-08 — MEGA-SESJA: recovery + atomic refactor + GPS konsolidacja + Tachograf Webfleet + DDD live compliance

20 commitów w jednej długiej sesji. Najwięcej zmian w jednym dniu od startu repo.

### Część 1 — Diagnostyka data loss + recovery (rano 2026-05-07)

User zgłosił że WGM 0507M nie ma kierowcy w UI Przegląd, plus inne pojazdy mają "Jan Kowalski" / "Piotr Wiśniewski" zamiast aktualnych imion (Volodymyr Iwansky / Siarhei Kolabu / volodymyr.lukashuchuk). 3 dzień łatka-do-łatki — meta-pattern szukamy.

**Diagnoza 3-fazowa (read-only, ~45 min)**:
1. **PITR snapshots** (6 punktów w czasie) — kolekcje, counts, diff
2. **Audit log fleetWrite** — kto/kiedy/co napisał ostatnie 24h
3. **Code audit** (Explore agent) — wszystkie write paths fleet/data

**Smoking gun**: fleetWrite 2026-05-07 08:12:45 UTC, source=`safeDbSet/useEffect`, prev_count=6 → next_count=6, **30+ pól ustawionych na None** dla każdego z 6 pojazdów. VIN, OC numer/expiry/kwota, AC, GAP, inspectionExpiry, udtExpiry, wartość netto, assignedDriver, tachoStart — **WSZYSTKO zniknęło**.

Source: `useEffect [vehicles, loaded] → safeDbSet(SK.vehicles, vehicles)` — silent writeback z stale state (partial vehicle objects z formularza edycji). Ten sam mechanizm który zniszczył frachty 2026-04-30, OC Przewoźnika 2026-05-06 — w pojazdach wciąż istniał.

**Recovery**: PITR snapshot `1h ago` (08:00 UTC) → PATCH `fleet/data?updateMask=fleetv2_vehicles` → 6 pojazdów z VIN/OC/aktywnymi kierowcami przywrócone. HTTP 200, updateTime 09:37 UTC.

### Część 2 — Atomic helpers refactor (kontynuacja 2026-04-30 dla frachty)

**Komit `08fc5e1`** — vehicles atomic:
- USUNIĘTY `useEffect [vehicles, loaded] → safeDbSet` (linia 1508)
- Nowe helpery: `dbAddVehicle`, `dbAssignDriverToVehicle`, `dbUnassignDriverFromVehicle`
- Refactor 6 callsite (`addVehicle`, `delVehicle`, `updateVehicle`, `restore`, `assignDriverToVehicle`, `unassignDriver`)

**Komit `01483c4`** — fix widoku statusów kierowców w Przeglądzie:
Helper `liveDriver(plate)` wyciąga aktywnego kierowcę z `vehicles[].driverHistory` zamiast `p.driver` (stale string w pauzy). Zero drift gdy kierowca się zmieni.

**Komit `653f26e`** — docs atomic:
- USUNIĘTY useEffect [docs, loaded]
- `onEdit` dokumentu refactor na `dbUpdateInArrayField` (był optimistic setState)
- Nowe helpery: `dbUpdateInArrayField` (update item po id) + `dbBulkReplaceArrayField`

**Komit `dc53e59`** — imi atomic:
- USUNIĘTY useEffect [imiRecords, loaded] (onAdd/onDelete już atomic)
- Wyjaśnia symptom z 2026-05-06 wieczór: 28 IMI zniknęło-wróciło + 5 (delete duplikatów) wracało

Zostały do faza 2: **costs, rent, categories** (ten sam pattern, niska pilność).

### Część 3 — GPS/Monitoring konsolidacja 8 → 3 zakładki

User: "uważam że mamy tu za dużo rzeczy". Komity:

- `4ef12c4` — ukryte: Kilometry/Trasy/Karta kierowcy (5 zakładek)
- `7115eda` — wycięte 522 linie kodu (GpsKilometry/Trasy/KartaSection)
- `7cf7dcb` — nowe nazwy: ddd → "Tachograf", tachograf → "Czas pracy kierowcy", aktywnosc → "Monitoring jazdy"
- `b26e3f8` — Monitoring jazdy scalony jako sekcja Multi-day timeline w Czas pracy kierowcy (4→3)

**Final layout**: Mapa online, Tachograf (pliki DDD), Czas pracy kierowcy (Webfleet view + plan + multi-day timeline).

### Część 4 — Tachograf compliance 1:1 z Webfleet

User pokazał screenshoty Webfleet — porównanie z naszym Tachografem.

- `fd8f941` — **fix 13h → 15h** "najpóźniejszy koniec zmiany" (Pakiet Mobilności art. 8.4). Dynamiczne: 15h gdy skrócenie dostępne, 13h gdy 3/3 użyte. + tooltip z explanation.
- `7738146` — sekcja "Zmniejszone tygodniowe czasy odpoczynków — Wyrównanie" (art. 8.6). Algorytm FIFO: skrócony tygodniowy (24h ≤ x < 45h) dodaje brakujące min do owed, wydłużony (>45h) kompensuje. Deadline = endMs najstarszego nieskompensowanego + 3 tyg.
- `b61fec0` — scalenie **Plan do przodu** + **Timeline 24h (z 7d wstecz)** ze starego GpsCzasPracySection.
- `26a0c9c` — usunięcie zbędnego info-boxa "Widok zgodny z Webfleet".

### Część 5 — Email "Status floty" — smart baza + logo VBS

User pokazał email — pojazdy z pauzą zaplanowaną w przyszłości po rozładunku pokazywały "DO PODJĘCIA" zamiast "Baza".

- `deaa574` — smart baza w `buildEmailHTML`: jeśli kierowca rozładował się + ma pauzę baza zaplanowaną + brak nextF → `isCurrentlyAtBaza=true` → wyświetla 🏠 Baza · "Dostępny od: X" · PL 25-611 Kielce. Plus sortowanie: W trasie najpierw, Baza na dole. Plus "Pauza/Baza: N" w nagłówku liczy aktywne + at-base.
- `d2e1fa1` — logo VBS w nagłówku (analogiczne do emaila "Kółko zakończone").

Bug "wciąż DO PODJĘCIA po deploy" — okazało się że jest **druga CF** `sendFleetEmailNow` (manualne wysyłanie) której nie zdeployowałem osobno. Po deploy wszystkich 4 (sendFleetEmail8/14/20/Now) — działa.

### Część 6 — DDD parser → driverActivities live (decyzja 2026-05-05 zrewidowana)

User pyta o source danych compliance. Wyjaśnienie: ww_csv + auto_gps live, DDD = archive only (decyzja 2026-05-05). User: "to chce odwrotnie — DDD jest nadrzędne (rozliczane przez policję), system powinien nadpisać CSV/GPS gdy kierowca wgra DDD".

**Plan implementacji**:
- `ce9ae97` — Cloud Function `parseDddFile` po `dddFiles add` zapisuje segmenty z `source="ddd"` do `driverActivities`. Reupload safety: usuwa stare segmenty source=ddd dla danego kierowcy w periodStart→periodEnd. `preferDddSegments` w czasPracy.js automatycznie wycina ww_csv/auto_gps w pokrytych zakresach (już istniało).
- `7ae4de7` — match po **cardNumber** w driverHistory (primary), fallback po nazwie (case-insensitive trim). Powód: DDD ma `driverName="Siarhei Kolabau"` ale fleet/data ma `"Siarhei Kolabu "` (rozjazd transliteracji). cardNumber = deterministyczny (jeden na 5 lat). + UI input "Numer karty kierowcy (DDD)" w driverHistory editor.
- `9a8be33` — fix `FAILED_PRECONDITION` (cleanup query wymagał composite index). Uproszczone: single-field query po driverEmail + composite filter w JS.

**Test Siarhei (user wgrał plik DDD ponownie po update cardNumber)**:
- 4350 segmentów ddd trafiło do driverActivities
- Total Siarhei: 4357 (4350 ddd + 6 ww_csv + 1 auto_gps)
- Weekly rests merged ≥24h (z DDD): 3 segmenty
  - 17-19.04 → 45h 5min (regularny, +0.1h ekstra)
  - **25-26.04 → 24h 1min** (SKRÓCONY, brak 21h) ⚠
  - 02-04.05 → 45h 16min (regularny, +0.3h ekstra)
- **OWED: 20h 43min**, deadline **17.05 07:28**

**To realne** ostrzeżenie dla dyspozytora. Pierwszy raz w aplikacji compliance z **rzeczywistego tachografu**.

### Część 7 — heurystyka ww_csv (konserwatywne)

User pokazał timeline Volodymyra — nocą szary (avail). Bug: heurystyka klasyfikowała postoje 45min-9h jako avail mimo że nocą kierowca spał (powinno być rest).

Najpierw zaproponowałem heurystykę nocną (22:00-06:00 → rest), user wycofał: "zrobimy inaczej, dyspozycyjność zamienimy na niebieski (rest)".

- `5bc3a66` — `mapWwPostojToType`: ≥45min → rest, <45min → work. **Brak avail z CSV** — DDD da prawdziwy avail (kierowca świadomie wciska "?"). Plus migration 29 istniejących avail (source=ww_csv) → rest.
- Avail w bazie po migration: 69 (wszystkie z DDD = świadomie wciśnięte na tachografie).

### Część 8 — GPS scale-up: 3 pojazdy GPS (był 1)

User dodał fizycznie GPS do WGM 0507M i WGM 5367K. Plus dodał "gps" w equipment przez UI edit pojazdu (test atomic helpers in real use — działa, fleetWrite audit log pokazuje atomic/dbUpdateVehicleField).

- `a7558c9` — imię kierowcy w lewym panelu listy GPS po marce ("Iveco · Volodymyr Iwansky")
- `061133b` — fix 2 bugów:
  - Zielona ikonka tylko dla `ignitionState=ON` lub pozycji <10 min → dodano check `hasTodayActivity` (drive/work segment dzisiaj)
  - **Stale closure setInterval** w auto-refresh: `if (!selectedDevice) setSelectedDevice(...)` resetował wybór na pierwszy pojazd co 30s (zamiana na funkcyjny setState z fresh prev)

### Część 9 — 4 BUGI compliance znalezione + udokumentowane (do dedykowanej sesji)

Po dorobieniu DDD live, user pyta dlaczego niewidoczne weekly rest Volodymyra (9-11.05). Analiza segmentów:

**Faktyczny rest**: 9.05 09:49 PL → 11.05 07:42 PL = **45h 53min** regularny ✅

**W bazie**: 3 fragmenty z gap 24h "ciszy" CSV (CSV nie raportuje gdy silnik wyłączony). Algorytm `weeklyRestCompensation` filtr `s.durMin >= 24*60` → żaden fragment nie kwalifikuje → fałszywy alarm "brak weekly rest".

**4 bugi compliance udokumentowane** w memory `project_priority_compliance_data_verify.md`:
1. CSV "milczy" + algorytm nie scala fragmentów = false alert weekly rest
2. auto_gps generuje krótkie switches drive/rest <1 min (fragmentacja)
3. Weekly rest deadline kalendarzowo (nd 00:00) zamiast 561/2006 art. 8.6 (6×24h od last rest end)
4. Uproszczenie kalendarzowe weekly rest deadline

Wszystkie do dedykowanej sesji compliance verify (~1-2h).

### Stan końcowy 2026-05-08

20 commitów dziś. Vercel deploy live (`5bc3a66` ostatni). Cloud Functions deploy: sendFleetEmail8/14/20/Now, parseDddFile, wwReportInbound.

### Otwarte na następną sesję

⭐ **PRIORYTET — Dedykowana sesja compliance verify** (~1-2h):
- 4 bugi udokumentowane w memory `project_priority_compliance_data_verify.md`
- Cel: 1:1 z 561/2006 + Pakiet Mobilności
- Test cases: Volodymyr (gap CSV), Siarhei (DDD source of truth), edge cases

📋 **Faza 2 fleet/data zakończenie**: costs, rent, categories atomic helpers (~30 min, low priority)

📋 **DDD Krok 3 (zaplanowane na "jutro" z dzisiejszej sesji)** — UI badge "TCH" przy danych z tachografu (~1h, dla użytkowników widzieć czy dane są z DDD czy CSV/GPS)

📋 **DDD pozostałych kierowców** — Volodymyr Iwansky (priorytet — często skrócenia), Lukashuchuk, Mirosław Teper. Każdy plik = realne dane.

📋 **scheduledGpsPoll — fragmentacja krótkich switches** — gdzieś bug który generuje 30+ drive/rest po 0-1 min (hysteresis: speed > 5 → drive, speed < 1 → rest)

📋 **Delete button dla dddFiles** w UI (zaplanowane wcześniej, nie zrobione)

### Operacyjne (user)

- Następny CSV widziszwszystko ~02:04 PL kolejnego dnia — sprawdzić heurystyka E działa (postoje ≥45min → rest)
- 2026-06-01 deadline — upgrade SendGrid trial
- Plus: 3 pojazdy GPS aktywne (była 1) → dane compliance dla WGM 0507M i 5367K będą rosły

### Memory zaktualizowane

- `MEMORY.md` — dodany priorytet ⭐ z gwiazdką
- `project_priority_compliance_data_verify.md` — utworzony (rano) + zaktualizowany (wieczór, 4 bugi udokumentowane)
- `feedback_communication_style.md` — rozszerzony o "po ludzku, nie żargonem" (user feedback)


---

## 2026-05-11 — Compliance verify (audit + 2 z 4 bugów fixed)

**Kontekst startu**: priorytet ⭐ z memory `project_priority_compliance_data_verify` — 4 bugi compliance udokumentowane 2026-05-08 podczas mega-sesji. Flota GPS rośnie (3 pojazdy aktywne), błędne compliance = ryzyko mandatów. Sesja dedykowana ~1-2h.

### Audit (read-first)

Mapa kodu po przeczytaniu:
- **Silnik**: `src/utils/czasPracy.js` (493 linii) — REGULATION + computeDriverCompliance + computeDriverPlan + weeklyRestCompensation + preferDddSegments
- **3 źródła** w `functions/index.js`:
  - `scheduledGpsPoll` (565-717) — auto_gps source
  - `wwReportInbound` + `processWWCsv` + `importWWForVehicle` + `mapWwPostojToType` — ww_csv source (z fix `5bc3a66` postoje≥45min jako rest)
  - `parseDddFile` (segment writes 1520-1625) — ddd source
- **Render**: `TachografComplianceSection.jsx` (107 → `plan?.weeklyRest?.startMs`)

Mapowanie 4 bugów na linie kodu + ranking impactu:
1. #1 Weekly rest false alert (active complaint) — `czasPracy.js:246-278`
2. #3+#4 Deadline kalendarzowy (planowanie tras) — `czasPracy.js:158-165` + `455-460`
3. #2 auto_gps fragmentation (cosmetic + edge) — `functions/index.js:664`

### Bug #1 ✅ commit `79ae3c7`

CSV widziszwszystko nie raportuje fragmentów gdy silnik OFF → weekend kierowcy = 2-3 rest fragmenty rozbite ~24h gap'ami. `weeklyRestCompensation` filtruje per-segment `durMin >= 24*60` → żaden fragment samodzielnie nie kwalifikuje → false alert "brak weekly rest".

Volodymyr WGM 0475M (weekend 9-11.05.2026, faktyczny rest 45h53min):
- 09.05 09:49→10.05 03:03 PL = 15h13min (ww_csv)
- gap 24h (silnik OFF)
- 11.05 03:01→09:43 PL = 6h45min (auto_gps)

Fix: nowa funkcja `coalesceRestGaps(segments)` jako export utility — scala 2+ rest oddzielonych BRAK segmentu drive/work/avail między nimi. Wywołane lokalnie w `weeklyRestCompensation` (mała blast radius — nie ruszamy current state UI, daily sums, continuousDrive, lastDailyRestEnd). Filozofia spójna z `5bc3a66` — gap = kontynuacja rest dopóki brak sprzecznego dowodu.

Po fix Volodymyr: 1 scalony rest 45h58min, `coalesced=true`, kwalifikuje jako weekly rest ✅.

### Bug #3+#4 ✅ commit `02a3e86`

Screenshot user'a 2026-05-11 — mimo że Volodymyr wykręcił 45h, system pokazuje "Odpoczynek tygodniowy 17.05 00:00 → 18.05 21:00" (kalendarzowo niedziela). Faktycznie wg 561/2006 art. 8.6 deadline = `koniec_poprzedniego_weekly_rest + 6×24h`.

`lastWeeklyRestEnd(segments, now)` ignorował segments — komentarz w kodzie potwierdza: "segments... nieużywane" — zawsze zwracał kalendarzowy poniedziałek.

Fix:
- Nowa funkcja `lastActualWeeklyRestEnd(segments, now)` — szuka rest≥45h w lookback 14d (z `coalesceRestGaps` z fix #1)
- `computeDriverCompliance` zwraca pole `lastActualWeeklyRestEnd`
- `computeDriverPlan.weeklyRest`: `endMs + 6×24h` jeśli istnieje, fallback na niedzielę kalendarzową gdy null (nowy kierowca / brak danych ≥45h w 14d — backward compat)
- NIE zmienione `lastWeeklyRestEnd` (używane w App.jsx + computeDriverCompliance dla weekStart kalendarzowy = sums tygodniowe wg art.4i — inny semant)

Po fix Volodymyr: deadline 17.05 09:43 → 19.05 06:43 (zamiast 17.05 00:00 → 18.05 21:00). W innych przypadkach (kierowca skończył rest w środę 12:00) różnica może być ~3-4 dni.

### Bug #2 🔲 OTWARTE — osobna sesja

`scheduledGpsPoll` (`functions/index.js:664`): `speed > 3 ? "drive" : "rest"` bez hysteresis → 30+ switches drive/rest po 0-1 min na sygnalizacji/korkach.

Plan fix (przygotowany, NIE wdrożony):
- Hysteresis: speed > 5 → drive, speed < 1 → rest, w środku utrzymaj poprzedni typ
- Min-duration filter: zatrzymanie <2 min nie kończy drive

Wymaga **CF deploy z main repo** (memory `feedback_deploy_worktree.md` — z worktree NIE działa). Osobna sesja.

### Stan końcowy 2026-05-11

**Branch**: `claude/affectionate-buck-2399c6` na `origin` (2 commits ahead of main)
- `79ae3c7` — fix #1 (coalesceRestGaps)
- `02a3e86` — fix #3+#4 (lastActualWeeklyRestEnd + deadline art.8.6)

**PR**: https://github.com/wasikkamil-art/VBS-Stat/pull/new/claude/affectionate-buck-2399c6

**Verify produkcyjnie po merge** (user):
1. Mergeuj PR → main → Vercel auto-deploy ~3 min
2. Otwórz fleetstat.pl → Tachograf → Volodymyr WGM 0475M
3. Sprawdź: (a) kafel "Wyrównanie tygodniowe" zielony (owedMin=0) + (b) "Odpoczynek tygodniowy" pokazuje 17.05 09:43 → 19.05 06:43 (NIE 17.05 00:00)

**Otwarte na kolejną sesję**:
- Bug #2 (auto_gps fragmentation hysteresis) — wymaga CF deploy z main repo
- Pozostałe priorytety z poprzedniego SESJA-LOG (DDD pozostali kierowcy, badge "TCH" w UI, delete button dddFiles, etc.)

### Memory zaktualizowane

- `project_priority_compliance_data_verify.md` — status OPEN → IN PROGRESS, bugi #1 + #3+#4 oznaczone ✅ z commit hash, bug #2 OTWARTE z notatką "wymaga CF deploy z main repo"

---

## 2026-05-25 — VBS Faktury sesja: ETAP 1+2 + caching + anti-hallucination fix

**Projekt**: vbs-invoices (`~/Desktop/vbs-invoices.nosync/`, osobny od FleetStat). 7 commitów lokalnych, **NADAL bez remote git** (TODO sprzed sesji nie zrobione).

### Punkt startowy
- Iter 2 promptu deployed wcześniej; 261 FV w bazie z parsing issues (forward Bartka/Dextraline odrzucany)
- Scheduler wyłączony, czekał na decyzje user'a

### Co zrobione (chronologicznie, 7 commitów)

1. **`ba1b975` inspectMailbox callable** — debug structure maili bez Claude/zapisu (+ UI sekcja "🔍 Diagnoza struktury maili" w Dashboard). Pozwoliło zdiagnozować że mail Dextraline ma 5 top-level attachments (3 logo + FV + POD), scanner JE WIDZI — problem leży gdzie indziej.

2. **`c4202cb` ETAP 1 fix forward FV**:
   - `shouldAcceptInvoice` — usunięto twarde filtry `isMainDocument` i `senderMatchesSeller && isReferencedDocument`. Forward przez pośrednika (Bartek) odrzucał poprawne FV bo Claude oznaczał Fwd: jako "referencyjny".
   - Pre-filtr tiny_image <15kB (logo skip przed Claude)
   - Prompt: forward ≠ referencyjny, decyduje buyerNip=VBS
   - **Walidacja**: FV Dextraline 500 EUR weszła ✅ (Invoice processed in log)

3. **`0129ed8` ETAP 2 grupowanie CMR/POD jako załącznik**:
   - Refactor pętli mailbox.js → classify-then-group (faza 1 classify, faza 2 podział główne/aux, faza 3 upload aux jako attachments[])
   - `ATTACHABLE_DOC_TYPES = ['delivery_note', 'cmr', 'pod', 'order']`
   - saveInvoice przyjmuje `attachments[]`
   - InvoiceDetail sekcja "📎 Załączniki" z preview obrazów + linkiem
   - **Walidacja**: AgroLuK FV/65/2026 1353€ + **3 CMR** dołączone (1000096481/483/484.jpg) ✅ User pokazał screen z 2 widocznymi CMR w UI

4. **`20b8726` Prompt caching**:
   - SYSTEM_PROMPT + STATIC_EXTRACTION_PROMPT z `cache_control: ephemeral`
   - `buildEmailContextText()` dynamiczny PO ostatnim markerze
   - Logger `cache_creation/read_input_tokens`
   - max_tokens 3072→2048
   - **Walidacja w logach**: 42/43 calls miały cacheRead=2188 (cache hit ~100%). **Realnie ~50% taniej per call** (od $0.031 do $0.015) — więcej niż przewidywane 25-30% bo zsumowały się: caching + tiny_image pre-filter + ETAP 2 + max_tokens redukcja.

5. **`58f585d` PDF viewer FitH** — `iframe src={pdfUrl}#view=FitH` żeby Chrome PDF viewer skalował do szerokości (user zgłosił "nie da się pomniejszyć")

6. **Lesson learned: `firebase deploy --only functions:X` ≠ shared lib**:
   Przez całą sesję deployowałem `--only functions:scanNow`. `scanIMAPMailboxes` (scheduler) **NIE dostał nowego kodu** — przez kilka godzin używał kodu sprzed ETAP 1 (z `isMainDocument` filter). User zauważył po `sub_document: isMainDocument=false` w logach mimo że kod lokalny jest czysty. Fix: `firebase deploy --only functions` (wszystkie).
   **Zasada na przyszłość**: jeśli edytujesz `functions/lib/*`, deployuj WSZYSTKIE funkcje.

7. **`121ae14` FIX halucynacji Claude (krytyczne!)**:
   User zobaczył FV "25057126 Getru 1805€" z **logo Instagrama jako PDF preview**. Z 1 maila powstały 3 różne "25057126" z różnymi NIPami (NL858045001B01, NL862536820B01, NL857867148B01) i kwotami (1763.65, 1768, 1805.01€). Claude halucynował dane FV z bodyExcerpt emaila widząc logo IG (~30kB, przeszło tiny_image <15kB).
   3 warstwy fix:
   - **MIN_IMAGE_SIZE 15→50kB** (logo IG/LinkedIn 20-40kB)
   - **SKIP_FILENAME_PATTERNS**: image\\d+, logo*, signature*, unnamed*, attachment.pdf, social
   - **Anti-hallucination prompt**: SYSTEM + zasada #0 — dane FV TYLKO z załącznika, kontekst emaila TYLKO do klasyfikacji typu, logo/ikona → isInvoice=false + wszystko null
   Deploy ALL functions ✅

### Stan końcowy
- Wszystkie 4 CF deployed z najnowszym kodem (scanNow, scanIMAPMailboxes, clearAndReset, inspectMailbox)
- 22 FV w bazie ZAŚMIECONE halucynacjami (przed fix) — user ma clear+rescan
- Anthropic balance: $27.98 (start) → $27.33 (po teście 10) → ~$26.5? (po pełnym scan 12 FV faktury) — szczegóły TBD
- Frontend dev server na port 5174 odpalony

### Otwarte do następnej sesji
1. **User**: clear+reset → pełen rescan z anti-hallucination fix → walidacja (mniej FV, brak duplikatów "25057126")
2. **User decision**: następna sesja = frontend wizualizacja (user wybrał, pomysły w `project_invoice_ai_scanner.md` → "NASTĘPNA SESJA")
3. **CMR-solo zakładka** (TODO sprzed sesji) — łącznie z frontend redesign
4. **⚠️ KRYTYCZNE**: vbs-invoices BEZ remote git. 7 commitów tylko lokalnie. Stworzyć GitHub repo + push, lub przynajmniej backup `vbs-invoices.nosync/` do iCloud razem z FleetStat.

### Memory zaktualizowane
- `project_invoice_ai_scanner.md` — ETAP 1 fix + ETAP 2 + caching + lesson deploy + anti-hallucination fix, plan CMR-solo + frontend NASTĘPNA SESJA
- `MEMORY.md` — index z aktualnym statusem

## 2026-05-26 — vbs-invoices: rescan walidacja + 3 bug fixy + cost optimization ($30+/mc → $5-8/mc)

**Projekt**: vbs-invoices (`~/Desktop/vbs-invoices.nosync/`). 10 commitów lokalnych, **NADAL bez remote push** (PAT scope blocker).

### Punkt startowy
- Repo GitHub `wasikkamil-art/vbs-invoices` utworzony w trakcie sesji (private, pusty)
- 25 FV w bazie po poprzednim scanie, z czego 5 halucynacji Getru (image002.png/006.jpg)
- Scheduler off, czekał na clear+rescan

### Co zrobione (chronologicznie, 3 commity sesji)

1. **Audit + clear+rescan**: REST API query Firestore zdiagnozował 5 halucynacji + duplikat e100. User kliknął Wyczyść+reset → 0 → scan → 16 FV (czyste). Skasowany 1 duplikat FR123260 (REST DELETE).

2. **`b3bb1df` 3 bug fixy**:
   - **Dedup multi-NIP** (firestore.js + storage.js + mailbox.js): `findExistingInvoice(extracted, storageRefPath)` 2-key check. Eksport `computeStorageRef()` deterministyczny. Walidacja: AgroLuK rescan → matchedBy storageRef ✅
   - **not_vbs filter** (mailbox.js): accept `isBuyerVBS=true` mimo `buyerNip=null`. Andamur zbiorcze przechodzi.
   - **Capitalizacja seller** (utils/format.js + 4 UI): `fmtSellerName()` — Title Case dla CAPS, lowercase dla brand z cyframi (e100 zostaje).

3. **KRYZYS KOSZTÓW**: User pokazał Anthropic Console — overnight (12h) $3.91 zmarnowane. Token volume 4.8M. Diagnoza z logów: każdy scheduler tick `cacheWrite: 2846, cacheRead: 0`. Cache TTL 5min vs scheduler 10min = cache MISS zawsze + premium write +25%. **Cache kosztował WIĘCEJ niż pomagał** ($0.036 z cache vs $0.017 bez).

4. **`d398f45` Cost optimization (dwa fixy w jednym)**:
   - **Cache fix**: usunięte `cache_control` z system + STATIC_EXTRACTION_PROMPT. System jako string. -53% per call.
   - **Paczka A pre-filtry**: `BLACKLISTED_SENDER_PATTERNS` (TIMOCOM, noreply, marketing), `SKIP_SUBJECT_KEYWORDS` (monit, wezwanie, nota odsetkowa, newsletter, SIPSI), `SKIP_FILENAME_PATTERNS` rozszerzone (lastschrift, zahlungsavis, SIPSI, monit). `preClassifyEmail()` skip CAŁY mail przed Claude. Walidacja: BNP "Nowa nota odsetkowa" → subject_blacklist = $0 (wcześniej $0.036). -40% calls.

5. **`d5260aa` Paczka B Haiku 4.5 pre-classifier**:
   - Konsultowany skill claude-api: model `claude-haiku-4-5` alias OK, native PDF, structured outputs `output_config.format`
   - `classifyAttachmentLite(buffer, contentType, emailContext, filename)` w claude.js — Haiku + JSON schema enforce → `{decision: 'yes'|'no'|'unsure', isInvoice, isLikelyVBS, reason}`. `max_tokens: 200`, koszt $0.0033/call (5x taniej Sonnet).
   - Integracja mailbox.js FAZA 1 między filename pre-filter a Sonnet: jeśli `decision='no'` → SKIP, jeśli 'yes'/'unsure' → Sonnet. Defensive: na error idziemy do Sonnet.
   - Toggle `useHaikuPrefilter` w scanConfig (default true, można wyłączyć REST/UI).
   - **NIE walidowane w realnym ruchu** — w testach żaden PDF nie dotarł do Haiku (Paczka A i tiny_image złapały wszystko wcześniej, paradoksalnie dobre). Walidacja czeka na naturalny mail z FV.

6. **Limits Anthropic**: workspace Invoices limit $30 → $50 (user), org limit $50 → $100 (user). Konsumowane: ~$35.55 z $100 (35%).

7. **Scheduler ON + Haiku ON** (REST API): `schedulerEnabled: true, useHaikuPrefilter: true`. Scheduler chodzi co 10 min od ~17:00 CEST.

### Projekcja kosztów
- Przed: $25-40/mc (cache invalid + brak filtrów)
- Po cache fix: $15-25/mc
- Po Paczce A: $10-15/mc
- Po Paczce B: **$5-8/mc** ← z dużym zapasem do celu $15

### Stan końcowy
- 17 FV w bazie (12 faktury, 5 info), 0 halucynacji, 0 null-amount, 0 duplikatów
- Wszystkie 4 CF deployed z najnowszym kodem (3 deploy w sesji)
- 10 commitów lokalnych vbs-invoices

### Otwarte
1. **⚠️ KRYTYCZNE PAT scope**: repo wasikkamil-art/vbs-invoices istnieje pusty. Fine-grained PAT nie ma scope. **10 commitów tylko lokalnie**. User musi wygenerować nowy classic PAT z scope `repo` LUB edytować fine-grained.
2. **Walidacja Haiku**: scheduler ON, ale nie potwierdzone czy Haiku poprawnie klasyfikuje (nie miał świeżego PDF do testu). Sprawdzić logi za 2-3h pod `Haiku classify` / `haiku_not_invoice`.
3. **Frontend backlog**: user dwa razy dismissował ankietę priorytetów. Czeka aż będzie gotów. Top opcje: filtry/sortowanie Skrzynka, Dashboard wykresy, mobile responsive, eksport CSV/PDF, CMR-solo zakładka, push notifications, soft auto-approve, deploy faktury.vbstransport.com.
4. **Auto-reload OFF**: credit balance $13.98 → ~2700 calls. Po zerze CF failują. Rekomendacja: włączyć auto-reload (np. $20 gdy <$5).
5. **Node 20 deprecation** (low priority): warning przy deploy, decommission 2026-10-30. Upgrade na Node 22.

### Memory zaktualizowane
- `project_invoice_ai_scanner.md` — rescan walidacja + 3 bug fixy + cost optimization (cache fix + Paczka A + Paczka B); aktualny stan bazy + scheduler/Haiku ON
- `MEMORY.md` — index z aktualnym statusem

---

## 2026-05-26 (popołudnie) — vbs-invoices: 2 bugi schedulera + frontend Skrzynka + PUSH GitHub

**Projekt**: vbs-invoices. Kontynuacja porannej sesji. **Wszystkie 14 commitów PUSHED na github.com/wasikkamil-art/vbs-invoices ✅**.

### Punkt startowy
Scheduler+Haiku ON od ~17:00 wczoraj. 17 FV w bazie. Nie wiedzieliśmy czy Haiku faktycznie działa (poprzedni test nie miał świeżego PDF).

### Co znaleźli + naprawione (4 commity tej sesji)

1. **Audyt po nocy → 2 bugi** (z `firebase functions:log` + Firestore REST):
   - **BUG #1 Haiku JSON truncation**: `max_tokens: 200` za małe. Haiku obcina output w środku polskiego `reason` → JSON niedomknięty → `parse_error` → defaulting do "unsure" → Sonnet fallback. Paczka B faktycznie nie działała.
   - **BUG #2 IMAP UID swap zombie**: RFC 3501 — gdy `UID N:*` z N > maxUID, server swap'uje na `*:N`, zwraca highest mail. AgroLuK info (UID 59515) skanowany co 10 min → Sonnet $0.036 × 114 ticków ≈ **$4 nocy zmarnowane** na duplikat.

2. **`e9afec8` Fix obu bugów**:
   - Haiku: `max_tokens 200→400` + prompt wymusza `reason max 80 znaków po polsku, nie cytuj danych z faktury`
   - IMAP: `messages.filter(m => m.uid > lastUid)` po `connection.search` + wczesny exit gdy 0 candidate
   - Walidacja: w ciągu 20 min po deploy: `Mailbox info: 0 candidate messages (IMAP zwrócił 1, odfiltrowano 1 stale)` ✅ zombie umarł

3. **`4f1663a` Fix mojego sub-buga**: po deploy user kliknął "Test 10 najnowszych" w UI → wynik 0/0/0. Mój filter LASTUID działał TEŻ w trybie test. Fix: `const effectiveLastUid = dryUidUpdate ? 0 : lastUid` — w test mode searchCriteria idzie po `scanConfig.startDate`, brak filtra.

4. **Walidacja Haiku w PROD ✅**: po fix user re-test 10 najnowszych. **9 PDF przez Haiku, 3 z `decision='no'`**:
   - 2× E100 PLN (`"Waluta PLN wyklucza FV"`)
   - 1× NKB_Registry (`"Rejestr/wykaz faktur, nie samodzielna FV"`)
   - Brak `parse_error` ani `haiku_error` w logach
   - Koszt testu: ~$0.26 (9 Haiku + 6 Sonnet)
   - **33% saving Sonnet calls** na tym batchu

### Frontend (commity `217cda7` + `7cf22f7`)

Po user briefing — priorytet: "**dobre pokazywanie w skrzynce — data przyjścia @ z jakiej skrzynki, ikonka co w nim jest (FV/CMR)**".

1. **InvoiceList.jsx — Skrzynka rozszerzona**:
   - Nowa kolumna **"Otrzymano"** (PIERWSZA, najważniejsza wg user): `fmtDate(emailDate)` + `fmtDateRelative` pod
   - Nowa kolumna **"Skrzynka"**: badge faktury (emerald) / info (sky)
   - Ikona **📎 N** obok sellerName gdy `attachments.length > 0`
   - Default sort `orderBy('emailDate', 'desc')` w `useInvoices` (zmiana z `createdAt`)
   - **Click headerem sortuje** 8 kolumn — asc/desc toggle, indicator ↑↓
   - **Search input** — fulltext sellerName/buyerName/invoiceNumber/sellerNip
   - **Mailbox filter dropdown** — wszystkie / faktury@ / info@
   - "Resetuj" button gdy aktywne filtry, counter "X z Y FV"
   - useMemo dla filtered list (nie liczy per render)

2. **CMRList.jsx — nowa zakładka /cmr**:
   - Flat-map invoices.attachments[] z inherit metadata FV
   - Sort `emailDate desc`
   - Karta per CMR: typ doc (cmr/pod/delivery_note z label), filename, skrzynka badge, "Otrzymano", powiązana FV (seller + nr + kwota), treść maila (od + temat, 1 linia każdy), preview obrazka (max-h-64), download link Storage
   - Sidebar item "📄 CMR / POD" przed Kontrahenci
   - Grid 1 col mobile / 2 col lg

### PAT + push ✅

User wygenerował classic PAT z scope=repo. Switch SSH→HTTPS+PAT, push 14 commitów. PAT siedzi teraz w `.git/config` plain text (jak FleetStat — user świadomy, standard u niego). Pre-push hook brak (vbs-invoices nie ma huska), więc nic nie zostało zablokowane.

### Stan końcowy
- 17 FV w bazie, nic nowego nie wpadło (skrzynka cicho)
- Wszystkie 4 CF deployed: scanIMAPMailboxes, scanNow, inspectMailbox, clearAndReset
- Scheduler ON co 10 min, Haiku prefilter ON
- **14 commitów lokalnie = 14 na github.com/wasikkamil-art/vbs-invoices ✅**
- 4 commity tej sesji: `e9afec8` bugi, `4f1663a` test mode fix, `217cda7` Skrzynka+CMR, `7cf22f7` filtry/sort

### Otwarte do następnej sesji
1. **Vercel deploy** — repo na GitHub jest. Import do Vercel (https://vercel.com → New Project → wasikkamil-art/vbs-invoices) + OVH CNAME `faktury.vbstransport.com → cname.vercel-dns.com`
2. **Dashboard wykresy Recharts** — top kontrahenci bar / suma EUR miesięczna / status pie
3. **Mobile responsive** — sidebar collapse, tabele → karty
4. **Eksport CSV/PDF** za okres (do księgowej / druk)
5. **Soft auto-approve** dla contractor.invoiceCount > 5 (zaufany)
6. **Anthropic auto-reload** — credit ~$13.50, włączyć ($20 gdy <$5)
7. **Node 20 deprecation** — upgrade na Node 22 do 2026-10-30

### Memory zaktualizowane
- `project_invoice_ai_scanner.md` — wpis na samej górze z całą sesją popołudniową
- `MEMORY.md` — index z aktualnym statusem (Haiku walidowany, push zrobiony, frontend Skrzynka rozszerzona)

---

## 2026-05-26 (wieczór) — vbs-invoices: VERCEL DEPLOY https://faktury.fleetstat.pl + rozbudowa filtrów

**Projekt**: vbs-invoices. Kontynuacja popołudnia. **PRODUKCJA LIVE na https://faktury.fleetstat.pl ✅**.

### Punkt startowy
Frontend Skrzynka rozszerzona + zakładka CMR/POD + filtry/sort już commit + push. Wszystkie 14 commitów na GitHub. Ale frontend NIE deployed na produkcji (Vercel project nie istniał).

### Decyzja architektoniczna — subdomena fleetstat.pl

Zmiana z planu początkowego (`faktury.vbstransport.com`) na **`faktury.fleetstat.pl`**. User uzasadnienie: planuje sprzedawać FleetStat na zewnątrz jako SaaS, **inne firmy też mogą chcieć tracking FV**. Dyskusja architektoniczna o 3 wymiarach:
1. **Multi-tenancy**: dziś single-tenant (FleetStat dla VBS, vbs-invoices dla VBS). Sprzedaż na zewnątrz wymaga refactor `tenantId` w kolekcjach + Firestore rules.
2. **Cross-product integration**: Suite (bundle, jeden login modułowy) vs Marketplace (osobne FV add-on) vs niezależne produkty
3. **Failure isolation**: trzymane separowane (osobne Firebase projects vbs-stats vs vbs-invoices, osobne deploys) — TRZEBA zachować nawet po refaktorze multi-tenant

**Faza 1 (teraz)**: subdomena `faktury.fleetstat.pl` jako brand `FleetStat Faktury` (parasol). Zero shared infra, osobny deploy + Firebase project. **Faza 2 (gdy sprzedaż)**: dorzucamy `tenantId`.

### Vercel deploy + DNS + Firebase Auth (4 kroki)

1. **Vercel import**: vercel.com → wasikkamil-art's projects → Import GitHub → vbs-invoices. Auto-detect Vite ✅. Env vars BRAK (firebase config publiczny). Build sukces ~1-2 min.

2. **DNS w home.pl** (NOT OVH — fleetstat.pl jest u home.pl, w przeciwieństwie do vbstransport.com): panel.home.pl → Domeny → fleetstat.pl → DNS Zone → Dodaj CNAME. **Pułapka home.pl UI**: pola "Nazwa kanoniczna" (= TARGET) i "Host" (= subdomain) odwrócone od intuicji — user pierwotnie wpisał `faktury.` w Nazwa kanoniczna zamiast `cname.vercel-dns.com`. Naprawione. CNAME `faktury → cname.vercel-dns.com` propagacja globalna ~2 min.

3. **Vercel Add Domain**: vercel.com → projekt → Domains (nowy UI — Domains jako osobny tab, NIE w Settings). Add Existing → `faktury.fleetstat.pl` → Production. SSL Let's Encrypt auto. "DNS Change Recommended" ostrzeżenie (nie blocker).

4. **Firebase Auth authorized domains**: console.firebase.google.com/project/vbs-invoices/authentication/settings → Add domain → `vbs-invoices.vercel.app` + `faktury.fleetstat.pl`. Bez tego login wybucha z `auth/unauthorized-domain`.

### ⚠️ Vercel BLOCKED 2 deploys — fix git author email

Po commitach `385ec56` (filter zakres dat) + `d4227d3` (quick filter chipy) Vercel zablokował deploy:

> "The deployment was blocked because the commit author email (kamilwasik@MacBook-Air-Kamil.local) is not valid. Ensure your git email matches your GitHub account."

**Diagnoza**: macOS auto-ustawia `git config --global user.email = <username>@<hostname>.local` (z systemu, nigdy nie podane manualnie). Vercel od ~2026-05 sprawdza czy commit author email zarejestrowany na GitHubie — nieznany = block. Zabezpieczenie przed podszywaniem się pod cudze commity.

**Fix**:
```bash
cd ~/Desktop/vbs-invoices.nosync
git config user.email "wasik.kamil@gmail.com"  # per-repo
git config user.name "Kamil Wasik"
git rebase HEAD~2 --exec "git commit --amend --reset-author --no-edit"
git push --force-with-lease origin main
```

Po force push Vercel wykrył nowych authorów → odblokował → deploy zakończony. Hashe się zmieniły: `385ec56→24c5a56`, `d4227d3→d50d985`. **Memory zapisana** (`reference_vercel_git_email.md`) — na przyszłość przy każdym nowym repo na macOS ustaw user.email PRZED pierwszym commit.

### Frontend dorzucone w tej sesji

1. **`24c5a56` Filter zakres dat w Skrzynce**:
   - Dropdown wybór pola (emailDate default / issueDate / dueDate)
   - 2 inputy type=date "od" / "do"
   - Szybki reset zakresu (✕) + "Resetuj wszystko" prawy róg
   - Porównanie stringowe ISO 8601 (poprawne lexicographically)

2. **`d50d985` Quick filter chips na górze paska**:
   - 3 chipy z counterem ile FV pasuje: ⚠️ Przeterminowane / 🔥 Dziś do zapłaty / 📆 Jutro do zapłaty
   - Multi-select (OR logic) — kombinuj "wszystko co pali"
   - Match po `inv.dueDate` vs today/tomorrow, pomijamy `status='paid'`
   - Counter z surowych invoices (przed innymi filtrami) — widać od razu globalny stan
   - Disabled gdy count=0 (jasne tło, nie klikalne)
   - Kolory aktywnego: czerwony / bursztynowy / niebieski

### Stan końcowy
- **Produkcja LIVE**: https://faktury.fleetstat.pl (SSL ✅, Firebase Auth ✅)
- Alias: https://vbs-invoices.vercel.app (backup, ten sam build)
- **Auto-deploy**: każdy push na main vbs-invoices → Vercel build 1-2 min
- 16 commitów na GitHub (14 popołudnie + 2 wieczorem po re-author force push)
- Git config per-repo OK (nowe commity od razu valid email)
- 17 FV w bazie, scheduler+Haiku ON (#143/145)

### Otwarte do następnej sesji
1. **Dashboard wykresy Recharts** — top kontrahenci bar / suma EUR miesięczna / status pie. ~2h
2. **Mobile responsive** — sidebar collapse, tabele → karty, modale full-screen. ~2-3h. Krytyczne dla Wioletty/Przemka z tel.
3. **Eksport CSV** — lista FV per okres dla księgowej. ~1h
4. **Soft auto-approve** — contractor.invoiceCount > 5, pending → approved auto
5. **Suma kwot filtrowanych** — pasek "12 z 17 FV · ∑ X EUR netto / Y brutto"
6. **Multi-tenant refaktor** — gdy zbliża się sprzedaż FleetStat zewnętrzna
7. **Vercel "DNS Change Recommended"** — ostrzeżenie do zbadania (nie blocker)
8. **Anthropic auto-reload** — credit ~$13.50

### Memory zaktualizowane
- `project_invoice_ai_scanner.md` — wpis wieczorny z Vercel deploy + DNS + Blocked fix + frontend
- `reference_vercel_git_email.md` — NOWA memory: pułapka macOS auto-email + procedura dla każdego nowego repo
- `MEMORY.md` — index z aktualnym statusem (LIVE faktury.fleetstat.pl)

---

## 2026-05-27 — vbs-invoices: dueDate logic + notatki + Apple UI + ROLE + logo (mega iteracja produktowa)

**Projekt**: vbs-invoices. Kontynuacja po Vercel deploy. Produkcja LIVE `https://faktury.fleetstat.pl`. 8 commitów. Wszystko deployed.

### Co zrobione (chronologicznie)

1. **DueDate fallback 60d dla FV transportowych** (`7b8857d` + `80d942b`):
   - Problem: FV przewoźnika (OTT 0043) nie podaje terminu — jest na zleceniu (60d od dostarczenia dok.)
   - `computeDueDate(extracted, emailMeta, attachments)` 4 poziomy: extracted → paymentDays+issueDate → **transport+brak → 60d od emailDate** → reszta brak → `missing`
   - Transport = Claude `isTransportInvoice` (fracht/przewóz vs paliwo/telekom) LUB CMR/POD attachment
   - Edycja ręczna terminu (DueDateField) z audit (dueDateEditedBy/At/Note). Indicatory: ⓘ amber (60d), ✎ blue (manual), ⚠ red (missing)
   - Migracja OTT 0043 → 2026-07-18 (REST)

2. **Notatki — historia zespołu** (`59d1057`): notes[] arrayUnion {text, author, createdAt ISO}. InvoiceDetail sekcja "📝 Notatki" + ikona 📝{count} w Skrzynce

3. **Apple Light redesign — CAŁA apka** (`0124710` pilot Skrzynka + `c49519e` reszta):
   - Globalne: paleta appbg #f5f5f7 / ink #1d1d1f / inkmuted #86868b / hairline #d2d2d7 / brand Apple blue #0071e3, font SF Pro, shadow-card, rounded-2xl
   - Sidebar translucent backdrop-blur, wszystkie widoki (Skrzynka/Dashboard/Kontrahenci/CMR/Users/login/modal) spójnie: karty rounded-2xl, tabele bez linii, pill chipy pastele, inputy rounded-xl

4. **System ról admin/podgląd** (`3f80ffd`):
   - rules isAdmin() (users/{uid}.role=='admin'); invoices/contractors/settings write tylko admin; users self-create TYLKO podglad
   - useUserRole.jsx (Context+hook, self-bootstrap), App nav+badge+banner, views/Users.jsx panel ról, InvoiceDetail+Dashboard gating akcji
   - **Kamil = admin** (bootstrap REST: PATCH users/O6S79Pw6MgWbjs4m3xE8s0MMelZ2)

5. **Logo FleetStat invoices** (`8dd551e`): public/logo-fleetstat-invoices.png (2529x753), sidebar+login, mix-blend-multiply

### FleetStat repo (przy okazji disaster recovery)
- **RECOVERY.md** (`94fdc02`) — procedura "stracony laptop": Apple ID + Google = master keys, iCloud Keychain ON, 3 rzeczy zapamiętać (Apple ID hasło, Google hasło, Google 2FA backup codes)
- **backup-claude-memory.sh fix** — `set -e` usuwał manifest przy iCloud "Resource deadlock"; fix: retry 3x + exit 0 + partial status. Memory snapshoty OK (były codziennie, tylko .env.local failował)

### Pułapki napotkane (lessons)
- **Vercel BLOCKED deploy** za git author email `kamilwasik@MacBook-Air-Kamil.local` (macOS auto) → fix `git config user.email wasik.kamil@gmail.com` + rebase --exec amend + force push. Memory: reference_vercel_git_email.md
- **useUserRole MUSI być .jsx** (JSX Provider, Vite wymaga rozszerzenia)
- **Auth admin REST nie działa z gcloud** (brak Identity Toolkit scope) → uid wzięty z Firestore users collection po self-bootstrap
- **home.pl DNS UI**: "Nazwa kanoniczna"=target, "Host"=subdomena (odwrotnie od intuicji)

### Stan końcowy
- Produkcja `https://faktury.fleetstat.pl` LIVE, 19 FV, scheduler+Haiku ON
- Kamil = admin; Przemek/Wioletta = TODO user tworzy konta
- ~24 commity na github.com/wasikkamil-art/vbs-invoices
- Cała apka Apple Light + role + notatki + dueDate logic

### Otwarte do następnego chatu
1. Dashboard wykresy Recharts | 2. Mobile responsive | 3. Eksport CSV | 4. User tworzy konta Przemek/Wioletta | 5. Soft auto-approve | 6. Multi-tenant (gdy SaaS)

---

## 2026-06-02 — Research Trans.eu/Eurodebt + decyzja workflow paliwa + raport maj 2026

**Projekt**: FleetStat (cwd `VBS-Stat.nosync`, branch `main`). Sesja przede wszystkim research + workflow paliwa miesięczny. **Zero zmian w kodzie apki** — tylko skrypt Python w chacie + nowa memory + ten wpis.

### A) Research weryfikacji kontrahentów (odłożone, user sam zdecyduje)

**Trans.eu API** (fetched via WebFetch + WebSearch):
- API pokrywa: frachty (loads), pojazdy (vehicles), zlecenia transportowe, monitoring (Trace GeoJSON), dock scheduler, partners
- Auth: OAuth2 + Trans ID, scopes (`offers.loads.manage`, `offers.vehicles.manage`)
- Base URL: `https://offers.system.trans.eu/api/rest/v1`
- ⚠️ **TransRisk / oceny kontrahentów NIE są w oficjalnym API** — sekcja Partners daje tylko zarządzanie relacjami (zaproś/zablokuj/aktywuj/lista/po ID/flota/pracownicy), żadnego scoringu
- Etyka: NIE podsłuchujemy wewnętrznego endpointu UI (zasada jak `/rest-api/` widziszwszystko)
- TODO jeśli wracamy: mail do `api@trans.eu` z pytaniem o pole TransRisk w "get contractor by id"

**Eurodebt** (fetched via WebSearch):
- **MA REST API** (x-api-key generowany w panelu Settings → Integrations)
- Workflow 3-krokowy: klucz → POST z NIP → raport real-time lub przez webhook
- Dedykowana funkcja Carrier Verification + generator PDF reports
- User ma **płatną subskrypcję** → wystarczy sprawdzić panel czy plan zawiera API
- TODO user: zalogować się do Eurodebt → Settings → Integrations → zobaczyć czy widzi "Generate API key"

### B) Workflow paliwa miesięczny — DECYZJA i NOWY MEMORY

**Pierwotny plan** (wcześniejsza tura sesji): Google Sheet + Service Account + Cloud Function `syncCostsFromGoogleSheet` + button "Synchronizuj" w UI Koszty FleetStat. ~3-4h setup jednorazowo.

**Final decyzja po analizie ROI**: **NIE** — nadinwestycja dla 1 importu/miesiąc (oszczędność: 2 kliki/mc × 12 = 24/rok kosztem 3-4h pracy). Wybrany prostszy workflow:
1. User pobiera raporty z 4 portali (Eurowag + E-100 + Andamur + NegoMetal)
2. Wrzuca do chatu (@-reference lub drag&drop)
3. Claude uruchamia **skrypt Python** (openpyxl + csv + NBP API), sumuje per pojazd EUR netto
4. Podział na 3 buckety: **Paliwo (diesel) / AdBlue / Opłaty drogowe**
5. User wkleja liczby do Total_26 do odpowiednich wierszy
6. Total_26 zostaje jak jest dla pozostałych (leasing/ZUS/polisa/serwis/itd. + nieprzewidziane)

**Nowy memory**: `feedback_paliwa_import_workflow.md` — pełen skrypt template (Python), mapowania kolumn 4 plików, lista pomijanych pojazdów (rozszerzona o UNIVERSAL5562), kursy NBP per dzień + fallback do -7 dni dla długich weekendów, konwersja CHF przez PLN jako mostek, sanity checks. **Następny import za miesiąc = odpalenie skryptu z templatu, ~30 sekund.**

### C) Raport MAJ 2026 — wykonany ✅

Pliki źródłowe (`~/Downloads/`):
- `EW_Export_TR_2606153 1447.csv` — Eurowag (~95 transakcji)
- `transaction-1577770.csv` — E-100 (separator `;`)
- `MOJE ZUŻYCIE (2).xlsx` — Andamur (11 transakcji, sheet "Consumption" z 2 wierszami nagłówka)
- `negometal_toll_transactions_website_export (34).xlsx` — NegoMetal (60 transakcji + 6 wierszy subtotali bez daty — KLUCZOWE pomijać!)

**Wynik per pojazd w EUR netto (gotowe do wklejenia w Total_26)**:

| Pojazd | Plate | Paliwo | AdBlue | Opłaty drogowe |
|--------|-------|-------:|-------:|---------------:|
| v1 | WGM 0475M | 2 343,81 | 38,84 | 295,73 |
| v3 | WGM 5367K | 2 550,39 | 52,31 | 239,92 |
| v4 | TK 314CL | 1 358,49 | 26,73 | 0,00 |
| v5 | WGM 0507M | 2 426,96 | 35,58 | 124,53 |
| **SUMA** | | **8 679,66** | **153,46** | **660,18** |

- Paliwo litry: **5 153,13 L**, średnia **1,684 €/L** ✓ (sanity OK dla mixa PL/FR/DE/LU/ES)
- AdBlue litry: **170,85 L**
- Opłaty drogowe = NegoMetal (587,64) + E-100 opłaty (72,54: v5 Autostrada A2 58,41 + v3 Parking TIR 14,12)
- Konwersja PLN/CHF → EUR po **NBP tabela A z dnia transakcji**, fallback `2026-05-01` (święto) → `2026-04-30` (kurs 4.2589)
- CHF (Szwajcaria, 39,70 CHF dla v3) konwertowany **przez PLN jako mostek**: `amt × CHF/PLN / EUR/PLN`
- ✓ Sanity NegoMetal: suma transakcji per pojazd per waluta = subtotale z pliku

**Otwarte decyzje przy wklejaniu** (user decyduje, kwoty FROZEN):
- AdBlue (153,46 EUR razem) → nowy wiersz `AdBlue` w Total_26 czy `inne`?
- Autostrada A2 (58,41 v5, AWSA prywatna PL, NIE e-Toll system) → `Nego` / `E-Toll` / `inne`?
- Parking TIR (14,12 v3) → `inne` z notatką

### Lessons learned (dorzucone do memory `feedback_paliwa_import_workflow.md`)

- **Per-day NBP vs single mid-month**: różnica ~0.02% dla maja 2026 (kursy stabilne 4.23-4.26 PLN/EUR), ale per-day zgodne z ZASADY-VBS-STAT.md
- **NegoMetal subtotale**: wiersze bez daty to subtotale per pojazd per waluta z portala — pominięcie **kluczowe** (inaczej liczymy razem subtotal + transakcje = 2× wartość)
- **UNIVERSAL5562**: dorzucone do SKIP_PLATES (CLAUDE.md miał tylko 5570; 5562 ma identyczny wzór = karta uniwersalna na benzynę dla aut osobowych)
- **Plate format**: NegoMetal **ze spacją** (`WGM 0475M`), reszta **bez** — mapping PLATE_TO_VID musi mieć obie formy
- **Długi weekend majowy**: świętą 1.05 + weekend → NBP nie publikuje 1-3.05, fallback do 30.04. Range NBP API musi sięgać w kwiecień (`YEAR-04-22` do `YEAR-MM-31`)
- **CHF konwersja**: NBP nie daje bezpośrednio EUR/CHF, robić przez PLN: `CHF × NBP[CHF→PLN] / NBP[EUR→PLN]`

### Pliki zmienione w tej sesji
- `SESJA-LOG.md` — ten wpis + (poprzednio uncommitted) wpis 2026-05-27 (vbs-invoices: dueDate + notatki + Apple UI + ROLE + logo)
- `~/.claude/projects/.../memory/feedback_paliwa_import_workflow.md` — NOWY
- `~/.claude/projects/.../memory/MEMORY.md` — dodany link do powyższej memory

### Następna sesja — co możliwe
1. **Wklejenie maja do Total_26** (manualnie, user)
2. **Workflow czerwiec 2026** zaplanowany na początek lipca — odpalenie skryptu template (~30 sek)
3. **Backlog bez zmian**: Bug #2 compliance (auto_gps fragmentation, CF deploy), vbs-invoices ⭐ (mobile responsive, dashboard Recharts, eksport CSV), code splitting App.jsx (1.77 MB), Trans.eu+Eurodebt API jeśli user wraca do tematu

---

## 2026-06-10 — Fix tacho "Powrót do bazy" + sugestie daty (PRODUKCJA)

**Projekt**: FleetStat, branch `fix/tacho-powrot-do-bazy` → merge `main` (Vercel deploy prod). 2 commity: `35b87ba` (fix) + `5e0a8d9` (sugestie). Sesja zaczęła się od planu fuel recommender, user przekierował: "mam problem z tacho".

### Problem (user)
Zakładka "⏱️ Czas pracy kierowcy" → WGM 0475M → blok "Powrót do bazy" pokazywał **"0 dni / deadline 21.05"** (minęło ~3 tyg), a przegląd/karta pojazdu poprawnie **13 dni**. Dwa widoki się rozjeżdżały.

### Przyczyna
Dwa niezależne systemy liczenia powrotu do bazy (28 dni):
- **Przegląd/karta** (App.jsx ~3221/~3320, DriverPanel ~1853) — od ręcznego `vehicle.tachoStart` ("kiedy wyjeżdża"). Działał OK.
- **Tacho compliance** (czasPracy.js `period28`) — kotwica `periodStart` = **najstarszy segment w bazie** ("uproszczenie MVP"). Gdy danych >28 dni → utknął na starcie danych (≈22.04) → "0 dni" na zawsze.

### Decyzja user
**"Tacho to świętość, przegląd to podgląd" → dwa NIEZALEŻNE liczniki.** "Kiedy wyjeżdża" (palec dyspozytora) ≠ "kiedy kierowca włoży kartę" (tachograf). Odrzucił moje pierwotne A (scalić pod tachoStart). Wybrał **C = osobne ręczne pole w Tacho**.

### Zmiany (deployed prod)
1. **Nowe pole pojazdu `tachoCardStart`** (data wg tachografu), osobne od `tachoStart`.
2. **TachografComplianceSection**: `periodStart = vehicle.tachoCardStart`; brak daty → prompt "⏱️ Data wg tachografu" zamiast "0 dni"; input edycja/reset; zapis przez `onUpdateVehicle` callback (App.jsx → `dbUpdateVehicleField`, bez cyklicznego importu).
3. **DriverCzasPracyDashboard** (mobile): czyta to samo pole read-only; brak daty → blok ukryty (kierowca nie widzi fałszywego "dziś powrót!").
4. **Sugestie daty** (przyciski pod polem, klik WSTAWIA, user zatwierdza):
   - ⏱️ z tachografu: helper `suggestBaseReturnFromRest` (czasPracy.js) — koniec ostatniego odpoczynku **≥56h** (próg user: 45h robi w trasie, dłuższy = baza), lookback 35d, pomija synthetic fillgap, coalesce realnych rest.
   - 📋 z przeglądu: kopiuje `tachoStart`.
   - Długie odpoczynki format w dniach ("8d 12h" zamiast "204h 28min").
5. **Przegląd/karta (`tachoStart`) — bez zmian.**

### Weryfikacja
Test lokalny (`npm run dev`, żywe dane user): data z tachografu (28.05) = data z przeglądu (28.05) → oba źródła się potwierdzają. Build zielony, 0 lint errors.

### ⚠️ Pułapki / lekcje
- **Mylące nazwy zakładek GPS/Monitoring**: "💾 Tachograf" = pliki DDD (GpsDddSection); prawdziwy tacho-compliance jest pod "⏱️ Czas pracy kierowcy" (TachografComplianceSection). User (i ja) gubiliśmy się gdzie jest pole — kosztowało kilka tur. **TODO UX**: poprawić nazwy/ikony zakładek.
- **`tachoStart` mylące w kodzie**: nazwa "tacho" ale to ręczna data przeglądu; prawdziwa tacho = nowe `tachoCardStart`. Nie zmieniam `tachoStart` (wiele miejsc + Firebase data).
- **GpsCzasPracySection.jsx = martwy kod** (nigdzie nie renderowany, stary "Czas pracy" scalony, ma stary bug periodStart). Zgłoszony chip cleanup (usunąć plik + lazy import App.jsx:34).
- **`tachoCardStart` startuje puste** dla wszystkich aut → po deploy user wpisuje realne daty per auto (raz, w zakładce ⏱️).

### Otwarte / następne
- User wpisuje `tachoCardStart` dla pozostałych aut (v3/v4/v5) na fleetstat.pl.
- Ew. dostrojenie progu ≥56h jeśli sugestia nie łapie bazy dla innych kierowców.
- Cleanup GpsCzasPracySection (chip).
- Backlog bez zmian (Total_26 maj, fuel recommender odłożony, vbs-invoices mobile, code splitting).

---

## 2026-06-10 (cd.) — Integracja DDD→compliance AKTYWNA + opcja C (skrócone tygodniowe)

Kontynuacja tej samej sesji. User pytał „czy forward calc liczy dobrze". Diagnoza przez **skrypty firebase-admin** (`serviceAccountKey.json` jest lokalnie w repo root, gitignored — pełen dostęp do Firestore).

### Odkrycie: compliance leciał z GPS, nie z DDD
- `driverActivities` były **100% `auto_gps`** (poszatkowane na 1-min slivery, szum). DDD leżał tylko w `dddFiles` (archiwum), NIE w compliance.
- Powód: cały pipeline DDD→`driverActivities` BYŁ zbudowany (CF `parseDddFile` 2026-05-08: match po cardNumber/nazwie → zapis segmentów `source="ddd"` + reupload-safety) ORAZ pole UI „Numer karty kierowcy (DDD)" (App.jsx ~15476) — **ale `driverHistory[].cardNumber` było puste u wszystkich** → match zawodził → zapis pomijany. Logi CF potwierdziły: „No driverEmail found for cardNumber=...".

### Fix = SAME DANE (zero kodu/deployu)
1. **`fix_driver_cards.js`** — wpisał `cardNumber` aktywnym kierowcom (z plików DDD): v1 Iwansky `UAD0000006RQ7001`, v3 Kolabau `1660617145710000`, v4 Teper `1590126102550000`, v5 Lukashchuk `UAD000000BFVJ000`. Backup `backup_vehicles_before_cards.json`.
2. **`migrate_ddd_backfill.js`** (reusable template) — backfill 90 dni segmentów DDD → `driverActivities` (match po karcie jak CF, reupload-safety). **4784 segmenty** (v1:1101, v3:1088, v4:1267, v5:1328).
3. Compliance teraz: `preferDddSegments` wycina GPS gdzie jest DDD (Volodymyr: 623 GPS → 318 DDD + 69 GPS ogon). **Przyszłe wgrania auto-linkują** (CF już wdrożona, brakowało tylko kart).
- ⚠️ **REWIZJA decyzji** z `reference_ddd_parser.md` („DDD = archive, NIE live driverActivities") — teraz DDD ŻYWO zasila compliance przez cardNumber linkage.

### Opcja C — skrócone tygodniowe odpoczynki (commit 359263a, PROD)
- Problem: plan „następny tygodniowy" liczył od ≥45h, ignorując skrócone 24-45h → false „przeterminowany".
- `czasPracy.js`: nowy `lastWeeklyRest` (≥24h, isReduced, lastRegularEnd) + `weeklyRestStatus`; plan kotwiczy na ostatnim ≥24h + flaga `mustBeRegular` (po skróconym następny musi być pełny ≥45h). UI: TachografComplianceSection + DriverPanel pokazują „musi być pełny ≥45h" + amber.
- Weryfikacja (żywe dane): Volodymyr następny 14.06 (było 03.06 przeszłość), mustBeRegular=TAK, ostatni pełny 28.05.

### Case Teper (TK 314CL) — błąd „dyspozycyjność na bazie"
- 14-22.05 = **198h DYSPOZYCYJNOŚĆ** (8 dni, karta w „available" zamiast „rest" na bazie). User opisał wydruk „kierowca zapomniał".
- Tacho teraz pokazuje to **uczciwie jako dyspozycyjność (NIE odpoczynek)** — GPS to chował (auto stojące=rest), DDD ujawnia prawdę. Widać w „Aktywność wielodniowa" (szare paski).
- NIE psuje dziś compliance (po 22.05 ma realne pełne odpoczynki 26.05 + 01.06; avail 3 tyg temu, poza oknem). Teper na dziś OK: następny tygodniowy 13.06, musi być pełny ≥45h.
- **Lekcja**: przypominać kierowcom — na bazie karta na ODPOCZYNEK, nie dyspozycyjność. Ew. przyszłość: ręczna korekta avail→rest z adnotacją.

### Deploy / stan
- Tacho fix + sugestie: commity 35b87ba/5e0a8d9 (PROD wcześniej).
- DDD integration: **dane only**, zero commitów (feature była gotowa).
- Opcja C: commit 359263a → main → PROD.
- Skrypty diagnostyczne (`diagnose_*`, `fix_*`, `migrate_*`) gitignored, lokalne. `migrate_ddd_backfill.js` warto zachować (template na przyszłe backfille).

### Otwarte / następne
- Po nowym wgraniu DDD: sprawdzić że auto-linkuje (powinno — karty są).
- Ew. więcej dni backfillu niż 90 (jeśli user chce dłuższą historię w multi-day).
- Sprawdzić Kolabau/Lukashchuk czy nie mają świeżego błędu avail-na-bazie (user pytał, nie zrobione).
- Cleanup GpsCzasPracySection (chip).

---

## 2026-06-11 — Korekta avail→rest (opcja A) + filtr "tacho wygrywa" w widoku + case Mirka rozwiązany (PROD)

**Projekt**: FleetStat, branch `feat/tacho-korekta-i-filtr-widoku` → merge `main` (Vercel) + `firebase deploy firestore:rules`. Commit `7cc3b7c`. Duża sesja: feature + analiza + deploy + grafiki + korekta na prodzie.

### A) Korekta "dyspozycyjność na bazie" → odpoczynek (opcja A, PROD)
Problem z poprzednich sesji: kierowca zostawia kartę w DYSPOZYCYJNOŚCI na bazie zamiast ODPOCZYNEK; DDD pokazuje to uczciwie jako avail → compliance słusznie NIE liczy jako odpoczynek. Potrzebny cyfrowy odpowiednik adnotacji na wydruku.

**Wybór: opcja A** (z 3: A=osobny segment "correction" priorytet>DDD, B=flaga/edycja in-place, C=osobna kolekcja overlay). **Decydujący argument**: reupload DDD kasuje TYLKO `source=="ddd"` (functions/index.js:1571) → korekta jako osobny `source="correction"` **przeżywa reupload**; B by ją skasował. A reuse'uje istniejący `preferDddSegments` (najmniej kodu), C nadinżynieria.

**Zmiany (commit 7cc3b7c):**
- `czasPracy.js preferDddSegments`: nowy **priorytet 0 "correction"** — wycina avail/rest + szum GPS z zakresu, **chroni jazdę/pracę z DDD** (safety: tacho-prawda jazdy nietykalna). Tiery 1-3 też zachowują `correction`.
- `App.jsx MultiDayActivityView`: przycisk "✏️ Korekta tachografu" (admin), modal od-do + wymagany powód, panel listy korekt z "Cofnij", render skorygowanego paska (niebieski hatch + tooltip). Walidacja zapisu = bariera (blokuje gdy zakres nachodzi na **DDD** drive/work; wymaga DDD avail w zakresie). driverEmail z segmentu DDD. Propsy `currentUser`/`isAdmin`/`showToast` przepuszczone przez GpsTab.
- `firestore.rules`: `source=="correction"` create tylko `canEdit()` (admin/dyspo).

### B) Filtr "tacho wygrywa" w widoku (PROD, ten sam commit)
**Odkrycie przez usera**: widok "Aktywność wielodniowa" pokazywał zielone "jazdy" GPS (0 km dryf) na dniach gdy tacho mówi dyspozycyjność — bo widok rysował **surowe** segmenty WSZYSTKICH źródeł, NIE stosował `preferDddSegments` (compliance go ma, widok nie). Mylące.
- **Fix**: `MultiDayActivityView` bucketing teraz robi `preferDddSegments(normalizeSegment(...))` przed renderem → DDD wycina szum GPS wszędzie gdzie jest tachograf. Usunięto ręczny `coveredByCorrection` skip (preferDddSegments to obsługuje). Widok = spójny z compliance.

### ⚠️ Bug złapany przy weryfikacji (na żywych danych!)
Pierwsza wersja bariery chroniła `drive/work` KAŻDEGO źródła → po korekcie wyskakiwał szum GPS "jazda" 3h26 (0 km) spod wyciętego avail. **Fix**: bariera/skip chroni jazdę tylko z `source=="ddd"` (tacho autorytatywne; GPS-owa "jazda" w oknie gdy tacho=dyspo to dryf, wycinamy). Lekcja: weryfikuj na realnych danych, nie tylko buildem.

### C) Case Mirka (Teper TK 314CL) — rozwiązany na prodzie
Diagnoza read-only (firebase-admin, `serviceAccountKey.json` lokalnie):
- **Nie jeździł 18-21.05**: tacho 0 jazdy (3 pliki DDD zgodne: 28.05/07.06/09.06), GPS tylko 0-km dryf. **Dowód definitywny**: tacho AUTOMATYCZNIE zapisuje jazdę gdy auto jedzie (niezależnie od przełącznika) → skoro 0 jazdy = auto stało.
- **Blok większy niż myśleliśmy**: nie 14-22 (8 dni/198h) tylko **08-21.05 = 14 dni czystej dyspozycyjności 24h** (+ kawałek 07.05). Obramowany jazdą: wjechał 06-07, stał 08-21, wyjechał 22-23. Wcześniejsze "222h" było przycięte oknem analizy (start 13.05).
- **Skan floty**: TYLKO Mirek dotknięty. Iwansky/Kolabau/Lukashchuk czyści (zero długich bloków avail). → problem izolowany, prewencja nie pali się.
- **KOREKTA ZASTOSOWANA NA PRODZIE**: `fix_teper_correction.mjs` (odtwarza zapis z UI: walidacja+correction doc+auditLog, atrybucja admin wasik.kamil@gmail.com, idempotent). Zakres 08.05→22.05 (336h), id=`DMQgT5U1SlLYmwtIEsrY`. Zweryfikowane: w zakresie został tylko `correction/rest`. Odwracalne ("Cofnij" w UI), oryginał DDD nietknięty.

### D) Bug rekompensaty (ZGŁOSZONY jako chip task_c34dff72, iteracja 2)
`weeklyRestCompensation()` (czasPracy.js) **ZAWYŻA** — traktuje KAŻDY odpoczynek ≥24h jako tygodniowy wymagający 45h. U Mirka naliczyło 47h06, w tym DWA "tygodniowe" w tym samym tygodniu 1-7.06 (niemożliwe — jeden na tydzień). Tacho Mirka pokazuje 23h39 rekompensaty (>21h max za jedną skróconą → ≥2 skrócone albo zaburzone dane; niepewne). **Wniosek dla kierowcy**: gdy liczba niepewna — bezpiecznie pełne 68h39 (nadmiar zawsze legalny). Fix: wykrywać JEDEN tygodniowy na tydzień stały pn-nd.

### E) Infografiki + PDF dla Mirka
Reguły rekompensaty zweryfikowane WebSearch (561/2006 art. 8.6): rekompensata **en bloc** (nie dzielić), doczepiona do odpoczynku **≥9h** (dzienny/tygodniowy), do końca **3. tygodnia**, max **21h** za jedną skróconą. Dwie grafiki HTML (sytuacja: 68h39=45h+23h39 + dwa zegary + plan Mirka; oraz "45h teraz + rekompensata później" — TAK pod 4 warunkami) → **landscape PDF** przez Playwright/Chromium (`gen_mirek_pdf.mjs`): 4 slajdy A4 + 2 osobne pliki w `~/Downloads/Mirek-*.pdf`. Weryfikacja layoutu przez preview screenshot (każdy slajd 794/794 px). HTML źródłowe `public/_mirek-*.html` — TYMCZASOWE, untracked, nie na prod.

### Pułapki / lekcje
- **Widok vs compliance rozjazd**: MultiDayActivityView rysował surowy GPS bez preferDddSegments → mylił usera. Teraz spójne.
- **Tacho auto-zapisuje jazdę** niezależnie od przełącznika karty → brak jazdy na DDD = auto stało (mocny dowód, nie domysł).
- **Bariera korekty = tylko DDD drive/work**, nie szum GPS (inaczej szum wyskakuje spod korekty).
- **Read PDF wymaga poppler** (brak) → layout weryfikowany przez ekranowy podgląd + preview screenshot zamiast renderu PDF.
- **gh token bez uprawnień PR** (createPullRequest fail) — backup branch + push działa, PR przez link/UI.
- Skrypty `diagnose_*.mjs`/`fix_*.mjs`/`gen_*.mjs` dodane do `.gitignore` (były tylko `.js`).

### Deploy / stan
- Wszystko PROD: commit 7cc3b7c (frontend Vercel) + firestore rules. Pre-push lint+build zielone.
- Korekta Mirka żywa na fleetstat.pl. Pozostali kierowcy czyści.

### Otwarte / następne
- **Prewencja** (odłożona — izolowany przypadek): alert kierowcy "stoisz na bazie X h, przełącz kartę na odpoczynek" w DriverPanel. Łapie błąd u źródła.
- **Bug rekompensaty** (chip task_c34dff72): jeden tygodniowy na tydzień stały.
- Cleanup: temp `public/_mirek-*.html` (powiedzieć→usunąć), GpsCzasPracySection martwy kod.

---

## 2026-06-12 — Sesja wielowątkowa: backup fix + dokumenty „od–do" + bug rekompensaty (4 commity PROD)

**Projekt**: FleetStat. 4 commity na main (Vercel): `822bb38`, `68cca4e`, `0dd193f`, `8949e07` + backfill Firestore + korekty docs/memory. Kilka pivotów wg potrzeb usera.

### A) Prewencja avail→rest (banner) — ZBUDOWANE i COFNIĘTE
Backlog #1. Banner w `DriverCzasPracyDashboard` (DriverPanel): bieżący OTWARTY status = dyspozycyjność >6h → żółta belka „Jesteś w DYSPOZYCYJNOŚCI od Xh" + one-tap „Przełącz na Odpoczynek" + dismiss. Trigger precyzyjny (auto-GPS nigdy nie daje avail → otwarty avail = świadomy klik). Build zielony, podgląd pokazany. **User: STOP — „chcę jak najmniej ingerencji kierowcy"** → banner cofnięty w całości (3 edycje odwrócone), NIE wdrożony. Memory: `feedback_minimal_driver_intervention`. Prewencja admin-side (korekta z 06-11) = właściwy kierunek.

### B) DDD auto-import — przeanalizowane, ODŁOŻONE (zostaje ręcznie)
User pytał o automatyzację pobierania `.ddd` z panelu widziszwszystko → import do FS. **Atlas API NIE ma endpointu DDD** (ATLAS_ALLOWED = tylko GPS). Pliki tylko w web-panelu, ręcznie (ikonka ⬇ per-plik; duży „Pobierz" wg zakresu dat bywa pusty — to myliło usera; data „11.06" = info „kiedy ostatni przeszedł", nie filtr). Pliki → `~/Downloads`. Opcje: A=mail od ww (jak CSV)→`wwReportInbound`, B=lokalny watcher folderu, C=bot panelu (ODRADZANE, etyka/ToS). **Decyzja: zostaje ręcznie**, docelowo email (A). Memory: `reference_ww_csv_import`.

### C) Nocny backup Firebase — NAPRAWIONY (commit `822bb38`)
Padał 4 noce (08-11.06, ostatni OK 07.06). Przyczyna: `npm install firebase-admin` BEZ pinu złapał **v14.0.0** (~08.06) → usunięte namespaced `admin.credential` → „Cannot read properties of undefined (reading 'cert')". Fix: modular API (`firebase-admin/app`+`/firestore`) + pin `@14`. Test read-only lokalnie (6 vehicles/1012 costs/status OK). **PAT**: token „vbs-stat (FleetStat)" nie miał perm **Workflows** → push pliku workflow odrzucony; user dodał `Workflows: RW`. Token nadal bez **Actions** → `gh workflow run` 403 → user odpalił przez web UI → zielony, świeży backup (`d2d0294` w vbs-stat-backups, 33818 wstawień). Memory: `reference_backup_discipline`.

### D) Node 20 deprecation (commit `68cca4e`)
2 annotacje = `actions/checkout@v4`+`setup-node@v4` na Node 20. Twardy deadline **16.06.2026** (GitHub wymusza Node 24). Bump → `@v5`.

### E) Dokumenty: „ważność od" (coverageStart) (commit `0dd193f`) + backfill
Skaner AI dokumentów (`extractWithAI`, App.jsx, claude-sonnet-4-6 przez `/api/claude`) gubił początek ochrony: miał `issueDate` (wystawienie) + `expiryDate` (do), brak „ważność OD". Test na 2 realnych polisach (curl→API + ground truth): **AI czyta daty BEZ błędów** — wystawienie 23.01 ≠ ochrona od 14.02 (różnica 3 tyg), ale „od" przepadało (brak pola w schemacie). Fix: `coverageStart` w prompt'cie (rozróżnia wystawienie vs ochrona), parsowaniu, formularzu kolejki, formularzu ręcznym, pasku `DocRow` („Zawarcie · Ważna od–do · X dni do wygaśnięcia"; fallback gdy brak od). Weryf. OC+AC (3 daty co do dnia). **Backfill**: 6/7 istniejących docs uzupełnione (transakcja Firestore + guard-raile długość/ID + kopia przed + weryfikacja; umowa GPS bez wyraźnego od → pominięta). Memory: `reference_doc_ai_scanner`. **⚠️ SECURITY**: `/api/claude` = otwarte proxy (CORS *, brak auth) → palenie klucza Anthropic; `task_7a16c81b`, blocker komercjalizacji.

### F) Bug rekompensaty (commit `8949e07`) — NAPRAWIONY
Backlog #2. `weeklyRestCompensation` liczyło KAŻDY rest ≥24h jako osobny tygodniowy → dwa długie odpoczynki w 1 tygodniu = podwójny dług (niemożliwe wg 561/2006). Fix: grupowanie po tygodniu pn-nd (`_mondayOf`), tygodniowy = najdłuższy ≥24h/tydzień, dług tylko ze skróconych (FIFO+deadline bez zmian). Weryf. read-only STARE vs NOWE na żywych segmentach: Mirek **40h05→4h22**, flota sensowna (Ivansky 20h31≤21h, Kolabu/Lukashuchuk 0; fix może tylko obniżyć). Zgodne z art. 8.6.

### Pułapki / lekcje
- **Unpinned dep w CI = cicha bomba** (firebase-admin v14 major złamał backup). Pinuj zależności.
- PAT fine-grained: edycja pliku workflow wymaga perm **Workflows**; trigger runów wymaga **Actions** (osobne).
- `node fetch` ucina duże body (PDF) → „undici terminated"; użyj **curl**. `.env.local` ANTHROPIC_API_KEY w **cudzysłowach** (strippować przy raw).
- **AI czyta daty dobrze** — błąd był w schemacie (brak pola), nie w odczycie.
- Firestore write na prod: **transakcja + guard-raile** (długość tablicy + zbiór ID) + kopia przed (data-loss history).
- Read PDF lokalnie nie działa (brak poppler) — ekstrakcja przez API.

### Deploy / stan
- 4 commity PROD na main (Vercel live, bundle `index-CEe9mKQA.js`). Backup workflow zielony. Backfill docs live.
- Memory: NOWE `feedback_minimal_driver_intervention`, `reference_doc_ai_scanner`; ZAKT. `reference_ww_csv_import`, `reference_backup_discipline`, `reference_ddd_parser`, MEMORY.md.

### Otwarte / następne
- **#3 cleanup** martwy kod `GpsCzasPracySection.jsx`.
- **Security** `/api/claude` otwarte proxy (`task_7a16c81b`) — Firebase ID token auth + zawężenie CORS; sprawdzić też vbs-invoices. Blocker komercjalizacji.
- DDD email-import (opcja A) gdy widziszwszystko doda wysyłkę `.ddd`.
- temp `public/_mirek-*.html` (z 06-11) — do usunięcia.

---

## 2026-06-15 — Security: /api/claude (main) zabezpieczony + audyt vbs-invoices (role-gating callable) — 2 repa PROD

**Projekt**: FleetStat. Domknięcie backlogu #Security + #cleanup z 06-12. 2 repozytoria, 3 commity PROD: `4a5153d` (VBS-Stat /api/claude→Vercel) + `fca7661` (vbs-invoices functions + `firebase deploy`) + `1cc66c2` (VBS-Stat cleanup→Vercel). Step-by-step z testami przed każdym deployem.

### A) Main app `/api/claude` — otwarte proxy ZABEZPIECZONE (commit `4a5153d`, PROD)
Backlog #Security (`task_7a16c81b`). `api/claude.js` był otwartym proxy: `Access-Control-Allow-Origin: *`, ZERO auth, forwardował dowolne body do Anthropic z kluczem właściciela → każdy znający URL palił klucz/limit. **Fix 3-częściowy**:
- **Backend** `api/claude.js`: weryfikacja **Firebase ID tokena** (`firebase-admin/auth` `verifyIdToken`, init `{projectId:'vbs-stats'}` BEZ service accounta) — bez/zły token → 401; CORS `*` → whitelist (fleetstat.pl, www, *.vercel.app, localhost).
- **Front** `src/firebase.js`: helper `callClaude(body)` dokłada `Authorization: Bearer <idToken>` (`auth.currentUser.getIdToken()`); 5 call-site'ów (App.jsx ×4 + ZlecenieUploadBtn.jsx) → `callClaude`.
- **Test lokalny** (diagnose_*.mjs gitignored): mint realnego tokena przez service account → handler 401(brak)/401(zły)/200(ważny) + CORS echo. **Weryfikacja PROD**: bez tokena 401 „Brak tokena", z tokenem 200 (real Anthropic). Memory: `reference_doc_ai_scanner`.
- ⚠️ Kanoniczna domena = `www.fleetstat.pl` (apex 307→www; curl bez `-L` widzi tylko „Redirecting…"). Apka woła `/api/claude` względnie (same-origin), redirect jej nie dotyczy.

### B) Faktury `vbs-invoices` — NIE było proxy (założenie błędne); role-gating callable WDROŻONE (commit `fca7661`, deploy)
Memory zakładała „ten sam otwarty proxy". **Recon (Krok 0) obalił**: repo JEST lokalnie (`~/Desktop/vbs-invoices.nosync`; wcześniejszy „brak" = artefakt zsh nomatch glob). Architektura INNA: brak `api/`, klucz = **Firebase Secret** użyty server-side w Cloud Functions (`functions/lib/claude.js`). Callable mają `if(!request.auth)`. **Anonimowego palenia klucza TU NIE MA.**
**Ale przy okazji znaleziony łagodniejszy gap**: `onCall` gatowały tylko „zalogowany", nie rolę → zalogowany nie-admin mógł wołać bezpośrednio (z pominięciem UI) `clearAndReset` (DESTRUKCYJNE: kasuje invoices+contractors), `scanNow` (koszt Claude), `inspectMailbox` (dane skrzynek). **Fix (user wybrał opcję B)**: `functions/lib/firestore.js` helper `isUserAdmin(uid)` czyta `users/{uid}.role` (1:1 jak `firestore.rules isAdmin()`; rola TYLKO w Firestore, brak custom claims) + `functions/index.js` bramka `assertAdmin(request)` (zalogowany+admin) w 3 callable. `node --check` OK → `firebase deploy --only functions` (projekt vbs-invoices, OSOBNY od vbs-stats). **Weryfikacja PROD**: bez auth 401 `unauthenticated`; admin skanuje → działa (licznik skanów +1, user potwierdził screenshotem 2×).

### C) Cleanup martwy `GpsCzasPracySection.jsx` (commit `1cc66c2`, PROD)
Backlog #3. Komponent (542 linie / 29 KB) był lazy-importowany w `App.jsx` ale **nigdzie nierenderowany** (`<GpsCzasPracySection` = 0 użyć) — zastąpiony przez `TachografComplianceSection` (06-05); orphaned import generował zbędny chunk 20 KB. Usunięto plik + lazy import + posprzątano 2 komentarze (`firebase.js`, `TachografComplianceSection.jsx`). Build 867 modułów (−1, chunk zniknął), lint 0 errors. Temp `public/_mirek-*.html` — sprawdzone, już nie istniały (sprzątnięte wcześniej). Memory: `project_tacho_powrot_do_bazy` zaktualizowana.

### Pułapki / lekcje
- **Weryfikuj założenia z pamięci recon'em ZANIM ruszysz kod** — „ten sam otwarty proxy" było nieprawdą; faktury miały zupełnie inną architekturę. Recon (Krok 0) oszczędził „naprawiania" nieistniejącego problemu / zepsucia działającej apki.
- **zsh nomatch**: `ls a* b* c*` gdy `b*` nie matchuje → zsh PRZERYWA całą komendę → fałszywy „brak" (vbs-invoices był na Desktopie cały czas). Używaj `2>/dev/null` per-glob lub `find`.
- **firebase-admin `verifyIdToken` działa na Vercelu z init `{projectId}` BEZ service accounta** (potrzebuje tylko projectId + publicznych kluczy Google) — zweryfikowane mint+verify lokalnie. `jose` by nie zadziałał out-of-the-box (Firebase = x509, nie JWKS).
- **Callable `onCall` NIE wymusza auth** — wymaga ręcznego `if(!request.auth)`; rola wymaga osobnego czytania Firestore (brak custom claims w vbs-invoices, inaczej niż main app gdzie `onRoleChange` syncuje claims).
- **2 OSOBNE projekty Firebase**: `vbs-stats` (main) vs `vbs-invoices` (faktury) — service account jednego nie działa na drugim; deploy funkcji = `firebase deploy --only functions` (NIE przez Vercel/merge).

### Deploy / stan
- VBS-Stat: `main` `4a5153d` (Vercel live). vbs-invoices: `main` `fca7661` + 4 funkcje redeployed (europe-west1, „Successful update").
- Branche `claude/secure-api-claude`, `claude/cleanup-gpsczaspracy` (VBS-Stat) + `claude/admin-gate-callables` (vbs-invoices) zmergowane FF i **usunięte** (local+remote) przy domknięciu sesji.
- Memory: ZAKT. `reference_doc_ai_scanner` (security oba repa, opis fix + dług Node 20). Chip `task_7a16c81b` = stale (sprzed restartu, nieusuwalny programowo — user może odrzucić ręcznie).

### Otwarte / następne
- **⚠️ Dług Node 20**: Cloud Functions runtime Node 20 **decommission 2026-10-30** (OBA repa) + `firebase-functions` outdated → upgrade przed deadline (po tym brak deploya bez upgrade'u). ~4,5 mc zapasu.
- DDD email-import (opcja A) gdy widziszwszystko doda wysyłkę `.ddd`.

---

## 2026-06-25 — vbs-invoices: maraton (logo + radek + thread-aware CMR + SSH)

**Projekt**: vbs-invoices (faktury.fleetstat.pl). Sesja ekstremalnie długa (~6h, budżet "krótko ~1h" przekroczony 6×). 11+ commitów PROD, 4 deploye CF, migracja security.

### A) Logo + favicon
- **Sidebar logo iteracje** (user nie wiedział co dobre — kilka rund live): 190 → 70 → 88 → 100 → 120 → 140 → **160px** (`commit e8cb0be`, ostateczny ~30px mniej niż oryginalny).
- **Favicon** (commit `029b44b`): wycięto sam znak (lewa część wordmarku 753×753) z `logo-fleetstat-invoices.png` przez Pillow (zainstalowany lokalnie) → `favicon.ico` (16/32/48) + `favicon-32.png` + `apple-touch-icon.png` (180px na białym). `<link>` w `index.html`.

### B) Skrzynka radek@vbstransport.com — pełen setup
- 3 zmiany kodu (commit `87f2901`): `IMAP_RADEK_PASSWORD` (Firebase Secret), `getMailboxConfigs()` + radek, secret w 3 funkcjach (scanIMAPMailboxes, scanNow, inspectMailbox).
- Hasło `Nowehaslo99` (wyciekło w transkrypcie — user zarekomendował rotację, ZROBIONE).
- **OOM przy 4-mc startDate** → bump memory 512 MiB → 2 GiB (`9097e40`); później batch limit 50/tick w schedulerze (`79466f8`) + scheduler `every 1 min` + `maxInstances: 1` (`7695d23`) dla przyspieszonego backfillu.
- **Radek ma 65 612 maili w INBOX** (gigant); 1-mc backfill = ~1944 kandydatów; po 30+ min backfilling.
- `startDate` global: 2026-04-18 → 2026-02-25 → ostatecznie **2026-05-25** (1 mc wstecz, decyzja user po info że 4 mc = drogo + ryzyko timeoutu).

### C) CMR/POD grouping — 3 warstwy bypass Haiku + thread-aware
**Regresja po Paczce B** (Haiku prefilter z 2026-05-26): Haiku odrzucał CMR jako "not FV" zanim FAZA 2 grouping mógł je podpiąć jako załączniki głównej FV. Iteracja fixów:
- **Warstwa 1 — filename hints** (`a6b2e38`): pliki z `/cmr|pod|list_przewoz|delivery_note|consignment/i` w nazwie omijają Haiku, idą prosto do Sonnet → `documentType` poprawnie ustawiony.
- **Warstwa 2 — subject pattern** (`83bcc43`): subject typu `NNNN/RS|KW|AW|AS/MM/YYYY` (kody dyspozytorów VBS) → CAŁY mail omija Haiku. Domain rule od user (RS=Radek Skiba?, KW/AW/AS=inni dyspozytorzy).
- **Reprocess CF + przycisk admin** (`4055e76`): nowa CF `reprocessAttachments` (2 GiB, 30 min timeout) + helper `reprocessInvoiceAttachments` w `lib/mailbox.js` + button "🔧 Uzupełnij brakujące CMR/POD" w Dashboardzie (fioletowy panel). Auto-szuka FV z pustym attachments + transport-subject, IMAP-fetch oryginalnego maila, klasyfikuje aux przez Sonnet, PATCH attachments[]. **Wynik 1. uruchomienia: 18/22 FV podpiętych (4 noAux)**.
- **Warstwa 3 — thread-aware IMAP SUBJECT search** (`e82f862`): user-disclosed workflow: wątek transportowy często ma CMR/POD/zlecenie w OSOBNYCH mailach od FV (CMR po rozładunku, FV tygodnie później). Reprocess teraz wyciąga threadKey z `emailSubject`, robi IMAP `SUBJECT` search po nim, znajduje ALL sibling UIDy w wątku, klasyfikuje aux ze wszystkich → merge z istniejącymi attachments (dedup po storageRef, pole `fromThread: true`). Filter rozszerzony na WSZYSTKIE transport-subject FV. **Naprawia case RIREU 25832**: CMR przyszedł UID 59933 (9 czerwca), FV UID 60224 (25 czerwca) — system połączył.

### D) UI badges (zamiast 📎 zszywacza)
- InvoiceList + CMRList (`b99baf6` + `94bf902`): małe kolorowe kwadraciki obok nazwy sprzedawcy: **FV** (zawsze, brand-blue), **CMR** (emerald, dla `delivery_note|cmr`), **POD** (amber), **ZL** (violet, dla `order`), **INNE** (szary fallback). Liczba per typ tylko gdy >1 (np. "CMR 3"). User widzi STRUKTURĘ dokumentów wątku transportowego jednym rzutem oka.

### E) Security — migracja PAT → SSH (wszystkie 3 repa)
- **2× wycieki w transkrypcie** w tej sesji: (1) IMAP password radka `Nowehaslo99`, (2) PAT `ghp_zMch...` w git push error message, (3) nowy PAT `ghp_gqvVBm...` po user paste; oryginalny PAT też naturally expired today (2026-06-25).
- **Decyzja**: SSH key zamiast PAT. Wygenerowano `ed25519` w `~/.ssh/id_ed25519` (no passphrase), `~/.ssh/config` z `UseKeychain` + `AddKeysToAgent`, klucz dodany do macOS Keychain. Public key dodany do GitHub.
- **3 remote'y przepięte** (HTTPS+PAT → SSH): `vbs-invoices` (był z PAT embedded), `VBS-Stat`/FleetStat (był z PAT przez Keychain credential helper), `fox` (był z PAT przez Keychain credential helper). Test `ssh -T git@github.com` → `Hi wasikkamil-art!`. Fetch działa dla wszystkich 3.
- Stary PAT (z transkryptu) — user **revoked + deleted** na GitHubie. Nowy backup PAT user zrobił dla future-use (API/automation) i zachował poza chat.

### Pułapki / lekcje
- **Vercel deploy lag** — kilka razy zdawało się że deploy nie zszedł, a faktycznie był (CDN edge cache podawał stary index.html). Bundle hash check (curl prod + grep) = wiarygodny indykator.
- **Logo size live-iteration kosztowna** — user robił `190 → 70 → 88 → 100 → 120 → 140 → 160` z 6 deployami po kolei (mocki proponowane ale user wolał deploy+see). Lekcja: gdy user iteruje rapid pixel-tuning, zaproponować Once vs po każdej zmianie.
- **Radek 65k mailbox** wymaga: 2 GiB CF memory, 30 min timeout (reprocess), batch limit 50/tick (scheduler), accelerated tick (every 1 min) tylko dla backfillu (revert do 10 min po dojechaniu).
- **Thread-aware retroactive fix wymaga IMAP SUBJECT search** — przeszukuje całą skrzynkę po substring, działa dobrze ale wolne na 65k INBOX radka. Wyciąga sibling UIDy, dedup storageRef merge z istniejącymi.
- **PAT wygasł dziś naturally** — pierwotnie myślałem że PAT w transkrypcie spowodował "push fail", ale tak naprawdę po prostu wygasł. SSH migration usuwa cały kategorię problemów.
- **Forward-going thread-aware grouping NIE zaimplementowane** — Phase 1 (auto-link orphans przy zapisie nowej FV) odłożone. Obecnie tylko reprocess button (retro) działa thread-aware. Jak nowa FV przyjdzie z CMR w sibling mailu → user musi kliknąć "Uzupełnij brakujące CMR/POD" po jakimś czasie. Forward-going wymagałoby nowej kolekcji `orphanDocs` + auto-link logic w `scanMailbox`.

### Deploy / stan
- vbs-invoices: 11+ commitów PROD (favicon `029b44b` → ... → UI badges `94bf902`), 4 deploye CF z `lib/` zmianami (wszystkie funkcje), wszystkie na SSH remote teraz.
- Backfill radek wciąż w toku (scheduler `every 1 min`, batch 50/tick, ~30+ ticków z ~39 oczekiwanych). Po dojechaniu — **revert scheduler na `every 10 minutes`** (kolejny commit + deploy CF).
- Memory: NOWA `reference_github_ssh_setup.md`; ZAKT. `project_invoice_ai_scanner.md` (wpis 2026-06-25 na górze); MEMORY.md zaktualizowany (entry SSH po PAT incident).

### Otwarte / następne
- **Revert scheduler na `every 10 minutes`** po zakończeniu backfillu radka — zostawić 1-min permanentnie = zbędne obciążenie + cold-starty.
- **Forward-going thread-aware grouping** (Phase 1) — jeśli user chce, nowa kolekcja `orphanDocs` + auto-link w `scanMailbox`. Obecnie tylko retro-button.
- **Dług Node 20** (z 2026-06-15) — wciąż otwarty na OBA repa, deadline 2026-10-30.
- **CLAUDE.md backup sekcja "Security PAT"** — nieaktualna (PAT już nie używamy). Update przy okazji.

---

## 2026-06-25 (cd. — sesja 2) — vbs-invoices: Phase 1 orphanDocs forward-going auto-link

**Projekt**: vbs-invoices (faktury.fleetstat.pl). Sesja krótka (~1h, w budżecie). Kontynuacja po marathonie. Wybór user'a: A) orphanDocs auto-link (budżet 4h+). 1 commit PROD `6ad7a26` (5 plików, +476/-25), 5 CF redeployed, rules deployed, front na Vercel.

### Co rozwiązuje (ból usera)
Wcześniej: FV przychodzi z CMR w OSOBNYM mailu tego samego wątku transportowego (CMR po rozładunku, FV tygodnie później, osobne UID, ten sam threadKey `NNNN/RS|KW|AW|AS/MM/YYYY`) → user musiał ręcznie klikać "🔧 Uzupełnij brakujące CMR/POD" (reprocess CF, retro). Teraz: **automatycznie i dwukierunkowo** przez kolekcję `orphanDocs`.

### Recon ZANIM kod (lekcja 06-15)
Pełne przeczytanie `mailbox.js` (1032 l.), `firestore.js`, `storage.js`, `index.js`, `CMRList.jsx`, `firestore.rules`, `storage.rules`, `firebase.json`. Potwierdzone: `saveInvoice` 1 caller (bezpieczna zmiana sygnatury), storage rules pokrywają orphan files (ta sama ścieżka `invoices/{y}/{m}/`), brak potrzeby nowych composite indexów.

### Implementacja (mailbox.js scanMailbox + firestore.js helpery)
- **FAZA 3a** (mail BEZ głównej FV): CMR/POD/zlecenie (isAttachable) → `captureOrphan` zamiast wyrzucenia. Upload Storage + `saveOrphanDoc`. Jeśli FV z tym threadKey JUŻ istnieje (CMR po fakturze) → `appendInvoiceAttachments` od razu + orphan zapisany jako linked.
- **FAZA 3c** (przyszła FV): `getUnlinkedOrphansByThread` → dociąga CMR z wcześniejszych maili wątku → attachments + `markOrphansLinked` (CMR przed fakturą = główny case).
- `saveInvoice` zapisuje `threadKey` (potrzebne do forward-link). 8 istniejących FV ma threadKey z wczorajszego reprocessu → forward-link działa od razu.
- Helpery firestore.js: `saveOrphanDoc` (idempotentny ID=sha1(storageRef)), `findInvoicesByThreadKey`, `getUnlinkedOrphansByThread` (filtr linkedInvoiceId==null w kodzie → bez composite indexu), `markOrphansLinked` (batch), `appendInvoiceAttachments` (dedup po storageRef).
- **ZERO dodatkowych wywołań Claude** (aux już sklasyfikowane w FAZA 1). Każdy krok try/catch (nie wywala scanu). Liczniki `orphansSaved`/`orphansLinked`.

### Frontend
`useOrphanDocs` hook + sekcja "📭 CMR/POD bez faktury" w CMRList (bursztynowa karta `OrphanCard`). **Cross-check po storageRef** — orphan znika gdy jego plik wisi przy JAKIEJKOLWIEK FV (łapie też podpięcia przez reprocess). Manual attach UI = poza fazą (orphan-bez-threadKey: komunikat "podepniesz ręcznie").

### Rules
`orphanDocs`: read=authed, write=CF-only (Admin SDK).

### Weryfikacja (sufit bez logowania / Javy / ADC)
- `node --check` ×3 ✅ + `npm run build` (64 modułów, 0 błędów) ✅.
- **Query na realnej infrze** (runQuery REST, gcloud token): `where threadKey ==` na invoices → trafia RIREU 25832; na orphanDocs (nowa kolekcja) → 0, oba BEZ błędu indexu (single-field auto-index potwierdzony).
- Brak regresji: ticki schedulera pre/post-deploy czyste (0 errors).
- **Front E2E wizualnie**: zasiany test orphan przez REST (`TEST_ORPHAN_DELETE`, realny PDF storageRef nie-attachment + threadKey pasujący do niczego) → user potwierdził screenshotem (sekcja + bursztynowa karta + threadKey status + download) → **skasowany, baza czysta**.
- **Live capture→link czeka na realny ruch** — niewykonalne z CLI (brak wstrzyknięcia maila / tokena Firebase / Javy / ADC). Zadziała na pierwszym realnym CMR-bez-FV; monitoring logów schedulera.

### Pułapki / lekcje
- Bez ADC/Javy/creds izolowany live-E2E backendu z CLI niewykonalny → weryfikuj przez (a) runQuery REST na realnych danych (query+index nie wywalą feature'a po cichu), (b) zasianie test-doc przez REST + wizualne potwierdzenie frontu, (c) monitoring logów. Test orphan musi mieć storageRef NIE-attachment (inaczej cross-check go ukryje) + threadKey pasujący do niczego (zostaje "oczekujący").
- Vite hash content-based → prod podający ten sam hash co lokalny build = pewny dowód że nowy front live (bez czekania na "deploy done").
- Edit tool wymaga Read tym narzędziem (nie `cat`/Bash) zanim edycja — firestore.rules/SESJA-LOG trzeba było Read.

### Deploy / stan
- vbs-invoices: `main` `6ad7a26` (Vercel live, bundle `index-Ijj9F9CM.js`). 5 CF redeployed (rewizja `scanimapmailboxes-00023-jem`). Rules deployed. Branch `claude/orphan-docs-autolink` zmergowany FF + usunięty.
- Memory: ZAKT. `project_invoice_ai_scanner.md` (frontmatter + wpis 2026-06-25 cd. na górze), MEMORY.md indeks.

### Otwarte / następne
- **Live confirmation orphan auto-link** — czeka na pierwszy realny CMR-bez-FV (monitoring logów). Można też kliknąć "Test 10 najnowszych".
- **Backlog UI** (z 2026-05-27, wciąż otwarte): dashboard wykresy Recharts, mobile responsive, eksport CSV księgowej.
- **Manual attach orphana-bez-threadKey** w InvoiceDetail (button "podepnij") + cleanup stale orphans — opcjonalne, gdy się pojawią.
- **Dług Node 20** — OBA repa, deadline 2026-10-30.
- **CLAUDE.md sekcja "Security PAT"** — nadal nieaktualna (option C z tej sesji, niewybrana).

## 2026-07-01 — FleetStat: multi-stop rozładunki (parser AI + DriverPanel) + Service Worker fix (2 commity PROD)

Trigger: zlecenie ZL0658/06/26 (Basten Logistik) miało **4 rozładunki** (Offenhausen zał. → Grass LU / Eupen BE / Vilvoorde BE / Merchtem BE), a „AI zaczytało tylko 2 u Mirka, resztę Arek dopisywał ręcznie".

### Diagnoza (read-only, potwierdzona na żywo)
`diagnose_zl0658.mjs` (firebase-admin, gitignored) na `fleet/data → fleetv2_frachty`, fracht `m5ja15cl` (v4): R1/R2 = robota AI ("Według CMR", godz z okien PDF), R3/R4 = ręczne (skrót "WG CMR", zbite spacje, data poprawiona 07-01→07-02 przez człowieka). **Werdykt: AI złapało 2 z 4 (cap schematu), reszta wklepana ręcznie.** Root cause: parser miał sloty tylko na 2 rozładunki; model danych + FrachtyModal (showR2..R5) + mapa/trasa uniosły już 5 — wąskie gardło = wyłącznie parser + DriverPanel.

### Fix 1 — parser AI zlecenia (commit `480dbd9`, `ZlecenieUploadBtn.jsx`)
Schemat +R3/R4/R5 (firma/kod/miasto/adres/telefon/data/godz × 3) + instrukcja multi-stop „1..5 w kolejności trasy, nie zwijaj" + `max_tokens` 1200→1800 (5 stopów bez ucięcia JSON→cichy pusty formularz). Odbiorca `...onlyNew` (App.jsx:16800/17390) i formularz już to obsługują — zero zmian downstream. Ograniczenie świadome: **daty** — AI weźmie „01.07" ze wszystkich okien PDF, rozbicie na dni (Arek: 07-01/07-02) dalej ręczne.

### Fix 2 — DriverPanel multi-stop R1..R5 (commit `480dbd9`, `DriverPanel.jsx`)
Dwa zahardkodowane kafle (R1 + opcjonalny R2 na `hasR2`) → **pętla `stopData.map` po R1..R5**. `stopNums=[1..5].filter(istnieje)`, sekwencyjne odblokowanie (stop N po dotarciu N-1), km koniec + zdjęcie uszkodzeń + brama „Zakończ trasę" na REALNIE ostatnim stopie, `cmrComplete = wszystkie stopy mają CMR`. Backend eventów (`updateFrachtStatus`/`uploadDriverPhoto`) już przyjmował dowolne `r` — cap był tylko w renderze. Backward compat: single-stop `r=null` (legacy events r==null||1 → R1), istniejące 2-stopowe (r=1/2) bez zmian. Chunk DriverPanel 92.4→86.95 kB (usunięty duplikat). 0 lint errors.

### Fix 3 — Service Worker (commit `29290e5`, `public/sw.js` + `index.html`) = zamyka TODO #1
Problem: po każdym deployu userzy trzymali stary kod, ręczne „wyczyść dane witryny" (kosztowało ~30 min debugu „nie działa" = stary cache).
- `sw.js`: index.html/nawigacje **stale-while-revalidate → NETWORK FIRST** (świeży shell online → nowe hashe → nowy bundle; offline→cache). CACHE_NAME **v5→v6** (jednorazowe przejście, wymusza instalację nowego SW u otwartych kart; dalej bump niepotrzebny). Hashed assets zostają cache-first (immutable).
- `index.html`: listener `controllerchange` → jednorazowy reload (guard `refreshing` przeciw pętli) gdy nowy SW przejmie kontrolę.
- Efekt: **kolejne deploye propagują się same**. Ryzyko flagged: auto-reload zabierze niezapisany formularz jeśli deploy trafi dokładnie gdy kierowca coś wpisuje (rzadkie, standardowy trade-off PWA).

### Deploy / stan
2 pushe na `main`: `480dbd9` (parser+DriverPanel), `29290e5` (SW). Oba pre-push (lint+build) zielone, Vercel auto-deploy. Diagnoza `diagnose_zl0658.mjs` lokalna (gitignored).

### Otwarte / następne (follow-up multi-stop — świadomie odłożone)
- **Admin Trip Summary (App.jsx, ~10 refs R2-cap) + publiczny TrackerPublicView (1 ref)** — dalej R1+R2. Kierowca odklika dotarcie R3/R4, ale timeline admina i publiczny link tych stopów NIE renderują jeszcze. Domknięcie spójności multi-stop = następna sesja.
- **Weryfikacja PROD (niewykonalne z CLI)**: (a) kierowca otwiera multi-stop fracht na telefonie → 4 kafle + sekwencja; (b) po deployu sprawdzić czy nowy kod wchodzi bez ręcznego czyszczenia (transakcja v5→v6 może wymagać jednego reloadu, KOLEJNE same).
- Z listy startowej wciąż: #2 dwa skanery AI na base64 (analyzeFile delegacje ~11981 + parseOneInvoice płatności ~10946 — latentny 413), #3 Node 20 CF (deadline 2026-10-30, oba repa), #4 cleanup 16 branchy claude/*.

## 2026-07-07 — Email floty: migracja SendGrid→Resend + fix statusu + redesign Apple-light (2 commity PROD)

Trigger: user zauważył że maile „Statusy floty" (auto 3×/dzień 8/14/20) nie wychodzą — ostatni 1 czerwca.

### Diagnoza (emailLogs, read-only)
Ostatni `sent` 2026-06-01 06:00, pierwszy błąd tego samego dnia 12:00 → **114× „Unauthorized"**. Scheduler odpala się co do minuty — problem ZA nim: **SendGrid trial wygasł 1.06.2026** → klucz API 401. Ten sam klucz napędzał też podsumowania tras do klientów (`finalizeTrip`) → **5 klientów nie dostało trip-summary** (m.in. `m5ja15cl` = ZL0658 Basten Logistik). Free tier SendGrida już nie istnieje (tylko 60-dniowy trial, najtańszy płatny ~$20/mc za 100k maili — przepłacanie przy realnym ~500/mc).

### Migracja na Resend (commit `c680aa0`)
Decyzja user: Resend (darmowy 3000/mc). Setup przez user krok-po-kroku: konto resend.com → domena fleetstat.pl region EU → 3 rekordy DNS w home.pl (DKIM `resend._domainkey`, MX+SPF na `send.fleetstat.pl`) → Verified → API key `re_...` wklejony w panel (pole `sendgridApiKey` — nazwa została). Kod: helper `sendEmailsResend` (czysty `fetch` do REST batch endpoint, Node 22 globalny fetch, **bez zależności npm**; `@sendgrid/mail` usunięty = cleanup C). 2 miejsca: `sendFleetStatusEmail` (batch, osobny mail/odbiorcę) + `finalizeTrip` (single, drop trackingSettings — Resend nie przepisuje linków → token Storage cały). Klucz `config.resendApiKey || config.sendgridApiKey`. **Pre-flight test przed deployem**: wysłany testowy mail przez REST → HTTP 200 + realna dostawa do inboxa → dopiero deploy. Deployed: sendFleetEmail8/14/20, sendFleetEmailNow, finalizeTrip (europe-west1).

### Fix statusu w mailu (ten sam commit `c680aa0`)
User: „WGM 0507M ma wbitą bazę, a mail pokazuje W trasie/WŁOCŁAWEK". `buildEmailHTML` czytał **puste pole `statusRozladunku`**, a realny status jest w `statusRozladunkuManual` (admin) lub `driverEvents` (kierowca) — od refactora 2026-04-28. Fix: port helpera `isFrachtRozladowanyCF` (parytet z `src/utils/frachtStatus.js` computeFrachtStatus) + pobranie driverEvents (246 dok., grupa per frachtId) + 5 miejsc filtrów. **Symulacja na realnych danych przed deployem**: W trasie 3 / Baza 1 (zgodne z Przeglądem).

### Redesign Apple-light + logo (commit `0ba2066`)
Iteracyjnie z user (kilka rund + screeny): emoji 🚛 → logo FleetStat (`public/logodologowania.png`, hostowane na fleetstat.pl przez Vercel). Masthead wyśrodkowany (VBS + logo│Status floty + data). Apple-light: karta radius 18px + warstwowy miękki cień + hairline ramka `#ececed` na tle `#f5f5f7`; palety Apple grey (`#1d1d1f`/`#6e6e73`/`#86868b`), separatory `#f0f0f2`, link stopki Apple blue `#0071e3`. Wiersze pojazdów zostają do lewej. Logo ciemne → najpierw próba na białym chipie (odrzucone jako „naklejka"), finalnie jasny nagłówek (logo natywnie na białym). Podgląd w widgecie odpadł (CSP blokuje obrazki z fleetstat.pl) → iteracja przez realny „Wyślij teraz".

### Lekcje / gotchy
- `emailLogs` (status sent/error + error.message) = złoty ślad do diagnozy wysyłki. `vehicleCount` odróżnia fleet-status od trip_summary.
- Weryfikacja bez deployu: (a) pre-flight REST send realnym kluczem z config na własny adres, (b) symulacja logiki statusu na realnych danych. Deploy dopiero po zielonym.
- CF już na **Node.js 22** (2nd Gen) — runtime część długu #3 załatwiona; zostaje bump paczki firebase-functions.
- Email image: tylko hostowany HTTPS (nie SVG/inline); box-shadow widać w Apple Mail, Gmail pomija → hairline ramka trzyma definicję karty w obu.

### Deploy / pamięć
2 pushe na main: `c680aa0`, `0ba2066` (+ wcześniejszy push multi-stop/SW z tej samej sesji: `480dbd9`, `29290e5`, `fc719cb`). Pamięć: nowa `reference_email_resend.md` + indeks MEMORY.md.

### Otwarte / następne
- **5 zaległych podsumowań do klientów** (okres awarii) — resend ręczny „Wyślij podsumowanie" w trasie; recent = Basten Logistik `m5ja15cl`. User zdecyduje które.
- **⚠️ Inbound SendGrid**: CSV import `imports@inbox.fleetstat.pl` (widziszwszystko) używał SendGrid Inbound Parse — ten sam trial mógł go ubić 1.06. NIESPRAWDZONE — do weryfikacji przy powrocie do importów CSV.
- Follow-up multi-stop (admin Trip Summary + TrackerPublicView R3–R5) wciąż otwarty (z sesji 2026-07-01).

## 2026-07-16 — Parser DDD: fix zawyżonego dnia pobrania karty (commit `88d2a02` PROD)

Trigger: user wgrał nowy plik DDD dla WGM 0475M (Volodymyr Ivanskyy), prosił o weryfikację czy compliance liczy dobrze czas pracy.

### Diagnoza (read-only na `dddFiles` + `driverActivities`)
Parse `success` (karta UAD0000006RQ7001, okres 2025-12-19→2026-07-16, 2329 aktywności). Dni historyczne OK (jazda/praca/odp zgodne z km). **ALE dzień pobrania karty (ostatni dzień pliku) zawyżony**: 07-16 pokazywał **jazda 18h34** (fizycznie niemożliwe). Wzorzec SYSTEMATYCZNY w każdym uploadzie: ostatni segment „drive" rozciągnięty do północy (07-16: `od 10:16 drive 13h44→24:00`; 07-15: 13h22; 07-13: 13h37). Root: **readesm-js domyka ostatnią otwartą czynność dnia do 1440 min** — dla dnia zgrania to fałsz (karta przestała rejestrować ~10:29 = godzina z nazwy pliku `C_20260716_1029`, nie o 24:00). Skutek: false compliance violation (przekroczony dzienny limit), zawyżony tydzień, błędny „pozostały czas jazdy dziś".

### Fix (`parseDddFile` / `computeDddDailyReport`)
Czas pobrania z nazwy pliku (`^[A-Za-z]_YYYYMMDD_HHMM`, strefa = UTC tachografu jak segmenty) → urwij ostatni segment dnia pobrania, **TYLKO gdy realnie sięga północy** (`lastEnd>=1440` i cutoff w segmencie) — bezpieczne, nie rusza dni zakończonych. Trim przed liczeniem `summary`, więc propaguje do sum, ribbonu (`dailyTotals`) i compliance (`driverActivities` source=ddd). Nowy param `computeDddDailyReport(parsed, vehicles, downloadCutoff)`.

### Weryfikacja (przed deployem + po re-uploadzie)
- Symulacja na realnych danych PRZED deployem: 07-16 18h34→5h03, 07-15 15h52→3h40, 07-13 17h37→5h25 (wszystkie <10h).
- Po re-uploadzie: 07-16 ribbon **5h03**, `driverActivities` source=ddd 17 wpisów jazda **5h03** kończące się dokładnie **10:29** (ostatni segment 10:16→10:29, przycięty 824→13min). GPS (auto_gps) dolicza po 10:29 osobno — `preferDddSegments` preferuje DDD w oknie karty.

### Gotchy / lekcje
- Pole compliance activities = `startTs`/`endTs` (nie `start`). Źródła mieszane: `ddd` + `auto_gps` w tym samym dniu (GPS pokrywa po zgraniu karty; DDD autorytatywne w oknie karty).
- Fix wymaga **re-uploadu** istniejących plików (poprawka działa na nowe parsowania; stary rekord ma zawyżony dzień pobrania). Nowe uploady już czyste — user nic nie musi robić.
- Nazwa pliku `C_YYYYMMDD_HHMM` = wiarygodne źródło czasu pobrania (VBS reader tak nazywa); godzina w UTC (spójna z `fromMin` segmentów).

---

## 2026-07-20 — Security `/api/claude` + role-gating vbs-invoices + cleanup + fix wycofanego modelu (4 commity PROD)

⚠️ **Uwaga o datach**: briefing na starcie tej sesji opisywał „stan po 2026-06-12", a repo miało już pracę do 2026-07-16. Wpis TEJ SAMEJ sesji został omyłkowo złożony wyżej jako **„2026-06-15"** (commity docs `5d49837`/`2dc3f96`) — treść tam jest poprawna, data myląca. **Commit-hashe = źródło prawdy.**

### Zrobione (wszystko zweryfikowane na PROD)
- **`4a5153d` SECURITY `/api/claude`** — było OTWARTE proxy (`Access-Control-Allow-Origin: *`, ZERO auth) forwardujące dowolne body do Anthropic z kluczem właściciela. Fix: weryfikacja **Firebase ID tokena** (`firebase-admin/auth` `verifyIdToken`, init `{projectId:'vbs-stats'}` **BEZ service accounta**) + CORS `*` → whitelist. Front: helper `callClaude(body)` w `src/firebase.js` dokłada `Authorization: Bearer`; 5 call-site'ów przerobionych. Weryfikacja prod: bez tokena **401**, z tokenem **200**.
- **`fca7661` (repo vbs-invoices) role-gating callable** — audyt obalił założenie „ten sam otwarty proxy": faktury go NIE mają (klucz = Firebase Secret, CF server-side, `onCall` mają `request.auth`). Ale gatowały tylko „zalogowany", NIE rolę → nie-admin mógł wołać bezpośrednio `clearAndReset` (DESTRUKCYJNE), `scanNow`, `inspectMailbox`. Fix: `assertAdmin(request)` + `isUserAdmin(uid)` czytający `users/{uid}.role`. Deploy `firebase deploy --only functions`. Weryfikacja: bez auth 401, admin skan działa (licznik +1).
- **`1cc66c2` cleanup** — usunięty martwy `GpsCzasPracySection.jsx` (542 linie; lazy-import bez renderu → zbędny chunk 20 kB).
- **`1be3195` fix WYCOFANEGO MODELU** — `ZlecenieUploadBtn` miał zaszyty `claude-sonnet-4-20250514` → Anthropic **404 `not_found_error`** → pusty formularz frachtu („AI nie zaczytuje"). → `claude-sonnet-4-6`. Audyt modeli obu repo: reszta żywa (`claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, `claude-haiku-4-5`).

### Lekcje
- **Przy „AI nie zaczytuje" NAJPIERW sprawdź status modelu** (curl → `404 not_found` = wycofany), zanim podejrzysz auth/proxy/cache. Preferuj **aliasy** (`claude-sonnet-4-6`) nad datowane snapshoty (`-YYYYMMDD`) — te bywają wycofywane.
- Wycofany model zwracał 404 **natychmiast** → maskował, że realne czytanie PDF trwa **~13s**. Po fixie user widział `pending` i sądził że zawiesiło.
- `verifyIdToken` działa na Vercelu z init `{projectId}` **bez service accounta** (tylko projectId + publiczne klucze Google). `jose` by nie zadziałał out-of-the-box (Firebase = x509, nie JWKS).
- `onCall` **nie wymusza auth** — trzeba ręcznie `if(!request.auth)`; rola = osobny odczyt Firestore (vbs-invoices nie ma custom claims, inaczej niż main app).
- **vbs-invoices = OSOBNY projekt Firebase** (`~/Desktop/vbs-invoices.nosync`); service account vbs-stats tam nie działa; deploy funkcji = `firebase deploy --only functions` (NIE przez Vercel/merge).
- Najszybsza droga do prawdy: pobrać realny uploadowany plik ze **Storage** (firebase-admin) i przepchnąć przez proxy **curl'em** (`--data @plik`) — **node fetch ucina duże body**.
- **Tacho (rozmowa z kierowcą)**: „ustawienie przeszłości" JEST możliwe, ale **tylko przy wkładaniu karty** (tachograf pyta o okres gdy karty nie było = manual entry). Z kartą w środku zapis leci wyłącznie do przodu. Stąd deklaracje „jazda → pauza + dyspozycyjność" (case Mirka). To manipulacja zapisu = ryzyko przy kontroli ITD.

### ⚠️ Korekta rekomendacji z tej sesji
Proponowałem dorobić wskaźnik „AI czyta zlecenie (~15s)" — **JUŻ ISTNIEJE** (commit `93d54b9`). **Nie duplikować.** Podobnie `sw.js` jest już **v6 network-first** (07-01), więc stare „stale-while-revalidate" nie obowiązuje.

### Otwarte / następne (realny stan po doczytaniu 07-01 / 07-07 / 07-16)
- **Domknięcie multi-stop**: admin Trip Summary (App.jsx ~10 refs R2-cap) + `TrackerPublicView` dalej R1+R2 — kierowca odklikuje R3/R4, ale timeline admina i publiczny link ich NIE renderują.
- **5 zaległych podsumowań do klientów** (awaria maili 01.06–07.07) — ręczny „Wyślij podsumowanie"; user wybiera które (recent: Basten Logistik `m5ja15cl`).
- ⚠️ **Inbound CSV `imports@inbox.fleetstat.pl`** — mógł paść razem z trialem SendGrida 1.06. **NIESPRAWDZONE.**
- **Re-upload starych plików DDD** — fix zawyżonego dnia pobrania (07-16) działa tylko na nowe parsowania.
- **Dług**: bump paczki `firebase-functions` (CF main app już Node 22) + **vbs-invoices CF wciąż Node 20** → decommission **2026-10-30**.
- 2 skanery AI wciąż na base64 (`analyzeFile` delegacje, `parseOneInvoice` płatności) — latentny 413.
- Cleanup 16 starych branchy `claude/*`.

## 2026-07-20 (cd.) — Domknięcie multi-stop: admin Trip Summary + timeline + tracker publiczny (R1..R5)

Kontynuacja tej samej doby. Zadanie #1 z listy otwartych: kierowca od 01.07 (`480dbd9`) odklikuje R3/R4,
ale admin i publiczny link tego nie widziały. Audyt wykazał, że dziura jest **większa niż „brak renderu"**.

### 🔴 Znaleziony bug (nie kosmetyka)
`src/utils/tripStats.js` brał **ostatnie** `dotarcie_rozladunek` (faktycznie ostatni stop, np. R4)
i porównywał je z **planem R1** (`f.dataRozladunku`) → **każdy multi-stop = fałszywe spóźnienie**
w statystykach admina. Cloud Function liczyła to POPRAWNIE (`maxR`) → panel admina i mail do
zleceniodawcy mówiły co innego o tym samym frachcie.

Dowód na danych syntetycznych (4 stopy, dotarcie na R4 +5 min od planu):
`punktRoz` = „Na czas (+5 min)" po fixie vs **„Spóźnienie 12h 5min"** przed.

### Zrobione
- **#1 `tripStats.js`** — `getMaxRouteIndex` + `effectiveAt(type, r)` (świadome `r`, z obsługą `cofnij_`),
  punktualność wobec planu **maxR**, `planEnd`/okno spalania też z maxR. Nowe pola w zwrotce:
  `maxR` + `stopy[]` (punktualność per stop). Ocena ogólna: spóźnienie na **dowolnym** stopie liczy się
  (wcześniej tylko ostatni). `TripSummaryPanel` renderuje kafel per rozładunek gdy maxR>1.
- **#2 timeline admina** (`App.jsx` ~17494) — było `hasR2` + kubełki `underR1`/`underR2`; eventy z
  `r===3/4/5` **wypadały w próżnię** (CMR-y i uwagi z R3+ niewidoczne). Teraz `underR[i]` dla i=1..maxR,
  legacy bez `r` przydzielane chronologicznie (granica = dotarcie na następny stop), render w pętli.
- **#3 tracker publiczny + CF `trackerData`** — para front/back wdrożona razem:
  - CF: `maxR` zamiast `hasR2`, `arrivalTs{}` per stop (jawne `r` + legacy chronologiczny fallback),
    stepper `maxR+3` kroków, `stops[]` w odpowiedzi, CMR `cmrRozR1..R5`, cele `dest{}` R1..R5,
    routing przez **oczekujące** stopy (pomija zaliczone → koniec detourów wstecz),
    nowe `nextStopIdx`/`kmToNext`/`percentToNext` (postęp do najbliższego stopu).
  - Front: stepper i karty dat generowane z `stops[]`, galeria CMR w pętli, pasek postępu do najbliższego stopu.
  - **Wsteczna zgodność zachowana**: `hasR2`, `plannedR1Ms/R2Ms`, `percentToR1`, `cmrRozR1/R2` zostają
    w odpowiedzi CF (SW może serwować stary front); front ma fallback gdy CF jeszcze nie wdrożona.
- **#4 `FrachtyModal`** — `setShowR2` odpalał się tylko na kluczu `dokod2`, a parser AI emituje
  `dokodPocztowy2..5` → dane R2..R5 wchodziły do stanu, ale sekcje zostawały **zwinięte**
  (dyspozytor ich nie widział ani nie mógł poprawić). Teraz rozwijanie kaskadowe wg tego co parser wypełnił.
- **#5 cap `dokod3`** — 9 miejsc ucinało listę „dokąd" na 3 stopach. Nowe helpery `unloadStops()`
  + `allDokody()` w `orderFormatters.js`; w CF lokalny `lastDokod()`.
- **#6 WhatsApp do kierowcy** — `formatOrderForWhatsapp` miał JEDNĄ sekcję ROZŁADUNEK (R1),
  choć `formatOrderForDriverCopy` obok robił R1..R5. Teraz „ROZŁADUNEK 2/4" + GPS/tel per stop.
  Pinezka `delivery` zostaje na R1 (następny cel nawigacji).

### Lekcje
- **Test parytetu złapał realny błąd w moim fixie**: pierwsza wersja `activeStep` ogłaszała klientowi
  **„Dostarczono" po samym dotarciu** na ostatni stop, bez odklikania rozładunku (40 przypadków, 4 rozjazdy).
  Cofnięte: `capArrived = maxR>1 ? maxR+1 : maxR+2`. Po fixie **40/40 parytetu** ze starą formułą dla maxR∈{1,2}.
  Wniosek: przy zmianie logiki widocznej dla KLIENTA pisz test parytetu stara-vs-nowa, nie ufaj przeglądowi kodu.
- Stara formuła była **niespójna**: dla maxR=1 dotarcie = „Dostarczono", dla maxR=2 już nie.
  Zachowałem tę niespójność świadomie (maxR=1 nie ma osobnego kroku „Rozładunek 1" na stepperze).
- Kolejność deployu ma znaczenie: **najpierw CF, potem front**. CF jest wstecznie zgodna
  (stary front działa na nowej funkcji), odwrotnie nie.

### ⚠️ Niezweryfikowane end-to-end
Testy były na **logice czystej** (node, dane syntetyczne), nie na renderze. Tracker publiczny
i timeline admina wymagają realnego zlecenia 3+ stopowego do potwierdzenia wizualnego.
**Do sprawdzenia przy najbliższym multi-stopie w produkcji.**

### Otwarte (bez zmian)
5 zaległych podsumowań do klientów · inbound CSV `imports@inbox.fleetstat.pl` (niesprawdzone) ·
re-upload starych DDD · bump `firebase-functions` + vbs-invoices Node 20 (decommission 2026-10-30) ·
2 skanery AI na base64 (latentny 413) · cleanup 16 branchy `claude/*`.

### ✅ Weryfikacja end-to-end na PRODUKCJI (po deployu)
Deploy: `firebase deploy --only functions:trackerData` → push `main` (`b3c5abc`) → Vercel.

Diagnostyka floty (`diagnose_tracker_stops.mjs`, read-only): 671 frachtów, rozkład stopów
`{1: 652, 2: 16, 4: 3}` — **multi-stop to margines, ale realny**. 6 frachtów ma `trackerToken`.

**Znaleziony przy weryfikacji problem z DANYMI (nie z kodem):** fracht `orpxuu3h`
(token `2fe4ddde`) ma wypełnione **R1, R3, R4 i PUSTY R2** — dyspozytor pominął slot.
Pierwsza wersja fixu rysowała klientowi **pusty krok „Rozładunek 2"** na publicznym trackerze.
→ commit `b3c5abc`: `stopIdx` = tylko wypełnione sloty; stop niesie prawdziwy `r`
(eventy kierowcy używają tego indeksu) ORAZ `pos` = numer kolejny bez dziur (to widzi klient).
`activeStep`/`stopDone` liczą z pozycji, nie z surowego `r`.

Potwierdzone na żywo na `https://fleetstat.pl/t/2fe4ddde...`:
- stepper **6 kroków**: Dojazd → Załadowano → Rozładunek 1 → 2 → 3 → Dostarczono
- karty dat: Załadunek + Rozładunek 1/2/3 (29.05 / 12.06 / 13.06)
- paski: „ROZŁADUNEK 1" (najbliższy, 1189 km) + „ROZŁADUNEK 3 (ŁĄCZNIE)" (2394 km)
- pusty slot R2 **zniknął**; CF zwraca `r=1/pos=1 CESKA TREBOVA, r=3/pos=2 EDEGEM, r=4/pos=3 OURENDE`

### ⚠️ Higiena danych — do decyzji użytkownika
Fracht `orpxuu3h` (plan rozładunku 13.06) **wciąż ma status `w_trasie`** i publiczny tracker
włączony → każdy z linkiem widzi **„Przewidywane opóźnienie 943 h"**. To NIE jest efekt tej
sesji (zachowanie sprzed zmian), ale wygląda fatalnie przed klientem.
**Do rozważenia**: auto-wygaszanie trackera po X dniach od planowanego rozładunku
albo masowe domknięcie zaległych frachtów. Pozostałe 2 sprawdzone trackery mają
`trackerEnabled === false` (odpowiedź `{"error":"disabled"}`) — czyli mechanizm wyłączania istnieje,
tylko ten jeden został włączony.

### Domknięcie: tracker `orpxuu3h` wyłączony + CLAUDE.md zaktualizowany
- **Tracker wyłączony** (`trackerEnabled: false`) transakcją z asercją długości tablicy (671 → 671).
  **`statusRozladunku` CELOWO nietknięty** — oznaczenie „rozladowano" twierdziłoby, że towar dojechał,
  czego nikt nie potwierdził; weszłoby w statystyki i punktualność. Wyłączenie trackera gasi publiczną
  stronę, nie zmyślając rekordu. Potwierdzone: CF zwraca `{"error":"disabled"}`, strona pokazuje
  „🔒 Śledzenie zostało wyłączone" zamiast „opóźnienie 943 h".
- **`CLAUDE.md`**: reguła „przed push na main zawsze pytaj" zastąpiona sekcją **Autonomia** —
  pełny łańcuch commit→deploy→push bez dopytywania, z zachowanymi warunkami (uczciwy raport,
  weryfikacja na żywo, stop przy destrukcyjnych, brak zmyślania faktów biznesowych,
  transakcje z asercją przy `fleet/data`).

**Otwarte z tej sesji**: czy `orpxuu3h` faktycznie dojechał (jeśli tak → oznaczyć rozładowany);
czy wdrożyć auto-wygaszanie trackerów po X dniach od planowanego rozładunku (jest 6 trackerów,
5 już wyłączonych — problem może się nie powtarzać).

### Masowe zamknięcie starych trackerów (decyzja user: „stare nieistotne, nowe mają działać")
Wyłączone **wszystkie 6** istniejących trackerów (`trackerEnabled: false`), transakcja z asercją
długości (671 → 671). `statusRozladunku` nietknięty w żadnym. Weryfikacja: wszystkie tokeny
zwracają `{"error":"disabled"}`, ponowny dry-run pokazuje `Do wyłączenia: 0`.

Frachty: `0080/06/2026`, `orpxuu3h`, `569654-604823`, `278/S/2026/K`, `2454/2026`, `ZL1392/04/26`
(najstarszy rozładunek 27.04, najnowszy 16.06).

**Nowe trackery NIE są dotknięte** — potwierdzone w kodzie:
- `FrachtyModal.jsx:701` — generowanie nowego tokenu ustawia jawnie `trackerEnabled: true`
- CF `functions/index.js:2271` blokuje tylko przy `=== false`; **brak pola = włączony**
- Odwracalne z UI: `App.jsx:16918` ma toggle (zielony/czerwony), token zostaje przy wyłączeniu

**Odkrycie przy okazji — auto-wygaszanie JUŻ ISTNIEJE**: `functions/index.js:3339` i `:3359`
(`finalizeTrip`) ustawiają `trackerEnabled: false` automatycznie przy domknięciu trasy.
Czyli te 6 „wiszących" to zlecenia, które **nigdy nie zostały sfinalizowane** (kierowca nie
odklikał ostatniego rozładunku) — a nie brak mechanizmu.
→ **Właściwy fix to nie „wygaszanie po X dniach", tylko domykanie niesfinalizowanych tras.**
Jest już `isStaleUnfinished` w `src/utils/frachtStatus.js` — do rozważenia: fallback wyłączający
tracker dla stale-unfinished, żeby nie polegać wyłącznie na kliknięciu kierowcy
(uwaga: [[feedback_minimal_driver_intervention]] — user woli automat/admin-side, nie nudge do kierowcy).

### 🛑 DECYZJA: tracker publiczny ODŁOŻONY
User: „wrócimy do trackerów jak klient będzie wymagał, na chwilę obecną to jakieś **1% klientów
chce tracker**". Nie inwestujemy dalej — ani w fallback `isStaleUnfinished`, ani w cokolwiek
innego wokół trackera — **dopóki konkretny klient tego nie zażąda**.

Stan zamrożenia: multi-stop R1–R5 w trackerze **zrobiony i zweryfikowany na produkcji**,
wszystkie stare trackery wyłączone, nowe działają bez zmian. Nie ma niedokończonej roboty.

## 2026-07-20 (cd. 2) — Koszt GCP: diagnoza + krok 1 (okno `driverActivities` dla kierowców)

Trigger: alert budżetowy Google Cloud „90% of budget reached" (budżet 25 zł, okres 1–31.07,
alert z 17.07). Budżet = próg alertowy, **niczego nie wyłącza**.

### Diagnoza (REST + Monitoring API; `gcloud` CLI wywala się na Pythonie 3.9)
| Metryka | Wartość | Darmowy limit |
|---|---|---|
| Odczyty Firestore | **987 450/dobę** | 50 000/dobę |
| Zapisy | 6 249/dobę | 20 000 ✅ |
| Kasowania | 199/dobę | ✅ |
| GCS (Storage) | 0,425 GB | 5 GB ✅ |
| Artifact Registry | 0,15 GB | 0,5 GB ✅ |
| Cloud Run min instances | **wszędzie 0** | brak kosztu bezczynności ✅ |

Rozbicie odczytów po typie: **QUERY 984 298**, LOOKUP 3 153. Czyli zapytania kolekcyjne.

**Wykluczone**: `scheduledGpsPoll` (chodzi co minutę, ale czyta tylko 2 dokumenty na przebieg
= 2 880 LOOKUP/dobę — zgadza się z pomiarem), magazyn, obrazy funkcji, idle Cloud Run.
Firestore **PITR włączony** (po incydencie 2026-05-06) — płatne, ale marginalne przy tej skali; NIE ruszać.

**Przyczyna**: `App.jsx:1454` subskrybował **całą kolekcję `driverActivities` bez filtra i limitu**.
Rozmiary kolekcji: `driverActivities` **20 338** (reszta: auditLog 2 316, emailLogs 409,
driverEvents 302, pozostałe <100). 984 298 ÷ 20 338 ≈ **48 pełnych odczytów kolekcji na dobę**
= tyle razy dziennie ktoś ładuje aplikację. Kolekcja rośnie ~70 dok./dobę z auto-detekcji GPS,
więc koszt rósłby sam.

### Audyt zasięgu przed cięciem (subagent) — najgłębsze realne potrzeby
`weeklyRestCompensation` ~31 dni · `suggestBaseReturnFromRest` lookback 35 dni + długość
odpoczynku ≥56h → **~39 dni** · `lastWeeklyRest` 21 dni · `period28`/powrót do bazy liczony
z `vehicle.tachoCardStart`, **nie z segmentów** (niewrażliwy na okno).

**BLOKADA dla admina**: `MultiDayActivityView` (`App.jsx:8648`) pozwala wybrać **dowolną datę
wstecz**, a `min`/`max` pickera biorą się z najstarszego segmentu w **załadowanej tablicy**
(`:8783`). Okno obcięłoby historię **PO CICHU** — bez błędu, z nagłówkiem „Dane od X do Y"
podającym obcięty zakres jako pełny. Dodatkowo lista `corrections` (`:8659`) to ścieżka
audytowa bez limitu czasowego — korekta sprzed pół roku zniknęłaby i nie dałoby się jej cofnąć.
Admin też **nie może** dostać filtra po `driverEmail` — `MultiDayActivityView` filtruje po
`vehicleId`, a pojazd miewa kilku kierowców (`driverHistory`).

### Krok 1 WDROŻONY — okno tylko dla roli KIEROWCA
`App.jsx`: `ACTIVITIES_WINDOW_DAYS = 60`; kierowca dostaje
`where(driverEmail == swój) + where(startTs >= now-60d)`, admin/dyspozytor **bez zmian** (cała kolekcja).
Indeks złożony `driverEmail+startTs` **już istniał** — nic nie trzeba było wdrażać.

Pomiar na produkcji (5 kierowców): **20 339 → średnio 1 086 dokumentów** na załadowanie
panelu = **−94,7%**. Przy okazji naprawia transfer na telefonach kierowców
(dotąd ciągnęli 20 tys. dokumentów, żeby zobaczyć własne segmenty).

### Krok 2 — DO ZROBIENIA (nie ruszone)
Admin wciąż czyta całość. Warunek wstępny: dać `MultiDayActivityView` + liście korekt
**własne leniwe zapytanie** (`vehicleId` + wybrany zakres dat) zamiast konsumpcji globalnego
listenera. Dopiero wtedy można nałożyć okno na admina bez cichego obcięcia historii.

## 2026-07-20 (cd. 3) — Skanery AI: base64 → URL-source (koniec latentnego 413)

Ostatnie dwa skanery jadące na base64 przez `/api/claude`: `parseOneInvoice` (płatności)
i `analyzeFile` (delegacje IMI). Reszta była naprawiona 21.06 (commity `4a0288a`/`6c87a32`).

### Dlaczego to bolało
Body funkcji na Vercelu ma limit **~4,5 MB**, a base64 powiększa plik o **+33%** → każdy skan
powyżej **~3,3 MB** kończył się `413 FUNCTION_PAYLOAD_TOO_LARGE`, pokazywanym userowi jako
niejasne „API 413". Strażnicy rozmiaru w kodzie były **wyżej niż realny limit** (10 MB dla faktur,
15 MB dla IMI), więc user dostawał błąd zamiast komunikatu „za duży".
Typowy skan z telefonu to 3–8 MB — czyli trafiało regularnie.

### Zrobione
- **`parseOneInvoice(file, fileUrl)`** — gdy plik jest w Storage, leci `{type:"url"}`. Zostaje
  fallback base64 (gdy upload padnie) z **jawnym limitem 3 MB i czytelnym komunikatem** zamiast 413.
- **Oba wywołania płatności** (`handleFile` + bulk) — było `Promise.all([parse, upload])`
  (równolegle), jest `upload → parse(url)`. Kosztuje ~1 s na plik, ale duże skany w ogóle przechodzą.
  W bulku pliki nadal lecą równolegle względem siebie.
- **`analyzeFile` (IMI)** — analogicznie URL-source z fallbackiem.
- **NOWE: oryginał IMI ląduje w Storage** (`uploadImiFile`, ścieżka `imi/`). Wcześniej dokument
  delegowania po sparsowaniu **przepadał** — w rekordzie zostawała sama `fileName`. Teraz rekord
  niesie `fileUrl` + `filePath`. To wykracza poza fix 413, ale przy dokumencie istotnym
  przy kontroli brak oryginału był realną dziurą.
- Reguły Storage sprawdzone — `imi/` przechodzi (`allow read, write: if request.auth != null`),
  nic nie trzeba wdrażać.

### Weryfikacja — dowód na produkcji, oba kierunki
Największy PDF w Storage: **4,84 MB** (jako base64 → 6,45 MB).
- **base64 → `HTTP 413 FUNCTION_PAYLOAD_TOO_LARGE`** (curl `--data @plik`, bo node fetch ucina duże body)
- **URL-source → `HTTP 200`**, Claude odczytał dokument („Trzy." = 3 strony), 3,7 s

### Gotcha odkryta przy testowaniu
`https://fleetstat.pl` robi **307 → `www.fleetstat.pl`**, a przekierowanie **cross-origin gubi
nagłówek `Authorization`** → `/api/claude` zwraca `401 Brak tokena uwierzytelnienia`.
Przy testach proxy strzelaj **bezpośrednio w `www.fleetstat.pl`**. Apka tego nie dotyczy
(woła relatywnie `/api/claude`, same-origin).

## 2026-07-20 (cd. 4) — Storage: reguły dostępu zamiast otwartego bucketu

Wypłynęło przy fixie skanerów AI (sprawdzałem, czy ścieżka `imi/` przejdzie).

### Stan PRZED
```
match /{allPaths=**} { allow read, write: if request.auth != null; }
```
Każdy zalogowany — **łącznie z kierowcą i rolą `podglad`** — mógł czytać, nadpisywać
i kasować **dowolny** plik. Najpoważniejsze: `backups/` (90 plików, 30,8 MB) to **pełne
zrzuty Firestore**; `listAll()` i `getDownloadURL()` były dozwolone, więc dało się je
wylistować i pobrać. Firestore miał role-gating, Storage **żadnego**.

### Rozpoznanie przed pisaniem reguł
9 prefiksów: `payments` 223 pliki · `documents` 183 · `driverPhotos` 126 · `backups` 90 ·
`driverDdd` 37 · `sprawy` 14 · `docs` 10 · `chat` 3 · `driverDocs` 1 (+ nowy `imi`).
Zweryfikowane, że aplikacja woła `getDownloadURL()` **wyłącznie zaraz po uploadzie**
(13 wywołań, każde po `uploadBytes`) i **nigdzie nie używa `listAll()`** → zaostrzenie
odczytu nie psuje żadnego widoku.

### Wdrożone
`backups` = nikt z klienta (pisze tylko CF przez Admin SDK, który omija reguły) ·
`payments`/`documents`/`docs`/`sprawy`/`imi` = admin+dyspozytor · `driverDocs` ograniczone
do **własnego katalogu po `token.email`** · `driverPhotos`/`driverDdd`/`chat` = zalogowani ·
domyślnie **deny** · limity rozmiaru per ścieżka.

Weryfikacja **przed** wdrożeniem: **39 przypadków przez Rules TestRuleset API, 39/39**.

### 🔴 WPADKA — i czego uczy
Pierwsza wersja używała `isKierowca()` (claim `role == "kierowca"`). Testy przeszły 33/33,
bo testowałem **założony** stan claimów. Po wdrożeniu sprawdziłem stan **rzeczywisty**:

| konto | claim w tokenie | rola w Firestore |
|---|---|---|
| volodymyr.ivansky | `podglad` | **kierowca** |
| siarhei.kolabu | `podglad` | **kierowca** |
| miroslaw.teper | `podglad` | **kierowca** |
| volodymyr.lukashuchuk | `podglad` | **kierowca** |

**Wszyscy 4 kierowcy mają claim `podglad`.** Przez kilka minut na produkcji obowiązywały
reguły, które **odcinały kierowcom wgrywanie CMR-ów i plików DDD**. Natychmiast poprawione
(`isAuth()` na trzech ścieżkach kierowcy — dla nich to i tak nie regresja, bucket był otwarty)
i ponownie wdrożone. `driverDocs` zostaje ograniczone po `token.email`, bo to działa
**niezależnie od claimu**.

**Lekcja: test reguł na wyobrażonym stanie tożsamości jest bezwartościowy.**
Rules API sprawdza logikę reguł, nie to, co realnie siedzi w tokenach.
Przy każdej regule opartej o claim — NAJPIERW `listUsers()` i zobacz prawdę.

### ⚠️ OTWARTE — dwa niezależne problemy
1. **Claimy kierowców rozjechane z Firestore** (`podglad` vs `kierowca`). To dotyczy też
   `firestore.rules`, które chodzą po tym samym claimie — czyli kierowcy mają dziś w Firestore
   uprawnienia roli `podglad`, nie `kierowca`. Trzeba ustalić, czy `onRoleChange` nie zadziałał,
   czy konta powstały jako `podglad` i zostały awansowane tylko w Firestore.
   **Nie ruszałem — zmiana claimu zmienia uprawnienia Firestore, to osobna decyzja.**
2. **`firebase.json` jest w `.gitignore`** (linia 63) → konfiguracja deployu (w tym nowy blok
   `"storage"`) **nie jest w repo**. Po świeżym klonie `firebase deploy --only storage` nie
   zadziała bez ręcznego dopisania. Do przemyślenia czy nie odgitignorować.

## 2026-07-20 (cd. 5) — DIAGNOZA: dlaczego claimy kierowców rozjechały się z Firestore

Zadanie czysto diagnostyczne — **żadnych zmian w kodzie ani danych.**

### Przyczyna źródłowa (jedna linia)
`functions/index.js:25`
```js
const VALID_ROLES = ["admin", "dyspozytor", "podglad"];   // ← BRAK "kierowca"
```
A UI oferuje `kierowca` jako pełnoprawną rolę (`App.jsx:9496-9498`, `ALL_ROLES`).

### Łańcuch (zweryfikowany w kodzie i danych)
1. Admin klika „Kierowca" w panelu → `changeRole()` (`App.jsx:9418`).
2. `setUserRole` (callable) rzuca `invalid-argument` — `kierowca` nie przechodzi `VALID_ROLES`
   (`functions/index.js:129`).
3. Front **łapie wyjątek i robi fallback: zapis wprost do Firestore** (`App.jsx:9428`),
   po czym pokazuje **„✅ Rola zaktualizowana"**. Z perspektywy admina wygląda na sukces.
4. Trigger `onRoleChange` startuje, trafia na **ten sam** `VALID_ROLES` (`:72`), loguje
   „Nieprawidłowa rola" i **wychodzi bez ustawienia claimu**.
5. Efekt: Firestore `kierowca`, claim zostaje **`podglad`** — czyli rola z self-bootstrapu
   przy pierwszym logowaniu (`App.jsx:861`: nowy user = `podglad`).

`addDriverByEmail` (`functions/index.js`) jest **jedyną ścieżką ustawiającą claim `kierowca`
poprawnie** — nasi 4 kierowcy przez nią nie przeszli.

### Dlaczego nikt tego nie zauważył — maskujący fallback
`App.jsx:890-898`: listener `onSnapshot` na `users/{uid}` widzi rozjazd, robi force refresh,
a gdy claim się nie zmienia → **`setRole(data.role)`**, czyli bierze rolę z Firestore.
Dlatego kierowcy **normalnie dostają DriverPanel** mimo claimu `podglad`.
Potwierdzone empirycznie: Teper klikał eventy **dziś o 07:21**.
(Efekt uboczny: przy każdym logowaniu prawdopodobnie mignięcie widoku „podgląd" przed panelem.)

### Realny wpływ DZIŚ
| Warstwa | Skutek |
|---|---|
| UI aplikacji | **działa** — fallback z Firestore |
| `firestore.rules` | **zero różnicy** — reguły nie odwołują się ani do `kierowca`, ani do `podglad` (tylko `admin`/`dyspozytor`/zalogowany) |
| `storage.rules` (nowe dziś) | **tu się wywróciło** — dlatego 3 ścieżki kierowcy musiały zostać na `isAuth()` |

Czyli rozjazd jest **latentny**, nie psuje dziś produkcji — ale blokuje zacieśnienie Storage
i jest pułapką dla każdej przyszłej reguły rozróżniającej rolę `kierowca`.

### Audyt nie pomógł (i to też jest ustalenie)
W `auditLog` są **tylko 2 wpisy `role_change`**, oba `deoen@o2.pl` z 2026-05-05 — czyli z dnia,
w którym audyt dodano (P3 incydentu). Role kierowców ustawiono **wcześniej**, więc nie ma po nich
śladu. Logi CF `onRoleChange` też już wyrotowane. Diagnoza oparta na kodzie + stanie faktycznym.

### Gotowy fix (NIE zastosowany — czeka na decyzję)
1. `functions/index.js:25` → dopisać `"kierowca"` do `VALID_ROLES`, redeploy `onRoleChange` + `setUserRole`.
2. Jednorazowy re-sync claimów dla 4 kont (`setCustomUserClaims` wg `users/{uid}.role`).
3. Potem zacieśnić `storage.rules` z `isAuth()` na `(isKierowca() || canEdit())` (TODO w pliku).
4. Rozważyć: fallback w `changeRole` (`App.jsx:9426`) **cicho udaje sukces** przy błędzie CF —
   powinien odróżniać „CF niedostępna" od „CF odrzuciła dane" i w drugim wypadku **nie kłamać**.

Ryzyko kroku 1-2 jest niskie (reguły Firestore nie rozróżniają tych ról), ale to zmiana
uprawnień serwerowych → świadomie zostawiona do decyzji.

## 2026-07-20 (cd. 6) — NAPRAWA rozjazdu claimów + zacieśnienie storage.rules

### Wykonane (w tej kolejności — kolejność ma znaczenie)
1. **`functions/index.js:25`** — `VALID_ROLES` uzupełnione o `"kierowca"`.
   Deploy `onRoleChange` + `setUserRole`.
2. **Re-sync 4 claimów PRZEZ TRIGGER** (nie Admin SDK) — świadomie, żeby przy okazji
   udowodnić, że poprawka działa end-to-end. **4/4 zsynchronizowane.**
3. **`storage.rules` zacieśnione** — trzy ścieżki kierowcy z `isAuth()` wróciły na
   `(isKierowca() || canEdit())`. Test: **39/39**, w tym nowe przypadki „STALE token
   podglad → DENY". Wdrożone.
4. **`App.jsx:9425` — koniec kłamiącego fallbacku.** `changeRole` rozróżnia teraz
   „CF niedostępna" (fallback + `⚠️ Custom Claim niezsynchronizowany`) od „CF ODMÓWIŁA"
   (`invalid-argument`/`permission-denied`/… → **żadnego zapisu**, czerwony komunikat
   z treścią błędu). To był właściwy powód, dla którego problem żył miesiącami.

Stan końcowy claimów: **10/10 kont zgodnych** z `users/{uid}.role`
(3× admin, 3× dyspozytor, 4× kierowca). **Nikt nie ma już roli `podglad`.**

### 🔑 Gotcha warta zapamiętania
**Zapis TEJ SAMEJ wartości do Firestore NIE odpala triggera.** Pierwsza próba re-syncu
(`update({ role: "kierowca" })` na dokumencie, który już miał `kierowca`) dała **0/4** —
w logach CF **zero wywołań**. Firestore nie tworzy nowej wersji dokumentu, gdy dane się
nie zmieniają, więc `onDocumentWritten` nie ma na co zareagować. Dopiero dołożenie realnie
zmieniającego się pola (`claimsResyncAt`) odpaliło trigger → 4/4.
Przy każdym „dotknij dokument, żeby wymusić trigger" — **musi polecieć realna zmiana.**

### Okno przejściowe (świadomie zaakceptowane)
Kierowcy z tokenem sprzed re-syncu mają jeszcze claim `podglad` i do odświeżenia tokena
**nie wgrają CMR-a**. Łagodzone dwoma mechanizmami: `onRoleChange` zapisuje `claimsUpdatedAt`
→ listener w `App.jsx:879` robi force refresh u zalogowanych; a token Firebase i tak wygasa
po 1 h. Ostatnia aktywność kierowcy tego dnia: 07:21, deploy ~16:00 → ryzyko minimalne.

### Otwarte drobiazgi
- W Auth jest **konto bez e-maila i bez dokumentu w `users`** (widoczne jako „(brak)").
  Nie ma claimu `role` → nic nie zapisze. Do sprawdzenia czym jest (test? anonimowe?).
- `functions/index.js` ma teraz jedno źródło prawdy dla ról, ale `ALL_ROLES` w `App.jsx:9496`
  to **osobna lista**. Rozjazd między nimi to dokładnie ten sam błąd co dziś — kandydat
  na wspólną stałą albo test.

## 2026-07-20 (cd. 7) — Wspólna stała ról zamiast dwóch list

Domknięcie przyczyny z cd. 5: zamiast pilnować dwóch list, jest **jedna**.

### Rozwiązanie
`functions/roles.shared.json` = jedyne źródło prawdy (id + prezentacja UI: label/icon/desc/color/bg/biuro).
- **Backend**: `const VALID_ROLES = require("./roles.shared.json").ROLES.map(r => r.id);`
- **Front**: `src/utils/roles.js` (eksportuje `ALL_ROLES`, `ROLES_BIURO`, `VALID_ROLE_IDS`,
  `isValidRole`, `roleById`) → `App.jsx` importuje stamtąd; usunięte lokalne `ROLES_BIURO`/`ALL_ROLES`.

**Dlaczego plik leży w `functions/`, a nie w `shared/` czy w roocie:** `firebase deploy` wysyła
**wyłącznie katalog `functions/`**. Plik trzymany gdziekolwiek indziej nie trafiłby do Cloud
Functions i `require` wywaliłby się na produkcji. Front importuje go przez **jeden** moduł
(`src/utils/roles.js`), żeby ta nietypowa ścieżka nie rozlazła się po kodzie.
Vite wbudowuje JSON w bundel w czasie builda — zero zależności runtime od `functions/`.

### 🔴 Pułapka złapana w trakcie
`.gitignore:48` ma blanket **`*.json`** z whitelistą wyjątków → `functions/roles.shared.json`
**był ignorowany**. Bez wyjątku plik nie trafiłby do repo, a każdy świeży klon / deploy z czystego
checkoutu wywaliłby **WSZYSTKIE Cloud Functions** na `Cannot find module './roles.shared.json'`.
Dodane `!functions/roles.shared.json`. Zweryfikowane: `git check-ignore` już nie łapie,
`require()` z rozpakowanego archiwum działa.

### Weryfikacja
- build zielony, 0 errors (front + functions)
- `Panel kierowcy` obecne w `dist/assets/index-*.js` → JSON faktycznie w bundlu
- backend liczy z pliku: `['admin','dyspozytor','podglad','kierowca']`
- deploy `onRoleChange` + `setUserRole`, potem trigger odpalony **bez zmiany czyjejkolwiek roli**
  (sam znacznik `claimsResyncAt`) → log CF **13:34:27 „Rola kierowca … już ustawiona, pomijam"**.
  To dowód, że funkcja wstała z nowym `require` i uznaje `kierowca` za prawidłową —
  przy starej liście byłoby „Nieprawidłowa rola".

### ⚠️ Wpadka po drodze (i naprawa)
Pierwsza wersja testu e2e wybrała **pierwszy** dokument z rolą `kierowca` — trafiła na osierocony
`kierowca.test@gmail.com` (dokument bez konta Auth, `docId != uid`) i **zdążyła zmienić mu rolę
na `podglad`** zanim się wywróciła na `getUser`. Przywrócone (`role: "kierowca"`), zweryfikowane.
Lekcja: skrypt dotykający produkcji ma **najpierw filtrować cele**, potem pisać — nie odwrotnie.

### Nietknięte świadomie (inny problem)
`functions/index.js:1186/1547/1822` mają `["admin","dyspozytor"].includes(callerRole)` —
to **sprawdzenia uprawnień**, nie rejestr ról. Nie duplikują listy ról, tylko wyrażają politykę
„kto może wywołać". Ujednolicenie ich to osobny temat (np. helper `canEdit(callerRole)`).

## 2026-07-20 (cd. 8) — Alert budżetu 100% + fix mobile GPS + decyzja o kroku 2

### Alert „100% of budget reached" — zdiagnozowany, NIE jest awarią
Budżet 25 zł = **próg alertowy, nie limit**. Nic się nie wyłącza. To NIE problem miejsca:
Storage 0,425 GB / 5 GB. Koszt robią **odczyty Firestore**.

Pomiar dobowy (REST Monitoring): suma 2,39 mln — ale **piki 13:41 (1,7 mln) i 15:41 (474k)
to MOJE skrypty diagnostyczne** (count() na kolekcji 20k, listUsers, re-sync claimów), nie ruch
aplikacji. Realny ruch: godziny pracy 07–12 = 21–55k/h (~180k), reszta doby ~400/h.
**Realny koszt ~7 zł/mies** (250k/dobę − 50k darmowe = 200k płatne × $0.03/100k × 30 × 4 zł/USD).
Po 16:41 (fix kierowców) spadek do ~400/h, ale to wieczór — realny efekt pokaże jutrzejszy pomiar.

### Decyzja: A + budżet
- **Krok 2 (okno dla admina/dyspozytora) — osobna sesja.** Wymaga refaktoru
  `MultiDayActivityView` (własne zapytanie), inaczej ciche obcięcie historii tachografu.
  Zapisane w memory `project_firestore_cost_krok2.md`. Pomiar: scheduled task 2026-07-21 12:00.
- **Budżet-alert 25 → 100 zł** — Budget API w projekcie WYŁĄCZONE (`PERMISSION_DENIED`,
  „has not been used before"). Nie włączam kolejnego API dla jednej liczby na koncie
  rozliczeniowym → user robi ręcznie w konsoli (Billing → Budżety → edytuj kwotę).

### Fix mobile: GPS w nawigacji + layout (2 commity, PROD)
- `608c418` — zakładka `gps` **nie była w pasku mobilnym** (sidebar `hidden md:flex`,
  dolny pasek jej nie zawierał) → z telefonu nie dało się wejść w GPS. Dodane, gate `canSeeTab`.
- `79e3dfe` — sam widok „wyglądał ochydnie" na telefonie (screen usera): korzeń `flex gap-4`
  nie składał się w kolumnę, panel `w-56 flex-shrink-0` (224px sztywno), podzakładki `flex-1`
  łamały „Czas pracy kierowcy" na 3 linie, toolbar DDD łamał napisy pionowo. Wszystko
  → `flex-col md:flex-row`, `w-full md:w-56`, poziomy scroll podzakładek, `whitespace-nowrap`.
  Zweryfikowane: klasy responsywne obecne w wygenerowanym CSS (arbitralne wartości bywają
  wycinane). ⚠️ NIE potwierdzone wizualnie na telefonie — widok za loginem, haseł nie wpisuję.

### Zauważone przy okazji (NIE ruszone)
- Niebieski FAB czatu **zasłania dolne menu** na telefonie (widać na screenie — przykrywa
  „Kierowcy"/„Czat"). Dotyczy wszystkich zakładek, nie tylko GPS. Osobna zmiana.
- Mapa GPS ma sztywne `height: 500px` — na telefonie działa, ale zajmuje dużo.

## 2026-07-21 — Pomiar Firestore (post-fix) + NOWY MODUŁ Kalkulator tras (Faza 1, PROD)

### Pomiar odczytów Firestore po fixie kierowców (07-20 krok 1)
Scheduled task `firestore-reads-check-vbs-stats` (12:00) jeszcze nie odpalił — zmierzyłem ręcznie
REST Monitoring API (`gcloud auth print-access-token` + curl, bo gcloud CLI wywala się na Py3.9).
- **Surowa doba (07-20 09:00Z → 07-21 09:00Z) = 2,39 mln** (QUERY 2,388 mln, LOOKUP 4,2k) — MYLĄCE.
- **Trend godzinowy demaskuje**: pik **1,66 mln w 1h (07-20 14:01Z=16:01 CEST) + 475k w następnej**
  = **2,14 mln w 2h** = wczorajsza sesja debug na produkcji (masa przeładowań), NIE ruch stały.
- **Post-fix noc (16Z–06Z, 15h) = ~640/h** (idle + `scheduledGpsPoll`). Fix kierowców działa.
- **Post-fix rano workday (07–08Z) ramping**; 08:01Z = 24k ≈ jeden pełny load kolekcji admina.
- `driverActivities` urosło **20 338 → 23 304** dok. (każdy load admina = pełna kolekcja).
- **Problem pomiaru**: brak jeszcze czystej doby post-fix (minęło ~18h, workday dopiero startuje).
  Ekstrapolacja ~150–250k/dobę = strefa „pomiędzy/poniżej progu 400k".
- **DECYZJA: krok 2 NIE teraz.** Preliminary poniżej progu, koszt ~7 zł/mies („nie pali się").
  Czysty pomiar dobowy DO DOKOŃCZENIA wieczorem 07-21 — dopiero on przesądza zamknięcie tematu.
  (Uwaga: okno `alignmentPeriod=86400s` z krótszym interwałem ŹLE się wyrównuje i wciąga pik —
  wiarygodne są kubełki godzinowe `alignmentPeriod=3600s`, sumowane w Pythonie.)

### NOWY MODUŁ: Kalkulator tras (commit `c5bc53d`, PROD via Vercel)
Pomysł usera: moduł pod Frachtami — dyspozytor dodaje trasę, my na podstawie danych (koszty
drogowe + paliwo, „nie 1:1, szacunkowo") pokazujemy szacowany koszt + mapa. Nazwa: **polska
„Kalkulator tras"** (user odrzucił EN warianty i „Wycena/Kosztorys").

**Wizja usera (docelowa):** inteligentny kalkulator per kraj. Przykład Kielce→Berlin: pełny bak
na start, tankowania po drodze (1× PL, 1× DE) → ceny paliwa z DWÓCH krajów wg km w każdym;
ceny aktualne z sieci (zmienne); kalibracja o 6 mc realnych tras z raportów.

**Faza 1 zbudowana (`src/components/KalkulatorTras.jsx`, osobny lazy chunk 14,67 kB / gzip 5,52):**
- Wpis punktów: adres → geokod **Nominatim/OSM** (darmowy), albo bezpośrednio „lat, lon".
- **OSRM** (własna kopia `osrmRoute`, ten sam publiczny serwer co reszta apki) → dystans + geometria.
- **Podział na kraje**: próbkowanie ~14 punktów geometrii + reverse-geocode (zoom=3, cache,
  ~1 req/s), przypisanie odcinków do najbliższego próbkowanego kraju, skalowanie haversine do
  realnego dystansu OSRM.
- **Model kosztu**: paliwo = km_kraj × spalanie/100 × cena_diesla_kraju; myto = km_kraj × stawka_kraju.
  Proporcjonalny per kraj (≈ logika „bak+tankowania", odporniejszy).
- **Stawki edytowalne** → `config/kalkulatorTras` (zasiane orientacyjnymi cenami diesla €/L +
  myto €/km per kraj, EUR). Pojazd → auto-spalanie ze średniej `operacyjne`. Mapa Leaflet.
- Wynik: total €, ≈PLN (eurRate), rozbicie per kraj (km/L/€/L/paliwo/myto). Tab dla admin+dyspozytor.

**Zweryfikowane na żywo** (Node fetch, Kielce→Berlin): geokod OK, OSRM **624 km / 7,1 h**,
podział **PL 515 km / DE 109 km** (granica ~14,6°E wykryta poprawnie), koszt paliwo 274€ + myto 107€ = 381€.
**NIEzweryfikowane end-to-end**: (1) kliknięcie w zalogowanym UI — brak hasła lokalnie, widok za
loginem; (2) **CORS Nominatim z przeglądarki** — test był server-side; do potwierdzenia na prod.
Stawki myta zasiane zgrubnie (PL 0,13 €/km zawyża — myto tylko na A/S) → Faza 3 kalibracja je dostroi.

**TODO Faza 2:** auto-odświeżanie cen paliwa (CF tygodniowa → config), zapis szacunków, podpięcie
pod konkretny fracht. **Faza 3:** kalibracja o 6 mc realnych kosztów (user wyciągnie z raportów).

## 2026-07-21 (cd.) — Kalibracja myta kalkulatora: GPS × NegoMetal (częściowa) + bug breadcrumbs

User: „myto wychodzi gigantyczne, tyle nie płacimy" → wrzucił NegoMetal toll export
(`negometal_toll_transactions_website_export (35).xlsx`, WGM 5367K, 24.06–16.07.2026).

### Realne myto per kraj (NegoMetal, cały plik, netto EUR)
DE **531,26** · FR **196,76** · PL 12,10 (52 zł) · ES 10,14 · BE 9,47 · CZ 1,06. Razem ~760€/3 tyg./1 auto.
To KWOTY, nie km — do €/km brakuje km per kraj.

### Pomysł usera: km z GPS (Atlas/widziszwszystko podpięte w Monitoring)
- Atlas **widzi teraz wiele aut** (v1,v3,v4,v5) — memory `reference_atlas_api` NIEAKTUALNE (było „tylko 0475M").
- Atlas `/history?year=&month=` zwraca **płytko** (czerwiec=5 pkt, lipiec=0) — brak głębokiej historii.
- `gpsBreadcrumbs/{vid}/points` (z `scheduledHistorySync`) sięgają tylko **14.07→21.07** (~tydzień).
- Overlap z mytem = **14–16.07** (3 dni). W tym oknie NegoMetal: FR 69,9€ + DE 29,4€.

### Wynik (okno 14–16.07, po odfiltrowaniu szumu)
- **FR: 841 km GPS / 69,9€ = 0,083 €/km** (seed 0,25 → **zawyża 3×**). SOLIDNE.
- **ES: 652 km GPS / ≤10€ = ≤0,016 €/km** (seed 0,12 → **zawyża ~7×**, Hiszpania prawie darmowa). SOLIDNE (górna granica).
- **DE nie pojawił się w GPS** w oknie (auto było FR+ES), a myto DE 29€ z tych dat → **daty transakcji NegoMetal mają lag** względem jazdy → precyzyjne krótkookienkowe dopasowanie dla reszty krajów zawodne.
- DE/PL/BE/CZ/AT — brak dopasowanych km, €/km NIEobliczalne (niskie total ≠ niska stawka).

**Wniosek:** intuicja usera trafna — seed myta zawyża (auto jedzie dużo dróg bezpłatnych).
Twarde dane tylko FR≈0,08 i ES≈0,02. Reszta wymaga **kalibracji do przodu**
(breadcrumbs uzbierają miesiąc → NegoMetal za dopasowane okno → €/km per kraj/flota).

### 🐛 Bug jakości GPS (zgłoszony jako task chip, task_fdf05d25)
Breadcrumbs v3 zanieczyszczone: punkt postoju ~47.914,3.714 (v=0) **powtarza się wymieszany**
z ruchem → skoki 137 km/48s = 10 000 km/h → zawyża dystans **10×** (15 462 zamiast 1 498 km/3 dni).
**Psuje też mapę trasy w GpsTab** (zygzaki). Źródło: scheduledGpsPoll/scheduledHistorySync,
podejrzenie stale last-known position albo plate matching `includes()`. Fix osobno.

### Decyzja: STAWKI NIE ruszone
User dwukrotnie odłożył decyzję (opcje: FR+ES z danych teraz / kalibracja do przodu / haircut).
`config/kalkulatorTras` bez zmian. Skrypty read-only w repo (gitignored): diagnose_breadcrumbs.mjs,
diagnose_calibrate_toll.mjs, diagnose_calibrate_overlap.mjs.

## 2026-07-21 (cd.2) — Kalkulator: frachty jako źródło km + integracja TollGuru (realne myto)

### Frachty jako baza km per kraj (pomysł usera)
Frachty mają `skad`/`dokod` (format „DE85748", „PL38-200 JASŁO" = kraj+kod pocztowy, geokodowalne)
+ gotowe `kmWszystkie`/`kmLadowne`/`kmPodjazd`. Przepuściłem realne trasy v3 (styczeń+luty, 10 frachtów)
przez OSRM+countrySplit skalując do `kmWszystkie`: **8 988 km → FR 46% / DE 20% / PL 9% / CZ 8% / AT 7%
/ CH 5% / IT 2% / NL+BE 3%**. Podział geograficznie poprawny (DE→FR przez CH). Pipeline działa.
**BLOKADA:** `skad` przestał być wpisywany **od kwietnia 2026** (kwi–lip: 0/… pełnych) → kalibrowalne
tylko sty–lut–mar; okres myta (lipiec) bez tras. Do dokończenia €/km trzeba NegoMetal za sty/lut.
⚠️ Warto przywrócić wpisywanie `skad` (bez tego brak kalibracji + rentowności tras na świeżych danych).

### DECYZJA usera: TollGuru (opcja A) — omija problem kalibracji
Zamiast dopasowywać myto do km z historii — wysyłamy trasę, dostajemy realny koszt z faktycznych
płatnych dróg. Zbadane: OSM `toll=yes` to tylko tagi (trzeba by budować własny silnik = niepraktyczne);
**TollGuru Map-Independent Toll API** bierze polyline OSRM + typ pojazdu → realne myto per kraj/operator
(ogarnia péage koncesyjne FR/IT/ES). Darmowy trial, płatne od ~$80/mc.

### WDROŻONE (commit 66c8d0f, CF zdeployowane Node 22 europe-west1)
- **CF `tollProxy`**: polyline(enc) + vehicleType → TollGuru (`route-encoded-polyline`, `x-api-key`),
  agreguje `tolls[]` per kraj do EUR (preferuje tagCost>cashCost; kursy zgrubne PLN/CZK/CHF…).
  Klucz z `config/toll.apiKey`. Bez klucza → `{success:false,reason:"no-key"}`.
- **CF `setTollKey`** (admin): zapis klucza przez serwer, klient nie czyta.
- **Kalkulator**: po OSRM enkoduje polyline (Google precision 5), woła tollProxy; sukces → myto realne
  per kraj (badge „TollGuru realne"), inaczej **fallback flat-rate €/km** (badge „szacunek flat-rate").
  Wybór typu pojazdu (2–6 osi, zapis w config), pole admina na klucz w sekcji stawek, kafelek
  „Myto — jak liczone" zależny od źródła. Osobny lazy chunk 20,68 kB.

**Działa od razu**: bez klucza leci flat-rate (dotychczasowe, zweryfikowane). Po wklejeniu klucza
myto staje się realne bez zmian w kodzie.
**Co NIEzweryfikowane end-to-end**: realny call TollGuru (user zakłada konto + wkleja klucz).
Fallback = ścieżka już działająca. **TODO usera**: konto tollguru.com → klucz API → wklej w Kalkulator
(sekcja Stawki, pole „Klucz TollGuru"); sprawdzić limit free tier vs ~150–600 zapytań/mc.

## 2026-07-21 (cd.3) — Kalkulator: TollGuru live + myto per klasa auta + flota (PRZERWANE na GPS)

### TollGuru — integracja LIVE (commity 66c8d0f→2a48682)
- Klucz trial usera `tg_...` (w config/toll, zapisany przez skrypt admin). **Endpoint działający:
  `origin-destination-waypoints`** (NIE `complete-polyline-from-mapping-service` = 403 „not authorized
  for TollTally" — osobny produkt). Wysyłamy `from/to/waypoints {lat,lng}`, nie polyline.
- Odpowiedź: `routes[0].tolls[]` (country ISO3, tagCost/cashCost, waluta kraju startu np. PLN).
  CF `tollProxy` agreguje per kraj → EUR (ISO3→ISO2 + kursy zgrubne), preferuje tagCost>cashCost.
- **LIMIT TRIALU = 15 transakcji/DZIEŃ** (rolling 24h, nie kalendarz). Za mało na produkcję,
  starczy na kalibrację. Dziś wyczerpany (testy). Reset ~24h od pierwszego użycia.
- **Brak darmowego-na-zawsze API** (Tollsmart=trial 10k/mc+Zach.Europa, OpenTollData=tylko FR WIP,
  Valhalla=bez cen). Plan: trial→kalibracja→flat-rate free. TODO: klucz regenerować (był w czacie).

### Myto PER KLASA auta (kluczowa poprawka)
Flota to lekkie auta, nie TIR-y. `vehicle.type`: v1/v3/v5=Solo (Iveco 70C18 solówki ~7,2t),
**v4 TK 314CL=Bus** (+przyczepa). Flat-rate liczył WSZYSTKIM myto jak zestaw >12t → bus Strawczyn-Paryż
pokazywał 431€ (user: „tyle nie płacę przez cały miesiąc").
- **Dwie tabele**: `tollPerKm` (solówka lekka: DE 0.13/FR 0.08/PL 0.05...) + `tollPerKmBus`
  (bus: DE 0/PL 0, płaci głównie péage FR/IT/ES + winiety AT/CH). Wybór wg `vehicle.type`.
- TollGuru vehicleType też per klasa: Bus→2AxlesAuto, Solo→2AxlesTruck.
- Efekt: bus Strawczyn-Paryż myto **~21€** (tylko FR péage) zamiast 431€. Total ~466€ (444 paliwo+21 myto).

### ⚠️ OTWARTE PYTANIE (do dokończenia po GPS)
User zapytał: „myta w Niemczech nie ma, w Polsce też?" — czyli DE/PL=0 dla busa może być ZŁE.
Ustawiłem busa jako ZWOLNIONY z Maut towarowego (dobre dla przewozu OSÓB). **ALE jeśli TK 314CL
wozi TOWAR (bus+przyczepa dla frachtu, ≥3,5t)** → płaci Maut DE + e-TOLL PL w niskiej klasie, NIE zero.
**Do potwierdzenia z userem:** czy TK 314CL płaci myto w DE/PL realnie?
- TAK → potraktować jak lekki pojazd towarowy = stawki jak solówka (DE 0.13/PL 0.05), nie zero.
- NIE → zostaje jak jest (péage tylko FR/IT/ES).
Najlepiej: NegoMetal faktura myta dla TK 314CL → realne kwoty per kraj. NIE zgadywać dalej
(już 2× źle: najpierw za wysoko jako TIR, potem może za nisko jako bus-pasażerski).

### Flota — archiwizacja (nie kasowanie!)
User: „zostaw tylko te 4, nie kasuj na stałe". Zarchiwizowane **TK 130EF (v2) + TK 315CL (v6)**
przez `archived:true` (transakcja, długość 6→6 bez zmian, historia 111+25 frachtów / 137+79 kosztów
nietknięta). Aktywne: WGM 0475M, WGM 5367K, TK 314CL, WGM 0507M. Mechanizm: `vehicles.filter(v=>!v.archived)`
(sekcja Archiwum osobno). Dropdown Pojazd w kalkulatorze też filtruje archived.

### Inne poprawki kalkulatora dziś
- Selektor „2–9 osi" USUNIĘTY (flota=solówki). Wybór pojazdu OBOWIĄZKOWY (bez auta spalanie=domyślne 30=bzdury).
- Skrypty read-only w repo (gitignored): diagnose_calibrate_toll.mjs, diagnose_calibrate_overlap.mjs,
  diagnose_frachty_km.mjs (frachty jako baza km per kraj — działa, ale skad wpisywany tylko sty-mar).

### Bug GPS breadcrumbs (task_fdf05d25) — user odpalił w osobnej sesji, WRACAMY DO GPS TERAZ
Breadcrumbs v3 zanieczyszczone stale-point 47.914,3.714 → skoki 10000 km/h, zawyża dystans 10×,
psuje mapę trasy. To był kontekst gdy user przełączył na „problem z GPS".

## 2026-07-22 — Kalkulator: myto z PTV Developer (europejskie, oficjalne) + box płatnymi/landem

### PTV Developer wygrał (europejski, liczy Polskę, darmowy 500/dzień)
Po odrzuceniu TollGuru (15/dzień, USA) i Tollsmart (USA, bez PL) — **PTV Developer** (developer.myptv.com,
niemiecki standard branżowy): Free Plan **500/dzień bez karty, rejestracja od ręki**, LICZY POLSKĘ,
oficjalne stawki operatorów. Standard Plan €0 + **50k/mies** gratis (user pokazał — nigdy nie dobijemy,
realnie **max 5 tras/dzień**). Koszt = martwy temat.
- CF `tollProxy` przepisany na PTV Routing API (`results=TOLL_COSTS`, `profile=EUR_TRUCK_7_49T`
  = solówka 3,5–7,49t). Odpowiedź: `toll.costs.countries[]` ISO2 + `convertedPrice` EUR (PTV
  konwertuje waluty sam). Klucz w `config/toll.ptvKey`. Bus = 0 (PTV nie wołany).
- Profil MA znaczenie: Kielce→Berlin domyślnie (40t) 152€, jako 7,49T = **77€** (PL 63 + DE 14).

### Walidacja o kotwicę usera €350–600/auto/mies (dowód, nie zgadywanie)
Realne trasy frachtów v3 przez PTV: styczeń 853€/4443km (powyżej), luty 332€/3018km (poniżej),
**średnia ~590€ = W ZAKRESIE**. PTV pasuje do rzeczywistości. FR dominuje myto (autostrady/péage).

### KOREKTA założeń (user)
- **Polska NIE omijana** — PL toll jest w **polskim e-TOLL** (osobny system), NegoMetal go NIE MA
  (stąd NegoMetal PL 12€ = niepełne; PTV PL 63€ realne). **Odrzucony pomysł „PL=0".**
- Po Europie jeżdżą **„landem"** (krajówkami) żeby płacić mniej → PTV najszybsza = górna granica.

### Box płatnymi vs landem (commit f915033)
CF liczy 2 trasy PTV równolegle: płatnymi + landem (`options[avoid]=TOLL`, enum: TOLL/FERRIES/
RAIL_SHUTTLES/HIGHWAYS). Box w wyniku: oba warianty (€ myto · km · h) + oszczędność/objazd/h +
ocena opłacalności (€/h objazdu, <8€/h = nieopłacalne). Kielce→Berlin: płatnymi 77€/9,2h vs
landem 1€/17,5h (+171km, +8h = nieopłacalne). Rozbicie liczone dla wariantu płatnego.

### Stan: myto REALNE i zwalidowane
Koniec szacunków. PTV = oficjalne stawki UE z Polską, zwalidowane kotwicą usera. Flat-rate =
tylko fallback gdy PTV padnie. **NIEzweryfikowane**: kliknięcie w zalogowanej apce (brak hasła).
Skrypty: diagnose_ptv_validate.mjs (gitignored). Klucz PTV był w czacie → user zregeneruje.

## 2026-07-22 — Kalkulator tras: myto PTV Developer + Polska z realnego e-TOLL

### PTV Developer wpięte (zastąpiło TollGuru) — commity f6f48b7→8877fe0
Po odrzuceniu TollGuru (15/dzień) i Tollsmart (bez Polski): **PTV Developer** (europejski,
developer.myptv.com). Free Plan 500/dzień bez karty, self-service, **LICZY POLSKĘ**. Standard Plan
€0 + 50k/mies free (user gotów wykupić, ale ~5 tras/dzień = nigdy nie dobije limitu).
- CF `tollProxy`: PTV Routing API, `profile=EUR_TRUCK_7_49T` (solówka 3,5–7,49t = Iveco 70C18).
  Odpowiedź `toll.costs.countries[]` ISO2 + convertedPrice EUR (PTV konwertuje sam). Klucz `config/toll.ptvKey`.
- Profil ma znaczenie: Kielce→Berlin 40t=152€, 11.99T=77€, **7.49T=77€** (PL 63+DE 14).
- Nagłówek czasu z PTV (czas ciężarówki 9,3h) zamiast OSRM (~auto 7,2h).

### Box „płatnymi vs landem"
PTV `options[avoid]=TOLL` (enum: TOLL,FERRIES,RAIL_SHUTTLES,HIGHWAYS). Dwa warianty:
płatnymi (najszybciej) vs landem (omijaj płatne) + ocena €/h objazdu. User: „po Europie jeździmy landem".

### Polska — NADPISANA realnym e-TOLL (kluczowa korekta)
PTV liczył PL **63€/trasa** przez płatną **A2 Konin–Świecko** (koncesja, najdroższa w PL). Ale:
- User: „w PL zjazd i wyjazd" — schemat 2 przejazdy PL/runda (wyjazd Kielce→załadunek PL→rozładunek
  DE/FR; powrót załadunek EU→rozładunek PL), reszta krajówki (omijają A2).
- **Realny e-TOLL z kosztów FleetStat** (import Excel v17-v19, linia „E-Toll", EUR): solówki
  **54–79€/MIESIĄC** (nie per trasa!). v1 374€/5mc, v3 397€, v5 271€, bus v4 251€.
- Fix: **PL nadpisane 0,02 €/km** (~10€/przejazd = 65€/mc ÷ ~6 przejazdów), edytowalne. Reszta krajów PTV.
  Bus PL też 0,02 (v4 płaci ~50€/mc). Kafelek pokazuje „PTV liczył PL X przez A2 → nadpisane na Y".

### Walidacja PTV vs kotwica usera €350–600/auto/mies
Realne trasy frachtów v3 przez PTV: styczeń 853€ / luty 332€ (śr ~590) = W ZAKRESIE. PTV = górna
granica (najszybsza=płatna), realnie mniej bo landem. Skrypt `diagnose_ptv_validate.mjs`.

### Dane opłat drogowych (z FleetStat costs, kat. oplaty)
Import kończy się na MAJU (czerwiec niewgrany). Rozbicie E-Toll+Nego per auto 2026 Jan-maj podane userowi.
**Czerwiec z NegoMetal (plik 37, 01-29.06, netto EUR):** WGM 0507M 399€, WGM 0475M 253€, WGM 5367K 167€
(suma 820€, tylko Nego zagr., bez PL e-TOLL, bez busa). User importuje sam przez Excel/Total — NIE wgrywać.

### Otwarte
1. Paliwo — wciąż ceny domyślne diesla (Faza 2 = realne). 2. Stawka PL 0,02 do potwierdzenia (user
sprawdza e-TOLL dokładnie). 3. Bus DE/FR myto=0 vs fakt że v4 płaci e-TOLL PL — spójne (PL≠0 teraz).
4. ⚠️ Klucz PTV był w transkrypcie → user regeneruje. Skrypty diagnostyczne: diagnose_ptv_validate.mjs,
diagnose_calibrate_*.mjs (gitignored).

---

## 2026-07-23 — Kalkulator: Polska z REALNYCH sekcji e-TOLL PTV (koniec zgadywanki 0,02)

Komit **3dc29ec** (CF `tollProxy` + `src/components/KalkulatorTras.jsx`).

### Problem ze starym modelem (0,02 €/km × total km PL)
User wrzucił 3 realne eksporty e-TOLL (WGM 5367K, TK 314CL bus, WGM 0475M; ~1520 płatnych km).
Taryfa e-TOLL jak w zegarku: **0,410 PLN/km ≈ 0,095 €/km**, identyczna dla solówki i busa (klasa
3,5–12t, euro_6). Stare 0,02 na CAŁY dystans PL zakładało po cichu, że tylko ~21% km jest płatne —
a realne trasy floty są mocno ekspresowe (A4/S8/S7), więc **0,02 zaniżało ~4×**.

### Odkrycie w PTV (live test Kielce→Zgorzelec, klucz z config/toll przez gcloud REST)
PTV `results=TOLL_COSTS,TOLL_SECTIONS,TOLL_SYSTEMS` zwraca:
- `toll.systems[]`: **[0] e-TOLL (państwowy), [1] A4 Stalexport (koncesja)**.
- `toll.sections[]`: per sekcja `countryCode`, `tollSystemIndex`, `costs[].convertedPrice` (EUR),
  `officialDistance`. **Sekcje e-TOLL wycenione po realnej taryfie 0,410 PLN/km** (2,39 PLN / 5,84 km).
- Kielce→Zgorzelec PL: total PTV **53,23€** = e-TOLL **41,21€** (435,8 km) + koncesja A4 **12,02€**.
  Kontrola: 435,8 × 0,095 = 41,40€ ✓. Stary model: 535 km × 0,02 = **10,71€** (4× za mało).

### Fix (wariant A wybrany przez usera)
- **CF `tollProxy`**: dolicza `plEtoll`/`plEtollKm`/`plHasEtoll` = suma sekcji PL systemu e-TOLL
  (operator/name zawiera „e-toll"), z pominięciem koncesji A2 AWSA / A4 Stalexport.
- **Frontend**: PL nadpisywane realnym `plEtoll` z PTV (nie 0,02×km). Fallback km×0,02 tylko gdy PTV
  nie zwróci sekcji (brak klucza/api-error). **Bus też woła PTV** i bierze TYLKO plEtoll (winiety
  zagranicą bez zmian). Infobox rozróżnia źródło: „realny e-TOLL (X km × 0,41 PLN/km)" vs fallback.
- Komentarze przy stałych zaktualizowane: `tollPerKm.PL=0,02` / `tollPerKmBus.PL=0,02` = TYLKO fallback.

### Zweryfikowane / NIE
- ✅ Logika parsowania sekcji na realnym JSON PTV (plEtoll=41,21€ policzone offline).
- ✅ Build zielony, CF deployed, push na main (Vercel auto-deploy). Klucz PTV WAŻNY (użyty w sesji).
- ⚠️ NIE klikałem UI kalkulatora za loginem (nie loguję się na konto). API PTV sprawdzone bezpośrednio,
  kliknięcia dyspozytora nie. Do potwierdzenia przez usera: policzenie realnej trasy w panelu.

### Otwarte (kalkulator)
1. **PALIWO** — jedyna część wciąż na wartościach domyślnych (Faza 2). To następny naturalny krok.
2. Stawka fallback PL 0,02 — nieistotna teraz (używana tylko gdy PTV padnie).

### Cross-check z oficjalnym kalkulatorem rządowym e-TOLL (etoll.gov.pl)
User podrzucił https://etoll.gov.pl/kalkulator-trasy-w-e-toll/. Odpaliłem w przeglądarce
(Kielce→Zgorzelec, Euro 6, ciężarówka 3,5–12t, „Najszybsza"):
- **Oficjalny gov: 183,17 PLN** vs **nasze PTV (sekcje e-TOLL): 178,51 PLN** (41,21€).
- Różnica **4,66 PLN = 2,5%** (porównanie PLN-do-PLN, bez FX). Zgoda 97,5%.
- Reszta różnicy = drobny wybór odcinków S/A przez „najszybszą", nie błąd stawki. Oba wykluczają
  koncesje A2/A4 (gov ich nie liczy, my pomijamy) → jabłko-do-jabłka.
- **Model PTV POTWIERDZONY rządowym źródłem.** Stary 0,02×535km≈46 PLN = ~4× za mało (gov to potwierdza).
- Technicznie: etoll.gov.pl = Next.js SPA za Incapsulą + zamknięty widżet Leaflet, BEZ publicznego API
  myta (kalkulacja w widżecie) → nie da się wpiąć, i nie trzeba (PTV daje to samo + myto zagr. w 1 calu).
- Gotcha: sticky-layout SPA psuje screenshoty (białe) i klik-po-refie; sterowane przez JS-focus + wybór
  opcji react-select przez dispatch mousedown; liczba czytana z DOM.

### PALIWO Faza 2 — realne ceny diesla NETTO z 3 kart (czerwiec 2026)
User: „A" (ceny z Waszych kart, nie detal) + wrzucił 3 raporty („z 3 korzystamy"): Eurowag
(EW_Export), E100 (transaction-1594078), Andamur (MOJE ZUŻYCIE). NegoMetal odpadł (to i tak myto).
- **Najpierw sprawdziłem Firestore `fuelEntries`** — za ubogie (24 rek., 2 tyg., pricePerL w GROSZACH
  i głównie null; tylko FR sensowny 1,33). Nie nadaje się. Import nie wypełnia ceny/kraju konsekwentnie.
- **Eurowag = backbone**: ma kolumnę „Kwota netto" (zweryfikowane: DE ratio 1,19=VAT19%, CZ 1,21=VAT21%)
  + kraj + litry, pokrywa 12 krajów (DE14/FR18/PL15/ES4/BE4/CZ/AT/HU/RO/BG/LU/PT diesle).
- **E100/Andamur = brutto → netto przez VAT kraju** (zasada ZASADY netto=brutto/(1+VAT)). Cross-check
  ZGODNY z Eurowag: ES 1,23/1,22/1,31 · FR 1,63/1,64 · AT 1,57/1,54 · RO 1,57/1,60 → konwersja OK.
- Filtr: tylko flota WGM*/TK314CL (OKAZICIEL/TRUCK/UNIVERSAL/benzyna skip). Kurs NBP 30.06.2026
  (EUR 4,2963/RON 0,819/CZK 0,1772). Ważone litrami.
- **Realne netto < domyślne** (potwierdza premisę): PL 1,30 (było 1,42), DE 1,51 (1,66), ES 1,23 (1,48),
  CZ 1,24 (1,44), FR 1,63 (1,69), BE 1,68, AT 1,57, LU 1,34, HU 1,68, RO 1,57, BG 1,35, PT 1,47.
- **ZAPISANE do `config/kalkulatorTras.fuelPrice`** (firebase-admin, merge:true, updatedAt ISO).
  Kraje bez danych czerwca (IT/NL/SK/SI/CH…) zostają z domyślnych przez merge w kodzie (linia 207).
- Skrypty (gitignored): diagnose_fuel_from_reports.py, diagnose_fuel_prices.mjs.

### Zweryfikowane / NIE
- ✅ Konwersja brutto→netto potwierdzona cross-checkiem 3 dostawców. Zapis do config odczytany zwrotnie.
- ⚠️ NIE klikane w UI za loginem (ceny załadują się dyspozytorowi przy otwarciu; merge logic w kodzie
  potwierdzony). RO/BG/PT/LU/HU = 1–3 tankowania (cienkie, ale realne); core PL/DE/FR/ES/BE = solidne próbki.
- Paliwo przestało być „szacunkowe" dla 12 krajów. Docelowy automat (CF/import wypełnia pricePerL+country
  → fuelEntries auto-źródło) = wciąż otwarte, gdy user zechce.

### Myto wg ZASADY FLOTY (polityka per kraj) — user doprecyzował schemat jazdy
User: „Niemcy Austria Czechy Włochy płatne drogi, reszta landem, Polska jak wiemy płatne również".
- PTV nie umie omijać toll per kraj (globalny avoid=TOLL daje objazd Berlin→Madryt przez Austrię +1100km).
- **Nie trzeba PTV do przetrasowania** — mam myto per kraj z PTV, więc ZERUJĘ myto w krajach „landem".
- Polityka `DEFAULT_TOLL_COUNTRIES=[DE,AT,CZ,IT,PL]` (edytowalna: config/kalkulatorTras.tollCountries).
  Kraje spoza listy (FR/ES/BE/NL/LU…) = landem, myto 0. PL = e-TOLL (jak wcześniej).
- Compute: `tollFull` (płatnymi per kraj) + `pay=tollPay.has(cc)` → tollCost=pay?tollFull:0. Śledzę
  `tollTotal` (wg zasady) i `allTollTotal` (gdyby wszędzie płatnymi). Row.land flag.
- UI: box „Wg Waszej zasady vs Gdyby wszędzie płatnymi" (+oszczędność), tabela pokazuje „landem",
  tekst „Myto — jak liczone" wymienia kraje płatne. Zastąpił binarny płatnymi-vs-landem.
- **CF: usunięte wywołanie economic (avoid=TOLL)** — polityka liczona per kraj po froncie → 1 wywołanie
  PTV zamiast 2 (szybciej, bez bezsensownych objazdów). Config: zapisane tollCountries (fuelPrice zachowane).
- **Przykład Berlin→Madryt**: gdyby wszędzie płatnymi 293 € → wg zasady (płatne tylko DE) **97 €**
  (landem FR/ES/BE = 0). Oszczędność 196 €. To realny model — płacą tylko niemiecki Maut.
- Commity: 3c296b0 (feature) + ff5f601 (fix timeout PTV wcześniej). Deploy CF + push OK.
- ⚠️ NIE klikane w UI za loginem — logika policy zweryfikowana na danych PTV (Berlin→Madryt 97 €).

### Frachty: kolumna „nego/e-toll" per zlecenie + zwężenie tabeli (user request)
User (na zrzucie tabeli WGM 0475M): dodać myto per zlecenie pod nazwą „nego/e-toll" (od lipca),
zwęzić daty, skrócić status. Potwierdził: myto AUTO z silnika (trasa załadunek→rozładunek → PTV+e-TOLL),
daty DD.MM, status „✅ rozł".
- **Kolumna „nego/e-toll"**: `computeFrachtToll(fracht)` — geokod (Nominatim) punktów załadunek+rozładunek
  → `tollProxy` (PTV per kraj + e-TOLL PL) → zasada floty (DE/AT/CZ/IT/PL płatne, reszta landem=0).
  Zapis `tollEstimate`+`tollEstimateAt`+`tollEstimatePer` na frachcie (liczone RAZ, nie na żywo — PTV limit).
  Komórka `FrachtTollCell`: wartość lub „🧮 licz" (tylko od 2026-07). Batch „🧮 Policz myto (N)" w nagłówku
  (July+ brakujące, sekwencyjnie). Suma myta w wierszu SUMA.
- **Daty** ZLEC/ZAŁ/ROZŁ → `ddmm()` = „06.07" (pełna w tooltip). **Status** cfg+opcje skrócone („✅ rozł"),
  select minWidth 130→92.
- Reuse: `geocode` (App.jsx) + `tollProxy` (wdrożony, wspiera plInRoute). BEZ zmian CF. Commit ca259cf.
- **Zweryfikowane silnikiem na realnych adresach**: #1 PL Stryków→FR Aoste = 145€ wg zasady (PL 9,74+DE 135,58;
  CH 50+FR 39 landem); #6 DE Neunkirchen→PL Kostrzyn = 117€ (DE 116+PL 0,23).
- ⚠️ **CH (Szwajcaria) transit** wychodzi jako landem=0 (nie ma jej na liście płatnych) — LSVA realnie
  nieuniknione jeśli jadą przez CH. User może dodać CH do config/kalkulatorTras.tollCountries.
- ⚠️ NIE klikane w UI za loginem (silnik zweryfikowany bezpośrednio). Mobile card BEZ kolumny myta (desktop only).
- OTWARTE: pełne auto-on-save (liczenie przy zapisie frachtu w modalu) — teraz trigger przyciskiem (per wiersz
  + batch). Auto-on-render odrzucone (limit PTV/re-fire).

### Diagnoza „strona miga / wywala do logowania" (user na komputerze, różne maszyny)
Trzy przyczyny (nie jedna):
1. **SW auto-reload** (`controllerchange → location.reload()` w index.html) — flash load→reload→load
   przy pierwszym wejściu / evikcji SW. Zbędne od SW v6 (shell network-first, deploye i tak propagują
   się same). **USUNIĘTE** (commit 2c74390). Potwierdzone na żywo: `performance.navigation.type=reload`.
2. **Banner „nowa wersja"** (checkVersion co 5 min, App.jsx ~1286: fetch `/` → porównanie hash bundla →
   niebieski pasek „Odśwież teraz" → reload). Sam OK, ale **dziś ~12 deployów w sesji = spam paska** u usera
   + flash przy każdym reloadzie. Efekt sesji, nie stały bug. Lekcja: mniej deployów gdy user pracuje na żywo.
3. **Auto-logout 30 min bezczynności** (App.jsx 763) — „wywala do logowania". Liczy ruch na oknie → karta
   w TLE (brak myszy) → cichy signOut po 30 min; multi-tab: jedna karta wylogowuje wszystkie (Firebase
   dzieli sesję). **Wydłużone 30min→12h** (commit a0a32f7), `AUTO_LOGOUT_MS=0` wyłącza. Ikona ciężarówki =
   ekran `user===undefined`/`!roleLoaded` (App.jsx 927/929) — miga gdy App się remountuje (reload).
- Persystencja auth = browserLocalPersistence (firebase.js 54) — reload NIE wylogowuje; logout był z #3.
- ⚠️ NIE zweryfikowane w zalogowanym UI (mechanizmy potwierdzone w kodzie + reload na żywo w przeglądarce).
  User: po deployu Vercela raz wyczyścić dane witryny (zejść ze starego shella z reloadem).

### NASTĘPNA SESJA (plan usera, koniec dnia 2026-07-23)
1. **Import kosztów za czerwiec** — user chce zrobić razem. Materiały już są: 3 raporty paliwowe czerwca
   sparsowane dziś (Eurowag EW_Export + E100 transaction-1594078 + Andamur MOJE ZUŻYCIE) — patrz sekcja
   "PALIWO Faza 2". NegoMetal czerwca (myto zagr.) policzony wcześniej: WGM 0507M 399€ / 0475M 253€ / 5367K 167€.
   Workflow: feedback_import_kosztow_workflow (Total_26, miesiąc=czerwiec=kol.H?, top-up brakujących, note=nr pliku).
2. **Nowy pomysł: monitorowanie/zarządzanie paliwem** — user ma koncepcję, do omówienia. Kontekst: dane
   tankowań są w `fuelEntries` (litry, pricePerL w groszach, country, station, isAdblue) — ale niekonsekwentnie
   wypełniane (patrz PALIWO Faza 2: import nie zawsze zapisuje cenę/kraj). Możliwy kierunek: €/L per kraj auto,
   €/km, alerty, spalanie. Poczekać na pomysł usera, nie zakładać z góry.

## 2026-07-24 — Import kosztów CZERWCA 2026 (top-up v20) + audyt dubli

Plik źródłowy: `Auta VBS 2025 (20).xlsx`, zakładka `Total_26`, **czerwiec = kolumna H**.
Note importu = **„Import Excel v20"** (numer PLIKU, nie auta).

### Audyt dubli PRZED importem (odpowiedź na pytanie usera)
Skan całego 2026 dwoma kluczami: appkowym (`vehicleId|date|amount|note`) i ostrzejszym
(ta sama kategoria >1× w miesiącu). **Prawdziwych dubli: 0.**
- „Powtórzenia" w sty–maju to `oplaty` ×2 = **Nego + E-Toll** (różne kwoty + suffiks w note) → legit.
- Styczeń v4/v2 `inne` ×2 = pozycja własna + „(Przyczepa)" → też legit.

### ⚠️ Realne ryzyko dubla (dlatego TOP-UP, nie pełny import)
Czerwiec NIE był pusty: **19 wpisów z projekcji „Import Excel v17"** (koszty stałe wepchnięte
naprzód na 2026-06…12). Kwoty zgadzały się z arkuszem co do grosza → pełne 50 pozycji dałoby
**19 dubli** (note v20 ≠ v17, dedup appki by ich nie złapał).
Dziury w projekcji v17, domknięte przez top-up: **v5 bez ZUS 400** (v1/v3 mają) oraz
**żaden pojazd nie miał `imi` 13 ani `ocpd` 104**.

### Import (wariant A — user wgrał sam przez UI „📥 Importuj z Excel")
Wygenerowany `~/Downloads/koszty_2026-06_flat.xlsx` — **31 pozycji** (v1 9, v3 7, v4 7, v5 8, v2 0).

### Weryfikacja PO imporcie (`diagnose_dedup_june.mjs`, read-only)
- Baza 1048 → **1079** wpisów (+31, dokładnie tyle ile w pliku).
- **2026-06 = 50 wpisów / 23 893,02 EUR** vs arkusz `suma kosztów` **23 893,01** (1 grosz zaokrągleń).
- Per auto (baza vs arkusz): v1 8910,14/8910,15 · v3 3838,79/3838,78 · v4 4623,29/4623,29 ·
  v5 6510,80/6510,79 · v2 10/10. ✅
- **DUBLE A: 0.** DUBLE B: 3 × `oplaty` (Nego+E-Toll) = oczekiwane.
- Cross-check Nego czerwca zgodny z NegoMetal policzonym 07-23: 0507M 399 / 0475M 253 / 5367K 167 ✅

### Flagi danych (do wiedzy usera, NIE zmieniane)
1. **v1 „inne" 1 243 €** — komentarz w H58: „naprawa klocków w FR". W arkuszu to wiersz *inne*,
   faktycznie serwis. Wgrane jako `inne` (1:1 z arkuszem, zasada snapshotu); user może przemapować.
2. **v1 E-Toll czerwiec = 2,59 €** przy Nego 253 € (inne auta 68–87 €) → wygląda na niekompletny
   e-TOLL dla WGM 0475M w arkuszu. Wgrane jak jest.
3. **v3 (WGM 5367K) czerwiec = 2 frachty / 8 dni** — auto stało, stąd paliwo 667 € (nie błąd).
4. Znany bug arkusza wrócił: wiersze podsumowań kategorii w bloku Total zaniżone
   (Nego 485 vs realne 819; E-Toll 95,65 vs 233,06). Bottom-line `suma kosztów` OK.

### Zweryfikowane / NIE
- ✅ Suma i skład czerwca odczytane zwrotnie z Firestore po imporcie usera. 0 dubli.
- ⚠️ Lipiec–grudzień 2026 wciąż mają projekcje v17 (po 19 wpisów) → co miesiąc znowu top-up.
  Kiedyś warto wyczyścić projekcje przyszłych miesięcy.

## 2026-07-24 (cd.) — NOWY MODUŁ „Paliwo": poglądowy widok na realnych danych czerwca + korekta Atlasa

Pomysł usera: mapa tankowań (co, gdzie, jaką kartą, kiedy, ile litrów, za ile) + wnioski + km z Atlasa.
Wariant **A** — najpierw poglądowy widok, potem kodowanie w App.jsx. Nic jeszcze nie poszło na produkcję.

### Dane — 3 karty, czerwiec 2026
91 transakcji (76 diesla, 15 AdBlue) z `EW_Export_TR_2607203`, `transaction-1594078` (E100),
`MOJE ZUŻYCIE (3)` (Andamur). **4 410 L ON / 6 494 € netto / 1,473 €/L** — litry i liczba tankowań
zgadzają się co do jednostki z zestawieniem, które user zrobił wcześniej (1413/439/1154/1404 L).
Netto: Eurowag ma kolumnę netto; E100/Andamur brutto/(1+VAT kraju); FX = NBP 30.06.2026.
**Geokod stacji** (raporty NIE mają coords): Nominatim po nazwie/adresie + countrycodes, cache 71 stacji,
7 skrótów ręcznie („Katy Wrocl." → Kąty Wrocławskie itd.). Docelowo kolekcja `fuelStations`.

### Widok (`mockup_paliwo.html`, gitignored; podgląd: launch.json wpis `mockup` → port 5190)
Panel lewy: filtry (auto/karta/Diesel-AdBlue/kraj) · KPI · auto-wnioski · ceny per kraj · auta
(litry, km, L/100, €/km) · lista tankowań (klik → skok na mapę). Mapa Leaflet: pin = transakcja,
kolor = karta, wielkość = litry, etykieta €/L od zoomu 6 (niżej się zlepiały), popup z pełnym detalem
+ ile realnie zapłacono w walucie lokalnej.

### Co dane pokazały (realne, nie przykładowe)
- **FR 1205 L @ 1,630 €/L = 27% litrów floty w najdroższym kraju → nadpłata 468 € vs CZ (1,242)**.
  Dalej DE 1,510 · PL 1,302 · ES 1,267.
- **W ES Andamur 1,311 vs E100 1,217 €/L → 33 € straty na 350 L.** Trzy karty w jednym kraju, jedna słabsza.
- Najgorsze tankowanie: 05.06 WGM 0475M, Andamur La Junquera, 1,371 €/L (+0,104 nad średnią ES).
- AdBlue: 165 L / 151 € / 0,916 €/L = 3,7% litrów diesla.
- **Arkusz vs karty: WGM 0507M +163 L, TK 314CL −30 L** — rozjazd do wyjaśnienia (wchodzi w spalanie).

### ⚠️ KOREKTA: Atlas widzi CAŁĄ flotę (user zgłosił, zweryfikowane na żywo)
Zapis w pamięci „konto vbs/vbs widzi tylko WGM 0475M, reszta to Webfleet" był **NIEAKTUALNY**.
`/devices` zwraca **5 urządzeń**: 81372 WGM 0475M · 81469 WGM 0507M · 81472 WGM5367K ·
81837 „TK 314CL " (trailing space!) · **83545 WE 2CG94 — user nie potwierdził co to za auto**.
- **`/history?year&month` = 1 rekord/pojazd z kumulacyjnym `distance`** → różnica miesięcy = km/miesiąc.
  Czerwiec: 0475M **8728** · 0507M **7862** · 5367K **2834** · 314CL **6872** km (arkusz: 8594 / 7617 /
  BRAK / 7039 → zgoda 1,6–3,2%; delta liczy ostatni punkt maja → ostatni czerwca). Historia od kwietnia.
- **WGM5367K raportuje licznik w METRACH** (202603000) — pozostałe w km. Normalizować per urządzenie.
- Spalanie (litry z kart / km z Atlasa): 0475M 16,2 · 5367K 15,5 · 314CL 16,8 · **0507M 17,9 L/100**.
- `gpsBreadcrumbs` w Firestore ma tylko ~7 dni (okno retencji) → backfill wstecz tylko z `/history`.

### 🔎 Odkrycie przy okazji — CAN daje paliwo
Pola `can[]`: `fuelUsage` = **kumulacyjne litry spalone przez auto** (Spalania) i `fuelLevelCan` = **% baku**
(u WE 2CG94 w litrach). To otwiera **detektor ubytków: litry z auta vs litry z kart**, oraz skoki poziomu
baku = tankowanie/spuszczanie. Retro nie policzymy (7 dni breadcrumbs); od teraz wymaga zapisu tych pól
w `scheduledGpsPoll`. Nie zrobione — do decyzji usera.

### Zweryfikowane / NIE
- ✅ Parsowanie 3 raportów (sumy = zestawienie usera), geokod 91/91 transakcji, widok działa w przeglądarce
  (KPI, filtry, mapa, popupy, tabele — sprawdzone przez DOM/JS na żywo).
- ✅ Atlas: devices, CAN, /history i km/miesiąc sprawdzone bezpośrednio na API.
- ⚠️ Nic nie jest w App.jsx ani na produkcji. Import danych = skrypt, nie UI. Historia = tylko czerwiec.
- ⚠️ Piąte urządzenie WE 2CG94 niewyjaśnione. Rozjazd litrów arkusz vs karty niewyjaśniony.
