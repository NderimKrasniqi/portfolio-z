import { test, expect } from "@playwright/test";

test("filmstrip and original letter effects work without whole-name drift", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  const thumbs = page.locator(".home-filmstrip button");
  await thumbs.nth(1).hover();
  await expect.poll(() => thumbs.nth(0).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeLessThan(-4);
  await expect.poll(() => thumbs.nth(2).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m41)).toBeGreaterThan(4);
  await thumbs.nth(1).click();
  await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");
  const name = page.getByRole("heading", { name: "Zeudi Di Palma" });
  const box = await name.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(name).toHaveCSS("translate", "none");
  await expect.poll(() => page.locator(".home-name-glyph").evaluateAll(glyphs => glyphs.some(el => Math.abs(new DOMMatrix(getComputedStyle(el).transform).m41) > .1))).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => thumbs.nth(1).evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await expect.poll(() => page.locator(".home-name-char").first().evaluate(el => getComputedStyle(el).transform)).toBe("none");
});

test("a correctly proportioned filmstrip preview enlarges into the main video", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  await expect(page.locator(".home-filmstrip button")).toHaveCount(3);
  expect(await page.locator(".home-filmstrip button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")))).toEqual(["Play YSL Beauty", "Play Pandora", "Play DKNY"]);
  const thumbnail = page.locator(".home-filmstrip button").nth(1);
  const img = thumbnail.locator("img");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 15000 });
  await expect(page.locator(".hx-card.is-center")).toHaveAttribute("aria-label", "YSL Beauty");
  await expect(page.locator(".hx-card.is-center video")).toHaveCSS("object-fit", "cover");
  const heroRatio = await page.locator(".hx-card.is-center").evaluate(el => el.clientWidth / el.clientHeight);
  expect(heroRatio).toBeCloseTo(.65, 2);
  const thumbnailRatios = await page.locator(".home-filmstrip img").evaluateAll(images => images.map(el => el.clientWidth / el.clientHeight));
  for (const ratio of thumbnailRatios) expect(Math.abs(ratio - heroRatio)).toBeLessThan(.025);
  await page.screenshot({ path: "/tmp/zeudi-filmstrip-proportions.png" });
  await thumbnail.click();
  const flight = page.locator(".home-film-flight");
  await expect(flight).toBeVisible();
  await expect(flight.locator("video")).toHaveCSS("object-fit", "cover");
  await expect(thumbnail).toBeVisible();
  await expect.poll(async () => (await flight.boundingBox())?.height ?? 0, {intervals:[20]}).toBeGreaterThan(80);
  await expect(thumbnail).toHaveAttribute("aria-current", "true");
  await expect(flight).toHaveCount(0);
  expect(await page.locator(".hx-card").evaluate(el => el.clientWidth / el.clientHeight)).toBeCloseTo(.65, 2);
  await expect(page.locator(".hx-card video")).toHaveAttribute("poster", (await img.getAttribute("src"))!);
  // A new choice cancels an in-flight copy instead of stacking competing animations.
  await page.locator(".home-filmstrip button").nth(2).click();
  await expect(flight).toBeVisible();
  await page.locator(".home-filmstrip button").nth(0).click();
  await expect(page.locator(".home-filmstrip button").nth(0)).toHaveAttribute("aria-current", "true");
  await expect(flight).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHeroRatio = await page.locator(".hx-card.is-center").evaluate(el => el.clientWidth / el.clientHeight);
  const mobileRatios = await page.locator(".home-filmstrip img").evaluateAll(images => images.map(el => el.clientWidth / el.clientHeight));
  expect(mobileHeroRatio).toBeCloseTo(.65, 2);
  for (const ratio of mobileRatios) expect(Math.abs(ratio - mobileHeroRatio)).toBeLessThan(.025);
  const strip = await page.locator(".home-filmstrip").evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(strip.content).toBeLessThanOrEqual(strip.width + 1);
  await page.screenshot({ path: "/tmp/zeudi-filmstrip-proportions-mobile.png" });
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const { top, bottom, height } = document.querySelector(selector)!.getBoundingClientRect();
        return { top, bottom, height };
      };
      return { name: rect(".home-identity"), video: rect(".hx-card.is-center"), scroll: rect(".home-scroll"), strip: rect(".home-filmstrip") };
    });
    expect(boxes.video.top - boxes.name.bottom).toBeGreaterThanOrEqual(20);
    expect(boxes.scroll.top - boxes.video.bottom).toBeGreaterThanOrEqual(19);
    expect(boxes.strip.top - boxes.scroll.bottom).toBeGreaterThanOrEqual(12);
    expect(boxes.strip.bottom).toBeLessThanOrEqual(viewport.height - 12);
    if (viewport.height >= 740) expect(boxes.video.height).toBeGreaterThan((viewport.width - 24) / .79);
    await page.screenshot({ path: `/tmp/zeudi-home-spacing-${viewport.width}.png` });
  }
});

