import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { resolveGitHubProjectIcon } from "../lib/github-project-icon.ts";

const project = "https://github.com/example/lime";
const raw = "https://raw.githubusercontent.com/example/lime/HEAD/";
const vector = (inside: string) => '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' + inside + "</svg>";
const shape = '<circle cx="32" cy="32" r="24" fill="#22cc99"/>';
const image = (url: string) => '<img alt="Lime logo" src="' + url + '">';

function server(readme: string, makeImage: () => Response) {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (url, options) => {
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    calls.push(String(url));
    return calls.length === 1 ? new Response(readme) : makeImage();
  };
  return { calls, fetcher };
}

test("an intro logo in the same repository becomes a 96px PNG", async () => {
  for (const ref of ["assets/logo.svg", "./assets/logo.svg", "https://github.com/example/lime/blob/main/assets/logo.svg?raw=true", "https://raw.githubusercontent.com/example/lime/refs/heads/main/assets/logo.svg"]) {
    const { calls, fetcher } = server(image(ref), () => new Response(vector(shape)));
    const icon = await resolveGitHubProjectIcon(project + "/tree/main#readme", fetcher);
    assert.deepEqual(calls, [raw + "README.md", raw + "assets/logo.svg"]);
    assert.equal(icon?.type, "image/png");
    const meta = await sharp(icon!.body).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["png", 96, 96]);
  }
});

test("badges, sample screenshots, avatars, other repositories and off-site image paths are skipped", async () => {
  for (const intro of [image("https://evil.example/logo.png"), image("https://raw.githubusercontent.com/example/other/main/logo.png"),
    image("//attacker.com/icon.png"), image("../private/logo.png"), image("logo%2F..%2Fother.svg"),
    image("samples/screenshot-logo.png"), image("avatar-icon.png"), image("github-logo.png"), image("badge-logo.svg"),
    image("https://raw.githubusercontent.com@evil.test/example/lime/main/logo.png"), "## Sponsors\n" + image("sponsor/logo.png")]) {
    const { calls, fetcher } = server(intro, () => new Response(vector(shape)));
    assert.equal(await resolveGitHubProjectIcon(project, fetcher), null);
    assert.deepEqual(calls, [raw + "README.md"]);
  }
});

test("only a supported GitHub project URL can trigger any lookup", async () => {
  for (const url of ["broken", "https://github.com/account", "https://github.com.evil.test/example/lime", "https://github.com:8088/example/lime", "https://user@github.com/example/lime", "http://github.com/example/lime", "https://github.com/%2f/lime"]) {
    const { calls, fetcher } = server(image("logo.png"), () => new Response(vector(shape)));
    assert.equal(await resolveGitHubProjectIcon(url, fetcher), null);
    assert.equal(calls.length, 0);
  }
});

test("the official branded domain goes only to the fixed favicon service", async () => {
  const png = await sharp(Buffer.from(vector(shape))).png().toBuffer();
  const { calls, fetcher } = server('<a href="https://lime.dev/docs">Documentation</a>', () => new Response(new Uint8Array(png)));
  assert.equal((await resolveGitHubProjectIcon(project, fetcher))?.type, "image/png");
  assert.equal(calls.length, 2);
  const endpoint = new URL(calls[1]);
  assert.equal(endpoint.origin + endpoint.pathname, "https://t2.gstatic.com/faviconV2");
  assert.equal(endpoint.searchParams.get("url"), "http://lime.dev");
  for (const link of ["https://lime.github.io", "https://lime.vercel.app", "https://lime.dev.evil.test", "https://127.0.0.1", "https://lime.dev@evil.test", "http://localhost"]) {
    const mock = server('<a href="' + link + '">Documentation</a>', () => new Response(vector(shape)));
    assert.equal(await resolveGitHubProjectIcon(project, mock.fetcher), null);
    assert.equal(mock.calls.length, 1, link);
  }
  const missing = server('[Website](https://lime.dev/)', () => new Response(new Uint8Array(png), { status: 404 }));
  assert.equal(await resolveGitHubProjectIcon(project, missing.fetcher), null);
});

test("untrusted SVG cannot load external resources, embedded images, entities or expensive filters", async () => {
  for (const payload of [
    vector('<image href="https://evil.example/mark.png"/>'),
    vector('<Ω:image xmlns:Ω="http://www.w3.org/2000/svg" href="data:image/png;base64,AAAA"/>'),
    vector('<path style="fill:url(https://evil.example/logo.svg)" d="M0 0h64v64z"/>'),
    vector('<path fill="url(https://evil.example/logo.svg)" d="M0 0h64v64z"/>'),
    vector('<script>alert(1)</script>'), vector('<foreignObject/>'), vector('<use href="#test"/>'),
    vector('<g onload="alert(1)"/>'), vector('<filter><feTurbulence/></filter>'),
    '<!DOCTYPE svg [<!ENTITY ext SYSTEM "file:///tmp/foo">]>' + vector(shape),
    '<?xml-stylesheet href="https://evil.example/style"?>' + vector(shape),
    vector(shape.repeat(1200)), vector(shape).replace('width="64"', 'width="9900000"'),
    vector(shape).replace('width="64"', 'width="500"'),
  ]) {
    const { fetcher } = server(image("logo.svg"), () => new Response(payload));
    assert.equal(await resolveGitHubProjectIcon(project, fetcher), null);
  }
});

test("untrusted files must stay inside both byte and decoded pixel budgets", async () => {
  const large = await sharp({ create: { width: 1600, height: 1600, channels: 3, background: "#808080" } }).png().toBuffer();
  const responses = [
    () => new Response(new Uint8Array(256_001)),
    () => new Response(vector(shape), { headers: { "Content-Length": "99999999" } }),
    () => new Response(new Uint8Array(large)),
    () => new Response("<html><body>This is not a logo file.</body></html>"),
  ];
  for (const response of responses) {
    const { fetcher } = server(image("icon.png"), response);
    assert.equal(await resolveGitHubProjectIcon(project, fetcher), null);
  }
  const truncated = server("x".repeat(16_384) + image("logo.png"), () => new Response(vector(shape)));
  assert.equal(await resolveGitHubProjectIcon(project, truncated.fetcher), null);
  assert.equal(truncated.calls.length, 1);
});

test("a stalled upstream read aborts within the shared network deadline", async () => {
  const keepAlive = setTimeout(() => {}, 4000);
  try {
    const start = performance.now();
    const fetcher: typeof fetch = (_, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    });
    assert.equal(await resolveGitHubProjectIcon(project, fetcher), null);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 3250, `request took ${elapsed}ms`);
  } finally {
    clearTimeout(keepAlive);
  }
});
