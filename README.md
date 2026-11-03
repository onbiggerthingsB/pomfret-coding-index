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

The 360 tiles in the opening scene represent 108 featured resources and 252 resources from public coding collections. Each of these cards explains what a student can do with the resource, which frameworks or formats it covers, how much setup to expect and one caveat. Dated source links let a student or agent verify the advice. The wider community catalog draws from 36 public collections.

The [November 2 catalog review](docs/CATALOG_REVIEW.md) covers all 28,359 original community entries. It records which links were removed or repaired, the limits of the checks, and how to trace the 18 featured additions to their sources. The [live API](https://pomfret-coding-index.vercel.app/api/resources?limit=1) returns the current deduplicated total in `indexed` and the featured count in `totalFeatured`.

The large catalog stays on the server. The browser receives the featured collection and paginated search results. The opening pile loads its logos from one image sheet. All 15 reserve tiles that can rotate into the scene also have reviewed guidance. Other search results can have a logo without reviewed guidance. After changing the roster or artwork, rebuild the sheet with `node --experimental-strip-types scripts/build-floor-sheet.mjs`.

To rebuild the community data from its recorded public sources, run the following command. It reads the recorded editorial decisions, fetches the public lists and updates the imported records and source manifest. Reviewed duplicate IDs remain usable through resource pages and the API.

```sh
npm run import:resources
```

Rebuild the app after changing the catalog so the homepage's count matches the updated API.

## Students and agents

- Press `/` to focus search. Describe a project, such as `a homework dashboard with due dates and a completed filter`, or ask for a specific resource by name, then press Enter.
- Up to 24 matching icons rise above the search bar with resource names. Click one to see its website, checked guidance when available, source and agent handoff. The text list keeps 60 results per page.
- After submitting a search, press Tab to reach the results list. It includes descriptions and pagination.
- Share the browser address to reopen a submitted search, category, results page or selected tile. Back and Forward restore those views. To share just one item, choose **Copy link** in its details. It opens a resource page where anyone can read the sources, save the item or add it to their own project.
- Try `weather API without an API key` for providers with documented keyless access. A result marked **Keyless with conditions** explains when that access applies. Providers that require a key or whose access is unverified are excluded. An empty result means the index has no verified match for that search.
- Open tabs in the same browser share saved resources and project picks.
- Choose **Copy this reference** to send one card to an agent. For several references, drag icons into **My project** or choose **Add to project**. Supply a goal and any stack or setup constraints, then copy or download the Markdown brief. It includes up to 12 resource-page links, their sources and the index's agent guide. The kit stays in the student's browser. Send the brief itself to share the selection.
- For agents opens a copyable prompt and the machine-readable entry points.
- Pause motion freezes the scene. Reduced-motion preferences are supported.
- Laptop tilt connects to an optional local helper on a compatible Apple Silicon MacBook. The helper reads the built-in accelerometer, and the page uses it to change gravity. See [laptop tilt setup](docs/LAPTOP_TILT.md).

Agent endpoints are available relative to the deployed origin.

```text
/llms.txt
/api/resources?q=components&limit=20&offset=0
/api/resources?q=weather+API+without+an+API+key
/api/resources?category=motion&kind=library
/api/resources?id=shadcn-ui
/resources/shadcn-ui
```

Search ranks matches on the server using names, tags, descriptions and reviewed use cases. Scores express relevance to the query. Localhost URLs require an agent with access to the same machine. Remote agents need a public deployment.

Bundled logos have recorded sources in `data/resource-logos.json`. Other websites use a cached favicon lookup. Linked brands and resources remain their owners' property.

GitHub entries can use project artwork from their repository or a linked project website. Resources without verified or available artwork use a local monogram. See [the classroom demonstration and peer-test guide](docs/CLASSROOM_DEMO.md).

## Verification

Run `npm test`, `npm run typecheck` and `npm run build` from the app directory. Tests cover catalog decisions, legacy resource links, search ranking, saved kits, icon handling and tilt calibration. The [classroom demo](docs/CLASSROOM_DEMO.md) includes a peer walkthrough.

The November 2 browser checks covered the search orb, keyboard hints, reduced motion, narrow screens and opening a resource from the results. The owner also confirmed that physical tilt moves the icons toward the lowered side in both directions on their MacBook. Optional tilt uses the foreground helper started with `npm run motion`.
