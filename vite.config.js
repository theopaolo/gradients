import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { defineConfig } from "vite";

const SW_TEMPLATE = "src/service-worker.js";
const SW_OUTPUT = "service-worker.js";

// The worker is only worth what it can serve offline, so the list is built from
// what actually landed in dist rather than from a hand-kept array that drifts.
// Source maps are debugging weight, the share image is only ever fetched by
// crawlers, and the worker script must never be able to serve itself from a
// cache it also controls.
const EXCLUDED = new Set([SW_OUTPUT, "og.jpg"]);
const isPrecachable = (path) => !path.endsWith(".map") && !EXCLUDED.has(path);

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, base);
    if (entry.name === ".DS_Store") return [];
    return [relative(base, full)];
  });
}

// Runs at closeBundle so the public directory has already been copied: reading
// dist from disk is the one view that sees bundle output and static files both.
function pwa() {
  let outDir;

  return {
    name: "soft-colors-pwa",
    apply: "build",

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    closeBundle() {
      const files = listFiles(outDir).filter(isPrecachable).sort();
      const urls = files.map((file) => `/${file}`);

      // Hashing contents rather than the clock keeps the build reproducible:
      // rebuilding unchanged sources leaves the cache name — and so the update
      // toast — alone. The worker's own source is part of the hash, because a
      // change to how it caches has to open a cache of its own rather than
      // inherit one filled under the old rules.
      const template = readFileSync(resolve(SW_TEMPLATE), "utf8");
      const digest = createHash("sha256").update(template);
      for (const file of files) {
        digest.update(file);
        digest.update(readFileSync(join(outDir, file)));
      }
      const buildId = digest.digest("hex").slice(0, 12);

      const worker = template
        .replace("__BUILD_ID__", buildId)
        .replace("__PRECACHE_URLS__", JSON.stringify(urls, null, 2));

      writeFileSync(join(outDir, SW_OUTPUT), worker);
      console.log(`\nservice worker: ${urls.length} files precached (build ${buildId})`);
    },
  };
}

export default defineConfig({
  plugins: [pwa()],
});
