"use client";

import { useEffect, useRef } from "react";
import { Orb } from "./fx/Orb";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  onClear: () => void;
  busy: boolean;
  paused: boolean;
};

export function SearchComposer({ value, onChange, onSubmit, onClear, busy, paused }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const ready = value.trim().length >= 2;

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
      data-paused={paused}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="search-composer flex w-full items-center gap-3 rounded-[5px] border border-line bg-panel/95 py-3 pl-6 pr-3 backdrop-blur-2xl focus-within:border-line-strong"
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
        onChange={(e) => onChange(e.target.value)}
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
      <span className="search-shortcuts" aria-hidden="true">
        {!busy && (ready ? <kbd className="search-enter">Enter</kbd> : !value && <kbd className="search-slash">/</kbd>)}
      </span>
      <button type="submit" disabled={busy || !ready} aria-label={busy ? "Searching" : "Search"} aria-busy={busy} className="search-submit">
        <Orb state={busy ? "busy" : ready ? "ready" : "idle"} />
      </button>
    </form>
  );
}
