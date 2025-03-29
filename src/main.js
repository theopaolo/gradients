import * as THREE from 'three';
import vertexShader from './glsl/vertex.glsl';
import fragmentShader from './glsl/shader.glsl';
import { audioData } from './audio.js';

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

const smoothedMouse = {
  x: 0.5,
  y: 0.5
};

const targetMouse = {
  x: 0.5,
  y: 0.5
};
const smoothingFactor = 0.1;

// Create Float32Array textures for waveform and FFT data
const waveformTextureSize = 32; // 32x32 texture
const waveformTextureData = new Float32Array(waveformTextureSize * waveformTextureSize);
const waveformTexture = new THREE.DataTexture(
  waveformTextureData,
  waveformTextureSize,
  waveformTextureSize,
  THREE.RedFormat,
  THREE.FloatType
);
waveformTexture.needsUpdate = true;

const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  mouse: { value: new THREE.Vector2(smoothedMouse.x, smoothedMouse.y) },
  // Audio uniforms
  audioVolume: { value: 0.0 },
  audioBass: { value: 0.0 },
  audioMid: { value: 0.0 },
  audioHigh: { value: 0.0 },
  waveform: { value: waveformTexture }
};

const material = new THREE.ShaderMaterial({
  fragmentShader,
  vertexShader,
  uniforms
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio;
mesh.scale.y = 1;
scene.add(mesh);

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
  mesh.scale.y = 1;

  uniforms.resolution.value.x = window.innerWidth;
  uniforms.resolution.value.y = window.innerHeight;
});

// Update audio data in the shader
function updateWaveformTexture() {
  // Copy a portion of the audio waveform data to the texture
  const waveLength = Math.min(audioData.waveform.length, waveformTextureSize * waveformTextureSize);
  for (let i = 0; i < waveLength; i++) {
    waveformTextureData[i] = audioData.waveform[i];
  }
  waveformTexture.needsUpdate = true;
}

function animate(timestamp) {
  uniforms.time.value = timestamp * 0.001;

  smoothedMouse.x += (targetMouse.x - smoothedMouse.x) * smoothingFactor;
  smoothedMouse.y += (targetMouse.y - smoothedMouse.y) * smoothingFactor;

  uniforms.mouse.value.x = smoothedMouse.x;
  uniforms.mouse.value.y = smoothedMouse.y;

  // Update audio-related uniforms
  uniforms.audioVolume.value = audioData.volume;
  uniforms.audioBass.value = audioData.bassEnergy;
  uniforms.audioMid.value = audioData.midEnergy;
  uniforms.audioHigh.value = audioData.highEnergy;

  // Update the waveform texture
  updateWaveformTexture();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
