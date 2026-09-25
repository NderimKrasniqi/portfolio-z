import {
  CARD_WIDTH_FACTORS,
  projectThreeSpherePoint,
  sphereUnits,
} from "./gallery-geometry";

export type CardSnapshot = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  width: number;
};

export type GridMetrics = {
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  targetW: number;
};

export type GridTarget = {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  targetW: number;
};

export const clamp = (
  value: number,
  min: number,
  max: number,
) => Math.max(min, Math.min(max, value));

export const smoother = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

function currentCardWidth(card: HTMLElement) {
  return Math.max(
    1,
    parseFloat(card.style.width) ||
      card.offsetWidth ||
      52,
  );
}

export function applyBaseCardSizing(
  cards: HTMLElement[],
  viewportWidth: number,
) {
  const baseCardWidth =
    Math.min(
      58,
      Math.max(44, viewportWidth * 0.0395),
    ) *
    (viewportWidth <= 800 ? 0.9 : 1);

  cards.forEach((card, index) => {
    card.style.width = `${
      (
        baseCardWidth *
        CARD_WIDTH_FACTORS[
          index % CARD_WIDTH_FACTORS.length
        ]
      ).toFixed(2)
    }px`;

    card.style.aspectRatio = "3 / 4";
  });
}

export function captureLiveSphereSnapshot(
  cards: HTMLElement[],
  rotation: number,
  width: number,
  height: number,
): CardSnapshot[] {
  const units = sphereUnits(cards.length);

  return cards.map((card, index) => {
    const target = projectThreeSpherePoint(
      units[index],
      rotation,
      width,
      height,
    );

    return {
      x: target.x,
      y: target.y,
      scale: target.scale,
      rotation: 0,
      zIndex: target.zIndex,
      width: currentCardWidth(card),
    };
  });
}

export function getGridMetrics(
  width: number,
  height: number,
  cardCount: number,
): GridMetrics {
  const mobile = width <= 800;

  const cols = mobile
    ? width < 470
      ? 3
      : 4
    : width < 1120
      ? 4
      : 5;

  return {
    cols,
    rows: Math.ceil(cardCount / cols),
    gapX: mobile
      ? Math.min(98, width * 0.225)
      : Math.min(155, width * 0.125),
    gapY: mobile
      ? Math.min(128, height * 0.155)
      : Math.min(176, height * 0.195),
    targetW: mobile
      ? Math.min(72, width * 0.145)
      : Math.min(98, width * 0.072),
  };
}

export function getGridTargets(
  cards: HTMLElement[],
  width: number,
  height: number,
): GridTarget[] {
  const {
    cols,
    rows,
    gapX,
    gapY,
    targetW,
  } = getGridMetrics(
    width,
    height,
    cards.length,
  );

  return cards.map((card, index) => {
    const row = Math.floor(index / cols);
    const first = row * cols;
    const countInRow = Math.min(
      cols,
      cards.length - first,
    );
    const column = index - first;

    return {
      x:
        (column - (countInRow - 1) / 2) *
        gapX,
      y:
        (row - (rows - 1) / 2) *
          gapY +
        (width <= 800 ? 4 : 10),
      scale: targetW / currentCardWidth(card),
      zIndex: 50 + index,
      targetW,
    };
  });
}

type Gsap = typeof import("gsap").gsap;

export function applyGridLayout(
  gsap: Gsap,
  cards: HTMLElement[],
  width: number,
  height: number,
) {
  const targets = getGridTargets(
    cards,
    width,
    height,
  );

  targets.forEach((target, index) => {
    const card = cards[index];

    card.style.width = `${target.targetW}px`;
    card.style.aspectRatio = "3 / 4";

    gsap.set(card, {
      x: target.x,
      y: target.y,
      scale: 1,
      rotation: 0,
      zIndex: target.zIndex,
    });
  });
}

