"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/lib/model";
import { MediaView, mediaUrl } from "./media";
import { SocialLinks } from "./frame";
import { signatureSvg } from "./signature";
import { SiteLink } from "./navigation";
import { loadGsap, prefersReducedMotion } from "./motion";

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

type YouTubePlayerEvent = { data: number };
type YouTubePlayer = {
  destroy?: () => void;
  mute?: () => void;
  pauseVideo?: () => void;
  playVideo?: () => void;
  setVolume?: (volume: number) => void;
  unMute?: () => void;
};
type YouTubeApi = {
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; CUED: number };
  Player: new (element: HTMLIFrameElement, options: {
    playerVars?: Record<string, number | string>;
    events: {
      onReady?: () => void;
      onStateChange?: (event: YouTubePlayerEvent) => void;
      onError?: () => void;
      onAutoplayBlocked?: () => void;
    };
  }) => YouTubePlayer;
};
type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};

let youTubeApiPromise: Promise<void> | null = null;
const MUSIC_VIDEO_ID = "qBrgKLPYoNM";

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube is browser-only"));
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve();
  if (youTubeApiPromise) return youTubeApiPromise;
  youTubeApiPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeout = 0;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    const previous = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      try { previous?.(); } catch { /* another consumer owns its callback */ }
      finish();
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-zeudi-youtube-api]");
    const script = existing || document.createElement("script");
    if (!existing) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.zeudiYoutubeApi = "1";
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => finish(new Error("YouTube API failed to load")), { once: true });
    timeout = window.setTimeout(() => finish(new Error("YouTube API timed out")), 8000);
  });
  return youTubeApiPromise;
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
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [mediaGeometry, setMediaGeometry] = useState<{ width: number; height: number; top: number }>();
  const stage = useRef<HTMLElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const identityName = useRef<HTMLHeadingElement>(null);
  const media = useRef<HTMLDivElement>(null);
  const frontMedia = useRef<HTMLDivElement>(null);
  const backMedia = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const musicFrame = useRef<HTMLIFrameElement>(null);
  const musicPlayer = useRef<YouTubePlayer | null>(null);
  const musicPlayingRef = useRef(false);
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

  useEffect(() => {
    musicPlayingRef.current = musicPlaying;
  }, [musicPlaying]);

  const sendMusicCommand = useCallback((func: "playVideo" | "pauseVideo" | "unMute") => {
    const frame = musicFrame.current;
    if (!frame?.contentWindow) return;
    frame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args: [] }), "https://www.youtube.com");
  }, []);
  const toggleMusic = useCallback(() => {
    if (!musicOpen) {
      setMusicOpen(true);
      setMusicPlaying(true);
      return;
    }
    const next = !musicPlaying;
    setMusicPlaying(next);
    if (!next) setMusicOpen(false);
    if (next) {
      musicPlayer.current?.setVolume?.(64);
      musicPlayer.current?.unMute?.();
      musicPlayer.current?.playVideo?.();
      sendMusicCommand("unMute");
    }
    sendMusicCommand(next ? "playVideo" : "pauseVideo");
  }, [musicOpen, musicPlaying, sendMusicCommand]);
  const handleMusicFrameLoad = useCallback(() => {
    sendMusicCommand(musicPlaying ? "playVideo" : "pauseVideo");
  }, [musicPlaying, sendMusicCommand]);

  useEffect(() => {
    if (!musicOpen) {
      musicPlayer.current?.pauseVideo?.();
      musicPlayer.current?.destroy?.();
      musicPlayer.current = null;
      return;
    }

    let cancelled = false;
    const frame = musicFrame.current;
    if (!frame) return;

    loadYouTubeApi().then(() => {
      const youtubeWindow = window as YouTubeWindow;
      if (cancelled || !frame || !youtubeWindow.YT?.Player) return;
      const states = youtubeWindow.YT.PlayerState;
      try {
        const player = new youtubeWindow.YT.Player(frame, {
          playerVars: {
            autoplay: 1,
            controls: 0,
            fs: 0,
            loop: 1,
            origin: window.location.origin,
            playlist: MUSIC_VIDEO_ID,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              player.setVolume?.(64);
              player.unMute?.();
              if (musicPlayingRef.current) player.playVideo?.();
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === states.PLAYING) {
                setMusicPlaying(true);
                return;
              }
              if (event.data === states.ENDED) {
                if (musicPlayingRef.current) player.playVideo?.();
                return;
              }
              if (event.data === states.PAUSED || event.data === states.CUED) setMusicPlaying(false);
            },
            onAutoplayBlocked: () => {
              if (cancelled) return;
              setMusicPlaying(false);
              // Keep the provider mounted off-canvas so the next speaker click
              // can retry playback with a fresh user gesture.
            },
            onError: () => {
              if (cancelled) return;
              setMusicPlaying(false);
              setMusicOpen(false);
            },
          },
        });
        musicPlayer.current = player;
      } catch {
        // The iframe can still use its autoplay URL if the API cannot attach.
      }
    }).catch(() => {
      // Keep the hidden iframe available as a fallback when the API script is blocked.
    });

    return () => {
      cancelled = true;
      musicPlayer.current?.destroy?.();
      musicPlayer.current = null;
    };
  }, [musicOpen]);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => {
        setMusicOpen(false);
        setMusicPlaying(false);
      });
    }
  }, [active]);

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
    const stageElement = stage.current;
    const loaderElement = loader.current;
    if (!active || preview || !loaderElement || !stageElement || sessionStorage.getItem("zeudi-loader-seen") || prefersReducedMotion()) {
      if (active && stageElement) {
        stageElement.style.visibility = "visible";
        stageElement.style.opacity = "1";
      }
      queueMicrotask(() => setLoading(false));
      return;
    }

    let cancelled = false;
    const front = frontMedia.current;
    const mediaElement = media.current;
    const pathElements = [...loaderElement.querySelectorAll<SVGPathElement>("path")];
    const visual = front?.querySelector<HTMLImageElement | HTMLVideoElement>("img,video");
    const mediaReady = (async () => {
      if (!visual) return;
      if (visual instanceof HTMLImageElement) {
        if (!visual.complete) await new Promise<void>((resolve) => {
          visual.addEventListener("load", () => resolve(), { once: true });
          visual.addEventListener("error", () => resolve(), { once: true });
        });
        try { await visual.decode?.(); } catch { /* an already painted image is still usable */ }
      } else if (visual.readyState < 2) {
        await new Promise<void>((resolve) => {
          visual.addEventListener("loadeddata", () => resolve(), { once: true });
          visual.addEventListener("error", () => resolve(), { once: true });
        });
      }
    })();

    const finishWithoutGsap = async () => {
      await mediaReady;
      if (cancelled) return;
      stageElement.style.visibility = "visible";
      stageElement.style.opacity = "1";
      if (media.current) media.current.style.visibility = "visible";
      sessionStorage.setItem("zeudi-loader-seen", "1");
      setLoading(false);
    };

    loadGsap().then(async (gsap) => {
      if (cancelled) return;
      if (!gsap) {
        await finishWithoutGsap();
        return;
      }

      const introUi = [...stageElement.querySelectorAll<HTMLElement>(
        ".identity,.desktop-main-nav,.mobile-menu-toggle,.meta,.socials,.browse,.filmstrip",
      )];
      gsap.killTweensOf([stageElement, loaderElement, mediaElement, ...introUi, ...pathElements].filter(Boolean));
      gsap.set(stageElement, { visibility: "visible", opacity: 1 });
      gsap.set(introUi, { opacity: 0 });
      gsap.set(mediaElement, { visibility: "hidden", opacity: 0 });
      pathElements.forEach((path) => {
        const length = path.getTotalLength();
        gsap.set(path, {
          opacity: 0,
          strokeDasharray: `${length} ${length + 24}`,
          strokeDashoffset: length + 12,
          strokeLinecap: "round",
        });
      });

      const write = gsap.timeline({ delay: .26 });
      write.set(loaderElement.querySelector(".loader__signature-wrap"), { autoAlpha: 1 }, 0);
      pathElements.forEach((path) => {
        const start = Number(path.dataset.delay || 0) * .72;
        write.set(path, { opacity: 1 }, start)
          .to(path, {
            strokeDashoffset: 0,
            duration: Number(path.dataset.duration || .5) * .72,
            ease: "none",
          }, start);
      });
      await new Promise<void>((resolve) => write.eventCallback("onComplete", resolve));
      await mediaReady;
      if (cancelled) return;

      gsap.set(mediaElement, { visibility: "visible", opacity: 0 });
      const reveal = gsap.timeline({ defaults: { overwrite: "auto" } });
      reveal
        .to(loaderElement.querySelector(".loader__signature"), { opacity: 0, duration: .26, ease: "power1.inOut" }, 0)
        .to(loaderElement, { opacity: 0, duration: .58, ease: "power2.inOut" }, .04)
        .to(mediaElement, { opacity: 1, duration: .62, ease: "power2.out" }, .10)
        .to(introUi, { opacity: 1, duration: .46, stagger: .045, ease: "power2.out" }, .16);
      await new Promise<void>((resolve) => reveal.eventCallback("onComplete", resolve));
      if (cancelled) return;

      gsap.set(introUi, { clearProps: "opacity" });
      gsap.set(mediaElement, { clearProps: "opacity" });
      sessionStorage.setItem("zeudi-loader-seen", "1");
      setLoading(false);
    }).catch(() => { void finishWithoutGsap(); });

    return () => {
      cancelled = true;
      loadGsap().then((gsap) => gsap?.killTweensOf([stageElement, loaderElement, mediaElement, ...pathElements].filter(Boolean)));
    };
  }, [active, preview]);

  // The reference keeps the name alive after the preload: small groups of
  // letters turn in place at irregular intervals and the pointer gently pulls
  // nearby glyphs. Keeping this separate from the preload means it can pause
  // cleanly whenever a panel is opened or the page is hidden.
  useLayoutEffect(() => {
    if (!active || preview || loading || prefersReducedMotion()) return;
    let cancelled = false;
    let dispose = () => {};

    loadGsap().then((gsap) => {
      if (cancelled || !gsap || prefersReducedMotion()) return;
      const name = identityName.current;
      const stageElement = stage.current;
      if (!name || !stageElement) return;
      const chars = [...name.querySelectorAll<HTMLElement>(".identity__char")];
      const glyphs = chars.map((char) => char.querySelector<HTMLElement>(".identity__glyph")).filter((glyph): glyph is HTMLElement => Boolean(glyph));
      if (chars.length < 2 || glyphs.length !== chars.length) return;

      const pulse = document.createElement("div");
      pulse.className = "home-exposure-pulse";
      pulse.setAttribute("aria-hidden", "true");
      document.body.appendChild(pulse);

      let timer: { kill: () => void } | null = null;
      let running = false;
      let previous = new Set<number>();
      const panelOpen = () => Boolean(document.querySelector(".gallery-panel.open,.about-panel.open,.shop-panel.open,.contact-panel.open"));
      const canAnimate = () => !cancelled && !document.hidden && !panelOpen() && !loader.current;
      const clearTimer = () => { timer?.kill(); timer = null; };
      const resetMagnet = () => glyphs.forEach((glyph) => gsap.to(glyph, { x: 0, y: 0, rotation: 0, duration: .42, ease: "power3.out", overwrite: true }));
      const materialPulse = () => {
        gsap.killTweensOf(pulse);
        gsap.timeline()
          .to(pulse, { opacity: .014, duration: .09, ease: "power1.out" })
          .to(pulse, { opacity: 0, duration: .28, ease: "power2.out" });
        gsap.to(stageElement, { "--zeudi-grain-lift": .018, duration: .12, yoyo: true, repeat: 1, ease: "power1.out", overwrite: true });
      };
      const chooseGroup = () => {
        const count = Math.random() < .62 ? 1 : Math.random() < .84 ? 2 : 3;
        const pool = chars.map((_, index) => index).filter((index) => !previous.has(index));
        gsap.utils.shuffle(pool);
        const picked = pool.slice(0, Math.min(count, pool.length));
        previous = new Set(picked);
        return picked.map((index) => chars[index]);
      };
      const schedule = () => {
        clearTimer();
        if (!canAnimate()) { running = false; return; }
        running = true;
        timer = gsap.delayedCall(gsap.utils.random(3.4, 5.4), flipGroup);
      };
      const flipGroup = () => {
        if (!canAnimate()) { schedule(); return; }
        const group = chooseGroup();
        materialPulse();
        let longest = 0;
        group.forEach((char, index) => {
          const direction = Math.random() < .5 ? -1 : 1;
          const axis = Math.random() < .78 ? "rotationX" : "rotationY";
          const stagger = index * gsap.utils.random(.055, .11);
          const firstDuration = gsap.utils.random(.52, .61);
          const secondDuration = gsap.utils.random(.58, .69);
          longest = Math.max(longest, stagger + firstDuration + secondDuration);
          gsap.killTweensOf(char);
          gsap.set(char, { rotationX: 0, rotationY: 0, scaleX: 1, scaleY: 1, transformPerspective: 780 });
          gsap.timeline({ delay: stagger })
            .to(char, { [axis]: direction * 180, scaleY: .975, duration: firstDuration, ease: "power1.inOut" })
            .to(char, { [axis]: direction * 360, scaleY: 1, duration: secondDuration, ease: "power2.inOut" })
            .set(char, { rotationX: 0, rotationY: 0 });
        });
        gsap.delayedCall(longest + .06, schedule);
      };

      const quickX = glyphs.map((glyph) => gsap.quickTo(glyph, "x", { duration: .42, ease: "power3.out" }));
      const quickY = glyphs.map((glyph) => gsap.quickTo(glyph, "y", { duration: .42, ease: "power3.out" }));
      const quickRotation = glyphs.map((glyph) => gsap.quickTo(glyph, "rotation", { duration: .48, ease: "power3.out" }));
      const onPointerMove = (event: PointerEvent) => {
        if (!canAnimate() || event.pointerType === "touch") return;
        const bounds = name.getBoundingClientRect();
        const distance = Math.hypot(event.clientX - (bounds.left + bounds.width / 2), event.clientY - (bounds.top + bounds.height / 2));
        const radius = Math.max(190, bounds.width * .82);
        if (distance > radius) { resetMagnet(); return; }
        glyphs.forEach((glyph, index) => {
          const rect = glyph.getBoundingClientRect();
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          const length = Math.max(45, Math.hypot(dx, dy));
          const force = Math.max(0, 1 - length / radius);
          quickX[index](Math.max(-2.4, Math.min(2.4, dx / length * 2.4 * force)));
          quickY[index](Math.max(-1.8, Math.min(1.8, dy / length * 1.8 * force)));
          quickRotation[index](Math.max(-.8, Math.min(.8, dx / radius * .8 * force)));
        });
      };
      const sync = () => {
        if (canAnimate()) { if (!running) schedule(); return; }
        clearTimer(); running = false; resetMagnet();
        chars.forEach((char) => { gsap.killTweensOf(char); gsap.set(char, { rotationX: 0, rotationY: 0, scaleX: 1, scaleY: 1 }); });
        gsap.set(pulse, { opacity: 0 });
        stageElement.style.setProperty("--zeudi-grain-lift", "0");
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", sync);
      window.addEventListener("pageshow", sync);
      schedule();
      dispose = () => {
        clearTimer();
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", sync);
        window.removeEventListener("pageshow", sync);
        gsap.killTweensOf([...chars, ...glyphs, pulse]);
        pulse.remove();
      };
    });

    return () => { cancelled = true; dispose(); };
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

  // The reference filmstrip behaves like a small horizontal gallery on narrow
  // screens: a drag scrolls the row and releases on the nearest work. Keep the
  // browser's native click from firing again after a drag has selected it.
  useEffect(() => {
    const strip = track.current;
    if (!strip) return;
    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let moved = false;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || strip.dataset.fits === "1") return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = strip.scrollLeft;
      moved = false;
      strip.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const delta = event.clientX - startX;
      if (Math.abs(delta) > 3) moved = true;
      if (moved) {
        event.preventDefault();
        strip.scrollLeft = startScroll - delta;
      }
    };
    const onEnd = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const wasMoved = moved;
      pointerId = null;
      moved = false;
      try { strip.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
      if (!wasMoved) return;
      const thumbs = [...strip.querySelectorAll<HTMLButtonElement>(".thumb")];
      const center = strip.getBoundingClientRect().left + strip.clientWidth / 2;
      const nearest = thumbs.reduce((best, thumb, index) => {
        const rect = thumb.getBoundingClientRect();
        const distance = Math.abs((rect.left + rect.right) / 2 - center);
        return distance < best.distance ? { index, distance } : best;
      }, { index: current, distance: Number.POSITIVE_INFINITY });
      suppressThumbClick.current = true;
      select(nearest.index);
    };
    strip.addEventListener("pointerdown", onDown);
    strip.addEventListener("pointermove", onMove, { passive: false });
    strip.addEventListener("pointerup", onEnd);
    strip.addEventListener("pointercancel", onEnd);
    return () => {
      strip.removeEventListener("pointerdown", onDown);
      strip.removeEventListener("pointermove", onMove);
      strip.removeEventListener("pointerup", onEnd);
      strip.removeEventListener("pointercancel", onEnd);
    };
  }, [current, items.length, select]);

  useLayoutEffect(() => {
    const strip = track.current;
    const markerElement = marker.current;
    if (!strip || !markerElement) return;
    let cancelled = false;
    const update = () => {
      const thumbs = [...strip.querySelectorAll<HTMLButtonElement>(".thumb")];
      if (!thumbs.length) return;
      strip.style.paddingLeft = "0px";
      strip.style.paddingRight = "0px";
      const styles = getComputedStyle(strip);
      const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const total = thumbs.reduce((sum, thumb) => sum + thumb.offsetWidth, 0) + gap * Math.max(0, thumbs.length - 1);
      const fits = total <= strip.clientWidth + 1;
      strip.dataset.fits = fits ? "1" : "0";
      let targetScroll = strip.scrollLeft;
      if (fits) {
        const side = Math.max(0, (strip.clientWidth - total) / 2);
        strip.style.paddingLeft = `${side}px`;
        strip.style.paddingRight = `${side}px`;
        strip.scrollLeft = 0;
      } else {
        const thumb = thumbs[current];
        if (thumb) {
          const left = thumb.offsetLeft;
          const right = left + thumb.offsetWidth;
          const edge = 6;
          const viewLeft = strip.scrollLeft;
          const viewRight = viewLeft + strip.clientWidth;
          const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
          targetScroll = left < viewLeft + edge ? Math.max(0, left - edge) : right > viewRight - edge ? Math.min(max, right - strip.clientWidth + edge) : viewLeft;
        }
      }
      const thumb = thumbs[current];
      if (!thumb) return;
      const trackRect = strip.getBoundingClientRect();
      const thumbRect = thumb.getBoundingClientRect();
      const x = thumbRect.left - trackRect.left + strip.scrollLeft;
      const y = Math.max(0, thumbRect.top - trackRect.top + strip.scrollTop - 4);
      const reduced = prefersReducedMotion();
      loadGsap().then((gsap) => {
        if (cancelled || !gsap) return;
        if (targetScroll !== strip.scrollLeft) {
          if (reduced) gsap.set(strip, { scrollLeft: targetScroll });
          else gsap.to(strip, { scrollLeft: targetScroll, duration: .36, ease: "power2.out", overwrite: true });
        }
        const vars = { x, y, width: thumbRect.width, duration: reduced ? 0 : .42, ease: "power3.inOut", overwrite: true } as const;
        if (reduced) gsap.set(markerElement, vars);
        else gsap.to(markerElement, vars);

        const settle = (hoverIndex = -1) => thumbs.forEach((thumb, index) => {
          const activeThumb = index === current;
          const hovered = index === hoverIndex;
          gsap.to(thumb, {
            x: hovered ? (index < current ? -4.5 : index > current ? 4.5 : 0) : 0,
            y: hovered ? -3 : activeThumb ? -1 : 0,
            scale: hovered ? (activeThumb ? 1.1 : 1.055) : activeThumb ? 1.085 : 1,
            opacity: hovered || activeThumb ? 1 : .42,
            filter: hovered || activeThumb ? "contrast(1) saturate(1)" : "contrast(.92) saturate(.88)",
            duration: hovered ? .28 : activeThumb ? .34 : .28,
            ease: "power3.out",
            overwrite: "auto",
          });
        });
        settle();
        thumbs.forEach((thumb, index) => {
          const enter = () => settle(index);
          const leave = () => settle();
          thumb.addEventListener("pointerenter", enter);
          thumb.addEventListener("pointerleave", leave);
          thumb.addEventListener("focus", enter);
          thumb.addEventListener("blur", leave);
          (thumb as HTMLButtonElement & { __zeudiMotionCleanup?: () => void }).__zeudiMotionCleanup = () => {
            thumb.removeEventListener("pointerenter", enter);
            thumb.removeEventListener("pointerleave", leave);
            thumb.removeEventListener("focus", enter);
            thumb.removeEventListener("blur", leave);
          };
        });
      });
    };
    update();
    const onResize = () => requestAnimationFrame(update);
    window.addEventListener("resize", onResize);
    strip.querySelectorAll("img").forEach((image) => image.addEventListener("load", onResize, { once: true }));
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      strip.querySelectorAll<HTMLButtonElement>(".thumb").forEach((thumb) => {
        (thumb as HTMLButtonElement & { __zeudiMotionCleanup?: () => void }).__zeudiMotionCleanup?.();
        delete (thumb as HTMLButtonElement & { __zeudiMotionCleanup?: () => void }).__zeudiMotionCleanup;
      });
    };
  }, [current, items.length]);

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
        <div id="homeMusicPlayer" className={`home-music-player home-music-frame${musicOpen ? " is-open" : ""}`} aria-hidden={!musicOpen}>{musicOpen && <iframe ref={musicFrame} title="Ludovico Einaudi — Nuvole Bianche" src={`https://www.youtube.com/embed/${MUSIC_VIDEO_ID}?enablejsapi=1&autoplay=1&controls=0&playsinline=1&loop=1&playlist=${MUSIC_VIDEO_ID}&rel=0&fs=0&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={handleMusicFrameLoad} />}</div>
      </>}
    </>
  );
}
