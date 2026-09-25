"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export function runHomeIdentityMotion({
  active,
  preview,
  loading,
  name,
  stage,
}: {
  active: boolean;
  preview: boolean;
  loading: boolean;
  name: HTMLHeadingElement | null;
  stage: HTMLElement | null;
}) {
  if (
    !active ||
    preview ||
    loading ||
    prefersReducedMotion()
  ) {
    return () => {};
  }

  let cancelled = false;
  let dispose = () => {};

  void loadGsap().then((gsap) => {
    if (
      cancelled ||
      !gsap ||
      prefersReducedMotion() ||
      !name ||
      !stage
    ) {
      return;
    }

    const chars = [
      ...name.querySelectorAll<HTMLElement>(
        ".identity__char",
      ),
    ];

    const glyphs = chars
      .map((char) =>
        char.querySelector<HTMLElement>(
          ".identity__glyph",
        ),
      )
      .filter(
        (
          glyph,
        ): glyph is HTMLElement =>
          Boolean(glyph),
      );

    if (
      chars.length < 2 ||
      glyphs.length !== chars.length
    ) {
      return;
    }

    const pulse =
      document.createElement("div");

    pulse.className =
      "home-exposure-pulse";

    pulse.setAttribute(
      "aria-hidden",
      "true",
    );

    document.body.appendChild(pulse);

    let timer:
      | { kill: () => void }
      | null = null;

    let running = false;
    let previous = new Set<number>();

    const panelOpen = () =>
      Boolean(
        document.querySelector(
          ".gallery-panel.open,.about-panel.open,.shop-panel.open,.contact-panel.open",
        ),
      );

    const canAnimate = () =>
      !cancelled &&
      !document.hidden &&
      !panelOpen();

    const clearTimer = () => {
      timer?.kill();
      timer = null;
    };

    const resetMagnet = () =>
      glyphs.forEach((glyph) =>
        gsap.to(glyph, {
          x: 0,
          y: 0,
          rotation: 0,
          duration: 0.42,
          ease: "power3.out",
          overwrite: true,
        }),
      );

    const materialPulse = () => {
      gsap.killTweensOf(pulse);

      gsap
        .timeline()
        .to(pulse, {
          opacity: 0.014,
          duration: 0.09,
          ease: "power1.out",
        })
        .to(pulse, {
          opacity: 0,
          duration: 0.28,
          ease: "power2.out",
        });

      gsap.to(stage, {
        "--zeudi-grain-lift": 0.018,
        duration: 0.12,
        yoyo: true,
        repeat: 1,
        ease: "power1.out",
        overwrite: true,
      });
    };

    const chooseGroup = () => {
      const count =
        Math.random() < 0.62
          ? 1
          : Math.random() < 0.84
            ? 2
            : 3;

      const pool = chars
        .map((_, index) => index)
        .filter(
          (index) =>
            !previous.has(index),
        );

      gsap.utils.shuffle(pool);

      const picked = pool.slice(
        0,
        Math.min(count, pool.length),
      );

      previous = new Set(picked);

      return picked.map(
        (index) => chars[index],
      );
    };

    const schedule = () => {
      clearTimer();

      if (!canAnimate()) {
        running = false;
        return;
      }

      running = true;

      timer = gsap.delayedCall(
        gsap.utils.random(3.4, 5.4),
        flipGroup,
      );
    };

    const flipGroup = () => {
      if (!canAnimate()) {
        schedule();
        return;
      }

      const group = chooseGroup();

      materialPulse();

      let longest = 0;

      group.forEach((char, index) => {
        const direction =
          Math.random() < 0.5
            ? -1
            : 1;

        const axis =
          Math.random() < 0.78
            ? "rotationX"
            : "rotationY";

        const stagger =
          index *
          gsap.utils.random(
            0.055,
            0.11,
          );

        const firstDuration =
          gsap.utils.random(
            0.52,
            0.61,
          );

        const secondDuration =
          gsap.utils.random(
            0.58,
            0.69,
          );

        longest = Math.max(
          longest,
          stagger +
            firstDuration +
            secondDuration,
        );

        gsap.killTweensOf(char);

        gsap.set(char, {
          rotationX: 0,
          rotationY: 0,
          scaleX: 1,
          scaleY: 1,
          transformPerspective: 780,
        });

        gsap
          .timeline({
            delay: stagger,
          })
          .to(char, {
            [axis]:
              direction * 180,
            scaleY: 0.975,
            duration:
              firstDuration,
            ease: "power1.inOut",
          })
          .to(char, {
            [axis]:
              direction * 360,
            scaleY: 1,
            duration:
              secondDuration,
            ease: "power2.inOut",
          })
          .set(char, {
            rotationX: 0,
            rotationY: 0,
          });
      });

      gsap.delayedCall(
        longest + 0.06,
        schedule,
      );
    };

    const quickX = glyphs.map(
      (glyph) =>
        gsap.quickTo(glyph, "x", {
          duration: 0.42,
          ease: "power3.out",
        }),
    );

    const quickY = glyphs.map(
      (glyph) =>
        gsap.quickTo(glyph, "y", {
          duration: 0.42,
          ease: "power3.out",
        }),
    );

    const quickRotation =
      glyphs.map((glyph) =>
        gsap.quickTo(
          glyph,
          "rotation",
          {
            duration: 0.48,
            ease: "power3.out",
          },
        ),
      );

    const onPointerMove = (
      event: PointerEvent,
    ) => {
      if (
        !canAnimate() ||
        event.pointerType === "touch"
      ) {
        return;
      }

      const bounds =
        name.getBoundingClientRect();

      const distance = Math.hypot(
        event.clientX -
          (bounds.left +
            bounds.width / 2),
        event.clientY -
          (bounds.top +
            bounds.height / 2),
      );

      const radius = Math.max(
        190,
        bounds.width * 0.82,
      );

      if (distance > radius) {
        resetMagnet();
        return;
      }

      glyphs.forEach(
        (glyph, index) => {
          const rect =
            glyph.getBoundingClientRect();

          const dx =
            event.clientX -
            (rect.left +
              rect.width / 2);

          const dy =
            event.clientY -
            (rect.top +
              rect.height / 2);

          const length = Math.max(
            45,
            Math.hypot(dx, dy),
          );

          const force = Math.max(
            0,
            1 - length / radius,
          );

          quickX[index](
            Math.max(
              -2.4,
              Math.min(
                2.4,
                (dx / length) *
                  2.4 *
                  force,
              ),
            ),
          );

          quickY[index](
            Math.max(
              -1.8,
              Math.min(
                1.8,
                (dy / length) *
                  1.8 *
                  force,
              ),
            ),
          );

          quickRotation[index](
            Math.max(
              -0.8,
              Math.min(
                0.8,
                (dx / radius) *
                  0.8 *
                  force,
              ),
            ),
          );
        },
      );
    };

    const sync = () => {
      if (canAnimate()) {
        if (!running) {
          schedule();
        }

        return;
      }

      clearTimer();
      running = false;
      resetMagnet();

      chars.forEach((char) => {
        gsap.killTweensOf(char);

        gsap.set(char, {
          rotationX: 0,
          rotationY: 0,
          scaleX: 1,
          scaleY: 1,
        });
      });

      gsap.set(pulse, {
        opacity: 0,
      });

      stage.style.setProperty(
        "--zeudi-grain-lift",
        "0",
      );
    };

    window.addEventListener(
      "pointermove",
      onPointerMove,
      { passive: true },
    );

    document.addEventListener(
      "visibilitychange",
      sync,
    );

    window.addEventListener(
      "pageshow",
      sync,
    );

    schedule();

    dispose = () => {
      clearTimer();

      window.removeEventListener(
        "pointermove",
        onPointerMove,
      );

      document.removeEventListener(
        "visibilitychange",
        sync,
      );

      window.removeEventListener(
        "pageshow",
        sync,
      );

      gsap.killTweensOf([
        ...chars,
        ...glyphs,
        pulse,
      ]);

      pulse.remove();
    };
  });

  return () => {
    cancelled = true;
    dispose();
  };
}
