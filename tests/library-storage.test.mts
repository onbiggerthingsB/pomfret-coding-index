import assert from "node:assert/strict";
import { test } from "node:test";
import { createLibraryStore, emptyLibrary, resolveLibraryResources } from "../lib/library-storage.ts";
import { PROJECT_LIMIT, SAVED_LIMIT } from "../lib/project-brief.ts";
import { resourceIconUrl } from "../lib/resource-icon.ts";
import { getCommunityMetadata } from "../lib/community-metadata.ts";
import { getLibrarySession } from "../components/useLibraryStore.ts";
import type { Resource } from "../lib/resources.ts";

const item = (id: string): Resource => ({
  id, name: id, description: "A code reference", url: "https://example.org/", sourceUrl: "https://example.org/",
  kind: "tool", category: "tools", icon: resourceIconUrl(id), tags: [], featured: false, origin: "community-index",
});

test("private SSR snapshots and a shared tab snapshot when storage is denied", async () => {
  const firstRequest = getLibrarySession();
  firstRequest.store.writeField("goal", "Private draft");
  assert.equal(getLibrarySession().getSnapshot().project.goal, "");

  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { get localStorage() { throw new Error("Access denied"); } },
  });
  try {
    const resourcePage = getLibrarySession();
    assert.equal(resourcePage.store.refresh(), false);
    let renders = 0;
    const unsubscribe = resourcePage.subscribe(() => { renders++; });
    const pick = item("local-only-resource");
    assert.equal((await resourcePage.store.select("project", pick, true)).persistent, false);
    assert.equal((await resourcePage.store.select("saved", pick, true)).persistent, false);
    assert.equal(renders, 2);
    unsubscribe();

    const projectPage = getLibrarySession();
    projectPage.store.refresh();
    assert.equal(renders, 2);
    assert.deepEqual(projectPage.getSnapshot().project.resources, [pick]);
    assert.deepEqual(projectPage.getSnapshot().saved, [pick]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
  assert.deepEqual(getLibrarySession().getSnapshot(), emptyLibrary());
});

test("saved community picks gain checked details while missing or offline picks keep their snapshots", () => {
  const weather = { ...item("community-ce0d61199427e31e"), description: "Explore Open-Meteo in Index / Environment." };
  const old = item("old-unlisted");
  const snapshot = { project: { goal: "My private forecast", stack: "Vue", resources: [old, weather] }, saved: [weather, old] };
  const offline = resolveLibraryResources(snapshot, new Map());
  assert.deepEqual(offline, snapshot);

  const { project, saved } = resolveLibraryResources(snapshot, new Map(), getCommunityMetadata);
  assert.equal(project.resources[0], old);
  assert.equal(saved[1], old);
  assert.equal(saved[0].name, "Open-Meteo");
  assert.notEqual(saved[0].description, weather.description);
  assert.ok(saved[0].guidance?.sourceUrls.includes("https://open-meteo.com/en/docs"));
  assert.equal(project.resources[1].description, saved[0].description);
  assert.equal(saved[0].requirements?.apiKey, "conditional");
  assert.equal(project.goal, snapshot.project.goal);
  assert.equal(project.stack, snapshot.project.stack);
  assert.equal(snapshot.saved[0].description, "Explore Open-Meteo in Index / Environment.");
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

test("legacy and current IDs restore as one reviewed pick and either ID can remove it", async () => {
  const old = item("community-29f09b5e1cf0f874");
  const current = item("community-31ff6e314f2a5cf3");
  const { storage, makeTab } = browser();
  for (const collection of ["project", "saved"] as const) {
    const resources = [old, item("second"), current];
    storage.setItem(`coding-index:${collection}`, JSON.stringify(collection === "project" ? { resources, goal: "Keep me" } : resources));
    const tab = makeTab();
    const snapshot = resolveLibraryResources(tab.state(), new Map(), getCommunityMetadata);
    const picks = collection === "project" ? snapshot.project.resources : snapshot.saved;
    assert.deepEqual(picks.map(pick => pick.id), [current.id, "second"]);
    assert.ok(picks[0].guidance);
    assert.equal(picks[0].icon, resourceIconUrl(current.id));
    assert.equal((await tab.select(collection, current, true)).changed, false);
    assert.equal((await tab.select(collection, old, false)).changed, true);
    const restored = makeTab().state();
    assert.deepEqual((collection === "project" ? restored.project.resources : restored.saved).map(pick => pick.id), ["second"]);
    assert.equal(restored.project.goal, "Keep me");
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
  const state = resolveLibraryResources(makeTab().state(), new Map([[latest.id, latest]]));
  assert.deepEqual(state.saved, [latest, community]);
  assert.deepEqual(state.project.resources, [community, latest]);
});
