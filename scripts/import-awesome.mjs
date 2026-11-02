import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This importer records references to public resources. It does not download
// packages, execute their instructions, or assert that listed software is safe.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(projectRoot, "data");
const sources = [
  ["sindresorhus/awesome", "main", "readme.md", "learning", ["directories", "discovery"]],
  ["sindresorhus/awesome-nodejs", "main", "readme.md", "tools", ["nodejs", "javascript", "backend"]],
  ["vinta/awesome-python", "master", "README.md", "tools", ["python"]],
  ["avelino/awesome-go", "main", "README.md", "tools", ["go", "backend"]],
  ["sorrycc/awesome-javascript", "master", "README.md", "tools", ["javascript", "web"]],
  ["enaqx/awesome-react", "master", "README.md", "components", ["react", "frontend", "components"]],
  ["vuejs/awesome-vue", "master", "README.md", "components", ["vue", "frontend", "components"]],
  ["jondot/awesome-react-native", "master", "README.md", "components", ["react-native", "mobile"]],
  ["dzharii/awesome-typescript", "master", "README.md", "tools", ["typescript", "javascript"]],
  ["sindresorhus/awesome-electron", "main", "readme.md", "tools", ["electron", "desktop"]],
  ["bradtraversy/design-resources-for-developers", "master", "readme.md", "inspiration", ["design", "frontend", "ui"]],
  ["awesome-css-group/awesome-css", "master", "README.md", "components", ["css", "styling", "frontend"]],
  ["brunopulis/awesome-a11y", "main", "README.md", "learning", ["accessibility", "a11y"]],
  ["EbookFoundation/free-programming-books", "main", "books/free-programming-books-langs.md", "learning", ["books", "programming"]],
  ["EbookFoundation/free-programming-books", "main", "books/free-programming-books-subjects.md", "learning", ["books", "computer-science"]],
  ["EbookFoundation/free-programming-books", "main", "courses/free-courses-en.md", "learning", ["courses", "programming"]],
  ["EbookFoundation/free-programming-books", "main", "casts/free-podcasts-screencasts-en.md", "learning", ["videos", "podcasts", "programming"]],
  ["Practical-Tutorials/project-based-learning", "master", "README.md", "learning", ["projects", "tutorials", "ideas"]],
  ["codecrafters-io/build-your-own-x", "master", "README.md", "learning", ["projects", "tutorials", "ideas"]],
  ["public-apis/public-apis", "master", "README.md", "tools", ["api", "data", "integrations"]],
  ["steven2358/awesome-generative-ai", "main", "README.md", "tools", ["ai", "generative-ai"]],
  ["Shubhamsaboo/awesome-llm-apps", "main", "README.md", "inspiration", ["ai", "agents", "projects"]],
  ["punkpeye/awesome-mcp-servers", "main", "README.md", "tools", ["mcp", "agents", "integrations"]],
  ["VoltAgent/awesome-agent-skills", "main", "README.md", "skills", ["agents", "skills"]],
  ["anthropics/skills", "main", "README.md", "skills", ["agents", "skills"]],
  ["github/awesome-copilot", "main", "README.md", "skills", ["agents", "copilot", "skills"]],
  ["sindresorhus/awesome-npm", "main", "readme.md", "tools", ["npm", "javascript", "packages"]],
  ["TheJambo/awesome-testing", "master", "README.md", "learning", ["testing", "quality"]],
  ["rust-unofficial/awesome-rust", "main", "README.md", "tools", ["rust", "systems"]],
  ["akullpp/awesome-java", "master", "README.md", "tools", ["java", "backend"]],
  ["awesome-selfhosted/awesome-selfhosted", "master", "README.md", "tools", ["self-hosted", "applications", "deployment"]],
  ["TheComputerM/awesome-svelte", "master", "README.md", "components", ["svelte", "frontend", "components"]],
  ["josephmisiti/awesome-machine-learning", "master", "README.md", "tools", ["machine-learning", "ai", "data"]],
  ["f/awesome-chatgpt-prompts", "main", "README.md", "skills", ["prompting", "agents"]],
  ["nikgraf/awesome-react-hooks", "master", "README.md", "components", ["react", "hooks", "frontend"]],
  ["brillout/awesome-react-components", "master", "README.md", "components", ["react", "components", "frontend"]],
];

