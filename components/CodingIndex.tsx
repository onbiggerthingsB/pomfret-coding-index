"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Resource } from "@/lib/resources";
import { IconFloor, type FloorApi } from "./IconFloor";
import openingSheet from "@/data/floor-sheet.json";
import { SearchComposer } from "./SearchComposer";
import { ProjectTray } from "./ProjectTray";
import { LaptopTiltControls } from "./LaptopTiltControls";
import type { TiltStatus } from "./floor/tilt";
import { buildProjectBrief, buildResourceBrief, PROJECT_LIMIT, SAVED_LIMIT, readResource } from "@/lib/project-brief";
import { createLibraryStore, emptyLibrary, resolveFeatured, withLibraryLock } from "@/lib/library-storage";

type Result = { resources: Resource[]; total: number; offset: number };
type Panel = "results" | "saved" | "agents" | "project" | null;

function displayHost(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

const categories = [
  ["components", "Components"], ["icons", "Icons"], ["motion", "Animation"],
  ["inspiration", "Design references"], ["skills", "Agent skills"], ["learning", "Learn"],
  ["tools", "Tools"],
] as const;

export function CodingIndex({ featured, indexed, sources, reserveSources }: {
  featured: Resource[]; indexed: number; sources: string[]; reserveSources: string[];
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [library, setLibrary] = useState(emptyLibrary);
  const [store] = useState(() => createLibraryStore(
    () => window.localStorage,
    withLibraryLock,
    setLibrary,
  ));
  const featuredById = useMemo(() => new Map(featured.map(resource => [resource.id, resource])), [featured]);
  const { project, saved } = useMemo(() => resolveFeatured(library, featuredById), [library, featuredById]);
  const [paused, setPaused] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [copyFallback, setCopyFallback] = useState("");
  const [floorVersion, setFloorVersion] = useState(0);
  const [projectNotice, setProjectNotice] = useState("");
  const [tiltStatus, setTiltStatus] = useState<TiltStatus>({ state: "off", message: "" });
  const tiltWanted = useRef(false);
  const dropTarget = useRef<HTMLButtonElement>(null);
  const floor = useRef<FloorApi | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const panelDialog = useRef<HTMLDialogElement>(null);
  const selectionRequest = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const requestedOffset = useRef(0);
  const lastKey = useRef(0);
  const ready = useCallback(() => setFloorVersion(value => value + 1), []);
  const onTiltStatus = useCallback((status: TiltStatus) => {
    if (status.state === "unavailable") tiltWanted.current = false;
    setTiltStatus(status);
  }, []);

  const toggleTilt = () => {
    const enabled = tiltStatus.state === "off" || tiltStatus.state === "unavailable";
    tiltWanted.current = enabled;
    floor.current?.setTiltEnabled(enabled);
  };

  const cells = useMemo(() => sources.map((_, index) => index), [sources]);
  const matches = useMemo(() => (result?.resources || []).slice(0, 24).map((resource, index) => ({
    src: resource.icon, title: resource.name, tagline: resource.description,
    detail: `${resource.category} · ${displayHost(resource.url)}`,
    probability: 1, badge: `#${(result?.offset || 0) + index + 1}`,
  })), [result]);

  useEffect(() => {
    if (!matches.length) { floor.current?.release(); return; }
    floor.current?.select(matches, () => {
      const box = bar.current?.getBoundingClientRect();
      return { x: (box?.left || 0) + (box?.width || window.innerWidth) / 2, above: box?.top || window.innerHeight / 2 };
    });
  }, [matches, floorVersion]);

  useEffect(() => { floor.current?.setPaused(paused); }, [paused, floorVersion]);
  useEffect(() => { floor.current?.setTiltEnabled(tiltWanted.current); }, [floorVersion]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith("coding-index:")) store.refresh(event.key);
    };
    const restore = () => {
      if (!store.refresh()) setProjectNotice("Browser storage is unavailable. Download your brief before leaving.");
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", restore);
    restore();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) setPaused(true);
    const onReduced = (event: MediaQueryListEvent) => { if (event.matches) setPaused(true); };
    reduced.addEventListener("change", onReduced);
    return () => {
      abort.current?.abort();
      reduced.removeEventListener("change", onReduced);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", restore);
    };
  }, [store]);

  useEffect(() => {
    if (!projectNotice) return;
    const timer = window.setTimeout(() => setProjectNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [projectNotice]);

  const getDropBounds = useCallback(() => {
    const rect = dropTarget.current?.getBoundingClientRect();
    return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
  }, []);

  const addToProject = useCallback(async (resource: Resource, showInDialog = false) => {
    const outcome = await store.select("project", resource, true);
    let notice = outcome.changed ? `Added ${resource.name} to your project.` : `${resource.name} is already in your project.`;
    if (outcome.full) notice = `Your tray has ${PROJECT_LIMIT} resources. Remove one to make room.`;
    if (!outcome.persistent) notice += " Download your brief before leaving this tab.";
    setProjectNotice(notice);
    if (showInDialog) setCopyStatus(notice);
  }, [store]);

  async function removeFromProject(resource: Resource) {
    const outcome = await store.select("project", resource, false);
    setCopyStatus(outcome.persistent ? "" : "Changed for this visit. Download your brief before leaving.");
  }

  function updateProjectField(field: "goal" | "stack", value: string) {
    if (!store.writeField(field, value)) setCopyStatus("Changed for this visit. Download your brief before leaving.");
  }

  const dropResource = useCallback(async (src: string) => {
    const known = [...featured, ...(result?.resources || [])].find(resource => resource.icon === src);
    if (known) { addToProject(known); return; }
    const id = src.split("/").pop()?.split("?")[0];
    if (!id) return;
    try {
      const response = await fetch(`/api/resources?id=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error("Resource unavailable");
      const data = await response.json() as { resource: Resource };
      const resource = readResource(data.resource);
      if (resource) addToProject(resource);
    } catch { setProjectNotice("That resource could not load. Add it from the results list."); }
  }, [featured, result, addToProject]);

  useEffect(() => {
    const node = dialog.current;
    if (selected && node && !node.open) node.showModal();
    if (!selected && node?.open) node.close();
    setCopyStatus("");
    setCopyFallback("");
  }, [selected]);

  useEffect(() => {
    const node = panelDialog.current;
    if (panel && node && !node.open) node.showModal();
    if (!panel && node?.open) node.close();
  }, [panel]);

  const chooseResource = useCallback((resource: Resource | null) => {
    selectionRequest.current++;
    setSelected(resource);
  }, []);

  const search = useCallback(async (raw: string, filter = "", offset = 0) => {
    const value = raw.trim();
    const id = ++requestId.current;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    requestedOffset.current = offset;
    setBusy(true);
    setResult(null);
    setError("");
    setText(value);
    setQuery(value);
    setCategory(filter);
    try {
      const params = new URLSearchParams({ q: value, category: filter, limit: "60", offset: String(offset) });
      const response = await fetch(`/api/resources?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Search could not load. Please try again.");
      const next = await response.json() as Result;
      if (id === requestId.current) setResult(next);
    } catch {
      if (id === requestId.current && !controller.signal.aborted) setError("Search could not load. Try again.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  const openResource = useCallback(async (src: string) => {
    const token = ++selectionRequest.current;
    const known = [...featured, ...(result?.resources || [])].find(resource => resource.icon === src);
    if (known) { setSelected(known); return; }
    const id = src.split("/").pop()?.split("?")[0];
    if (!id) return;
    try {
      const response = await fetch(`/api/resources?id=${id}`);
      if (response.ok && token === selectionRequest.current) {
        const data = await response.json() as { resource: Resource };
        if (token === selectionRequest.current) setSelected(data.resource);
      }
    } catch { if (token === selectionRequest.current) setError("That resource could not load. Try the results list."); }
  }, [featured, result]);

  function onType(value: string) {
    requestId.current++;
    abort.current?.abort();
    setBusy(false);
    setText(value);
    setResult(null);
    setError("");
    floor.current?.release();
    const now = performance.now();
    const gap = now - lastKey.current;
    if (gap < 1200 && !paused) floor.current?.shake(Math.min(0.6, 60 / Math.max(gap, 50)));
    lastKey.current = now;
  }

  async function toggleSave(resource: Resource) {
    const include = !saved.some(item => item.id === resource.id);
    const outcome = await store.select("saved", resource, include);
    if (outcome.full) setCopyStatus(`Your Saved list is full. Keep fewer than ${SAVED_LIMIT} resources to save another.`);
    else if (!outcome.persistent) setCopyStatus("Changed for this visit. Browser storage is unavailable.");
    else setCopyStatus(include ? "Resource saved." : "Resource removed from Saved.");
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setCopyStatus("Copied. Paste into your agent’s chat."); setCopyFallback(""); }
    catch { setCopyFallback(value); setCopyStatus("Select and copy the text below."); }
  }

  function downloadBrief() {
    const url = URL.createObjectURL(new Blob([buildProjectBrief(project)], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "my-coding-project.md";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setCopyStatus("Downloaded your project brief.");
  }

  const listed = panel === "saved" ? saved : result?.resources || (busy || error ? [] : featured);
  const activeCategory = categories.find(([id]) => id === category)?.[1];
  const actionLabel = error ? "Retry search" : !result ? "" : result.total > 0 ? "View results" : "Browse all";

  function browseLibrary() {
    setPanel("results");
    void search("");
  }

  function submitSearch(value: string) {
    if (error) void search(value, category, requestedOffset.current);
    else if (!result) void search(value, category);
    else if (result.total === 0) browseLibrary();
    else setPanel("results");
  }

  return <>
    <IconFloor sources={sources} featuredCount={featured.length} reserveSources={reserveSources} cells={cells} sheet={openingSheet} apiRef={floor} onReady={ready} onResourceSelect={openResource} getDropBounds={getDropBounds} onResourceDrop={dropResource} onTiltStatus={onTiltStatus} />
    <header className="index-header">
      <a href="/" className="index-brand"><span className="index-symbol" aria-hidden="true">⌘</span><span>The Coding Index<small>Science / Advanced Coding</small></span></a>
      <nav aria-label="Library"><button onClick={() => { setPanel("results"); if (!result && !busy) void search(text, category); }}>Explore</button><button onClick={() => setPanel("saved")}>Saved <span>{saved.length}</span></button><button onClick={() => { setPanel("agents"); setCopyStatus(""); setCopyFallback(""); }}>For agents <span aria-hidden="true">↗</span></button></nav>
    </header>

    <main className="index-main">
      <div className="index-search" ref={bar}>
        <SearchComposer value={text} onChange={onType} onSubmit={submitSearch} onClear={() => { setCategory(""); onType(""); }} actionLabel={actionLabel} busy={busy} paused={paused} />
        <div className="index-underbar">
          <span role="status">{busy ? "Searching the index…" : error || (result?.total === 0 ? "No matches. Try a shorter phrase." : result ? `${result.total.toLocaleString()} ${result.total === 1 ? "resource" : "resources"} found` : "Find a tool or reference for your project.")}</span>
          <button onClick={browseLibrary}>{indexed.toLocaleString()} indexed <span aria-hidden="true">↗</span></button>
        </div>
        <div className="index-categories" role="group" aria-label="Filter by category">{categories.map(([id, label]) => <button key={id} aria-pressed={category === id} onClick={() => void search(text, category === id ? "" : id)}>{label}</button>)}</div>
        {!result && !busy && !error && !text && !category && <div className="index-starters"><span>Try a search</span>{["a homework dashboard with due dates", "microinteractions", "testing"].map(example => <button key={example} onClick={() => void search(example)}>{example}</button>)}</div>}
      </div>
    </main>

    <ProjectTray project={project} dropRef={dropTarget} notice={projectNotice} onOpen={() => {setPanel("project"); setCopyStatus(""); setCopyFallback("");}} />

    <footer className="index-footer">
      <span>{featured.length} featured resources</span>
      <div>
        <span className="index-hint">Click to explore. Drag to your project.</span>
        <LaptopTiltControls status={tiltStatus} onToggle={toggleTilt} onCalibrate={() => floor.current?.calibrateTilt()} />
        <button onClick={() => setPaused(value => !value)} aria-pressed={paused}>
          {paused ? "Resume motion" : "Pause motion"}
        </button>
      </div>
    </footer>

    <dialog ref={panelDialog} aria-labelledby="index-panel-title" className="index-panel-backdrop" onCancel={() => setPanel(null)} onClose={() => setPanel(null)} onClick={event => {if (event.target === event.currentTarget) setPanel(null);}}>
      {panel && <section className="index-panel" aria-label={panel === "project" ? "Project tray" : panel === "agents" ? "Agent access" : panel === "saved" ? "Saved resources" : "Search results"}>
        <div className="index-panel-top"><div><h1 id="index-panel-title">{panel === "project" ? "Your project kit" : panel === "agents" ? "For your agent" : panel === "saved" ? "Your saved resources" : query || activeCategory || "Explore the index"}</h1><p>{panel === "project" ? "Choose your resources. Give your agent a clear starting point." : panel === "agents" ? "A readable, searchable library for the tools you already use." : panel === "saved" ? "Kept in this browser. Open one to add it to your project." : busy ? "Searching the index…" : error || `${result?.total.toLocaleString() ?? featured.length} ${result?.total === 1 ? "resource" : "resources"}${query && activeCategory ? ` in ${activeCategory}` : ""}`}</p></div><button className="index-close" aria-label="Close panel" onClick={() => setPanel(null)}>×</button></div>
        {panel === "project" ? <div className="index-project-content">
          <label htmlFor="project-goal">What are you building?</label><textarea id="project-goal" maxLength={1200} value={project.goal} onChange={event => updateProjectField("goal", event.target.value)} placeholder="A homework dashboard that helps our class track upcoming assignments…" />
          <label htmlFor="project-stack">Your setup or constraints <span>optional</span></label><input id="project-stack" maxLength={160} value={project.stack} onChange={event => updateProjectField("stack", event.target.value)} placeholder="React, free resources, works on phones…" />
          <div className="project-section-title"><h2>Your choices</h2><span>{project.resources.length} / {PROJECT_LIMIT}</span></div>
          {project.resources.length === 0 ? <div className="project-empty"><p>Start with one useful resource.</p><span>Drag an icon onto the tray, or open a result and choose “Add to project”.</span><button onClick={() => setPanel(null)}>Explore resources ↗</button></div> : <ul className="project-picks">{project.resources.map(resource => <li key={resource.id}><img src={resource.icon} alt="" width="36" height="36"/><div><button className="project-pick-name" onClick={() => chooseResource(resource)}>{resource.name}</button><p>{resource.guidance?.bestFor || resource.description}</p><small>{resource.guidance ? `Guidance checked ${resource.guidance.checkedAt}` : resource.featured ? "Featured resource" : "Community reference"}</small></div><button className="project-remove" aria-label={`Remove ${resource.name} from project`} onClick={() => void removeFromProject(resource)}>×</button></li>)}</ul>}
          <div className="project-export"><button className="index-primary" disabled={!project.goal.trim() || project.resources.length === 0} onClick={() => void copy(buildProjectBrief(project))}>Copy project brief</button><button disabled={!project.goal.trim() || project.resources.length === 0} onClick={downloadBrief}>Download .md ↓</button></div>
          <p className="index-note">{!project.goal.trim() || !project.resources.length ? "Add a goal and at least one resource to create your brief. " : "Paste the brief into your existing agent chat. "}It includes your goal, references, tradeoffs to check and a testing checklist. Your kit stays in this browser.</p>
          <p className="index-copy-status" role="status">{copyStatus}</p>{copyFallback && <textarea readOnly value={copyFallback} aria-label="Project brief to copy" />}
          <details className="project-brief-preview"><summary>What will my agent receive?</summary><pre>{buildProjectBrief(project)}</pre></details>
        </div> : panel === "agents" ? <div className="index-agent-content">
          <h2>Build a project kit together</h2><p>Collect resources in My project, add your goal, and copy the complete brief into your agent’s chat. Or ask your agent to explore this index directly.</p><button className="index-primary" onClick={() => {setPanel("project"); setCopyStatus(""); setCopyFallback("");}}>Open my project kit</button>
          <pre>{`Search this coding library for resources that fit my project.\nCompare framework, accessibility, setup and license.\nExplain your choices before implementing.\n\n${typeof window !== "undefined" ? window.location.origin : ""}/llms.txt`}</pre>
          <button className="index-primary" onClick={() => void copy(`Search this coding library for resources that fit my project. Compare framework, accessibility, setup and license. Explain your choices before implementing. Read ${window.location.origin}/llms.txt`)}>Copy agent prompt</button>
          <div className="index-agent-links"><a href="/llms.txt" target="_blank">Read the agent guide ↗</a><a href="/api/resources?q=components&limit=20" target="_blank">Try the search API ↗</a></div>
          <h2>Human-readable and machine-readable</h2><p>Every resource has an ordinary page with its description, tags and original sources. The API provides the same index as JSON.</p><p className="index-note">The index includes {featured.length} featured resources and references imported from community-maintained collections. Imported destination sites have not all been individually checked.</p><p className="index-note">During local preview, agents need access to this computer’s localhost. A public deployment makes these URLs available remotely.</p>
          <p aria-live="polite">{copyStatus}</p>{copyFallback && <textarea readOnly value={copyFallback} aria-label="Agent prompt to copy" />}
        </div> : <>
          <div className="index-resource-list">{listed.map(resource => <button className="index-resource-row" key={resource.id} onClick={() => chooseResource(resource)}><img src={resource.icon} alt="" width="40" height="40" loading="lazy"/><span><strong>{resource.name}</strong><span>{resource.description}</span><small>{displayHost(resource.url)} · {resource.kind} · {resource.guidance ? "Guidance checked" : resource.featured ? "Featured" : "Community reference"}</small></span><span aria-hidden="true">›</span></button>)}</div>
          {listed.length === 0 && <p className="index-empty">{panel === "saved" ? "Open a resource and save it here for your next project." : busy ? "Searching…" : error || "No resources matched. Try a shorter phrase or a category."}</p>}
          {panel === "results" && error && <button className="index-search-recovery" onClick={() => void search(query, category, requestedOffset.current)}>Retry search</button>}
          {panel === "results" && result?.total === 0 && <button className="index-search-recovery" onClick={browseLibrary}>Browse all resources</button>}
          {panel === "results" && result && result.total > 0 && <div className="index-pagination"><button disabled={busy || result.offset === 0} onClick={() => void search(query, category, Math.max(0, result.offset - 60))}>Previous</button><span>{result.offset + 1}–{Math.min(result.offset + result.resources.length, result.total)} of {result.total.toLocaleString()}</span><button disabled={busy || result.offset + result.resources.length >= result.total} onClick={() => void search(query, category, result.offset + 60)}>Next</button></div>}
        </>}
      </section>}
    </dialog>

    <dialog ref={dialog} className="index-detail" onCancel={() => chooseResource(null)} onClose={() => chooseResource(null)} onClick={event => {if (event.target === event.currentTarget) chooseResource(null);}}>
      {selected && <article>
        <div className="index-detail-top"><img src={selected.icon} alt="" width="64" height="64"/><button className="index-close" aria-label="Close resource" onClick={() => chooseResource(null)}>×</button></div>
        <p className="index-eyebrow">{displayHost(selected.url)} · {selected.category} / {selected.kind}</p><h2>{selected.name}</h2><p className="index-description">{selected.description}</p>
        <div className="index-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
        {selected.guidance ? <section className="resource-guidance"><p className="guidance-date">Sources checked {selected.guidance.checkedAt}</p><dl><dt>Best for</dt><dd>{selected.guidance.bestFor}</dd><dt>Works with</dt><dd>{selected.guidance.frameworks.join(" · ")}</dd><dt>Setup effort</dt><dd>{selected.guidance.setup} <span>(our estimate)</span></dd><dt>Consider</dt><dd>{selected.guidance.caveat}</dd></dl><div>{selected.guidance.sourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">Source {index + 1} ↗</a>)}</div></section> : <p className="index-note">{selected.featured ? "Featured in the class collection. Detailed compatibility guidance has not been checked yet." : "Imported community reference. Check its original documentation before using it."}</p>}
        <div className="index-detail-actions"><button className="index-primary" onClick={() => void addToProject(selected, true)}>{project.resources.some(item => item.id === selected.id) ? "In your project ✓" : "Add to project +"}</button><a href={selected.url} target="_blank" rel="noreferrer">Open website ↗</a><button onClick={() => toggleSave(selected)}>{saved.some(item => item.id === selected.id) ? "Saved ✓" : "Save resource"}</button><button onClick={() => void copy(buildResourceBrief(selected))}>Copy this reference</button></div>
        <p className="index-note">Read the original resource for current setup, pricing and licensing.</p><div className="index-detail-links"><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{displayHost(selected.sourceUrl) === "x.com" ? "Discovery post on X" : "Original source"} ↗</a><a href={`/resources/${selected.id}`}>Resource page ↗</a>{selected.agentUrl && <a href={selected.agentUrl} target="_blank" rel="noreferrer">Agent-readable guide ↗</a>}</div>
        <p className="index-copy-status" aria-live="polite">{copyStatus}</p>{copyFallback && <textarea readOnly value={copyFallback} aria-label="Resource brief to copy" />}
      </article>}
    </dialog>
  </>;
}
