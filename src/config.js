import {
  MAX_COLORS,
  MODES,
  RAMP_MODES,
  DEFAULT_COLORS,
  DEFAULT_PARAMS,
  makeColor,
  defaultColors,
  setColors,
  setMode,
  setGrainEnabled,
  setOrigin,
  setMouseEnabled,
  setParam,
  renderStill,
  maxExportSize,
} from './main.js';
import { createHandles } from './handles.js';
import { playIntro } from './motion.js';

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HIDE_KEY = 'h';
const REPLAY_KEY = 'r';
const STORAGE_KEY = 'gradients:config';

// Each slider drives the shader uniform of the same name. `modes` limits a
// slider to the gradient styles it actually affects; omitting it means always.
const SLIDERS = [
  { group: 'shape', name: 'angle', label: 'Angle', min: 0, max: 360, step: 1, modes: ['linear', 'square', 'diamond', 'conic'] },
  { group: 'shape', name: 'spread', label: 'Spread', min: 0.1, max: 4, step: 0.01, modes: RAMP_MODES },
  { group: 'shape', name: 'softness', label: 'Blend easing', min: 0, max: 1, step: 0.01, modes: RAMP_MODES },
  { group: 'shape', name: 'blobSharpness', label: 'Blob falloff', min: 0.5, max: 12, step: 0.1, modes: ['mesh'] },

  { group: 'motion', name: 'speed', label: 'Speed', min: 0, max: 3, step: 0.01 },
  { group: 'motion', name: 'orbitRadius', label: 'Drift', min: 0, max: 2, step: 0.01, modes: ['mesh', 'waves'] },
  { group: 'motion', name: 'frequency', label: 'Wave frequency', min: 0.1, max: 4, step: 0.01, modes: ['waves'] },
  { group: 'motion', name: 'intensity', label: 'Wave intensity', min: 0, max: 3, step: 0.01, modes: ['waves'] },

  { group: 'texture', name: 'grainAmount', label: 'Grain amount', min: 0, max: 0.2, step: 0.001 },
  { group: 'texture', name: 'warpAmount', label: 'Warp', min: 0, max: 0.6, step: 0.005 },
  { group: 'texture', name: 'warpScale', label: 'Warp scale', min: 0.2, max: 12, step: 0.1 },
];

// Sizes are driven by the short edge, which is how the social formats are
// actually specified: 1080 short gives exactly 1080x1350 and 1080x1920.
const FORMATS = [
  { id: 'viewport', label: 'Viewport', ratio: null },
  { id: 'square', label: 'Square 1:1', ratio: 1 },
  { id: 'portrait', label: 'Portrait 4:5', ratio: 4 / 5 },
  { id: 'story', label: 'Story 9:16', ratio: 9 / 16 },
  { id: 'landscape', label: 'Landscape 16:9', ratio: 16 / 9 },
];

const SIZES = [
  { value: 1080, label: '1080 — social' },
  { value: 1440, label: '1440' },
  { value: 2160, label: '2160' },
  { value: 3240, label: '3240 — print' },
  { value: 4096, label: '4096 — print' },
];

const PRINT_DPI = 300;

// `variable` marks the one face that carries a real weight axis; the others
// would only get synthetic bolding, so the weight slider stays hidden for them.
const FONTS = [
  { id: 'editorial', label: 'Editorial Old', stack: '"Editorial Old", serif' },
  { id: 'museum', label: 'PP Museum', stack: '"PP Museum", serif' },
  { id: 'museum-ultra', label: 'PP Museum Ultrabold', stack: '"PP Museum Ultrabold", serif' },
  { id: 'snpro', label: 'SN Pro', stack: '"SN Pro", sans-serif' },
  { id: 'worksans', label: 'Work Sans', stack: '"Work Sans", sans-serif', variable: true },
];

// Absolute sizes rather than viewport units, so the same value holds on a phone
const TEXT_SLIDERS = [
  { name: 'titleSize', label: 'Title size', min: 16, max: 240, step: 1, property: '--title-size', unit: 'px' },
  { name: 'titleLeading', label: 'Title line height', min: 0.7, max: 2, step: 0.01, property: '--title-leading', unit: '' },
  { name: 'paragraphSize', label: 'Paragraph size', min: 10, max: 96, step: 1, property: '--paragraph-size', unit: 'px' },
  { name: 'weight', label: 'Weight', min: 100, max: 900, step: 10, property: '--text-weight', unit: '', variableOnly: true },
];