const rejectedHosts = /(^|\.)(shields\.io|travis-ci\.org|travis-ci\.com|codecov\.io|coveralls\.io|gitter\.im|discord\.gg|discord\.com|twitter\.com|x\.com|facebook\.com|linkedin\.com|patreon\.com|opencollective\.com|buymeacoffee\.com|ko-fi\.com|star-history\.com|starchart\.cc|imgur\.com|sindresorhus\.com)$/i;
const rejectedNames = /^(?:demo|demos|docs|documentation|website|web site|source|source code|github|gitlab|license|licence|contributing|contributors|contribute|sponsor|sponsors|donate|donation|preview|examples?|download|downloads|screenshots?|playground|video|live|npm|pypi|crates\.io|stars|forks|build|coverage|contents|table of contents|readme|english|中文|日本語|한국어|português|español|français|русский)$/i;
const skippedHeadings = /^(?:translations?|sponsors?|contribut(?:e|ing|ions|ors)|licen[sc]e|star history|support(?:ers)?|donations?|related lists?|other awesome lists?|badges|credits|acknowledg(?:e)?ments)$/i;
const featureTerms = [
  ["authentication", /\bauth(?:entication|orization)?\b|\boauth\b|\bsign.in\b/i],
  ["accessibility", /\baccessib(?:le|ility)\b|\ba11y\b/i],
  ["animation", /\banimat(?:e|ed|ion|ions)\b|\bmotion\b/i],
  ["testing", /\btest(?:ing|s)?\b|\bassertions?\b/i],
  ["debugging", /\bdebug(?:ger|ging)?\b/i],
  ["database", /\bdatabases?\b|\bsql\b|\bpostgres\b/i],
  ["search", /\bsearch(?:ing)?\b|\bindex(?:ing)?\b/i],
  ["forms", /\bforms?\b|\bvalidation\b/i],
  ["charts", /\bcharts?\b|\bdata visuali[sz]ation\b/i],
  ["maps", /\bmaps?\b|\bgeospatial\b/i],
  ["images", /\bimages?\b|\bphotos?\b/i],
  ["audio", /\baudio\b|\bsound\b|\bmusic\b/i],
  ["video", /\bvideos?\b|\bstreaming\b/i],
  ["files", /\bfiles?\b|\bstorage\b/i],
  ["api", /\bapis?\b|\bgraphql\b|\brestful\b/i],
  ["deployment", /\bdeploy(?:ment|ments)?\b|\bhosting\b/i],
  ["performance", /\bperformance\b|\bprofil(?:ing|er)\b|\boptimi[sz](?:ation|e)\b/i],
  ["security", /\bsecurity\b|\bsecure\b|\bvulnerabilit(?:y|ies)\b/i],
  ["mobile", /\bmobile\b|\bandroid\b|\bios\b/i],
  ["responsive", /\bresponsive\b/i],
  ["design-system", /\bdesign systems?\b|\bui kits?\b|\bcomponent librar(?:y|ies)\b/i],
  ["editor", /\beditors?\b|\brich.text\b/i],
  ["markdown", /\bmarkdown\b|\bmdx\b/i],
  ["pdf", /\bpdf\b/i],
  ["automation", /\bautomat(?:e|ed|ion)\b|\bworkflows?\b/i],
  ["agents", /\bagents?\b|\bmcp\b/i],
  ["llm", /\bllms?\b|\blanguage models?\b/i],
  ["retrieval", /\brag\b|\bretrieval\b|\bembeddings?\b/i],
  ["git", /\bgit\b|\bgit(hub|lab)\b|\bversion control\b/i],
];

