"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Content } from "@/lib/model";
import { MediaView, mediaUrl } from "./media";
import { SocialLinks } from "./frame";
import { signatureSvg } from "./signature";

function displayName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first || "ZEUDI", `${rest.join(" ").replace(/\.$/, "")}.`];
}

export function HomeView({ content, base, active, shopVisible, preview = false }: {
  content: Content;
  base: string;
  active: boolean;
  shopVisible: boolean;
  preview?: boolean;
}) {
  const items = content.media.filter((item) => item.featured);
  const [current, setCurrent] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(active);
  const [musicOpen, setMusicOpen] = useState(false);
  const [mediaGeometry, setMediaGeometry] = useState<{ width: number; height: number; top: number }>();
  const stage = useRef<HTMLElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const lastWheel = useRef(0);
  const wheelAmount = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentItem = items[current] || items[0];
  const [firstName, restName] = displayName(content.name);

  const select = useCallback((index: number) => {
    if (!items.length) return;
    setCurrent(Math.max(0, Math.min(items.length - 1, index)));
  }, [items.length]);
  const step = useCallback((amount: number) => select(current + amount), [current, select]);

  useEffect(() => {
    if (!active || preview || sessionStorage.getItem("zeudi-loader-seen")) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    const timer = window.setTimeout(() => {
      sessionStorage.setItem("zeudi-loader-seen", "1");
      setLoading(false);
    }, 1700);
    return () => clearTimeout(timer);
  }, [active, preview]);

  useLayoutEffect(() => {
    if (!currentItem || !track.current) return;
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw <= 800;
      const topEdge = mobile ? 82 : 58;
      const bottomEdge = Math.max(topEdge + 220, track.current!.getBoundingClientRect().top - (mobile ? 22 : 34));
      const availableHeight = Math.max(250, bottomEdge - topEdge);
      const ratio = currentItem.width / currentItem.height;
      const maxHeight = Math.min(availableHeight, mobile ? vh * .59 : 780);
      const maxWidth = mobile ? Math.min(vw * .8, 520) : Math.min(vw * .54, 840);
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) { height = maxHeight; width = height * ratio; }
      setMediaGeometry({ width: Math.round(width), height: Math.round(height), top: Math.round(topEdge + (bottomEdge - topEdge) / 2) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [currentItem]);

  useEffect(() => {
    if (!track.current || !marker.current) return;
    const thumb = track.current.querySelectorAll<HTMLButtonElement>(".thumb")[current];
    if (!thumb) return;
    marker.current.style.width = `${thumb.offsetWidth}px`;
    marker.current.style.transform = `translateX(${thumb.offsetLeft}px)`;
    const desired = thumb.offsetLeft - track.current.clientWidth / 2 + thumb.clientWidth / 2;
    track.current.scrollTo({ left: desired, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [current, mediaGeometry]);

  useEffect(() => {
    if (!media.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let animation: { kill: () => void } | undefined;
    let alive = true;
    import("gsap").then(({ gsap }) => {
      if (alive && media.current) animation = gsap.fromTo(media.current, { opacity: .25, scale: .96 }, { opacity: 1, scale: 1, duration: .65, ease: "power3.out" });
    });
    return () => { alive = false; animation?.kill(); };
  }, [current]);

  useEffect(() => {
    if (!active || menuOpen) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || (event.target as Element).closest(".filmstrip")) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel.current > 170) wheelAmount.current = 0;
      lastWheel.current = now;
      wheelAmount.current += event.deltaY;
      if (Math.abs(wheelAmount.current) >= 74) {
        step(Math.sign(wheelAmount.current));
        wheelAmount.current = 0;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); step(-1); }
    };
    const onStart = (event: TouchEvent) => { if (event.touches[0]) touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; };
    const onEnd = (event: TouchEvent) => {
      if (!touchStart.current || !event.changedTouches[0]) return;
      const delta = touchStart.current.y - event.changedTouches[0].clientY;
      if (Math.abs(delta) > 45) step(Math.sign(delta));
      touchStart.current = null;
    };
    const el = stage.current;
    el?.addEventListener("wheel", onWheel, { passive: false });
    el?.addEventListener("touchstart", onStart, { passive: true });
    el?.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      el?.removeEventListener("wheel", onWheel);
      el?.removeEventListener("touchstart", onStart);
      el?.removeEventListener("touchend", onEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, menuOpen, step]);

  return (
    <>
      {loading && active && <div className="loader reference-loader" aria-hidden="true"><div className="loader__signature-wrap"><div className="loader__signature" dangerouslySetInnerHTML={{ __html: signatureSvg }} /></div></div>}
      <main id="main" ref={stage} className="stage" aria-hidden={!active}>
        {currentItem && <div ref={media} className="media frame-portrait" style={mediaGeometry ? { width: mediaGeometry.width, height: mediaGeometry.height, top: mediaGeometry.top } : undefined}>
          <div className="media-layer is-front"><MediaView media={currentItem} priority={active} draft={preview} /></div>
        </div>}
        <div className="identity"><h1 className="identity__name">{firstName}<br />{restName}</h1></div>
        <nav className="desktop-main-nav" aria-label="Primary navigation">
          <Link className="gallery-open" href={`${base}/gallery`}>{content.nav.gallery}</Link>
          <Link className="about-open" href={`${base}/about`}>{content.nav.about}</Link>
          {shopVisible && <Link className="shop-open" href={`${base}/shop`}>{content.nav.shop}</Link>}
          <Link className="contact-open" href={`${base}/contact`}>{content.nav.contact}</Link>
        </nav>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobileNavPanel" onClick={() => setMenuOpen(!menuOpen)}><span className="mobile-menu-toggle__icon" aria-hidden="true" /></button>
        <nav className={`mobile-nav-panel${menuOpen ? " is-open" : ""}`} id="mobileNavPanel" aria-label="Mobile navigation" aria-hidden={!menuOpen}>
          <div className="mobile-nav-panel__inner">
            <Link className="mobile-nav-link" href={`${base}/gallery`}>{content.nav.gallery}</Link>
            <Link className="mobile-nav-link" href={`${base}/about`}>{content.nav.about}</Link>
            {shopVisible && <Link className="mobile-nav-link" href={`${base}/shop`}>{content.nav.shop}</Link>}
            <Link className="mobile-nav-link" href={`${base}/contact`}>{content.nav.contact}</Link>
          </div>
        </nav>
        <div className="meta" aria-live="polite" aria-label="Gallery progress"><div className="meta__content">
          <div className="meta__count"><span>{String(current + 1).padStart(2, "0")}</span><span className="meta__slash">/</span><span>{String(items.length).padStart(2, "0")}</span></div>
          <div className="meta__progress" aria-hidden="true"><span className="meta__progress-dot" style={{ top: `${items.length > 1 ? current / (items.length - 1) * 100 : 0}%` }} /></div>
        </div></div>
        <SocialLinks content={content} className="socials" />
        <button className="browse" type="button" onClick={() => step(1)} aria-label="Browse next work">SCROLL</button>
        <div className="filmstrip"><div className="filmstrip__track" ref={track} aria-label="Selected work">
          {items.map((item, index) => <button key={item.id} className={`thumb${current === index ? " is-active" : ""}`} type="button" onClick={() => select(index)} aria-label={`View ${item.title}`} aria-current={current === index ? "true" : undefined}>
            <img src={mediaUrl(item.thumbKey, preview)} alt="" width={Math.max(1, Math.round(item.width / item.height * 50))} height={50} loading={index < 8 ? "eager" : "lazy"} />
          </button>)}
          <span className="thumb-active-marker" ref={marker} aria-hidden="true" />
        </div></div>
      </main>
      {active && <>
        <button className={`home-music-toggle${musicOpen ? "" : " is-muted"}`} type="button" aria-label={musicOpen ? "Close music player" : "Play Nuvole Bianche"} aria-pressed={musicOpen} aria-expanded={musicOpen} aria-controls="homeMusicPlayer" title="Nuvole Bianche — Ludovico Einaudi" onClick={() => setMusicOpen(!musicOpen)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5-3.5a7 7 0 0 1 0 13m-2.2-10.5a4 4 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
        <div id="homeMusicPlayer" className={`home-music-player${musicOpen ? " is-open" : ""}`} aria-hidden={!musicOpen}>{musicOpen && <iframe title="Ludovico Einaudi — Nuvole Bianche" src="https://www.youtube.com/embed/sR2W2scFS4Y?autoplay=1&controls=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" />}</div>
      </>}
    </>
  );
}
