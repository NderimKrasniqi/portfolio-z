"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { BackButton, SocialLinks } from "./frame";

const Sphere = dynamic(() => import("./sphere"), { ssr: false });
const pad = (value: number) => String(value).padStart(2, "0");

export function GalleryView({ content, preview = false, base, onBack }: {
  content: Content;
  preview?: boolean;
  base: string;
  onBack: () => void;
}) {
  const items = useMemo(() => content.media, [content.media]);
  const [mode, setMode] = useState<"sphere" | "grid">("sphere");
  const [focused, setFocused] = useState<number | null>(null);
  const [intro, setIntro] = useState(true);
  const [threeReady, setThreeReady] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const onSelect = useCallback((index: number) => setFocused(index), []);
  const onReady = useCallback((ready: boolean) => setThreeReady(ready), []);
  useEffect(() => {
    const update = () => setViewport({ width: innerWidth, height: innerHeight });
    update(); window.addEventListener("resize", update);
    const timer = window.setTimeout(() => setIntro(false), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1050);
    return () => { clearTimeout(timer); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && focused !== null) setFocused(null);
      else if (focused !== null && event.key === "ArrowRight") setFocused((focused + 1) % items.length);
      else if (focused !== null && event.key === "ArrowLeft") setFocused((focused - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [focused, items.length]);
  const selected = focused === null ? null : items[focused];
  const mobile = viewport.width <= 800;
  const rx = mobile ? Math.min(150, viewport.width * .335, viewport.height * .19) : Math.min(viewport.width * .19, 260);
  const ry = mobile ? rx : Math.min(viewport.height * .30, 258);

  return (
    <section className="gallery-panel open is-ready" role="dialog" aria-modal="true" aria-label="Gallery">
      <BackButton className="gallery-back" onBack={onBack} />
      <header className="gallery-head gallery-head--zeudi">
        <SocialLinks content={content} className="gallery-socials" />
        <nav className="gallery-links" aria-label="Gallery navigation">
          <button className="gallery-link gallery-link--active" type="button" onClick={onBack}>GALLERY</button>
          <Link className="gallery-link" href={`${base}/about`}>{content.nav.about}</Link>
          <Link className="gallery-link" href={`${base}/contact`}>{content.nav.contact}</Link>
        </nav>
      </header>
      <main id="main" className="gallery-space">
        <div className="gallery-view-toggle" aria-label="Gallery view">
          <button type="button" aria-pressed={mode === "sphere"} onClick={() => setMode("sphere")}>SPHERE</button>
          <span aria-hidden="true">/</span>
          <button type="button" aria-pressed={mode === "grid"} onClick={() => setMode("grid")}>GRID</button>
        </div>
        {mode === "sphere" && <Sphere items={items} draft={preview} onSelect={onSelect} onReady={onReady} />}
        <div className={`gallery-intro-assets ${mode === "grid" ? "is-grid" : "is-sphere"}${mode === "sphere" && threeReady && !intro ? " is-three" : ""}`}>
          {items.map((item, index) => {
            const angle = index / items.length * Math.PI * 2 - Math.PI / 2;
            return <button key={item.id} type="button" className="gallery-intro-card" onClick={() => onSelect(index)} aria-label={`View ${item.title}`} style={mode === "sphere" ? { transform: `translate(calc(-50% + ${Math.cos(angle) * rx}px), calc(-50% + ${Math.sin(angle) * ry}px))`, zIndex: Math.round((Math.sin(angle) + 1) * 10) } : undefined}>
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
        <div id="galleryFocus" className={`gallery-focus${selected ? " is-open" : ""}`} aria-hidden={!selected}>
          <button className="gallery-focus__veil" type="button" onClick={() => setFocused(null)} aria-label="Close image" />
          {selected && (selected.kind === "video" ? <video className="gallery-focus__video reference-focus-media" src={mediaUrl(selected.key, preview)} poster={mediaUrl(selected.thumbKey, preview)} controls playsInline preload="metadata" autoPlay /> : <img className="gallery-focus__img reference-focus-media" src={mediaUrl(selected.key, preview)} alt={selected.alt} width={selected.width} height={selected.height} onClick={() => setFocused(null)} />)}
          {selected && <div className="reference-focus-controls"><span>{pad(focused! + 1)} / {pad(items.length)} · {selected.title}</span><button type="button" onClick={() => setFocused(null)} aria-label="Close image">CLOSE ×</button></div>}
        </div>
      </main>
    </section>
  );
}
