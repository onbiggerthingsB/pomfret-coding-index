import { resourceIconUrl } from "./resource-icon.ts";
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
  guidance?: Set<string>;
  frameworks?: Set<string>;
  description: string;
  words: Set<string>;
  urlWords: Set<string>;
};

type Catalog = {
  signature: string;
  resources: Resource[];
  featured: Resource[];
  byId: Map<string, Resource>;
  index: IndexedResource[];
  frequencies: Map<string, number>;
};

let catalog: Catalog | undefined;

const stopWords = new Set("a am an and anything are as at be by can could create find for from get give help how i in is it looking m me my need of on or our please re searching show something that the to use using want we website with would what which who where when that they them their people let like works work your it s ve does do did new through".split(" "));
const stackTerms = new Set([
  "react", "vue", "svelte", "angular", "solid", "nextjs", "nuxtjs", "tailwind", "bootstrap",
  "javascript", "typescript", "css", "html", "python", "rust", "java", "go", "kotlin", "swift", "php",
]);
const accessibilityTerms = new Set(["accessible", "accessibility", "a11y"]);
const interfaceObjects = new Set(["card", "button", "panel", "menu", "modal", "list", "element"]);
const aliases: Record<string, string[]> = {
  component: ["component", "ui", "designsystem"],
  modal: ["modal", "dialog"],
  dialog: ["dialog", "modal"],
  check: ["check", "audit", "testing", "verification"],
  audit: ["audit", "check", "testing"],
  login: ["login", "signin", "authentication"],
  authenticate: ["authenticate", "authentication"],
  upload: ["upload", "uploader", "uploading"],
  dragdrop: ["dragdrop", "dropzone", "drag", "draggable"],
  drop: ["drop", "dropzone", "dragdrop", "draggable"],
  pick: ["pick", "picker", "datepicker", "choose"],
  date: ["date", "datepicker", "calendar"],
  bounce: ["bounce", "spring", "physics"],
  drag: ["drag", "draggable", "gesture"],
  map: ["map", "mapping", "geospatial"],
  place: ["place", "location", "marker"],
  soccer: ["soccer", "football"],
  picture: ["picture", "image", "photo"],
  signup: ["signup", "registration", "register"],
  codebase: ["codebase", "repository", "repo", "instructions"],
  uploader: ["uploader", "upload", "picker"],
  scroll: ["scroll", "scrolling"],
  scrolling: ["scrolling", "scroll"],
  transition: ["transition", "animation"],
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
    .replace(/\b(react|vue|svelte|angular|solid)\.?js\b/g, "$1").replace(/\b(next|nuxt)\.js\b/g, "$1js")
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
  const aliasFile = path.join(process.cwd(), "data", "community-id-aliases.json");
  const signature = [...files, aliasFile].map(fileSignature).join("|");
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
        icon: resourceIconUrl(id),
      };
      byId.set(id, resource);
      canonicalUrls.add(canonical);
    }
  });

  const resources = [...byId.values()];
  // Historical links resolve to the same record without adding results to search.
  const previousIds: Record<string, string> = JSON.parse(readFileSync(aliasFile, "utf8"));
  for (const [oldId, currentId] of Object.entries(previousIds)) {
    const current = byId.get(currentId);
    if (current && !byId.has(oldId)) byId.set(oldId, current);
  }
  const index = resources.map(resource => ({
    resource,
    name: normalize(resource.name),
    names: new Set(words(resource.name)),
    tags: new Set(words([...resource.tags, resource.category, resource.kind].join(" "))),
    description: normalize(resource.description),
    words: new Set(words(resource.description)),
    guidance: resource.guidance && new Set(words(resource.guidance.bestFor)),
    frameworks: resource.guidance && new Set(words(resource.guidance.frameworks.join(" "))),
    urlWords: new Set(words(resource.url)),
  }));
  const frequencies = new Map<string, number>();
  for (const entry of index) {
    const seen = new Set([...entry.names, ...entry.tags, ...entry.words, ...(entry.guidance ?? [])]);
    for (const term of seen) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  }
  catalog = { signature, resources, featured: resources.filter(item => item.featured), byId, index, frequencies };
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

