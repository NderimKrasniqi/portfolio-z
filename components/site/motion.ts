"use client";

/** Load GSAP only in the browser and share the promise between public views. */
let gsapPromise: Promise<typeof import("gsap").gsap> | null = null;

export function loadGsap() {
  if (typeof window === "undefined") return Promise.resolve(null);
  gsapPromise ??= import("gsap").then(({ gsap }) => gsap);
  return gsapPromise;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

