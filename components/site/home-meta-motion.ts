"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export function runHomeMetaMotion({
  counter,
  dot,
  current,
  previous,
  itemCount,
}: {
  counter: HTMLSpanElement | null;
  dot: HTMLSpanElement | null;
  current: number;
  previous: number;
  itemCount: number;
}) {
  if (!counter || !dot) return () => {};

  let cancelled = false;

  const last = Math.max(0, itemCount - 1);
  const center = Math.min(4, last);

  const progress =
    last === 0
      ? 0
      : current <= center
        ? center > 0
          ? 0.5 * (current / center)
          : 0
        : 0.5 +
          0.5 *
            ((current - center) /
              Math.max(1, last - center));

  void loadGsap().then((gsap) => {
    if (cancelled || !gsap) return;

    if (
      prefersReducedMotion() ||
      previous === current
    ) {
      gsap.set(counter, {
        yPercent: 0,
      });

      counter.textContent = String(
        current + 1,
      ).padStart(2, "0");

      gsap.set(dot, { y: 0 });

      return;
    }

    const direction =
      current > previous ? 1 : -1;

    const outgoing =
      -115 * direction;

    const incoming =
      115 * direction;

    gsap.killTweensOf([
      counter,
      dot,
    ]);

    gsap.set(counter, {
      yPercent: 0,
    });

    gsap
      .timeline({
        defaults: {
          overwrite: "auto",
        },
      })
      .to(
        counter,
        {
          yPercent: outgoing,
          duration: 0.2,
          ease: "power2.in",
        },
        0,
      )
      .add(() => {
        counter.textContent = String(
          current + 1,
        ).padStart(2, "0");
      }, 0.2)
      .set(
        counter,
        {
          yPercent: incoming,
        },
        0.2,
      )
      .to(
        counter,
        {
          yPercent: 0,
          duration: 0.34,
          ease: "power3.out",
        },
        0.215,
      );

    const rail = dot.parentElement;
    const railHeight =
      rail?.clientHeight || 1;
    const dotHeight =
      dot.offsetHeight || 5;

    gsap.to(dot, {
      y:
        progress *
        Math.max(
          0,
          railHeight - dotHeight,
        ),
      duration: 0.46,
      ease: "power3.inOut",
      overwrite: "auto",
    });
  });

  return () => {
    cancelled = true;
  };
}
