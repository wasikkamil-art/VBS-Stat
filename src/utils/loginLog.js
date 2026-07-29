// Monitoring logowań — zapis wpisu do kolekcji `loginEvents` po udanym logowaniu.
// Kto (uid+email) · kiedy (serverTimestamp) · skąd (IP+miasto+kraj z /api/loginctx,
// czyli serwerowo z krawędzi Vercela) · z jakiego urządzenia (userAgent → przeglądarka/OS).
// Best-effort: NIGDY nie blokuje ani nie opóźnia logowania (fire-and-forget, własny try/catch).
// Wzorzec 1:1 z FOX (fox.fleetstat.pl). Uzupełnia istniejący logAction("login",...) w auditLog,
// który jest client-side (bez IP/geo, spoofable) — tu IP+geo są serwerowe.
// Wersję "hardened" (blocking function beforeUserSignedIn) dołożymy przy MFA/Identity Platform.
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export function parseDevice(ua) {
  if (!ua) return "";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : "Przeglądarka";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux" : "";
  const mobile = /Mobile|iPhone|Android/.test(ua) ? " · mobil" : "";
  return [browser, os].filter(Boolean).join(" · ") + mobile;
}

export async function logLoginEvent(user) {
  if (!user) return;
  try {
    let ctx = {};
    try {
      const r = await fetch("/api/loginctx", { cache: "no-store" });
      if (r.ok) ctx = await r.json();
    } catch { /* geo best-effort — brak nie blokuje wpisu */ }
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    await addDoc(collection(db, "loginEvents"), {
      uid: user.uid,
      email: user.email || "",
      at: serverTimestamp(),
      ip: ctx.ip || "",
      city: ctx.city || "",
      country: ctx.country || "",
      region: ctx.region || "",
      device: parseDevice(ua),
      userAgent: ua,
    });
  } catch (e) {
    console.warn("logLoginEvent:", e?.message || e);
  }
}
