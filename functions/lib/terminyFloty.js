// Mail „Terminy aut" — poniedziałki i czwartki 7:00, do wszystkich kont biura (user, 23.11.2026):
// w treści ma być jasno, co jest PO TERMINIE, a czemu termin SIĘ ZBLIŻA (przypominamy 30 dni przed).
// Czysta logika bez Firebase, żeby dało się ją sprawdzić skryptem.
//
// Lista terminów to KOPIA `terminyPojazdu` z `src/components/PojazdyPanel.jsx` (front jest ESM i nie
// trafia do paczki funkcji): pola karty auta + dokumenty z datą ważności; rat leasingu tu nie ma —
// to płatności, nie terminy do dopilnowania. Dodajesz nowy termin w panelu → dodaj go też tutaj.

const ILE_DNI_PRZED = 30;
const RODZAJE = { coc: "Świadectwo zgodności (COC)", oswiadczenie: "Oświadczenie do rejestracji", cemt: "Certyfikat CEMT / Euro", protokol: "Protokół przekazania", umowa: "Umowa leasingu", aneks: "Aneks do umowy", harmonogram: "Harmonogram rat", upowaznienie: "Upoważnienie leasingodawcy", winda: "Dokumenty windy", tachograf: "Kalibracja tachografu", gwarancja: "Gwarancja / serwis", faktura: "Faktura", inne: "" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dzien = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}.${m}.${y}`; };
const poprawnaData = (x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x || "")) && !isNaN(Date.parse(`${x}T00:00:00Z`));
const dniDo = (data, dzis) => Math.round((Date.parse(`${data}T00:00:00Z`) - Date.parse(`${dzis}T00:00:00Z`)) / 86400000);

/** Terminy aktywnych aut, które są po terminie albo wypadają w ciągu 30 dni. Najpilniejsze na górze. */
function terminyDoMaila(pojazdy, docs, dzis) {
  const lista = [];
  for (const v of pojazdy || []) {
    if (!v || v.archived) continue;
    const dodaj = (nazwa, data) => { if (poprawnaData(data)) lista.push({ plate: v.plate || "", nazwa, data, dni: dniDo(data, dzis) }); };
    dodaj("Przegląd techniczny", v.inspectionExpiry);
    dodaj("OC", v.ocExpiry);
    if (v.plate2) dodaj(`OC przyczepy ${v.plate2}`, v.ocExpiry2);
    dodaj("AC", v.acExpiry);
    dodaj("GAP", v.gapExpiry);
    dodaj("UDT windy", v.udtExpiry);
    dodaj("Gaśnica", v.gasnicaExpiry);
    dodaj("Koniec leasingu", v.leasing?.koniec);
    for (const d of docs || []) {
      if (d.vehicleId !== v.id || !d.expiryDate) continue;
      if (["polisa", "gap", "udt", "dowod", "badanie", "gasnica"].includes(d.kind)) continue; // mają swój termin w polach karty
      dodaj(RODZAJE[d.kind] || d.label || "Dokument", d.expiryDate);
    }
  }
  return lista.filter(t => t.dni <= ILE_DNI_PRZED).sort((a, b) => a.dni - b.dni || a.plate.localeCompare(b.plate));
}

const ile = (dni) => dni < 0 ? `${-dni} ${-dni === 1 ? "dzień" : "dni"} po terminie` : dni === 0 ? "termin DZIŚ" : dni === 1 ? "został 1 dzień" : `zostało ${dni} dni`;

function tabela(lista, kolor) {
  return `<table style="border-collapse:collapse;width:100%">${lista.map(t => `<tr>
<td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb;white-space:nowrap;width:110px"><b>${esc(t.plate)}</b></td>
<td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb">${esc(t.nazwa)}</td>
<td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb;white-space:nowrap;width:100px">${dzien(t.data)}</td>
<td style="padding:6px 0;border-top:1px solid #e5e7eb;white-space:nowrap;width:180px;color:${kolor};font-weight:bold">${ile(t.dni)}</td></tr>`).join("")}</table>`;
}

/** { subject, html } — jeden mail dla wszystkich odbiorców. Wołać tylko, gdy lista nie jest pusta. */
function mailTerminy(lista, dzis) {
  const po = lista.filter(t => t.dni < 0), blisko = lista.filter(t => t.dni >= 0);
  const czesci = [po.length && `po terminie: ${po.length}`, blisko.length && `termin się zbliża: ${blisko.length}`].filter(Boolean).join(", ");
  return {
    subject: `📅 Terminy aut — ${czesci} · ${dzien(dzis)}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;max-width:680px">
<h2 style="font-size:17px;margin:0 0 12px">Terminy aut — stan na ${dzien(dzis)}</h2>
${po.length ? `<h3 style="font-size:15px;color:#b91c1c;margin:16px 0 6px">PO TERMINIE (${po.length})</h3>${tabela(po, "#b91c1c")}` : ""}
${blisko.length ? `<h3 style="font-size:15px;color:#92400e;margin:20px 0 6px">TERMIN SIĘ ZBLIŻA — najbliższe ${ILE_DNI_PRZED} dni (${blisko.length})</h3>${tabela(blisko, "#92400e")}` : ""}
<p style="margin:18px 0 0"><a href="https://fleetstat.pl" style="color:#1d4ed8">Otwórz FleetStat</a> → Pojazdy. Po odnowieniu wpisz nową datę w karcie auta — termin zniknie z przypomnień.</p>
<p style="font-size:12px;color:#4b5563;margin:14px 0 0">Przypomnienie przychodzi w poniedziałki i czwartki o 7:00 do wszystkich kont biura, dopóki jakiś termin jest po dacie albo wypada w ciągu ${ILE_DNI_PRZED} dni.</p></div>`,
  };
}

module.exports = { ILE_DNI_PRZED, terminyDoMaila, mailTerminy };
