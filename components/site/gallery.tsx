"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton, SocialLinks } from "./frame";
import { SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";
import {
  applyBaseCardSizing,
  applyGridLayout,
  captureCardSnapshot,
  runGalleryIntroTransition,
  runGridToSphereTransition,
  runSphereToGridTransition,
  type CardSnapshot,
} from "./gallery-motion";

const Sphere = dynamic(() => import("./sphere"), { ssr: false });
const pad = (value: number) => String(value).padStart(2, "0");

type GalleryPhase =
  | "opening"
  | "sphere-waiting"
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
  const [threeReady, setThreeReady] = useState(false);
  const [threeSettled, setThreeSettled] = useState(false);
  const [handoffRotation, setHandoffRotation] = useState(0);

  const introPlayed = useRef(false);
  const sphereSnapshot = useRef<CardSnapshot[]>([]);
  const liveSphereRotation = useRef(0);
  const sphereRotationSnapshot = useRef(0);

  const panelRef = useRef<HTMLElement | null>(null);
  const assetsRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef<HTMLDivElement | null>(null);

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

  const threeLive = phase === "sphere";
  const onSelect = useCallback((index: number) => {
    const current = phaseRef.current;

    if (
      current === "opening" ||
      current === "to-grid" ||
      current === "to-sphere"
    ) {
      return;
    }

    setFocused(index);
  }, []);
  const onReady = useCallback((ready: boolean) => {
    setThreeReady(ready);
    setThreeSettled(true);
  }, []);

  const onSphereRotation = useCallback((rotation: number) => {
    liveSphereRotation.current = rotation;
  }, []);
  useEffect(() => {
    if (phase !== "sphere-waiting" || !threeReady) return;

    const assets = assetsRef.current;
    const sphere =
      panelRef.current?.querySelector<HTMLElement>(
        ".reference-three-sphere",
      ) ?? null;

    if (!assets || !sphere) {
      setGalleryPhase("sphere");
      return;
    }

    let cancelled = false;
    let timeline: { kill: () => void } | null = null;

    void loadGsap().then((gsap) => {
      if (cancelled) return;

      if (!gsap || prefersReducedMotion()) {
        setGalleryPhase("sphere");
        return;
      }

      gsap.killTweensOf([assets, sphere]);

      gsap.set(assets, {
        opacity: 1,
        visibility: "visible",
      });

      gsap.set(sphere, {
        opacity: 0,
        visibility: "visible",
      });

      const crossfade = gsap.timeline({
        onComplete: () => {
          if (!cancelled) {
            setGalleryPhase("sphere");
          }
        },
      });

      crossfade
        .to(
          assets,
          {
            opacity: 0,
            duration: 0.18,
            ease: "sine.inOut",
          },
          0,
        )
        .to(
          sphere,
          {
            opacity: 1,
            duration: 0.18,
            ease: "sine.inOut",
          },
          0,
        );

      timeline = crossfade;
    });

    return () => {
      cancelled = true;
      timeline?.kill();
    };
  }, [phase, threeReady, setGalleryPhase]);

  useLayoutEffect(() => {
    if (phase !== "sphere") return;

    const assets = assetsRef.current;
    const sphere =
      panelRef.current?.querySelector<HTMLElement>(
        ".reference-three-sphere",
      ) ?? null;

    assets?.style.removeProperty("opacity");
    assets?.style.removeProperty("visibility");
    sphere?.style.removeProperty("opacity");
    sphere?.style.removeProperty("visibility");
  }, [phase]);
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
  const dismissFocus = useCallback(() => {
    if (focused === null || focusClosing) return;
    setFocusClosing(true);
    const focus = document.getElementById("galleryFocus");
    const media = focus?.querySelector<HTMLElement>(".reference-focus-media");
    loadGsap().then((gsap) => {
      if (!gsap || prefersReducedMotion() || !focus || !media) {
        setFocused(null);
        setFocusClosing(false);
        return;
      }
      gsap.timeline({ onComplete: () => { setFocused(null); setFocusClosing(false); } })
        .to(media, { opacity: 0, scale: .97, duration: .22, ease: "power2.in" }, 0)
        .to(focus, { opacity: 0, duration: .28, ease: "power2.inOut" }, 0);
    });
  }, [focusClosing, focused]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focused !== null) dismissFocus();
      else if (focused !== null && event.key === "ArrowRight") setFocused((focused + 1) % items.length);
      else if (focused !== null && event.key === "ArrowLeft") setFocused((focused - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dismissFocus, focused, items.length]);

  useLayoutEffect(() => {
    if (focused === null || focusClosing) return;
    const focus = document.getElementById("galleryFocus");
    const media = focus?.querySelector<HTMLElement>(".reference-focus-media");
    if (!focus || !media) return;
    let cancelled = false;
    loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;
      if (prefersReducedMotion()) { gsap.set([focus, media], { clearProps: "all" }); return; }
      gsap.set(focus, { opacity: 0 });
      gsap.set(media, { opacity: 0, scale: .965 });
      gsap.timeline()
        .to(focus, { opacity: 1, duration: .3, ease: "power2.out" }, 0)
        .to(media, { opacity: 1, scale: 1, duration: .55, ease: "power4.out" }, .06);
    });
    return () => { cancelled = true; };
  }, [focused, focusClosing]);

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

    // The first sphere sequence should not compete with Three.js texture
    // uploads. Sphere reports once its first frame is prepared (or WebGL has
    // settled into the accessible grid fallback), so the DOM sequence gets a
    // clean, uninterrupted clock from its first visible frame.
    if (!introPlayed.current && mode === "sphere" && !threeSettled) return;

    let cancelled = false;
    let timeline: { kill: () => void } | null = null;
    let removeResize: (() => void) | null = null;
    loadGsap().then((gsap) => {
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

              setHandoffRotation(
                sphereRotationSnapshot.current,
              );

              setGalleryPhase(
                "sphere-waiting",
              );
            },
          });

        return;
      }

      introPlayed.current = true;

      timeline =
        runGalleryIntroTransition({
          gsap,
          cards,
          assets,
          panel,
          copy,
          count,
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

            setHandoffRotation(
              handoffRotation,
            );

            setGalleryPhase(
              "sphere-waiting",
            );
          },
        });
    });

    return () => { cancelled = true; timeline?.kill(); removeResize?.(); };
  }, [items.length, mode, threeSettled]);
  const selected = focused === null ? null : items[focused];
  return (
    <section
      ref={panelRef}
      id="galleryPanel"
      className={`gallery-panel open is-ready fixed inset-0 z-[3250] isolate visible overflow-hidden bg-white text-[#080808] opacity-100 pointer-events-auto${opening ? " is-opening" : ""}${mode === "sphere" && threeLive ? " is-three-live" : ""}${mode === "grid" ? " is-grid-mode" : ""}`}
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
          className="gallery-view-toggle absolute bottom-[53px] left-1/2 z-[34] flex -translate-x-1/2 items-center gap-[6px] whitespace-nowrap text-center text-[8px] leading-none tracking-[.15em] uppercase text-[#080808] opacity-100 pointer-events-auto max-[800px]:bottom-[max(47px,calc(env(safe-area-inset-bottom)+41px))] max-[800px]:gap-[5px] max-[800px]:text-[6px] max-[520px]:tracking-[.14em]"
          aria-label="Gallery view"
        >
          <button
            className={`appearance-none border-0 bg-transparent py-2 -my-2 [color:inherit] [font:inherit] [letter-spacing:inherit] uppercase cursor-pointer transition-opacity duration-[250ms] ${mode === "sphere" ? "opacity-100" : "opacity-[.58]"}`}
            type="button"
            aria-pressed={mode === "sphere"}
            onClick={() => switchMode("sphere")}
          >
            SPHERE
          </button>
          <span className="opacity-[.42]" aria-hidden="true">/</span>
          <button
            className={`appearance-none border-0 bg-transparent py-2 -my-2 [color:inherit] [font:inherit] [letter-spacing:inherit] uppercase cursor-pointer transition-opacity duration-[250ms] ${mode === "grid" ? "opacity-100" : "opacity-[.58]"}`}
            type="button"
            aria-pressed={mode === "grid"}
            onClick={() => switchMode("grid")}
          >
            GRID
          </button>
        </div>
        <Sphere
          items={items}
          draft={preview}
          onSelect={onSelect}
          onReady={onReady}
          onRotationChange={onSphereRotation}
          rotationY={handoffRotation}
          animate={mode === "sphere" && threeLive}
        />
        <div
          ref={assetsRef}
          className={`gallery-intro-assets absolute inset-0 z-[12] overflow-hidden pointer-events-none [perspective:980px] [transform-style:preserve-3d] ${phase === "grid" ? "is-grid" : "is-sphere"}${mode === "sphere" && threeLive ? " is-three" : ""}`}
        >
          {items.map((item, index) => {
            return (
              <button
                key={item.id}
                type="button"
                className="gallery-intro-card absolute left-1/2 top-1/2 aspect-[3/4] overflow-hidden bg-[#eee] opacity-0 origin-center [width:clamp(44px,3.95vw,58px)] [will-change:transform,opacity] [backface-visibility:hidden] [box-shadow:0_0_0_1px_rgba(0,0,0,0.026)]"
                onClick={() => onSelect(index)}
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
          className="gallery-space-label absolute left-[var(--side)] bottom-[19px] z-30 pointer-events-none text-[6px] tracking-[.14em] uppercase opacity-0 max-[800px]:bottom-[14px] max-[520px]:hidden"
          aria-hidden="true"
        >
          ARCHIVE — {items.length} ASSETS
        </div>
        <div
          className="gallery-instruction absolute left-1/2 bottom-[32px] z-30 -translate-x-1/2 pointer-events-none whitespace-nowrap text-[6px] tracking-[.15em] uppercase opacity-[.56] max-[800px]:bottom-[max(32px,calc(env(safe-area-inset-bottom)+26px))]"
          aria-hidden="true"
        >
          {mode === "sphere" ? "SCROLL" : "SELECT"}
        </div>
        <div
          className="gallery-orbit-index absolute right-[var(--side)] bottom-[19px] z-30 pointer-events-none text-[6px] tracking-[.12em] tabular-nums opacity-0 max-[800px]:bottom-[14px]"
          aria-hidden="true"
        >
          01 / {pad(items.length)}
        </div>
        <div id="galleryFocus" className={`gallery-focus${selected ? " is-open" : ""}${focusClosing ? " is-closing" : ""}`} aria-hidden={!selected}>
          <button className="gallery-focus__veil" type="button" onClick={dismissFocus} aria-label="Close image" />
          {selected && (selected.kind === "video" ? <video className="gallery-focus__video reference-focus-media" src={mediaUrl(selected.key, preview)} poster={mediaUrl(selected.thumbKey, preview)} controls playsInline preload="metadata" autoPlay /> : <img className="gallery-focus__img reference-focus-media" src={mediaUrl(selected.key, preview)} alt={selected.alt} width={selected.width} height={selected.height} onClick={dismissFocus} />)}
          {selected && <div className="reference-focus-controls"><span>{pad(focused! + 1)} / {pad(items.length)} · {selected.title}</span><button type="button" onClick={dismissFocus} aria-label="Close image">CLOSE ×</button></div>}
        </div>
      </main>
    </section>
  );
}
