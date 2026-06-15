import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Inicjalizacja firebase-admin raz na cold start (init bez service accounta —
// verifyIdToken potrzebuje tylko projectId + publicznych kluczy Google, NIE prywatnych creds).
if (!getApps().length) {
  initializeApp({ projectId: "vbs-stats" });
}

// Origin'y z których apka legalnie woła proxy. Wywołania z apki są same-origin
// (relatywny `/api/claude`), więc whitelist to obrona przed cross-origin abuse z innych stron.
const ALLOWED_ORIGINS = [
  "https://fleetstat.pl",
  "https://www.fleetstat.pl",
  "https://vbs-stats.web.app",
  "https://vbs-stats.firebaseapp.com",
];
function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) return true; // preview deploys
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;          // dev
  return false;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // --- Auth: wymagaj ważnego Firebase ID tokena z projektu vbs-stats ---
  // To zamyka otwarte proxy: bez tokena każdy mógł forwardować do Anthropic z naszym kluczem.
  const authz = req.headers.authorization || "";
  const match = authz.match(/^Bearer (.+)$/);
  if (!match) return res.status(401).json({ error: "Brak tokena uwierzytelnienia" });
  try {
    await getAuth().verifyIdToken(match[1]);
  } catch {
    return res.status(401).json({ error: "Token nieprawidłowy lub wygasł" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
