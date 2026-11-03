import assert from "node:assert/strict";
import { test } from "node:test";
import { createLibraryStore, emptyLibrary, resolveFeatured } from "../lib/library-storage.ts";
import { PROJECT_LIMIT, SAVED_LIMIT } from "../lib/project-brief.ts";
import { resourceIconUrl } from "../lib/resource-icon.ts";
import type { Resource } from "../lib/resources.ts";

const item = (id: string): Resource => ({
  id, name: id, description: "A code reference", url: "https://example.org/", sourceUrl: "https://example.org/",
  kind: "tool", category: "tools", icon: resourceIconUrl(id), tags: [], featured: false, origin: "community-index",
});

function browser() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
  let previousWrite = Promise.resolve();
  function request<T>(_key: string, write: () => T) {
    const result = previousWrite.then(write);
    previousWrite = result.then(() => {}, () => {});
    return result;
  }
  const makeTab = () => {
    let snapshot = emptyLibrary();
    const store = createLibraryStore(() => storage, request, value => { snapshot = value; });
    store.refresh();
    return { ...store, state: () => snapshot };
  };
  return { storage, makeTab };
}

test("simultaneous selectors in stale tabs keep both picks and respect explicit removal", async () => {
  const { makeTab } = browser();
  const first = makeTab(), second = makeTab();
  for (const collection of ["project", "saved"] as const) {
    const [a, b] = await Promise.all([first.select(collection, item("ant"), true), second.select(collection, item("vitest"), true)]);
    assert.ok(a.changed && b.changed && a.persistent && b.persistent);
    first.refresh(`coding-index:${collection}`);
    const picks = () => collection === "saved" ? first.state().saved : first.state().project.resources;
    assert.deepEqual(picks().map(resource => resource.id).sort(), ["ant", "vitest"]);
    await Promise.all([second.select(collection, item("ant"), false), first.select(collection, item("headless"), true)]);
    first.refresh();
    assert.deepEqual(picks().map(resource => resource.id).sort(), ["headless", "vitest"]);
  }
});

test("simultaneous last-slot requests allow one pick and disclose the cap", async () => {
  const { storage, makeTab } = browser();
  for (const [collection, limit] of [["project", PROJECT_LIMIT], ["saved", SAVED_LIMIT]] as const) {
    const resources = Array.from({ length: limit - 1 }, (_, i) => item(`item-${i}`));
    storage.setItem(`coding-index:${collection}`, JSON.stringify(collection === "project" ? { resources } : resources));
    const first = makeTab(), second = makeTab();
    const outcomes = await Promise.all([first.select(collection, item("last-a"), true), second.select(collection, item("last-b"), true)]);
    assert.equal(outcomes.filter(outcome => outcome.changed).length, 1);
    assert.equal(outcomes.filter(outcome => outcome.full).length, 1);
    const reload = makeTab().state();
    assert.equal((collection === "project" ? reload.project.resources : reload.saved).length, limit);
  }
});

test("legacy bookmarks above the limit stay accessible and removable", async () => {
  const { storage, makeTab } = browser();
  const previous = Array.from({ length: SAVED_LIMIT + 1 }, (_, id) => item(`resource-${id}`));
  storage.setItem("coding-index:saved", JSON.stringify(previous));
  const tab = makeTab();
  assert.equal(tab.state().saved.length, SAVED_LIMIT + 1);
  assert.equal((await tab.select("saved", item("over-limit"), true)).full, true);
  await tab.select("saved", previous[0], false);
  assert.equal(makeTab().state().saved.length, SAVED_LIMIT);
  assert.equal(makeTab().state().saved.at(-1)?.id, previous.at(-1)?.id);
});

test("editing a legacy project in different tabs preserves its picks and independently edited fields", async () => {
  const { storage, makeTab } = browser();
  storage.setItem("coding-index:project", JSON.stringify({ goal: "Previous goal", stack: "Previous setup", resources: [item("ant")] }));
  const first = makeTab(), second = makeTab();
  assert.equal(first.state().project.goal, "Previous goal");
  assert.equal(first.writeField("goal", ""), true);
  const added = second.select("project", item("vitest"), true);
  second.writeField("stack", "React");
  await added;
  first.refresh("coding-index:stack");
  assert.equal(first.state().project.stack, "React");
  assert.equal(first.state().project.goal, "");
  assert.deepEqual(makeTab().state().project.resources.map(resource => resource.id), ["ant", "vitest"]);
});

test("unavailable storage keeps each change for the visit without overwriting unread selections", async () => {
  const { storage } = browser();
  storage.setItem("coding-index:project", JSON.stringify({ resources: [item("old")] }));
  let denied = true;
  let state = emptyLibrary();
  const store = createLibraryStore(() => { if (denied) throw Error("unavailable"); return storage; }, async (_, fn) => fn(), value => { state = value; });
  assert.equal(store.refresh(), false);
  assert.equal((await store.select("project", item("local"), true)).persistent, false);
  assert.equal(store.writeField("goal", "Keep typing"), false);
  denied = false;
  store.refresh();
  assert.deepEqual(state.project.resources.map(resource => resource.id), ["local"]);
  assert.equal(state.project.goal, "Keep typing");
  assert.match(storage.getItem("coding-index:project")!, /"old"/);
});

test("old saved and project entries use current featured guidance without changing community entries or order", () => {
  const { storage, makeTab } = browser();
  const old = item("ant-design"), community = item("community");
  storage.setItem("coding-index:saved", JSON.stringify([old, community]));
  storage.setItem("coding-index:project", JSON.stringify({ resources: [community, old] }));
  const latest = { ...old, guidance: { bestFor: "React forms", caveat: "Check bundle size", checkedAt: "2026-11-02", setup: "low" as const, frameworks: ["React"], sourceUrls: [old.url] } };
  const state = resolveFeatured(makeTab().state(), new Map([[latest.id, latest]]));
  assert.deepEqual(state.saved, [latest, community]);
  assert.deepEqual(state.project.resources, [community, latest]);
});
