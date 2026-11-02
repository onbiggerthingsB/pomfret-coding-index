export type TiltSample = {
  a: [number, number, number];
  lid: number | null;
  sequence: number;
};

export type Gravity = { x: number; y: number };

const DEFAULT_LID = 105;
const SMOOTHING = 0.16;
const SIDEWAYS_DEAD_ZONE = 0.035;
const MIN_DOWNWARD_GRAVITY = 0.25;

export function parseTiltSample(value: unknown): TiltSample | null {
  if (!value || typeof value !== "object") return null;
  const sample = value as Partial<TiltSample>;
  if (!Array.isArray(sample.a) || sample.a.length !== 3) return null;
  if (!sample.a.every(axis => typeof axis === "number" && Number.isFinite(axis) && Math.abs(axis) <= 16)) return null;
  if (Math.hypot(...sample.a) < 0.05) return null;
  if (sample.lid !== null && (typeof sample.lid !== "number" || !Number.isFinite(sample.lid))) return null;
  if (typeof sample.sequence !== "number" || !Number.isSafeInteger(sample.sequence) || sample.sequence < 0) return null;
  const lid = sample.lid !== null && sample.lid > 30 && sample.lid < 170 ? sample.lid : null;
  return { a: [sample.a[0], sample.a[1], sample.a[2]], lid, sequence: sample.sequence };
}

/** Projects the base sensor's gravity onto the open display and smooths hand tremor. */
export function createTiltProjection() {
  let filtered: [number, number, number] | null = null;
  let sensorSign = 1;
  let sensorSignKnown = false;
  let levelAngle = 0;
  let projected: Gravity | null = null;

  function gravity(): Gravity {
    if (!projected) return { x: 0, y: 1 };
    const cosine = Math.cos(levelAngle);
    const sine = Math.sin(levelAngle);
    let x = projected.x * cosine - projected.y * sine;
    let y = projected.x * sine + projected.y * cosine;
    const magnitude = Math.max(1, Math.hypot(x, y));
    x /= magnitude;
    y /= magnitude;
    // Sideways tilt stays inside the closed sides while new icons pour in from above.
    y = Math.min(1, Math.max(MIN_DOWNWARD_GRAVITY, y));
    const horizontalLimit = Math.sqrt(Math.max(0, 1 - y * y));
    x = Math.max(-horizontalLimit, Math.min(horizontalLimit, x));
    if (Math.abs(x) < SIDEWAYS_DEAD_ZONE) x = 0;
    return { x, y };
  }

  return {
    add(sample: TiltSample): Gravity {
      if (!filtered) {
        filtered = [...sample.a];
        // Keep this basis through pauses so a near-zero axis cannot reverse calibration.
        if (!sensorSignKnown) {
          sensorSign = sample.a[2] <= 0 ? 1 : -1;
          sensorSignKnown = true;
        }
      } else {
        for (let axis = 0; axis < 3; axis++) {
          filtered[axis] += (sample.a[axis] - filtered[axis]) * SMOOTHING;
        }
      }
      const lid = sample.lid !== null && sample.lid > 30 && sample.lid < 170 ? sample.lid : DEFAULT_LID;
      const radians = lid * Math.PI / 180;
      projected = {
        x: sensorSign * filtered[0],
        y: sensorSign * (filtered[1] * Math.cos(radians) - filtered[2] * Math.sin(radians)),
      };
      return gravity();
    },
    calibrate(): Gravity | null {
      if (!projected) return null;
      levelAngle = Math.atan2(projected.x, projected.y);
      return gravity();
    },
    reset(keepCalibration = false) {
      filtered = null;
      projected = null;
      if (!keepCalibration) {
        sensorSign = 1;
        sensorSignKnown = false;
        levelAngle = 0;
      }
    },
  };
}
