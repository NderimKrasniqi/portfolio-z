"use client";

import type { Content } from "@/lib/model";
import { mediaUrl } from "./media";
import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export type HomeMediaGeometry = {
  width: number;
  height: number;
  top: number;
};

type MediaItem = Content["media"][number];
type Gsap = NonNullable<
  Awaited<ReturnType<typeof loadGsap>>
>;

async function waitForFirstPaint(
  front: HTMLDivElement,
) {
  const visual =
    front.querySelector<
      HTMLImageElement | HTMLVideoElement
    >("img,video");

  if (!visual) return;

  if (visual instanceof HTMLImageElement) {
    if (!visual.complete) {
      await new Promise<void>((resolve) => {
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
      });
    }

    try {
      await visual.decode?.();
    } catch {}

    return;
  }

  if (visual.readyState < 2) {
    await new Promise<void>((resolve) => {
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
    });
  }
}

function makeHeroFlight({
  gsap,
  item,
  source,
  preview,
  measure,
}: {
  gsap: Gsap;
  item: MediaItem;
  source: HTMLButtonElement | null;
  preview: boolean;
  measure: (
    item: MediaItem,
  ) => HomeMediaGeometry | null;
}) {
  if (!source) return null;

  const sourceRect =
    source.getBoundingClientRect();

  if (
    sourceRect.width < 1 ||
    sourceRect.height < 1
  ) {
    return null;
  }

  const flight =
    document.createElement("div");

  flight.className =
    `hero-flight${
      item.kind === "video"
        ? " is-video"
        : ""
    }`;

  const visual =
    item.kind === "video"
      ? document.createElement("video")
      : document.createElement("img");

  visual.setAttribute(
    "aria-hidden",
    "true",
  );
  visual.draggable = false;

  if (item.kind === "video") {
    const video =
      visual as HTMLVideoElement;

    video.src = mediaUrl(
      item.key,
      preview,
    );
    video.poster = mediaUrl(
      item.thumbKey,
      preview,
    );
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
  } else {
    const image =
      visual as HTMLImageElement;

    image.decoding = "async";
    image.src = mediaUrl(
      item.key,
      preview,
    );
    image.alt = "";
  }

  flight.appendChild(visual);

  (
    document.querySelector<HTMLElement>(
      ".portfolio",
    ) || document.body
  ).appendChild(flight);

  const destination = measure(item);

  if (!destination) {
    flight.remove();
    return null;
  }

  const destinationRect = {
    left:
      (window.innerWidth -
        destination.width) /
      2,
    top:
      destination.top -
      destination.height / 2,
    width: destination.width,
    height: destination.height,
  };

  gsap.set(flight, {
    left: sourceRect.left,
    top: sourceRect.top,
    width: sourceRect.width,
    height: sourceRect.height,
    opacity: 0,
  });

  const ready = (async () => {
    if (
      visual instanceof
      HTMLImageElement
    ) {
      if (
        !visual.complete ||
        visual.naturalWidth < 1
      ) {
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
      } catch {}

      return visual.naturalWidth > 0;
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
          visual.load();
        },
      );
    }

    try {
      await visual.play();
    } catch {}

    return (
      visual.readyState >= 2 ||
      Boolean(visual.poster)
    );
  })();

  return {
    flight,
    destinationRect,
    ready,
  };
}

export function runHomeHeroTransition({
  front,
  back,
  flightSource,
  currentItem,
  previousItem,
  previousIndex,
  preview,
  measure,
  onGeometry,
  onUnlock,
  onFinish,
}: {
  front: HTMLDivElement | null;
  back: HTMLDivElement | null;
  flightSource: HTMLButtonElement | null;
  currentItem: MediaItem;
  previousItem: MediaItem | null;
  previousIndex: number | null;
  preview: boolean;
  measure: (
    item: MediaItem,
  ) => HomeMediaGeometry | null;
  onGeometry: (
    geometry: HomeMediaGeometry,
  ) => void;
  onUnlock: () => void;
  onFinish: () => void;
}) {
  if (!front) return () => {};

  let cancelled = false;

  void loadGsap().then(async (gsap) => {
    if (cancelled || !gsap) return;

    gsap.killTweensOf(
      [front, back].filter(Boolean),
    );

    if (prefersReducedMotion()) {
      gsap.set(front, {
        opacity: 1,
        scale: 1,
      });

      if (back) {
        gsap.set(back, {
          opacity: 0,
          scale: 1,
        });
      }

      const geometry =
        measure(currentItem);

      if (geometry) {
        onGeometry(geometry);
      }

      if (previousIndex !== null) {
        onFinish();
      }

      return;
    }

    if (!back || previousItem === null) {
      gsap.fromTo(
        front,
        {
          opacity: 0.25,
          scale: 0.96,
        },
        {
          opacity: 1,
          scale: 1,
          duration: 0.65,
          ease: "power3.out",
          onComplete: onUnlock,
        },
      );

      return;
    }

    gsap.set(back, {
      opacity: 1,
      scale: 1,
    });

    gsap.set(front, {
      opacity: 0,
      scale: 1.025,
    });

    await waitForFirstPaint(front);

    if (cancelled) return;

    const nextGeometry =
      measure(currentItem);

    const flight = makeHeroFlight({
      gsap,
      item: currentItem,
      source: flightSource,
      preview,
      measure,
    });

    if (flight) {
      const ready = await flight.ready;

      if (cancelled) {
        flight.flight.remove();
        return;
      }

      if (ready && nextGeometry) {
        await new Promise<void>(
          (resolve) => {
            gsap
              .timeline({
                onComplete: resolve,
                defaults: {
                  overwrite: "auto",
                },
              })
              .to(
                flight.flight,
                {
                  opacity: 1,
                  duration: 0.12,
                  ease: "power2.out",
                },
                0,
              )
              .to(
                flight.flight,
                {
                  ...flight.destinationRect,
                  duration: 0.64,
                  ease: "power4.inOut",
                },
                0.04,
              )
              .to(
                back,
                {
                  opacity: 0,
                  scale: 0.985,
                  duration: 0.2,
                  ease: "power1.inOut",
                },
                0.44,
              );
          },
        );

        onGeometry(nextGeometry);

        gsap.set(front, {
          opacity: 1,
          scale: 1,
        });

        await new Promise<void>(
          (resolve) =>
            gsap.to(
              flight.flight,
              {
                opacity: 0,
                duration: 0.1,
                ease: "power1.out",
                onComplete: resolve,
              },
            ),
        );

        flight.flight.remove();
        onFinish();
        return;
      }

      flight.flight.remove();
    }

    gsap
      .timeline({
        onComplete: onFinish,
      })
      .to(
        back,
        {
          opacity: 0,
          scale: 0.985,
          duration: 0.2,
          ease: "power1.inOut",
        },
        0,
      )
      .add(() => {
        if (nextGeometry) {
          onGeometry(nextGeometry);
        }
      }, 0.2)
      .to(
        front,
        {
          opacity: 1,
          scale: 1,
          duration: 0.32,
          ease: "power1.inOut",
        },
        0.2,
      );
  });

  return () => {
    cancelled = true;

    void loadGsap().then((gsap) =>
      gsap?.killTweensOf(
        [front, back].filter(Boolean),
      ),
    );
  };
}
