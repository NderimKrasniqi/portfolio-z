"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

/*
 * Preloader: a cream page, the signature drawn stroke by stroke, then a
 * slow fade-out. The signature's 9 strokes take about 2.6s at this speed.
 */
const DRAW_SPEED = 0.55;
const STROKE_SCALE = 1.45;

export function runHomeLoaderTransition({
  preview,
  stage,
  loader,
  media,
  front,
  onDone,
}: {
  preview: boolean;
  stage: HTMLElement | null;
  loader: HTMLDivElement | null;
  media: HTMLDivElement | null;
  front: HTMLDivElement | null;
  onDone: () => void;
}) {
  if (
    preview ||
    !loader ||
    !stage ||
    sessionStorage.getItem(
      "zeudi-loader-seen",
    ) ||
    prefersReducedMotion()
  ) {
    if (stage) {
      stage.style.visibility = "visible";
      stage.style.opacity = "1";
    }

    queueMicrotask(onDone);

    return () => {};
  }

  let cancelled = false;

  const paths = [
    ...loader.querySelectorAll<SVGPathElement>(
      "path",
    ),
  ];

  const visual =
    front?.querySelector<
      HTMLImageElement | HTMLVideoElement
    >("img,video");

  const mediaReady = (async () => {
    if (!visual) return;

    if (
      visual instanceof HTMLImageElement
    ) {
      if (!visual.complete) {
        await new Promise<void>(
          (resolve) => {
            visual.addEventListener(
              "load",
              () => resolve(),
              { once: true },
            );

            visual.addEventListener(
              "error",
              () => resolve(),
              { once: true },
            );
          },
        );
      }

      try {
        await visual.decode?.();
      } catch {
        // Already painted is good enough.
      }

      return;
    }

    if (visual.readyState < 2) {
      await new Promise<void>(
        (resolve) => {
          visual.addEventListener(
            "loadeddata",
            () => resolve(),
            { once: true },
          );

          visual.addEventListener(
            "error",
            () => resolve(),
            { once: true },
          );
        },
      );
    }
  })();

  const finishWithoutGsap =
    async () => {
      await mediaReady;

      if (cancelled) return;

      stage.style.visibility = "visible";
      stage.style.opacity = "1";

      if (media) {
        media.style.visibility = "visible";
      }

      sessionStorage.setItem(
        "zeudi-loader-seen",
        "1",
      );

      onDone();
    };

  void loadGsap()
    .then(async (gsap) => {
      if (cancelled) return;

      if (!gsap) {
        await finishWithoutGsap();
        return;
      }

      const introUi = [
        ...stage.querySelectorAll<HTMLElement>(
          ".identity,.desktop-main-nav,.mobile-menu-toggle,.meta,.socials,.browse,.filmstrip",
        ),
      ];

      gsap.killTweensOf(
        [
          stage,
          loader,
          media,
          ...introUi,
          ...paths,
        ].filter(Boolean),
      );

      gsap.set(stage, {
        visibility: "visible",
        opacity: 1,
      });

      gsap.set(introUi, {
        opacity: 0,
      });

      gsap.set(media, {
        visibility: "hidden",
        opacity: 0,
      });

      paths.forEach((path) => {
        const length =
          path.getTotalLength();

        gsap.set(path, {
          opacity: 0,
          strokeDasharray:
            `${length} ${length + 24}`,
          strokeDashoffset:
            length + 12,
          strokeLinecap: "round",
          // the signature is shown small, so its strokes are thickened
          // to keep the bold pen weight of the reference
          strokeWidth:
            Number(path.getAttribute("stroke-width") || 26) * STROKE_SCALE,
        });
      });

      const write = gsap.timeline({
        delay: 0.26,
      });

      write.set(
        loader.querySelector(
          ".loader__signature-wrap",
        ),
        { autoAlpha: 1 },
        0,
      );

      paths.forEach((path) => {
        const start =
          Number(
            path.dataset.delay || 0,
          ) * DRAW_SPEED;

        write
          .set(
            path,
            { opacity: 1 },
            start,
          )
          .to(
            path,
            {
              strokeDashoffset: 0,
              duration:
                Number(
                  path.dataset.duration ||
                    0.5,
                ) * DRAW_SPEED,
              ease: "none",
            },
            start,
          );
      });

      // Like the reference: the finished signature rests for a moment.
      write.to({}, { duration: 0.45 });

      await new Promise<void>(
        (resolve) =>
          write.eventCallback(
            "onComplete",
            resolve,
          ),
      );

      await mediaReady;

      if (cancelled) return;

      gsap.set(media, {
        visibility: "visible",
        opacity: 0,
      });

      const reveal = gsap.timeline({
        defaults: {
          overwrite: "auto",
        },
      });

      reveal
        .to(
          loader.querySelector(
            ".loader__signature",
          ),
          {
            opacity: 0,
            duration: 0.6,
            ease: "power2.inOut",
          },
          0,
        )
        .to(
          loader,
          {
            opacity: 0,
            duration: 0.58,
            ease: "power2.inOut",
          },
          // the cream page leaves only once the signature has faded
          0.55,
        )
        .to(
          media,
          {
            opacity: 1,
            duration: 0.62,
            ease: "power2.out",
          },
          0.6,
        )
        .to(
          introUi,
          {
            opacity: 1,
            duration: 0.46,
            stagger: 0.045,
            ease: "power2.out",
          },
          0.66,
        );

      await new Promise<void>(
        (resolve) =>
          reveal.eventCallback(
            "onComplete",
            resolve,
          ),
      );

      if (cancelled) return;

      gsap.set(introUi, {
        clearProps: "opacity",
      });

      gsap.set(media, {
        clearProps: "opacity",
      });

      sessionStorage.setItem(
        "zeudi-loader-seen",
        "1",
      );

      onDone();
    })
    .catch(() => {
      void finishWithoutGsap();
    });

  return () => {
    cancelled = true;

    void loadGsap().then((gsap) =>
      gsap?.killTweensOf(
        [
          stage,
          loader,
          media,
          ...paths,
        ].filter(Boolean),
      ),
    );
  };
}
