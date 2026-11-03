"use client";

import { useEffect, useRef, type PointerEvent, type RefObject } from "react";
import type { Project } from "@/lib/project-brief";
import { PROJECT_LIMIT } from "@/lib/project-brief";
import "./project-tray.css";

// Red and green encode a horizontal and vertical offset. The neutral center leaves the tiles in place.
const edgeMap = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
    <defs>
      <linearGradient id="x"><stop stop-color="#008080"/><stop offset=".045" stop-color="#808080"/><stop offset=".955" stop-color="#808080"/><stop offset="1" stop-color="#ff8080"/></linearGradient>
      <linearGradient id="y" x2="0" y2="1"><stop stop-color="#800080"/><stop offset=".16" stop-color="#808080" stop-opacity="0"/><stop offset=".84" stop-color="#808080" stop-opacity="0"/><stop offset="1" stop-color="#80ff80"/></linearGradient>
    </defs>
    <rect width="100" height="100" fill="url(#x)"/><rect width="100" height="100" fill="url(#y)"/>
  </svg>`,
);

function moveReflection(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType !== "mouse") return;
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  button.style.setProperty("--dock-light-x", `${event.clientX - rect.left}px`);
  button.style.setProperty("--dock-light-y", `${event.clientY - rect.top}px`);
}

function playRipple(node: HTMLSpanElement, x?: number, y?: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const animation of node.getAnimations()) animation.cancel();
  node.style.left = x === undefined ? "" : `${x}px`;
  node.style.top = y === undefined ? "" : `${y}px`;
  node.animate([
    { transform: "translate(-50%, -50%) scale(0.015)", opacity: 0 },
    { opacity: 0.95, offset: 0.12 },
    { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
  ], { duration: 780, easing: "cubic-bezier(.18,.47,.31,1)" });
}

type TrayProps = {
  project: Project;
  dropRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  notice: string;
  motionPaused?: boolean;
  additionSequence?: number;
};

export function ProjectTray({ project, dropRef, onOpen, notice, motionPaused = false, additionSequence = 0 }: TrayProps) {
  const ripple = useRef<HTMLSpanElement>(null);
  const seenAddition = useRef(additionSequence);
  useEffect(() => {
    const fresh = seenAddition.current !== additionSequence;
    seenAddition.current = additionSequence;
    const node = ripple.current;
    if (!node) return;
    if (fresh && !motionPaused) playRipple(node);
    return () => { for (const animation of node.getAnimations()) animation.cancel(); };
  }, [additionSequence, motionPaused]);

  return <div className="project-tray-wrap">
    <svg className="project-dock-filter" width="0" height="0" aria-hidden="true" focusable="false">
      <defs><filter id="project-dock-edge" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={edgeMap} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="offsets" />
        <feDisplacementMap in="SourceGraphic" in2="offsets" scale="10" xChannelSelector="R" yChannelSelector="G" />
      </filter></defs>
    </svg>
    <button ref={dropRef}
      onPointerDown={event => {
        if (motionPaused || !event.isPrimary || event.button !== 0 || !ripple.current) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        playRipple(ripple.current, event.clientX - bounds.left, event.clientY - bounds.top);
      }}
      onClick={event => {
        if (event.detail === 0 && !motionPaused && ripple.current) playRipple(ripple.current);
        onOpen();
      }}
      onPointerMove={motionPaused ? undefined : moveReflection} data-motion-paused={motionPaused} className="project-tray project-dock" aria-label={`Open project tray, ${project.resources.length} of ${PROJECT_LIMIT} resources`}>
      <span className="project-tray-symbol" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
      <span><strong>My project <span>{project.resources.length}/{PROJECT_LIMIT}</span></strong><small>{project.resources.length ? "Review your picks. Build an agent brief." : "Drop icons here to build your project kit."}</small></span>
      {project.resources.length > 0 && <span className="project-tray-icons" aria-hidden="true">{project.resources.slice(0, 3).map(resource => <img key={resource.id} src={resource.icon} alt="" width="27" height="27"/>)}</span>}
      <span className="project-dock-arrow" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 12l8-8M5 4h7v7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <span className="project-dock-lens" aria-hidden="true" />
      <span className="project-dock-ripple-mask" aria-hidden="true"><span ref={ripple} className="project-dock-ripple" /></span>
    </button>
    <p className="project-tray-notice" role="status">{notice}</p>
  </div>;
}
