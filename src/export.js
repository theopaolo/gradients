import * as THREE from "three";
import {
  renderer,
  scene,
  camera,
  applyAspect,
  applyViewportAspect,
  requestRender,
} from "./gradient.js";

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

  // Back to the viewport before the next animation frame paints. The loop may
  // be idle, so it has to be told the canvas needs redrawing.
  applyViewportAspect();
  requestRender();

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
