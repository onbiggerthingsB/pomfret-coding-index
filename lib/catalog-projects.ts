import { projectFamilies } from "./project-families.ts";
import { inferProjectLinks } from "./project-identity.ts";
import type { Resource } from "./resources.ts";

/** Keep original records addressable while giving search one entry per project. */
export function groupCatalogProjects(resources: Resource[], byId: Map<string, Resource>, normalizeName: (value: string) => string) {
  const alternateOf = new Map<string, Resource>();
  const namedProjects = new Map<string, Resource>();
  const preferredProjects = new Map<string, Resource | null>();
  const reserved = new Set(projectFamilies.flatMap(family => family.links?.map(link => link.id) ?? []));
  const curated = new Set(projectFamilies.map(family => family.id));
  const suggested = inferProjectLinks(resources, reserved, curated);
  const groups = new Map(projectFamilies.map(family => [family.id, [...(family.links ?? [])]]));
  for (const [primaryId, links] of suggested) {
    if (!reserved.has(primaryId)) groups.set(primaryId, [...(groups.get(primaryId) ?? []), ...links]);
  }

  for (const [id, links] of groups) {
    const primary = byId.get(id);
    if (!primary) continue;
    for (const link of links) {
      const alternate = byId.get(link.id);
      if (!alternate || alternate === primary || groups.has(alternate.id) || alternateOf.has(alternate.id)) continue;
      alternateOf.set(alternate.id, primary);
      (primary.projectLinks ??= []).push({ label: link.label, url: alternate.url });
      for (const name of [primary.name, alternate.name].map(normalizeName)) {
        if (!preferredProjects.has(name)) preferredProjects.set(name, primary);
        else if (preferredProjects.get(name) !== primary) preferredProjects.set(name, null);
      }
      if (link.label === "GitHub" && alternate.guidance && !primary.guidance) {
        primary.projectGuidanceFrom = alternate.id;
        primary.guidance = alternate.guidance;
        // The reviewed repository describes the same project even when its
        // website already has a useful source summary.
        primary.kind = alternate.kind;
        primary.category = alternate.category;
        primary.tags = [...new Set([...primary.tags, ...alternate.tags])];
        if (primary.description.startsWith("Explore ")) {
          primary.description = alternate.description;
        }
      }
    }
  }

  // Don't turn an exact name shared by independent projects into a shortcut to one of them.
  const owners = new Map<string, Resource | null>();
  for (const entry of resources) {
    const name = normalizeName(entry.name);
    const primary = alternateOf.get(entry.id) ?? entry;
    if (!owners.has(name)) owners.set(name, primary);
    else if (owners.get(name) !== primary) owners.set(name, null);
  }
  for (const [name, primary] of owners) {
    // Curated families supply their own aliases; e.g. "Framer Motion" vs the topic "motion".
    if (primary?.projectLinks?.length && !curated.has(primary.id)) namedProjects.set(name, primary);
  }
  for (const family of projectFamilies) {
    const primary = byId.get(family.id);
    if (!primary) continue;
    if (family.displayName) primary.name = family.displayName;
    for (const alias of family.aliases) namedProjects.set(normalizeName(alias), primary);
  }
  for (const family of projectFamilies) {
    const primary = byId.get(family.id);
    if (primary && family.related) {
      primary.relatedTools = family.related.flatMap(id => {
        const tool = alternateOf.get(id) ?? byId.get(id);
        return tool ? [{ id: tool.id, name: tool.name }] : [];
      });
    }
  }
  return { alternateOf, namedProjects, preferredProjects };
}
