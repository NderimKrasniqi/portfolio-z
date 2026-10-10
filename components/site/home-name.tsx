"use client";

import { useEffect, useRef } from "react";
import { loadGsap } from "./motion";

/** Original letter flips and cursor magnetism. */
export function HomeName({ enabled }: { enabled: boolean }) {
  const name = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const element = name.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let cleanup = () => {};
    void loadGsap().then(loaded => {
      if (!loaded || disposed) return;
      const gsap = loaded;
      const chars = Array.from(element.querySelectorAll<HTMLElement>(".home-name-char"));
      const glyphs = Array.from(element.querySelectorAll<HTMLElement>(".home-name-glyph"));
      let timer = 0;
      let lastIndex = -1;
      const reset = () => {
        clearTimeout(timer);
        gsap.killTweensOf([...chars, ...glyphs]);
        gsap.set([...chars, ...glyphs], { clearProps: "transform" });
      };
      function schedule() {
        timer = window.setTimeout(() => {
          if (disposed || reduced.matches || document.hidden) return;
          const index = (lastIndex + 1 + Math.floor(Math.random() * (chars.length - 1))) % chars.length;
          lastIndex = index;
          const chosen = Math.random() < .65 ? [chars[index]] : [chars[index], chars[(index + 1) % chars.length]];
          chosen.forEach((char, i) => {
            const direction = Math.random() < .5 ? -1 : 1;
            gsap.fromTo(char, { rotationX: 0 }, {
              rotationX: direction * 360, duration: 1.2, delay: i * .08,
              ease: "power2.inOut", overwrite: true,
              onComplete: () => { gsap.set(char, { rotationX: 0 }); },
            });
          });
          schedule();
        }, 10000 + Math.random() * 5000);
      }
      const move = (event: PointerEvent) => {
        if (reduced.matches || document.hidden || event.pointerType === "touch") return;
        const box = element.getBoundingClientRect();
        const radius = Math.max(190, box.width * .82);
        const near = Math.hypot(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2) < radius;
        glyphs.forEach(glyph => {
          const rect = glyph.getBoundingClientRect();
          const dx = event.clientX - rect.left - rect.width / 2;
          const dy = event.clientY - rect.top - rect.height / 2;
          const distance = Math.max(45, Math.hypot(dx, dy));
          const force = near ? Math.max(0, 1 - distance / radius) : 0;
          gsap.to(glyph, { x: dx / distance * 2.4 * force, y: dy / distance * 1.8 * force,
            rotationZ: Math.max(-.8, Math.min(.8, dx / radius * .8 * force)),
            duration: .42, ease: "power3.out", overwrite: true });
        });
      };
      const sync = () => { reset(); if (!reduced.matches && !document.hidden) schedule(); };
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("visibilitychange", sync);
      reduced.addEventListener("change", sync);
      sync();
      cleanup = () => {
        reset();
        window.removeEventListener("pointermove", move);
        document.removeEventListener("visibilitychange", sync);
        reduced.removeEventListener("change", sync);
      };
    });
    return () => { disposed = true; cleanup(); };
  }, [enabled]);
  return <h1 ref={name} aria-label="Zeudi Di Palma">
    {["ZEUDI", "DI PALMA."].map((line, row) => <span className="home-name-line" aria-hidden="true" key={line}>
      {Array.from(line).map((letter, i) => /[A-Z]/.test(letter)
        ? <span className="home-name-char" key={`${row}-${i}`}><span className="home-name-glyph">{letter}</span></span>
        : letter === " " ? "\u00a0" : letter)}
    </span>)}
  </h1>;
}
