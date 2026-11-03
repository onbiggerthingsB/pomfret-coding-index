import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { getResources, type Resource } from "../lib/resources.ts";

/** Build the browser's saved-project identities from the same groups as search. */
export function buildProjectSelections(resources: readonly Resource[]) {
  const byUrl = new Map(resources.map(resource => [resource.url, resource]));
  const aliases: Record<string, string> = {};
  const projects: Record<string, Resource> = {};
  for (const primary of resources) {
    for (const link of primary.projectLinks ?? []) {
      const alternate = byUrl.get(link.url);
      if (!alternate || alternate.id === primary.id) continue;
      aliases[alternate.id] = primary.id;
      projects[primary.id] = primary;
    }
  }
  return { version: 1, aliases, projects };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = new URL("../data/project-selections.json", import.meta.url);
  const contents = JSON.stringify(buildProjectSelections(getResources()), null, 2) + "\n";
  if (process.argv.includes("--write")) {
    writeFileSync(file, contents);
  } else if (readFileSync(file, "utf8") !== contents) {
    throw new Error("Project selection identities changed. Run node --experimental-strip-types scripts/project-selections.mts --write.");
  }
}
