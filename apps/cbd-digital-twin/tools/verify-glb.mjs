#!/usr/bin/env node
/**
 * verify-glb.mjs — 校验 3D Tiles 白模资产结构（零依赖，Node 18+）
 *
 * 检查项：
 *   GLB:  magic='glTF' / version=2 / header.length==文件大小 / chunk 4 字节对齐 /
 *         JSON chunk 可解析 / BIN chunk 存在 / buffer.byteLength 与 BIN 一致 /
 *         bufferView 偏移对齐与越界 / accessor count 与 byteLength 自洽 /
 *         POSITION min/max 完整且覆盖实际数据 / 索引范围 / 法线单位性抽检
 *   tileset: asset.version=1.1 / root.transform 16 个数且正交归一（右手系）/
 *         root.boundingVolume.box 12 个数且覆盖 GLB 顶点（含 Y-up→Z-up 轴映射）/
 *         content.uri 指向的文件存在
 *
 * 用法：
 *   node tools/verify-glb.mjs
 *   node tools/verify-glb.mjs --data public/data
 *   node tools/verify-glb.mjs --glb path/to/x.glb --tileset path/to/tileset.json
 *
 * 退出码：0 全部通过；1 有错误。
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
function opt(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const dataDir = resolve(opt('data', resolve(HERE, '..', 'public', 'data')));
const glbPath = resolve(opt('glb', resolve(dataDir, 'tiles/white-models/white-models.glb')));
const tilesetPath = resolve(opt('tileset', resolve(dataDir, 'tiles/white-models/tileset.json')));

const errors = [];
const warnings = [];
const ok = (label, detail = '') => console.log(`  ✅ ${label}${detail ? '  ' + detail : ''}`);
const bad = (label, detail = '') => { errors.push(label + (detail ? ': ' + detail : '')); console.log(`  ❌ ${label}${detail ? '  ' + detail : ''}`); };
const warn = (label, detail = '') => { warnings.push(label + (detail ? ': ' + detail : '')); console.log(`  ⚠️  ${label}${detail ? '  ' + detail : ''}`); };
const pad4 = (n) => (4 - (n % 4)) % 4;

function fmt(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

/* ------------------------------------------------------------------ GLB */
console.log(`\n=== GLB: ${glbPath} ===`);
let gltf = null;
let bin = null;
let posMin = null;
let posMax = null;

if (!existsSync(glbPath)) {
  bad('文件不存在');
} else {
  const buf = readFileSync(glbPath);
  console.log(`  文件: ${fmt(buf.byteLength)}`);
  if (buf.byteLength < 20) {
    bad('文件过短');
  } else {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const magic = dv.getUint32(0, true);
    const version = dv.getUint32(4, true);
    const length = dv.getUint32(8, true);
    magic === 0x46546c67 ? ok('magic = glTF') : bad('magic 不是 glTF', '0x' + magic.toString(16));
    version === 2 ? ok('version = 2') : bad('version is not 2', String(version));
    length === buf.byteLength ? ok('header.length == 文件大小', String(length)) : bad('header.length 与文件大小不符', `${length} vs ${buf.byteLength}`);

    let off = 12;
    const chunks = [];
    while (off + 8 <= buf.byteLength) {
      const clen = dv.getUint32(off, true);
      const ctype = dv.getUint32(off + 4, true);
      off += 8;
      if (off + clen > buf.byteLength) { bad('chunk 越界'); break; }
      chunks.push({ clen, ctype, body: buf.subarray(off, off + clen) });
      off += clen;
    }
    off === buf.byteLength ? ok('chunk 结构完整') : bad('解析后仍有残余字节', `${off} / ${buf.byteLength}`);
    const jsonChunk = chunks.find((c) => c.ctype === 0x4e4f534a);
    bin = chunks.find((c) => c.ctype === 0x004e4942)?.body ?? null;
    jsonChunk ? ok('JSON chunk', fmt(jsonChunk.clen)) : bad('缺少 JSON chunk');
    bin ? ok('BIN chunk', fmt(bin.byteLength)) : bad('缺少 BIN chunk');
    for (const c of chunks) c.clen % 4 === 0 ? null : bad('chunk 未 4 字节对齐', String(c.clen));
    ok('chunk 长度均 4 字节对齐', chunks.map((c) => c.clen).join(' / '));

    if (jsonChunk) {
      try {
        gltf = JSON.parse(new TextDecoder().decode(jsonChunk.body).trim());
        ok('JSON chunk 可解析', `glTF ${gltf?.asset?.version}`);
      } catch (e) {
        bad('JSON chunk 解析失败', e.message);
      }
    }
  }
}

