import * as THREE from 'three';
import { GUI } from 'lil-gui';
import vertexShader from './glsl/vertex.glsl';
import fragmentShader from './glsl/shader.glsl';

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



const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },

  // Time controls
  timeOfDay: { value: 0.75 },
  colorIntensity: { value: 1.0 },
  flowSpeed: { value: 1.0 },

  // Whimsical cloud controls
  cloudCoverage: { value: 0.5 },        // Nice amount of clouds
  cloudFluffiness: { value: 0.8 },      // How fluffy/soft the clouds are
  cloudScale: { value: 2.0 },           // Bigger, fluffier clouds
  cloudSpeed: { value: 0.2 },           // Gentle drift
  cloudDensity: { value: 0.6 },         // Light and airy

  // Particle effects
  particleCount: { value: 0.3 },        // Amount of floating particles
  particleSpeed: { value: 0.1 },        // Particle movement speed
  particleSize: { value: 0.5 },         // Size of particles

  // Volumetric cloud controls
  volumetricCloudSize: { value: 0.3 },    // Size of the main volumetric cloud
  volumetricCloudDensity: { value: 0.8 }, // Density of the volumetric cloud
  cloudHeight: { value: 0.6 },           // Height of the cloud center
  cloudDepth: { value: 0.4 },            // Depth/thickness of the cloud
  erosionStrength: { value: 0.2 },       // Envelope erosion strength
  lightingIntensity: { value: 1.0 },     // Lighting strength
  scatteringStrength: { value: 0.8 },    // Light scattering strength

  // Cute sky colors (whimsical pastels)
  skyColor1: { value: new THREE.Color(0.8, 0.9, 1.0) },      // Soft blue
  skyColor2: { value: new THREE.Color(1.0, 0.95, 0.9) },     // Peachy white
  cloudColorLight: { value: new THREE.Color(1.0, 1.0, 1.0) }, // Pure white
  cloudColorDark: { value: new THREE.Color(0.9, 0.9, 0.95) }, // Very light gray
  cloudColorEdge: { value: new THREE.Color(1.0, 0.98, 0.95) } // Creamy white
};

const material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio;
scene.add(mesh);

// === GUI SETUP ===
const gui = new GUI();
gui.title('Whimsical Sky Generator');

// Time & Atmosphere controls
const timeFolder = gui.addFolder('Time & Atmosphere');
timeFolder.add(uniforms.timeOfDay, 'value', 0, 1, 0.01)
  .name('Time of Day')
  .onChange(() => {})
  .listen();

timeFolder.add(uniforms.colorIntensity, 'value', 0, 2, 0.01)
  .name('Color Intensity');

timeFolder.add(uniforms.flowSpeed, 'value', 0, 3, 0.01)
  .name('Animation Speed');

// Fluffy Cloud Controls
const cloudFolder = gui.addFolder('Fluffy Clouds');
cloudFolder.add(uniforms.cloudCoverage, 'value', 0, 1, 0.01).name('Cloud Coverage');
cloudFolder.add(uniforms.cloudFluffiness, 'value', 0.1, 2, 0.01).name('Fluffiness');
cloudFolder.add(uniforms.cloudScale, 'value', 0.5, 5, 0.1).name('Cloud Size');
cloudFolder.add(uniforms.cloudSpeed, 'value', 0, 1, 0.01).name('Drift Speed');
cloudFolder.add(uniforms.cloudDensity, 'value', 0, 1, 0.01).name('Cloud Density');

// Particle Effects
const particleFolder = gui.addFolder('Magical Particles');
particleFolder.add(uniforms.particleCount, 'value', 0, 1, 0.01).name('Particle Amount');
particleFolder.add(uniforms.particleSpeed, 'value', 0, 0.5, 0.01).name('Particle Speed');
particleFolder.add(uniforms.particleSize, 'value', 0.1, 2, 0.01).name('Particle Size');