const titleElement = document.querySelector('.smooth-web');
const paragraphElement = document.querySelector('.p-container p');

// --- Persistence ---

const defaultState = () => ({
  mode: 'waves',
  grainEnabled: true,
  colors: defaultColors(),
  origin: { x: 0.5, y: 0.5 },
  mouseEnabled: true,
  showHandles: true,
  format: 'portrait',
  size: 1080,
  params: { ...DEFAULT_PARAMS },
  title: [...titleElement.querySelectorAll('span')].map((s) => s.textContent).join('\n'),
  paragraph: paragraphElement.textContent,
  text: {
    font: 'editorial',
    color: '#ffffff',
    titleSize: 96,
    titleLeading: 1,
    paragraphSize: 36,
    weight: 400,
  },
});

const isHex = (value) => typeof value === 'string' && HEX_PATTERN.test(value);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const clamp01 = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, -1, 2) : fallback;

// Entries used to be plain hex strings, so a saved palette from an older build
// is upgraded rather than thrown away.
function restoreColors(saved, fallback) {
  if (!Array.isArray(saved)) return fallback;

  const entries = saved
    .map((entry, index) => {
      if (isHex(entry)) return makeColor(entry, index, saved.length);
      if (!entry || typeof entry !== 'object' || !isHex(entry.hex)) return null;

      const base = makeColor(entry.hex, index, saved.length);
      return {
        hex: entry.hex,
        x: clamp01(entry.x, base.x),
        y: clamp01(entry.y, base.y),
        radius: typeof entry.radius === 'number' && Number.isFinite(entry.radius)
          ? clamp(entry.radius, 0.05, 2)
          : base.radius,
        stop: typeof entry.stop === 'number' && Number.isFinite(entry.stop)
          ? clamp(entry.stop, 0, 1)
          : base.stop,
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
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return state;
  }
  if (!saved || typeof saved !== 'object') return state;

  state.colors = restoreColors(saved.colors, state.colors);

  if (MODES.some((m) => m.id === saved.mode)) state.mode = saved.mode;
  if (typeof saved.grainEnabled === 'boolean') state.grainEnabled = saved.grainEnabled;

  if (saved.origin && typeof saved.origin === 'object') {
    state.origin = {
      x: clamp01(saved.origin.x, 0.5),
      y: clamp01(saved.origin.y, 0.5),
    };
  }

  if (typeof saved.mouseEnabled === 'boolean') state.mouseEnabled = saved.mouseEnabled;
  if (typeof saved.showHandles === 'boolean') state.showHandles = saved.showHandles;
  if (FORMATS.some((f) => f.id === saved.format)) state.format = saved.format;
  if (SIZES.some((s) => s.value === saved.size)) state.size = saved.size;
  if (typeof saved.title === 'string') state.title = saved.title;
  if (typeof saved.paragraph === 'string') state.paragraph = saved.paragraph;

  if (saved.text && typeof saved.text === 'object') {
    if (FONTS.some((f) => f.id === saved.text.font)) state.text.font = saved.text.font;
    if (isHex(saved.text.color)) state.text.color = saved.text.color;

    TEXT_SLIDERS.forEach(({ name, min, max }) => {
      const value = saved.text[name];
      if (typeof value === 'number' && Number.isFinite(value)) {
        state.text[name] = clamp(value, min, max);
      }
    });
  }

  if (saved.params && typeof saved.params === 'object') {
    SLIDERS.forEach(({ name, min, max }) => {
      const value = saved.params[name];
      if (typeof value === 'number' && Number.isFinite(value)) {
        state.params[name] = clamp(value, min, max);
      }
    });
  }

  return state;
}

const state = restoreState();

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or a full quota: settings just won't outlive the session
    }
  }, 200);
}

// --- Shared appliers ---

function applyColors() {
  setColors(state.colors);
  save();
}

const isRampMode = () => RAMP_MODES.includes(state.mode);

// --- Markup ---

const panel = document.createElement('div');
panel.className = 'config';
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

