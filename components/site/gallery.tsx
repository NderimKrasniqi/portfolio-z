"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton } from "./site-controls";
import { prefersReducedMotion } from "./motion";

type Item = Content["media"][number];

type Spot = { x: number; y: number; z: number; width: number; delay: number };

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
      width: 0.2 + random(index + 37) * 0.08,
      delay: random(index + 51) * 4,
    };
  });
}

const ease = (value: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);

export function GalleryView({ content, preview = false, onBack }: {
  content: Content;
  preview?: boolean;
  base: string;
  onBack: () => void;
}) {
  const items = useMemo(() => content.media.filter((item) => item.kind === "image"), [content.media]);
  const spots = useMemo(() => layout(items), [items]);
  const [focus, setFocus] = useState<number | null>(null);
  const space = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const focusRef = useRef<number | null>(null);
  const motion = useRef({ yaw: 0, pitch: -0.25, vx: 0, vy: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0, moved: 0, start: 0, blend: [] as number[] });

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
      const radius = Math.min(width, heightPx) * (width <= 800 ? 0.4 : 0.34) * m.zoom;
      const focal = radius * 3.2;
      const focused = focusRef.current;
      const focusHeight = Math.min(heightPx * 0.56, 560);
      const elapsed = (now - m.start) / 1000;

      if (!m.dragging) {
        m.vx *= Math.pow(0.04, dt);
        m.vy *= Math.pow(0.04, dt);
        m.yaw += (focused === null && !still ? 0.08 : 0) * dt + m.vx * dt;
        m.pitch = Math.max(-1.3, Math.min(1.3, m.pitch + m.vy * dt));
      }
      const cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), cp = Math.cos(m.pitch), sp = Math.sin(m.pitch);

      cards.current.forEach((card, index) => {
        if (!card) return;
        const spot = spots[index];
        const item = items[index];
        const grow = still ? 1 : ease((elapsed - 0.8 - spot.delay) / 1.4);
        const x1 = spot.x * cy + spot.z * sy;
        const z1 = -spot.x * sy + spot.z * cy;
        const y = (spot.y * cp - z1 * sp) * radius * grow;
        const z = (spot.y * sp + z1 * cp) * radius;
        const x = x1 * radius * grow;
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
        const opacity = (0.25 + 0.75 * front) * grow * dim + b * (1 - (0.25 + 0.75 * front) * grow * dim);

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
      m.yaw += dx * 0.005;
      m.pitch = Math.max(-1.3, Math.min(1.3, m.pitch - dy * 0.005));
      m.vx = dx * 0.3;
      m.vy = -dy * 0.3;
    };
    const up = () => {
      m.dragging = false;
    };
    const wheel = (event: WheelEvent) => {
      if (focusRef.current !== null) return;
      m.zoom = Math.max(0.6, Math.min(1.8, m.zoom - event.deltaY * 0.001));
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
