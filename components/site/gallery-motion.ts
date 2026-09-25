import {
  CARD_WIDTH_FACTORS,
  projectSpherePoint,
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


export function captureCardSnapshot(
  gsap: Gsap,
  cards: HTMLElement[],
): CardSnapshot[] {
  return cards.map((card) => ({
    x:
      Number(gsap.getProperty(card, "x")) ||
      0,
    y:
      Number(gsap.getProperty(card, "y")) ||
      0,
    scale:
      Number(gsap.getProperty(card, "scaleX")) ||
      1,
    rotation:
      Number(gsap.getProperty(card, "rotation")) ||
      0,
    zIndex:
      Number.parseInt(card.style.zIndex, 10) ||
      1,
    width: currentCardWidth(card),
  }));
}

export function runGalleryIntroTransition({
  gsap,
  cards,
  assets,
  panel,
  copy,
  count,
  reduced,
  onComplete,
}: {
  gsap: Gsap;
  cards: HTMLElement[];
  assets: HTMLElement;
  panel: HTMLElement | null;
  copy: HTMLElement | null;
  count: HTMLElement | null;
  reduced: boolean;
  onComplete: (result: {
    handoffRotation: number;
    snapshot: CardSnapshot[] | null;
  }) => void;
}) {
  if (panel) {
    gsap.set(panel, {
      opacity: 0,
      visibility: "visible",
    });
  }

  if (copy) {
    gsap.set(copy, { opacity: 0 });
  }

  const mediaReady = { value: false };

  void Promise.all(
    cards.map((card) => {
      const image =
        card.querySelector<HTMLImageElement>("img");

      if (!image || image.complete) {
        return (
          image
            ?.decode?.()
            .catch(() => undefined) ??
          Promise.resolve()
        );
      }

      return new Promise<void>((resolve) => {
        const done = () => resolve();

        image.addEventListener(
          "load",
          done,
          { once: true },
        );

        image.addEventListener(
          "error",
          done,
          { once: true },
        );
      });
    }),
  ).then(() => {
    mediaReady.value = true;
  });

  const width = window.innerWidth;
  const height = window.innerHeight;
  const mobile = width <= 800;

  const rx = mobile
    ? Math.min(
        150,
        width * 0.335,
        height * 0.19,
      )
    : Math.min(width * 0.19, 260);

  const ry = mobile
    ? rx
    : Math.min(height * 0.3, 258);

  const units = sphereUnits(cards.length);

  const targetAt = (
    index: number,
    yRotation: number,
  ) =>
    projectSpherePoint(
      units[index],
      yRotation,
      width,
      height,
    );

  const baseAngles = cards.map(
    (_, index) =>
      -Math.PI * 0.51 +
      (index / cards.length) *
        Math.PI *
        2,
  );

  const order = [...cards.keys()].sort(
    (a, b) =>
      baseAngles[a] - baseAngles[b],
  );

  const rank = new Map(
    order.map((index, position) => [
      index,
      position,
    ]),
  );

  const state = { progress: 0 };

  const flowStart = 0.36;
  const flowDuration = 7.35;
  const revealEnd = 0.385;
  const collapseStart = 0.405;
  const stackLock = 0.735;
  const burstStart = 0.815;

  const heroIndex = Math.min(
    6,
    cards.length - 1,
  );

  const introRadial = [
    0.94,
    1.04,
    0.9,
    1.02,
    0.97,
    1.08,
    0.92,
    1,
    1.05,
    0.91,
    1.01,
    0.96,
  ];

  const angularVelocityAt = (
    value: number,
  ) => {
    const revealSpeed = 0.085;
    const collapseSpeed = 4.15;
    const deckSpeed = 1.15;

    const first = smoother(
      (value - 0.315) / 0.355,
    );

    const second = smoother(
      (value - 0.69) / 0.145,
    );

    const third = smoother(
      (value - 0.825) / 0.175,
    );

    let speed =
      revealSpeed +
      (collapseSpeed - revealSpeed) *
        first;

    speed +=
      (deckSpeed - collapseSpeed) *
      second;

    speed +=
      (0.13 - deckSpeed) *
      third;

    return speed;
  };

  const angleSteps = 1200;

  const angleLut = new Float64Array(
    angleSteps + 1,
  );

  for (
    let index = 1;
    index <= angleSteps;
    index += 1
  ) {
    const previous =
      (index - 1) / angleSteps;

    const current =
      index / angleSteps;

    angleLut[index] =
      angleLut[index - 1] +
      ((angularVelocityAt(previous) +
        angularVelocityAt(current)) *
        0.5) *
        (flowDuration / angleSteps);
  }

  const angleAt = (value: number) => {
    const position =
      clamp(value, 0, 1) *
      angleSteps;

    const index = Math.min(
      angleSteps - 1,
      Math.floor(position),
    );

    const fraction =
      position - index;

    return (
      angleLut[index] +
      (angleLut[index + 1] -
        angleLut[index]) *
        fraction
    );
  };

  const renderFlow = () => {
    const progress = clamp(
      state.progress,
      0,
      1,
    );

    const sharedAngle =
      angleAt(progress);

    const collapse = smoother(
      (progress - collapseStart) /
        (stackLock - collapseStart),
    );

    const orbitRadius = 1 - collapse;

    const holdPhase = clamp(
      (progress - stackLock) /
        (burstStart - stackLock),
      0,
      1,
    );

    const holdEnvelope =
      collapse *
      (1 -
        smoother(
          (progress - burstStart) /
            0.055,
        ));

    const compression =
      Math.sin(holdPhase * Math.PI) *
      0.045 *
      holdEnvelope;

    const sphereEase = smoother(
      (progress - burstStart) /
        (1 - burstStart),
    );

    const sphereSpread =
      sphereEase +
      Math.sin(sphereEase * Math.PI) *
        0.075;

    cards.forEach((card, index) => {
      const cardRank =
        rank.get(index) ?? index;

      const revealSpan =
        revealEnd * 0.91;

      const revealStart =
        cards.length <= 1
          ? 0
          : (cardRank /
              (cards.length - 1)) *
            revealSpan;

      const appear = mediaReady.value
        ? smoother(
            (progress - revealStart) /
              0.092,
          )
        : 0;

      const angle =
        baseAngles[index] +
        sharedAngle;

      const radial =
        introRadial[
          index % introRadial.length
        ];

      const ringX =
        Math.cos(angle) *
        rx *
        radial *
        orbitRadius;

      const ringY =
        Math.sin(angle) *
        ry *
        radial *
        orbitRadius;

      const stableX =
        cardRank === 0
          ? 0
          : ((cardRank % 5) - 2) *
            0.42;

      const stableY =
        cardRank === 0
          ? 0
          : Math.min(cardRank, 12) *
            0.21;

      const stableTwist =
        cardRank === 0
          ? 0
          : (cardRank % 2 ? 1 : -1) *
            (0.28 +
              Math.min(cardRank, 10) *
                0.028);

      const deckAngle =
        sharedAngle * 0.34;

      const cosDeck =
        Math.cos(deckAngle);

      const sinDeck =
        Math.sin(deckAngle);

      const deckX =
        (stableX * cosDeck -
          stableY * sinDeck) *
        collapse;

      const deckY =
        (stableX * sinDeck +
          stableY * cosDeck) *
        collapse;

      const deckDrift =
        cardRank === 0
          ? 0
          : (0.2 +
              Math.min(cardRank, 10) *
                0.012) *
            holdEnvelope;

      const driftX =
        Math.cos(
          sharedAngle +
            cardRank * 0.57,
        ) * deckDrift;

      const driftY =
        Math.sin(
          sharedAngle * 0.94 +
            cardRank * 0.43,
        ) * deckDrift;

      const squeeze =
        1 - compression;

      const stackX =
        (deckX + driftX) *
        squeeze *
        (1 - sphereEase);

      const stackY =
        (deckY + driftY) *
        squeeze *
        (1 - sphereEase);

      const stackTwist =
        (stableTwist * collapse +
          Math.sin(
            sharedAngle +
              cardRank * 0.31,
          ) *
            0.26 *
            holdEnvelope) *
        (1 - sphereEase);

      const target = targetAt(
        index,
        sharedAngle,
      );

      const baseScale =
        0.88 + 0.12 * appear;

      const deckScale =
        1 +
        collapse *
          (cardRank === 0
            ? 0.043
            : 0.017) -
        compression * 0.34;

      const burstPulse =
        1 +
        Math.sin(
          sphereEase * Math.PI,
        ) *
          0.028;

      const scale =
        baseScale * deckScale +
        (target.scale *
          burstPulse -
          baseScale * deckScale) *
          sphereEase;

      const orbitDepth =
        20 +
        Math.round(
          ((Math.sin(angle) + 1) /
            2) *
            30,
        );

      const zIndex =
        sphereEase < 0.075
          ? collapse > 0.76
            ? index === heroIndex
              ? 1000
              : 700 - cardRank
            : orbitDepth
          : target.zIndex;

      gsap.set(card, {
        xPercent: -50,
        yPercent: -50,
        x:
          ringX +
          stackX +
          target.x * sphereSpread,
        y:
          ringY +
          stackY +
          target.y * sphereSpread,
        scale,
        rotation:
          Math.cos(angle) *
            1.7 *
            orbitRadius *
            (1 - sphereEase) +
          stackTwist,
        opacity: appear,
        zIndex,
        visibility: "visible",
      });
    });
  };

  if (reduced) {
    state.progress = 1;
    mediaReady.value = true;

    renderFlow();

    if (panel) {
      gsap.set(panel, { opacity: 1 });
    }

    if (copy) {
      gsap.set(copy, { opacity: 0 });
    }

    if (count) {
      gsap.set(count, { opacity: 0 });
    }

    onComplete({
      handoffRotation: angleAt(1),
      snapshot: null,
    });

    return null;
  }

  if (copy) {
    gsap.set(copy, {
      opacity: 0,
      scale: 0.96,
      y: 2,
    });
  }

  if (count) {
    gsap.set(count, { opacity: 0 });
  }

  if (panel) {
    gsap.set(panel, {
      opacity: 0,
      visibility: "visible",
    });
  }

  cards.forEach((card) => {
    gsap.set(card, {
      xPercent: -50,
      yPercent: -50,
      x: 0,
      y: 0,
      scale: 0.14,
      rotation: 0,
      opacity: 0,
      visibility: "visible",
    });
  });

  const timeline = gsap.timeline({
    defaults: {
      overwrite: "auto",
    },
    onUpdate: renderFlow,
    onComplete: () => {
      if (panel) {
        gsap.set(panel, {
          opacity: 1,
        });
      }

      if (copy) {
        gsap.set(copy, {
          opacity: 0,
        });
      }

      if (count) {
        gsap.set(count, {
          opacity: 0,
        });
      }

      assets.classList.add(
        "is-sphere",
      );

      onComplete({
        handoffRotation: angleAt(1),
        snapshot: captureCardSnapshot(
          gsap,
          cards,
        ),
      });
    },
  });

  if (panel) {
    timeline.to(
      panel,
      {
        opacity: 1,
        duration: 0.42,
        ease: "power2.out",
      },
      0,
    );
  }

  if (copy) {
    timeline.to(
      copy,
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.48,
        ease: "power3.out",
      },
      0.14,
    );
  }

  timeline.to(
    state,
    {
      progress: 1,
      duration: flowDuration,
      ease: "none",
    },
    flowStart,
  );

  if (copy) {
    timeline.to(
      copy,
      {
        opacity: 0,
        scale: 0.987,
        duration: 0.52,
        ease: "sine.inOut",
      },
      flowStart + 2.56,
    );
  }

  return timeline;
}
