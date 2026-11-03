import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { advanceClock, createRenderPoses, SUBSTEP } from "../components/floor/timing.ts";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `expected ${expected}, got ${actual}`);

function movingTile() {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
  const body = Matter.Bodies.rectangle(0, 0, 24, 24, { frictionAir: 0 });
  Matter.Body.setVelocity(body, { x: 10, y: -2 });
  Matter.Body.setAngularVelocity(body, 0.12);
  Matter.Composite.add(engine.world, body);
  const poses = createRenderPoses([body]);
  let remainder = 0;

  function paint(elapsed: number) {
    const tick = advanceClock(remainder, elapsed);
    remainder = tick.remainder;
    // The floor records the last solver step, even when several land in one paint.
    for (let step = 0; step < tick.steps; step++) {
      if (step === tick.steps - 1) poses.beforeStep(1);
      Matter.Engine.update(engine, SUBSTEP);
    }
    if (tick.steps) poses.afterStep(1);
    return poses.at(0, remainder / SUBSTEP);
  }
  return { body, poses, paint };
}

function checkCadence(intervals: number[]) {
  const { paint } = movingTile();
  let clock = 0;
  for (const elapsed of intervals) {
    clock += elapsed;
    const pose = paint(elapsed);
    // Matter velocities are in pixels or radians per 1/60 s. Interpolation adds
    // one solver step of latency in exchange for an even distance each paint.
    const seconds = Math.max(0, clock - SUBSTEP) / 1000;
    close(pose.position.x, 600 * seconds);
    close(pose.position.y, -120 * seconds);
    close(pose.angle, 7.2 * seconds);
  }
}

for (const hz of [30, 60, 120, 144, 240]) {
  test(`a moving and rotating Matter tile paints at a constant speed at ${hz} Hz`, () => {
    checkCadence(Array(hz).fill(1000 / hz));
  });
}

test("a variable refresh interval preserves the tile's speed on every paint", () => {
  checkCadence([3.8, 4.6, 8.1, 12.9, 7.5, 31.5, 5.9, 16.7, 4.1, 20.3]);
});

test("a stall caps solver work and retains only the fractional phase for the next paint", () => {
  const stalled = advanceClock(SUBSTEP / 4, SUBSTEP * 40.5);
  assert.equal(stalled.steps, 9);
  close(stalled.remainder / SUBSTEP, 0.75);
  const next = advanceClock(stalled.remainder, SUBSTEP / 2);
  assert.equal(next.steps, 1);
  close(next.remainder / SUBSTEP, 0.25);
});

test("applying a velocity impulse does not rewrite the positions already sampled for display", () => {
  const { body, poses, paint } = movingTile();
  paint(SUBSTEP);
  Matter.Body.setVelocity(body, { x: -20, y: 5 });
  Matter.Body.setAngularVelocity(body, -0.75);
  const halfway = poses.at(0, 0.5);
  close(halfway.position.x, body.position.x / 2);
  close(halfway.position.y, body.position.y / 2);
  close(halfway.angle, body.angle / 2);
});

test("a teleported or externally rotated tile paints at its new pose immediately", () => {
  const { body, poses, paint } = movingTile();
  paint(SUBSTEP);
  Matter.Body.setAngle(body, Math.PI);
  close(poses.at(0, 0.25).angle, Math.PI);
  paint(SUBSTEP);
  Matter.Body.setPosition(body, { x: 240, y: -90 });
  const teleported = poses.at(0, 0.25);
  assert.deepEqual(teleported.position, { x: 240, y: -90 });
  close(teleported.angle, body.angle);
});

test("a tile that falls asleep paints its final position and angle", () => {
  const { body, poses, paint } = movingTile();
  paint(SUBSTEP);
  Matter.Sleeping.set(body, true);
  const settled = poses.at(0, 0.25);
  assert.deepEqual(settled.position, body.position);
  close(settled.angle, body.angle);
});