// Volumetric Cloud Controls
const volumetricFolder = gui.addFolder('Volumetric Cloud');
volumetricFolder.add(uniforms.volumetricCloudSize, 'value', 0.1, 1.0, 0.01).name('Cloud Size');
volumetricFolder.add(uniforms.volumetricCloudDensity, 'value', 0, 2, 0.01).name('Cloud Density');
volumetricFolder.add(uniforms.cloudHeight, 'value', 0, 1, 0.01).name('Cloud Height');
volumetricFolder.add(uniforms.cloudDepth, 'value', 0.1, 1, 0.01).name('Cloud Depth');
volumetricFolder.add(uniforms.erosionStrength, 'value', 0, 1, 0.01).name('Erosion Strength');
volumetricFolder.add(uniforms.lightingIntensity, 'value', 0, 3, 0.01).name('Lighting Intensity');
volumetricFolder.add(uniforms.scatteringStrength, 'value', 0, 2, 0.01).name('Scattering Strength');

// Sky Colors
const skyFolder = gui.addFolder('Sky Colors');
skyFolder.addColor({ color: uniforms.skyColor1.value.getHex() }, 'color')
  .name('Sky Color 1')
  .onChange(value => uniforms.skyColor1.value.setHex(value));
skyFolder.addColor({ color: uniforms.skyColor2.value.getHex() }, 'color')
  .name('Sky Color 2')
  .onChange(value => uniforms.skyColor2.value.setHex(value));

// Cloud Colors
const cloudColorFolder = gui.addFolder('Cloud Colors');
cloudColorFolder.addColor({ color: uniforms.cloudColorLight.value.getHex() }, 'color')
  .name('Cloud Highlights')
  .onChange(value => uniforms.cloudColorLight.value.setHex(value));
cloudColorFolder.addColor({ color: uniforms.cloudColorDark.value.getHex() }, 'color')
  .name('Cloud Shadows')
  .onChange(value => uniforms.cloudColorDark.value.setHex(value));
cloudColorFolder.addColor({ color: uniforms.cloudColorEdge.value.getHex() }, 'color')
  .name('Cloud Edges')
  .onChange(value => uniforms.cloudColorEdge.value.setHex(value));

// Whimsical sky presets
const whimsicalPresets = {
  'Cotton Candy': () => {
    uniforms.skyColor1.value.setRGB(1.0, 0.8, 0.9);
    uniforms.skyColor2.value.setRGB(0.8, 0.9, 1.0);
    uniforms.cloudFluffiness.value = 1.5;
    uniforms.cloudCoverage.value = 0.6;
    uniforms.volumetricCloudSize.value = 0.4;
    uniforms.volumetricCloudDensity.value = 0.6;
    uniforms.scatteringStrength.value = 1.2;
    uniforms.timeOfDay.value = 0.8;
  },
  'Sunny Day': () => {
    uniforms.skyColor1.value.setRGB(0.6, 0.8, 1.0);
    uniforms.skyColor2.value.setRGB(1.0, 1.0, 0.9);
    uniforms.cloudFluffiness.value = 0.8;
    uniforms.cloudCoverage.value = 0.3;
    uniforms.volumetricCloudSize.value = 0.3;
    uniforms.volumetricCloudDensity.value = 0.8;
    uniforms.lightingIntensity.value = 1.5;
    uniforms.timeOfDay.value = 0.5;
  },
  'Dreamy Sunset': () => {
    uniforms.skyColor1.value.setRGB(1.0, 0.7, 0.5);
    uniforms.skyColor2.value.setRGB(0.9, 0.5, 0.7);
    uniforms.cloudFluffiness.value = 1.2;
    uniforms.cloudCoverage.value = 0.4;
    uniforms.volumetricCloudSize.value = 0.5;
    uniforms.volumetricCloudDensity.value = 1.0;
    uniforms.scatteringStrength.value = 1.5;
    uniforms.timeOfDay.value = 0.75;
  },
  'Magical Morning': () => {
    uniforms.skyColor1.value.setRGB(0.9, 0.9, 1.0);
    uniforms.skyColor2.value.setRGB(1.0, 0.9, 0.8);
    uniforms.cloudFluffiness.value = 1.0;
    uniforms.cloudCoverage.value = 0.5;
    uniforms.particleCount.value = 0.5;
    uniforms.volumetricCloudSize.value = 0.35;
    uniforms.volumetricCloudDensity.value = 0.7;
    uniforms.erosionStrength.value = 0.3;
    uniforms.timeOfDay.value = 0.3;
  },
  'Epic Cloud': () => {
    uniforms.skyColor1.value.setRGB(0.7, 0.8, 0.95);
    uniforms.skyColor2.value.setRGB(0.95, 0.95, 1.0);
    uniforms.cloudCoverage.value = 0.2; // Minimal background clouds
    uniforms.volumetricCloudSize.value = 0.6; // Large volumetric cloud
    uniforms.volumetricCloudDensity.value = 1.2;
    uniforms.cloudHeight.value = 0.7;
    uniforms.erosionStrength.value = 0.4;
    uniforms.lightingIntensity.value = 2.0;
    uniforms.scatteringStrength.value = 1.8;
  }
};

