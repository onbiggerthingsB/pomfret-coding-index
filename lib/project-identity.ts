import type { Resource } from "./resources.ts";

type Entry = { resource: Resource; url: URL };
type ProjectLink = { id: string; label: string };

function brand(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function projectPath(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return host + (host === "github.com" ? path.toLowerCase() : path + url.search);
}

function cites(source: Resource, target: URL): boolean {
  const links = [source.sourceUrl, ...(source.guidance?.sourceUrls ?? [])];
  const targetPath = projectPath(target);
  return links.some(link => projectPath(new URL(link)) === targetPath);
}

function identifiesRepository(site: Entry, repo: Entry, name: string): boolean {
  const [, owner, slug] = repo.url.pathname.split("/");
  if (brand(slug) !== name) return false;

  // The official-looking title alone cannot distinguish projects sharing a name.
  if (cites(site.resource, repo.url) || cites(repo.resource, site.url)) return true;

  const host = site.url.hostname.toLowerCase().replace(/^www\./, "");
  const path = site.url.pathname.replace(/\/+$/, "").toLowerCase();
  if (host === owner.toLowerCase() + ".github.io" && path === "/" + slug.toLowerCase()) return true;
  if (path || site.url.search) return false;

  // Require both the website's brand and the GitHub organization to corroborate
  // the exact repository name. An unrelated repo with a familiar slug is common.
  const labels = host.split(".");
  const projectDomain = brand(labels[0]);
  const hostBrand = brand(host);
  const ownerBrand = brand(owner);
  return (name === projectDomain || name === hostBrand) &&
    (ownerBrand === name || ownerBrand === hostBrand) &&
    site.resource.tags.some(tag => repo.resource.tags.includes(tag));
}

// These are cataloged lists about a named project, not its official source.
function isCommunityGuide({ resource, url }: Entry, name: string): boolean {
  const slug = url.pathname.split("/")[2].toLowerCase();
  return slug.startsWith("awesome-") && brand(slug.slice("awesome-".length)) === name &&
    resource.kind === "documentation" && resource.tags.includes("directories") &&
    resource.tags.includes("discovery") && !resource.tags.includes("programming languages") &&
    projectPath(new URL(resource.sourceUrl)) === "github.com/sindresorhus/awesome/blob/main/readme.md";
}

export function inferProjectLinks(
  resources: readonly Resource[],
  reservedIds: ReadonlySet<string>,
  knownPrimaryIds: ReadonlySet<string> = new Set(),
): Map<string, ProjectLink[]> {
  const candidates = new Map<string, { sites: Entry[]; repos: Entry[] }>();
  for (const resource of resources) {
    if (reservedIds.has(resource.id)) continue;
    const name = brand(resource.name);
    if (name.length < 3) continue;
    const url = new URL(resource.url);
    const repository = url.hostname === "github.com";
    if (repository && !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)) continue;
    if (!repository && url.pathname !== "/" && !url.hostname.endsWith(".github.io")) continue;
    const group = candidates.get(name) ?? { sites: [], repos: [] };
    (repository ? group.repos : group.sites).push({ resource, url });
    candidates.set(name, group);
  }

  const links = new Map<string, ProjectLink[]>();
  for (const [name, { sites, repos }] of candidates) {
    const matches = sites.flatMap(site => repos
      .filter(repo => identifiesRepository(site, repo, name))
      .map(repo => ({ site, repo })));
    // Multiple plausible pairs are an editorial decision.
    if (matches.length === 1) {
      const { site, repo } = matches[0];
      links.set(site.resource.id, [{ id: repo.resource.id, label: "GitHub" }]);
    }
  }

  const projects = new Map<string, string[]>();
  for (const { id, name } of resources) {
    if (!links.has(id) && !knownPrimaryIds.has(id)) continue;
    const key = brand(name);
    projects.set(key, [...(projects.get(key) ?? []), id]);
  }
  for (const [name, owners] of projects) {
    const group = candidates.get(name);
    if (!group || owners.length !== 1) continue;
    const id = owners[0];
    const aliases = links.get(id) ?? [];
    const identities = new Set([id, ...aliases.map(link => link.id)]);
    // A second site or repository with the same name makes a directory ambiguous.
    const namesakes = [...group.sites, ...group.repos.filter(repo => brand(repo.url.pathname.split("/")[2]) === name)];
    if (namesakes.some(entry => !identities.has(entry.resource.id))) continue;
    const guides = group.repos.filter(repo => !identities.has(repo.resource.id) && isCommunityGuide(repo, name));
    if (guides.length === 1) links.set(id, [...aliases, { id: guides[0].resource.id, label: "Community guide" }]);
  }
  return links;
}
