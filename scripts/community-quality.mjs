// Apply the same editorial rules to a saved catalog and to newly imported lists.
// Dated destination findings live alongside the source manifests in data/.
const navigationLabels = /^(?:here|click here|read more|other resources|more information|official website|see below|this repo)$/i;
const eventSections = new Set(["meetups", "conferences", "socials", "companies using vue.js"]);
const indexSections = new Set(["list of licenses", "important note on prs:", "learn more about public apis", "skills paths for other ai coding assistants"]);
const githubRoutes = new Set(["about", "apps", "collections", "enterprise", "events", "explore", "features", "marketplace", "orgs", "organizations", "readme", "search", "settings", "sponsors", "topics", "users"]);

// This reproduces the original import identity. Preserve it for saved kits
// even when the navigable URL needs its original slash, fragment or a repair.
export function importIdentity(href) {
  const url = new URL(href);
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

export function repositoryName(url) {
  if (url.hostname !== "github.com") return null;
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo || githubRoutes.has(owner.toLowerCase())) return null;
  return `${owner}/${repo.replace(/\.git$/i, "")}`.toLowerCase();
}

function resolveRepository(url, aliases) {
  const repo = repositoryName(url);
  if (repo && aliases[repo]) {
    url.pathname = url.pathname.replace(/^\/[^/]+\/[^/]+/, `/${aliases[repo]}`);
  }
  return repo;
}

function destinationKey(url, aliases) {
  const repo = repositoryName(url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (repo && parts.length === 2) return `github.com/${(aliases[repo] ?? repo).toLowerCase()}`;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.host.replace(/^www\./, "") + url.pathname.replace(/\/+$/, "") + url.search;
}

function editorialReason(entry, url) {
  const host = url.hostname.replace(/^www\./, "");
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !host.includes(".") || /\.(?:invalid|localhost|local|test|example)$/.test(host)) return "invalid destination";
  const tags = entry.tags;
  if (tags.some(tag => indexSections.has(tag)) || navigationLabels.test(entry.name) || /^\[[^\]]+$/.test(entry.name)
    || (entry.sourceUrl.includes("brunopulis/awesome-a11y/") && url.pathname.includes("/topics/"))) return "source navigation or appendix";
  if (tags.some(tag => eventSections.has(tag)) || (host === "meetup.com" && !url.pathname.startsWith("/api"))
    || /^(?:chat\.whatsapp\.com|t\.me|telegram\.me|bsky\.app|slackin\.xyz)$/.test(host)
    || (host.endsWith(".slack.com") && url.pathname === "/")) return "event listing, profile or chat invitation";
  if (tags.includes("spirituality & esoterica") || /\b(?:sports[ -]betting|social casino|memecoin launchpad)\b/i.test(entry.name)
    || /^(?:4chan|Premium Poker Tools)$/i.test(entry.name) || /^binance\/(?:spot|meme-rush|derivatives-trading)/i.test(entry.name)) return "outside classroom project scope";
  if (/^\/(?:login|sign-in|checkout)\/?$/i.test(url.pathname)) return "account gate without a resource";
  return null;
}

export function curateCommunity(entries, featured, review) {
  const aliases = review.repositoryAliases;
  const destinations = new Map();
  const repositoryFindings = new Map();
  for (const [reason, urls] of Object.entries(review.destinations)) for (const url of urls) destinations.set(url, reason);
  for (const [reason, repos] of Object.entries(review.repositories)) {
    for (const name of repos) {
      const repo = name.toLowerCase();
      repositoryFindings.set(repo, reason);
      if (aliases[repo]) repositoryFindings.set(aliases[repo].toLowerCase(), reason);
    }
  }
  const seen = new Set(featured.map(entry => destinationKey(new URL(entry.url), aliases)));
  const kept = [];
  const removed = {};
  for (const original of entries) {
    const identity = URL.canParse(original.url) ? importIdentity(original.url) : original.url;
    const repair = review.repairs[identity];
    const href = repair ?? original.url;
    const url = URL.canParse(href) ? new URL(href) : null;
    const repo = url && resolveRepository(url, aliases);
    const details = url && review.resourceDetails?.[importIdentity(url.href)];
    let entry = url && (details || repair || url.href !== original.url) ? { ...original, ...details, url: url.href } : original;
    let reason = url ? editorialReason(entry, url) : "invalid destination";
    if (!reason && !repair) reason = destinations.get(identity);
    if (!reason && repo) {
      const finding = repositoryFindings.get(repo);
      // Frozen examples, books, datasets and icon assets can still be useful.
      // An archived package, however, is a poor dependency recommendation.
      const installable = ["library", "tool", "skills"].includes(entry.kind) && entry.category !== "icons";
      if (finding !== "archived package repository" || installable) reason = finding;
      if (aliases[repo] && entry.name.toLowerCase() === repo) {
        entry = {
          ...entry, name: aliases[repo],
          description: entry.description.replace(`Explore ${entry.name} in `, `Explore ${aliases[repo]} in `),
        };
      }
    }
    if (!reason) {
      const key = destinationKey(url, aliases);
      if (seen.has(key)) reason = "duplicate destination";
      else seen.add(key);
    }
    if (reason) removed[reason] = (removed[reason] ?? 0) + 1;
    else kept.push(entry);
  }
  return { kept, removed };
}

// Only migrate IDs when a previously published destination is still represented.
// Chasing the previous target here keeps the saved aliases direct across imports.
export function communityIdAliases(previous, current, review, existing) {
  const ids = new Set(current.map(entry => entry.id));
  const byDestination = new Map(current.map(entry => [
    destinationKey(new URL(entry.url), review.repositoryAliases), entry.id,
  ]));
  const aliases = new Map();
  for (const entry of previous) {
    if (ids.has(entry.id) || !URL.canParse(entry.url)) continue;
    const url = new URL(review.repairs[importIdentity(entry.url)] ?? entry.url);
    resolveRepository(url, review.repositoryAliases);
    const target = byDestination.get(destinationKey(url, review.repositoryAliases));
    if (target) aliases.set(entry.id, target);
  }
  for (const [oldId, formerTarget] of Object.entries(existing)) {
    if (ids.has(oldId) || aliases.has(oldId)) continue;
    const target = ids.has(formerTarget) ? formerTarget : aliases.get(formerTarget);
    if (target) aliases.set(oldId, target);
  }
  return Object.fromEntries([...aliases].sort(([a], [b]) => a.localeCompare(b)));
}
