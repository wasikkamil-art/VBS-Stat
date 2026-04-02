/**
 * Jednorazowy skrypt migracyjny — ustawia Custom Claims
 * dla wszystkich istniejących użytkowników na podstawie ról z Firestore.
 *
 * Użycie: node migrate-claims.js
 * (uruchom z folderu functions/)
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore }        = require("firebase-admin/firestore");

// Inicjalizacja z kluczem adminsdk
const app = initializeApp({
  credential: cert(require("../vbs-stats-firebase-adminsdk.json")),
});

const auth = getAuth(app);
const db   = getFirestore(app);

async function migrateClaims() {
  console.log("🔄 Rozpoczynam migrację Custom Claims...\n");

  const usersSnap = await db.collection("users").get();

  if (usersSnap.empty) {
    console.log("Brak użytkowników w Firestore.");
    return;
  }

  let success = 0;
  let errors = 0;

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data();
    const role = data.role || "podglad";

    try {
      // Pobierz obecne claims
      const userRecord = await auth.getUser(uid);
      const currentRole = userRecord.customClaims?.role;

      if (currentRole === role) {
        console.log(`  ⏭  ${data.email || uid} — już ma claim "${role}"`);
        continue;
      }

      // Ustaw Custom Claim
      await auth.setCustomUserClaims(uid, {
        ...userRecord.customClaims,
        role: role,
      });

      // Zaktualizuj claimsUpdatedAt w Firestore
      await doc.ref.update({
        claimsUpdatedAt: new Date().toISOString(),
      });

      console.log(`  ✅ ${data.email || uid} → ${role}`);
      success++;
    } catch (e) {
      console.error(`  ❌ ${data.email || uid} — ${e.message}`);
      errors++;
    }
  }

  console.log(`\n🏁 Migracja zakończona: ${success} ustawionych, ${errors} błędów.`);
  console.log("   Użytkownicy muszą się wylogować i zalogować ponownie,");
  console.log("   lub poczekać ~1h na automatyczne odświeżenie tokena.");
  process.exit(0);
}

migrateClaims().catch(e => {
  console.error("Błąd migracji:", e);
  process.exit(1);
});
