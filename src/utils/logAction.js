// Audit log helper — używany w całym App.jsx (53 miejsc) + lazy-loaded komponentach.
// Wydzielone z App.jsx 2026-04-28 (TODO #5c krok 2) żeby DriverPanel.jsx i inne
// nie musiały re-deklarować tej samej funkcji.
//
// Schema dokumentu w `auditLog` (Firestore):
//   { action, module, details, uid, email, displayName, ts }
//
// Failure mode: try/catch silent — audit log nigdy nie ma blokować user akcji.

import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";

export function logAction(action, module, details = {}) {
  try {
    const u = auth.currentUser;
    addDoc(collection(db, "auditLog"), {
      action,          // "add" | "update" | "delete" | "login" | "logout" | "toggleStatus" ...
      module,          // "payments" | "sprawy" | "pauzy" | "chat" | "vehicles" | "users" | "config" ...
      details,         // { id, name, ... } — dowolne kontekstowe dane
      uid: u?.uid || null,
      email: u?.email || null,
      displayName: u?.displayName || u?.email || null,
      ts: new Date().toISOString(),
    }).catch(e => console.warn("auditLog write fail", e));
  } catch(e) { console.warn("auditLog error", e); }
}
