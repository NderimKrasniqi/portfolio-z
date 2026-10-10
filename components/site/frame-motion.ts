"use client";

import { loadGsap, prefersReducedMotion } from "./motion";

let clientNavigated = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { clientNavigated = true; });
}

function pageTarget(root: HTMLElement) {
  return root.querySelector<HTMLElement>(
    ".gallery-panel.open,.about-panel.open,.shop-panel.open,.contact-panel.open,.stage",
  );
}

function makeShutter(root: HTMLElement) {
  document.querySelector(".site-transition")?.remove();
  const shutter = document.createElement("div");
  shutter.className = "site-transition";
  shutter.setAttribute("aria-hidden", "true");
  shutter.style.setProperty("--transition-paper", getComputedStyle(root).getPropertyValue("--paper").trim() || "#f7f5f0");
  for (let index = 0; index < 3; index++) {
    const panel = document.createElement("span");
    panel.style.transformOrigin = index === 1 ? "center top" : "center bottom";
    shutter.append(panel);
  }
  document.body.append(shutter);
  return shutter;
}

export function runFrameExitTransition(onComplete: () => void) {
  clientNavigated = true;
  if (prefersReducedMotion()) { onComplete(); return; }
  const root = document.querySelector<HTMLElement>(".portfolio");
  const target = root && pageTarget(root);
  if (!root || !target) { onComplete(); return; }
  let completed = false;
  const finish = () => { if (!completed) { completed = true; onComplete(); } };
  void loadGsap().then((gsap) => {
    if (!gsap) return finish();
    const shutter = makeShutter(root);
    gsap.killTweensOf(target);
    gsap.timeline({ onComplete: finish })
      .to(shutter.children, { scaleY: 1, duration: .5, stagger: .055, ease: "power4.inOut" }, 0)
      .to(target, { opacity: .45, duration: .38, ease: "power2.inOut" }, .08);
  }).catch(() => {
    document.querySelector(".site-transition")?.remove();
    finish();
  });
}

export function runFrameEnterTransition() {
  const root = document.querySelector<HTMLElement>(".portfolio");
  const shutter = document.querySelector<HTMLElement>(".site-transition");
  const revealFinished = () => {
    shutter?.remove();
    window.dispatchEvent(new Event("zeudi-page-revealed"));
  };
  if (!root || prefersReducedMotion() || !clientNavigated) {
    revealFinished();
    return () => {};
  }
  const target = pageTarget(root);
  if (!target) { revealFinished(); return () => {}; }
  root.classList.add("motion-gsap");
  let cancelled = false;
  let animation: { kill: () => void } | undefined;
  void loadGsap().then((gsap) => {
    if (cancelled) return;
    if (!gsap) { revealFinished(); return; }
    gsap.killTweensOf(target);
    gsap.set(target, { clipPath: "inset(0% 0% 0% 0%)", visibility: "visible" });
    const timeline = gsap.timeline({ onComplete: () => {
      gsap.set(target, { opacity: 1, clearProps: "clipPath" });
      revealFinished();
    } });
    animation = timeline;
    if (shutter) {
      Array.from(shutter.children).forEach((panel, index) => {
        (panel as HTMLElement).style.transformOrigin = index === 1 ? "center bottom" : "center top";
      });
      timeline.to(shutter.children, { scaleY: 0, duration: .62, stagger: .055, ease: "power4.inOut" }, 0);
    }
    // The gallery's own circle reveal supplies its entrance after the curtain clears.
    if (target.classList.contains("gallery-panel")) {
      gsap.set(target, { opacity: 1 });
    } else {
      timeline.fromTo(target, { opacity: .55 }, { opacity: 1, duration: .55, ease: "power2.out" }, .12);
    }
    if (!shutter && target.classList.contains("gallery-panel")) revealFinished();
  }).catch(revealFinished);
  return () => {
    cancelled = true;
    animation?.kill();
    shutter?.remove();
  };
}
