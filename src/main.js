import * as THREE from "three";
import vertexShader from "./glsl/vertex.glsl";
import fragmentShader from "./glsl/shader.glsl";

const scene = new THREE.Scene();

const viewSize = 2;
const aspectRatio = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  (-aspectRatio * viewSize) / 2,
  (aspectRatio * viewSize) / 2,
  viewSize / 2,
  -viewSize / 2,
  0.1,
  1000,
);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);

const smoothedMouse = { x: 0.5, y: 0.5 };
const targetMouse = { x: 0.5, y: 0.5 };
const smoothingFactor = 0.1;

export const MAX_COLORS = 8;

// The order here is the order of the `mode` uniform's branches.
export const MODES = [
  { id: "linear", label: "Linear" },
  { id: "radial", label: "Radial" },
  { id: "square", label: "Square" },
  { id: "diamond", label: "Diamond" },
  { id: "conic", label: "Conic" },
  { id: "mesh", label: "Mesh" },
  { id: "waves", label: "Waves" },
];

// Modes that read the stops array and the shared origin/angle/spread controls.
export const RAMP_MODES = ["linear", "radial", "square", "diamond", "conic"];

export const DEFAULT_COLORS = ["#5a60d3", "#dceef8", "#e2e8ff"];

const BASE_MOUSE_INFLUENCE = 0.3;
let targetMouseInfluence = BASE_MOUSE_INFLUENCE;

// Palette slots are always sent full length; colorCount tells the shader how
// many to read.
const paletteUniform = Array.from(
  { length: MAX_COLORS },
  () => new THREE.Vector3(),
);
const positionsUniform = Array.from(
  { length: MAX_COLORS },
  () => new THREE.Vector2(0.5, 0.5),
);
const radiiUniform = new Array(MAX_COLORS).fill(0.5);
const stopsUniform = new Array(MAX_COLORS).fill(0);

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

// Angle is the one parameter whose readable unit is not its shader unit.
const PARAM_SCALE = { angle: Math.PI / 180 };

const uniforms = {
  time: { value: 0.0 },
  resolution: {
    value: new THREE.Vector2(window.innerWidth, window.innerHeight),
  },
  mouse: { value: new THREE.Vector2(smoothedMouse.x, smoothedMouse.y) },
  mouseInfluence: { value: BASE_MOUSE_INFLUENCE },

  colors: { value: paletteUniform },
  positions: { value: positionsUniform },
  radii: { value: radiiUniform },
  stops: { value: stopsUniform },
  colorCount: { value: DEFAULT_COLORS.length },

  mode: { value: MODES.findIndex((m) => m.id === "waves") },
  grainEnabled: { value: true },

  origin: { value: new THREE.Vector2(0.5, 0.5) },

  ...Object.fromEntries(
    Object.entries(DEFAULT_PARAMS).map(([name, value]) => [
      name,
      { value: value * (PARAM_SCALE[name] ?? 1) },
    ]),
  ),
};

// Accepts "#rgb" or "#rrggbb" and writes straight to 0-1 sRGB values; the
// shader converts into the chosen blend space itself.
function hexToVector(hex, target) {
  let value = hex.replace("#", "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(value, 16);
  return target.set(
    ((int >> 16) & 255) / 255,
    ((int >> 8) & 255) / 255,
    (int & 255) / 255,
  );
}

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

// Rewrites every palette-derived uniform from the config panel's state.
export function setColors(entries) {
  const used = entries.slice(0, MAX_COLORS);

  used.forEach((entry, i) => {
    hexToVector(entry.hex, paletteUniform[i]);
    positionsUniform[i].set(entry.x, entry.y);
    radiiUniform[i] = entry.radius;
    stopsUniform[i] = entry.stop;
  });

  uniforms.colorCount.value = Math.max(used.length, 1);
}

export function setMode(id) {
  const index = MODES.findIndex((m) => m.id === id);
  if (index >= 0) uniforms.mode.value = index;
}

export function setGrainEnabled(enabled) {
  uniforms.grainEnabled.value = enabled;
}

export function setOrigin(x, y) {
  uniforms.origin.value.set(x, y);
}

export function setMouseEnabled(enabled) {
  targetMouseInfluence = enabled ? BASE_MOUSE_INFLUENCE : 0.0;
}

export function setParam(name, value) {
  if (!(name in DEFAULT_PARAMS)) return;
  uniforms[name].value = value * (PARAM_SCALE[name] ?? 1);
}

setColors(defaultColors());

const material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio;
mesh.scale.y = 1;
scene.add(mesh);

window.addEventListener("mousemove", (e) => {
  targetMouse.x = e.clientX / window.innerWidth;
  targetMouse.y = 1.0 - e.clientY / window.innerHeight;
});

// Frames the plane for a given output shape. The export path reuses this to
// render at aspect ratios the window never has.
function applyAspect(ratio, width, height) {
  camera.left = (-ratio * viewSize) / 2;
  camera.right = (ratio * viewSize) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  mesh.scale.x = ratio;
  mesh.scale.y = 1;

  uniforms.resolution.value.set(width, height);
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyAspect(
    window.innerWidth / window.innerHeight,
    window.innerWidth,
    window.innerHeight,
  );
});

// --- Still export ---

export function maxExportSize() {
  return renderer.capabilities.maxTextureSize;
}

// Reading back from an offscreen target rather than the visible canvas keeps
// the export independent of the window size and of `preserveDrawingBuffer`.
export function renderStill(width, height) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  applyAspect(width / height, width, height);

  renderer.setRenderTarget(target);
  renderer.render(scene, camera);

  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);

  renderer.setRenderTarget(null);
  target.dispose();

  // Back to the viewport before the next animation frame paints
  applyAspect(
    window.innerWidth / window.innerHeight,
    window.innerWidth,
    window.innerHeight,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);

  // WebGL hands back rows bottom-up, ImageData wants them top-down
  const rowBytes = width * 4;
  for (let y = 0; y < height; y++) {
    const source = (height - 1 - y) * rowBytes;
    image.data.set(pixels.subarray(source, source + rowBytes), y * rowBytes);
  }

  context.putImageData(image, 0, 0);
  return canvas;
}

function animate(timestamp) {
  uniforms.time.value = timestamp * 0.001;

  smoothedMouse.x += (targetMouse.x - smoothedMouse.x) * smoothingFactor;
  smoothedMouse.y += (targetMouse.y - smoothedMouse.y) * smoothingFactor;

  uniforms.mouse.value.x = smoothedMouse.x;
  uniforms.mouse.value.y = smoothedMouse.y;

  // Ease the influence so toggling interactivity doesn't snap the wave origins
  uniforms.mouseInfluence.value +=
    (targetMouseInfluence - uniforms.mouseInfluence.value) * smoothingFactor;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