function mentions(entry: IndexedResource, term: string): boolean {
  return entry.names.has(term) || entry.tags.has(term) || !!entry.frameworks?.has(term);
}

function tokenScore(entry: IndexedResource, alternatives: string[]): number {
  let best = 0;
  for (const [index, term] of alternatives.entries()) {
    let score = 0;
    if (entry.names.has(term)) score = 18;
    else if (entry.tags.has(term) || entry.frameworks?.has(term)) score = 12;
    else if (entry.guidance?.has(term)) score = 10;
    else if (entry.words.has(term)) score = 4;
    else if (term.length >= 3) {
      for (const set of [entry.names, entry.tags]) {
        for (const word of set) {
          if (word.startsWith(term)) {
            score = 3;
            break;
          }
        }
        if (score) break;
      }
      if (!score && entry.urlWords.has(term)) score = 1;
    }
    // A synonym can score at most 0.6 × 18. A direct name or tag wins.
    if (index === 0 && score >= 12) return score;
    best = Math.max(best, index === 0 ? score : score * 0.6);
  }
  return best;
}

function planSearch(query: string, catalog: Catalog) {
  const framed = normalize(query.replace(/(^|\s)-(\w+)/g, "$1without $2"))
    .replace(/^(?:what|which) (?:tools?|libraries|resources?) (?:can|should|could) (?:i|we) use (?:to|for) /, "")
    .replace(/^(?:learn how to|help me learn how to|i m trying to|i am trying to) /, "")
    .replace(/^(?:i d like to |i would like to |can you help me )/, "")
    .replace(/\b(?:to|am|m|are|re)\s+(?:build|building|make|making|create|creating)\b/g, " ")
    .replace(/\b(?:build|building|make|making|add|adding)\s+(?:a|an|my|our)\b/g, " ")
    .replace(/\bwalk ((?:my |our |an? )?\w+) through\b/g, "$1")
    .replace(/\b(?:my|our|this|the|a|an) ([a-z0-9]+) (?:web ?site|site|webpage|app|project)\b/g, "$1")
    .replace(/\b(?:my|our|this|the) (?:web ?site|site|webpage)\b/g, " ")
    .replace(/\bsign up\b/g, "signup")
    .replace(/\b(?:sign|log) (?:in|into)\b/g, "login")
    .replace(/\bdrag (?:and |n )?drop\b/g, "dragdrop")
    .replace(/\bauthenticat(?:e|ing) (?:the )?users?\b/g, "authentication")
    .replace(/\b(?:without(?: using)?|no|not(?: built with| using| use| include)?|excluding|except|avoid|don t (?:want|use|include))\b/g, "exclude");
  const raw = words(framed);
  const excluded = new Set<string>();
  const terms = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "exclude" && i + 1 < raw.length) {
      excluded.add(raw[++i]);
      while (["and", "or"].includes(raw[i + 1]) && stackTerms.has(raw[i + 2])) {
        excluded.add(raw[i + 2]);
        i += 2;
      }
    } else if (!stopWords.has(raw[i])) terms.add(raw[i]);
  }
  const motionQuery = [...terms].some(term => ["animate", "animated", "animating", "animation", "motion"].includes(term));
  const content = [...terms].filter(term => !stackTerms.has(term));
  const subject = new Set(words(framed.split(/\b(?:that|where|with|of|for|when)\b/)[0]).filter(term => content.includes(term)));
  const interfaceMotion = motionQuery && [...terms].some(term => interfaceObjects.has(term));
  const audit = terms.has("check") && [...accessibilityTerms].some(term => terms.has(term));
  const browserTest = (terms.has("test") || terms.has("testing")) && [...terms].some(term => ["login", "checkout", "page", "form", "signup"].includes(term));
  const fileUpload = (terms.has("upload") || terms.has("uploader")) && terms.has("file");
  const loginForm = terms.has("login") && terms.has("form");
  // A classroom subject can help rank a dashboard or a test without being
  // a requirement of the general-purpose tool that implements it.
  let focus: string[] = [];
  if (browserTest) focus = ["test", "testing"];
  else if (fileUpload) focus = ["file", "upload", "uploader"];
  else if (loginForm) focus = ["form"];
  else if (terms.has("dashboard")) focus = ["dashboard"];
  else if (terms.has("debug") || terms.has("debugging")) focus = ["debug", "debugging"];
  else if (terms.size >= 3) focus = ["scroll", "scrolling", "transition"].filter(term => terms.has(term));
  return {
    excluded: [...excluded], browserTest, fileUpload, loginForm, interfaceMotion,
    contentCount: content.length,
    needsBehavior: /\b(?:that|when)\b/.test(framed) && ["bounce", "drag", "animate"].some(term => terms.has(term)),
    terms: [...terms].map(term => {
      const alternatives = audit && term === "check" ? ["audit", "check", "testing"]
        : interfaceMotion && interfaceObjects.has(term) ? [term, "element", "component", "ui", "dom", "css"]
        : Object.hasOwn(aliases, term) ? aliases[term] : [term];
      const frequency = Math.max(...alternatives.map(word => catalog.frequencies.get(word) ?? 0));
      return {
        term, alternatives, stack: stackTerms.has(term),
        subject: subject.size === 1 && subject.has(term),
        focus: focus.includes(term),
        required: focus.includes(term) || stackTerms.has(term) || accessibilityTerms.has(term),
        importance: 1 + Math.min(5, Math.log((catalog.index.length + 1) / (frequency + 1))) / 6,
      };
    }),
  };
}

