import { TITLE_SELECTOR, PARAGRAPH_SELECTOR } from "../constants.js";
import { normalizeHex, expandHex } from "../color.js";
import { playIntro } from "../motion.js";
import { FONTS, TEXT_SLIDERS } from "./controls.js";
import { pick, makeSlider } from "./dom.js";

// The page copy and everything that styles it. The panel writes custom
// properties and the stylesheet reads them, so nothing here needs to know which
// elements are actually styled.

export function createTypographyControls({ panel, state, save }) {
  const titleElement = document.querySelector(TITLE_SELECTOR);
  const paragraphElement = document.querySelector(PARAGRAPH_SELECTOR);

  const titleInput = pick(panel, ".config-title");
  const paragraphInput = pick(panel, ".config-paragraph");
  const fontSelect = pick(panel, ".config-font");
  const textColorInput = pick(panel, ".config-text-color");
  const textHexInput = pick(panel, ".config-text-hex");
  const replayButton = pick(panel, ".config-replay");

  FONTS.forEach(({ id, label }) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    fontSelect.appendChild(option);
  });

  const currentFont = () =>
    FONTS.find((f) => f.id === state.text.font) ?? FONTS[0];

  function applyText() {
    const root = document.documentElement.style;
    root.setProperty("--text-font", currentFont().stack);
    root.setProperty("--text-color", state.text.color);

    TEXT_SLIDERS.forEach(({ name, property, unit }) => {
      root.setProperty(property, `${state.text[name]}${unit}`);
    });
  }

  const controls = TEXT_SLIDERS.map((definition) => {
    const { name, unit } = definition;

    const control = makeSlider(
      definition,
      (value) => {
        state.text[name] = value;
        applyText();
        save();
      },
      (value) => `${value}${unit}`,
    );

    pick(panel, '.config-sliders[data-group="text"]').appendChild(
      control.field,
    );

    return { definition, ...control };
  });

  function syncSliders() {
    controls.forEach(({ definition, field, set }) => {
      set(state.text[definition.name]);
      field.hidden =
        Boolean(definition.variableOnly) && !currentFont().variable;
    });
  }

  // `hidden` leaves the CSS start state in place so the intro can animate the
  // lines in; edits made after the intro has run need them visible immediately.
  function renderTitle(hidden) {
    const lines = state.title.split("\n").filter((line) => line.trim() !== "");

    titleElement.innerHTML = "";
    lines.forEach((line) => {
      const wrapper = document.createElement("div");
      const span = document.createElement("span");
      span.textContent = line;
      if (!hidden) {
        span.style.opacity = "1";
        span.style.transform = "translateY(0px)";
      }
      wrapper.appendChild(span);
      titleElement.appendChild(wrapper);
    });
  }

  fontSelect.addEventListener("change", () => {
    state.text.font = fontSelect.value;
    applyText();
    syncSliders();
    save();
  });

  textColorInput.addEventListener("input", () => {
    state.text.color = textColorInput.value;
    textHexInput.value = textColorInput.value;
    applyText();
    save();
  });

  textHexInput.addEventListener("input", () => {
    const normalized = normalizeHex(textHexInput.value);
    if (!normalized) return;
    state.text.color = normalized;
    textColorInput.value = expandHex(normalized);
    applyText();
    save();
  });

  titleInput.addEventListener("input", () => {
    state.title = titleInput.value;
    renderTitle(false);
    save();
  });

  paragraphInput.addEventListener("input", () => {
    state.paragraph = paragraphInput.value;
    paragraphElement.textContent = state.paragraph;
    save();
  });

  replayButton.addEventListener("click", () => playIntro());

  // Applies the restored state. The title is rebuilt while still hidden, so the
  // intro animation on load still plays.
  function sync() {
    titleInput.value = state.title;
    paragraphInput.value = state.paragraph;
    fontSelect.value = state.text.font;
    textColorInput.value = expandHex(state.text.color);
    textHexInput.value = state.text.color;
    applyText();
    syncSliders();
    renderTitle(true);
    paragraphElement.textContent = state.paragraph;
  }

  return { sync };
}
