// Planet assembly: loads and merges the original terrain chunks plus the
// environmental layers (trees, water, cables, sky) and builds the ground
// collision index.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GroundCollision } from './collision.js';
import { SPAWNS, NPCS, REGIONS, SPOT_TO_NPC, PICKUP_TO_NPC } from './planet-config.js';

const CHUNKS = 10;
const LEAF_CHUNKS = 5;
const HITMESH_CHUNKS = 5;

async function mergeAll(assets, paths, label) {
  const geometries = await Promise.all(paths.map((p) => assets.loadGeometry(p)));
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  merged.name = label;
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}


function createGrassMesh(grassGeometry, material) {
  const srcPos = grassGeometry.getAttribute('position');
  const srcUp = grassGeometry.getAttribute('up');
  const srcRand = grassGeometry.getAttribute('randomm');
  const pointCount = srcPos.count;
  const perPoint = 3;
  const total = pointCount * perPoint;

  const aPos = new Float32Array(total * 3);
  const aUp = new Float32Array(total * 3);
  const aRandom = new Float32Array(total * 4);

  const p = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();
  let w = 0;
  for (let i = 0; i < pointCount; i += 1) {
    p.fromBufferAttribute(srcPos, i);
    up.fromBufferAttribute(srcUp, i).normalize();
    const r0 = srcRand.getX(i);
    const r1 = srcRand.getY(i);
    const r2 = srcRand.getZ(i);
    const r3 = srcRand.getW(i);
    const ref = Math.abs(up.x) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
    tangent.crossVectors(up, ref).normalize();
    bitangent.crossVectors(up, tangent).normalize();
    for (let k = 0; k < perPoint; k += 1) {
      const jitter = (k - 1) * 0.35;
      const ox = Math.sin((i + k) * 12.9898) * 0.42 + jitter * (r0 - 0.5);
      const oz = Math.cos((i + k) * 78.233) * 0.42 + jitter * (r1 - 0.5);
      aPos[w * 3] = p.x + tangent.x * ox + bitangent.x * oz;
      aPos[w * 3 + 1] = p.y + tangent.y * ox + bitangent.y * oz;
      aPos[w * 3 + 2] = p.z + tangent.z * ox + bitangent.z * oz;
      aUp[w * 3] = up.x;
      aUp[w * 3 + 1] = up.y;
      aUp[w * 3 + 2] = up.z;
      aRandom[w * 4] = (r0 + k * 0.271) % 1;
      aRandom[w * 4 + 1] = (r1 + k * 0.413) % 1;
      aRandom[w * 4 + 2] = (r2 + k * 0.137) % 1;
      aRandom[w * 4 + 3] = (r3 + k * 0.619) % 1;
      w += 1;
    }
  }

  const base = new THREE.BufferGeometry();
  const bw = 0.16;
  const positions = new Float32Array([
    -bw, 0, 0, bw, 0, 0, -bw, 1, 0, bw, 1, 0,
    0, 0, -bw, 0, 0, bw, 0, 1, -bw, 0, 1, bw,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 1, 1]);
  const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);
  const index = new Uint16Array([0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7]);
  base.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  base.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  base.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  base.setIndex(new THREE.BufferAttribute(index, 1));

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.copy(base);
  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geometry.setAttribute('aUp', new THREE.InstancedBufferAttribute(aUp, 3));
  geometry.setAttribute('aRandom', new THREE.InstancedBufferAttribute(aRandom, 4));
  geometry.instanceCount = total;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 60);
  base.dispose();
  return geometry;
}


