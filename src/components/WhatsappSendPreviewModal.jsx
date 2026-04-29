// WhatsappSendPreviewModal — admin podgląd treści przed wysłaniem zlecenia
// na WhatsApp do kierowcy. Wysyła 4 wiadomości:
//   1. Tekst zlecenia (podpisany dyspozytorem)
//   2. (opcjonalnie) Info systemowe / przypomnienie o aplikacji
//   3. Pinezka GPS załadunku
//   4. Pinezka GPS rozładunku
//
// Wydzielone z monolitu App.jsx 2026-04-29 (TODO #5c krok 5). Lazy-loadowane —
// admin pobiera dopiero gdy kliknie "📱 Wyślij na WhatsApp" w FrachtyModal.

import { useState, useMemo } from "react";
import { httpsCallable } from "firebase/functions";

import { functions } from "../firebase";
import { formatOrderForWhatsapp } from "../utils/orderFormatters";

// System reminder — info systemowe wysyłane razem ze zleceniem (opcjonalne toggle).
// Krótkie przypomnienie o korzystaniu z aplikacji FleetStat zamiast WhatsApp.
const WA_SYSTEM_REMINDER = [
  "ℹ️ *FleetStat — przypomnienie:*",
  "• Zlecenie masz też w aplikacji FleetStat",
  "• Po dojechaniu na załadunek → kliknij *\"Dotarcie na załadunek\"* w apce",
  "• Zrób zdjęcia CMR i towaru",
  "• Po rozładunku → kliknij *\"Dotarcie na rozładunek\"* + zdjęcie CMR",
].join("\n");

export default function WhatsappSendPreviewModal({ fracht, driver, dispatcherName, onClose, onSent, showToast }) {
  const order = useMemo(() => formatOrderForWhatsapp(fracht), [fracht]);
  const [body, setBody] = useState(order.body);
  const [sending, setSending] = useState(false);
  const [sendReminder, setSendReminder] = useState(true);

  const signedPreview = `*${dispatcherName}:*\n${body}`;

  async function send() {
    if (!driver?.uid) { showToast("❌ Brak kierowcy"); return; }
    if (!driver.whatsappNumber) { showToast("❌ Kierowca nie ma numeru WhatsApp"); return; }
    if (!body.trim()) { showToast("❌ Pusta treść"); return; }

    setSending(true);
    try {
      const sendFn = httpsCallable(functions, "sendWhatsappMessage");

      // 1) Tekst zlecenia (podpisany dyspozytorem)
      await sendFn({
        driverUid: driver.uid,
        type: "text",
        content: { body },
        frachtId: fracht?.id || null,
      });

      // 2) Info systemowe (bez podpisu dyspozytora)
      if (sendReminder) {
        await sendFn({
          driverUid: driver.uid,
          type: "text",
          content: { body: WA_SYSTEM_REMINDER, signature: false },
          frachtId: fracht?.id || null,
        });
      }

      // 3) Pinezka załadunku
      if (order.pickup) {
        await sendFn({
          driverUid: driver.uid,
          type: "location",
          content: {
            latitude: order.pickup.lat,
            longitude: order.pickup.lng,
            name: order.pickup.name,
            address: order.pickup.address,
          },
          frachtId: fracht?.id || null,
        });
      }

      // 4) Pinezka rozładunku
      if (order.delivery) {
        await sendFn({
          driverUid: driver.uid,
          type: "location",
          content: {
            latitude: order.delivery.lat,
            longitude: order.delivery.lng,
            name: order.delivery.name,
            address: order.delivery.address,
          },
          frachtId: fracht?.id || null,
        });
      }

      showToast("✅ Zlecenie wysłane na WhatsApp");
      if (onSent) onSent();
      onClose();
    } catch (e) {
      console.error("WhatsApp send error:", e);
      const msg = e?.message || "Nieznany błąd";
      const details = e?.details ? ` [${JSON.stringify(e.details).slice(0, 120)}]` : "";
      if (msg.includes("24 hours") || msg.includes("re-engagement") || msg.includes("outside") || msg.includes("131047")) {
        showToast("⚠️ Okno 24h zamknięte — poproś kierowcę o napisanie do nas WhatsApp albo użyj szablonu");
      } else if (msg.includes("failed-precondition")) {
        showToast("❌ Kierowca nie ma numeru WhatsApp");
      } else if (msg.includes("131030") || msg.includes("not in allowed")) {
        showToast("⚠️ Numer kierowcy nie jest na liście test recipients w Meta");
      } else {
        showToast(`❌ Błąd wysyłki: ${msg.slice(0, 140)}${details}`);
      }
    } finally {
      setSending(false);
    }
  }

  const totalMsgs = 1 + (sendReminder ? 1 : 0) + (order.pickup ? 1 : 0) + (order.delivery ? 1 : 0);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.6)", zIndex: 10000}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{maxHeight:"90vh"}}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">📱 Wyślij zlecenie na WhatsApp</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Do: <strong>{driver?.displayName || driver?.email || "?"}</strong>
              {driver?.whatsappNumber && <span className="text-gray-400"> · +{driver.whatsappNumber}</span>}
              {" · "}Wiadomości: <strong>{totalMsgs}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto" style={{flex:"1 1 auto"}}>
          {/* Treść zlecenia (edytowalna) */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              1️⃣ Treść zlecenia (podpisana: {dispatcherName})
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
              style={{resize:"vertical"}}
            />
            <div className="mt-2 text-xs text-gray-500">
              Kierowca zobaczy: <span className="font-mono bg-gray-50 px-1">*{dispatcherName}:*</span> + treść (jak wyżej).
            </div>
          </div>

          {/* Info systemowe toggle */}
          <div className="mb-4">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReminder}
                onChange={(e) => setSendReminder(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  2️⃣ Info systemowe (przypomnienie o aplikacji)
                </div>
                <pre className="mt-1 p-2 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap font-sans border border-gray-100">
{WA_SYSTEM_REMINDER}
                </pre>
              </div>
            </label>
          </div>

          {/* Pinezki GPS */}
          <div className="space-y-2">
            {order.pickup && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="text-base">📍</span>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-emerald-800">3️⃣ Pinezka załadunku</div>
                  <div className="text-emerald-600">{order.pickup.lat.toFixed(5)}, {order.pickup.lng.toFixed(5)}</div>
                </div>
              </div>
            )}
            {order.delivery && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-base">📍</span>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-blue-800">4️⃣ Pinezka rozładunku</div>
                  <div className="text-blue-600">{order.delivery.lat.toFixed(5)}, {order.delivery.lng.toFixed(5)}</div>
                </div>
              </div>
            )}
            {(!order.pickup || !order.delivery) && (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 p-2 rounded-lg">
                ⚠️ {!order.pickup && "Brak GPS załadunku. "}{!order.delivery && "Brak GPS rozładunku. "}
                Ustaw lokalizację w formularzu żeby wysłać pinezkę.
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={sending}
            className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Anuluj</button>
          <button onClick={send} disabled={sending || !driver?.whatsappNumber}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{background: sending ? "#9ca3af" : "#25D366"}}>
            {sending ? "Wysyłanie..." : `📱 Wyślij (${totalMsgs})`}
          </button>
        </div>
      </div>
    </div>
  );
}
