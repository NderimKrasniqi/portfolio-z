import { expect, test } from "@playwright/test";

test("category rails and collection filters keep products in the right collection", async ({
  page,
}) => {
  await page.goto("/en/shop");
  await expect(
    page.getByRole("heading", { name: "The wardrobe" }),
  ).toBeAttached();
  await expect(page.locator(".wardrobe-piece")).toHaveCount(4);
  await page.getByRole("button", { name: /^Hoodies/ }).click();
  await expect(page.locator(".wardrobe-piece")).toHaveCount(2);
  await page.getByRole("button", { name: /^Pants/ }).click();
  await expect(
    page.getByRole("button", { name: "View Worn-in denim", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Merch", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Hoodies/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: /^T-shirts/ }).click();
  await expect(page.locator(".wardrobe-piece")).toHaveCount(1);
  await page.getByRole("button", { name: /^Pants/ }).click();
  await expect(
    page.getByText("No pants in this collection yet."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore everything" }).click();
  await expect(page.locator(".wardrobe-piece")).toHaveCount(1);
});

test("keyboard browsing opens an accessible preview, cycles and restores focus", async ({
  page,
}) => {
  await page.goto("/en/shop");
  const leather = page.getByRole("button", {
    name: "View LEATHER JACKET",
    exact: true,
  });
  await leather.focus();
  await page.keyboard.press("ArrowRight");
  const blazer = page.getByRole("button", {
    name: "View PINSTRIPE BLAZER",
    exact: true,
  });
  await expect(blazer).toBeFocused();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading")).toHaveText("Pinstripe Blazer");
  await expect(detail.getByText("Preview piece · Not for sale")).toBeVisible();
  await expect(detail.locator('a[href^="mailto:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Next product" }).click();
  await expect(detail.getByRole("heading")).toHaveText("Vintage Varsity");
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(blazer).toBeFocused();
});

test("hover turns the selected garment and moves its neighbours aside", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en/shop");
  await page.waitForTimeout(800);
  const pieces = page.locator(".wardrobe-piece");
  const before = await pieces
    .nth(2)
    .evaluate((el) => el.style.getPropertyValue("--piece-x"));
  await pieces.nth(1).hover();
  await expect(pieces.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1000);
  const after = await pieces
    .nth(2)
    .evaluate((el) => el.style.getPropertyValue("--piece-x"));
  expect(parseFloat(after) - parseFloat(before)).toBeGreaterThan(60);
  expect(
    Number(
      await pieces
        .nth(1)
        .evaluate((el) => el.style.getPropertyValue("--piece-front")),
    ),
  ).toBeGreaterThan(0.95);
  await page.screenshot({ path: "/tmp/wardrobe-desktop.png" });
  await pieces.nth(1).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "/tmp/wardrobe-detail.png" });
});

test.describe("mobile wardrobe", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("tap previews, second tap opens, and rails remain available", async ({
    page,
  }) => {
    await page.goto("/en/shop");
    const item = page.getByRole("button", {
      name: "View PINSTRIPE BLAZER",
      exact: true,
    });
    await item.tap();
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: "/tmp/wardrobe-mobile.png" });
    await item.tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close product" }).tap();
    await page.getByRole("button", { name: /^T-shirts/ }).tap();
    await page
      .getByRole("button", { name: "View The everyday tee", exact: true })
      .tap();
    await page.screenshot({ path: "/tmp/wardrobe-tee-mobile.png" });
    await page.getByRole("button", { name: /^Pants/ }).tap();
    await page
      .getByRole("button", { name: "View Worn-in denim", exact: true })
      .tap();
    await page.screenshot({ path: "/tmp/wardrobe-pants-mobile.png" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
});
