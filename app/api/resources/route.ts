import { getResource, getResources, resourceCategories, resourceKinds, searchResources } from "@/lib/resources";

export const runtime = "nodejs";

function integer(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const headers = { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" };
  if (id !== null) {
    const resource = getResource(id);
    return resource ? Response.json({ resource }, { headers }) : Response.json({ error: "Resource not found" }, { status: 404 });
  }

  if (params.has("sample")) {
    const count = integer(params.get("sample"), 16, 1, 100);
    const resources = getResources();
    const sample = new Set<string>();
    const start = resources.length ? Math.floor(Math.random() * resources.length) : 0;
    for (let index = 0; index < Math.min(count, resources.length); index++) sample.add(resources[(start + index) % resources.length].icon);
    return Response.json({ srcs: [...sample] }, { headers: { "Cache-Control": "no-store" } });
  }

  const category = params.get("category") || undefined;
  const kind = params.get("kind") || undefined;
  if (category && category !== "all" && !Object.hasOwn(resourceCategories, category)) {
    return Response.json({ error: "Unknown resource category", categories: Object.keys(resourceCategories) }, { status: 400 });
  }
  if (kind && kind !== "all" && !resourceKinds.includes(kind as typeof resourceKinds[number])) {
    return Response.json({ error: "Unknown resource kind", kinds: resourceKinds }, { status: 400 });
  }

  const results = searchResources({
    query: params.get("q") || "",
    category,
    kind,
    limit: integer(params.get("limit"), 30, 1, 100),
    offset: integer(params.get("offset"), 0, 0, 1_000_000),
  });
  return Response.json(results, { headers });
}
