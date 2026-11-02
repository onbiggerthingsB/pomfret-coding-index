# Classroom readiness implementation plan

> **For agentic workers:** Use subagent-driven development for independent work, with a final integrated review. Preserve the existing project branch and teammates' files.

**Goal:** Make Coding Index deliverable, easier to evaluate, and useful for a student's complete resource-to-agent workflow.

**Architecture:** Keep the existing Next.js app and Matter.js world. Add optional reviewed resource metadata, a browser-local project tray, and a deterministic brief generator. Keep search and the large catalog on the server.

**Tech Stack:** Existing Next.js, React, Matter.js and TypeScript. Node built-in tests; no new packages.

**Spec:** The user-approved recommendations in the criteria audit at `../../../../../../../../research/coding-index-criteria-audit-2026-11-02/README.md` and `/Users/likerun/HACKATHON_REQUIREMENTS.md`.

## Global constraints

- Preserve the reference-inspired dark layout and falling icon interaction.
- Keep work on `project/onbiggerthingsB`; leave the pull request open for team review.
- Preserve other members' project files; do not invent their projects or contributions.
- No new dependencies, secrets, paid services or unrelated configuration changes.
- Distinguish checked guidance from unverified community imports.
- Retain keyboard and reduced-motion access to every essential action.
- Public deployment and draft PR are included in the user's accepted delivery sequence. Do not merge or submit the organizer's form.

## Review focus

- Corrupt or stale browser data must not crash the tray or copy operation.
- Duplicate additions must not multiply resources or overwhelm the brief.
- Drag release must not also open the resource, and must work after rerenders.
- Remote agents must receive public source URLs, not local-only origin assumptions.
- Identical GitHub favicons must be distinguishable with visible resource names.

## Task 1: Delivery path and team readiness

- [x] Confirm live GitHub state, hosting account and existing project settings.
- [x] Add a concise team delivery register with confirmed facts and explicit unknowns.
- [x] Build and prepare the standalone app for an appropriate existing hosting account.
- [x] Commit and push the project branch; open a draft PR and record its URL.
- [x] Deploy the verified app and test public page, API and agent guide. Update handoff evidence.

## Task 2: Reviewed featured resources

Owner files: `lib/resources.ts`, `data/coding-resources.json`, `app/resources/[id]/page.tsx`, `tests/resource-guidance.test.*`.

Interface: export `ResourceGuidance` with `bestFor: string`, `frameworks: string[]`, `setup: "low" | "moderate" | "advanced"`, `caveat: string`, `checkedAt: string`, `sourceUrls: string[]`. Add optional `Resource.guidance`.

- [x] Add a failing test for guidance presence, shape and unchanged catalog identity/count.
- [x] Check official documentation for at least 12 useful featured resources; retain evidence URLs and date. Setup difficulty is editorial guidance, not a vendor claim.
- [x] Parse optional guidance, expose it in API output, and render it on resource pages.
- [x] Run focused tests and type checking.

## Task 3: Physics drop target and readable results

Owner files: `components/IconFloor.tsx`, `components/floor/*`, focused drag tests if a pure helper is introduced.

Interface: optional `getDropBounds(): {left:number;right:number;top:number;bottom:number}|null`, `onResourceDrop(src:string): void` props. Invoke only after an actual drag released inside the target. Preserve click-to-open elsewhere. Show visible concise names for raised results while retaining hover details.

- [x] Establish drag/click acceptance checks before edits.
- [x] Implement optional drop target and resource name captions without per-frame React state.
- [x] Preserve pause/reduced-motion operation and clean lifecycle teardown.
- [x] Type check; hand off browser checks to root.

## Task 4: Recognizable icons

Owner files: `app/api/resource-icon/[id]/route.ts`, optional pure helper and tests.

- [x] Test that repository links do not all choose the host favicon.
- [x] Return a deterministic resource-name monogram for GitHub repository resources; keep cached favicons for actual product sites.
- [x] Preserve bounded cache, timeout and safe fallback behavior.

## Task 5: Project tray and student workflow

Owner files: `components/CodingIndex.tsx`, `components/ProjectTray.tsx`, `lib/project-brief.ts`, `app/globals.css`, `app/llms.txt/route.ts`, `tests/project-brief.test.*`.

- [x] Write failing tests for unique resource selection, invalid storage, limits and a brief including goal, stack, sources, guidance and acceptance steps.
- [x] Implement pure tray parsing and brief generation; store only validated data locally.
- [x] Add an always reachable tray/drop target, goal/stack fields, add/remove buttons, copy and download.
- [x] Connect Matter drop events; allow the same task with buttons and keyboard.
- [x] Surface reviewed guidance in details and result rows, enlarge class label, add useful starting queries and the Tools category.
- [x] Update the agent guide for project packs and public access.

## Task 6: Integrated validation and delivery

- [x] Run meaningful Node tests, TypeScript and production build.
- [x] Review React/Next changes with an independent reviewer and address findings.
- [x] Browser-check desktop/narrow view, drag-to-tray, duplicates, keyboard, pause, persistence, copy/download and repeated search.
- [x] Validate deployed site and API without login. Do not claim actual classmate testing or school-network testing without it.
- [x] Update project README and team register with actual evidence and remaining human dependencies.

## Execution ledger

- 2026-11-02: Plan checked against the accepted audit. Tasks 2 and 5 share only the `guidance` interface; tasks 3 and 5 share only drop callbacks; task 4 consumes the existing catalog API. Ownership avoids concurrent file edits. Existing feature branch is retained to preserve the established team workflow. Higher-priority instructions authorize continuing without a second plan approval and parallelizing independent work.
- Tasks 2–5 implemented and locally verified. Fourteen resources have checked guidance; names and monograms distinguish results; the tray persists and exports a project brief. Independent review identified one storage hydration issue, fixed with two regression tests and re-reviewed as resolved.
- Ego Browser confirmed desktop and emulated-touch additions, no click-through dialog, persistence after reload, button-based addition, brief download, reduced motion and the mobile layout. Pure browser-protocol calls were needed because high-level automation changed tab visibility/viewport between input events. No production input workaround was added for the automation behavior.
- Final local validation passed: 17 Node tests, TypeScript and production webpack build. Independent clean `npm ci` verified the portable lockfile; `npm audit` reported zero vulnerabilities. The existing Next.js dependency was patched to 16.4.4; no new dependency choices were added.
- The project branch is pushed; [PR #2](https://github.com/onbiggerthingsB/Hackathon/pull/2) is open for review. Vercel production deployment passed at [the public app](https://pomfret-coding-index.vercel.app), with Next.js explicitly configured. Unauthenticated checks passed for the homepage, search, checked resource API/page, icons and agent guide. App revision `c3e36b1`, deployment `dpl_HHpVp43R1GsY5DCjU8d6fWXGg8Vj`. Shared delivery docs use [PR #4](https://github.com/onbiggerthingsB/Hackathon/pull/4).
- App and team handoff documentation now reflect the implemented workflow and observed verification. Exact deadline, form URL, teammate entries, physical-phone testing, real peer testing and school-Wi-Fi checks remain unconfirmed. No merge or organizer-form submission was performed.

- Public browser walkthrough passed: search, checked details, collection, goal and setup, Markdown download, and restored kit after reload. The exported brief was inspected and contains the selected sources and task.
