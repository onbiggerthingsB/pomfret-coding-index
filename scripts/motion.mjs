import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, renameSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = process.argv.slice(2);
const validArgs = args.length === 0 || (args.length === 1 && ["--probe", "--build-only"].includes(args[0]));
if (!validArgs) {
  console.error("Usage: node scripts/motion.mjs [--probe | --build-only]");
  process.exit(64);
}
if (process.platform !== "darwin") {
  console.error("The laptop motion helper currently supports macOS on compatible Apple Silicon MacBooks.");
  process.exit(1);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "native", "motion.swift");
const output = path.join(root, ".motion");
const cache = path.join(output, "cache");
const binary = path.join(output, "motion");
mkdirSync(cache, { recursive: true });

function modifiedTime(file) {
  try { return statSync(file).mtimeMs; }
  catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

if (modifiedTime(binary) < modifiedTime(source) || args[0] === "--build-only") {
  const temporaryBinary = `${binary}.build-${process.pid}`;
  console.error("Compiling the local motion helper with the installed Swift compiler…");
  const build = spawnSync("swiftc", [
    "-O", "-module-cache-path", cache,
    "-framework", "IOKit", "-framework", "Network",
    source, "-o", temporaryBinary,
  ], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, SWIFT_MODULE_CACHE_PATH: cache, CLANG_MODULE_CACHE_PATH: cache },
  });
  if (build.error) {
    console.error(`Could not run the installed Swift compiler. ${build.error.message}`);
    process.exit(1);
  }
  if (build.status !== 0) process.exit(build.status ?? 1);
  renameSync(temporaryBinary, binary);
}

if (args[0] === "--build-only") {
  console.error(`Built ${binary}`);
  process.exit(0);
}

const child = spawn(binary, args, { cwd: root, stdio: "inherit" });
const forward = signal => () => child.kill(signal);
const handlers = new Map(["SIGINT", "SIGTERM", "SIGHUP"].map(signal => [signal, forward(signal)]));
for (const [signal, handler] of handlers) process.on(signal, handler);
child.on("error", error => {
  console.error(`The motion helper could not start. ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  for (const [name, handler] of handlers) process.off(name, handler);
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
