import Link from "next/link";
import { notFound } from "next/navigation";
import { getResource, resourceCategories } from "@/lib/resources";

export const dynamic = "force-dynamic";

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = getResource(id);
  if (!resource) notFound();

  return (
    <main className="fixed inset-0 overflow-y-auto bg-ink px-6 py-10 text-text sm:py-16">
      <article className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Back to the Coding Library</Link>
        <header className="mt-12">
          <p className="text-sm text-muted">{resourceCategories[resource.category]} · {resource.kind}</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">{resource.name}</h1>
          <p className="mt-6 text-lg leading-8 text-muted">{resource.description}</p>
        </header>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="rounded-md bg-text px-5 py-3 text-sm font-medium text-ink">Open resource</a>
          {resource.agentUrl && <a href={resource.agentUrl} target="_blank" rel="noopener noreferrer" className="rounded-md border border-line-strong px-5 py-3 text-sm">Agent documentation</a>}
          <a href={`/api/resources?id=${encodeURIComponent(resource.id)}`} className="rounded-md border border-line-strong px-5 py-3 text-sm">Read JSON</a>
        </div>
        {resource.guidance && (
          <section className="mt-12 border-t border-line pt-6" aria-labelledby="reviewed-guidance">
            <h2 id="reviewed-guidance" className="text-base font-medium">Reviewed guidance</h2>
            <p className="mt-2 text-sm text-muted">Documentation checked {resource.guidance.checkedAt}. Setup level is an editorial estimate, not a runtime compatibility test.</p>
            <dl className="mt-5 space-y-4 text-sm leading-6">
              <div><dt className="font-medium">Best for</dt><dd className="text-muted">{resource.guidance.bestFor}</dd></div>
              <div><dt className="font-medium">Frameworks and formats</dt><dd className="text-muted">{resource.guidance.frameworks.join(", ")}</dd></div>
              <div><dt className="font-medium">Setup</dt><dd className="capitalize text-muted">{resource.guidance.setup}</dd></div>
              <div><dt className="font-medium">Before you choose</dt><dd className="text-muted">{resource.guidance.caveat}</dd></div>
            </dl>
            <ul className="mt-5 space-y-2">
              {resource.guidance.sourceUrls.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm underline underline-offset-4">{url}</a></li>)}
            </ul>
          </section>
        )}
        <section className="mt-12 border-t border-line pt-6">
          <h2 className="text-base font-medium">Useful search terms</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {resource.tags.map(tag => <li key={tag} className="rounded-md border border-line px-3 py-1.5 text-sm text-muted">{tag}</li>)}
          </ul>
        </section>
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-base font-medium">Where this entry came from</h2>
          <p className="mt-3 text-sm leading-6 text-muted">{resource.featured ? "Featured in the class collection. Follow the resource's own documentation for current compatibility, pricing and licensing." : "Imported from a community-maintained collection. Review the original source and project before using it."}</p>
          <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block max-w-full break-all text-sm underline underline-offset-4">{resource.sourceUrl}</a>
        </section>
      </article>
    </main>
  );
}
