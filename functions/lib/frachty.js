// Dostęp do frachtów dla Cloud Functions (KROK 3, 2026-09-24).
//
// Frachty przeniosły się z tablicy `fleet/data.fleetv2_frachty` do własnej
// kolekcji `frachty/{id}` — tablica dobijała do limitu 1 MiB, a każdy odczyt
// ciągnął ~700 KB. Ten moduł ukrywa przejście: dopóki kolekcja jest pusta,
// czytamy i piszemy po staremu, więc kolejność wdrożeń jest obojętna.
//
// Po sprzątnięciu tablicy (skrypt migracyjny, tryb --sprzataj) stara ścieżka
// zwyczajnie przestanie mieć dane i zostanie martwym kodem do usunięcia.

const KOL = "frachty";
const POLE = "fleetv2_frachty";

/** Czy frachty żyją już w kolekcji? (jeden lekki odczyt) */
async function kolekcjaAktywna(db) {
  const próbka = await db.collection(KOL).limit(1).get();
  return !próbka.empty;
}

/** Wszystkie frachty — z kolekcji albo (przejściowo) z tablicy w fleet/data. */
async function pobierzFrachty(db, fleetData = null) {
  const snap = await db.collection(KOL).get();
  if (!snap.empty) return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  const dane = fleetData || (await db.doc("fleet/data").get()).data() || {};
  return dane[POLE] || [];
}

/** Jeden fracht po ID (kolekcja → tablica bieżąca → archiwum). */
async function pobierzFracht(db, id, fleetData = null) {
  const d = await db.collection(KOL).doc(id).get();
  if (d.exists) return { ...d.data(), id: d.id };
  const dane = fleetData || (await db.doc("fleet/data").get()).data() || {};
  const wBiezacych = (dane[POLE] || []).find(f => f && f.id === id);
  if (wBiezacych) return wBiezacych;
  const arch = await db.doc("fleet/frachty_archiwum").get();
  return arch.exists ? ((arch.data()[POLE] || []).find(f => f && f.id === id) || null) : null;
}

/**
 * Zapis pól frachtu. W kolekcji to zwykły merge; w trybie przejściowym —
 * transakcja na tablicy (tak jak dotąd, żeby nie zgubić równoległych zmian).
 */
async function zapiszFracht(db, id, patch) {
  const ref = db.collection(KOL).doc(id);
  const d = await ref.get();
  if (d.exists) { await ref.set(patch, { merge: true }); return true; }

  const kolekcja = await kolekcjaAktywna(db);
  if (kolekcja) {
    // Kolekcja działa, ale tego frachtu w niej nie ma — tworzenie „przy okazji"
    // zapisu byłoby zgadywaniem, więc mówimy wprost, że się nie udało.
    console.warn(`zapiszFracht: ${id} nie istnieje w kolekcji ${KOL}`);
    return false;
  }
  const fleetRef = db.doc("fleet/data");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(fleetRef);
    const lista = (snap.data() || {})[POLE] || [];
    if (lista.some(f => f && f.id === id)) {
      tx.update(fleetRef, { [POLE]: lista.map(f => f && f.id === id ? { ...f, ...patch } : f) });
      return true;
    }
    const archRef = db.doc("fleet/frachty_archiwum");
    const arch = await tx.get(archRef);
    const stare = (arch.data() || {})[POLE] || [];
    if (!stare.some(f => f && f.id === id)) return false;
    tx.update(archRef, { [POLE]: stare.map(f => f && f.id === id ? { ...f, ...patch } : f) });
    return true;
  });
}

module.exports = { pobierzFrachty, pobierzFracht, zapiszFracht, kolekcjaAktywna, KOL, POLE };
