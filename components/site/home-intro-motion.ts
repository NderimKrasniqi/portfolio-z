"use client";

import { loadGsap, prefersReducedMotion } from "./motion";

export function runHomeIntro({
  stage,
  grid,
  cells,
  center,
  sides,
  reveal,
  pool,
  finalSrc,
  paper,
  onDone,
}: {
  stage: HTMLElement;
  grid: HTMLElement;
  cells: HTMLImageElement[];
  center: HTMLElement;
  sides: HTMLElement[];
  reveal: HTMLElement[];
  pool: string[];
  finalSrc: string;
  paper: string;
  onDone: () => void;
}) {
  let cancelled = false;
  const timers: number[] = [];
  const animations: { kill: () => void }[] = [];

  const finish = () => {
    if (cancelled) return;
    grid.style.display = "none";
    onDone();
  };

  if (prefersReducedMotion() || !pool.length) {
    finish();
    return () => {
      cancelled = true;
    };
  }

  // Decode before shuffling so a flash always shows a complete photograph.
  const ready = [...new Set([...pool, finalSrc])].map((src) => {
    const image = new Image();
    image.src = src;
    return image.decode().catch(() => {});
  });
  const boundedReady = Promise.race([
    Promise.all(ready),
    new Promise<void>((resolve) => timers.push(window.setTimeout(resolve, 3000))),
  ]);

  void Promise.all([loadGsap(), boundedReady]).then(([gsap]) => {
    if (cancelled || !gsap) return finish();

    gsap.set(grid, { autoAlpha: 1 });
    const leftCredits = grid.querySelectorAll(".intro-credits--left .intro-credits__row");
    const rightCredits = grid.querySelectorAll(".intro-credits--right .intro-credits__row");
    // Measured from Nite's grid reveal (its separate logo prelude is excluded).
    // Keep the reference's 18-row phase boundaries even with our shorter brand lists.
    // Both columns share one clock; no setTimeout-driven text or extra reading hold.
    const scan = { duration: .1, stagger: .05, ease: "power2.inOut" };
    gsap.set([...leftCredits, ...rightCredits], { opacity: 0 });
    gsap.set([...reveal, ...sides], { autoAlpha: 0 });
    gsap.set(cells, { autoAlpha: 1, clipPath: "inset(0 0 100% 0)" });
    let tick = 0;
    const sequence = gsap.timeline();
    animations.push(sequence);
    sequence
      .to(cells, { clipPath: "inset(0 0 0% 0)", duration: .5, ease: "power2.inOut" }, 0)
      .to(leftCredits, { opacity: .4, ...scan }, .1)
      .to(rightCredits, { opacity: .4, ...scan }, .1)
      .to(leftCredits, { opacity: 1, ...scan }, 1.05)
      .to(rightCredits, { opacity: 1, ...scan }, 1.05)
      .to(leftCredits, { opacity: 0, ...scan }, 2.1)
      .to(rightCredits, { opacity: 0, ...scan }, 2.1);

    // Image changes remain on the same GSAP clock as the text, including on slow frames.
    for (let time = .1; time < 2.48; time += .1) {
      sequence.call(() => {
        tick++;
        cells.forEach((cell, index) => { cell.src = pool[(index + tick * 4) % pool.length]; });
      }, [], time);
    }
    sequence.call(() => {
      cells[4].src = finalSrc;
      collapse();
    }, [], 2.48);

    const collapse = () => {
      if (cancelled) return;
      const others = cells.filter((_, index) => index !== 4);
      const cell = cells[4];
      const from = cell.getBoundingClientRect();
      const video = center.querySelector("video");
      const nameLines = stage.querySelectorAll(".home-name-line");
      const previews = stage.querySelectorAll(".home-filmstrip img");
      gsap.set(cell, { position: "fixed", left: from.left, top: from.top, width: from.width, height: from.height, margin: 0, zIndex: 10 });
      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(stage, { clearProps: "backgroundColor" });
          finish();
        },
      });
      animations.push(timeline);
      timeline
        .to(others, { clipPath: "inset(0 0 100% 0)", duration: .5, ease: "power2.inOut" }, 0)
        .add(() => {
          const to = center.getBoundingClientRect();
          animations.push(gsap.to(cell, { left: to.left, top: to.top, width: to.width, height: to.height, duration: 0.5, ease: "power2.inOut" }));
        }, .57)
        .to(stage, { backgroundColor: paper, duration: 0.5, ease: "power1.inOut" }, .57)
        .call(() => { if (video) void video.play().catch(() => {}); }, [], .57)
        .set(center, { autoAlpha: 1 }, 1.07)
        .to(cell, { autoAlpha: 0, duration: .22, ease: "power1.out" }, 1.07)
        .to(reveal, { autoAlpha: 1, duration: .5, ease: "power2.out" }, .72)
        .fromTo(nameLines, { y: 22, opacity: 0 }, {
          y: 0, opacity: 1, stagger: .08, duration: .75, ease: "power3.out", clearProps: "transform,opacity",
        }, .72)
        .fromTo(previews, { y: -34, opacity: 0, scale: .82, rotation: (i: number) => (i - 1) * 7 }, {
          y: 0, opacity: 1, scale: 1, rotation: 0, stagger: .09, duration: .7,
          ease: "power3.out", clearProps: "transform,opacity",
        }, .94);
    };
  }).catch(finish);

  return () => {
    cancelled = true;
    animations.forEach((animation) => animation.kill());
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
