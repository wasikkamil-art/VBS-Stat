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
