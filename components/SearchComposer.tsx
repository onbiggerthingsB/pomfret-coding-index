"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Orb } from "./fx/Orb";
import { usePageMotion } from "./useMotionPreference";

const TypingGlow = dynamic(() => import("voice-glow").then((module) => module.VoiceBeam), { ssr: false });

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onClear: () => void;
  actionLabel: string;
  busy: boolean;
  paused: boolean;
  suspended?: boolean;
};

export function SearchComposer({ value, onChange, onSubmit, onClear, actionLabel, busy, paused, suspended = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const pulse = useRef({ level: 0, time: 0 });
  const ready = Boolean(value.trim() || actionLabel);
  const animate = usePageMotion(paused || suspended);

  // Sample elapsed time so the fade is the same on 60 Hz and 120 Hz screens.
  const glowLevel = () => pulse.current.level * 0.91 ** ((performance.now() - pulse.current.time) * 60 / 1000);

  // Text typed before React finished loading lives only in the DOM, so adopt it once.
  useEffect(() => {
    const typed = input.current?.value;
    if (typed && typed !== value) onChange(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = () => {
    if (!busy) onSubmit(input.current?.value ?? value);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      data-paused={!animate}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="search-composer relative flex w-full items-center gap-3 rounded-[5px] border border-line bg-panel/95 py-3 pl-6 pr-3 backdrop-blur-2xl focus-within:border-line-strong"
    >
      <label htmlFor="q" className="sr-only">Search coding resources</label>
      <input
        id="q"
        ref={input}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={300}
        value={value}
        aria-keyshortcuts="/"
        onChange={(e) => {
          if (animate) pulse.current = { level: Math.min(1, glowLevel() + 0.5), time: performance.now() };
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            onClear();
            input.current?.blur();
          }
        }}
        placeholder="What do you want to build?"
        className="min-w-0 flex-1 bg-transparent py-2 text-[18px] leading-8 tracking-[-0.01em] text-text outline-none placeholder:text-faint"
      />
      {!actionLabel && <span className="search-shortcuts" aria-hidden="true">
        {!busy && (ready ? <kbd className="search-enter">Enter</kbd> : !value && <kbd className="search-slash">/</kbd>)}
      </span>}
      <button type="submit" disabled={!ready && !busy} aria-disabled={busy || undefined} aria-label={busy ? "Searching" : actionLabel || "Search"} aria-busy={busy} className="search-submit">
        {actionLabel && <span className="search-action-label">{actionLabel}</span>}
        <Orb state={busy ? "busy" : ready ? "ready" : "idle"} paused={!animate} />
      </button>
      {animate && <TypingGlow
        aria-hidden="true"
        type="default"
        theme="dark"
        colorVariant="colorful"
        strength={0.9}
        level={glowLevel}
        processing={busy}
        paused={false}
        borderRadius={5}
        style={{ position: "absolute", inset: -1, pointerEvents: "none" }}
      >{null}</TypingGlow>}
    </form>
  );
}
