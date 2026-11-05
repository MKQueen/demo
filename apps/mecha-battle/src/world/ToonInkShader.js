/**
 * Single-sample final colour grade. The original export name is retained for
 * debug integrations; edges and posterisation no longer modify PBR shading.
 */
export const ToonInkShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: null },
    levels: { value: 7.0 },
    edgeStrength: { value: 0.72 },
    edgeLow: { value: 0.055 },
    edgeHigh: { value: 0.22 },
    inkColor: { value: null },
    vignette: { value: 0.12 },
    aberration: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float levels;
    uniform float edgeStrength;
    uniform float edgeLow;
    uniform float edgeHigh;
    uniform vec3 inkColor;
    uniform float vignette;
    uniform float aberration;
    varying vec2 vUv;

    float luma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 centered = vUv - 0.5;
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Preserve the PBR material gradients. A restrained display-space grade
      // keeps warm attack lights distinct from the cool city haze.
      float l = luma(color);
      color = mix(vec3(l), color, 0.96);
      color = (color - 0.5) * 1.035 + 0.5;

      float vig = 1.0 - smoothstep(0.28, 0.86, length(centered));
      color *= mix(1.0, vig, vignette * 0.75);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
