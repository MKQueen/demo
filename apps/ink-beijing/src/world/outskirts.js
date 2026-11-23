/** 京郊：关厢沿驿路生长，村落背靠林地，田畴落在村路之间。 */
import * as THREE from 'three';
import { makeRng } from '../lib/rand.js';
import { mergeGeoms } from '../lib/geometry.js';
import { gableRoofGeometry } from '../lib/roof.js';
import { buildTrees } from '../lib/flora.js';
import { setInkWeight } from '../lib/materials.js';
import { INNER_CITY, OUTER_CITY, u, h, terrainHeight, LAKES, RIVERS, CANALS, MODERN } from '../layout.js';

function distanceToPath(x, z, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const dx = bx - ax, dz = bz - az;
    const t = THREE.MathUtils.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// All placements share this exclusion: no roofs, crops or trees in lakes,
// canals, landmark grounds or the city. Radius also checks the footprint corners.
function openPlain(x, z, radius = 0) {
  for (const [dx, dz] of [[0, 0], [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    const px = x + dx, pz = z + dz;
    const halfX = pz > INNER_CITY.south ? OUTER_CITY.halfX : INNER_CITY.halfX;
    if (Math.abs(px) < halfX + u(150) && pz > INNER_CITY.north - u(180) && pz < OUTER_CITY.south + u(180)) return false;
    if (terrainHeight(px, pz) > 0.35) return false;
    for (const lake of Object.values(LAKES)) {
      if (Math.hypot((px - lake.cx) / (lake.rx * 1.12), (pz - lake.cz) / (lake.rz * 1.12)) < 1) return false;
    }
    for (const river of [...RIVERS, ...CANALS]) {
      if (distanceToPath(px, pz, river.points) < river.width * 1.2 + u(45)) return false;
    }
    // Reserve the modern skyline, Olympic grounds and Yuanmingyuan.
    if (Math.abs(px - MODERN.cbd.x) < u(1500) && Math.abs(pz - MODERN.cbd.z) < u(1300)) return false;
    if (Math.abs(px) < u(1700) && pz < -u(7000) && pz > -u(10500)) return false;
    if (Math.hypot((px + u(8800)) / u(1200), (pz + u(7600)) / u(1100)) < 1) return false;
  }
  return true;
}

function dryRoad(a, b) {
  // Sample the full segment, so neither main roads nor village lanes bridge water.
  for (let i = 0; i <= 4; i++) {
    const t = i / 4, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (terrainHeight(x, z) > 0.3) return false;
    if ([...RIVERS, ...CANALS].some(r => distanceToPath(x, z, r.points) < r.width * 0.8)) return false;
    if (Object.values(LAKES).some(l => Math.hypot((x - l.cx) / l.rx, (z - l.cz) / l.rz) < 1.08)) return false;
  }
  return true;
}

function curve(a, c, b, steps = 36) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, s = 1 - t;
    return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]];
  });
}

function pathGeometry(path, width, y) {
  const p = [];
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len * width / 2, nz = (bx - ax) / len * width / 2;
    p.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, ax - nx, y, az - nz,
      ax - nx, y, az - nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.computeVertexNormals();
  return geo;
}

