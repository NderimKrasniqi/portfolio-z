import { expect, test } from "@playwright/test";

test("paper shutters bridge every section and release the gallery intro", async ({ page }) => {
  test.setTimeout(60000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 15000 });
  for (const section of ["about", "shop", "contact", "gallery"]) {
    await page.locator(`.home-original-nav a[href="/en/${section}"]`).click();
    await expect(page.locator(".site-transition > span")).toHaveCount(3);
    await expect(page).toHaveURL(new RegExp(`/en/${section}$`));
    await expect(page.locator(".site-transition")).toHaveCount(0);
    await expect(page.locator(".site-header__back")).toBeVisible();
    if (section === "gallery") await expect(page.locator(".gx")).toHaveAttribute("data-intro", "sphere", { timeout: 15000 });
    await page.getByRole("button", { name: "Back to main page" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator(".site-transition")).toHaveCount(0);
    await expect(page.locator(".hx-card.is-center")).toBeVisible();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/gallery$/);
  await expect(page.locator(".site-transition")).toHaveCount(0);
  await expect(page.locator(".gx")).toHaveAttribute("data-intro", "sphere", { timeout: 15000 });
});

test("signature closes as a paper band before the Nite grid", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  await expect(page.locator(".loader")).toBeVisible();
  await expect.poll(() => page.locator(".loader").evaluate(el => getComputedStyle(el).clipPath), { intervals: [15] }).not.toBe("none");
  await page.screenshot({ path: "/tmp/zeudi-preload-shutter.png" });
  await expect(page.locator(".loader")).toHaveCount(0);
  await expect(page.locator(".hx-grid")).toBeVisible();
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 15000 });
});
