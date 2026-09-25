"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { MediaView, mediaUrl } from "./media";
import { SocialLinks } from "./frame";
import { signatureSvg } from "./signature";
import { SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";
import {
  HOME_MUSIC_VIDEO_ID,
  useHomeMusic,
} from "./home-music";
import { runHomeLoaderTransition } from "./home-loader-motion";
import { runHomeIdentityMotion } from "./home-identity-motion";
import { useHomeFilmstrip } from "./home-filmstrip";

function displayName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first || "ZEUDI", `${rest.join(" ").replace(/\.$/, "")}.`];
}

function identityText(value: string, keyPrefix: string) {
  return [...value].map((character, index) => {
    if (!/[A-Za-zÀ-ÿ]/.test(character)) return <span key={`${keyPrefix}-space-${index}`}>{character}</span>;
    return <span key={`${keyPrefix}-${index}`} className="identity__char" data-original={character} aria-hidden="true"><span className="identity__glyph">{character}</span></span>;
  });
}

export function HomeView({ content, base, active, shopVisible, preview = false }: {
  content: Content;
  base: string;
  active: boolean;
  shopVisible: boolean;
  preview?: boolean;
}) {
  const items = useMemo(() => content.media.filter((item) => item.featured), [content.media]);
  const [selection, setSelection] = useState<{ current: number; previous: number | null }>({ current: 0, previous: null });
  const current = selection.current;
  const previous = selection.previous;
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(active);
  const [mediaGeometry, setMediaGeometry] = useState<{ width: number; height: number; top: number }>();
  const stage = useRef<HTMLElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const identityName = useRef<HTMLHeadingElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const frontMedia = useRef<HTMLDivElement>(null);
  const backMedia = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const countNow = useRef<HTMLSpanElement>(null);
  const progressDot = useRef<HTMLSpanElement>(null);
  const lastWheel = useRef(0);
  const wheelAmount = useRef(0);
  const wheelConsumed = useRef(false);
  const wheelTailSeen = useRef(false);
  const lastWheelAbs = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const activeIndex = useRef(0);
  const transitionLock = useRef(false);
  const thumbFlightSource = useRef<HTMLButtonElement | null>(null);
  const suppressThumbClick = useRef(false);
  const lastMetaIndex = useRef(0);
  const mediaGeometryRef = useRef<{ width: number; height: number; top: number } | undefined>(undefined);
  const currentItem = items[current] || items[0];
  const previousItem = previous === null ? null : items[previous];
  const currentItemRef = useRef(currentItem);
  const previousIndexRef = useRef(previous);
  const previousItemRef = useRef(previousItem);
  useLayoutEffect(() => {
    currentItemRef.current = currentItem;
    previousIndexRef.current = previous;
    previousItemRef.current = previousItem;
  }, [currentItem, previous, previousItem]);
  const [firstName, restName] = displayName(content.name);

  const {
    musicOpen,
    musicPlaying,
    musicFrame,
    toggleMusic,
    handleMusicFrameLoad,
  } = useHomeMusic(active);


  const measureMediaGeometry = useCallback((item: Content["media"][number]) => {
    const strip = track.current;
    if (!strip || typeof window === "undefined") return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw <= 800;
    const topEdge = mobile ? 82 : 58;
    const bottomEdge = Math.max(topEdge + 220, strip.getBoundingClientRect().top - (mobile ? 22 : 34));
    const availableHeight = Math.max(250, bottomEdge - topEdge);
    const ratio = Math.max(.35, Math.min(3.2, item.width / Math.max(1, item.height)));
    const maxHeight = Math.min(availableHeight, mobile ? vh * .59 : 780);
    const maxWidth = mobile ? Math.min(vw * .8, 520) : Math.min(vw * .54, 840);
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) { height = maxHeight; width = height * ratio; }
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      top: Math.round(topEdge + (bottomEdge - topEdge) / 2),
    };
  }, []);

  const select = useCallback((index: number, source: HTMLButtonElement | null = null) => {
    if (!items.length) return;
    const next = Math.max(0, Math.min(items.length - 1, index));
    if (activeIndex.current === next || transitionLock.current) return;
    const old = activeIndex.current;
    activeIndex.current = next;
    thumbFlightSource.current = source;
    transitionLock.current = true;
    setSelection({ current: next, previous: old });
  }, [items.length]);
  const step = useCallback((amount: number) => select(activeIndex.current + amount), [select]);

  useLayoutEffect(() => {
    return runHomeLoaderTransition({
      active,
      preview,
      stage: stage.current,
      loader: loader.current,
      media: media.current,
      front: frontMedia.current,
      onDone: () => setLoading(false),
    });
  }, [active, preview]);

  useLayoutEffect(() => {
    return runHomeIdentityMotion({
      active,
      preview,
      loading,
      name: identityName.current,
      stage: stage.current,
    });
  }, [active, loading, preview]);

  useLayoutEffect(() => {
    if (!items.length) return;
    const update = () => {
      const next = measureMediaGeometry(items[activeIndex.current] || items[0]);
      if (!next) return;
      // During a media handoff the old frame must keep its physical bounds. A
      // resize is recorded and applied after the incoming frame is visible.
      if (transitionLock.current) {
        mediaGeometryRef.current = next;
        return;
      }
      mediaGeometryRef.current = next;
      setMediaGeometry((old) => old && old.width === next.width && old.height === next.height && old.top === next.top ? old : next);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [active, items, measureMediaGeometry]);

  // Keep the counter and its rail on the same GSAP clock as the image handoff.
  // Updating the number synchronously while the photograph is still crossing
  // the frame makes the right side appear to jump ahead of the transition.
  useLayoutEffect(() => {
    const counter = countNow.current;
    const dot = progressDot.current;
    if (!counter || !dot) return;
    let cancelled = false;
    const previous = lastMetaIndex.current;
    lastMetaIndex.current = current;
    const last = Math.max(0, items.length - 1);
    const center = Math.min(4, last);
    const progress = last === 0
      ? 0
      : current <= center
        ? (center > 0 ? .5 * (current / center) : 0)
        : .5 + .5 * ((current - center) / Math.max(1, last - center));

    loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;
      if (prefersReducedMotion() || previous === current) {
        gsap.set(counter, { yPercent: 0 });
        counter.textContent = String(current + 1).padStart(2, "0");
        gsap.set(dot, { y: 0 });
        return;
      }
      const direction = current > previous ? 1 : -1;
      const outgoing = -115 * direction;
      const incoming = 115 * direction;
      gsap.killTweensOf([counter, dot]);
      gsap.set(counter, { yPercent: 0 });
      gsap.timeline({ defaults: { overwrite: "auto" } })
        .to(counter, { yPercent: outgoing, duration: .20, ease: "power2.in" }, 0)
        .add(() => { counter.textContent = String(current + 1).padStart(2, "0"); }, .20)
        .set(counter, { yPercent: incoming }, .20)
        .to(counter, { yPercent: 0, duration: .34, ease: "power3.out" }, .215);
      const rail = dot.parentElement;
      const railHeight = rail?.clientHeight || 1;
      const dotHeight = dot.offsetHeight || 5;
      gsap.to(dot, {
        y: progress * Math.max(0, railHeight - dotHeight),
        duration: .46,
        ease: "power3.inOut",
        overwrite: "auto",
      });
    });
    return () => { cancelled = true; };
  }, [current, items.length]);

  useHomeFilmstrip({
    track,
    marker,
    current,
    itemCount: items.length,
    select,
  });

  useLayoutEffect(() => {
    if (!media.current || !frontMedia.current) return;
    const front = frontMedia.current;
    const back = backMedia.current;
    const flightSource = thumbFlightSource.current;
    // Consume the source once. The state cleanup that removes the previous
    // layer must never replay the same thumbnail flight.
    thumbFlightSource.current = null;
    const waitForFirstPaint = async () => {
      const visual = front.querySelector<HTMLImageElement | HTMLVideoElement>("img,video");
      if (!visual) return;
      if (visual instanceof HTMLImageElement) {
        if (!visual.complete) await new Promise<void>((resolve) => {
          visual.addEventListener("load", () => resolve(), { once: true });
          visual.addEventListener("error", () => resolve(), { once: true });
        });
        try { await visual.decode?.(); } catch { /* the browser can still paint a decoded image */ }
      } else if (visual.readyState < 2) {
        await new Promise<void>((resolve) => {
          visual.addEventListener("loadeddata", () => resolve(), { once: true });
          visual.addEventListener("error", () => resolve(), { once: true });
        });
      }
    };
    const makeHeroFlight = (gsapApi: NonNullable<Awaited<ReturnType<typeof loadGsap>>>, item: Content["media"][number], source: HTMLButtonElement | null) => {
      if (!source || typeof document === "undefined") return null;
      const sourceRect = source.getBoundingClientRect();
      if (sourceRect.width < 1 || sourceRect.height < 1) return null;
      const flight = document.createElement("div");
      flight.className = `hero-flight${item.kind === "video" ? " is-video" : ""}`;
      const visual = item.kind === "video" ? document.createElement("video") : document.createElement("img");
      visual.setAttribute("aria-hidden", "true");
      visual.draggable = false;
      if (item.kind === "video") {
        const video = visual as HTMLVideoElement;
        video.src = mediaUrl(item.key, preview);
        video.poster = mediaUrl(item.thumbKey, preview);
        video.muted = true;
        video.defaultMuted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "auto";
      } else {
        const image = visual as HTMLImageElement;
        image.decoding = "async";
        image.src = mediaUrl(item.key, preview);
        image.alt = "";
      }
      flight.appendChild(visual);
      // Keep the flight inside the scoped public surface so the reference
      // positioning rules apply without leaking into the admin UI.
      (document.querySelector<HTMLElement>(".portfolio") || document.body).appendChild(flight);
      const destination = measureMediaGeometry(item);
      if (!destination) { flight.remove(); return null; }
      const destinationRect = {
        left: (window.innerWidth - destination.width) / 2,
        top: destination.top - destination.height / 2,
        width: destination.width,
        height: destination.height,
      };
      gsapApi.set(flight, {
        left: sourceRect.left,
        top: sourceRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
        opacity: 0,
      });
      const ready = (async () => {
        if (visual instanceof HTMLImageElement) {
          if (!visual.complete || visual.naturalWidth < 1) {
            await new Promise<void>((resolve) => {
              visual.addEventListener("load", () => resolve(), { once: true });
              visual.addEventListener("error", () => resolve(), { once: true });
            });
          }
          try { await visual.decode?.(); } catch { /* the browser can still paint it */ }
          return visual.naturalWidth > 0;
        }
        if (visual.readyState < 2) {
          await new Promise<void>((resolve) => {
            visual.addEventListener("loadeddata", () => resolve(), { once: true });
            visual.addEventListener("error", () => resolve(), { once: true });
            visual.load();
          });
        }
        try { await visual.play(); } catch { /* a poster is still a valid handoff */ }
        return visual.readyState >= 2 || Boolean(visual.poster);
      })();
      return { flight, destinationRect, ready };
    };
    let cancelled = false;
    loadGsap().then(async (gsap) => {
      if (cancelled || !gsap) return;
      gsap.killTweensOf([front, back].filter(Boolean));
      const finish = () => {
        transitionLock.current = false;
        setSelection((old) => old.current === current ? { current: old.current, previous: null } : old);
      };
      if (prefersReducedMotion()) {
        gsap.set(front, { opacity: 1, scale: 1 });
        if (back) gsap.set(back, { opacity: 0, scale: 1 });
        const nextGeometry = measureMediaGeometry(currentItemRef.current);
        if (nextGeometry) { mediaGeometryRef.current = nextGeometry; setMediaGeometry(nextGeometry); }
        if (previousIndexRef.current !== null) finish();
        return;
      }
      if (!back || previousItemRef.current === null) {
        gsap.fromTo(front, { opacity: .25, scale: .96 }, { opacity: 1, scale: 1, duration: .65, ease: "power3.out", onComplete: () => { transitionLock.current = false; } });
        return;
      }
      gsap.set(back, { opacity: 1, scale: 1 });
      gsap.set(front, { opacity: 0, scale: 1.025 });
      await waitForFirstPaint();
      if (cancelled) return;
      const nextGeometry = measureMediaGeometry(currentItemRef.current);
      const flight = makeHeroFlight(gsap, currentItemRef.current, flightSource);
      if (flight) {
        const ready = await flight.ready;
        if (cancelled) { flight.flight.remove(); return; }
        if (ready && nextGeometry) {
          await new Promise<void>((resolve) => {
            gsap.timeline({ onComplete: resolve, defaults: { overwrite: "auto" } })
              .to(flight.flight, { opacity: 1, duration: .12, ease: "power2.out" }, 0)
              .to(flight.flight, { ...flight.destinationRect, duration: .64, ease: "power4.inOut" }, .04)
              // Keep the previous frame underneath the travelling image until
              // the new frame is already covering the hero. Fading it at the
              // start creates a white gap when decoding takes a few frames.
              .to(back, { opacity: 0, scale: .985, duration: .20, ease: "power1.inOut" }, .44);
          });
          mediaGeometryRef.current = nextGeometry;
          setMediaGeometry(nextGeometry);
          gsap.set(front, { opacity: 1, scale: 1 });
          await new Promise<void>((resolve) => gsap.to(flight.flight, { opacity: 0, duration: .10, ease: "power1.out", onComplete: resolve }));
          flight.flight.remove();
          finish();
          return;
        }
        flight.flight.remove();
      }
      gsap.timeline({
        onComplete: finish,
      })
        .to(back, { opacity: 0, scale: .985, duration: .20, ease: "power1.inOut" }, 0)
        .add(() => {
          if (!nextGeometry) return;
          mediaGeometryRef.current = nextGeometry;
          setMediaGeometry(nextGeometry);
        }, .20)
        .to(front, { opacity: 1, scale: 1, duration: .32, ease: "power1.inOut" }, .20);
    });
    return () => {
      cancelled = true;
      loadGsap().then((gsap) => gsap?.killTweensOf([front, back].filter(Boolean)));
    };
  }, [current, measureMediaGeometry]);

  useEffect(() => {
    if (!active || menuOpen) return;
    wheelAmount.current = 0;
    wheelConsumed.current = false;
    wheelTailSeen.current = false;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || (event.target instanceof Element && event.target.closest(".filmstrip"))) return;
      event.preventDefault();
      const now = performance.now();
      const raw = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const delta = event.deltaMode === 1 ? raw * 18 : event.deltaMode === 2 ? raw * window.innerHeight : raw;
      const absolute = Math.abs(delta);
      if (absolute < 1) return;
      const gap = lastWheel.current ? now - lastWheel.current : Infinity;
      if (wheelConsumed.current) {
        const freshAfterGap = gap > 150;
        const freshAfterTail = wheelTailSeen.current && absolute >= 12 && absolute > Math.max(12, lastWheelAbs.current * 1.8);
        if (freshAfterGap || freshAfterTail) {
          wheelConsumed.current = false;
          wheelTailSeen.current = false;
          wheelAmount.current = 0;
        } else {
          if (absolute <= 5) wheelTailSeen.current = true;
          lastWheel.current = now;
          lastWheelAbs.current = absolute;
          return;
        }
      }
      if (gap > 150) wheelAmount.current = 0;
      lastWheel.current = now;
      lastWheelAbs.current = absolute;
      if (wheelAmount.current && Math.sign(wheelAmount.current) !== Math.sign(delta)) wheelAmount.current = 0;
      wheelAmount.current += delta;
      if (Math.abs(wheelAmount.current) >= 46) {
        wheelConsumed.current = true;
        wheelTailSeen.current = false;
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
      const deltaX = touchStart.current.x - event.changedTouches[0].clientX;
      const deltaY = touchStart.current.y - event.changedTouches[0].clientY;
      const delta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
      if (Math.abs(delta) > 32) step(Math.sign(delta));
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
      {loading && active && <div ref={loader} className="loader reference-loader" aria-hidden="true"><div className="loader__veil" /><div className="loader__signature-wrap"><div className="loader__signature" dangerouslySetInnerHTML={{ __html: signatureSvg }} /></div></div>}
      <main id="stage" ref={stage} className="stage" aria-hidden={!active}>
        {currentItem && <div ref={media} className="media frame-portrait" style={mediaGeometry ? { width: mediaGeometry.width, height: mediaGeometry.height, top: mediaGeometry.top } : undefined}>
          {previousItem && <div ref={backMedia} className="media-layer is-back"><MediaView media={previousItem} priority={false} draft={preview} /></div>}
          <div ref={frontMedia} className="media-layer is-front" style={previousItem ? { opacity: 0 } : undefined}><MediaView media={currentItem} priority={active} draft={preview} /></div>
        </div>}
        <div className="identity"><h1 ref={identityName} className="identity__name" aria-label={content.name}>{identityText(firstName, "first")}<br />{identityText(restName, "rest")}</h1></div>
        <nav className="desktop-main-nav" aria-label="Primary navigation">
          <SiteLink className="gallery-open" href={`${base}/gallery`}>{content.nav.gallery}</SiteLink>
          <SiteLink className="about-open" href={`${base}/about`}>{content.nav.about}</SiteLink>
          {shopVisible && <SiteLink className="shop-open" href={`${base}/shop`}>{content.nav.shop}</SiteLink>}
          <SiteLink className="contact-open" href={`${base}/contact`}>{content.nav.contact}</SiteLink>
        </nav>
        <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobileNavPanel" onClick={() => setMenuOpen(!menuOpen)}><span className="mobile-menu-toggle__icon" aria-hidden="true" /></button>
        <nav className={`mobile-nav-panel${menuOpen ? " is-open" : ""}`} id="mobileNavPanel" aria-label="Mobile navigation" aria-hidden={!menuOpen}>
          <div className="mobile-nav-panel__inner">
            <SiteLink className="mobile-nav-link" href={`${base}/gallery`}>{content.nav.gallery}</SiteLink>
            <SiteLink className="mobile-nav-link" href={`${base}/about`}>{content.nav.about}</SiteLink>
            {shopVisible && <SiteLink className="mobile-nav-link" href={`${base}/shop`}>{content.nav.shop}</SiteLink>}
            <SiteLink className="mobile-nav-link" href={`${base}/contact`}>{content.nav.contact}</SiteLink>
          </div>
        </nav>
        <div className="meta" aria-live="polite" aria-label="Gallery progress"><div className="meta__content">
          <div className="meta__count"><span ref={countNow}>{String(current + 1).padStart(2, "0")}</span><span className="meta__slash">/</span><span>{String(items.length).padStart(2, "0")}</span></div>
          <div className="meta__progress" aria-hidden="true"><span ref={progressDot} className="meta__progress-dot" style={{ top: "0%" }} /></div>
        </div></div>
        <SocialLinks content={content} className="socials" />
        <button className="browse" type="button" onClick={() => step(current === items.length - 1 ? -1 : 1)} aria-label="Browse next work">SCROLL</button>
        <div className="filmstrip"><div className="filmstrip__track" ref={track} aria-label="Selected work">
          {items.map((item, index) => <button key={item.id} className={`thumb${current === index ? " is-active" : ""}`} type="button" onClick={(event) => {
            if (suppressThumbClick.current) { suppressThumbClick.current = false; return; }
            select(index, event.currentTarget);
          }} aria-label={`View ${item.title}`} aria-current={current === index ? "true" : undefined}>
            <img src={mediaUrl(item.thumbKey, preview)} alt="" width={Math.max(1, Math.round(item.width / item.height * 50))} height={50} loading={index < 8 ? "eager" : "lazy"} />
          </button>)}
          <span className="thumb-active-marker" ref={marker} aria-hidden="true" />
        </div></div>
      </main>
      {active && <>
        <button id="homeMusicToggle" className={`home-music-toggle${musicPlaying ? "" : " is-muted"}`} type="button" aria-label={musicPlaying ? "Pause Nuvole Bianche" : "Play Nuvole Bianche"} aria-pressed={musicPlaying} aria-expanded={musicOpen} aria-controls="homeMusicPlayer" title="Nuvole Bianche — Ludovico Einaudi" onClick={toggleMusic}><svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="music-wave" d="M4 9v6h4l5 4V5L8 9H4z" />
          <path className="music-wave" d="M16 6.5a7 7 0 0 1 0 11" />
          <path className="music-wave" d="M14 9a3 3 0 0 1 0 6" />
          <path className="music-slash" d="M3.4 3.5l17.2 17" />
        </svg></button>
        <div id="homeMusicPlayer" className={`home-music-player home-music-frame${musicOpen ? " is-open" : ""}`} aria-hidden={!musicOpen}>{musicOpen && <iframe ref={musicFrame} title="Ludovico Einaudi — Nuvole Bianche" src={`https://www.youtube.com/embed/${HOME_MUSIC_VIDEO_ID}?enablejsapi=1&autoplay=1&controls=0&playsinline=1&loop=1&playlist=${HOME_MUSIC_VIDEO_ID}&rel=0&fs=0&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={handleMusicFrameLoad} />}</div>
      </>}
    </>
  );
}
