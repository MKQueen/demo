/**
 * people.js —— 长卷里的人。
 *
 * 清明上河图之所以活，是因为画里有一千多个人：挑夫、轿夫、船工、算命先生、
 * 骑马的人、赶驴的人、看热闹的人。这里用一个 InstancedMesh 的广告牌系统
 * 把所有人一次画完：一张手绘的「人物谱」贴图 + 逐实例的位移/摇晃/行走。
 *
 * 契约：world/index.js 先建 ctx.people = [];
 * 各模块往里面 push：
 *   { kind, x, z, y?, dir?: [dx, dz], speed?, span?, h?, mirror? }
 *
 * kind: walker | porter | rider | donkey | camel | palanquin | boatman | vendor | scholar | monk | child
 */
import * as THREE from 'three';
import { makeRng } from '../lib/rand.js';
import { GROUND_Y } from '../layout.js';

const KINDS = [
  'walker',
  'porter',
  'rider',
  'donkey',
  'camel',
  'palanquin',
  'boatman',
  'vendor',
  'scholar',
  'monk',
  'child',
  'lady',
];
const COLS = 4;
const ROWS = 3;

/* -------------------------------------------------------------------------- */
/*  人物谱：一张 Canvas 画 12 个小人                                             */
/* -------------------------------------------------------------------------- */

