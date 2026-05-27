# RECOVERY.md — Procedura "Stracony laptop"

Procedura odzyskania pracy na nowym urządzeniu po utracie MacBooka (kradzież, zalanie, awaria, etc.).

**Aktualizowane**: 2026-05-27

---

## 🔑 ARCHITEKTURA BEZPIECZEŃSTWA — co od czego zależy

Jeden master key + automatyczna synchronizacja:

```
Apple ID hasło ──┐
                 ├──> iCloud Keychain (wł.) ──> hasła home.pl, OVH, Anthropic, Firebase, Vercel
                 └──> iCloud Drive ──> FleetStat-backup/ (memory + .env.local)

Google account hasło ──┐
(wasik.kamil@gmail.com) │
                       ├──> Google login → Firebase Console
                       ├──> Google OAuth → GitHub (wasikkamil-art)
                       │                  └──> Vercel (przez GitHub OAuth)
                       └──> Google OAuth → Anthropic Console (jeśli skonfigurowane)

Google 2FA backup codes ──> awaryjny dostęp jeśli telefon utracony
```

**Wniosek**: Apple ID + Google account = dwa klucze do wszystkiego.

---

## ⚠️ CO MUSISZ MIEĆ ZAPISANE *PRZED* UTRATĄ

Bez tego nie wykonasz procedury — zapisz w jednym z miejsc (priorytet wg bezpieczeństwa):

| Co | Gdzie zapisać | Krytyczność |
|---|---|---|
| **Apple ID hasło** | pamięć / sejf / iCloud Note na telefonie | 🔴 KRYTYCZNE |
| **Google account hasło** (wasik.kamil@gmail.com) | pamięć / sejf | 🔴 KRYTYCZNE |
| **Google 2FA backup codes** (10 sztuk) | wydruk + sejf, **NIE na MacBooku** | 🔴 KRYTYCZNE |
| **Apple ID 2FA backup codes** | wydruk + sejf | 🟡 backup |
| **GitHub recovery codes** (gdyby Google OAuth padło) | wydruk + sejf | 🟡 backup |

**Pozostałe hasła (home.pl, OVH, Anthropic, Firebase apps)** są w **iCloud Keychain** → odzyskasz automatycznie po loginie Apple ID na nowym urządzeniu.

### Generowanie 2FA backup codes — jak

- **Google**: https://myaccount.google.com/security → "2-Step Verification" → "Backup codes" → Generate
- **GitHub**: https://github.com/settings/security → "Recovery codes" (gdyby login Google OAuth padał)

---

## 🚨 FAZA 1 — PIERWSZE 10 MINUT (damage control)

Cel: odetnij dostęp złodzieja zanim coś zniszczy.

### 1. Zdalnie wymaż MacBook
- iPhone / dowolne urządzenie → https://www.icloud.com/find
- Apple ID login → kliknij swój MacBook → **"Erase This Device"**
- Mac zostanie wymazany przy pierwszym połączeniu z internetem
- Wszystkie cache, klucze, `.git/config` (z PAT-ami) — usunięte

### 2. Zmień hasło Google
```
https://myaccount.google.com/security
```
- "Password" → nowe mocne hasło
- "Your devices" → **Sign out** wszystkie poza twoim nowym urządzeniem
- Automatyczna konsekwencja: wylogowanie z Firebase, GitHub (OAuth), Vercel (OAuth), Anthropic (OAuth)

### 3. (Opcjonalnie) Zrewokuj PAT-y na GitHubie
```
https://github.com/settings/tokens
```
Usuń wszystkie tokeny (`ghp_...`, `github_pat_...`). Bez aktywnej sesji GitHub złodziej i tak nie zrobi nic, ale tokeny w `.git/config` na ukradzionym Macu pozostają fizycznie dostępne — lepiej je martwe.

### 4. Sprawdź czy produkcja niezakłócona (3 min)
- https://fleetstat.pl — działa? Loguje się?
- https://faktury.fleetstat.pl — działa?
- Firebase Console: https://console.firebase.google.com/project/vbs-stats/authentication/users — ostatnie loginy są twoje?
- Vercel: https://vercel.com/wasikkamil-arts-projects → Audit Log → ostatnie akcje są twoje?

---

## 🛠️ FAZA 2 — NOWY KOMPUTER (1-2 godziny)

