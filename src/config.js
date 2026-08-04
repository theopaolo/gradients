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
import { pick, iconHTML } from "./panel/dom.js";
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

// A checkbox the panel can actually style: the real input stays in the
// accessibility tree and takes focus, the drawn box next to it takes the paint.
const check = (className, label) => `
  <label class="config-check">
    <input type="checkbox" class="${className}">
    <span class="config-check-box">${iconHTML("check")}</span>
    <span>${label}</span>
  </label>
`;

const panel = document.createElement("div");
panel.className = "config";
panel.innerHTML = `
  <button type="button" class="config-toggle" aria-expanded="false" aria-controls="config-body">
    ${iconHTML("sliders")}
    <span class="config-toggle-label">Tune</span>
    <span class="config-chevron">${iconHTML("chevron")}</span>
  </button>

  <div class="config-body" id="config-body" hidden>
    <div class="config-tabs" role="tablist" aria-label="Panel sections"></div>

    <section class="config-section" data-tab="Style">
      <p class="config-group">Gradient style</p>
      <div class="config-modes"></div>

      <p class="config-group">Shape</p>
      <div class="config-sliders" data-group="shape"></div>

      <p class="config-group">Canvas</p>
      ${check("config-mouse", "Follow the pointer")}
      ${check("config-show-handles", "Show drag handles")}
    </section>

    <section class="config-section" data-tab="Colors">
      <p class="config-group">Palette <span class="config-count"></span></p>
      <ul class="config-colors"></ul>
      <div class="config-row">
        <button type="button" class="config-btn config-add">${iconHTML("plus")}Add</button>
        <button type="button" class="config-btn config-reverse">Reverse</button>
        <button type="button" class="config-btn config-shuffle">Shuffle</button>
      </div>
      <div class="config-row">
        <button type="button" class="config-btn config-even" hidden>Space stops evenly</button>
      </div>

      <p class="config-group">From an image</p>
      <div class="config-row">
        <button type="button" class="config-btn config-import">Choose an image…</button>
      </div>
      <input type="file" class="config-import-input" accept="image/*" hidden>
      <p class="config-note config-import-note">
        Drop a Color Catchers export anywhere on the page to load its palette.
      </p>
    </section>

    <section class="config-section" data-tab="Texture">
      <p class="config-group">Grain</p>
      ${check("config-grain", "Show film grain")}
      <div class="config-sliders" data-group="grain"></div>

      <p class="config-group">Warp</p>
      <div class="config-sliders" data-group="warp"></div>
    </section>

    <section class="config-section" data-tab="Motion">
      <div class="config-sliders" data-group="motion"></div>
    </section>

    <section class="config-section" data-tab="Text">
      <p class="config-group">Copy</p>
      <label class="config-field">
        <span class="config-field-label">Title (one line per row)</span>
        <textarea class="config-title" rows="2" spellcheck="false"></textarea>
      </label>
      <label class="config-field">
        <span class="config-field-label">Paragraph</span>
        <textarea class="config-paragraph" rows="2" spellcheck="false"></textarea>
      </label>

      <p class="config-group">Type</p>
      <label class="config-field">
        <span class="config-field-label">Font</span>
        <select class="config-font"></select>
      </label>
      <div class="config-sliders" data-group="text"></div>

      <p class="config-group">Color</p>
      <div class="config-color-head">
        <input type="color" class="config-text-color" aria-label="Text color">
        <input type="text" class="config-hex config-text-hex" spellcheck="false" aria-label="Text color hex value">
      </div>

      <button type="button" class="config-btn config-btn-wide config-replay">Replay the intro</button>
    </section>

    <section class="config-section" data-tab="Export">
      <label class="config-field">
        <span class="config-field-label">Format</span>
        <select class="config-format"></select>
      </label>
      <label class="config-field">
        <span class="config-field-label">Short edge</span>
        <select class="config-size"></select>
      </label>
      ${check("config-export-text", "Include the title and paragraph")}
      <p class="config-note config-export-note"></p>
      <button type="button" class="config-btn config-btn-primary config-btn-wide config-export">Export PNG</button>
    </section>

    <div class="config-footer">
      <p class="config-hint">
        <kbd>${HIDE_KEY.toUpperCase()}</kbd> hides the panel,
        <kbd>${REPLAY_KEY.toUpperCase()}</kbd> replays the intro
      </p>
      <div class="config-footer-actions">
        <button type="button" class="config-reset">Reset</button>
        <button type="button" class="config-close">${iconHTML("close")}Close</button>
      </div>
    </div>
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
const closeButton = pick(panel, ".config-close");

// --- Panel open / close / hide ---

function setOpen(open) {
  body.toggleAttribute("hidden", !open);
  panel.classList.toggle("is-open", open);
  toggleButton.setAttribute("aria-expanded", String(open));
}

toggleButton.addEventListener("click", () =>
  setOpen(body.hasAttribute("hidden")),
);

closeButton.addEventListener("click", () => setOpen(false));

// --- Tabs ---

// Six sections stacked in a 300px column is a two-thousand-pixel scroll, so
// only one is ever in the flow — on the desktop panel as much as on the phone
// sheet, where the scroll was worse but the problem was the same.
const tabList = pick(panel, ".config-tabs");
const sections = [...panel.querySelectorAll(".config-section")];
const tabs = [];

function setTab(index) {
  sections.forEach((section, i) =>
    section.classList.toggle("is-active", i === index),
  );
  tabs.forEach((tab, i) => {
    tab.classList.toggle("is-active", i === index);
    tab.setAttribute("aria-selected", String(i === index));
    // Only the current tab is a tab stop; the arrow keys move between them
    tab.tabIndex = i === index ? 0 : -1;
  });
}

sections.forEach((section, index) => {
  const name = section.dataset.tab;
  const id = `config-tab-${name.toLowerCase()}`;

  const button = document.createElement("button");
  button.type = "button";
  button.id = id;
  button.className = "config-tab";
  button.setAttribute("role", "tab");
  button.textContent = name;
  button.addEventListener("click", () => setTab(index));

  section.id = `config-panel-${name.toLowerCase()}`;
  section.setAttribute("role", "tabpanel");
  section.setAttribute("aria-labelledby", id);
  button.setAttribute("aria-controls", section.id);

  tabList.appendChild(button);
  tabs.push(button);
});

tabList.addEventListener("keydown", (event) => {
  const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!offset) return;
  event.preventDefault();
  const current = tabs.indexOf(document.activeElement);
  const next = (current + offset + tabs.length) % tabs.length;
  setTab(next);
  tabs[next].focus();
});

setTab(0);

// --- Fading while a slider is being moved ---

// Every slider changes something on the canvas the panel is sitting on top of,
// and the panel covers the top-right corner of it. So for as long as one is
// being moved the panel drops to a hint of itself and gets out of the way of
// its own result. It stays in the flow and stays interactive: the drag has to
// be able to finish, and the fade has to end with it.
const isSlider = (node) =>
  node instanceof HTMLInputElement && node.type === "range";
const setTuning = (tuning) => panel.classList.toggle("is-tuning", tuning);

panel.addEventListener("pointerdown", (event) => {
  if (isSlider(event.target)) setTuning(true);
});

// A range keeps the pointer once it has it, so the release can land well
// outside the panel — and outside anything faded, which is the whole point.
window.addEventListener("pointerup", () => setTuning(false));
window.addEventListener("pointercancel", () => setTuning(false));

// The arrow keys move a slider too, and hide the result the same way. Watching
// the release on the window rather than the panel keeps the panel from sticking
// at a tenth of itself if focus moves while the key is still down.
const isArrow = (key) => key.startsWith("Arrow");

panel.addEventListener("keydown", (event) => {
  if (isSlider(event.target) && isArrow(event.key)) setTuning(true);
});

window.addEventListener("keyup", (event) => {
  if (isArrow(event.key)) setTuning(false);
});

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
    syncModeChips();
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

ui.colors = createColorControls({
  panel,
  state,
  applyColors,
  handles,
  onPaletteChange: () => syncModeChips(),
});
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
  setOpen(true);
  setTab(colorsTab);

  ui.colors.importFile(file);
});

// --- Style ---

MODES.forEach(({ id, label }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "config-mode";
  button.dataset.mode = id;

  const chip = document.createElement("span");
  chip.className = "config-mode-chip";

  const name = document.createElement("span");
  name.textContent = label;

  button.append(chip, name);
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

// Every style chip previews itself in the palette that is actually loaded, so
// the picker doubles as a legend for what the current colors do in each one.
function syncModeChips() {
  const [first, second, third] = state.colors;
  modeList.style.setProperty("--c1", first.hex);
  modeList.style.setProperty("--c2", (second ?? first).hex);
  modeList.style.setProperty("--c3", (third ?? second ?? first).hex);
}

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
syncModeChips();
ui.colors.render();
ui.sliders.sync();
ui.sliders.syncVisibility();
handles.refresh();

grainCheckbox.checked = state.grainEnabled;
mouseCheckbox.checked = state.mouseEnabled;
handlesCheckbox.checked = state.showHandles;

ui.export.sync();
ui.typography.sync();
