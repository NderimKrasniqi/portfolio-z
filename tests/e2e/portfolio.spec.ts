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

  const galleryLink =
    page.locator(".gallery-open");

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
});

test("contact representation renders", async ({
  page,
}) => {
  await page.goto("/en/contact");

  await expect(
    page.locator(".rep-row"),
  ).toHaveCount(3);
});
