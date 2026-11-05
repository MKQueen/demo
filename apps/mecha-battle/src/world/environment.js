import * as THREE from 'three';
import { glowTexture, canvasTexture, makeRng, buildGlowSprite } from '../utils.js';

function cloudTexture(seed = 1) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const rng = makeRng(seed);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 36; i++) {
      const x = 30 + rng.range(0, w - 60);
      const y = 35 + rng.range(0, h - 60);
      const rx = 20 + rng.range(0, 50);
      const ry = 8 + rng.range(0, 20);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, `rgba(${120 + rng.range(0, 50)}, ${80 + rng.range(0, 40)}, ${90 + rng.range(0, 40)}, ${0.1 + rng.range(0, 0.1)})`);
      g.addColorStop(0.5, `rgba(80, 60, 72, ${0.06 + rng.range(0, 0.08)})`);
      g.addColorStop(1, 'rgba(30,25,40,0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}


function toonSunTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    // flat outer rim, deliberately inked
    ctx.fillStyle = '#2a1720';
    ctx.beginPath(); ctx.arc(cx, cy, 116, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb85d';
    ctx.beginPath(); ctx.arc(cx, cy, 108, 0, Math.PI * 2); ctx.fill();
    const bands = ['#ffcb72', '#ffc05c', '#ffad4f', '#ff9841', '#ff8639'];
    for (let i = 0; i < bands.length; i++) {
      const y = cy - 80 + i * 34;
      ctx.fillStyle = bands[i];
      ctx.fillRect(cx - 108, y, 216, 34);
    }
    // inner disc
    ctx.fillStyle = '#fff1b0';
    ctx.beginPath(); ctx.arc(cx, cy - 20, 54, 0, Math.PI * 2); ctx.fill();
    // retro cut-out stripes across the lower half
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const y = cy + 18 + i * 18;
      ctx.fillRect(cx - 110, y, 220, 7);
    }
    ctx.globalCompositeOperation = 'source-over';
    // a second, thinner inked outline
    ctx.strokeStyle = 'rgba(21, 11, 16, .9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 111, 0, Math.PI * 2); ctx.stroke();
  });
}

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.group.name = 'environment';
    scene.add(this.group);
    this.time = 0;
    this.rng = makeRng(41);
    this.sunDir = new THREE.Vector3(-0.6, 1, 0.45).normalize();
    this.clouds = [];
    this.searchlights = [];
    this.embers = [];
    this.buildSky();
    this.buildLights();


    this.buildHelicopter();
    this.buildDust();
  }

  buildSky() {
    this.scene.background = new THREE.Color('#85c9f0');
    this.skyMat = { uniforms: { time: { value: 0 }, horizonColor: { value: new THREE.Color('#d9eef7') } } };
    this.stars = new THREE.Group();
    this.toonSun = new THREE.Group();
    // High, soft white cloud banks frame a clear midday sky.
    const cloudMap=canvasTexture(256,128,(ctx,w,h)=>{
      for(let i=0;i<24;i++){
        const x=30+(i*73%190), y=40+(i*29%45), radius=22+i%5*5;
        const g=ctx.createRadialGradient(x,y,1,x,y,radius);
        g.addColorStop(0,'rgba(255,255,255,.2)');g.addColorStop(.55,'rgba(255,255,255,.1)');g.addColorStop(1,'rgba(255,255,255,0)');
        ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
    });
    for(let i=0;i<12;i++){
      const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudMap,color:'#ffffff',transparent:true,opacity:.65,depthWrite:false,fog:false}));
      const a=i*2.399;cloud.position.set(Math.cos(a)*320,120+i%4*20,Math.sin(a)*320);
      cloud.scale.set(100+i%3*20,35,1);this.group.add(cloud);
    }
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#d3efff', '#8c9497', .85);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight('#fff6df', 1.8);
    sun.position.copy(this.sunDir).multiplyScalar(150);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -115;
    sun.shadow.camera.right = 115;
    sun.shadow.camera.top = 115;
    sun.shadow.camera.bottom = -115;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 380;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
    this.sun = sun;
    this.scene.add(sun);
    this.scene.add(sun.target);

    const fill = new THREE.DirectionalLight('#a8c7dc', 0.3);
    fill.position.set(80, 55, 110);
    this.scene.add(fill);

    // 从镜头一侧给巨兽和机甲一层中性补光，避免逆光时只剩剪影
    const frontFill = new THREE.DirectionalLight('#dce6eb', 0.42);
    frontFill.position.set(6, 48, 125);
    this.scene.add(frontFill);
    // strong cyan/amber rims carve the new armour and scales out of the dusk
    const coolRim = new THREE.DirectionalLight('#a1cddd', 0.15);
    coolRim.position.set(-55, 72, -105);
    this.scene.add(coolRim);
    const warmRim = new THREE.DirectionalLight('#ffc08a', 0.1);
    warmRim.position.set(70, 42, -85);
    this.scene.add(warmRim);
    this.rimDirectional = coolRim;
    this.warmRim = warmRim;

    const plaza = new THREE.PointLight('#ff8a52', 260, 95, 2);
    plaza.position.set(0, 24, 0);
    this.scene.add(plaza);
    this.plazaLight = plaza;
    const cool = new THREE.PointLight('#58dceb', 520, 100, 2);
    cool.position.set(-34, 20, 34);
    this.scene.add(cool);
    this.coolLight = cool; cool.intensity = 0;
    const rim = new THREE.PointLight('#9fd9ff', 280, 80, 2);
    rim.position.set(26, 32, -28);
    this.scene.add(rim);
    this.rimLight = rim; rim.intensity = 0;

    this.scene.fog = new THREE.Fog('#c3e2f0', 150, 500);
  }

  buildClouds() {
    const tex = cloudTexture(12);
    const rng = makeRng(88);
    for (let i = 0; i < 13; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: i % 3 === 0 ? '#c6866a' : '#6a5868',
        transparent: true, opacity: rng.range(0.1, 0.3), depthWrite: false, fog: false,
      });
      const sp = new THREE.Sprite(mat);
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(190, 350);
      sp.position.set(Math.cos(angle) * radius, rng.range(45, 120), Math.sin(angle) * radius);
      sp.scale.set(rng.range(100, 230), rng.range(25, 65), 1);
      sp.material.rotation = rng.range(-0.15, 0.15);
      this.group.add(sp);
      this.clouds.push({ sprite: sp, speed: rng.range(0.0008, 0.0022), angle });
    }
  }

  buildSearchlights() {
    const positions = [
      [-92, 0, -82], [96, 0, -64], [78, 0, 88],
    ];
    const colors = ['#b3e6ff', '#a4c8ff', '#d9eaff'];
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      group.position.set(...positions[i]);
      const beamGeo = new THREE.CylinderGeometry(13, 0.22, 180, 24, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: colors[i], transparent: true, opacity: 0.022, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 90;
      group.add(beam);
      const base = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 16),
        new THREE.MeshBasicMaterial({ color: '#c7efff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
      );
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.25;
      group.add(base);
      const glow = buildGlowSprite('#a8dfff', 10, 0.28);
      glow.position.y = 1.2;
      group.add(glow);
      group.rotation.z = i === 0 ? 0.35 : i === 1 ? -0.28 : 0.18;
      this.group.add(group);
      this.searchlights.push({ group, beam, base: i * 1.7, speed: 0.09 + i * 0.017, tilt: i === 1 ? -0.2 : 0.18 });
    }
  }

  buildHelicopter() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#161c21', metalness: 0.6, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 3.2, 3, 6), bodyMat);
    body.rotation.z = Math.PI / 2;
    body.scale.y = 1.1;
    g.add(body);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 6), new THREE.MeshStandardMaterial({ color: '#293d4a', emissive: '#123444', emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.2 }));
    glass.position.set(2.1, 0.1, 0);
    glass.scale.set(0.6, 0.55, 0.7);
    g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 0.3), bodyMat);
    tail.position.set(-3.4, 0.25, 0);
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.12), bodyMat);
    fin.position.set(-5.2, 0.6, 0);
    g.add(fin);
    const rotor = new THREE.Group();
    rotor.position.y = 1.0;
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.04, 0.16), new THREE.MeshStandardMaterial({ color: '#2c3439', metalness: 0.4, roughness: 0.6 }));
      blade.rotation.y = (i / 4) * Math.PI;
      rotor.add(blade);
    }
    g.add(rotor);
    this.heliRotor = rotor;
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), new THREE.MeshBasicMaterial({ color: '#ff2b35', toneMapped: false }));
    blink.position.set(-2.2, 1.0, 0);
    g.add(blink);
    this.heliBlink = blink;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 0.3, 44, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#e3f4ff', transparent: true, opacity: 0.026, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })
    );
    beam.position.set(1.5, -21, 0);
    beam.rotation.z = 0.1;
    g.add(beam);
    const heliGlow = buildGlowSprite('#aadfff', 7, 0.13);
    heliGlow.position.set(1.5, -1, 0);
    g.add(heliGlow);
    g.position.set(60, 58, 30);
    this.group.add(g);
    this.heli = g;
    this.heliAngle = 0.4;
  }

  buildDust() {
    const count = 650;
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const rng = makeRng(233);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rng.range(-140, 140);
      pos[i * 3 + 1] = rng.range(0.2, 45);
      pos[i * 3 + 2] = rng.range(-140, 140);
      speed[i] = rng.range(0.2, 1.0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustSpeeds = speed;
    const mat = new THREE.PointsMaterial({
      color: '#ffbb83', size: 0.12, map: glowTexture('#ffd1a6'), transparent: true, opacity: 0.35,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, alphaTest: 0.01,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  setBattleMood(intensity = 0) {
    this.battleMood = intensity;
    this.skyMat.uniforms.horizonColor.value.set(intensity > 0.5 ? '#d0e4ed' : '#d9eef7');
    this.plazaLight.intensity = 0;
  }

  update(dt, time) {
    this.time = time;
    this.skyMat.uniforms.time.value = time;
    this.stars.rotation.y = time * 0.0015;
    for (const c of this.clouds) {
      c.angle += c.speed * dt * 0.35;
      const r = Math.hypot(c.sprite.position.x, c.sprite.position.z);
      c.sprite.position.x = Math.cos(c.angle) * r;
      c.sprite.position.z = Math.sin(c.angle) * r;
    }
    for (const s of this.searchlights) {
      s.beam.material.opacity = 0.016 + Math.sin(time * 0.6 + s.base) * 0.006;
      s.group.rotation.z = s.tilt + Math.sin(time * s.speed + s.base) * 0.23;
      s.group.rotation.x = Math.cos(time * s.speed * 0.8 + s.base) * 0.12;
    }
    this.heliAngle += dt * 0.045;
    const r = 72;
    this.heli.position.x = Math.cos(this.heliAngle) * r;
    this.heli.position.z = Math.sin(this.heliAngle) * r;
    this.heli.position.y = 57 + Math.sin(time * 0.3) * 2.2;
    this.heli.rotation.y = -this.heliAngle - Math.PI / 2;
    this.heliRotor.rotation.y += dt * 26;
    this.heliBlink.visible = Math.sin(time * 3.5) > 0.2;

    // dust drift
    const positions = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < this.dustSpeeds.length; i++) {
      positions[i * 3 + 1] += dt * this.dustSpeeds[i] * 0.65;
      positions[i * 3] += Math.sin(time * 0.2 + i) * dt * 0.08;
      if (positions[i * 3 + 1] > 47) {
        positions[i * 3 + 1] = 0.2;
      }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
    this.coolLight.intensity = 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.hemi, this.sun, this.sun.target, this.plazaLight, this.coolLight, this.rimLight);
  }
}
