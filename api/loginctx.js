// Vercel serverless function — zwraca kontekst logowania widziany PO STRONIE SERWERA:
// prawdziwe IP klienta + geolokalizacja z krawędzi Vercela (nagłówki x-vercel-ip-*).
// Bez klucza, bez third-party, bez bazy. Klient dociąga to po udanym logowaniu
// i zapisuje wpis do kolekcji `loginEvents` (patrz src/utils/loginLog.js).
// Uwaga: nagłówki geo są wstrzykiwane tylko na produkcji Vercela (w dev = puste).
export default function handler(req, res) {
  const xff = req.headers['x-forwarded-for'] || '';
  const ip = String(xff).split(',')[0].trim() || req.socket?.remoteAddress || '';
  const dec = (v) => {
    try { return v ? decodeURIComponent(v) : ''; } catch { return v || ''; }
  };
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ip,
    city: dec(req.headers['x-vercel-ip-city']),
    country: req.headers['x-vercel-ip-country'] || '',
    region: req.headers['x-vercel-ip-country-region'] || '',
  });
}
