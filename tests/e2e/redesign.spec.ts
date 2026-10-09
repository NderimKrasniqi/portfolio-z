import { expect, test } from "@playwright/test";

test("home cards advance and a gallery picture opens and closes", async ({ page }) => {
  await page.goto("/en");

  const footer = page.locator(".hx-footer");
  await expect(page.locator(".hx-card.is-center")).toBeVisible();
  await expect(footer).toContainText("01");

  await page.getByRole("button", { name: "Next work" }).click();
  await expect(footer.locator("span").first()).toHaveText("02");
  await expect(page.locator(".hx-slider__track .is-active")).toHaveText(/./);

  await page.goto("/en/gallery");
  const cards = page.locator(".gx-card");
  await expect(cards.first()).toBeVisible();

  await cards.nth(2).click();
  await expect(page.locator(".gx-card.is-open")).toHaveCount(1);
  await expect(page.locator(".gx-caption strong")).not.toBeEmpty();

  await page.keyboard.press("Escape");
  await expect(page.locator(".gx-card.is-open")).toHaveCount(0);
  await expect(page.locator(".gx-caption")).toContainText("WORKS");
});