const toggleButton = panel.querySelector('.config-toggle');
const body = panel.querySelector('.config-body');
const modeList = panel.querySelector('.config-modes');
const colorList = panel.querySelector('.config-colors');
const colorCount = panel.querySelector('.config-count');
const grainCheckbox = panel.querySelector('.config-grain');
const addButton = panel.querySelector('.config-add');
const reverseButton = panel.querySelector('.config-reverse');
const shuffleButton = panel.querySelector('.config-shuffle');
const evenButton = panel.querySelector('.config-even');
const mouseCheckbox = panel.querySelector('.config-mouse');
const handlesCheckbox = panel.querySelector('.config-show-handles');
const formatSelect = panel.querySelector('.config-format');
const sizeSelect = panel.querySelector('.config-size');
const exportNote = panel.querySelector('.config-note');
const exportButton = panel.querySelector('.config-export');
const titleInput = panel.querySelector('.config-title');
const paragraphInput = panel.querySelector('.config-paragraph');
const fontSelect = panel.querySelector('.config-font');
const textColorInput = panel.querySelector('.config-text-color');
const textHexInput = panel.querySelector('.config-text-hex');
const replayButton = panel.querySelector('.config-replay');
const resetButton = panel.querySelector('.config-reset');

// --- Panel open / close / hide ---

toggleButton.addEventListener('click', () => {
  const open = body.hasAttribute('hidden');
  body.toggleAttribute('hidden', !open);
  toggleButton.setAttribute('aria-expanded', String(open));
});

// --- Sections ---

// One long scroll is fine in the desktop sidebar but miserable on a phone, so
// the sheet shows a single section at a time. Which one is visible is decided
// purely in CSS from `is-active`, so the desktop layout ignores all of this and
// keeps every section on screen.
const tabList = panel.querySelector('.config-tabs');
const sections = [...panel.querySelectorAll('.config-section')];

function setTab(index) {
  sections.forEach((section, i) => section.classList.toggle('is-active', i === index));
  tabList.querySelectorAll('.config-tab').forEach((button, i) => {
    button.classList.toggle('is-active', i === index);
    button.setAttribute('aria-pressed', String(i === index));
  });
}

sections.forEach((section, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'config-tab';
  button.textContent = section.dataset.tab;
  button.addEventListener('click', () => setTab(index));
  tabList.appendChild(button);
});

setTab(0);

const SHORTCUTS = {
  [HIDE_KEY]: () => panel.classList.toggle('is-hidden'),
  [REPLAY_KEY]: () => playIntro(),
};

document.addEventListener('keydown', (event) => {
  // Leaves browser combos such as Cmd+R alone
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const action = SHORTCUTS[event.key.toLowerCase()];
  if (!action) return;

  // Never swallow the key while the user is typing into the panel
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  action();
});

// --- On-canvas handles ---

const handles = createHandles({
  state,
  onColorsChange: () => {
    applyColors();
    renderColors();
  },
  onOriginChange: () => {
    setOrigin(state.origin.x, state.origin.y);
    save();
  },
  onShapeChange: () => {
    setParam('angle', state.params.angle);
    setParam('spread', state.params.spread);
    syncSliders();
    save();
  },
});

// --- Style ---

MODES.forEach(({ id, label }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'config-mode';
  button.dataset.mode = id;
  button.textContent = label;
  button.addEventListener('click', () => {
    state.mode = id;
    setMode(id);
    save();
    renderModes();
    renderColors();
    syncSliderVisibility();
    handles.refresh();
  });
  modeList.appendChild(button);
});

function renderModes() {
  modeList.querySelectorAll('.config-mode').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mode === state.mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
  });
}

// --- Colors ---

// Stops belong to the slot rather than to the color, so moving a color up or
// down actually moves it along the ramp instead of carrying its position along.
function moveColor(from, to) {
  const stops = state.colors.map((entry) => entry.stop);
  const [moved] = state.colors.splice(from, 1);
  state.colors.splice(to, 0, moved);
  state.colors.forEach((entry, index) => { entry.stop = stops[index]; });
}

// Keyboard path: rebuilds the list, then puts focus back on the grip that moved
function reorder(from, to) {
  if (to < 0 || to >= state.colors.length) return;
  moveColor(from, to);
  applyColors();
  renderColors();
  handles.refresh();
  colorList.children[to]?.querySelector('.config-grip')?.focus();
}

// Which row the pointer is over, by comparing against each row's midpoint
function rowIndexAt(clientY) {
  const rows = [...colorList.children];
  const found = rows.findIndex((row) => {
    const rect = row.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });
  return found === -1 ? rows.length - 1 : found;
}

let drag = null;

