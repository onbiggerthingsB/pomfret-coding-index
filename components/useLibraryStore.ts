"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createLibraryStore, emptyLibrary, withLibraryLock } from "../lib/library-storage.ts";

function createLibrarySession() {
  let library = emptyLibrary();
  const listeners = new Set<() => void>();
  const store = createLibraryStore(() => window.localStorage, withLibraryLock, value => {
    library = value;
    for (const notify of listeners) notify();
  });
  return {
    store,
    getSnapshot: () => library,
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => { listeners.delete(notify); };
    },
  };
}

let tabSession: ReturnType<typeof createLibrarySession> | undefined;
export function getLibrarySession() {
  // Each server render gets its own snapshot. In a tab, soft navigation keeps unsaved picks.
  if (typeof window === "undefined") return createLibrarySession();
  return tabSession ??= createLibrarySession();
}

export function useLibraryStore() {
  const [session] = useState(getLibrarySession);
  const { store } = session;
  const library = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const restore = () => setAvailable(store.refresh());
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("coding-index:")) store.refresh(event.key);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("pageshow", restore);
    restore();
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", restore);
    };
  }, [store]);
  return { library, available, store };
}
