/*
 * Verlet cloth for one garment photo.
 *
 * The cloth is a grid of points in world space. Neighbouring points are
 * joined by distance constraints (structural and shear). The top row is
 * pinned: every frame the caller moves the pins to where the hanger is, and
 * the rest of the cloth follows with gravity, inertia and damping.
 */
export type Vec3 = [number, number, number];

export class Cloth {
  readonly cols: number;
  readonly rows: number;
  readonly width: number;
  readonly height: number;
  readonly positions: Float32Array;
  private readonly previous: Float32Array;
  private readonly constraints: Array<[number, number, number]> = [];

  constructor(width: number, height: number, cols = 14, rows = 18) {
    this.cols = cols;
    this.rows = rows;
    this.width = width;
    this.height = height;
    this.positions = new Float32Array(cols * rows * 3);
    this.previous = new Float32Array(cols * rows * 3);

    const dx = width / (cols - 1);
    const dy = height / (rows - 1);
    const diagonal = Math.hypot(dx, dy);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = this.index(c, r);
        if (c < cols - 1) this.constraints.push([i, this.index(c + 1, r), dx]);
        if (r < rows - 1) this.constraints.push([i, this.index(c, r + 1), dy]);
        if (c < cols - 1 && r < rows - 1) {
          this.constraints.push([i, this.index(c + 1, r + 1), diagonal]);
          this.constraints.push([this.index(c + 1, r), this.index(c, r + 1), diagonal]);
        }
        // bending: skip one point, so the cloth resists sharp folds
        if (c < cols - 2) this.constraints.push([i, this.index(c + 2, r), dx * 2]);
        if (r < rows - 2) this.constraints.push([i, this.index(c, r + 2), dy * 2]);
      }
    }
  }

  index(c: number, r: number) {
    return r * this.cols + c;
  }

  /** Place the cloth flat: `toWorld` maps local (x, y) on the photo to world space. */
  reset(toWorld: (x: number, y: number) => Vec3) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const [x, y, z] = toWorld(this.localX(c), this.localY(r));
        const i = this.index(c, r) * 3;
        this.positions[i] = this.previous[i] = x;
        this.positions[i + 1] = this.previous[i + 1] = y;
        this.positions[i + 2] = this.previous[i + 2] = z;
      }
    }
  }

  localX(c: number) {
    return (c / (this.cols - 1) - 0.5) * this.width;
  }

  localY(r: number) {
    return -(r / (this.rows - 1)) * this.height;
  }

  /**
   * Advance one step. `pin` gives the world position of each top-row point.
   * `push` lets the caller add a velocity (for example from the pointer).
   */
  step(
    dt: number,
    pin: (c: number) => Vec3,
    push?: (x: number, y: number, z: number) => Vec3 | null,
    rest?: { at: (c: number, r: number) => Vec3; stiffness: number },
  ) {
    const gravity = -9.8 * 0.35;
    const damping = 0.965;
    const p = this.positions;
    const q = this.previous;

    for (let i = 0; i < this.cols * this.rows; i++) {
      const k = i * 3;
      const x = p[k], y = p[k + 1], z = p[k + 2];
      let vx = (x - q[k]) * damping;
      let vy = (y - q[k + 1]) * damping;
      let vz = (z - q[k + 2]) * damping;
      const extra = push?.(x, y, z);
      if (extra) {
        vx += extra[0]; vy += extra[1]; vz += extra[2];
      }
      q[k] = x; q[k + 1] = y; q[k + 2] = z;
      p[k] = x + vx;
      p[k + 1] = y + vy + gravity * dt * dt;
      p[k + 2] = z + vz;
    }

    // shape memory: pull each point a little towards its rest position on the hanger
    if (rest) {
      for (let r = 1; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const [x, y, z] = rest.at(c, r);
          const k = this.index(c, r) * 3;
          p[k] += (x - p[k]) * rest.stiffness;
          p[k + 1] += (y - p[k + 1]) * rest.stiffness;
          p[k + 2] += (z - p[k + 2]) * rest.stiffness;
        }
      }
    }

    for (let iteration = 0; iteration < 12; iteration++) {
      for (const [a, b, rest] of this.constraints) {
        const ka = a * 3, kb = b * 3;
        const dx = p[kb] - p[ka];
        const dy = p[kb + 1] - p[ka + 1];
        const dz = p[kb + 2] - p[ka + 2];
        const distance = Math.hypot(dx, dy, dz) || 1e-6;
        const offset = ((distance - rest) / distance) * 0.5;
        p[ka] += dx * offset; p[ka + 1] += dy * offset; p[ka + 2] += dz * offset;
        p[kb] -= dx * offset; p[kb + 1] -= dy * offset; p[kb + 2] -= dz * offset;
      }
      for (let c = 0; c < this.cols; c++) {
        const [x, y, z] = pin(c);
        const k = this.index(c, 0) * 3;
        p[k] = x; p[k + 1] = y; p[k + 2] = z;
      }
    }
  }
}
