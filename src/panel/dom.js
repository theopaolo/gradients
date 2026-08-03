// Small helpers shared by the panel's control groups.

// The panel is built from one markup blob, so every reference into it is a
// selector that can quietly miss. Failing here names the selector instead of
// leaving a null to blow up at the first addEventListener.
export function pick(root, selector) {
  const found = root.querySelector(selector);
  if (!found) throw new Error(`Config panel markup is missing ${selector}`);
  return found;
}

// One labelled range row with a live readout. `format` decides how the readout
// reads; `set` is how anything else pushes a value back into the control.
export function makeSlider(
  { min, max, step, label },
  onInput,
  format = String,
) {
  const field = document.createElement("label");
  field.className = "config-slider";

  const caption = document.createElement("span");
  const output = document.createElement("output");
  caption.textContent = label;
  caption.appendChild(output);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = step;

  function set(value) {
    slider.value = value;
    output.textContent = format(value);
  }

  slider.addEventListener("input", () => {
    const parsed = parseFloat(slider.value);
    output.textContent = format(parsed);
    onInput(parsed);
  });

  field.append(caption, slider);

  return { field, slider, set };
}
