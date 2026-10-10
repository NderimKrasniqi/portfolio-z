"use client";

import { useEffect, useRef, useState } from "react";
import type { WardrobePiece } from "./shop-catalog";
import { loadSkia } from "./skia-loader";
import { createSkiaWardrobe } from "./skia-wardrobe-scene";

export function SkiaWardrobeRack({
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
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const target = useRef(active),
    touch = useRef(false),
    wake = useRef(() => {});
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    target.current = active;
    wake.current();
  }, [active]);
  useEffect(() => {
    const element = root.current!,
      node = canvas.current!;
    const abort = new AbortController();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let scene: Awaited<ReturnType<typeof createSkiaWardrobe>> | undefined;
    let frame = 0,
      previous = 0,
      visible = false,
      started = false;
    const buttons = Array.from(
      element.querySelectorAll<HTMLButtonElement>(".skia-piece-hit"),
    );
    const fail = () => {
      if (!abort.signal.aborted) {
        cancelAnimationFrame(frame);
        frame = 0;
        setStatus("error");
      }
    };
    function tick(now: number) {
      frame = 0;
      if (!scene || !visible || abort.signal.aborted) return;
      const dt = Math.min((now - (previous || now)) / 1000, 1 / 30);
      previous = now;
      try {
        const { moving, slots } = scene.draw(
          target.current,
          dt,
          motion.matches,
        );
        slots.forEach((slot, i) => {
          const button = buttons[i];
          button.style.left = `${slot.x}px`;
          button.style.width = `${slot.width}px`;
          button.style.height = `${slot.height}px`;
          button.style.zIndex =
            target.current === i ? "20" : `${pieces.length - i}`;
          button.dataset.turn = slot.turn.toFixed(3);
          button.dataset.sway = slot.sway.toFixed(3);
        });
        if (moving) frame = requestAnimationFrame(tick);
      } catch {
        fail();
      }
    }
    function resume() {
      if (!frame && scene && visible && !abort.signal.aborted) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    }
    wake.current = resume;
    function resize() {
      if (scene && element.clientWidth) {
        try {
          scene.resize(element.clientWidth, element.clientHeight);
          resume();
        } catch {
          fail();
        }
      }
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !started) {
          started = true;
          loadSkia()
            .then((kit) => {
              if (abort.signal.aborted) return;
              return createSkiaWardrobe(kit, node, pieces, abort.signal);
            })
            .then((result) => {
              if (!result) return;
              if (abort.signal.aborted) {
                result.dispose();
                return;
              }
              scene = result;
              scene.resize(element.clientWidth, element.clientHeight);
              setStatus("ready");
              resume();
            })
            .catch(fail);
        } else if (visible) resume();
        else {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { rootMargin: "250px" },
    );
    observer.observe(element);
    motion.addEventListener("change", resume);
    const lost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    node.addEventListener("webglcontextlost", lost);
    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      motion.removeEventListener("change", resume);
      node.removeEventListener("webglcontextlost", lost);
      scene?.dispose();
      wake.current = () => {};
    };
  }, [pieces, attempt]);
  return (
    <div
      className="skia-wardrobe-stage"
      ref={root}
      data-status={status}
      data-active={active ?? "none"}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onActive(null);
      }}
    >
      <canvas
        key={attempt}
        ref={canvas}
        aria-hidden="true"
        data-renderer="skia"
      />
      {status !== "ready" && (
        <div className="skia-status" role="status">
          {status === "loading" ? (
            "Loading the Skia rail…"
          ) : (
            <>
              <p>
                The Skia rail couldn’t load. The original above is still
                available.
              </p>
              <button
                onClick={() => {
                  setStatus("loading");
                  setAttempt((value) => value + 1);
                }}
              >
                Try again
              </button>
            </>
          )}
        </div>
      )}
      {pieces.map((piece, index) => (
        <button
          key={piece.id}
          className="skia-piece-hit"
          disabled={status !== "ready"}
          type="button"
          aria-label={`View ${piece.title} in Skia rail`}
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
                ?.querySelectorAll<HTMLButtonElement>(".skia-piece-hit")
                [next]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
