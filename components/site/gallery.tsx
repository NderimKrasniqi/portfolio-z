"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton } from "./site-controls";
import { prefersReducedMotion } from "./motion";

type Item = Content["media"][number];

type Spot = { angle: number; radius: number; height: number; width: number; delay: number };

const TILT = (56 * Math.PI) / 180;

function random(seed: number) {
  const value = Math.sin(seed * 9301 + 49297) * 233280;
  return value - Math.floor(value);
}

function layout(items: Item[]): Spot[] {
  return items.map((_, index) => ({
    angle: (index / items.length) * Math.PI * 2 + (random(index + 1) - 0.5) * 0.7,
    radius: 0.84 + random(index + 11) * 0.36,
    height: (random(index + 23) - 0.5) * 0.4,
    width: 0.1 + random(index + 37) * 0.13,
    delay: random(index + 51) * 6,
  }));
}

const ease = (value: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);

export function GalleryView({ content, preview = false, onBack }: {
  content: Content;
  preview?: boolean;
  base: string;
  onBack: () => void;
}) {
  const items = useMemo(() => content.media, [content.media]);
  const spots = useMemo(() => layout(items), [items]);
  const [focus, setFocus] = useState<number | null>(null);
  const space = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const focusRef = useRef<number | null>(null);
  const motion = useRef({ angle: 0, velocity: 0, dragging: false, lastX: 0, moved: 0, start: 0, blend: [] as number[] });

  const open = useCallback((index: number | null) => {
    focusRef.current = index;
    setFocus(index);
  }, []);

  useEffect(() => {
    const node = space.current;
    if (!node) return;
    const still = prefersReducedMotion();
    const m = motion.current;
    m.start = performance.now();
    m.blend = items.map(() => 0);
    let frame = 0;
    let last = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const width = node.clientWidth;
      const heightPx = node.clientHeight;
      const radius = Math.min(width, heightPx) * (width <= 800 ? 0.36 : 0.235);
      const focal = radius * 3.4;
      const focused = focusRef.current;
      const focusHeight = Math.min(heightPx * 0.56, 560);
      const elapsed = (now - m.start) / 1000;

      if (!m.dragging) {
        m.velocity *= Math.pow(0.04, dt);
        m.angle += (focused === null && !still ? 0.06 : 0) * dt + m.velocity * dt;
      }

      cards.current.forEach((card, index) => {
        if (!card) return;
        const spot = spots[index];
        const item = items[index];
        const grow = still ? 1 : ease((elapsed - 0.8 - spot.delay) / 1.4);
        const angle = spot.angle + m.angle;
        const r = radius * spot.radius;
        const x = Math.cos(angle) * r;
        const z0 = Math.sin(angle) * r;
        const y0 = spot.height * radius;
        const y = y0 * Math.cos(TILT) - z0 * Math.sin(TILT);
        const z = y0 * Math.sin(TILT) + z0 * Math.cos(TILT);
        const depth = focal / (focal - z);
        const cardWidth = radius * spot.width * depth * (0.15 + 0.85 * grow);
        const cardHeight = cardWidth * (item.height / item.width);
        const front = (z / radius + 1) / 2;

        const target = focused === index ? 1 : 0;
        m.blend[index] += (target - m.blend[index]) * Math.min(1, dt * (still ? 60 : 7));
        const b = m.blend[index];
        const fullHeight = focusHeight;
        const fullWidth = fullHeight * (item.width / item.height);
        const tx = x * (1 - b);
        const ty = y * (1 - b);
        const w = cardWidth + (fullWidth - cardWidth) * b;
        const h = cardHeight + (fullHeight - cardHeight) * b;
        const dim = focused !== null && focused !== index ? 0.12 : 1;
        const opacity = (0.55 + 0.45 * front) * grow * dim + b * (1 - (0.55 + 0.45 * front) * grow * dim);

        card.style.width = `${w}px`;
        card.style.height = `${h}px`;
        card.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px)`;
        card.style.opacity = String(opacity);
        card.style.zIndex = String(b > 0.01 ? 1000 : Math.round(front * 100));
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [items, spots]);

  useEffect(() => {
    const node = space.current;
    if (!node) return;
    const m = motion.current;
    const down = (event: PointerEvent) => {
      m.dragging = true;
      m.lastX = event.clientX;
      m.moved = 0;
    };
    const move = (event: PointerEvent) => {
      if (!m.dragging || focusRef.current !== null) return;
      const dx = event.clientX - m.lastX;
      m.lastX = event.clientX;
      m.moved += Math.abs(dx);
      m.angle += dx * 0.004;
      m.velocity = dx * 0.25;
    };
    const up = () => {
      m.dragging = false;
    };
    const wheel = (event: WheelEvent) => {
      if (focusRef.current !== null) return;
      m.velocity += (Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * 0.004;
    };
    node.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    node.addEventListener("wheel", wheel, { passive: true });
    return () => {
      node.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
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

  const focused = focus === null ? null : items[focus];

  return (
    <section className="gallery-panel open is-ready gx" aria-label={content.nav.gallery}>
      <BackButton onBack={onBack} className="gallery-back" />
      <p className="gx-bar">
        <strong>Z.DP</strong>
        <span>
          {content.nav.gallery}
          <sup>{items.length}</sup>
        </span>
      </p>
      <p className="gx-mark" aria-hidden="true">Z.DP</p>
      <p className="gx-side gx-side--left">{content.name.replace(/\.$/, "")}</p>
      <p className="gx-side gx-side--right">{content.nav.gallery}</p>
      <div ref={space} className={`gx-space${focus !== null ? " is-focus" : ""}`} id="main">
        {focus !== null && <button type="button" className="gx-veil" aria-label="Close" onClick={() => open(null)} />}
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              cards.current[index] = element;
            }}
            type="button"
            className={`gx-card${focus === index ? " is-open" : ""}`}
            aria-label={focus === index ? `Close ${item.title}` : `Open ${item.title}`}
            onClick={() => {
              if (motion.current.moved > 6) return;
              open(focus === index ? null : index);
            }}
          >
            {item.kind === "video" && focus === index ? (
              <video src={mediaUrl(item.key, preview)} poster={mediaUrl(item.mediumKey, preview)} autoPlay muted loop playsInline />
            ) : (
              <img src={mediaUrl(focus === index ? item.mediumKey : item.thumbKey, preview)} alt={item.alt} draggable={false} decoding="async" />
            )}
          </button>
        ))}
      </div>
      <p className="gx-caption" aria-live="polite">
        {focused ? (
          <>
            <strong>{focused.title}</strong> <span>{focused.category}</span>
          </>
        ) : (
          <span>{String(items.length).padStart(2, "0")} WORKS — DRAG TO TURN</span>
        )}
      </p>
    </section>
  );
}
