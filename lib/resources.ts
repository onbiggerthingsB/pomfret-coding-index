import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

/** This module stays on the server. Client components can import its types. */
export const resourceCategories = {
  components: "UI components",
  icons: "Icons & assets",
  inspiration: "Design inspiration",
  motion: "Motion & physics",
  skills: "Agent skills",
  learning: "Articles & learning",
  tools: "Developer tools",
} as const;

export type ResourceCategory = keyof typeof resourceCategories;
export type ResourceKind = "library" | "documentation" | "gallery" | "article" | "video" | "tool" | "skills";
export const resourceKinds: ResourceKind[] = ["library", "documentation", "gallery", "article", "video", "tool", "skills"];

export interface ResourceGuidance {
  bestFor: string;
  frameworks: string[];
  setup: "low" | "moderate" | "advanced";
  caveat: string;
  checkedAt: string;
  sourceUrls: string[];
}

export type Resource = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: ResourceCategory;
  tags: string[];
  kind: ResourceKind;
  agentUrl?: string;
  sourceUrl: string;
  origin: "curated" | "community-index";
  featured: boolean;
  icon: string;
  guidance?: ResourceGuidance;
};

export type ResourceResult = Resource & { score: number };
export type ResourceSearch = {
  query: string;
  total: number;
  offset: number;
  limit: number;
  resources: ResourceResult[];
  indexed: number;
  totalFeatured: number;
};

type SearchOptions = {
  query?: string;
  category?: string;
  kind?: string;
  limit?: number;
  offset?: number;
};

type IndexedResource = {
  resource: Resource;
  name: string;
  names: Set<string>;
  tags: Set<string>;
  description: string;
  words: Set<string>;
  location: string;
};

type Catalog = {
  signature: string;
  resources: Resource[];
  featured: Resource[];
  byId: Map<string, Resource>;
  index: IndexedResource[];
};

let catalog: Catalog | undefined;

const stopWords = new Set("a am an and anything are as at be by can could create find for from get give help how i in is it looking m me my need of on or our please re searching show something that the to use using want we website with would".split(" "));
const interfaceObjects = new Set(["card", "button", "panel", "menu", "modal", "list", "element"]);
const aliases: Record<string, string[]> = {
  component: ["component", "ui", "designsystem"],
  icon: ["icon", "symbol", "pictogram"],
  animation: ["animation", "motion", "animate"],
  animate: ["animate", "animation", "motion"],
  animated: ["animated", "animation", "motion"],
  animating: ["animating", "animation", "motion"],
  motion: ["motion", "animation"],
  physics: ["physics", "matter", "simulation"],
  accessible: ["accessible", "accessibility", "a11y"],
  accessibility: ["accessibility", "accessible", "a11y"],
  a11y: ["a11y", "accessibility", "accessible"],
  skill: ["skill", "workflow", "agent"],
  testing: ["testing", "test", "playwright", "vitest", "jest"],
  test: ["test", "testing", "playwright", "vitest", "jest"],
  debug: ["debug", "debugging", "devtools"],
  debugging: ["debugging", "debug", "devtools"],
  inspiration: ["inspiration", "gallery", "showcase"],
  tutorial: ["tutorial", "learning", "course", "lesson"],
  article: ["article", "guide", "tutorial"],
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/c\+\+/g, " cpp ").replace(/c#/g, " csharp ").replace(/\.net\b/g, " dotnet ")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("s") && word.length > 4 && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(value: string): string[] {
  return normalize(value).split(/\s+/).filter(Boolean).map(stem);
}

function webUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch {
    return;
  }
}

/** Invalid or incomplete review data never earns a checked label. */
export function parseResourceGuidance(raw: unknown): ResourceGuidance | undefined {
  if (!raw || typeof raw !== "object") return;
  const value = raw as Record<string, unknown>;
  const nonempty = (item: unknown): item is string => typeof item === "string" && !!item.trim();
  if (!nonempty(value.bestFor) || !nonempty(value.caveat)
    || !Array.isArray(value.frameworks) || !value.frameworks.length || !value.frameworks.every(nonempty)
    || !["low", "moderate", "advanced"].includes(String(value.setup))
    || typeof value.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.checkedAt)
    || !Number.isFinite(Date.parse(value.checkedAt))
    || new Date(value.checkedAt).toISOString().slice(0, 10) !== value.checkedAt
    || !Array.isArray(value.sourceUrls) || !value.sourceUrls.length) return;
  const sourceUrls = value.sourceUrls.map(webUrl);
  if (sourceUrls.some(url => !url)) return;
  return {
    bestFor: value.bestFor.trim(), frameworks: value.frameworks.map(item => item.trim()),
    setup: value.setup as ResourceGuidance["setup"], caveat: value.caveat.trim(),
    checkedAt: value.checkedAt, sourceUrls: sourceUrls as string[],
  };
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  let pathname = url.pathname.replace(/\/+$/, "");
  if (url.hostname === "github.com") pathname = pathname.toLowerCase();
  return url.hostname.replace(/^www\./, "") + pathname + url.search;
}

