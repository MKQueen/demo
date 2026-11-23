// Asset loader for the reverse-engineered Messenger assets.
//
// Geometry: the original .drc files are Draco files created by the site's own
// tooling. They embed a plain-text `info` metadata entry that lists every
// attribute name + type, and their custom worker decodes *all* attributes
// (not just position/normal/uv). We reuse their dracoworker.js (patched to
// resolve the libs path for our /assets-messenger/ folder).
//
// Textures: the site ships KTX2 (Basis) textures. We use three's KTX2Loader
// with the site's own basis transcoder wasm. A tiny mode map reproduces the
// original loader's colorSpace / filter / wrap combinations.
//
// The 3D LUT is a 32x32x32 RGBA8 KTX2 that three transcodes to raw RGBA; we
// rebuild it as a THREE.Data3DTexture for the outline/grading pass.

import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const ASSET_BASE = new URL('./assets-messenger/', document.baseURI).href;

// Attribute types used by the site's `info` metadata entry:
// index into their TAB = [Int8,Uint8,Uint8Clamped,Int16,Uint16,Int32,Uint32,Float32,Float64]
const TYPE_TABLE = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];

let __worker = null;
let __taskId = 0;
const __pending = new Map();

function getDracoWorker() {
  if (__worker) return __worker;
  __worker = new Worker(new URL('./assets-messenger/dracoworker.js', document.baseURI), { type: 'module' });
  __worker.onmessage = (e) => {
    const { id, geometry, error } = e.data || {};
    const task = __pending.get(id);
    if (!task) return;
    __pending.delete(id);
    if (error || !geometry) task.reject(new Error('draco decode failed'));
    else task.resolve(geometry);
  };
  __worker.onerror = (err) => {
    for (const task of __pending.values()) task.reject(new Error('draco worker error: ' + err.message));
    __pending.clear();
  };
  return __worker;
}

function decodeDraco(buffer, path) {
  return new Promise((resolve, reject) => {
    const id = ++__taskId;
    __pending.set(id, { resolve, reject });
    getDracoWorker().postMessage({ id, url: new URL(path, ASSET_BASE).href, buffer }, [buffer]);
  });
}

export function geometryFromDecoded(data) {
  const geometry = new THREE.BufferGeometry();
  if (data.index) {
    const a = data.index.array;
    geometry.setIndex(new THREE.BufferAttribute(a.constructor === Uint32Array ? a : new Uint32Array(a), 1));
  }
  for (const attr of data.attributes) {
    let array = attr.array;
    let normalized = false;
    // The site's shaders bind these tiny id attributes as normalized floats.
    if (array instanceof Uint8Array || array instanceof Int8Array) {
      // keep original type: the material declares int/float variants explicitly.
      normalized = false;
    }
    geometry.setAttribute(attr.name, new THREE.BufferAttribute(array, attr.itemSize, normalized));
  }
  if (data.userData && Object.keys(data.userData).length) geometry.userData = data.userData;
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

const TEXTURE_MODES = {
  'srgb-nearest': { colorSpace: THREE.SRGBColorSpace, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, wrap: THREE.ClampToEdgeWrapping },
  'srgb-repeat': { colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrap: THREE.RepeatWrapping },
  'repeat': { colorSpace: THREE.SRGBColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrap: THREE.RepeatWrapping },
  'linearfilter-repeat': { colorSpace: THREE.NoColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrap: THREE.RepeatWrapping },
  'linearfilter': { colorSpace: THREE.NoColorSpace, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, wrap: THREE.ClampToEdgeWrapping },
};

export function createAssets(renderer) {
  const ktx2 = new KTX2Loader()
    .setTranscoderPath(new URL('libs/basis/', ASSET_BASE).href)
    .detectSupport(renderer);

  const audioCtx = { ctx: null };
  function ensureAudio() {
    if (!audioCtx.ctx) audioCtx.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx.ctx;
  }

  const textureCache = new Map();
  const geometryCache = new Map();

  function loadTexture(path, mode = 'srgb-nearest') {
    const key = path + '|' + mode;
    if (textureCache.has(key)) return textureCache.get(key);
    const promise = new Promise((resolve, reject) => {
      ktx2.load(new URL(path, ASSET_BASE).href, (tex) => {
        const m = TEXTURE_MODES[mode] || TEXTURE_MODES['srgb-nearest'];
        if (tex.isCompressedTexture) {
          tex.colorSpace = m.colorSpace;
          tex.magFilter = m.magFilter;
          tex.minFilter = m.minFilter;
          tex.wrapS = tex.wrapT = m.wrap;
          tex.generateMipmaps = false;
          tex.needsUpdate = true;
          resolve(tex);
          return;
        }
        resolve(tex);
      }, undefined, reject);
    }).catch((err) => {
      // PNG fallback (some assets are plain PNG)
      const tex = new THREE.TextureLoader().load(new URL(path, ASSET_BASE).href);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      return tex;
    });
    textureCache.set(key, promise);
    return promise;
  }

  // Decode the 32^3 grading LUT. KTX2Loader has already turned it into a
  // Data3DTexture (either RGBA8 or RGBA16F depending on the decoder backend);
  // the original site samples it with nearest filtering and does its own
  // tetrahedral interpolation in the outline shader.
  async function loadLUT(path = 'images/lut.ktx2') {
    const tex = await new Promise((resolve, reject) => {
      ktx2.load(new URL(path, ASSET_BASE).href, resolve, undefined, reject);
    });
    const mm = tex.mipmaps && tex.mipmaps[0];
    if (!mm || !mm.data) return null;
    const data = mm.data;
    const width = mm.width || tex.image?.width || 32;
    const height = mm.height || tex.image?.height || 32;
    const depth = mm.depth || tex.image?.depth || 32;
    const expected = width * height * depth * 4;
    if (data.length !== expected) return null;
    const tex3d = new THREE.Data3DTexture(data, width, height, depth);
    tex3d.format = tex.format || THREE.RGBAFormat;
    tex3d.type = tex.type || THREE.UnsignedByteType;
    tex3d.colorSpace = THREE.NoColorSpace;
    tex3d.minFilter = THREE.NearestFilter;
    tex3d.magFilter = THREE.NearestFilter;
    tex3d.wrapS = tex3d.wrapT = tex3d.wrapR = THREE.ClampToEdgeWrapping;
    tex3d.unpackAlignment = 1;
    tex3d.needsUpdate = true;
    return tex3d;
  }

  function loadGeometry(path) {
    if (geometryCache.has(path)) return geometryCache.get(path);
    const promise = fetch(new URL(path, ASSET_BASE).href)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch ' + path);
        return r.arrayBuffer();
      })
      .then((buffer) => decodeDraco(buffer, path))
      .then((data) => geometryFromDecoded(data));
    geometryCache.set(path, promise);
    return promise;
  }

  function loadJSON(path) {
    return fetch(new URL(path, ASSET_BASE).href).then((r) => r.json());
  }

  async function loadAudio(path) {
    const ctx = ensureAudio();
    const data = await fetch(new URL(path, ASSET_BASE).href).then((r) => r.arrayBuffer());
    return ctx.decodeAudioData(data.slice(0));
  }

  return {
    base: ASSET_BASE,
    renderer,
    audioContext: ensureAudio,
    loadTexture,
    loadLUT,
    loadGeometry,
    loadJSON,
    loadAudio,
    THREE,
    TYPE_TABLE,
  };
}
