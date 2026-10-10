import { expect, it } from "vitest";
import { galleryIntroPose, galleryPhase } from "../components/site/gallery-intro-motion";

const sphere = { x: 160, y: -80, width: 65, height: 90, opacity: 0.85, order: 60 };
const pose = (index: number, elapsed: number, viewportWidth = 1280) => galleryIntroPose({
  index, elapsed, count: 32, viewportWidth, viewportHeight: 720, aspect: 0.75, sphere,
});

it("reveals ten upright pictures on a rotating circle before introducing the rest", () => {
  for (const width of [390, 1280]) {
    const ring = Array.from({ length: 10 }, (_, i) => pose(i, 3.65, width));
    const radii = ring.map(p => Math.hypot(p.x, p.y));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.001);
    expect(new Set(ring.map(p => `${p.x},${p.y}`)).size).toBe(10);
    expect(ring.every(p => p.opacity === 1)).toBe(true);
    expect(ring.every(p => Math.abs(p.x) + p.width / 2 < width / 2)).toBe(true);
    expect(pose(0, 1, width).x).not.toBe(pose(0, 2, width).x);
  }
  expect(pose(9, 0.3).opacity).toBe(0);
  expect(pose(10, 2).opacity).toBe(0);
});

it("finishes the entire center stack before all 32 pictures expand", () => {
  expect(galleryPhase(6.4, 32)).toBe("stack");
  for (let i = 0; i < 10; i++) {
    const p = pose(i, 6.4);
    expect(Math.hypot(p.x, p.y)).toBeLessThan(0.001);
    expect(p.height).toBe(120);
  }
  expect(galleryPhase(7, 32)).toBe("explode");
  for (let i = 0; i < 32; i++) {
    expect(pose(i, 7).opacity).toBeGreaterThan(0);
    expect(pose(i, 8.1)).toEqual(sphere);
  }
});

it("keeps the same top photograph as the stack starts expanding", () => {
  const before = Array.from({length:32}, (_,i)=>pose(i,6.7));
  const during = Array.from({length:32}, (_,i)=>pose(i,6.72));
  const top = (poses: typeof before) => poses.map((p,i)=>({p,i})).filter(({p})=>p.opacity>.01).sort((a,b)=>b.p.order-a.p.order)[0].i;
  expect(top(before)).toBe(9);
  expect(top(during)).toBe(9);
  expect(during[10].opacity).toBeLessThan(.01);
});
