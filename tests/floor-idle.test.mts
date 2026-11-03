import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { applyGrowth, applyHoldForces, needsPhysics } from "../components/floor/forces.ts";
import type { Hold, Scene } from "../components/floor/scene.ts";
import { SUBSTEP } from "../components/floor/timing.ts";

function sleepingFloor() {
  const bodies = [Matter.Bodies.rectangle(0, 0, 20, 20), Matter.Bodies.rectangle(10, -20, 20, 20)];
  Matter.Sleeping.set(bodies[0], true);
  return { bodies, added: 1, grown: new Map<number, number>(), holds: new Map<number, Hold>() };
}

test("a sleeping pile needs no steps until a body wakes, is grabbed or is poured in", () => {
  const scene = sleepingFloor();
  assert.equal(needsPhysics(scene), false);
  assert.equal(needsPhysics(scene, scene.bodies[0]), true);
  Matter.Sleeping.set(scene.bodies[0], false);
  assert.equal(needsPhysics(scene), true);
  Matter.Sleeping.set(scene.bodies[0], true);
  scene.added++;
  assert.equal(needsPhysics(scene), true);
});

test("a sleeping search result needs steps to lift, finish growing and shrink after release", () => {
  const scene = sleepingFloor();
  const hold: Hold = {
    rest: { x: 0, y: -20, side: 40 }, scale: 2, startY: 0, t: 0, boost: 1, rank: 0, label: 0,
    arrived: false, parked: false, labelled: false, match: { src: "/icon.svg", probability: 1, title: "Result" },
  };
  scene.holds.set(0, hold);
  scene.grown.set(0, 1);
  assert.equal(needsPhysics(scene), true);
  hold.parked = true;
  scene.grown.set(0, 1.995);
  assert.equal(needsPhysics(scene), true);
  // The solver can leave the body a fraction of a pixel short of its requested cell.
  Matter.Body.setPosition(scene.bodies[0], { x: 0, y: -19.9996 });
  const motionScene = { ...scene, scroll: 0, dirty: false, sharp: new Map() } as Scene;
  for (let i = 0; i < 12; i++) {
    applyGrowth(motionScene, 1 / 3);
    applyHoldForces(motionScene, SUBSTEP);
  }
  assert.equal(scene.grown.get(0), hold.scale);
  assert.equal(needsPhysics(scene), false);
  scene.holds.clear();
  assert.equal(needsPhysics(scene), true);
  scene.grown.clear();
  assert.equal(needsPhysics(scene), false);
});
