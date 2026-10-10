import { test, expect } from "@playwright/test";

test("music keeps the same player across every section and remains controllable", async ({ page }) => {
  // Isolate navigation/player lifetime from YouTube availability and autoplay policy.
  await page.route("https://www.youtube.com/embed/**", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.route("https://www.youtube.com/iframe_api", route => route.fulfill({
    contentType: "application/javascript",
    body: `window.musicCalls = { created: 0, destroyed: 0, paused: 0 };
      window.YT = { PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, CUED: 5 },
        Player: function(frame, options) {
          window.musicCalls.created++;
          this.setVolume = this.unMute = function() {};
          this.playVideo = function() { options.events.onStateChange({data: 1}); };
          this.pauseVideo = function() { window.musicCalls.paused++; };
          this.destroy = function() { window.musicCalls.destroyed++; };
          setTimeout(() => options.events.onReady(), 0);
        }
      }; window.onYouTubeIframeAPIReady();`,
  }));
  await page.goto("/en");
  await page.getByRole("button", { name: "Play Singing Guitar Vibes, Pt. 2" }).click();
  await expect(page.getByRole("button", { name: "Pause Singing Guitar Vibes, Pt. 2" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { musicCalls?: { created: number } }).musicCalls?.created)).toBe(1);
  const frame = await page.locator("#homeMusicPlayer iframe").elementHandle();
  for (const section of ["Gallery", "About", "Shop", "Contact"]) {
    await page.locator(`.home-original-nav a[href="/en/${section.toLowerCase()}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/en/${section.toLowerCase()}$`));
    await expect(page.getByRole("button", { name: "Pause Singing Guitar Vibes, Pt. 2" })).toBeVisible();
    expect(await frame!.evaluate(el => el.isConnected && el === document.querySelector("#homeMusicPlayer iframe"))).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(/\/en$/);
  }
  expect(await page.evaluate(() => (window as unknown as { musicCalls: object }).musicCalls)).toEqual({ created: 1, destroyed: 0, paused: 0 });
  await page.getByRole("button", { name: "Pause Singing Guitar Vibes, Pt. 2" }).click();
  await expect(page.getByRole("button", { name: "Play Singing Guitar Vibes, Pt. 2" })).toBeVisible();
  await expect(page.locator("#homeMusicPlayer iframe")).toHaveCount(0);
});
