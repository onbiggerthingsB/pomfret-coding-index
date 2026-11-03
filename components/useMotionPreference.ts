"use client";

import { useSyncExternalStore, type SetStateAction } from "react";

const preferenceKey = "coding-index:motion-paused";
const changeEvent = "coding-index:motion-preference";
let inMemoryPaused = false;
let storageUnavailable = false;

export function readMotionPause(): boolean {
  if (typeof window === "undefined") return false;
  if (storageUnavailable) return inMemoryPaused;
  try { return window.localStorage.getItem(preferenceKey) === "true"; }
  catch { return inMemoryPaused; }
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", notify);
  };
}

function setPaused(update: SetStateAction<boolean>) {
  const paused = typeof update === "function" ? update(readMotionPause()) : update;
  inMemoryPaused = paused;
  try { window.localStorage.setItem(preferenceKey, String(paused)); }
  catch { storageUnavailable = true; }
  window.dispatchEvent(new Event(changeEvent));
}

export function useMotionPreference() {
  const paused = useSyncExternalStore(subscribe, readMotionPause, () => false);
  return [paused, setPaused] as const;
}

function subscribeToPage(notify: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  document.addEventListener("visibilitychange", notify);
  reduced.addEventListener("change", notify);
  return () => {
    document.removeEventListener("visibilitychange", notify);
    reduced.removeEventListener("change", notify);
  };
}

const pageAllowsMotion = () => !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Begin with a static poster so hydration never downloads animation for reduced motion. */
export function usePageMotion(paused: boolean) {
  const allowed = useSyncExternalStore(subscribeToPage, pageAllowsMotion, () => false);
  const savedPause = useSyncExternalStore(subscribe, readMotionPause, () => false);
  return allowed && !paused && !savedPause;
}
