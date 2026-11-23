/**
 * water.js —— 湖、河、护城河的水面与岸线（负责：自然模块）。
 * 契约：export function buildWater(ctx) → THREE.Group。
 *
 * 做法：
 *   1. 所有水面（北海/中南海/什刹海/昆明湖 + 护城河 + 长河/通惠河/永定河）
 *      都烘进同一张几何：位置 + 一个 aT 属性（0 = 湖心，1 = 岸），只留 1 个 draw call。
 *   2. 自定义 ShaderMaterial：水墨底色的径向/横向浓淡 + 两层线描水纹（ctx.tex.waterLine）
 *      以不同方向、不同速度滚动 + 极缓的正弦起伏；带 fog（手写 fog chunk）。
 *   3. 岸线：同一片水外围再铺 2~3 圈「稍大的同形状」湿墨，透明度极低，
 *      像宣纸洇水；水草/芦苇是几笔墨线。
 *
 * 高度：layout.WATER_Y = -0.06，但 terrain.js 的纸面在 -0.02、墨晕在 -0.01，
 * 严格用 WATER_Y 会被纸面挡死。所以整体抬到「纸面之下、墨晕之上」，
 * 仍然是「低于地面」的水。若 terrain 以后改了层高，只需改下面两个常量。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { LAKES, MOAT, CANALS, RIVERS, WATER_Y } from '../layout.js';
import { mergeGeoms } from '../lib/geometry.js';

const SURF_Y = WATER_Y + 0.0568; // ≈ -0.0032，纸面(0)之下
const WET_Y = WATER_Y + 0.0532; // ≈ -0.0068，水面之下、纸面之上

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* -------------------------------------------------------------------------- */
/*  几何小工具                                                                  */
/* -------------------------------------------------------------------------- */

/** 多边形重心。 */
function polyCenter(points) {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p[0];
    z += p[1];
  }
  return [x / points.length, z / points.length];
}

/** 绕重心缩放多边形（用于做一圈稍大的岸线）。 */
function scalePolygon(points, c, s) {
  return points.map(([x, z]) => [c[0] + (x - c[0]) * s, c[1] + (z - c[1]) * s]);
}

/** 平均半径（用来把「世界单位的外扩」换成缩放比）。 */
function polyRadius(points, c) {
  let r = 0;
  for (const [x, z] of points) r += Math.hypot(x - c[0], z - c[1]);
  return r / points.length || 1;
}

/** Chaikin 切角：把湖岸那条折线磨圆，像手画的岸线。 */
function smoothPolygon(points, iterations = 2) {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]);
      out.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
    }
    pts = out;
  }
  return pts;
}

/** 多边形三角化（YX 平面里折腾，最后把局部 y 还原成世界 -z）。 */
function polygonTriangles(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.attributes.position;
  const idx = geo.index;
  const count = idx ? idx.count / 3 : pos.count / 3;
  const out = [];
  for (let i = 0; i < count; i++) {
    const ia = idx ? idx.getX(i * 3) : i * 3;
    const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
    const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
    const ax = pos.getX(ia);
    const az = -pos.getY(ia);
    const bx = pos.getX(ib);
    const bz = -pos.getY(ib);
    const cx = pos.getX(ic);
    const cz = -pos.getY(ic);
    // 统一朝上（+y），否则背面剔除会把水面吃没
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny < 0) out.push([ax, az, cx, cz, bx, bz]);
    else out.push([ax, az, bx, bz, cx, cz]);
  }
  geo.dispose();
  return out;
}