function makeGrip(index) {
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'config-grip';
  grip.textContent = '⠿';
  grip.setAttribute('aria-label', `Reorder color ${index + 1} — drag, or use the arrow keys`);

  grip.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    grip.setPointerCapture(event.pointerId);
    drag = { index, grip, row: colorList.children[index] };
    drag.row.classList.add('is-dragging');
  });

  grip.addEventListener('pointermove', (event) => {
    if (drag?.grip !== grip) return;

    const target = rowIndexAt(event.clientY);
    if (target === drag.index) return;

    // The rows are moved in place rather than re-rendered, because rebuilding
    // the list mid-drag would destroy the element holding the pointer capture
    const rows = [...colorList.children];
    colorList.insertBefore(
      drag.row,
      target > drag.index ? rows[target].nextSibling : rows[target]
    );

    moveColor(drag.index, target);
    drag.index = target;
    applyColors();
  });

  // Ownership of the drag is the condition, not hasPointerCapture: the capture
  // is already being torn down by the time pointerup is dispatched.
  const end = () => {
    if (drag?.grip !== grip) return;
    drag.row.classList.remove('is-dragging');
    drag = null;
    // Now safe to rebuild, which resyncs every row's index-based labels
    renderColors();
    handles.refresh();
  };

  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  // Catches the drag being interrupted without a pointerup of its own
  grip.addEventListener('lostpointercapture', end);

  grip.addEventListener('keydown', (event) => {
    const offset = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!offset) return;
    event.preventDefault();
    reorder(index, index + offset);
  });

  return grip;
}

function distributeStops() {
  const count = state.colors.length;
  state.colors.forEach((entry, index) => {
    entry.stop = count > 1 ? index / (count - 1) : 0;
  });
}

