import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { createIconBody } from "../components/floor/icon-body.ts";
import { resizeFloorBodies } from "../components/floor/resize.ts";
import type { Hold } from "../components/floor/scene.ts";

const box = (x: number, y: number, size: number) => createIconBody(x, y, size, 0);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} vs ${expected}`);

test("resize synchronizes grown, queued and rotated collision boxes with the new rendered size", () => {
  const held = box(200, 100, 40);
  const queued = box(750, -200, 20);
  const airborne = box(799, 450, 20);
  Matter.Body.setAngle(airborne, Math.PI / 4);
  Matter.Body.setVelocity(airborne, { x: 2, y: 3 });
  const original = { width: 800, height: 600, size: 20 };
  const bodies = [held, airborne, queued];
  resizeFloorBodies({ width: 400, height: 300, size: 10, bodies, added: 2, holds: new Map([[0, {} as Hold]]) }, original);
  close(held.bounds.max.x - held.bounds.min.x, 20);
  close(queued.bounds.max.x - queued.bounds.min.x, 10);
  close(airborne.area, box(0, 0, 10).area);
  assert.deepEqual(held.position, { x: 200, y: 100 });
  close(queued.position.y, -100);
  const shape = Matter.Bounds.create(airborne.vertices);
  close(shape.max.x, 400);
  close(shape.max.y, 300);
  assert.ok(shape.min.x > 0);
  assert.deepEqual(Matter.Body.getVelocity(airborne), { x: 2, y: 3 });
});

test("a uniform resize keeps a resting stack supported; widening only wakes the unsupported upper box", () => {
  const lower = box(100, 190, 20);
  const upper = box(100, 170, 20);
  for (const body of [upper, lower]) Matter.Sleeping.set(body, true);
  const previous = { width: 400, height: 200, size: 20 };
  const scene = { width: 200, height: 300, size: 10, bodies: [lower, upper], added: 2, holds: new Map<number, Hold>() };
  resizeFloorBodies(scene, previous);
  close(lower.bounds.max.y, scene.height);
  close(upper.bounds.max.y, lower.bounds.min.y);
  assert.ok(lower.isSleeping && upper.isSleeping);
  resizeFloorBodies({ ...scene, width: 300 }, scene);
  assert.ok(lower.isSleeping && !upper.isSleeping);
});

test("cut corners allow near misses, and the flat edges support a resting body after a resize", () => {
  const icon = box(50, 50, 20);
  assert.equal(icon.vertices.length, 8);
  assert.deepEqual([icon.restitution, icon.friction, icon.frictionStatic], [0.25, 0.45, 0.9]);
  close(icon.area, 20 ** 2 - 2 * (20 * 0.13) ** 2);
  assert.deepEqual(Matter.Query.point([icon], { x: 59.8, y: 59.8 }), []);
  assert.equal(Matter.Query.point([icon], { x: 59.8, y: 50 })[0], icon);

  Matter.Body.setAngle(icon, Math.PI / 4);
  const halfY = Matter.Bounds.create(icon.vertices).max.y - icon.position.y;
  Matter.Body.setPosition(icon, { x: 50, y: 200 - halfY });
  Matter.Sleeping.set(icon, true);
  const scene = { width: 200, height: 300, size: 10, bodies: [icon], added: 1, holds: new Map<number, Hold>() };
  resizeFloorBodies(scene, { width: 400, height: 200, size: 20 });
  close(Matter.Bounds.create(icon.vertices).max.y, scene.height);
  assert.ok(icon.isSleeping);
});
