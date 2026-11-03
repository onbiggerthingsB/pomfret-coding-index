import { getResource } from "@/lib/resources";
import { resolveGitHubProjectIcon } from "@/lib/github-project-icon";
import { iconHost, resourceMonogram } from "@/lib/resource-icon";

type Icon = { body: Uint8Array; type: string };
const DAY = 86_400;
const RETRY = 300;
const cache = new Map<string, { result: Promise<Icon | null>; until: number }>();

async function favicon(host: string): Promise<Icon | null> {
  const response = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, {
    signal: AbortSignal.timeout(2500), next: { revalidate: DAY },
  });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !/^image\/(png|x-icon|vnd\.microsoft\.icon|webp|jpeg)(?:;|$)/i.test(type)) return null;
  if (Number(response.headers.get("content-length")) > 256_000) return null;
  const body = new Uint8Array(await response.arrayBuffer());
  return body.length > 100 && body.length < 256_000 ? { body, type } : null;
}

// Share lookups across records on the same site and simultaneous searches for the same project.
function lookup(url: string): Promise<Icon | null> {
  const host = iconHost(url);
  const key = host ?? url;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.result;
  if (cache.size >= 500) cache.delete(cache.keys().next().value!);
  const entry = { result: (host ? favicon(host) : resolveGitHubProjectIcon(url)).catch(() => null), until: Date.now() + RETRY * 1000 };
  cache.set(key, entry);
  void entry.result.then(icon => { entry.until = Date.now() + (icon ? DAY : RETRY) * 1000; });
  return entry.result;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resource = getResource(id);
  if (!resource) return new Response("Resource not found", { status: 404 });
  const icon = await lookup(resource.url);
  const ttl = icon ? DAY : RETRY;
  return new Response(icon ? Buffer.from(icon.body) : resourceMonogram(resource.name, resource.id), {
    headers: {
      "Content-Type": icon?.type ?? "image/svg+xml",
      "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
