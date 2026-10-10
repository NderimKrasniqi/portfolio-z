"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { WardrobePiece } from "./shop-catalog";
import { createWardrobeMotion, garmentFaces } from "./wardrobe-motion";

export function WardrobeHanger({
  pants = false,
  exposed = false,
}: {
  pants?: boolean;
  exposed?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="wardrobe-hanger" viewBox="0 0 300 110" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-neckline`}>
          <rect x="126" y="48" width="48" height="58" />
        </clipPath>
        <linearGradient id={`${id}-metal`}>
          <stop stopColor="#61615e" />
          <stop offset=".35" stopColor="#faf9f5" />
          <stop offset=".6" stopColor="#a6a5a0" />
          <stop offset="1" stopColor="#575853" />
        </linearGradient>
        <linearGradient id={`${id}-wood`} x2="0" y2="1">
          <stop stopColor="#bd8a5b" />
          <stop offset=".4" stopColor="#a06b40" />
          <stop offset="1" stopColor="#6d452c" />
        </linearGradient>
      </defs>
      <path
        d={`M150 ${pants || exposed ? 41 : 70}V24c0-7 11-7 11-15 0-13-23-13-23 0v4`}
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {pants ? (
        <>
          <rect
            x="67"
            y="42"
            width="166"
            height="9"
            rx="4"
            fill={`url(#${id}-wood)`}
          />
          {[78, 210].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="43"
                width="13"
                height="23"
                rx="3"
                fill={`url(#${id}-metal)`}
              />
              <path d={`M${x + 3} 61h7`} stroke="#4d4b46" />
            </g>
          ))}
        </>
      ) : (
        <g clipPath={exposed ? undefined : `url(#${id}-neckline)`}>
          <g transform={exposed ? undefined : "translate(0 18)"}>
            <path
              d="M145 34q5-3 10 0l5 13 82 34q9 6 2 12l-17-2-73-33q-4-2-8 0L73 91l-17 2q-7-6 2-12l82-34Z"
              fill={`url(#${id}-wood)`}
              stroke="#704d31"
              strokeWidth=".8"
            />
            <path
              d="M62 87q85 18 176 0"
              fill="none"
              stroke="#865b39"
              strokeWidth="4"
            />
            <path
              d="m65 81 80-30q5-2 10 0l80 30"
              fill="none"
              stroke="#d5aa7a"
              strokeWidth="1"
              opacity=".65"
            />
          </g>
        </g>
      )}
    </svg>
  );
}

export function PieceImage({
  piece,
  side = false,
}: {
  piece: WardrobePiece;
  side?: boolean;
}) {
  return (
    <img
      className={`wardrobe-photo ${side ? "wardrobe-photo--side" : "wardrobe-photo--front"} ${piece.treatment ? `wardrobe-photo--${piece.treatment}` : ""}`}
      src={(side && piece.side) || piece.front}
      alt=""
      draggable={false}
    />
  );
}

export function WardrobeRack({
  pieces,
  active,
  onActive,
  onOpen,
}: {
  pieces: WardrobePiece[];
  active: number | null;
  onActive: (index: number | null) => void;
  onOpen: (index: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const target = useRef(active);
  const touch = useRef(false);
  const wake = useRef(() => {});
  useEffect(() => {
    target.current = active;
    wake.current();
  }, [active]);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const buttons = Array.from(
      element.querySelectorAll<HTMLButtonElement>(".wardrobe-piece"),
    );
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const physics = createWardrobeMotion(pieces.length);
    let width = element.clientWidth,
      garment =
        element.querySelector<HTMLElement>(".wardrobe-pivot")?.offsetWidth ??
        240,
      frame = 0,
      previous = 0;
    function resume() {
      if (!frame) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    }
    wake.current = resume;
    motion.addEventListener("change", resume);
    const observer = new ResizeObserver(() => {
      width = element.clientWidth;
      garment =
        element.querySelector<HTMLElement>(".wardrobe-pivot")?.offsetWidth ??
        240;
      resume();
    });
    observer.observe(element);
    function tick(now: number) {
      const dt = Math.min((now - (previous || now)) / 1000, 1 / 30);
      previous = now;
      const step = Math.min(76, width * 0.115);
      const selected = target.current;
      const moving = physics.advance(
        dt,
        selected,
        garment,
        step,
        motion.matches,
      );
      physics.states.forEach((state, index) => {
        const turn = selected === index;
        const progress = Math.max(0, Math.min(1, state.turn));
        const faces = garmentFaces(progress);
        const button = buttons[index];
        if (!button) return;
        button.style.setProperty("--piece-x", `${state.x}px`);
        button.style.setProperty("--piece-turn", `${(1 - progress) * 82}deg`);
        button.style.setProperty("--piece-sway", `${state.sway}deg`);
        button.style.setProperty("--piece-front", `${faces.front}`);
        button.style.setProperty("--piece-side", `${faces.side}`);
        button.style.setProperty("--hanger-width", `${faces.width}`);
        button.style.setProperty(
          "--fabric-bend",
          `${Math.max(-2, Math.min(2, state.vs * 0.04))}deg`,
        );
        button.dataset.sway = state.sway.toFixed(3);
        button.style.width = `${turn ? garment : step}px`;
        button.style.zIndex = `${turn ? 20 : pieces.length - index}`;
      });
      frame = moving ? requestAnimationFrame(tick) : 0;
    }
    resume();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      motion.removeEventListener("change", resume);
      wake.current = () => {};
    };
  }, [pieces]);

  return (
    <div
      ref={root}
      className="wardrobe-stage"
      data-active={active ?? "none"}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onActive(null);
      }}
    >
      <div className="wardrobe-rail" aria-hidden="true">
        <i />
        <i />
      </div>
      {pieces.map((piece, index) => (
        <button
          key={piece.id}
          type="button"
          className={`wardrobe-piece ${piece.treatment ? `wardrobe-piece--${piece.treatment}` : ""}`}
          style={{ "--piece-front": 0, "--piece-side": 1 } as CSSProperties}
          aria-label={`View ${piece.title}`}
          aria-pressed={active === index}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") onActive(index);
          }}
          onPointerDown={(event) => {
            touch.current = event.pointerType === "touch";
          }}
          onFocus={() => {
            if (!touch.current) onActive(index);
          }}
          onClick={() => {
            if (touch.current && active !== index) onActive(index);
            else onOpen(index);
            touch.current = false;
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? pieces.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        pieces.length) %
                      pieces.length;
              root.current
                ?.querySelectorAll<HTMLButtonElement>(".wardrobe-piece")
                [next]?.focus();
            }
          }}
        >
          <span className="wardrobe-pivot">
            <WardrobeHanger pants={piece.rail === "Pants"} />
            <span className="wardrobe-fabric">
              <PieceImage piece={piece} />
              <PieceImage piece={piece} side />
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
