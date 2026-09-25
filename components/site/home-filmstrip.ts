"use client";

import {
  useEffect,
  useLayoutEffect,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export function useHomeFilmstrip({
  track,
  marker,
  current,
  itemCount,
  select,
  suppressThumbClick,
}: {
  track: RefObject<HTMLDivElement | null>;
  marker: RefObject<HTMLSpanElement | null>;
  current: number;
  itemCount: number;
  select: (
    index: number,
    source?: HTMLButtonElement | null,
  ) => void;
  suppressThumbClick: MutableRefObject<boolean>;
}) {
  useEffect(() => {
    const strip = track.current;
    if (!strip) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const onDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        strip.dataset.fits === "1"
      ) return;

      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = strip.scrollLeft;
      moved = false;

      strip.setPointerCapture?.(
        event.pointerId,
      );
    };

    const onMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;

      const delta =
        event.clientX - startX;

      if (Math.abs(delta) > 3) {
        moved = true;
      }

      if (moved) {
        event.preventDefault();
        strip.scrollLeft =
          startScroll - delta;
      }
    };

    const onEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;

      const wasMoved = moved;

      pointerId = null;
      moved = false;

      try {
        strip.releasePointerCapture?.(
          event.pointerId,
        );
      } catch {}

      if (!wasMoved) return;

      const thumbs = [
        ...strip.querySelectorAll<HTMLButtonElement>(
          ".thumb",
        ),
      ];

      const center =
        strip.getBoundingClientRect().left +
        strip.clientWidth / 2;

      const nearest = thumbs.reduce(
        (best, thumb, index) => {
          const rect =
            thumb.getBoundingClientRect();

          const distance = Math.abs(
            (rect.left + rect.right) / 2 -
              center,
          );

          return distance < best.distance
            ? { index, distance }
            : best;
        },
        {
          index: current,
          distance:
            Number.POSITIVE_INFINITY,
        },
      );

      suppressThumbClick.current = true;
      select(nearest.index);
    };

    strip.addEventListener(
      "pointerdown",
      onDown,
    );
    strip.addEventListener(
      "pointermove",
      onMove,
      { passive: false },
    );
    strip.addEventListener(
      "pointerup",
      onEnd,
    );
    strip.addEventListener(
      "pointercancel",
      onEnd,
    );

    return () => {
      strip.removeEventListener(
        "pointerdown",
        onDown,
      );
      strip.removeEventListener(
        "pointermove",
        onMove,
      );
      strip.removeEventListener(
        "pointerup",
        onEnd,
      );
      strip.removeEventListener(
        "pointercancel",
        onEnd,
      );
    };
  }, [current, itemCount, select, track]);

  useLayoutEffect(() => {
    const strip = track.current;
    const markerElement = marker.current;

    if (!strip || !markerElement) return;

    let cancelled = false;

    const update = () => {
      const thumbs = [
        ...strip.querySelectorAll<HTMLButtonElement>(
          ".thumb",
        ),
      ];

      if (!thumbs.length) return;

      strip.style.paddingLeft = "0px";
      strip.style.paddingRight = "0px";

      const styles =
        getComputedStyle(strip);

      const gap =
        parseFloat(
          styles.columnGap ||
            styles.gap ||
            "0",
        ) || 0;

      const total =
        thumbs.reduce(
          (sum, thumb) =>
            sum + thumb.offsetWidth,
          0,
        ) +
        gap *
          Math.max(
            0,
            thumbs.length - 1,
          );

      const fits =
        total <= strip.clientWidth + 1;

      strip.dataset.fits =
        fits ? "1" : "0";

      let targetScroll =
        strip.scrollLeft;

      if (fits) {
        const side = Math.max(
          0,
          (strip.clientWidth - total) / 2,
        );

        strip.style.paddingLeft =
          `${side}px`;
        strip.style.paddingRight =
          `${side}px`;
        strip.scrollLeft = 0;
      } else {
        const thumb = thumbs[current];

        if (thumb) {
          const left = thumb.offsetLeft;
          const right =
            left + thumb.offsetWidth;
          const edge = 6;
          const viewLeft =
            strip.scrollLeft;
          const viewRight =
            viewLeft +
            strip.clientWidth;

          const max = Math.max(
            0,
            strip.scrollWidth -
              strip.clientWidth,
          );

          targetScroll =
            left < viewLeft + edge
              ? Math.max(
                  0,
                  left - edge,
                )
              : right >
                  viewRight - edge
                ? Math.min(
                    max,
                    right -
                      strip.clientWidth +
                      edge,
                  )
                : viewLeft;
        }
      }

      const thumb = thumbs[current];
      if (!thumb) return;

      const trackRect =
        strip.getBoundingClientRect();

      const thumbRect =
        thumb.getBoundingClientRect();

      const x =
        thumbRect.left -
        trackRect.left +
        strip.scrollLeft;

      const y = Math.max(
        0,
        thumbRect.top -
          trackRect.top +
          strip.scrollTop -
          4,
      );

      const reduced =
        prefersReducedMotion();

      void loadGsap().then((gsap) => {
        if (cancelled || !gsap) return;

        if (
          targetScroll !==
          strip.scrollLeft
        ) {
          if (reduced) {
            gsap.set(strip, {
              scrollLeft:
                targetScroll,
            });
          } else {
            gsap.to(strip, {
              scrollLeft:
                targetScroll,
              duration: 0.36,
              ease: "power2.out",
              overwrite: true,
            });
          }
        }

        const vars = {
          x,
          y,
          width: thumbRect.width,
          duration: reduced
            ? 0
            : 0.42,
          ease: "power3.inOut",
          overwrite: true,
        } as const;

        if (reduced) {
          gsap.set(
            markerElement,
            vars,
          );
        } else {
          gsap.to(
            markerElement,
            vars,
          );
        }

        const settle = (
          hoverIndex = -1,
        ) =>
          thumbs.forEach(
            (thumb, index) => {
              const activeThumb =
                index === current;

              const hovered =
                index === hoverIndex;

              gsap.to(thumb, {
                x: hovered
                  ? index < current
                    ? -4.5
                    : index > current
                      ? 4.5
                      : 0
                  : 0,
                y: hovered
                  ? -3
                  : activeThumb
                    ? -1
                    : 0,
                scale: hovered
                  ? activeThumb
                    ? 1.1
                    : 1.055
                  : activeThumb
                    ? 1.085
                    : 1,
                opacity:
                  hovered ||
                  activeThumb
                    ? 1
                    : 0.42,
                filter:
                  hovered ||
                  activeThumb
                    ? "contrast(1) saturate(1)"
                    : "contrast(.92) saturate(.88)",
                duration: hovered
                  ? 0.28
                  : activeThumb
                    ? 0.34
                    : 0.28,
                ease: "power3.out",
                overwrite: "auto",
              });
            },
          );

        settle();

        thumbs.forEach(
          (thumb, index) => {
            const enter = () =>
              settle(index);
            const leave = () =>
              settle();

            thumb.addEventListener(
              "pointerenter",
              enter,
            );
            thumb.addEventListener(
              "pointerleave",
              leave,
            );
            thumb.addEventListener(
              "focus",
              enter,
            );
            thumb.addEventListener(
              "blur",
              leave,
            );

            (
              thumb as HTMLButtonElement & {
                __zeudiMotionCleanup?: () => void;
              }
            ).__zeudiMotionCleanup =
              () => {
                thumb.removeEventListener(
                  "pointerenter",
                  enter,
                );
                thumb.removeEventListener(
                  "pointerleave",
                  leave,
                );
                thumb.removeEventListener(
                  "focus",
                  enter,
                );
                thumb.removeEventListener(
                  "blur",
                  leave,
                );
              };
          },
        );
      });
    };

    update();

    const onResize = () =>
      requestAnimationFrame(update);

    window.addEventListener(
      "resize",
      onResize,
    );

    strip
      .querySelectorAll("img")
      .forEach((image) =>
        image.addEventListener(
          "load",
          onResize,
          { once: true },
        ),
      );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "resize",
        onResize,
      );

      strip
        .querySelectorAll<HTMLButtonElement>(
          ".thumb",
        )
        .forEach((thumb) => {
          (
            thumb as HTMLButtonElement & {
              __zeudiMotionCleanup?: () => void;
            }
          ).__zeudiMotionCleanup?.();

          delete (
            thumb as HTMLButtonElement & {
              __zeudiMotionCleanup?: () => void;
            }
          ).__zeudiMotionCleanup;
        });
    };
  }, [
    current,
    itemCount,
    marker,
    track,
  ]);
}
