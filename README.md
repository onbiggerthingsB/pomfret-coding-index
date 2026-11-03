# The Coding Index

A searchable resource library for Science / Advanced Coding. Students explore a Matter.js pile of website icons, compare resources, collect a project kit and give their existing coding agent a source-backed implementation brief.

See LICENSE and NOTICE for third-party licensing.

[Open the live app](https://pomfret-coding-index.vercel.app) · [Catalog review and design sources](docs/CATALOG_REVIEW.md) · [Laptop tilt setup](docs/LAPTOP_TILT.md) · [Original team project](https://github.com/onbiggerthingsB/Hackathon/tree/75400d7/projects/onbiggerthingsB/coding-library)

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

The featured collection includes 108 starting points for components, icons, motion, design, agent workflows, learning and developer tools. Thirty-two have a dated guide with use cases, setup and caveats. Other records come from 36 public coding collections.

The [November 2 catalog review](docs/CATALOG_REVIEW.md) covers all 28,359 original community entries. It records which links were removed or repaired, the limits of the checks, and how to trace the 18 featured additions to their sources. The [live API](https://pomfret-coding-index.vercel.app/api/resources?limit=1) returns the current deduplicated total in `indexed` and the featured count in `totalFeatured`.

The large catalog stays on the server. The browser receives the featured collection and paginated search results. The opening pile loads one image sheet containing 108 featured tiles and 252 distinct community logos. Only the community tiles rotate. After changing the roster or artwork, rebuild the sheet with `node --experimental-strip-types scripts/build-floor-sheet.mjs`.

To rebuild the community data from its recorded public sources, run the following command. It reads the recorded editorial decisions, fetches the public lists and updates the imported records and source manifest. Reviewed duplicate IDs remain usable through resource pages and the API.

```sh
npm run import:resources
```

Rebuild the app after changing the catalog so the homepage's count matches the updated API.

## Students and agents

- Press `/` to focus search. Try `microinteractions`, `gradients` or `components for a dashboard`, then press Enter.
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

Bundled logos have recorded sources in `data/resource-logos.json`. Other websites use a cached favicon lookup. Linked brands and resources remain their owners' property.

GitHub entries can use project artwork from their repository or a linked project website. Resources without verified or available artwork use a local monogram. See [the classroom demonstration and peer-test guide](docs/CLASSROOM_DEMO.md).

## Verification

Run `npm test`, `npm run typecheck` and `npm run build` from the app directory. Tests cover catalog decisions, legacy resource links, search ranking, saved kits, icon handling and tilt calibration. The [classroom demo](docs/CLASSROOM_DEMO.md) includes a peer walkthrough.

The November 2 browser checks covered the search orb, keyboard hints, reduced motion, narrow screens and opening a resource from the results. The owner also confirmed that physical tilt moves the icons toward the lowered side in both directions on their MacBook. Optional tilt uses the foreground helper started with `npm run motion`.
