/**
 * lib/post.js —— 夜景三渲二后期。
 *
 * 管线：HDR 渲染 → UnrealBloom（霓虹/灯箱辉光）→ 自写最终调色 Pass
 *      （ACES 近似 tonemap + sRGB + 青冷阴影/暖高光分离 + 移轴微模糊 +
 *        暗角 + 颗粒 + 轻微色散）。
 *
 * 不使用 OutputPass：渲染目标保持线性 HDR，所有色调映射与输出编码都在最终 Pass
 * 里一次完成，便于把霓虹压出干净、柔和的动画夜景。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uExposure: { value: 1.0 },
    uBloom: { value: 1.0 },
    uVignette: { value: 0.48 },
    uGrain: { value: 0.035 },
    uSaturation: { value: 1.2 },
    uTilt: { value: 0.7 },
    uFade: { value: 0.0 },
    uShadowTint: { value: new THREE.Color('#24406e') },
    uHighlightTint: { value: new THREE.Color('#ffd9a8') },
    uAberration: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uExposure;
    uniform float uBloom;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uTilt;
    uniform float uFade;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uAberration;
    varying vec2 vUv;

    // ACES filmic approximation (Narkowicz)
    vec3 aces( vec3 x ) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp( ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e ), 0.0, 1.0 );
    }

    vec3 toSRGB( vec3 c ) {
      return mix( pow( c, vec3( 1.0 / 2.4 ) ) * 1.055 - 0.055, c * 12.92, step( c, vec3( 0.0031308 ) ) );
    }

    float hash( vec2 p ) {
      p = fract( p * vec2( 123.34, 456.21 ) );
      p += dot( p, p + 45.32 );
      return fract( p.x * p.y );
    }

    vec3 sampleSoft( vec2 uv, float radius ) {
      if ( radius < 0.0001 ) return texture2D( tDiffuse, uv ).rgb;
      vec2 px = radius / uResolution;
      vec3 sum = vec3( 0.0 );
      float total = 0.0;
      for ( int i = 0; i < 8; i ++ ) {
        float a = float( i ) * 0.7853981634 + 0.3;
        vec2 o = vec2( cos( a ), sin( a ) );
        vec3 s = texture2D( tDiffuse, uv + o * px * 2.2 ).rgb;
        float w = 1.0;
        sum += s * w;
        total += w;
        vec3 s2 = texture2D( tDiffuse, uv + o * px * 0.9 ).rgb;
        sum += s2 * 1.0;
        total += 1.0;
      }
      return sum / total;
    }

    void main() {
      vec2 uv = vUv;
      // 轻微镜头色散：画面边缘更明显，中间几乎没有
      vec2 center = uv - 0.5;
      float edge = smoothstep( 0.12, 0.62, length( center ) );
      float ab = uAberration * edge * 0.0016;
      vec3 color;
      color.r = texture2D( tDiffuse, uv + center * ab ).r;
      color.g = texture2D( tDiffuse, uv ).g;
      color.b = texture2D( tDiffuse, uv - center * ab ).b;

      // 移轴式微模糊（上下远处模糊，保留中间的模型细节）——微缩摄影感
      float band = smoothstep( 0.30, 0.78, abs( uv.y - 0.5 ) );
      float radius = band * uTilt * 2.6;
      vec3 soft = sampleSoft( uv, radius );
      color = mix( color, soft, band * 0.82 );

      // 曝光 + tonemap
      color *= uExposure;
      color = aces( color );
      color = toSRGB( color );

      // 分离调色：冷阴影、暖高光
      color = max( color, vec3( 0.0001 ) );
      float luma = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      float shadowW = 1.0 - smoothstep( 0.02, 0.42, luma );
      float highW = smoothstep( 0.55, 1.0, luma );
      color += uShadowTint * shadowW * 0.085;
      color = mix( color, color * uHighlightTint, highW * 0.28 );

      // 饱和度
      color = mix( vec3( luma ), color, uSaturation );

      // 轻微 S 曲线，给夜景一点对比度（三渲二的色块更干净）
      color = clamp( color, 0.0, 1.0 );
      color = color * color * ( 3.0 - 2.0 * color ) * 0.35 + color * 0.65;

      // 暗角
      vec2 vigUv = ( uv - 0.5 ) * vec2( uResolution.x / uResolution.y, 1.0 );
      float vig = 1.0 - uVignette * smoothstep( 0.34, 1.05, length( vigUv ) );
      color *= vig;

      // 颗粒（动画噪点，微弱）
      float grain = hash( uv * uResolution.xy + fract( uTime ) * 371.0 ) - 0.5;
      color += grain * uGrain * ( 0.25 + 0.75 * ( 1.0 - luma ) );

      // 轻微暗部蓝移 + 高光柔化
      color = clamp( color, 0.0, 1.0 );
      color *= uFade;

      // 抖动
      float dither = ( hash( uv * uResolution.xy + 17.0 ) - 0.5 ) / 255.0;
      color += dither;

      gl_FragColor = vec4( color, 1.0 );
    }
  `,
};

export function createPost(renderer, scene, camera, opts = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    samples: opts.samples ?? 4,
  });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    opts.bloomStrength ?? 0.72,
    opts.bloomRadius ?? 0.62,
    opts.bloomThreshold ?? 0.72,
  );
  composer.addPass(bloom);

  const grade = new ShaderPass(GradeShader);
  grade.renderToScreen = true;
  composer.addPass(grade);

  const uniforms = grade.uniforms;
  uniforms.uExposure.value = opts.exposure ?? 1.0;
  uniforms.uBloom.value = 1;

  function setSize(w, h) {
    composer.setSize(w, h);
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    uniforms.uResolution.value.set(s.x, s.y);
    bloom.resolution.set(w, h);
  }

  function resize() {
    setSize(window.innerWidth, window.innerHeight);
  }

  setSize(window.innerWidth, window.innerHeight);

  let fadeStart = performance.now();
  const fadeDur = opts.fadeMs ?? 1800;

  return {
    composer,
    bloom,
    grade,
    uniforms,
    setSize,
    resize,
    render(dt, t) {
      uniforms.uTime.value = t;
      const f = Math.min(1, (performance.now() - fadeStart) / fadeDur);
      uniforms.uFade.value = f * f * (3 - 2 * f);
      composer.render(dt);
    },
    get fadeDone() {
      return performance.now() - fadeStart > fadeDur + 100;
    },
  };
}
