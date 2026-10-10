// World-space rack dimensions, shared by layout and the spring simulation.
export const RACK_SPACING = 0.7;
export const RACK_MARGIN = 0.9;
export const FRONT_HALF = 0.95;
export const SIDE_HALF = 0.3;
export const SIDE_YAW = Math.PI / 2;
export const FIXED_STEP = 1 / 60;

export const restX = (index: number, count: number) => (index - (count - 1) / 2) * RACK_SPACING;

/** Pack outward from the selected hanger, retaining order and room for shoulders. */
export function rackTargets(count: number, active: number | null, visibleHalf: number) {
  const targets = Array.from({ length: count }, (_, index) => restX(index, count));
  if (active === null || !count) return targets;
  const railHalf = (count - 1) * RACK_SPACING / 2 + RACK_MARGIN;
  const limit = Math.max(0, Math.min(railHalf, visibleHalf) - FRONT_HALF - 0.08);
  targets[active] = Math.max(-limit, Math.min(limit, targets[active]));
  const openGap = FRONT_HALF + SIDE_HALF + 0.08;
  const closedGap = SIDE_HALF * 2 + 0.04;
  for (let index = active + 1; index < count; index++)
    targets[index] = Math.max(targets[index], targets[index - 1] + (index === active + 1 ? openGap : closedGap));
  for (let index = active - 1; index >= 0; index--)
    targets[index] = Math.min(targets[index], targets[index + 1] - (index === active - 1 ? openGap : closedGap));
  return targets;
}

export type HangerMotion = { x: number; xVelocity: number; yaw: number; yawVelocity: number; swing: number; swingVelocity: number };

export function stepHanger(m: HangerMotion, targetX: number, open: boolean, dt = FIXED_STEP) {
  // Fast, nearly critical sliding; the body keeps a little inertia below the hook.
  const slideForce = (targetX - m.x) * 95 - m.xVelocity * 19.5;
  m.xVelocity += slideForce * dt;
  m.x += m.xVelocity * dt;
  const yawForce = ((open ? 0 : SIDE_YAW) - m.yaw) * 65 - m.yawVelocity * 12.5;
  m.yawVelocity += yawForce * dt;
  m.yaw += m.yawVelocity * dt;
  const swingForce = -20 * m.swing - 4.2 * m.swingVelocity - slideForce * 0.025 + m.yawVelocity * 0.12;
  m.swingVelocity += swingForce * dt;
  const swing = m.swing + m.swingVelocity * dt;
  m.swing = Math.max(-0.12, Math.min(0.12, swing));
  if (Math.abs(swing) > 0.12 && Math.sign(m.swingVelocity) === Math.sign(swing)) m.swingVelocity = 0;
}
