import { MAX_COLORS, RAMP_MODES, makeColor } from "../constants.js";
import { normalizeHex, expandHex } from "../color.js";
import { readPaletteFromImage } from "../palette-metadata.js";
import { pick } from "./dom.js";

// The palette list: swatches, hex fields, drag reordering, and the per-row
// value slider that means "stop" on a ramp and "size" in mesh mode.

export function createColorControls({ panel, state, applyColors, handles }) {
  const colorList = pick(panel, ".config-colors");
  const colorCount = pick(panel, ".config-count");
  const addButton = pick(panel, ".config-add");
  const reverseButton = pick(panel, ".config-reverse");
  const shuffleButton = pick(panel, ".config-shuffle");
  const evenButton = pick(panel, ".config-even");
  const importButton = pick(panel, ".config-import");
  const importInput = pick(panel, ".config-import-input");
  const importNote = pick(panel, ".config-import-note");

  const isRampMode = () => RAMP_MODES.includes(state.mode);

  // Stops belong to the slot rather than to the color, so any reshuffle moves
  // the colors along the ramp instead of carrying their positions with them.
  function withStopsPinned(reorder) {
    const stops = state.colors.map((entry) => entry.stop);
    reorder();
    state.colors.forEach((entry, index) => {
      entry.stop = stops[index];
    });
  }

  function moveColor(from, to) {
    withStopsPinned(() => {
      const [moved] = state.colors.splice(from, 1);
      state.colors.splice(to, 0, moved);
    });
  }

  function distributeStops() {
    const count = state.colors.length;
    state.colors.forEach((entry, index) => {
      entry.stop = count > 1 ? index / (count - 1) : 0;
    });
  }

  // Keyboard path: rebuilds the list, then puts focus back on the grip that moved
  function reorder(from, to) {
    if (to < 0 || to >= state.colors.length) return;
    moveColor(from, to);
    applyColors();
    render();
    handles.refresh();
    colorList.children[to]?.querySelector(".config-grip")?.focus();
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
    const grip = document.createElement("button");
    grip.type = "button";
    grip.className = "config-grip";
    grip.textContent = "⠿";
    grip.setAttribute(
      "aria-label",
      `Reorder color ${index + 1} — drag, or use the arrow keys`,
    );

    grip.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      grip.setPointerCapture(event.pointerId);
      drag = { index, grip, row: colorList.children[index] };
      drag.row.classList.add("is-dragging");
    });

    grip.addEventListener("pointermove", (event) => {
      if (drag?.grip !== grip) return;

      const target = rowIndexAt(event.clientY);
      if (target === drag.index) return;

      // The rows are moved in place rather than re-rendered, because rebuilding
      // the list mid-drag would destroy the element holding the pointer capture
      const rows = [...colorList.children];
      colorList.insertBefore(
        drag.row,
        target > drag.index ? rows[target].nextSibling : rows[target],
      );

      moveColor(drag.index, target);
      drag.index = target;
      applyColors();
    });

    // Ownership of the drag is the condition, not hasPointerCapture: the capture
    // is already being torn down by the time pointerup is dispatched.
    const end = () => {
      if (drag?.grip !== grip) return;
      drag.row.classList.remove("is-dragging");
      drag = null;
      // Now safe to rebuild, which resyncs every row's index-based labels
      render();
      handles.refresh();
    };

    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    // Catches the drag being interrupted without a pointerup of its own
    grip.addEventListener("lostpointercapture", end);

    grip.addEventListener("keydown", (event) => {
      const offset = { ArrowUp: -1, ArrowDown: 1 }[event.key];
      if (!offset) return;
      event.preventDefault();
      reorder(index, index + offset);
    });

    return grip;
  }

  // Which entry field the per-row slider edits in the current mode, or null
  // when the mode has no per-color value to show.
  function rowValueKey() {
    if (isRampMode()) return "stop";
    return state.mode === "mesh" ? "radius" : null;
  }

  function render() {
    colorList.innerHTML = "";

    const key = rowValueKey();
    const showStops = key === "stop";

    state.colors.forEach((entry, index) => {
      const row = document.createElement("li");
      row.className = "config-color";

      const head = document.createElement("div");
      head.className = "config-color-head";

      const swatch = document.createElement("input");
      swatch.type = "color";
      swatch.value = expandHex(entry.hex);
      swatch.setAttribute("aria-label", `Color ${index + 1}`);

      const text = document.createElement("input");
      text.type = "text";
      text.className = "config-hex";
      text.value = entry.hex;
      text.spellcheck = false;
      text.setAttribute("aria-label", `Color ${index + 1} hex value`);

      swatch.addEventListener("input", () => {
        entry.hex = swatch.value;
        text.value = swatch.value;
        applyColors();
        handles.refresh();
      });

      text.addEventListener("input", () => {
        const normalized = normalizeHex(text.value);
        if (!normalized) return;
        entry.hex = normalized;
        swatch.value = expandHex(normalized);
        applyColors();
        handles.refresh();
      });

      head.append(makeGrip(index), swatch, text);

      if (state.colors.length > 1) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "config-icon";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove color ${index + 1}`);
        remove.addEventListener("click", () => {
          state.colors.splice(index, 1);
          distributeStops();
          applyColors();
          render();
          handles.refresh();
        });
        head.appendChild(remove);
      }

      row.appendChild(head);

      if (key) {
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "config-color-value";
        slider.min = showStops ? 0 : 0.05;
        slider.max = showStops ? 1 : 2;
        slider.step = 0.01;
        slider.value = entry[key];
        slider.setAttribute(
          "aria-label",
          showStops ? `Color ${index + 1} stop` : `Color ${index + 1} size`,
        );
        slider.addEventListener("input", () => {
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

  // Pushes one entry's value back into its existing row. Dragging a handle on
  // the canvas fires at pointer-event rate, and rebuilding the whole list — a
  // few dozen elements and listeners — for a value that lives in one input is
  // the difference between a smooth drag and a stuttering one.
  function syncRow(index) {
    const key = rowValueKey();
    const slider = colorList.children[index]?.querySelector(
      ".config-color-value",
    );
    if (key && slider) slider.value = state.colors[index][key];
  }

  addButton.addEventListener("click", () => {
    if (state.colors.length >= MAX_COLORS) return;
    const last = state.colors[state.colors.length - 1];
    state.colors.push(
      makeColor(last.hex, state.colors.length, state.colors.length + 1),
    );
    distributeStops();
    applyColors();
    render();
    handles.refresh();
  });

  reverseButton.addEventListener("click", () => {
    withStopsPinned(() => state.colors.reverse());
    applyColors();
    render();
    handles.refresh();
  });

  shuffleButton.addEventListener("click", () => {
    withStopsPinned(() => {
      for (let i = state.colors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.colors[i], state.colors[j]] = [state.colors[j], state.colors[i]];
      }
    });
    applyColors();
    render();
    handles.refresh();
  });

  evenButton.addEventListener("click", () => {
    distributeStops();
    applyColors();
    render();
  });

  // --- Palette import ---

  // A palette read from a file replaces the list outright rather than merging
  // into it: the incoming colors are the whole point, and makeColor lays them
  // out afresh so the ramp stops and mesh blobs match the new count.
  function applyPalette(hexColors) {
    const kept = hexColors.slice(0, MAX_COLORS);
    state.colors = kept.map((hex, index) => makeColor(hex, index, kept.length));
    applyColors();
    render();
    handles.refresh();
  }

  async function importFile(file) {
    importNote.textContent = "Reading…";

    let colors;
    try {
      colors = await readPaletteFromImage(file);
    } catch (error) {
      importNote.textContent = `Could not read that file — ${error.message}`;
      return;
    }

    if (!colors) {
      importNote.textContent =
        "No palette in that file. Messaging and social apps re-encode on upload and drop the metadata — move an export as a file.";
      return;
    }

    applyPalette(colors);
    importNote.textContent =
      colors.length > MAX_COLORS
        ? `Read ${colors.length} colors, kept the first ${MAX_COLORS}.`
        : `Read ${colors.length} colors.`;
  }

  importButton.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", () => {
    const [file] = importInput.files;
    // Cleared so picking the same file twice in a row still fires a change
    importInput.value = "";
    if (file) importFile(file);
  });

  return { render, syncRow, importFile };
}
