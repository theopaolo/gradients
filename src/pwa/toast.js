/* The one notification slot.
 *
 * Two notices want the same corner — a build waiting to be reloaded onto, and
 * an offer to install — and stacking them there would cover the artwork the
 * app exists to show. So only one is up at a time and the more urgent one owns
 * the slot: an update the user has to act on displaces an invitation they can
 * ignore, never the other way round.
 */

// Higher wins the slot.
export const PRIORITY = { install: 0, update: 1 };

let current = null;

// Displacing a toast is not the user turning it down, so this is the visual
// half only; `dismissToast` is the half that reports back.
function hide(entry) {
  const { element } = entry;

  // Nothing to transition from if the opening frame has not landed yet.
  if (!element.classList.contains("is-shown")) {
    element.remove();
    return;
  }

  element.classList.remove("is-shown");
  element.addEventListener("transitionend", () => element.remove(), {
    once: true,
  });
}

// `element` carries the toast's own markup; the close button is wired here if
// it has one, since every toast dismisses the same way.
export function showToast(element, { priority = 0, onDismiss } = {}) {
  if (current) {
    if (priority <= current.priority) return null;
    hide(current);
  }

  const entry = { element, priority, onDismiss };
  current = entry;

  element.classList.add("pwa-toast");
  element.setAttribute("role", "status");
  element
    .querySelector(".pwa-toast-close")
    ?.addEventListener("click", () => dismissToast(entry));

  document.body.append(element);
  // One frame on the closed state, so the opening transition has something to
  // run from.
  requestAnimationFrame(() => element.classList.add("is-shown"));

  return entry;
}

// `silent` closes a toast that has served its purpose — the install prompt
// once the browser's own dialog has taken over — without it counting as a
// refusal.
export function dismissToast(entry, { silent = false } = {}) {
  if (!entry || current !== entry) return;

  current = null;
  hide(entry);
  if (!silent) entry.onDismiss?.();
}
