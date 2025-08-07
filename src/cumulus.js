import * as THREE from 'three';
import { GUI } from 'lil-gui';
import vertexShader from './glsl/vertex.glsl';
import fragmentShader from './glsl/cumulus-sky.glsl';

const scene = new THREE.Scene();

const viewSize = 2;
const aspectRatio = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
    -aspectRatio * viewSize / 2,
     aspectRatio * viewSize / 2,
     viewSize / 2,
    -viewSize / 2,
    0.1,
    1000
);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.PlaneGeometry(2, 2);

const smoothedMouse = { x: 0.5, y: 0.5 };
const targetMouse = { x: 0.5, y: 0.5 };
const smoothingFactor = 0.1;

const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  mouse: { value: new THREE.Vector2(0.5, 0.5) },

  // Cloud controls
  cloudSize: { value: 1.2 },              // Nice medium clouds
  cloudCoverage: { value: 0.4 },          // Partly cloudy
  cloudSharpness: { value: 1.8 },         // Well-defined edges
  cloudHeight: { value: 0.3 },            // Clouds in upper portion
  cloudThickness: { value: 0.4 },         // Thick cloud layer
  cloudSpeed: { value: 0.2 },             // Gentle movement
  cloudDetail: { value: 1.0 },            // Full detail

  // Sky colors
  skyColorTop: { value: new THREE.Color(0.2, 0.5, 0.9) },      // Deep blue
  skyColorHorizon: { value: new THREE.Color(0.6, 0.8, 1.0) },  // Light blue
  skyGradientPower: { value: 0.8 },       // Natural gradient

  // Cloud colors
  cloudColorBright: { value: new THREE.Color(1.0, 1.0, 1.0) },    // Pure white
  cloudColorShadow: { value: new THREE.Color(0.7, 0.75, 0.8) },   // Light gray
  cloudColorCore: { value: new THREE.Color(0.6, 0.65, 0.7) },     // Medium gray
  cloudContrast: { value: 1.2 },          // Good contrast

  // Lighting
  sunIntensity: { value: 0.8 },
  sunPosition: { value: new THREE.Vector2(0.7, 0.8) },  // Upper right

  // Fragment controls
  fragmentCount: { value: 6.0 },          // Number of active cloud fragments
  fragmentSpread: { value: 0.3 },         // How spread out fragments are
  fragmentVariation: { value: 0.5 },      // Amount of procedural variation
  fragmentSeedOffset: { value: 0.0 }      // Offset for procedural generation
};

const material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio;
scene.add(mesh);

// === EVENT HANDLERS ===
window.addEventListener('mousemove', (e) => {
  targetMouse.x = e.clientX / window.innerWidth;
  targetMouse.y = 1.0 - e.clientY / window.innerHeight;
});

window.addEventListener('resize', () => {
  const newAspectRatio = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);

  camera.left = -newAspectRatio * viewSize / 2;
  camera.right = newAspectRatio * viewSize / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix();

  mesh.scale.x = newAspectRatio;
  uniforms.resolution.value.x = window.innerWidth;
  uniforms.resolution.value.y = window.innerHeight;
});

// === GUI SETUP ===
const gui = new GUI();
gui.title('Cumulus Cloud Sky');

// Cloud Shape Controls
const cloudFolder = gui.addFolder('Cloud Shape');
cloudFolder.add(uniforms.cloudSize, 'value', 0.3, 4, 0.1).name('Cloud Size');
cloudFolder.add(uniforms.cloudCoverage, 'value', 0, 1, 0.01).name('Coverage');
cloudFolder.add(uniforms.cloudSharpness, 'value', 0.3, 4, 0.1).name('Sharpness');
cloudFolder.add(uniforms.cloudHeight, 'value', 0, 1, 0.01).name('Height');
cloudFolder.add(uniforms.cloudThickness, 'value', 0.1, 1, 0.01).name('Thickness');
cloudFolder.add(uniforms.cloudDetail, 'value', 0, 2, 0.1).name('Detail');

// Sky Colors
const skyFolder = gui.addFolder('Sky Colors');
skyFolder.addColor({ color: uniforms.skyColorTop.value.getHex() }, 'color')
  .name('Sky Top')
  .onChange(value => uniforms.skyColorTop.value.setHex(value));
