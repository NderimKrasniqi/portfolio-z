"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton } from "./site-controls";
import { galleryIntroPose, galleryPhase, galleryTiming, type GalleryPhase } from "./gallery-intro-motion";

type Item = Content["media"][number];

type Spot = { x: number; y: number; z: number; width: number };

function random(seed: number) {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

function layout(items: Item[]): Spot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return items.map((_, index) => {
    const y = 1 - ((index + 0.5) / items.length) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = index * golden;
    return {
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      width: 0.21 + random(index + 37) * 0.08,
    };
  });
}

export function GalleryView({ content, preview = false, onBack }: {
  content: Content;
  preview?: boolean;
  base: string;
  onBack: () => void;
}) {
  const items = useMemo(() => content.media.filter((item) => item.kind === "image"), [content.media]);
  const spots = useMemo(() => layout(items), [items]);
  const [phase, setPhase] = useState<GalleryPhase>("loading");
  const interactive = useRef(false);
  const [view, setView] = useState<"sphere" | "grid">("sphere");
  const viewRef = useRef<"sphere" | "grid">("sphere");
  const [focus, setFocus] = useState<number | null>(null);
  const space = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const focusRef = useRef<number | null>(null);
  const motion = useRef({ yaw: 0, pitch: -0.25, vx: 0, vy: 0, zoom: 1, maxZoom: 1.8, gridBlend: 0, dragging: false, lastX: 0, lastY: 0, moved: 0, blend: [] as number[] });

  const open = useCallback((index: number | null) => {
    if (index !== null && !interactive.current) return;
    focusRef.current = index;
    setFocus(index);
  }, []);

  useEffect(() => {
    const node = space.current;
    if (!node) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const m = motion.current;
    let started: number | null = null;
    let cancelled = false;
    let currentPhase: GalleryPhase = "loading";
    const { ringCount, endAt } = galleryTiming(items.length);
    // Wait for the circle's pictures before starting its reveal clock.
    let gateTimer = 0;
    const decoded = Array.from(node.querySelectorAll("img")).slice(0, ringCount)
      .map((img) => img.decode().catch(() => {}));
    let revealListener: (() => void) | undefined;
    const curtainReady = new Promise<void>((resolve) => {
      if (!document.querySelector(".site-transition")) { resolve(); return; }
      revealListener = resolve;
      window.addEventListener("zeudi-page-revealed", revealListener, { once: true });
    });
    void Promise.all([curtainReady, Promise.race([
      Promise.all(decoded),
      new Promise<void>((resolve) => { gateTimer = window.setTimeout(resolve, 3000); }),
    ])]).then(() => {
      if (!cancelled) started = performance.now();
      window.clearTimeout(gateTimer);
    });
    m.blend = items.map(() => 0);
    let frame = 0;
    let last = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = node.clientWidth;
      const heightPx = node.clientHeight;
      const mobile = width <= 800;
      const baseRadius = Math.min(width, heightPx) * (mobile ? 0.48 : 0.34);
      // Bound the whole photo, including its perspective-scaled edges, at any rotation.
      // Reserve the header band so zoom can never push a card beneath the layout controls.
      const maxHalfHeight = Math.max(0, ...spots.map((spot, index) => spot.width * items[index].height / items[index].width / 2)) * (3.2 / 2.2);
      const maxHalfWidth = Math.max(0, ...spots.map(spot => spot.width / 2)) * (3.2 / 2.2);
      // Let the mobile sphere fill the screen, while retaining the header clearance.
      const horizontalRoom = width / 2 + (mobile ? 16 : -16);
      const safeRadius = Math.min((heightPx / 2 - 80) / (1 + maxHalfHeight), horizontalRoom / (1 + maxHalfWidth));
      m.maxZoom = Math.max(.2, Math.min(1.8, safeRadius / baseRadius));
      m.zoom = Math.min(m.zoom, m.maxZoom);
      const radius = baseRadius * m.zoom;
      const focal = radius * 3.2;
      const focused = focusRef.current;
      const focusTop = 72;
      const focusBottom = 16;
      const focusHeight = Math.max(120, heightPx - focusTop - focusBottom);
      const focusOffsetY = (focusTop - focusBottom) / 2;
      const still = reducedMotion.matches;
      const elapsed = still || !items.length ? endAt : started === null ? -1 : (now - started) / 1000;
      const nextPhase = galleryPhase(elapsed, items.length);
      interactive.current = nextPhase === "sphere";
      if (nextPhase !== currentPhase) {
        currentPhase = nextPhase;
        setPhase(nextPhase);
      }

      if (!m.dragging && viewRef.current === "sphere" && m.gridBlend < .001 && (nextPhase === "sphere" || nextPhase === "explode")) {
        m.vx *= Math.pow(0.04, dt);
        m.vy *= Math.pow(0.04, dt);
        m.yaw += (focused === null && !still ? 0.05 : 0) * dt + m.vx * dt;
        m.pitch = Math.max(-1.3, Math.min(1.3, m.pitch + m.vy * dt));
      }
      const gridTarget = viewRef.current === "grid" ? 1 : 0;
      m.gridBlend = still ? gridTarget : m.gridBlend + (gridTarget - m.gridBlend) * (1 - Math.exp(-dt * 3.4));
      if (Math.abs(gridTarget - m.gridBlend) < .001) m.gridBlend = gridTarget;
      node.dataset.layoutProgress = m.gridBlend.toFixed(3);
      const columns = width <= 640 ? 4 : width <= 1000 ? 5 : 6;
      const rows = Math.ceil(items.length / columns);
      const cellW = Math.min(160, (width - 48) / columns);
      const cellH = Math.min(150, (heightPx - 200) / Math.max(1, rows));
      const gap = width <= 640 ? 10 : 18;
      const cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), cp = Math.cos(m.pitch), sp = Math.sin(m.pitch);

      cards.current.forEach((card, index) => {
        if (!card) return;
        const spot = spots[index];
        const item = items[index];
        const x1 = spot.x * cy + spot.z * sy;
        const z1 = -spot.x * sy + spot.z * cy;
        const y = (spot.y * cp - z1 * sp) * radius;
        const z = (spot.y * sp + z1 * cp) * radius;
        const x = x1 * radius;
        const depth = focal / (focal - z);
        const cardWidth = radius * spot.width * depth;
        const cardHeight = cardWidth * (item.height / item.width);
        const front = (z / radius + 1) / 2;

        const pose = galleryIntroPose({
          index, count: items.length, elapsed, viewportWidth: width, viewportHeight: heightPx,
          aspect: item.width / item.height,
          sphere: { x, y, width: cardWidth, height: cardHeight, opacity: 1, order: Math.round(front * 100) },
        });
        if (nextPhase === "sphere" && m.gridBlend > 0) {
          const aspect = item.width / item.height;
          const gridWidth = Math.min(cellW - gap, (cellH - gap) * aspect);
          const gridHeight = gridWidth / aspect;
          const gridX = ((index % columns) - (columns - 1) / 2) * cellW;
          const gridY = (Math.floor(index / columns) - (rows - 1) / 2) * cellH;
          const t = m.gridBlend;
          pose.x += (gridX - pose.x) * t;
          pose.y += (gridY - pose.y) * t;
          pose.width += (gridWidth - pose.width) * t;
          pose.height += (gridHeight - pose.height) * t;
          pose.opacity += (1 - pose.opacity) * t;
        }
        const target = focused === index ? 1 : 0;
        m.blend[index] += (target - m.blend[index]) * Math.min(1, dt * (still ? 60 : 4.5));
        const b = m.blend[index];
        const fullWidth = Math.min(width - (mobile ? 16 : 40), focusHeight * (item.width / item.height));
        const fullHeight = fullWidth * (item.height / item.width);
        const tx = pose.x * (1 - b);
        const ty = pose.y * (1 - b) + focusOffsetY * b;
        const w = pose.width + (fullWidth - pose.width) * b;
        const h = pose.height + (fullHeight - pose.height) * b;
        const opacity = pose.opacity + b * (1 - pose.opacity);

        card.style.width = `${w}px`;
        card.style.height = `${h}px`;
        card.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(b > 0.01 ? 1000 : pose.order);
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelled = true;
      interactive.current = false;
      window.clearTimeout(gateTimer);
      if (revealListener) window.removeEventListener("zeudi-page-revealed", revealListener);
      cancelAnimationFrame(frame);
    };
  }, [items, spots]);

  useEffect(() => {
    const node = space.current;
    if (!node) return;
    const m = motion.current;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !interactive.current || viewRef.current === "grid") return;
      m.dragging = true;
      m.lastX = event.clientX;
      m.lastY = event.clientY;
      m.moved = 0;
    };
    const move = (event: PointerEvent) => {
      if (!m.dragging || focusRef.current !== null) return;
      const dx = event.clientX - m.lastX;
      const dy = event.clientY - m.lastY;
      m.lastX = event.clientX;
      m.lastY = event.clientY;
      m.moved += Math.abs(dx) + Math.abs(dy);
      m.yaw += dx * 0.003;
      m.pitch = Math.max(-1.3, Math.min(1.3, m.pitch - dy * 0.003));
      m.vx = dx * 0.16;
      m.vy = -dy * 0.16;
    };
    const up = () => {
      m.dragging = false;
    };
    const wheel = (event: WheelEvent) => {
      if (focusRef.current !== null || !interactive.current || viewRef.current === "grid") return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? node.clientWidth : 1;
      const dx = (event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX) * unit;
      const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY * unit;
      if (Math.abs(dx) > Math.abs(dy)) {
        // Follow the horizontal gesture immediately, then coast with bounded momentum.
        m.yaw += dx * 0.004;
        m.vx = Math.max(-3, Math.min(3, m.vx + dx * 0.012));
      } else {
        m.zoom = Math.max(Math.min(0.6, m.maxZoom), Math.min(m.maxZoom, m.zoom - dy * 0.0006));
      }
    };
    node.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    node.addEventListener("wheel", wheel, { passive: false });
    return () => {
      node.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      node.removeEventListener("wheel", wheel);
    };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const current = focusRef.current;
      if (event.key === "Escape" && current !== null) open(null);
      if (current === null) return;
      if (event.key === "ArrowRight") open((current + 1) % items.length);
      if (event.key === "ArrowLeft") open((current - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [items.length, open]);


  return (
    <section data-view={view} data-intro={phase} className="gallery-panel open is-ready gx" aria-label={content.nav.gallery}>
      <header className="site-header site-header--interior gallery-minimal-header">
        <BackButton onBack={onBack} className="site-header__back gallery-back" />
      </header>
      <div ref={space} className={`gx-space${focus !== null ? " is-focus" : ""}`} id="main">
        {focus !== null && <button type="button" className="gx-veil" aria-label="Close" onClick={() => open(null)} />}
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              cards.current[index] = element;
            }}
            type="button"
            disabled={phase !== "sphere"}
            className={`gx-card${focus === index ? " is-open" : ""}`}
            aria-label={focus === index ? `Close ${item.title}` : `Open ${item.title}`}
            onClick={(event) => {
              if (event.detail !== 0 && motion.current.moved > 6) { motion.current.moved = 0; return; }
              open(focus === index ? null : index);
            }}
          >
            {item.kind === "video" && focus === index ? (
              <video src={mediaUrl(item.key, preview)} poster={mediaUrl(item.mediumKey, preview)} autoPlay muted loop playsInline />
            ) : (
              <img src={mediaUrl(focus === index ? item.key : item.thumbKey, preview)} alt={item.alt} draggable={false} decoding="async" />
            )}
          </button>
        ))}
      </div>
      <nav className="gx-view-toggle" aria-label="Gallery layout" hidden={phase !== "sphere" || focus !== null}>
        {(["sphere", "grid"] as const).map((mode) => (
          <button key={mode} type="button" aria-pressed={view === mode} onClick={() => {
            viewRef.current = mode;
            motion.current.dragging = false;
            motion.current.vx = motion.current.vy = 0;
            motion.current.moved = 0;
            setView(mode);
          }}>{mode === "sphere" ? "Sphere" : "Grid"}</button>
        ))}
      </nav>

    </section>
  );
}
