// Rozliczenie trasy — „plan kontra wykonanie" (Etap 2 planera).
//
// Plan powstał w Kalkulatorze tras (`planyTras/{frachtId}`). Tu zbieramy, jak
// kurs poszedł naprawdę, i wypisujemy ODCHYLENIA — bez oceniania kierowcy
// (decyzja usera 2026-09-23: lista różnic, nie punktacja).
//
// Źródła i ich pułapki:
//  • `gpsBreadcrumbs` — lat/lng/ts/speed/mileage/cc co minutę, ale **żyją 7 dni**
//    (cleanupBreadcrumbs). Dlatego rozliczenie liczymy przy ZAMYKANIU kursu i
//    zamrażamy tu ślad; później byłoby już po ptakach.
//  • `mileage` z CAN = licznik pojazdu → najuczciwsze kilometry (nie routing).
//  • `driverActivities` — jazda/przerwy; DDD ma pierwszeństwo nad GPS, ale karta
//    spływa dopiero przy zgraniu, więc świeży kurs bywa liczony z GPS.
//  • `driverEvents` — `dotarcie_rozladunek` to moment dojazdu wg kierowcy.
//  • `fuelTransactions` — tankowania kartami w oknie kursu.

const POSTOJ_MIN = 20;          // od tylu minut bez ruchu mówimy „postój"
const TOLERANCJA_KM = 0.05;     // 5% różnicy kilometrów to jeszcze nie odchylenie
const TOLERANCJA_MIN = 30;      // pół godziny różnicy w dojeździe to nie odchylenie
const PAUZA_MIN = 45;

const MIN = 60000;

