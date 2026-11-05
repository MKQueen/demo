import { StreetFurniture } from './streetFurniture.js';
import { UrbanTrees } from './urbanTrees.js';
import { concreteMaterial, asphaltMaterial, scaleBuildingUV, windowMaterial } from './surfaceMaterials.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  clamp, lerp, damp, dampAngle, rand, randInt, pick, chance, mulberry32, makeRng,
  canvasTexture, glowTexture, smokeTexture, scorchTexture, makeCanvas,
} from '../utils.js';

const ROAD_LINES = [-119, -85, -51, -17, 17, 51, 85, 119];
const CELL_STEP = 34;
const PLAZA_RADIUS = 30;
const CELL_RANGE = [-3, -2, -1, 0, 1, 2, 3];

const CAR_COLORS = ['#8a9bb0', '#3b4b60', '#b63e39', '#c88b42', '#4d6d73', '#d1d5d1', '#2e3138', '#7a455f', '#4d5f43'];
const JACKETS = ['#5b6468','#8a8171','#4b606b','#655c54','#555f66','#a09b8d','#53565c','#596056','#7b6860','#43515b'];
const SKIN = ['#d6a17a', '#b77b56', '#8b5d42', '#e8bd98', '#6e4735'];
const CIVILIAN_HEIGHTS = [0.94, 1.02, 1.08];