async function buildBirds({ assets, env, group, count, curvePath, speed, direction, scale, radiusOffset }) {
  const [birdGeometry, curveGeometry] = await Promise.all([
    assets.loadGeometry('geometries/birds/1.drc'),
    assets.loadGeometry(curvePath),
  ]);
  const curveAttr = curveGeometry.getAttribute('position_1') || curveGeometry.getAttribute('position');
  const points = [];
  for (let i = 0; i < curveAttr.count; i += 1) {
    points.push(new THREE.Vector3().fromBufferAttribute(curveAttr, i));
  }
  if (!points.length) return null;

  const material = env.bird();
  const birds = [];
  const baseGeometry = birdGeometry;
  const up = new THREE.Vector3(0, 1, 0);
  const obj = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(baseGeometry, material);
    mesh.scale.setScalar(scale);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    birds.push({
      mesh,
      progress: (i / count) + Math.random() * 0.02,
      speed: speed * (0.8 + Math.random() * 0.4),
      lateral: (Math.random() - 0.5) * 0.06,
      height: (Math.random() - 0.5) * 1.6,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function sample(progress) {
    const t = ((progress % 1) + 1) % 1;
    const f = t * points.length;
    const i0 = Math.floor(f) % points.length;
    const i1 = (i0 + 1) % points.length;
    const local = f - Math.floor(f);
    return new THREE.Vector3().lerpVectors(points[i0], points[i1], local);
  }

  function update(time) {
    for (const bird of birds) {
      const p = sample(bird.progress + time * bird.speed * 0.02 * direction);
      const n = p.clone().normalize();
      const tangent = sample(bird.progress + time * bird.speed * 0.02 * direction + 0.002).sub(p).normalize();
      const lateral = new THREE.Vector3().crossVectors(n, tangent).normalize();
      const pos = p.clone().addScaledVector(n, radiusOffset + bird.height * 0.5).addScaledVector(lateral, bird.lateral * 10);
      pos.addScaledVector(n, Math.sin(time * 0.8 + bird.phase) * 0.4);
      bird.mesh.position.copy(pos);
      obj.position.copy(pos);
      obj.up.copy(n);
      obj.lookAt(pos.clone().add(tangent));
      bird.mesh.quaternion.copy(obj.quaternion);
      // birds face -Z with lookAt; flip to whichever orientation looks right
      bird.mesh.rotateY(Math.PI);
    }
  }

  return { update, birds };
}

export async function buildPlanet({ assets, materials, env, scene }) {
  const group = new THREE.Group();
  group.name = 'planet';
  scene.add(group);

  // ---------------------------------------------------------------- ground
  const groundGeometry = await mergeAll(
    assets,
    Array.from({ length: CHUNKS }, (_, i) => `geometries/planets/present/full_${i}.drc`),
    'planet-ground',
  );
  const ground = new THREE.Mesh(groundGeometry, materials.planet());
  ground.name = 'planet-ground';
  ground.castShadow = true;
  ground.receiveShadow = true;
  ground.matrixAutoUpdate = false;
  ground.updateMatrixWorld(true);
  group.add(ground);

  // ---------------------------------------------------------------- collision
  const hitGeometry = await mergeAll(
    assets,
    Array.from({ length: HITMESH_CHUNKS }, (_, i) => `geometries/planets/present/hitmesh_${i}.drc`),
    'planet-hitmesh',
  );
  const collision = new GroundCollision(hitGeometry);

  // ---------------------------------------------------------------- trees
  const leavesGeometry = await mergeAll(
    assets,
    Array.from({ length: LEAF_CHUNKS }, (_, i) => `geometries/planets/present/tree-leaves_${i}.drc`),
    'planet-leaves',
  );
  const leaves = new THREE.Mesh(leavesGeometry, env.leaves({ near: 0.2, far: 175 }));
  leaves.name = 'tree-leaves';
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  leaves.frustumCulled = false;
  group.add(leaves);

  // ---------------------------------------------------------------- grass
  const grassGeometry = await assets.loadGeometry('geometries/planets/present/grass.drc');
  const grass = new THREE.Mesh(createGrassMesh(grassGeometry, env.grass()), env.grass());
  grass.name = 'grass';
  grass.frustumCulled = false;
  grass.castShadow = false;
  grass.receiveShadow = false;
  group.add(grass);

  // ---------------------------------------------------------------- water
  const waterGeometry = await assets.loadGeometry('geometries/planets/present/water.drc');
  waterGeometry.computeBoundingSphere();
  const water = new THREE.Mesh(waterGeometry, env.water());
  water.name = 'water';
  water.renderOrder = 1;
  water.receiveShadow = false;
  water.castShadow = false;
  group.add(water);

  // ---------------------------------------------------------------- cables
  const cableGeometry = await mergeAll(
    assets,
    ['geometries/planets/present/cables-1.drc', 'geometries/planets/present/cables-2.drc'],
    'planet-cables',
  );
  const cables = new THREE.Mesh(cableGeometry, env.cables());
  cables.name = 'cables';
  cables.frustumCulled = false;
  group.add(cables);

  // ---------------------------------------------------------------- birds
  const flock1 = await buildBirds({
    assets, env, group, count: 16, curvePath: 'geometries/birds/curve-1.drc',
    speed: 1.0, direction: 1, scale: 0.16, radiusOffset: 7,
  });
  const flock2 = await buildBirds({
    assets, env, group, count: 20, curvePath: 'geometries/birds/curve-2.drc',
    speed: 0.7, direction: -1, scale: 0.2, radiusOffset: 9,
  });

  // ---------------------------------------------------------------- sky
  const sky = env.sky();
  scene.add(sky.mesh);

  // ---------------------------------------------------------------- anchors
  const spawn = SPAWNS[0];
  const spawnNormal = new THREE.Vector3(...spawn.position).normalize();
  const spawnGround = collision.groundAtDirection(spawnNormal);
  const spawnPoint = spawnGround ? spawnGround.point : spawnNormal.clone().multiplyScalar(27);

  const npcAnchors = NPCS.map((npc) => {
    const normal = new THREE.Vector3(...npc.position).normalize();
    const hit = collision.groundAtDirection(normal);
    const point = hit ? hit.point : normal.clone().multiplyScalar(27);
    const up = normal.clone();
    const euler = new THREE.Euler(npc.rotation[0], npc.rotation[1], npc.rotation[2]);
    const facing = new THREE.Vector3(0, 0, 1).applyEuler(euler);
    facing.addScaledVector(up, -facing.dot(up));
    if (facing.lengthSq() < 1e-4) facing.set(1, 0, 0).addScaledVector(up, -up.x);
    facing.normalize();
    return { ...npc, normal: up, point, facing };
  });

  const regions = REGIONS.map((r) => {
    const normal = new THREE.Vector3(...r.position).normalize();
    const hit = collision.groundAtDirection(normal);
    return { ...r, normal, point: hit ? hit.point : normal.clone().multiplyScalar(27) };
  });

  // named quest spots: NPC meeting points + floating pickup points next to them
  const byId = Object.fromEntries(npcAnchors.map((a) => [a.id, a]));
  const spots = {};
  for (const [spotId, npcId] of Object.entries(SPOT_TO_NPC)) {
    const anchor = byId[npcId];
    if (!anchor) continue;
    spots[spotId] = {
      point: anchor.point.clone(),
      normal: anchor.normal.clone(),
      facing: anchor.facing.clone(),
      npcId: anchor.id,
      kind: anchor.kind,
    };
  }
  for (const [spotId, npcId] of Object.entries(PICKUP_TO_NPC)) {
    const anchor = byId[npcId];
    if (!anchor) continue;
    // put the parcel on the ground a couple of steps away from the NPC
    const tangent = new THREE.Vector3(0, 0, 1);
    if (Math.abs(tangent.dot(anchor.normal)) > 0.9) tangent.set(1, 0, 0);
    tangent.addScaledVector(anchor.normal, -tangent.dot(anchor.normal)).normalize();
    const dir = anchor.normal.clone().addScaledVector(tangent, 0.075).normalize();
    const ground = collision.groundAtDirection(dir);
    const point = ground ? ground.point : anchor.normal.clone().multiplyScalar(27);
    spots[spotId] = {
      point: point.clone().addScaledVector(anchor.normal, 0.34),
      normal: anchor.normal.clone(),
      facing: tangent,
      npcId: anchor.id,
    };
  }

  function update(time, dt, player) {
    env.update(time, {
      charPos: player ? player.position : undefined,
      charSpeed: player ? player.speed : 0,
    });
    sky.mesh.position.copy(player ? player.position : new THREE.Vector3());
    flock1?.update(time);
    flock2?.update(time);
  }

  return {
    group,
    ground,
    leaves,
    water,
    cables,
    sky,
    collision,
    spawn: {
      point: spawnPoint,
      normal: spawnNormal,
      heading: spawn.rotation,
    },
    npcAnchors,
    regions,
    spots,
    update,
  };
}

export async function buildIntroPlanet({ assets, env }) {
  const group = new THREE.Group();
  group.name = 'intro-planet';
  const material = env.intro();
  const planetGeometry = await assets.loadGeometry('geometries/planets/present/intro/planet.drc');
  const planet = new THREE.Mesh(planetGeometry, material);
  planet.name = 'intro-planet-mesh';
  planet.castShadow = true;
  planet.receiveShadow = true;
  group.add(planet);

  const waterGeometry = await assets.loadGeometry('geometries/planets/present/intro/water.drc');
  const water = new THREE.Mesh(waterGeometry, env.water());
  water.name = 'intro-water';
  group.add(water);

  const treesGeometry = await assets.loadGeometry('geometries/planets/present/intro/trees.drc');
  const trees = new THREE.Mesh(treesGeometry, material);
  trees.name = 'intro-trees';
  trees.castShadow = true;
  trees.receiveShadow = true;
  group.add(trees);

  return { group, planet, water, trees };
}
