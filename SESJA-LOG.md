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

## 2026-05-06 — Bug B resolved (nie kod, stuck subscription)

**Kontekst**: Wznowienie pracy. User zostawił wczoraj otwartą diagnostykę Bug B (home tile pokazuje "Czeka na zlecenie" mimo aktywnej bazy w `pauzy`). Pierwszy task = weryfikacja czy bug nadal istnieje po Vercel deploy + re-login.

### Bug B — RESOLVED

User otworzył fleetstat.pl po hard refresh (screenshot Przegląd):
- Kafel WGM 5367K → "Baza · do 7 maj" ✅
- Kafel WGM 0507M → "Baza · do 8 maj" ✅
- Sidebar "Czas pracy — Statusy kierowców" → wpisy "Baza" widoczne ✅
- F12 Console → bez errors (tylko `FCM token saved` standardowy log) ✅

**Root cause**: stuck subscription state. Podczas incydentu admin "Podgląd" (2026-05-05 ~14:00) `pauzy onSnapshot` rzucił `permission-denied`. Firestore SDK nie auto-reconnect'uje po permission error. Re-login Custom Claim wrócił, ALE subscription `pauzy` pozostała broken aż do fresh page load po Vercel deploy (2026-05-05 wieczór).

**Lekcja architektoniczna**: `fleet/data` ma już auto-retry (`4176b4c`), inne `onSnapshot` (jak `pauzy`) — nie. Defense layer (backlog, NIE pilne): retry wrapper na permission errors lub force-reload subscriptions na `onIdTokenChanged`. Edge-case po claim recovery, ale przy SaaS bar 10/10 warto.

Memory `project_bug_czas_pracy_2026_05_05.md` zaktualizowana — Bug B status → resolved + lekcja architektoniczna.

### Stan repo

- Worktree: `claude/eager-rhodes-513624`
- Origin/main najnowsze: `23feb44` (z wczoraj — finalne podsumowanie sesji 2026-05-05)
- Bez code changes w tej części sesji (tylko docs/memory)

### Otwarte (nadal)

1. ⏳ **Email do klienta** — quick research czy używa `pauzy` (impact gdyby Bug B-pattern się powtórzył) lub innego źródła
2. ⏳ **P3 audit log test** — user zmienia rolę backup admin Admin→Dyspozytor→Admin → sprawdzenie `auditLog` collection w Firestore (czy są nowe entries `role_change`)
3. 📋 **Defensive auto-retry dla `pauzy`/innych subscription** — backlog, niska pilność (edge-case)
4. 📋 **TODO feature work** (rekomendacja: B alerty banner Czas pracy iter. 2):
   - A WhatsApp / **B alerty banner** ⭐ / C AI chat / D Giełda / E Tachograf refinement

### Operacyjne (user, nie Claude)

- **2026-05-06 (dzisiaj)** — pierwszy raport CSV z widziszwszystko (SendGrid Inbound Parse → wwReportInbound CF). Sprawdzić czy działa end-to-end.
- Przed 2026-06-01 — upgrade SendGrid (trial kończy się)
- Decyzja E3 (merge Tachograf + Czas pracy) — czekamy 1-2 tyg na user feedback (od 2026-05-04)
