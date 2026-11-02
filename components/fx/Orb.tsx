"use client";

import { useEffect, useRef } from "react";

type Props = { state: "idle" | "ready" | "busy"; paused: boolean };

// Read the atlas from left to right. Each keyframe holds one complete sphere.
const columns = 8;
const rows = 8;
const frames: Keyframe[] = Array.from({ length: columns * rows }, (_, index) => ({
  backgroundPosition: `${(index % columns) * 100 / (columns - 1)}% ${Math.floor(index / columns) * 100 / (rows - 1)}%`,
  offset: index / (columns * rows),
  easing: "steps(1, end)",
}));
frames.push({ ...frames[0], offset: 1 });

export function Orb({ state, paused }: Props) {
  const material = useRef<HTMLSpanElement>(null);
  const motion = useRef<Animation | null>(null);

  useEffect(() => {
    if (!material.current?.animate) return;
    const animation = material.current.animate(frames, { duration: 4000, iterations: Infinity });
    animation.pause();
    motion.current = animation;
    return () => {
      animation.cancel();
      motion.current = null;
    };
  }, []);

  useEffect(() => {
    const animation = motion.current;
    if (!animation) return;
    animation.updatePlaybackRate(state === "busy" ? 2 : state === "ready" ? 1.25 : 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (paused || reduced.matches || document.hidden) animation.pause();
      else animation.play();
    };
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      reduced.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused, state]);

  return (
    <span className="search-orb" data-state={state} aria-hidden="true">
      <span className="orb-material" ref={material} style={{ backgroundSize: `${columns * 100}% ${rows * 100}%` }} />
      <svg className="orb-progress" viewBox="0 0 44 44" fill="none" focusable="false">
        <circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="29 100" />
      </svg>
      <svg className="orb-action" viewBox="0 0 20 20" fill="none" focusable="false">
        <path d="M4 10h11m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
