/** Seconds from the first decoded circle frame, independent of display refresh rate. */
export const GALLERY_INTRO = {
  circleCount: 10,
  revealStart: 0.72,
  revealStagger: 0.2,
  revealDuration: 1.1,
  collapseAt: 3.7,
  collapseDuration: 1.97,
  collapseStagger: 0.05,
  stackHold: 0.59,
  explodeDuration: 1.36,
} as const;

export type GalleryPhase = "loading" | "circle" | "collapse" | "stack" | "explode" | "sphere";
export type GalleryPose = { x: number; y: number; width: number; height: number; opacity: number; order: number };

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const out = (n: number) => 1 - Math.pow(1 - clamp(n), 4);
const inOut = (n: number) => {
  const t = clamp(n);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const backOut = (n: number) => {
  const t = clamp(n) - 1;
  return 1 + 2.70158 * t * t * t + 1.70158 * t * t;
};

// Integrate the original page's gentle reveal, accelerating collapse, and slowing stack.
// A fixed table keeps the choreography identical at different display refresh rates.
const SPIN_STEPS = 1200;
const smoother = (value: number) => { const t = clamp(value); return t*t*t*(t*(t*6-15)+10); };
function spinSpeed(t: number) {
  let speed = .085 + (4.15 - .085) * smoother((t - .315) / .355);
  speed += (1.15 - 4.15) * smoother((t - .690) / .145);
  return speed + (.05 - 1.15) * smoother((t - .825) / .175);
}
const spinAngles = new Float64Array(SPIN_STEPS + 1);
for (let i = 1; i <= SPIN_STEPS; i++) {
  spinAngles[i] = spinAngles[i-1] + (spinSpeed((i-1)/SPIN_STEPS) + spinSpeed(i/SPIN_STEPS)) * .5 * 7.35 / SPIN_STEPS;
}

export function galleryTiming(count: number) {
  const ringCount = Math.min(count, GALLERY_INTRO.circleCount);
  const stackAt = GALLERY_INTRO.collapseAt + GALLERY_INTRO.collapseDuration
    + Math.max(0, ringCount - 1) * GALLERY_INTRO.collapseStagger;
  const explodeAt = stackAt + GALLERY_INTRO.stackHold;
  return { ringCount, stackAt, explodeAt, endAt: explodeAt + GALLERY_INTRO.explodeDuration };
}

export function galleryPhase(elapsed: number, count: number): GalleryPhase {
  const timing = galleryTiming(count);
  if (elapsed < 0) return "loading";
  if (elapsed < GALLERY_INTRO.collapseAt) return "circle";
  if (elapsed < timing.stackAt) return "collapse";
  if (elapsed < timing.explodeAt) return "stack";
  if (elapsed < timing.endAt) return "explode";
  return "sphere";
}

export function galleryIntroPose({ index, count, elapsed, viewportWidth, viewportHeight, aspect, sphere }: {
  index: number; count: number; elapsed: number;
  viewportWidth: number; viewportHeight: number; aspect: number; sphere: GalleryPose;
}): GalleryPose {
  const { ringCount, explodeAt, endAt } = galleryTiming(count);
  if (elapsed >= endAt) return sphere;
  const mobile = viewportWidth <= 640;
  const circleRadius = Math.min(mobile ? 180 : 240, viewportWidth * 0.37, viewportHeight * 0.32);
  const size = mobile ? 52.5 : 70;
  const stackSize = mobile ? 96 : 120;
  const box = (longSide: number) => ({
    width: aspect >= 1 ? longSide : longSide * aspect,
    height: aspect >= 1 ? longSide / aspect : longSide,
  });
  const stack = box(stackSize);
  const spinTime = Math.max(0, Math.min(elapsed, explodeAt) - GALLERY_INTRO.revealStart);
  const sample = Math.min(SPIN_STEPS, spinTime / 7.35 * SPIN_STEPS);
  const lo = Math.floor(sample), hi = Math.min(SPIN_STEPS, lo + 1);
  const angle = -Math.PI / 2 + index / Math.max(1, ringCount) * Math.PI * 2
    + mix(spinAngles[lo], spinAngles[hi], sample - lo);

  if (elapsed < explodeAt) {
    if (index >= ringCount) return { x: 0, y: 0, ...stack, opacity: 0, order: index };
    const reveal = (elapsed - GALLERY_INTRO.revealStart - index * GALLERY_INTRO.revealStagger) / GALLERY_INTRO.revealDuration;
    const circle = box(size * Math.max(0.01, backOut(reveal)));
    const collapse = inOut((elapsed - GALLERY_INTRO.collapseAt - index * GALLERY_INTRO.collapseStagger)
      / GALLERY_INTRO.collapseDuration);
    return {
      x: Math.cos(angle) * circleRadius * (1 - collapse),
      y: Math.sin(angle) * circleRadius * (1 - collapse),
      width: mix(circle.width, stack.width, collapse),
      height: mix(circle.height, stack.height, collapse),
      opacity: elapsed < 0 ? 0 : out(reveal),
      order: 100 + index,
    };
  }

  const progress = smoother((elapsed - explodeAt) / GALLERY_INTRO.explodeDuration);
  const bloom = 1 + 0.1 * Math.sin(Math.PI * progress);
  return {
    x: sphere.x * progress * bloom,
    y: sphere.y * progress * bloom,
    width: mix(stack.width, sphere.width, progress),
    height: mix(stack.height, sphere.height, progress),
    opacity: index < ringCount ? mix(1, sphere.opacity, progress) : sphere.opacity * smoother(progress / .4),
    // Keep the deck's top photo in front until the cards have separated.
    order: progress < .65 ? (index < ringCount ? 100 + index : index) : sphere.order,
  };
}