function drawPerson(ctx, cx, cy, s, kind, rng) {
  const ink = 'rgba(32,36,38,0.92)';
  const line = (x0, y0, x1, y1, w = 1.6) => {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + x0 * s, cy + y0 * s);
    ctx.lineTo(cx + x1 * s, cy + y1 * s);
    ctx.stroke();
  };
  const blob = (x, y, r) => {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx + x * s, cy + y * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  };
  const robe = (color, h = 0.62) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 0.1 * s, cy - 0.06 * s);
    ctx.lineTo(cx + 0.1 * s, cy - 0.06 * s);
    ctx.lineTo(cx + 0.16 * s, cy - h * s);
    ctx.lineTo(cx - 0.16 * s, cy - h * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  };

  ctx.save();
  // 地面投影
  ctx.fillStyle = 'rgba(60,60,52,0.16)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 0.03 * s, 0.16 * s, 0.035 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (kind === 'walker') {
    robe('rgba(196,178,146,0.8)');
    blob(0, -0.66, 0.075);
    line(-0.08, -0.1, -0.11, 0.02, 2.0);
    line(0.08, -0.1, 0.11, 0.02, 2.0);
    line(0.1, -0.5, 0.17, -0.36, 1.6);
  } else if (kind === 'porter') {
    robe('rgba(176,160,128,0.8)');
    blob(0, -0.66, 0.075);
    // 扁担与两筐
    line(-0.32, -0.52, 0.32, -0.52, 2.0);
    ctx.fillStyle = 'rgba(120,104,78,0.9)';
    ctx.beginPath(); ctx.arc(cx - 0.3 * s, cy - 0.44 * s, 0.075 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 0.3 * s, cy - 0.44 * s, 0.075 * s, 0, Math.PI * 2); ctx.fill();
    line(-0.08, -0.1, -0.11, 0.02, 2.0);
    line(0.08, -0.1, 0.11, 0.02, 2.0);
  } else if (kind === 'rider') {
    // 马
    ctx.fillStyle = 'rgba(92,78,60,0.95)';
    ctx.beginPath();
    ctx.moveTo(cx - 0.22 * s, cy - 0.24 * s);
    ctx.lineTo(cx + 0.24 * s, cy - 0.24 * s);
    ctx.lineTo(cx + 0.2 * s, cy - 0.06 * s);
    ctx.lineTo(cx - 0.2 * s, cy - 0.06 * s);
    ctx.closePath();
    ctx.fill();
    line(-0.18, -0.1, -0.22, 0.02, 2.4);
    line(-0.12, -0.1, -0.1, 0.02, 2.4);
    line(0.12, -0.1, 0.1, 0.02, 2.4);
    line(0.18, -0.1, 0.22, 0.02, 2.4);
    // 马头
    line(0.22, -0.24, 0.34, -0.4, 2.6);
    blob(0.3, -0.42, 0.06);
    // 骑者
    robe('rgba(150,140,120,0.85)', 0.5);
    blob(0, -0.62, 0.07);
  } else if (kind === 'donkey') {
    ctx.fillStyle = 'rgba(104,92,74,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.22 * s, 0.2 * s, 0.1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    line(-0.14, -0.14, -0.16, 0.02, 2.2);
    line(-0.08, -0.14, -0.07, 0.02, 2.2);
    line(0.08, -0.14, 0.07, 0.02, 2.2);
    line(0.14, -0.14, 0.16, 0.02, 2.2);
    line(0.18, -0.26, 0.27, -0.42, 2.2);
    blob(0.27, -0.43, 0.05);
    // 驮的炭
    ctx.fillStyle = 'rgba(60,56,50,0.9)';
    ctx.beginPath(); ctx.arc(cx, cy - 0.34 * s, 0.1 * s, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'camel') {
    ctx.fillStyle = 'rgba(150,128,96,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 0.36 * s, 0.3 * s, 0.14 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // 驼峰
    ctx.beginPath(); ctx.arc(cx - 0.1 * s, cy - 0.48 * s, 0.09 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 0.08 * s, cy - 0.48 * s, 0.09 * s, 0, Math.PI * 2); ctx.fill();
    line(-0.22, -0.28, -0.26, 0.02, 2.6);
    line(-0.12, -0.28, -0.1, 0.02, 2.6);
    line(0.12, -0.28, 0.1, 0.02, 2.6);
    line(0.22, -0.28, 0.26, 0.02, 2.6);
    line(0.28, -0.4, 0.44, -0.62, 3.0);
    blob(0.45, -0.64, 0.06);
    // 驼背上的货
    ctx.fillStyle = 'rgba(112,96,72,0.9)';
    ctx.fillRect(cx - 0.16 * s, cy - 0.62 * s, 0.32 * s, 0.12 * s);
  } else if (kind === 'palanquin') {
    // 轿子
    ctx.fillStyle = 'rgba(120,86,58,0.92)';
    ctx.fillRect(cx - 0.16 * s, cy - 0.48 * s, 0.32 * s, 0.34 * s);
    ctx.fillStyle = 'rgba(180,150,110,0.9)';
    ctx.fillRect(cx - 0.19 * s, cy - 0.52 * s, 0.38 * s, 0.06 * s);
    line(-0.35, -0.5, 0.35, -0.5, 2.2);
    // 两个轿夫
    for (const sx of [-0.3, 0.3]) {
      ctx.fillStyle = 'rgba(170,155,130,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx + sx * s - 0.05 * s, cy - 0.1 * s);
      ctx.lineTo(cx + sx * s + 0.05 * s, cy - 0.1 * s);
      ctx.lineTo(cx + sx * s + 0.08 * s, cy - 0.48 * s);
      ctx.lineTo(cx + sx * s - 0.08 * s, cy - 0.48 * s);
      ctx.closePath();
      ctx.fill();
      blob(sx, -0.54, 0.055);
    }
  } else if (kind === 'boatman') {
    robe('rgba(120,132,120,0.85)');
    blob(0, -0.66, 0.075);
    // 篙
    line(0.1, -0.7, -0.28, 0.1, 2.2);
  } else if (kind === 'vendor') {
    // 摊子 + 人
    ctx.fillStyle = 'rgba(200,180,140,0.85)';
    ctx.fillRect(cx - 0.3 * s, cy - 0.3 * s, 0.6 * s, 0.05 * s);
    line(-0.28, -0.3, -0.32, 0.02, 2.0);
    line(0.28, -0.3, 0.32, 0.02, 2.0);
    ctx.fillStyle = 'rgba(160,140,110,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy - 0.24 * s, 0.06 * s, 0, Math.PI * 2); ctx.fill();
    blob(0, -0.56, 0.06);
  } else if (kind === 'scholar') {
    robe('rgba(230,218,196,0.9)');
    blob(0, -0.66, 0.072);
    line(0.1, -0.5, 0.2, -0.34, 1.4);
  } else if (kind === 'monk') {
    robe('rgba(196,176,140,0.85)');
    blob(0, -0.66, 0.08);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy - 0.66 * s, 0.085 * s, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'child') {
    robe('rgba(200,180,150,0.75)', 0.4);
    blob(0, -0.44, 0.06);
  } else if (kind === 'lady') {
    robe('rgba(214,190,170,0.85)');
    blob(0, -0.64, 0.07);
    line(-0.12, -0.34, -0.2, -0.06, 1.6);
  }
  ctx.restore();
}

