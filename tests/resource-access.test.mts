import assert from "node:assert/strict";
import { test } from "node:test";
import accessReviews from "../data/api-requirements.json" with { type: "json" };
import { buildProjectBrief, buildResourceBrief, parseProject, parseSaved } from "../lib/project-brief.ts";
import { apiKeyLabel, readRequirements } from "../lib/resource-access.ts";
import { getResource } from "../lib/resources.ts";

function entry(id: string) {
  const resource = getResource(id);
  assert.ok(resource, id);
  return resource;
}

test("each reviewed API retains its evidence when restored from a saved collection or project", () => {
  for (const [id, review] of Object.entries(accessReviews)) {
    const resource = entry(id);
    const requirements = readRequirements(review);
    assert.ok(requirements, `Invalid access review for ${id}`);
    assert.deepEqual(resource.requirements, requirements, id);
    const [saved] = parseSaved(JSON.stringify([resource]));
    const { resources: [pick] } = parseProject(JSON.stringify({ resources: [resource] }));
    assert.deepEqual(saved.requirements, requirements, id);
    assert.deepEqual(pick.requirements, requirements, id);
  }
});

test("reference and project exports distinguish keyless, conditional and authenticated APIs with provider evidence", () => {
  const examples = [
    ["community-61eca8c1b4525101", "No API key", /User-Agent/i],
    ["community-ce0d61199427e31e", "Keyless with conditions", /noncommercial/i],
    ["community-e38846b4eca76a34", "API key required", /subscription/i],
  ] as const;
  for (const [id, label, condition] of examples) {
    const resource = entry(id);
    assert.equal(apiKeyLabel(resource), label);
    const review = resource.requirements;
    assert.ok(review);
    assert.match(review.note, condition);
    assert.notEqual(resource.sourceUrl, review.sourceUrl, "fixture has distinct discovery and provider URLs");
    for (const brief of [buildResourceBrief(resource), buildProjectBrief({ goal: "Make a weather app", stack: "", resources: [resource] })]) {
      const lines = brief.split("\n");
      assert.ok(lines.some(line => line.includes(label) && line.includes(review.note)), id);
      assert.equal(lines.filter(line => line.endsWith(review.sourceUrl)).length, 1, id);
      assert.ok(lines.some(line => /access documentation/i.test(line) && line.endsWith(review.sourceUrl)), id);
      assert.ok(lines.some(line => /discovery source/i.test(line) && line.endsWith(resource.sourceUrl)), id);
    }
  }
});

test("legacy and malformed access records preserve the resource and never imply keyless access", () => {
  const resource = entry("community-ce0d61199427e31e");
  const valid = resource.requirements;
  assert.ok(valid);
  const badSource = "https://student:password@example.org/docs";
  for (const requirements of [
    undefined, { ...valid, apiKey: "free" }, { ...valid, checkedAt: "yesterday" }, { ...valid, checkedAt: "2026-02-30" }, { ...valid, note: "   " },
    { ...valid, sourceUrl: badSource }, { ...valid, sourceUrl: "javascript:alert(1)" },
  ]) {
    const legacy = { ...resource, requirements, guidance: undefined };
    const [saved] = parseSaved(JSON.stringify([legacy]));
    const { resources: [pick] } = parseProject(JSON.stringify({ resources: [legacy] }));
    for (const restored of [saved, pick]) {
      assert.equal(restored.id, resource.id);
      assert.equal(restored.requirements, undefined);
      assert.equal(apiKeyLabel(restored), "API key unverified");
    }
    const brief = buildResourceBrief(saved);
    assert.match(brief, /API key unverified/);
    assert.doesNotMatch(brief, /No API key|Keyless with conditions|access documentation|student:password|javascript:alert/i);
  }
  assert.equal(apiKeyLabel(entry("lucide")), undefined);
});
