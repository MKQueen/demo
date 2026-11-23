/**
 * ink.js —— 把 3D 画面「画」成水墨画的最后一层。
 *
 * 做法：先把场景渲进一张带深度纹理的 HDR 目标，再用一个全屏 shader 做：
 *   1. 深度 + 亮度双 Sobel → 墨线（建筑的边、屋顶的转折、山脊都会自己长出墨线，
 *      不需要手动画描边）；
 *   2. 降饱和 + 纸色叠加 + 压角 → 整幅画统一到宣纸的色温里；
 *   3. 暮色时整体偏暖、压暗，像纸被夕阳染过。
 *
 * 输出时手动做 sRGB 编码：全屏 shader 是原始材质，three 不会替我们转。
 * 这里的参数（uInk / 墨线阈值）是整幅画的气质所在，改动请配合截图看效果。
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform sampler2D tPaper;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uInk;
  uniform float uDusk;
  uniform float uSnow;
  uniform float uTime;

  varying vec2 vUv;

  float linearDepth(float d) {
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }
  float lum(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    vec2 texel = 1.0 / uResolution;

    // —— 1. 画面 + 轻微笔触柔化 ——
    vec3 color = texture2D(tDiffuse, vUv).rgb;
    vec3 soft =
      texture2D(tDiffuse, vUv + vec2(texel.x, 0.0) * 1.6).rgb +
      texture2D(tDiffuse, vUv - vec2(texel.x, 0.0) * 1.6).rgb +
      texture2D(tDiffuse, vUv + vec2(0.0, texel.y) * 1.6).rgb +
      texture2D(tDiffuse, vUv - vec2(0.0, texel.y) * 1.6).rgb;
    soft *= 0.25;
    color = mix(color, soft, 0.22);

    // —— 2. 深度边 → 墨线 ——
    float dc = linearDepth(texture2D(tDepth, vUv).x);
    float dl = linearDepth(texture2D(tDepth, vUv - vec2(texel.x, 0.0)).x);
    float dr = linearDepth(texture2D(tDepth, vUv + vec2(texel.x, 0.0)).x);
    float du = linearDepth(texture2D(tDepth, vUv + vec2(0.0, texel.y)).x);
    float dd = linearDepth(texture2D(tDepth, vUv - vec2(0.0, texel.y)).x);

    float ddepth = (abs(dl - dr) + abs(du - dd)) / max(dc, 1.0);
    float depthEdge = smoothstep(0.008, 0.06, ddepth);

    // —— 3. 亮度边 → 细节线（瓦垄、栏杆、窗棂） ——
    float lc = lum(color);
    float ll = lum(texture2D(tDiffuse, vUv - vec2(texel.x, texel.y) * 1.2).rgb);
    float lr = lum(texture2D(tDiffuse, vUv + vec2(texel.x, texel.y) * 1.2).rgb);
    float lu = lum(texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y) * 1.2).rgb);
    float ld = lum(texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y) * 1.2).rgb);
    float detail = (abs(ll - lr) + abs(lu - ld));
    float detailEdge = smoothstep(0.025, 0.11, detail);

    float edge = clamp(depthEdge * 1.0 + detailEdge * 0.85, 0.0, 1.0);
    // 远山/远景不该有和近处一样锐利的墨线：空气透视，越远墨线越淡
    float depthFade = smoothstep(90.0, 650.0, dc);
    float brushWeight = texture2D(tDiffuse, vUv).a;
    // Broad planes keep their wash, small details recede; the material mask
    // preserves red walls / golden roofs without outlining every grey cottage.
    edge = depthEdge * mix(0.35, 0.82, brushWeight)
         + detailEdge * mix(0.06, 0.46, brushWeight);
    edge = clamp(edge, 0.0, 1.0) * mix(1.0, 0.12, depthFade);
    // 墨色不是纯黑，是一点冷灰
    vec3 inkColor = vec3(0.042, 0.05, 0.053);
    color = mix(color, inkColor, edge * clamp(uInk, 0.0, 1.6));

    // —— 4. 墨分五色：降饱和、抬纸色 ——
    float g = lum(color);
    color = mix(color, vec3(g), 0.14);
    // 宣纸上的墨没有纯黑：抬一点暗部、压一点高光
    color = mix(color, vec3(max(g, 0.0)), 0.12);
    color = pow(max(color, vec3(0.0)), vec3(0.82));
    color = color * 1.01 + vec3(0.014, 0.013, 0.010);
    // 暖纸色偏移（亮部偏暖、暗部偏冷）
    float warm = smoothstep(0.15, 0.85, g);
    color *= mix(vec3(0.98, 0.99, 1.02), vec3(1.045, 1.0, 0.94), warm);

    // 轻微 S 曲线：暗部压一点、亮部提一点，让墨更实
    color = mix(color, color * color * (3.0 - 2.0 * color), 0.18);

    // —— 5. 纸纹 ——
    vec3 paper = texture2D(tPaper, vUv * vec2(2.6, 1.9)).rgb;
    paper = mix(vec3(1.0), paper, 0.12);
    color *= paper;

    // —— 5.5 雪：低饱和的面（屋顶/墙面/地面/远山）被雪覆盖，红墙金顶保留 ——
    if (uSnow > 0.001) {
      float mx = max(color.r, max(color.g, color.b));
      float mn = min(color.r, min(color.g, color.b));
      float sat = (mx - mn) / max(mx, 0.0001);
      // 暖重彩（宫墙朱红 / 屋脊金）保留下来，其余灰面覆雪
      bool warm = color.r > color.g * 1.03 && color.r > color.b * 1.03;
      float preserve = (warm && sat > 0.16) ? 1.0 : 0.0;
      float snowMask = (1.0 - smoothstep(0.08, 0.42, sat)) * (1.0 - preserve);
      snowMask *= smoothstep(0.012, 0.075, lum(color));
      // 雪也有起伏：亮处纯白，暗处冷蓝灰
      vec3 snowCol = mix(vec3(0.52, 0.6, 0.66), vec3(0.985, 0.99, 0.99), smoothstep(0.03, 0.8, lum(color)));
      color = mix(color, snowCol, uSnow * snowMask * 0.95);
      // 没被覆雪的部分也降一点温
      color = mix(color, color * vec3(0.97, 0.995, 1.03), uSnow * 0.55);
      // 雪天更亮一点（雪的反光）
      color += vec3(0.012, 0.014, 0.016) * uSnow;
    }

    // —— 6. 暮色 ——
    color *= mix(vec3(1.0), vec3(1.08, 0.9, 0.76), uDusk);
    color += vec3(0.014, 0.008, 0.002) * uDusk;

    // —— 7. 压角（旧画心） ——
    vec2 q = vUv - 0.5;
    float vig = 1.0 - dot(q, q) * 0.4;
    color *= clamp(vig, 0.0, 1.0);

    gl_FragColor = vec4(pow(max(color, vec3(0.0)), vec3(1.0 / 2.2)), 1.0);
  }
`;

export class InkPost {
  constructor({ renderer, paperTexture }) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.uniforms = {
      tDiffuse: { value: null },
      tDepth: { value: null },
      tPaper: { value: paperTexture },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.1 },
      uFar: { value: 5000 },
      uInk: { value: 1 },
      uDusk: { value: 0 },
      uSnow: { value: 0 },
      uTime: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.rt = null;
    this.width = 1;
    this.height = 1;
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(width, height, pixelRatio = null) {
    const pr = pixelRatio ?? Math.min(window.devicePixelRatio || 1, 1.85);
    const w = Math.max(2, Math.floor(width * pr));
    const h = Math.max(2, Math.floor(height * pr));
    if (this.rt) {
      this.rt.setSize(w, h);
    } else {
      this.rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples: 4,
        depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
      });
      this.rt.depthTexture.minFilter = THREE.NearestFilter;
      this.rt.depthTexture.magFilter = THREE.NearestFilter;
    }
    this.width = w;
    this.height = h;
    this.uniforms.tDiffuse.value = this.rt.texture;
    this.uniforms.tDepth.value = this.rt.depthTexture;
    this.uniforms.uResolution.value.set(w, h);
  }

  set ink(v) {
    this.uniforms.uInk.value = v;
  }
  set dusk(v) {
    this.uniforms.uDusk.value = v;
  }
  set snow(v) {
    this.uniforms.uSnow.value = v;
  }
  set time(v) {
    this.uniforms.uTime.value = v;
  }

  render(scene, camera, timeSeconds = 0) {
    this.uniforms.uNear.value = camera.near;
    this.uniforms.uFar.value = camera.far;
    this.uniforms.uTime.value = timeSeconds;
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }

  dispose() {
    this.rt?.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
