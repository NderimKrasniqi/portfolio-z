"use client";

/** Load GSAP only in the browser and share the promise between public views. */
let gsapPromise: Promise<typeof import("gsap").gsap> | null = null;

export function loadGsap() {
  if (typeof window === "undefined") return Promise.resolve(null);
  gsapPromise ??= import("gsap").then(({ gsap }) => gsap);
  return gsapPromise;
}

/** The opacity the CSS gives an element at rest. GSAP fades to it, so the
 *  CSS dimming stays in one place and GSAP never needs to beat `!important`. */
export function restingOpacity(element: Element) {
  const el = element as HTMLElement;
  el.dataset.restOpacity ??= getComputedStyle(el).opacity;
  return Number(el.dataset.restOpacity);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

