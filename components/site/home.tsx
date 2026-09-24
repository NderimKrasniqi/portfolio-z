"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Content, Locale } from "@/lib/model";
import { MediaView, mediaUrl } from "./media";
export function HomeView({
  content,
  locale,
  preview = false,
}: {
  content: Content;
  locale: Locale;
  preview?: boolean;
}) {
  const items = content.media.filter((m) => m.featured);
  const [firstName, ...restOfName] = content.name.trim().split(/\s+/);
  const [current, setCurrent] = useState(0);
  const figure = useRef<HTMLElement>(null);
  const item = items[current] || items[0];
  useEffect(() => {
    if (
      !figure.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let active = true;
    let animation: { kill: () => void } | undefined;
    import("gsap").then(({ gsap }) => {
      if (active)
        animation = gsap.fromTo(
          figure.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.65, ease: "power2.out" },
        );
    });
    return () => {
      active = false;
      animation?.kill();
    };
  }, [current]);
  const step = (n: number) =>
    setCurrent((i) => (i + n + items.length) % items.length);
  return (
    <main id="main" className="home-stage">
      <div className="home-identity">
        <span className="eyebrow">SELECTED WORK / PORTFOLIO</span>
        <h1>
          {firstName}
          <br />
          {restOfName.join(" ")}
        </h1>
        <Link
          className="text-link"
          href={`${preview ? "/admin/preview" : ""}/${locale}/gallery`}
        >
          {content.nav.gallery} ↗
        </Link>
      </div>
      {item && (
        <figure ref={figure} className="home-media">
          <MediaView media={item} priority draft={preview} />
        </figure>
      )}
      <div className="home-meta">
        <div className="counter">
          {String(current + 1).padStart(2, "0")}
          <span> / {String(items.length).padStart(2, "0")}</span>
        </div>
        <hr />
        <p>{item?.title}</p>
        <p>{item?.category}</p>
        <div className="arrows">
          <button onClick={() => step(-1)} aria-label="Previous work">
            ←
          </button>
          <button onClick={() => step(1)} aria-label="Next work">
            →
          </button>
        </div>
      </div>
      <div className="filmstrip" aria-label="Select work">
        {items.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setCurrent(i)}
            aria-label={`View ${m.title}`}
            aria-pressed={i === current}
          >
            <img
              src={mediaUrl(m.thumbKey, preview)}
              alt=""
              width={64}
              height={80}
              loading={i < 5 ? "eager" : "lazy"}
            />
          </button>
        ))}
      </div>
    </main>
  );
}
