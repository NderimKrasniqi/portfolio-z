"use client";

import { loadGsap, prefersReducedMotion } from "./motion";

export function runHomeIntro({
  stage,
  grid,
  cells,
  lists,
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
  lists: HTMLElement[];
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

  pool.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
  const final = new Image();
  final.src = finalSrc;

  void loadGsap().then((gsap) => {
    if (cancelled || !gsap) return finish();

    gsap.set(grid, { autoAlpha: 1 });
    gsap.set([...reveal, ...sides], { autoAlpha: 0 });
    gsap.fromTo(cells, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25, stagger: 0.03 });
    gsap.fromTo(lists, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, delay: 0.1 });

    let tick = 0;
    const steps = 9;
    const swap = () => {
      if (cancelled) return;
      cells.forEach((cell, index) => {
        cell.src = pool[(tick * 5 + index * 7) % pool.length];
      });
      tick++;
      if (tick < steps) timers.push(window.setTimeout(swap, 150 + tick * 10));
      else {
        cells[4].src = finalSrc;
        timers.push(window.setTimeout(collapse, 300));
      }
    };
    timers.push(window.setTimeout(swap, 250));

    const collapse = () => {
      if (cancelled) return;
      const others = cells.filter((_, index) => index !== 4);
      const cell = cells[4];
      const from = cell.getBoundingClientRect();
      gsap.set(cell, { position: "fixed", left: from.left, top: from.top, width: from.width, height: from.height, margin: 0, zIndex: 10 });
      const tall = from.width * 1.08;
      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set(stage, { clearProps: "backgroundColor" });
          finish();
        },
      });
      timeline
        .to(lists, { autoAlpha: 0, duration: 0.35 }, 0)
        .to(others, { scaleY: 0.3, transformOrigin: "50% 0%", duration: 0.45, ease: "power2.in" }, 0)
        .to(others, { scaleY: 0, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0.45)
        .to(cell, { top: from.top - (tall - from.height) / 2, height: tall, duration: 0.6, ease: "power3.inOut" }, 0.1)
        .add(() => {
          const to = center.getBoundingClientRect();
          gsap.to(cell, { left: to.left, top: to.top, width: to.width, height: to.height, duration: 0.95, ease: "power4.inOut" });
        }, 1.05)
        .to(stage, { backgroundColor: paper, duration: 0.5, ease: "power1.inOut" }, 1.1)
        .set(center, { autoAlpha: 1 }, 2.0)
        .set(cell, { autoAlpha: 0 }, 2.0)
        .fromTo(sides, { x: 0, rotationY: 0, rotation: 0, scale: 0.9, autoAlpha: 1 }, { x: (index: number) => Number(sides[index].dataset.x), rotationY: (index: number) => Number(sides[index].dataset.ry), rotation: (index: number) => Number(sides[index].dataset.rz), scale: 0.86, duration: 0.8, ease: "power3.out", immediateRender: false }, 2.15)
        .to(reveal, { autoAlpha: 1, duration: 0.6, stagger: 0.05, ease: "power2.out" }, 2.4);
    };
  });

  return () => {
    cancelled = true;
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