Kolejność ważna — dopiero po Apple ID + Google działa reszta.

### 1. Apple ID login (nowy Mac)
```
System Settings → Apple ID → Sign in
```
**Zaczekaj 15-30 min** na sync:
- iCloud Drive → folder `FleetStat-backup/` pojawi się w `~/Library/Mobile Documents/com~apple~CloudDocs/`
- iCloud Keychain → hasła pojawią się w Safari + System Passwords

### 2. Install narzędzia developerskie
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Git, Node 20, Firebase CLI
brew install git node@20 firebase-cli

# Claude Code (z https://claude.com/download)
```

### 3. Google account login
- Otwórz przeglądarkę (Safari/Chrome)
- https://accounts.google.com → zaloguj się
- 2FA: kod z telefonu lub jeden z backup codes
- Zmień hasło Google jeszcze raz (na inne niż przy faza 1) — dla pewności

### 4. Nowy PAT GitHub
- https://github.com/settings/tokens → "Generate new token (classic)"
- Note: `recovery-2026-XX-XX`
- Expiration: 90 days
- Scope: ✅ `repo` (tylko ten)
- Generate → skopiuj `ghp_...` (jednorazowo!)

### 5. Klonuj repo
```bash
mkdir -p ~/Desktop
cd ~/Desktop

# Ustaw PAT jako zmienną (do końca terminal sessji)
PAT="ghp_PASTE_TWÓJ_NOWY_TOKEN_TUTAJ"

# FleetStat
git clone https://$PAT@github.com/wasikkamil-art/VBS-Stat.git VBS-Stat.nosync
cd VBS-Stat.nosync
git config user.email "wasik.kamil@gmail.com"
git config user.name "Kamil Wasik"
npm install
cd functions && npm install && cd ..
npx husky init  # pre-commit + pre-push hooks
cd ..

# vbs-invoices
git clone https://$PAT@github.com/wasikkamil-art/vbs-invoices.git vbs-invoices.nosync
cd vbs-invoices.nosync
git config user.email "wasik.kamil@gmail.com"
git config user.name "Kamil Wasik"
npm install
cd functions && npm install && cd ..
cd ..
```

### 6. Odzyskaj credentials z iCloud
```bash
# .env.local FleetStat (Firebase + Anthropic dla utilities lokalnych)
cp "$HOME/Library/Mobile Documents/com~apple~CloudDocs/FleetStat-backup/env/.env.local" \
   ~/Desktop/VBS-Stat.nosync/.env.local

# Memory Claude — wybierz ostatni snapshot (ls aby zobaczyć daty)
ls "$HOME/Library/Mobile Documents/com~apple~CloudDocs/FleetStat-backup/memory/"
# Np. ostatni to 2026-05-27:
mkdir -p ~/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory
cp -R "$HOME/Library/Mobile Documents/com~apple~CloudDocs/FleetStat-backup/memory/2026-05-27/"* \
   ~/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory/
```

### 7. Firebase CLI
```bash
firebase login
# Otworzy przeglądarkę → Google OAuth → autoryzuj
firebase use vbs-stats     # default FleetStat
# (vbs-invoices używa firebase.json w swoim katalogu)
```

### 8. Test lokalne
```bash
# FleetStat
cd ~/Desktop/VBS-Stat.nosync
npm run dev  # → http://localhost:5173

# vbs-invoices (drugi terminal)
cd ~/Desktop/vbs-invoices.nosync
npm run dev  # → http://localhost:5174
```

### 9. Setup auto-backup (jeśli chcesz kontynuować)
```bash
# Skopiuj plist do LaunchAgents
cp ~/Desktop/VBS-Stat.nosync/scripts/backup-claude-memory.plist \
   ~/Library/LaunchAgents/com.fleetstat.backup-claude-memory.plist

# Załaduj
launchctl load ~/Library/LaunchAgents/com.fleetstat.backup-claude-memory.plist

