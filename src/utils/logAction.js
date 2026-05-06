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

// Diff helper dla fleet/data array writes (vehicles, costs, docs, rent, imi).
// Liczy: removed/added/changed entries z field-level diff. Używane przez safeDbSet
// + atomic helpers żeby zaloguj DOKŁADNIE co kto napisał (debug data loss / regresja).
// Returns null jeśli prev/next nie są arrayami albo brak różnic.
export function computeFleetDiff(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return null;
  const prevById = Object.fromEntries(prev.filter(x => x?.id).map(x => [x.id, x]));
  const nextById = Object.fromEntries(next.filter(x => x?.id).map(x => [x.id, x]));
  const removed = Object.keys(prevById).filter(id => !(id in nextById))
    .map(id => ({ id, plate: prevById[id].plate || prevById[id].name || "?" }));
  const added = Object.keys(nextById).filter(id => !(id in prevById))
    .map(id => ({ id, plate: nextById[id].plate || nextById[id].name || "?" }));
  const changed = [];
  for (const id of Object.keys(prevById)) {
    if (!nextById[id]) continue;
    const p = prevById[id], n = nextById[id];
    const fields = {};
    const allKeys = new Set([...Object.keys(p), ...Object.keys(n)]);
    for (const k of allKeys) {
      const pv = p[k], nv = n[k];
      try {
        if (JSON.stringify(pv) !== JSON.stringify(nv)) {
          const trunc = (v) => {
            if (v == null) return v;
            if (typeof v === "string" && v.length > 60) return v.slice(0, 60) + "...";
            if (typeof v === "object") return "[obj]";
            return v;
          };
          fields[k] = { from: trunc(pv === undefined ? null : pv), to: trunc(nv === undefined ? null : nv) };
        }
      } catch { /* skip non-serializable */ }
    }
    if (Object.keys(fields).length) {
      changed.push({ id, plate: p.plate || n.plate || p.name || "?", fields });
    }
  }
  if (removed.length === 0 && added.length === 0 && changed.length === 0) return null;
  return { removed, added, changed: changed.slice(0, 10), prevCount: prev.length, nextCount: next.length };
}

// Loguj fleet/data write z diff. Source = "safeDbSet" | "atomic" | "init" itp.
// Skip jeśli brak różnic (idempotent write).
export function logFleetWrite(field, prev, next, source = "safeDbSet") {
  const diff = computeFleetDiff(prev, next);
  if (!diff) return;
  logAction("fleetWrite", field, { source, ...diff });
}
