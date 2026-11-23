// Material plumbing for the actor layer.
//
// The render layer (src/render/materials.js, owned by the Lead) exposes
// `materials.character()` and `materials.npc()` factories that return a fresh
// ShaderMaterial each call. Those materials implement the original site's
// IS_CHARACTER / IS_NPC shader branches (palette atlas + eyes + mouth) and rely
// on three's standard skinning attributes.
//
// The actor modules must work before/without that layer (tests, tools), so we
// fall back to a cel-shaded material that samples the 16x16 palette atlas with
// the mesh's baked UVs. That reproduces the character colours (only the
// eye/mouth sprites are missing) without touching render ownership.
import * as THREE from 'three';

const ATLAS_PATH = 'images/atlas.png';

function isMaterial(value) {
  return Boolean(value && value.isMaterial);
}

function isMaterialLike(value) {
  return isMaterial(value) || (value && typeof value === 'object' && value.uniforms);
}

/**
 * Resolve a material from the render layer.
 * Accepts a factory (`materials.character()`), a ready-made material instance,
 * a Promise of either, or nothing (falls back to the palette material).
 */
export async function resolveActorMaterial(materials, kind, assets) {
  const source = materials && materials[kind];
  let material = null;
  if (typeof source === 'function') material = await source();
  else if (isMaterialLike(source)) material = await source;
  else if (source && typeof source.then === 'function') material = await source;

  if (isMaterialLike(material)) {
    material.name ||= `actor-${kind}`;
    return normalizeActorMaterial(material);
  }
  return createFallbackActorMaterial(assets, kind);
}

/**
 * three adds `#define USE_SKINNING` by itself for every SkinnedMesh material.
 * The ported base material currently also lists it in `defines`, which makes the
 * GLSL compiler reject the program with "macro redefined". Drop the redundant
 * entry so the actor layer can use the render material as-is.
 * (TODO: remove once src/render/materials.js stops declaring it.)
 */
function normalizeActorMaterial(material) {
  if (material.defines && Object.prototype.hasOwnProperty.call(material.defines, 'USE_SKINNING')) {
    delete material.defines.USE_SKINNING;
    material.needsUpdate = true;
  }
  return material;
}

let fallbackPalettePromise = null;

/** Load (once) the palette atlas used by every character material. */
function loadFallbackPalette(assets) {
  if (fallbackPalettePromise) return fallbackPalettePromise;
  if (!assets || typeof assets.loadTexture !== 'function') {
    fallbackPalettePromise = Promise.resolve(null);
    return fallbackPalettePromise;
  }
  fallbackPalettePromise = assets.loadTexture(ATLAS_PATH, 'srgb-nearest')
    .then((texture) => {
      if (!texture) return null;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      return texture;
    })
    .catch(() => null);
  return fallbackPalettePromise;
}

/**
 * Cel-shading stand-in used until the real character shader is wired in.
 * The accessory UVs point straight at the palette atlas, so a textured
 * MeshToonMaterial already yields the correct body/clothes colours.
 */
export async function createFallbackActorMaterial(assets, kind = 'character') {
  const map = await loadFallbackPalette(assets);
  const material = new THREE.MeshToonMaterial({
    color: 0xffffff,
    map,
    side: THREE.DoubleSide,
  });
  material.name = `actor-fallback-${kind}`;
  return material;
}

/** True when the material is the real shader (has the IS_CHARACTER/IS_NPC uniforms). */
export function isShaderActorMaterial(material) {
  return Boolean(material && material.isShaderMaterial && material.uniforms);
}

/** Set a uniform on a material when it exists; returns whether it was applied. */
export function setUniform(material, name, value) {
  const uniform = material && material.uniforms && material.uniforms[name];
  if (!uniform) return false;
  uniform.value = value;
  return true;
}
