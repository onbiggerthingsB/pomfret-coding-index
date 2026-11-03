import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildProjectSelections } from "../scripts/project-selections.mts";
import { getResource, getResources } from "../lib/resources.ts";
import { addResource, buildProjectBrief, buildResourceBrief, canonicalResourceId, parseProject, parseSaved, readResource } from "../lib/project-brief.ts";

const ant = getResource("ant-design")!;
const repo = getResource("community-a24166629bd76570")!;
const charts = getResource("community-f8f43e49b0d97e16")!;

test("saved project identity data stays synchronized with search grouping", () => {
  const saved = JSON.parse(readFileSync(new URL("../data/project-selections.json", import.meta.url), "utf8"));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(buildProjectSelections(getResources()))), "Regenerate using scripts/project-selections.mts --write after changing catalog groups");
});

test("old repository and website picks restore as one project with all supporting links", () => {
  for (const resources of [[repo, ant, charts], [ant, repo, charts]]) {
    const project = parseProject(JSON.stringify({ goal: "Keep my goal", stack: "React", resources }));
    const saved = parseSaved(JSON.stringify(resources));
    for (const items of [project.resources, saved]) {
      assert.deepEqual(items.map(item => item.id), [ant.id, charts.id]);
      assert.equal(items[0].url, ant.url);
      assert.ok(items[0].projectLinks?.some(link => link.url === repo.url));
    }
    assert.equal(project.goal, "Keep my goal");
    assert.equal(project.stack, "React");
  }
  assert.equal(canonicalResourceId(repo.id), ant.id);
  assert.equal(readResource(repo)?.url, ant.url);
  assert.equal(addResource([ant], repo).length, 1);
  assert.equal(addResource([charts], repo).length, 2);
});

test("an old repository brief links to its project and keeps the repository destination", () => {
  const origin = "https://class.preview.example";
  const single = buildResourceBrief(repo, origin);
  assert.ok(single.startsWith("# Ant Design\n"));
  assert.ok(single.includes(origin + "/resources/" + ant.id));
  assert.ok(single.includes(repo.url));
  const combined = buildProjectBrief({ goal: "", stack: "", resources: [ant, repo, charts] }, origin);
  assert.equal((combined.match(/^### \d+\./gm) ?? []).length, 2);
  assert.equal((combined.match(/^### \d+\. Ant Design$/gm) ?? []).length, 1);
});

test("merged selections preserve extra source destinations while featured details refresh", () => {
  const old = { ...repo, sourceUrl: "https://notes.example/ant-design" };
  const restored = parseProject(JSON.stringify({ resources: [old, ant] })).resources[0];
  assert.ok(restored.projectLinks?.some(link => link.url === old.sourceUrl));
});
