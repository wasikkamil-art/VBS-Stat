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
