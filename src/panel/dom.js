// Small helpers shared by the panel's control groups.

// The panel is built from one markup blob, so every reference into it is a
// selector that can quietly miss. Failing here names the selector instead of
// leaving a null to blow up at the first addEventListener.
export function pick(root, selector) {
  const found = root.querySelector(selector);
  if (!found) throw new Error(`Config panel markup is missing ${selector}`);
  return found;
}

// One drawn set, one 16px box, one stroke weight — so a glyph borrowed from a
// text font never has to stand in for an icon.
const ICONS = {
  sliders: `<path d="M2.5 4.5h4M9.5 4.5h4M2.5 11.5h2M7.5 11.5h6"/>
    <circle cx="8" cy="4.5" r="1.6"/><circle cx="6" cy="11.5" r="1.6"/>`,
  chevron: `<path d="M4 6.5 8 10.5l4-4"/>`,
  check: `<path d="M3.5 8.5 6.5 11.5l6-7"/>`,
  close: `<path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"/>`,
  plus: `<path d="M8 3.5v9M3.5 8h9"/>`,
  // iOS's own share glyph, redrawn on this grid: the install hint names a
  // button the user has to find in their browser, so it has to look like it.
  share: `<path d="M5.5 7h-2v6h9V7h-2"/><path d="M8 2.5v7M5.5 5 8 2.5l2.5 2.5"/>`,
  grip: `<g class="config-svg-fill">
    <circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/>
    <circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/>
    <circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>
  </g>`,
};

export function iconHTML(name) {
  return `<svg class="config-svg" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`;
}

export function icon(name) {
  const template = document.createElement("template");
  template.innerHTML = iconHTML(name);
  return template.content.firstElementChild;
}

// One labelled range with a live readout. The track paints itself from
// `--ui-fill`, which is the only thing that has to be kept in step with the
// value; `format` decides how the readout reads, and `set` is how anything
// else pushes a value back into the control.
export function makeSlider(
  { min, max, step, label },
  onInput,
  format = String,
) {
  const field = document.createElement("label");
  field.className = "config-slider";

  const head = document.createElement("span");
  head.className = "config-slider-head";

  const caption = document.createElement("span");
  caption.textContent = label;

  const output = document.createElement("output");
  head.append(caption, output);

  const track = document.createElement("span");
  track.className = "config-track";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = step;
  track.appendChild(slider);

  const fill = (value) =>
    `${(((value - min) / (max - min)) * 100).toFixed(2)}%`;

  function set(value) {
    slider.value = value;
    output.textContent = format(value);
    field.style.setProperty("--ui-fill", fill(value));
  }

  slider.addEventListener("input", () => {
    const parsed = parseFloat(slider.value);
    output.textContent = format(parsed);
    field.style.setProperty("--ui-fill", fill(parsed));
    onInput(parsed);
  });

  field.append(head, track);

  return { field, slider, set };
}

// The palette rows carry a bare range with no caption of its own, but it is
// painted by the same comb, so it needs the same fill bookkeeping.
export function makeBareSlider({ min, max, step }, onInput) {
  const track = document.createElement("span");
  track.className = "config-track";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = step;
  track.appendChild(slider);

  const set = (value) => {
    slider.value = value;
    track.style.setProperty(
      "--ui-fill",
      `${(((value - min) / (max - min)) * 100).toFixed(2)}%`,
    );
  };

  slider.addEventListener("input", () => {
    const parsed = parseFloat(slider.value);
    set(parsed);
    onInput(parsed);
  });

  return { track, slider, set };
}
