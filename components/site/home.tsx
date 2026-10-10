"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import { SocialLinks } from "./site-controls";
import { signatureSvg } from "./signature";
import { HomeName } from "./home-name";
import { useHomePresence, useLiveFilmPreview } from "./home-presence";
import { flyFilmToHero } from "./home-film-flight";
import { transitionHomeVideo } from "./home-video-transition";
import { homeCollaborations } from "./home-collaborations";
import { SiteLink } from "./navigation";
import { runHomeLoaderTransition } from "./home-loader-motion";
import { runHomeIntro } from "./home-intro-motion";
import { loadGsap, prefersReducedMotion } from "./motion";

type Item = Content["media"][number];

const filmPosters: Record<string, string> = {
  "365d116de0811522869da2f8": "/home/ysl.webp",
  "c18a0ea2519a70fb546c7932": "/home/pandora.webp",
  "a15ef899f04b375ed7460c37": "/home/dkny.webp",
};
const filmPoster = (item: Item, preview: boolean) => filmPosters[item.id] ?? mediaUrl(item.mediumKey, preview);

let lastHomeIndex = 0;
let introPlayed = false;

function slotStyle() {
  return { xPercent: -50, yPercent: -50, x: 0, y: 0, rotationY: 0, rotation: 0, scale: 1, autoAlpha: 1, zIndex: 3 };
}

