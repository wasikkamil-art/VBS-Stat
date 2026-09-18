// Granice doby w polskiej strefie — używane przez agregat km per kraj.
// Miesiące rozliczamy lokalnie, więc doba też musi być lokalna: inaczej dwie godziny
// ruchu z przełomu miesiąca wpadłyby do sąsiedniego okresu.
const TZ_PL = "Europe/Warsaw";

function tzOffsetMs(ms, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = dtf.formatToParts(new Date(ms)).reduce((a, x) => (a[x.type] = x.value, a), {});
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}

/** Godzina `HH:MM` dnia `YYYY-MM-DD` w strefie `tz`, jako ms UTC (NaN przy złym formacie).
 *  Offset liczony dla KONKRETNEJ chwili — latem +02:00, zimą +01:00. Wpisane na sztywno
 *  `+02:00` od końca października przesuwało wszystko o godzinę. */
function lokalnyCzas(dateStr, timeStr = "00:00", tz = TZ_PL) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const [hh, mm] = String(timeStr || "00:00").split(":").map(Number);
  const cel = Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0);
  if (isNaN(cel)) return NaN;
  let ms = cel;
  for (let i = 0; i < 3; i++) ms = cel - tzOffsetMs(ms, tz);
  return ms;
}

/** Północ dnia `YYYY-MM-DD` w strefie `tz`, jako ms UTC. */
function lokalnaPolnoc(dateStr, tz = TZ_PL) {
  return lokalnyCzas(dateStr, "00:00", tz);
}

/** Kolejny dzień kalendarzowy. +36 h wpada w następny dzień także wtedy,
 *  gdy doba ma 23 lub 25 godzin przy zmianie czasu. */
function nastepnyDzien(dateStr, tz = TZ_PL) {
  return new Date(lokalnaPolnoc(dateStr, tz) + 36 * 3600000).toLocaleDateString("sv-SE", { timeZone: tz });
}

/** Dzisiejsza data lokalna (albo data dla podanego ms). */
function dataLokalna(ms = Date.now(), tz = TZ_PL) {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: tz });
}

module.exports = { TZ_PL, lokalnyCzas, lokalnaPolnoc, nastepnyDzien, dataLokalna };
