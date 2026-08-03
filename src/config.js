import { MODES } from "./constants.js";
import {
  setColors,
  setMode,
  setGrainEnabled,
  setOrigin,
  setMouseEnabled,
  setParam,
} from "./gradient.js";
import { state, save, clearSaved } from "./persistence.js";
import { createHandles } from "./handles.js";
import { playIntro } from "./motion.js";
import { pick } from "./panel/dom.js";
import { createColorControls } from "./panel/colors.js";
import { createSliderControls } from "./panel/sliders.js";
import { createExportControls } from "./panel/export.js";
import { createTypographyControls } from "./panel/typography.js";

const HIDE_KEY = "h";
const REPLAY_KEY = "r";

function applyColors() {
  setColors(state.colors);
  save();
}

// --- Markup ---

const panel = document.createElement("div");
panel.className = "config";
panel.innerHTML = `
  <button type="button" class="config-toggle" aria-expanded="false" aria-controls="config-body">Config</button>
  <div class="config-body" id="config-body" hidden>
    <nav class="config-tabs" aria-label="Panel sections"></nav>

    <section class="config-section" data-tab="Style">
      <h2>Style</h2>
      <div class="config-modes"></div>
      <div class="config-sliders" data-group="shape"></div>
    </section>

    <section class="config-section" data-tab="Colors">
      <h2>Colors <span class="config-count"></span></h2>
      <ul class="config-colors"></ul>
      <div class="config-row">
        <button type="button" class="config-add">Add</button>
        <button type="button" class="config-reverse">Reverse</button>
        <button type="button" class="config-shuffle">Shuffle</button>
        <button type="button" class="config-even" hidden>Even stops</button>
      </div>
      <div class="config-row">
        <button type="button" class="config-import">Palette from image…</button>
      </div>
      <input type="file" class="config-import-input" accept="image/*" hidden>
      <p class="config-import-note">
        Drop a Color Catchers export anywhere on the page to build a gradient
        from the palette it carries.
      </p>
    </section>

    <section class="config-section" data-tab="Texture">
      <h2>Texture</h2>
      <label class="config-toggle-row">
        <input type="checkbox" class="config-grain">
        <span>Film grain</span>
      </label>
      <div class="config-sliders" data-group="texture"></div>
    </section>

    <section class="config-section" data-tab="Motion">
      <h2>Motion</h2>
      <div class="config-sliders" data-group="motion"></div>
    </section>

    <section class="config-section" data-tab="Interact">
      <h2>Interaction</h2>
      <label class="config-toggle-row">
        <input type="checkbox" class="config-mouse">
        <span>Mouse interactivity</span>
      </label>
      <label class="config-toggle-row">
        <input type="checkbox" class="config-show-handles">
        <span>On-canvas handles</span>
      </label>
    </section>

    <section class="config-section" data-tab="Export">
      <h2>Export</h2>
      <label class="config-field">
        <span>Format</span>
        <select class="config-format"></select>
      </label>
      <label class="config-field">
        <span>Short edge</span>
        <select class="config-size"></select>
      </label>
      <label class="config-toggle-row">
        <input type="checkbox" class="config-export-text">
        <span>Include title and paragraph</span>
      </label>
      <p class="config-note"></p>
      <button type="button" class="config-export">Export PNG</button>
    </section>

    <section class="config-section" data-tab="Text">
      <h2>Text</h2>
      <label class="config-field">
        <span>Title (one line per row)</span>
        <textarea class="config-title" rows="3" spellcheck="false"></textarea>
      </label>
      <label class="config-field">
        <span>Paragraph</span>
        <textarea class="config-paragraph" rows="3" spellcheck="false"></textarea>
      </label>
      <label class="config-field">
        <span>Font</span>
        <select class="config-font"></select>
      </label>
      <div class="config-sliders" data-group="text"></div>
      <label class="config-field">
        <span>Color</span>
      </label>
      <div class="config-color-head">
        <input type="color" class="config-text-color" aria-label="Text color">
        <input type="text" class="config-hex config-text-hex" spellcheck="false" aria-label="Text color hex value">
      </div>
      <button type="button" class="config-replay">Replay intro animation</button>
    </section>

    <section class="config-section" data-tab="More">
      <button type="button" class="config-reset">Reset to defaults</button>
    </section>

    <p class="config-hint">
      <kbd>${HIDE_KEY.toUpperCase()}</kbd> hides this panel,
      <kbd>${REPLAY_KEY.toUpperCase()}</kbd> replays the intro
    </p>
  </div>
`;
document.body.appendChild(panel);

const toggleButton = pick(panel, ".config-toggle");
const body = pick(panel, ".config-body");
const modeList = pick(panel, ".config-modes");
const grainCheckbox = pick(panel, ".config-grain");
const mouseCheckbox = pick(panel, ".config-mouse");
const handlesCheckbox = pick(panel, ".config-show-handles");
const resetButton = pick(panel, ".config-reset");

// --- Panel open / close / hide ---

toggleButton.addEventListener("click", () => {
  const open = body.hasAttribute("hidden");
  body.toggleAttribute("hidden", !open);
  toggleButton.setAttribute("aria-expanded", String(open));
});

// --- Sections ---

// One long scroll is fine in the desktop sidebar but miserable on a phone, so
// the sheet shows a single section at a time. Which one is visible is decided
// purely in CSS from `is-active`, so the desktop layout ignores all of this and
// keeps every section on screen.
const tabList = pick(panel, ".config-tabs");
const sections = [...panel.querySelectorAll(".config-section")];

