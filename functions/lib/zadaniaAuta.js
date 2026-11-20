// Maile „Do zrobienia na bazie" (kolekcja `zadaniaAuta`) — sama treść i dobór odbiorców, bez Firebase,
// żeby dało się to sprawdzić skryptem. Reguły ustalone z userem 20.11.2026:
//   • mail OD RAZU po dodaniu zadania,
//   • mail OD RAZU po zmianie terminu (kto, z jakiej daty na jaką, dlaczego),
//   • CODZIENNIE 7:00 pon–pt, dopóki zadanie nie jest odhaczone — jeden zbiorczy mail na osobę,
//   • odbiorcy = osoby zaznaczone przy zadaniu (`powiadom`), ale wysyłamy TYLKO na adresy kont
//     admin/dyspozytor — pole w dokumencie nie może zrobić z nas przekaźnika poczty na dowolny adres.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dzien = (iso) => { if (!iso) return "—"; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}.${m}.${y}`; };
const krotko = (email) => String(email || "").split("@")[0] || "—";
const dniMiedzy = (odIso, doIso) => Math.round((Date.parse(doIso + "T00:00:00Z") - Date.parse(odIso + "T00:00:00Z")) / 86400000);

// „zostały 3 dni" / „dziś" / „po terminie 2 dni"
function ileCzasu(termin, dzis) {
  if (!termin) return "bez terminu";
  const d = dniMiedzy(dzis, termin);
  if (d === 0) return "termin DZIŚ";
  if (d > 0) return d === 1 ? "został 1 dzień" : d <= 4 ? `zostały ${d} dni` : `zostało ${d} dni`;
  return Math.abs(d) === 1 ? "PO TERMINIE 1 dzień" : `PO TERMINIE ${Math.abs(d)} dni`;
}

// Konta pomijane w powiadomieniach — `deoen` to zapasowy admin na wypadek zgubienia hasła (user, 20.11.2026).
// Ta sama lista jest we froncie: `src/utils/zadaniaAuta.js` (KONTA_BEZ_POWIADOMIEN).
const KONTA_BEZ_POWIADOMIEN = ["deoen"];
const czyPowiadamiac = (email) => !KONTA_BEZ_POWIADOMIEN.includes(String(email || "").split("@")[0]);

// Odbiorcy zadania ograniczeni do adresów biura (Set małymi literami), bez kont pomijanych.
function odbiorcy(zadanie, biuro) {
  return [...new Set((zadanie.powiadom || []).map(e => String(e || "").trim().toLowerCase()))].filter(e => e && biuro.has(e) && czyPowiadamiac(e));
}

const ramka = (tytul, tresc) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;max-width:640px">
<h2 style="font-size:17px;margin:0 0 12px">${tytul}</h2>${tresc}
<p style="margin:18px 0 0"><a href="https://fleetstat.pl" style="color:#1d4ed8">Otwórz FleetStat</a> → Przegląd → „Checklista” na kafelku auta.</p>
<p style="font-size:12px;color:#4b5563;margin:14px 0 0">Dostajesz tę wiadomość, bo zaznaczono Cię przy zadaniu. Przypomnienia przychodzą codziennie o 7:00 (pon–pt), dopóki zadanie nie zostanie odhaczone.</p></div>`;
const wiersz = (k, w) => `<tr><td style="padding:4px 14px 4px 0;color:#4b5563;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:4px 0">${w}</td></tr>`;

function mailNowe(z, dzis) {
  return {
    subject: `🔧 ${z.plate}: checklista — ${z.tytul} (termin ${dzien(z.termin)})`,
    html: ramka(`Checklista — nowe zadanie przy aucie ${esc(z.plate)}`, `<table style="border-collapse:collapse">
${wiersz("Zadanie", `<b>${esc(z.tytul)}</b>`)}${z.opis ? wiersz("Opis", esc(z.opis)) : ""}
${wiersz("Termin", `${dzien(z.termin)} — ${ileCzasu(z.termin, dzis)}`)}
${wiersz("Dodał(a)", esc(krotko(z.createdBy)))}</table>`),
  };
}

function mailTermin(z, zmiana, dzis) {
  return {
    subject: `📅 ${z.plate}: zmiana terminu — ${z.tytul} (${dzien(zmiana.z)} → ${dzien(zmiana.na)})`,
    html: ramka(`Zmieniono termin zadania przy aucie ${esc(z.plate)}`, `<table style="border-collapse:collapse">
${wiersz("Zadanie", `<b>${esc(z.tytul)}</b>`)}
${wiersz("Termin", `${dzien(zmiana.z)} → <b>${dzien(zmiana.na)}</b> — ${ileCzasu(zmiana.na, dzis)}`)}
${wiersz("Kto zmienił", esc(krotko(zmiana.kto)))}
${wiersz("Dlaczego", esc(zmiana.powod || "—"))}</table>`),
  };
}

// Poranne zestawienie: { [email]: { subject, html } } — tylko zadania otwarte, najpilniejsze na górze.
function mailePoranne(zadania, biuro, dzis) {
  const naOsobe = new Map();
  for (const z of zadania) {
    if (z.status !== "otwarte") continue;
    for (const e of odbiorcy(z, biuro)) (naOsobe.get(e) || naOsobe.set(e, []).get(e)).push(z);
  }
  const wynik = {};
  for (const [email, lista] of naOsobe) {
    lista.sort((a, b) => (a.termin || "9999").localeCompare(b.termin || "9999") || String(a.plate).localeCompare(String(b.plate)));
    const po = lista.filter(z => z.termin && z.termin < dzis).length;
    const wiersze = lista.map(z => {
      const zle = z.termin && z.termin <= dzis;
      return `<tr><td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb;white-space:nowrap"><b>${esc(z.plate)}</b></td>
<td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb">${esc(z.tytul)}${z.opis ? `<div style="font-size:12px;color:#4b5563">${esc(z.opis)}</div>` : ""}</td>
<td style="padding:6px 12px 6px 0;border-top:1px solid #e5e7eb;white-space:nowrap">${dzien(z.termin)}</td>
<td style="padding:6px 0;border-top:1px solid #e5e7eb;white-space:nowrap;${zle ? "color:#b91c1c;font-weight:bold" : ""}">${ileCzasu(z.termin, dzis)}</td></tr>`;
    }).join("");
    wynik[email] = {
      subject: `🔧 Checklista aut — do zrobienia: ${lista.length}${po ? ` (po terminie: ${po})` : ""} · ${dzien(dzis)}`,
      html: ramka(`Checklista — nieodhaczone zadania przy autach, ${dzien(dzis)}`, `<table style="border-collapse:collapse;width:100%">
<tr><th align="left" style="padding:4px 12px 4px 0;font-size:12px;color:#4b5563">Auto</th><th align="left" style="padding:4px 12px 4px 0;font-size:12px;color:#4b5563">Zadanie</th><th align="left" style="padding:4px 12px 4px 0;font-size:12px;color:#4b5563">Termin</th><th align="left" style="padding:4px 0;font-size:12px;color:#4b5563">Stan</th></tr>${wiersze}</table>`),
    };
  }
  return wynik;
}

// Ostatni wpis „termin" z historii — to on niesie kto/z/na/powód.
const ostatniaZmianaTerminu = (z) => (z.historia || []).filter(h => h.typ === "termin").sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")))[0] || null;

module.exports = { odbiorcy, ileCzasu, mailNowe, mailTermin, mailePoranne, ostatniaZmianaTerminu };
