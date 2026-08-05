/* The offline copy of the app.
 *
 * This file is a template, not a module: nothing imports it, and Vite never
 * bundles it. The `pwa` plugin in vite.config.js rewrites the two placeholders
 * below at build time — one with the list of everything the build produced, one
 * with a hash of that list and of this file — and writes the result to
 * dist/service-worker.js.
 *
 * The build id is what makes an update an update: a new hash means a new cache
 * name, so the fresh worker fills its own cache while the running one keeps
 * serving the old files, and nothing is thrown away until the user says go.
 */

const BUILD_ID = "__BUILD_ID__";
const CACHE_PREFIX = "soft-colors-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;

const PRECACHE_URLS = __PRECACHE_URLS__;
const PRECACHE_URL_SET = new Set(PRECACHE_URLS);
const APP_SHELL_URL = "/index.html";

// Without the shell there is no app, so a failure here has to fail the install.
// A missing font only costs a fallback face for one session, so those are
// gathered separately and allowed to fail.
const REQUIRED_URLS = PRECACHE_URLS.filter(
  (url) => url === APP_SHELL_URL || url.startsWith("/assets/"),
);

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const optionalUrls = PRECACHE_URLS.filter(
    (url) => !REQUIRED_URLS.includes(url),
  );

  // `cache: "reload"` so the browser's own HTTP cache can't hand this worker
  // the very files the previous build already stored.
  try {
    await Promise.all(
      REQUIRED_URLS.map((url) =>
        cache.add(new Request(url, { cache: "reload" })),
      ),
    );
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }

  const results = await Promise.allSettled(
    optionalUrls.map((url) => cache.add(new Request(url, { cache: "reload" }))),
  );
  const failed = results.filter(
    (result) => result.status === "rejected",
  ).length;
  if (failed > 0) {
    console.warn(
      `Service worker: ${failed} optional asset(s) missing from the offline copy.`,
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

// The page holds the new worker back until someone presses Reload in the
// update toast; this is the message that press sends.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const stale = names.filter(
        (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
      );

      await Promise.all(stale.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

const offline = () =>
  new Response("Offline", { status: 503, statusText: "Offline" });

// `ignoreVary` because Vite marks the entry script and stylesheet
// `crossorigin`: the browser sends those two requests with an `Origin` header,
// the install-time requests carried none, and a host that answers `Vary:
// Origin` — vite preview does — would then have the cache refuse to match the
// two files the app most needs offline. Every key here is a URL this build
// wrote, so there is no variant for Vary to choose between anyway.
const match = (request) =>
  caches.match(request, { cacheName: CACHE_NAME, ignoreVary: true });

// Nothing outside `install` ever writes to the cache, so its contents are
// always exactly one build. That is what keeps a page served from somewhere
// else — a dev server on the same port, a deploy mid-flight — from leaving a
// shell in there that belongs to no build at all.
//
// The document is asked for over the network first: served stale it would name
// the hashed assets of a build this worker may no longer be the one for. It is
// 1 kB, and the timeout means a network that hangs rather than fails costs a
// wait no longer than this and not the launch.
const SHELL_TIMEOUT = 2500;

function respondWithShell(event) {
  event.respondWith(
    (async () => {
      const cached = await match(APP_SHELL_URL);
      const network = fetch(event.request).catch(() => null);

      if (!cached) {
        return (await network) ?? offline();
      }

      const timeout = new Promise((resolve) =>
        setTimeout(resolve, SHELL_TIMEOUT, null),
      );
      const response = await Promise.race([network, timeout]);
      if (response?.ok) return response;

      // Let a slow request finish anyway: it holds the worker alive long
      // enough that the next navigation may find a warm HTTP cache.
      event.waitUntil(network);
      return cached;
    })(),
  );
}

// Everything precached is either content-hashed by Vite or a font that only
// changes when its filename does, so a cache hit is always the right answer.
function respondWithAsset(event) {
  event.respondWith(
    (async () => {
      const cached = await match(event.request);
      if (cached) return cached;

      // A miss is an asset from some other build — the network's to answer.
      try {
        return await fetch(event.request);
      } catch {
        return offline();
      }
    })(),
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    respondWithShell(event);
    return;
  }

  // The manifest list is the whole allowlist. Anything else — the worker
  // script itself above all, which must be revalidated by the browser rather
  // than served from a cache it controls — goes straight to the network.
  if (!url.search && PRECACHE_URL_SET.has(url.pathname)) {
    respondWithAsset(event);
  }
});
