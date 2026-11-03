import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProject, parseSaved, addResource, buildProjectBrief, loadLibraryState } from "../lib/project-brief.ts";
import type { Resource } from "../lib/resources.ts";

const resource: Resource = { id: "example", name: "Example UI", url: "https://example.com/ui", description: "Components for forms", category: "components", tags: ["react"], kind: "library", sourceUrl: "https://example.com/docs", origin: "curated", featured: true, icon: "/api/resource-icon/example" };

test("corrupt saved links cannot erase an independently valid project kit", () => {
  const restored = loadLibraryState(key => key === "coding-index:saved" ? "corrupt" : JSON.stringify({ goal: "Keep my real project", stack: "React", resources: [resource] }));
  assert.equal(restored.project.goal, "Keep my real project");
  assert.equal(restored.project.resources.length, 1);
  assert.deepEqual(restored.saved, []);
});

test("a failed project read never enables persistence over unread data", () => {
  const restored = loadLibraryState(key => { if (key === "coding-index:project") throw new Error("storage denied"); return JSON.stringify([resource]); });
  assert.equal(restored.projectHydrated, false);
  assert.equal(restored.saved.length, 1);
});

test("restoring corrupt browser storage gives a usable empty project", () => {
  assert.deepEqual(parseProject("broken"), { goal: "", stack: "", resources: [] });
  assert.deepEqual(parseProject('{"resources":[{"id":"bad","url":"javascript:alert(1)"}]}').resources, []);
});

test("adding the same resource twice preserves one selection", () => {
  const next = addResource(addResource([], resource), resource);
  assert.equal(next.length, 1);
  assert.equal(next[0].id, "example");
});

test("saved links and project picks keep valid project destinations and internal tool IDs", () => {
  const repository = { label: "GitHub", url: "https://github.com/example/ui" };
  const charts = { name: "Example Charts", id: "example-charts" };
  const entry = { ...resource,
    projectLinks: [repository, null, { label: "bad", url: "javascript:alert(1)" }, { label: "bad", url: "https://user:secret@example.com/" }],
    relatedTools: [charts, { name: "bad", id: "../outside" }, { name: "bad", id: "//other.example" }],
  };
  for (const restored of [parseProject(JSON.stringify({ resources: [entry] })).resources, parseSaved(JSON.stringify([entry]))]) {
    assert.deepEqual(restored[0].projectLinks, [repository]);
    assert.deepEqual(restored[0].relatedTools, [charts]);
  }
});

test("a saved project preserves its goal and valid resources but drops malformed entries", () => {
  const restored = parseProject(JSON.stringify({ goal: "Build a class dashboard", stack: "React", resources: [resource, resource, { ...resource, id: "unsafe", sourceUrl: "file:///secret" }, null] }));
  assert.equal(restored.goal, "Build a class dashboard");
  assert.equal(restored.stack, "React");
  assert.deepEqual(restored.resources.map(item => item.id), ["example"]);
});

test("a project pack bounds pasted input and selection count", () => {
  const restored = parseProject(JSON.stringify({ goal: "x".repeat(10000), stack: "y".repeat(1000), resources: Array.from({ length: 40 }, (_, index) => ({ ...resource, id: `r${index}` })) }));
  assert.ok(restored.goal.length <= 1200);
  assert.ok(restored.stack.length <= 160);
  assert.equal(restored.resources.length, 12);
});

test("the agent brief carries the actual task and sources with verification steps", () => {
  const brief = buildProjectBrief({ goal: "Build a homework dashboard", stack: "React and CSS", resources: [resource] });
  assert.match(brief, /Build a homework dashboard/);
  assert.match(brief, /React and CSS/);
  assert.match(brief, /https:\/\/example.com\/ui/);
  assert.match(brief, /https:\/\/example.com\/docs/);
  assert.match(brief, /keyboard/i);
  assert.match(brief, /existing project/i);
  assert.doesNotMatch(brief, /undefined|127\.0\.0\.1/);
});
