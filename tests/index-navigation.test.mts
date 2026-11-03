import assert from "node:assert/strict";
import { test } from "node:test";
import { correctedSearchPath, indexPath, parseIndexLocation } from "../lib/index-navigation.ts";

test("shared filtered and paginated results can be restored with their selected resource", () => {
  const route = { query: "map & layers", category: "tools", kind: "", page: 2, resource: "mapcn", panel: "results" as const };
  assert.deepEqual(parseIndexLocation(indexPath(route).slice(1)), route);
  assert.equal(indexPath({ ...route, resource: null }), "/?q=map+%26+layers&category=tools&page=2&view=results");
});

test("format filters survive shared links, details and page corrections", () => {
  const route = { query: "animation", category: "motion", kind: "video", page: 3, panel: "results" as const, resource: "example-video" };
  assert.deepEqual(parseIndexLocation(indexPath(route).slice(1)), route);
  const corrected = correctedSearchPath(indexPath(route).slice(1), "animation", "motion", 120, 61, "video");
  assert.equal(corrected, "/?q=animation&category=motion&kind=video&page=2&view=results&resource=example-video");
  assert.equal(correctedSearchPath(indexPath(route).slice(1), "animation", "motion", 120, 61, "library"), null);
  assert.equal(parseIndexLocation("?kind=unrecognized").kind, "");
});

test("shared URL input cannot turn the resource page's return link into an external redirect", () => {
  const route = parseIndexLocation("q=javascript%3Aalert(1)&resource=..%2Fbad&view=https%3A%2F%2Fevil.example&category=bogus&page=-2");
  assert.equal(indexPath(route), "/?q=javascript%3Aalert%281%29");
  assert.equal(parseIndexLocation("?view=results").query, "");
  assert.equal(parseIndexLocation("").query, null);
});

test("an out-of-range shared page moves to the last real page and preserves the open resource and filter", () => {
  const search = "?q=map&category=tools&page=1001&view=results&resource=mapcn";
  const corrected = correctedSearchPath(search, "map", "tools", 60000, 61);
  assert.equal(corrected, "/?q=map&category=tools&page=2&view=results&resource=mapcn");
  assert.equal(correctedSearchPath(corrected!.slice(1), "map", "tools", 60, 61), null);
  for (const total of [0, 2, 60]) {
    assert.equal(correctedSearchPath(search, "map", "tools", 60000, total), "/?q=map&category=tools&view=results&resource=mapcn");
  }
});

test("a response for a previous query, filter or page cannot rewrite the current URL", () => {
  const search = "?q=icons&category=tools&page=12&view=results";
  assert.equal(correctedSearchPath(search, "old query", "tools", 660, 1), null);
  assert.equal(correctedSearchPath(search, "icons", "icons", 660, 1), null);
  assert.equal(correctedSearchPath(search, "icons", "tools", 120, 1), null);
});
