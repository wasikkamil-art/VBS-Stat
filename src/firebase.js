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
  persistentLocalCache,
  persistentMultipleTabManager,
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

// initializeFirestore z persistent cache — dane w IndexedDB, instant load przy
// kolejnym otwarciu, automatyczna synchronizacja w tle. Fallback do getFirestore
// jeśli przeglądarka nie wspiera IndexedDB (Safari prywatne, niektóre webview).
let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  console.warn("Firestore persistent cache niedostępny — fallback na in-memory:", e?.message);
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
