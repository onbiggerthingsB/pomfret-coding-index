import Link from "next/link";
import { indexPath, resourcePath, type IndexLocation } from "@/lib/index-navigation";
import type { Resource } from "@/lib/resources";
import styles from "./project-connections.module.css";

type Props = {
  resource: Resource;
  route: IndexLocation;
  onRelated?: (id: string) => void;
};

export function ProjectConnections({ resource, route, onRelated }: Props) {
  const { projectLinks = [], relatedTools = [] } = resource;
  if (!projectLinks.length && !relatedTools.length) return null;

  return <div className={styles.connections}>
    {(onRelated || projectLinks.length > 0) && <section aria-label="Project links">
      <h3>Project links</h3>
      <ul>{onRelated && <li>
        <a className={styles.primary} href={resource.url} target="_blank" rel="noopener noreferrer">
          {new URL(resource.url).hostname === "github.com" ? "GitHub repository" : "Website"} <span aria-hidden="true">↗</span>
        </a>
      </li>}{projectLinks.map(link => <li key={link.url}>
        <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden="true">↗</span></a>
      </li>)}</ul>
    </section>}
    {relatedTools.length > 0 && <section aria-label="Related tools">
      <h3>Related tools</h3>
      <ul>{relatedTools.map(tool => <li key={tool.id}>
        <Link
          prefetch={false}
          href={onRelated ? indexPath({ ...route, resource: tool.id }) : resourcePath(tool.id) + indexPath({ ...route, resource: null }).slice(1)}
          onNavigate={onRelated ? event => { event.preventDefault(); onRelated(tool.id); } : undefined}
        >{tool.name} <span aria-hidden="true">→</span></Link>
      </li>)}</ul>
    </section>}
  </div>;
}