skyFolder.addColor({ color: uniforms.skyColorHorizon.value.getHex() }, 'color')
  .name('Sky Horizon')
  .onChange(value => uniforms.skyColorHorizon.value.setHex(value));
skyFolder.add(uniforms.skyGradientPower, 'value', 0.1, 3, 0.1).name('Gradient Power');

// Cloud Colors
const cloudColorFolder = gui.addFolder('Cloud Colors');
cloudColorFolder.addColor({ color: uniforms.cloudColorBright.value.getHex() }, 'color')
  .name('Cloud Highlights')
  .onChange(value => uniforms.cloudColorBright.value.setHex(value));
cloudColorFolder.addColor({ color: uniforms.cloudColorShadow.value.getHex() }, 'color')
  .name('Cloud Shadows')
  .onChange(value => uniforms.cloudColorShadow.value.setHex(value));
cloudColorFolder.addColor({ color: uniforms.cloudColorCore.value.getHex() }, 'color')
  .name('Cloud Core')
  .onChange(value => uniforms.cloudColorCore.value.setHex(value));
cloudColorFolder.add(uniforms.cloudContrast, 'value', 0.5, 3, 0.1).name('Contrast');

// Lighting
const lightFolder = gui.addFolder('Lighting');
lightFolder.add(uniforms.sunIntensity, 'value', 0, 2, 0.1).name('Sun Intensity');
lightFolder.add(uniforms.sunPosition.value, 'x', 0, 1, 0.01).name('Sun X');
lightFolder.add(uniforms.sunPosition.value, 'y', 0, 1, 0.01).name('Sun Y');

// Fragment Controls
const fragmentFolder = gui.addFolder('Cloud Fragments');
fragmentFolder.add(uniforms.fragmentCount, 'value', 1, 8, 1).name('Fragment Count');
fragmentFolder.add(uniforms.fragmentSpread, 'value', 0, 1, 0.01).name('Fragment Spread');
fragmentFolder.add(uniforms.fragmentVariation, 'value', 0, 2, 0.01).name('Fragment Variation');
fragmentFolder.add(uniforms.fragmentSeedOffset, 'value', 0, 100, 0.1).name('Seed Offset');

// Animation
const animFolder = gui.addFolder('Animation');
animFolder.add(uniforms.cloudSpeed, 'value', 0, 1, 0.01).name('Cloud Speed');

// Export functionality
const exportControls = {
  'Export 4K PNG': () => captureHighRes(4096, 4096),
  'Export 8K PNG': () => captureHighRes(7680, 7680),
  'Export Current View': () => captureCurrentView()
};

const exportFolder = gui.addFolder('Export');
Object.keys(exportControls).forEach(key => {
  exportFolder.add(exportControls, key);
});

