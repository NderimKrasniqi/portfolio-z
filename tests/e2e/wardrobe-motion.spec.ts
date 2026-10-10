import { test, expect } from "@playwright/test";

test.use({ reducedMotion: "no-preference", video: "on" });
test("the original rail sways after the push, keep a stationary hover, and settle on release", async ({
  page,
}) => {
  await page.goto("/en/shop");
  await expect(page.locator('canvas[data-renderer="three"]')).toHaveCount(0);
  const root = page.locator(".wardrobe-stage");
  const pieces = root.locator(".wardrobe-piece");
  await pieces.nth(1).hover();
  await expect
    .poll(async () =>
      Math.abs(Number(await pieces.nth(2).getAttribute("data-sway"))),
    )
    .toBeGreaterThan(0.15);
  await page.screenshot({
    path: "/tmp/original-hanger-sway.png",
  });
  // Stay still: moving hit boxes must not change the selected garment beneath the pointer.
  await page.waitForTimeout(800);
  await expect(root).toHaveAttribute("data-active", "1");
  await page.mouse.move(5, 120);
  await expect(root).toHaveAttribute("data-active", "none");
  await expect
    .poll(
      async () =>
        Math.max(
          ...(await pieces.evaluateAll((elements) =>
            elements.map((el) =>
              Math.abs(Number((el as HTMLElement).dataset.sway)),
            ),
          )),
        ),
      { timeout: 7000 },
    )
    .toBeLessThan(0.04);
});
