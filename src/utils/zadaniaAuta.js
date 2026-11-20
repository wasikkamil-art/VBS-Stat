// zadaniaAuta — „Do zrobienia na bazie": lista prac przy aucie (opony, olej, naprawy) wpisywana
// przez biuro z kafelka Przeglądu. Jedno zadanie = jeden dokument w kolekcji `zadaniaAuta`:
//   { vehicleId, plate, tytul, opis, termin: "YYYY-MM-DD" | "", status: "otwarte" | "zrobione" | "usuniete",
//     zrobioneAt, zrobioneBy, zalaczniki: [{ id, url, nazwa, path, ts, kto }],
//     powiadom: [e-maile osób z biura, które dostają maile o TYM zadaniu],
//     historia: [{ id, ts, kto, typ, opis }], createdAt, createdBy, updatedAt, updatedBy }
// Ustalenia usera 20.11.2026: termin jest OBOWIĄZKOWY (auto stoi na bazie np. 3 dni — tyle jest czasu);
// termin można przestawić tylko z notatką „dlaczego" — zostaje ślad kto, z jakiej daty na jaką i powód.
// Maile wysyłają Cloud Functions (`functions/lib/zadaniaAuta.js`): od razu po dodaniu, od razu po zmianie
// terminu i codziennie 7:00 pon–pt, dopóki zadanie nie jest odhaczone.
// „Usunięcie" to status, nie skasowanie dokumentu — inaczej zdarzenia znikałyby z chronologii.
// Tu sama logika (bez Firebase i bez Reacta), żeby dało się ją sprawdzić skryptem.

export const PODPOWIEDZI_ZADAN = ["Zmiana opon", "Wymiana oleju", "Przegląd", "Naprawa", "Mycie"];

const losowe = () => Math.random().toString(36).slice(2, 10);

export const TYPY_ZDARZEN = {
  dodano: "Dodano",
  edytowano: "Zmieniono",
  termin: "Zmieniono termin",
  zrobione: "Zrobione",
  cofnieto: "Cofnięto wykonanie",
  zalacznik: "Dodano plik",
  usunieto: "Usunięto",
};

// Wpis do chronologii. `ts` w ISO — wpisy idą do tablicy przez arrayUnion, a tam serverTimestamp nie działa.
export const wpisHistorii = (typ, kto, opis = "", teraz = new Date()) => ({
  id: losowe(), ts: teraz.toISOString(), kto: kto || "", typ, opis: opis || "",
});

export const dzisIso = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; // data LOKALNA, nie UTC
};

export const czyPoTerminie = (z, dzis = dzisIso()) => z.status === "otwarte" && !!z.termin && z.termin < dzis;

// Konta, których NIE pokazujemy na liście „Powiadom e-mailem" i na które maile nie idą.
// `deoen` = zapasowy admin na wypadek zgubienia hasła (user, 20.11.2026) — nikt tej skrzynki nie czyta.
// Dopasowanie po części adresu przed „@". Ta sama lista jest w `functions/lib/zadaniaAuta.js`.
export const KONTA_BEZ_POWIADOMIEN = ["deoen"];
export const czyPowiadamiac = (email) => !KONTA_BEZ_POWIADOMIEN.includes(String(email || "").trim().toLowerCase().split("@")[0]);

export const czystaLista = (emaile) => [...new Set((emaile || []).map(e => (e || "").trim().toLowerCase()).filter(Boolean))].sort();

// Nowe zadanie gotowe do zapisu. Zwraca null, gdy nie ma tytułu albo terminu.
export const noweZadanie = (v, { tytul, opis = "", termin = "", powiadom = [] }, kto, teraz = new Date()) => {
  const t = (tytul || "").trim();
  if (!t || !termin) return null;
  const ts = teraz.toISOString();
  return {
    vehicleId: v.id, plate: v.plate || "", tytul: t, opis: (opis || "").trim(), termin: termin || "",
    status: "otwarte", zrobioneAt: null, zrobioneBy: "", zalaczniki: [], powiadom: czystaLista(powiadom),
    historia: [wpisHistorii("dodano", kto, `termin ${termin}`, teraz)],
    createdAt: ts, createdBy: kto || "", updatedAt: ts, updatedBy: kto || "",
  };
};

