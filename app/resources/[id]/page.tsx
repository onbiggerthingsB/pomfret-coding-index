import type { Metadata } from "next";
import { StandaloneResourceActions } from "@/components/ResourceActions";
import { indexPath, parseIndexLocation } from "@/lib/index-navigation";
import Link from "next/link";
import { ResourceAccess } from "@/components/ResourceAccess";
import { ProjectConnections } from "@/components/ProjectConnections";
import { notFound } from "next/navigation";
import { getResource, resourceCategories } from "@/lib/resources";
import styles from "./reader.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const resource = getResource(id);
  return resource ? { title: `${resource.name} · The Coding Index`, description: resource.description } : {};
}

export default async function ResourcePage({ params, searchParams }: Props) {
  const { id } = await params;
  const resource = getResource(id);
  if (!resource) notFound();
  const context = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") context.set(key, value);
  }
  const route = { ...parseIndexLocation(context.toString()), resource: null };
  const back = indexPath(route);

  const guide = resource.guidance;

  return (
    <main className={styles.reader}>
      <article className={styles.sheet} aria-labelledby="resource-title">
        <nav className={styles.navigation} aria-label="Library">
          <Link href={back}>
            <span aria-hidden="true">←</span>
            {back === "/" ? "Back to the Coding Library" : "Return to your library view"}
          </Link>
          <span className={styles.collection}>{resource.featured ? "Featured collection" : "Community index"}</span>
        </nav>

        <div className={styles.spread}>
          <header className={styles.header}>
            <div className={styles.identity}>
              <img src={resource.icon} alt="" width={68} height={68} />
              <p>{resourceCategories[resource.category]}<span>{resource.kind}</span></p>
            </div>
            <h1 id="resource-title">{resource.name}</h1>
            <p className={styles.description}>{resource.description}</p>
          </header>

          <section className={styles.actions} aria-label="Resource actions">
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className={styles.open}>
              Open {resource.projectLinks?.length ? "website" : "resource"} <span aria-hidden="true">↗</span>
            </a>
            <div className={styles.formats}>
              {resource.agentUrl && <a href={resource.agentUrl} target="_blank" rel="noopener noreferrer">Agent documentation</a>}
              <a href={`/api/resources?id=${encodeURIComponent(resource.id)}`}>Read JSON</a>
            </div>
            <StandaloneResourceActions resource={resource} projectHref={indexPath({ ...route, panel: "project" })} />
            <ProjectConnections resource={resource} route={route} />
          </section>
        </div>

        <div className={styles.spread}>
          <section className={styles.guidance} aria-labelledby="reviewed-guidance">
            <h2 id="reviewed-guidance">{guide ? "Reviewed guidance" : "Using this resource"}</h2>
            {guide ? (
              <dl className={styles.facts}>
                <div><dt>Best for</dt><dd>{guide.bestFor}</dd></div>
                <div><dt>Frameworks and formats</dt><dd>{guide.frameworks.join(", ")}</dd></div>
                <div><dt>Setup effort</dt><dd><span className={styles.setup}>{guide.setup}</span><small>Editorial estimate</small></dd></div>
                <div className={styles.caveat}><dt>Before you choose</dt><dd>{guide.caveat}</dd></div>
              </dl>
            ) : (
              <p className={styles.bodyCopy}>This entry has no reviewed setup or compatibility notes yet. Check the original resource for its requirements.</p>
            )}
            <div className={styles.access}><ResourceAccess resource={resource} /></div>
            {resource.tags.length > 0 && <section className={styles.terms} aria-labelledby="search-terms">
              <h3 id="search-terms">Useful search terms</h3>
              <ul>{resource.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>
            </section>}
          </section>

          <aside className={styles.notes} aria-label="Sources and provenance">
            {guide && <section aria-labelledby="checked-sources">
              <h2 id="checked-sources">Sources checked</h2>
              <time dateTime={guide.checkedAt}>{guide.checkedAt}</time>
              <ul>{guide.sourceUrls.map(url => <li key={url}><SourceLink url={url} /></li>)}</ul>
            </section>}
            <section aria-labelledby="entry-source">
              <h2 id="entry-source">Where this entry came from</h2>
              <p>{resource.featured ? "Selected for the class collection. Follow the original documentation for current compatibility, pricing and licensing." : "This resource was listed in a community-maintained collection."}</p>
              <SourceLink url={resource.sourceUrl} />
            </section>
          </aside>
        </div>
      </article>
    </main>
  );
}

function SourceLink({ url }: { url: string }) {
  return <a href={url} target="_blank" rel="noopener noreferrer" className={styles.source}>
    <span>{url.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span><span aria-hidden="true">↗</span>
  </a>;
}
