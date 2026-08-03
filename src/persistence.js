import {
  MAX_COLORS,
  MODES,
  DEFAULT_PARAMS,
  TITLE_SELECTOR,
  PARAGRAPH_SELECTOR,
  makeColor,
  defaultColors,
} from "./constants.js";
import { isHex } from "./color.js";
import {
  SLIDERS,
  FORMATS,
  SIZES,
  FONTS,
  TEXT_SLIDERS,
} from "./panel/controls.js";

const STORAGE_KEY = "gradients:config";

// Bumped whenever a saved shape changes in a way restore has to know about.
// Version 0 is everything written before this field existed, which is the only
// case restoreColors still has to infer from the data itself.
const STORAGE_VERSION = 1;

const titleElement = document.querySelector(TITLE_SELECTOR);
const paragraphElement = document.querySelector(PARAGRAPH_SELECTOR);

const defaultState = () => ({
  version: STORAGE_VERSION,
  mode: "waves",
  grainEnabled: true,
  colors: defaultColors(),
  origin: { x: 0.5, y: 0.5 },
  mouseEnabled: true,
  showHandles: true,
  format: "portrait",
  size: 1080,
  exportText: false,
  params: { ...DEFAULT_PARAMS },
  title: [...titleElement.querySelectorAll("span")]
    .map((s) => s.textContent)
    .join("\n"),
  paragraph: paragraphElement.textContent,
  text: {
    font: "editorial",
    color: "#ffffff",
    titleSize: 96,
    titleLeading: 1,
    paragraphSize: 36,
    weight: 400,
  },
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clampNumber = (value, min, max, fallback) =>
  typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;

// Handle coordinates are deliberately unbounded: dragging a blob centre or a
// ramp origin off-canvas is a legitimate way to get an edge wash, and nothing
// on the write side limits it. Restoring only rejects values that are not
// numbers at all, so a saved layout comes back exactly as it was left.
const coord = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// Version 0 stored entries as plain hex strings, so a palette from an older
// build is upgraded rather than thrown away.
function restoreColors(saved, fallback, version) {
  if (!Array.isArray(saved)) return fallback;

  const entries = saved
    .map((entry, index) => {
      if (version === 0 && isHex(entry))
        return makeColor(entry, index, saved.length);
      if (!entry || typeof entry !== "object" || !isHex(entry.hex)) return null;

      const base = makeColor(entry.hex, index, saved.length);
      return {
        hex: entry.hex,
        x: coord(entry.x, base.x),
        y: coord(entry.y, base.y),
        radius: clampNumber(entry.radius, 0.05, 2, base.radius),
        stop: clampNumber(entry.stop, 0, 1, base.stop),
      };
    })
    .filter(Boolean);

  return entries.length ? entries.slice(0, MAX_COLORS) : fallback;
}

// Anything unrecognised falls back to the default, so an old or hand-edited
// entry can never leave the page in a broken state.
function restoreState() {
  const state = defaultState();

  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return state;
  }
  if (!saved || typeof saved !== "object") return state;

  const version = Number.isInteger(saved.version) ? saved.version : 0;

  state.colors = restoreColors(saved.colors, state.colors, version);

  if (MODES.some((m) => m.id === saved.mode)) state.mode = saved.mode;
  if (typeof saved.grainEnabled === "boolean")
    state.grainEnabled = saved.grainEnabled;

  if (saved.origin && typeof saved.origin === "object") {
    state.origin = {
      x: coord(saved.origin.x, 0.5),
      y: coord(saved.origin.y, 0.5),
    };
  }

  if (typeof saved.mouseEnabled === "boolean")
    state.mouseEnabled = saved.mouseEnabled;
  if (typeof saved.showHandles === "boolean")
    state.showHandles = saved.showHandles;
  if (FORMATS.some((f) => f.id === saved.format)) state.format = saved.format;
  if (SIZES.some((s) => s.value === saved.size)) state.size = saved.size;
  if (typeof saved.exportText === "boolean")
    state.exportText = saved.exportText;
  if (typeof saved.title === "string") state.title = saved.title;
  if (typeof saved.paragraph === "string") state.paragraph = saved.paragraph;

  if (saved.text && typeof saved.text === "object") {
    if (FONTS.some((f) => f.id === saved.text.font))
      state.text.font = saved.text.font;
    if (isHex(saved.text.color)) state.text.color = saved.text.color;

    TEXT_SLIDERS.forEach(({ name, min, max }) => {
      state.text[name] = clampNumber(
        saved.text[name],
        min,
        max,
        state.text[name],
      );
    });
  }

  if (saved.params && typeof saved.params === "object") {
    SLIDERS.forEach(({ name, min, max }) => {
      state.params[name] = clampNumber(
        saved.params[name],
        min,
        max,
        state.params[name],
      );
    });
  }

  return state;
}

export const state = restoreState();

let saveTimer;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or a full quota: settings just won't outlive the session
    }
  }, 200);
}

// Clearing storage is only safe if the debounced write cannot land after it —
// a pending save would otherwise put the state straight back before the reload.
export function clearSaved() {
  clearTimeout(saveTimer);
  localStorage.removeItem(STORAGE_KEY);
}
