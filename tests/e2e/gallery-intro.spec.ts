import { expect, test } from "@playwright/test";

for (const width of [1280, 390]) {
  test(`gallery reveals a circle, stacks, and expands at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/en/gallery");
    const gallery = page.locator(".gx");
    await expect(gallery).toHaveAttribute("data-intro", "circle");
    await expect(gallery.locator(".site-name,.site-header__title")).toHaveCount(0);
    await expect(page.locator(".gx-card").first()).toBeDisabled();
    await expect.poll(() => page.locator(".gx-card").evaluateAll(cards => cards.filter(c => Number((c as HTMLElement).style.opacity) > 0.99).length), { intervals: [50] }).toBe(10);
    await page.screenshot({ path: `/tmp/gallery-circle-${width}.png` });
    await expect(gallery).toHaveAttribute("data-intro", "collapse");
    await expect.poll(() => gallery.getAttribute("data-intro"), { intervals: [20] }).toBe("stack");
    const centers = await page.locator(".gx-card").evaluateAll(cards => cards.slice(0, 10).map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
    expect(centers.every(c => Math.hypot(c.x - width / 2, c.y - 422) < 2)).toBe(true);
    await page.screenshot({ path: `/tmp/gallery-stack-${width}.png` });
    await expect(gallery).toHaveAttribute("data-intro", "sphere");
    await expect(page.locator(".gx-card:enabled")).toHaveCount(32);
    await page.screenshot({ path: `/tmp/gallery-sphere-${width}.png` });
    const sources = await page.locator(".gx-card img").evaluateAll(images => images.map(image => (image as HTMLImageElement).src));
    await page.getByRole("button", { name: "Grid", exact: true }).click();
    await expect(gallery).toHaveAttribute("data-view", "grid");
    await expect.poll(async () => Number(await page.locator(".gx-space").getAttribute("data-layout-progress"))).toBeGreaterThan(.99);
    const rects = await page.locator(".gx-card").evaluateAll(cards => cards.map(card => {
      const r = card.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
    }));
    expect(rects.every(r => r.x >= 0 && r.right <= width && r.y > 65 && r.bottom < 760)).toBe(true);
    expect(rects.every((r,i) => rects.every((s,j) => i===j || r.right<=s.x || s.right<=r.x || r.bottom<=s.y || s.bottom<=r.y))).toBe(true);
    expect(await page.locator(".gx-card img").evaluateAll(images => images.map(image => (image as HTMLImageElement).src))).toEqual(sources);
    await page.screenshot({ path: `/tmp/gallery-grid-${width}.png` });
    await page.locator(".gx-card").first().press("Enter");
    await expect(page.locator(".gx-card.is-open")).toHaveCount(1);
    const opened = page.locator(".gx-card.is-open");
    const image = opened.locator("img");
    await expect.poll(() => image.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const aspect = await image.evaluate(img => (img as HTMLImageElement).naturalWidth / (img as HTMLImageElement).naturalHeight);
    const expectedWidth = Math.min(width - (width <= 800 ? 16 : 40), (844 - 88) * aspect);
    await expect.poll(() => opened.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(expectedWidth * .99);
    const openedBounds = await opened.boundingBox();
    expect(openedBounds!.y).toBeGreaterThan(65);
    expect(openedBounds!.y + openedBounds!.height).toBeLessThan(844 - 12);
    expect(openedBounds!.width / openedBounds!.height).toBeCloseTo(aspect, 2);
    await page.screenshot({ path: `/tmp/gallery-open-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(page.locator(".gx-card.is-open")).toHaveCount(0);
    await page.getByRole("button", { name: "Sphere", exact: true }).click();
    await expect.poll(async () => Number(await page.locator(".gx-space").getAttribute("data-layout-progress"))).toBeLessThan(.01);
  });
}
