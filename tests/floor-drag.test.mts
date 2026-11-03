import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { classifyRelease, createFloorDrag, pickFloorIcon } from "../components/floor/drag.ts";
import { createMatches } from "../components/floor/matches.ts";
import { createSwaps } from "../components/floor/swaps.ts";
import type { Scene } from "../components/floor/scene";

const bounds = { left: 100, right: 300, top: 400, bottom: 500 };

test("clicks and small pointer jitter select even over the tray", () => {
  assert.equal(classifyRelease(0, 150, 450, bounds), "select");
  assert.equal(classifyRelease(7, 150, 450, bounds), "select");
});

test("genuine drags drop inside the current viewport bounds including edges", () => {
  assert.equal(classifyRelease(7.1, 150, 450, bounds), "drop");
  assert.equal(classifyRelease(100, 100, 400, bounds), "drop");
  assert.equal(classifyRelease(100, 300, 500, bounds), "drop");
  assert.equal(classifyRelease(100, 150, 450, { ...bounds, top: 600, bottom: 700 }), "ignore");
});

test("drags outside or without a valid target never select", () => {
  for (const [x, y] of [[99, 450], [301, 450], [150, 399], [150, 501]]) {
    assert.equal(classifyRelease(100, x, y, bounds), "ignore");
  }
  assert.equal(classifyRelease(100, 150, 450, null), "ignore");
  assert.equal(classifyRelease(100, 150, 450, { ...bounds, right: 100 }), "ignore");
  assert.equal(classifyRelease(100, NaN, 450, bounds), "ignore");
});

const dt = 1000 / 180;
function gesture(offset = 0) {
  const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 }, enableSleeping: true });
  const body = Matter.Bodies.rectangle(100, 100, 20, 20, { frictionAir: 0.014 });
  Matter.Composite.add(engine.world, body);
  Matter.Sleeping.set(body, true);
  const drag = createFloorDrag(engine);
  drag.start(body, { x: 0, y: offset }, { x: 100, y: 100 + offset }, 0, 20);
  return { body, drag, engine };
}

function fling(steps: number, offset = 0) {
  const { body, drag, engine } = gesture(offset);
  for (let n = 1; n <= steps; n++) {
    drag.move({ x: 100 + 120 * n / steps, y: 100 + offset }, n * dt, true);
    Matter.Engine.update(engine, dt);
  }
  drag.finish(true);
  return body;
}

test("a faster swipe carries more momentum; grabbing the edge also turns the tile", () => {
  const slow = fling(42);
  const quick = fling(21);
  assert.ok(Matter.Body.getVelocity(quick).x > 1.8 * Matter.Body.getVelocity(slow).x);
  assert.equal(quick.angle, 0);
  assert.ok(Math.abs(fling(21, 8).angle) > 0.3);
});

test("one large pointer jump cannot stretch the spring across the screen or launch the body on release", () => {
  const { body, drag, engine } = gesture();
  drag.move({ x: 1600, y: 100 }, 8, true);
  Matter.Engine.update(engine, dt);
  assert.ok(body.position.x > 100 && body.position.x < 120);
  drag.finish(true);
  const velocity = Matter.Body.getVelocity(body);
  assert.ok(velocity.x > 12 && velocity.x <= 26.0001);
  Matter.Engine.update(engine, dt);
  assert.ok(Matter.Body.getSpeed(body) <= 26.0001);
  assert.equal(Matter.Composite.allConstraints(engine.world).length, 0);
});

test("a stationary release and a canceled gesture have no residual spring impulse on the following step", () => {
  for (const canceled of [false, true]) {
    const { body, drag, engine } = gesture(8);
    const end = { x: 240, y: 108 };
    drag.move(end, 12, true);
    Matter.Engine.update(engine, dt);
    if (!canceled) drag.move(end, 16 + 100, true);
    drag.finish(!canceled);
    const position = { ...body.position };
    const angle = body.angle;
    Matter.Engine.update(engine, dt);
    assert.deepEqual(body.position, position);
    assert.equal(body.angle, angle);
  }
});

test("paused dragging preserves the corner under the pointer without stepping the rest of the scene", () => {
  const { body, drag } = gesture(8);
  drag.move({ x: 166, y: 121 }, 32, false);
  assert.deepEqual(body.position, { x: 166, y: 113 });
  drag.finish(false);
  assert.equal(Matter.Body.getSpeed(body), 0);
});

test("a pick uses CSS pixels and the painted rotated pose, honors clipping, and ignores transparent corners", () => {
  const bodies = [Matter.Bodies.rectangle(300, 260, 20, 20), Matter.Bodies.rectangle(300, 260, 20, 20)];
  const scene = {
    bodies, added: 2, size: 20, dpr: 2, grown: new Map([[0, 1.5]]), holds: new Map([[0, { parked: true }]]),
    sharp: new Map(), pops: new Map(), atlas: { patch: () => ({}) }, box: { x: 185, y: 110, width: 50, height: 25 },
  } as unknown as Scene;
  const pose = () => ({ position: { x: 200, y: 120 }, angle: Math.PI / 2 });
  const top = pickFloorIcon(scene, { x: 192, y: 123 }, pose);
  assert.equal(top?.index, 0);
  assert.ok(Math.abs(top!.local.x - 3) < 0.0001 && Math.abs(top!.local.y - 8) < 0.0001);
  scene.box!.y = 45;
  assert.equal(pickFloorIcon(scene, { x: 192, y: 123 }, pose)?.index, 1);
  assert.equal(pickFloorIcon(scene, { x: 190, y: 110 }, pose), undefined);
  assert.equal(pickFloorIcon(scene, { x: 400, y: 240 }, pose), undefined);
});

