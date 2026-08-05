/* The offer to put the app on the home screen.
 *
 * Only on touch devices, and only once the intro has played — an install
 * prompt over the first three seconds of a tool nobody has used yet is a
 * banner, not an offer. Turning it down snoozes it for a month rather than
 * hiding it for good, because the second visit is when the offer starts to
 * make sense; accepting it retires the prompt for good.
 *
 * Two routes in, because the platforms differ. Chromium hands over a deferred
 * `beforeinstallprompt` event and the toast just needs a button to fire it. On
 * iOS no such event exists at all — the browser's own Share menu is the only
 * way to add to the home screen — so there the toast can only point at it.
 */

import { iconHTML } from "../panel/dom.js";
import { showToast, dismissToast, PRIORITY } from "./toast.js";

const STORAGE_KEY = "gradients:install-prompt";
const SNOOZE = 30 * 24 * 60 * 60 * 1000;

// The intro runs for a little under three seconds from load.
const APPEAR_DELAY = 5000;

// --- Where we are ---

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS Safari's own flag, which predates the display-mode query and is still
  // the only one it sets.
  window.navigator.standalone === true;

// The home screen is a phone and tablet idea. A desktop browser can install
// this too, but there the offer is a chrome affordance the user goes looking
// for rather than something the page should raise.
const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

const isIOS = () =>
  /iP(ad|hone|od)/.test(navigator.userAgent) ||
  // iPadOS asks for desktop sites by default and reports itself as a Mac; the
  // touch points are what give it away.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// --- Memory of past answers ---

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function writeState(patch) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readState(), ...patch }),
    );
  } catch {
    // Private mode or a full quota: the prompt just gets to ask again.
  }
}

function isSuppressed() {
  const { installed, dismissedAt } = readState();
  if (installed) return true;
  return typeof dismissedAt === "number" && Date.now() - dismissedAt < SNOOZE;
}

const snooze = () => writeState({ dismissedAt: Date.now() });

// --- Toast ---

// Same console as the update toast, with the app's own icon in front of it so
// what is being offered is the thing that will end up on the home screen. A
// hint is only there when the toast has no button to press — a second line
// explaining a button next to it would be saying it twice.
function buildToast({ hint, actionLabel }) {
  const element = document.createElement("div");
  element.classList.add("pwa-toast-install");
  if (hint) element.classList.add("is-stacked");
  element.innerHTML = `
    <img class="pwa-toast-icon" src="/icons/icon.svg" alt="" width="32" height="32">
    <div class="pwa-toast-body">
      <p class="pwa-toast-text">Install Soft Colors</p>
      ${hint ? `<p class="pwa-toast-hint">${hint}</p>` : ""}
    </div>
    ${actionLabel ? `<button type="button" class="pwa-toast-action">${actionLabel}</button>` : ""}
    <button type="button" class="pwa-toast-close" aria-label="Not now">
      ${iconHTML("close")}
    </button>
  `;
  return element;
}

let shown = false;
let offer = null;

function show({ hint, actionLabel, onAction } = {}) {
  // The deferred event can arrive more than once across a session, and the iOS
  // timer knows nothing about it; one offer per visit either way.
  if (shown || isSuppressed() || isStandalone()) return;
  shown = true;

  const element = buildToast({ hint, actionLabel });
  offer = showToast(element, {
    priority: PRIORITY.install,
    onDismiss: snooze,
  });
  if (!offer) return;

  const entry = offer;
  element
    .querySelector(".pwa-toast-action")
    ?.addEventListener("click", () => onAction(entry), { once: true });
}

// --- Chromium ---

window.addEventListener("beforeinstallprompt", (event) => {
  // Held back so the browser's own banner doesn't fire on its own schedule —
  // the event is the only handle on the install dialog, and it is spent once
  // `prompt()` has been called on it.
  event.preventDefault();

  if (!isTouch()) return;

  setTimeout(() => {
    show({
      actionLabel: "Install",
      onAction: async (entry) => {
        // The browser's dialog is the prompt now; ours has said its piece and
        // steps aside without that counting as a refusal.
        dismissToast(entry, { silent: true });

        event.prompt();
        const { outcome } = await event.userChoice;
        // `appinstalled` covers the accepted case. Declining the real dialog
        // is a firmer no than closing a toast, but the snooze is the same one.
        if (outcome === "dismissed") snooze();
      },
    });
  }, APPEAR_DELAY);
});

// --- iOS ---

// Chrome and Firefox on iOS are the same engine behind a different menu, and
// both have carried Add to Home Screen in their share sheet for a while, so
// the wording points at the sheet rather than at Safari by name.
if (isIOS() && isTouch() && !isStandalone() && !isSuppressed()) {
  const share = iconHTML("share");
  setTimeout(
    () => show({ hint: `Tap ${share} then <b>Add to Home Screen</b>.` }),
    APPEAR_DELAY,
  );
}

// --- After the fact ---

// Fires however the install happened, including from the browser's own menu
// with our toast never shown.
window.addEventListener("appinstalled", () => {
  writeState({ installed: true });
  dismissToast(offer, { silent: true });
});