if (gltf && bin) {
  const pl = gltf.buffers?.[0]?.byteLength ?? 0;
  (pl <= bin.byteLength && pl > bin.byteLength - 4)
    ? ok('buffer.byteLength 与 BIN chunk 自洽', `${pl} <= ${bin.byteLength}`)
    : bad('buffer.byteLength 与 BIN chunk 不匹配', `${pl} vs ${bin.byteLength}`);

  for (const [i, bv] of (gltf.bufferViews ?? []).entries()) {
    const o = bv.byteOffset ?? 0;
    o % 4 === 0 ? null : bad(`bufferView[${i}] 偏移未对齐`, String(o));
    (o + bv.byteLength <= bin.byteLength) ? null : bad(`bufferView[${i}] 越界`);
  }
  ok('bufferViews 对齐/边界', `${gltf.bufferViews.length} 个`);
  const unit = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const arity = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  for (const [i, a] of (gltf.accessors ?? []).entries()) {
    const need = unit[a.componentType] * arity[a.type] * a.count;
    const bv = gltf.bufferViews[a.bufferView];
    need <= bv.byteLength ? null : bad(`accessor[${i}] 数据量超出 bufferView`, `${need} > ${bv.byteLength}`);
  }
  ok('accessors count/byteLength 自洽', `${gltf.accessors.length} 个`);

  const posAcc = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  if (!posAcc.min || !posAcc.max) bad('POSITION accessor 缺少 min/max');
  else ok('POSITION min/max 存在', JSON.stringify(posAcc.min) + ' → ' + JSON.stringify(posAcc.max));

  // 解码 POSITION（float32 VEC3）
  if (posAcc.componentType === 5126) {
    const bv = gltf.bufferViews[posAcc.bufferView];
    const start = (bv.byteOffset ?? 0) + (posAcc.byteOffset ?? 0);
    const vals = new Float32Array(bin.buffer, bin.byteOffset + start, posAcc.count * 3);
    posMin = [Infinity, Infinity, Infinity];
    posMax = [-Infinity, -Infinity, -Infinity];
    let nan = 0;
    for (let k = 0; k < vals.length; k += 3) {
      for (let c = 0; c < 3; c++) {
        const v = vals[k + c];
        if (!Number.isFinite(v)) nan++;
        if (v < posMin[c]) posMin[c] = v;
        if (v > posMax[c]) posMax[c] = v;
      }
    }
    nan ? bad('POSITION 含 NaN/Inf', String(nan)) : ok('POSITION 无 NaN/Inf', `${posAcc.count} 顶点`);
    let mis = 0;
    for (let c = 0; c < 3; c++) {
      if (Math.abs(posMin[c] - posAcc.min[c]) > 1e-3 || Math.abs(posMax[c] - posAcc.max[c]) > 1e-3) mis++;
    }
    mis ? bad('POSITION min/max 与实际数据不符') : ok('POSITION min/max 覆盖实际数据');
  } else {
    warn('POSITION componentType 非 float32，跳过数据校验');
  }

  // 索引
  const idxAcc = gltf.accessors[gltf.meshes[0].primitives[0].indices];
  const idxBv = gltf.bufferViews[idxAcc.bufferView];
  const idxStart = (idxBv.byteOffset ?? 0) + (idxAcc.byteOffset ?? 0);
  let idxOk = true;
  if (idxAcc.componentType === 5125) {
    const arr = new Uint32Array(bin.buffer, bin.byteOffset + idxStart, idxAcc.count);
    let max = 0;
    for (const v of arr) if (v > max) max = v;
    max < posAcc.count ? ok('索引范围合法', `max=${max} < vertexCount=${posAcc.count}`) : bad('索引越界', `max=${max}`);
    idxAcc.count % 3 === 0 ? ok('索引数为 3 的倍数', `${idxAcc.count / 3} 三角形`) : bad('索引数不是 3 的倍数');
    idxOk = true;
  } else {
    warn('indices componentType 非 UNSIGNED_INT', String(idxAcc.componentType));
  }
  if (!idxOk) bad('索引校验失败');

  // 法线抽检
  const nrmAcc = gltf.accessors[gltf.meshes[0].primitives[0].attributes.NORMAL];
  if (nrmAcc) {
    const bv = gltf.bufferViews[nrmAcc.bufferView];
    const start = (bv.byteOffset ?? 0) + (nrmAcc.byteOffset ?? 0);
    const vals = new Float32Array(bin.buffer, bin.byteOffset + start, nrmAcc.count * 3);
    let badN = 0;
    const step = 3 * 97;
    for (let k = 0; k < vals.length; k += step) {
      const l = Math.hypot(vals[k], vals[k + 1], vals[k + 2]);
      if (Math.abs(l - 1) > 1e-2) badN++;
    }
    badN ? warn('NORMAL 抽检存在非单位向量', String(badN)) : ok('NORMAL 单位化抽检通过');
    ok('COLOR_0 存在', gltf.accessors[gltf.meshes[0].primitives[0].attributes.COLOR_0]
      ? `normalized=${gltf.accessors[gltf.meshes[0].primitives[0].attributes.COLOR_0].normalized === true}`
      : '缺失');
  } else {
    warn('缺少 NORMAL 属性（客户端需自行计算平面法线）');
  }
  const mat = gltf.materials?.[0]?.pbrMetallicRoughness;
  mat ? ok('材质', `metallic=${mat.metallicFactor} roughness=${mat.roughnessFactor} doubleSided=${gltf.materials[0].doubleSided}`) : warn('缺少材质');
  console.log(`  ℹ️  顶点 ${posAcc.count} · 三角形 ${idxAcc.count / 3} · 顶点数据 ${fmt(posAcc.count * 12)} / 索引 ${fmt(idxAcc.count * 4)}`);
}

