// Lazy chunks smoke tests — weryfikują że code splitting (#5c) działa poprawnie:
// rożni użytkownicy pobierają różne chunki, główny bundle jest mniejszy niż kiedyś.
//
// Bug history (chunki które wprowadziliśmy):
//   - 2026-04-28: DriverPanel + TripSummaryPanel + utils
//   - 2026-04-29: TrackerPublicView + GpsCzasPracySection + WhatsappSendPreviewModal
//                 + FrachtyModal + ZlecenieUploadBtn + safeHref + czasPracy + ...

import { test, expect } from "@playwright/test";

test.describe("Code splitting / lazy chunks", () => {
  test("strona główna NIE pobiera DriverPanel + FrachtyModal + Tracker chunk od razu", async ({ page }) => {
    const requests = [];
    page.on("request", req => {
      if (req.url().includes("/assets/")) requests.push(req.url());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Te chunki POWINNY być lazy → NIE załadowane przed userem akcji
    const driverPanel = requests.find(url => /DriverPanel-.*\.js/.test(url));
    const frachtyModal = requests.find(url => /FrachtyModal-.*\.js/.test(url));
    const trackerView = requests.find(url => /TrackerPublicView-.*\.js/.test(url));

    expect(driverPanel, "DriverPanel chunk nie powinien ładować się na login screen").toBeUndefined();
    expect(frachtyModal, "FrachtyModal chunk nie powinien ładować się na login screen").toBeUndefined();
    expect(trackerView, "TrackerPublicView chunk nie powinien ładować się na login screen").toBeUndefined();
  });

  test("main bundle (index-*.js) jest pobierany i nie jest większy niż 2.5 MB", async ({ page }) => {
    const responses = [];
    page.on("response", async resp => {
      if (/\/assets\/index-.*\.js/.test(resp.url())) {
        const size = parseInt(resp.headers()["content-length"] || "0");
        responses.push({ url: resp.url(), size });
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    expect(responses.length, "main index-*.js powinien być pobrany").toBeGreaterThanOrEqual(1);
    const mainBundleBytes = responses[0]?.size || 0;
    // SLA komercjalizacji: po refactorach #5c bundle poniżej 2 MB (gzipped poniżej 500 KB).
    // Buffer +500 KB na wzrost przy nowych featurach.
    expect(mainBundleBytes, `main bundle ${Math.round(mainBundleBytes/1024)} KB > 2.5 MB threshold`).toBeLessThan(2.5 * 1024 * 1024);
  });
});
