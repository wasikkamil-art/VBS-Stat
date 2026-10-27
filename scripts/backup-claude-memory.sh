#!/bin/bash
# backup-claude-memory.sh
# Codzienny backup memory Claude + .env.local + narzędzi roboczych do iCloud Drive.
# Memory + credentials są LOKALNE (folder *.nosync wykluczony z iCloud) — bez tego skryptu
# utrata MacBooka = utrata preferencji + recovery procedures + Firebase/Anthropic keys.
#
# Usage:
#   ./scripts/backup-claude-memory.sh             # live run
#   ./scripts/backup-claude-memory.sh --dry-run   # podgląd akcji bez kopiowania
#
# Setup auto-run (Krok 2b z 2026-05-04 — TBD): launchd plist codziennie 22:00

set -uo pipefail
# UWAGA: NIE używamy `set -e` — `cp` do iCloud Drive okazjonalnie failuje
# z "Resource deadlock avoided" (race z iCloud sync daemon). Nie chcemy żeby
# pojedynczy fail killa całego skryptu. Track błędów ręcznie w ERRORS.
ERRORS=0
FAILED_STEPS=""   # nazwy kroków, które padły — do podsumowania (zamiast zgadywania „sprawdź .env.local")

# === Konfiguracja ===
SOURCE_MEMORY="$HOME/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory"
SOURCE_ENV="$HOME/Desktop/VBS-Stat.nosync/.env.local"
SOURCE_REPO="$HOME/Desktop/VBS-Stat.nosync"
ICLOUD_BASE="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
DEST_BASE="$ICLOUD_BASE/FleetStat-backup"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +'%Y-%m-%d %H:%M:%S')
RETENTION_DAYS=30

# === Tryb dry-run ===
DRY_RUN=""
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN="echo [DRY] "
    echo "🔍 Tryb DRY-RUN — pokazuję akcje bez wykonania"
    echo
fi

# === Sprawdzenie iCloud Drive ===
if [ ! -d "$ICLOUD_BASE" ]; then
    echo "❌ ERROR: iCloud Drive niedostępny ($ICLOUD_BASE)"
    echo "   Sprawdź System Settings → Apple ID → iCloud → iCloud Drive — czy włączony?"
    exit 1
fi

# === Utworzenie struktury docelowej ===
$DRY_RUN mkdir -p "$DEST_BASE/memory/$DATE"
$DRY_RUN mkdir -p "$DEST_BASE/env"

# === Backup memory (versioned snapshot per dzień) ===
#
# WSZYSTKIE projekty Claude'a, nie tylko FleetStat (zmiana 2026-10-27). Wcześniej
# ścieżka była zaszyta na jeden katalog, więc pamięć z sesji prowadzonych z innego
# repo (FOX, FreeTruck) ani z worktree nie trafiała do kopii w ogóle.
#
# Pamięć głównego projektu ląduje w `memory/$DATE/` jak dotąd (żeby nie łamać
# dotychczasowych snapshotów i procedury odtwarzania), a pozostałe projekty
# w `memory/$DATE/_inne-projekty/<nazwa>/`.
if [ -d "$SOURCE_MEMORY" ]; then
    FILE_COUNT=$(find "$SOURCE_MEMORY" -maxdepth 1 -type f | wc -l | xargs)
    SIZE=$(du -sh "$SOURCE_MEMORY" 2>/dev/null | awk '{print $1}')
    $DRY_RUN cp -R "$SOURCE_MEMORY/" "$DEST_BASE/memory/$DATE/"
    echo "✅ Memory snapshot: $DEST_BASE/memory/$DATE/ ($FILE_COUNT plików, $SIZE)"
else
    echo "⚠️  Source memory nieobecny: $SOURCE_MEMORY (pomijam)"
fi

