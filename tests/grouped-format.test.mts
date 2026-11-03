import assert from "node:assert/strict";
import test from "node:test";
import { getResource, searchResources } from "../lib/resources.ts";

test("a real homepage summary does not discard the same project's reviewed library classification", () => {
  const [tailwind] = searchResources({ query: "Tailwind CSS", kind: "library" }).resources;
  assert.equal(new URL(tailwind.url).hostname, "tailwindcss.com");
  assert.equal(tailwind.category, "components");
  assert.ok(tailwind.guidance);
  assert.ok(tailwind.projectGuidanceFrom);
  const evidence = getResource(tailwind.projectGuidanceFrom);
  assert.equal(tailwind.kind, evidence?.kind);
  assert.equal(tailwind.category, evidence?.category);
  assert.ok(!tailwind.description.startsWith("Explore "));
});
