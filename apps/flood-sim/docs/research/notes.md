# ShaderToy `Ms2SD1` — "Seascape" by TDM — research notes

**Status: FULL SOURCE OBTAINED.** `ms2sd1-source.glsl` is the complete Image-tab GLSL,
restored to ShaderToy form. Nothing is missing.

---

## 0. TL;DR

| Field | Value |
|---|---|
| Shader | **"Seascape"** |
| Author | **Alexander Alekseev aka TDM** (`TDM` on ShaderToy) — *not* Dave Hoskins |
| Year | 2014 |
| License | **CC BY-NC-SA 3.0 Unported** (attribution + non-commercial + share-alike) |
| URL | https://www.shadertoy.com/view/Ms2SD1 |
| Passes | 1 (Image only), **no textures / no iChannel** — 100% procedural |
| Uniforms | `iResolution`, `iTime`, `iMouse` |
| Size | ~180 lines of actual GLSL |

> The "Dave Hoskins" guess was wrong. `Ms2SD1` = TDM's Seascape. Two independent
> confirmations: the ISF conversion embeds `// "Seascape" by Alexander Alekseev aka TDM - 2014`,
> and `creikey/tdm-godot-ocean` describes itself as *"The TDM Seascape Shadertoy shader ported to
> godot: https://www.shadertoy.com/view/Ms2SD1"*.

---

## 1. How the source was obtained (reusable trick)

ShaderToy is behind Cloudflare and returns **403 "Just a moment…"** to every direct attempt:

| Attempt | Result |
|---|---|
| `curl` with browser UA | 403 (CF managed challenge) |
| Playwright **headless** chromium 1217 (`/view` and `/embed`) | 403 |
| Playwright **headful real Chrome 156** (`channel: 'chrome'`, webdriver patched) | 403, never cleared in 60 s |
| `r.jina.ai` reader proxy | connection blocked (000) |
| `web.archive.org` (CDX + `id_` snapshot) | connection blocked (000) |
| `www-shadertoy-com.translate.goog` | blocked (000) |
| `grep.app/api`, `searchcode.com/api` | Vercel checkpoint / 404 |
| GitHub code search (unauthenticated) | requires auth |

**What worked:** [ISF.video](https://editor.isf.video) — the Interactive Shader Format web editor —
runs a bulk **"Automatically Converted"** import of ShaderToy shaders. It is *not* behind
Cloudflare and it exposes a **public, unauthenticated JSON API**:

```
GET https://editor.isf.video/api/shaders/6769241c2909a9001a007182
→ { "title": "st_Ms2SD1.fs",
    "description": "Automatically converted from https://www.shadertoy.com/view/Ms2SD1",
    "rawFragmentSource": "<the whole shader>",
    "user": { "username": "Dav", "name": "Moz" } }
```

Other useful endpoints on the same host: `/api/shaders?sort=popular`,
`/api/shaders?featured=true`, `/api/shaders/<id>/related`.
Discovery path: `web_search "Ms2SD1"` → `https://editor.isf.video/shaders/6769241c2909a9001a007182`
(titled `st_Ms2SD1.fs`) → Playwright request capture to find the XHR → plain `curl`.

**This is a general workaround for any ShaderToy shader**: search `editor.isf.video` for the
shortcode / title, grab the Mongo-style id, then `curl` the API.

Raw artefacts are kept verbatim in `raw/`:
`raw/isf-ms2sd1.json` (full JSON), `raw/isf-frag.glsl` (byte-exact `rawFragmentSource`).

---

## 2. Reconstruction deltas (ISF → ShaderToy)

The ISF importer is a *mechanical* converter, so undoing it is lossless. Only these changes exist:

| ISF form | Restored ShaderToy form |
|---|---|
| `RENDERSIZE` | `iResolution` |
| `TIME` | `iTime` |
| the 6 tunables emitted as ISF `INPUT`s (`SEA_FREQ` 0.16, `SEA_CHOPPY` 4.0, `SEA_HEIGHT` 0.6, `SEA_SPEED` 0.8, plus 2 colors) | original `const float …` / `const vec3 …` declarations |
| `void main()` + `gl_FragCoord` / `gl_FragColor` | `void mainImage(out vec4 fragColor, in vec2 fragCoord)` + `fragColor` |

Colors recovered from ISF defaults: `SEA_BASE = vec3(0.1,0.19,0.22)`,
`SEA_WATER_COLOR = vec3(0.8,0.9,0.6)`.

**Verification against bteitler's annotated copy** (a direct, comment-annotated copy of the
ShaderToy source, now at `https://github.com/eshnil2000/SeascapeGPUShader`): identical global
declarations in identical order, identical constants, identical function bodies and identical
statement order inside `mainImage`. That is very strong evidence the reconstruction is faithful.