/** Deterministic metadata search. Scores are ranking weights, not probabilities. */
export function searchResources(options: SearchOptions = {}): ResourceSearch {
  const current = loadCatalog();
  const query = (options.query ?? "").trim().slice(0, 300);
  const normalized = normalize(query);
  const plan = planSearch(query, current);
  const broadQuery = plan.terms.length === 1 && Object.hasOwn(aliases, plan.terms[0].term);
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(100, Math.trunc(options.limit!))) : 30;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.trunc(options.offset!)) : 0;
  const matches: ResourceResult[] = [];

  for (const entry of current.index) {
    if (options.category && options.category !== "all" && entry.resource.category !== options.category) continue;
    if (options.kind && options.kind !== "all" && entry.resource.kind !== options.kind) continue;
    let score = entry.resource.featured ? (plan.terms.length > 1 ? 32 : 80) : 0;
    if (query && entry.name === normalized) {
      // Names such as "No-Login Web Apps" contain ordinary search operators.
      score += broadQuery ? 60 : 1000;
    } else if (query) {
      if (!plan.terms.length && !plan.excluded.length) continue;
      if (plan.excluded.some(term => mentions(entry, term) || entry.words.has(term) || entry.guidance?.has(term))) continue;
      let eligible = true;
      let matched = 0;
      let strongAnchor = false;
      for (const {term, required, alternatives, stack, subject, importance, focus} of plan.terms) {
        if (stack && !mentions(entry, term)) {
          eligible = false;
          break;
        }
        const weight = tokenScore(entry, alternatives);
        if (required && !weight) {
          eligible = false;
          break;
        }
        if (!weight) continue;
        if (!stack) {
          matched++;
          if ((focus || subject) && weight >= 6 && !plan.needsBehavior) strongAnchor = true;
        }
        score += (weight + 8) * importance;
        if (subject) score += weight;
        if (focus && mentions(entry, term)) score += 14;
      }
      // A framework alone cannot satisfy an unknown feature request. A single
      // specific subject (e.g. a chart of soccer scores) can supply a useful tool.
      if (!eligible || (matched < Math.min(2, plan.contentCount) && !strongAnchor)) continue;
      if (entry.name.includes(normalized)) score += broadQuery ? 20 : 45;
      if (entry.description.includes(normalized)) score += 12;
      if (plan.fileUpload && (entry.tags.has("uploader") || entry.names.has("upload"))) score += 20;
      if (plan.browserTest) {
        const browserAutomation = entry.tags.has("browser") && entry.tags.has("automation");
        if (matched === 1 && !browserAutomation) continue;
        if (browserAutomation) score += 35;
        else if (entry.resource.kind === "library" && entry.tags.has("testing") && entry.tags.has("component")) score += 12;
      }
      if (plan.interfaceMotion && entry.resource.category === "motion" && entry.resource.kind === "library") score += 18;
      if ((plan.fileUpload || plan.loginForm) && entry.resource.category === "components") score += 30;
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
