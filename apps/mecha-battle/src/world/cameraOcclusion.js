import * as THREE from 'three';

// Fade only foreground buildings intersecting the camera-to-character corridors.
// Clone their materials before changing opacity: city materials are shared.
export function updateCameraOcclusion(city, cameraPosition, targets, dt) {
  for (const b of city.buildings) {
    if (b.destroyed) continue;
    let obscures = false;
    for (const target of targets) {
      if (buildingOccludesSegment(b,cameraPosition,target,2)) { obscures=true; break; }
    }
    if (!obscures && !b.cameraFadeMaterials) continue;
    if (!b.cameraFadeMaterials) {
      b.cameraFadeMaterials = [];
      b.group.traverse(o => {
        if (!o.isMesh) return;
        const clone = original => {
          const mat = original.clone();
          if (original === b.damageMaterial) { b.damageMaterial = mat; original.dispose(); }
          b.cameraFadeMaterials.push({ mat, opacity: original.opacity, transparent: original.transparent, depthWrite: original.depthWrite });
          return mat;
        };
        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      });
      b.cameraFade = 1;
      b.cameraInstances = [];
      for (const [mesh, start, count] of [[city.windowMesh, b.windowStart, b.windowCount], [city.roofUnits, b.roofUnitIndex, 2]]) {
        if (!mesh || start == null || !count) continue;
        b.cameraInstances.push({ attribute: mesh.instanceMatrix, start: start * 16, original: mesh.instanceMatrix.array.slice(start * 16, (start + count) * 16) });
      }
    }
    b.cameraFade = THREE.MathUtils.damp(b.cameraFade, obscures ? .12 : 1, obscures ? 14 : 7, dt);
    const instanceScale = b.cameraFade > .995 ? 1 : b.cameraFade;
    if (Math.abs((b.cameraInstanceScale ?? 1) - instanceScale) > .001) {
      for (const {attribute, start, original} of b.cameraInstances) {
        for (let i = 0; i < original.length; i++) attribute.array[start + i] = original[i] * (i % 16 < 12 ? instanceScale : 1);
        attribute.addUpdateRange(start, original.length); attribute.needsUpdate = true;
      }
      b.cameraInstanceScale = instanceScale;
    }
    for (const {mat, opacity, transparent, depthWrite} of b.cameraFadeMaterials) {
      mat.opacity = opacity * b.cameraFade;
      const fading = b.cameraFade < .995;
      const nextTransparent = transparent || fading;
      if (mat.transparent !== nextTransparent) { mat.transparent = nextTransparent; mat.needsUpdate = true; }
      mat.depthWrite = fading ? false : depthWrite;
    }
  }
}

// Slab intersection tests the actual footprint, including wide/corner-on towers.
// Ignore geometry beyond the actor; do not fade the skyline behind combatants.
export function buildingOccludesSegment(building, from, to, margin=0) {
  let near=0,far=.98;
  const minimum=[building.x-building.w/2-margin,-margin,building.z-building.d/2-margin];
  const maximum=[building.x+building.w/2+margin,building.h+margin,building.z+building.d/2+margin];
  for(let i=0;i<3;i++) {
    const key=['x','y','z'][i],delta=to[key]-from[key];
    if(Math.abs(delta)<1e-8) {
      if(from[key]<minimum[i] || from[key]>maximum[i])return false;
    } else {
      const a=(minimum[i]-from[key])/delta,b=(maximum[i]-from[key])/delta;
      near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
      if(near>far)return false;
    }
  }
  return far>.001;
}
