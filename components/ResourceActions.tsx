"use client";

import { useState } from "react";
import Link from "next/link";
import { buildResourceBrief, canonicalResourceId, PROJECT_LIMIT, SAVED_LIMIT } from "@/lib/project-brief";
import { resourcePath } from "@/lib/index-navigation";
import type { Resource } from "@/lib/resources";
import { useLibraryStore } from "./useLibraryStore";

type LibraryStore = ReturnType<typeof useLibraryStore>["store"];
export function projectPickNotice(name: string, outcome: Awaited<ReturnType<LibraryStore["select"]>>) {
  let message = outcome.changed ? `Added ${name} to your project.` : `${name} is already in your project.`;
  if (outcome.full) message = `Your tray has ${PROJECT_LIMIT} resources. Remove one to make room.`;
  if (!outcome.persistent) message += " Download your brief before leaving this tab.";
  return message;
}

type Props = {
  resource: Resource; store: LibraryStore; inProject: boolean; saved: boolean;
  onPick?: (notice: string, added: boolean) => void; showWebsite?: boolean;
  onOpenProject?: () => void; projectHref?: string;
};

export function ResourceActions({ resource, store, inProject, saved, onPick, showWebsite, onOpenProject, projectHref = "/?view=project" }: Props) {
  const [notice, setNotice] = useState("");
  const [fallback, setFallback] = useState("");

  async function add() {
    const outcome = await store.select("project", resource, true);
    const message = projectPickNotice(resource.name, outcome);
    setNotice(message);
    onPick?.(message, outcome.changed);
  }

  async function bookmark() {
    const result = await store.select("saved", resource, !saved);
    if (result.full) setNotice(`Your Saved list holds ${SAVED_LIMIT} resources. Remove one to make room.`);
    else if (!result.persistent) setNotice("Changed for this visit. Browser storage is unavailable.");
    else setNotice(saved ? "Resource removed from Saved." : "Resource saved.");
  }

  async function copy(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); setFallback(""); setNotice(message); }
    catch { setFallback(value); setNotice("Select and copy the text below."); }
  }

  return <>
    <div className="index-detail-actions">
      <button className="index-primary" onClick={add} disabled={inProject}>{inProject ? "In your project ✓" : "Add to project +"}</button>
      {inProject && (onOpenProject ? <button className="index-primary" onClick={onOpenProject}>Open project kit ↗</button> : <Link className="index-primary" href={projectHref}>Open project kit ↗</Link>)}
      {showWebsite && <a href={resource.url} target="_blank" rel="noreferrer">Open website ↗</a>}
      <button onClick={bookmark}>{saved ? "Saved ✓" : "Save resource"}</button>
      <button onClick={() => void copy(buildResourceBrief(resource), "Copied. Paste into your agent’s chat.")}>Copy this reference</button>
      <button onClick={() => void copy(new URL(resourcePath(canonicalResourceId(resource.id)), window.location.origin).href, "Resource link copied.")}>Copy link</button>
    </div>
    <p className="index-copy-status" role="status">{notice}</p>
    {fallback && <textarea className="w-full" readOnly value={fallback} aria-label="Resource text to copy" />}
  </>;
}

export function StandaloneResourceActions({ resource, projectHref }: { resource: Resource; projectHref?: string }) {
  const { library, store } = useLibraryStore();
  const id = canonicalResourceId(resource.id);
  return <ResourceActions resource={resource} store={store}
    projectHref={projectHref}
    inProject={library.project.resources.some(item => item.id === id)}
    saved={library.saved.some(item => item.id === id)} />;
}
