"use client";

import { useEffect, useRef } from "react";

// Retain the last three films' two frames without keeping video decoders alive.
const stills = new Map<string, HTMLCanvasElement>();

/** A still from the selected film, with its poster visible while seeking. */
export function VideoStill({ src, poster, fraction, alt }: {
  src: string; poster: string; fraction: number; alt: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const frame = canvas.current;
    if (!frame) return;
    const cacheKey = `${src}#${fraction}`;
    const cached = stills.get(cacheKey);
    if (cached) {
      frame.width = cached.width;
      frame.height = cached.height;
      frame.getContext("2d")?.drawImage(cached, 0, 0);
      frame.style.opacity = "1";
      return;
    }
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const seek = () => {
      if (Number.isFinite(video.duration) && video.duration > 0)
        video.currentTime = Math.min(video.duration - 0.05, video.duration * fraction);
    };
    const paint = () => {
      if (!video.videoWidth) return;
      frame.width = Math.min(720, video.videoWidth);
      frame.height = Math.round(frame.width * video.videoHeight / video.videoWidth);
      try {
        const context = frame.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, frame.width, frame.height);
        frame.style.opacity = "1";
        stills.set(cacheKey, frame);
        if (stills.size > 6) stills.delete(stills.keys().next().value!);
        video.removeEventListener("loadedmetadata", seek);
        video.removeEventListener("seeked", paint);
        video.removeAttribute("src");
        video.load();
      } catch { /* The poster remains available for unsupported media. */ }
    };
    video.addEventListener("loadedmetadata", seek);
    video.addEventListener("seeked", paint);
    video.src = src;
    return () => {
      video.removeEventListener("loadedmetadata", seek);
      video.removeEventListener("seeked", paint);
      video.removeAttribute("src");
      video.load();
    };
  }, [src, fraction]);

  return <><img src={poster} alt={alt} decoding="async" /><canvas ref={canvas} className="hx-still" aria-hidden="true" /></>;
}