function renderColors() {
  colorList.innerHTML = '';

  const showStops = isRampMode();
  const showSize = state.mode === 'mesh';

  state.colors.forEach((entry, index) => {
    const row = document.createElement('li');
    row.className = 'config-color';

    const head = document.createElement('div');
    head.className = 'config-color-head';

    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.value = entry.hex;
    swatch.setAttribute('aria-label', `Color ${index + 1}`);

    const text = document.createElement('input');
    text.type = 'text';
    text.className = 'config-hex';
    text.value = entry.hex;
    text.spellcheck = false;
    text.setAttribute('aria-label', `Color ${index + 1} hex value`);

    swatch.addEventListener('input', () => {
      entry.hex = swatch.value;
      text.value = swatch.value;
      applyColors();
      handles.refresh();
    });

    text.addEventListener('input', () => {
      if (!HEX_PATTERN.test(text.value)) return;
      const normalized = text.value.startsWith('#') ? text.value : `#${text.value}`;
      entry.hex = normalized;
      swatch.value = normalized.length === 4
        ? `#${normalized.slice(1).split('').map((c) => c + c).join('')}`
        : normalized;
      applyColors();
      handles.refresh();
    });

    head.append(makeGrip(index), swatch, text);

    if (state.colors.length > 1) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'config-icon';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove color ${index + 1}`);
      remove.addEventListener('click', () => {
        state.colors.splice(index, 1);
        distributeStops();
        applyColors();
        renderColors();
        handles.refresh();
      });
      head.appendChild(remove);
    }

    row.appendChild(head);

    if (showStops || showSize) {
      const key = showStops ? 'stop' : 'radius';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'config-color-value';
      slider.min = showStops ? 0 : 0.05;
      slider.max = showStops ? 1 : 2;
      slider.step = 0.01;
      slider.value = entry[key];
      slider.setAttribute(
        'aria-label',
        showStops ? `Color ${index + 1} stop` : `Color ${index + 1} size`
      );
      slider.addEventListener('input', () => {
        entry[key] = parseFloat(slider.value);
        applyColors();
      });
      row.appendChild(slider);
    }

    colorList.appendChild(row);
  });

  colorCount.textContent = `${state.colors.length}/${MAX_COLORS}`;
  addButton.disabled = state.colors.length >= MAX_COLORS;
  evenButton.hidden = !showStops;
}

addButton.addEventListener('click', () => {
  if (state.colors.length >= MAX_COLORS) return;
  const last = state.colors[state.colors.length - 1];
  state.colors.push(makeColor(last.hex, state.colors.length, state.colors.length + 1));
  distributeStops();
  applyColors();
  renderColors();
  handles.refresh();
});

reverseButton.addEventListener('click', () => {
  const stops = state.colors.map((entry) => entry.stop);
  state.colors.reverse();
  state.colors.forEach((entry, index) => { entry.stop = stops[index]; });
  applyColors();
  renderColors();
  handles.refresh();
});

shuffleButton.addEventListener('click', () => {
  const stops = state.colors.map((entry) => entry.stop);
  for (let i = state.colors.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.colors[i], state.colors[j]] = [state.colors[j], state.colors[i]];
  }
  state.colors.forEach((entry, index) => { entry.stop = stops[index]; });
  applyColors();
  renderColors();
  handles.refresh();
});

evenButton.addEventListener('click', () => {
  distributeStops();
  applyColors();
  renderColors();
});

// --- Grain ---

grainCheckbox.addEventListener('change', () => {
  state.grainEnabled = grainCheckbox.checked;
  setGrainEnabled(state.grainEnabled);
  save();
});

// --- Motion parameters ---

const sliderControls = SLIDERS.map((definition) => {
  const { group, name, label, min, max, step } = definition;

  const field = document.createElement('label');
  field.className = 'config-slider';

  const caption = document.createElement('span');
  const value = document.createElement('output');
  caption.textContent = label;
  caption.appendChild(value);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;

  slider.addEventListener('input', () => {
    const parsed = parseFloat(slider.value);
    state.params[name] = parsed;
    value.textContent = parsed;
    setParam(name, parsed);
    save();
    if (name === 'angle' || name === 'spread') handles.sync();
  });

  field.append(caption, slider);
  panel.querySelector(`.config-sliders[data-group="${group}"]`).appendChild(field);

  return { definition, field, slider, value };
});

// Pulls the visible sliders back in line after a drag on the canvas moved them
function syncSliders() {
  sliderControls.forEach(({ definition, slider, value }) => {
    const current = state.params[definition.name];
    slider.value = current;
    value.textContent = Math.round(current * 100) / 100;
  });
}

function syncSliderVisibility() {
  sliderControls.forEach(({ definition, field }) => {
    field.hidden = Boolean(definition.modes) && !definition.modes.includes(state.mode);
  });
}

// --- Mouse interactivity ---

mouseCheckbox.addEventListener('change', () => {
  state.mouseEnabled = mouseCheckbox.checked;
  setMouseEnabled(state.mouseEnabled);
  save();
});

handlesCheckbox.addEventListener('change', () => {
  state.showHandles = handlesCheckbox.checked;
  save();
  handles.refresh();
});

// --- Export ---

FORMATS.forEach(({ id, label }) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = label;
  formatSelect.appendChild(option);
});

SIZES.forEach(({ value, label }) => {
  const option = document.createElement('option');
  option.value = String(value);
  option.textContent = label;
  sizeSelect.appendChild(option);
});

// The short edge drives the size, so a portrait crop gains pixels instead of
// losing them the way a longest-edge cap would.
function exportSize() {
  const format = FORMATS.find((f) => f.id === state.format);
  const ratio = format.ratio ?? window.innerWidth / window.innerHeight;
  const short = state.size;

  const width = ratio >= 1 ? Math.round(short * ratio) : short;
  const height = ratio >= 1 ? short : Math.round(short / ratio);

  const limit = maxExportSize();
  const overflow = Math.max(width, height) / limit;
  if (overflow > 1) {
    return {
      width: Math.floor(width / overflow),
      height: Math.floor(height / overflow),
      clamped: true,
    };
  }

  return { width, height, clamped: false };
}

function renderExportNote() {
  const { width, height, clamped } = exportSize();
  const inches = (px) => (px / PRINT_DPI).toFixed(1);
  exportNote.textContent = clamped
    ? `${width} × ${height} px — clamped to this GPU's ${maxExportSize()} px limit`
    : `${width} × ${height} px · ${inches(width)} × ${inches(height)} in at ${PRINT_DPI} dpi`;
}

formatSelect.addEventListener('change', () => {
  state.format = formatSelect.value;
  renderExportNote();
  save();
});

sizeSelect.addEventListener('change', () => {
  state.size = Number(sizeSelect.value);
  renderExportNote();
  save();
});

exportButton.addEventListener('click', async () => {
  const { width, height } = exportSize();
  const label = exportButton.textContent;

  // Reading back a few hundred megabytes blocks the main thread, so the button
  // has to show its new state before the work starts rather than after
  exportButton.disabled = true;
  exportButton.textContent = 'Rendering…';
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    const canvas = renderStill(width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gradient-${state.mode}-${width}x${height}.png`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    // Almost always an out-of-memory refusal on the largest sizes
    exportNote.textContent = `Export failed: ${error.message}`;
  } finally {
    exportButton.disabled = false;
    exportButton.textContent = label;
  }
});

// --- Text ---

// `hidden` leaves the CSS start state in place so the intro can animate the
// lines in; edits made after the intro has run need them visible immediately.
function renderTitle(hidden) {
  const lines = state.title.split('\n').filter((line) => line.trim() !== '');

  titleElement.innerHTML = '';
  lines.forEach((line) => {
    const wrapper = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = line;
    if (!hidden) {
      span.style.opacity = '1';
      span.style.transform = 'translateY(0px)';
    }
    wrapper.appendChild(span);
    titleElement.appendChild(wrapper);
  });
}

// --- Typography ---

FONTS.forEach(({ id, label }) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = label;
  fontSelect.appendChild(option);
});

const currentFont = () => FONTS.find((f) => f.id === state.text.font) ?? FONTS[0];

// The panel writes custom properties and the stylesheet reads them, so nothing
// here needs to know which elements are actually styled.
function applyText() {
  const root = document.documentElement.style;
  root.setProperty('--text-font', currentFont().stack);
  root.setProperty('--text-color', state.text.color);

  TEXT_SLIDERS.forEach(({ name, property, unit }) => {
    root.setProperty(property, `${state.text[name]}${unit}`);
  });
}

const textSliderControls = TEXT_SLIDERS.map((definition) => {
  const { name, label, min, max, step, unit } = definition;

  const field = document.createElement('label');
  field.className = 'config-slider';

  const caption = document.createElement('span');
  const value = document.createElement('output');
  caption.textContent = label;
  caption.appendChild(value);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min;
  slider.max = max;
  slider.step = step;

  slider.addEventListener('input', () => {
    state.text[name] = parseFloat(slider.value);
    value.textContent = `${state.text[name]}${unit}`;
    applyText();
    save();
  });

  field.append(caption, slider);
  panel.querySelector('.config-sliders[data-group="text"]').appendChild(field);

  return { definition, field, slider, value };
});

function syncTextSliders() {
  textSliderControls.forEach(({ definition, field, slider, value }) => {
    slider.value = state.text[definition.name];
    value.textContent = `${state.text[definition.name]}${definition.unit}`;
    field.hidden = Boolean(definition.variableOnly) && !currentFont().variable;
  });
}

fontSelect.addEventListener('change', () => {
  state.text.font = fontSelect.value;
  applyText();
  syncTextSliders();
  save();
});

textColorInput.addEventListener('input', () => {
  state.text.color = textColorInput.value;
  textHexInput.value = textColorInput.value;
  applyText();
  save();
});

textHexInput.addEventListener('input', () => {
  if (!HEX_PATTERN.test(textHexInput.value)) return;
  const normalized = textHexInput.value.startsWith('#')
    ? textHexInput.value
    : `#${textHexInput.value}`;
  state.text.color = normalized;
  textColorInput.value = normalized.length === 4
    ? `#${normalized.slice(1).split('').map((c) => c + c).join('')}`
    : normalized;
  applyText();
  save();
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value;
  renderTitle(false);
  save();
});

paragraphInput.addEventListener('input', () => {
  state.paragraph = paragraphInput.value;
  paragraphElement.textContent = state.paragraph;
  save();
});

replayButton.addEventListener('click', () => {
  playIntro();
});

// --- Reset ---

resetButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
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
renderColors();
syncSliders();
syncSliderVisibility();
handles.refresh();

grainCheckbox.checked = state.grainEnabled;
formatSelect.value = state.format;
sizeSelect.value = String(state.size);
renderExportNote();
mouseCheckbox.checked = state.mouseEnabled;
handlesCheckbox.checked = state.showHandles;
titleInput.value = state.title;
paragraphInput.value = state.paragraph;
fontSelect.value = state.text.font;
textColorInput.value = state.text.color;
textHexInput.value = state.text.color;
applyText();
syncTextSliders();

// Rebuilt while still hidden, so the intro animation on load still plays
renderTitle(true);
paragraphElement.textContent = state.paragraph;
