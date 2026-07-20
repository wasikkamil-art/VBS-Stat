// Helpery formatowania zlecenia — używane przez:
//   - CopyOrderPreviewModal (kopiuj dane dla kierowcy do Signal/SMS/email)
//   - WhatsappSendPreviewModal (wysyłka template do Meta)
//   - App.jsx (inline display różnych miejsc)
//
// Wydzielone z monolitu App.jsx 2026-04-28 jako pierwszy krok TODO #5c
// (code splitting komercjalizacji — pozwala lazy load CopyOrderPreviewModal).

// ── parseGeoString ──
// "50.123, 19.456" → { lat: 50.123, lng: 19.456 } | null
// Format Atlas/widziszwszystko: string "lat,lng" (z opcjonalnymi spacjami).
export function parseGeoString(geo) {
  if (!geo || typeof geo !== "string") return null;
  const [latStr, lngStr] = geo.split(",").map(s => s.trim());
  const lat = Number(latStr), lng = Number(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// ── unloadStops ──
// Rozkłada płaskie pola R1..R5 (`dokodPocztowy`, `dokodMiasto`, `rozladunekAdres`,
// suffix "" dla R1 i "2".."5" dla reszty) na listę punktów rozładunku.
// Zwraca TYLKO stopy które mają jakikolwiek adres — więc długość tablicy = liczba
// realnych rozładunków. Jedno źródło prawdy dla WhatsAppa, kopiowania i list w App.jsx.
export function unloadStops(fracht) {
  if (!fracht) return [];
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    const kod = fracht[`dokodPocztowy${sfx}`];
    const miasto = fracht[`dokodMiasto${sfx}`];
    const adres = fracht[`rozladunekAdres${sfx}`];
    const legacy = fracht[`dokod${sfx}`];
    const full = [adres, [kod, miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const addr = (full || legacy || "").trim();
    if (!addr) continue;
    out.push({
      i, addr,
      krotki: ([kod, miasto].filter(Boolean).join(" ") || legacy || "").trim(),
      geo: fracht[`rozladunekGeo${sfx}`],
      tel: fracht[`rozladunekTelefon${sfx}`],
      data: fracht[`dataRozladunku${sfx}`],
      godz: fracht[`godzRozladunku${sfx}`],
      firma: fracht[`rozladunekFirma${sfx}`],
    });
  }
  return out;
}

// ── allDokody ──
// Krótkie etykiety "dokąd" dla wszystkich stopów (R1..R5) — do list i tabel.
// Zastępuje rozsiane po kodzie `[f.dokod, f.dokod2, f.dokod3]` (ucinało R4/R5).
export function allDokody(fracht) {
  return unloadStops(fracht).map(s => s.krotki).filter(Boolean);
}

// ── formatOrderForDriverCopy ──
// Bogaty tekstowy format zlecenia gotowy do wklejenia kierowcy w Signal/SMS/email
// (poza WhatsApp który używa templatu Meta — patrz formatOrderForWhatsapp).
//
// Format dla kierowcy — TYLKO niezbędne info: BEZ numeru zlecenia, BEZ klienta,
// BEZ vehicle (driver wie co prowadzi), BEZ zleceniodawcy, BEZ cen/marży.
// Obsługuje: pełne Z1+Z2 + R1-R5 z GPS/telefonami/firmą per punkt.
export function formatOrderForDriverCopy(fracht /* , vehicles = [] */) {
  if (!fracht) return "";
  const fmtD = (d) => d ? d.split("-").reverse().join(".") : "—";
  const fmtT = (t) => t || "—";
  const lines = [];

  // ZAŁADUNEK — Z1 i Z2
  const zalPunkty = [];
  const z1full = [fracht.zaladunekAdres, [fracht.zaladunekKodPocztowy, fracht.zaladunekMiasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (z1full || fracht.zaladunekKod) zalPunkty.push({
    idx: "Z1", addr: z1full || fracht.zaladunekKod || "",
    geo: fracht.zaladunekGeo, tel: fracht.zaladunekTelefon,
    data: fracht.dataZaladunku, godz: fracht.godzZaladunku,
    firma: fracht.zaladunekFirma,
  });
  const z2full = [fracht.zaladunekAdres2, [fracht.zaladunekKodPocztowy2, fracht.zaladunekMiasto2].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (z2full || fracht.zaladunekKod2) zalPunkty.push({
    idx: "Z2", addr: z2full || fracht.zaladunekKod2 || "",
    geo: fracht.zaladunekGeo2, tel: fracht.zaladunekTelefon2,
    data: fracht.dataZaladunku2, godz: fracht.godzZaladunku2,
    firma: fracht.zaladunekFirma2,
  });

  if (zalPunkty.length > 0) {
    lines.push("📍 ZAŁADUNEK");
    zalPunkty.forEach(p => {
      const firmaSuffix = p.firma ? ` — ${p.firma}` : "";
      lines.push(`🚩 ${p.idx} — ${fmtD(p.data)} ${fmtT(p.godz)}${firmaSuffix}`);
      if (p.addr) lines.push(`   ${p.addr}`);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`   GPS: ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`);
      if (p.tel) lines.push(`   Tel: ${p.tel}`);
      lines.push("");
    });
  }

  // ROZŁADUNEK — R1 do R5
  const rozPunkty = [];
  for (let i = 1; i <= 5; i++) {
    const sfx = i === 1 ? "" : String(i);
    const kodPocztowy = fracht[`dokodPocztowy${sfx}`];
    const miasto = fracht[`dokodMiasto${sfx}`];
    const adres = fracht[`rozladunekAdres${sfx}`];
    const kodCompat = fracht[`dokod${sfx}`];
    const full = [adres, [kodPocztowy, miasto].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const addr = full || kodCompat || "";
    if (!addr) continue;
    rozPunkty.push({
      idx: `R${i}`, addr,
      geo: fracht[`rozladunekGeo${sfx}`],
      tel: fracht[`rozladunekTelefon${sfx}`],
      data: fracht[`dataRozladunku${sfx}`],
      godz: fracht[`godzRozladunku${sfx}`],
      firma: fracht[`rozladunekFirma${sfx}`],
    });
  }

  if (rozPunkty.length > 0) {
    lines.push("📦 ROZŁADUNEK");
    rozPunkty.forEach(p => {
      const firmaSuffix = p.firma ? ` — ${p.firma}` : "";
      lines.push(`📦 ${p.idx} — ${fmtD(p.data)} ${fmtT(p.godz)}${firmaSuffix}`);
      if (p.addr) lines.push(`   ${p.addr}`);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`   GPS: ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`);
      if (p.tel) lines.push(`   Tel: ${p.tel}`);
      lines.push("");
    });
  }

  // TOWAR
  const towarLines = [];
  if (fracht.towarIloscPalet || fracht.towarOpis) {
    towarLines.push([fracht.towarIloscPalet, fracht.towarOpis].filter(Boolean).join(" × ") || fracht.towarOpis || `${fracht.towarIloscPalet} sztuk`);
  }
  if (fracht.towarPalety) towarLines.push(`Palety: ${fracht.towarPalety}`);
  if (fracht.wagaLadunku) towarLines.push(`Waga: ${fracht.wagaLadunku} kg`);
  if (fracht.zaladunekTyp) towarLines.push(`Załadunek: ${fracht.zaladunekTyp}`);
  if (towarLines.length) {
    lines.push("🧰 TOWAR");
    towarLines.forEach(t => lines.push(`   ${t}`));
    lines.push("");
  }

  if (fracht.uwagi) {
    lines.push("📋 UWAGI");
    lines.push(`   ${fracht.uwagi}`);
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── formatOrderForWhatsapp ──
// Format dla wysyłki do kierowcy przez WhatsApp Cloud API. Zwraca obiekt z
// `body` (treść tekstowa, sygnowana dyspozytorem) + `pickup`/`delivery`
// (pinezki GPS). 4 wiadomości w sumie (text + 2 pinezki + opcjonalny system reminder).
//
// UWAGA: WhatsApp template wymaga zatwierdzenia przez Meta, więc body nie ma
// emoji w nagłówku (bezpieczne dla Cloud API).
export function formatOrderForWhatsapp(fracht) {
  if (!fracht) return { body: "", pickup: null, delivery: null };
  const fmtD = (d) => d ? d.split("-").reverse().join(".") : "—";
  const fmtT = (t) => t || "—";
  const addrZal = (fracht.zaladunekAdres || [fracht.zaladunekKod, fracht.zaladunekKod2, fracht.zaladunekKod3].filter(Boolean).join(" / ") || "").trim();
  const addrRoz = (fracht.rozladunekAdres || allDokody(fracht).join(" / ") || "").trim();
  const pickupGeo = parseGeoString(fracht.zaladunekGeo);
  const deliveryGeo = parseGeoString(fracht.rozladunekGeo);

  const lines = [];
  lines.push(`🚛 Nowe zlecenie${fracht.nrRef ? ` #${fracht.nrRef}` : ""}`);
  lines.push("");
  lines.push(`📍 ZAŁADUNEK — ${fmtD(fracht.dataZaladunku)} ${fmtT(fracht.godzZaladunku)}`);
  if (addrZal) lines.push(addrZal);
  if (pickupGeo) lines.push(`GPS: ${pickupGeo.lat.toFixed(5)}, ${pickupGeo.lng.toFixed(5)}`);
  if (fracht.zaladunekTelefon) lines.push(`Tel: ${fracht.zaladunekTelefon}`);
  lines.push("");
  // Rozładunki R1..R5 — kierowca musi widzieć wszystkie stopy, nie tylko pierwszy.
  // Pinezka `delivery` zostaje na R1 (następny cel nawigacji); kolejne stopy mają GPS w treści.
  const rozStops = unloadStops(fracht);
  const multi = rozStops.length > 1;
  (rozStops.length ? rozStops : [{ i: 1, addr: addrRoz, geo: fracht.rozladunekGeo, tel: fracht.rozladunekTelefon, data: fracht.dataRozladunku, godz: fracht.godzRozladunku, firma: fracht.rozladunekFirma }])
    .forEach(p => {
      const naglowek = multi ? `📍 ROZŁADUNEK ${p.i}/${rozStops.length}` : "📍 ROZŁADUNEK";
      lines.push(`${naglowek} — ${fmtD(p.data)} ${fmtT(p.godz)}${p.firma ? ` — ${p.firma}` : ""}`);
      if (p.addr) lines.push(p.addr);
      const g = parseGeoString(p.geo);
      if (g) lines.push(`GPS: ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`);
      if (p.tel) lines.push(`Tel: ${p.tel}`);
      lines.push("");
    });

  const towarParts = [];
  if (fracht.towarIloscPalet) towarParts.push(`${fracht.towarIloscPalet} ${fracht.towarOpis || "palet"}`);
  else if (fracht.towarOpis) towarParts.push(fracht.towarOpis);
  if (fracht.towarPalety) towarParts.push(fracht.towarPalety);
  if (towarParts.length) lines.push(`📦 ${towarParts.join(", ")}`);
  if (fracht.zaladunekTyp) lines.push(`Załadunek: ${fracht.zaladunekTyp}`);
  if (fracht.wagaLadunku) lines.push(`Waga: ${fracht.wagaLadunku} kg`);
  if (fracht.uwagi) { lines.push(""); lines.push(`ℹ️ ${fracht.uwagi}`); }

  return {
    body: lines.join("\n").trim(),
    pickup: pickupGeo ? { ...pickupGeo, name: "Załadunek", address: addrZal || null } : null,
    delivery: deliveryGeo ? { ...deliveryGeo, name: "Rozładunek", address: addrRoz || null } : null,
  };
}
