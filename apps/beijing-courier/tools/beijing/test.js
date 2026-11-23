// Beijing asset harness page. Renders the procedural Beijing asset pack on the
// real planet (same assets / materials / MRT pipeline / LUT as the game) so the
// pack can be verified without the game loop. Also exposes terrain probing
// helpers used while choosing the district placement.
//
// Query parameters:
//   mode     = gallery | scene | probe        (default: gallery)
//   district = hutong | axis | cbd | wall      (scene mode: which district view)
//   view     = street | aerial | gate ...      (district-defined viewpoint id)
//   cam      = x,y,z                           (explicit world camera position)
//   target   = x,y,z                           (explicit world look-at point)
//   fov      = number                          (default 50)
//   labels   = 1                               (show landmark labels)
//   freeze   = 1                               (freeze animation time)
//
// window.__app exposes the scene, camera, landmarks, district frames and terrain
// helpers; tools/beijing/shots.mjs drives it with Playwright.
import * as THREE from 'three';
import { createAssets } from '/src/assets.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') || 'gallery';
const WANT_LABELS = params.get('labels') === '1';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const statusEl = $('status');
const subtitleEl = $('subtitle');
const overlay = $('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const assets = createAssets(renderer);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#000000');
const camera = new THREE.PerspectiveCamera(Number(params.get('fov')) || 50, window.innerWidth / window.innerHeight, 0.2, 175);

// ---------------------------------------------------------------- lighting
// Mirrors src/main.js so the pack is seen under the exact game lighting.
const sunDir = new THREE.Vector3(-0.416, 0.809, 0.416).normalize();
const sun = new THREE.DirectionalLight('#ffffff', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 210;
sun.shadow.bias = -0.0001;
sun.shadow.normalBias = 0.07;
sun.position.copy(sunDir).multiplyScalar(100);
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight('#25577c', '#2f2f2f', 0.7));

// ---------------------------------------------------------------- render layer
let env = null;
let materialsLayer = null;
let pipeline = null;
let world = null;
let beijing = null;
let sky = null;
let materialLayerError = null;

async function setupRenderLayer() {
  const [{ createEnvironmentMaterials }, { createPipeline }] = await Promise.all([
    import('/src/render/environment.js'),
    import('/src/render/pipeline.js'),
  ]);
  env = createEnvironmentMaterials({ assets });
  await env.ready;
  sky = env.sky();
  scene.add(sky.mesh);
  pipeline = createPipeline(renderer);
  const lut = await assets.loadLUT();
  if (lut) pipeline.setLUT(lut);
  pipeline.uniforms.uLUTIntensity.value = lut ? 1 : 0;
  pipeline.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
  env.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());

  if (MODE === 'scene' || MODE === 'probe') {
    const { createMaterials } = await import('/src/render/materials.js');
    materialsLayer = createMaterials({ assets });
    try {
      await (typeof materialsLayer.ready === 'function' ? materialsLayer.ready() : materialsLayer.ready);
    } catch (error) {
      console.warn('[beijing-test] materials.ready failed', error);
    }
  }
}

// ---------------------------------------------------------------- planet
async function setupPlanet() {
  const { buildPlanet } = await import('/src/world/planet.js');
  world = await buildPlanet({ assets, materials: materialsLayer, env, scene });
  return world;
}

// ---------------------------------------------------------------- beijing
async function setupBeijing() {
  const module = await import('/src/world/beijing.js');
  const group = new THREE.Group();
  group.name = 'beijing-harness';
  scene.add(group);
  beijing = module.buildBeijing({ scene, collision: world.collision, spots: world.spots, group });
  if (beijing.ready) await beijing.ready;
  return beijing;
}

// ---------------------------------------------------------------- gallery ground
function galleryGround() {
  const { createToonMaterial } = importCache.toon;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 0.5, 64), createToonMaterial({ color: '#9fb59a', flatShading: false }));
  disc.position.y = -0.25;
  disc.receiveShadow = true;
  scene.add(disc);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(16.4, 16.4, 0.55, 64), createToonMaterial({ color: '#7d927c', flatShading: false }));
  rim.position.y = -0.35;
  scene.add(rim);
}

