// CopyOrderPreviewModal — podgląd sformatowanego zlecenia gotowego do przeklejenia
// (Signal, SMS, email, Telegram — cokolwiek kierowca używa). Obsługuje Z1+Z2 +
// R1-R5 z GPS per punkt. User może edytować treść przed skopiowaniem.
//
// Wydzielone z monolitu App.jsx 2026-04-28 jako pierwszy krok TODO #5c
// (code splitting komercjalizacji). Lazy-loadowane przez App.jsx — ładuje się
// dopiero gdy admin/dyspozytor kliknie "Kopiuj dane" w FrachtyModal.

import { useMemo, useState, useRef } from "react";
import { formatOrderForDriverCopy } from "../utils/orderFormatters";

export default function CopyOrderPreviewModal({ fracht, vehicles = [], showToast, onClose }) {
  const initialText = useMemo(() => formatOrderForDriverCopy(fracht, vehicles), [fracht, vehicles]);
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback dla starszych przeglądarek / niesafe context (HTTP)
        textareaRef.current?.select();
        document.execCommand("copy");
      }
      setCopied(true);
      showToast?.("📋 Skopiowano do schowka");
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error("Copy failed:", e);
      showToast?.("Błąd kopiowania — zaznacz tekst ręcznie i kopiuj Ctrl+C");
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{background: "rgba(0,0,0,0.6)", zIndex: 10000}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{maxHeight: "90vh"}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">📋 Skopiuj dane zlecenia</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-5 pt-3 pb-1 text-[11px] text-gray-500">
          Sprawdź / edytuj treść przed kopiowaniem. Po skopiowaniu możesz wkleić np. w Signal, SMS, email.
        </div>
        <div className="px-5 pb-3 flex-1 overflow-hidden flex flex-col">
          <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
            className="w-full h-80 px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono resize-none"
            style={{fontFamily: "'DM Mono', Menlo, monospace", whiteSpace: "pre", lineHeight: 1.5}} />
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <button onClick={() => setText(initialText)}
            className="px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100">
            ↺ Przywróć oryginał
          </button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100">Zamknij</button>
            <button onClick={copyToClipboard}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2"
              style={{background: copied ? "#16a34a" : "#111827"}}>
              {copied ? "✅ Skopiowano" : "📋 Kopiuj do schowka"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
