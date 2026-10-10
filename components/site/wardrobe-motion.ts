/** Hook translation drives a damped pendulum; hover changes preserve momentum. */
export type GarmentMotion = {
  x: number;
  vx: number;
  turn: number;
  vt: number;
  sway: number;
  vs: number;
};
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const smooth = (value: number) => {
  const x = clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
};
export function garmentFaces(turn: number) {
  const angle = (1 - clamp(turn, 0, 1)) * Math.PI * 0.46;
  const front = smooth((turn - 0.18) / 0.48);
  return { front, side: 1 - front, width: Math.max(0.13, Math.cos(angle)) };
}
export function createWardrobeMotion(count: number) {
  const states: GarmentMotion[] = Array.from({ length: count }, () => ({
    x: 0,
    vx: 0,
    turn: 0,
    vt: 0,
    sway: 0,
    vs: 0,
  }));
  let initialized = false,
    selected: number | null = null,
    age = 1;
  let from = states.map(() => 0);
  return {
    states,
    advance(
      dt: number,
      active: number | null,
      garment: number,
      spacing: number,
      reduced = false,
    ) {
      const middle = (count - 1) / 2;
      const targets = states.map((_, index) => {
        if (active === null) return (index - middle) * spacing;
        const distance = index - active;
        // Keep the chosen hook near its original slot instead of pulling every selection to centre.
        return (
          (active - middle) * spacing * 0.85 +
          (distance === 0
            ? 0
            : Math.sign(distance) *
              (garment * 0.55 +
                spacing * 0.65 +
                (Math.abs(distance) - 1) * spacing * 0.88))
        );
      });
      if (!initialized || reduced) {
        states.forEach((state, index) =>
          Object.assign(state, {
            x: targets[index],
            vx: 0,
            turn: active === index ? 1 : 0,
            vt: 0,
            sway: 0,
            vs: 0,
          }),
        );
        initialized = true;
        selected = active;
        age = 1;
        from = targets;
        return false;
      }
      if (selected !== active) {
        selected = active;
        age = 0;
        from = states.map((state) => state.x);
      }
      const duration = clamp(dt, 0, 1 / 20),
        steps = Math.max(1, Math.ceil(duration * 120)),
        step = duration / steps;
      for (let frame = 0; frame < steps; frame++) {
        age += step;
        states.forEach((state, index) => {
          const distance = active === null ? 0 : Math.abs(index - active);
          // A short wave propagates outwards, like pushing adjacent hangers along a rail.
          const delay =
            active === null
              ? 0
              : Math.min(0.09, Math.max(0, distance - 1) * 0.028);
          const goal = age < delay ? from[index] : targets[index];
          const stiffness = active === index ? 105 : 80;
          const acceleration = (goal - state.x) * stiffness - state.vx * 15.8;
          state.vx += acceleration * step;
          state.x += state.vx * step;
          // Clear some room before opening the garment; close immediately on release.
          const turn = active === index && age > 0.055 ? 1 : 0;
          state.vt += ((turn - state.turn) * 78 - state.vt * 16) * step;
          state.turn += state.vt * step;
          state.vs +=
            (-state.sway * 24 - state.vs * 4.4 - acceleration * 0.035) * step;
          state.sway = clamp(state.sway + state.vs * step, -6, 6);
        });
      }
      return (
        age < 0.18 ||
        states.some(
          (state, index) =>
            Math.abs(targets[index] - state.x) > 0.05 ||
            Math.abs(state.vx) > 0.05 ||
            Math.abs((active === index ? 1 : 0) - state.turn) > 0.001 ||
            Math.abs(state.vt) > 0.001 ||
            Math.abs(state.sway) > 0.015 ||
            Math.abs(state.vs) > 0.015,
        )
      );
    },
  };
}
