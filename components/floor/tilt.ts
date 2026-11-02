import Matter from "matter-js";
import type { Scene } from "./scene";
import { createTiltProjection, parseTiltSample, type Gravity } from "./tilt-math.ts";

export type TiltState = "off" | "connecting" | "active" | "paused" | "unavailable";
export type TiltStatus = { state: TiltState; message: string };

const FEED = "http://127.0.0.1:3918/motion";
const CONNECT_TIMEOUT_MS = 5000;
const SAMPLE_TIMEOUT_MS = 1000;
const WAKE_DISTANCE = 0.06;
const CALIBRATION_SAMPLES = 15;

/** Connects only when requested. Sensor samples never pass through React state. */
export function createTilt(scene: Scene, onStatus: (status: TiltStatus) => void) {
  const projection = createTiltProjection();
  let source: EventSource | null = null;
  let timer: number | undefined;
  let stopped = false;
  let wanted = false;
  let suspended = false;
  let lastSequence = -1;
  let calibrationSamples = 0;
  let calibrated = false;
  let status: TiltStatus | null = null;
  let settled: Gravity = { x: 0, y: 1 };

  function report(state: TiltState, message: string) {
    if (stopped || (status?.state === state && status.message === message)) return;
    status = { state, message };
    onStatus(status);
  }

  function apply(gravity: Gravity) {
    scene.engine.gravity.x = gravity.x;
    scene.engine.gravity.y = gravity.y;
    if (Math.hypot(gravity.x - settled.x, gravity.y - settled.y) < WAKE_DISTANCE) return;
    settled = gravity;
    for (let index = 0; index < scene.added; index++) {
      if (!scene.holds.has(index)) Matter.Sleeping.set(scene.bodies[index], false);
    }
    scene.dirty = true;
  }

  function disconnect() {
    window.clearTimeout(timer);
    timer = undefined;
    if (source) {
      source.onmessage = null;
      source.onerror = null;
      source.close();
      source = null;
    }
    lastSequence = -1;
    calibrationSamples = 0;
    projection.reset(true);
    apply({ x: 0, y: 1 });
  }

  function unavailable(message: string) {
    wanted = false;
    disconnect();
    calibrated = false;
    projection.reset();
    report("unavailable", message);
  }

  function armTimeout(delay: number, message: string) {
    window.clearTimeout(timer);
    const connection = source;
    timer = window.setTimeout(() => {
      if (!stopped && wanted && !suspended && source === connection) unavailable(message);
    }, delay);
  }

  function connect() {
    if (stopped || !wanted || suspended || source) return;
    report("connecting", "Connecting to the laptop motion helper…");
    let connection: EventSource;
    try {
      connection = new EventSource(FEED);
      source = connection;
    } catch {
      unavailable("Start the local motion helper and allow local network access, then try Laptop tilt again.");
      return;
    }
    armTimeout(CONNECT_TIMEOUT_MS, "No motion readings arrived. Start the local motion helper, then try Laptop tilt again.");
    connection.onmessage = event => {
      if (stopped || source !== connection || suspended || !wanted) return;
      let sample;
      try {
        sample = parseTiltSample(JSON.parse(event.data));
      } catch {
        return;
      }
      if (!sample || sample.sequence <= lastSequence) return;
      lastSequence = sample.sequence;
      let gravity = projection.add(sample);
      armTimeout(SAMPLE_TIMEOUT_MS, "Motion readings stopped. Check the local helper, then try Laptop tilt again.");
      if (!calibrated) {
        calibrationSamples++;
        if (calibrationSamples < CALIBRATION_SAMPLES) {
          report("connecting", "Hold your Mac level while the motion sensor calibrates…");
          return;
        }
        gravity = projection.calibrate() ?? gravity;
        calibrated = true;
      }
      apply(gravity);
      if (status?.state !== "active") report("active", "Laptop tilt is on. Tilt your Mac to move the icons.");
    };
    connection.onerror = () => {
      if (stopped || source !== connection) return;
      unavailable("Cannot reach the motion helper. Start it and allow local network access, then try Laptop tilt again.");
    };
  }

  report("off", "Laptop tilt is off.");

  return {
    setEnabled(on: boolean) {
      if (stopped || wanted === on) return;
      wanted = on;
      if (!on) {
        disconnect();
        projection.reset();
        calibrated = false;
        report("off", "Laptop tilt is off.");
      } else if (suspended) {
        report("paused", "Laptop tilt is paused with motion.");
      } else {
        connect();
      }
    },
    setSuspended(on: boolean) {
      if (stopped || suspended === on) return;
      suspended = on;
      if (!wanted) return;
      if (on) {
        disconnect();
        report("paused", "Laptop tilt is paused with motion.");
      } else {
        connect();
      }
    },
    calibrate() {
      if (stopped || status?.state !== "active") return;
      const gravity = projection.calibrate();
      if (gravity) {
        apply(gravity);
        report("active", "Level set. Tilt your laptop to move the icons.");
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      wanted = false;
      disconnect();
    },
  };
}
