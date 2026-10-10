"use client";

import {
  useLayoutEffect,
  useRef,
} from "react";
import type { Content } from "@/lib/model";
import { ViewHeader } from "./site-controls";
import {
  loadGsap,
  prefersReducedMotion,
  restingOpacity,
} from "./motion";

export function AboutView({
  content,
  preview = false,
  onBack,
}: {
  content: Content;
  preview?: boolean;
  onBack: () => void;
}) {
  const sheet =
    useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroller = sheet.current;

    if (!scroller) return;

    const portrait =
      scroller.querySelector<HTMLElement>(
        ".about-portrait img, .about-portrait video",
      );

    let disposed = false;
    let frame = 0;

    let gsapApi:
      Awaited<
        ReturnType<typeof loadGsap>
      > = null;

    const update = () => {
      const maximum = Math.max(
        1,
        scroller.scrollHeight -
          scroller.clientHeight,
      );

      const ratio = Math.max(
        0,
        Math.min(
          1,
          scroller.scrollTop / maximum,
        ),
      );

      if (
        portrait &&
        gsapApi &&
        !prefersReducedMotion()
      ) {
        gsapApi.set(portrait, {
          yPercent:
            -1.5 + ratio * 3,
          scale:
            1.035 + ratio * 0.04,
        });
      }
    };

    const schedule = () => {
      if (frame) return;

      frame =
        requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };

    const onScroll = () =>
      schedule();

    scroller.addEventListener(
      "scroll",
      onScroll,
      { passive: true },
    );

    update();

    const observer =
      new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (
              !entry.isIntersecting
            ) {
              return;
            }

            entry.target.classList.add(
              "is-visible",
            );

            const parts = [
              ...entry.target.querySelectorAll<HTMLElement>(
                ".about-chapter-kicker,h3,.about-chapter-copy>p:last-child",
              ),
            ];

            if (
              gsapApi &&
              !prefersReducedMotion()
            ) {
              gsapApi.to(parts, {
                opacity: (_index: number, target: Element) =>
                  restingOpacity(target),
                y: 0,
                duration: 0.56,
                stagger: 0.035,
                ease: "power3.out",
                overwrite: "auto",
              });
            }
          }),
        {
          root: scroller,
          threshold: 0.14,
        },
      );

    scroller
      .querySelectorAll(
        ".about-chapter",
      )
      .forEach((chapter) =>
        observer.observe(chapter),
      );

    void loadGsap().then(
      (gsap) => {
        if (disposed) return;

        gsapApi = gsap;

        if (
          !gsap ||
          prefersReducedMotion()
        ) {
          return;
        }

        const parts = [
          ...scroller.querySelectorAll<HTMLElement>(
            ".about-chapter-kicker,h3,.about-chapter-copy>p:last-child",
          ),
        ];

        parts.forEach(restingOpacity);

        gsap.set(parts, {
          opacity: 0,
          y: 24,
        });

        gsap.set(portrait, {
          scale: 1.035,
          yPercent: -1.5,
        });

        update();
      },
    );

    const onResize = () =>
      schedule();

    window.addEventListener(
      "resize",
      onResize,
      { passive: true },
    );

    return () => {
      disposed = true;

      scroller.removeEventListener(
        "scroll",
        onScroll,
      );

      window.removeEventListener(
        "resize",
        onResize,
      );

      observer.disconnect();

      cancelAnimationFrame(frame);
    };
  }, [content.chapters]);

  return (
    <section
      id="aboutPanel"
      className="about-panel open is-ready"
      role="dialog"
      aria-modal="true"
      aria-label={`About ${content.name}`}
    >
      <ViewHeader onBack={onBack} backClass="about-close" />

      <main
        id="main"
        className="about-sheet"
        ref={sheet}
      >
        <div className="about-inner about-story-shell">
          <div className="about-copy">
            <header className="about-intro">
              <h1 className="about-story-title">{content.aboutTitle}</h1>

              <p className="about-lead">
                {content.aboutLead}
              </p>

            </header>

            <div className="about-body">
              {content.chapters.map(
                (chapter, index) => (
                  <section
                    className="about-chapter"
                    key={chapter.id}
                    data-step={index + 1}
                  >
                    <div className="about-chapter-copy">
                      <p className="about-chapter-kicker">
                        {chapter.label}
                      </p>

                      <h3>
                        {chapter.title}
                      </h3>

                      <p>
                        {chapter.body}
                      </p>
                    </div>
                  </section>
                ),
              )}
            </div>
          </div>

          <aside
            className="about-visual"
            aria-hidden="true"
          >
            <figure className="about-portrait">
              <img
                src="/reference-about-portrait.jpg"
                alt=""
                width="934"
                height="1285"
                fetchPriority="high"
              />
            </figure>

            <div className="about-portrait-meta">
              <span>
                {content.location}
              </span>

            </div>

          </aside>
        </div>
      </main>
    </section>
  );
}
