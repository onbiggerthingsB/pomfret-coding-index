import { emptyProject, parseProject, parseSaved, PROJECT_LIMIT, SAVED_LIMIT } from "./project-brief.ts";
import type { Project } from "./project-brief.ts";
import type { Resource } from "./resources";

type Collection = "project" | "saved";
type Field = "goal" | "stack";
type Snapshot = { project: Project; saved: Resource[] };
type StorageAccess = Pick<Storage, "getItem" | "setItem">;
type Lock = <T>(key: string, edit: () => T) => Promise<T>;

export const emptyLibrary = (): Snapshot => ({ project: emptyProject(), saved: [] });
const keyFor = (key: Collection | Field) => `coding-index:${key}`;
const fieldLimit = { goal: 1200, stack: 160 };

export function resolveFeatured(snapshot: Snapshot, featured: Map<string, Resource>): Snapshot {
  const resolve = (item: Resource) => featured.get(item.id) || item;
  return { project: { ...snapshot.project, resources: snapshot.project.resources.map(resolve) }, saved: snapshot.saved.map(resolve) };
}

// Older browsers can still serialize writes through an exclusive IndexedDB transaction.
export function withLibraryLock<T>(key: string, write: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request(key, write);
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("coding-index-write-lock", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("collections");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("collections", "readwrite");
      const request = transaction.objectStore("collections").get(key);
      let result: T;
      request.onsuccess = () => {
        try { result = write(); }
        catch (error) { transaction.abort(); reject(error); }
      };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
      transaction.oncomplete = () => { db.close(); resolve(result); };
    };
  });
}

// Each tab edits only the requested selection while holding the collection lock.
// The goal and setup have separate keys so typing is synchronous and independent.
export function createLibraryStore(access: () => StorageAccess, lock: Lock, publish: (value: Snapshot) => void) {
  let state = emptyLibrary();
  const inMemory = new Set<Collection | Field>();
  function refresh(key: string | null = null) {
    let readable = true;
    let { project, saved } = state;
    if (key === null || key === keyFor("project") || key === keyFor("goal") || key === keyFor("stack")) {
      try {
        const storage = access();
        const legacy = parseProject(storage.getItem(keyFor("project")));
        const field = (name: Field) => inMemory.has(name) ? project[name] : (storage.getItem(keyFor(name)) ?? legacy[name]).slice(0, fieldLimit[name]);
        project = { goal: field("goal"), stack: field("stack"), resources: inMemory.has("project") ? project.resources : legacy.resources };
      } catch { readable = false; }
    }
    if ((key === null || key === keyFor("saved")) && !inMemory.has("saved")) {
      try { saved = parseSaved(access().getItem(keyFor("saved"))); }
      catch { readable = false; }
    }
    state = { project, saved };
    publish(state);
    return readable;
  }

  function writeField(field: Field, value: string) {
    value = value.slice(0, fieldLimit[field]);
    try { access().setItem(keyFor(field), value); inMemory.delete(field); }
    catch { inMemory.add(field); }
    state = { ...state, project: { ...state.project, [field]: value } };
    publish(state);
    return !inMemory.has(field);
  }

  async function select(collection: Collection, resource: Resource, include: boolean) {
    const key = keyFor(collection);
    const apply = (storage?: StorageAccess) => {
      const project = storage && collection === "project" ? parseProject(storage.getItem(key)) : state.project;
      const items = collection === "project" ? project.resources : storage ? parseSaved(storage.getItem(key)) : state.saved;
      const present = items.some(item => item.id === resource.id);
      const full = include && !present && items.length >= (collection === "project" ? PROJECT_LIMIT : SAVED_LIMIT);
      let next = items;
      if (!full && include !== present) {
        next = include ? [...items, resource] : items.filter(item => item.id !== resource.id);
        try { storage?.setItem(key, JSON.stringify(collection === "project" ? { ...project, resources: next } : next)); }
        catch { inMemory.add(collection); }
      }
      state = collection === "project" ? { ...state, project: { ...state.project, resources: next } } : { ...state, saved: next };
      publish(state);
      return { full, changed: items !== next, persistent: !inMemory.has(collection) };
    };
    if (!inMemory.has(collection)) {
      try { return await lock(key, () => apply(access())); }
      catch { inMemory.add(collection); }
    }
    return apply();
  }

  return { refresh, writeField, select };
}
