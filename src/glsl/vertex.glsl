const vertexShader = `
varying vec2 vUv; // N'oublie pas de passer les UV si ton fragment shader les utilise

void main() {
  vUv = uv; // Passe l'attribut 'uv' de la géométrie au fragment shader

  // Calcul correct de la position finale du sommet
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export default vertexShader;