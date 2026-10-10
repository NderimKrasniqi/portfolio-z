import { describe, expect, it } from "vitest";
import { FIXED_STEP, FRONT_HALF, RACK_MARGIN, RACK_SPACING, SIDE_HALF, SIDE_YAW, rackTargets, restX, stepHanger } from "../components/site/shop-rack-motion";

describe("rack packing", () => {
  it("keeps six hangers ordered, separated, and on the rail for every selection", () => {
    const railHalf = 5 * RACK_SPACING / 2 + RACK_MARGIN;
    for (let active = 0; active < 6; active++) {
      const targets = rackTargets(6, active, 2.85);
      expect(Math.abs(targets[active]) + FRONT_HALF).toBeLessThan(railHalf);
      for (let index = 0; index < 6; index++) {
        expect(Math.abs(targets[index])).toBeLessThan(railHalf);
        if (index > 0) {
          const halfA = index - 1 === active ? FRONT_HALF : SIDE_HALF;
          const halfB = index === active ? FRONT_HALF : SIDE_HALF;
          expect(targets[index] - targets[index - 1]).toBeGreaterThanOrEqual(halfA + halfB + 0.035);
        }
      }
    }
  });
});

it("settles turns and bounded sway after rapid hover changes at different frame rates", () => {
  const run = (fps: number) => {
    const m = { x: restX(2, 6), xVelocity: 0, yaw: SIDE_YAW, yawVelocity: 0, swing: 0, swingVelocity: 0 };
    let accumulator = 0;
    let tick = 0;
    for (let frame = 0; frame < fps * 6; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-10 >= FIXED_STEP) {
        const active = tick < 30 ? 2 : tick < 45 ? 1 : tick < 60 ? 3 : 2;
        stepHanger(m, rackTargets(6, active, 3)[2], active === 2);
        expect(Object.values(m).every(Number.isFinite)).toBe(true);
        expect(Math.abs(m.swing)).toBeLessThanOrEqual(0.12);
        accumulator -= FIXED_STEP;
        tick++;
      }
    }
    expect(Math.abs(m.yaw)).toBeLessThan(0.002);
    expect(Math.abs(m.swing)).toBeLessThan(0.002);
    return m;
  };
  const sixty = run(60);
  for (const fps of [30, 120]) {
    const other = run(fps);
    for (const key of Object.keys(sixty) as (keyof typeof sixty)[]) expect(other[key]).toBeCloseTo(sixty[key], 8);
  }
});