const importCache = { toon: null };

// ---------------------------------------------------------------- labels
const labels = [];
function addLabel(text, worldPos) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  overlay.appendChild(el);
  labels.push({ el, world: worldPos.clone() });
}
function projectLabels() {
  for (const entry of labels) {
    const p = entry.world.clone().project(camera);
    if (p.z > 1) { entry.el.style.display = 'none'; continue; }
    entry.el.style.display = '';
    entry.el.style.left = `${((p.x * 0.5 + 0.5) * window.innerWidth).toFixed(1)}px`;
    entry.el.style.top = `${((-p.y * 0.5 + 0.5) * window.innerHeight + 10).toFixed(1)}px`;
  }
}

// ---------------------------------------------------------------- camera helpers
const UP = new THREE.Vector3(0, 1, 0);

function districtById(id) {
  return beijing?.districts?.find((d) => d.id === id) || beijing?.districts?.[0] || null;
}

function frameOf(district) {
  const up = new THREE.Vector3(...district.up).normalize();
  const right = new THREE.Vector3(...district.right).normalize();
  const forward = new THREE.Vector3(...district.forward).normalize();
  return { up, right, forward };
}

function localToWorld(district, local) {
  const { up, right, forward } = frameOf(district);
  const origin = new THREE.Vector3(...district.origin);
  return origin.clone()
    .addScaledVector(right, local[0] ?? 0)
    .addScaledVector(up, local[1] ?? 0)
    .addScaledVector(forward, local[2] ?? 0);
}

function setCamera({ position, target, fov, up }) {
  if (up) camera.up.set(...up).normalize();
  if (position) camera.position.set(...position);
  if (target) camera.lookAt(new THREE.Vector3(...target));
  if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  renderOnce();
}

function applyView(districtId, viewId) {
  const district = districtById(districtId);
  if (!district) return null;
  const views = district.views || [];
  const view = views.find((v) => v.id === viewId) || views[0];
  if (!view) return null;
  const top = view.flat === false ? 0 : (district.terraceTop || 0);
  const position = localToWorld(district, [view.position[0], view.position[1] + top, view.position[2]]);
  const target = localToWorld(district, [view.target[0], view.target[1] + top, view.target[2]]);
  camera.fov = view.fov || 50;
  camera.updateProjectionMatrix();
  if (view.up === 'forward') camera.up.set(...district.forward).normalize();
  else if (view.up === 'right') camera.up.set(...district.right).normalize();
  else camera.up.set(...district.up).normalize();
  camera.position.copy(position);
  camera.lookAt(target);
  subtitleEl.textContent = `${district.name} · ${view.title || view.id}`;
  window.__lastView = { districtId, viewId: view.id, position: position.toArray(), target: target.toArray() };
  renderOnce();
  return window.__lastView;
}

// ---------------------------------------------------------------- terrain probes
function probeGrid({ center, size = 6, steps = 17, height = 80 }) {
  const up = new THREE.Vector3(...center).normalize();
  const right = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x);
  if (right.lengthSq() < 1e-4) right.set(0, 0, 1).addScaledVector(up, -up.z);
  right.normalize();
  const forward = new THREE.Vector3().crossVectors(up, right).normalize();
  const R = up.clone().multiplyScalar(27).length(); // rough planet radius for angle conversion
  const rows = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < steps; i += 1) {
    const row = [];
    for (let j = 0; j < steps; j += 1) {
      const x = ((i / (steps - 1)) - 0.5) * 2 * size;
      const z = ((j / (steps - 1)) - 0.5) * 2 * size;
      const dir = up.clone().addScaledVector(right, x / R).addScaledVector(forward, z / R).normalize();
      const hit = world?.collision?.groundAtDirection(dir);
      const h = hit ? hit.point.dot(up) : null;
      if (h != null) { min = Math.min(min, h); max = Math.max(max, h); }
      row.push(h == null ? null : +h.toFixed(3));
    }
    rows.push(row);
  }
  return { center, up: up.toArray(), right: right.toArray(), forward: forward.toArray(), size, steps, min, max, relief: +(max - min).toFixed(3), rows };
}

