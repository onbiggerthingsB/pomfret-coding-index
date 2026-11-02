# The Coding Index

A searchable resource library for Science / Advanced Coding. Students explore a Matter.js pile of website icons, compare resources, collect a project kit and give their existing coding agent a source-backed implementation brief.

See LICENSE and NOTICE for third-party licensing.

[Open the live app](https://pomfret-coding-index.vercel.app) · [Laptop tilt setup](docs/LAPTOP_TILT.md) · [Original team project](https://github.com/onbiggerthingsB/Hackathon/tree/75400d7/projects/onbiggerthingsB/coding-library)

## Run locally

Run the commands below from the root of this repository with Node 20.9 or newer.

The included test command requires Node 22.6 or newer for TypeScript stripping. Verification used Node 22.22.3.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3001. No API key is required. Dependencies are installed inside this app; the portable lockfile supports a clean checkout with npm ci.

```sh
npm run typecheck
npm test
npm run build
npm start
```

## What is indexed

The November 2, 2026 snapshot has 28,358 deduplicated records, including 90 featured resources. The import contains 28,359 community records before the server applies its additional normalization and merges the featured collection.

- Featured resources include 38 component libraries, plus icons, animation, design references, agent workflows, learning and developer tools.
- Community references were imported from 36 successfully retrieved public source documents.
- Each record retains its source URL. Imported descriptions summarize resource names and source sections.
- The source documents were checked. Individual imported destinations and software behavior have not all been verified.
- The count measures resource references across these categories. A linked UI library can contain many additional components.
- Fourteen featured resources include documentation-checked guidance: use cases, frameworks, setup estimates, caveats, source links and a checked date. This is not a runtime compatibility certification.

The large catalog stays on the server. The browser receives the featured collection and paginated search results. The physical pile displays a bounded sample, with repeated featured icons, independently of total index size.

To rebuild the community data from its recorded public sources, run the following command. It makes network requests and updates the two community JSON files.

```sh
npm run import:resources
```

Rebuild the app after changing the catalog so the homepage's count matches the updated API.

## Students and agents

- Enter a phrase such as `accessible React components`, `icons`, or `I need components for a dashboard`.
- Up to 24 matching icons rise above the search bar with resource names. Click one to see its website, checked guidance when available, source and agent handoff. The text list keeps 60 results per page.
- Use the results list for keyboard access, descriptions and pagination.
- Saved resources stay in the current browser.
- Drag an icon into My project, or choose Add to project in its details. Add a goal and stack or setup constraints, then copy or download one Markdown brief containing up to 12 resources. The project kit persists in this browser; it is not automatically shared between devices.
- For agents opens a copyable prompt and the machine-readable entry points.
- Pause motion freezes the scene. Reduced-motion preferences are supported.
- Laptop tilt connects to an optional local helper on a compatible Apple Silicon MacBook. The helper reads the built-in accelerometer, and the page uses it to change gravity. See [laptop tilt setup](docs/LAPTOP_TILT.md).

Agent endpoints are available relative to the deployed origin.

```text
/llms.txt
/api/resources?q=components&limit=20&offset=0
/api/resources?category=motion&kind=library
/api/resources?id=shadcn-ui
/resources/shadcn-ui
```

Search runs on the server using metadata tokens, synonyms and featured-resource weighting. It returns relevance weights. Localhost URLs require an agent with access to the same machine. Remote agents need a public deployment.

Website favicons are requested through a fixed Google favicon endpoint and cached. If a favicon is unavailable, a local SVG monogram is returned. Linked brands and resources remain their owners' property.

GitHub repository references use resource-specific monograms instead of repeating the GitHub logo. See [the classroom demonstration and peer-test guide](docs/CLASSROOM_DEMO.md).

## Verification

Completed on November 2, 2026.

- All 29 Node tests and the TypeScript check passed, including tilt calibration, pause/resume, stale readings and connection cleanup.
- Production Next.js webpack build passed, including the data files in server traces.
- Search and API assertions covered natural-language queries, unknown queries, pagination, invalid filters, record lookup and sampling.
- Ego Browser checks covered the falling pile, rising results, selecting a physics icon, resource details, saved resources, keyboard dismissal, agent guide and narrow-screen layout.
- New checks covered desktop and emulated touch drag-to-project, button-based addition, project persistence, a downloaded Markdown brief, reduced-motion operation, and mobile header clearance. Real classmates, physical phones and school Wi-Fi still need hands-on testing.
- Independent review found a browser-storage hydration issue; the fix and its regression tests were re-reviewed as resolved.
- Next.js was patched to 16.4.4 within the existing dependency choice. A clean independent `npm ci` verified the portable lockfile; `npm audit` reported zero vulnerabilities. No new dependency choices were added.
- The original project was merged through [PR #2](https://github.com/onbiggerthingsB/Hackathon/pull/2).
- The Next.js production deployment passed. Earlier unauthenticated public checks verified the homepage, search over 28,358 references, checked resource API and page, icons, agent guide and invalid-input responses. The latest tilt deployment is `dpl_bsze8G3jnkhBq3TpmKPJTmTAYPhU`, app revision `cd69b4d`. Public HTTP checks confirmed the new controls and working resource search. Later documentation-only commits do not change that deployed app.
- A live Ego Browser walkthrough confirmed search, checked guidance, collection, Markdown download and restoration of the goal, setup and resources after reload.
- Shared team delivery documentation is tracked separately in [PR #4](https://github.com/onbiggerthingsB/Hackathon/pull/4).
- Laptop tilt received live accelerometer data through the local browser. Calibration, pause/resume and switching tilt off were exercised. The helper's origin, method and path restrictions passed runtime checks. On November 2, 2026, the owner confirmed on the live site that icons fall toward the lowered side for both left and right tilt on this Mac.
- Laptop tilt was merged in [team PR #6](https://github.com/onbiggerthingsB/Hackathon/pull/6). This standalone copy includes the search field fix from [team PR #8](https://github.com/onbiggerthingsB/Hackathon/pull/8), verified on the live site at team revision `75400d7`.

No external hardware is required. Optional physical laptop tilt requires the foreground motion helper and a compatible MacBook sensor. Start it from this directory with `npm run motion`, then choose Laptop tilt on the page. Browser local-network permission may be requested.
