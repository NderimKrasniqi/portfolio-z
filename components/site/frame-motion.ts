"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export function runFrameExitTransition(
  onComplete: () => void,
) {
  if (prefersReducedMotion()) {
    onComplete();
    return;
  }

  const root =
    document.querySelector<HTMLElement>(
      ".portfolio",
    );

  const panel =
    root?.querySelector<HTMLElement>(
      ".gallery-panel.open, .about-panel.open, .shop-panel.open, .contact-panel.open",
    );

  const stage =
    root?.querySelector<HTMLElement>(
      ".stage",
    );

  const target = panel || stage;

  if (!target) {
    onComplete();
    return;
  }

  void loadGsap()
    .then((gsap) => {
      if (!gsap) {
        onComplete();
        return;
      }

      gsap.killTweensOf(target);

      const timeline = gsap.timeline({
        onComplete,
      });

      if (
        panel?.classList.contains(
          "about-panel",
        )
      ) {
        timeline.to(target, {
          clipPath:
            "inset(0 100% 0 0)",
          duration: 0.58,
          ease: "power4.inOut",
        });
      } else if (
        panel?.classList.contains(
          "contact-panel",
        )
      ) {
        timeline.to(target, {
          clipPath:
            "inset(100% 0 0 0)",
          duration: 0.56,
          ease: "power4.inOut",
        });
      } else if (
        panel?.classList.contains(
          "shop-panel",
        )
      ) {
        timeline.to(target, {
          clipPath:
            "inset(0 0 0 100%)",
          duration: 0.56,
          ease: "power4.inOut",
        });
      } else {
        timeline.to(target, {
          opacity: 0,
          duration: 0.36,
          ease: "power2.inOut",
        });
      }
    })
    .catch(onComplete);
}

export function runFrameEnterTransition() {
  const root =
    document.querySelector<HTMLElement>(
      ".portfolio",
    );

  if (
    !root ||
    prefersReducedMotion()
  ) {
    return () => {};
  }

  root.classList.add("motion-gsap");

  const panel =
    root.querySelector<HTMLElement>(
      ".gallery-panel.open, .about-panel.open, .shop-panel.open, .contact-panel.open",
    );

  const stage =
    root.querySelector<HTMLElement>(
      ".stage",
    );

  const target = panel || stage;

  if (!target) {
    return () => {};
  }

  if (
    panel?.classList.contains(
      "gallery-panel",
    )
  ) {
    return () => {};
  }

  let cancelled = false;

  void loadGsap().then((gsap) => {
    if (cancelled || !gsap) return;

    gsap.killTweensOf(target);

    if (
      panel?.classList.contains(
        "about-panel",
      )
    ) {
      gsap.set(panel, {
        clipPath:
          "inset(0 100% 0 0)",
      });

      const close =
        panel.querySelector<HTMLElement>(
          ".about-close",
        );

      const portrait =
        panel.querySelector<HTMLElement>(
          ".about-portrait",
        );

      const intro = [
        ...panel.querySelectorAll<HTMLElement>(
          ".about-eyebrow,.about-copy h2,.about-lead,.about-location,.about-scroll-hint",
        ),
      ];

      const pieces = [
        ...intro,
        close,
        portrait,
      ].filter(
        (
          piece,
        ): piece is HTMLElement =>
          Boolean(piece),
      );

      gsap.set(pieces, {
        opacity: 0,
      });

      gsap.set(intro, {
        y: 14,
      });

      const enter = gsap.timeline({
        defaults: {
          overwrite: "auto",
        },
      });

      enter
        .to(
          panel,
          {
            clipPath:
              "inset(0 0% 0 0)",
            duration: 0.72,
            ease: "power4.inOut",
          },
          0,
        )
        .to(
          close,
          {
            opacity: 1,
            duration: 0.22,
            ease: "power3.out",
          },
          0.58,
        )
        .to(
          portrait,
          {
            opacity: 1,
            duration: 0.46,
            ease: "power2.out",
          },
          0.58,
        )
        .to(
          intro,
          {
            opacity: 1,
            y: 0,
            duration: 0.46,
            stagger: 0.035,
            ease: "power3.out",
          },
          0.62,
        )
        .add(() => {
          gsap.set(intro, {
            clearProps:
              "opacity,transform",
          });
        }, ">");
    } else if (
      panel?.classList.contains(
        "contact-panel",
      )
    ) {
      gsap.set(panel, {
        clipPath:
          "inset(100% 0 0 0)",
      });

      gsap.to(panel, {
        clipPath:
          "inset(0% 0 0 0)",
        duration: 0.64,
        ease: "power4.inOut",
      });
    } else if (
      panel?.classList.contains(
        "shop-panel",
      )
    ) {
      gsap.set(panel, {
        clipPath:
          "inset(0 0 0 100%)",
      });

      gsap.to(panel, {
        clipPath: "inset(0)",
        duration: 0.72,
        ease: "power4.inOut",
      });
    } else if (
      !root.querySelector(
        ".reference-loader",
      )
    ) {
      gsap.fromTo(
        stage,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.58,
          ease: "power2.out",
        },
      );
    } else {
      gsap.set(stage, {
        opacity: 1,
        visibility: "visible",
      });
    }
  });

  return () => {
    cancelled = true;

    void loadGsap().then((gsap) =>
      gsap?.killTweensOf(target),
    );
  };
}