function cleanText(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function resourceUrl(raw, source) {
  if (raw.startsWith("#") || raw.startsWith("mailto:")) return null;
  let input = raw.replace(/^<|>$/g, "").replace(/\\([()])/g, "$1");
  if (!/^https?:\/\//i.test(input)) {
    if (input.startsWith("//")) input = "https:" + input;
    else {
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(source.file), input));
      if (relative.startsWith("..")) return null;
      const mode = /\.[a-z0-9]+(?:#.*)?$/i.test(relative) ? "blob" : "tree";
      input = `https://github.com/${source.repo}/${mode}/${source.branch}/${relative}`;
    }
  }
  let url;
  try { url = new URL(input); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || rejectedHosts.test(url.hostname)) return null;
  if (/\.(?:svg|png|jpe?g|gif|webp|ico|woff2?)(?:$|\?)/i.test(url.pathname)) return null;
  if (/(?:^|\/)(?:license|licence|contributing|code_of_conduct)(?:\.|\/|$)/i.test(url.pathname)) return null;
  if (url.hostname === "github.com" && /\/(?:issues|pulls|actions|stargazers|network|graphs|sponsors)(?:\/|$)/.test(url.pathname)) return null;
  if (url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length < 2) return null;
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(?:utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
  return url.href.replace(/\/$/, "");
}

function kindFor(url, topic, source, category) {
  if (/youtu\.be|youtube\.com|vimeo\.com/.test(url)) return "video";
  if (source.category === "skills") return "skills";
  if (/books|courses|tutorials/.test(source.tags.join(" "))) return "documentation";
  if (/articles?|blog|tutorial/.test(topic) || /\/(blog|articles?)\//.test(url)) return "article";
  if (category === "components" || category === "icons" || category === "motion") return "library";
  if (source.category === "inspiration") return "gallery";
  if (source.category === "learning") return "documentation";
  if (/github\.com|gitlab\.com/.test(url) || source.category === "components") return "library";
  return "tool";
}

function categoryFor(topic, source) {
  if (/\b(icon|icons|illustrations?|fonts?)\b/i.test(topic)) return "icons";
  if (/\b(animation|animations|motion|physics)\b/i.test(topic)) return "motion";
  if (/\b(components?|ui kits?|widgets?)\b/i.test(topic)) return "components";
  if (/\b(tutorials?|courses?|books?|articles?|learning|education)\b/i.test(topic)) return "learning";
  return source.category;
}

function parseResources(markdown, source) {
  const entries = [];
  const headings = [];
  const references = new Map();
  for (const line of markdown.split(/\r?\n/)) {
    const reference = line.match(/^\s*\[([^\]]+)\]:\s*(https?:\/\/\S+)/);
    if (reference) references.set(reference[1].toLowerCase(), reference[2]);
  }
  let inCode = false;
  for (let line of markdown.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inCode = !inCode; continue; }
    if (inCode) continue;
    const markdownHeading = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
    const htmlHeading = line.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
    if (markdownHeading || htmlHeading) {
      const level = markdownHeading ? markdownHeading[1].length : Number(htmlHeading[1]);
      const title = markdownHeading ? markdownHeading[2] : htmlHeading[2];
      headings.length = level;
      headings[level - 1] = cleanText(title).replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s:]+/u, "");
      continue;
    }
    if (!/^\s*(?:[-*+]\s+|\d+[.)]\s+|\|)/.test(line)) continue;
    if (headings.some(value => value && skippedHeadings.test(value))) continue;
    line = line.replace(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g, (match, label, key) => {
      const url = references.get((key || label).toLowerCase());
      return url ? `[${label}](${url})` : match;
    });
    const links = [...line.matchAll(/(?<!!)\[([^\]\n]+)\]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+"[^"]*")?\)/g)];
    for (const link of links) {
      let name = cleanText(link[1]).replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s:]+/u, "").trim();
      if (/^\.\.?\//.test(name)) name = source.repo.split("/")[0] + " " + name.replace(/^\.\.?\//, "").replace(/[-_\/]/g, " ");
      if (name.length < 2 || name.length > 180 || rejectedNames.test(name)) continue;
      const url = resourceUrl(link[2], source);
      if (!url || url === source.sourceUrl.replace(/\/$/, "")) continue;
      const topic = headings.slice(1).filter(value => value && !/^(table of )?contents$/i.test(value)).join(" / ") || source.tags.join(", ");
      const category = categoryFor(`${topic} ${name}`, source);
      const kind = kindFor(url, topic.toLowerCase(), source, category);
      const topicTags = topic.toLowerCase().split(/\s*\/\s*|\s*,\s*/).filter(tag => tag.length > 1 && tag.length < 45);
      const features = featureTerms.filter(([, pattern]) => pattern.test(cleanText(line))).map(([label]) => label);
      entries.push({
        id: "community-" + createHash("sha256").update(url.toLowerCase()).digest("hex").slice(0, 16),
        name,
        url,
        description: `Explore ${name} in ${topic}. Listed by ${source.name}.`.slice(0, 200),
        category,
        tags: [...new Set([...source.tags, ...topicTags, ...features])].slice(0, 16),
        kind,
        sourceUrl: source.sourceUrl,
        origin: "community-index",
      });
      // The primary link is the resource. Secondary demo, source and license
      // links on the same list row should not inflate the resource count.
      break;
    }
  }
  return entries;
}

