import { test, expect } from "@playwright/test";

test.describe("inquiry form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/get-a-piece");
  });

  test("form is present", async ({ page }) => {
    await expect(page.locator("form")).toBeVisible();
  });

  test("pre-fills piece from ?piece= query param", async ({ page }) => {
    await page.goto("/get-a-piece?piece=Whispers");
    // The FormBlock reads ?piece= and fills the Piece input
    const pieceInput = page.locator('input[name="Piece"]');
    await expect(pieceInput).toHaveValue("Whispers");
  });
});
