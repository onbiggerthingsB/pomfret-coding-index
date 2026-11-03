import { apiKeyLabel } from "@/lib/resource-access";
import type { Resource } from "@/lib/resources";

export function ResourceAccess({ resource }: { resource: Resource }) {
  const label = apiKeyLabel(resource);
  if (!label) return null;
  const access = resource.requirements;
  return (
    <div className="my-4 text-sm leading-6 text-muted">
      <strong className="text-text">{label}</strong>
      {access && <>
        <p>{access.note}</p>
        <a className="underline underline-offset-4" href={access.sourceUrl} target="_blank" rel="noreferrer">Provider documentation ↗</a>
      </>}
    </div>
  );
}