function setTab(index) {
  sections.forEach((section, i) =>
    section.classList.toggle("is-active", i === index),
  );
  tabList.querySelectorAll(".config-tab").forEach((button, i) => {
    button.classList.toggle("is-active", i === index);
    button.setAttribute("aria-pressed", String(i === index));
  });
}

sections.forEach((section, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "config-tab";
  button.textContent = section.dataset.tab;
  button.addEventListener("click", () => setTab(index));
  tabList.appendChild(button);
});

setTab(0);

const SHORTCUTS = {
  [HIDE_KEY]: () => panel.classList.toggle("is-hidden"),
  [REPLAY_KEY]: () => playIntro(),
};

document.addEventListener("keydown", (event) => {
  // Leaves browser combos such as Cmd+R alone
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const action = SHORTCUTS[event.key.toLowerCase()];
  if (!action) return;

  // Never swallow the key while the user is typing into the panel
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  action();
});

// --- Control groups ---

// The handles call into the control groups and the control groups call back
// into the handles, so the callbacks reach for `ui` lazily rather than closing
// over bindings that do not exist yet.
const ui = {};

const handles = createHandles({
  state,
  // `row` marks the one list row whose value changed. A plain position drag
  // fires at pointer-event rate and changes nothing in the list, so it passes
  // no hint and the DOM is left alone.
  onColorsChange: (hint) => {
    applyColors();
    if (hint?.row != null) ui.colors.syncRow(hint.row);
  },
  onOriginChange: () => {
    setOrigin(state.origin.x, state.origin.y);
    save();
  },
  onShapeChange: () => {
    setParam("angle", state.params.angle);
    setParam("spread", state.params.spread);
    ui.sliders.sync();
    save();
  },
});

ui.colors = createColorControls({ panel, state, applyColors, handles });
ui.sliders = createSliderControls({
  panel,
  state,
  save,
  onShapeParam: () => handles.sync(),
});
ui.export = createExportControls({ panel, state, save });
ui.typography = createTypographyControls({ panel, state, save });

// --- Palette drop ---

// A Color Catchers export carries its palette as metadata, so dropping one on
// the page is enough to rebuild the gradient from it. The target is the whole
// window because that is what the canvas covers.
const colorsTab = sections.findIndex(
  (section) => section.dataset.tab === "Colors",
);

const hasFiles = (event) => event.dataTransfer?.types.includes("Files");

let dragDepth = 0;

function setDropping(active) {
  document.body.classList.toggle("is-dropping", active);
}

// dragenter and dragleave both fire on every element the pointer crosses, and
// the enter for the element being moved onto arrives before the leave for the
// one being left — so only a depth counter tells a real exit from a move
// between children.
window.addEventListener("dragenter", (event) => {
  if (!hasFiles(event)) return;
  dragDepth += 1;
  setDropping(true);
});

window.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) setDropping(false);
});

// Without a prevented dragover the browser refuses the drop outright and
// navigates to the file instead.
window.addEventListener("dragover", (event) => {
  if (hasFiles(event)) event.preventDefault();
});

window.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  event.preventDefault();

  dragDepth = 0;
  setDropping(false);

  // An image with no palette in it changes nothing on screen, so the note
  // saying so has to be visible before the read even starts.
  panel.classList.remove("is-hidden");
  body.removeAttribute("hidden");
  toggleButton.setAttribute("aria-expanded", "true");
  setTab(colorsTab);

  ui.colors.importFile(file);
});

// --- Style ---

MODES.forEach(({ id, label }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "config-mode";
  button.dataset.mode = id;
  button.textContent = label;
  button.addEventListener("click", () => {
    state.mode = id;
    setMode(id);
    save();
    renderModes();
    ui.colors.render();
    ui.sliders.syncVisibility();
    handles.refresh();
  });
  modeList.appendChild(button);
});

function renderModes() {
  modeList.querySelectorAll(".config-mode").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.mode === state.mode),
    );
  });
}

// --- Toggles ---

grainCheckbox.addEventListener("change", () => {
  state.grainEnabled = grainCheckbox.checked;
  setGrainEnabled(state.grainEnabled);
  save();
});

mouseCheckbox.addEventListener("change", () => {
  state.mouseEnabled = mouseCheckbox.checked;
  setMouseEnabled(state.mouseEnabled);
  save();
});

handlesCheckbox.addEventListener("change", () => {
  state.showHandles = handlesCheckbox.checked;
  save();
  handles.refresh();
});

// --- Reset ---

resetButton.addEventListener("click", () => {
  clearSaved();
  location.reload();
});

// --- Apply the restored state ---

setColors(state.colors);
setMode(state.mode);
setGrainEnabled(state.grainEnabled);
setOrigin(state.origin.x, state.origin.y);
setMouseEnabled(state.mouseEnabled);
Object.entries(state.params).forEach(([name, value]) => setParam(name, value));

renderModes();
ui.colors.render();
ui.sliders.sync();
ui.sliders.syncVisibility();
handles.refresh();

grainCheckbox.checked = state.grainEnabled;
mouseCheckbox.checked = state.mouseEnabled;
handlesCheckbox.checked = state.showHandles;

ui.export.sync();
ui.typography.sync();
