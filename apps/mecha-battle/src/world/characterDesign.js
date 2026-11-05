import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { assetUrl } from '../assetPaths.js';

export async function installStudioReflections(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let target;
  try {
    const sky = await new HDRLoader().loadAsync(assetUrl('textures/polyhaven/daylight.hdr'));
    target = pmrem.fromEquirectangular(sky);
    sky.dispose();
  } catch (error) {
    console.warn('Daylight reflection unavailable, using fallback', error);
    const room = new RoomEnvironment();
    target = pmrem.fromScene(room, .04);
    room.dispose();
  }
  scene.environment = target.texture;
  scene.environmentIntensity = .55;
  pmrem.dispose();
  return target;
}

export function disposeCharacter(root, shadow) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  for (const tree of [root, shadow]) tree.traverse(o => {
    if (o.geometry) geometries.add(o.geometry);
    if (o.skeleton) skeletons.add(o.skeleton);
    if (o.customDepthMaterial) materials.add(o.customDepthMaterial);
    for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData.shared) textures.add(value);
    }
  });
  skeletons.forEach(s => s.dispose());
  textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}

// Invisible effect/control anchors preserve the existing gesture controller.
// All rendered character geometry comes from the downloaded glTF assets.
function anchor(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
function effectAnchor(parent) {
  const g = anchor(parent);
  g.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  return g;
}
function base(actor, monster) {
  actor.hips = anchor(actor.visual, 0, monster ? 3.35 : 2.95);
  actor.torso = anchor(actor.hips, 0, monster ? .7 : .35);
  actor.neck = anchor(actor.torso, 0, 1.82, .64);
  actor.head = anchor(monster ? actor.neck : actor.torso, 0, monster ? .62 : 2.06, .3);
  actor.flashMats = [];
}
export function buildMech(m) {
  base(m, false);
  const arm = side => {
    const shoulder = anchor(m.torso, side * 1.37, 1.32), upper = anchor(shoulder, 0, -.12);
    const elbow = anchor(upper, 0, -.92), fist = anchor(elbow, 0, -1.04);
    const bladeGroup = anchor(fist), blade = effectAnchor(bladeGroup), bladeCore = effectAnchor(bladeGroup), bladeGlow = effectAnchor(bladeGroup);
    return { shoulder, upper, elbow, fist, side, bladeGroup, blade, bladeCore, bladeGlow, bladeMat: blade.material, bladeCoreMat: bladeCore.material };
  };
  const leg = side => { const hip = anchor(m.hips, side * .57), knee = anchor(hip, 0, -1.36), foot = anchor(knee, 0, -1.34); return { hip, knee, foot, side }; };
  m.shoulderL = arm(-1); m.shoulderR = arm(1); m.legL = leg(-1); m.legR = leg(1);
  m.backpack = anchor(m.torso, 0, 1, -.65);
  for (const key of ['core', 'coreRing', 'coreGlow', 'flameL', 'flameR', 'backGlow', 'wristGlowL', 'wristGlowR']) m[key] = effectAnchor(m.torso);
  m.missilePodGlows = []; m.binders = []; m.energyStrips = [];
}
export function buildMonster(m) {
  base(m, true);
  m.jaw = anchor(m.head, 0, -.3, .2); m.headBaseRotation = new THREE.Euler();
  const arm = side => { const shoulder = anchor(m.torso, side * 1.5, 1.12), upper = anchor(shoulder, side * .12, -.24), elbow = anchor(upper, 0, -1.5), hand = anchor(elbow, 0, -1.65); return { shoulder, upper, elbow, hand, side }; };
  const leg = side => { const hip = anchor(m.hips, side * .94, -.35), knee = anchor(hip, 0, -1.35), ankle = anchor(knee, 0, -1.35); return { hip, knee, ankle, side }; };
  m.armL = arm(-1); m.armR = arm(1); m.legL = leg(-1); m.legR = leg(1); m.tail = [];
  for (const key of ['chestGlow', 'mouthGlow', 'backGlow', 'aura']) m[key] = effectAnchor(m.torso);
  m.mouthPoint = anchor(m.head, 0, -.2, 1.45);
  m.eyeMat = new THREE.MeshBasicMaterial(); m.magmaMats = [new THREE.MeshBasicMaterial()];
  // No looping aura/ember cloud obscures the imported model in daylight.
  m.coreLight = new THREE.PointLight('#ffffff', 0, 1); m.root.add(m.coreLight);
  m.emberSpeed = new Float32Array(0); m.emberAngle = new Float32Array(0); m.emberRadius = new Float32Array(0);
  m.rageEmbers = effectAnchor(m.root);
  m.rageEmbers.geometry = new THREE.BufferGeometry();
  m.rageEmbers.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
}
