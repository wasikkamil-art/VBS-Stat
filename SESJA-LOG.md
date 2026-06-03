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
