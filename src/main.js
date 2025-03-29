import * as THREE from 'three';
import vertexShader from './glsl/vertex.glsl';
import fragmentShader from './glsl/shader.glsl';
import fragmentShader2 from './glsl/shader2.glsl';
// Basic setup
const scene = new THREE.Scene();
// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// camera.position.z = 1;

const viewSize = 2; // Hauteur de la vue
const aspectRatio = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
    -aspectRatio * viewSize / 2, // left
     aspectRatio * viewSize / 2, // right
     viewSize / 2,               // top
    -viewSize / 2,               // bottom
    0.1,                         // near
    1000                         // far
);
camera.position.z = 1;

// const distance = camera.position.z;
// // Convertir le FOV en radians et prendre la moitié
// const vFov = THREE.MathUtils.degToRad(camera.fov);
// const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
// // Calculer la largeur visible en fonction de l'aspect ratio
// const visibleWidth = visibleHeight * camera.aspect;


const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a plane that fills the screen
const geometry = new THREE.PlaneGeometry(2, 2);

const uniforms = {
  time: { value: 0.0 },
  resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
};

const material = new THREE.ShaderMaterial({
  fragmentShader2,
  vertexShader,
  uniforms
});

const mesh = new THREE.Mesh(geometry, material);
mesh.scale.x = aspectRatio; // Échelle X pour correspondre à la largeur de la caméra
mesh.scale.y = 1;   // Échelle Y est 1 car la hauteur correspond déjà
scene.add(mesh);

// mesh.scale.x = visibleWidth / 2;
// mesh.scale.y = visibleHeight / 2;


window.addEventListener('resize', () => {
  // Mettre à jour la taille du rendu
  renderer.setSize(window.innerWidth, window.innerHeight);
  aspectRatio = window.innerWidth / window.innerHeight; // Recalculer l'aspect ratio

  // Mettre à jour les limites de la caméra
  camera.left = -aspectRatio * viewSize / 2;
  camera.right = aspectRatio * viewSize / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.updateProjectionMatrix(); // Appliquer les changements de la caméra

  // Mettre à jour l'aspect de la caméra
  // camera.aspect = window.innerWidth / window.innerHeight;
  // camera.updateProjectionMatrix(); // Très important après changement d'aspect

  // Recalculer la taille visible et mettre à jour l'échelle du mesh
  // const updatedVisibleHeight = 2 * Math.tan(vFov / 2) * distance;
  // const updatedVisibleWidth = updatedVisibleHeight * camera.aspect;
  // mesh.scale.x = updatedVisibleWidth / 2;
  // mesh.scale.y = updatedVisibleHeight / 2;

  mesh.scale.x = aspectRatio;
  mesh.scale.y = 1; // Reste 1

  // Mettre à jour l'uniform resolution (si ton shader l'utilise encore)
  uniforms.resolution.value.x = window.innerWidth;
  uniforms.resolution.value.y = window.innerHeight;
});

function animate(timestamp) {
  uniforms.time.value = timestamp * 0.001;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
