# Coding Index catalog review

November 2, 2026. The class needs resources a student can inspect, explain to a teammate, and give to a coding agent. To earn a featured spot, a resource should give a student something concrete to inspect, such as source code, a working tool or a design example with an identifiable creator.

## What changed in the catalog

| November 2 review | Result |
| --- | --- |
| Original featured collection | All 90 destinations reviewed. We improved 38 cards, including 28 new links to agent-readable material. |
| Featured additions | All nine supplied websites and nine additional X discoveries. The featured collection now has 108 entries, including 32 with reviewed guidance. |
| Community collection | All 28,359 original records from 36 source documents screened. 1,122 removed or consolidated, leaving 27,237. |
| Searchable catalog | 27,345 unique resources. 74 historical IDs resolve to their current entry for shared links and API lookups. |

The community review used GitHub repository metadata, file paths, destination checks and source-section rules. It removed 413 archived package entries, 205 repeatedly missing external pages and three domains advertised for sale. Meetup listings, author profiles and source-table links were also removed. The current [Django documentation](https://docs.djangoproject.com/en/stable/) replaces nine old guides, while [Anthropic’s archived courses](https://github.com/anthropics/courses) remain useful as teaching material.

The link check attempted all 12,073 non-GitHub destinations and found 45 verified repairs. The review also corrected an obsolete npm documentation link and redirected the nine Django editions, bringing the total to 55 individually verified URL repairs. The importer now preserves trailing slashes and section anchors for links throughout the catalog. Another 1,313 responses were inconclusive, often because of blocking or timeouts. Those responses alone did not trigger removal. We tested selected featured examples by hand. For the broader community collection, the evidence covers the link and repository status.

The [source manifest](../data/community-sources.json) records totals by reason and the hashes of the imported documents. The [review ledger](../data/community-review.json) keeps individual findings and repairs available to the next import.

## What we took from the nine references

| Site | What we found | Decision for the Coding Index |
| --- | --- | --- |
| [Designeer](https://designeer.xyz/) | The search palette puts Escape beside the input and explains keyboard actions near the results. Individual finds credit the creator. | Show the shortcut a student can actually use. Its [Orbkit listing](https://designeer.xyz/resources/orbkit) also led to [Hydrogen](https://orbkit.zzzzshawn.cloud/playground?orb=shdr-11), the motion study adapted for the search button. |
| [Detail](https://detail.design/detail/hold-to-reveal-shortcut-hint) | A small product example reveals a shortcut in context, on the control it operates. | Reveal hints according to search state. The field keeps its simple border when focused. |
| [Motionimo Frames](https://motionimo.xyz/frames) | A student can find a still by color, mood or composition and follow its creator credit. The search area shows how many frames match. | Keep result counts next to the query. Index Frames as visual reference material. |
| [Amicro](https://amicro.dev/buttons/btn-11) | Its search button preview demonstrates an icon swap and a short press response, with source to inspect. | Reveal a submit arrow on hover or keyboard focus, and when ready on touchscreens. The [Gradient Arc](https://amicro.dev/loaders/gradient-arc) informed a fine arc around the sphere while a request is in progress. |
| [Paaages](https://paaages.com/pages/not-found) | Landing, pricing, login and missing-page galleries let students browse by the screen they are actually building. | Use specific searches and tag the resource with real screen types so a student can find it by task. |
| [Gradientora](https://shader.gradientora.com/3d-shaders) | The sphere editor separates surface lighting and noise from the speed of the animation. Many downloadable packs are paid. | Use opposing warm and cool highlights and a dark fold to keep the moving sphere legible at button size. The surface freezes when the student pauses motion. |
| [Introducing Geist Serif](https://vercel.com/blog/introducing-geist-serif) | The article uses type hierarchy to distinguish a display title from interface controls. | Use the official locally hosted regular face for resource names in details and on shareable resource pages. Its [license](../app/fonts/geist-serif/OFL.txt) is bundled. |
| [DesignBookmark](https://designbookmark.com/design) | Listings have a short functional description, a preview, and separate Visit and Save actions. Sponsored entries are identified. | Describe what the student can do at the destination. Show the destination domain in results and give opening a resource and collecting it distinct actions. |
| [Insposite](https://www.insposite.com/tools) | Switching between portfolios and tools changes the actual collection. Cards credit the creator and show the resource type. | Show the originating site in resource details and label X discovery links so a student can trace a recommendation. |

## Discoveries on X

We searched X directly and used Grok to find leads. We then read the posts and checked each destination. Likes and bookmarks below are snapshots from November 2, 2026. For a roundup, they apply to the whole post.

| Resource | Why it made the collection | Discovery |
| --- | --- | --- |
| [Kinetics](https://kinetics.colorion.co/tools/spring-animation-generator/) | Change spring parameters, compare motion, then copy CSS or React. This gives a student something concrete to try with an agent. | [Creator demonstration](https://x.com/csaba_kissi/status/2075845852849942695), 1,230 likes and 1,828 bookmarks. [October update](https://x.com/csaba_kissi/status/2116596745379385657). |
| [Paper Shaders](https://shaders.paper.design/smoke-ring) | The Smoke Ring example exposes radius, thickness, noise and speed, including a static frame. | [Creator announcement](https://x.com/stephenhaney/status/2072369858638233843), 5,559 likes and 5,734 bookmarks. |
| [Canvas UI](https://canvasui.dev/docs) | A class can compare an experimental shader effect to its HTML fallback and test which browsers can use it. | [Creator launch](https://x.com/davidhaz/status/2080224101432447094), 7,462 likes and 10,282 bookmarks. |
| [The Component Gallery](https://component.gallery/components/popover/) | Compare several design systems' implementations of one component before asking an agent to choose one. | [October roundup](https://x.com/iamtanzil_/status/2108066324907962575), 2,760 likes and 7,162 bookmarks. |
| [mapcn](https://www.mapcn.dev/) | Practical React map components for a project with locations, markers and popups. | [Same October roundup](https://x.com/iamtanzil_/status/2108066324907962575). |
| [Craft by Gustavo Fior](https://craft.gustavofior.com/button-press) | Short, runnable lessons on how an interaction feels. The record points to a published example. | [October recommendation](https://x.com/AdhamDannaway/status/2114725737932435514), 584 likes and 849 bookmarks. |
| [UI Skills](https://www.ui-skills.com/skills/emilkowalski/improve-animations) | Read an individual agent skill for improving a real interface before deciding whether to use it. | [September recommendation](https://x.com/Abmankendrick/status/2101256670236025105), 419 likes and 639 bookmarks. |
| [Graphical](https://www.graphicalui.com/) | A useful example of turning a theme into agent-readable design instructions. Its card identifies the paid builder. | [Creator launch](https://x.com/joshpuckett/status/2107175379903594714), 4,910 likes and 7,731 bookmarks. |
| [Transitions.dev](https://transitions.dev/) | Copy a transition recipe or read its companion motion skill. The card distinguishes free and paid material. | [November roundup](https://x.com/adrien_ninet/status/2116862984366809326), 363 likes and 446 bookmarks. |

We also checked [Amicro's creator announcement](https://x.com/SubhanHQ/status/2078447867795238999), which showed 3,023 likes and 4,272 bookmarks. Amicro counts once among the nine supplied references.
