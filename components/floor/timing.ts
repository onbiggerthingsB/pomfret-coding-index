export const STEP = 1000 / 60;
export const SUBSTEP = STEP / 3;
const MAX_SUBSTEPS = 9; // Up to 50 ms of physics per paint, including sustained 30 Hz playback.

export function advanceClock(remainder: number, elapsed: number) {
  const total = remainder + Math.max(0, elapsed);
  const due = Math.floor(total / SUBSTEP + 1e-9);
  return {
    steps: Math.min(due, MAX_SUBSTEPS),
    // Drop whole overdue steps after a long stall, but keep the fractional phase.
    remainder: Math.max(0, total - due * SUBSTEP),
  };
}

type Pose = { position: { x: number; y: number }; angle: number };
type Body = Pose & { isSleeping: boolean };

// Keep real solver poses. Matter's positionPrev also changes when an impulse
// adjusts velocity, so it is not necessarily the last pose the body occupied.
export function createRenderPoses(bodies: Body[]) {
  const samples: { from: Pose; to: Pose; drawn: Pose }[] = [];
  const pose = (): Pose => ({ position: { x: 0, y: 0 }, angle: 0 });
  const copy = (out: Pose, input: Pose) => {
    out.position.x = input.position.x;
    out.position.y = input.position.y;
    out.angle = input.angle;
  };

  return {
    beforeStep(count: number) {
      for (let i = 0; i < count; i++) {
        const sample = samples[i] ??= { from: pose(), to: pose(), drawn: pose() };
        copy(sample.from, bodies[i]);
      }
    },
    afterStep(count: number) {
      for (let i = 0; i < count; i++) copy(samples[i].to, bodies[i]);
    },
    at(i: number, alpha: number): Pose {
      const body = bodies[i];
      const sample = samples[i];
      if (!sample || body.isSleeping || alpha >= 1) return body;
      const { from, to, drawn } = sample;
      // A swap, resize or parked result can move the body outside the solver.
      if (to.position.x !== body.position.x || to.position.y !== body.position.y || to.angle !== body.angle) return body;
      drawn.position.x = from.position.x + (to.position.x - from.position.x) * alpha;
      drawn.position.y = from.position.y + (to.position.y - from.position.y) * alpha;
      drawn.angle = from.angle + (to.angle - from.angle) * alpha;
      return drawn;
    },
  };
}
