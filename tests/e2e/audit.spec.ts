import { expect, test } from "@playwright/test";

test("mobile menu opens, closes with Escape, and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards");
  const toggle = page.getByRole("button", { name: "Open menu", exact: true });
  await toggle.click();
  await expect(page.locator("#mobileNavPanel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu", exact: true })).toHaveClass(/is-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#mobileNavPanel")).toBeHidden();
  await toggle.click();
  await page.locator("#mobileNavPanel").getByRole("link", { name: /^gallery$/i }).click();
  await expect(page).toHaveURL(/\/en\/gallery$/);
  await expect(page.locator(".gx-card")).toHaveCount(32);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  test(`hero fits and advances at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/en");
    await expect(page.locator(".hx-card.is-center")).toBeVisible();
    await expect(page.locator(".hx-slider")).toHaveCount(0);
    const bounds = await page.locator(".hx-card.is-center").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y).toBeGreaterThanOrEqual(50);
    expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height - 100);
    if (viewport.width === 1280) expect(bounds!.height).toBeCloseTo(556, 0);
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".home-filmstrip button").last()).toHaveAttribute("aria-current", "true");
    await page.locator(".home-filmstrip button").first().click();
    await expect(page.locator(".home-filmstrip button").first()).toHaveAttribute("aria-current", "true");
    await page.screenshot({ path: `/tmp/reference-audit-home-${viewport.width}.png` });
  });
}

test("returning visitors skip the signature and grid on reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards");
  await expect(page.locator(".loader")).toHaveCount(0);
  await expect(page.locator(".hx-grid")).toBeHidden();
});

test("all gallery photos load and keyboard browsing opens newly added photos", async ({ page }) => {
  await page.goto("/en/gallery");
  await expect(page.locator(".gx-card")).toHaveCount(32);
  await expect.poll(() => page.locator(".gx-card img").evaluateAll(nodes => nodes.filter(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0).length)).toBe(32);
  await page.getByRole("button", { name: "Open Sweet Mood — 02", exact: true }).press("Enter");
  await expect(page.locator(".gx-card.is-open")).toHaveAttribute("aria-label", "Close Sweet Mood — 02");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".gx-card.is-open")).toHaveAttribute("aria-label", "Close PORTRAIT 01");
  await page.keyboard.press("Escape");
  await expect(page.locator(".gx-card.is-open")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/reference-audit-gallery.png" });
});
