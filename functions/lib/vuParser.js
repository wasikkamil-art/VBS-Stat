// ═══════════════════════════════════════════════════════════════════
//  Parser plików VU (pamięć pojazdu) — Generation 2 Version 2
//  readesm-js NIE obsługuje Gen2 V2 (zna tylko Gen1 TREP 0x01-0x06).
//  Format download Gen2 = sekwencja bloków `76 <TREP>` + „record-arrays"
//  { recordType(1) recordSize(2 BE) noOfRecords(2 BE) records[] } — wg
//  Rozporządzenia (UE) 2016/799 Annex 1C, Appendix 7. Zdekodowany na realnym
//  pliku VBS (WGM 5367K, 2026-07-30) — patrz reference_ddd_parser (memory).
// ═══════════════════════════════════════════════════════════════════

const TREP = { 0x31: "overview", 0x32: "activities", 0x33: "eventsFaults", 0x35: "technical" };

// Znane recordType (na podstawie realnego pliku + Annex 1C)
const RT = {
  VIN: 0x0a,            // VehicleIdentificationNumber (17B ASCII)
  VRN: 0x24,            // VehicleRegistrationNumber (1B nation + 14B)
  DL_PERIOD: 0x13,      // vuDownloadablePeriod (2× TimeReal = 8B)
  DL_TIME: 0x03,        // downloadingTime (TimeReal 4B)
  DAY_DATE: 0x06,       // dateOfDayDownloaded (TimeReal 4B) — dzień rekordu VuActivities
  ODO_MIDNIGHT: 0x05,   // odometerValueMidnight (3B)
  ACTIVITY: 0x01,       // ActivityChangeInfo (2B każdy)
  CARD_IW: 0x1c,        // VuCardIWRecord (41B — karta wło/wyjęcie)
  EVENT: 0x15,          // VuEventRecord
  FAULT: 0x18,          // VuFaultRecord
  OVERSPEED: 0x1b,      // VuOverSpeedingEventRecord
};

const ACT_LABEL = { 0: "rest", 1: "avail", 2: "work", 3: "drive" };

function trealIso(buf, p) {
  if (p + 4 > buf.length) return null;
  const t = buf.readUInt32BE(p);
  if (t <= 0 || t > 4102444800) return null; // 0 .. rok 2100
  return new Date(t * 1000).toISOString();
}

// Rozkłada plik na bloki i ich record-arrays. Defensywny — na śmieciach przerywa blok.
function walk(buf) {
  const out = [];
  let pos = 0;
  const N = buf.length;
  while (pos < N - 1) {
    if (buf[pos] === 0x76 && TREP[buf[pos + 1]] !== undefined) {
      const trep = buf[pos + 1];
      pos += 2;
      const ras = [];
      while (pos < N - 5) {
        if (buf[pos] === 0x76 && TREP[buf[pos + 1]] !== undefined) break; // następny blok
        const rt = buf[pos];
        const rs = buf.readUInt16BE(pos + 1);
        const nr = buf.readUInt16BE(pos + 3);
        if (rs > 5000 || nr > 20000) break; // niesensowne → koniec bloku
        const dataPos = pos + 5;
        if (dataPos + rs * nr > N + 8) break;
        ras.push({ rt, rs, nr, dataPos });
        pos += 5 + rs * nr;
      }
      out.push({ trep, ras });
    } else {
      pos += 1;
    }
  }
  return out;
}

