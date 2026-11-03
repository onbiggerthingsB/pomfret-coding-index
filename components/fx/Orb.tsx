"use client";

import { useEffect, useRef } from "react";

type Props = { state: "idle" | "ready" | "busy"; paused: boolean };

const columns = 24;
const rows = 15;
const frameCount = columns * rows;
const loopMs = 6000;

function sheetPosition(frame: number): string {
  const x = -(frame % columns) * 100 / columns;
  const y = -Math.floor(frame / columns) * 100 / rows;
  return `translate3d(${x}%, ${y}%, 0)`;
}

// The upper layer fades between neighbours. Each sheet changes tile only
// while concealed, so the surface also moves between samples on 120 Hz screens.
function sheetFrames(upper: boolean): Keyframe[] {
  const frames: Keyframe[] = [];
  const add = (at: number, tile: number) => frames.push({
    offset: at / frameCount, transform: sheetPosition(tile % frameCount), easing: "steps(1, end)",
  });
  add(0, upper ? 1 : 0);
  for (let at = upper ? 2 : 1; at < frameCount; at += 2) add(at, at + 1);
  add(frameCount, upper ? 1 : 0);
  return frames;
}

const lowerFrames = sheetFrames(false);
const upperFrames = sheetFrames(true);
const sheetSize = { width: `${columns * 100}%`, height: `${rows * 100}%` };

export function Orb({ state, paused }: Props) {
  const lower = useRef<HTMLSpanElement>(null);
  const upper = useRef<HTMLSpanElement>(null);
  const motion = useRef<Animation[]>([]);

  useEffect(() => {
    if (!lower.current?.animate || !upper.current) return;
    const loop = { duration: loopMs, iterations: Infinity };
    const animations = [
      lower.current.animate(lowerFrames, loop),
      upper.current.animate(upperFrames, loop),
      upper.current.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], {
        duration: 2 * loopMs / frameCount, iterations: Infinity,
      }),
    ];
    for (const animation of animations) animation.pause();
    motion.current = animations;
    return () => {
      for (const animation of animations) animation.cancel();
      motion.current = [];
    };
  }, [paused]);

  useEffect(() => {
    const animations = motion.current;
    if (!animations.length) return;
    const rate = state === "busy" ? 1.5 : state === "ready" ? 1.15 : 1;
    for (const animation of animations) animation.updatePlaybackRate(rate);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      for (const animation of animations) {
        if (paused || reduced.matches || document.hidden) animation.pause();
        else animation.play();
      }
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
      <span className="orb-material">
        {paused ? (
          // A single 84px frame instead of the 360-frame sheet while motion is disabled.
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/orb/hydrogen-still.webp" alt="" width={84} height={84} style={{ width: "100%", height: "100%" }} />
        ) : <>
          <span className="orb-sheet" ref={lower} style={sheetSize} />
          <span className="orb-sheet orb-blend" ref={upper} style={sheetSize} />
        </>}
      </span>
      <svg className="orb-progress" viewBox="0 0 44 44" fill="none" focusable="false">
        <circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="29 100" />
      </svg>
      <svg className="orb-action" viewBox="0 0 20 20" fill="none" focusable="false">
        <path d="M4 10h11m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
