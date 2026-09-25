"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export function runHomeLoaderTransition({
  active,
  preview,
  stage,
  loader,
  media,
  front,
  onDone,
}: {
  active: boolean;
  preview: boolean;
  stage: HTMLElement | null;
  loader: HTMLDivElement | null;
  media: HTMLDivElement | null;
  front: HTMLDivElement | null;
  onDone: () => void;
}) {
  if (
    !active ||
    preview ||
    !loader ||
    !stage ||
    sessionStorage.getItem(
      "zeudi-loader-seen",
    ) ||
    prefersReducedMotion()
  ) {
    if (active && stage) {
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
          ) * 0.72;

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
                ) * 0.72,
              ease: "none",
            },
            start,
          );
      });

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
            duration: 0.26,
            ease: "power1.inOut",
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
          0.04,
        )
        .to(
          media,
          {
            opacity: 1,
            duration: 0.62,
            ease: "power2.out",
          },
          0.1,
        )
        .to(
          introUi,
          {
            opacity: 1,
            duration: 0.46,
            stagger: 0.045,
            ease: "power2.out",
          },
          0.16,
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
