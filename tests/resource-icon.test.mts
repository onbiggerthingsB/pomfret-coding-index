import test from "node:test";
import assert from "node:assert/strict";
import { iconHost, resourceMonogram } from "../lib/resource-icon.ts";

test("GitHub projects skip the shared host favicon and have a deterministic fallback", () => {
  assert.equal(iconHost("https://github.com/example/alpha"), null);
  assert.equal(iconHost("https://www.github.com/example/beta/tree/main"), null);
  assert.equal(resourceMonogram("Alpha", "one"), resourceMonogram("Alpha", "one"));
  assert.notEqual(resourceMonogram("Alpha", "one"), resourceMonogram("Beta", "two"));
});

test("product sites retain favicon lookup and malformed URLs fall back", () => {
  assert.equal(iconHost("https://react.dev/learn"), "react.dev");
  assert.equal(iconHost("https://github.com"), "github.com");
  assert.equal(iconHost("https://github.com.evil.test/example/repo"), "github.com.evil.test");
  for (const url of ["broken", "javascript:alert(1)", "file:///tmp/icon", "ftp://example.com/icon"]) {
    assert.equal(iconHost(url), null);
  }
});

test("fallback markup never interpolates hostile names or identity as markup", () => {
  const svg = resourceMonogram('<script onload="alert(1)">&bad', '<img src=x onerror=alert(1)>');
  assert.equal((svg.match(/<text /g) ?? []).length, 1);
  assert.doesNotMatch(svg, /<script|<img|onload=|onerror=|&bad/);
  assert.match(resourceMonogram("😀", "emoji"), />\?<\/text>/);
});
