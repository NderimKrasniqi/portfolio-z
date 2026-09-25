"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton, SocialLinks } from "./frame";
import { SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";
import {
  CARD_WIDTH_FACTORS,
  projectSpherePoint,
  sphereUnits,
} from "./gallery-geometry";

const Sphere = dynamic(() => import("./sphere"), { ssr: false });
const pad = (value: number) => String(value).padStart(2, "0");
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoother = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

type CardSnapshot = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  width: number;
};

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
  useEffect(() => {
    if (phase !== "sphere-waiting" || !threeReady) return;

    const frame = requestAnimationFrame(() => {
      setGalleryPhase("sphere");
    });

    return () => cancelAnimationFrame(frame);
  }, [phase, threeReady, setGalleryPhase]);
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
    const cards = [...document.querySelectorAll<HTMLElement>(".gallery-intro-assets .gallery-intro-card")];
    const assets = document.querySelector<HTMLElement>(".gallery-intro-assets");
    const panel = document.getElementById("galleryPanel");
    const copy = document.querySelector<HTMLElement>(".gallery-intro-copy");
    const count = document.querySelector<HTMLElement>(".gallery-intro-count");
    if (!cards.length || !assets) return;

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
      const firstOpening = !introPlayed.current && mode === "sphere";
      if (firstOpening) {
        if (panel) gsap.set(panel, { opacity: 0, visibility: "visible" });
        if (copy) gsap.set(copy, { opacity: 0 });
      }
      const mediaReady = { value: false };
      void Promise.all(cards.map((card) => {
        const image = card.querySelector<HTMLImageElement>("img");
        if (!image || image.complete) return image?.decode?.().catch(() => undefined) ?? Promise.resolve();
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          image.addEventListener("load", done, { once: true });
          image.addEventListener("error", done, { once: true });
        });
      })).then(() => { if (!cancelled) mediaReady.value = true; });
      if (cancelled) return;
      gsap.killTweensOf([...cards, copy, count].filter(Boolean));
      const baseCardWidth = Math.min(58, Math.max(44, window.innerWidth * .0395)) * (window.innerWidth <= 800 ? .90 : 1);
      cards.forEach((card, index) => {
        card.style.width = `${(baseCardWidth * CARD_WIDTH_FACTORS[index % CARD_WIDTH_FACTORS.length]).toFixed(2)}px`;
        card.style.aspectRatio = "3 / 4";
      });

      const captureSnapshot = (): CardSnapshot[] => cards.map((card) => ({
        x: Number(gsap.getProperty(card, "x")) || 0,
        y: Number(gsap.getProperty(card, "y")) || 0,
        scale: Number(gsap.getProperty(card, "scaleX")) || 1,
        rotation: Number(gsap.getProperty(card, "rotation")) || 0,
        zIndex: Number.parseInt(card.style.zIndex, 10) || 1,
        width: Math.max(1, parseFloat(card.style.width) || card.offsetWidth || 52),
      }));

      const gridMetrics = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const mobile = width <= 800;
        const cols = mobile ? (width < 470 ? 3 : 4) : (width < 1120 ? 4 : 5);
        return {
          cols,
          rows: Math.ceil(cards.length / cols),
          gapX: mobile ? Math.min(98, width * .225) : Math.min(155, width * .125),
          gapY: mobile ? Math.min(128, height * .155) : Math.min(176, height * .195),
          targetW: mobile ? Math.min(72, width * .145) : Math.min(98, width * .072),
        };
      };

      const gridTargets = () => {
        const { cols, rows, gapX, gapY, targetW } = gridMetrics();
        return cards.map((_, index) => {
          const row = Math.floor(index / cols);
          const first = row * cols;
          const countInRow = Math.min(cols, cards.length - first);
          const column = index - first;
          const baseWidth = Math.max(1, parseFloat(cards[index].style.width) || cards[index].offsetWidth || 52);
          return {
            x: (column - (countInRow - 1) / 2) * gapX,
            y: (row - (rows - 1) / 2) * gapY + (window.innerWidth <= 800 ? 4 : 10),
            scale: targetW / baseWidth,
            zIndex: 50 + index,
            targetW,
          };
        });
      };

      const applyGridLayout = () => {
        const targets = gridTargets();
        targets.forEach((target, index) => {
          const card = cards[index];
          card.style.width = `${target.targetW}px`;
          card.style.aspectRatio = "3 / 4";
          gsap.set(card, { x: target.x, y: target.y, scale: 1, rotation: 0, zIndex: target.zIndex });
        });
      };

      const handleResize = () => {
        if (mode === "grid" && !assets.classList.contains("is-grid-transition")) applyGridLayout();
      };

      if (mode === "grid") {
        window.addEventListener("resize", handleResize);
        removeResize = () => window.removeEventListener("resize", handleResize);
        const snapshot = captureSnapshot();
        sphereSnapshot.current = snapshot;
        const targets = gridTargets();
        const reduced = prefersReducedMotion();
        assets.classList.add("is-grid-transition");
        gsap.set(copy, { opacity: 0 });
        gsap.set(count, { opacity: 0 });
        gsap.set(cards, { opacity: 1, visibility: "visible", xPercent: -50, yPercent: -50 });
        if (reduced) {
          assets.classList.remove("is-grid-transition");
          applyGridLayout();
          setGalleryPhase("grid");
          return;
        }
        const gridTimeline = gsap.timeline({
          defaults: { duration: 1.16, ease: "power3.inOut", overwrite: true },
          onComplete: () => {
            assets.classList.remove("is-grid-transition");
            applyGridLayout();
            setGalleryPhase("grid");
          },
        });
        timeline = gridTimeline;
        targets.forEach((target, index) => gridTimeline.to(cards[index], { x: target.x, y: target.y, scale: target.scale, rotation: 0 }, 0));
        return;
      }

      if (introPlayed.current) {
        const snapshot = sphereSnapshot.current.length === cards.length ? sphereSnapshot.current : captureSnapshot();
        const { targetW } = gridMetrics();
        gsap.set(copy, { opacity: 0 });
        gsap.set(count, { opacity: 0 });
        assets.classList.remove("is-grid-transition");
        snapshot.forEach((target, index) => {
          const card = cards[index];
          card.style.width = `${target.width}px`;
          card.style.aspectRatio = "3 / 4";
          gsap.set(card, { xPercent: -50, yPercent: -50, scale: targetW / target.width, opacity: 1, visibility: "visible" });
        });
        if (prefersReducedMotion()) {
          snapshot.forEach((target, index) => gsap.set(cards[index], { x: target.x, y: target.y, scale: target.scale, rotation: target.rotation, zIndex: target.zIndex }));
          sphereSnapshot.current = [];
          setGalleryPhase("sphere-waiting");
          return;
        }
        const sphereTimeline = gsap.timeline({
          defaults: { duration: 1.18, ease: "power3.inOut", overwrite: true },
          onComplete: () => {
            snapshot.forEach((target, index) => {
              const card = cards[index];
              card.style.width = `${target.width}px`;
              card.style.aspectRatio = "3 / 4";
              gsap.set(card, { x: target.x, y: target.y, scale: target.scale, rotation: target.rotation, zIndex: target.zIndex });
            });
            sphereSnapshot.current = [];
            setGalleryPhase("sphere-waiting");
          },
        });
        timeline = sphereTimeline;
        snapshot.forEach((target, index) => sphereTimeline.to(cards[index], { x: target.x, y: target.y, scale: target.scale, rotation: target.rotation }, 0));
        return;
      }

      introPlayed.current = true;

      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width <= 800;
      const rx = mobile ? Math.min(150, width * .335, height * .19) : Math.min(width * .190, 260);
      const ry = mobile ? rx : Math.min(height * .300, 258);
      const units = sphereUnits(cards.length);

      const targetAt = (
        index: number,
        yRotation: number,
      ) =>
        projectSpherePoint(
          units[index],
          yRotation,
          width,
          height,
        );

      const baseAngles = cards.map((_, index) => -Math.PI * .51 + (index / cards.length) * Math.PI * 2);
      const order = [...cards.keys()].sort((a, b) => baseAngles[a] - baseAngles[b]);
      const rank = new Map(order.map((index, position) => [index, position]));
      const state = { progress: 0 };
      const flowStart = .36;
      const flowDuration = 7.35;
      const revealEnd = .385;
      const collapseStart = .405;
      const stackLock = .735;
      const burstStart = .815;
      const heroIndex = Math.min(6, cards.length - 1);
      const introRadial = [.94, 1.04, .90, 1.02, .97, 1.08, .92, 1, 1.05, .91, 1.01, .96];

      const angularVelocityAt = (value: number) => {
        const revealSpeed = .085;
        const collapseSpeed = 4.15;
        const deckSpeed = 1.15;
        const first = smoother((value - .315) / .355);
        const second = smoother((value - .690) / .145);
        const third = smoother((value - .825) / .175);
        let speed = revealSpeed + (collapseSpeed - revealSpeed) * first;
        speed += (deckSpeed - collapseSpeed) * second;
        speed += (.13 - deckSpeed) * third;
        return speed;
      };
      const angleSteps = 1200;
      const angleLut = new Float64Array(angleSteps + 1);
      for (let index = 1; index <= angleSteps; index += 1) {
        const previous = (index - 1) / angleSteps;
        const current = index / angleSteps;
        angleLut[index] = angleLut[index - 1] + ((angularVelocityAt(previous) + angularVelocityAt(current)) * .5) * (flowDuration / angleSteps);
      }
      const angleAt = (value: number) => {
        const position = clamp(value, 0, 1) * angleSteps;
        const index = Math.min(angleSteps - 1, Math.floor(position));
        const fraction = position - index;
        return angleLut[index] + (angleLut[index + 1] - angleLut[index]) * fraction;
      };

      const renderFlow = () => {
        const progress = clamp(state.progress, 0, 1);
        const sharedAngle = angleAt(progress);
        const collapse = smoother((progress - collapseStart) / (stackLock - collapseStart));
        const orbitRadius = 1 - collapse;
        const holdPhase = clamp((progress - stackLock) / (burstStart - stackLock), 0, 1);
        const holdEnvelope = collapse * (1 - smoother((progress - burstStart) / .055));
        const compression = Math.sin(holdPhase * Math.PI) * .045 * holdEnvelope;
        const sphereEase = smoother((progress - burstStart) / (1 - burstStart));
        const sphereSpread = sphereEase + Math.sin(sphereEase * Math.PI) * .075;
        cards.forEach((card, index) => {
          const cardRank = rank.get(index) ?? index;
          const revealSpan = revealEnd * .91;
          const revealStart = cards.length <= 1 ? 0 : (cardRank / (cards.length - 1)) * revealSpan;
          const appear = mediaReady.value ? smoother((progress - revealStart) / .092) : 0;
          const angle = baseAngles[index] + sharedAngle;
          const radial = introRadial[index % introRadial.length];
          const ringX = Math.cos(angle) * rx * radial * orbitRadius;
          const ringY = Math.sin(angle) * ry * radial * orbitRadius;
          const stableX = cardRank === 0 ? 0 : ((cardRank % 5) - 2) * .42;
          const stableY = cardRank === 0 ? 0 : Math.min(cardRank, 12) * .21;
          const stableTwist = cardRank === 0 ? 0 : (cardRank % 2 ? 1 : -1) * (.28 + Math.min(cardRank, 10) * .028);
          const deckAngle = sharedAngle * .34;
          const cosDeck = Math.cos(deckAngle), sinDeck = Math.sin(deckAngle);
          const deckX = (stableX * cosDeck - stableY * sinDeck) * collapse;
          const deckY = (stableX * sinDeck + stableY * cosDeck) * collapse;
          const deckDrift = cardRank === 0 ? 0 : (.20 + Math.min(cardRank, 10) * .012) * holdEnvelope;
          const driftX = Math.cos(sharedAngle + cardRank * .57) * deckDrift;
          const driftY = Math.sin(sharedAngle * .94 + cardRank * .43) * deckDrift;
          const squeeze = 1 - compression;
          const stackX = (deckX + driftX) * squeeze * (1 - sphereEase);
          const stackY = (deckY + driftY) * squeeze * (1 - sphereEase);
          const stackTwist = (stableTwist * collapse + Math.sin(sharedAngle + cardRank * .31) * .26 * holdEnvelope) * (1 - sphereEase);
          const target = targetAt(index, sharedAngle);
          const baseScale = .88 + .12 * appear;
          const deckScale = 1 + collapse * (cardRank === 0 ? .043 : .017) - compression * .34;
          const burstPulse = 1 + Math.sin(sphereEase * Math.PI) * .028;
          const scale = (baseScale * deckScale) + (target.scale * burstPulse - baseScale * deckScale) * sphereEase;
          const orbitDepth = 20 + Math.round(((Math.sin(angle) + 1) / 2) * 30);
          const zIndex = sphereEase < .075
            ? (collapse > .76 ? (index === heroIndex ? 1000 : 700 - cardRank) : orbitDepth)
            : target.zIndex;
          gsap.set(card, {
            xPercent: -50,
            yPercent: -50,
            x: ringX + stackX + target.x * sphereSpread,
            y: ringY + stackY + target.y * sphereSpread,
            scale,
            rotation: Math.cos(angle) * 1.7 * orbitRadius * (1 - sphereEase) + stackTwist,
            opacity: appear,
            zIndex,
            visibility: "visible",
          });
        });
      };

      if (prefersReducedMotion()) {
        state.progress = 1;
        mediaReady.value = true;
        renderFlow();
        setHandoffRotation(angleAt(1));
        if (panel) gsap.set(panel, { opacity: 1 });
        gsap.set(copy, { opacity: 0 });
        gsap.set(count, { opacity: 0 });
        setGalleryPhase("sphere-waiting");
        return;
      }

      gsap.set(copy, { opacity: 0, scale: .96, y: 2 });
      gsap.set(count, { opacity: 0 });
      if (panel) gsap.set(panel, { opacity: 0, visibility: "visible" });
      cards.forEach((card) => gsap.set(card, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: .14, rotation: 0, opacity: 0, visibility: "visible" }));
      const introTimeline = gsap.timeline({ defaults: { overwrite: "auto" }, onUpdate: renderFlow, onComplete: () => {
        if (cancelled) return;
        setHandoffRotation(angleAt(1));
        if (panel) gsap.set(panel, { opacity: 1 });
        gsap.set(copy, { opacity: 0 });
        gsap.set(count, { opacity: 0 });
        assets.classList.add("is-sphere");
        sphereSnapshot.current = captureSnapshot();
        setGalleryPhase("sphere-waiting");
      } });
      timeline = introTimeline;
      introTimeline.to(panel, { opacity: 1, duration: .42, ease: "power2.out" }, 0);
      introTimeline.to(copy, { opacity: 1, scale: 1, y: 0, duration: .48, ease: "power3.out" }, .14);
      introTimeline.to(state, { progress: 1, duration: flowDuration, ease: "none" }, flowStart);
      introTimeline.to(copy, { opacity: 0, scale: .987, duration: .52, ease: "sine.inOut" }, flowStart + 2.56);
    });

    return () => { cancelled = true; timeline?.kill(); removeResize?.(); };
  }, [items.length, mode, threeSettled]);
  const selected = focused === null ? null : items[focused];
  return (
    <section
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
        <div id="galleryViewToggle" className="gallery-view-toggle" aria-label="Gallery view">
          <button type="button" aria-pressed={mode === "sphere"} onClick={() => switchMode("sphere")}>SPHERE</button>
          <span aria-hidden="true">/</span>
          <button type="button" aria-pressed={mode === "grid"} onClick={() => switchMode("grid")}>GRID</button>
        </div>
        <Sphere items={items} draft={preview} onSelect={onSelect} onReady={onReady} rotationY={handoffRotation} animate={mode === "sphere" && threeLive} />
        <div className={`gallery-intro-assets ${mode === "grid" ? "is-grid" : "is-sphere"}${mode === "sphere" && threeLive ? " is-three" : ""}`}>
          {items.map((item, index) => {
            return <button key={item.id} type="button" className="gallery-intro-card" onClick={() => onSelect(index)} aria-label={`View ${item.title}`}>
              <img src={mediaUrl(item.thumbKey, preview)} alt="" loading={index < 8 ? "eager" : "lazy"} />
            </button>;
          })}
        </div>
        <ol className="gallery-semantic-list" aria-label="Gallery items">{items.map((item, index) => <li key={item.id}><button type="button" onClick={() => onSelect(index)}>{item.title}</button></li>)}</ol>
        <div className="gallery-intro-copy" aria-hidden="true"><h2 className="gallery-intro-name">ZEUDI <span className="slash">/</span> DI PALMA</h2></div>
        <div className="gallery-intro-count" aria-hidden="true">{intro ? "00" : "01"} / {pad(items.length)}</div>
        <div className="gallery-space-label" aria-hidden="true">ARCHIVE — {items.length} ASSETS</div>
        <div className="gallery-instruction" aria-hidden="true">{mode === "sphere" ? "SCROLL" : "SELECT"}</div>
        <div className="gallery-orbit-index" aria-hidden="true">01 / {pad(items.length)}</div>
        <div id="galleryFocus" className={`gallery-focus${selected ? " is-open" : ""}${focusClosing ? " is-closing" : ""}`} aria-hidden={!selected}>
          <button className="gallery-focus__veil" type="button" onClick={dismissFocus} aria-label="Close image" />
          {selected && (selected.kind === "video" ? <video className="gallery-focus__video reference-focus-media" src={mediaUrl(selected.key, preview)} poster={mediaUrl(selected.thumbKey, preview)} controls playsInline preload="metadata" autoPlay /> : <img className="gallery-focus__img reference-focus-media" src={mediaUrl(selected.key, preview)} alt={selected.alt} width={selected.width} height={selected.height} onClick={dismissFocus} />)}
          {selected && <div className="reference-focus-controls"><span>{pad(focused! + 1)} / {pad(items.length)} · {selected.title}</span><button type="button" onClick={dismissFocus} aria-label="Close image">CLOSE ×</button></div>}
        </div>
      </main>
    </section>
  );
}