function buildAtlas() {
  const cell = 256;
  const canvas = document.createElement('canvas');
  canvas.width = cell * COLS;
  canvas.height = cell * ROWS;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rng = makeRng(20250301);
  for (let i = 0; i < KINDS.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell * 0.92;
    drawPerson(ctx, cx, cy, cell * 0.9, KINDS[i], rng);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/* -------------------------------------------------------------------------- */
/*  实例系统                                                                    */
/* -------------------------------------------------------------------------- */

export function buildPeople(ctx) {
  const group = new THREE.Group();
  group.name = 'people';
  const specs = Array.isArray(ctx.people) ? ctx.people : [];
  if (!specs.length) return group;

  const atlas = buildAtlas();
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;

  const n = specs.length;
  const origin = new Float32Array(n * 3);
  const cells = new Float32Array(n * 2);
  const size = new Float32Array(n * 2); // h, w
  const motion = new Float32Array(n * 4); // phase, speed, span, dirX
  const dirZ = new Float32Array(n);
  const rng = makeRng(99123);
  for (let i = 0; i < n; i++) {
    const p = specs[i];
    const kind = KINDS.indexOf(p.kind) >= 0 ? p.kind : 'walker';
    const idx = KINDS.indexOf(kind);
    origin[i * 3] = p.x;
    origin[i * 3 + 1] = p.y != null ? p.y : GROUND_Y;
    origin[i * 3 + 2] = p.z;
    cells[i * 2] = (idx % COLS) / COLS;
    cells[i * 2 + 1] = 1 - (Math.floor(idx / COLS) + 1) / ROWS;
    const isBig = ['rider', 'camel', 'palanquin'].includes(kind);
    const h = p.h != null ? p.h : isBig ? 2.7 : kind === 'child' ? 1.1 : 1.72;
    size[i * 2] = h;
    size[i * 2 + 1] = h * 0.78;
    const dir = p.dir || [1, 0];
    const len = Math.hypot(dir[0], dir[1]) || 1;
    motion[i * 4] = rng();
    motion[i * 4 + 1] = p.speed != null ? p.speed : 0.6 + rng() * 0.5;
    motion[i * 4 + 2] = p.span != null ? p.span : 0;
    motion[i * 4 + 3] = (len ? dir[0] / len : 1) * (p.mirror ? -1 : 1);
    dirZ[i] = len ? dir[1] / len : 0;
    if (p.mirror) motion[i * 4 + 3] *= -1;
  }
  geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2));
  geo.setAttribute('aMotion', new THREE.InstancedBufferAttribute(motion, 4));
  geo.setAttribute('aDirZ', new THREE.InstancedBufferAttribute(dirZ, 1));
  geo.instanceCount = n;

  const uniforms = {
    uTime: { value: 0 },
    uTex: { value: atlas },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
    uCamForward: { value: new THREE.Vector3(0, 0, -1) },
    uFogColor: { value: new THREE.Color(ctx?.scene?.fog?.color || 0xe9ddc5) },
    uFogDensity: { value: ctx?.scene?.fog?.density || 0.0009 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec3 aOrigin;
      attribute vec2 aCell;
      attribute vec2 aSize;
      attribute vec4 aMotion;
      attribute float aDirZ;
      uniform float uTime;
      uniform vec3 uCamRight;
      uniform vec3 uCamUp;
      uniform vec3 uCamForward;
      varying vec2 vUv;
      varying float vFade;
      varying float vFog;

      void main() {
        float phase = aMotion.x;
        float speed = aMotion.y;
        float span = aMotion.z;

        // 行走：沿方向来回、走出画外再折回（带一点上下起落）
        float walk = 0.0;
        float step = 0.0;
        if (span > 0.01) {
          float cycle = fract(uTime * speed * 0.06 + phase);
          walk = (cycle - 0.5) * span;
          step = sin(cycle * 6.283 * span * 0.5) * 0.03;
          // 走到两端淡出，避免「转身瞬移」的突兀
          float edge = smoothstep(0.0, 0.12, cycle) * (1.0 - smoothstep(0.88, 1.0, cycle));
          vFade = mix(0.35, 1.0, edge);
        } else {
          step = sin(uTime * 1.9 + phase * 6.283) * 0.015;
          vFade = 1.0;
        }

        vec3 origin = aOrigin;
        origin.x += aMotion.w * walk;
        origin.z += aDirZ * walk;
        // 远景降抖：远处的小人不该抖成噪点
        float dcam = length(aOrigin - cameraPosition);
        float dampP = 1.0 - smoothstep(360.0, 1000.0, dcam);
        origin.y += step * dampP;

        // 广告牌：始终面向相机
        float h = aSize.x;
        float w = aSize.y;
        vec3 p = origin
          + uCamRight * (uv.x - 0.5) * w
          + uCamUp * uv.y * h
          + uCamForward * 0.02;

        vec4 mv = viewMatrix * vec4(p, 1.0);
        vec4 clip = projectionMatrix * mv;
        vUv = vec2(aCell.x + uv.x / 4.0, aCell.y + uv.y / 3.0);
        vFog = length(origin - cameraPosition);
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform vec3 uFogColor;
      varying vec2 vUv;
      varying float vFade;
      varying float vFog;
      void main() {
        vec4 t = texture2D(uTex, vUv);
        if (t.a < 0.04) discard;
        // 极淡的空气透视：远处的人融进绢里
        float f = clamp(vFog / 260.0, 0.0, 0.55);
        vec3 col = mix(t.rgb, uFogColor, f);
        gl_FragColor = vec4(col, t.a * vFade);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  group.add(mesh);

  ctx.onTick?.((time) => {
    uniforms.uTime.value = time;
    const e = ctx.camera.matrixWorld.elements;
    uniforms.uCamRight.value.set(e[0], e[1], e[2]);
    uniforms.uCamUp.value.set(e[4], e[5], e[6]);
    uniforms.uCamForward.value.set(-e[8], -e[9], -e[10]);
  });

  return group;
}