test("scroll slides films in both directions and consumes trackpad momentum once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 15000 });
  const thumbs = page.locator(".home-filmstrip button");
  const active = await thumbs.evaluateAll(nodes => nodes.findIndex(node => node.getAttribute("aria-current") === "true"));
  await page.locator("#stage").dispatchEvent("wheel", { deltaY: 80 });
  const incoming = page.locator(".home-video-transition");
  await expect(incoming).toBeVisible();
  await expect.poll(() => incoming.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42), { intervals: [20] }).toBeGreaterThan(0);
  expect(await page.locator(".home-name-line").evaluateAll(lines => lines.every(line => getComputedStyle(line).transform === "none" && line.getAnimations().length === 0))).toBe(true);
  const midSlide = await page.locator(".hx-card").evaluate(hero => {
    const animations = hero.getAnimations({ subtree: true });
    animations.forEach(animation => { animation.pause(); animation.currentTime = 450; });
    const outgoing = hero.querySelector(":scope > video")!.getBoundingClientRect();
    const incoming = hero.querySelector(".home-video-transition video")!.getBoundingClientRect();
    const frame = hero.getBoundingClientRect();
    const result = { frameWidth: frame.width, frameHeight: frame.height,
      outgoingWidth: outgoing.width, outgoingHeight: outgoing.height,
      incomingWidth: incoming.width, incomingHeight: incoming.height,
      seam: Math.abs(outgoing.bottom - incoming.top) };
    animations.forEach(animation => animation.play());
    return result;
  });
  expect(midSlide.outgoingWidth).toBeCloseTo(midSlide.frameWidth, 1);
  expect(midSlide.incomingWidth).toBeCloseTo(midSlide.frameWidth, 1);
  expect(midSlide.outgoingHeight).toBeCloseTo(midSlide.frameHeight, 1);
  expect(midSlide.incomingHeight).toBeCloseTo(midSlide.frameHeight, 1);
  expect(midSlide.seam).toBeLessThan(1);
  await page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      document.querySelector("#stage")!.dispatchEvent(new WheelEvent("wheel", { deltaY: 18, bubbles: true, cancelable: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });
  await expect(thumbs.nth((active + 1) % await thumbs.count())).toHaveAttribute("aria-current", "true");
  await expect(incoming).toHaveCount(0);
  await page.waitForTimeout(250);
  await page.locator("#stage").dispatchEvent("wheel", { deltaY: -80 });
  await expect(incoming).toBeVisible();
  await expect.poll(() => incoming.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42), { intervals: [20] }).toBeLessThan(0);
  await expect(thumbs.nth(active)).toHaveAttribute("aria-current", "true");
  await expect(incoming).toHaveCount(0);
});


test("all three films fill equal frames with a balanced crop and filmstrip clearance", async ({ page }) => {
  await page.goto("/en");
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    const widths: number[] = [];
    const heights: number[] = [];
    for (let index = 0; index < 3; index++) {
      await page.locator(".home-filmstrip button").nth(index).click();
      const video = page.locator(".hx-card > video");
      await expect.poll(() => video.evaluate(v => (v as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
      await expect(video).toHaveCSS("object-fit", "cover");
      const bounds = await video.evaluate(el => {
        const video = el as HTMLVideoElement;
        const box = video.getBoundingClientRect();
        const scale = Math.max(box.width / video.videoWidth, box.height / video.videoHeight);
        const strip = document.querySelector(".home-filmstrip")!.getBoundingClientRect();
        return { width: video.videoWidth * scale, height: video.videoHeight * scale, boxWidth: box.width, boxHeight: box.height, top: box.top,
          bottom: box.bottom, stripTop: strip.top };
      });
      expect(1 - bounds.boxWidth / bounds.width).toBeLessThan(.14);
      expect(1 - bounds.boxHeight / bounds.height).toBeLessThan(.14);
      expect(bounds.top).toBeGreaterThan(40);
      expect(bounds.stripTop - bounds.bottom).toBeGreaterThanOrEqual(23);
      widths.push(bounds.boxWidth);
      heights.push(bounds.boxHeight);
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  }
});


test("the live preview follows selection and spatial motion respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => sessionStorage.setItem("zeudi-loader-seen", "1"));
  await page.goto("/en");
  await expect(page.locator(".hx")).toHaveAttribute("data-phase", "cards", { timeout: 15000 });
  const live = page.locator(".home-filmstrip .is-active canvas");
  await expect(live).toHaveCSS("opacity", "1");
  await page.mouse.move(1150, 400);
  await expect.poll(() => page.locator("#stage").evaluate(el => parseFloat(el.style.getPropertyValue("--home-drift")))).toBeGreaterThan(3);
  await page.locator(".home-filmstrip button").nth(1).click();
  await expect(page.locator(".home-filmstrip button").nth(1)).toHaveAttribute("aria-current", "true");
  await expect(live).toHaveCSS("opacity", "1");
  await expect(page.locator(".home-filmstrip button").first().locator("canvas")).toHaveCSS("opacity", "0");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(live).toHaveCSS("opacity", "0");
  await expect(page.locator(".hx-cards")).toHaveCSS("translate", "none");
});