function slotFixture(count: number) {
  const bodies = Array.from({ length: count }, (_, i) => Matter.Bodies.rectangle(10 + i * 20, 650, 20, 20));
  const img = { complete: false, addEventListener() {} } as unknown as HTMLImageElement;
  const scene = {
    bodies, added: count, srcs: bodies.map((_, i) => `tile-${i}`), images: [], tiles: [], holds: new Map(), grown: new Map(),
    pops: new Map(), sharp: new Map(), size: 20, bigSize: 80, width: 500, height: 700,
    animate: true, scroll: 0, now: 1000, retile() {}, ensureImage: () => img,
  } as unknown as Scene;
  return { scene, img };
}

test("a pending swap invalidates the affected slot while its original resource is still present", () => {
  for (const kind of ["tick", "finish", "paused"]) {
    const { scene, img } = slotFixture(2);
    const invalidated: string[] = [];
    const swaps = createSwaps(scene, () => false, i => invalidated.push(scene.srcs[i]), { swaps: 0 });
    scene.animate = kind !== "paused";
    swaps.swapIn(1, img, "replacement", 0);
    if (kind !== "paused") assert.deepEqual(invalidated, []);
    if (kind === "tick") swaps.run(scene.pops.get(1)!.t0 + 155);
    if (kind === "finish") swaps.finish();
    assert.deepEqual(invalidated, ["tile-1"]);
    assert.deepEqual(scene.srcs, ["tile-0", "replacement"]);
    swaps.stop();
  }
});

test("a result claim, scroll, relayout, retirement and release invalidate the held slot before repositioning it", () => {
  const { scene, img } = slotFixture(48);
  scene.animate = false;
  const seen: number[] = [];
  const invalidate = (i: number) => { if (i === 0) seen.push(scene.bodies[i].position.y); };
  const overlays = {
    assign: (i: number) => i, frame() {}, scroll() {}, fade() {}, move() {},
  } as unknown as Parameters<typeof createMatches>[1];
  const swaps = createSwaps(scene, () => false, invalidate, { swaps: 0 });
  const matches = createMatches(scene, overlays, swaps, () => img, invalidate);
  const rows = scene.srcs.map(src => ({ src, probability: 1, title: src }));
  matches.select(rows, () => ({ x: 250, above: 380 }));
  matches.tick(1);
  assert.deepEqual(seen, [650]);
  const heldY = scene.bodies[0].position.y;
  assert.ok(matches.scrollBy(20, 200, 250));
  matches.tick(2);
  assert.deepEqual(seen, [650, heldY]);
  assert.equal(scene.bodies[0].position.y, heldY - 20);
  matches.relayout();
  assert.equal(seen.at(-1), heldY - 20);
  seen.length = 0;
  assert.ok(matches.scrollBy(1000, 200, 250));
  matches.tick(3);
  scene.now += 200;
  matches.tick(4);
  assert.equal(seen.length, 2); // scroll followed by retirement
  assert.equal(scene.holds.has(0), false);
  seen.length = 0;
  matches.select(rows, () => ({ x: 250, above: 380 }));
  matches.tick(5);
  seen.length = 0;
  const beforeRelease = scene.bodies[0].position.y;
  matches.release();
  assert.deepEqual(seen, [beforeRelease]);
  assert.notEqual(scene.bodies[0].position.y, beforeRelease);
  swaps.stop();
});

test("a delayed image from a retired launch cannot replace or free the current reservation, even after revisiting the same rank", () => {
  const { scene } = slotFixture(1);
  const images: HTMLImageElement[] = [];
  const load = () => {
    const img = { complete: false, addEventListener() {} } as unknown as HTMLImageElement;
    images.push(img);
    return img;
  };
  const noop = () => {};
  const overlays = { assign: () => 0, frame: noop, scroll: noop, fade: noop } as unknown as Parameters<typeof createMatches>[1];
  const swaps = createSwaps(scene, () => false, noop, { swaps: 0 });
  const matches = createMatches(scene, overlays, swaps, load, noop);
  const rows = Array.from({ length: 60 }, (_, i) => ({ src: `result-${i}`, title: "result", probability: 1 }));
  const select = () => matches.select(rows, () => ({ x: 250, above: 380 }));
  select();
  matches.tick(1);
  const first = images[0];
  const scroll = (dy: number, frame: number) => {
    assert.ok(matches.scrollBy(dy, 200, 250));
    scene.now += 220;
    matches.tick(frame);
  };
  scroll(1500, 2);
  assert.equal(images.length, 2);
  const oldEvent = new Event("load");
  first.onload!(oldEvent);
  assert.equal(scene.pops.size, 0);
  // Give the second rank an animation still waiting to commit and retire it.
  images[1].onload!(oldEvent);
  assert.equal(scene.pops.size, 1);
  scroll(-1500, 3);
  assert.equal(scene.pops.size, 0);
  assert.equal(images.length, 3);
  first.onerror!(oldEvent);
  first.onload!(oldEvent);
  assert.equal(scene.pops.size, 0);
  images[2].onload!(oldEvent);
  assert.equal(scene.pops.get(0)!.src, "result-0");
  matches.release();
  swaps.run(performance.now() + 1000);
  assert.deepEqual(scene.srcs, ["tile-0"]);
  assert.equal(scene.holds.size, 0);
  swaps.stop();
});
