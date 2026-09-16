// Km per kraj z punktów GPS — dystans liczony z PRZYROSTU LICZNIKA CAN, nie z odległości
// między punktami. Powód: przy postoju szum GPS zawyża (v1 w tygodniu: 33 km z pozycji
// wobec 9 km z licznika), a licznik jest tym samym źródłem, co arkusz i raport ww.
const { countryOf, mileageKm } = require("./geo");

// Progi odrzucania odcinka. Punkt co ~1 min w ruchu (mediana skoku 1,4 km),
// więc odcinek 200 km albo 3 h przerwy to luka w danych, nie przejazd.
const MAX_ODCINEK_KM = 200;
const MAX_PREDKOSC = 130;      // km/h — powyżej to błąd danych, nie jazda
const MAX_PRZERWA_H = 3;

/**
 * @param {Array<{lat:number,lng:number,ts:number,mileage:number,cc?:string}>} punkty
 * @returns {{perKraj:Object, kmPrzypisane:number, kmLicznik:number, odrzucone:number, punkty:number}}
 */
function kmPerKraj(punkty) {
  const p = (punkty || [])
    .filter(x => x && typeof x.lat === "number" && typeof x.lng === "number" && x.ts)
    .sort((a, b) => a.ts - b.ts);

  const perKraj = {};
  let kmPrzypisane = 0, odrzucone = 0;

  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const ma = mileageKm(a.mileage), mb = mileageKm(b.mileage);
    if (ma == null || mb == null) { odrzucone++; continue; }

    const dkm = mb - ma;
    const dh = (b.ts - a.ts) / 3600000;
    // Licznik cofnięty = obcy punkt albo reset urządzenia.
    if (dkm < 0 || dh <= 0) { odrzucone++; continue; }
    if (dkm === 0) continue;                                  // postój — nic do przypisania
    if (dkm > MAX_ODCINEK_KM || dh > MAX_PRZERWA_H) { odrzucone++; continue; }
    if (dkm / dh > MAX_PREDKOSC) { odrzucone++; continue; }

    // Kraj bierzemy z punktu początkowego odcinka. Przy przekroczeniu granicy błąd
    // to najwyżej długość jednego odcinka (mediana 1,4 km), kilka razy na trasę.
    const cc = a.cc || countryOf(a.lat, a.lng) || "??";
    perKraj[cc] = Math.round(((perKraj[cc] || 0) + dkm) * 10) / 10;
    kmPrzypisane += dkm;
  }

  // Kontrola: ile licznik przejechał w całym oknie (bez odcinków odrzuconych nie wyjdzie równo).
  const mil = p.map(x => mileageKm(x.mileage)).filter(x => x != null);
  const kmLicznik = mil.length > 1 ? Math.max(0, mil[mil.length - 1] - mil[0]) : 0;

  return {
    perKraj,
    kmPrzypisane: Math.round(kmPrzypisane * 10) / 10,
    kmLicznik: Math.round(kmLicznik * 10) / 10,
    odrzucone,
    punkty: p.length,
  };
}

module.exports = { kmPerKraj, MAX_ODCINEK_KM, MAX_PREDKOSC, MAX_PRZERWA_H };
