import { describe, expect, it } from "vitest";
import { createWardrobeMotion } from "../components/site/wardrobe-motion";

function settle(
  motion: ReturnType<typeof createWardrobeMotion>,
  active: number | null,
  hz = 60,
  seconds = 6,
) {
  for (let i = 0; i < hz * seconds; i++)
    motion.advance(1 / hz, active, 240, 76);
}
describe("wardrobe hanger dynamics", () => {
  it("opens a gap before turning and propagates the push to farther hangers", () => {
    const motion = createWardrobeMotion(6);
    motion.advance(0, null, 240, 76);
    const initial = motion.states.map((s) => s.x);
    motion.advance(1 / 60, 2, 240, 76);
    expect(motion.states[3].x).toBeGreaterThan(initial[3]);
    expect(motion.states[4].x).toBe(initial[4]);
    expect(motion.states[2].turn).toBe(0);
    settle(motion, 2);
    expect(motion.states[2].turn).toBeCloseTo(1, 3);
    expect(motion.states[3].x - motion.states[2].x).toBeGreaterThan(175);
  });
  it("preserves momentum on interruption, stays ordered, and settles back onto the rail", () => {
    const motion = createWardrobeMotion(6);
    motion.advance(0, null, 240, 76);
    settle(motion, 2, 60, 0.18);
    const before = { ...motion.states[3] };
    motion.advance(0, 4, 240, 76);
    expect(motion.states[3]).toEqual(before);
    for (let i = 0; i < 360; i++) {
      motion.advance(1 / 60, i < 25 ? 4 : null, 240, 76);
      for (let j = 1; j < 6; j++)
        expect(motion.states[j].x).toBeGreaterThan(motion.states[j - 1].x);
      for (const state of motion.states)
        expect(Math.abs(state.sway)).toBeLessThanOrEqual(6);
    }
    for (const [index, state] of motion.states.entries()) {
      expect(state.x).toBeCloseTo((index - 2.5) * 76, 1);
      expect(state.sway).toBeCloseTo(0, 1);
    }
  });
  it("behaves consistently at 30 and 120 fps and skips motion when requested", () => {
    const a = createWardrobeMotion(4),
      b = createWardrobeMotion(4);
    a.advance(0, null, 240, 76);
    b.advance(0, null, 240, 76);
    settle(a, 1, 30, 1);
    settle(b, 1, 120, 1);
    expect(a.states[2].x).toBeCloseTo(b.states[2].x, 1);
    expect(a.states[2].sway).toBeCloseTo(b.states[2].sway, 1);
    a.advance(1 / 60, 3, 240, 76, true);
    expect(a.states[3].turn).toBe(1);
    for (const state of a.states)
      expect([state.vx, state.vt, state.vs, state.sway]).toEqual([0, 0, 0, 0]);
  });
});
