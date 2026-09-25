"use client";

import {
  useEffect,
  useRef,
  type RefObject,
} from "react";

export function useHomeInput({
  active,
  menuOpen,
  stage,
  step,
}: {
  active: boolean;
  menuOpen: boolean;
  stage: RefObject<HTMLElement | null>;
  step: (amount: number) => void;
}) {
  const lastWheel = useRef(0);
  const wheelAmount = useRef(0);
  const wheelConsumed = useRef(false);
  const wheelTailSeen = useRef(false);
  const lastWheelAbs = useRef(0);
  const touchStart = useRef<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!active || menuOpen) return;

    wheelAmount.current = 0;
    wheelConsumed.current = false;
    wheelTailSeen.current = false;

    const onWheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        (event.target instanceof Element &&
          event.target.closest(".filmstrip"))
      ) {
        return;
      }

      event.preventDefault();

      const now = performance.now();

      const raw =
        Math.abs(event.deltaY) >=
        Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;

      const delta =
        event.deltaMode === 1
          ? raw * 18
          : event.deltaMode === 2
            ? raw * window.innerHeight
            : raw;

      const absolute = Math.abs(delta);

      if (absolute < 1) return;

      const gap = lastWheel.current
        ? now - lastWheel.current
        : Infinity;

      if (wheelConsumed.current) {
        const freshAfterGap =
          gap > 150;

        const freshAfterTail =
          wheelTailSeen.current &&
          absolute >= 12 &&
          absolute >
            Math.max(
              12,
              lastWheelAbs.current * 1.8,
            );

        if (
          freshAfterGap ||
          freshAfterTail
        ) {
          wheelConsumed.current = false;
          wheelTailSeen.current = false;
          wheelAmount.current = 0;
        } else {
          if (absolute <= 5) {
            wheelTailSeen.current = true;
          }

          lastWheel.current = now;
          lastWheelAbs.current = absolute;
          return;
        }
      }

      if (gap > 150) {
        wheelAmount.current = 0;
      }

      lastWheel.current = now;
      lastWheelAbs.current = absolute;

      if (
        wheelAmount.current &&
        Math.sign(wheelAmount.current) !==
          Math.sign(delta)
      ) {
        wheelAmount.current = 0;
      }

      wheelAmount.current += delta;

      if (
        Math.abs(wheelAmount.current) >= 46
      ) {
        wheelConsumed.current = true;
        wheelTailSeen.current = false;

        step(
          Math.sign(
            wheelAmount.current,
          ),
        );

        wheelAmount.current = 0;
      }
    };

    const onKey = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        step(1);
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        step(-1);
      }
    };

    const onStart = (
      event: TouchEvent,
    ) => {
      if (!event.touches[0]) return;

      touchStart.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    };

    const onEnd = (
      event: TouchEvent,
    ) => {
      if (
        !touchStart.current ||
        !event.changedTouches[0]
      ) {
        return;
      }

      const deltaX =
        touchStart.current.x -
        event.changedTouches[0].clientX;

      const deltaY =
        touchStart.current.y -
        event.changedTouches[0].clientY;

      const delta =
        Math.abs(deltaY) >=
        Math.abs(deltaX)
          ? deltaY
          : deltaX;

      if (Math.abs(delta) > 32) {
        step(Math.sign(delta));
      }

      touchStart.current = null;
    };

    const element = stage.current;

    element?.addEventListener(
      "wheel",
      onWheel,
      { passive: false },
    );

    element?.addEventListener(
      "touchstart",
      onStart,
      { passive: true },
    );

    element?.addEventListener(
      "touchend",
      onEnd,
      { passive: true },
    );

    window.addEventListener(
      "keydown",
      onKey,
    );

    return () => {
      element?.removeEventListener(
        "wheel",
        onWheel,
      );

      element?.removeEventListener(
        "touchstart",
        onStart,
      );

      element?.removeEventListener(
        "touchend",
        onEnd,
      );

      window.removeEventListener(
        "keydown",
        onKey,
      );
    };
  }, [
    active,
    menuOpen,
    stage,
    step,
  ]);
}
