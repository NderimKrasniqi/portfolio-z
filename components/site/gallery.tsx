"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton, SocialLinks } from "./site-controls";
import { SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";
import {
  projectSpherePoint,
  sphereUnits,
} from "./gallery-geometry";
import {
  applyBaseCardSizing,
  applyGridLayout,
  captureCardSnapshot,
  runGalleryIntroTransition,
  runGridToSphereTransition,
  runSphereToGridTransition,
  type CardSnapshot,
} from "./gallery-motion";
import {
  runGalleryFocusClose,
  runGalleryFocusOpen,
  type FocusRect,
} from "./gallery-focus-motion";

const pad = (value: number) => String(value).padStart(2, "0");

type GalleryPhase =
  | "opening"
  | "sphere"
  | "to-grid"
  | "grid"
  | "to-sphere";

export function GalleryView({ content, preview = false, base, onBack }: {
  content: Content;
  preview?: boolean;
  base: string;
  onBack: () => void;
}) {
  const items = useMemo(() => content.media, [content.media]);
  const [phase, setPhase] = useState<GalleryPhase>("opening");
  const phaseRef = useRef<GalleryPhase>("opening");

  const [focused, setFocused] = useState<number | null>(null);
  const [focusClosing, setFocusClosing] = useState(false);
  const focusedRef = useRef<number | null>(null);

  const introPlayed = useRef(false);
  const sphereSnapshot = useRef<CardSnapshot[]>([]);
  const liveSphereRotation = useRef(0);
  const sphereRotationSnapshot = useRef(0);
  const sphereVelocity = useRef(0);
  const sphereLastInput = useRef(0);
  const suppressSphereTap = useRef(false);

  const panelRef = useRef<HTMLElement | null>(null);
  const assetsRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef<HTMLDivElement | null>(null);
  const spaceLabelRef = useRef<HTMLDivElement | null>(null);
  const instructionRef = useRef<HTMLDivElement | null>(null);
  const orbitIndexRef = useRef<HTMLDivElement | null>(null);

  const focusRef = useRef<HTMLDivElement | null>(null);
  const focusVeilRef = useRef<HTMLButtonElement | null>(null);
  const focusGhostRef = useRef<HTMLImageElement | null>(null);
  const focusImageRef = useRef<HTMLImageElement | null>(null);
  const focusVideoRef = useRef<HTMLVideoElement | null>(null);
  const focusSourceIndex = useRef<number | null>(null);
  const focusSourceRect = useRef<FocusRect | null>(null);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  const setGalleryPhase = useCallback((next: GalleryPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const mode: "sphere" | "grid" =
    phase === "grid" || phase === "to-grid"
      ? "grid"
      : "sphere";

  const opening = phase === "opening";

  const intro =
    phase === "opening" ||
    phase === "to-sphere";

  const onSelect = useCallback((index: number) => {
    const current = phaseRef.current;

    if (
      current === "opening" ||
      current === "to-grid" ||
      current === "to-sphere"
    ) {
      return;
    }

    const card =
      assetsRef.current?.querySelectorAll<HTMLElement>(
        ".gallery-intro-card",
      )[index] ?? null;

    const rect =
      card?.getBoundingClientRect();

    focusSourceIndex.current =
      index;

    focusSourceRect.current =
      rect
        ? {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        : null;

    sphereVelocity.current = 0;
    sphereLastInput.current =
      performance.now();

    focusedRef.current = index;
    setFocused(index);
  }, []);
  const switchMode = useCallback((next: "sphere" | "grid") => {
    const current = phaseRef.current;

    if (
      next === mode ||
      current === "opening" ||
      current === "to-grid" ||
      current === "to-sphere"
    ) {
      return;
    }

    setGalleryPhase(
      next === "grid"
        ? "to-grid"
        : "to-sphere",
    );
  }, [mode, setGalleryPhase]);
  useEffect(() => {
    if (phase !== "sphere") return;

    const assets = assetsRef.current;
    const space =
      panelRef.current?.querySelector<HTMLElement>(
        ".gallery-space",
      ) ?? null;

    if (!assets || !space) return;

    const cards = [
      ...assets.querySelectorAll<HTMLElement>(
        ".gallery-intro-card",
      ),
    ];

    if (!cards.length) return;

    const units =
      sphereUnits(cards.length);

    let cancelled = false;
    let frame = 0;
    let last =
      performance.now();

    let touchStartY: number | null = null;
    let touchLastY: number | null = null;
    let touchMoved = false;

    const clamp = (
      value: number,
      min: number,
      max: number,
    ) =>
      Math.max(
        min,
        Math.min(max, value),
      );

    const markInput = () => {
      sphereLastInput.current =
        performance.now();
    };

    const addSpinImpulse = (
      delta: number,
    ) => {
      markInput();

      const impulse = clamp(
        delta * 0.0002,
        -0.026,
        0.026,
      );

      sphereVelocity.current =
        clamp(
          sphereVelocity.current +
            impulse,
          -0.072,
          0.072,
        );
    };

    const onWheel = (
      event: WheelEvent,
    ) => {
      if (
        phaseRef.current !==
          "sphere" ||
        focusedRef.current !== null
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const horizontal =
        Math.abs(event.deltaX) >
        Math.abs(event.deltaY);

      // Exact reference direction:
      // horizontal gestures are inverted,
      // vertical gestures are not.
      const delta = horizontal
        ? -event.deltaX
        : event.deltaY;

      addSpinImpulse(delta);
    };

    const onTouchStart = (
      event: TouchEvent,
    ) => {
      if (
        phaseRef.current !==
          "sphere" ||
        focusedRef.current !== null
      ) {
        return;
      }

      const y =
        event.touches[0]?.clientY;

      touchStartY = y ?? null;
      touchLastY = y ?? null;
      touchMoved = false;
    };

    const onTouchMove = (
      event: TouchEvent,
    ) => {
      if (
        touchLastY === null ||
        phaseRef.current !==
          "sphere" ||
        focusedRef.current !== null
      ) {
        return;
      }

      const y =
        event.touches[0]?.clientY;

      if (y == null) return;

      const delta =
        touchLastY - y;

      touchLastY = y;

      if (
        touchStartY !== null &&
        Math.abs(
          y - touchStartY,
        ) > 8
      ) {
        touchMoved = true;
      }

      if (
        Math.abs(delta) > 0.25
      ) {
        addSpinImpulse(
          delta * 1.65,
        );

        event.preventDefault();
      }
    };

    const endTouch = () => {
      if (touchMoved) {
        suppressSphereTap.current =
          true;

        window.setTimeout(() => {
          suppressSphereTap.current =
            false;
        }, 220);
      }

      touchStartY = null;
      touchLastY = null;
      touchMoved = false;
    };

    space.addEventListener(
      "wheel",
      onWheel,
      {
        passive: false,
        capture: true,
      },
    );

    space.addEventListener(
      "touchstart",
      onTouchStart,
      { passive: true },
    );

    space.addEventListener(
      "touchmove",
      onTouchMove,
      { passive: false },
    );

    space.addEventListener(
      "touchend",
      endTouch,
      { passive: true },
    );

    space.addEventListener(
      "touchcancel",
      endTouch,
      { passive: true },
    );

    void loadGsap().then((gsap) => {
      if (
        cancelled ||
        !gsap
      ) {
        return;
      }

      const reduced =
        prefersReducedMotion();

      const render = (
        now: number,
      ) => {
        if (cancelled) return;

        const deltaTime =
          Math.min(
            0.05,
            Math.max(
              0,
              (now - last) / 1000,
            ),
          );

        last = now;

        if (
          phaseRef.current ===
            "sphere" &&
          focusedRef.current === null
        ) {
          if (
            Math.abs(
              sphereVelocity.current,
            ) > 0.00002
          ) {
            liveSphereRotation.current +=
              sphereVelocity.current *
              (deltaTime * 60);

            sphereVelocity.current *=
              Math.pow(
                0.875,
                deltaTime * 60,
              );

            if (
              Math.abs(
                sphereVelocity.current,
              ) < 0.00002
            ) {
              sphereVelocity.current = 0;
            }
          } else if (
            !reduced &&
            now -
              sphereLastInput.current >=
              1300
          ) {
            liveSphereRotation.current +=
              0.13 * deltaTime;
          }

          const width =
            window.innerWidth;

          const height =
            window.innerHeight;

          cards.forEach(
            (card, index) => {
              const point =
                projectSpherePoint(
                  units[index],
                  liveSphereRotation.current,
                  width,
                  height,
                );

              gsap.set(card, {
                xPercent: -50,
                yPercent: -50,
                x: point.x,
                y: point.y,
                scale: point.scale,
                rotation: 0,
                opacity:
                  point.opacity,
                zIndex:
                  point.zIndex,
                visibility:
                  "visible",
              });
            },
          );
        }

        frame =
          requestAnimationFrame(
            render,
          );
      };

      frame =
        requestAnimationFrame(
          render,
        );
    });

    return () => {
      cancelled = true;

      cancelAnimationFrame(frame);

      space.removeEventListener(
        "wheel",
        onWheel,
        true,
      );

      space.removeEventListener(
        "touchstart",
        onTouchStart,
      );

      space.removeEventListener(
        "touchmove",
        onTouchMove,
      );

      space.removeEventListener(
        "touchend",
        endTouch,
      );

      space.removeEventListener(
        "touchcancel",
        endTouch,
      );
    };
  }, [
    phase,
  ]);

  const dismissFocus = useCallback(() => {
    if (
      focused === null ||
      focusClosing
    ) {
      return;
    }

    const sourceIndex =
      focusSourceIndex.current ??
      focused;

    const sourceCard =
      assetsRef.current?.querySelectorAll<HTMLElement>(
        ".gallery-intro-card",
      )[sourceIndex] ?? null;

    const ghost =
      focusGhostRef.current;

    const veil =
      focusVeilRef.current;

    const selectedItem =
      items[focused];

    const media =
      selectedItem?.kind === "video"
        ? focusVideoRef.current
        : focusImageRef.current;

    if (
      !ghost ||
      !veil ||
      !media ||
      !selectedItem
    ) {
      if (sourceCard) {
        sourceCard.style.visibility =
          "visible";
      }

      focusedRef.current = null;
      setFocused(null);
      setFocusClosing(false);

      focusSourceIndex.current =
        null;

      focusSourceRect.current =
        null;

      return;
    }

    setFocusClosing(true);

    const ghostSrc =
      selectedItem.kind === "video"
        ? mediaUrl(
            selectedItem.thumbKey,
            preview,
          )
        : (
            media instanceof
            HTMLImageElement &&
            media.currentSrc
          ) ||
          mediaUrl(
            selectedItem.key,
            preview,
          );

    void runGalleryFocusClose({
      sourceCard,
      ghost,
      ghostSrc,
      media,
      veil,
    })
      .catch(() => {
        if (sourceCard) {
          sourceCard.style.visibility =
            "visible";
        }
      })
      .finally(() => {
        focusedRef.current = null;
        setFocused(null);
        setFocusClosing(false);

        focusSourceIndex.current =
          null;

        focusSourceRect.current =
          null;
      });
  }, [
    focusClosing,
    focused,
    items,
    preview,
  ]);

  useEffect(() => {
    const key = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key !== "Escape" ||
        focused === null
      ) {
        return;
      }

      event.preventDefault();
      dismissFocus();
    };

    window.addEventListener(
      "keydown",
      key,
    );

    return () =>
      window.removeEventListener(
        "keydown",
        key,
      );
  }, [
    dismissFocus,
    focused,
  ]);

  useLayoutEffect(() => {
    if (
      focused === null ||
      focusClosing
    ) {
      return;
    }

    const selectedItem =
      items[focused];

    const sourceIndex =
      focusSourceIndex.current ??
      focused;

    const sourceCard =
      assetsRef.current?.querySelectorAll<HTMLElement>(
        ".gallery-intro-card",
      )[sourceIndex] ?? null;

    const sourceRect =
      focusSourceRect.current ??
      (() => {
        const rect =
          sourceCard?.getBoundingClientRect();

        return rect
          ? {
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
            }
          : null;
      })();

    const ghost =
      focusGhostRef.current;

    const veil =
      focusVeilRef.current;

    const media =
      selectedItem?.kind === "video"
        ? focusVideoRef.current
        : focusImageRef.current;

    if (
      !selectedItem ||
      !sourceRect ||
      !ghost ||
      !veil ||
      !media
    ) {
      return;
    }

    const ghostSrc =
      selectedItem.kind === "video"
        ? mediaUrl(
            selectedItem.thumbKey,
            preview,
          )
        : mediaUrl(
            selectedItem.key,
            preview,
          );

    let cancelled = false;

    void runGalleryFocusOpen({
      sourceCard,
      sourceRect,
      ghost,
      ghostSrc,
      media,
      veil,
    }).catch(() => {
      if (
        cancelled ||
        !media ||
        !veil
      ) {
        return;
      }

      media.style.opacity = "1";
      veil.style.opacity = "1";
    });

    return () => {
      cancelled = true;
    };
  }, [
    focused,
    focusClosing,
    items,
    preview,
  ]);

  useLayoutEffect(() => {
    const assets = assetsRef.current;
    const panel = panelRef.current;
    const copy = copyRef.current;
    const count = countRef.current;

    if (!assets) return;

    const cards = [
      ...assets.querySelectorAll<HTMLElement>(
        ".gallery-intro-card",
      ),
    ];

    if (!cards.length) return;

    let cancelled = false;
    let timeline: { kill: () => void } | null = null;
    let removeResize: (() => void) | null = null;
    loadGsap().then(async (gsap) => {
      if (cancelled || !gsap) return;
      gsap.killTweensOf([...cards, copy, count].filter(Boolean));
      applyBaseCardSizing(
        cards,
        window.innerWidth,
      );

      const handleResize = () => {
        if (
          mode === "grid" &&
          !assets.classList.contains(
            "is-grid-transition",
          )
        ) {
          applyGridLayout(
            gsap,
            cards,
            window.innerWidth,
            window.innerHeight,
          );
        }
      };

      if (mode === "grid") {
        window.addEventListener(
          "resize",
          handleResize,
        );

        removeResize = () =>
          window.removeEventListener(
            "resize",
            handleResize,
          );

        const sphereRotation =
          liveSphereRotation.current;

        sphereRotationSnapshot.current =
          sphereRotation;

        const result =
          runSphereToGridTransition({
            gsap,
            cards,
            assets,
            copy,
            count,
            sphereRotation,
            reduced: prefersReducedMotion(),
            onComplete: () => {
              setGalleryPhase("grid");
            },
          });

        sphereSnapshot.current =
          result.snapshot;

        timeline = result.timeline;

        return;
      }

      if (introPlayed.current) {
        const snapshot =
          sphereSnapshot.current.length ===
          cards.length
            ? sphereSnapshot.current
            : captureCardSnapshot(
                gsap,
                cards,
              );

        timeline =
          runGridToSphereTransition({
            gsap,
            cards,
            assets,
            copy,
            count,
            snapshot,
            reduced: prefersReducedMotion(),
            onComplete: () => {
              sphereSnapshot.current = [];

              liveSphereRotation.current =
                sphereRotationSnapshot.current;

              sphereVelocity.current = 0;

              sphereLastInput.current =
                performance.now() -
                1301;

              setGalleryPhase(
                "sphere",
              );
            },
          });

        return;
      }

      await Promise.all(
        cards.map(async (card) => {
          const image =
            card.querySelector<HTMLImageElement>(
              "img",
            );

          if (!image) return;

          if (!image.complete) {
            await new Promise<void>(
              (resolve) => {
                const done = () =>
                  resolve();

                image.addEventListener(
                  "load",
                  done,
                  { once: true },
                );

                image.addEventListener(
                  "error",
                  done,
                  { once: true },
                );
              },
            );
          }

          try {
            await image.decode?.();
          } catch {
            // A painted image is sufficient.
          }
        }),
      );

      if (cancelled) return;

      introPlayed.current = true;

      timeline =
        runGalleryIntroTransition({
          gsap,
          cards,
          assets,
          panel,
          copy,
          count,
          spaceLabel:
            spaceLabelRef.current,
          instruction:
            instructionRef.current,
          orbitIndex:
            orbitIndexRef.current,
          reduced:
            prefersReducedMotion(),
          onComplete: ({
            handoffRotation,
            snapshot,
          }) => {
            if (cancelled) return;

            if (snapshot) {
              sphereSnapshot.current =
                snapshot;
            }

            liveSphereRotation.current =
              handoffRotation;

            sphereVelocity.current = 0;

            // Reference resumes the quiet idle motion immediately
            // after the intro has completed.
            sphereLastInput.current =
              performance.now() -
              1301;

            setGalleryPhase(
              "sphere",
            );
          },
        });
    });

    return () => { cancelled = true; timeline?.kill(); removeResize?.(); };
  }, [items.length, mode]);
  const selected = focused === null ? null : items[focused];

  // The original prototype keeps the focus media nodes mounted for the
  // lifetime of the Gallery. Seed the image layer with the first portrait
  // so the browser can decode/composite it before the first interaction.
  const focusSeed =
    items.find((item) => item.kind !== "video") ??
    null;

  const focusImageItem =
    selected && selected.kind !== "video"
      ? selected
      : focusSeed;

  return (
    <section
      ref={panelRef}
      id="galleryPanel"
      className={`gallery-panel open is-ready fixed inset-0 z-[3250] isolate visible overflow-hidden bg-white text-[#080808] opacity-100 pointer-events-auto${opening ? " is-opening" : ""}${mode === "grid" ? " is-grid-mode" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Gallery"
    >
      <BackButton className="gallery-back" onBack={onBack} />
      <header className="gallery-head gallery-head--zeudi">
        <SocialLinks content={content} className="gallery-socials" />
        <nav className="gallery-links" aria-label="Gallery navigation">
          <button className="gallery-link gallery-link--active" type="button" onClick={onBack}>GALLERY</button>
          <SiteLink className="gallery-link" href={`${base}/about`}>{content.nav.about}</SiteLink>
          <SiteLink className="gallery-link" href={`${base}/contact`}>{content.nav.contact}</SiteLink>
        </nav>
      </header>
      <main
        id="main"
        className="gallery-space absolute inset-0 h-dvh min-h-dvh overflow-hidden bg-[var(--gallery-bg)] cursor-default select-none touch-none overscroll-none"
      >
        <div
          id="galleryViewToggle"
          className={`gallery-view-toggle absolute bottom-[53px] left-1/2 z-[34] flex -translate-x-1/2 items-center gap-[6px] whitespace-nowrap text-center text-[8px] leading-none tracking-[.15em] uppercase text-[#080808] max-[800px]:bottom-[max(47px,calc(env(safe-area-inset-bottom)+41px))] max-[800px]:gap-[5px] max-[800px]:text-[6px] max-[520px]:tracking-[.14em] ${selected ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}
          aria-label="Gallery view"
        >
          <button
            className={`appearance-none border-0 bg-transparent py-2 -my-2 [color:inherit] [font:inherit] [letter-spacing:inherit] uppercase cursor-pointer transition-opacity [transition-duration:250ms] ${mode === "sphere" ? "opacity-100" : "opacity-[.58]"}`}
            type="button"
            aria-pressed={mode === "sphere"}
            onClick={() => switchMode("sphere")}
          >
            SPHERE
          </button>
          <span className="opacity-[.42]" aria-hidden="true">/</span>
          <button
            className={`appearance-none border-0 bg-transparent py-2 -my-2 [color:inherit] [font:inherit] [letter-spacing:inherit] uppercase cursor-pointer transition-opacity [transition-duration:250ms] ${mode === "grid" ? "opacity-100" : "opacity-[.58]"}`}
            type="button"
            aria-pressed={mode === "grid"}
            onClick={() => switchMode("grid")}
          >
            GRID
          </button>
        </div>
        <div
          ref={assetsRef}
          className={`gallery-intro-assets absolute inset-0 z-[12] overflow-hidden pointer-events-none [perspective:980px] [transform-style:preserve-3d] ${phase === "grid" ? "is-grid" : "is-sphere"}`}
        >
          {items.map((item, index) => {
            return (
              <button
                key={item.id}
                type="button"
                className="gallery-intro-card absolute left-1/2 top-1/2 aspect-[3/4] overflow-hidden bg-[#eee] opacity-0 origin-center [width:clamp(44px,3.95vw,58px)] [will-change:transform,opacity] [backface-visibility:hidden] [box-shadow:0_0_0_1px_rgba(0,0,0,0.026)]"
                onClick={() => {
                  if (
                    suppressSphereTap.current
                  ) {
                    return;
                  }

                  onSelect(index);
                }}
                onPointerEnter={() => {
                  if (
                    phaseRef.current !==
                    "sphere"
                  ) {
                    return;
                  }

                  if (
                    orbitIndexRef.current
                  ) {
                    orbitIndexRef.current.textContent =
                      `${pad(index + 1)} / ${pad(items.length)}`;
                  }
                }}
                aria-label={`View ${item.title}`}
              >
                <img
                  className="block h-full w-full object-cover pointer-events-none"
                  src={mediaUrl(item.thumbKey, preview)}
                  alt=""
                  loading={index < 8 ? "eager" : "lazy"}
                />
              </button>
            );
          })}
        </div>
        <ol className="gallery-semantic-list" aria-label="Gallery items">{items.map((item, index) => <li key={item.id}><button type="button" onClick={() => onSelect(index)}>{item.title}</button></li>)}</ol>
        <div ref={copyRef} className="gallery-intro-copy" aria-hidden="true"><h2 className="gallery-intro-name">ZEUDI <span className="slash">/</span> DI PALMA</h2></div>
        <div ref={countRef} className="gallery-intro-count" aria-hidden="true">{intro ? "00" : "01"} / {pad(items.length)}</div>
        <div
          ref={spaceLabelRef}
          className="gallery-space-label absolute left-[var(--side)] bottom-[19px] z-30 pointer-events-none text-[6px] tracking-[.14em] uppercase opacity-0 max-[800px]:bottom-[14px] max-[520px]:hidden"
          aria-hidden="true"
        >
          ARCHIVE — {items.length} ASSETS
        </div>
        <div
          ref={instructionRef}
          className="gallery-instruction absolute left-1/2 bottom-[32px] z-30 -translate-x-1/2 pointer-events-none whitespace-nowrap text-[6px] tracking-[.15em] uppercase opacity-0 max-[800px]:bottom-[max(32px,calc(env(safe-area-inset-bottom)+26px))]"
          aria-hidden="true"
        >
          {mode === "sphere" ? "SCROLL" : "SELECT"}
        </div>
        <div
          ref={orbitIndexRef}
          className="gallery-orbit-index absolute right-[var(--side)] bottom-[19px] z-30 pointer-events-none text-[6px] tracking-[.12em] tabular-nums opacity-0 max-[800px]:bottom-[14px]"
          aria-hidden="true"
        >
          01 / {pad(items.length)}
        </div>
        <div
          ref={focusRef}
          id="galleryFocus"
          className={`gallery-focus fixed inset-0 z-[3600] flex h-dvh w-screen items-center justify-center overflow-hidden p-0 visible ${selected ? "is-open pointer-events-auto" : "pointer-events-none"}`}
          aria-hidden={!selected}
        >
          <button
            ref={focusVeilRef}
            className="gallery-focus__veil absolute inset-0 z-[1] border-0 bg-white p-0 opacity-0 cursor-zoom-out"
            type="button"
            onClick={dismissFocus}
            aria-label="Close image"
          />

          <img
            ref={focusGhostRef}
            className="gallery-focus__ghost fixed z-[6] block bg-[#eee] object-cover opacity-0 pointer-events-none [will-change:left,top,width,height,opacity]"
            alt=""
            aria-hidden="true"
          />

          <video
            ref={focusVideoRef}
            className={`gallery-focus__video absolute z-[7] h-auto w-auto max-h-[80dvh] max-w-[min(86vw,780px)] object-contain bg-black opacity-0 [will-change:opacity] [transform:translateZ(0)] [backface-visibility:hidden] max-[800px]:max-h-[calc(100dvh-116px)] max-[800px]:max-w-[calc(100vw-32px)] ${selected?.kind === "video" ? "block" : "pointer-events-none"}`}
            src={
              selected?.kind === "video"
                ? mediaUrl(selected.key, preview)
                : undefined
            }
            poster={
              selected?.kind === "video"
                ? mediaUrl(selected.thumbKey, preview)
                : undefined
            }
            controls
            playsInline
            preload="metadata"
            autoPlay={selected?.kind === "video"}
          />

          {focusImageItem && (
            <img
              ref={focusImageRef}
              className={`gallery-focus__img relative z-[7] block h-auto w-auto max-h-[80dvh] max-w-[min(86vw,780px)] object-contain opacity-0 [will-change:opacity] [transform:translateZ(0)] [backface-visibility:hidden] max-[800px]:max-h-[calc(100dvh-116px)] max-[800px]:max-w-[calc(100vw-32px)] ${selected?.kind === "video" ? "pointer-events-none" : "cursor-zoom-out"}`}
              src={mediaUrl(focusImageItem.key, preview)}
              alt={
                selected &&
                selected.kind !== "video"
                  ? selected.alt
                  : ""
              }
              width={focusImageItem.width}
              height={focusImageItem.height}
              onClick={
                selected &&
                selected.kind !== "video"
                  ? dismissFocus
                  : undefined
              }
              aria-hidden={!selected || selected.kind === "video"}
            />
          )}
        </div>
      </main>
    </section>
  );
}
