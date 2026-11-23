// Custom rendering pipeline copied from messenger.abeto.co's look:
//   1. render the scene into a 2-attachment HalfFloat render target
//        color = shaded color + surfaceId in alpha
//        info  = packed depth, spheremap normal, outline weight
//   2. fullscreen pass: detect outlines from face ids / depth / normals,
//      tint them, then apply the game's 32^3 3D LUT.
//
// This replaces the site's `MultipleRenderPass` + `outlines` composer passes.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { fit, encoding, depth, custom as outlineFn, lut } from '../shaders/chunks.js';

const OUTLINE_VERT = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const OUTLINE_FRAG = /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tInfo;
    uniform sampler3D tLUT;
    uniform float uLUTIntensity;
    uniform float uCameraNear;
    uniform float uCameraFar;
    uniform vec2 resolution;

    uniform vec2 uOutlineFade;
    uniform float uOutlineThickness;
    uniform vec3 uOutlineColor;
    uniform vec3 uInfoRange;
    uniform float uInfoMinScale;
    uniform vec3 uDepthRange;
    uniform vec3 uNormalRange;
    uniform float uOutlineScale;
    uniform float uSmoothMargin;

    varying vec2 vUv;

    ${fit}
    ${depth}
    ${encoding}
    ${lut}
    ${outlineFn}

    void main() {
        vec2 uv = vUv;
        float aspect = resolution.x / resolution.y;

        vec4 scene = texture2D(tDiffuse, vUv);
        vec3 sceneColor = scene.rgb;

        float resScale = min(1.0, resolution.y / 1300.0) * uOutlineScale;

        float centerDepth = 0.0;
        float nearestDepth = 0.0;
        float outlineValue = outline(
            tDiffuse, tInfo, vUv, uOutlineThickness, resScale,
            uInfoRange, uDepthRange, uNormalRange, uSmoothMargin, uInfoMinScale,
            uOutlineFade, vec2(uCameraNear, uCameraFar),
            nearestDepth, centerDepth
        );

        sceneColor = mix(sceneColor, uOutlineColor, outlineValue);
        sceneColor = apply3DLUTTetrahedral(sceneColor, tLUT, uLUTIntensity);

        gl_FragColor = vec4(sceneColor, 1.0);
        #include <colorspace_fragment>
    }
`;

export function createPipeline(renderer, options = {}) {
  let renderScale = options.renderScale || 1;
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    count: 2,
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.textures[0].name = 'color';
  target.textures[1].name = 'info';
  target.textures[0].colorSpace = THREE.NoColorSpace;
  target.textures[1].colorSpace = THREE.NoColorSpace;

  const uniforms = {
    tDiffuse: { value: target.textures[0] },
    tInfo: { value: target.textures[1] },
    tLUT: { value: null },
    uLUTIntensity: { value: 1 },
    uCameraNear: { value: 0.1 },
    uCameraFar: { value: 500 },
    resolution: { value: new THREE.Vector2(size.x, size.y) },
    uOutlineFade: { value: new THREE.Vector2(5, 80) },
    uOutlineThickness: { value: 1 },
    uOutlineColor: { value: new THREE.Color('#363a3c') },
    uInfoRange: { value: new THREE.Vector3(1e-4, 2e-4, 0.1) },
    uInfoMinScale: { value: 0.6 },
    uDepthRange: { value: new THREE.Vector3(1e-4, 0.01001, 0.1) },
    uNormalRange: { value: new THREE.Vector3(0.4, 0.5, 0.3) },
    uOutlineScale: { value: 1 },
    uSmoothMargin: { value: 0.2 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Render the shadow map + scene normally into the MRT, then upscale/grade.
  function render(scene, camera) {
    if (camera && camera.isPerspectiveCamera) {
      uniforms.uCameraNear.value = camera.near;
      uniforms.uCameraFar.value = camera.far;
    }
    uniforms.tDiffuse.value = target.textures[0];
    uniforms.tInfo.value = target.textures[1];

    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    renderer.clear(true, true, true);
    quad.render(renderer);
  }

  function setSize(width, height, pixelRatio = 1, scale = renderScale) {
    const bw = Math.floor(width * pixelRatio);
    const bh = Math.floor(height * pixelRatio);
    if (bw === 0 || bh === 0) return;
    // Supersampling: the scene + outline info are rendered at a higher
    // resolution and then downsampled by the fullscreen pass. This removes the
    // one-pixel outline/foliage shimmer the reference pipeline shows when the
    // camera moves, without using MSAA (which made the face-id buffer unstable).
    const w = Math.max(1, Math.floor(bw * scale));
    const h = Math.max(1, Math.floor(bh * scale));
    target.setSize(w, h);
    uniforms.resolution.value.set(w, h);
    uniforms.uOutlineScale.value = 1.0 / Math.max(1, scale * 0.8);
  }

  function setRenderScale(scale) {
    renderScale = Math.max(0.75, Math.min(2, scale));
    uniforms.uOutlineScale.value = 1.0 / Math.max(1, renderScale * 0.8);
  }

  function setLUT(texture) {
    uniforms.tLUT.value = texture;
  }

  function setOutline(settings = {}) {
    Object.assign(uniforms, settings);
  }

  function dispose() {
    target.dispose();
    quad.dispose();
    material.dispose();
  }

  return { render, setSize, setRenderScale, setLUT, setOutline, dispose, target, uniforms, material };
}
