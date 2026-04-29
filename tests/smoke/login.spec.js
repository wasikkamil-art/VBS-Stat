// Login screen smoke tests — sprawdzają że formularz logowania renderuje
// poprawnie + ma poprawne atrybuty mobilne (autoCapitalize/Correct fix z 2026-04-28).
//
// Bug history:
//   - 2026-04-28: kierowca nie mógł zalogować się z telefonu, bo autoCapitalize
//     zmieniał pierwszą literę hasła na wielką. Fix: dodane attrs autoCapitalize="off",
//     autoCorrect="off", autoComplete="current-password" do password input.

import { test, expect } from "@playwright/test";

test.describe("Login screen", () => {
  test("renderuje się z formularzem email + hasło", async ({ page }) => {
    await page.goto("/");
    // Logo FleetStat widoczne
    await expect(page.getByAltText("FleetStat")).toBeVisible();
    // Pola formularza
    await expect(page.getByPlaceholder("twoj@email.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    // Przycisk submit
    await expect(page.getByRole("button", { name: /zaloguj/i })).toBeVisible();
  });

  test("password input ma autoCapitalize=off (mobile fix 2026-04-28)", async ({ page }) => {
    await page.goto("/");
    const passwordInput = page.locator("input[type='password']").first();
    await expect(passwordInput).toBeVisible();
    // Krytyczne attrs które naprawiły bug logowania z telefonu
    await expect(passwordInput).toHaveAttribute("autocapitalize", "off");
    await expect(passwordInput).toHaveAttribute("autocorrect", "off");
    await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    await expect(passwordInput).toHaveAttribute("spellcheck", "false");
  });

  test("email input ma autoComplete=email + inputMode=email (mobile keyboard)", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.locator("input[type='email']").first();
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
    await expect(emailInput).toHaveAttribute("autocapitalize", "off");
    await expect(emailInput).toHaveAttribute("inputmode", "email");
  });

  test("podanie błędnego hasła nie crashuje aplikacji", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("twoj@email.com").fill("nieistniejacy@example.com");
    await page.getByPlaceholder("••••••••").fill("blednehaslo123");
    await page.getByRole("button", { name: /zaloguj/i }).click();
    // Czekamy chwilę na response Firebase Auth
    await page.waitForTimeout(3000);
    // Po błędzie loading state znika, button znowu klikalny.
    // Test sprawdza tylko że strona nie zawisła / nie crashed (nie sprawdza konkretnego tekstu — Firebase regularnie zmienia komunikaty error).
    await expect(page.getByRole("button", { name: /zaloguj/i })).toBeVisible();
  });
});
