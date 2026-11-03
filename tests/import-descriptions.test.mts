import assert from "node:assert/strict";
import test from "node:test";
import { parseResources } from "../scripts/import-awesome.mjs";

const source = {
  repo: "class/resources", branch: "main", file: "README.md",
  name: "resources", sourceUrl: "https://github.com/class/resources/blob/main/README.md",
  category: "tools", tags: ["tools"],
};

test("imported bullets preserve summaries and discard ancillary links", () => {
  const [resource] = parseResources("# Resources\n## Images\n- **[Cropper](https://cropper.dev/)** - [demo](https://demo.dev/) - A responsive image cropper for **React**. ([docs](https://docs.dev/))", source);
  assert.equal(resource.name, "Cropper");
  assert.equal(resource.description, "A responsive image cropper for React.");
  assert.equal(resource.sourceUrl, source.sourceUrl);
  assert.equal(resource.url, "https://cropper.dev/");
});

test("table summaries are independent of auth, transport and CORS columns", () => {
  const [resource] = parseResources("# Resources\n## APIs\n| [Books](https://books.dev) | Search books, covers and related data | No | Yes | Unknown |", source);
  assert.equal(resource.description, "Search books, covers and related data");
});

test("source headings remain a fallback for missing summaries and bibliographic credits", () => {
  const [bare] = parseResources("# Resources\n## Components\n- [Widgets](https://widgets.dev)", source);
  assert.match(bare.description, /^Explore Widgets in Components/);
  const [book] = parseResources("# Books\n## JavaScript\n- [Book](https://books.dev) - John Smith and Ada Smith (PDF)", {
    ...source, repo: "EbookFoundation/free-programming-books",
  });
  assert.match(book.description, /^Explore Book in JavaScript/);
  assert.ok(!book.description.includes("Ada Smith"));
});

test("long source descriptions stay compact without cutting a word", () => {
  const [resource] = parseResources("# Resources\n- [Tool](https://tool.dev) - " + "Useful source description. ".repeat(30), source);
  assert.ok(resource.description.length <= 320);
  assert.match(resource.description, /…$/);
});
