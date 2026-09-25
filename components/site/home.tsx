"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { MediaView, mediaUrl } from "./media";
import { SocialLinks } from "./site-controls";
import { signatureSvg } from "./signature";
import { SiteLink } from "./navigation";
import {
  HOME_MUSIC_VIDEO_ID,
  useHomeMusic,
} from "./home-music";
import { runHomeLoaderTransition } from "./home-loader-motion";
import { runHomeIdentityMotion } from "./home-identity-motion";
import { useHomeFilmstrip } from "./home-filmstrip";
import { runHomeHeroTransition } from "./home-hero-motion";
import { runHomeMetaMotion } from "./home-meta-motion";
import { useHomeInput } from "./home-input";

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

  useLayoutEffect(() => {
    const previous =
      lastMetaIndex.current;

    lastMetaIndex.current =
      current;

    return runHomeMetaMotion({
      counter: countNow.current,
      dot: progressDot.current,
      current,
      previous,
      itemCount: items.length,
    });
  }, [current, items.length]);

  useHomeFilmstrip({
    track,
    marker,
    current,
    itemCount: items.length,
    select,
    suppressThumbClick,
  });

  useLayoutEffect(() => {
    const flightSource =
      thumbFlightSource.current;

    thumbFlightSource.current = null;

    return runHomeHeroTransition({
      front: frontMedia.current,
      back: backMedia.current,
      flightSource,
      currentItem:
        currentItemRef.current,
      previousItem:
        previousItemRef.current,
      previousIndex:
        previousIndexRef.current,
      preview,
      measure: measureMediaGeometry,
      onGeometry: (geometry) => {
        mediaGeometryRef.current =
          geometry;
        setMediaGeometry(geometry);
      },
      onUnlock: () => {
        transitionLock.current =
          false;
      },
      onFinish: () => {
        transitionLock.current =
          false;

        setSelection((old) =>
          old.current === current
            ? {
                current: old.current,
                previous: null,
              }
            : old,
        );
      },
    });
  }, [current, measureMediaGeometry]);

  useHomeInput({
    active,
    menuOpen,
    stage,
    step,
  });

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
