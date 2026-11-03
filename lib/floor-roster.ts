import communityIds from "../data/floor-community.json" with { type: "json" };
import { resourceIconUrl } from "./resource-icon.ts";
import type { Resource } from "./resources";

export function getFloorRoster(featured: readonly Resource[]) {
  const community = (communityIds as string[]).map(resourceIconUrl);
  const slots = Math.max(0, 360 - featured.length);
  return {
    sources: [...featured.map(resource => resource.icon), ...community.slice(0, slots)],
    reserveSources: community.slice(slots),
  };
}
