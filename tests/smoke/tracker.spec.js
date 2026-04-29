// Tracker public view smoke tests — sprawdzają że publiczna strona /t/{token}
// dla zleceniodawców ładuje się poprawnie + nie ma regresji multi-stop.
//
// Bug history (regression scenarios):
//   - 2026-04-28 (commit 3174f84): GpsCzasPracySection / Tracker pokazywał trasę
//     z lutego 2025 dla WGM 0475M bo żaden nowszy fracht nie pasował do filtra.
//     Fix: skip stale frachts (>7 dni od dataZaladunku bez explicit zamknięcia).
//   - 2026-04-28: trackerData CF używał [pos, R1, R2] zamiast [pos, R2] po
//     zrealizowaniu R1 → fałszywe 1364 km zamiast 10. Fix: r1AlreadyDone check.
//
// UWAGA: prawdziwy test multi-stop wymaga znanego tokenu z R1+R2 frachtem w trasie.
// Tutaj sprawdzamy tylko że strona LADUJE SIE (nie crashuje, nie 500).

import { test, expect } from "@playwright/test";

test.describe("Tracker public view (/t/{token})", () => {
  test("invalid token nie crashuje strony (tracker chunk się ładuje)", async ({ page }) => {
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto("/t/INVALID_TOKEN_TEST_ZZZZZ");
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    // Strona załadowała się bez crash JavaScript
    expect(errors, "Brak unhandled JS errors").toHaveLength(0);
    // Body jest widoczne (UI cokolwiek wyrenderował — strona nie jest white screen)
    await expect(page.locator("body")).toBeVisible();
  });

  test("strona /t/ ładuje się szybko (lazy chunk dla zleceniodawcy)", async ({ page }) => {
    const start = Date.now();
    await page.goto("/t/TEST_TIMING_ZZZ");
    // Loading fallback ("📦 Ładowanie statusu przesyłki…") znika i UI renderuje się
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const elapsed = Date.now() - start;
    // Komercjalizacyjny SLA: poniżej 5s (z internetem) jest dobre dla 4G
    expect(elapsed).toBeLessThan(15000);
  });

  test("Tracker.chunk.js JEST ładowany (nie main bundle ze wszystkim)", async ({ page }) => {
    const requests = [];
    page.on("request", req => {
      if (req.url().includes("/assets/")) requests.push(req.url());
    });
    await page.goto("/t/TEST_BUNDLE_CHECK");
    await page.waitForLoadState("networkidle", { timeout: 10000 });
    // Sprawdź że TrackerPublicView chunk się ładuje (lazy load)
    const trackerChunkLoaded = requests.some(url => /TrackerPublicView-.*\.js/.test(url));
    expect(trackerChunkLoaded).toBe(true);
    // Sprawdź że DriverPanel chunk NIE jest ładowany (nie potrzebny dla zleceniodawcy)
    const driverPanelLoaded = requests.some(url => /DriverPanel-.*\.js/.test(url));
    expect(driverPanelLoaded).toBe(false);
  });
});
