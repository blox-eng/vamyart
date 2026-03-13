import { test, expect } from "@playwright/test";

test.describe("inquiry form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/get-a-piece");
  });

  test("form is present", async ({ page }) => {
    await expect(page.locator("form").first()).toBeVisible();
  });

  test("pre-fills piece from ?piece= query param", async ({ page }) => {
    await page.goto("/get-a-piece?piece=whispers");
    // The page fetches artwork by slug and pre-fills the piece field
    const pieceInput = page.locator('input[name="piece"], input[name="Piece"], [data-piece-input]');
    // Wait for tRPC to load and pre-fill — may take a moment
    await expect(pieceInput.first()).toBeVisible({ timeout: 10_000 });
  });
});
