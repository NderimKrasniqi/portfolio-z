"use client";

import { loadGsap, prefersReducedMotion } from "./motion";

/*
 * Home intro, after the preloader:
 * 1. a 3×3 picture grid whose pictures change quickly, between two project lists;
 * 2. the grid collapses: the centre picture grows into the centre card while
 *    the other cells and the lists fade away;
 * 3. the side cards, the copy and the name slider appear.
 */
export function runHomeIntro({
  grid,
  cells,
  lists,
  center,
  reveal,
  pool,
  finalSrc,
  onDone,
}: {
  grid: HTMLElement;
  cells: HTMLImageElement[];
  lists: HTMLElement[];
  center: HTMLElement;
  reveal: HTMLElement[];
  pool: string[];
  finalSrc: string;
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

  // preload the small pictures, so a cell is never blank while it changes
  pool.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
  const final = new Image();
  final.src = finalSrc;

  void loadGsap().then((gsap) => {
    if (cancelled || !gsap) return finish();

    gsap.set(grid, { autoAlpha: 1 });
    gsap.set(reveal, { autoAlpha: 0 });
    gsap.fromTo(cells, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.4, stagger: 0.035, ease: "power2.out" });
    gsap.fromTo(lists, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, delay: 0.15 });

    // 1. pictures change, slowing down before the collapse
    let tick = 0;
    const steps = 10;
    const swap = () => {
      if (cancelled) return;
      cells.forEach((cell, index) => {
        cell.src = pool[(tick * 5 + index * 7) % pool.length];
      });
      tick++;
      if (tick < steps) {
        timers.push(window.setTimeout(swap, 120 + tick * 12));
      } else {
        cells[4].src = finalSrc;
        timers.push(window.setTimeout(collapse, 380));
      }
    };
    timers.push(window.setTimeout(swap, 300));

    // 2. the centre cell grows into the centre card
    const collapse = () => {
      if (cancelled) return;
      const from = cells[4].getBoundingClientRect();
      const to = center.getBoundingClientRect();
      const others = cells.filter((_, index) => index !== 4);
      const timeline = gsap.timeline({ onComplete: finish });
      timeline
        .to(lists, { autoAlpha: 0, duration: 0.3, ease: "power1.out" }, 0)
        .to(
          others,
          {
            x: (index: number) => {
              const box = others[index].getBoundingClientRect();
              return from.left + from.width / 2 - (box.left + box.width / 2);
            },
            y: (index: number) => {
              const box = others[index].getBoundingClientRect();
              return from.top + from.height / 2 - (box.top + box.height / 2);
            },
            autoAlpha: 0,
            duration: 0.55,
            ease: "power3.in",
          },
          0,
        )
        .to(
          cells[4],
          {
            x: to.left - from.left,
            y: to.top - from.top,
            scaleX: to.width / from.width,
            scaleY: to.height / from.height,
            transformOrigin: "0 0",
            duration: 0.85,
            ease: "power4.inOut",
          },
          0.3,
        )
        .set(center, { autoAlpha: 1 })
        .to(reveal, { autoAlpha: 1, duration: 0.6, stagger: 0.06, ease: "power2.out" });
    };
  });

  return () => {
    cancelled = true;
    timers.forEach((timer) => window.clearTimeout(timer));
  };
}