// „7 h 27 min" czyta się lepiej niż „447 min" — to trafia na oczy dyspozytora.
const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? " " + (min % 60) + " min" : ""}` : `${min} min`);

/** Odległość w km między dwoma punktami (haversine) — do wykrywania postojów. */
function odleglosc(a, b) {
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Punkty GPS pojazdu w oknie kursu (posortowane). */
async function sladPojazdu(db, vehicleId, odMs, doMs) {
  const snap = await db.collection("gpsBreadcrumbs").doc(vehicleId).collection("points")
    .where("ts", ">=", odMs).where("ts", "<=", doMs).orderBy("ts").get();
  return snap.docs.map(d => d.data()).filter(p => p && isFinite(p.lat) && isFinite(p.lng));
}

/** Postoje: ciągi punktów bez ruchu dłuższe niż POSTOJ_MIN. */
function wykryjPostoje(punkty) {
  const postoje = [];
  let start = null, ostatni = null;
  for (const p of punkty) {
    const stoi = (p.speed || 0) < 3;
    if (stoi) {
      if (!start) start = p;
      ostatni = p;
      // „stoi", ale odjechał od miejsca startu postoju → to nie ten sam postój
      if (odleglosc(start, p) > 1) { start = p; }
    } else {
      if (start && ostatni) {
        const minut = Math.round((ostatni.ts - start.ts) / MIN);
        if (minut >= POSTOJ_MIN) postoje.push({ odMs: start.ts, doMs: ostatni.ts, minut, lat: start.lat, lng: start.lng, cc: start.cc || null });
      }
      start = null; ostatni = null;
    }
  }
  if (start && ostatni) {
    const minut = Math.round((ostatni.ts - start.ts) / MIN);
    if (minut >= POSTOJ_MIN) postoje.push({ odMs: start.ts, doMs: ostatni.ts, minut, lat: start.lat, lng: start.lng, cc: start.cc || null });
  }
  return postoje;
}

/** Kilometry z licznika CAN — RÓŻNICA MAX−MIN, nie suma kroków.
 *  Dane bywają zakłócone: część punktów podaje zamrożoną wartość licznika i wraca
 *  do właściwej (case v4 17.09.2026: 91 skoków tam i z powrotem o ~90 km), więc
 *  sumowanie różnic zawyżało przebieg ośmiokrotnie. Licznik jest monotoniczny,
 *  więc uczciwa odpowiedź to max − min w oknie.
 *  Podział na kraje liczymy geometrycznie (odległości między punktami) i skalujemy
 *  do sumy z licznika — inaczej pojedynczy błędny punkt psuje cały kraj. */
function kmZLicznika(punkty) {
  const mil = punkty.map(p => Number(p.mileage)).filter(x => isFinite(x) && x > 0);
  let km = null;
  if (mil.length >= 2) {
    const roznica = Math.max(...mil) - Math.min(...mil);
    // >3000 km w jednym kursie = raczej reset licznika/zmiana urządzenia niż przejazd
    km = roznica >= 0 && roznica < 3000 ? Math.round(roznica) : null;
  }
  // Geometria per kraj (haversine) — do proporcji
  const geo = {}; let geoSuma = 0;
  for (let i = 1; i < punkty.length; i++) {
    const d = odleglosc(punkty[i - 1], punkty[i]);
    if (!(d > 0) || d > 30) continue;                 // 30 km między punktami = luka w danych
    const cc = punkty[i].cc || punkty[i - 1].cc;
    geoSuma += d;
    if (cc) geo[cc] = (geo[cc] || 0) + d;
  }
  const perKraj = {};
  if (geoSuma > 0) {
    const skala = km && km > 0 ? km / geoSuma : 1;
    for (const [cc, d] of Object.entries(geo)) perKraj[cc] = Math.round(d * skala);
  }
  return { km: km ?? (geoSuma ? Math.round(geoSuma) : null), perKraj, kmZGeometrii: Math.round(geoSuma) };
}

/** Czas jazdy i przerwy z segmentów czasu pracy w oknie kursu. */
function czasPracyWOknie(segmenty, odMs, doMs) {
  let jazdaMin = 0; const przerwy = [];
  let zrodloDdd = false;
  for (const s of segmenty) {
    const st = Date.parse(s.startTs), en = s.endTs ? Date.parse(s.endTs) : doMs;
    if (!isFinite(st)) continue;
    const od = Math.max(st, odMs), doo = Math.min(en, doMs);
    if (doo <= od) continue;
    const minut = Math.round((doo - od) / MIN);
    if (s.source === "ddd") zrodloDdd = true;
    if (s.type === "drive") jazdaMin += minut;
    else if ((s.type === "rest" || s.type === "avail") && minut >= 15) {
      przerwy.push({ odMs: od, minut, typ: s.type, source: s.source || null });
    }
  }
  return { jazdaMin, przerwy, zrodloDdd };
}

/**
 * Buduje rozliczenie kursu. Zwraca obiekt do zapisu w `realizacjeTras/{frachtId}`.
 * Nie zapisuje — zapis robi wołający.
 */
async function rozliczTrase(db, fracht, plan, events) {
  const frachtId = fracht.id;
  const wyjazdMs = plan?.wyjazdAt ? Date.parse(plan.wyjazdAt) : null;
  const dotarcie = (events || []).filter(e => e.type === "dotarcie_rozladunek" && e.ts)
    .map(e => Date.parse(e.value || e.ts)).filter(isFinite).sort((a, b) => b - a)[0] || null;
  const koniecMs = dotarcie || Date.now();
  const startMs = wyjazdMs || (koniecMs - 3 * 24 * 3600000);

  const punkty = await sladPojazdu(db, fracht.vehicleId, startMs, koniecMs);
  const licznik = kmZLicznika(punkty);
  const postoje = wykryjPostoje(punkty);

  // Czas pracy kierowcy w oknie kursu
  const kierowca = plan?.kierowca || null;
  let czas = { jazdaMin: 0, przerwy: [], zrodloDdd: false };
  if (kierowca) {
    const segSnap = await db.collection("driverActivities")
      .where("driverEmail", "==", kierowca)
      .where("startTs", ">=", new Date(startMs - 12 * 3600000).toISOString())
      .where("startTs", "<=", new Date(koniecMs).toISOString())
      .get();
    czas = czasPracyWOknie(segSnap.docs.map(d => d.data()), startMs, koniecMs);
  }

  // Tankowania w oknie kursu (miesiące mogą być dwa — kurs przez przełom)
  const miesiace = [...new Set([startMs, koniecMs].map(ms => new Date(ms).toISOString().slice(0, 7)))];
  const tankowania = [];
  for (const m of miesiace) {
    const snap = await db.collection("fuelTransactions").doc(m).collection("tx").get();
    snap.forEach(d => {
      const t = d.data() || {};
      const ts = Date.parse(t.ts || t.date || "");
      if (t.vehicleId === fracht.vehicleId && isFinite(ts) && ts >= startMs - 12 * 3600000 && ts <= koniecMs + 12 * 3600000) {
        tankowania.push({ ts: t.ts || t.date, litry: t.liters || 0, netEUR: t.netEUR || 0, station: t.station || null, cc: t.country || null, product: t.product || null });
      }
    });
  }
  const litryFakt = Math.round(tankowania.filter(t => t.product !== "adblue").reduce((a, t) => a + (Number(t.litry) || 0), 0));
  const paliwoFaktEUR = Math.round(tankowania.filter(t => t.product !== "adblue").reduce((a, t) => a + (Number(t.netEUR) || 0), 0) * 100) / 100;

  // Kilometry z licznika z Trip Summary (kmStart/kmEnd) — najpewniejsze, gdy są
  const kmTrip = (Number(fracht.kmEnd) > 0 && Number(fracht.kmStart) > 0)
    ? Math.round(Number(fracht.kmEnd) - Number(fracht.kmStart)) : null;
  const kmFakt = kmTrip ?? (licznik.km || null);

  // ── Odchylenia — fakty, nie oceny ──
  const odchylenia = [];
  const dodaj = (typ, tekst, dane = {}) => odchylenia.push({ typ, tekst, ...dane });

  if (plan?.km && kmFakt) {
    const roznica = kmFakt - plan.km;
    if (Math.abs(roznica) / plan.km > TOLERANCJA_KM) {
      dodaj("km", `Kilometry: plan ${plan.km} km, licznik ${kmFakt} km (${roznica > 0 ? "+" : ""}${roznica} km, ${(roznica / plan.km * 100).toFixed(0)}%)`, { plan: plan.km, fakt: kmFakt });
    }
  }
  if (plan?.etaAt && dotarcie) {
    const roznicaMin = Math.round((dotarcie - Date.parse(plan.etaAt)) / MIN);
    if (Math.abs(roznicaMin) > TOLERANCJA_MIN) {
      dodaj("dojazd", `Dojazd: plan ${new Date(plan.etaAt).toISOString().slice(11, 16)}, faktycznie ${new Date(dotarcie).toISOString().slice(11, 16)} (${roznicaMin > 0 ? "później o " : "wcześniej o "}${Math.abs(roznicaMin)} min)`, { planMs: Date.parse(plan.etaAt), faktMs: dotarcie, roznicaMin });
    }
  }
  if (plan?.jazdaMin && czas.jazdaMin) {
    const r = czas.jazdaMin - plan.jazdaMin;
    if (Math.abs(r) > 45) {
      dodaj("jazda", `Czas jazdy: plan ${hm(Math.round(plan.jazdaMin))}, ${czas.zrodloDdd ? "tachograf" : "GPS"} ${hm(Math.round(czas.jazdaMin))} (${r > 0 ? "+" : ""}${Math.round(r)} min)`, { plan: plan.jazdaMin, fakt: czas.jazdaMin, zrodlo: czas.zrodloDdd ? "ddd" : "gps" });
    }
  }
  // Pauzy: ile z planowanych 45-minutowych faktycznie trwało ≥45 min
  const pauzPlan = (plan?.postoje || []).filter(p => p.typ === "pauza").length;
  const pauzFakt = czas.przerwy.filter(p => p.minut >= PAUZA_MIN).length;
  if (pauzPlan && pauzFakt < pauzPlan) {
    const krotkie = czas.przerwy.filter(p => p.minut >= 15 && p.minut < PAUZA_MIN);
    dodaj("pauzy", `Pauzy 45 min: w planie ${pauzPlan}, w danych ${pauzFakt}${krotkie.length ? ` (${krotkie.length} przerw krótszych: ${krotkie.map(k => k.minut + " min").join(", ")})` : ""}`, { plan: pauzPlan, fakt: pauzFakt });
  }
  // Postoje, których plan nie przewidywał (nie licząc tych w miejscach pauz/odpoczynków)
  const planoweMs = (plan?.postoje || []).map(p => Date.parse(p.odAt)).filter(isFinite);
  const nieplanowane = postoje.filter(s => !planoweMs.some(m => Math.abs(m - s.odMs) < 90 * MIN) && s.minut >= 30);
  for (const s of nieplanowane.sort((a, b) => b.minut - a.minut).slice(0, 5)) {
    // Postój ≥6 h to najpewniej odpoczynek (dobowy albo skrócony), tylko w innym
    // miejscu, niż zakładał plan — nie mylmy go z nieplanowanym staniem w korku.
    const opis = s.minut >= 6 * 60 ? " — poza planem (najpewniej odpoczynek)" : " — poza planem";
    dodaj("postoj", `Postój ${hm(s.minut)}${s.cc ? " w " + s.cc : ""} o ${new Date(s.odMs).toISOString().slice(11, 16)}${opis}`, { odMs: s.odMs, minut: s.minut, lat: s.lat, lng: s.lng });
  }
  if (plan?.litry && litryFakt) {
    const r = litryFakt - plan.litry;
    if (Math.abs(r) / plan.litry > 0.15) {
      dodaj("paliwo", `Paliwo: plan ${plan.litry} L, zatankowane w trasie ${litryFakt} L (${r > 0 ? "+" : ""}${r} L) — uwaga, tankowanie nie musi pokrywać się z przejazdem`, { plan: plan.litry, fakt: litryFakt });
    }
  }

  // Ślad do mapy — co ~2 minuty, max 600 punktów (dokument musi się zmieścić)
  const krok = Math.max(1, Math.ceil(punkty.length / 600));
  const slad = punkty.filter((_, i) => i % krok === 0).map(p => [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5]);

  return {
    frachtId,
    policzoneAt: new Date().toISOString(),
    vehicleId: fracht.vehicleId || null,
    kierowca,
    okno: { odAt: new Date(startMs).toISOString(), doAt: new Date(koniecMs).toISOString(), dojazdZEventu: !!dotarcie },
    plan: plan ? { km: plan.km, jazdaMin: plan.jazdaMin, etaAt: plan.etaAt, litry: plan.litry, kosztRazem: plan.kosztRazem, pauz: pauzPlan } : null,
    fakt: {
      km: kmFakt, kmZrodlo: kmTrip ? "licznik kursu (kmStart/kmEnd)" : (licznik.km ? "licznik CAN z GPS" : "brak"),
      kmPerKraj: licznik.perKraj, jazdaMin: czas.jazdaMin, zrodloCzasu: czas.zrodloDdd ? "tachograf (DDD)" : "GPS",
      pauz: pauzFakt, przerwy: czas.przerwy.map(p => ({ odMs: p.odMs, minut: p.minut, typ: p.typ })),
      postoje, litry: litryFakt, paliwoEUR: paliwoFaktEUR, tankowan: tankowania.length,
      dojazdAt: dotarcie ? new Date(dotarcie).toISOString() : null,
    },
    odchylenia,
    slad,
    punktowGps: punkty.length,
    braki: [
      ...(punkty.length === 0 ? ["brak śladu GPS w oknie kursu (breadcrumbs żyją 7 dni — rozlicz kurs krótko po zakończeniu)"] : []),
      ...(!plan ? ["brak zapisanego planu — nie ma z czym porównać"] : []),
      ...(!kierowca ? ["plan bez kierowcy — czas jazdy i pauzy nieliczone"] : []),
      ...(!dotarcie ? ["brak zdarzenia „dotarcie rozładunek” — jako dojazd przyjęto moment liczenia"] : []),
    ],
  };
}

module.exports = { rozliczTrase, wykryjPostoje, kmZLicznika, czasPracyWOknie, POSTOJ_MIN };
