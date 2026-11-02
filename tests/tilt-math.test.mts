import assert from "node:assert/strict";
import test from "node:test";
import { createTiltProjection, parseTiltSample, type TiltSample } from "../components/floor/tilt-math.ts";

const sample = (a: [number, number, number], sequence = 1): TiltSample => ({ a, lid: 105, sequence });

test("motion samples require finite acceleration, a plausible hinge angle and an increasing-capable sequence", () => {
  assert.deepEqual(parseTiltSample(sample([0, 0, -1])), sample([0, 0, -1]));
  for (const value of [
    null,
    { a: [0, 0], lid: null, sequence: 1 },
    { a: [0, 0, NaN], lid: null, sequence: 1 },
    { a: [0, Infinity, -1], lid: null, sequence: 1 },
    { a: [0, 0, 0], lid: null, sequence: 1 },
    { a: [20, 0, -1], lid: null, sequence: 1 },
    { a: [0, 0, -1], lid: "unknown", sequence: 1 },
    { a: [0, 0, -1], lid: null, sequence: -1 },
    { a: [0, 0, -1], lid: null, sequence: 1.5 },
    { a: [0, 0, -1], lid: null },
  ]) assert.equal(parseTiltSample(value), null);
});

test("physical left and right tilts point gravity in their respective directions", () => {
  const left = createTiltProjection().add(sample([-0.6, 0, -0.8]));
  const right = createTiltProjection().add(sample([0.6, 0, -0.8]));
  assert.ok(left.x < -0.5);
  assert.ok(right.x > 0.5);
  assert.ok(left.y > 0.25 && right.y > 0.25);
  const reversedSensor = createTiltProjection().add(sample([-0.6, 0, 0.8]));
  assert.ok(reversedSensor.x > 0.5);
});

test("level noise does not slide the pile and calibration defines a new level", () => {
  const projection = createTiltProjection();
  assert.equal(projection.add(sample([0.013, 0, -1])).x, 0);
  for (let index = 0; index < 60; index++) projection.add(sample([0.3, 0, -0.95], index));
  const calibrated = projection.calibrate();
  assert.ok(calibrated);
  assert.equal(calibrated.x, 0);
  assert.ok(calibrated.y > 0.9);
  projection.reset(true);
  assert.equal(projection.add(sample([0.3, 0, -0.95])).x, 0);
});

test("gravity remains bounded and downward during steep tilt and large acceleration", () => {
  const projection = createTiltProjection();
  for (const acceleration of [[1, 0, -0.001], [4, 2, -5], [0, 0, 1]] as [number, number, number][]) {
    const gravity = projection.add(sample(acceleration));
    assert.ok(Number.isFinite(gravity.x) && Number.isFinite(gravity.y));
    assert.ok(Math.abs(gravity.x) <= 1);
    assert.ok(gravity.y >= 0.25 && gravity.y <= 1);
    assert.ok(Math.hypot(gravity.x, gravity.y) <= 1.000001);
  }
});

test("unavailable hinge readings retain acceleration and use the default display angle", () => {
  const reading = parseTiltSample({ a: [-0.98, 0.01, -0.09], lid: 359, sequence: 1 });
  assert.ok(reading);
  assert.equal(reading.lid, null);
  const projection = createTiltProjection();
  projection.add(reading);
  assert.equal(projection.calibrate()?.x, 0);
});

test("resuming keeps the calibrated sensor basis when a near-zero axis changes sign", () => {
  const projection = createTiltProjection();
  projection.add(sample([-0.98, 0.01, -0.09]));
  projection.calibrate();
  projection.reset(true);
  const resumed = projection.add(sample([-0.98, 0.01, 0.01]));
  assert.ok(resumed.y > 0.9);
  assert.ok(Math.abs(resumed.x) < 0.2);
});
