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
  if (count <= 0) return [];

  const golden = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, index) => {
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

type SphereProjectionBase = {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
  depth01: number;
};

function projectSphereBase(
  unit: SphereUnit,
  rotationY: number,
  width: number,
  height: number,
): SphereProjectionBase {
  const scale = roomScale(width, height);

  const sinY = Math.sin(rotationY);
  const cosY = Math.cos(rotationY);

  const x1 =
    unit.x * scale.x * cosY +
    unit.z * scale.z * sinY;

  const z1 =
    -unit.x * scale.x * sinY +
    unit.z * scale.z * cosY;

  const tilt = -0.055;
  const sinTilt = Math.sin(tilt);
  const cosTilt = Math.cos(tilt);

  const y2 =
    unit.y * scale.y * cosTilt -
    z1 * sinTilt;

  const z2 =
    unit.y * scale.y * sinTilt +
    z1 * cosTilt;

  const depth = Math.max(
    0.9,
    CAMERA_Z - z2,
  );

  const projection =
    focalPx(height) / depth;

  const depth01 = Math.max(
    0,
    Math.min(
      1,
      (z2 / scale.z + 1) / 2,
    ),
  );

  return {
    x: x1 * projection,
    y: -y2 * projection,
    scale: CAMERA_Z / depth,
    zIndex:
      100 +
      Math.round(depth01 * 100),
    depth01,
  };
}

export function projectThreeSpherePoint(
  unit: SphereUnit,
  rotationY: number,
  width: number,
  height: number,
) {
  const {
    depth01: _depth01,
    ...projection
  } = projectSphereBase(
    unit,
    rotationY,
    width,
    height,
  );

  return projection;
}

export function projectSpherePoint(
  unit: SphereUnit,
  rotationY: number,
  width: number,
  height: number,
) {
  const projection = projectSphereBase(
    unit,
    rotationY,
    width,
    height,
  );

  const depthScale =
    0.96 + projection.depth01 * 0.08;

  return {
    x: projection.x,
    y: projection.y,
    scale: projection.scale * depthScale,
    opacity:
      0.78 +
      projection.depth01 * 0.22,
    zIndex: projection.zIndex,
  };
}
