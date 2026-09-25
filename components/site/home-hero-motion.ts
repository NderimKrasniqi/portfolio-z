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
  onMeta,
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
  onMeta: () => void;
  onUnlock: () => void;
  onFinish: () => void;
}) {
  if (!front) return () => {};

  let cancelled = false;
  let metaTimer: {
    kill: () => void;
  } | null = null;

  void loadGsap().then(async (gsap) => {
    if (cancelled || !gsap) return;

    gsap.killTweensOf(
      [front, back].filter(Boolean),
    );

    // The original HTML lets the loader own the first hero reveal.
    // Do not run a second scale/fade animation underneath it.
    if (
      previousIndex === null ||
      !back ||
      previousItem === null
    ) {
      gsap.set(front, {
        opacity: 1,
        scale: 1,
      });

      onUnlock();
      return;
    }

    const nextGeometry =
      measure(currentItem);

    if (prefersReducedMotion()) {
      if (nextGeometry) {
        onGeometry(nextGeometry);
      }

      gsap.set(back, {
        opacity: 0,
        scale: 1,
      });

      gsap.set(front, {
        opacity: 1,
        scale: 1,
      });

      onMeta();
      onFinish();
      return;
    }

    gsap.set(back, {
      opacity: 1,
      scale: 1,
      zIndex: 3,
    });

    gsap.set(front, {
      opacity: 0,
      scale: 1,
      zIndex: 4,
    });

    const frontReady =
      waitForFirstPaint(front);

    const flight = makeHeroFlight({
      gsap,
      item: currentItem,
      source: flightSource,
      preview,
      measure,
    });

    if (flight) {
      // Match the HTML:
      // - full-resolution flight prepares independently
      // - old hero starts fading immediately
      // - counter begins at 240ms
      // - destination and flight must both be ready before handoff
      const flightDone = (async () => {
        const ready =
          await flight.ready;

        if (
          cancelled ||
          !ready
        ) {
          return false;
        }

        gsap.set(
          flight.flight,
          { opacity: 1 },
        );

        await new Promise<void>(
          (resolve) =>
            gsap.to(
              flight.flight,
              {
                ...flight.destinationRect,
                duration: 0.64,
                ease: "power4.inOut",
                overwrite: false,
                onComplete: resolve,
              },
            ),
        );

        return true;
      })();

      gsap.to(back, {
        opacity: 0,
        duration: 0.20,
        ease: "power1.inOut",
        overwrite: "auto",
      });

      metaTimer = gsap.delayedCall(
        0.24,
        () => {
          if (!cancelled) {
            onMeta();
          }
        },
      );

      const [, flightPlayed] =
        await Promise.all([
          frontReady,
          flightDone,
        ]);

      if (cancelled) {
        flight.flight.remove();
        return;
      }

      if (nextGeometry) {
        onGeometry(nextGeometry);
      }

      gsap.set(front, {
        opacity: 1,
        scale: 1,
      });

      if (flightPlayed) {
        await new Promise<void>(
          (resolve) =>
            gsap.to(
              flight.flight,
              {
                opacity: 0,
                duration: 0.10,
                ease: "power1.out",
                overwrite: "auto",
                onComplete: resolve,
              },
            ),
        );
      }

      flight.flight.remove();

      onFinish();
      return;
    }

    // Wheel, keyboard and browse navigation use the quieter
    // fade from the reference HTML.
    await frontReady;

    if (cancelled) return;

    await new Promise<void>(
      (resolve) =>
        gsap.to(back, {
          opacity: 0,
          duration: 0.20,
          ease: "power1.inOut",
          overwrite: "auto",
          onComplete: resolve,
        }),
    );

    if (cancelled) return;

    if (nextGeometry) {
      onGeometry(nextGeometry);
    }

    onMeta();

    await new Promise<void>(
      (resolve) =>
        gsap.to(front, {
          opacity: 1,
          scale: 1,
          duration: 0.32,
          ease: "power1.inOut",
          overwrite: "auto",
          onComplete: resolve,
        }),
    );

    if (!cancelled) {
      onFinish();
    }
  });

  return () => {
    cancelled = true;
    metaTimer?.kill();

    void loadGsap().then((gsap) =>
      gsap?.killTweensOf(
        [front, back].filter(Boolean),
      ),
    );
  };
}
