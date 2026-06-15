// Firebase initialization — wydzielone z App.jsx 2026-04-28 (TODO #5c krok 2).
// Pozwala lazy-loadowanym komponentom (DriverPanel, TrackerPublicView, GpsCzasPracySection)
// importować Firebase services bez circular dependency z App.jsx.
//
// Eksportowane:
//   - app, db, auth, storage, functions — usługi Firebase
//   - messaging — FCM (może być null jeśli przeglądarka nie wspiera)
//   - pushDiag — diagnostyka push notifications (iOS PWA, standalone, etc.)

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey:            "AIzaSyBJ_1_i_OS3DQ7g0hjJyF6ZTgU9_7LkHcQ",
  authDomain:        "vbs-stats.firebaseapp.com",
  projectId:         "vbs-stats",
  storageBucket:     "vbs-stats.firebasestorage.app",
  messagingSenderId: "331217061974",
  appId:             "1:331217061974:web:375c8931f0cda74ec413f7",
  measurementId:     "G-EJTBVPYH1X",
};

export const app = initializeApp(firebaseConfig);

// initializeFirestore z MEMORY-ONLY cache (bez IndexedDB persistence).
//
// Dlaczego: persistent IndexedDB cache + multiple-tab manager generował
// stale cache emits w onSnapshot listenerach. Po visibilitychange recovery
// (commit 9f94410) re-subscribe → cache emit z pre-write state → setVehicles
// nadpisywało świeże dane → "Reset Tacho wraca", "OC Przewoźnika znika",
// "Pauza Baza znika" (incident 2026-05-06 × 3).
//
// Trade-off: brak instant-load przy ponownym otwarciu (cold network start).
// fleetstat.pl wymaga internetu (Atlas API, login, Firebase Auth) — offline
// mode i tak był nieużywalny. Memory cache = świeże dane zawsze.
let _db;
try {
  _db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch (e) {
  console.warn("Firestore memoryLocalCache niedostępny — fallback na getFirestore default:", e?.message);
  _db = getFirestore(app);
}
export const db = _db;

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(e => console.warn("setPersistence error", e));

export const storage = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

// FCM (Push Notifications) — może być null jeśli przeglądarka nie wspiera.
// App.jsx + DriverPanel używają tylko gdy messaging != null.
export let messaging = null;
try { messaging = getMessaging(app); } catch (e) { console.warn("FCM init skip:", e.message); }

// Diagnostyka push notifications — używana przez registerFCMToken (App.jsx)
// oraz przyciski diagnostyczne w admin panelu.
export const pushDiag = {
  supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document),
  isStandalone: window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true,
};

// Helper do re-init messaging gdy pierwsza próba zfailowała (np. user dał zgodę później)
export function reinitMessaging() {
  if (messaging) return messaging;
  try { messaging = getMessaging(app); return messaging; }
  catch (e) { console.warn("FCM reinit failed:", e?.message); return null; }
}

// --- Uwierzytelnione wywołanie proxy /api/claude ---
// Dokłada Firebase ID token zalogowanego usera jako `Authorization: Bearer ...`.
// Proxy `api/claude.js` weryfikuje ten token (firebase-admin) — bez niego zwraca 401.
// To zamyka otwarte proxy (każdy mógł palić klucz Anthropic) — tylko zalogowani userzy vbs-stats.
// Zwraca surowy Response z fetch, żeby wszystkie call-site'y zachowały własną obsługę odpowiedzi.
// `body` = obiekt Anthropic Messages API ({ model, max_tokens, messages, system? }).
export async function callClaude(body) {
  const user = auth.currentUser;
  if (!user) throw new Error("Brak zalogowanego użytkownika — zaloguj się ponownie.");
  const token = await user.getIdToken();
  return fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}
