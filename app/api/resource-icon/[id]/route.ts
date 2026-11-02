import { getResource } from "@/lib/resources";
import { iconHost, resourceMonogram } from "@/lib/resource-icon";

const icons = new Map<string, { body: Uint8Array; type: string }>();

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const resource = getResource(id);
  if (!resource) return new Response("Resource not found", { status: 404 });
  const host = iconHost(resource.url);
  const monogram = () => new Response(resourceMonogram(resource.name, resource.id), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  if (!host) return monogram();
  const cached = icons.get(id);
  if (cached) return new Response(Buffer.from(cached.body), { headers: { "Content-Type": cached.type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
  try {
    const response = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`, { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } });
    const type = response.headers.get("content-type") || "";
    if (response.ok && /^image\/(png|x-icon|vnd\.microsoft\.icon|webp|jpeg)(?:;|$)/i.test(type)) {
      const body = new Uint8Array(await response.arrayBuffer());
      if (body.length > 100 && body.length < 256_000) {
        if (icons.size >= 500) icons.delete(icons.keys().next().value!);
        icons.set(id, { body, type });
        return new Response(Buffer.from(body), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
      }
    }
  } catch { /* A local monogram keeps the resource usable when a favicon is unavailable. */ }
  return monogram();
}
