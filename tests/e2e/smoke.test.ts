import { test, expect } from "@playwright/test";

test.describe("smoke — pages load", () => {
  test("home page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("gallery page", async ({ page }) => {
    await page.goto("/gallery");
    await expect(page.locator("body")).toBeVisible();
    // Should not show an error page
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("get-a-piece page", async ({ page }) => {
    await page.goto("/get-a-piece");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("form")).toBeVisible();
  });

  test("404 page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
  });
});