/** 把一条折线扩成带状三角面（带 mitre 转角、横向三排顶点方便上浓淡）。 */
function ribbonTriangles(points, halfWidth) {
  const n = points.length;
  if (n < 2) return [];
  const nrm = [];
  for (let i = 0; i < n; i++) {
    let dx;
    let dz;
    if (i === 0) {
      dx = points[1][0] - points[0][0];
      dz = points[1][1] - points[0][1];
    } else if (i === n - 1) {
      dx = points[n - 1][0] - points[n - 2][0];
      dz = points[n - 1][1] - points[n - 2][1];
    } else {
      dx = points[i + 1][0] - points[i - 1][0];
      dz = points[i + 1][1] - points[i - 1][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    nrm.push([-dz / len, dx / len]);
  }

  const rows = [];
  for (let i = 0; i < n; i++) {
    const [px, pz] = points[i];
    let nx = nrm[i][0];
    let nz = nrm[i][1];
    let w = halfWidth;
    if (i > 0 && i < n - 1) {
      const sx = nrm[i - 1][0] + nrm[i][0];
      const sz = nrm[i - 1][1] + nrm[i][1];
      const sl = Math.hypot(sx, sz) || 1;
      nx = sx / sl;
      nz = sz / sl;
      const dot = Math.max(0.45, nx * nrm[i][0] + nz * nrm[i][1]);
      w = Math.min(halfWidth / dot, halfWidth * 2.1);
    }
    rows.push([
      [px - nx * w, pz - nz * w, 0.96],
      [px, pz, 0.12],
      [px + nx * w, pz + nz * w, 0.96],
    ]);
  }

  const out = [];
  const push = (a, b, c) => {
    const ux = b[0] - a[0];
    const uz = b[1] - a[1];
    const vx = c[0] - a[0];
    const vz = c[1] - a[1];
    if (uz * vx - ux * vz < 0) out.push([a, c, b]);
    else out.push([a, b, c]);
  };
  for (let i = 0; i < n - 1; i++) {
    const A = rows[i];
    const B = rows[i + 1];
    push(A[0], B[0], A[1]);
    push(A[1], B[0], B[1]);
    push(A[1], B[1], A[2]);
    push(A[2], B[1], B[2]);
  }
  return out;
}

function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* -------------------------------------------------------------------------- */
/*  水面 shader                                                                 */
/* -------------------------------------------------------------------------- */

const WATER_VERT = /* glsl */ `
  attribute float aT;
  uniform float uTime;
  varying float vT;
  varying vec2 vPos;
  #include <fog_pars_vertex>

  void main() {
    vT = aT;
    vPos = position.xy;
    vec3 p = position;
    // 极缓的起伏：整片水像在呼吸，不晃眼
    p.z += sin(position.x * 0.19 + uTime * 0.38) * 0.014
         + sin(position.y * 0.13 - uTime * 0.24) * 0.011
         + sin((position.x + position.y) * 0.061 + uTime * 0.15) * 0.008;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform sampler2D uLines;
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uLine;
  uniform float uLineAlpha;
  uniform vec3 uRipples[6];
  varying float vT;
  varying vec2 vPos;
  #include <fog_pars_fragment>

  mat2 rot2(float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    float t = clamp(vT, 0.0, 1.0);
    // 灰蓝墨青：湖心深、近岸浅
    vec3 col = mix(uDeep, uShallow, smoothstep(0.04, 0.96, t));

    // 极淡的水面墨晕
    float cloud = sin(vPos.x * 0.045 + vPos.y * 0.037) * 0.5 + 0.5;
    col *= 0.97 + cloud * 0.06;

    // 线描水波：两层，方向不同、缓慢流动，能看出细密的水纹
    // 方向随位置缓慢变化 → 不是死板的斜线，而是像水面上的波纹
    float ang = 0.9 + sin(vPos.x * 0.021 + vPos.y * 0.017) * 0.85 + sin(vPos.x * 0.006 - vPos.y * 0.009) * 0.5;
    vec2 warp = vec2(sin(vPos.y * 0.62 + uTime * 0.10), cos(vPos.x * 0.53 - uTime * 0.08)) * 0.05;
    vec2 warp2 = vec2(sin(vPos.y * 0.37 - uTime * 0.06), cos(vPos.x * 0.44 + uTime * 0.05)) * 0.07;
    float a1 = texture2D(uLines, rot2(ang) * vPos * 0.105 + warp + vec2(uTime * 0.011, 0.0)).r;
    float a2 = texture2D(uLines, rot2(ang + 1.4) * vPos * 0.148 - warp2 + vec2(uTime * -0.007, 0.021)).r;
    float line = max(a1 * 0.85, a2 * 0.6);
    float mask = smoothstep(0.05, 0.36, line);
    col = mix(col, uLine, mask * uLineAlpha * 0.85);

    // 缓慢扩散的涟漪环（6 处）
    float rip = 0.0;
    for (int i = 0; i < 6; i++) {
      vec2 c = uRipples[i].xy;
      float ph = uRipples[i].z;
      float d = length(vPos - c);
      float w = sin(d * 2.6 - uTime * 1.15 + ph * 6.2831);
      rip += w * exp(-d * 0.085) * smoothstep(0.0, 1.6, d);
    }
    col += rip * 0.03;

    // 近岸收一笔深墨
    col *= 1.0 - smoothstep(0.72, 1.0, t) * 0.14;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/* -------------------------------------------------------------------------- */
/*  主入口                                                                      */
/* -------------------------------------------------------------------------- */

export function buildWater(ctx) {
  const group = new THREE.Group();
  group.name = 'water';

  const { tex } = ctx;
  const rngSeed = 20261105;

  /** 水面三角形：[[x,z,t] ×3] */
  const surfTris = [];

  /** 湿墨岸三角形：[[x,z,alpha] ×3] */
  const wetTris = [];

  /* —— 1. 湖 —— */
  for (const key of Object.keys(LAKES)) {
    const lake = LAKES[key];
    // 湖岸加密 + 磨圆：layout 给的是手画的折线，这里再按 Beziers 的感觉抹一遍
    const pts = smoothPolygon(lake.points, 2);
    const c = polyCenter(pts);
    const radius = polyRadius(pts, c);

    // 水面：aT = 归一化到岸的距离
    for (const tri of polygonTriangles(pts)) {
      const arr = [];
      for (let i = 0; i < 3; i++) {
        const x = tri[i * 2];
        const z = tri[i * 2 + 1];
        const dx = (x - c[0]) / (lake.rx || radius);
        const dz = (z - c[1]) / (lake.rz || radius);
        arr.push([x, z, Math.pow(clamp01(Math.hypot(dx, dz)), 0.78)]);
      }
      surfTris.push(arr);
    }

    // 湿墨岸：三圈，越外越淡（宣纸洇水）
    const rings = [
      [2.9, 0.028],
      [1.5, 0.065],
      [0.6, 0.13],
    ];
    for (const [d, alpha] of rings) {
      const grown = scalePolygon(pts, c, 1 + d / radius);
      for (const tri of polygonTriangles(grown)) {
        wetTris.push([
          [tri[0], tri[1], alpha],
          [tri[2], tri[3], alpha],
          [tri[4], tri[5], alpha],
        ]);
      }
    }
  }

  /* —— 2. 护城河：内城一圈矩形水环 —— */
  {
    const o = MOAT.outer;
    const i = MOAT.inner;
    const outerShape = new THREE.Shape();
    outerShape.moveTo(-o.halfX, -o.north);
    outerShape.lineTo(o.halfX, -o.north);
    outerShape.lineTo(o.halfX, -o.south);
    outerShape.lineTo(-o.halfX, -o.south);
    outerShape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-i.halfX, -i.north);
    hole.lineTo(-i.halfX, -i.south);
    hole.lineTo(i.halfX, -i.south);
    hole.lineTo(i.halfX, -i.north);
    hole.closePath();
    outerShape.holes.push(hole);

    const geo = new THREE.ShapeGeometry(outerShape);
    const pos = geo.attributes.position;
    const idx = geo.index;
    const count = idx ? idx.count / 3 : pos.count / 3;
    for (let k = 0; k < count; k++) {
      const ia = idx ? idx.getX(k * 3) : k * 3;
      const ib = idx ? idx.getX(k * 3 + 1) : k * 3 + 1;
      const ic = idx ? idx.getX(k * 3 + 2) : k * 3 + 2;
      const ax = pos.getX(ia);
      const az = -pos.getY(ia);
      const bx = pos.getX(ib);
      const bz = -pos.getY(ib);
      const cx = pos.getX(ic);
      const cz = -pos.getY(ic);
      const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      const a = [ax, az, 0.9];
      const b = [bx, bz, 0.9];
      const cc = [cx, cz, 0.9];
      surfTris.push(ny < 0 ? [a, cc, b] : [a, b, cc]);
    }
    geo.dispose();

    // 护城河两岸的湿墨：同一条环再粗两圈（内城一圈就够）
    const wetRings = [
      [3.6, 0.03],
      [1.9, 0.065],
      [0.8, 0.13],
    ];
    for (const [d, alpha] of wetRings) {
      const oo = {
        halfX: o.halfX + d,
        north: o.north - d,
        south: o.south + d,
      };
      const ii = {
        halfX: Math.max(0.1, i.halfX - d),
        north: Math.min(oo.north + 0.1, i.north + d),
        south: Math.max(oo.south - 0.1, i.south - d),
      };
      const s2 = new THREE.Shape();
      s2.moveTo(-oo.halfX, -oo.north);
      s2.lineTo(oo.halfX, -oo.north);
      s2.lineTo(oo.halfX, -oo.south);
      s2.lineTo(-oo.halfX, -oo.south);
      s2.closePath();
      const h2 = new THREE.Path();
      h2.moveTo(-ii.halfX, -ii.north);
      h2.lineTo(-ii.halfX, -ii.south);
      h2.lineTo(ii.halfX, -ii.south);
      h2.lineTo(ii.halfX, -ii.north);
      h2.closePath();
      s2.holes.push(h2);
      const g2 = new THREE.ShapeGeometry(s2);
      const p2 = g2.attributes.position;
      const x2 = g2.index;
      const c2 = x2 ? x2.count / 3 : p2.count / 3;
      for (let k = 0; k < c2; k++) {
        const ia = x2 ? x2.getX(k * 3) : k * 3;
        const ib = x2 ? x2.getX(k * 3 + 1) : k * 3 + 1;
        const ic = x2 ? x2.getX(k * 3 + 2) : k * 3 + 2;
        const ax = p2.getX(ia);
        const az = -p2.getY(ia);
        const bx = p2.getX(ib);
        const bz = -p2.getY(ib);
        const cx = p2.getX(ic);
        const cz = -p2.getY(ic);
        const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        const a = [ax, az, alpha];
        const b = [bx, bz, alpha];
        const cc = [cx, cz, alpha];
        wetTris.push(ny < 0 ? [a, cc, b] : [a, b, cc]);
      }
      g2.dispose();
    }
  }

  /* —— 3. 河道 / 大河：折线生成带状水面 —— */
  const waterLines = [];
  for (const canal of [...CANALS, ...RIVERS]) {
    const hw = canal.width / 2;
    for (const tri of ribbonTriangles(canal.points, hw)) {
      surfTris.push([
        [tri[0][0], tri[0][1], tri[0][2]],
        [tri[1][0], tri[1][1], tri[1][2]],
        [tri[2][0], tri[2][1], tri[2][2]],
      ]);
    }
    // 湿墨岸：一条比河面更宽的暗带，压在下面
    for (const [extra, alpha] of [
      [3.0, 0.03],
      [1.7, 0.065],
      [0.8, 0.13],
    ]) {
      for (const tri of ribbonTriangles(canal.points, hw + extra)) {
        wetTris.push([
          [tri[0][0], tri[0][1], alpha],
          [tri[1][0], tri[1][1], alpha],
          [tri[2][0], tri[2][1], alpha],
        ]);
      }
    }
    waterLines.push(canal);
  }

  /* —— 4. 组装几何 —— */
  const surfPos = new Float32Array(surfTris.length * 9);
  const surfAT = new Float32Array(surfTris.length * 3);
  for (let i = 0; i < surfTris.length; i++) {
    const t = surfTris[i];
    for (let j = 0; j < 3; j++) {
      // 顶点先放在局部 XY 平面 (x, -z)，mesh 再绕 X 转 -90° → 世界 (x, 0, z)
      surfPos[i * 9 + j * 3] = t[j][0];
      surfPos[i * 9 + j * 3 + 1] = -t[j][1];
      surfPos[i * 9 + j * 3 + 2] = 0;
      surfAT[i * 3 + j] = t[j][2];
    }
  }
  const surfGeo = new THREE.BufferGeometry();
  surfGeo.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
  surfGeo.setAttribute('aT', new THREE.BufferAttribute(surfAT, 1));
  surfGeo.computeBoundingSphere();

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uLines: { value: null },
      uDeep: { value: new THREE.Color(0x4a565e) },
      uShallow: { value: new THREE.Color(0x5e6b73) },
      uLine: { value: new THREE.Color(0xe4ece2) },
      uLineAlpha: { value: 0.5 },
      uRipples: {
        value: [
          new THREE.Vector3(-230, -200, 0.1),
          new THREE.Vector3(-224, -194, 0.55),
          new THREE.Vector3(-29, -18, 0.3),
          new THREE.Vector3(-30, -20, 0.8),
          new THREE.Vector3(-28, -86, 0.45),
          new THREE.Vector3(-176, -152, 0.2),
        ],
      },
    },
  ]);
  uniforms.uLines.value = tex.waterLine;

  const waterMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    fog: true,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const surfMesh = new THREE.Mesh(surfGeo, waterMat);
  surfMesh.name = 'water-surface';
  surfMesh.position.y = SURF_Y;
  surfMesh.rotation.x = -Math.PI / 2;
  surfMesh.renderOrder = 20;
  surfMesh.frustumCulled = false;
  group.add(surfMesh);

  // 湿墨岸
  const wetPos = new Float32Array(wetTris.length * 9);
  const wetCol = new Float32Array(wetTris.length * 12);
  const ink = new THREE.Color(P.INK_DEEP);
  for (let i = 0; i < wetTris.length; i++) {
    const t = wetTris[i];
    for (let j = 0; j < 3; j++) {
      wetPos[i * 9 + j * 3] = t[j][0];
      wetPos[i * 9 + j * 3 + 1] = -t[j][1];
      wetPos[i * 9 + j * 3 + 2] = 0;
      wetCol[i * 12 + j * 4] = ink.r;
      wetCol[i * 12 + j * 4 + 1] = ink.g;
      wetCol[i * 12 + j * 4 + 2] = ink.b;
      wetCol[i * 12 + j * 4 + 3] = t[j][2];
    }
  }
  const wetGeo = new THREE.BufferGeometry();
  wetGeo.setAttribute('position', new THREE.BufferAttribute(wetPos, 3));
  wetGeo.setAttribute('color', new THREE.BufferAttribute(wetCol, 4));
  wetGeo.computeBoundingSphere();

  const wetMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const wetMesh = new THREE.Mesh(wetGeo, wetMat);
  wetMesh.name = 'water-shore-wash';
  wetMesh.position.y = WET_Y;
  wetMesh.rotation.x = -Math.PI / 2;
  wetMesh.renderOrder = 10;
  wetMesh.frustumCulled = false;
  group.add(wetMesh);

  /* —— 5. 水草 / 芦苇：几笔深墨，贴着岸长 —— */
  const reedTris = [];
  const reedColorTop = new THREE.Color(P.INK_DEEP);
  const reedColorBot = new THREE.Color(P.PINE);
  let seed = rngSeed;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const addReedClump = (x, z, dirX, dirZ, scale) => {
    const blades = 3 + Math.floor(rand() * 4);
    for (let b = 0; b < blades; b++) {
      const a = rand() * Math.PI * 2;
      const ox = Math.cos(a) * 0.22 * scale;
      const oz = Math.sin(a) * 0.22 * scale;
      const sway = (rand() - 0.5) * 0.7;
      const height = (0.45 + rand() * 0.75) * scale;
      const halfW = 0.035 + rand() * 0.03;
      const bx = x + ox;
      const bz = z + oz;
      // 叶尖朝水外/水面
      const tx = bx + dirX * (0.2 + sway * 0.5) * scale;
      const tz = bz + dirZ * (0.2 + sway * 0.5) * scale;
      // 两片交叉的窄三角，让它在俯视下也有体积
      reedTris.push([
        [bx - dirZ * halfW, bz + dirX * halfW, 0.55],
        [bx + dirZ * halfW, bz - dirX * halfW, 0.55],
        [tx, tz, 0.02],
        height,
        b < 2 ? 0 : 1,
      ]);
      reedTris.push([
        [bx + dirX * halfW, bz + dirZ * halfW, 0.55],
        [bx - dirX * halfW, bz - dirZ * halfW, 0.55],
        [tx + dirX * 0.04, tz + dirZ * 0.04, 0.02],
        height,
        b < 2 ? 0 : 1,
      ]);
    }
  };

  for (const key of Object.keys(LAKES)) {
    const lake = LAKES[key];
    const pts = smoothPolygon(lake.points, 2);
    const c = polyCenter(pts);
    const step = Math.max(2, Math.floor(pts.length / 14));
    for (let i = 0; i < pts.length; i += step) {
      if (rand() < 0.32) continue;
      const [x, z] = pts[i];
      let dx = x - c[0];
      let dz = z - c[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const off = 0.25 + rand() * 0.9;
      addReedClump(x + dx * off, z + dz * off, -dx, -dz, 0.9 + rand() * 0.7);
    }
  }
  for (const canal of waterLines) {
    const hw = canal.width / 2;
    const pts = canal.points;
    for (let i = 1; i < pts.length - 1; i++) {
      if (rand() < 0.45) continue;
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const side = rand() < 0.5 ? 1 : -1;
      const jitter = (rand() - 0.5) * 2;
      const [px, pz] = pts[i];
      addReedClump(
        px + nx * side * (hw + 0.2 + rand() * 0.5) + jitter,
        pz + nz * side * (hw + 0.2 + rand() * 0.5) + jitter,
        -nx * side,
        -nz * side,
        0.8 + rand() * 0.6,
      );
    }
  }

  // 芦苇几何：底部两个点 + 叶尖
  const reedPos = [];
  const reedCol = [];
  const tmpC = new THREE.Color();
  for (const r of reedTris) {
    const [a, b, tip, height, tone] = r;
    tmpC.copy(reedColorBot).lerp(reedColorTop, tone === 0 ? 0.75 : 1);
    const verts = [
      [a[0], 0, a[1]],
      [b[0], 0, b[1]],
      [tip[0], height, tip[1]],
    ];
    // 法线朝上，双面材质所以怎么绕都行
    for (const v of verts) {
      reedPos.push(v[0], v[1], v[2]);
      reedCol.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  if (reedPos.length) {
    const reedGeo = new THREE.BufferGeometry();
    reedGeo.setAttribute('position', new THREE.Float32BufferAttribute(reedPos, 3));
    reedGeo.setAttribute('color', new THREE.Float32BufferAttribute(reedCol, 3));
    reedGeo.computeBoundingSphere();
    const reedMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: true,
    });
    const reeds = new THREE.Mesh(reedGeo, reedMat);
    reeds.name = 'water-reeds';
    reeds.renderOrder = 22;
    reeds.frustumCulled = false;
    group.add(reeds);
    group.userData.reedMat = reedMat;
  }

  /* —— 5.5 倒影：岸边 / 岛边的竖向淡墨条（假反射，不用真反射） —— */
  {
    const rpos = [];
    const rcol = [];
    const reflInk = new THREE.Color(0x39453f);
    const RA = rand;
    const addReflection = (x, z, ix, iz, len, w, alpha) => {
      // 从岸上往水里拉一条细长的墨条，长度渐隐
      const px = -iz * w;
      const pz = ix * w;
      const tipX = x + ix * len;
      const tipZ = z + iz * len;
      const quad = [
        [x + px, z + pz, alpha],
        [x - px, z - pz, alpha],
        [tipX - px * 0.5, tipZ - pz * 0.5, 0.0],
        [tipX + px * 0.5, tipZ + pz * 0.5, 0.0],
      ];
      const tris = [
        [quad[0], quad[1], quad[2], quad[1], quad[3], quad[2]],
      ];
      for (const t of tris) {
        for (const v of t) {
          rpos.push(v[0], 0, v[1]);
          rcol.push(reflInk.r, reflInk.g, reflInk.b, v[2]);
        }
      }
    };

    for (const key of Object.keys(LAKES)) {
      const lake = LAKES[key];
      const pts = smoothPolygon(lake.points, 2);
      const c = polyCenter(pts);
      const step = Math.max(1, Math.floor(pts.length / 26));
      for (let i = 0; i < pts.length; i += step) {
        if (RA() < 0.35) continue;
        const [x, z] = pts[i];
        let dx = c[0] - x;
        let dz = c[1] - z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const len = 1.6 + RA() * 3.6;
        addReflection(x + dx * 0.15, z + dz * 0.15, dx, dz, len, 0.1 + RA() * 0.18, 0.22 + RA() * 0.16);
      }
    }
    // 河道两岸也来几笔
    for (const canal of CANALS) {
      const hw = canal.width / 2;
      const pts = canal.points;
      for (let i = 1; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i - 1];
        const [x1, z1] = pts[i + 1];
        let dx = x1 - x0;
        let dz = z1 - z0;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const side = RA() < 0.5 ? 1 : -1;
        const nx = -dz * side;
        const nz = dx * side;
        addReflection(pts[i][0] + nx * (hw - 0.1), pts[i][1] + nz * (hw - 0.1), -nx, -nz, 1.2 + RA() * 2.2, 0.08 + RA() * 0.12, 0.2);
      }
    }

    if (rpos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(rcol, 4));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
        fog: true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'water-reflections';
      mesh.position.y = SURF_Y + 0.05;
      mesh.renderOrder = 21;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
  }

  /* —— 5.6 小舟 / 画舫：墨色小船 + 一点灯火，缓慢移动 —— */
  const boats = [];
  {
    const parts = [];
    const paint = (geo, hex) => {
      const c = new THREE.Color(hex);
      const n = geo.attributes.position.count;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      return geo;
    };
    // 船身
    const hull = new THREE.BoxGeometry(3.4, 0.26, 0.95);
    hull.translate(0, 0.13, 0);
    parts.push(paint(hull, 0x2f3a3d));
    // 船头 / 船尾翘起
    const bow = new THREE.BoxGeometry(0.9, 0.2, 0.9);
    bow.rotateZ(0.22);
    bow.translate(1.55, 0.2, 0);
    parts.push(paint(bow, 0x333e41));
    const stern = new THREE.BoxGeometry(0.7, 0.18, 0.9);
    stern.rotateZ(-0.2);
    stern.translate(-1.6, 0.19, 0);
    parts.push(paint(stern, 0x333e41));
    // 篷
    const canopy = new THREE.BoxGeometry(1.5, 0.42, 0.86);
    canopy.translate(-0.1, 0.47, 0);
    parts.push(paint(canopy, 0x8d9183));
    const roof = new THREE.BoxGeometry(1.72, 0.09, 0.96);
    roof.translate(-0.1, 0.72, 0);
    parts.push(paint(roof, 0x49545a));
    // 灯火
    const lamp = new THREE.SphereGeometry(0.12, 6, 4);
    lamp.translate(1.0, 0.46, 0);
    parts.push(paint(lamp, 0xf0a862));
    const boatGeo = mergeGeoms(parts);

    const boatMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: true });
    // 每条小舟一条环形水路：半径沿射线采样水面，保证不出湖
    const openRadius = (lake, ang, frac) => {
      const pts = smoothPolygon(lake.points, 2);
      let maxR = 0;
      for (let k = 1; k <= 30; k++) {
        const r = k * 0.6;
        const x = lake.cx + Math.cos(ang) * r;
        const z = lake.cz + Math.sin(ang) * r;
        if (pointInPoly(x, z, pts)) maxR = r;
      }
      return Math.max(1.2, maxR * frac);
    };
    const boatDefs = [
      { lake: LAKES.kunming, ang: 0.4, speed: 0.05, phase: 0.3, w: 0.76, s: 1.25 },
      { lake: LAKES.kunming, ang: 2.6, speed: -0.068, phase: 2.1, w: 0.8, s: 1.0 },
      { lake: LAKES.beihai, ang: 1.2, speed: 0.085, phase: 1.2, w: 0.84, s: 1.15 },
      { lake: LAKES.shichahai, ang: 3.4, speed: -0.06, phase: 4.0, w: 0.7, s: 1.0 },
      { lake: LAKES.fuhai, ang: 0.8, speed: 0.06, phase: 5.1, w: 0.8, s: 1.1 },
      { lake: LAKES.zhongnanhai, ang: 2.2, speed: -0.08, phase: 3.2, w: 0.78, s: 1.0 },
    ];
    const specs = boatDefs.map((b) => ({
      cx: b.lake.cx,
      cz: b.lake.cz,
      r: openRadius(b.lake, b.ang, 0.62),
      speed: b.speed,
      phase: b.phase,
      w: b.w,
      s: b.s,
    }));
    const mesh = new THREE.InstancedMesh(boatGeo, boatMat, specs.length);
    mesh.name = 'water-boats';
    mesh.frustumCulled = false;
    mesh.renderOrder = 23;
    group.add(mesh);

    // 灯火的光晕
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(specs.length * 3), 3));
    glowGeo.computeBoundingSphere();
    const glowMat = new THREE.PointsMaterial({
      map: tex.glow,
      color: 0xffa864,
      size: 1.9,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: true,
    });
    const lamps = new THREE.Points(glowGeo, glowMat);
    lamps.name = 'boat-lamps';
    lamps.frustumCulled = false;
    lamps.renderOrder = 24;
    group.add(lamps);

    const m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const attr = glowGeo.attributes.position;
    boats.push((t) => {
      for (let i = 0; i < specs.length; i++) {
        const b = specs[i];
        const a = b.phase + t * b.speed;
        const x = b.cx + Math.cos(a) * b.r;
        const z = b.cz + Math.sin(a) * b.r * b.w;
        const dx = -Math.sin(a) * b.r * b.speed;
        const dz = Math.cos(a) * b.r * b.w * b.speed;
        const yaw = Math.atan2(-dz, dx);
        quat.setFromAxisAngle(up, yaw);
        pos.set(x, SURF_Y - 0.04 + Math.sin(t * 1.2 + b.phase) * 0.012, z);
        scl.set(b.s, b.s, b.s);
        m4.compose(pos, quat, scl);
        mesh.setMatrixAt(i, m4);
        attr.setXYZ(i, x + Math.cos(yaw) * 0.35, pos.y + 0.5, z - Math.sin(yaw) * 0.35);
      }
      mesh.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
    });
  }

  /* —— 6. 动画 + 晨暮 —— */
  const DAY = {
    deep: new THREE.Color(0x4a565e),
    shallow: new THREE.Color(0x5e6b73),
    line: new THREE.Color(0xe4ece2),
  };
  const DUSK = {
    deep: new THREE.Color(0x3b4750),
    shallow: new THREE.Color(0x4f5c64),
    line: new THREE.Color(0xe6cfb0),
  };
  const wetDay = new THREE.Color(P.INK_DEEP);
  const wetDusk = new THREE.Color(0x241b16);

  let blend = 0;
  let clock = 0;
  const isDusk = () => {
    if (typeof document === 'undefined') return false;
    const t = document.body && document.body.dataset && document.body.dataset.time;
    return t === 'dusk';
  };

  const tick = (time, delta) => {
    const dt = typeof delta === 'number' && delta > 0 && delta < 0.5 ? delta : 0.016;
    clock += dt;
    for (const b of boats) b(clock);
    uniforms.uTime.value = clock;
    const target = isDusk() ? 1 : 0;
    blend += (target - blend) * Math.min(1, dt * 2.2);
    uniforms.uDeep.value.copy(DAY.deep).lerp(DUSK.deep, blend);
    uniforms.uShallow.value.copy(DAY.shallow).lerp(DUSK.shallow, blend);
    uniforms.uLine.value.copy(DAY.line).lerp(DUSK.line, blend);
    wetMat.color.copy(wetDay).lerp(wetDusk, blend);
    if (group.userData.reedMat) {
      group.userData.reedMat.color.setRGB(1, 1, 1).lerp(wetDusk, blend * 0.35);
    }
  };

  if (typeof ctx.onTick === 'function') ctx.onTick(tick);
  else tick(0, 0.016);

  group.userData.surface = surfMesh;
  group.userData.wet = wetMesh;
  return group;
}