// Presets
const presets = {
  'Classic Cumulus': () => {
    uniforms.cloudSize.value = 1.2;
    uniforms.cloudCoverage.value = 0.4;
    uniforms.cloudSharpness.value = 1.8;
    uniforms.skyColorTop.value.setRGB(0.2, 0.5, 0.9);
    uniforms.skyColorHorizon.value.setRGB(0.6, 0.8, 1.0);
    uniforms.fragmentCount.value = 6;
    uniforms.fragmentSpread.value = 0.3;
    uniforms.fragmentVariation.value = 0.5;
  },
  'Big Fluffy Clouds': () => {
    uniforms.cloudSize.value = 0.8;
    uniforms.cloudCoverage.value = 0.3;
    uniforms.cloudSharpness.value = 1.2;
    uniforms.cloudDetail.value = 1.5;
    uniforms.fragmentCount.value = 4;
    uniforms.fragmentSpread.value = 0.5;
    uniforms.fragmentVariation.value = 0.8;
  },
  'Crisp Blue Sky': () => {
    uniforms.cloudCoverage.value = 0.2;
    uniforms.skyColorTop.value.setRGB(0.1, 0.4, 0.9);
    uniforms.skyColorHorizon.value.setRGB(0.4, 0.7, 1.0);
    uniforms.fragmentCount.value = 3;
    uniforms.fragmentSpread.value = 0.2;
    uniforms.fragmentVariation.value = 0.3;
  },
  'Stormy Clouds': () => {
    uniforms.cloudCoverage.value = 0.7;
    uniforms.cloudSharpness.value = 2.5;
    uniforms.cloudColorShadow.value.setRGB(0.4, 0.4, 0.5);
    uniforms.skyColorTop.value.setRGB(0.3, 0.4, 0.6);
    uniforms.fragmentCount.value = 8;
    uniforms.fragmentSpread.value = 0.4;
    uniforms.fragmentVariation.value = 1.2;
  },
  'Scattered Fragments': () => {
    uniforms.cloudSize.value = 0.6;
    uniforms.cloudCoverage.value = 0.25;
    uniforms.cloudSharpness.value = 2.0;
    uniforms.fragmentCount.value = 8;
    uniforms.fragmentSpread.value = 0.8;
    uniforms.fragmentVariation.value = 1.5;
    uniforms.skyColorTop.value.setRGB(0.15, 0.35, 0.8);
    uniforms.skyColorHorizon.value.setRGB(0.5, 0.75, 1.0);
  },
  'Dense Cloud Field': () => {
    uniforms.cloudSize.value = 1.5;
    uniforms.cloudCoverage.value = 0.6;
    uniforms.cloudSharpness.value = 1.4;
    uniforms.fragmentCount.value = 7;
    uniforms.fragmentSpread.value = 0.2;
    uniforms.fragmentVariation.value = 0.3;
    uniforms.cloudDetail.value = 1.2;
  },
  'Dynamic Chaos': () => {
    uniforms.cloudSize.value = 1.0;
    uniforms.cloudCoverage.value = 0.5;
    uniforms.cloudSharpness.value = 1.6;
    uniforms.fragmentCount.value = 8;
    uniforms.fragmentSpread.value = 1.0;
    uniforms.fragmentVariation.value = 2.0;
    uniforms.cloudSpeed.value = 0.6;
  }
};

const presetFolder = gui.addFolder('Presets');
Object.keys(presets).forEach(key => {
  presetFolder.add(presets, key);
});

// === EXPORT FUNCTIONS ===
function captureHighRes(width = 4096, height = 4096) {
  const offscreenRenderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
  });
  offscreenRenderer.setSize(width, height);

  const aspectRatio = width / height;
  const tempCamera = camera.clone();
  tempCamera.left = -aspectRatio * viewSize / 2;
  tempCamera.right = aspectRatio * viewSize / 2;
  tempCamera.updateProjectionMatrix();

  const tempMesh = mesh.clone();
  tempMesh.scale.x = aspectRatio;

  const tempScene = new THREE.Scene();
  tempScene.add(tempMesh);

  uniforms.resolution.value.set(width, height);
  offscreenRenderer.render(tempScene, tempCamera);

  const canvas = offscreenRenderer.domElement;
  const link = document.createElement('a');
  link.download = `cumulus-sky-${width}x${height}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  offscreenRenderer.dispose();
}

function captureCurrentView() {
  const canvas = renderer.domElement;
  const link = document.createElement('a');
  link.download = `cumulus-sky-${window.innerWidth}x${window.innerHeight}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Folder visibility
cloudFolder.open();
skyFolder.open();
fragmentFolder.open();
exportFolder.close();

// === ANIMATION LOOP ===
function animate(timestamp) {
  uniforms.time.value = timestamp * 0.001;

  // Mouse smoothing
  smoothedMouse.x += (targetMouse.x - smoothedMouse.x) * smoothingFactor;
  smoothedMouse.y += (targetMouse.y - smoothedMouse.y) * smoothingFactor;

  uniforms.mouse.value.x = smoothedMouse.x;
  uniforms.mouse.value.y = smoothedMouse.y;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// === KEYBOARD SHORTCUTS ===
window.addEventListener('keydown', (e) => {
  switch(e.key) {
    case '1': presets['Classic Cumulus'](); break;
    case '2': presets['Big Fluffy Clouds'](); break;
    case '3': presets['Crisp Blue Sky'](); break;
    case '4': presets['Stormy Clouds'](); break;
    case '5': presets['Scattered Fragments'](); break;
    case '6': presets['Dense Cloud Field'](); break;
    case '7': presets['Dynamic Chaos'](); break;
    case 'r': // Randomize fragment seed
      uniforms.fragmentSeedOffset.value = Math.random() * 100;
      break;
    case 's':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        captureHighRes(4096, 4096);
      }
      break;
  }
});

// Start the animation
requestAnimationFrame(animate);