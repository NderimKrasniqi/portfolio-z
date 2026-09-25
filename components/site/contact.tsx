"use client";

import {
  useLayoutEffect,
  useRef,
} from "react";
import type { Content } from "@/lib/model";
import { BackButton } from "./site-controls";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

const MANAGEMENT_URL =
  "https://www.wannabemgmt.com/";

const MANAGEMENT_INSTAGRAM =
  "https://www.instagram.com/wannabemgmt/";

export function ContactView({
  content,
  onBack,
}: {
  content: Content;
  onBack: () => void;
}) {
  const panel =
    useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = panel.current;
    if (!root) return;

    let cancelled = false;

    void loadGsap().then((gsap) => {
      if (cancelled || !gsap) return;

      const pieces = [
        ...root.querySelectorAll<HTMLElement>(
          ".contact-eyebrow,.contact-inner h2,.rep-row",
        ),
      ];

      const close =
        root.querySelector<HTMLElement>(
          ".contact-close",
        );

      const elements = [
        ...pieces,
        close,
      ].filter(Boolean);

      if (prefersReducedMotion()) {
        gsap.set(elements, {
          clearProps: "all",
        });
        return;
      }

      gsap.set(elements, {
        opacity: 0,
        y: 5,
      });

      gsap.to(elements, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.035,
        ease: "power3.out",
        delay: 0.58,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const title =
    content.contactTitle.replace(
      /\.$/,
      "",
    );

  const words =
    title.split(/\s+/);

  return (
    <section
      id="contactPanel"
      ref={panel}
      className="contact-panel open is-ready"
      role="dialog"
      aria-modal="true"
      aria-label="Contact and representation"
    >
      <BackButton
        className="contact-close"
        onBack={onBack}
      />

      <main
        id="main"
        className="contact-sheet"
      >
        <div className="contact-inner">
          <p className="contact-eyebrow">
            {content.contactLabel}
          </p>

          <h2
            role="heading"
            aria-level={1}
          >
            {words.map(
              (word, index) => (
                <span key={index}>
                  {index > 0 && <br />}
                  {word}
                  {index ===
                  words.length - 1
                    ? "."
                    : ""}
                </span>
              ),
            )}
          </h2>

          <div className="rep-list">
            <div className="rep-row">
              <div className="rep-role">
                Agency
              </div>

              <div className="rep-name">
                <a
                  href={MANAGEMENT_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {title}
                </a>
              </div>
            </div>

            <div className="rep-row">
              <div className="rep-role">
                Email
              </div>

              <div className="rep-name">
                <a
                  href={`mailto:${content.contactEmail}`}
                >
                  {content.contactEmail}
                </a>
              </div>
            </div>

            <div className="rep-row">
              <div className="rep-role">
                Instagram
              </div>

              <div className="rep-name">
                <a
                  href={
                    MANAGEMENT_INSTAGRAM
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  @wannabemgmt
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
