import { setParam } from "../gradient.js";
import { SLIDERS } from "./controls.js";
import { pick, makeSlider } from "./dom.js";

// The shader-parameter sliders, grouped into the sections the markup declares.

const round = (value) => String(Math.round(value * 100) / 100);

export function createSliderControls({ panel, state, save, onShapeParam }) {
  const controls = SLIDERS.map((definition) => {
    const { group, name } = definition;

    const control = makeSlider(
      definition,
      (value) => {
        state.params[name] = value;
        setParam(name, value);
        save();
        if (name === "angle" || name === "spread") onShapeParam();
      },
      round,
    );

    pick(panel, `.config-sliders[data-group="${group}"]`).appendChild(
      control.field,
    );

    return { definition, ...control };
  });

  // Pulls the visible sliders back in line after a drag on the canvas moved them
  function sync() {
    controls.forEach(({ definition, set }) =>
      set(state.params[definition.name]),
    );
  }

  function syncVisibility() {
    controls.forEach(({ definition, field }) => {
      field.hidden =
        Boolean(definition.modes) && !definition.modes.includes(state.mode);
    });
  }

  return { sync, syncVisibility };
}
