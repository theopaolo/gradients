import { RAMP_MODES, SPREAD_MODES } from "./constants.js";

// On-canvas controls. Mesh mode gets one draggable dot per color; the ramp
// modes get an origin dot plus an endpoint that sets angle and spread at once,
// the way a gradient tool in a design app behaves.

const MIN_SPREAD = 0.1;
const MAX_SPREAD = 4;

const layer = document.createElement("div");
layer.className = "handles";
layer.innerHTML = `
  <svg class="handles-line" aria-hidden="true">
    <line x1="0" y1="0" x2="0" y2="0" />
  </svg>
`;
document.body.appendChild(layer);

const line = layer.querySelector("line");

function toUv(event) {
  return {
    x: event.clientX / window.innerWidth,
    y: 1 - event.clientY / window.innerHeight,
  };
}

function halfSize() {
  return { x: (window.innerWidth / window.innerHeight) * 0.5, y: 0.5 };
}

// Mirrors the shader's normalisation so the endpoint handle always sits exactly
// where the ramp finishes.
function fitDistance(mode, angleRadians) {
  const h = halfSize();
  if (mode === "linear") {
    return (
      Math.abs(Math.cos(angleRadians)) * h.x +
      Math.abs(Math.sin(angleRadians)) * h.y
    );
  }
  return Math.min(h.x, h.y);
}

export function createHandles({
  state,
  onColorsChange,
  onOriginChange,
  onShapeChange,
}) {
  let handles = [];

  // Conic wraps the whole circle, so there is no distance for spread to scale.
  // Its endpoint handle is a pure angle dial, parked at a fixed radius.
  const usesSpread = () => SPREAD_MODES.includes(state.mode);

  function place(element, uv) {
    element.style.left = `${uv.x * 100}%`;
    element.style.top = `${(1 - uv.y) * 100}%`;
  }

  // Where the ramp's last stop lands, in uv space
  function endpointUv() {
    const radians = (state.params.angle * Math.PI) / 180;
    const spread = usesSpread() ? state.params.spread : 1;
    const distance = spread * fitDistance(state.mode, radians);
    const h = halfSize();
    // The shader measures distances in an aspect-corrected space, so both axes
    // divide back out by their own half-extent to land in uv again
    return {
      x: state.origin.x + (Math.cos(radians) * distance) / (h.x * 2),
      y: state.origin.y + (Math.sin(radians) * distance) / (h.y * 2),
    };
  }

  function sync() {
    if (!handles.length) return;

    handles.forEach((handle) => place(handle.element, handle.read()));

    const showLine = RAMP_MODES.includes(state.mode);
    line.style.display = showLine ? "" : "none";

    if (showLine) {
      const from = state.origin;
      const to = endpointUv();
      line.setAttribute("x1", `${from.x * window.innerWidth}`);
      line.setAttribute("y1", `${(1 - from.y) * window.innerHeight}`);
      line.setAttribute("x2", `${to.x * window.innerWidth}`);
      line.setAttribute("y2", `${(1 - to.y) * window.innerHeight}`);
    }
  }

  function makeHandle({ label, color, read, write, onWheel, extraClass = "" }) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `handle ${extraClass}`.trim();
    element.setAttribute("aria-label", label);
    element.title = label;
    if (color) element.style.setProperty("--handle-color", color);

    // Tracked explicitly rather than through hasPointerCapture, which is already
    // being torn down by the time pointerup is dispatched.
    let dragging = false;

    element.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      element.setPointerCapture(event.pointerId);
      dragging = true;
      element.classList.add("is-dragging");
    });

    element.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      write(toUv(event));
      sync();
    });

    const end = () => {
      if (!dragging) return;
      dragging = false;
      element.classList.remove("is-dragging");
    };

    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("lostpointercapture", end);

    // Arrow keys give the same control without a pointer
    element.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 0.05 : 0.01;
      const nudges = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const nudge = nudges[event.key];
      if (!nudge) return;
      event.preventDefault();
      const current = read();
      write({ x: current.x + nudge[0], y: current.y + nudge[1] });
      sync();
    });

    if (onWheel) {
      element.addEventListener(
        "wheel",
        (event) => {
          event.preventDefault();
          onWheel(event.deltaY);
          sync();
        },
        { passive: false },
      );
    }

    layer.appendChild(element);
    handles.push({ element, read });
    return element;
  }

  function refresh() {
    handles.forEach((handle) => handle.element.remove());
    handles = [];

    if (!state.showHandles || state.mode === "waves") {
      line.style.display = "none";
      return;
    }

    if (state.mode === "mesh") {
      state.colors.forEach((entry, index) => {
        makeHandle({
          label: `Color ${index + 1} position — drag to move, scroll to resize`,
          color: entry.hex,
          read: () => ({ x: entry.x, y: entry.y }),
          write: (uv) => {
            entry.x = uv.x;
            entry.y = uv.y;
            // Nothing in the color list shows a position, so no row to update
            onColorsChange();
          },
          onWheel: (deltaY) => {
            entry.radius = Math.min(
              Math.max(entry.radius - deltaY * 0.001, 0.05),
              2,
            );
            onColorsChange({ row: index });
          },
        });
      });
    } else {
      makeHandle({
        label: "Gradient origin",
        extraClass: "handle-origin",
        read: () => state.origin,
        write: (uv) => {
          state.origin = uv;
          onOriginChange();
        },
      });

      makeHandle({
        label: usesSpread() ? "Gradient angle and spread" : "Gradient angle",
        extraClass: "handle-endpoint",
        read: endpointUv,
        write: (uv) => {
          const h = halfSize();
          const dx = (uv.x - state.origin.x) * h.x * 2;
          const dy = (uv.y - state.origin.y) * h.y * 2;
          const radians = Math.atan2(dy, dx);

          state.params.angle = ((radians * 180) / Math.PI + 360) % 360;

          if (usesSpread()) {
            const distance = Math.hypot(dx, dy);
            state.params.spread = Math.min(
              Math.max(distance / fitDistance(state.mode, radians), MIN_SPREAD),
              MAX_SPREAD,
            );
          }

          onShapeChange();
        },
      });
    }

    sync();
  }

  window.addEventListener("resize", sync);

  return { refresh, sync };
}
