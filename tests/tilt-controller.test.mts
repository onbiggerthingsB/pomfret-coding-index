import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { createTilt, type TiltStatus } from "../components/floor/tilt.ts";
import type { Scene } from "../components/floor/scene.ts";

class Clock {
  now = 0;
  next = 0;
  jobs = new Map<number, { at: number; callback: () => void }>();
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.next;
    this.jobs.set(id, { at: this.now + delay, callback });
    return id;
  };
  clearTimeout = (id: number) => { this.jobs.delete(id); };
  advance(delay: number) {
    const target = this.now + delay;
    for (;;) {
      const next = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      this.now = next[1].at;
      this.jobs.delete(next[0]);
      next[1].callback();
    }
    this.now = target;
  }
}

class MotionStream {
  static streams: MotionStream[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    MotionStream.streams.push(this);
  }
  close() { this.closed = true; }
  send(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent<string>);
  }
}

function setup(t: test.TestContext) {
  const clock = new Clock();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStream = Object.getOwnPropertyDescriptor(globalThis, "EventSource");
  Object.defineProperty(globalThis, "window", { configurable: true, value: clock });
  Object.defineProperty(globalThis, "EventSource", { configurable: true, value: MotionStream });
  MotionStream.streams = [];
  const engine = Matter.Engine.create();
  const bodies = [Matter.Bodies.rectangle(0, 0, 10, 10), Matter.Bodies.rectangle(20, 0, 10, 10)];
  bodies.forEach(body => Matter.Sleeping.set(body, true));
  const scene = { engine, bodies, added: 2, holds: new Map([[1, {}]]), dirty: false } as Scene;
  const statuses: TiltStatus[] = [];
  const controller = createTilt(scene, status => statuses.push(status));
  t.after(() => {
    controller.stop();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStream) Object.defineProperty(globalThis, "EventSource", originalStream);
    else Reflect.deleteProperty(globalThis, "EventSource");
  });
  return { clock, scene, statuses, controller };
}

const reading = (sequence: number) => ({ a: [0.6, 0, -0.8], lid: 105, sequence });
function calibrate(stream: MotionStream) {
  for (let sequence = 1; sequence <= 15; sequence++) stream.send({ a: [0, 0, -1], lid: 105, sequence });
}

test("valid live samples wake the free pile, leave held results asleep and report active once", t => {
  const { scene, statuses, controller } = setup(t);
  controller.setEnabled(true);
  const stream = MotionStream.streams[0];
  assert.equal(stream.url, "http://127.0.0.1:3918/motion");
  assert.equal(statuses.at(-1)?.state, "connecting");
  calibrate(stream);
  stream.send(reading(16));
  assert.ok(scene.engine.gravity.x > 0.05);
  assert.equal(scene.bodies[0].isSleeping, false);
  assert.equal(scene.bodies[1].isSleeping, true);
  assert.equal(statuses.at(-1)?.state, "active");
  const count = statuses.length;
  stream.send(reading(17));
  assert.equal(statuses.length, count);
});

test("invalid or replayed samples cannot keep a dead sensor marked active", t => {
  const { clock, scene, statuses, controller } = setup(t);
  controller.setEnabled(true);
  const stream = MotionStream.streams[0];
  calibrate(stream);
  stream.send(reading(16));
  clock.advance(800);
  stream.send(reading(16));
  stream.send({ a: [0, null, -1], lid: null, sequence: 2 });
  clock.advance(201);
  assert.equal(statuses.at(-1)?.state, "unavailable");
  assert.equal(stream.closed, true);
  assert.deepEqual([scene.engine.gravity.x, scene.engine.gravity.y], [0, 1]);
  clock.advance(30000);
  assert.equal(MotionStream.streams.length, 1);
  controller.setEnabled(true);
  assert.equal(MotionStream.streams.length, 2);
});

test("connection without a valid sample times out and connection errors reset gravity", t => {
  const { clock, scene, statuses, controller } = setup(t);
  controller.setEnabled(true);
  clock.advance(5001);
  assert.equal(statuses.at(-1)?.state, "unavailable");
  controller.setEnabled(true);
  const stream = MotionStream.streams[1];
  calibrate(stream);
  stream.send(reading(16));
  stream.onerror?.();
  assert.equal(statuses.at(-1)?.state, "unavailable");
  assert.deepEqual([scene.engine.gravity.x, scene.engine.gravity.y], [0, 1]);
});

test("pause closes sensing, resume reconnects, and stopped controllers reject late events", t => {
  const { clock, scene, statuses, controller } = setup(t);
  controller.setEnabled(true);
  const first = MotionStream.streams[0];
  calibrate(first);
  first.send(reading(16));
  const lateMessage = first.onmessage;
  controller.setSuspended(true);
  assert.equal(first.closed, true);
  assert.equal(statuses.at(-1)?.state, "paused");
  clock.advance(30000);
  assert.equal(MotionStream.streams.length, 1);
  controller.setSuspended(false);
  assert.equal(MotionStream.streams.length, 2);
  controller.stop();
  const count = statuses.length;
  lateMessage?.({ data: JSON.stringify(reading(10)) } as MessageEvent<string>);
  controller.setEnabled(true);
  clock.advance(30000);
  assert.deepEqual([scene.engine.gravity.x, scene.engine.gravity.y], [0, 1]);
  assert.equal(statuses.length, count);
  assert.equal(MotionStream.streams.length, 2);
});

test("turning tilt off clears pending work and is idempotent", t => {
  const { clock, statuses, controller } = setup(t);
  controller.setEnabled(true);
  controller.setEnabled(false);
  const count = statuses.length;
  controller.setEnabled(false);
  clock.advance(30000);
  assert.equal(statuses.at(-1)?.state, "off");
  assert.equal(statuses.length, count);
  assert.equal(MotionStream.streams[0].closed, true);
  assert.equal(clock.jobs.size, 0);
});

test("startup calibration handles an M4 sensor whose resting gravity is on its first axis", t => {
  const { scene, statuses, controller } = setup(t);
  controller.setEnabled(true);
  const stream = MotionStream.streams[0];
  for (let sequence = 1; sequence < 15; sequence++) {
    stream.send({ a: [-0.98, 0.01, -0.09], lid: 359, sequence });
  }
  assert.equal(statuses.at(-1)?.state, "connecting");
  assert.deepEqual([scene.engine.gravity.x, scene.engine.gravity.y], [0, 1]);
  stream.send({ a: [-0.98, 0.01, -0.09], lid: 359, sequence: 15 });
  assert.equal(statuses.at(-1)?.state, "active");
  assert.equal(scene.engine.gravity.x, 0);
  assert.ok(scene.engine.gravity.y > 0.9);
});
