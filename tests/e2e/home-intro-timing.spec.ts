import { expect, test } from "@playwright/test";
import { homeCollaborations } from "../../components/site/home-collaborations";

test("brand scans follow the reference clock in both columns", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/en");
  const leftNames = await page.locator(".intro-credits--left .intro-credits__name").allTextContents();
  const rightNames = await page.locator(".intro-credits--right .intro-credits__name").allTextContents();
  expect(rightNames).toEqual([...leftNames].reverse());
  const recording = page.evaluate(async () => {
    const rows = [...document.querySelectorAll<HTMLElement>(".intro-credits__row")];
    const grid = document.querySelector<HTMLElement>(".hx-grid")!;
    const frames: { t: number; values: number[]; transforms: string[] }[] = [];
    let start = 0;
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        if (getComputedStyle(grid).visibility === "visible" && !start) start = now;
        if (start) frames.push({ t: (now - start) / 1000,
          values: rows.map(row => Number(getComputedStyle(row).opacity)),
          transforms: rows.map(row => getComputedStyle(row).transform) });
        if (start && now - start > 2900) resolve(); else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return frames;
  });
  await expect.poll(() => page.locator(".intro-credits__row").last().evaluate(row => Number(getComputedStyle(row).opacity)), { intervals: [20], timeout: 15000 }).toBe(1);
  await page.screenshot({ path: "/tmp/zeudi-nite-matched-intro.png" });
  const samples = await recording;
  for (const time of [.85, 1.85, 2.85]) {
    const frame = samples.find(frame => frame.t >= time)!;
    expect(frame.values).toHaveLength(homeCollaborations.length * 2);
    for (const opacity of frame.values) expect(opacity).toBeCloseTo(time === .85 ? .4 : time === 1.85 ? 1 : 0, 2);
    expect(frame.transforms.every(value => value === "none")).toBe(true);
  }
  for (const frame of samples) {
    for (let i = 0; i < homeCollaborations.length; i++) expect(frame.values[i]).toBeCloseTo(frame.values[i + homeCollaborations.length], 2);
  }
  await expect(page.locator('.hx')).toHaveAttribute('data-phase', 'cards');
});

test("reload replays the grid while the signature is once per tab", async ({ page, context }) => {
  test.setTimeout(45000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/en");
  await expect(page.locator(".loader")).toBeVisible();
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 20000 });
  expect(await page.evaluate(() => sessionStorage.getItem("zeudi-loader-seen"))).toBe("1");

  await page.reload();
  await expect(page.locator(".loader")).toHaveCount(0);
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "intro");
  await expect(page.locator(".hx-grid")).toBeVisible();
  await expect.poll(() => page.locator(".intro-credits__row").first().evaluate(row => Number(getComputedStyle(row).opacity))).toBeGreaterThan(0);
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 10000 });

  const freshTab = await context.newPage();
  await freshTab.emulateMedia({ reducedMotion: "no-preference" });
  await freshTab.goto("/en");
  await expect(freshTab.locator(".loader")).toBeVisible();
  expect(await freshTab.evaluate(() => sessionStorage.getItem("zeudi-loader-seen"))).toBeNull();
  await freshTab.close();
});