function groundAt(normalArray) {
  const n = new THREE.Vector3(...normalArray).normalize();
  const hit = world?.collision?.groundAtDirection(n);
  if (!hit) return null;
  return { point: hit.point.toArray(), normal: hit.normal.toArray(), radius: hit.point.length() };
}


/** Classify the top-down view and return large, smooth patches of a land class.
 *  Green = grass/lawn, grey = stone/pavement, tan = dirt/sand. */
function scanLand({ center, distance = 30, fov = 55, step = 4, top = 8, minArea = 220 }) {
  const up = new THREE.Vector3(...center).normalize();
  const ground = groundAt(up.toArray());
  if (!ground) return { error: 'no ground' };
  const ref = Math.abs(up.y) > 0.95 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(ref, up).normalize();
  const forward = new THREE.Vector3().crossVectors(up, right).normalize();
  camera.up.copy(forward);
  camera.position.copy(new THREE.Vector3(...ground.point)).addScaledVector(up, distance);
  camera.lookAt(new THREE.Vector3(...ground.point));
  camera.fov = fov;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  renderOnce();

  const gl = renderer.domElement;
  const w = gl.width;
  const h = gl.height;
  const buffer = document.createElement('canvas');
  buffer.width = w;
  buffer.height = h;
  const ctx = buffer.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(gl, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;
  const gw = Math.floor(w / step);
  const gh = Math.floor(h / step);
  const mask = new Uint8Array(gw * gh); // 1 grass, 2 grey, 3 tan, 0 other
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const px = gx * step + (step >> 1);
      const py = gy * step + (step >> 1);
      const i = (py * w + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let cls = 0;
      if (g > 70 && g > r * 1.1 && g > b * 1.03 && b < g * 0.97) cls = 1;
      else if (Math.abs(r - g) < 16 && Math.abs(g - b) < 22 && g > 90) cls = 2;
      else if (r > g * 1.06 && g > b * 1.02 && r > 110) cls = 3;
      mask[gy * gw + gx] = cls;
    }
  }

  const visited = new Uint8Array(gw * gh);
  const components = [];
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const id = gy * gw + gx;
      if (!mask[id] || visited[id]) continue;
      const cls = mask[id];
      const stack = [[gx, gy]];
      visited[id] = 1;
      const cells = [];
      let minX = gx; let maxX = gx; let minY = gy; let maxY = gy;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const nid = ny * gw + nx;
          if (mask[nid] === cls && !visited[nid]) { visited[nid] = 1; stack.push([nx, ny]); }
        }
      }
      if (cells.length < minArea) continue;
      components.push({ cls, cells, minX, maxX, minY, maxY, area: cells.length });
    }
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const results = [];
  for (const comp of components.slice(0, 40)) {
    let sumX = 0; let sumY = 0;
    for (const [cx, cy] of comp.cells) { sumX += cx; sumY += cy; }
    const centroidX = sumX / comp.cells.length;
    const centroidY = sumY / comp.cells.length;
    const picked = [];
    const want = 14;
    for (let i = 0; i < want; i += 1) {
      const cell = comp.cells[Math.floor((i / want) * comp.cells.length)];
      const px = cell[0] * step + (step >> 1);
      const py = cell[1] * step + (step >> 1);
      ndc.set((px / w) * 2 - 1, -(py / h) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = world?.collision?.raycast(camera.position, raycaster.ray.direction, 260);
      if (!hit) continue;
      picked.push({ px, py, point: hit.point.clone(), radius: hit.point.length(), normal: hit.normal.clone() });
    }
    if (picked.length < 6) continue;
    const radii = picked.map((p) => p.radius).sort((a, b) => a - b);
    const median = radii[Math.floor(radii.length / 2)];
    const smooth = picked.filter((p) => Math.abs(p.radius - median) < 0.75).length / picked.length;
    // direction of the component centre
    const cpx = centroidX * step + (step >> 1);
    const cpy = centroidY * step + (step >> 1);
    ndc.set((cpx / w) * 2 - 1, -(cpy / h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const centreHit = world?.collision?.raycast(camera.position, raycaster.ray.direction, 260);
    const dir = centreHit ? centreHit.point.clone().normalize() : new THREE.Vector3(...center).normalize();
    results.push({
      cls: comp.cls,
      area: comp.area,
      bbox: [comp.minX, comp.minY, comp.maxX, comp.maxY],
      centroidPx: [cpx, cpy],
      smooth: +smooth.toFixed(2),
      meanRadius: +median.toFixed(2),
      spread: +(radii[radii.length - 1] - radii[0]).toFixed(2),
      dir: dir.toArray().map((v) => +v.toFixed(4)),
      point: centreHit ? centreHit.point.toArray().map((v) => +v.toFixed(2)) : null,
    });
  }
  results.sort((a, b) => b.area * (0.3 + b.smooth) - a.area * (0.3 + a.smooth));
  return { view: { center: up.toArray(), distance, fov }, grass: results.filter((r) => r.cls === 1).slice(0, top), grey: results.filter((r) => r.cls === 2).slice(0, top), tan: results.filter((r) => r.cls === 3).slice(0, top) };
}

/** Batch raycast: one height per unit direction ("x,y,z"). Used for terrain surveys. *//** Batch raycast: one height per unit direction ("x,y,z"). Used for terrain surveys. */
function sampleDirs(dirs) {
  const out = [];
  for (const raw of dirs) {
    const n = new THREE.Vector3(...raw).normalize();
    const hit = world?.collision?.groundAtDirection(n);
    out.push(hit ? { radius: +hit.point.length().toFixed(3), normal: hit.normal.toArray().map((v) => +v.toFixed(3)) } : null);
  }
  return out;
}

// ---------------------------------------------------------------- render loop
let frozen = params.get('freeze') === '1';
let time = 0;
let last = performance.now();

function renderOnce() {
  if (pipeline) pipeline.render(scene, camera);
  else { renderer.setRenderTarget(null); renderer.clear(true, true, true); renderer.render(scene, camera); }
  projectLabels();
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!frozen) {
    time += dt;
    if (beijing?.update) beijing.update(time, dt);
    if (env) env.update(time, {});
    if (world?.update) world.update(time, dt, null);
  }
  if (sky) sky.mesh.position.copy(camera.position);
  renderOnce();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- resize
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (pipeline) pipeline.setSize(width, height, renderer.getPixelRatio());
  if (env) env.setSize(width, height, renderer.getPixelRatio());
}
window.addEventListener('resize', onResize);

/** Screen pixel (CSS px) -> ground direction via collision raycast. */
function pick(px, py) {
  const ndc = new THREE.Vector2((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hit = world?.collision?.raycast(camera.position, raycaster.ray.direction, 400);
  if (!hit) return null;
  return {
    point: hit.point.toArray().map((v) => +v.toFixed(3)),
    normal: hit.normal.toArray().map((v) => +v.toFixed(3)),
    dir: hit.point.clone().normalize().toArray().map((v) => +v.toFixed(4)),
    radius: +hit.point.length().toFixed(3),
  };
}

/** Turn distance fog off (recon maps only). */
function setFog(enabled) {
  const value = enabled ? null : 0;
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material?.uniforms) continue;
      if (material.uniforms.uFogDensity && value !== null) material.uniforms.uFogDensity.value = value;
    }
  });
}

