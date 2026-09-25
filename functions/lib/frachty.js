// Dostęp do frachtów dla Cloud Functions.
//
// Frachty mieszkają w kolekcji `frachty/{id}` (KROK 3, 2026-09-24). Wcześniej były
// tablicą `fleet/data.fleetv2_frachty` + dokumentem `fleet/frachty_archiwum` na zamknięte
// lata — oba usunięte z bazy razem z obsługującym je kodem (25.09.2026). Powód przenosin:
// tablica dobijała do limitu 1 MiB, a każdy odczyt ciągnął ~700 KB.

const KOL = "frachty";

/** Wszystkie frachty z kolekcji. */
async function pobierzFrachty(db) {
  const snap = await db.collection(KOL).get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

/** Jeden fracht po ID, albo null. */
async function pobierzFracht(db, id) {
  const d = await db.collection(KOL).doc(id).get();
  return d.exists ? { ...d.data(), id: d.id } : null;
}

/**
 * Zapis pól frachtu (merge). Zwraca false, gdy frachtu nie ma — tworzenie go
 * „przy okazji" zapisu byłoby zgadywaniem, więc mówimy wprost, że się nie udało.
 */
async function zapiszFracht(db, id, patch) {
  const ref = db.collection(KOL).doc(id);
  const d = await ref.get();
  if (!d.exists) {
    console.warn(`zapiszFracht: ${id} nie istnieje w kolekcji ${KOL}`);
    return false;
  }
  await ref.set(patch, { merge: true });
  return true;
}

module.exports = { pobierzFrachty, pobierzFracht, zapiszFracht, KOL };