/* -------------------------------------------------------------- tileset */
console.log(`\n=== Tileset: ${tilesetPath} ===`);
let tileset = null;
if (!existsSync(tilesetPath)) {
  bad('文件不存在');
} else {
  try {
    tileset = JSON.parse(readFileSync(tilesetPath, 'utf8'));
    ok('JSON 可解析', `${fmt(readFileSync(tilesetPath).byteLength)}`);
  } catch (e) {
    bad('JSON 解析失败', e.message);
  }
}

let box = null;
let transform = null;
if (tileset) {
  const root = tileset.root ?? {};
  const ver = String(tileset.asset?.version ?? '');
  ver.startsWith('1.1') ? ok('asset.version = 1.1') : bad('asset.version 不是 1.1', ver);
  const t = root.transform;
  if (!Array.isArray(t) || t.length !== 16 || !t.every(Number.isFinite)) {
    bad('root.transform 缺失或不是 16 个数字');
  } else {
    transform = t;
    const cols = [t.slice(0, 3), t.slice(4, 7), t.slice(8, 11)];
    let ortho = true;
    for (let i = 0; i < 3; i++) {
      const l = Math.hypot(...cols[i]);
      if (Math.abs(l - 1) > 1e-6) { ortho = false; bad(`transform 列${i} 不是单位向量`, l.toFixed(9)); }
    }
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        const d = cols[i][0] * cols[j][0] + cols[i][1] * cols[j][1] + cols[i][2] * cols[j][2];
        if (Math.abs(d) > 1e-9) { ortho = false; bad(`transform 列${i}·列${j} != 0`, String(d)); }
      }
    }
    const det =
      cols[0][0] * (cols[1][1] * cols[2][2] - cols[1][2] * cols[2][1]) -
      cols[1][0] * (cols[0][1] * cols[2][2] - cols[0][2] * cols[2][1]) +
      cols[2][0] * (cols[0][1] * cols[1][2] - cols[0][2] * cols[1][1]);
    det > 0 ? ok('transform 右手系（det=+1）', det.toFixed(9)) : bad('transform 为镜像（det<0）', String(det));
    if (ortho && det > 0) ok('transform 正交归一');
    (t[3] === 0 && t[7] === 0 && t[11] === 0 && t[15] === 1) ? ok('transform 第 4 行合法') : bad('transform 第 4 行非法');
    // 平移列的模长 ≈ 地球半径（ECEF），可作为快速合理性检查
    const r = Math.hypot(t[12], t[13], t[14]);
    (r > 6.3e6 && r < 6.45e6) ? ok('transform 平移列在地球表面', `|origin|=${(r / 1000).toFixed(1)} km`) : bad('transform 平移列不像 ECEF 坐标', r.toFixed(1));
    const upZ = t[10]; // up 列的 z 分量 = sin(lat)
    const lat = (Math.asin(upZ) * 180) / Math.PI;
    ok('原点纬度（由 up 列反推）', lat.toFixed(6) + '°');
  }

  box = root.boundingVolume?.box;
  if (Array.isArray(box) && box.length === 12 && box.every(Number.isFinite)) {
    ok('root.boundingVolume.box', JSON.stringify(box.map((v) => +v.toFixed(2))));
    // 轴对齐 box（旋转项为 0）时检查覆盖 GLB 顶点（glTF Y-up → tile Z-up: x=e, y=up, z=-north）
    const rot = [box[4], box[5], box[6], box[8], box[9], box[10]];
    if (rot.every((v) => Math.abs(v) < 1e-9) && posMin && posMax) {
      const tMin = [posMin[0], -posMax[2], posMin[1]];
      const tMax = [posMax[0], -posMin[2], posMax[1]];
      let covered = true;
      for (let c = 0; c < 3; c++) {
        const lo = box[c] - box[3 + 4 * c];
        const hi = box[c] + box[3 + 4 * c];
        if (!(lo <= tMin[c] + 1e-6 && hi >= tMax[c] - 1e-6)) {
          covered = false;
          bad(`box 未覆盖几何 axis${c}`, `${lo.toFixed(2)}..${hi.toFixed(2)} vs ${tMin[c].toFixed(2)}..${tMax[c].toFixed(2)}`);
        }
      }
      if (covered) ok('box 覆盖 GLB 顶点（Y-up→Z-up 轴映射后）');
    } else {
      warn('box 含旋转项，跳过覆盖检查');
    }
  } else {
    bad('root.boundingVolume.box 缺失或非法');
  }

  const uri = root.content?.uri ?? root.content?.url;
  if (!uri) bad('root.content.uri 缺失');
  else {
    const glbOnDisk = resolve(dirname(tilesetPath), uri);
    existsSync(glbOnDisk) ? ok('content.uri 文件存在', uri) : bad('content.uri 文件不存在', uri);
  }
  if (root.content?.uri && root.content.url) bad('同时存在 uri 与 url（3D Tiles 1.1 只应使用 uri）');
  (root.refine === 'ADD' || root.refine === 'REPLACE') ? ok('root.refine 合法', root.refine) : bad('root.refine 非法', String(root.refine));
  Number.isFinite(tileset.geometricError) ? ok('tileset.geometricError', String(tileset.geometricError)) : bad('缺少 tileset.geometricError');
}

/* --------------------------------------------------------------- 结论 */
console.log('\n' + '─'.repeat(60));
if (errors.length) {
  console.log(`❌ 校验失败：${errors.length} 个错误`);
  for (const e of errors) console.log('   - ' + e);
  process.exit(1);
}
console.log(`✅ 全部通过${warnings.length ? `（${warnings.length} 个警告）` : ''}`);
process.exit(0);
