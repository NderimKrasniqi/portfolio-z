"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { Content } from "@/lib/model";
import { MediaView } from "./media";
const Sphere = dynamic(() => import("./sphere"), {
  ssr: false,
  loading: () => <p role="status">Loading sphere…</p>,
});
export function GalleryView({
  content,
  preview = false,
}: {
  content: Content;
  preview?: boolean;
}) {
  const [mode, setMode] = useState<"grid" | "sphere">("grid");
  const [category, setCategory] = useState("All");
  const items = content.media.filter(
    (m) => category === "All" || m.category === category,
  );
  return (
    <main id="main" className="gallery-page">
      <div className="gallery-heading">
        <h1>{content.nav.gallery}</h1>
        <div className="arrows">
          <button
            aria-pressed={mode === "grid"}
            onClick={() => setMode("grid")}
          >
            Grid
          </button>
          <button
            aria-pressed={mode === "sphere"}
            onClick={() => setMode("sphere")}
          >
            Sphere
          </button>
        </div>
      </div>
      <div className="filters">
        {["All", ...new Set(content.media.map((m) => m.category))].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {mode === "sphere" ? (
        <Sphere items={items} draft={preview} />
      ) : (
        <div className="gallery-grid">
          {items.map((m, i) => (
            <figure key={m.id}>
              <MediaView media={m} priority={i < 2} draft={preview} />
              <figcaption>
                {m.title}
                <span>{m.category}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
