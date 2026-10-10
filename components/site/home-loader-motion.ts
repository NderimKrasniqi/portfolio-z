"use client";

import { loadGsap, prefersReducedMotion } from "./motion";

function loaderSeen() {
  try { return Boolean(sessionStorage.getItem("zeudi-loader-seen")); }
  catch { return false; }
}

function rememberLoader() {
  try { sessionStorage.setItem("zeudi-loader-seen", "1"); }
  catch { /* The intro remains usable when storage is unavailable. */ }
}

export function runHomeLoaderTransition({ preview, stage, loader, onDone }: {
  preview: boolean;
  stage: HTMLElement | null;
  loader: HTMLDivElement | null;
  media: HTMLDivElement | null;
  front: HTMLDivElement | null;
  onDone: (skipIntro?: boolean) => void;
}) {
  let cancelled = false;
  let animation: { kill: () => void } | undefined;
  const finish = (skipIntro = false) => {
    if (cancelled) return;
    if (stage) {
      stage.style.visibility = "visible";
      stage.style.opacity = "1";
    }
    onDone(skipIntro);
  };
  if (preview || !loader || !stage || prefersReducedMotion()) {
    queueMicrotask(() => finish(true));
    return () => { cancelled = true; };
  }
  if (loaderSeen()) {
    // Session storage only gates the signature, never the grid/brand intro.
    loader.style.display = "none";
    queueMicrotask(() => finish());
    return () => { cancelled = true; };
  }

  void loadGsap().then((gsap) => {
    if (cancelled) return;
    if (!gsap) return finish();
    gsap.set(stage, { visibility: "visible", opacity: 1 });
    const timeline = gsap.timeline({ delay: 0.26, onComplete: () => {
      rememberLoader();
      finish();
    } });
    animation = timeline;
    timeline.set(loader.querySelector(".loader__signature-wrap"), { autoAlpha: 1 }, 0);
    const strokes = loader.querySelectorAll<SVGPathElement>(".pen");
    strokes.forEach((stroke) => {
      const length = stroke.getTotalLength();
      gsap.set(stroke, {
        opacity: 0, strokeDasharray: `${length} ${length + 24}`,
        strokeDashoffset: length + 12,
      });
      const start = Number(stroke.dataset.delay || 0) * 0.72;
      timeline.set(stroke, { opacity: 1 }, start).to(stroke, {
        strokeDashoffset: 0,
        duration: Number(stroke.dataset.duration || 0.5) * 0.72,
        ease: "none",
      }, start);
    });
    // The name finishes, rests, then completely disappears before the film intro.
    timeline.to({}, { duration: .25 })
      .addLabel("handoff")
      .to(loader.querySelector(".loader__signature"), { opacity: 0, y: -12, scale: .97, duration: .3, ease: "power2.in" }, "handoff")
      .to(loader, { clipPath: "inset(50% 0% 50% 0%)", duration: .72, ease: "power4.inOut" }, "handoff+=.24");
  }).catch(() => finish(true));

  return () => { cancelled = true; animation?.kill(); };
}
