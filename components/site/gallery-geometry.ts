export const CAMERA_FOV = 42;
export const CAMERA_Z = 9.25;

export const CARD_WIDTH_FACTORS = [
  0.96,
  1.04,
  0.99,
  1.07,
  1.01,
  0.93,
  1.05,
  0.98,
  0.95,
  1.03,
  0.97,
  1,
] as const;

export type SphereUnit = {
  x: number;
  y: number;
  z: number;
};

export function sphereUnits(count: number): SphereUnit[] {
  const golden = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    let y = 1 - 2 * ((index + 0.5) / count);

    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = index * golden + 0.58;

    let x = Math.cos(theta) * ring;
    let z = Math.sin(theta) * ring;

    const cy = Math.cos(0.22);
    const sy = Math.sin(0.22);

    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;

    const cx = Math.cos(-0.1);
    const sx = Math.sin(-0.1);

    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;

    const length = Math.hypot(x1, y1, z2) || 1;

    x = x1 / length;
    y = y1 / length;
    z = z2 / length;

    return { x, y, z };
  });
}

export function focalPx(height: number) {
  return (
    height /
    (2 * Math.tan(((CAMERA_FOV * Math.PI) / 180) / 2))
  );
}

export function targetCardPx(
  index: number,
  width: number,
) {
  const base = Math.min(
    58,
    Math.max(44, width * 0.0395),
  );

  return (
    base *
    CARD_WIDTH_FACTORS[
      index % CARD_WIDTH_FACTORS.length
    ] *
    (width <= 800 ? 0.9 : 1)
  );
}

export function roomScale(
  width: number,
  height: number,
) {
  const mobile = width <= 800;

  const radiusPx = mobile
    ? Math.min(190, width * 0.37, height * 0.235)
    : Math.min(255, width * 0.18, height * 0.285);

  const radius =
    (radiusPx * CAMERA_Z) / focalPx(height);

  return {
    x: radius,
    y: radius,
    z: radius * 1.075,
  };
}

export function projectSpherePoint(
  unit: SphereUnit,
  rotationY: number,
  width: number,
  height: number,
) {
  const mobile = width <= 800;

  const sphereRadius = mobile
    ? Math.min(190, width * 0.37, height * 0.235)
    : Math.min(255, width * 0.18, height * 0.285);

  const focal = focalPx(height);

  const worldRadius =
    (sphereRadius * CAMERA_Z) / focal;

  const sinY = Math.sin(rotationY);
  const cosY = Math.cos(rotationY);

  const x1 =
    unit.x * worldRadius * cosY +
    unit.z * worldRadius * 1.075 * sinY;

  const z1 =
    -unit.x * worldRadius * sinY +
    unit.z * worldRadius * 1.075 * cosY;

  const tilt = -0.055;

  const sinTilt = Math.sin(tilt);
  const cosTilt = Math.cos(tilt);

  const y2 =
    unit.y * worldRadius * cosTilt -
    z1 * sinTilt;

  const z2 =
    unit.y * worldRadius * sinTilt +
    z1 * cosTilt;

  const depth = Math.max(
    0.9,
    CAMERA_Z - z2,
  );

  const projection = focal / depth;

  const depthScale =
    0.96 +
    (((z2 / (worldRadius * 1.075) + 1) / 2) *
      0.08);

  return {
    x: x1 * projection,
    y: -y2 * projection,
    scale:
      (CAMERA_Z / depth) *
      depthScale,
    zIndex:
      100 +
      Math.round(
        ((z2 / (worldRadius * 1.075) + 1) / 2) *
          100,
      ),
  };
}