function makeNeonTexture(text, hue = '#ff648d', sub = '') {
  return canvasTexture(512, 160, (ctx, w, h) => {
    const rng = mulberry32(text.length * 351 + 17);
    ctx.fillStyle = 'rgba(4, 9, 12, 0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = hue;
    ctx.globalAlpha = 0.35;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = hue;
      ctx.globalAlpha = 0.11;
      ctx.shadowColor = hue;
      ctx.shadowBlur = 34;
      ctx.font = `800 ${78 - i * 4}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillText(text, w / 2 + (rng() - 0.5) * 2, h / 2 - 7 + (rng() - 0.5) * 2);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#f5ffff';
    ctx.font = '800 66px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(text, w / 2, h / 2 - 6);
    ctx.shadowBlur = 8;
    ctx.fillStyle = hue;
    ctx.globalAlpha = 0.9;
    ctx.font = '500 18px "SFMono-Regular", monospace';
    if (sub) ctx.fillText(sub, w / 2, h - 28);
    ctx.globalAlpha = 1;
  });
}

function plazaTexture() {
  return canvasTexture(1024,1024,(ctx,w,h)=>{
    const rng=mulberry32(77);
    ctx.fillStyle='#8c887f';ctx.fillRect(0,0,w,h);
    // Meter-scale stone slabs with narrow recessed joints and worn surfaces.
    const tile=32;
    for(let y=0;y<h;y+=tile)for(let x=0;x<w;x+=tile){
      const v=Math.floor(148+rng()*22),warm=Math.floor(rng()*5);
      ctx.fillStyle=`rgb(${v+warm},${v},${v-8})`;ctx.fillRect(x+1,y+1,tile-2,tile-2);
      ctx.fillStyle='rgba(238,230,211,.15)';ctx.fillRect(x+1,y+1,tile-2,1);
      ctx.fillStyle='rgba(30,27,22,.12)';ctx.fillRect(x+1,y+tile-2,tile-2,1);
    }
    for(let i=0;i<14000;i++){
      ctx.fillStyle=rng()<.5?'rgba(32,28,22,.06)':'rgba(255,248,221,.08)';
      ctx.fillRect(rng()*w,rng()*h,1+rng()*2,1+rng()*2);
    }
    // Construction joints divide the civic square without arena-like neon rings.
    ctx.strokeStyle='rgba(56,53,46,.2)';ctx.lineWidth=3;
    for(const x of [256,512,768]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(const y of [256,512,768]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let i=0;i<50;i++){
      const x=rng()*w,y=rng()*h,r=8+rng()*30;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(47,43,33,.1)');g.addColorStop(1,'rgba(47,43,33,0)');
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  });
}

function makePanelTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#061013';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(97, 242, 255, .25)';
    ctx.strokeRect(7, 7, w - 14, h - 14);
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,.17)';
      ctx.fillRect(0, y, w, 1);
    }
    ctx.fillStyle = 'rgba(99,245,255,.12)';
    ctx.fillRect(18, 18, 92, 3);
    ctx.fillStyle = 'rgba(99,245,255,.65)';
    ctx.font = '500 16px "SFMono-Regular", monospace';
    ctx.fillText('NEW HARBOR / SECTOR 09', 18, 44);
    ctx.fillStyle = '#ff7e45';
    ctx.font = '800 44px "DIN Condensed", "Arial Narrow", "PingFang SC", sans-serif';
    ctx.fillText('城市防卫协议', 18, 94);
    ctx.fillStyle = 'rgba(173, 243, 255, .66)';
    ctx.font = '500 16px "SFMono-Regular", monospace';
    ctx.fillText('DEFENSE NETWORK ONLINE', 18, 124);
    ctx.fillStyle = 'rgba(99,245,255,.2)';
    for (let i = 0; i < 28; i++) {
      const bw = 3 + Math.random() * 20;
      ctx.fillRect(22 + i * 16, 164, bw, 28);
    }
    ctx.strokeStyle = 'rgba(255,120,65,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(420, 78, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(420, 36); ctx.lineTo(420, 120); ctx.moveTo(378, 78); ctx.lineTo(462, 78); ctx.stroke();
    ctx.fillStyle = 'rgba(255,137,84,.8)';
    ctx.font = '500 12px "SFMono-Regular", monospace';
    ctx.fillText('09 / 震级未知', 18, 222);
  });
}

function makeAlertScreenTexture() {
  return canvasTexture(768, 384, (ctx, w, h) => {
    ctx.fillStyle = '#180b0b';
    ctx.fillRect(0, 0, w, h);
    const t = performance.now() / 1000;
    ctx.globalAlpha = 0.4;
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,113,58,.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.fillStyle = '#ffb28b';
    ctx.font = '500 17px "SFMono-Regular", monospace';
    ctx.fillText('CIVIL DEFENSE / EMERGENCY', 32, 52);
    ctx.fillStyle = '#ff4d38';
    ctx.font = '800 76px "DIN Condensed", "Arial Narrow", "PingFang SC", sans-serif';
    ctx.fillText('巨兽警报', 32, 145);
    ctx.fillStyle = 'rgba(255,216,186,.85)';
    ctx.font = '500 22px "SFMono-Regular", monospace';
    ctx.fillText('THREAT LEVEL: OMEGA', 34, 187);
    ctx.fillStyle = 'rgba(255, 73, 55, .85)';
    ctx.fillRect(32, 218, w - 64, 6);
    ctx.fillStyle = 'rgba(255,180,140,.65)';
    ctx.font = '500 16px "SFMono-Regular", monospace';
    ctx.fillText('EVACUATE THE PLAZA · 请立即撤离中央广场', 34, 262);
    for (let i = 0; i < 8; i++) {
      const alpha = 0.15 + 0.4 * Math.abs(Math.sin(t * 2 + i * 0.7));
      ctx.fillStyle = `rgba(255,78,53,${alpha})`;
      ctx.fillRect(34 + i * 86, 304, 64, 30);
    }
    ctx.fillStyle = 'rgba(255,220,200,.45)';
    ctx.font = '500 12px "SFMono-Regular", monospace';
    ctx.fillText(`SIGNAL ${String(Math.floor(t * 7) % 999).padStart(3, '0')} / UPLINK STABLE`, 34, 360);
  });
}

export class City {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.rng = makeRng(options.seed ?? 9317);
    this.buildings = [];
    this.people = [];
    this.cars = [];
    this.signs = [];
    this.screens = [];
    this.destroyedCount = 0;
    this.panic = false;
    this.panicOrigin = new THREE.Vector3(0, 0, 0);
    this.windowSpecs = [];
    this.treePlacements = [];
    this.furniturePlacements = [];
    this.roofSpecs = [];
    this.time = 0;
    this.riftActive = false;
    this.casualties = 0;
    this.tmp = new THREE.Object3D();
    this.tmp2 = new THREE.Object3D();

    this.materials = this.createMaterials();
    this.buildGround();
    this.buildStreets();
    this.buildBlocks();
    this.buildDistantSkyline();
    this.createWindows();
    this.createRooftops();
    this.buildSkylineNeon();
    this.buildPlazaDetails();
    this.streetFurniture = new StreetFurniture(this.group,this.furniturePlacements);
    this.urbanTrees = new UrbanTrees(this.group,this.treePlacements);
    this.createPeople();
    this.createCars();
    this.buildRift();
    this.buildScreens();
    this.panicApplied = false;
  }

  createMaterials() {
    const facadeColors = ['#b0b6b5','#d4d6ce','#9caeb7','#c1b9a6','#9da9af','#c6c5b8'];
    const facades = facadeColors.map(concreteMaterial);
    const trims = [
      new THREE.MeshStandardMaterial({ color: '#444c55', roughness: 0.42, metalness: 0.72 }),
      new THREE.MeshStandardMaterial({ color: '#5b4a43', roughness: 0.8, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: '#202a34', roughness: 0.36, metalness: 0.8 }),
    ];
    return {
      facades, trims,
      curtain: new THREE.MeshStandardMaterial({color:'#2c4552',roughness:.3,metalness:.12,envMapIntensity:.5}),
      sidewalk: new THREE.MeshStandardMaterial({ color: '#929994', roughness: 0.9, metalness: 0.06 }),
      curb: new THREE.MeshStandardMaterial({ color: '#b4b8af', roughness: 0.86, metalness: 0.05 }),
      asphalt: asphaltMaterial(),
      marking: new THREE.MeshBasicMaterial({ color: '#c4c2ab', transparent: true, opacity: 0.46, toneMapped: false }),
      markingYellow: new THREE.MeshBasicMaterial({ color: '#d8ab62', transparent: true, opacity: 0.4, toneMapped: false }),
      lamp: new THREE.MeshBasicMaterial({ color: '#ffdfaa', toneMapped: false }),
      pole: new THREE.MeshStandardMaterial({ color: '#252d31', roughness: 0.45, metalness: 0.7 }),
      treeTrunk: new THREE.MeshStandardMaterial({ color: '#3b2c22', roughness: 1 }),
      foliage: new THREE.MeshStandardMaterial({ color: '#27362d', roughness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ color: '#6d7377', roughness: 0.35, metalness: 0.82 }),
      rubber: new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.92, metalness: 0.1 }),
      glass: new THREE.MeshStandardMaterial({ color: '#0b1519', roughness: 0.18, metalness: 0.8 }),
      rubble: new THREE.MeshStandardMaterial({ color: '#2d2c2a', roughness: 0.95, metalness: 0.05 }),
      crack: new THREE.MeshBasicMaterial({ color: '#ff6b31', transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    };
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(430, 64),
      this.materials.asphalt
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    this.group.add(ground);

    // wet patches
    const puddleTex = glowTexture('#597a90', 0.35);
    const puddleMat = new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.08, color: '#6d9fb4', blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 22; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(this.rng.range(2, 9), 20), puddleMat);
      p.rotation.x = -Math.PI / 2;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(20, 130);
      p.position.set(Math.cos(a) * r, 0.005, Math.sin(a) * r);
      p.scale.set(1, this.rng.range(0.25, 0.6), 1);
      this.group.add(p);
    }

    // giant plaza disc
    const plazaTex = plazaTexture();
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex, color: '#d0c9b9', roughness: .95, metalness: .01,
    });
    this.plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_RADIUS + 2, 96), plazaMat);
    this.plaza.rotation.x = -Math.PI / 2;
    this.plaza.position.y = 0.09;
    this.plaza.receiveShadow = true;
    this.group.add(this.plaza);
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(PLAZA_RADIUS + 1.4, PLAZA_RADIUS + 2.8, 96),
      new THREE.MeshStandardMaterial({ color: '#596065', roughness: 0.42, metalness: 0.65 })
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.22;
    this.group.add(rim);

    // glowing inlay rings
    const ring1 = new THREE.Mesh(
      new THREE.RingGeometry(PLAZA_RADIUS - 1.5, PLAZA_RADIUS - 1.1, 96),
      new THREE.MeshBasicMaterial({ color: '#7cdde6', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.17;
    this.group.add(ring1);
    this.plazaRing = ring1;
    ring1.visible=false;

    // ring road
    const ringRoad = new THREE.Mesh(
      new THREE.RingGeometry(PLAZA_RADIUS + 4, PLAZA_RADIUS + 11, 96),
      new THREE.MeshStandardMaterial({ color: '#11171c', roughness: 0.55, metalness: 0.3 })
    );
    ringRoad.rotation.x = -Math.PI / 2;
    ringRoad.position.y = 0.015;
    this.group.add(ringRoad);
    // ring lane dashes
    const dashGeo = new THREE.BoxGeometry(0.3, 0.02, 2.2);
    const dashes = new THREE.InstancedMesh(dashGeo, this.materials.marking, 46);
    dashes.frustumCulled = false;
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      this.tmp.position.set(Math.cos(a) * (PLAZA_RADIUS + 7.5), 0.05, Math.sin(a) * (PLAZA_RADIUS + 7.5));
      this.tmp.rotation.set(0, -a, 0);
      this.tmp.updateMatrix();
      dashes.setMatrixAt(i, this.tmp.matrix);
    }
    this.group.add(dashes);
    // inner and outer solid rings
    for (const r of [PLAZA_RADIUS + 4.2, PLAZA_RADIUS + 10.8]) {
      const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.08, r + 0.08, 96), this.materials.marking);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.04;
      this.group.add(m);
    }
  }

  buildStreets() {
    const markGeo = new THREE.BoxGeometry(0.15, 0.02, 3.4);
    const marks = [];
    const positions = [];
    for (let i = -44; i <= 44; i++) {
      const along = i * 6.2;
      if (Math.abs(along) < PLAZA_RADIUS + 12) continue;
      for (const road of ROAD_LINES) {
        positions.push({ x: road, z: along, rot: 0 });
        positions.push({ x: along, z: road, rot: Math.PI / 2 });
      }
    }
    const inst = new THREE.InstancedMesh(markGeo, this.materials.marking, positions.length);
    inst.frustumCulled = false;
    let i = 0;
    for (const p of positions) {
      this.tmp.position.set(p.x, 0.045, p.z);
      this.tmp.rotation.set(0, p.rot, 0);
      this.tmp.updateMatrix();
      inst.setMatrixAt(i++, this.tmp.matrix);
    }
    this.group.add(inst);

    // yellow center stripes on main avenues
    const stripeGeo = new THREE.BoxGeometry(0.13, 0.02, 4.6);
    const stripes = [];
    for (const road of [-51, 51]) {
      for (let i = -60; i <= 60; i++) {
        const z = i * 8;
        if (Math.abs(z) < PLAZA_RADIUS + 12) continue;
        stripes.push({ x: road - 0.5, z });
        stripes.push({ x: road + 0.5, z });
      }
    }
    const inst2 = new THREE.InstancedMesh(stripeGeo, this.materials.markingYellow, stripes.length);
    inst2.frustumCulled = false;
    i = 0;
    for (const p of stripes) {
      this.tmp.position.set(p.x, 0.045, p.z);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.updateMatrix();
      inst2.setMatrixAt(i++, this.tmp.matrix);
    }
    this.group.add(inst2);

    // crosswalks on the ring road at four cardinal points
    const cwGeo = new THREE.BoxGeometry(0.7, 0.02, 3.2);
    const cw = [];
    for (const a of [0, 1, 2, 3]) {
      const angle = a * Math.PI / 2;
      for (let s = -3; s <= 3; s++) {
        const tangent = angle + Math.PI / 2;
        const cx = Math.cos(angle) * (PLAZA_RADIUS + 3);
        const cz = Math.sin(angle) * (PLAZA_RADIUS + 3);
        cw.push({
          x: cx + Math.cos(tangent) * s * 0.9,
          z: cz + Math.sin(tangent) * s * 0.9,
          rot: -angle,
        });
      }
    }
    const inst3 = new THREE.InstancedMesh(cwGeo, this.materials.marking, cw.length);
    i = 0;
    for (const p of cw) {
      this.tmp.position.set(p.x, 0.055, p.z);
      this.tmp.rotation.set(0, p.rot, 0);
      this.tmp.updateMatrix();
      inst3.setMatrixAt(i++, this.tmp.matrix);
    }
    this.group.add(inst3);

    // Manholes
    const mhMat = new THREE.MeshStandardMaterial({ color: '#1b1e20', roughness: 0.62, metalness: 0.5 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(this.rng.range(0.4, 0.65), 12), mhMat);
      m.rotation.x = -Math.PI / 2;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(18, 120);
      m.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
      this.group.add(m);
    }
  }

  buildBlocks() {
    this.blockCenters = [];
    for (const ix of CELL_RANGE) {
      for (const iz of CELL_RANGE) {
        const cx = ix * CELL_STEP;
        const cz = iz * CELL_STEP;
        if (Math.hypot(cx, cz) < 44) continue;
        this.blockCenters.push([cx, cz, Math.hypot(cx, cz)]);
        this.buildBlock(cx, cz, Math.hypot(cx, cz));
      }
    }
  }

  buildBlock(cx, cz, distance) {
    // sidewalk
    const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(28, 0.26, 28), this.materials.sidewalk);
    sidewalk.position.set(cx, 0.13, cz);
    sidewalk.receiveShadow = true;
    this.group.add(sidewalk);
    const curbGeo = new THREE.BoxGeometry(28.8, 0.24, 28.8);
    const curb = new THREE.Mesh(curbGeo, this.materials.curb);
    curb.position.set(cx, 0.1, cz);
    this.group.add(curb);

    const near = distance < 80;
    const slots = near
      ? [[-5.4, -5.4], [5.4, -5.4], [0, 5.5]]
      : [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]];
    let count = near ? (this.rng.chance(0.45) ? 3 : 2) : (this.rng.chance(0.55) ? 4 : 3);
    count = Math.min(count, slots.length);
    const used = [];
    for (let s = 0; s < count; s++) {
      let slot = slots[s];
      if (near && count === 2) slot = slots[s === 0 ? 0 : 3] || slots[1];
      if (used.includes(slot)) continue;
      used.push(slot);
      const w = this.rng.range(8.1, 9.9);
      const d = this.rng.range(8.1, 9.9);
      let h;
      if (distance < 60) {
        h = this.rng.range(6.5, 10);
      } else if (distance < 84) {
        h = this.rng.range(7, 11);
      } else {
        h = this.rng.range(24, 44) + Math.max(0, distance - 100) * 0.2;
        if (this.rng.chance(0.22)) h *= 1.4;
      }
      h = clamp(h, 6, 76);
      const px = cx + slot[0] + this.rng.range(-0.35, 0.35);
      const pz = cz + slot[1] + this.rng.range(-0.35, 0.35);
      this.addBuilding(px, pz, w, d, h, distance);
    }

    // block planters / benches: merged small details
    const props = [];
    const propPositions = [
      [cx - 11.8, cz - 3], [cx + 11.8, cz + 3], [cx - 11.8, cz + 8],
    ];
    for (const [px, pz] of propPositions) {
      if (this.rng.chance(0.45)) {
        this.treePlacements.push({x:px,z:pz,height:this.rng.range(5.5,8),yaw:this.rng.range(0,Math.PI*2)});
      }
    }
    // add these details as individual meshes; low count only
    for (const p of props) {
      const mesh = new THREE.Mesh(p.geo, this.materials[p.mat]);
      this.group.add(mesh);
    }
  }

  addBuilding(x, z, w, d, h, distance) {
    const style = Math.abs(Math.round(x * 13 + z * 7)) % 5;
    const curtain = h > 25 && style < 2;
    const setback = h > 30 && style === 3;
    const topScale = setback ? .72 : 1;
    const facade = curtain ? this.materials.curtain : this.rng.pick(this.materials.facades);
    const trim = this.rng.pick(this.materials.trims);
    const group = new THREE.Group();
    group.position.set(x, 0.26, z);
    const lowerH = setback ? h * .72 : h;
    const lower = new THREE.BoxGeometry(w, lowerH, d);
    scaleBuildingUV(lower,w,lowerH,d);
    lower.translate(0,lowerH/2,0);
    let mainGeo = lower;
    if(setback){
      const upper = new THREE.BoxGeometry(w*topScale,h-lowerH,d*topScale);
      scaleBuildingUV(upper,w*topScale,h-lowerH,d*topScale);
      upper.translate(0,lowerH+(h-lowerH)/2,0);
      mainGeo = mergeGeometries([lower,upper]);
      lower.dispose();upper.dispose();
    }
    const main = new THREE.Mesh(mainGeo, facade);
    main.position.y = 0;
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // horizontal floor bands + vertical corner ribs merged
    const trimGeos = [];
    const floors = Math.max(3, Math.floor(h / (curtain ? 3.2 : 6.5)));
    for (let i = 1; i < floors; i++) {
      const y = curtain ? 1.6 + i * 3.2 : (h / floors) * i;
      if(y>h-.4)continue;
      const levelScale = y > lowerH ? topScale : 1;
      const g = new THREE.BoxGeometry(w*levelScale + .12, curtain ? .13 : .1, d*levelScale + .12);
      g.translate(0, y, 0);
      trimGeos.push(g);
    }
    const ribH = lowerH;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.16, ribH, 0.16);
        g.translate((sx * (w / 2 - 0.2)), ribH / 2, (sz * (d / 2 - 0.2)));
        trimGeos.push(g);
      }
    }
    // roof lip
    const lip = new THREE.BoxGeometry(w*topScale + .4, .35, d*topScale + .4);
    lip.translate(0, h - 0.1, 0);
    trimGeos.push(lip);
    if(setback){
      const terrace=new THREE.BoxGeometry(w+.3,.3,d+.3);terrace.translate(0,lowerH,0);trimGeos.push(terrace);
    }
    // Recessed glazed lobby and entry canopy give the street level a readable scale.
    if(h>18){
      const lobby=new THREE.Mesh(new THREE.BoxGeometry(w+.12,2.5,d+.12),this.materials.glass);
      lobby.position.y=2.35;group.add(lobby);
      for(const sx of [-1,1])for(const sz of [-1,1]){
        const column=new THREE.BoxGeometry(.4,3.2,.4);column.translate(sx*(w/2+.25),1.6,sz*(d/2+.25));trimGeos.push(column);
      }
      const canopy=new THREE.BoxGeometry(w+.85,.22,1.5);canopy.translate(0,3.7,d/2+.3);trimGeos.push(canopy);
    }
    const trimMesh = new THREE.Mesh(mergeGeometries(trimGeos), trim);
    trimMesh.castShadow = true;
    group.add(trimMesh);

    // base plinth
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.9, 1.2, d + 0.9),
      new THREE.MeshStandardMaterial({ color: '#1b2024', roughness: 0.75, metalness: 0.2 })
    );
    base.position.y = 0.6;
    base.receiveShadow = true;
    group.add(base);

    const b = {
      group, main, trimMesh, base,
      x, z, w, d, h,
      center: new THREE.Vector3(x, h * 0.5, z),
      radius: Math.hypot(w, d) * 0.5,
      destroyed: false,
      state: 'intact',
      fallT: 0,
      fallDir: new THREE.Vector3(this.rng.range(-1, 1), 0, this.rng.range(-1, 1)).normalize(),
      windowStart: 0,
      windowCount: 0,
      extras: [],
    };

    // window specs
    const litWarm = this.rng.chance(0.56);
    const colors = litWarm
      ? ['#344652','#4b5f6d','#71828a','#3c4d55']
      : ['#627c8c','#425d70','#788d98','#4f6b7b'];
    const floorGap = curtain ? 3.2 : 3.05;
    const floorStart = 3.2;
    const floorsN = Math.max(2, Math.floor((h - 5) / floorGap));
    const makeFace = (faceW, axis, sign) => {
      const cols = Math.max(1, Math.floor((faceW - 2.4) / 2.3));
      const step = (faceW - 2.8) / Math.max(1, cols - 1);
      for (let fl = 0; fl < floorsN; fl++) {
        for (let col = 0; col < cols; col++) {
          if (!curtain && this.rng.chance(.015)) continue;
          let local = -faceW / 2 + 1.4 + col * step;
          const y = floorStart + fl * floorGap;
          if (y > h - 2.0) continue;
          const scale = y > lowerH ? topScale : 1;local *= scale;
          const lit = this.rng.chance(.82);
          const color = curtain ? ['#6c8795','#728d9b','#7a929e'][fl%3] : lit ? colors[(col+fl*3)%colors.length] : '#39566b';
          let px = x;
          let pz = z;
          let ry = 0;
          if (axis === 'z') {
            px += local;
            pz += sign * (d*scale / 2 + 0.03);
            ry = sign > 0 ? 0 : Math.PI;
          } else {
            px += sign * (w*scale / 2 + 0.03);
            pz += local;
            ry = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
          this.windowSpecs.push({
            building: b,
            x: px, y: y + 0.26, z: pz, ry,
            sx: (curtain ? step-.13 : 1.35)*scale, sy: curtain ? 2.85 : 1.65,
            color,
          });
        }
      }
    };
    makeFace(w, 'z', 1);
    makeFace(w, 'z', -1);
    makeFace(d, 'x', 1);
    makeFace(d, 'x', -1);

    // rooftop details specs
    this.roofSpecs.push({
      building: b,
      x, z, y: 0.26 + h,
      w:w*topScale, d:d*topScale, height: h,
    });

    // shop sign on buildings near plaza
    if (distance < 78 && this.rng.chance(0.34)) {
      const texts = ['新港', '拉面', '九龙', '夜行', 'MECHA', '电玩', '天台', '北岸'];
      const text = this.rng.pick(texts);
      const hues = ['#ff648d', '#61f2ff', '#ffb03b', '#a78bff', '#ff6b44'];
      const texture = makeNeonTexture(text, this.rng.pick(hues), this.rng.chance(0.5) ? 'NEW HARBOR' : '');
      const sw = this.rng.range(5.2, 8.2);
      const sh = sw * 0.31;
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, side: THREE.DoubleSide });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
      const dx = -x;
      const dz = -z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dx / len;
      const nz = dz / len;
      const hy = this.rng.range(5, Math.min(15, h - 4));
      sign.position.set(nx * (w / 2 + 0.25), hy, nz * (d / 2 + 0.25));
      sign.rotation.y = Math.atan2(nx, nz);
      group.add(sign);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(this.rng.pick(hues)), color: '#ffffff', transparent: true, opacity: 0.13,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      glow.scale.set(sw * 1.1, sh * 2.5, 1);
      glow.position.copy(sign.position);
      group.add(glow);
      b.extras.push(sign, glow);
    }

    this.group.add(group);
    this.buildings.push(b);
    return b;
  }

  createWindows() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = windowMaterial();
    const count = this.windowSpecs.length;
    this.windowMesh = new THREE.InstancedMesh(geo, mat, count);
    this.windowMesh.frustumCulled = false;
    this.windowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) {
      const s = this.windowSpecs[i];
      this.tmp.position.set(s.x, s.y, s.z);
      this.tmp.rotation.set(0, s.ry, 0);
      this.tmp.scale.set(s.sx, s.sy, 1);
      this.tmp.updateMatrix();
      this.windowMesh.setMatrixAt(i, this.tmp.matrix);
      this.windowMesh.setColorAt(i, new THREE.Color(s.color));
    }
    this.windowMesh.instanceColor.needsUpdate = true;
    this.group.add(this.windowMesh);
    // assign window ranges
    let idx = 0;
    let cur = null;
    for (const s of this.windowSpecs) {
      if (cur !== s.building) {
        cur = s.building;
        cur.windowStart = idx;
      }
      idx++;
      cur.windowCount = idx - cur.windowStart;
    }
    this.windowCount = count;
  }

  createRooftops() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const unitMat = new THREE.MeshStandardMaterial({ color: '#5b6367', roughness: 0.68, metalness: 0.4 });
    const inst = new THREE.InstancedMesh(boxGeo, unitMat, this.roofSpecs.length * 2);
    const antennaMat = new THREE.MeshStandardMaterial({ color: '#9b9b90', roughness: 0.45, metalness: 0.7 });
    const antennaGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 4);
    const antennas = new THREE.InstancedMesh(antennaGeo, antennaMat, this.roofSpecs.length);
    this.roofUnits = inst;
    this.roofAntennas = antennas;
    let ui = 0, ai = 0;
    for (const r of this.roofSpecs) {
      const w = r.w * this.rng.range(0.16, 0.28);
      const h = this.rng.range(0.8, 2.2);
      const d = r.d * this.rng.range(0.16, 0.26);
      for (let k = 0; k < 2; k++) {
        this.tmp.position.set(
          r.x + this.rng.range(-r.w * 0.26, r.w * 0.26),
          r.y + h / 2 + 0.15,
          r.z + this.rng.range(-r.d * 0.26, r.d * 0.26)
        );
        this.tmp.rotation.set(0, this.rng.range(0, 0.2), 0);
        this.tmp.scale.set(w, h, d);
        this.tmp.updateMatrix();
        inst.setMatrixAt(ui++, this.tmp.matrix);
      }
      const ah = this.rng.range(2, 7);
      this.tmp.position.set(r.x + this.rng.range(-2, 2), r.y + ah / 2, r.z + this.rng.range(-2, 2));
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.scale.set(1, ah, 1);
      this.tmp.updateMatrix();
      antennas.setMatrixAt(ai++, this.tmp.matrix);
      r.building.roofUnitIndex = (ui - 2);
      r.building.roofAntennaIndex = (ai - 1);
    }
    inst.frustumCulled = false;
    antennas.frustumCulled = false;
    this.group.add(inst, antennas);
  }


  buildSkylineNeon() {
    const hues = ['#64f1ff', '#ff5f9d', '#ffb33c', '#9c8bff', '#ff7447'];
    const candidates = this.buildings.filter((b) => b.h > 18 && Math.hypot(b.x, b.z) < 155);
    const rng = this.rng;
    this.neonStrips = [];
    let added = 0;
    for (const b of candidates) {
      if (added > 32) break;
      if (!rng.chance(0.42)) continue;
      const axis = Math.abs(b.x) >= Math.abs(b.z) ? 'x' : 'z';
      const sign = axis === 'x' ? -Math.sign(b.x || 1) : -Math.sign(b.z || 1);
      const color = rng.pick(hues);
      const hgt = b.h * rng.range(0.26, 0.52);
      const y = rng.range(b.h * 0.35, Math.max(b.h * 0.36, b.h * 0.72));
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(rng.range(0.22, 0.45), hgt),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, toneMapped: false })
      );
      if (axis === 'x') {
        strip.position.set(sign * (b.w / 2 + 0.08), y, rng.range(-b.d * 0.3, b.d * 0.3));
        strip.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        strip.position.set(rng.range(-b.w * 0.3, b.w * 0.3), y, sign * (b.d / 2 + 0.08));
        strip.rotation.y = sign > 0 ? 0 : Math.PI;
      }
      b.group.add(strip);
      b.extras.push(strip);
      this.neonStrips.push(strip);
      added++;
      // one larger sign on the taller towers
      if (b.h > 32 && rng.chance(0.5)) {
        const texts = ['新港港务', 'HARBOR', 'TRANSIT', '新港银行', '九龙', '北岸', '港湾物流'];
        const tex = makeNeonTexture(rng.pick(texts), color, rng.chance(0.45) ? 'NEW HARBOR' : '');
        const sw = rng.range(7, 11.5);
        const sh = sw * 0.34;
        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(sw, sh),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide })
        );
        board.position.set(
          axis === 'x' ? sign * (b.w / 2 + 0.12) : rng.range(-b.w * 0.2, b.w * 0.2),
          rng.range(b.h * 0.55, b.h * 0.82),
          axis === 'x' ? rng.range(-b.d * 0.2, b.d * 0.2) : sign * (b.d / 2 + 0.12)
        );
        board.rotation.y = axis === 'x' ? (sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (sign > 0 ? 0 : Math.PI);
        b.group.add(board);
        b.extras.push(board);
      }
    }
    // rooftop beacons on the distant skyline
    for (let i = 0; i < 28; i++) {
      const b = candidates[i % Math.max(1, candidates.length)];
      if (!b) break;
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(rng.pick(hues)), color: rng.pick(hues), transparent: true, opacity: 0.08,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      beacon.scale.set(1.4, 1.4, 1);
      beacon.position.set(rng.range(-b.w * 0.3, b.w * 0.3), b.h + 0.8, rng.range(-b.d * 0.3, b.d * 0.3));
      b.group.add(beacon);
      b.extras.push(beacon);
    }
  }

  buildPlazaDetails() {
    // monument that will be shattered by the kaiju
    this.monument = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#555a5d', roughness: 0.7, metalness: 0.15 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 1.3, 12), stone);
    base.position.y = 0.8;
    this.monument.add(base);
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.4, 15, 4), stone);
    obelisk.position.y = 8.2;
    obelisk.rotation.y = Math.PI / 4;
    this.monument.add(obelisk);
    this.monument.position.y = 0.2;
    this.group.add(this.monument);
    // Street furniture shares the same breakable instance system as road lamps.
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4+.13,r=PLAZA_RADIUS-5;
      this.furniturePlacements.push({kind:'bench',x:Math.cos(a)*r,z:Math.sin(a)*r,yaw:-a+Math.PI/2});
    }

    // planters with trees around plaza
    const potGeo = new THREE.BoxGeometry(2.4, 0.8, 2.4);
    const potMat = new THREE.MeshStandardMaterial({ color: '#303335', roughness: 0.8, metalness: 0.15 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.36;
      const x = Math.cos(a) * (PLAZA_RADIUS - 4.2);
      const z = Math.sin(a) * (PLAZA_RADIUS - 4.2);
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.set(x, 0.45, z);
      pot.rotation.y = a;
      pot.castShadow = true;
      this.group.add(pot);
      this.treePlacements.push({x,z,y:.8,height:this.rng.range(6,8),yaw:a});
    }

    // street lights around ring
    const lampPositions = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      lampPositions.push([Math.cos(a) * (PLAZA_RADIUS + 12.6), Math.sin(a) * (PLAZA_RADIUS + 12.6)]);
    }
    for (const c of this.blockCenters) {
      lampPositions.push([c[0] + 13.8, c[1] + 12.2]);
    }
    for(const [x,z]of lampPositions)this.furniturePlacements.push({kind:'lamp',x,z,yaw:0});
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4+.4,r=PLAZA_RADIUS+2.4;
      this.furniturePlacements.push({kind:'barrier',x:Math.cos(a)*r,z:Math.sin(a)*r,yaw:-a+Math.PI/2});
    }
  }

  buildDistantSkyline() {
    // Real destructible towers replace the old decorative instanced backdrop.
    const rng = makeRng(501);
    for (let i = 0; i < 44; i++) {
      const a = i * Math.PI * 2 / 44;
      const r = rng.range(163, 216);
      this.addBuilding(Math.cos(a) * r, Math.sin(a) * r,
        rng.range(10, 17), rng.range(10, 17), rng.range(32, 78), r);
    }
  }

  createPeople() {
    const count = 92;
    this.peopleCount = count;
    const rng = this.rng;
    const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.34, 3, 6);
    const headGeo = new THREE.SphereGeometry(0.18, 7, 6);
    const legGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
    legGeo.translate(0, -0.31, 0);
    const armGeo = new THREE.BoxGeometry(0.11, 0.55, 0.12);
    armGeo.translate(0, -0.275, 0);
    const coatMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.72, metalness: 0.02 });
    const headMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#1b2026', roughness: 0.85 });
    this.personMeshes = {
      body: new THREE.InstancedMesh(bodyGeo, coatMat, count),
      head: new THREE.InstancedMesh(headGeo, headMat, count),
      legL: new THREE.InstancedMesh(legGeo, legMat, count),
      legR: new THREE.InstancedMesh(legGeo, legMat, count),
      armL: new THREE.InstancedMesh(armGeo, legMat, count),
      armR: new THREE.InstancedMesh(armGeo, legMat, count),
    };
    for (const m of Object.values(this.personMeshes)) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    for (let i = 0; i < count; i++) {
      const inPlaza = i < 16;
      let route = null;
      let x, z;
      if (inPlaza) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(6, 24);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        route = null;
      } else {
        const block = rng.pick(this.blockCenters);
        const side = rng.int(0, 3);
        const hw = 13.4;
        const corners = [
          new THREE.Vector3(block[0] - hw, 0, block[1] - hw),
          new THREE.Vector3(block[0] + hw, 0, block[1] - hw),
          new THREE.Vector3(block[0] + hw, 0, block[1] + hw),
          new THREE.Vector3(block[0] - hw, 0, block[1] + hw),
        ];
        route = { corners, index: side, t: rng.range(0, 1), loop: true };
        x = corners[side].x;
        z = corners[side].z;
      }
      const person = {
        pos: new THREE.Vector3(x, 0.26, z),
        heading: rng.range(0, Math.PI * 2),
        phase: rng.range(0, Math.PI * 2),
        speed: rng.range(1.2, 2.1),
        state: 'walk',
        scale: rng.pick(CIVILIAN_HEIGHTS),
        panicSpeed: rng.range(3.4, 6.6),
        panicDir: new THREE.Vector3(),
        color: new THREE.Color(rng.pick(JACKETS)),
        skin: new THREE.Color(rng.pick(SKIN)),
        route,
        bob: rng.range(0, 10),
        variant: rng.pick([0, 1, 2]),
        hidden: false,
      };
      if (inPlaza) {
        const angle = rng.range(0, Math.PI * 2);
        person.circle = { radius: rng.range(8, 25), angle, speed: rng.range(0.04, 0.12) * (rng.chance(0.5) ? 1 : -1) };
      }
      this.people.push(person);
      const body = this.personMeshes.body;
      body.setColorAt(i, person.color);
      this.personMeshes.head.setColorAt(i, person.skin);
    }
    this.personMeshes.body.instanceColor.needsUpdate = true;
    this.personMeshes.head.instanceColor.needsUpdate = true;
    this.updatePeople(0);
  }

  createCars() {
    const count = 26;
    this.carCount = count;
    const bodyGeo = new THREE.BoxGeometry(1.9, 0.5, 4.2);
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.46, 1.7);
    const wheelGeo = new THREE.BoxGeometry(0.22, 0.6, 0.6);
    const lightGeo = new THREE.BoxGeometry(0.42, 0.12, 0.08);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.56 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: '#0a1116', roughness: 0.12, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#080a0b', roughness: 0.9 });
    const headMat = new THREE.MeshBasicMaterial({ color: '#fff1c9', toneMapped: false });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2d2a', toneMapped: false });
    this.carMeshes = {
      body: new THREE.InstancedMesh(bodyGeo, bodyMat, count),
      cabin: new THREE.InstancedMesh(cabinGeo, cabinMat, count),
      wheels: new THREE.InstancedMesh(wheelGeo, wheelMat, count * 4),
      head: new THREE.InstancedMesh(lightGeo, headMat, count * 2),
      tail: new THREE.InstancedMesh(lightGeo, tailMat, count * 2),
    };
    for (const m of Object.values(this.carMeshes)) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    for (let i = 0; i < count; i++) {
      let car;
      if (i < 5) {
        car = {
          mode: 'ring',
          angle: this.rng.range(0, Math.PI * 2),
          radius: PLAZA_RADIUS + 7.4,
          dir: this.rng.chance(0.5) ? 1 : -1,
          speed: this.rng.range(0.07, 0.15),
          yaw: 0,
          x: 0, z: 0,
        };
      } else {
        const vertical = this.rng.chance(0.5);
        const road = this.rng.pick([-85, -51, 51, 85]);
        const dir = this.rng.chance(0.5) ? 1 : -1;
        const lane = road + dir * 1.8;
        const along = this.rng.range(-140, 140);
        car = {
          mode: 'road',
          vertical,
          lane,
          along,
          dir,
          speed: this.rng.range(6, 12),
          yaw: 0,
          x: 0, z: 0,
        };
      }
      car.color = new THREE.Color(this.rng.pick(CAR_COLORS));
      car.panic = false;
      car.hidden = false;
      this.cars.push(car);
      this.carMeshes.body.setColorAt(i, car.color);
    }
    this.carMeshes.body.instanceColor.needsUpdate = true;
    this.updateCars(0);
  }

  buildRift() {
    this.rift = new THREE.Group();
    this.rift.visible = false;
    this.rift.position.y = 0.16;
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(17, 48),
      new THREE.MeshBasicMaterial({ map:scorchTexture(),color:'#55534b',transparent:true,opacity:.85,depthWrite:false })
    );
    hole.rotation.x = -Math.PI / 2;
    this.rift.add(hole);
    const fracture = canvasTexture(512,512,(ctx,w,h)=>{
      const rng=makeRng(817);ctx.clearRect(0,0,w,h);
      for(let n=0;n<22;n++){
        let x=w/2+rng.range(-100,100),y=h/2+rng.range(-100,100),a=rng.range(0,Math.PI*2);
        ctx.beginPath();ctx.moveTo(x,y);
        for(let j=0;j<6;j++){a+=rng.range(-.8,.8);x+=Math.cos(a)*rng.range(12,35);y+=Math.sin(a)*rng.range(12,35);ctx.lineTo(x,y);}
        ctx.strokeStyle=n%3===0?'rgba(255,107,30,.7)':'rgba(28,25,21,.9)';ctx.lineWidth=n%3===0?1.5:3;ctx.stroke();
      }
    });
    const magma = new THREE.Mesh(new THREE.CircleGeometry(14,48),new THREE.MeshBasicMaterial({map:fracture,transparent:true,opacity:.72,depthWrite:false}));
    magma.rotation.x = -Math.PI / 2;
    magma.position.y = 0.03;
    this.rift.add(magma);
    this.riftMagma = magma;
    // debris rim
    for (let i = 0; i < 18; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(9, 17);
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(this.rng.range(0.3, 1.4), 0),
        this.materials.rubble
      );
      rock.position.set(Math.cos(a) * r, this.rng.range(0, 0.4), Math.sin(a) * r);
      rock.rotation.set(this.rng.range(0, 3), this.rng.range(0, 3), 0);
      rock.castShadow = true;
      this.rift.add(rock);
    }
    this.group.add(this.rift);
  }

  buildScreens() {
    this.screenCanvas = makeCanvas(768, 384);
    this.screenCtx = this.screenCanvas.getContext('2d');
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenUpdateAt = 0;
    // initial frame
    this.drawScreenFrame(false);
    this.screenTexture.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false });
    const candidates = this.buildings
      .filter((b) => b.h > 24 && Math.hypot(b.x, b.z) < 90)
      .sort((a, b) => b.h - a.h)
      .slice(0, 3);
    for (const b of candidates) {
      const dx = -b.x, dz = -b.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dx / len, nz = dz / len;
      const sw = Math.min(13.5, b.w * 0.75);
      const sh = sw * 0.5;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(sw + 0.7, sh + 0.7, 0.3),
        new THREE.MeshStandardMaterial({ color: '#0b1013', metalness: 0.5, roughness: 0.5 })
      );
      frame.position.set(nx * (b.w / 2 + 0.36), b.h - 8, nz * (b.d / 2 + 0.36));
      frame.rotation.y = Math.atan2(nx, nz);
      b.group.add(frame);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
      screen.position.set(nx * (b.w / 2 + 0.53), b.h - 8, nz * (b.d / 2 + 0.53));
      screen.rotation.y = Math.atan2(nx, nz);
      b.group.add(screen);
      b.extras.push(frame, screen);
      this.screens.push({ screen, building: b });
    }
  }

  drawScreenFrame(alert) {
    const ctx = this.screenCtx;
    const w = this.screenCanvas.width;
    const h = this.screenCanvas.height;
    if (!ctx) return;
    if (!alert) {
      ctx.fillStyle = '#071014';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(99,245,255,.1)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = 'rgba(99,245,255,.7)';
      ctx.font = '500 15px "SFMono-Regular", monospace';
      ctx.fillText('NEW HARBOR // PUBLIC NETWORK', 26, 42);
      ctx.fillStyle = '#ffca8e';
      ctx.font = '800 66px "DIN Condensed", "Arial Narrow", "PingFang SC", sans-serif';
      ctx.fillText('晴空 · 城市通行正常', 26, 128);
      ctx.fillStyle = 'rgba(160, 225, 235, .52)';
      ctx.font = '500 19px "SFMono-Regular", monospace';
      ctx.fillText('12:30 / 24°C / 东南风 3 级', 28, 166);
      ctx.strokeStyle = 'rgba(99,245,255,.22)';
      ctx.beginPath(); ctx.moveTo(26, 202); ctx.lineTo(w - 26, 202); ctx.stroke();
      ctx.fillStyle = 'rgba(99,245,255,.26)';
      for (let i = 0; i < 34; i++) ctx.fillRect(28 + i * 21, 226, 2 + Math.random() * 12, 62);
      ctx.fillStyle = 'rgba(99,245,255,.55)';
      ctx.font = '500 13px "SFMono-Regular", monospace';
      ctx.fillText('HONG KONG NEW HARBOR · TRANSIT LIVE', 28, 327);
    } else {
      const t = performance.now() / 1000;
      ctx.fillStyle = '#1b0908';
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 4) { ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(0, y, w, 1); }
      ctx.fillStyle = '#ffbd97';
      ctx.font = '500 15px "SFMono-Regular", monospace';
      ctx.fillText('CIVIL DEFENSE / LEVEL OMEGA', 26, 42);
      ctx.fillStyle = '#ff4938';
      ctx.font = '800 72px "DIN Condensed", "Arial Narrow", "PingFang SC", sans-serif';
      ctx.fillText('巨兽警报', 26, 135);
      ctx.fillStyle = 'rgba(255,215,185,.8)';
      ctx.font = '500 18px "SFMono-Regular", monospace';
      ctx.fillText('EVACUATE ALL CIVILIANS', 28, 174);
      ctx.fillStyle = `rgba(255,80,55,${0.35 + Math.abs(Math.sin(t * 3)) * 0.5})`;
      ctx.fillRect(26, 205, w - 52, 8);
      ctx.fillStyle = 'rgba(255,150,105,.7)';
      ctx.font = '500 15px "SFMono-Regular", monospace';
      ctx.fillText('SHELTER IN PLACE OR EVACUATE VIA ROUTE 4', 28, 252);
      ctx.fillStyle = 'rgba(255,80,55,.28)';
      for (let i = 0; i < 12; i++) {
        if (Math.floor(t * 4) % 12 === i) ctx.fillStyle = 'rgba(255,80,55,.7)';
        ctx.fillRect(26 + i * 57, 282, 40, 36);
      }
    }
    ctx.strokeStyle = 'rgba(130,235,255,.2)';
    ctx.strokeRect(8, 8, w - 16, h - 16);
    this.screenTexture.needsUpdate = true;
  }

  openRift() {
    this.riftActive = true;
    this.rift.visible = true;
    this.monument.visible = false;
    // destroy two nearest buildings for a dramatic entrance
    const near = this.buildings
      .filter((b) => !b.destroyed)
      .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))
      .slice(0, 2);
    for (const b of near) this.destroyBuilding(b, new THREE.Vector3(0, 0, 0), false);
    this.drawScreenFrame(true);
    return near;
  }

  setPanic(origin) {
    if (this.panic) return;
    this.panic = true;
    this.panicOrigin.copy(origin);
    for (const p of this.people) {
      p.state = 'flee';
      p.panicDir.set(p.pos.x - origin.x, 0, p.pos.z - origin.z);
      if (p.panicDir.lengthSq() < 0.01) p.panicDir.set(rand(-1, 1), 0, rand(-1, 1));
      p.panicDir.normalize();
      if (p.circle) {
        p.circle = null;
      }
    }
    for (const c of this.cars) {
      c.panic = true;
      c.speed *= c.mode === 'ring' ? 1.25 : 1.5;
    }
    for (const s of this.screens) {
      // screens share texture
    }
    this.drawScreenFrame(true);
  }

  destroyBuilding(b, impactOrigin = null, silent = false) {
    if (!b || b.destroyed) return false;
    b.destroyed = true;
    b.state = 'falling';
    b.fallT = 0;
    this.destroyedCount++;
    const dir = impactOrigin ? new THREE.Vector3(b.x - impactOrigin.x, 0, b.z - impactOrigin.z).normalize() : b.fallDir;
    b.fallDir.copy(dir);
    if(b.fallDir.lengthSq()<.01)b.fallDir.set(1,0,0);
    // Replace the intact shell with floor clusters. Keep volume above ground,
    // rather than scaling a whole tower down into the pavement.
    b.collapseGroup=new THREE.Group();
    b.collapseGroup.position.set(b.x,.26,b.z);
    this.group.add(b.collapseGroup);
    b.collapseParts=[];
    const collapseMaterial=b.main.material.clone();
    collapseMaterial.opacity=1;collapseMaterial.transparent=false;collapseMaterial.depthWrite=true;
    const count=Math.max(3,Math.min(9,Math.ceil(b.h/7))),height=b.h/count;
    for(let i=0;i<count;i++)for(let half=0;half<2;half++){
      const cluster=new THREE.Group();
      const width=b.w*.47;
      const shellGeo=new THREE.BoxGeometry(width,height*.75,b.d*.94);
      scaleBuildingUV(shellGeo,width,height*.75,b.d);
      const shell=new THREE.Mesh(shellGeo,collapseMaterial);
      shell.castShadow=shell.receiveShadow=true;cluster.add(shell);
      for(const sign of [-1,1]){
        const slab=new THREE.Mesh(new THREE.BoxGeometry(width+.15,.38,b.d+.15),this.materials.rubble);
        slab.position.y=sign*height*.40;slab.castShadow=slab.receiveShadow=true;cluster.add(slab);
      }
      cluster.position.set((half-.5)*b.w*.5,(i+.5)*height,0);
      b.collapseGroup.add(cluster);
      b.collapseParts.push({mesh:cluster,delay:i*.065+half*.025,velocity:0,index:i,half,height,width,landed:false,
        drift:(half===0?-1:1)*(1.2+i*.35)});
    }
    b.group.visible=false;
    // knock out windows
    const arr = this.windowMesh.instanceMatrix.array;
    for (let i = 0; i < b.windowCount; i++) {
      const idx = (b.windowStart + i) * 16;
      for (let k = 0; k < 16; k++) arr[idx + k] = 0;
    }
    this.windowMesh.instanceMatrix.needsUpdate = true;
    for (const e of b.extras) e.visible = false;
    if (this.roofUnits && b.roofUnitIndex != null) {
      for (let k = 0; k < 2; k++) {
        const idx = (b.roofUnitIndex + k) * 16;
        for (let j = 0; j < 16; j++) this.roofUnits.instanceMatrix.array[idx + j] = 0;
      }
      const aidx = b.roofAntennaIndex * 16;
      for (let j = 0; j < 16; j++) this.roofAntennas.instanceMatrix.array[aidx + j] = 0;
      this.roofUnits.instanceMatrix.needsUpdate = true;
      this.roofAntennas.instanceMatrix.needsUpdate = true;
    }
    // rubble pile
    const rubbleGroup = new THREE.Group();
    rubbleGroup.position.set(b.x, 0.26, b.z);
    rubbleGroup.visible = true;
    b.rubble = rubbleGroup;
    const rng = mulberry32(Math.floor(b.x * 44 + b.z * 91) + 9);
    for (let i = 0; i < 9; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(rng() * 2.4 + 0.7, 0),
        this.materials.rubble
      );
      rock.position.set((rng() - 0.5) * b.w * 1.15, rng() * 1.1 + 0.2, (rng() - 0.5) * b.d * 1.15);
      rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rock.scale.y = rng() * 0.6 + 0.4;
      rock.castShadow = true;
      rock.receiveShadow = true;
      rubbleGroup.add(rock);
    }
    // rebar
    const rebarMat = new THREE.MeshStandardMaterial({ color: '#5f4e40', roughness: 0.7, metalness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, rng() * 4 + 1.5, 4), rebarMat);
      bar.position.set((rng() - 0.5) * b.w, 1.5, (rng() - 0.5) * b.d);
      bar.rotation.set((rng() - 0.5) * 1.3, rng() * 3, (rng() - 0.5) * 1.3);
      rubbleGroup.add(bar);
    }
    this.group.add(rubbleGroup);
    b.rubble = rubbleGroup;
    if (!silent && this.options.onBuildingDestroyed) {
      this.options.onBuildingDestroyed(b);
    }
    return true;
  }

  footprintDistance(b, pos) {
    return Math.hypot(Math.max(0, Math.abs(pos.x - b.x) - b.w / 2),
      Math.max(0, Math.abs(pos.z - b.z) - b.d / 2));
  }

  damageBuilding(b, amount, origin) {
    if (!b || b.destroyed || amount <= 0) return false;
    b.maxHealth ??= 65 + b.h * 1.25;
    b.health = (b.health ?? b.maxHealth) - amount;
    // A damaged facade darkens before the tower collapses.
    if (!b.damageMaterial) {
      if (!b.cameraFadeMaterials) b.main.material = b.main.material.clone();
      b.damageMaterial = b.main.material;
    }
    b.damageMaterial.color.multiplyScalar(Math.max(.92, 1 - amount / b.maxHealth * .18));
    return b.health <= 0 ? this.destroyBuilding(b, origin) : false;
  }

  damageRadius(pos, radius, amount, origin = pos) {
    if(amount>0){
      this.urbanTrees?.crush(pos,radius);
      this.streetFurniture?.sweep(pos,pos,radius,p=>this.options.onStreetBreak?.(p));
    }
    let hits = 0;
    for (const b of this.buildings) {
      if (!b.destroyed && this.footprintDistance(b, pos) < radius) {
        this.damageBuilding(b, amount, origin); hits++;
      }
    }
    return hits;
  }

  damageSegment(from, to, radius, amount) {
    const delta = to.clone().sub(from); delta.y = 0;
    const lengthSq = delta.lengthSq();
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      const t = Math.max(0, Math.min(1, ((b.x - from.x) * delta.x + (b.z - from.z) * delta.z) / (lengthSq || 1)));
      const nearest = from.clone().addScaledVector(delta, t);
      if (this.footprintDistance(b, nearest) < radius) this.damageBuilding(b, amount, from);
    }
  }

  findBuildingNear(pos, maxDistance = 70) {
    let best = null;
    let bestD = maxDistance;
    for (const b of this.buildings) {
      if (b.destroyed) continue;
      const d = this.footprintDistance(b, pos);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  intactBuildings() {
    return this.buildings.filter((b) => !b.destroyed);
  }

  updatePeople(dt) {
    const meshes = this.personMeshes;
    if (!meshes) return;
    const t = this.time ?? 0;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      if (p.state === 'flee') {
        p.pos.x += p.panicDir.x * p.panicSpeed * dt;
        p.pos.z += p.panicDir.z * p.panicSpeed * dt;
        p.heading = dampAngle(p.heading, Math.atan2(p.panicDir.x, p.panicDir.z), 5, dt);
        p.phase += dt * p.panicSpeed * 2.4;
        p.bob += dt * 11;
        p.speed = p.panicSpeed;
        if (Math.hypot(p.pos.x, p.pos.z) > 150) {
          p.hidden = true;
        }
      } else if (p.circle) {
        p.circle.angle += p.circle.speed * dt;
        p.pos.x = Math.cos(p.circle.angle) * p.circle.radius;
        p.pos.z = Math.sin(p.circle.angle) * p.circle.radius;
        p.heading = -p.circle.angle + (p.circle.speed > 0 ? Math.PI : 0);
        p.phase += dt * 1.7;
        p.bob += dt * 5;
        p.speed = 1;
      } else if (p.route) {
        const route = p.route;
        const from = route.corners[route.index];
        const to = route.corners[(route.index + 1) % 4];
        const dx = to.x - p.pos.x;
        const dz = to.z - p.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.32) {
          p.route.index = (p.route.index + 1) % 4;
        } else {
          const spd = p.speed;
          p.pos.x += (dx / dist) * spd * dt;
          p.pos.z += (dz / dist) * spd * dt;
          p.heading = dampAngle(p.heading, Math.atan2(dx, dz), 6, dt);
        }
        p.phase += dt * 4.7;
        p.bob += dt * 5;
      }
      if (p.hidden) {
        for (const m of Object.values(meshes)) {
          this.tmp.position.set(0, -50, 0);
          this.tmp.scale.set(0.001, 0.001, 0.001);
          this.tmp.updateMatrix();
          m.setMatrixAt(i, this.tmp.matrix);
          m.instanceMatrix.needsUpdate = true;
        }
        continue;
      }
      const swing = Math.sin(p.phase) * (p.state === 'flee' ? 0.75 : 0.48);
      const bob = Math.abs(Math.sin(p.phase)) * 0.045;
      const baseY = p.pos.y + bob;
      const cosH = Math.cos(p.heading);
      const sinH = Math.sin(p.heading);
      // body
      this.tmp.position.set(p.pos.x, baseY + 1.02 * p.scale, p.pos.z);
      this.tmp.rotation.set(0.035, p.heading, 0);
      this.tmp.scale.set(p.scale, p.scale, p.scale);
      this.tmp.updateMatrix();
      meshes.body.setMatrixAt(i, this.tmp.matrix);
      // head
      this.tmp.position.set(p.pos.x - sinH * 0.03, baseY + 1.55 * p.scale, p.pos.z - cosH * 0.03);
      this.tmp.rotation.set(0, p.heading, 0);
      this.tmp.scale.set(p.scale, p.scale, p.scale);
      this.tmp.updateMatrix();
      meshes.head.setMatrixAt(i, this.tmp.matrix);
      // legs
      const hipY = baseY + 0.67 * p.scale;
      const legSwing = p.state === 'flee' ? swing : swing;
      const lateral = 0.16 * p.scale;
      // left leg
      this.tmp.position.set(p.pos.x + cosH * lateral, hipY, p.pos.z - sinH * lateral);
      this.tmp.rotation.set(legSwing, p.heading, 0, 'YXZ');
      this.tmp.scale.set(p.scale, p.scale, p.scale);
      this.tmp.updateMatrix();
      meshes.legL.setMatrixAt(i, this.tmp.matrix);
      // right leg
      this.tmp.position.set(p.pos.x - cosH * lateral, hipY, p.pos.z + sinH * lateral);
      this.tmp.rotation.set(-legSwing, p.heading, 0, 'YXZ');
      this.tmp.updateMatrix();
      meshes.legR.setMatrixAt(i, this.tmp.matrix);
      // arms (swing opposite)
      const shoulderY = baseY + 1.33 * p.scale;
      const armLift = p.state === 'flee' ? -1.65 : 0.1;
      this.tmp.position.set(p.pos.x + cosH * (0.32 * p.scale), shoulderY, p.pos.z - sinH * (0.32 * p.scale));
      this.tmp.rotation.set(p.state === 'flee' ? armLift + Math.sin(p.phase) * 0.3 : -swing * 0.7, p.heading, 0, 'YXZ');
      this.tmp.updateMatrix();
      meshes.armL.setMatrixAt(i, this.tmp.matrix);
      this.tmp.position.set(p.pos.x - cosH * (0.32 * p.scale), shoulderY, p.pos.z + sinH * (0.32 * p.scale));
      this.tmp.rotation.set(p.state === 'flee' ? armLift - Math.sin(p.phase) * 0.3 : swing * 0.7, p.heading, 0, 'YXZ');
      this.tmp.updateMatrix();
      meshes.armR.setMatrixAt(i, this.tmp.matrix);
    }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
  }

  updateCars(dt) {
    const meshes = this.carMeshes;
    if (!meshes) return;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (c.mode === 'ring') {
        c.angle += c.dir * c.speed * dt * (c.panic ? 1.6 : 1);
        c.x = Math.cos(c.angle) * c.radius;
        c.z = Math.sin(c.angle) * c.radius;
        c.yaw = -c.angle + (c.dir > 0 ? 0 : Math.PI);
      } else {
        c.along += c.dir * c.speed * dt * (c.panic ? 1.5 : 1);
        if (c.along > 155) c.along = -155;
        if (c.along < -155) c.along = 155;
        if (c.vertical) {
          c.x = c.lane;
          c.z = c.along;
          c.yaw = c.dir > 0 ? 0 : Math.PI;
        } else {
          c.x = c.along;
          c.z = c.lane;
          c.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // body
      this.tmp.position.set(c.x, 0.83, c.z);
      this.tmp.rotation.set(0, c.yaw, 0);
      this.tmp.scale.set(1, 1, 1);
      this.tmp.updateMatrix();
      meshes.body.setMatrixAt(i, this.tmp.matrix);
      // cabin
      this.tmp.position.set(c.x, 1.28, c.z);
      this.tmp.rotation.set(0, c.yaw, 0);
      this.tmp.updateMatrix();
      meshes.cabin.setMatrixAt(i, this.tmp.matrix);
      // wheels
      const cos = Math.cos(c.yaw);
      const sin = Math.sin(c.yaw);
      let w = 0;
      for (const sx of [-1, 1]) {
        for (const sz of [-1.35, 1.35]) {
          const lx = sx * 0.98;
          const lz = sz;
          const wx = c.x + lx * cos + lz * sin;
          const wz = c.z - lx * sin + lz * cos;
          this.tmp.position.set(wx, 0.37, wz);
          this.tmp.rotation.set(0, c.yaw, 0);
          this.tmp.updateMatrix();
          meshes.wheels.setMatrixAt(i * 4 + w, this.tmp.matrix);
          w++;
        }
      }
      // lights
      for (let k = 0; k < 2; k++) {
        const lx = (k === 0 ? -0.6 : 0.6);
        const lz = 2.12;
        const wx = c.x + lx * cos + lz * sin;
        const wz = c.z - lx * sin + lz * cos;
        this.tmp.position.set(wx, 0.83, wz);
        this.tmp.rotation.set(0, c.yaw, 0);
        this.tmp.updateMatrix();
        meshes.head.setMatrixAt(i * 2 + k, this.tmp.matrix);
        const bx = c.x + lx * cos - lz * sin;
        const bz = c.z - lx * sin - lz * cos;
        this.tmp.position.set(bx, 0.83, bz);
        this.tmp.updateMatrix();
        meshes.tail.setMatrixAt(i * 2 + k, this.tmp.matrix);
      }
    }
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
  }

  update(dt, time) {
    this.time = time;
    this.urbanTrees?.update(dt);
    this.streetFurniture?.update(dt);
    this.updatePeople(dt);
    this.updateCars(dt);
    // Progressive floor failure. Clusters accelerate under gravity, spread
    // away from impact and remain as a low, layered ruin after settling.
    for (const b of this.buildings) {
      if (b.state === 'falling') {
        b.fallT += dt;
        let settled=true;
        for(const part of b.collapseParts||[]){
          if(part.landed)continue;
          settled=false;
          if(b.fallT<part.delay)continue;
          part.velocity+=32*dt;
          const mesh=part.mesh;
          const tilt=Math.min(1,(b.fallT-part.delay)/1.6);
          mesh.rotation.set((part.half===0?1:-1)*(.10+part.index*.035)*tilt,
            (part.half===0?-1:1)*part.index*.11*tilt,(part.half===0?-1:1)*(.08+part.index*.025)*tilt);
          const floor=part.height*.5+part.index*.19+
            Math.abs(Math.sin(mesh.rotation.x))*b.d*.5+Math.abs(Math.sin(mesh.rotation.z))*part.width*.5;
          mesh.position.y=Math.max(floor,mesh.position.y-part.velocity*dt);
          mesh.position.x+=(b.fallDir.x*(2+part.index*.55)+b.fallDir.z*part.drift)*dt;
          mesh.position.z+=(b.fallDir.z*(2+part.index*.55)-b.fallDir.x*part.drift)*dt;
          if(mesh.position.y<=floor){
            part.landed=true;
            this.options.onCollapseImpact?.(b,part);
          }
        }
        if (settled) {
          b.state = 'destroyed';
          // Consolidate settled pieces into two static meshes; a ruined city
          // must not retain dozens of draw calls for every fallen tower.
          const shells=[],slabs=[];
          for(const part of b.collapseParts){
            part.mesh.updateMatrix();
            for(const [index,child]of part.mesh.children.entries()){
              child.updateMatrix();
              const geometry=child.geometry.clone().applyMatrix4(child.matrix).applyMatrix4(part.mesh.matrix);
              (index===0?shells:slabs).push(geometry);
              child.geometry.dispose();
            }
            b.collapseGroup.remove(part.mesh);
          }
          for(const [geometries,material]of [[shells,b.collapseParts[0].mesh.children[0].material],[slabs,this.materials.rubble]]){
            const merged=mergeGeometries(geometries);
            geometries.forEach(g=>g.dispose());
            const ruin=new THREE.Mesh(merged,material);
            ruin.castShadow=ruin.receiveShadow=true;b.collapseGroup.add(ruin);
          }
        }
      }
    }
    // burning rift pulse
    if (this.riftActive) {
      this.riftMagma.material.opacity = .65 + Math.sin(time * 2.1) * .06;
      // Cracks remain fixed in the asphalt, rather than rotating like a portal.
    }
    if (this.plazaRing) this.plazaRing.material.opacity = .06;
    // screens animation
    if (time - this.screenUpdateAt > 0.22) {
      this.screenUpdateAt = time;
      this.drawScreenFrame(this.panic);
    }
  }

  get buildingCount() { return this.buildings.length; }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            if (m[k] && m[k].isTexture && !m[k].userData.shared) m[k].dispose();
          }
          m.dispose();
        }
      }
    });
  }
}
