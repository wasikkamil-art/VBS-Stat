// Wspólne źródło danych dla skryptów raportowych i importowych (Node + firebase-admin).
//
// PO CO: frachty, koszty i IMI wyprowadziliśmy z tablic w `fleet/data` do własnych
// kolekcji (frachty 24.09.2026, koszty i IMI 25.09.2026). Generatory dashboardów oraz
// narzędzia comiesięcznego importu czytały te tablice WPROST — po migracji dostawały
// pustkę i wypluwały raport z samymi zerami, nie zgłaszając żadnego błędu.
// Ten moduł jest jedynym miejscem, które wie, gdzie te dane leżą.
//
// Używać z admin SDK: `const { pobierzFrachty } = await import("./src/utils/daneRaportow.mjs")`
// (skrypty bywają CommonJS, moduł jest ESM — stąd dynamiczny import, jak przy `bucketFor`).

/** Rzuca wyjątkiem zamiast zwrócić pustą listę — cichy raport z zerami jest gorszy niż stop. */
async function pobierzKolekcje(db, nazwa, minimum) {
  const snap = await db.collection(nazwa).get();
  const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  if (lista.length < minimum) {
    throw new Error(
      `${nazwa}: ${lista.length} dokumentów, oczekiwane co najmniej ${minimum}. ` +
      `Nie licz dalej — raport wyszedłby zaniżony. Sprawdź uprawnienia serviceAccountKey i stan bazy.`
    );
  }
  return lista;
}

/** Wszystkie frachty (kolekcja `frachty`, od 24.09.2026; wcześniej tablica + archiwum). */
export async function pobierzFrachty(db, { minimum = 400 } = {}) {
  return pobierzKolekcje(db, "frachty", minimum);
}

/** Wszystkie koszty (kolekcja `costs`, od 25.09.2026; wcześniej `fleet/data.fleetv2_costs`). */
export async function pobierzKoszty(db, { minimum = 900 } = {}) {
  return pobierzKolekcje(db, "costs", minimum);
}

/** Wpisy IMI (kolekcja `imi`, od 25.09.2026; wcześniej `fleet/data.fleetv2_imi`). */
export async function pobierzImi(db, { minimum = 100 } = {}) {
  return pobierzKolekcje(db, "imi", minimum);
}

/** Pojazdy — te ZOSTAŁY tablicą w `fleet/data` (6 szt., nie ciążą). */
export async function pobierzPojazdy(db) {
  const d = (await db.doc("fleet/data").get()).data() || {};
  const v = d.fleetv2_vehicles || [];
  if (!v.length) throw new Error("fleet/data.fleetv2_vehicles puste — sprawdź bazę");
  return v;
}