const whimsicalPresetFolder = gui.addFolder('Whimsical Presets');
Object.keys(whimsicalPresets).forEach(key => {
  whimsicalPresetFolder.add(whimsicalPresets, key);
});

// Animation controls
const controls = {
  autoCycle: false,
  cycleSpeed: 0.0003,
  pauseAnimation: false,
  resetTime: () => uniforms.time.value = 0
};

const animationFolder = gui.addFolder('Animation');
animationFolder.add(controls, 'autoCycle').name('Auto Day/Night Cycle');
animationFolder.add(controls, 'cycleSpeed', 0.0001, 0.002, 0.0001).name('Cycle Speed');
animationFolder.add(controls, 'pauseAnimation').name('Pause Animation');
animationFolder.add(controls, 'resetTime').name('Reset Time');

// Export controls
const exportControls = {
  'Export 4K PNG': () => captureHighRes(4096, 4096),
  'Export 8K PNG': () => captureHighRes(7680, 7680),
  'Export Current View': () => captureCurrentView()
};

const exportFolder = gui.addFolder('Export');
Object.keys(exportControls).forEach(key => {
  exportFolder.add(exportControls, key);
});



// Collapse folders by default except main controls
timeFolder.open();
cloudFolder.open();
particleFolder.open();
volumetricFolder.open();
skyFolder.close();
cloudColorFolder.close();
whimsicalPresetFolder.close();
animationFolder.close();
exportFolder.close();

// === EVENT LISTENERS ===
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
  link.download = `sky-gradient-${width}x${height}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();

  uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  offscreenRenderer.dispose();
}

function captureCurrentView() {
  const canvas = renderer.domElement;
  const link = document.createElement('a');
  link.download = `sky-gradient-${window.innerWidth}x${window.innerHeight}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// === ANIMATION LOOP ===
function animate(timestamp) {
  if (!controls.pauseAnimation) {
    uniforms.time.value = timestamp * 0.001 * uniforms.flowSpeed.value;
  }

  // Auto day/night cycle
  if (controls.autoCycle) {
    uniforms.timeOfDay.value = (Math.sin(timestamp * controls.cycleSpeed) + 1) * 0.5;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// === KEYBOARD SHORTCUTS ===
window.addEventListener('keydown', (e) => {
  switch(e.key) {
    case '1': uniforms.timeOfDay.value = 0.0; break;   // Night
    case '2': uniforms.timeOfDay.value = 0.25; break;  // Sunrise
    case '3': uniforms.timeOfDay.value = 0.5; break;   // Day
    case '4': uniforms.timeOfDay.value = 0.75; break;  // Sunset
    case ' ': controls.pauseAnimation = !controls.pauseAnimation; break;
    case 'c': controls.autoCycle = !controls.autoCycle; break;
    case 's':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        captureHighRes(4096, 4096);
      }
      break;
  }
});

requestAnimationFrame(animate);