export function HomeView({ content, base, preview = false }: { content: Content; base: string; preview?: boolean }) {
  const items = useMemo(() => content.media.filter((item) => item.kind === "video" && item.featured), [content.media]);
  const introImages = useMemo(() => {
    const photos = content.media.filter((entry) => entry.kind === "image");
    const source = photos.length ? photos : items;
    return Array.from({ length: Math.min(9, source.length) }, (_, index) =>
      source[Math.floor(index * source.length / Math.min(9, source.length))]);
  }, [content.media, items]);
  const count = items.length;
  const [current, setCurrent] = useState(() => Math.min(lastHomeIndex, Math.max(0, count - 1)));
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"intro" | "cards">(() => (introPlayed || !count ? "cards" : "intro"));
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredFilm, setHoveredFilm] = useState<number | null>(null);
  const stage = useRef<HTMLElement>(null);
  useHomePresence(stage, !loading && phase === "cards" && !menuOpen);
  useLiveFilmPreview(stage, current, !loading && phase === "cards");
  const loader = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLImageElement | null)[]>([]);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);
  const reveal = useRef<(HTMLElement | null)[]>([]);
  const lock = useRef(false);
  const filmFlight = useRef<(() => void) | null>(null);
  useEffect(() => () => filmFlight.current?.(), []);
  const positioned = useRef(false);
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    const resize = () => { filmFlight.current?.(); setViewport((value) => value + 1); };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);


  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      stage.current?.querySelector<HTMLButtonElement>(".mobile-menu-toggle")?.focus();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  const go = useCallback(
    (next: number) => {
      filmFlight.current?.();
      filmFlight.current = null;
      if (!count) return;
      const index = ((next % count) + count) % count;
      lastHomeIndex = index;
      setCurrent(index);
    },
    [count],
  );
  const step = useCallback((amount: number) => {
    if (lock.current || count < 2) return;
    const index = ((lastHomeIndex + amount) % count + count) % count;
    const hero = cards.current[1];
    if (!hero || prefersReducedMotion()) { go(index); return; }
    filmFlight.current?.();
    lock.current = true;
    filmFlight.current = transitionHomeVideo({
      hero, src: mediaUrl(items[index].key, preview), poster: filmPoster(items[index], preview),
      direction: Math.sign(amount),
      commit: () => { lastHomeIndex = index; setCurrent(index); },
      done: () => { lock.current = false; filmFlight.current = null; },
    });
  }, [count, go, items, preview]);

  useLayoutEffect(
    () =>
      runHomeLoaderTransition({
        preview,
        stage: stage.current,
        loader: loader.current,
        media: grid.current,
        front: null,
        onDone: (skipIntro) => {
          if (skipIntro) setPhase("cards");
          setLoading(false);
        },
      }),
    [preview],
  );

  useLayoutEffect(() => {
    if (loading || phase !== "intro" || !grid.current) return;
    const center = cards.current[1];
    if (!center) return;
    const node = stage.current;
    if (!node) return;
    return runHomeIntro({
      stage: node,
      paper: getComputedStyle(node).getPropertyValue("--paper").trim() || "#f6f2ee",
      sides: cards.current.filter((card, index): card is HTMLButtonElement => Boolean(card) && index !== 1),
      grid: grid.current,
      cells: cells.current.filter((cell): cell is HTMLImageElement => Boolean(cell)),
      center,
      reveal: reveal.current.filter((element): element is HTMLElement => Boolean(element)),
      pool: introImages.map((entry) => mediaUrl(entry.mediumKey, preview)),
      finalSrc: filmPoster(items[current], preview),
      onDone: () => {
        introPlayed = true;
        setPhase("cards");
      },
    });
  }, [loading, phase]);

  useLayoutEffect(() => {
    let cancelled = false;
    void loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;
      const instant = prefersReducedMotion() || !positioned.current;
      positioned.current = true;
      cards.current.forEach((card, index) => {
        if (!card) return;
        const offset = index - 1;
        const vars = slotStyle();
        card.dataset.x = String(vars.x);
        card.dataset.ry = String(vars.rotationY);
        card.dataset.rz = String(vars.rotation);
        card.dataset.y = String("y" in vars ? vars.y : 0);
        card.dataset.scale = String(vars.scale);
        if (phase === "intro" && Math.abs(offset) <= 1) delete (vars as { autoAlpha?: number }).autoAlpha;
        if (instant || phase === "intro") gsap.set(card, vars);
        else gsap.to(card, { ...vars, duration: 0.8, ease: "power3.out", overwrite: "auto" });
      });

    });
    return () => {
      cancelled = true;
    };
  }, [current, phase, viewport]);

  useEffect(() => {
    cards.current.forEach((card, index) => {
      const video = card?.querySelector("video");
      if (!video) return;
      if (index === 1 && phase === "cards") void video.play().catch(() => {});
      else video.pause();
    });
  }, [current, phase]);

  useEffect(() => {
    const node = stage.current;
    if (!node || phase !== "cards") return;
    const move = (amount: number) => {
      if (lock.current || menuOpen) return;
      step(amount);
    };
    let wheelTime = 0;
    let wheelTotal = 0;
    let wheelUsed = false;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as Element).closest(".home-filmstrip,.mobile-nav-panel")) return;
      event.preventDefault();
      const now = performance.now();
      if (now - wheelTime > 220) { wheelTotal = 0; wheelUsed = false; }
      wheelTime = now;
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      wheelTotal += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (!wheelUsed && Math.abs(wheelTotal) >= 40) {
        wheelUsed = true;
        move(Math.sign(wheelTotal));
      }
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
    node.addEventListener("wheel", onWheel, { passive: false });
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
        <div className="home-identity" ref={addReveal}>
          <HomeName enabled={!loading && phase === "cards" && !menuOpen} />
        </div>
        <header className="home-original-header" ref={addReveal}>
          <SocialLinks content={content} className="socials home-original-socials" />
          <nav className="home-original-nav" aria-label="Primary navigation">
            <SiteLink href={`${base}/gallery`}>{content.nav.gallery}</SiteLink>
            <SiteLink href={`${base}/about`}>{content.nav.about}</SiteLink>
            <SiteLink href={`${base}/shop`}>{content.nav.shop}</SiteLink>
            <SiteLink href={`${base}/contact`}>{content.nav.contact}</SiteLink>
          </nav>
        </header>
        <button className={`mobile-menu-toggle${menuOpen ? " is-open" : ""}`} type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobileNavPanel" onClick={() => setMenuOpen(!menuOpen)}>
          <span className="mobile-menu-toggle__icon" aria-hidden="true" />
        </button>
        <nav className={`mobile-nav-panel${menuOpen ? " is-open" : ""}`} id="mobileNavPanel" aria-label="Mobile navigation" aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="mobile-nav-panel__inner">
            <SiteLink className="mobile-nav-link" href={`${base}/gallery`}>{content.nav.gallery}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/about`}>{content.nav.about}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/shop`}>{content.nav.shop}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/contact`}>{content.nav.contact}</SiteLink>
          </div>
        </nav>

        <div ref={grid} className="hx-grid" aria-hidden="true">
          <div className="intro-credits intro-credits--left">
            {homeCollaborations.map(brand => (
              <div className="intro-credits__row" key={brand.name}>
                <span className="intro-credits__name">{brand.name}</span>
              </div>
            ))}
          </div>
          <div className="hx-grid__cells">
            {Array.from({ length: 9 }, (_, index) => (
              <img
                key={index}
                ref={(element) => { cells.current[index] = element; }}
                className="hx-grid__cell"
                style={{ gridArea: `${Math.floor(index / 3) + 1} / ${index % 3 + 1}` }}
                src={introImages.length ? mediaUrl(introImages[index % introImages.length].mediumKey, preview) : undefined}
                alt=""
                decoding="async"
              />
            ))}
          </div>
          <div className="intro-credits intro-credits--right">
            {[...homeCollaborations].reverse().map(brand => (
              <div className="intro-credits__row" key={brand.name}>
                <span className="intro-credits__name">{brand.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hx-cards">
          {item && (
            <button
              ref={(element) => { cards.current[1] = element; }}
              type="button"
              className="hx-card is-center"
              disabled={phase !== "cards"}
              aria-label={item.title}
            >
              <video key={item.id} src={mediaUrl(item.key, preview)} poster={filmPoster(item, preview)} muted loop playsInline preload="auto" />
            </button>
          )}
        </div>

        <nav className="home-filmstrip" aria-label="Selected films" ref={addReveal} style={{ "--film-count": count } as CSSProperties}>
          {items.map((film, index) => (
            <button key={film.id} type="button" className={current === index ? "is-active" : undefined}
              aria-label={`Play ${film.title}`} aria-current={current === index ? "true" : undefined}
              onPointerEnter={event => { if (event.pointerType === "mouse") setHoveredFilm(index); }}
              onPointerLeave={() => setHoveredFilm(null)}
              onFocus={() => setHoveredFilm(index)} onBlur={() => setHoveredFilm(null)}
              style={{
                transform: `translate(${hoveredFilm === null ? 0 : Math.abs(index - hoveredFilm) === 1 ? Math.sign(index - hoveredFilm) * 4.5 : Math.abs(index - hoveredFilm) === 2 ? Math.sign(index - hoveredFilm) * 1.8 : 0}px, ${hoveredFilm === index ? -3 : current === index ? -1 : 0}px) scale(${hoveredFilm === index ? 1.055 : 1})`,
                opacity: current === index || hoveredFilm === index ? 1 : .72,
                filter: current === index || hoveredFilm === index ? "none" : "contrast(.98) saturate(.96)",
              }}
              onClick={event => {
                filmFlight.current?.();
                filmFlight.current = null;
                if (index === current) return;
                const thumbnail = event.currentTarget.querySelector("img");
                const hero = cards.current[1];
                if (!thumbnail || !hero || prefersReducedMotion()) { go(index); return; }
                filmFlight.current = flyFilmToHero({
                  thumbnail, hero, src: mediaUrl(film.key, preview), poster: filmPoster(film, preview),
                  commit: () => { lastHomeIndex = index; setCurrent(index); },
                });
              }}>
              <img src={filmPoster(film, preview)} width={film.width} height={film.height} alt="" />
              <canvas className="home-film-live" aria-hidden="true" />
            </button>
          ))}
        </nav>

        <button className="home-scroll" type="button" onClick={() => step(1)} ref={addReveal} aria-label="Browse next work"><span>Scroll</span><svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 1v13M2 10l4 4 4-4" /></svg></button>
      </main>

    </>
  );
}
