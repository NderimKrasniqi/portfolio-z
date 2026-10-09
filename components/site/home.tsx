"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { SocialLinks } from "./site-controls";
import { signatureSvg } from "./signature";
import { SiteLink } from "./navigation";
import { HOME_MUSIC_VIDEO_ID, useHomeMusic } from "./home-music";
import { runHomeLoaderTransition } from "./home-loader-motion";
import { runHomeIntro } from "./home-intro-motion";
import { loadGsap, prefersReducedMotion } from "./motion";

type Item = Content["media"][number];

let lastHomeIndex = 0;
let introPlayed = false;

const pad = (value: number) => String(value).padStart(2, "0");

export function cardHeight(mobile: boolean) {
  return mobile ? Math.min(window.innerHeight * 0.46, 380) : Math.min(window.innerHeight * 0.52, 470);
}

function slotStyle(offset: number, mobile: boolean) {
  const side = Math.sign(offset);
  const width = cardHeight(mobile) * 0.79;
  const base = { xPercent: -50, yPercent: -50 };
  if (offset === 0) return { ...base, x: 0, rotationY: 0, rotation: 0, scale: 1, autoAlpha: 1, zIndex: 3 };
  if (Math.abs(offset) === 1)
    return { ...base, x: side * width * (mobile ? 0.6 : 0.68), rotationY: -side * 30, rotation: side * 4, scale: 0.86, autoAlpha: 1, zIndex: 2 };
  return { ...base, x: side * width * 0.4, rotationY: -side * 32, rotation: side * 4, scale: 0.8, autoAlpha: 0, zIndex: 1 };
}

