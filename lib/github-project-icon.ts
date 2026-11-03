import sharp from "sharp";

const RAW = "https://raw.githubusercontent.com";
const README_BYTES = 16_384;
const IMAGE_BYTES = 256_000;
const SAFE_SEGMENT = /^[a-z0-9_@.-]+$/i;
const SVG_TAGS = new Set("svg g path rect circle ellipse polygon polyline line defs linearGradient radialGradient stop title desc".split(" "));
const SVG_ATTRIBUTES = new Set(("id width height x y x1 y1 x2 y2 cx cy r rx ry fx fy d points viewBox preserveAspectRatio " +
  "fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity opacity " +
  "transform gradientUnits gradientTransform offset stop-color stop-opacity version role aria-hidden focusable").split(" "));

/** A deliberately small SVG subset for untrusted repository content. Only gradients can be referenced by ID. */
function simpleSvg(xml: string) {
  if (xml.length > 32_768 || /[&\\]/.test(xml)) return null;
  const source = xml.replace(/^\s*<\?xml\s+version=["']1\.0["'][^<>?]*\?>/i, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  // SVG is rasterized from this checked UTF-8 string; never let an XML encoding
  // declaration reinterpret the original bytes. Every markup opening must parse.
  if (!/^<svg[\s>]/.test(source) || /[^\x09\x0a\x0d\x20-\x7e]/.test(source)) return null;
  const tag = /<(\/?)([A-Za-z][\w-]*)([^<>]*)>/gy;
  let count = 0;
  for (let index = source.indexOf("<"); index !== -1; index = source.indexOf("<", tag.lastIndex)) {
    tag.lastIndex = index;
    const match = tag.exec(source);
    if (!match) return null;
    const [, closing, name, attributes] = match;
    if (!SVG_TAGS.has(name) || ++count > 512) return null;
    if (closing) {
      if (attributes.trim()) return null;
      continue;
    }
    const attr = /\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;
    let end = 0;
    for (let item = attr.exec(attributes); item; item = attr.exec(attributes)) {
      end = attr.lastIndex;
      const key = item[1], value = item[2] ?? item[3];
      if (key === "xmlns" && value === "http://www.w3.org/2000/svg") continue;
      if (key === "xmlns:xlink" && value === "http://www.w3.org/1999/xlink") continue;
      if (!SVG_ATTRIBUTES.has(key) || !/^[\w\s.,#+%():-]*$/.test(value)) return null;
      if (/url\s*\(/i.test(value) && !(/^(fill|stroke)$/.test(key) && /^url\(#[\w-]+\)$/.test(value))) return null;
    }
    if (!/^\s*\/?\s*$/.test(attributes.slice(end))) return null;
  }
  return Buffer.from(source);
}

function repository(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !/^(www\.)?github\.com$/.test(parsed.host) || parsed.username || parsed.password) return null;
  const [owner, repo] = parsed.pathname.split("/").slice(1, 3);
  if (!/^[\w-]{1,100}$/.test(owner || "") || !/^[\w.-]{1,100}$/.test(repo || "") || repo === "." || repo === "..") return null;
  return owner + "/" + repo;
}

function logoAddress(address: string, alt: string, project: string) {
  if (!address || /[\\%\s]/.test(address)) return null;
  let path: string;
  if (address.startsWith("https://")) {
    const url = new URL(address);
    if (url.username || url.password || !["github.com", "raw.githubusercontent.com"].includes(url.host)) return null;
    const parts = url.pathname.slice(1).split("/");
    if (parts.splice(0, 2).join("/").toLowerCase() !== project.toLowerCase()) return null;
    if (url.host === "github.com" && !["blob", "raw"].includes(parts.shift() || "")) return null;
    if (parts[0] === "refs" && parts[1] === "heads") parts.splice(0, 2);
    parts.shift(); // Always use the audited repository's default branch.
    path = parts.join("/");
  } else {
    path = address.replace(/^\.\//, "").split(/[?#]/, 1)[0];
  }
  const segments = path.split("/");
  if (segments.some(part => !SAFE_SEGMENT.test(part) || part === "." || part === "..")) return null;
  const file = segments.at(-1)!;
  if (!/\.(png|jpe?g|webp|svg)$/i.test(file) || /badge|screenshot|banner|sponsor|shields|avatar|github-mark|octocat|preview|cover|wordmark/i.test(path + " " + alt)) return null;
  const basename = file.replace(/\.[^.]+$/, "").toLowerCase();
  if (/\b(?:github|gitlab|npm|vercel|netlify|discord|patreon|opencollective|circleci|codecov)\b/.test((basename + " " + alt).toLowerCase())) return null;
  const projectName = project.split("/")[1].toLowerCase();
  if (!/(?:^|[._-])(?:logo(?:type|mark)?|icon|favicon|mascot|brandmark)(?:[._-]|$)/i.test(basename) &&
      !(basename === projectName && /\b(?:logo|icon)\b/i.test(alt))) return null;
  return RAW + "/" + project + "/HEAD/" + path;
}

/** Stop at the first subsection to avoid treating integration or sponsor artwork as a project logo. */
function introLogo(intro: string, project: string) {
  for (const entry of intro.matchAll(/<img\b[^>]{1,1600}>|!\[([^\]\n]{0,200})\]\(([^\s)]{1,600})[^)\n]*\)/gi)) {
    const attribute = (name: string) => entry[0].match(new RegExp("\\s" + name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i"))?.[1] || "";
    try {
      const url = logoAddress(entry[2] ?? attribute("src"), entry[1] ?? attribute("alt"), project);
      if (url) return url;
    } catch { /* Ignore malformed image links in otherwise valid readmes. */ }
  }
  return null;
}

/** Only an advertised project-branded domain. Never visit the URL supplied by the README. */
function homeDomain(intro: string, project: string) {
  const [owner, repo] = project.toLowerCase().split("/");
  const brand = (/^(?:cli|core|framework|website)$/.test(repo) ? owner : repo).replace(/[^a-z0-9]/g, "");
  if (brand.length < 2 || /^(?:app|docs|api|server|node|example|test|sdk|mcp|agent|js)$/.test(brand)) return null;
  for (const match of intro.matchAll(/(?:\bhref=["']|\bsrc=["']|\]\()https:\/\/([a-z0-9.-]+)(?=[/"')?#])/gi)) {
    const host = match[1].toLowerCase().replace(/^www\./, "");
    if (host.length > 190 || !/^(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,24}$/.test(host)) continue;
    if (/(?:^|\.)(?:github\.com|github\.io|githubusercontent\.com|gitlab\.(?:com|io)|npmjs\.(?:com|org)|vercel\.(?:app|com)|netlify\.(?:app|com)|pages\.dev|readthedocs\.(?:io|org)|herokuapp\.com|gitbook\.io|youtube\.com|google\.com|medium\.com)$/.test(host)) continue;
    const labels = host.split(".");
    const name = labels.length === 3 && labels[1] === "js" && labels[2] === "org" ? labels[0] : labels.at(-2)!;
    if (name.replace(/-/g, "") === brand || name.replace(/-/g, "") === brand + "js") return host;
  }
  return null;
}

async function readBytes(response: Response, limit: number, prefixOnly: boolean) {
  if (!response.ok || !response.body || (!prefixOnly && Number(response.headers.get("content-length")) > limit)) {
    void response.body?.cancel().catch(() => {});
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < limit || !prefixOnly) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!prefixOnly && size + value.length > limit) return null;
      const bytes = value.subarray(0, limit - size);
      chunks.push(bytes);
      size += bytes.length;
    }
    return Buffer.concat(chunks, size);
  } finally {
    void reader.cancel().catch(() => {});
  }
}

async function pngIcon(bytes: Buffer | null) {
  if (!bytes || bytes.length < 32) return null;
  try {
    const raster = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.readUInt16BE(0) === 0xffd8 || (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP");
    const input = raster ? bytes : simpleSvg(bytes.toString("utf8"));
    if (!input) return null;
    const icon = sharp(input, { limitInputPixels: 2_000_000, failOn: "warning" }).timeout({ seconds: 1 });
    const meta = await icon.metadata();
    const w = meta.width, h = meta.height;
    if (!w || !h || !["png", "jpeg", "webp", "svg"].includes(meta.format || "") || (meta.format === "svg") === raster ||
        Math.min(w, h) < 16 || w * h > 2_000_000 || w / h < 0.65 || w / h > 1.65 || (meta.pages || 1) > 1) return null;
    const body = await icon.resize(96, 96, { fit: "contain", background: "#0000" }).png().toBuffer();
    return { body, type: "image/png" as const };
  } catch {
    return null;
  }
}

export async function resolveGitHubProjectIcon(resourceUrl: string, fetcher: typeof fetch = fetch): Promise<{ body: Uint8Array; type: "image/png" } | null> {
  try {
    const project = repository(resourceUrl);
    if (!project) return null;
    const options = { signal: AbortSignal.timeout(2000), redirect: "error", cache: "no-store" } as const;
    const readme = await readBytes(await fetcher(RAW + "/" + project + "/HEAD/README.md", {
      ...options, headers: { Range: "bytes=0-" + (README_BYTES - 1) },
    }), README_BYTES, true);
    if (!readme) return null;
    const intro = readme.toString("utf8").replace(/<!--[\s\S]*?(?:-->|$)/g, "").split(/^[\t ]*(?:#{2,6}[\t ]|```|~~~)/im, 1)[0];
    const address = introLogo(intro, project);
    if (address) {
      const icon = await pngIcon(await readBytes(await fetcher(address, options), IMAGE_BYTES, false));
      if (icon) return icon;
    }
    const domain = homeDomain(intro, project);
    if (!domain || options.signal.aborted) return null;
    const favicon = new URL("https://t2.gstatic.com/faviconV2");
    favicon.search = new URLSearchParams({ client: "SOCIAL", type: "FAVICON", fallback_opts: "TYPE,SIZE,URL", url: "http://" + domain, size: "128" }).toString();
    return pngIcon(await readBytes(await fetcher(favicon.href, options), IMAGE_BYTES, false));
  } catch {
    return null;
  }
}
