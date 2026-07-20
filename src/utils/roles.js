// Role użytkowników — front czyta TĘ SAMĄ definicję co Cloud Functions.
//
// Kanoniczne dane siedzą w `functions/roles.shared.json`, bo `firebase deploy`
// wysyła wyłącznie katalog `functions/` — plik trzymany np. w `src/` albo w roocie
// nie trafiłby do Cloud Functions. Ten moduł jest JEDYNYM miejscem, które sięga
// po tę ścieżkę; reszta frontu importuje stąd.
//
// Import JSON-a rozwiązuje Vite w czasie builda (dane lądują w bundlu) — nie ma
// tu żadnej zależności runtime od katalogu functions/.
//
// Historia: do 2026-07-20 były dwie rozjechane listy (`VALID_ROLES` bez `kierowca`
// vs `ALL_ROLES` z `kierowca`), przez co nadanie roli kierowcy cicho nie
// synchronizowało Custom Claim. Patrz SESJA-LOG 2026-07-20 (cd. 5).
import rolesData from "../../functions/roles.shared.json";

// Pełne definicje ról (id + prezentacja dla UI)
export const ALL_ROLES = rolesData.ROLES;

// Role „biurowe" — wszystko poza kierowcą (osobna sekcja w panelu użytkowników)
export const ROLES_BIURO = ALL_ROLES.filter(r => r.biuro);

// Same identyfikatory — odpowiednik `VALID_ROLES` po stronie Cloud Functions
export const VALID_ROLE_IDS = ALL_ROLES.map(r => r.id);

// Czy dany string jest prawidłową rolą
export const isValidRole = (role) => VALID_ROLE_IDS.includes(role);

// Definicja roli po id (np. do kolorów/etykiet w UI)
export const roleById = (id) => ALL_ROLES.find(r => r.id === id) || null;
