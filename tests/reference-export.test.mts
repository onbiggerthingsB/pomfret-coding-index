import assert from "node:assert/strict";
import { test } from "node:test";
import * as briefs from "../lib/project-brief.ts";
import type { Resource } from "../lib/resources.ts";

const gallery: Resource = {
  id: "example-gallery", name: "Example gallery", description: "A collection of layouts.",
  url: "https://gallery.example/", sourceUrl: "https://gallery.example/",
  category: "inspiration", kind: "gallery", tags: [], icon: "", origin: "curated", featured: true,
};

const reviewed: Resource = {
  ...gallery, name: "Example library", category: "components", kind: "library",
  url: "https://library.example/", agentUrl: "https://library.example/llms.txt",
  sourceUrl: "https://discovery.example/post",
  guidance: {
    bestFor: "Building accessible form controls.", frameworks: ["React", "TypeScript"],
    setup: "moderate", caveat: "You own updates to copied code.", checkedAt: "2026-11-02",
    sourceUrls: ["https://library.example/llms.txt", "https://library.example/docs/updates"],
  },
};

for (const mode of ["project", "reference"] as const) {
  function exportResource(resource: Resource) {
    if (mode === "project") return briefs.buildProjectBrief({ goal: "Make a form", stack: "", resources: [resource] });
    assert.equal(typeof briefs.buildResourceBrief, "function", "Single-reference copy needs a tested exporter");
    return briefs.buildResourceBrief(resource);
  }

  test(`${mode} export keeps the checked guidance, evidence and distinct link purposes`, () => {
    const output = exportResource(reviewed);
    for (const value of ["Building accessible form controls.", "React", "TypeScript", "moderate", "You own updates to copied code.", "2026-11-02"]) {
      assert.ok(output.includes(value), value);
    }
    assert.match(output, /agent.*reviewed|reviewed.*agent/i);
    assert.equal(output.split("https://library.example/llms.txt").length - 1, 1);
    assert.match(output, /(?:evidence|reviewed source).*https:\/\/library\.example\/docs\/updates/i);
    assert.match(output, /(?:discovery|original source).*https:\/\/discovery\.example\/post/i);
  });

  test(`${mode} export gives an unreviewed gallery a single website link without inventing documentation`, () => {
    const output = exportResource(gallery);
    assert.equal(output.split("https://gallery.example/").length - 1, 1);
    assert.doesNotMatch(output, /(?:documentation|agent guide|evidence):\s*https:\/\/gallery\.example/i);
    assert.match(output, /no checked compatibility guidance/i);
  });
}

test("shared entries and exports link back to the deployment that created the brief", () => {
  const origin = "https://coding.preview.example";
  const second = { ...reviewed, id: "second-entry" };
  const brief = briefs.buildProjectBrief({ goal: "Choose a form", stack: "React", resources: [reviewed, second] }, origin);
  for (const resource of [reviewed, second]) {
    assert.ok(brief.includes(`${origin}/resources/${resource.id}`));
    assert.ok(briefs.buildResourceBrief(resource, origin).includes(`${origin}/resources/${resource.id}`));
  }
  assert.equal(brief.split(`${origin}/llms.txt`).length - 1, 1);
});
