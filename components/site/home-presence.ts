"use client";

import { useEffect, type RefObject } from "react";

/** A small, damped response in the existing composition; never resize the film. */
export function useHomePresence(stage: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const node = stage.current;
    if (!node || !enabled) return;
    const allowed = matchMedia("(min-width: 1101px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let value = 0;
    let target = 0;
    const paint = () => {
      value += (target - value) * .075;
      node.style.setProperty("--home-drift", `${value.toFixed(3)}px`);
      if (Math.abs(target - value) > .015) frame = requestAnimationFrame(paint);
      else frame = 0;
    };
    const move = (event: PointerEvent) => {
      if (!allowed.matches || event.pointerType !== "mouse") return;
      if ((event.target as Element).closest("a,button:not(.hx-card),.home-filmstrip")) target = 0;
      else target = Math.max(-10, Math.min(10, (event.clientX / innerWidth - .5) * 20));
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; value = 0; target = 0;
      node.style.removeProperty("--home-drift");
    };
    node.addEventListener("pointermove", move, { passive: true });
    node.addEventListener("pointerleave", reset);
    // Settle before either transition measures the hero's destination.
    node.addEventListener("pointerdown", reset, true);
    node.addEventListener("wheel", reset, { capture: true, passive: true });
    window.addEventListener("keydown", reset);
    allowed.addEventListener("change", reset);
    return () => {
      reset();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", reset);
      node.removeEventListener("pointerdown", reset, true);
      node.removeEventListener("wheel", reset, true);
      window.removeEventListener("keydown", reset);
      allowed.removeEventListener("change", reset);
    };
  }, [enabled, stage]);
}

/** Mirror the playing film into its selected preview using the existing decoder. */
export function useLiveFilmPreview(stage: RefObject<HTMLElement | null>, current: number, enabled: boolean) {
  useEffect(() => {
    const node = stage.current;
    const video = node?.querySelector<HTMLVideoElement>(".hx-card > video");
    const canvas = node?.querySelector<HTMLCanvasElement>(".home-filmstrip .is-active canvas");
    if (!enabled || !video || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context || !video.requestVideoFrameCallback) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let disposed = false;
    canvas.width = 104; canvas.height = 160;
    const paint = () => {
      if (disposed || reduced.matches || document.hidden) return;
      if (video.videoWidth && video.readyState >= 2) {
        const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const w = video.videoWidth * scale, h = video.videoHeight * scale;
        context.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        canvas.style.opacity = "1";
      }
      frame = video.requestVideoFrameCallback(paint);
    };
    const sync = () => {
      video.cancelVideoFrameCallback(frame);
      canvas.style.opacity = "0";
      if (!reduced.matches && !document.hidden) frame = video.requestVideoFrameCallback(paint);
    };
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      video.cancelVideoFrameCallback(frame);
      canvas.style.opacity = "0";
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [stage, current, enabled]);
}
