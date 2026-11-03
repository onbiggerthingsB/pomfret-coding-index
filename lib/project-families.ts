export type ProjectFamily = {
  id: string;
  displayName?: string;
  aliases: string[];
  links?: { id: string; label: string }[];
  related?: string[];
};

// Each ID points to an existing catalog record so saved links remain usable.
// Links are other ways to read about the same project. Related IDs are distinct tools.
const github = (id: string) => ({ id, label: "GitHub" });
const communityGuide = (id: string) => ({ id, label: "Community guide" });
const antVue = "community-735362ce9672e68f";
const antCharts = "community-f8f43e49b0d97e16";
const antReactNative = "community-cd1cf756a3cceed5";
const antMobile = "community-eb59c0a4da328793";
const antAngular = "community-e6ca8458e9c714f4";

export const projectFamilies: ProjectFamily[] = [
  {
    id: "ant-design",
    aliases: ["Ant Design", "Ant Design React", "Ant Design for React", "antd"],
    links: [github("community-a24166629bd76570"), communityGuide("community-996c1466a9aa292f")],
    related: [antCharts, antVue, antAngular, antReactNative, antMobile],
  },
  {
    id: antVue,
    displayName: "Ant Design Vue",
    aliases: ["Ant Design Vue", "Ant Design for Vue", "antd Vue", "Antdv"],
    links: [{ id: "community-2813eee78d1c352e", label: "Documentation" }],
  },
  { id: antCharts, aliases: ["Ant Design Charts", "Ant Design chart", "antd charts"] },
  { id: antReactNative, aliases: ["Ant Design for React Native", "Ant Design React Native", "antd React Native"] },
  { id: antMobile, displayName: "Ant Design Mobile Web", aliases: ["Ant Design Mobile", "Ant Design Mobile Web", "antd mobile"] },
  { id: antAngular, displayName: "NG-ZORRO for Angular", aliases: ["NG-ZORRO", "NG-ZORRO for Angular", "Ant Design Angular", "Ant Design for Angular", "antd angular"] },
  {
    id: "community-bf2905db04afec23",
    aliases: ["Tailwind CSS", "tailwindcss", "Tailwind"],
    links: [github("community-b662278c0d08c19d"), communityGuide("community-3bd77bc5c23e181b")],
    related: ["daisyui", "flowbite", "hyperui", "preline-ui"],
  },
  {
    id: "radix-ui",
    aliases: ["Radix UI", "Radix Primitives"],
    related: ["community-af1855253bff312b", "community-b545e28422fc9b31"],
  },
  { id: "community-af1855253bff312b", aliases: ["Radix Icons", "Radix UI icons"] },
  { id: "community-b545e28422fc9b31", aliases: ["Radix Svelte", "Radix UI Svelte"] },
  {
    id: "chakra-ui",
    aliases: ["Chakra UI", "Chakra"],
    links: [github("community-f0a350cc23b11116")],
    related: ["community-463e187534e60ff2", "community-2fec359bd48adc85"],
  },
  { id: "community-463e187534e60ff2", aliases: ["Chakra UI Vue", "Chakra Vue"] },
  { id: "community-2fec359bd48adc85", aliases: ["Chakra Templates", "Chakra UI templates"] },
  {
    id: "shadcn-ui",
    aliases: ["shadcn/ui", "shadcn"],
    links: [github("community-a3b6067eebf224ed")],
    related: [
      "community-3e811907b0bf50c5", // Vue port
      "community-182c65c98dcd9d4a", // Svelte port
      "community-3c2d73956bea2a85", // MCP server
      "community-87c23deacaceda62", // Component skill
      "community-98448162a9b5dfbf", // Admin dashboard
      "community-29a7299aa0613394", // Templates
      "community-39f37262af6d7f90", // Examples
      "community-268bcdaffc059b98", // Blocks
      "community-5b5c3c4432ca0849", // Studio
      "community-33734b17b0f5e48d", // Component generator
    ],
  },
  {
    id: "lucide",
    aliases: ["Lucide", "Lucide icons", "lucide-react"],
    links: [github("community-4f826eb69fc40d07"), { id: "community-a207437c904c17c8", label: "Alternate website" }],
    related: ["community-a0dbe16efd6463d9"], // Lucide Motion Vue
  },
  {
    id: "three-js",
    aliases: ["Three.js", "threejs"],
    links: [github("community-11a9984670e2cae4")],
    related: ["community-9352e6a96a5cd5ad"], // React Three Fiber
  },
  {
    id: "storybook",
    aliases: ["Storybook"],
    links: [github("community-77884e06cdb61b15"), communityGuide("community-cfdd8983c87fb16b")],
    related: ["community-54fc77b129d88d0f"], // MCP add-on
  },
  {
    id: "playwright",
    aliases: ["Playwright", "Microsoft Playwright"],
    links: [github("community-e8a6ea38f92e425f"), communityGuide("community-d505e88fe2c2e4a5")],
    related: ["community-ba31bde2dfc28f63", "community-ec8eeed6bdfe52f3"], // Official MCP server and Python bindings
  },
  { id: "community-ba31bde2dfc28f63", aliases: ["Playwright MCP", "Microsoft Playwright MCP"] },
  { id: "community-ec8eeed6bdfe52f3", aliases: ["Playwright Python", "Playwright for Python"] },
  {
    id: "community-f1ec2932ad28360d",
    aliases: ["D3", "D3.js", "d3js", "Data Driven Documents"],
    links: [github("community-dfc80ee0426fca56"), communityGuide("community-49bef1932ea26168")],
  },
  { id: "headless-ui", aliases: ["Headless UI"], links: [github("community-10656da63b5f44ac"), { id: "community-1f96f885ec39d1c6", label: "Legacy website" }] },
  { id: "community-54fc77b129d88d0f", aliases: ["Storybook MCP", "Storybook MCP add-on"], displayName: "Storybook MCP add-on" },
  { id: "heroicons", aliases: ["Heroicons"], links: [github("community-d25d730a8f8c325a")] },
  { id: "motion", aliases: ["Framer Motion", "Motion for React"], links: [github("community-d0d951d500e0a6ae")] },
  { id: "gsap", aliases: ["GSAP", "GreenSock"], links: [github("community-3ddc35f314cc779c")] },
  {
    id: "community-78414a9e632bb993", // react.dev
    aliases: ["React official website"],
    links: [
      { id: "community-b1573965de5736d6", label: "Legacy website" },
      communityGuide("community-a2f4aa6060d9ac0a"),
    ],
  },
  {
    id: "community-43d3ef9bd32addf2", // Svelte
    aliases: ["Svelte framework"],
    links: [communityGuide("community-7ff24d5e59a24574")],
  },
  {
    id: "community-9cbe205a8df2648d", // Angular
    aliases: ["Angular framework"],
    links: [communityGuide("community-4b5677d926173e77")],
  },
  {
    id: "community-fa47a130b33588a4", // vite.dev
    aliases: ["Vite.js", "Vite official website"],
    links: [
      github("community-2b14193563ce6363"),
      { id: "community-7ca2e5348b3737e2", label: "Legacy website" },
      communityGuide("community-778085adaf4e8416"),
    ],
  },
  {
    id: "community-dcb792d718508bec", // Next.js
    aliases: ["Next.js framework"],
    links: [communityGuide("community-c897ce73fa058062")],
  },
  {
    id: "community-4f846901f9ff948b", // TypeScript
    aliases: ["TypeScript official website"],
    links: [github("community-1c95e679a4e3fa53")],
  },
  {
    id: "community-768db728288ffbb5",
    aliases: ["Drizzle ORM", "DrizzleORM"],
    links: [github("community-bebec19dda3a76e4")],
  },
  {
    id: "material-ui",
    aliases: ["Material UI", "MUI", "MUI Material"],
    links: [
      github("community-2ee35ac2beedf2e2"),
      { id: "community-49fe478893a17981", label: "Legacy website" },
      communityGuide("community-50f00630b8aef896"),
    ],
    related: [
      "community-eb240fd33e4b0bf3", // MUI X Data Grid
      "community-fed259f6dca914f1", // MUI-Datatables
      "base-ui", // Unstyled controls
    ],
  },
  { id: "community-eb240fd33e4b0bf3", aliases: ["MUI X", "MUI X Data Grid", "MUI Data Grid", "Material UI Data Grid"] },
  {
    id: "base-ui",
    aliases: ["Base UI"],
    links: [github("community-abf8970a448d67ae")],
  },
];