// Co się zmieniło przy edycji (poza terminem) — tekst do chronologii. Pusty string = nic.
export const opisZmian = (stare, nowe) => {
  const z = [];
  if ("tytul" in nowe && (nowe.tytul || "").trim() !== (stare.tytul || "")) z.push(`nazwa: „${stare.tytul || ""}” → „${(nowe.tytul || "").trim()}”`);
  if ("opis" in nowe && (nowe.opis || "").trim() !== (stare.opis || "")) z.push("opis");
  if ("powiadom" in nowe && czystaLista(nowe.powiadom).join() !== czystaLista(stare.powiadom).join()) z.push(`powiadomienia: ${czystaLista(nowe.powiadom).map(e => e.split("@")[0]).join(", ") || "nikt"}`);
  return z.join("; ");
};

// Edycja zadania → { pola, wpisy } do zapisu albo { blad }. Zmiana terminu wymaga powodu
// i dostaje WŁASNY wpis w chronologii (z, na, powod) — to on jest „śladem, kto przedłużył i dlaczego".
export const przygotujEdycje = (stare, nowe, kto, teraz = new Date()) => {
  const pola = { tytul: (nowe.tytul || "").trim(), opis: (nowe.opis || "").trim(), termin: nowe.termin || "", powiadom: czystaLista(nowe.powiadom ?? stare.powiadom) };
  if (!pola.tytul) return { blad: "Zadanie musi mieć nazwę." };
  if (!pola.termin) return { blad: "Zadanie musi mieć termin." };
  const wpisy = [];
  if (pola.termin !== (stare.termin || "")) {
    const powod = (nowe.powod || "").trim();
    if (!powod) return { blad: "Zmiana terminu wymaga notatki — wpisz, dlaczego." };
    wpisy.push({ ...wpisHistorii("termin", kto, `${stare.termin || "brak"} → ${pola.termin} — ${powod}`, teraz), z: stare.termin || "", na: pola.termin, powod });
  }
  const co = opisZmian(stare, pola);
  if (co) wpisy.push(wpisHistorii("edytowano", kto, co, teraz));
  return { pola, wpisy };
};

// Ostatnia zmiana terminu (do pokazania w tabeli pod datą) albo null.
export const ostatniaZmianaTerminu = (z) => (z.historia || []).filter(h => h.typ === "termin").sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))[0] || null;

// Otwarte: najpierw z terminem (najbliższy na górze), potem bez terminu wg kolejności dodania.
// Zrobione: ostatnio wykonane na górze.
export const podzielZadania = (zadania) => {
  const otwarte = zadania.filter(z => z.status === "otwarte").sort((a, b) => {
    if (!!a.termin !== !!b.termin) return a.termin ? -1 : 1;
    return (a.termin || "").localeCompare(b.termin || "") || (a.createdAt || "").localeCompare(b.createdAt || "");
  });
  const zrobione = zadania.filter(z => z.status === "zrobione")
    .sort((a, b) => (b.zrobioneAt || "").localeCompare(a.zrobioneAt || ""));
  return { otwarte, zrobione };
};

// Licznik na kafelek Przeglądu: { [vehicleId]: { otwarte, poTerminie } }
export const licznikiZadan = (zadania, dzis = dzisIso()) => {
  const m = {};
  for (const z of zadania) {
    if (z.status !== "otwarte") continue;
    const l = m[z.vehicleId] || (m[z.vehicleId] = { otwarte: 0, poTerminie: 0 });
    l.otwarte++;
    if (czyPoTerminie(z, dzis)) l.poTerminie++;
  }
  return m;
};

// Chronologia auta: zdarzenia wszystkich zadań (także usuniętych) w jednej osi, najnowsze na górze.
export const chronologiaZadan = (zadania) => zadania
  .flatMap(z => (z.historia || []).map(h => ({ ...h, zadanieId: z.id, tytul: z.tytul })))
  .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