function sceneStats() {
  let draws = 0;
  let triangles = 0;
  let shadowCasters = 0;
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.visible) return;
    draws += 1;
    if (obj.castShadow) shadowCasters += 1;
    const geometry = obj.geometry;
    if (!geometry) return;
    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');
    if (index) triangles += index.count / 3;
    else if (position) triangles += position.count / 3;
  });
  return { draws, triangles: Math.round(triangles), shadowCasters };
}

// ---------------------------------------------------------------- boot
async function boot() {
  try {
    setStatus('render layer…');
    await setupRenderLayer();
    if (params.get('cam') && params.get('target')) {
      camera.position.set(...(params.get('cam') || '').split(',').map(Number));
    }

    if (MODE === 'gallery' || MODE === 'single') {
      setStatus('gallery…');
      importCache.toon = await import('/src/render/toon.js');
      galleryGround();
      const module = await import('/src/world/beijing.js');
      if (MODE === 'gallery') {
        const group = new THREE.Group();
        scene.add(group);
        const keysParam = params.get('keys');
        beijing = module.buildBeijingAssetGallery({ scene, group, keys: keysParam ? keysParam.split(',') : null });
        if (beijing.ready) await beijing.ready;
        if (beijing.fontsReady) await beijing.fontsReady;
        for (const item of beijing.items) {
          addLabel(item.name, item.labelPosition.clone());
        }
        camera.position.set(0, 9.5, 15.5);
        camera.lookAt(0, 0.4, 0);
        camera.updateProjectionMatrix();
        subtitleEl.textContent = `资产陈列 · ${beijing.items.length} 件`;
      } else {
        let singleRoot = null;
        let singleAsset = null;
        const setAsset = async (key) => {
          if (singleRoot) {
            scene.remove(singleRoot);
            singleRoot.traverse((obj) => {
              if (obj.isMesh) {
                obj.geometry?.dispose();
              }
            });
          }
          singleRoot = new THREE.Group();
          scene.add(singleRoot);
          singleAsset = module.buildBeijingSingleAsset({ group: singleRoot, key });
          if (singleAsset.fontsReady) await singleAsset.fontsReady;
          overlay.querySelectorAll('.label').forEach((el) => el.remove());
          labels.length = 0;
          renderOnce();
          return { key, options: singleAsset.options, info: singleAsset.info() };
        };
        window.__setAsset = setAsset;
        beijing = { districts: [], landmarks: [], items: [] };
        await setAsset(params.get('key') || 'courtyard');
        const key = params.get('key') || 'courtyard';
        camera.up.set(0, 1, 0);
        camera.position.set(5.2, 3.4, 7.6);
        camera.lookAt(0, 1.2, 0);
        camera.fov = 45;
        camera.updateProjectionMatrix();
        subtitleEl.textContent = `单体资产 · ${key}`;
      }
    } else {
      setStatus('planet…');
      await setupPlanet();
      if (MODE === 'scene') {
        setStatus('beijing…');
        await setupBeijing();
        if (beijing.fontsReady) await beijing.fontsReady;
        const district = districtById(params.get('district'));
        const viewId = params.get('view');
        if (camera.position.lengthSq() === 0 || (params.get('district') || params.get('view'))) {
          if (district) applyView(district.id, viewId);
        }
        if (params.get('cam') && params.get('target')) {
          setCamera({
            position: (params.get('cam') || '').split(',').map(Number),
            target: (params.get('target') || '').split(',').map(Number),
            fov: Number(params.get('fov')) || undefined,
          });
        }
        if (WANT_LABELS) {
          for (const lm of beijing.landmarks) addLabel(lm.name, new THREE.Vector3(...lm.point));
        }
        subtitleEl.textContent = `场景 · ${beijing.districts.length} 个片区 · ${beijing.landmarks.length} 个地标`;
      } else {
        camera.position.set(0, 42, 42);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        subtitleEl.textContent = '地形探测 · probe';
      }
    }

    renderOnce();
    requestAnimationFrame(frame);

    window.__app = {
      THREE, renderer, scene, camera, assets, world, beijing, env, pipeline,
      setAsset: (key) => (window.__setAsset ? window.__setAsset(key) : Promise.resolve(null)),
      districtById, localToWorld, applyView, setCamera, probeGrid, groundAt, sampleDirs, scanLand, pick, setFog, sceneStats,
      renderOnce,
      freeze(value = true) { frozen = Boolean(value); last = performance.now(); },
      get time() { return time; },
    };
    window.__ready = true;
    if (beijing?.info) console.log('[beijing]', JSON.stringify(beijing.info()));
  } catch (error) {
    console.error('[beijing-test] boot failed', error);
    setStatus('ERROR: ' + ((error && error.stack) || error));
    window.__error = String((error && error.stack) || error);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

boot();