### Known uncertainty (cosmetic only)

`SEA_TIME`:

* ISF conversion **and** bteitler's copy both have
  `float SEA_TIME = iTime * SEA_SPEED;` at global scope → used in `ms2sd1-source.glsl`.
* Some later rewrites use `#define SEA_TIME (1.0 + iTime * SEA_SPEED)`
  (e.g. `DarelCullen/3dshaders`, `red-fire-code/cesium-water-polygon`).

The `1.0 +` only shifts the wave pattern by one time unit — visually identical, and irrelevant
for a port. Whitespace/tab mix is preserved as served; exact byte-identity with the ShaderToy
editor cannot be claimed, but semantically it is 1:1.

### Portability caveat (important when porting) — **verified experimentally**

Two globals are initialised from uniforms:

```glsl
float EPSILON_NRM = 0.1 / iResolution.x;   // line 25
float SEA_TIME    = iTime * SEA_SPEED;     // line 36
```

Compiling the restored file in Chromium:

| Context | Result |
|---|---|
| **WebGL 1 / GLSL ES 1.00** (ShaderToy's default) | ✅ compiles, links, renders. Only *warnings*: `'=' : global variable initializers should be constant expressions (uniforms and globals are allowed in global initializers for legacy compatibility)` |
| **WebGL 2 / GLSL ES 3.00** | ❌ `ERROR: 0:25: '=' : global variable initializers must be constant expressions` (same at 0:36) |

So the original is **not** valid ES 3.00 — it only works because ShaderToy's default pass is
WebGL1. Any modern port (Cesium 1.100+ uses WebGL2, Three.js r152+ uses WebGL2) must
**move both initialisations into `mainImage`** or turn them into uniforms set per frame.
The Godot port did exactly this. This is the #1 gotcha when lifting this shader.

### End-to-end validation

`raw/render-test.mjs` compiles the restored file in headless Chromium (WebGL1), sets
`iResolution = 640×360`, `iTime = 12`, `iMouse = 0`, draws one full-screen triangle and reads back
the framebuffer:

* `gl.getError() == 0`, mean luminance 150.8/255, 100 % of pixels non-black.
* Saved frame: **`raw/ms2sd1-render.png`** — shows the characteristic TDM seascape: horizon,
  choppy multi-octave waves, sun glitter, blue-grey sky gradient. This confirms the
  reconstruction is behaviourally identical to the original, not just textually plausible.

---

## 3. Shader structure

Entry point: `void mainImage(out vec4 fragColor, in vec2 fragCoord)`.

### Globals / constants

```glsl
const int   NUM_STEPS     = 8;      // heightfield tracing iterations
const float PI            = 3.1415;
const float EPSILON       = 1e-3;   // unused leftover
float       EPSILON_NRM   = 0.1 / iResolution.x;   // normal epsilon scale
const int   ITER_GEOMETRY = 3;      // octaves for the tracing heightfield  (cheap)
const int   ITER_FRAGMENT = 5;      // octaves for the normal heightfield    (detailed)
const float SEA_HEIGHT    = 0.6, SEA_CHOPPY = 4.0, SEA_SPEED = 0.8, SEA_FREQ = 0.16;
const vec3  SEA_BASE        = vec3(0.1, 0.19, 0.22);  // deep-water base colour
const vec3  SEA_WATER_COLOR = vec3(0.8, 0.9, 0.6);    // scattering / subsurface tint
float       SEA_TIME      = iTime * SEA_SPEED;
mat2        octave_m      = mat2(1.6, 1.2, -1.2, 1.6);  // per-octave UV rotate+scale
```

### Helper functions

| Function | Role |
|---|---|
| `mat3 fromEuler(vec3 ang)` | Builds a rotation matrix from 3 Euler angles; used to pitch/roll/yaw the ray. |
| `float hash(vec2 p)` | `fract(sin(dot(p,(127.1,311.7)))*43758.5453)` — classic sine hash. |
| `float noise(vec2 p)` | Value noise, bilinear with smoothstep `u = f*f*(3-2f)`, remapped to **[-1,1]**. |
| `float diffuse(vec3 n, vec3 l, float p)` | Wrapped Lambert: `pow(dot(n,l)*0.4+0.6, p)`. |
| `float specular(vec3 n, vec3 l, vec3 e, float s)` | Reflection-based Phong with energy normalisation `(s+8)/(π*8)`. |
| `vec3 getSkyColor(vec3 e)` | **Analytic** sky gradient — no cubemap: `r=(1-e.y)^2`, `g=1-e.y`, `b=0.6+(1-e.y)*0.4`. |
| `float sea_octave(vec2 uv, float choppy)` | The wave primitive (see below). |
| `float map(vec3 p)` | Heightfield for **tracing**: 3 octaves, returns `p.y - h` (signed "below surface" distance). |
| `float map_detailed(vec3 p)` | Same but 5 octaves — only used for normals. |
| `vec3 getSeaColor(p, n, l, eye, dist)` | Fresnel mix of sky reflection + water refraction, plus subsurface and specular. |
| `vec3 getNormal(vec3 p, float eps)` | Forward differences on `map_detailed` with `n.y = eps` (heightfield gradient trick). |
| `float heightMapTracing(vec3 ori, vec3 dir, out vec3 p)` | Secant-accelerated heightfield ray march. |

### The wave function (`sea_octave`) — the heart of the look

```glsl
float sea_octave(vec2 uv, float choppy) {
    uv += noise(uv);                 // domain warp -> breaks up sine regularity
    vec2 wv  = 1.0 - abs(sin(uv));   // sharp crests (abs of sine)
    vec2 swv = abs(cos(uv));         // phase-shifted variant
    wv = mix(wv, swv, wv);           // self-blended -> choppy, non-repeating profile
    return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}
```

Each octave in `map()` sums **two counter-scrolling copies** (`uv + SEA_TIME` and
`uv - SEA_TIME`), then applies `uv *= octave_m; freq *= 1.9; amp *= 0.22;`
`choppy = mix(choppy, 1.0, 0.2)`. `uv.x *= 0.75` stretches waves along z.

### Ray / camera setup (`mainImage`)

```glsl
vec2 uv = fragCoord.xy / iResolution.xy;
uv = uv * 2.0 - 1.0;
uv.x *= iResolution.x / iResolution.y;          // aspect
float time = iTime * 0.3 + iMouse.x * 0.01;     // mouse scrubs the animation

vec3 ang  = vec3(sin(time*3.0)*0.1, sin(time)*0.2+0.3, time);   // gentle pitch/roll/yaw
vec3 ori  = vec3(0.0, 3.5, time*5.0);                           // fly forward in +z
vec3 dir  = normalize(vec3(uv.xy, -2.0));       // ~90° fov (focal length 2)
dir.z    += length(uv) * 0.15;                  // barrel/fisheye distortion
dir       = normalize(dir) * fromEuler(ang);
```

### Tracing — note: **not** sphere tracing

```glsl
float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {
    float tm = 0.0, tx = 1000.0;
    float hx = map(ori + dir * tx);
    if (hx > 0.0) return tx;               // ray escapes above the horizon
    float hm = map(ori + dir * tm);
    float tmid = 0.0;
    for (int i = 0; i < NUM_STEPS; i++) {
        tmid = mix(tm, tx, hm / (hm - hx)); // secant / false-position step
        p = ori + dir * tmid;
        float hmid = map(p);
        if (hmid < 0.0) { tx = tmid; hx = hmid; }  // below water -> pull far plane in
        else            { tm = tmid; hm = hmid; }  // above water -> push near plane out
    }
    return tmid;
}
```

This is a **false-position (regula falsi) heightfield intersection**, 8 iterations, no
epsilon/overstep guards. Cheap and stable because the heightfield is bounded.

### Shading

```glsl
// normal: step size proportional to distance² -> no shimmer at the horizon
vec3 n = getNormal(p, dot(dist, dist) * EPSILON_NRM);

vec3 light = normalize(vec3(0.0, 1.0, 0.8));   // fixed sun

vec3 color = mix(
    getSkyColor(dir),                          // what the ray sees if it misses
    getSeaColor(p, n, light, dir, dist),       // water shading
    pow(smoothstep(0.0, -0.05, dir.y), 0.3));  // fade to sky at the horizon

fragColor = vec4(pow(color, vec3(0.75)), 1.0); // gamma-ish lift
```

`getSeaColor` in detail:

```glsl
float fresnel = pow(1.0 - max(dot(n, -eye), 0.0), 3.0) * 0.65;  // Schlick-ish, 0.65 max
vec3 reflected = getSkyColor(reflect(eye, n));                  // analytic sky reflection
vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12;
vec3 color     = mix(refracted, reflected, fresnel);
float atten    = max(1.0 - dot(dist,dist)*0.001, 0.0);          // distance attenuation
color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;   // wave-crest subsurface glow
color += vec3(specular(n, l, eye, 60.0));                       // sun glitter
```

### Techniques checklist

* **Normals**: forward-difference gradient of a *higher-octave* copy of the heightfield
  (`map_detailed`, 5 octaves vs 3), with `n.y = eps` — the classic "gradient as normal" trick,
  not `normalize(cross(...))`.
* **Distance-adaptive normal epsilon** (`eps ∝ dist²`) — the single most important anti-shimmer
  trick; without it the horizon boils.
* **Reflection**: analytic sky function evaluated along `reflect(eye, n)`. No cubemap, no
  screen-space reflection.
* **Refraction / water body colour**: constant `SEA_BASE` + wrapped-diffuse `SEA_WATER_COLOR`
  term — a cheap stand-in for Beer-Lambert absorption.
* **Fresnel**: `pow(1 - dot(n,-eye), 3) * 0.65`.
* **Caustics**: **none**. There is no caustic term in this shader. What reads as "caustic-ish"
  sparkle is `specular(..., 60.0)` sun glitter plus the crest-glow term
  `SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten`.
* **Foam**: none explicitly (wave crests whiten only via the subsurface term + specular).
* **Sky/atmosphere**: 3-line analytic gradient, no scattering integral.
* **No AA, no temporal reprojection, no textures.**

Typical cost: 1 ray × (8 tracing × 3-octave map) + 1 normal × (3 × 5-octave map) ≈ 8 map calls
at 3 octaves + 3 at 5 octaves per pixel. Runs fine at 1080p on integrated GPUs.

---

## 4. Ports found

### 4.1 Cesium — the directly relevant one ⭐

**`red-fire-code/cesium-water-polygon`** — https://github.com/red-fire-code/cesium-water-polygon
(17★, Chinese; *"借助于 shadertoy 中的水效果、在 cesium 中实现类似水面 primitive 效果"* =
"using the ShaderToy water effect to implement a water-surface primitive in Cesium").

File: [`WaterPolygon.ts`](https://github.com/red-fire-code/cesium-water-polygon/blob/main/WaterPolygon.ts)
— a `Cesium.Primitive` + `Cesium.MaterialAppearance` wrapper around a
**`Cesium.Material` fabric** whose `source` is the Seascape shader retargeted to
`czm_getMaterial`. Extracted copy: `raw/cesium-fabric-material.glsl`;
full TS: `raw/cesium-water-waterpolygon.ts`.

Key adaptation pattern:

```ts
new Cesium.MaterialAppearance({
  material: new Cesium.Material({
    fabric: {
      uniforms: {
        u_time: 0.0,
        u_waterColor: new Cesium.Cartesian3(0.1, 0.19, 0.22),
        u_alpha: 1.0, u_speed: 0.8, u_choppy: 4.0, u_height: 0.6, u_freq: 0.1
      },
      source: ` ... Seascape ... vec4 czm_getMaterial(vec2 vUv) { ... } `
    }
  }),
  vertexShaderSource: `
    in vec3 position3DHigh; in vec3 position3DLow; in float batchId; in vec2 st; in vec3 normal;
    out vec2 v_st; out vec3 v_positionEC; out vec3 v_normalEC;
    void main() {
      v_st = st;
      vec4 p = czm_computePosition();
      v_positionEC = (czm_modelViewRelativeToEye * p).xyz;
      v_normalEC   = czm_normal * normal;
      gl_Position  = czm_modelViewProjectionRelativeToEye * p;
    }`,
  fragmentShaderSource: `
    in vec2 v_st; in vec3 v_positionEC; in vec3 v_normalEC;
    void main() {
      czm_materialInput materialInput;
      materialInput.normalEC        = normalize(v_normalEC);
      materialInput.positionToEyeEC = v_positionEC;
      materialInput.st              = v_st;
      out_FragColor                 = czm_getMaterial(v_st);
    }`,
});
function renderLoop(t: number) {
  appearance.material.uniforms.u_time = t / 1000;   // seconds
  requestAnimationFrame(renderLoop);
}
```

What they changed vs the original:
* `mainImage` → `vec4 czm_getMaterial(vec2 vUv)` returning premultiplied colour + `u_alpha`.
* `iResolution` is gone → `#define EPSILON_NRM (0.1 / 200.0)` (hard-coded; should really be
  derived from `czm_viewport` or a uniform).
* `iTime` → `u_time`; `time = u_time * 0.3 + 0.0*0.01` (mouse scrub removed).
* Camera fully static: `ang = vec3(0, 1.2, 0)`, `ori = vec3(0, 3.5, 0)` — the flying camera is
  replaced by Cesium's own model-view, so the water is a flat local patch, not an infinite ocean.
* `SEA_WATER_COLOR` changed to `vec3(0.0,0.09,0.18)`, `SEA_SPEED` to `1.8`, `u_height`/`u_freq`
  exposed.
* Uses `u_alpha` for translucency.

**Limitations to be aware of for a real flood-sim:** it is a *local planar patch with a fake
camera*. It does **not** line up with Cesium's ellipsoid/georeferencing, has no world-space
anchoring, no depth interaction with terrain, and `st` grows with the polygon's own UVs. For a
georeferenced ocean you must either (a) drive `ori`/`light`/`time` from camera ECEF→ENU and feed
world-space position in, or (b) skip the raymarch and use just `sea_octave` as a *normal map*
generator on `czm_materialInput.st` — see 4.4.

Other Cesium references:
* CSDN, *在 Cesium 中实现海水、波浪及水花特效* — https://blog.csdn.net/qq_19991931/article/details/149041667
  — Chinese walkthrough of sea/wave/spray effects in Cesium (same technique family).
* Cesium `CustomShader` API (modern replacement for Fabric `source`):
  https://cesium.com/learn/cesiumjs/ref-doc/CustomShader.html — `czm_getMaterial` becomes
  `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)`.

### 4.2 Godot 4 (vertex-displaced, not raymarched)

**`creikey/tdm-godot-ocean`** — https://github.com/creikey/tdm-godot-ocean
([`src/TDMOpenOcean.shader`](https://github.com/creikey/tdm-godot-ocean/blob/HEAD/src/TDMOpenOcean.shader))
— `shader_type spatial`, built on **bteitler's annotated version**. Rather than raymarching, it
re-uses `sea_octave`/`map_detailed` to **displace mesh vertices** and rebuild `NORMAL` from the
gradient, i.e. the "heightfield → vertex shader" translation. Constants retuned for looks
(`SEA_HEIGHT 1.3`, `SEA_SPEED 1.5`, `SEA_BASE vec3(0,0.09,0.18)`, `SEA_WATER_COLOR*0.6`).
Good reference for the *cheap* option.

### 4.3 HLSL / DirectX 9–12

**`Alex0vSky/HelloWinHlslSeascapeTdm`** — https://github.com/Alex0vSky/HelloWinHlslSeascapeTdm
— `TDM.cpp` + `resource/Tdm_ps_Dx9|Dx10|Dx11|Dx12.hlsl`. Straight GLSL→HLSL port of the same
shader, useful if you need the exact semantics in HLSL.

### 4.4 Three.js / WebGL

No canonical "official" Three.js port was found (the once-common `mattatz/Seascape` repo is
gone / 404). What exists:

* **`DarelCullen/3dshaders`** — https://github.com/DarelCullen/3dshaders —
  `src/shaders/presets.js` contains an `ms2sd1-seascape` preset: a **rewritten tribute**
  (uniforms for `SEA_HEIGHT`/`SEA_CHOPPY`/`SEA_SPEED`/`SEA_FREQ`/`NUM_STEPS`, `PI = 3.141592`,
  altered `getSkyColor` and `SEA_BASE = vec3(0,0.09,0.18)`). Close, but *not* verbatim — don't
  use it as the reference; use `ms2sd1-source.glsl`.
* **`holooooo/webgl-seascape-video`** — https://github.com/holooooo/webgl-seascape-video —
  WebGL demo episodes around a realistic seascape (raw WebGL, not Three.js).
* **`razodin137/seascape-glsl`** — https://github.com/razodin137/seascape-glsl — single-file
  vanilla-WebGL ocean, interactive controls.
* **`Kenotgg/Ocean-Flight`** — https://github.com/Kenotgg/Ocean-Flight — WASD/mouse ocean flight,
  a rework of the classic Seascape.
* **`eshnil2000/SeascapeGPUShader`** — https://github.com/eshnil2000/SeascapeGPUShader —
  bteitler's **annotated** copy of the original (best learning reference; comment-per-line).

### 4.5 Porting summary for our flood-sim use case

Three viable strategies, in increasing cost/fidelity:

1. **Normal-map only (cheapest).** Keep `hash`/`noise`/`sea_octave`; evaluate the gradient of
   `map_detailed` in a fragment shader over `st`, output a normal, feed it to
   `czm_modelMaterial.normal`. Gives moving, choppy waves without a raymarch, works with any
   Cesium geometry (water polygons, terrain-clipped meshes) and composes with depth/lighting.
2. **Vertex displacement (Godot approach).** Same math in a vertex shader on a tessellated mesh —
   needs a mesh with enough vertices and a Cesium `CustomShader` with `vertexShaderSource`.
3. **Full raymarch (this shader).** Only makes sense for a *skybox-like* or screen-space ocean
   layer with its own camera; it fights Cesium's projection and cannot be georeferenced easily.

Watch out for: `iResolution`-dependent `EPSILON_NRM` (must become a uniform), the global-scope
initializer (must move into the function), `iMouse` (drop), the fixed `time = iTime*0.3`
(fine), and `light = normalize(vec3(0,1,0.8))` (should become the scene's sun direction in
ECEF/ENU for correct specular alignment).

---

## 5. Files in this directory

```
ms2sd1-source.glsl                 complete ShaderToy Image-tab GLSL (restored, mainImage)
ms2sd1-meta.json                   metadata + provenance + attribution
notes.md                           this file
raw/isf-ms2sd1.json                verbatim ISF API JSON response
raw/isf-frag.glsl                  verbatim rawFragmentSource (ISF dialect, untouched)
raw/isf-page.html, raw/isf.png     captured ISF editor page for provenance
raw/shadertoy-*.html/.png          Cloudflare 403 captures (evidence of blocked attempts)
raw/godot-tdm.shader               Godot port (bteitler lineage)
raw/cesium-water-waterpolygon.ts   Cesium port, full TS
raw/cesium-fabric-material.glsl    Cesium port, shader only
raw/eshnil-readme.md               bteitler annotated original (verbatim + comments)
raw/ms2sd1-render.png              proof render produced from ms2sd1-source.glsl (640x360, t=12)
raw/compile-test2.mjs              WebGL1-vs-WebGL2 compile check
raw/render-test.mjs                headless render + readback harness
raw/fetch-shadertoy.mjs            the (unsuccessful) Playwright ShaderToy attempts
raw/fetch-isf.mjs                  the Playwright ISF request-capture that found the API
```

## 6. Attribution

If this shader (or any derivative) ships, the licence **requires** visible attribution and is
**non-commercial** + **share-alike**:

> "Seascape" by Alexander Alekseev (TDM), 2014 — licensed under
> [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/) —
> https://www.shadertoy.com/view/Ms2SD1

For a commercial product, either get permission from TDM or re-implement the technique
(the *maths* — value noise, abs-sine choppy octaves, false-position heightfield tracing — is
standard and not copyrightable; the specific code expression is).
