import type { Resource, ResourceRequirements } from "./resources.ts";

export function apiKeyLabel(resource: Resource): string | undefined {
  switch (resource.requirements?.apiKey) {
    case "required": return "API key required";
    case "not-required": return "No API key";
    case "conditional": return "Keyless with conditions";
    default:
      if (resource.sourceUrl.startsWith("https://github.com/public-apis/public-apis/")) return "API key unverified";
  }
}

export function readRequirements(raw: unknown): ResourceRequirements | undefined {
  if (!raw || typeof raw !== "object") return;
  const value = raw as Record<string, unknown>;
  const { apiKey, checkedAt, note, sourceUrl } = value;
  if (apiKey !== "required" && apiKey !== "not-required" && apiKey !== "conditional") return;
  if (typeof note !== "string" || !note.trim() || typeof sourceUrl !== "string" || typeof checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) return;
  if (!Number.isFinite(Date.parse(checkedAt)) || new Date(checkedAt).toISOString().slice(0, 10) !== checkedAt) return;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) return;
    return { apiKey, note: note.trim().slice(0, 1000), sourceUrl: url.href, checkedAt };
  } catch { return; }
}
