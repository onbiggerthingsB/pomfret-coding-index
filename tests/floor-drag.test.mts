import assert from "node:assert/strict";
import test from "node:test";
import { classifyRelease } from "../components/floor/drag.ts";

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
