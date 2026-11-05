import * as THREE from 'three';

/** 4-step cel ramp shared by every opaque surface. */
export const TOON_GRADIENT = (() => {
  const steps = [92, 162, 220, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((value, i) => {
    data[i * 4 + 0] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  tex.name = 'toon-gradient';
  tex.userData.shared = true;
  return tex;
})();

const TOON_MODES = new Set();

function copyToon(source, cache) {
  if (!source) return source;
  if (TOON_MODES.has(source.uuid)) return source;
  if (!(source.isMeshStandardMaterial || source.isMeshPhysicalMaterial)) return source;
  if (cache.has(source)) return cache.get(source);

  const toon = new THREE.MeshToonMaterial({
    color: source.color ? source.color.clone() : 0xffffff,
    map: source.map || null,
    alphaMap: source.alphaMap || null,
    emissive: source.emissive ? source.emissive.clone() : 0x000000,
    emissiveMap: source.emissiveMap || null,
    emissiveIntensity: source.emissiveIntensity ?? 1,
    gradientMap: TOON_GRADIENT,
    side: source.side,
    flatShading: source.flatShading,
    transparent: source.transparent,
    opacity: source.opacity,
    alphaTest: source.alphaTest,
    depthWrite: source.depthWrite,
    depthTest: source.depthTest,
    blending: source.blending,
    vertexColors: source.vertexColors,
    toneMapped: source.toneMapped,
    fog: source.fog,
    name: source.name ? `${source.name}-toon` : 'toon-surface',
  });
  toon.userData = { ...source.userData, toonSource: source.uuid };
  toon.polygonOffset = source.polygonOffset;
  toon.polygonOffsetFactor = source.polygonOffsetFactor;
  toon.polygonOffsetUnits = source.polygonOffsetUnits;
  TOON_MODES.add(toon.uuid);
  cache.set(source, toon);
  return toon;
}

/**
 * Replace PBR surfaces with cel-shaded MeshToonMaterial across a scene subtree.
 * Sprites, neon/basic materials and the sky shader are intentionally left alone.
 */
export function applyToonMaterials(root) {
  if (!root) return 0;
  const cache = new Map();
  let count = 0;
  root.traverse((object) => {
    if (!object.isMesh && !object.isInstancedMesh) return;
    const source = object.material;
    if (Array.isArray(source)) {
      object.material = source.map((mat) => {
        const next = copyToon(mat, cache);
        if (next !== mat) count++;
        return next;
      });
    } else {
      const next = copyToon(source, cache);
      if (next !== source) {
        object.material = next;
        count++;
      }
    }
  });
  return count;
}

/**
 * Inverted-hull outlines around solid character armour.
 * Skip tiny, transparent, textured or emissive-basic pieces to keep linework clean.
 */
export function addCharacterInk(root, options = {}) {
  if (!root) return null;
  const thickness = options.thickness ?? 1.035;
  const minRadius = options.minRadius ?? 0.16;
  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? 0x05080e,
    side: THREE.BackSide,
    toneMapped: false,
    fog: true,
    depthWrite: true,
  });
  const candidates = [];
  root.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.isSprite) return;
    if (object.userData.isInkOutline || object.userData.noOutline) return;
    const mat = object.material;
    if (!mat || mat.transparent || mat.map || mat.alphaTest > 0) return;
    if (!mat.isMeshToonMaterial && !mat.isMeshStandardMaterial) return;
    if (!object.geometry) return;
    object.geometry.computeBoundingSphere();
    const radius = object.geometry.boundingSphere?.radius || 0;
    if (radius < minRadius) return;
    candidates.push(object);
  });

  for (const mesh of candidates) {
    const outline = new THREE.Mesh(mesh.geometry, material);
    outline.name = 'ink-outline';
    outline.scale.setScalar(thickness);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.userData.isInkOutline = true;
    outline.renderOrder = -1;
    mesh.add(outline);
  }
  return material;
}

/**
 * Black edge geometry for the boxy city blocks. This gives distant buildings
 * a hand-inked silhouette without needing a full post-processing depth pass.
 */
export function addBuildingInk(city) {
  if (!city || !Array.isArray(city.buildings)) return null;
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x05080e,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  });
  const cache = new Map();
  const hullMat = new THREE.MeshBasicMaterial({ color: 0x05080e, side: THREE.BackSide, toneMapped: false, fog: true });
  for (const b of city.buildings) {
    if (!b.main?.geometry || b.ink) continue;
    let edges = cache.get(b.main.geometry);
    if (!edges) {
      edges = new THREE.EdgesGeometry(b.main.geometry, 24);
      cache.set(b.main.geometry, edges);
    }
    // dark hull gives every tower a readable cartoon silhouette
    const hull = new THREE.Mesh(b.main.geometry, hullMat);
    hull.name = 'building-outline';
    hull.scale.setScalar(1.017);
    hull.renderOrder = -1;
    hull.castShadow = false;
    hull.receiveShadow = false;
    b.main.add(hull);
    const ink = new THREE.LineSegments(edges, lineMaterial);
    ink.name = 'building-ink';
    ink.renderOrder = 1;
    ink.castShadow = false;
    ink.receiveShadow = false;
    b.main.add(ink);
    b.ink = ink;
  }
  return lineMaterial;
}
