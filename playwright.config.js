// Playwright config — smoke E2E (TODO #5d komercjalizacji).
// Cel: canary tests blokujące najgorsze regresje. NIE pełna piramida testów.
//
// Uruchomienie:
//   npm run test:e2e                # wszystkie testy
//   npm run test:e2e -- --headed     # widoczna przeglądarka (debug)
//   npm run test:e2e -- --ui         # interactive UI mode
//
// Strategy: testy chodzą przeciw produkcji `https://fleetstat.pl` (read-only smoke).
// To omija konieczność uruchamiania local dev server + setupu test data. Trade-off:
// testy zależą od stabilności prod (zwykle dobra). Pre-push hook NIE odpala E2E
// (zbyt wolne — 10-30s z internetem) — uruchamiamy ręcznie przed deploy lub w CI.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/smoke",
  // Każdy test max 30s
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  // Sequencjalnie żeby nie dobijać produkcji
  fullyParallel: false,
  workers: 1,

  // Retry raz na wypadek transient network errors
  retries: 1,

  // Reporter
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "https://fleetstat.pl",
    // Cookie/storage czyszczone między testami (default)
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Polski locale = lepsze realistyczne testy daty/format
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  },

  projects: [
    // Desktop Chromium — admin flow
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mobile Chrome — kierowca flow
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