export function runSphereToGridTransition({
  gsap,
  cards,
  assets,
  copy,
  count,
  sphereRotation,
  reduced,
  onComplete,
}: {
  gsap: Gsap;
  cards: HTMLElement[];
  assets: HTMLElement;
  copy: HTMLElement | null;
  count: HTMLElement | null;
  sphereRotation: number;
  reduced: boolean;
  onComplete: () => void;
}) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const snapshot = captureLiveSphereSnapshot(
    cards,
    sphereRotation,
    width,
    height,
  );

  const targets = getGridTargets(
    cards,
    width,
    height,
  );

  assets.classList.add("is-grid-transition");

  if (copy) {
    gsap.set(copy, { opacity: 0 });
  }

  if (count) {
    gsap.set(count, { opacity: 0 });
  }

  gsap.set(cards, {
    opacity: 1,
    visibility: "visible",
    xPercent: -50,
    yPercent: -50,
  });

  snapshot.forEach((target, index) => {
    gsap.set(cards[index], {
      x: target.x,
      y: target.y,
      scale: target.scale,
      rotation: target.rotation,
      zIndex: target.zIndex,
    });
  });

  if (reduced) {
    assets.classList.remove("is-grid-transition");

    applyGridLayout(
      gsap,
      cards,
      width,
      height,
    );

    onComplete();

    return {
      snapshot,
      timeline: null,
    };
  }

  const timeline = gsap.timeline({
    defaults: {
      duration: 1.16,
      ease: "power3.inOut",
      overwrite: true,
    },
    onComplete: () => {
      assets.classList.remove(
        "is-grid-transition",
      );

      applyGridLayout(
        gsap,
        cards,
        window.innerWidth,
        window.innerHeight,
      );

      onComplete();
    },
  });

  targets.forEach((target, index) => {
    timeline.to(
      cards[index],
      {
        x: target.x,
        y: target.y,
        scale: target.scale,
        rotation: 0,
      },
      0,
    );
  });

  return {
    snapshot,
    timeline,
  };
}

export function runGridToSphereTransition({
  gsap,
  cards,
  assets,
  copy,
  count,
  snapshot,
  reduced,
  onComplete,
}: {
  gsap: Gsap;
  cards: HTMLElement[];
  assets: HTMLElement;
  copy: HTMLElement | null;
  count: HTMLElement | null;
  snapshot: CardSnapshot[];
  reduced: boolean;
  onComplete: () => void;
}) {
  const { targetW } = getGridMetrics(
    window.innerWidth,
    window.innerHeight,
    cards.length,
  );

  if (copy) {
    gsap.set(copy, { opacity: 0 });
  }

  if (count) {
    gsap.set(count, { opacity: 0 });
  }

  assets.classList.remove(
    "is-grid-transition",
  );

  snapshot.forEach((target, index) => {
    const card = cards[index];

    card.style.width = `${target.width}px`;
    card.style.aspectRatio = "3 / 4";

    gsap.set(card, {
      xPercent: -50,
      yPercent: -50,
      scale: targetW / target.width,
      opacity: 1,
      visibility: "visible",
    });
  });

  const applySphereTarget = () => {
    snapshot.forEach((target, index) => {
      const card = cards[index];

      card.style.width = `${target.width}px`;
      card.style.aspectRatio = "3 / 4";

      gsap.set(card, {
        x: target.x,
        y: target.y,
        scale: target.scale,
        rotation: target.rotation,
        zIndex: target.zIndex,
      });
    });
  };

  if (reduced) {
    applySphereTarget();
    onComplete();
    return null;
  }

  const timeline = gsap.timeline({
    defaults: {
      duration: 1.18,
      ease: "power3.inOut",
      overwrite: true,
    },
    onComplete: () => {
      applySphereTarget();
      onComplete();
    },
  });

  snapshot.forEach((target, index) => {
    timeline.to(
      cards[index],
      {
        x: target.x,
        y: target.y,
        scale: target.scale,
        rotation: target.rotation,
      },
      0,
    );
  });

  return timeline;
}
