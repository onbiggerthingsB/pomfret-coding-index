import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { getFloorRoster } from "../lib/floor-roster.ts";
import { getFeaturedResources } from "../lib/resources.ts";
import { resourceMonogram } from "../lib/resource-icon.ts";
import sheet from "../data/floor-sheet.json" with { type: "json" };

test("every painted opening tile uses the corresponding resource's artwork exactly once", async () => {
  const featured = getFeaturedResources();
  const { sources } = getFloorRoster(featured);
  const file = await readFile("public" + sheet.url.split("?")[0]);
  const digest = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
  assert.ok(sheet.url.endsWith(digest(file).slice(0, 12)));
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const step = sheet.cell + sheet.gutter;
  assert.equal(info.width, sheet.cols * step);
  assert.equal(info.height, Math.ceil(sources.length / sheet.cols) * step);
  const colors = new Set<string>();
  for (const [index, url] of sources.entries()) {
    const id = url.split("/").pop()!.split("?")[0];
    const input = id === "paaages" ? Buffer.from(resourceMonogram("Paaages", id)) : "public/resource-logos/" + id + ".png";
    const resized = await sharp(input).resize(sheet.cell, sheet.cell).png().toBuffer();
    const expected = await sharp(resized).flatten({background: "#fff"}).removeAlpha().raw().toBuffer();
    const left = (index % sheet.cols) * step, top = Math.floor(index / sheet.cols) * step;
    const extracted = await sharp(data, {raw: info}).extract({left, top, width: sheet.cell, height: sheet.cell})
      .flatten({background: "#fff"}).removeAlpha().raw().toBuffer();
    const hash = digest(extracted);
    // Transparent RGB outside a logo is immaterial on the tile's light backing.
    if (id === "paaages") {
      // Its retained monogram uses the host font. The tile color is stable across platforms.
      const pixel = (Math.floor(sheet.cell / 4) * sheet.cell + Math.floor(sheet.cell / 4)) * 3;
      assert.deepEqual(extracted.subarray(pixel, pixel + 3), expected.subarray(pixel, pixel + 3));
    } else {
      // SIMD resampling can round channels differently on different architectures.
      const error = extracted.reduce((sum, value, n) => sum + Math.abs(value - expected[n]), 0);
      assert.ok(error / extracted.length < 1, id);
    }
    assert.ok(!colors.has(hash), "Repeated tile artwork for " + id);
    colors.add(hash);
  }
  assert.equal(colors.size, 360);
});
