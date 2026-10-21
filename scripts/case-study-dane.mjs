// Generator liczb do case study „Flota pod lupą" (materialy-marketingowe/CASE-STUDY-flota-12mc.md).
//
// PO CO: case study ma być odświeżalny — po zamknięciu kolejnych miesięcy odpalasz to
// jeszcze raz z innym oknem i podmieniasz tabele w .md. Bez tego skryptu liczby trzeba
// by zbierać ręcznie z 5 miejsc w bazie i nikt już nie wie, skąd się wzięły.
//
// UŻYCIE:
//   node scripts/case-study-dane.mjs                       # domyślne okno 2025-10..2026-09
//   node scripts/case-study-dane.mjs 2026-01 2026-12        # własne okno (12 mc zamkniętych)
//
// ⚠️ OKNO MUSI OBEJMOWAĆ TYLKO ZAMKNIĘTE MIESIĄCE. `costs` zawiera przedpłacone pozycje
// cykliczne (polisa, slickshift, telefon, uruchomienie, zus) kilka miesięcy w przód —
// wejście w niezamknięty miesiąc da koszty bez paliwa i wypłat, czyli marżę z sufitu.
//
// ŹRÓDŁA: frachty + costs przez src/utils/daneRaportow.mjs (kolekcje, NIE tablice
// w fleet/data — patrz komentarz w tym module), km z licznika z `vehicleKmMonthly`,
// paliwo z `fuelTransactions/<mc>/tx`, myto z `tollTransactions/<mc>/tx`, tachograf
// z `dddFiles`. Kwoty wszędzie netto EUR.

import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const sa = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url), "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const PLATES = { v1: "WGM 0475M", v2: "TK 130EF", v3: "WGM 5367K", v4: "TK 314CL", v5: "WGM 0507M", v6: "TK 315CL" };

// Podział stały/zmienny użyty do progu opłacalności. `wyplata` i `zus` są po stronie
// stałej, bo empirycznie tak się zachowują: v1 przejechał 20 tys. km mniej niż v5,
// a wypłatę miał niższą tylko o 6% (23 895 vs 25 483 EUR). Gdyby kiedyś wejść na
// rozliczenie czysto kilometrowe, trzeba to przenieść do zmiennych.
const STALE = ["leasing", "wyplata", "zus", "ocpd", "polisa", "uruchomienie", "telefon", "slickshift", "imi"];
const ZMIENNE = ["paliwo", "oplaty", "serwis", "hotele", "mandaty", "inne"];

const R0 = (n) => Math.round(n).toLocaleString("pl-PL");
const FX = (n, d = 3) => Number.isFinite(n) ? Number(n).toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

