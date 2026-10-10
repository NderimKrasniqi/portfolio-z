import {
  expect,
  test,
} from "@playwright/test";

test("home → gallery → home navigation works", async ({
  page,
}) => {
  await page.goto("/en");

  await expect(
    page.locator(".stage"),
  ).toBeVisible();

  const galleryLink = page
    .locator(".hx-head")
    .getByRole("link", { name: /gallery/i });

  await expect(
    galleryLink,
  ).toBeVisible();

  await galleryLink.click();

  await expect(page).toHaveURL(
    /\/en\/gallery$/,
  );

  await expect(
    page.locator(
      ".gallery-panel.open",
    ),
  ).toBeVisible();

  await page
    .locator(".gallery-back")
    .click();

  await expect(page).toHaveURL(
    /\/en$/,
  );

  await expect(
    page.locator(".stage"),
  ).toBeVisible();
});

const publicPages = [
  {
    path: "/en/gallery",
    selector:
      ".gallery-panel.open",
  },
  {
    path: "/en/about",
    selector:
      ".about-panel.open",
  },
  {
    path: "/en/contact",
    selector:
      ".contact-panel.open",
  },
] as const;

for (const {
  path,
  selector,
} of publicPages) {
  test(`${path} renders its panel`, async ({
    page,
  }) => {
    await page.goto(path);

    await expect(
      page.locator(selector),
    ).toBeVisible();
  });
}

test("about content renders", async ({
  page,
}) => {
  await page.goto("/en/about");

  await expect(
    page.locator(".about-chapter"),
  ).not.toHaveCount(0);
  await expect(page.locator(".site-name,.site-header__title,.about-story-progress,.about-progress-track")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "MY STORY", exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/zeudi-about-clean-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/zeudi-about-clean-mobile.png" });
  await page.getByRole("button", { name: "Back to main page" }).click();
  await expect(page).toHaveURL(/\/en$/);
});

test("contact representation renders", async ({
  page,
}) => {
  await page.goto("/en/contact");

  await expect(
    page.locator(".rep-row"),
  ).toHaveCount(3);
  await expect(page.locator(".site-name,.site-header__title")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/zeudi-contact-clean-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/zeudi-contact-clean-mobile.png" });
  await page.getByRole("button", { name: "Back to main page" }).click();
  await expect(page).toHaveURL(/\/en$/);
});
