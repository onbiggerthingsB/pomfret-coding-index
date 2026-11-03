// Run from the app directory with: node --experimental-strip-types scripts/build-floor-sheet.mjs
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { resourceMonogram } from "../lib/resource-icon.ts";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const featured = await json("data/coding-resources.json");
const community = await json("data/floor-community.json");
const marks = await json("data/resource-logos.json");
const opening = [...featured, ...community.slice(0, 360 - featured.length).map(id => ({ id }))];
if (opening.length !== 360 || new Set(opening.map(item => item.id)).size !== opening.length) {
  throw new Error("Expected 360 distinct opening resources");
}

const cell = 64, gutter = 2, cols = 20;
const step = cell + gutter;
const width = cols * step, height = Math.ceil(opening.length / cols) * step;
const pixels = Buffer.alloc(width * height * 4);
await Promise.all(opening.map(async ({ id, name }, i) => {
  // Paaages is the one retained featured item with no published mark.
  const input = id === "paaages" && !marks[id] ? Buffer.from(resourceMonogram(name, id)) : `public/resource-logos/${id}.png`;
  const tile = await sharp(input).resize(cell, cell).ensureAlpha().raw().toBuffer();
  const left = (i % cols) * step, top = Math.floor(i / cols) * step;
  for (let row = 0; row < cell; row++) {
    tile.copy(pixels, ((top + row) * width + left) * 4, row * cell * 4, (row + 1) * cell * 4);
  }
}));
// Preserve small logo details while reducing the cold page load. The sheet test compares every decoded tile to its original.
const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } })
  .webp({ nearLossless: true, quality: 70, effort: 6 }).toBuffer();
const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
const url = `/floor/opening-${hash}.webp`;
await writeFile("public" + url, bytes);
await writeFile("data/floor-sheet.json", JSON.stringify({ url, cell, gutter, cols }, null, 2) + "\n");
console.log(`Packed ${opening.length} tiles in ${bytes.length} bytes.`);