function readCatalogFile(file: string): unknown[] {
  try {
    const contents: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(contents)) throw new Error(`Expected a resource array in ${file}`);
    return contents;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function fileSignature(file: string): string {
  try {
    const stat = statSync(file);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
}

function loadCatalog(): Catalog {
  const files = ["coding-resources.json", "community-resources.json"].map(file => path.join(process.cwd(), "data", file));
  const signature = files.map(fileSignature).join("|");
  if (catalog?.signature === signature) return catalog;

  const byId = new Map<string, Resource>();
  const canonicalUrls = new Set<string>();
  files.forEach((file, fileIndex) => {
    for (const raw of readCatalogFile(file)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const url = webUrl(item.url);
      const sourceUrl = webUrl(item.sourceUrl);
      if (!url || !sourceUrl || typeof item.name !== "string" || !item.name.trim()) continue;
      const canonical = canonicalUrl(url);
      if (canonicalUrls.has(canonical)) continue;
      const category = String(item.category) as ResourceCategory;
      const kind = String(item.kind) as ResourceKind;
      if (!Object.hasOwn(resourceCategories, category) || !resourceKinds.includes(kind)) continue;

      const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 12);
      const suppliedId = typeof item.id === "string" ? item.id.replace(/[^a-zA-Z0-9_-]/g, "-") : "";
      let id = suppliedId || `resource-${hash}`;
      if (byId.has(id)) id = `${id}-${hash}`;
      const resource: Resource = {
        id,
        name: item.name.trim(),
        url,
        sourceUrl,
        description: typeof item.description === "string" ? item.description.trim() : "",
        category,
        kind,
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 30) : [],
        agentUrl: webUrl(item.agentUrl),
        origin: fileIndex === 0 ? "curated" : "community-index",
        featured: fileIndex === 0,
        guidance: fileIndex === 0 ? parseResourceGuidance(item.guidance) : undefined,
        icon: `/api/resource-icon/${encodeURIComponent(id)}?v=2`,
      };
      byId.set(id, resource);
      canonicalUrls.add(canonical);
    }
  });

  const resources = [...byId.values()];
  const index = resources.map(resource => ({
    resource,
    name: normalize(resource.name),
    names: new Set(words(resource.name)),
    tags: new Set(words([...resource.tags, resource.category, resource.kind].join(" "))),
    description: normalize(resource.description),
    words: new Set(words(resource.description)),
    location: normalize(resource.url),
  }));
  catalog = { signature, resources, featured: resources.filter(item => item.featured), byId, index };
  return catalog;
}

export function getResources(): Resource[] {
  return loadCatalog().resources;
}

export function getFeaturedResources(): Resource[] {
  return loadCatalog().featured;
}

export function getResource(id: string): Resource | undefined {
  return loadCatalog().byId.get(id);
}

function tokenScore(entry: IndexedResource, token: string, interfaceMotion: boolean): number {
  let best = 0;
  // Element-animation libraries can apply to cards or buttons even when the
  // catalog describes their general component support instead of each shape.
  const alternatives = interfaceMotion && interfaceObjects.has(token)
    ? [token, "element", "component", "ui"]
    : aliases[token] ?? [token];
  for (const [index, alternative] of alternatives.entries()) {
    let score = 0;
    if (entry.names.has(alternative)) score = 18;
    else if (entry.tags.has(alternative)) score = 12;
    else if (entry.words.has(alternative)) score = 4;
    else if (alternative.length >= 3 && [...entry.names, ...entry.tags].some(word => word.startsWith(alternative))) score = 3;
    else if (alternative.length >= 3 && entry.location.includes(alternative)) score = 1;
    best = Math.max(best, index === 0 ? score : score * 0.7);
  }
  return best;
}

/** Deterministic metadata search. Scores are ranking weights, not probabilities. */
export function searchResources(options: SearchOptions = {}): ResourceSearch {
  const current = loadCatalog();
  const query = (options.query ?? "").trim().slice(0, 300);
  const normalized = normalize(query);
  // Remove request framing while retaining meaningful searches such as
  // "build tools" and "building simulation".
  const searchable = normalized
    .replace(/\b(?:to|am|m|are|re)\s+(?:build|building|make|making|create|creating)\b/g, " ")
    .replace(/\b(?:build|building|make|making)\s+(?:a|an|my|our)\b/g, " ");
  const tokens = [...new Set(words(searchable).filter(word => !stopWords.has(word)))];
  const interfaceMotion = tokens.some(token => ["animate", "animated", "animating", "animation", "motion"].includes(token));
  const broadQuery = tokens.length === 1 && Object.hasOwn(aliases, tokens[0]);
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, Math.trunc(options.limit!))) : 30;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.trunc(options.offset!)) : 0;
  const matches: ResourceResult[] = [];

  for (const entry of current.index) {
    if (options.category && options.category !== "all" && entry.resource.category !== options.category) continue;
    if (options.kind && options.kind !== "all" && entry.resource.kind !== options.kind) continue;
    // Broad queries should lead with the class's selected starting points.
    let score = entry.resource.featured ? 80 : 0;
    if (query) {
      if (!tokens.length) continue;
      const scores = tokens.map(token => tokenScore(entry, token, interfaceMotion));
      if (scores.some(weight => weight === 0)) continue;
      score += scores.reduce((sum, weight) => sum + weight, 0);
      if (entry.name === normalized) score += broadQuery ? 60 : 150;
      else if (entry.name.includes(normalized)) score += broadQuery ? 20 : 45;
      if (entry.description.includes(normalized)) score += 12;
    }
    matches.push({ ...entry.resource, score: Math.round(score * 10) / 10 });
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"));
  return {
    query,
    total: matches.length,
    offset,
    limit,
    resources: matches.slice(offset, offset + limit),
    indexed: current.resources.length,
    totalFeatured: current.featured.length,
  };
}
