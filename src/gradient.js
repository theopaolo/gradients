import * as THREE from "three";
import vertexShader from "./glsl/vertex.glsl";
import fragmentSource from "./glsl/shader.glsl";
import { hexToOklab } from "./color.js";
import {
  MAX_COLORS,
  MODES,
  DEFAULT_COLORS,
  DEFAULT_PARAMS,
} from "./constants.js";

// The scene and every uniform setter that drives it. Nothing here knows the
// config panel exists; the panel just calls the setters.

const WAVE_COLORS = 4;

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

// No MSAA: the scene is a single screen-filling quad, so there is not one
// geometry edge to antialias — it would buy a multisampled buffer and a resolve
// every frame for nothing.
const renderer = new THREE.WebGLRenderer({ antialias: false });

// Deliberately no setPixelRatio: on a HiDPI screen the canvas renders at CSS
// pixels and the compositor upscales, which is a 4x saving on a shader this
// heavy and invisible on a smooth gradient. The tradeoff is that the two
// features computed per device pixel on purpose — the film grain and the
// sub-LSB dither — get softened by that upscale.
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);

const smoothedMouse = { x: 0.5, y: 0.5 };
const targetMouse = { x: 0.5, y: 0.5 };
const smoothingFactor = 0.1;

// Below this the easing is done: values snap to their target so the render loop
// can tell "still moving" from "arrived" by plain equality.
const SETTLED = 1e-4;

const BASE_MOUSE_INFLUENCE = 0.3;
let targetMouseInfluence = BASE_MOUSE_INFLUENCE;

// Palette slots are always sent full length; colorCount tells the shader how
// many to read.
const paletteUniform = Array.from(
  { length: MAX_COLORS },
  () => new THREE.Vector3(),
);
const waveColorsUniform = Array.from(
  { length: WAVE_COLORS },
  () => new THREE.Vector3(),
);
const positionsUniform = Array.from(
  { length: MAX_COLORS },
  () => new THREE.Vector2(0.5, 0.5),
);
const radiiUniform = new Array(MAX_COLORS).fill(0.5);
const stopsUniform = new Array(MAX_COLORS).fill(0);

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
  waveColors: { value: waveColorsUniform },
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

// --- Render scheduling ---

// The output is provably static once speed is 0 and both easings have arrived,
// so the loop stops issuing draw calls until something actually changes.
let dirty = true;

export function requestRender() {
  dirty = true;
}

// --- Uniform setters ---

// Rewrites every palette-derived uniform from the config panel's state.
export function setColors(entries) {
  const used = entries.slice(0, MAX_COLORS);

  used.forEach((entry, i) => {
    hexToOklab(entry.hex, paletteUniform[i]);
    positionsUniform[i].set(entry.x, entry.y);
    radiiUniform[i] = entry.radius;
    stopsUniform[i] = entry.stop;
  });

  const count = Math.max(used.length, 1);
  uniforms.colorCount.value = count;

  // Wave mode cycles through four slots whatever the palette length is. Wrapping
  // here saves the shader emulating a dynamic array index per lookup.
  for (let i = 0; i < WAVE_COLORS; i++) {
    waveColorsUniform[i].copy(paletteUniform[i % count]);
  }

  requestRender();
}

export function setMode(id) {
  const index = MODES.findIndex((m) => m.id === id);
  if (index >= 0) uniforms.mode.value = index;
  requestRender();
}

export function setGrainEnabled(enabled) {
  uniforms.grainEnabled.value = enabled;
  requestRender();
}

export function setOrigin(x, y) {
  uniforms.origin.value.set(x, y);
  requestRender();
}

export function setMouseEnabled(enabled) {
  targetMouseInfluence = enabled ? BASE_MOUSE_INFLUENCE : 0.0;
  requestRender();
}

export function setParam(name, value) {
  if (!(name in DEFAULT_PARAMS)) return;
  uniforms[name].value = value * (PARAM_SCALE[name] ?? 1);
  requestRender();
}

// --- Scene ---

// One source of truth for the mode numbering: the shader gets its MODE_* values
// from the same array the panel builds its buttons from.
const modeDefines = MODES.map(
  (m, index) => `#define MODE_${m.id.toUpperCase()} ${index}`,
).join("\n");

const material = new THREE.ShaderMaterial({
  fragmentShader: `${modeDefines}\n${fragmentSource}`,
  vertexShader,
  uniforms,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio;
mesh.scale.y = 1;
scene.add(mesh);

// pointermove rather than mousemove, so a finger drag reaches the shader too:
// on a touch device the interactivity would otherwise be dead rather than off.
window.addEventListener("pointermove", (event) => {
  targetMouse.x = event.clientX / window.innerWidth;
  targetMouse.y = 1.0 - event.clientY / window.innerHeight;
});

// Frames the plane for a given output shape. The export path reuses this to
// render at aspect ratios the window never has.
export function applyAspect(ratio, width, height) {
  camera.left = (-ratio * viewSize) / 2;
  camera.right = (ratio * viewSize) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  mesh.scale.x = ratio;
  mesh.scale.y = 1;

  uniforms.resolution.value.set(width, height);
}

export function applyViewportAspect() {
  applyAspect(
    window.innerWidth / window.innerHeight,
    window.innerWidth,
    window.innerHeight,
  );
}

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  applyViewportAspect();
  requestRender();
});

// The export path needs the raw pieces; nothing else should reach for them.
export { renderer, scene, camera };

// --- Loop ---

function ease(from, to) {
  return Math.abs(to - from) < SETTLED
    ? to
    : from + (to - from) * smoothingFactor;
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  // Toggling interactivity eases rather than snapping the wave origins, and the
  // pointer itself trails behind by design — both count as motion.
  const easing =
    smoothedMouse.x !== targetMouse.x ||
    smoothedMouse.y !== targetMouse.y ||
    uniforms.mouseInfluence.value !== targetMouseInfluence;

  smoothedMouse.x = ease(smoothedMouse.x, targetMouse.x);
  smoothedMouse.y = ease(smoothedMouse.y, targetMouse.y);
  uniforms.mouseInfluence.value = ease(
    uniforms.mouseInfluence.value,
    targetMouseInfluence,
  );

  if (!dirty && !easing && uniforms.speed.value <= 0) return;

  uniforms.time.value = timestamp * 0.001;
  uniforms.mouse.value.set(smoothedMouse.x, smoothedMouse.y);

  renderer.render(scene, camera);
  dirty = false;
}

requestAnimationFrame(animate);