function okno(od, doo) {
  const out = [];
  let [y, m] = od.split("-").map(Number);
  const [ry, rm] = doo.split("-").map(Number);
  while (y < ry || (y === ry && m <= rm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

const OD = process.argv[2] || "2025-10";
const DO = process.argv[3] || "2026-09";
const MONTHS = okno(OD, DO);
const inW = (m) => MONTHS.includes(m);
const mcFrachtu = (f) => String(f.dataZaladunku || f.dataZlecenia || "").slice(0, 7);
const kmFrachtu = (f) => parseInt(f.kmWszystkie) || parseInt(f.kmLadowne) || 0;

const { pobierzFrachty, pobierzKoszty } = await import("../src/utils/daneRaportow.mjs");
const frachty = await pobierzFrachty(db);
const koszty = await pobierzKoszty(db);

console.log(`# Case study — dane źródłowe`);
console.log(`okno: ${OD}..${DO} (${MONTHS.length} mc) | wygenerowano: ${new Date().toISOString().slice(0, 10)}`);

/* ── 1. Frachty i obrót ───────────────────────────────────────────── */
const fM = {};
let Fn = 0, Feur = 0, Fkm = 0;
for (const f of frachty) {
  const m = mcFrachtu(f); if (!inW(m)) continue;
  const e = parseFloat(f.cenaEur) || 0, k = kmFrachtu(f);
  Fn++; Feur += e; Fkm += k;
  fM[m] ??= { n: 0, eur: 0, km: 0 };
  fM[m].n++; fM[m].eur += e; fM[m].km += k;
}
console.log(`\n## 1. Frachty\nrazem: ${Fn} frachtów | ${R0(Feur)} EUR | ${R0(Fkm)} km | śr. fracht ${R0(Feur / Fn)} EUR | ${FX(Feur / Fkm)} EUR/km`);
console.log("\n| miesiąc | frachty | obrót EUR | km | EUR/km | śr. fracht |\n|---|---|---|---|---|---|");
for (const m of MONTHS) {
  const x = fM[m] ?? { n: 0, eur: 0, km: 0 };
  console.log(`| ${m} | ${x.n} | ${R0(x.eur)} | ${R0(x.km)} | ${x.km ? FX(x.eur / x.km) : "—"} | ${x.n ? R0(x.eur / x.n) : "—"} |`);
}

/* ── 2. Koszty, marża ─────────────────────────────────────────────── */
const kM = {}, kCat = {};
let Ktot = 0;
for (const k of koszty) {
  const m = String(k.date || "").slice(0, 7); if (!inW(m)) continue;
  const c = k.category || "?", v = parseFloat(k.amountEUR) || 0;
  Ktot += v; kCat[c] = (kCat[c] || 0) + v;
  kM[m] ??= { tot: 0, cats: {} };
  kM[m].tot += v; kM[m].cats[c] = (kM[m].cats[c] || 0) + v;
}
console.log(`\n## 2. Koszty i marża\nkoszty: ${R0(Ktot)} EUR | marża: ${R0(Feur - Ktot)} EUR = ${FX((Feur - Ktot) / Feur * 100, 1)}%`);
console.log("\n| kategoria | EUR | % kosztów | EUR/km |\n|---|---|---|---|");
for (const [c, v] of Object.entries(kCat).sort((a, b) => b[1] - a[1]))
  console.log(`| ${c} | ${R0(v)} | ${FX(v / Ktot * 100, 1)}% | ${FX(v / Fkm)} |`);
console.log("\n| miesiąc | obrót | koszty | marża EUR | marża % |\n|---|---|---|---|---|");
for (const m of MONTHS) {
  const kk = (kM[m] ?? { tot: 0 }).tot, ff = (fM[m] ?? { eur: 0 }).eur;
  console.log(`| ${m} | ${R0(ff)} | ${R0(kk)} | ${R0(ff - kk)} | ${ff ? FX((ff - kk) / ff * 100, 1) + "%" : "—"} |`);
}

/* ── 3. P&L i próg opłacalności per auto ──────────────────────────── */
const vKm = {}, vEur = {}, vFr = {}, vC = {};
for (const f of frachty) {
  const m = mcFrachtu(f); if (!inW(m)) continue;
  const v = f.vehicleId || "?";
  vKm[v] = (vKm[v] || 0) + kmFrachtu(f);
  vEur[v] = (vEur[v] || 0) + (parseFloat(f.cenaEur) || 0);
  vFr[v] = (vFr[v] || 0) + 1;
}
for (const k of koszty) {
  const m = String(k.date || "").slice(0, 7); if (!inW(m)) continue;
  const v = k.vehicleId || "?";
  vC[v] ??= {};
  vC[v][k.category] = (vC[v][k.category] || 0) + (parseFloat(k.amountEUR) || 0);
}
const autaCzynne = Object.keys(vKm).filter((v) => vKm[v] > 0).sort((a, b) => vEur[b] - vEur[a]);
console.log("\n## 3. P&L per auto\n\n| poj. | rejestracja | frachty | km | obrót EUR | EUR/km | koszty EUR | marża EUR | marża % |\n|---|---|---|---|---|---|---|---|---|");
for (const v of autaCzynne) {
  const kosz = Object.values(vC[v] ?? {}).reduce((a, b) => a + b, 0);
  console.log(`| ${v} | ${PLATES[v] ?? "?"} | ${vFr[v]} | ${R0(vKm[v])} | ${R0(vEur[v])} | ${FX(vEur[v] / vKm[v])} | ${R0(kosz)} | ${R0(vEur[v] - kosz)} | ${FX((vEur[v] - kosz) / vEur[v] * 100, 1)}% |`);
}
for (const [v, c] of Object.entries(vC)) {
  if (vKm[v]) continue;
  const kosz = Object.values(c).reduce((a, b) => a + b, 0);
  if (kosz > 0) console.log(`| ${v} | ${PLATES[v] ?? "?"} | 0 | 0 | 0 | — | ${R0(kosz)} | ${R0(-kosz)} | — |`);
}
console.log("\n### Próg opłacalności (koszty stałe / marża jednostkowa)\n");
console.log("| poj. | rejestracja | stałe EUR | zmienne EUR/km | stawka EUR/km | marża jedn. | próg km/rok | próg km/mc | realne km/mc |\n|---|---|---|---|---|---|---|---|---|");
let sS = 0, sZ = 0, sK = 0, sE = 0;
for (const v of autaCzynne) {
  const c = vC[v] ?? {}, k = vKm[v], e = vEur[v];
  const st = STALE.reduce((a, x) => a + (c[x] || 0), 0);
  const zm = ZMIENNE.reduce((a, x) => a + (c[x] || 0), 0);
  sS += st; sZ += zm; sK += k; sE += e;
  const contr = e / k - zm / k, be = contr > 0 ? st / contr : NaN;
  console.log(`| ${v} | ${PLATES[v] ?? "?"} | ${R0(st)} | ${FX(zm / k)} | ${FX(e / k)} | ${FX(contr)} | ${R0(be)} | ${R0(be / MONTHS.length)} | ${R0(k / MONTHS.length)} |`);
}
const contrF = sE / sK - sZ / sK, beF = sS / contrF;
console.log(`\nFLOTA (${autaCzynne.length} aut czynnych): stałe ${R0(sS)} EUR | zmienne ${FX(sZ / sK)} EUR/km | stawka ${FX(sE / sK)} EUR/km | marża jedn. ${FX(contrF)} EUR/km`);
console.log(`próg ${R0(beF)} km (= ${R0(beF / autaCzynne.length / MONTHS.length)} km/auto/mc), realnie ${R0(sK)} km → nadwyżka ${R0(sK - beF)} km (${FX((sK - beF) / beF * 100, 1)}%)`);

/* ── 4. Paliwo: cena per kraj i per karta ─────────────────────────── */
const JEST_ON = (p) => ["on", "diesel", "olej", "ON"].includes(String(p));
const fuelKraj = {}, fuelKarta = {}, fuelKrajKarta = {}, fuelMc = {}, fuelPoj = {};
let adblueL = 0, adblueE = 0;
for (const m of MONTHS) {
  const tx = await db.collection("fuelTransactions").doc(m).collection("tx").get();
  for (const d of tx.docs) {
    const x = d.data(), L = parseFloat(x.liters) || 0, e = parseFloat(x.netEUR) || 0;
    if (!JEST_ON(x.product)) { if (String(x.product) === "adblue") { adblueL += L; adblueE += e; } continue; }
    const add = (o, key) => { o[key] ??= { L: 0, e: 0, n: 0 }; o[key].L += L; o[key].e += e; o[key].n++; };
    add(fuelKraj, x.country || "?");
    add(fuelKarta, x.card || "?");
    add(fuelKrajKarta, `${x.country || "?"}|${x.card || "?"}`);
    add(fuelMc, m);
    add(fuelPoj, x.vehicleId || "?");
  }
}
const fL = Object.values(fuelKraj).reduce((a, v) => a + v.L, 0);
const fE = Object.values(fuelKraj).reduce((a, v) => a + v.e, 0);
if (fL > 0) {
  console.log(`\n## 4. Paliwo (ON)\nrazem ${R0(fL)} L | ${R0(fE)} EUR netto | śr. ${FX(fE / fL)} EUR/L | AdBlue ${R0(adblueL)} L / ${R0(adblueE)} EUR`);
  console.log(`⚠️ transakcje paliwowe istnieją dopiero od 2026-05 — ta sekcja pokrywa krótsze okno niż reszta raportu.`);
  console.log("\n| kraj | transakcje | litry | EUR netto | EUR/L |\n|---|---|---|---|---|");
  for (const [c, v] of Object.entries(fuelKraj).sort((a, b) => b[1].L - a[1].L))
    console.log(`| ${c} | ${v.n} | ${R0(v.L)} | ${R0(v.e)} | ${FX(v.e / v.L)} |`);
  const duze = Object.entries(fuelKraj).filter(([, v]) => v.L > 500).sort((a, b) => a[1].e / a[1].L - b[1].e / b[1].L);
  if (duze.length > 1) {
    const lo = duze[0], hi = duze.at(-1);
    console.log(`\nrozpiętość (kraje >500 L): ${lo[0]} ${FX(lo[1].e / lo[1].L)} ↔ ${hi[0]} ${FX(hi[1].e / hi[1].L)} = ${FX(hi[1].e / hi[1].L - lo[1].e / lo[1].L)} EUR/L`);
  }
  console.log(`każdy 0,01 EUR/L średniej ceny = ${R0(fL * 0.01)} EUR na tym oknie`);
  console.log("\n| karta | transakcje | litry | EUR/L |\n|---|---|---|---|");
  for (const [c, v] of Object.entries(fuelKarta).sort((a, b) => b[1].L - a[1].L))
    console.log(`| ${c} | ${v.n} | ${R0(v.L)} | ${FX(v.e / v.L)} |`);
  // Ta sama cena w tym samym kraju, różne karty — oddziela efekt karty od efektu geografii.
  console.log("\n### Karta vs karta w TYM SAMYM kraju (komórki ≥200 L)\n");
  for (const c of [...new Set(Object.keys(fuelKrajKarta).map((k) => k.split("|")[0]))]) {
    const rows = Object.entries(fuelKrajKarta)
      .filter(([k, v]) => k.startsWith(c + "|") && v.L >= 200)
      .map(([k, v]) => ({ card: k.split("|")[1], L: v.L, p: v.e / v.L }))
      .sort((a, b) => a.p - b.p);
    if (rows.length < 2) continue;
    console.log(`- **${c}**: ${rows.map((r) => `${r.card} ${FX(r.p)} (${R0(r.L)} L)`).join(" vs ")} → delta **${FX(rows.at(-1).p - rows[0].p)} EUR/L**`);
  }
}

/* ── 5. Km z licznika vs km z frachtów, spalanie ──────────────────── */
const kmLic = {};
for (const d of (await db.collection("vehicleKmMonthly").get()).docs)
  kmLic[d.id] = Object.values(d.data().vehicles ?? {}).reduce((a, v) => a + (v.km || 0), 0);
const mcLic = MONTHS.filter((m) => kmLic[m]);
if (mcLic.length) {
  console.log("\n## 5. Km z licznika vs km z frachtów (puste przebiegi) i spalanie\n");
  console.log("| miesiąc | licznik km | frachty km | różnica | % | litry | L/100km | paliwo EUR/km |\n|---|---|---|---|---|---|---|---|");
  for (const m of mcLic) {
    const kl = kmLic[m], kf = (fM[m] ?? { km: 0 }).km, p = fuelMc[m], pal = (kM[m] ?? { cats: {} }).cats.paliwo || 0;
    console.log(`| ${m} | ${R0(kl)} | ${R0(kf)} | ${R0(kl - kf)} | ${FX((kl - kf) / kl * 100, 1)}% | ${p ? R0(p.L) : "—"} | ${p ? FX(p.L / kl * 100, 2) : "—"} | ${FX(pal / kl)} |`);
  }
  const mcPal = mcLic.filter((m) => fuelMc[m]);
  const sumLic = mcLic.reduce((a, m) => a + kmLic[m], 0);
  const sumFr = mcLic.reduce((a, m) => a + (fM[m]?.km || 0), 0);
  console.log(`\nrazem: licznik ${R0(sumLic)} km, frachty ${R0(sumFr)} km → ${FX((sumLic - sumFr) / sumLic * 100, 1)}% km bez przypisanego frachtu`);
  if (mcPal.length) {
    const pl = mcPal.reduce((a, m) => a + fuelMc[m].L, 0), pk = mcPal.reduce((a, m) => a + kmLic[m], 0);
    console.log(`spalanie na oknie paliwowym (${mcPal.length} mc): ${FX(pl / pk * 100, 2)} L/100km | 1 L/100km różnicy = ${R0(pk / 100 * (fE / fL))} EUR`);
  }
  if (Object.keys(fuelPoj).length) {
    // Km zliczamy TYLKO z miesięcy, w których są transakcje paliwowe. Inaczej litry
    // z 5 miesięcy dzielilibyśmy przez km z 12 i spalanie wyszłoby o połowę za niskie.
    const kmPoj = {};
    for (const d of (await db.collection("vehicleKmMonthly").get()).docs) {
      if (!mcPal.includes(d.id)) continue;
      for (const [v, o] of Object.entries(d.data().vehicles ?? {})) kmPoj[v] = (kmPoj[v] || 0) + (o.km || 0);
    }
    console.log(`\nSpalanie per auto — okno paliwowe ${mcPal[0]}..${mcPal.at(-1)}:\n`);
    console.log("| poj. | rejestracja | litry | km licznik | L/100km | śr. cena EUR/L |\n|---|---|---|---|---|---|");
    for (const [v, x] of Object.entries(fuelPoj).sort((a, b) => b[1].L - a[1].L))
      console.log(`| ${v} | ${PLATES[v] ?? "?"} | ${R0(x.L)} | ${R0(kmPoj[v] || 0)} | ${kmPoj[v] ? FX(x.L / kmPoj[v] * 100, 2) : "—"} | ${FX(x.e / x.L)} |`);
  }
}

/* ── 6. Myto per kraj ─────────────────────────────────────────────── */
const tollKraj = {}, tollMc = {};
for (const m of MONTHS) {
  const tx = await db.collection("tollTransactions").doc(m).collection("tx").get();
  for (const d of tx.docs) {
    const x = d.data(), e = parseFloat(x.amountEUR) || 0, c = x.country || "?";
    tollKraj[c] ??= { e: 0, n: 0 };
    tollKraj[c].e += e; tollKraj[c].n++;
    tollMc[m] ??= { e: 0, n: 0 };
    tollMc[m].e += e; tollMc[m].n++;
  }
}
if (Object.keys(tollKraj).length) {
  const tE = Object.values(tollKraj).reduce((a, v) => a + v.e, 0);
  console.log(`\n## 6. Myto\nrazem ${R0(tE)} EUR na oknie z transakcjami (${Object.keys(tollMc).join(", ")})`);
  console.log("\n| kraj | przejazdy | EUR | % | EUR/przejazd |\n|---|---|---|---|---|");
  for (const [c, v] of Object.entries(tollKraj).sort((a, b) => b[1].e - a[1].e))
    console.log(`| ${c} | ${v.n} | ${R0(v.e)} | ${FX(v.e / tE * 100, 1)}% | ${FX(v.e / v.n, 2)} |`);
}

/* ── 7. Tachograf (DDD) ───────────────────────────────────────────── */
const kierowcy = {};
for (const d of (await db.collection("dddFiles").where("parseStatus", "==", "success").get()).docs) {
  const x = d.data(), s = x.summary ?? {};
  // Parser DDD zwraca polskie znaki w latin-1 („Miros³aw" = „Mirosław"). Podmiana tylko
  // na potrzeby wydruku — w bazie zostaje jak było.
  const n = String(x.driverName || "?").replace(/\u00b3/g, "ł").replace(/\u00bf/g, "ż").replace(/\u00b9/g, "ą").replace(/\u00e6/g, "ć").replace(/\u00ea/g, "ę").replace(/\u00f1/g, "ń").replace(/\u009c/g, "ś").replace(/\u008f/g, "Ź");
  if (n === "?" || !s.daysWithCard) continue;
  // Jeden kierowca ma wiele wgranych plików DDD (każde zrzucenie karty to nowy plik),
  // a każdy obejmuje cały okres karty. Bierzemy TYLKO najszerszy — sumowanie plików
  // liczyłoby te same dni po kilka razy.
  if (!kierowcy[n] || s.daysWithCard > kierowcy[n].span)
    kierowcy[n] = { span: s.daysWithCard, drive: s.totalDriveMin || 0, km: s.totalKm || 0, dni: s.daysWorked || 0, od: x.periodStart, do: x.periodEnd };
}
if (Object.keys(kierowcy).length) {
  console.log("\n## 7. Tachograf (DDD — najszerszy plik per kierowca)\n");
  console.log("| kierowca | okres | dni z kartą | dni pracy | wykorzystanie | h jazdy | km | h jazdy/dzień | km/h jazdy |\n|---|---|---|---|---|---|---|---|---|");
  let tD = 0, tK = 0, tDni = 0, tSpan = 0;
  for (const [n, v] of Object.entries(kierowcy).sort((a, b) => b[1].km - a[1].km)) {
    const h = v.drive / 60;
    tD += v.drive; tK += v.km; tDni += v.dni; tSpan += v.span;
    console.log(`| ${n} | ${v.od}..${v.do} | ${v.span} | ${v.dni} | ${FX(v.dni / v.span * 100, 1)}% | ${R0(h)} | ${R0(v.km)} | ${FX(h / v.dni, 1)} | ${FX(v.km / h, 1)} |`);
  }
  console.log(`\nrazem: ${R0(tD / 60)} h jazdy | ${R0(tK)} km | ${tDni} dni pracy / ${tSpan} dni z kartą = ${FX(tDni / tSpan * 100, 1)}% wykorzystania | śr. ${FX(tK / (tD / 60), 1)} km/h jazdy`);
}

process.exit(0);
