"use client";

import type { RefObject } from "react";
import type { Project } from "@/lib/project-brief";
import { PROJECT_LIMIT } from "@/lib/project-brief";

export function ProjectTray({ project, dropRef, onOpen, notice }: { project: Project; dropRef: RefObject<HTMLButtonElement | null>; onOpen: () => void; notice: string }) {
  return <div className="project-tray-wrap">
    <button ref={dropRef} onClick={onOpen} className="project-tray" aria-label={`Open project tray, ${project.resources.length} of ${PROJECT_LIMIT} resources`}>
      <span className="project-tray-symbol" aria-hidden="true">+</span>
      <span><strong>My project <span>{project.resources.length}/{PROJECT_LIMIT}</span></strong><small>{project.resources.length ? "Review your picks. Build an agent brief." : "Drop icons here to build your project kit."}</small></span>
      {project.resources.length > 0 && <span className="project-tray-icons" aria-hidden="true">{project.resources.slice(0, 3).map(resource => <img key={resource.id} src={resource.icon} alt="" width="27" height="27"/>)}</span>}
      <span aria-hidden="true">↗</span>
    </button>
    <p className="project-tray-notice" role="status">{notice}</p>
  </div>;
}
