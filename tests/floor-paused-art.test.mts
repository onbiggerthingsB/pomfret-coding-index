import assert from "node:assert/strict";
import test from "node:test";
import Matter from "matter-js";
import { createMatches } from "../components/floor/matches.ts";
import type { Scene } from "../components/floor/scene.ts";

function pendingResultArt() {
  let loaded: (() => void) | undefined;
  const image = {
    complete: false, naturalWidth: 0,
    addEventListener: (name: string, callback: () => void) => { if (name === "load") loaded = callback; },
  } as unknown as HTMLImageElement;
  const engine = Matter.Engine.create();
  const body = Matter.Bodies.rectangle(200, 800, 20, 20);
  Matter.Composite.add(engine.world, body);
  const scene: Scene = {
    engine, bodies: [body], added: 1, srcs: ["/result.svg"], images: [image], tiles: [0],
    sheet: null, sheetImg: null,
    atlas: { side: 20, layout() {}, patch: () => null, put() {}, putImage: () => false, putSheet() {}, forget() {} },
    grown: new Map(), sharp: new Map(), holds: new Map(), pops: new Map(),
    box: null, scroll: 0, width: 1440, height: 900, size: 20, bigSize: 96, midSize: 56, dpr: 1,
    now: 1000, animate: false, dirty: false, ensureImage: () => image, retile: () => {},
  };
  const overlays = {
    assign: () => 0, frame() {}, scroll() {}, fade() {}, move() {},
  } as unknown as Parameters<typeof createMatches>[1];
  const swaps = {} as Parameters<typeof createMatches>[2];
  const matches = createMatches(scene, overlays, swaps, () => image, () => {});
  matches.select([{ src: "/result.svg", probability: 1, title: "Result" }], () => ({ x: 720, above: 500 }));
  matches.tick(1);
  assert.equal(matches.holes(), 0);
  assert.ok(loaded, "the displayed result is waiting on its full-resolution art");
  scene.dirty = false;
  return { scene, matches, loaded: () => loaded!() };
}

test("late result artwork requests a repaint even after a paused scene has gone idle", () => {
  const { scene, loaded } = pendingResultArt();
  loaded();
  assert.equal(scene.dirty, true);
});

test("a late image from a released search does not wake the idle scene", () => {
  const { scene, matches, loaded } = pendingResultArt();
  matches.release();
  scene.dirty = false;
  loaded();
  assert.equal(scene.dirty, false);
});