export function HomeView({ content, base, preview = false }: { content: Content; base: string; preview?: boolean }) {
  const items = useMemo(() => content.media.filter((item) => item.kind === "video"), [content.media]);
  const photoCount = content.media.length - items.length;
  const count = items.length;
  const [current, setCurrent] = useState(() => Math.min(lastHomeIndex, Math.max(0, count - 1)));
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"intro" | "cards">(() => (introPlayed ? "cards" : "intro"));
  const [menuOpen, setMenuOpen] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLImageElement | null)[]>([]);
  const lists = useRef<(HTMLDivElement | null)[]>([]);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const reveal = useRef<(HTMLElement | null)[]>([]);
  const track = useRef<HTMLDivElement>(null);
  const titles = useRef<(HTMLButtonElement | null)[]>([]);
  const lock = useRef(false);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () =>
      setClock(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date()));
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);
  const { musicOpen, musicPlaying, musicFrame, toggleMusic, handleMusicFrameLoad } = useHomeMusic();

  const go = useCallback(
    (next: number) => {
      if (!count) return;
      const index = ((next % count) + count) % count;
      lastHomeIndex = index;
      setCurrent(index);
    },
    [count],
  );
  const step = useCallback((amount: number) => go(lastHomeIndex + amount), [go]);
  const offsetOf = useCallback(
    (index: number) => {
      let offset = index - current;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;
      return offset;
    },
    [count, current],
  );

  useLayoutEffect(
    () =>
      runHomeLoaderTransition({
        preview,
        stage: stage.current,
        loader: loader.current,
        media: grid.current,
        front: null,
        onDone: () => setLoading(false),
      }),
    [preview],
  );

  useLayoutEffect(() => {
    if (loading || phase !== "intro" || !grid.current) return;
    const center = cards.current[current];
    if (!center) return;
    const node = stage.current;
    if (!node) return;
    return runHomeIntro({
      stage: node,
      paper: getComputedStyle(node).getPropertyValue("--paper").trim() || "#f6f2ee",
      sides: cards.current.filter((card, index): card is HTMLButtonElement => Boolean(card) && Math.abs(offsetOf(index)) === 1),
      grid: grid.current,
      cells: cells.current.filter((cell): cell is HTMLImageElement => Boolean(cell)),
      lists: lists.current.filter((list): list is HTMLDivElement => Boolean(list)),
      center,
      reveal: reveal.current.filter((element): element is HTMLElement => Boolean(element)),
      pool: items.map((entry) => mediaUrl(entry.mediumKey, preview)),
      finalSrc: mediaUrl(items[current].mediumKey, preview),
      onDone: () => {
        introPlayed = true;
        setPhase("cards");
      },
    });
  }, [loading, phase]);

  useLayoutEffect(() => {
    let cancelled = false;
    const mobile = window.innerWidth <= 800;
    void loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;
      const instant = prefersReducedMotion();
      cards.current.forEach((card, index) => {
        if (!card) return;
        const offset = offsetOf(index);
        const vars = slotStyle(offset, mobile);
        card.dataset.x = String(vars.x);
        card.dataset.ry = String(vars.rotationY);
        card.dataset.rz = String(vars.rotation);
        if (phase === "intro" && Math.abs(offset) <= 1) delete (vars as { autoAlpha?: number }).autoAlpha;
        if (instant) gsap.set(card, vars);
        else gsap.to(card, { ...vars, duration: 0.8, ease: "power3.out", overwrite: "auto" });
      });
      const active = titles.current[current];
      if (track.current && active) {
        const x = track.current.parentElement!.clientWidth / 2 - (active.offsetLeft + active.offsetWidth / 2);
        if (instant) gsap.set(track.current, { x });
        else gsap.to(track.current, { x, duration: 0.8, ease: "power3.out", overwrite: "auto" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [current, offsetOf, phase]);

  useEffect(() => {
    cards.current.forEach((card, index) => {
      const video = card?.querySelector("video");
      if (!video) return;
      if (index === current && phase === "cards") void video.play().catch(() => {});
      else video.pause();
    });
  }, [current, phase]);

  useEffect(() => {
    const node = stage.current;
    if (!node || phase !== "cards") return;
    const move = (amount: number) => {
      if (lock.current || menuOpen) return;
      lock.current = true;
      step(amount);
      window.setTimeout(() => (lock.current = false), 650);
    };
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (Math.abs(delta) > 12) move(Math.sign(delta));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") move(1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") move(-1);
    };
    let startX = 0;
    const onTouchStart = (event: TouchEvent) => (startX = event.touches[0].clientX);
    const onTouchEnd = (event: TouchEvent) => {
      const dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: true });
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, phase, step]);

  const item: Item | undefined = items[current];
  const half = Math.ceil(items.length / 2);
  let revealIndex = 0;
  const addReveal = (element: HTMLElement | null) => {
    reveal.current[revealIndex++] = element;
  };

  return (
    <>
      {loading && (
        <div ref={loader} className="loader reference-loader z-[var(--z-loader)]" aria-hidden="true">
          <div className="loader__veil" />
          <div className="loader__signature-wrap">
            <div className="loader__signature" dangerouslySetInnerHTML={{ __html: signatureSvg }} />
          </div>
        </div>
      )}
      <main id="stage" ref={stage} className="stage hx" data-phase={phase}>
        <header className="hx-head" ref={addReveal}>
          <p className="hx-head__place">
            NAPLES, (IT) <span aria-hidden="true">{"//"}</span> <span className="hx-head__dot" aria-hidden="true" /> {clock}
          </p>
          <SiteLink className="hx-head__link" href={`${base}/gallery`}>
            {content.nav.gallery}
            <sup>{pad(photoCount)}</sup>
          </SiteLink>
          <p className="hx-head__logo">
            <span>ZEUDI</span>
            <span>DI PALMA</span>
          </p>
          <SiteLink className="hx-head__link" href={`${base}/shop`}>
            {content.nav.shop}
          </SiteLink>
          <nav className="hx-head__nav" aria-label="Primary navigation">
            <SiteLink href={`${base}/about`}>{content.nav.about}</SiteLink>
            <SiteLink href={`${base}/contact`}>{content.nav.contact}</SiteLink>
          </nav>
        </header>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobileNavPanel" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="mobile-menu-toggle__icon" aria-hidden="true" />
        </button>
        <nav className={`mobile-nav-panel${menuOpen ? " is-open" : ""}`} id="mobileNavPanel" aria-label="Mobile navigation" aria-hidden={!menuOpen}>
          <div className="mobile-nav-panel__inner">
            <SiteLink className="mobile-nav-link" href={`${base}/gallery`}>{content.nav.gallery}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/about`}>{content.nav.about}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/shop`}>{content.nav.shop}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/contact`}>{content.nav.contact}</SiteLink>
          </div>
        </nav>

        <div ref={grid} className="hx-grid" aria-hidden="true">
          <div ref={(element) => { lists.current[0] = element; }} className="hx-list hx-list--left">
            <p className="hx-list__head"><span>PROJECT</span><span>CATEGORY</span></p>
            {items.slice(0, half).map((entry) => (
              <p key={entry.id}><span>{entry.title}</span><span>{entry.category}</span></p>
            ))}
          </div>
          <div className="hx-grid__cells">
            {Array.from({ length: 9 }, (_, index) => (
              <img
                key={index}
                ref={(element) => { cells.current[index] = element; }}
                className="hx-grid__cell"
                src={items.length ? mediaUrl(items[index % items.length].mediumKey, preview) : undefined}
                alt=""
                decoding="async"
              />
            ))}
          </div>
          <div ref={(element) => { lists.current[1] = element; }} className="hx-list hx-list--right">
            <p className="hx-list__head"><span>PROJECT</span><span>CATEGORY</span></p>
            {items.slice(half).map((entry) => (
              <p key={entry.id}><span>{entry.title}</span><span>{entry.category}</span></p>
            ))}
          </div>
        </div>

        <div className="hx-copy hx-copy--left" ref={addReveal}>
          <p><strong>{content.name.replace(/\.$/, "")}.</strong></p>
          <p>{item?.category}</p>
        </div>
        <div className="hx-copy hx-copy--right" ref={addReveal}>
          <p>SELECTED WORK.</p>
          <p><strong>{pad(current + 1)} / {pad(count)}</strong></p>
        </div>
        <div className="hx-cards">
          {items.map((entry, index) => {
            const offset = offsetOf(index);
            const near = Math.abs(offset) <= 1;
            return (
              <button
                key={entry.id}
                ref={(element) => {
                  cards.current[index] = element;
                }}
                type="button"
                className={`hx-card${offset === 0 ? " is-center" : ""}`}
                tabIndex={near ? 0 : -1}
                aria-label={offset === 0 ? entry.title : `Show ${entry.title}`}
                onClick={() => offset !== 0 && go(index)}
              >
                {offset === 0 ? (
                  <video src={mediaUrl(entry.key, preview)} poster={mediaUrl(entry.mediumKey, preview)} muted loop playsInline preload="metadata" />
                ) : near ? (
                  <video src={`${mediaUrl(entry.key, preview)}#t=${offset < 0 ? 1.2 : 3.5}`} muted playsInline preload="metadata" aria-hidden="true" />
                ) : (
                  <img src={mediaUrl(near ? entry.mediumKey : entry.thumbKey, preview)} alt={entry.alt} loading={near ? "eager" : "lazy"} decoding="async" />
                )}
              </button>
            );
          })}
        </div>

        <div className="hx-slider" ref={addReveal}>
          <div ref={track} className="hx-slider__track">
            {items.map((entry, index) => (
              <button
                key={entry.id}
                ref={(element) => { titles.current[index] = element; }}
                type="button"
                className={index === current ? "is-active" : undefined}
                onClick={() => go(index)}
                aria-current={index === current ? "true" : undefined}
              >
                {entry.title}
              </button>
            ))}
          </div>
        </div>
        <footer className="hx-footer" ref={addReveal}>
          <div className="hx-footer__left">
            <span>©{new Date().getFullYear()}</span>
            <SocialLinks content={content} className="socials hx-footer__socials" />
          </div>
          <p className="hx-footer__count">
            <button type="button" onClick={() => step(-1)} aria-label="Previous work">◂◂</button>
            <span>{pad(current + 1)}</span>
            <span aria-hidden="true">{"//"}</span>
            <span>{pad(count)}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next work">▸▸</button>
          </p>
        </footer>
      </main>
      <button id="homeMusicToggle" className={`home-music-toggle${musicPlaying ? "" : " is-muted"}`} type="button" aria-label={musicPlaying ? "Pause Nuvole Bianche" : "Play Nuvole Bianche"} aria-pressed={musicPlaying} aria-expanded={musicOpen} aria-controls="homeMusicPlayer" title="Nuvole Bianche — Ludovico Einaudi" onClick={toggleMusic}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="music-wave" d="M4 9v6h4l5 4V5L8 9H4z" />
          <path className="music-wave" d="M16 6.5a7 7 0 0 1 0 11" />
          <path className="music-wave" d="M14 9a3 3 0 0 1 0 6" />
          <path className="music-slash" d="M3.4 3.5l17.2 17" />
        </svg>
      </button>
      <div id="homeMusicPlayer" className={`home-music-player home-music-frame${musicOpen ? " is-open" : ""}`} aria-hidden={!musicOpen}>
        {musicOpen && (
          <iframe ref={musicFrame} title="Ludovico Einaudi — Nuvole Bianche" src={`https://www.youtube.com/embed/${HOME_MUSIC_VIDEO_ID}?enablejsapi=1&autoplay=1&controls=0&playsinline=1&loop=1&playlist=${HOME_MUSIC_VIDEO_ID}&rel=0&fs=0&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={handleMusicFrameLoad} />
        )}
      </div>
    </>
  );
}
