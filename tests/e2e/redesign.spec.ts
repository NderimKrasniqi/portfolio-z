import { expect, test } from "@playwright/test";

test("home cards advance and a gallery picture opens and closes", async ({ page }) => {
  await page.goto("/en");

  const thumbnails = page.locator(".home-filmstrip button");
  await expect(page.locator(".hx-card.is-center video")).toBeVisible();
  await expect(page.locator(".hx-card:not(.is-center)")).toHaveCount(0);
  await expect(thumbnails.first()).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".hx-card")).toHaveCount(1);
  const firstVideo = await page.locator(".hx-card.is-center video").getAttribute("src");

  await thumbnails.nth(1).click();
  await expect(thumbnails.nth(1)).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".hx-slider")).toHaveCount(0);
  await expect(page.locator(".hx-card.is-center video")).not.toHaveAttribute("src", firstVideo!);

  await page.goto("/en/gallery");
  const cards = page.locator(".gx-card");
  await expect(cards.first()).toBeVisible();
  await expect(page.locator(".gx-card video")).toHaveCount(0);

  await cards.nth(2).click();
  await expect(page.locator(".gx-card.is-open")).toHaveCount(1);
  await expect(page.locator(".gx-caption")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.locator(".gx-card.is-open")).toHaveCount(0);
  await expect(page.locator(".gx-caption")).toHaveCount(0);
});

test("signature hands off to the intro and single film with contact strip on mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await expect(page.locator(".loader")).toBeVisible();
  await expect(page.locator(".loader")).toHaveCount(0, { timeout: 15000 });
  const grid = page.locator(".hx-grid__cell");
  await expect(page.locator(".hx-grid")).toBeVisible();
  const original = await grid.evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).src));
  expect(new Set(original).size).toBe(9);
  await expect.poll(() => grid.first().getAttribute("src"), { intervals: [20] }).not.toBe(new URL(original[0]).pathname);
  const shuffled = await grid.evaluateAll(nodes => nodes.map(node => (node as HTMLImageElement).src));
  expect([...shuffled].sort()).toEqual([...original].sort());
  expect(shuffled).not.toEqual(original);
  await expect(page.locator(".hx-copy,.hx-list")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/home-grid-corrected.png" });
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 20000 });
  await expect(page.locator(".loader")).toHaveCount(0);
  await expect(page.locator(".hx-grid")).toBeHidden();
  const video = page.locator(".hx-card.is-center video");
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => !node.paused && node.currentTime > 0)).toBe(true);
  await expect(page.locator(".home-filmstrip button")).toHaveCount(3);
  await page.locator(".home-filmstrip button").nth(1).click();
  await expect(page.locator(".home-filmstrip button").nth(1)).toHaveAttribute("aria-current", "true");
  await page.goto("/en/gallery");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".gx-card").first().press("Enter");
  await expect(page.locator(".gx-card.is-open")).toHaveCount(1);
  const bounds = await page.locator(".gx-card.is-open").boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(374 + 1);
});
