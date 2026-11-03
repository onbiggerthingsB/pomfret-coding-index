export const categories = [
  ["components", "Components"], ["icons", "Icons"], ["motion", "Animation"],
  ["inspiration", "Design references"], ["skills", "Agent skills"], ["learning", "Learn"],
  ["tools", "Tools"],
] as const;

export type Panel = "results" | "saved" | "agents" | "project" | null;
export type IndexLocation = { query: string | null; category: string; page: number; panel: Panel; resource: string | null };
export const pageSize = 60;

export function parseIndexLocation(search: string): IndexLocation {
  const params = new URLSearchParams(search);
  const category = categories.find(([id]) => id === params.get("category"))?.[0] ?? "";
  const view = params.get("view");
  const panel = view === "results" || view === "saved" || view === "agents" || view === "project" ? view : null;
  const page = Number(params.get("page"));
  const resource = params.get("resource") || "";
  return {
    query: params.get("q")?.trim().slice(0, 300) ?? (panel === "results" ? "" : null),
    category, page: Number.isSafeInteger(page) && page > 0 && page <= 16667 ? page : 1,
    panel, resource: /^[a-zA-Z0-9_-]{1,180}$/.test(resource) ? resource : null,
  };
}

export function indexPath(route: IndexLocation): string {
  const params = new URLSearchParams();
  if (route.query !== null) params.set("q", route.query);
  if (route.category) params.set("category", route.category);
  if (route.page > 1) params.set("page", String(route.page));
  if (route.panel) params.set("view", route.panel);
  if (route.resource) params.set("resource", route.resource);
  return params.size ? `/?${params}` : "/";
}

export function resourcePath(id: string): string {
  return `/resources/${encodeURIComponent(id)}`;
}

export function correctedSearchPath(search: string, query: string, category: string, offset: number, total: number): string | null {
  const route = parseIndexLocation(search);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  // A response can arrive after Back or a new search changed the address.
  if ((route.query ?? "") !== query || route.category !== category || (route.page - 1) * pageSize !== offset || route.page <= lastPage) return null;
  return indexPath({ ...route, page: lastPage });
}
