import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resourceIconUrl } from "../lib/resource-icon.ts";
import { readResource } from "../lib/project-brief.ts";
import { getResource } from "../lib/resources.ts";

const readJson = (name: string) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const sources = readJson("resource-logos") as Record<string, { page: string; source: string }>;
const aliases = readJson("resource-logo-aliases") as Record<string, string>;
const root = new URL("../public/resource-logos/", import.meta.url);

test("every bundled logo belongs to a catalog resource and has a recorded source and square PNG", () => {
  assert.deepEqual(readdirSync(root).sort(), Object.keys(sources).map(id => id + ".png").sort());
  for (const [id, origin] of Object.entries(sources)) {
    assert.equal(getResource(id)?.id, id);
    assert.equal(new URL(origin.source).protocol, "https:", id);
    assert.equal(new URL(origin.page).protocol, "https:", id);
    const image = readFileSync(new URL(id + ".png", root));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", id);
    assert.equal(image.readUInt32BE(16), 128, id);
    assert.equal(image.readUInt32BE(20), 128, id);
  }
  for (const [id, mark] of Object.entries(aliases)) {
    assert.equal(getResource(id)?.id, id);
    assert.ok(!Object.hasOwn(sources, id) && Object.hasOwn(sources, mark), id);
  }
});

test("the Ant Design site and official repo share the brand but keep separate selectable and saved identities", () => {
  const site = getResource("ant-design")!;
  const repo = getResource("community-a24166629bd76570")!;
  assert.ok(sources[site.id]);
  assert.equal(aliases[repo.id], site.id);
  assert.equal(site.icon, resourceIconUrl(site.id));
  assert.notEqual(repo.icon, site.icon);
  assert.equal(readResource({ ...repo, icon: "/api/resource-icon/old?v=2" })?.icon, resourceIconUrl(repo.id));
});
