import { test, expect } from "@playwright/test";

test("top layout controls and both scroll directions work independently", async ({ page }) => {
  await page.goto("/en/gallery");
  const space = page.locator(".gx-space");
  const card = page.locator(".gx-card").first();
  await expect(page.locator(".gx")).toHaveAttribute("data-intro", "sphere");
  const nav = await page.getByRole("navigation", { name: "Gallery layout" }).boundingBox();
  expect(nav!.y).toBeLessThan(60);
  const initial = await card.evaluate(el => el.style.transform);
  await space.dispatchEvent("wheel", { deltaX: 120, deltaY: 0 });
  await expect.poll(() => card.evaluate(el => el.style.transform)).not.toBe(initial);
  // Let horizontal momentum settle before testing vertical zoom.
  await page.waitForTimeout(2600);
  await space.dispatchEvent("wheel", { deltaX: 0, deltaY: 500 });
  await page.waitForTimeout(100);
  const width = await card.evaluate(el => parseFloat(el.style.width));
  await space.dispatchEvent("wheel", { deltaX: 0, deltaY: -300 });
  await expect.poll(() => card.evaluate(el => parseFloat(el.style.width))).toBeGreaterThan(width * 1.1);
  await space.dispatchEvent("wheel", { deltaX: 0, deltaY: -10000 });
  await page.waitForTimeout(100);
  const photos = await page.locator(".gx-card").evaluateAll(cards => cards.map(card => ({top:card.getBoundingClientRect().top, opacity:getComputedStyle(card).opacity})));
  expect(photos.every(photo => photo.top >= 80 && photo.opacity === "1")).toBe(true);
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(space).toHaveAttribute("data-layout-progress", "1.000");
  const grid = await card.evaluate(el => el.style.transform);
  await space.dispatchEvent("wheel", { deltaX: 300, deltaY: 0 });
  await expect.poll(() => card.evaluate(el => el.style.transform)).toBe(grid);
});
