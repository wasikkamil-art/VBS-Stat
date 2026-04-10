#!/bin/bash
cd ~/Desktop/VBS-Stat.nosync

SIZE=$(wc -c < src/App.jsx)
if [ "$SIZE" -lt 400000 ]; then
  echo "❌ BŁĄD: App.jsx za mały ($SIZE bajtów)"
  exit 1
fi

echo "✅ App.jsx OK: $SIZE bajtów"
git add src/App.jsx
git commit -m "${1:-update App.jsx}"
git push origin main
echo "✅ Deploy gotowy"
