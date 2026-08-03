// Shared vocabulary: everything here is plain data, so the config panel and the
// on-canvas handles can read it without pulling the renderer in behind them.

export const MAX_COLORS = 8;

// The order here is the order of the `mode` uniform's branches — but the shader
// never spells those numbers out. gradient.js injects `#define MODE_<ID> <n>`
// from this array, so reordering or inserting a style stays safe. Persisted
// configs store the id, not the index, for the same reason.
export const MODES = [
  { id: "linear", label: "Linear" },
  { id: "radial", label: "Radial" },
  { id: "square", label: "Square" },
  { id: "diamond", label: "Diamond" },
  { id: "conic", label: "Conic" },
  { id: "mesh", label: "Mesh" },
  { id: "waves", label: "Waves" },
];

// Modes that read the stops array and the shared origin/angle controls.
export const RAMP_MODES = ["linear", "radial", "square", "diamond", "conic"];

// A conic sweep always closes back onto its first color at the edge of the
// circle, so there is no distance for `spread` to scale: it is the one ramp
// mode where that control does nothing.
export const SPREAD_MODES = RAMP_MODES.filter((id) => id !== "conic");

export const DEFAULT_COLORS = ["#5a60d3", "#dceef8", "#e2e8ff"];

// Every entry here maps 1:1 to a shader uniform of the same name.
export const DEFAULT_PARAMS = {
  angle: 90,
  spread: 1.0,
  softness: 0.5,
  blobSharpness: 3.0,
  warpAmount: 0.0,
  warpScale: 3.0,
  grainAmount: 0.01,
  speed: 1.0,
  frequency: 1.0,
  intensity: 1.0,
  orbitRadius: 1.0,
};

// The page copy the panel edits. Shared so persistence, typography and the
// intro animation all agree on which elements they are talking about.
export const TITLE_SELECTOR = ".smooth-web";
export const PARAGRAPH_SELECTOR = ".p-container p";

// A color entry carries everything the shader needs for one palette slot:
// its value, where its blob sits, how big that blob is, and where it lands on
// the ramp. Slots the current mode ignores simply stay untouched.
export function makeColor(hex, index = 0, count = 1) {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2;
  return {
    hex,
    x: 0.5 + Math.cos(angle) * 0.28,
    y: 0.5 + Math.sin(angle) * 0.28,
    radius: 0.6,
    stop: count > 1 ? index / (count - 1) : 0,
  };
}

export function defaultColors() {
  return DEFAULT_COLORS.map((hex, i) =>
    makeColor(hex, i, DEFAULT_COLORS.length),
  );
}
