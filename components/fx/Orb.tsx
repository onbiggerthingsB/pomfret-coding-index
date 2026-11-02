type Props = { state: "idle" | "ready" | "busy" };

/** A small glass lens. The marks stay legible even when motion is paused. */
export function Orb({ state }: Props) {
  return (
    <span className="search-orb" data-state={state} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" focusable="false">
        {state === "busy" ? <g fill="currentColor">
          <circle cx="6.5" cy="12" r="1.45" />
          <circle cx="12" cy="12" r="1.45" />
          <circle cx="17.5" cy="12" r="1.45" />
        </g> : state === "ready" ? <path d="M5 12h13m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> :
          <ellipse cx="12" cy="12" rx="5.4" ry="9.7" transform="rotate(43 12 12)" stroke="currentColor" strokeWidth=".8" opacity=".48" />}
      </svg>
    </span>
  );
}
