import { createFlow, setFlow } from './flowVFX.js';
import { DebrisPhysics } from './debrisPhysics.js';
import { QuarksImpacts } from './quarksImpacts.js';
import * as THREE from 'three';
import {
  clamp, rand, randInt, pick, glowTexture, smokeTexture, scorchTexture, canvasTexture,
} from '../utils.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);


function makeSlashTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    const drawArc = (width, color) => {
      ctx.beginPath();
      ctx.arc(256, 285, 205, -2.48, -0.62);
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    drawArc(40, 'rgba(10, 8, 12, .95)');
    drawArc(28, 'rgba(255, 127, 45, .98)');
    drawArc(15, 'rgba(255, 219, 137, 1)');
    drawArc(5, 'rgba(255, 255, 240, 1)');
    ctx.lineCap = 'butt';
    for (let i = 0; i < 7; i++) {
      const a = -2.32 + i * 0.27;
      const x1 = 256 + Math.cos(a) * 215;
      const y1 = 285 + Math.sin(a) * 215;
      const x2 = 256 + Math.cos(a) * (260 + i * 7);
      const y2 = 285 + Math.sin(a) * (260 + i * 7);
      ctx.strokeStyle = i % 2 ? 'rgba(255, 228, 170, .8)' : 'rgba(20, 12, 14, .8)';
      ctx.lineWidth = i % 2 ? 4 : 7;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  });
}


function makeSpeedTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.045;
      const inner = 48 + (i % 7) * 10;
      const outer = 180 + (i % 5) * 22;
      const x1 = cx + Math.cos(a) * inner;
      const y1 = cy + Math.sin(a) * inner;
      const x2 = cx + Math.cos(a) * outer;
      const y2 = cy + Math.sin(a) * outer;
      ctx.strokeStyle = 'rgba(9, 10, 15, .9)';
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(255, 239, 176, .98)' : 'rgba(224, 255, 255, .92)';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (i % 3 === 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
  });
}

function makeComicBurstTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const star = (points, outer, inner, color) => {
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    star(12, 116, 58, 'rgba(8, 8, 12, .95)');
    star(12, 104, 46, 'rgba(255, 96, 38, .96)');
    star(10, 82, 32, 'rgba(255, 200, 92, .98)');
    star(8, 46, 20, 'rgba(255, 249, 221, 1)');
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
      ctx.lineTo(cx + Math.cos(a) * 145, cy + Math.sin(a) * 145);
      ctx.stroke();
    }
  });
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'effects';
    scene.add(this.group);
    this.time = 0;
    this.shakeAmp = 0;
    this.shakeTime = 0;
    this.shakeDuration = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.onFlash = null;
    this.onShake = null;
    this.buildPools();
    this.contactVFX=new QuarksImpacts(this.group);
  }

  buildPools() {
    this.sparks = this.createParticlePool(520, 0.13, new THREE.MeshBasicMaterial({
      color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      toneMapped: false, vertexColors: false,
    }), { box: true, gravity: -22, additive: true });
    this.physics = new DebrisPhysics(96);
    this.debris = this.createParticlePool(96, 0.42, new THREE.MeshStandardMaterial({
      color: '#ffffff', roughness: 0.9, metalness: 0.1, flatShading: true,
    }), { gravity: -38, bounce: true });
    this.smoke = this.createSpritePool(46, smokeTexture(), { blending: THREE.NormalBlending });
    this.glows = this.createSpritePool(34, glowTexture('#ffffff'), { blending: THREE.AdditiveBlending, toneMapped: false });
    this.slashes = this.createSpritePool(8, makeSlashTexture(), { blending: THREE.NormalBlending, toneMapped: false });
    this.bursts = this.createSpritePool(6, makeComicBurstTexture(), { blending: THREE.NormalBlending, toneMapped: false });
    this.speedLines = this.createSpritePool(10, makeSpeedTexture(), { blending: THREE.NormalBlending, toneMapped: false });
    this.shockwaves = this.createRingPool(16);
    this.flowStreams = Array.from({length:12},()=>{
      const group=createFlow({color:'#ff6a19',mode:1,sheets:4});
      this.group.add(group);group.visible=false;
      return {group,life:0,maxLife:1,length:1,width:1};
    });
    this.toonBeams = [];
    this.toonBeamGeo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
    this.eruptions = [];
    this.eruptionGeo = new THREE.ConeGeometry(1, 1, 6, 2);
    const ep = this.eruptionGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const y = ep.getY(i);
      if (y < 0.49) {
        const j = 0.72 + ((i * 37) % 11) / 30;
        ep.setX(i, ep.getX(i) * j);
        ep.setZ(i, ep.getZ(i) * (0.78 + ((i * 19) % 7) / 25));
      }
    }
    this.eruptionGeo.computeVertexNormals();
    this.beams = [];
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.beams.push({ mesh, life: 0, maxLife: 1, thickness: 1, active: false, end: new THREE.Vector3(), sparkTimer: 0, color: '#fff' });
    }
    this.scorchMat = new THREE.MeshBasicMaterial({
      map: scorchTexture(), transparent: true, opacity: 0.8, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.scorches = [];
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.scorchMat.clone());
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.scorches.push({ mesh: m, active: false });
    }
    this.scorchIndex = 0;
    this.flash = 0;
    this.flashColor = new THREE.Color('#ffffff');
  }

  createParticlePool(count, size, material, opts = {}) {
    const geo = opts.box ? new THREE.BoxGeometry(1, 1, 0.35) : new THREE.TetrahedronGeometry(0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const pool = {
      mesh, count, size, active: [], opts,
      data: new Array(count).fill(null).map(() => ({
        pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(),
        spin: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, color: new THREE.Color(),
        gravity: opts.gravity ?? 0, bounce: !!opts.bounce, active: false,
      })),
      cursor: 0,
    };
    const dummy = new THREE.Object3D();
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color('#ffffff'));
    }
    mesh.instanceColor.needsUpdate = true;
    return pool;
  }

  createSpritePool(count, map, opts = {}) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map, color: '#ffffff', transparent: true, opacity: 1, depthWrite: false,
        blending: opts.blending ?? THREE.NormalBlending, toneMapped: opts.toneMapped ?? true,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      this.group.add(s);
      arr.push({
        sprite: s, life: 0, maxLife: 1, startScale: 1, endScale: 2, startOpacity: 1,
        vel: new THREE.Vector3(), active: false, fadeIn: 0.2,
      });
    }
    return { items: arr, cursor: 0 };
  }

  createRingPool(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#ffffff', transparent: true, opacity: 1, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 64), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      arr.push({ mesh, life: 0, maxLife: 1, active: false, startScale: 1, endScale: 10, y: 0.2, fade: 1 });
    }
    return { items: arr, cursor: 0 };
  }

  particle(pool, pos, opts = {}) {
    const index = pool.cursor;
    const p = pool.data[index];
    pool.cursor = (pool.cursor + 1) % pool.count;
    if (pool === this.debris) this.physics.remove(p);
    p.physicsRotation = null;
    p.pos.copy(pos);
    p.vel.copy(opts.vel ?? new THREE.Vector3());
    p.rot.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    p.spin.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    p.life = opts.life ?? 1;
    p.maxLife = p.life;
    p.size = opts.size ?? 1;
    p.gravity = opts.gravity ?? pool.opts.gravity ?? 0;
    p.bounce = opts.bounce ?? pool.opts.bounce ?? false;
    p.color.set(opts.color ?? '#ffffff');
    p.active = true;
    if (pool.mesh.instanceColor) {
      pool.mesh.setColorAt(index, p.color);
      pool.mesh.instanceColor.needsUpdate = true;
    }
    if (pool === this.debris) this.physics.spawn(p, pool.size * p.size * .5);
    return p;
  }

  sparkBurst(pos, count = 14, color = '#ffcf7a', power = 1) {
    for (let i = 0; i < count; i++) {
      const theta = rand(0, Math.PI * 2);
      const phi = rand(0, Math.PI * 0.7);
      const speed = rand(4, 16) * power;
      this.particle(this.sparks, pos, {
        vel: new THREE.Vector3(Math.cos(theta) * Math.sin(phi) * speed, Math.cos(phi) * speed + 3, Math.sin(theta) * Math.sin(phi) * speed),
        life: rand(0.25, 0.75),
        size: rand(0.4, 1.1),
        color: i % 3 === 0 ? '#ffffff' : color,
      });
    }
  }

  debrisBurst(pos, count = 8, scale = 1, color = '#4a4641') {
    for (let i = 0; i < count; i++) {
      const theta = rand(0, Math.PI * 2);
      const speed = rand(6, 23) * scale;
      this.particle(this.debris, pos, {
        vel: new THREE.Vector3(Math.cos(theta) * speed, rand(8, 32) * scale, Math.sin(theta) * speed),
        life: rand(2.8, 5),
        size: rand(0.35, 1.4) * scale,
        color,
      });
    }
  }

  smokePuff(pos, count = 4, scale = 1, color = '#9a8f82') {
    for (let i = 0; i < count; i++) {
      const item = this.smoke.items[this.smoke.cursor];
      this.smoke.cursor = (this.smoke.cursor + 1) % this.smoke.items.length;
      item.active = true;
      item.life = rand(1.4, 2.8);
      item.maxLife = item.life;
      item.fadeIn = rand(0.1, 0.35);
      item.startScale = rand(1.5, 4) * scale;
      item.endScale = rand(5, 12) * scale;
      item.startOpacity = rand(0.22, 0.5) * (scale < 1 ? 0.7 : 1);
      item.sprite.visible = true;
      item.sprite.position.copy(pos).add(new THREE.Vector3(rand(-2, 2) * scale, rand(0, 2) * scale, rand(-2, 2) * scale));
      item.sprite.material.color.set(color);
      item.sprite.material.rotation = rand(0, Math.PI * 2);
      item.vel.set(rand(-1.5, 1.5) * scale, rand(1.5, 5) * scale, rand(-1.5, 1.5) * scale);
    }
  }

  glowBurst(pos, color = '#ffd094', size = 4, life = 0.32, vel = null, opacity = 0.95) {
    const item = this.glows.items[this.glows.cursor];
    this.glows.cursor = (this.glows.cursor + 1) % this.glows.items.length;
    item.active = true;
    item.life = life;
    item.maxLife = life;
    item.fadeIn = 0.03;
    item.startScale = size * 0.4;
    item.endScale = size;
    item.startOpacity = opacity;
    item.sprite.material.color.set(color);
    item.sprite.material.rotation = rand(0, Math.PI * 2);
    item.sprite.position.copy(pos);
    item.sprite.visible = true;
    item.vel.copy(vel ?? new THREE.Vector3());
    return item;
  }

  shockwave(pos, color = '#ffd2a2', startScale = 2, endScale = 28, life = 0.7, flat = true) {
    const item = this.shockwaves.items[this.shockwaves.cursor];
    this.shockwaves.cursor = (this.shockwaves.cursor + 1) % this.shockwaves.items.length;
    item.active = true;
    item.life = life;
    item.maxLife = life;
    item.startScale = startScale;
    item.endScale = endScale;
    item.mesh.visible = true;
    item.mesh.position.copy(pos);
    item.mesh.position.y = Math.max(0.2, pos.y);
    item.mesh.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0);
    item.mesh.material.color.set(color);
    return item;
  }

  scorch(pos, size = 10) {
    const item = this.scorches[this.scorchIndex];
    this.scorchIndex = (this.scorchIndex + 1) % this.scorches.length;
    item.active = true;
    item.mesh.visible = true;
    item.mesh.position.set(pos.x, 0.07, pos.z);
    item.mesh.rotation.z = rand(0, Math.PI * 2);
    item.mesh.scale.setScalar(size);
    item.mesh.material.opacity = 0.68;
  }

  energyImpact(pos,normal,color='#9ee8ff') {
    const outward=normal?.clone().normalize()||new THREE.Vector3(0,1,0);
    for(let i=0;i<28;i++){
      const velocity=new THREE.Vector3(rand(-1,1),rand(-1,1),rand(-1,1)).normalize().multiplyScalar(rand(3,12));
      if(velocity.dot(outward)<0)velocity.reflect(outward);
      velocity.addScaledVector(outward,rand(2,7));
      this.particle(this.sparks,pos,{vel:velocity,life:rand(.18,.5),size:rand(.35,.8),color:i%4?'#f3c589':'#eafaff'});
    }
    this.glowBurst(pos,color,4,.12,null,.65);
    this.glowBurst(pos,'#ffffff',1.5,.05,null,.8);
    this.smokePuff(pos,4,.65,'#87918e');
    const ring=this.shockwave(pos,color,.4,4.5,.2,false);
    ring.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),outward);
  }

  punchImpact(pos, color = '#a8fbff', heavy = false, options = {}) {
    // Local contact flash and fragments leave the striking limb visible.
    this.contactVFX.emit(pos,{heavy,...options});
    this.glowBurst(pos, color, heavy ? 4.5 : 2.6, .1, null, .65);
    this.glowBurst(pos, '#ffffff', heavy ? 2.2 : 1.3, .055, null, .8);
    this.screenShake(heavy ? .3 : .12, heavy ? .18 : .1);
  }

  shieldBurst(pos) {
    this.glowBurst(pos, '#8ffcff', 8, 0.3, null, 0.8);
    this.sparkBurst(pos, 16, '#8ffcff', 0.75);
    this.shockwave(pos.clone().setY(0.2), '#8ffcff', 1, 8, 0.4);
  }

  laserImpact(pos) {
    this.glowBurst(pos, '#ffffff', 9, 0.2, null, 1);
    this.sparkBurst(pos, 18, '#9ffcff', 1);
  }

  monsterHit(pos, heavy = false) {
    this.sparkBurst(pos, heavy ? 46 : 22, '#ffb15a', 1.3);
    this.glowBurst(pos, '#ffb15a', heavy ? 12 : 7, 0.25);
    this.shockwave(pos, '#ff9a5a', 1, heavy ? 12 : 6, 0.36);
  }

  explosion(pos, scale = 1, opts = {}) {
    const color = opts.color ?? '#ff9b4b';
    this.glowBurst(pos, '#fff0c7', 5 * scale, 0.16, null, 1);
    this.glowBurst(pos, color, 10 * scale, 0.45, new THREE.Vector3(0, 3, 0), 0.7);
    this.smokePuff(pos, Math.round(5 * scale), scale, opts.smokeColor ?? '#80746b');
    this.smokePuff(pos.clone().add(new THREE.Vector3(0, 5 * scale, 0)), Math.round(3 * scale), scale * 1.3, '#4f4a45');
    this.sparkBurst(pos, Math.round(26 * scale), color, scale * 1.1);
    this.debrisBurst(pos, Math.round(14 * scale), scale);
    this.shockwave(pos, color, 1.5, 25 * scale, 0.85);
    this.scorch(pos, 12 * scale);
    this.screenShake(0.55 * scale, 0.5);
    if (opts.screenFlash && this.onFlash) this.onFlash(color, 0.2 * Math.min(2, scale));
  }

  dustRise(pos, count = 8, radius = 3, color = '#8a7c70') {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(0, radius);
      this.smokePuff(new THREE.Vector3(pos.x + Math.cos(a) * r, 0.2, pos.z + Math.sin(a) * r), 1, 0.7 + rand(0, 0.7), color);
    }
  }

  trail(from, to, color = '#a0fcff', duration = 0.16, thickness = 0.35) {
    this.createBeam(from, to, color, duration, thickness, false);
  }

  beam(from, to, color = '#ff7a2e', duration = 0.8, thickness = 1.8) {
    return this.createBeam(from, to, color, duration, thickness, true);
  }

  toonSlash(pos, options = {}) {
    const item = this.slashes.items[this.slashes.cursor];
    this.slashes.cursor = (this.slashes.cursor + 1) % this.slashes.items.length;
    const life = options.life ?? 0.24;
    item.active = true;
    item.life = life;
    item.maxLife = life;
    item.fadeIn = 0.01;
    item.startScale = (options.scale ?? 22) * 0.55;
    item.endScale = options.scale ?? 22;
    item.startOpacity = options.opacity ?? 0.95;
    item.sprite.visible = true;
    item.sprite.position.copy(pos);
    item.sprite.material.color.set(options.color ?? '#ffe5a6');
    item.sprite.material.rotation = options.rotation ?? rand(-0.5, 0.2);
    item.vel.set(0, 0, 0);
    return item;
  }

  speedBurst(pos, options = {}) {
    const item = this.speedLines.items[this.speedLines.cursor];
    this.speedLines.cursor = (this.speedLines.cursor + 1) % this.speedLines.items.length;
    const life = options.life ?? 0.3;
    item.active = true;
    item.life = life;
    item.maxLife = life;
    item.fadeIn = 0.01;
    item.startScale = (options.scale ?? 22) * 0.35;
    item.endScale = options.scale ?? 22;
    item.startOpacity = options.opacity ?? 0.95;
    item.sprite.visible = true;
    item.sprite.position.copy(pos);
    item.sprite.material.color.set(options.color ?? '#ffffff');
    item.sprite.material.rotation = options.rotation ?? rand(0, Math.PI * 2);
    item.vel.set(0, 0, 0);
    return item;
  }

  comicBurst(pos, options = {}) {
    const item = this.bursts.items[this.bursts.cursor];
    this.bursts.cursor = (this.bursts.cursor + 1) % this.bursts.items.length;
    const life = options.life ?? 0.42;
    item.active = true;
    item.life = life;
    item.maxLife = life;
    item.fadeIn = 0.015;
    item.startScale = (options.scale ?? 16) * 0.3;
    item.endScale = options.scale ?? 16;
    item.startOpacity = 1;
    item.sprite.visible = true;
    item.sprite.position.copy(pos);
    item.sprite.material.color.set(options.color ?? '#ffffff');
    item.sprite.material.rotation = options.rotation ?? rand(0, Math.PI * 2);
    item.vel.set(0, options.rise ?? 0, 0);
    return item;
  }

  eruption(pos, scale = 1) {
    const base = pos.clone().setY(.25);
    const item = this.breathStream(base, base.clone().add(new THREE.Vector3(0, 17 * scale, 0)), .85, 6 * scale, .7);
    this.debrisBurst(base, Math.round(12 * scale), .8 * scale, '#514a42');
    this.sparkBurst(base.clone().setY(2), 24, '#ffb052', 1.2);
    this.dustRise(base, 5, 4 * scale, '#9b8b75');
    this.smokePuff(base, 3, 1.3, '#60574d');
    this.scorch(pos, 7 * scale);
    this.screenShake(.22 * scale, .3);
    return item;
  }

  energyColumn(from, to, duration = 1.15, width = 5.5) {
    const item = this.breathStream(from, to, duration, width, .4);
    for (const sheet of item.group.children) {
      sheet.material.uniforms.uMode.value = 0;
      sheet.material.uniforms.uColor.value.set('#64bfff');
      sheet.material.blending = THREE.AdditiveBlending;
      sheet.material.needsUpdate = true;
    }
    return item;
  }

  breathStream(from,to,duration=.8,width=8,taper=.93) {
    const item=this.flowStreams.find(s=>s.life<=0)||this.flowStreams[0];
    item.group.position.copy(from);
    const direction=to.clone().sub(from);item.length=direction.length();
    item.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction.normalize());
    for(const sheet of item.group.children){
      sheet.material.uniforms.uTaper.value=Math.max(0,(taper-.18)/.75);
      sheet.material.uniforms.uMode.value=1;
      sheet.material.uniforms.uColor.value.set('#ff6a19');
      if(sheet.material.blending!==THREE.NormalBlending){sheet.material.blending=THREE.NormalBlending;sheet.material.needsUpdate=true;}
    }
    item.life=item.maxLife=duration;item.width=width;item.group.visible=true;
    setFlow(item.group,this.time,0,width,item.length);
    return item;
  }

  /** Solid cel-shaded pillar used for the orbital strike. */
  toonBeam(from, to, color = '#9cfbff', duration = 1.2, thickness = 8, options = {}) {
    const group = new THREE.Group();
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.1) return null;
    const outerMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: options.opacity ?? 0.66, blending: THREE.NormalBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#fffdf0', transparent: true, opacity: options.coreOpacity ?? 0.9, blending: THREE.NormalBlending,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false,
    });
    const outer = new THREE.Mesh(this.toonBeamGeo, outerMat);
    outer.scale.set(thickness, len, thickness);
    const core = new THREE.Mesh(this.toonBeamGeo, coreMat);
    core.scale.set(thickness * 0.33, len * 0.998, thickness * 0.33);
    group.add(outer, core);
    group.position.copy(from).add(to).multiplyScalar(0.5);
    group.quaternion.setFromUnitVectors(Y_AXIS, dir.normalize());
    group.renderOrder = 2;
    this.group.add(group);
    this.toonBeams.push({
      group, life: duration, maxLife: duration, outer, core, outerMat, coreMat,
      baseOuter: options.opacity ?? 0.66, baseCore: options.coreOpacity ?? 0.9,
    });
    return group;
  }

  createBeam(from, to, color, duration, thickness, withSparks) {
    let item = this.beams.find((b) => !b.active) || this.beams[0];
    const mesh = item.mesh;
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len < 0.01) return item;
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, dir.clone().normalize());
    mesh.scale.set(thickness, len, thickness);
    mesh.material.color.set(color);
    mesh.material.opacity = 0.88;
    mesh.visible = true;
    item.active = true;
    item.life = duration;
    item.maxLife = duration;
    item.thickness = thickness;
    item.end.copy(to);
    item.withSparks = withSparks;
    item.sparkTimer = 0;
    item.color = color;
    // extra white core for thicker beams
    if (withSparks && thickness > 0.8) {
      this.glowBurst(to, '#ffe1b0', 8, 0.25);
      this.sparkBurst(to, 12, color, 0.9);
    }
    return item;
  }

  screenShake(amount, duration) {
    this.shakeAmp = Math.max(this.shakeAmp, amount);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTime = this.shakeDuration;
  }

  update(dt, time) {
    this.time = time;
    this.contactVFX.update(dt);
    for(const item of this.flowStreams){
      if(item.life<=0)continue;
      item.life=Math.max(0,item.life-dt);item.group.visible=item.life>0;
      const elapsed=item.maxLife-item.life;
      const power=Math.min(1,elapsed/.08,item.life/.18);
      setFlow(item.group,time,power,item.width,item.length);
    }
    // particles
    this.physics.update(dt);
    this.updateParticles(this.sparks, dt);
    this.updateParticles(this.debris, dt);
    // smoke sprites
    for (const item of this.smoke.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const scale = item.startScale + (item.endScale - item.startScale) * t;
      item.sprite.scale.set(scale, scale * 0.8, 1);
      const fade = item.life / item.maxLife;
      const fadeIn = clamp(t / Math.max(0.02, item.fadeIn), 0, 1);
      item.sprite.material.opacity = item.startOpacity * fade * fadeIn;
      item.sprite.material.rotation += dt * 0.08;
      item.sprite.position.addScaledVector(item.vel, dt);
      item.vel.y += dt * 0.2;
    }
    // glows
    for (const item of this.glows.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const s = item.startScale + (item.endScale - item.startScale) * t;
      item.sprite.scale.set(s, s, 1);
      item.sprite.material.opacity = item.startOpacity * (1 - t) * (1 - t);
      item.sprite.position.addScaledVector(item.vel, dt);
    }
    // anime slash sprites
    for (const item of this.slashes.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const s = item.startScale + (item.endScale - item.startScale) * (1 - Math.pow(1 - t, 2));
      item.sprite.scale.set(s, s * 0.55, 1);
      item.sprite.material.opacity = item.startOpacity * (1 - Math.pow(t, 1.4));
    }
    // comic star bursts
    for (const item of this.bursts.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const s = item.startScale + (item.endScale - item.startScale) * (1 - Math.pow(1 - t, 2));
      item.sprite.scale.set(s, s, 1);
      item.sprite.material.opacity = item.startOpacity * (1 - t) * (1 - t);
      item.sprite.position.addScaledVector(item.vel, dt);
    }
    // radial comic speed lines
    for (const item of this.speedLines.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.sprite.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const s = item.startScale + (item.endScale - item.startScale) * (1 - Math.pow(1 - t, 2));
      item.sprite.scale.set(s, s, 1);
      item.sprite.material.opacity = item.startOpacity * Math.pow(1 - t, 1.5);
      item.sprite.material.rotation += dt * 0.08;
    }
    // shockwaves
    for (const item of this.shockwaves.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const s = item.startScale + (item.endScale - item.startScale) * (1 - Math.pow(1 - t, 2));
      item.mesh.scale.setScalar(s);
      item.mesh.material.opacity = (1 - t) * 0.7;
    }
    // beams
    for (const item of this.beams) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }
      const t = 1 - item.life / item.maxLife;
      const flicker = 0.82 + Math.sin(time * 45) * 0.16;
      item.mesh.material.opacity = Math.sin(Math.min(1, t * 3) * Math.PI / 2) * (1 - t) * 0.9 * flicker + 0.05;
      if (item.withSparks) {
        item.sparkTimer -= dt;
        if (item.sparkTimer <= 0) {
          item.sparkTimer = 0.07;
          this.glowBurst(item.end, item.color, 4.5, 0.2);
          if (Math.random() < 0.5) this.sparkBurst(item.end, 3, item.color, 0.65);
        }
      }
    }
    // toon lava spikes
    for (let i = this.eruptions.length - 1; i >= 0; i--) {
      const e = this.eruptions[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.group.remove(e.group);
        e.outerMat.dispose(); e.lavaMat.dispose(); e.coreMat.dispose(); e.outlineMat.dispose();
        e.rim.geometry.dispose(); e.rim.material.dispose();
        this.eruptions.splice(i, 1);
        continue;
      }
      const t = 1 - e.life / e.maxLife;
      const grow = t < 0.18 ? (t / 0.18) * 1.08 : 1.08 - (t - 0.18) * 0.12;
      e.group.scale.set(1, grow, 1);
      const fade = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
      e.outerMat.opacity = fade;
      e.lavaMat.opacity = fade;
      e.coreMat.opacity = fade;
      e.outlineMat.opacity = fade;
      e.rim.material.opacity = 0.7 * fade;
    }
    // solid toon beams
    for (let i = this.toonBeams.length - 1; i >= 0; i--) {
      const b = this.toonBeams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.group.remove(b.group);
        b.outerMat.dispose();
        b.coreMat.dispose();
        this.toonBeams.splice(i, 1);
        continue;
      }
      const t = 1 - b.life / b.maxLife;
      const fade = Math.sin(Math.min(1, t * 2.2) * Math.PI / 2) * (1 - t * 0.55);
      const flicker = 0.9 + Math.sin(time * 52) * 0.08;
      b.outerMat.opacity = b.baseOuter * fade * flicker;
      b.coreMat.opacity = b.baseCore * fade;
    }
    // shake
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const f = this.shakeDuration > 0 ? this.shakeTime / this.shakeDuration : 0;
      const a = this.shakeAmp * f * f;
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
      if (this.shakeTime === 0) {
        this.shakeAmp = 0;
        this.shakeDuration = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  updateParticles(pool, dt) {
    const dummy = new THREE.Object3D();
    let changed = false;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.data[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        if (pool === this.debris) this.physics.remove(p);
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0.0001);
        dummy.updateMatrix();
        pool.mesh.setMatrixAt(i, dummy.matrix);
        changed = true;
        continue;
      }
      if (pool !== this.debris) {
        p.vel.y += p.gravity * dt;
        p.pos.addScaledVector(p.vel, dt);
        if (p.bounce && p.pos.y < 0.25) {
          p.pos.y = 0.25;
          p.vel.y = Math.abs(p.vel.y) * 0.3;
          p.vel.x *= 0.72;
          p.vel.z *= 0.72;
          p.spin.multiplyScalar(0.72);
        }
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
      }
      const t = p.life / p.maxLife;
      const size = pool.size * p.size * (p.bounce ? Math.min(1, p.life * 1.5) : Math.min(1, t * 2.5));
      dummy.position.copy(p.pos);
      dummy.rotation.copy(p.rot);
      if (p.physicsRotation) dummy.quaternion.copy(p.physicsRotation);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(i, dummy.matrix);
      changed = true;
    }
    if (changed) pool.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.contactVFX.clear();
    this.physics.clear();
    for(const item of this.flowStreams){item.life=0;item.group.visible=false;}
    for (const pool of [this.sparks, this.debris]) {
      const dummy = new THREE.Object3D();
      dummy.position.set(0, -1000, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      for (let i = 0; i < pool.count; i++) {
        pool.data[i].active = false;
        pool.mesh.setMatrixAt(i, dummy.matrix);
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const item of this.smoke.items) { item.active = false; item.sprite.visible = false; }
    for (const item of this.glows.items) { item.active = false; item.sprite.visible = false; }
    for (const item of this.slashes.items) { item.active = false; item.sprite.visible = false; }
    for (const item of this.bursts.items) { item.active = false; item.sprite.visible = false; }
    for (const item of this.speedLines.items) { item.active = false; item.sprite.visible = false; }
    for (const item of this.shockwaves.items) { item.active = false; item.mesh.visible = false; }
    for (const item of this.beams) { item.active = false; item.mesh.visible = false; }
    for (const b of this.toonBeams) {
      this.group.remove(b.group);
      b.outerMat.dispose();
      b.coreMat.dispose();
    }
    this.toonBeams.length = 0;
    for (const e of this.eruptions) {
      this.group.remove(e.group);
      e.outerMat.dispose(); e.lavaMat.dispose(); e.coreMat.dispose(); e.outlineMat.dispose();
      e.rim.geometry.dispose(); e.rim.material.dispose();
    }
    this.eruptions.length = 0;
    for (const item of this.scorches) { item.active = false; item.mesh.visible = false; }
  }

  dispose() {
    this.contactVFX.dispose();
    this.physics.dispose();
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