export function buildOutskirts(ctx) {
  const group = new THREE.Group();
  group.name = 'outskirts';
  const rng = makeRng(20261106);
  const low = ctx.quality === 'low';
  const trees = [], walls = [], roofs = [], fascia = [], courtyards = [], lanes = [];
  const villages = [];
  const cityW = INNER_CITY.halfX, cityN = INNER_CITY.north, cityS = OUTER_CITY.south;
  const roads = [
    curve([-cityW, -u(900)], [-u(7800), -u(3600)], [-u(11500), -u(10000)]),
    curve([-cityW, u(900)], [-u(7400), u(2400)], [-u(8600), u(4800)]),
    curve([cityW, -u(900)], [u(8500), -u(1700)], [u(15500), u(3200)]),
    curve([cityW, u(900)], [u(9000), u(2000)], [u(15000), u(6300)]),
    curve([-u(900), cityN], [-u(1700), -u(10000)], [-u(2600), -u(17000)]),
    curve([u(900), cityN], [u(4400), -u(7500)], [u(6500), -u(12500)]),
    curve([-u(2300), cityS], [-u(4300), u(9500)], [-u(6500), u(14500)]),
    curve([u(2300), cityS], [u(4600), u(10000)], [u(7500), u(15000)]),
    curve([0, cityS], [u(100), u(10000)], [-u(600), u(15500)]),
  ];

  function addHouse(x, z, w, d, rot = 0) {
    if (!openPlain(x, z, Math.max(w, d) * 0.65)) return;
    const bodyH = h(5 + rng() * 2.5);
    const wall = new THREE.BoxGeometry(w, bodyH, d);
    wall.translate(0, bodyH / 2, 0); wall.rotateY(rot); wall.translate(x, 0, z); walls.push(wall);
    const { roof, fascia: edge } = gableRoofGeometry({ width: w * 1.15, depth: d * 1.18, height: Math.min(w, d) * 0.36, segU: 3, segV: 2 });
    roof.rotateY(rot); roof.translate(x, bodyH, z); roofs.push(roof);
    edge.rotateY(rot); edge.translate(x, bodyH, z); fascia.push(edge);
  }

  function addVillage(x, z, size = 1, rot = 0) {
    if (!openPlain(x, z, u(260) * size)) return;
    if (villages.some(v => Math.hypot(v.x - x, v.z - z) < v.radius + u(320) * size)) return;
    // Compound courtyards follow a common lane instead of random isolated cubes.
    const cs = Math.cos(rot), sn = Math.sin(rot);
    const point = (dx, dz) => [x + dx * cs - dz * sn, z + dx * sn + dz * cs];
    const rows = 3 + Math.floor(rng() * 3), cols = 3 + Math.floor(rng() * 3);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (rng() < 0.12) continue;
        const dx = (col - (cols - 1) / 2) * u(100) * size;
        const dz = (row - (rows - 1) / 2) * u(120) * size;
        const [cx, cz] = point(dx, dz);
        if (!openPlain(cx, cz, u(65) * size)) continue;
        const w = u(57) * size, d = u(22) * size;
        const [hx, hz] = point(dx, dz - u(28) * size);
        addHouse(hx, hz, w, d, -rot);
        for (const sign of [-1, 1]) {
          const [sx, sz] = point(dx + sign * u(25) * size, dz);
          addHouse(sx, sz, u(18) * size, u(42) * size, -rot);
        }
        const yard = new THREE.PlaneGeometry(w, u(58) * size);
        yard.rotateX(-Math.PI / 2); yard.rotateY(-rot); yard.translate(cx, 0.012, cz); courtyards.push(yard);
        if (rng() > 0.55) trees.push({ kind: 'locust', x: cx, z: cz, h: 0.5 + rng() * 0.3 });
      }
    }
    for (let row = 0; row < rows; row++) {
      const dz = (row - (rows - 1) / 2) * u(120) * size + u(55) * size;
      lanes.push(pathGeometry([point(-cols * u(50) * size, dz), point(cols * u(50) * size, dz)], u(24), 0.018));
    }
    villages.push({ x, z, radius: u(430) * size });
    for (let i = 0; i < (low ? 12 : 22); i++) {
      const a = rng() * Math.PI * 2, r = u(300 + rng() * 260) * size;
      const [tx, tz] = point(Math.cos(a) * r, Math.sin(a) * r);
      if (openPlain(tx, tz)) trees.push({ kind: rng() > 0.7 ? 'blossom' : 'locust', x: tx, z: tz, h: 0.65 + rng() * 0.55 });
    }
  }

  for (const road of roads) {
    const roadGeos = [];
    for (let i = 1; i < road.length; i++) {
      const [x, z] = road[i];
      // Check each segment: never connect across a lake after filtering points.
      const prev = road[i - 1];
      if (dryRoad(prev, [x, z])) {
        roadGeos.push(pathGeometry([prev, [x, z]], u(62), 0.016));
      }
      if (i % 5 === 2) {
        const dx = x - prev[0], dz = z - prev[1], len = Math.hypot(dx, dz) || 1;
        const sign = i % 2 ? 1 : -1;
        const vx = x - dz / len * u(360) * sign, vz = z + dx / len * u(360) * sign;
        addVillage(vx, vz, 1.1 + rng() * 0.5, Math.atan2(dz, dx) * 0.16);
        if (openPlain(vx, vz) && dryRoad([x, z], [vx, vz])) lanes.push(pathGeometry([[x, z], [vx, vz]], u(28), 0.018));
      }
      for (const sign of [-1, 1]) {
        const tx = x + sign * u(95), tz = z + sign * u(45);
        if (openPlain(tx, tz)) trees.push({ kind: rng() > 0.6 ? 'willow' : 'locust', x: tx, z: tz, h: 0.75 + rng() * 0.5 });
      }
    }
    lanes.push(...roadGeos);
  }

  // Close suburbs: the city should grow into its landscape, not stop at a bare moat.
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 7; i++) addVillage(sign * (cityW + u(500 + (i % 2) * 650)), cityN + u(650 + i * 1200), 1.15, sign * 0.06);
    for (let i = 0; i < 5; i++) addVillage(sign * u(1200 + i * 1800), cityS + u(700 + (i % 2) * 800), 1.3, sign * 0.08);
  }

  // One world-aligned atlas gives fields broad, quiet colour without thousands
  // of independently outlined planes. It is generated locally, not an image asset.
  const extent = 440, resolution = low ? 2048 : 4096;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = resolution;
  const c = canvas.getContext('2d');
  const scale = resolution / (extent * 2);
  c.translate(resolution / 2, resolution / 2); c.scale(scale, scale);
  const crops = ['#aeb79a', '#bdba99', '#c7bea2', '#a7b0a0', '#b7bfaa'];
  let fieldCount = 0;
  for (let z = -u(14000); z < u(17000); z += u(730)) {
    for (let x = -u(16000); x < u(17000); x += u(820)) {
      const fx = x + (rng() - 0.5) * u(280), fz = z + (rng() - 0.5) * u(240);
      const w = u(530 + rng() * 270), d = u(430 + rng() * 230);
      if (!openPlain(fx, fz, Math.max(w, d) * 0.65)) continue;
      if (villages.some(v => Math.hypot(v.x - fx, v.z - fz) < v.radius + Math.max(w, d) * 0.6)) continue;
      if (roads.some(p => distanceToPath(fx, fz, p) < Math.max(w, d) * 0.65)) continue;
      if (rng() < 0.14) continue;
      c.save(); c.translate(fx, fz); c.rotate((rng() - 0.5) * 0.2);
      c.globalAlpha = 0.43 + rng() * 0.2; c.fillStyle = crops[Math.floor(rng() * crops.length)];
      c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d * 0.46); c.lineTo(w * 0.46, d / 2); c.lineTo(-w * 0.48, d * 0.46); c.closePath(); c.fill();
      c.clip(); c.globalAlpha = 0.45; c.strokeStyle = '#748366'; c.lineWidth = 0.24;
      for (let row = -d / 2; row < d / 2; row += u(40)) {
        c.beginPath(); c.moveTo(-w / 2, row); c.lineTo(w / 2, row + 0.12); c.stroke();
      }
      c.restore(); fieldCount++;
      if (rng() > 0.48) {
        for (let t = 0; t < (low ? 3 : 6); t++) {
          const tx = fx - w / 2 + t / 5 * w, tz = fz + d / 2 + u(35);
          if (openPlain(tx, tz)) trees.push({ kind: rng() > 0.82 ? 'blossom' : 'locust', x: tx, z: tz, h: 0.65 + rng() * 0.65 });
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  const fieldMaterial = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.015, depthWrite: false, toneMapped: false });
  const paper = new THREE.Color(0xf6efe0);
  fieldMaterial.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      float fieldCoverage = diffuseColor.a;
      #include <opaque_fragment>
      gl_FragColor.rgb = mix(vec3(${paper.r}, ${paper.g}, ${paper.b}), gl_FragColor.rgb, fieldCoverage * 0.88);
      gl_FragColor.a = 0.04;
    `);
  };
  fieldMaterial.customProgramCacheKey = () => 'field-wash';
  const fields = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2, extent * 2), fieldMaterial);
  fields.name = 'field-atlas'; fields.rotation.x = -Math.PI / 2; fields.position.y = 0.008;
  group.add(fields);

  // Irregular groves between farms and the mountain foot, with readable tree silhouettes.
  for (let i = 0; i < (low ? 100 : 160); i++) {
    const gx = (rng() - 0.5) * u(33000), gz = (rng() - 0.5) * u(32000);
    if (!openPlain(gx, gz, u(150))) continue;
    for (let j = 0; j < (low ? 6 : 10); j++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * u(330);
      const x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r;
      if (openPlain(x, z)) trees.push({ kind: rng() > 0.7 ? 'pine' : 'locust', x, z, h: 0.8 + rng() * 0.9 });
    }
  }
  // Willow banks make the Changhe's course visible all the way to the gardens.
  for (const canal of CANALS) {
    for (let i = 1; i < canal.points.length; i++) {
      const [ax, az] = canal.points[i - 1], [bx, bz] = canal.points[i];
      const len = Math.hypot(bx - ax, bz - az), count = Math.floor(len / u(160));
      for (let k = 0; k < count; k++) {
        const t = (k + 0.5) / count;
        for (const sign of [-1, 1]) {
          const x = ax + (bx - ax) * t - (bz - az) / len * (canal.width * 1.5 + u(60)) * sign;
          const z = az + (bz - az) * t + (bx - ax) / len * (canal.width * 1.5 + u(60)) * sign;
          if (openPlain(x, z)) trees.push({ kind: 'willow', x, z, h: 0.85 + rng() * 0.55 });
        }
      }
    }
  }

  const addBatch = (name, geos, mat) => {
    if (!geos.length) return;
    const merged = mergeGeoms(geos);
    for (const geo of geos) if (geo !== merged) geo.dispose();
    const mesh = new THREE.Mesh(merged, mat); mesh.name = name; group.add(mesh);
  };
  // Merge AFTER every village has been added; the old distant villages were
  // appended after merging and never reached the scene.
  addBatch('village-walls', walls, ctx.mats.wallPlaster);
  addBatch('village-roofs', roofs, setInkWeight(new THREE.MeshLambertMaterial({ color: 0x707c73, flatShading: true, side: THREE.DoubleSide }), 0.32));
  addBatch('village-eaves', fascia, ctx.mats.eave);
  addBatch('village-courtyards', courtyards, new THREE.MeshBasicMaterial({ color: 0xd9ceb5, toneMapped: false }));
  addBatch('country-roads', lanes, new THREE.MeshBasicMaterial({ color: 0xc8b99b, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide }));
  group.add(buildTrees(trees, ctx));
  group.userData.landscape = { villages: villages.length, fields: fieldCount, trees: trees.length, houses: walls.length };
  return group;
}
