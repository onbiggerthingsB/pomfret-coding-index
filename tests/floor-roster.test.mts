import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getFloorRoster } from "../lib/floor-roster.ts";
import { getFeaturedResources, getResource } from "../lib/resources.ts";
import { resourceIconUrl } from "../lib/resource-icon.ts";

test("the initial 360 tiles include all 108 featured resources exactly once and 252 verified community logos", () => {
  const featured = getFeaturedResources();
  const { sources, reserveSources } = getFloorRoster(featured);
  const ids: string[] = JSON.parse(readFileSync(new URL("../data/floor-community.json", import.meta.url), "utf8"));
  const logos = JSON.parse(readFileSync(new URL("../data/resource-logos.json", import.meta.url), "utf8"));
  assert.equal(featured.length, 108);
  assert.equal(sources.length, 360);
  assert.deepEqual(sources.slice(0, 108), featured.map(row => row.icon));
  assert.deepEqual(sources.slice(108), ids.slice(0, 252).map(resourceIconUrl));
  assert.deepEqual(reserveSources, ids.slice(252).map(resourceIconUrl));
  assert.equal(new Set([...sources, ...reserveSources]).size, sources.length + reserveSources.length);
  for (const id of ids) {
    assert.equal(getResource(id)?.featured, false, id);
    assert.ok(Object.hasOwn(logos, id), id);
  }
});
