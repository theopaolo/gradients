import { RAMP_MODES, SPREAD_MODES } from "../constants.js";

// What the panel offers, as data. Persistence reads the same tables to clamp a
// restored value back into range, so a slider's bounds are declared once.

// Each slider drives the shader uniform of the same name. `modes` limits a
// slider to the gradient styles it actually affects; omitting it means always.
export const SLIDERS = [
  {
    group: "shape",
    name: "angle",
    label: "Angle",
    min: 0,
    max: 360,
    step: 1,
    modes: ["linear", "square", "diamond", "conic"],
  },
  {
    group: "shape",
    name: "spread",
    label: "Spread",
    min: 0.1,
    max: 4,
    step: 0.01,
    modes: SPREAD_MODES,
  },
  {
    group: "shape",
    name: "softness",
    label: "Softness",
    min: 0,
    max: 1,
    step: 0.01,
    modes: RAMP_MODES,
  },
  {
    group: "shape",
    name: "blobSharpness",
    label: "Blob sharpness",
    min: 0.5,
    max: 12,
    step: 0.1,
    modes: ["mesh"],
  },

  {
    group: "motion",
    name: "speed",
    label: "Speed",
    min: 0,
    max: 3,
    step: 0.01,
  },
  {
    group: "motion",
    name: "orbitRadius",
    label: "Drift",
    min: 0,
    max: 2,
    step: 0.01,
    modes: ["mesh", "waves"],
  },
  {
    group: "motion",
    name: "frequency",
    label: "Wave frequency",
    min: 0.1,
    max: 4,
    step: 0.01,
    modes: ["waves"],
  },
  {
    group: "motion",
    name: "intensity",
    label: "Wave intensity",
    min: 0,
    max: 3,
    step: 0.01,
    modes: ["waves"],
  },

  {
    group: "grain",
    name: "grainAmount",
    label: "Amount",
    min: 0,
    max: 0.2,
    step: 0.001,
  },
  {
    group: "warp",
    name: "warpAmount",
    label: "Amount",
    min: 0,
    max: 0.6,
    step: 0.005,
  },
  {
    group: "warp",
    name: "warpScale",
    label: "Scale",
    min: 0.2,
    max: 12,
    step: 0.1,
  },
];

// Sizes are driven by the short edge, which is how the social formats are
// actually specified: 1080 short gives exactly 1080x1350 and 1080x1920.
export const FORMATS = [
  { id: "viewport", label: "Viewport", ratio: null },
  { id: "square", label: "Square 1:1", ratio: 1 },
  { id: "portrait", label: "Portrait 4:5", ratio: 4 / 5 },
  { id: "story", label: "Story 9:16", ratio: 9 / 16 },
  { id: "landscape", label: "Landscape 16:9", ratio: 16 / 9 },
];

export const SIZES = [
  { value: 1080, label: "1080 (social)" },
  { value: 1440, label: "1440" },
  { value: 2160, label: "2160" },
  { value: 3240, label: "3240 (print)" },
  { value: 4096, label: "4096 (print)" },
];

export const PRINT_DPI = 300;

// `variable` marks the one face that carries a real weight axis; the others
// would only get synthetic bolding, so the weight slider stays hidden for them.
export const FONTS = [
  { id: "editorial", label: "Editorial Old", stack: '"Editorial Old", serif' },
  { id: "museum", label: "PP Museum", stack: '"PP Museum", serif' },
  {
    id: "museum-ultra",
    label: "PP Museum Ultrabold",
    stack: '"PP Museum Ultrabold", serif',
  },
  { id: "snpro", label: "SN Pro", stack: '"SN Pro", sans-serif' },
  {
    id: "worksans",
    label: "Work Sans",
    stack: '"Work Sans", sans-serif',
    variable: true,
  },
];

// Absolute sizes rather than viewport units, so the same value holds on a phone
export const TEXT_SLIDERS = [
  {
    name: "titleSize",
    label: "Title size",
    min: 16,
    max: 240,
    step: 1,
    property: "--title-size",
    unit: "px",
  },
  {
    name: "titleLeading",
    label: "Title line height",
    min: 0.7,
    max: 2,
    step: 0.01,
    property: "--title-leading",
    unit: "",
  },
  {
    name: "paragraphSize",
    label: "Paragraph size",
    min: 10,
    max: 96,
    step: 1,
    property: "--paragraph-size",
    unit: "px",
  },
  {
    name: "weight",
    label: "Weight",
    min: 100,
    max: 900,
    step: 10,
    property: "--text-weight",
    unit: "",
    variableOnly: true,
  },
];
