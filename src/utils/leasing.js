// Drobne reguły leasingu pojazdu, wspólne dla App.jsx i (ładowanego na żądanie) panelu Pojazdy.

/**
 * Termin pierwszej raty leasingu — to jest data „We flocie od” (decyzja usera 24.11.2026:
 * „we flocie zawsze ustawiaj datę od daty pierwszego leasingu”; z dwóch możliwości wybrał termin
 * pierwszej raty, nie datę zawarcia umowy). "" gdy auto nie ma harmonogramu.
 */
export function pierwszaRataLeasingu(leasing) {
  return ((leasing?.harmonogram || []).map(r => r.data).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || "")).sort()[0]) || "";
}
