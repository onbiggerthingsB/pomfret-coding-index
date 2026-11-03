"use client";

import { useMemo, useSyncExternalStore } from "react";
import { correctedSearchPath, indexPath, parseIndexLocation, type IndexLocation } from "@/lib/index-navigation";

const changed = "coding-index:navigate";
const currentSearch = () => window.location.search;
const serverSearch = () => "";

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(changed, notify);
  };
}

export function useIndexLocation() {
  const search = useSyncExternalStore(subscribe, currentSearch, serverSearch);
  return useMemo(() => parseIndexLocation(search), [search]);
}

export function correctSearchPage(query: string, category: string, offset: number, total: number, kind = ""): boolean {
  const path = correctedSearchPath(window.location.search, query, category, offset, total, kind);
  if (!path) return false;
  window.history.replaceState({ codingIndexParent: window.history.state?.codingIndexParent }, "", path);
  window.dispatchEvent(new Event(changed));
  return true;
}

export function navigateIndex(changes: Partial<IndexLocation>, close = false) {
  const current = window.location.pathname + window.location.search;
  const next = indexPath({ ...parseIndexLocation(window.location.search), ...changes });
  if (next === current) return;
  if (close && window.history.state?.codingIndexParent === next) {
    window.history.back();
    return;
  }
  if (close) window.history.replaceState(null, "", next);
  else window.history.pushState({ codingIndexParent: current }, "", next);
  window.dispatchEvent(new Event(changed));
}