// Główna funkcja: buffer (Node Buffer) → obiekt raportu VU
function parseVuFile(buf) {
  const blocks = walk(buf);
  const result = {
    generation: "gen2v2",
    vin: null,
    vrn: null,
    periodStart: null,
    periodEnd: null,
    downloadTime: null,
    days: [],            // { date, odometer, driveMin, workMin, restMin, availMin, cards }
    drivers: [],         // { cardNumber, insertions }
    eventCounts: { events: 0, faults: 0, overspeed: 0 },
  };
  const cardCounts = {};

  for (const { trep, ras } of blocks) {
    if (trep === 0x31) {
      for (const { rt, rs, nr, dataPos } of ras) {
        if (rt === RT.VIN && rs === 17) result.vin = buf.toString("latin1", dataPos, dataPos + 17).replace(/[^\x20-\x7e]/g, "").trim();
        if (rt === RT.VRN && rs === 15) result.vrn = buf.toString("latin1", dataPos + 1, dataPos + 15).replace(/[^\x20-\x7e]/g, "").trim();
        if (rt === RT.DL_PERIOD && rs === 8) { result.periodStart = trealIso(buf, dataPos); result.periodEnd = trealIso(buf, dataPos + 4); }
        if (rt === RT.DL_TIME && rs === 4) result.downloadTime = trealIso(buf, dataPos);
        void nr;
      }
    } else if (trep === 0x32) {
      let date = null, odo = null, cards = 0;
      // ActivityChangeInfo `scpaattt tttttttt`: bit15=slot (0=kierowca,1=zmiennik),
      // bit12-11=aktywność, bit10-0=minuta doby. Rekord 0x01 skleja OBA sloty —
      // MUSIMY rozdzielić, inaczej sortowanie po minucie miesza kierowcę i zmiennika.
      const bySlot = { 0: [], 1: [] };
      for (const { rt, rs, nr, dataPos } of ras) {
        if (rt === RT.DAY_DATE && rs === 4) { const iso = trealIso(buf, dataPos); date = iso ? iso.slice(0, 10) : null; }
        if (rt === RT.ODO_MIDNIGHT && rs === 3) odo = buf.readUIntBE(dataPos, 3);
        if (rt === RT.ACTIVITY && rs === 2) {
          for (let i = 0; i < nr; i++) {
            const v = buf.readUInt16BE(dataPos + i * 2);
            bySlot[(v >> 15) & 0x1].push({ min: v & 0x7ff, act: (v >> 11) & 0x3 });
          }
        }
        if (rt === RT.CARD_IW && rs === 41) {
          cards += nr;
          for (let i = 0; i < nr; i++) {
            const rec = buf.toString("latin1", dataPos + i * 41, dataPos + i * 41 + 41);
            const m = rec.match(/[0-9]{14,16}/);
            if (m) cardCounts[m[0]] = (cardCounts[m[0]] || 0) + 1;
          }
        }
      }
      // Slot kierowcy (0) = aktywność pojazdu. Minuty = segment do następnej zmiany (ostatni→1440).
      const tot = { 0: 0, 1: 0, 2: 0, 3: 0 };
      const drv = bySlot[0].sort((a, b) => a.min - b.min);
      for (let j = 0; j < drv.length; j++) {
        const end = j + 1 < drv.length ? drv[j + 1].min : 1440;
        tot[drv[j].act] += Math.max(0, end - drv[j].min);
      }
      if (date) result.days.push({ date, odometer: odo, driveMin: tot[3], workMin: tot[2], restMin: tot[0], availMin: tot[1], cards });
    } else if (trep === 0x33) {
      for (const { rt, nr } of ras) {
        if (rt === RT.EVENT) result.eventCounts.events += nr;
        if (rt === RT.FAULT) result.eventCounts.faults += nr;
        if (rt === RT.OVERSPEED) result.eventCounts.overspeed += nr;
      }
    }
  }

  result.days.sort((a, b) => (a.date < b.date ? -1 : 1));
  result.drivers = Object.entries(cardCounts)
    .map(([cardNumber, insertions]) => ({ cardNumber, insertions }))
    .sort((a, b) => b.insertions - a.insertions);

  // Podsumowanie
  result.summary = {
    daysWithData: result.days.length,
    totalDriveMin: result.days.reduce((s, d) => s + (d.driveMin || 0), 0),
    totalWorkMin: result.days.reduce((s, d) => s + (d.workMin || 0), 0),
    odoStart: result.days.find((d) => d.odometer != null)?.odometer ?? null,
    odoEnd: [...result.days].reverse().find((d) => d.odometer != null)?.odometer ?? null,
  };
  result.summary.totalKm = (result.summary.odoEnd != null && result.summary.odoStart != null)
    ? result.summary.odoEnd - result.summary.odoStart : null;

  return result;
}

module.exports = { parseVuFile, ACT_LABEL };