INNE_N=0
for PROJ_DIR in "$HOME/.claude/projects"/*; do
    [ -d "$PROJ_DIR/memory" ] || continue
    [ "$PROJ_DIR/memory" = "$SOURCE_MEMORY" ] && continue
    PROJ_NAME=$(basename "$PROJ_DIR")
    $DRY_RUN mkdir -p "$DEST_BASE/memory/$DATE/_inne-projekty/$PROJ_NAME"
    $DRY_RUN cp -R "$PROJ_DIR/memory/" "$DEST_BASE/memory/$DATE/_inne-projekty/$PROJ_NAME/"
    INNE_N=$((INNE_N + 1))
    echo "✅ Pamięć innego projektu: $PROJ_NAME ($(find "$PROJ_DIR/memory" -maxdepth 1 -type f | wc -l | xargs) plików)"
done
[ "$INNE_N" -eq 0 ] && echo "ℹ️  Innych projektów z pamięcią brak — kopiowana tylko pamięć główna"

# === Backup transcripts Claude Code (rolling, bez per-dzień snapshotu) ===
# .jsonl transkrypty są lokalne w ~/.claude/projects/.../, append-only.
# Rolling rsync z --update: kopiuje tylko nowe/zmienione, NIE usuwa starych
# (cumulative history — gdyby Claude Code rotował lokalnie, my zachowujemy w backupie).
# WSZYSTKIE projekty, nie tylko FleetStat (zmiana 2026-10-27) — wcześniej transkrypt
# z worktree albo z sesji prowadzonej z innego repo wypadał poza kopię.
# Nazwy plików to UUID-y, więc spłaszczenie do jednego katalogu jest bezkolizyjne.
SOURCE_TRANSCRIPTS="$HOME/.claude/projects"
DEST_TRANSCRIPTS="$DEST_BASE/transcripts"
if [ -d "$SOURCE_TRANSCRIPTS" ]; then
    $DRY_RUN mkdir -p "$DEST_TRANSCRIPTS"
    if [ -n "$DRY_RUN" ]; then
        SRC_COUNT=$(find "$SOURCE_TRANSCRIPTS" -maxdepth 2 -name "*.jsonl" | wc -l | xargs)
        SRC_TOTAL=$(du -ch "$SOURCE_TRANSCRIPTS"/*/*.jsonl 2>/dev/null | tail -1 | awk '{print $1}')
        echo "[DRY] rsync $SRC_COUNT .jsonl files (~$SRC_TOTAL) → $DEST_TRANSCRIPTS/"
    else
        # rsync --update: skip jeśli destination jest nowszy/identyczny; kopiuje nowe + zmienione.
        # Do 2026-09-18 stderr szedł do /dev/null, a błąd był liczony bez podania przyczyny —
        # transkrypty nie trafiały do iCloud od 29.08 i przez 3 tygodnie log mówił o czymś innym.
        # Teraz: 3 próby (iCloud „Resource deadlock avoided" przy plikach w trakcie synchronizacji,
        # ten sam błąd, który obchodzimy dla .env.local), a komunikat rsync ląduje w logu.
        # Kod 24 = plik zniknął w trakcie (aktywna sesja) — to nie jest błąd backupu.
        TR_OK=0
        for ATTEMPT in 1 2 3; do
            RSYNC_ERR=$(rsync -a --update "$SOURCE_TRANSCRIPTS"/*/*.jsonl "$DEST_TRANSCRIPTS/" 2>&1)
            RC=$?
            if [ "$RC" -eq 0 ] || [ "$RC" -eq 24 ]; then TR_OK=1; break; fi
            echo "⚠️  rsync transkryptów: kod $RC (próba $ATTEMPT/3): $(echo "$RSYNC_ERR" | tail -2 | tr '\n' ' ')"
            sleep 5
        done
        if [ "$TR_OK" -eq 0 ]; then
            echo "❌ Transkrypty NIE zsynchronizowane po 3 próbach"
            ERRORS=$((ERRORS + 1))
            FAILED_STEPS="$FAILED_STEPS transkrypty"
        fi
        TC_COUNT=$(find "$DEST_TRANSCRIPTS" -maxdepth 1 -name "*.jsonl" 2>/dev/null | wc -l | xargs)
        TC_SIZE=$(du -sh "$DEST_TRANSCRIPTS" 2>/dev/null | awk '{print $1}')
        echo "✅ Transkrypty: $DEST_TRANSCRIPTS/ ($TC_COUNT plików, $TC_SIZE) — rolling, bez retention"
    fi
fi

# === Backup narzędzi roboczych (.js/.mjs/.py w katalogu głównym repo) ===
# Skrypty cykliczne — generatory raportów (make_dashboard_*, raport_dyspozytorzy_*),
# rekoncyliacja paliwa (reconcile_andamur.mjs), narzędzia importu i migracji — są
# GITIGNORED zgodnie z konwencją z CLAUDE.md, więc `git push` ich NIE zabezpiecza.
# Do 2026-09-25 nie obejmował ich żaden backup: utrata MacBooka = odtwarzanie od zera
# comiesięcznego workflow raportowego. Łącznie ~1,7 MB plików tekstowych.
#
# Rolling, BEZ --delete i bez retencji: skrypt skasowany lokalnie ma zostać w kopii.
# Pliki konfiguracyjne (vite/tailwind/eslint/postcss/playwright) pomijamy — są w repo.
DEST_TOOLS="$DEST_BASE/tools"
if [ -d "$SOURCE_REPO" ]; then
    $DRY_RUN mkdir -p "$DEST_TOOLS"
    if [ -n "$DRY_RUN" ]; then
        TOOL_COUNT=$(find "$SOURCE_REPO" -maxdepth 1 \( -name "*.js" -o -name "*.mjs" -o -name "*.py" \) \
            ! -name "*.config.js" ! -name "*.config.mjs" | wc -l | xargs)
        echo "[DRY] rsync $TOOL_COUNT narzędzi → $DEST_TOOLS/"
    else
        # Ten sam wzorzec co przy transkryptach: iCloud potrafi rzucić
        # „Resource deadlock avoided" na pliku w trakcie synchronizacji. Kod 24 = plik
        # zniknął w trakcie (np. sprzątnięta jednorazówka) — to nie jest błąd backupu.
        TOOLS_OK=0
        for ATTEMPT in 1 2 3; do
            RSYNC_ERR=$(rsync -a --update \
                --include="*.js" --include="*.mjs" --include="*.py" \
                --exclude="*.config.js" --exclude="*.config.mjs" --exclude="*" \
                "$SOURCE_REPO/" "$DEST_TOOLS/" 2>&1)
            RC=$?
            if [ "$RC" -eq 0 ] || [ "$RC" -eq 24 ]; then TOOLS_OK=1; break; fi
            echo "⚠️  rsync narzędzi: kod $RC (próba $ATTEMPT/3): $(echo "$RSYNC_ERR" | tail -2 | tr '\n' ' ')"
            sleep 5
        done
        if [ "$TOOLS_OK" -eq 0 ]; then
            echo "❌ Narzędzia NIE zsynchronizowane po 3 próbach"
            ERRORS=$((ERRORS + 1))
            FAILED_STEPS="$FAILED_STEPS narzędzia"
        fi
        TL_COUNT=$(find "$DEST_TOOLS" -maxdepth 1 -type f 2>/dev/null | wc -l | xargs)
        TL_SIZE=$(du -sh "$DEST_TOOLS" 2>/dev/null | awk '{print $1}')
        echo "✅ Narzędzia: $DEST_TOOLS/ ($TL_COUNT plików, $TL_SIZE) — rolling, bez retention"
    fi
fi

# === Backup atrap podglądowych (podglad/ — bez zrzutów danych) ===
# `podglad/*` to harnessy Vite, którymi oglądamy widoki BEZ logowania (Paliwo, Analizy,
# Kalkulator, Rozliczenie). Są gitignored, a niosą nietrywialną wiedzę: atrapy
# `firebase/firestore`, konfiguracje portów i symulację ról.
# `dane.json` POMIJAMY — to regenerowalne zrzuty z Firestore (do ~1 MB każdy), które
# i tak mają kopię w backupach bazy; kopiowanie ich tu tylko puchłoby bez zysku.
DEST_PODGLAD="$DEST_BASE/podglad"
if [ -d "$SOURCE_REPO/podglad" ]; then
    $DRY_RUN mkdir -p "$DEST_PODGLAD"
    if [ -n "$DRY_RUN" ]; then
        PG_COUNT=$(find "$SOURCE_REPO/podglad" -type f ! -name "dane.json" | wc -l | xargs)
        echo "[DRY] rsync $PG_COUNT plików podglądu (bez dane.json) → $DEST_PODGLAD/"
    else
        PG_OK=0
        for ATTEMPT in 1 2 3; do
            RSYNC_ERR=$(rsync -a --update --exclude="dane.json" --exclude="node_modules" \
                "$SOURCE_REPO/podglad/" "$DEST_PODGLAD/" 2>&1)
            RC=$?
            if [ "$RC" -eq 0 ] || [ "$RC" -eq 24 ]; then PG_OK=1; break; fi
            echo "⚠️  rsync podglądu: kod $RC (próba $ATTEMPT/3): $(echo "$RSYNC_ERR" | tail -2 | tr '\n' ' ')"
            sleep 5
        done
        if [ "$PG_OK" -eq 0 ]; then
            echo "❌ Podgląd NIE zsynchronizowany po 3 próbach"
            ERRORS=$((ERRORS + 1))
            FAILED_STEPS="$FAILED_STEPS podglad"
        fi
        PG_N=$(find "$DEST_PODGLAD" -type f 2>/dev/null | wc -l | xargs)
        PG_S=$(du -sh "$DEST_PODGLAD" 2>/dev/null | awk '{print $1}')
        echo "✅ Podgląd: $DEST_PODGLAD/ ($PG_N plików, $PG_S) — bez dane.json"
    fi
fi

# === Backup .env.local — WSZYSTKIE projekty (1 kopia każdy, overwrite) ===
#
# Do 2026-10-27 kopiowany był TYLKO plik FleetStata, a sekrety FOX-a i FreeTrucka
# istniały wyłącznie na dysku. Te pliki są gitignorowane, więc `git push` ich nie ratuje.
# Pierwszy (FleetStat) zostaje pod starą nazwą `.env.local`, żeby nie łamać procedury
# odtwarzania; pozostałe dostają sufiks z nazwą projektu.
#
# iCloud Drive ma znanego buga "Resource deadlock avoided" przy cp do plików
# które są w trakcie sync. Workaround: rm -f destination + retry 3x z sleep.
kopiuj_env() {
    ZRODLO="$1"; CEL="$2"; NAZWA="$3"
    if [ ! -f "$ZRODLO" ]; then
        echo "ℹ️  $NAZWA: brak pliku ($ZRODLO) — pomijam"
        return 0
    fi
    if [ -n "$DRY_RUN" ]; then
        echo "[DRY] cp $ZRODLO $CEL"
        return 0
    fi
    for ATTEMPT in 1 2 3; do
        rm -f "$CEL" 2>/dev/null || true
        sleep 1
        if cp "$ZRODLO" "$CEL" 2>/dev/null; then
            echo "✅ $NAZWA skopiowany (próba $ATTEMPT): $CEL"
            return 0
        fi
        echo "⚠️  cp $NAZWA fail (próba $ATTEMPT/3) — czekam 3s na iCloud..."
        sleep 3
    done
    echo "❌ $NAZWA NIE skopiowany po 3 próbach (resource deadlock?)"
    ERRORS=$((ERRORS + 1))
    FAILED_STEPS="$FAILED_STEPS $NAZWA"
    return 1
}

kopiuj_env "$SOURCE_ENV" "$DEST_BASE/env/.env.local" ".env.local (FleetStat)"
kopiuj_env "$HOME/Desktop/fox.nosync/.env.local"       "$DEST_BASE/env/.env.local.fox"       ".env.local (FOX)"
kopiuj_env "$HOME/Desktop/freetruck.nosync/.env.local" "$DEST_BASE/env/.env.local.freetruck" ".env.local (FreeTruck)"

# === Manifest log (append-only) — zawsze zapisuje status (success/partial) ===
MANIFEST="$DEST_BASE/manifest.txt"
if [ -z "$DRY_RUN" ]; then
    STATUS_LABEL="success"
    if [ "$ERRORS" -gt 0 ]; then
        STATUS_LABEL="partial ($ERRORS errors)"
    fi
    # Dopisanie do pliku w iCloud też potrafi dostać „Resource deadlock avoided" — 3 próby.
    # Nieudany zapis manifestu NIE jest błędem backupu (dane już są), tylko informacją w logu.
    for ATTEMPT in 1 2 3; do
        if echo "$TIMESTAMP | snapshot $DATE | ${FILE_COUNT:-0} memory files | $STATUS_LABEL" >> "$MANIFEST" 2>/dev/null; then
            break
        fi
        [ "$ATTEMPT" -eq 3 ] && echo "⚠️  manifest.txt: nie dopisano wpisu (iCloud deadlock) — dane backupu są, brakuje tylko linijki w dzienniku"
        sleep 2
    done
fi

# === Retention: usuń memory snapshots starsze niż RETENTION_DAYS ===
if [ -z "$DRY_RUN" ]; then
    DELETED=$(find "$DEST_BASE/memory" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -print -exec rm -rf {} \; 2>/dev/null | wc -l | tr -dc '0-9')
    if [ "${DELETED:-0}" -gt 0 ]; then
        echo "🗑️  Usunięto $DELETED snapshot(s) starszych niż $RETENTION_DAYS dni"
    fi
fi

# === Meldunek („znak życia") do Firestore ===
#
# PO CO: backup, który się NIE uruchomił, nie wyśle powiadomienia, że go nie było.
# Dlatego po każdym przebiegu zostawiamy w bazie ślad, a workflow `heartbeat-mac.yml`
# sprawdza go raz dziennie i PADA, gdy ślad jest przeterminowany — wtedy GitHub wysyła
# maila tym samym kanałem, którym zgłasza padnięte backupy baz.
#
# Firestore, a nie `git push`: skrypt chodzi z launchd i sięganie po klucz SSH z Keychaina
# bywa w tym kontekście zawodne, a konto serwisowe to zwykły plik na dysku.
# Błąd meldunku NIE przerywa backupu — kopia jest ważniejsza niż powiadomienie o niej.
if [ -z "$DRY_RUN" ]; then
    MELDUNEK_STATUS=$([ "$ERRORS" -gt 0 ] && echo "partial" || echo "ok")
    MEM_N=$(ls -1 "$DEST_BASE/memory/$DATE" 2>/dev/null | wc -l | tr -dc '0-9')
    if MELDUNEK_OUT=$(cd "$SOURCE_REPO" && node -e '
      const admin = require("firebase-admin");
      admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });
      admin.firestore().doc("config/backupHeartbeat").set({
        ts: new Date().toISOString(),
        status: process.argv[1],
        bledy: Number(process.argv[2]),
        plikowPamieci: Number(process.argv[3]),
        host: require("os").hostname(),
        zrodlo: "backup-claude-memory.sh",
      }, { merge: true }).then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
    ' "$MELDUNEK_STATUS" "$ERRORS" "${MEM_N:-0}" 2>&1); then
        echo "📡 Meldunek zapisany w Firestore (status: $MELDUNEK_STATUS)"
    else
        echo "⚠️  Meldunek do Firestore nie poszedł: $(echo "$MELDUNEK_OUT" | tail -1)"
        echo "    Backup jest zrobiony — nie zadziała tylko powiadomienie o nim."
    fi
fi

echo
if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  Backup zakończony z $ERRORS błędem(ami) — $TIMESTAMP"
    echo "   Lokalizacja: $DEST_BASE"
    echo "   Nie powiodło się:${FAILED_STEPS:- (krok bez nazwy — patrz komunikaty wyżej)}"
    exit 0  # NIE failujemy launchd job — partial backup też wartościowy
else
    echo "✅ Backup zakończony — $TIMESTAMP"
    echo "   Lokalizacja: $DEST_BASE"
fi
