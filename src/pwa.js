/* Installs the offline copy of the app and offers updates.
 *
 * Reloading a page that is mid-work — a half-tuned gradient, an export in
 * flight — is not something a background process gets to decide. So a new
 * build waits, and what reloads onto it is the Reload button in the toast
 * below. The one update that passes without asking is the one that changes
 * nothing on screen: see the silent window.
 */

import { iconHTML } from "./panel/dom.js";

const SW_URL = "/service-worker.js";
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
// Kept in step with the same name in service-worker.js, which is the only
// other thing that touches these caches.
const CACHE_PREFIX = "soft-colors-";

// --- Toast ---

let toast;

function dismissToast() {
  if (!toast) return;

  const node = toast;
  toast = null;
  node.classList.remove("is-shown");
  node.addEventListener("transitionend", () => node.remove(), { once: true });
}

function showUpdateToast(onReload) {
  if (toast) return;

  toast = document.createElement("div");
  toast.className = "pwa-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <p class="pwa-toast-text">A new version is ready.</p>
    <button type="button" class="pwa-toast-action">Reload</button>
    <button type="button" class="pwa-toast-close" aria-label="Dismiss">
      ${iconHTML("close")}
    </button>
  `;

  toast.querySelector(".pwa-toast-action").addEventListener("click", () => {
    toast.querySelector(".pwa-toast-text").textContent = "Updating…";
    toast.querySelector(".pwa-toast-action").disabled = true;
    onReload();
  });
  toast
    .querySelector(".pwa-toast-close")
    .addEventListener("click", dismissToast);

  document.body.append(toast);
  // One frame on the closed state, so the opening transition has something to
  // run from.
  requestAnimationFrame(() => toast?.classList.add("is-shown"));
}

// --- Registration ---

// Set only by the Reload button, and read by the controller change below: a
// first install claims this page too, and that hand-over must pass unnoticed.
let updateRequested = false;

// The worker fetches the document from the network, so a page that has only
// just opened is already the new build and there is nothing to reload it for:
// the worker behind it is swapped in without a word. Past that, the page on
// screen is the old build and the swap is the user's call.
const SILENT_WINDOW = 10 * 1000;
const openedAt = Date.now();

function offerUpdate(registration) {
  const waiting = registration.waiting;
  if (!waiting) return;

  if (Date.now() - openedAt < SILENT_WINDOW) {
    waiting.postMessage({ type: "SKIP_WAITING" });
    return;
  }

  showUpdateToast(() => {
    updateRequested = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  });
}

// An update check on every return to the tab, plus a slow interval for the
// window left open all afternoon. `update()` is a conditional request against
// the worker script; when nothing has shipped it costs a 304.
function watchForUpdates(registration) {
  let checking = false;

  const check = () => {
    // Offline, `update()` only fails — and the app is running from the cache
    // anyway, which is the whole point of it being there.
    if (
      checking ||
      !navigator.onLine ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    checking = true;
    registration
      .update()
      .catch((error) =>
        console.warn("Service worker update check failed:", error),
      )
      .finally(() => {
        checking = false;
      });
  };

  setInterval(check, UPDATE_CHECK_INTERVAL);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
  check();
}

function register() {
  navigator.serviceWorker
    .register(SW_URL, { updateViaCache: "none" })
    .then((registration) => {
      // A build can already be waiting from a previous visit that was never
      // reloaded, in which case `updatefound` has long since fired.
      offerUpdate(registration);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;

        installing.addEventListener("statechange", () => {
          // Without a controller this is the first install, not an update:
          // there is nothing to replace and nothing to tell the user about.
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            offerUpdate(registration);
          }
        });
      });

      watchForUpdates(registration);
    })
    .catch((error) =>
      console.error("Service worker registration failed:", error),
    );
}

// The new worker takes over, and only then is the page reloaded onto it — the
// reload is what puts the fresh assets on screen.
let reloading = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (!updateRequested || reloading) return;
  reloading = true;
  window.location.reload();
});

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", register);
  } else {
    // A worker left over from a build previewed on this same localhost port
    // has no business here: `vite dev` serves modules it knows nothing about.
    // Its cache goes with it rather than sitting in storage all week.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((it) => it.unregister()));
    window.caches
      ?.keys()
      .then((names) =>
        names
          .filter((name) => name.startsWith(CACHE_PREFIX))
          .forEach((name) => caches.delete(name)),
      );
  }
}
