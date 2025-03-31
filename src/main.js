import * as THREE from 'three';
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

const smoothedMouse = {
  x: 0.5,
  y: 0.5
};

const targetMouse = {
  x: 0.5,
  y: 0.5
};
const smoothingFactor = 0.1;

const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  mouse: { value: new THREE.Vector2(smoothedMouse.x, smoothedMouse.y) },
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

function animate(timestamp) {
  uniforms.time.value = timestamp * 0.001;

  smoothedMouse.x += (targetMouse.x - smoothedMouse.x) * smoothingFactor;
  smoothedMouse.y += (targetMouse.y - smoothedMouse.y) * smoothingFactor;

  uniforms.mouse.value.x = smoothedMouse.x;
  uniforms.mouse.value.y = smoothedMouse.y;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
