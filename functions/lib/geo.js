// Przypisanie współrzędnych do kraju — offline, bez zapytań sieciowych.
// Granice: Natural Earth 50m admin_0, uproszczone do ~400 m (data/europe-borders.json).
// Używane przez scheduledGpsPoll (pole `cc` przy punkcie) i aggregateCountryKm.
const BORDERS = require("../data/europe-borders.json");

// [cc, minX, minY, maxX, maxY, ring] — płaska lista, żeby bounding box odsiewał szybko
const RINGS = [];
for (const f of BORDERS.f) {
  for (const [ring, bbox] of f.p) RINGS.push([f.cc, bbox[0], bbox[1], bbox[2], bbox[3], ring]);
}

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

// Cache po siatce ~1 km (3 miejsca po przecinku). Flota kręci się po tych samych
// trasach, więc trafień jest dużo, a funkcja chodzi co minutę.
const cache = new Map();
const CACHE_MAX = 20000;

/** Kod kraju (ISO-2) dla współrzędnych albo null poza zasięgiem granic. */
function countryOf(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let res = null;
  for (const [cc, minX, minY, maxX, maxY, ring] of RINGS) {
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (inRing(ring, lng, lat)) { res = cc; break; }
  }
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, res);
  return res;
}

/** Licznik CAN w km — WGM5367K raportuje w metrach, reszta w kilometrach. */
function mileageKm(mileage) {
  if (mileage == null || !isFinite(mileage)) return null;
  return mileage > 1e6 ? mileage / 1000 : mileage;
}

module.exports = { countryOf, mileageKm };