async function getText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "ClassCodingLibrary/1.0 (public resource index)" }, signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function identifyLicense(text) {
  if (/Creative Commons.*?Attribution.*?ShareAlike|CC.BY.SA/i.test(text)) return "CC-BY-SA (see source for version)";
  if (/Creative Commons.*?Attribution|CC.BY\b/i.test(text)) return "CC-BY (see source for version)";
  if (/CC0|Creative Commons Zero|PUBLIC DOMAIN DEDICATION/i.test(text)) return "CC0";
  if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) return "MIT";
  if (/Apache License/i.test(text)) return "Apache-2.0";
  if (/GNU GENERAL PUBLIC LICENSE/i.test(text)) return "GPL (see source for version)";
  if (/DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE/i.test(text)) return "WTFPL";
  return "Unclassified; see source";
}

const licenseCache = new Map();
async function sourceLicense(repo, branch) {
  const key = `${repo}/${branch}`;
  if (licenseCache.has(key)) return licenseCache.get(key);
  const lookup = (async () => {
    for (const file of ["LICENSE", "license", "LICENSE.md", "LICENSE.txt"]) {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
      try { return { name: identifyLicense(await getText(url)), url: `https://github.com/${repo}/blob/${branch}/${file}` }; } catch {}
    }
    return { name: "Not detected", url: `https://github.com/${repo}` };
  })();
  licenseCache.set(key, lookup);
  return lookup;
}

async function importSource(row) {
  const [repo, requestedBranch, file, category, tags] = row;
  let markdown, branch, error;
  for (const candidate of [...new Set([requestedBranch, "main", "master"])]) {
    try {
      markdown = await getText(`https://raw.githubusercontent.com/${repo}/${candidate}/${file}`);
      branch = candidate;
      break;
    } catch (failure) { error = failure.message; }
  }
  if (!markdown) return { meta: { repo, file, status: "failed", error }, entries: [] };
  const source = { repo, branch, file, category, tags, name: repo.split("/")[1], sourceUrl: `https://github.com/${repo}/blob/${branch}/${file}` };
  const entries = parseResources(markdown, source);
  return { meta: { ...source, status: "imported", extracted: entries.length, contentSha256:createHash("sha256").update(markdown).digest("hex"), license: await sourceLicense(repo, branch) }, entries };
}

const importedAt = new Date().toISOString();
const results = [];
for (let offset = 0; offset < sources.length; offset += 6) {
  const batch = await Promise.all(sources.slice(offset, offset + 6).map(importSource));
  results.push(...batch);
  for (const result of batch) console.log(`${result.meta.status}: ${result.meta.repo}/${result.meta.file} (${result.entries.length})`);
}
const unique = new Map();
for (const result of results) {
  for (const entry of result.entries) {
    const key = entry.url.toLowerCase();
    const existing = unique.get(key);
    if (existing) existing.tags = [...new Set([...existing.tags, ...entry.tags])].slice(0, 16);
    else unique.set(key, entry);
  }
}
const entries = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
if (entries.length < 1000) throw new Error(`Only ${entries.length} resources imported; existing catalogue preserved.`);
const metadata = {
  importedAt,
  count: entries.length,
  method: "Primary resource links from public, community-curated lists. Descriptions are generated from each resource title and list section, rather than copied editorial descriptions.",
  verification: "Source documents were retrieved successfully. Individual destination links, software behavior, security, and continued availability have not been independently verified.",
  sources: results.map(result => result.meta),
};
await mkdir(dataDirectory, { recursive: true });
for (const [file, value] of [["community-resources.json", entries], ["community-sources.json", metadata]]) {
  const destination = path.join(dataDirectory, file);
  await writeFile(destination + ".tmp", JSON.stringify(value, null, 2) + "\n");
  await rename(destination + ".tmp", destination);
}
console.log(`Saved ${entries.length} unique resources from ${results.filter(result => result.meta.status === "imported").length} source documents.`);
