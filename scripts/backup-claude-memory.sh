#!/bin/bash
# backup-claude-memory.sh
# Codzienny backup memory Claude + .env.local do iCloud Drive.
# Memory + credentials są LOKALNE (folder *.nosync wykluczony z iCloud) — bez tego skryptu
# utrata MacBooka = utrata preferencji + recovery procedures + Firebase/Anthropic keys.
#
# Usage:
#   ./scripts/backup-claude-memory.sh             # live run
#   ./scripts/backup-claude-memory.sh --dry-run   # podgląd akcji bez kopiowania
#
# Setup auto-run (Krok 2b z 2026-05-04 — TBD): launchd plist codziennie 22:00

set -euo pipefail

# === Konfiguracja ===
SOURCE_MEMORY="$HOME/.claude/projects/-Users-kamilwasik-Desktop-VBS-Stat-nosync/memory"
SOURCE_ENV="$HOME/Desktop/VBS-Stat.nosync/.env.local"
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
if [ -d "$SOURCE_MEMORY" ]; then
    FILE_COUNT=$(find "$SOURCE_MEMORY" -maxdepth 1 -type f | wc -l | xargs)
    SIZE=$(du -sh "$SOURCE_MEMORY" 2>/dev/null | awk '{print $1}')
    $DRY_RUN cp -R "$SOURCE_MEMORY/" "$DEST_BASE/memory/$DATE/"
    echo "✅ Memory snapshot: $DEST_BASE/memory/$DATE/ ($FILE_COUNT plików, $SIZE)"
else
    echo "⚠️  Source memory nieobecny: $SOURCE_MEMORY (pomijam)"
fi

# === Backup .env.local (1 kopia, overwrite) ===
if [ -f "$SOURCE_ENV" ]; then
    $DRY_RUN cp "$SOURCE_ENV" "$DEST_BASE/env/.env.local"
    echo "✅ .env.local skopiowany: $DEST_BASE/env/.env.local"
else
    echo "⚠️  Source .env.local nieobecny: $SOURCE_ENV (pomijam)"
fi

# === Manifest log (append-only) ===
MANIFEST="$DEST_BASE/manifest.txt"
if [ -z "$DRY_RUN" ]; then
    echo "$TIMESTAMP | snapshot $DATE | $FILE_COUNT memory files" >> "$MANIFEST"
fi

# === Retention: usuń memory snapshots starsze niż RETENTION_DAYS ===
if [ -z "$DRY_RUN" ]; then
    DELETED=$(find "$DEST_BASE/memory" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -print -exec rm -rf {} \; 2>/dev/null | wc -l | xargs)
    if [ "$DELETED" -gt 0 ]; then
        echo "🗑️  Usunięto $DELETED snapshot(s) starszych niż $RETENTION_DAYS dni"
    fi
fi

echo
echo "✅ Backup zakończony — $TIMESTAMP"
echo "   Lokalizacja: $DEST_BASE"
