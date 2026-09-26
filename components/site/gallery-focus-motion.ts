"use client";

import {
  loadGsap,
  prefersReducedMotion,
} from "./motion";

export type FocusRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type FocusMedia =
  | HTMLImageElement
  | HTMLVideoElement;

function validRect(
  rect: FocusRect | DOMRect,
) {
  return (
    rect.width > 2 &&
    rect.height > 2
  );
}

async function waitForMedia(
  media: FocusMedia,
) {
  if (media instanceof HTMLImageElement) {
    if (media.complete) {
      try {
        await media.decode();
      } catch {
        // A painted image is still usable if decode rejects.
      }
      return;
    }

    await new Promise<void>((resolve) => {
      const done = () => resolve();

      media.addEventListener(
        "load",
        done,
        { once: true },
      );

      media.addEventListener(
        "error",
        done,
        { once: true },
      );
    });

    try {
      await media.decode();
    } catch {
      // Keep the loaded image.
    }

    return;
  }

  if (media.readyState >= 1) {
    return;
  }

  await new Promise<void>((resolve) => {
    const done = () => resolve();

    media.addEventListener(
      "loadedmetadata",
      done,
      { once: true },
    );

    media.addEventListener(
      "error",
      done,
      { once: true },
    );
  });
}

async function prepareGhost(
  ghost: HTMLImageElement,
  src: string,
) {
  ghost.src = src;

  try {
    await ghost.decode();
  } catch {
    // The source can still be painted if decode is unavailable/rejects.
  }
}

function positionGhost(
  ghost: HTMLImageElement,
  rect: FocusRect | DOMRect,
) {
  Object.assign(
    ghost.style,
    {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    },
  );
}

export async function runGalleryFocusOpen({
  sourceCard,
  sourceRect,
  ghost,
  ghostSrc,
  media,
  veil,
}: {
  sourceCard: HTMLElement | null;
  sourceRect: FocusRect;
  ghost: HTMLImageElement;
  ghostSrc: string;
  media: FocusMedia;
  veil: HTMLElement;
}) {
  await waitForMedia(media);

  const targetRect =
    media.getBoundingClientRect();

  const gsap =
    await loadGsap();

  if (
    !gsap ||
    prefersReducedMotion() ||
    !validRect(sourceRect) ||
    !validRect(targetRect) ||
    !ghostSrc
  ) {
    veil.style.opacity = "1";
    media.style.opacity = "1";
    return;
  }

  await prepareGhost(
    ghost,
    ghostSrc,
  );

  gsap.killTweensOf([
    ghost,
    veil,
    media,
  ]);

  positionGhost(
    ghost,
    sourceRect,
  );

  gsap.set(
    veil,
    { opacity: 0 },
  );

  gsap.set(
    media,
    { opacity: 0 },
  );

  gsap.set(
    ghost,
    { opacity: 1 },
  );

  if (sourceCard) {
    sourceCard.style.visibility =
      "hidden";
  }

  await new Promise<void>(
    (resolve) => {
      gsap
        .timeline({
          defaults: {
            overwrite: "auto",
          },
          onComplete: resolve,
        })
        .to(
          veil,
          {
            opacity: 1,
            duration: 0.46,
            ease: "power2.out",
          },
          0,
        )
        .to(
          ghost,
          {
            left: targetRect.left,
            top: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            duration: 0.72,
            ease: "power4.inOut",
          },
          0.02,
        )
        // Paint the real media fully underneath the still-opaque
        // morph layer first. Only then reveal it by fading the ghost.
        // This prevents the white veil showing through during handoff.
        .to(
          media,
          {
            opacity: 1,
            duration: 0.16,
            ease: "power1.out",
          },
          0.58,
        )
        .to(
          ghost,
          {
            opacity: 0,
            duration: 0.10,
            ease: "power1.out",
          },
          0.74,
        );
    },
  );
}

export async function runGalleryFocusClose({
  sourceCard,
  ghost,
  ghostSrc,
  media,
  veil,
}: {
  sourceCard: HTMLElement | null;
  ghost: HTMLImageElement;
  ghostSrc: string;
  media: FocusMedia;
  veil: HTMLElement;
}) {
  const currentRect =
    media.getBoundingClientRect();

  const destinationRect =
    sourceCard?.getBoundingClientRect();

  const gsap =
    await loadGsap();

  const cleanup = () => {
    if (sourceCard) {
      sourceCard.style.visibility =
        "visible";
    }

    ghost.style.opacity = "0";
    ghost.removeAttribute("src");

    media.style.opacity = "0";
    veil.style.opacity = "0";
  };

  if (
    !gsap ||
    prefersReducedMotion() ||
    !destinationRect ||
    !validRect(currentRect) ||
    !validRect(destinationRect) ||
    !ghostSrc
  ) {
    cleanup();
    return;
  }

  // The opening morph already decoded and retained this ghost.
  // Do not decode again on close: the reference begins closing
  // immediately on the interaction frame.
  if (
    ghost.getAttribute("src") !==
    ghostSrc
  ) {
    ghost.src = ghostSrc;
  }

  gsap.killTweensOf([
    ghost,
    veil,
    media,
  ]);

  positionGhost(
    ghost,
    currentRect,
  );

  const deltaX =
    destinationRect.left -
    currentRect.left;

  const deltaY =
    destinationRect.top -
    currentRect.top;

  const scaleX =
    destinationRect.width /
    currentRect.width;

  const scaleY =
    destinationRect.height /
    currentRect.height;

  gsap.set(
    ghost,
    {
      opacity: 1,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      transformOrigin: "0 0",
      force3D: true,
    },
  );

  gsap.set(
    media,
    { opacity: 0 },
  );

  await new Promise<void>(
    (resolve) => {
      gsap
        .timeline({
          defaults: {
            overwrite: "auto",
          },
          onComplete: () => {
            cleanup();
            resolve();
          },
        })
        // Closing uses compositor transforms instead of continuously
        // changing left/top/width/height. This avoids layout work on
        // every frame while preserving the same start/end geometry.
        .to(
          ghost,
          {
            left: destinationRect.left,
            top: destinationRect.top,
            width: destinationRect.width,
            height: destinationRect.height,
            duration: 0.62,
            ease: "power4.inOut",
          },
          0,
        )
        .to(
          veil,
          {
            opacity: 0,
            duration: 0.48,
            ease: "power2.inOut",
          },
          0.1,
        )
        // The ghost has now landed exactly on the sphere card.
        // Reveal the real card underneath BEFORE removing the ghost.
        // This avoids the final one-frame disappear/reappear hitch.
        .set(
          sourceCard,
          {
            visibility: "visible",
          },
          0.62,
        )
        .to(
          ghost,
          {
            opacity: 0,
            duration: 0.10,
            ease: "power1.out",
          },
          0.62,
        );
    },
  );
}