# Sprawdź
launchctl list | grep fleetstat
```

(Jeśli plist nie istnieje w repo — patrz `scripts/backup-claude-memory.sh` i utwórz launchd job ręcznie z harmonogramem 22:00.)

---

## ✅ FAZA 3 — CO DZIAŁA SAMO BEZ INTERWENCJI

W trakcie całego incydentu (od kradzieży do pełnego odzysku) **te rzeczy chodzą bez przerwy**:

| Co | Status podczas incydentu |
|---|---|
| `https://fleetstat.pl` (Vercel auto-deploy z GitHub main) | ✅ Klienci VBS pracują normalnie |
| `https://faktury.fleetstat.pl` (Vercel auto-deploy z GitHub main) | ✅ Działa |
| Firebase Functions (scanIMAPMailboxes, gpsProxy, parseDddFile, etc.) | ✅ Google cloud, niezakłócone |
| Firestore data (frachty, costs, invoices) | ✅ Google cloud, bezpieczne |
| Cloud Storage (PDF FV, CMR, DDD) | ✅ Google cloud, bezpieczne |
| Scheduler (scanIMAPMailboxes co 10 min) | ✅ Skanuje skrzynki, zapisuje nowe FV |

**Twój biznes NIE wpada w awarie z powodu utraty laptopa.** Tylko twoja zdolność deploy'owania nowych zmian (frontendu lub Cloud Functions) jest zablokowana do czasu setup'u nowego komputera.

---

## 📋 CHECKLIST przed wyjściem z domu (1 minuta nawyk)

Po każdej sesji rozwoju:
- [ ] `git status` w obu repo (FleetStat + vbs-invoices) — czy wszystko zacommitowane?
- [ ] `git push` w obu — wypchnięte do GitHub?
- [ ] `tail -1 ~/Library/Logs/fleetstat-backup.log` — ostatnia linia z dziś = "success" (lub partial OK)?

---

## 🔍 GDZIE CO LEŻY (kluczowe lokalizacje)

| Co | Gdzie na MacBooku | Backup |
|---|---|---|
| Kod FleetStat | `~/Desktop/VBS-Stat.nosync/` | GitHub `wasikkamil-art/VBS-Stat` |
| Kod vbs-invoices | `~/Desktop/vbs-invoices.nosync/` | GitHub `wasikkamil-art/vbs-invoices` |
| Memory Claude (oba projekty) | `~/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory/` | iCloud `FleetStat-backup/memory/YYYY-MM-DD/` (dzienne snapshots, retention 30d) |
| `.env.local` FleetStat | `~/Desktop/VBS-Stat.nosync/.env.local` | iCloud `FleetStat-backup/env/.env.local` |
| PAT GitHub (FleetStat) | `~/Desktop/VBS-Stat.nosync/.git/config` (plain text) | Tylko lokalnie — generowany nowy po stracie |
| PAT GitHub (vbs-invoices) | `~/Desktop/vbs-invoices.nosync/.git/config` (plain text) | Tylko lokalnie — generowany nowy po stracie |
| Firebase CLI session | `~/.config/firebase/` | Google account (re-login) |
| Hasła paneli (home.pl, OVH, Anthropic) | macOS Keychain | iCloud Keychain (sync auto) |
| Apple Notes | Notes app | iCloud Notes |
| Wszystkie produkcyjne dane | Google Firebase cloud | Multi-region replication automatic |

---

## 🆘 GDYBYŚ STRACIŁ WSZYSTKO (worst case)

Jeśli **stracisz laptop + telefon + 2FA codes** (np. pożar):

1. **Apple ID recovery**: https://iforgot.apple.com → identyfikacja przez prawdziwe imię + nazwisko + dane karty (Apple ma weryfikację tożsamości, trwa ~24h)
2. **Google account recovery**: https://accounts.google.com/signin/recovery → identyfikacja przez powiązany telefon / email + pytania
3. Po odzyskaniu Apple ID → iCloud Keychain wraca → hasła do home.pl, OVH wrócą
4. Po odzyskaniu Google → GitHub OAuth wróci → klonowanie repo → setup
5. **Kod i dane produkcyjne pozostają na cloud** — Google Firebase i GitHub trzymają wszystko, nawet jeśli stracisz dostęp do swoich kont na jakiś czas

---

## ✏️ AKTUALIZACJE TEGO DOKUMENTU

Gdy zmieniają się rzeczy — domeny, repo, struktura backup, etc. — **edytuj ten plik** w `~/Desktop/VBS-Stat.nosync/RECOVERY.md` i commit do GitHub. Wtedy zawsze najnowsza wersja jest w repo, dostępna z każdego urządzenia.

Plik jest też częścią dziennych backup memory (jako część repo). Powtórnie zapisany w iCloud przez git history.
