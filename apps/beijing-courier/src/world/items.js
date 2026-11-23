// 自研投递物（不使用参考站的道具模型）
//
// 每个道具都是程序化几何 + canvas 手绘贴图，用 createToonMaterial 渲染，
// 自动并入现有的描边 + LUT 管线。造型参考「北京/手写信」的主题：
//   letter   — 折起的信纸，盖红蜡印，带一点水渍
//   postcard — 手绘北京天际线明信片 + 邮票 + 邮戳
//   note     — 便签纸，上面是中文手写字
//   offering — 老字号点心匣子 + 红绳
//   record   — 黑胶唱片 + 手绘唱片封套

import * as THREE from 'three';
import { createToonMaterial, makeCanvasTexture, box, merge } from '../render/toon.js';

function drawPaperTexture(ctx, w, h, base = '#f7f1df') {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // paper grain
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = `rgba(90, 70, 40, ${0.02 + Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
  }
  // fiber lines
  ctx.strokeStyle = 'rgba(120, 95, 60, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i += 1) {
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
}

const POSTCARD_W = 512;
const POSTCARD_H = 340;

function createPostcardTexture() {
  const texture = makeCanvasTexture(POSTCARD_W, POSTCARD_H, (ctx, w, h) => {
    drawPaperTexture(ctx, w, h, '#f4ecda');
    // hand-drawn Beijing skyline: hutong roofs + drum tower + CBD silhouettes
    ctx.strokeStyle = '#3b3f41';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(120, 150, 150, 0.18)';

    // rolling roofs (hutong)
    const roof = (x, y, rw, rh) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + rw * 0.2, y - rh, x + rw * 0.5, y - rh);
      ctx.quadraticCurveTo(x + rw * 0.8, y - rh, x + rw, y);
      ctx.lineTo(x + rw, y + 8);
      ctx.lineTo(x, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    roof(30, 210, 120, 26);
    roof(140, 214, 96, 20);
    roof(250, 208, 130, 28);

    // drum tower
    ctx.fillStyle = 'rgba(150, 110, 80, 0.25)';
    ctx.beginPath();
    ctx.rect(110, 120, 60, 78);
    ctx.fill();
    ctx.stroke();
    roof(96, 124, 88, 22);

    // 中国尊 (CITIC tower silhouette)
    ctx.beginPath();
    ctx.moveTo(392, 210);
    ctx.bezierCurveTo(398, 150, 402, 120, 412, 96);
    ctx.bezierCurveTo(422, 120, 426, 150, 432, 210);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // birds
    ctx.lineWidth = 2.4;
    for (const [bx, by] of [[330, 74], [352, 62], [372, 78]]) {
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.quadraticCurveTo(bx - 3, by - 6, bx, by - 1);
      ctx.quadraticCurveTo(bx + 3, by - 6, bx + 8, by);
      ctx.stroke();
    }

    // red postmark ring + 京
    ctx.strokeStyle = '#c94f43';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(446, 88, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c94f43';
    ctx.font = '700 26px "Kaiti SC", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('京', 446, 90);

    // stamp
    ctx.strokeStyle = '#c94f43';
    ctx.lineWidth = 2;
    ctx.strokeRect(452, 140, 34, 44);
    ctx.fillStyle = 'rgba(201, 79, 67, 0.15)';
    ctx.fillRect(452, 140, 34, 44);
    ctx.fillStyle = '#c94f43';
    ctx.font = '700 16px "Kaiti SC", serif';
    ctx.fillText('信', 469, 163);

    // handwriting lines
    ctx.strokeStyle = 'rgba(59, 63, 65, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 6, 250 + i * 22);
      ctx.lineTo(250 + i * 20, 250 + i * 22);
      ctx.stroke();
    }
  });
  return texture;
}

function createNoteTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    drawPaperTexture(ctx, w, h, '#f2e6c4');
    ctx.fillStyle = '#33322e';
    ctx.font = '700 34px "Kaiti SC", "STKaiti", "KaiTi", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('记得', w / 2, 82);
    ctx.fillText('吃早饭', w / 2, 132);
    ctx.font = '600 22px "Kaiti SC", serif';
    ctx.fillText('—— 妈', w / 2 + 48, 196);
    ctx.strokeStyle = 'rgba(200, 70, 60, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(190, 84, 12, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function createOfferingTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    drawPaperTexture(ctx, w, h, '#c53f34');
    ctx.strokeStyle = 'rgba(255, 236, 200, 0.75)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.fillStyle = '#ffe9c2';
    ctx.font = '700 58px "Kaiti SC", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('京', w / 2, 100);
    ctx.font = '700 34px "Kaiti SC", serif';
    ctx.fillText('点心', w / 2, 168);
  });
}

function createLetterTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    drawPaperTexture(ctx, w, h, '#f8f3e4');
    // folded crease
    ctx.strokeStyle = 'rgba(120, 100, 70, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    // water stains (the "wet letter" from the harbor quest)
    ctx.fillStyle = 'rgba(120, 150, 160, 0.22)';
    ctx.beginPath();
    ctx.ellipse(190, 200, 46, 30, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(120, 150, 160, 0.16)';
    ctx.beginPath();
    ctx.ellipse(70, 74, 30, 18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // address lines
    ctx.strokeStyle = 'rgba(60, 60, 55, 0.6)';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(44, 52 + i * 26);
      ctx.lineTo(176 + (i % 2) * 26, 52 + i * 26);
      ctx.stroke();
    }
    // red wax seal
    ctx.fillStyle = '#b5372c';
    ctx.beginPath();
    ctx.arc(212, 64, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3e6c8';
    ctx.font = '700 22px "Kaiti SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('信', 212, 66);
  });
}

function createRecordSleeveTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    drawPaperTexture(ctx, w, h, '#2d3a40');
    ctx.strokeStyle = 'rgba(240, 230, 205, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, 78, 0, Math.PI * 2);
    ctx.stroke();
    // lanterns
    ctx.fillStyle = '#c94f43';
    for (const [x, y] of [[80, 90], [128, 74], [176, 90]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffe9c2';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#f2e8cf';
    ctx.font = '600 26px "Kaiti SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('京城夜曲', 128, 190);
  });
}

function plane(w, h, material) {
  const geometry = new THREE.PlaneGeometry(w, h);
  return new THREE.Mesh(geometry, material);
}

function makeMaterial(texture, options = {}) {
  return createToonMaterial({ map: texture, flatShading: false, ...options });
}

/**
 * @param {'letter'|'postcard'|'note'|'offering'|'samplebox'|'record'} kind
 * @returns {THREE.Group}
 */
export function createDeliveryItem(kind) {
  const group = new THREE.Group();
  group.name = `delivery-${kind}`;
  group.userData.kind = kind;

  if (kind === 'postcard') {
    const material = makeMaterial(createPostcardTexture());
    const card = plane(0.62, 0.41, material);
    card.rotation.x = -Math.PI / 2 + 0.35;
    card.position.y = 0.28;
    group.add(card);
    const edgeMaterial = createToonMaterial({ color: '#d9cfb6', flatShading: true });
    const backing = new THREE.Mesh(box(0.64, 0.012, 0.43, 0), edgeMaterial);
    backing.rotation.x = 0.35;
    backing.position.set(0, 0.272, -0.005);
    group.add(backing);
  } else if (kind === 'note') {
    const paper = makeMaterial(createNoteTexture());
    const sheet = plane(0.44, 0.44, paper);
    sheet.rotation.x = -Math.PI / 2 + 0.08;
    sheet.rotation.z = 0.12;
    sheet.position.y = 0.2;
    group.add(sheet);
  } else if (kind === 'offering') {
    const texture = createOfferingTexture();
    const materials = ['#8f2f27', '#c53f34'].map((color) => createToonMaterial({ color, flatShading: true }));
    const body = new THREE.Mesh(box(0.46, 0.22, 0.34, 0), materials[1]);
    body.position.y = 0.24;
    group.add(body);
    const lid = new THREE.Mesh(box(0.48, 0.07, 0.36, 0), materials[0]);
    lid.position.y = 0.38;
    group.add(lid);
    const ribbon = new THREE.Mesh(box(0.49, 0.075, 0.05, 0), createToonMaterial({ color: '#e8c45b' }));
    ribbon.position.y = 0.39;
    group.add(ribbon);
    const emblem = makeMaterial(texture);
    const plaque = plane(0.3, 0.22, emblem);
    plaque.rotation.y = Math.PI / 2;
    plaque.position.set(0.235, 0.26, 0);
    group.add(plaque);
  } else if (kind === 'samplebox') {
    const material = createToonMaterial({ color: '#b98756', flatShading: true });
    const body = new THREE.Mesh(box(0.42, 0.24, 0.3, 0.01), material);
    body.position.y = 0.2;
    group.add(body);
    const tape = new THREE.Mesh(box(0.43, 0.06, 0.31, 0), createToonMaterial({ color: '#d8c8a8' }));
    tape.position.y = 0.24;
    group.add(tape);
    const label = makeMaterial(makeCanvasTexture(128, 128, (ctx, w, h) => {
      drawPaperTexture(ctx, w, h, '#f1e7cf');
      ctx.fillStyle = '#5a3c2c';
      ctx.font = '700 28px "Kaiti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('样', w / 2, h / 2 - 14);
      ctx.fillText('品', w / 2, h / 2 + 18);
    }));
    const sticker = plane(0.16, 0.16, label);
    sticker.position.set(0, 0.205, 0.152);
    group.add(sticker);
  } else if (kind === 'record') {
    const sleeveTexture = createRecordSleeveTexture();
    const sleeve = makeMaterial(sleeveTexture);
    const cover = new THREE.Mesh(box(0.52, 0.52, 0.02, 0), sleeve);
    cover.position.y = 0.35;
    cover.rotation.y = 0.4;
    group.add(cover);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.012, 28), createToonMaterial({ color: '#232527', flatShading: true }));
    disc.rotation.z = Math.PI / 2;
    disc.rotation.y = 0.4;
    disc.position.set(0.24, 0.34, 0.05);
    group.add(disc);
  } else {
    // letter: a folded paper slab with a wax seal and a small "信" face
    const texture = createLetterTexture();
    const paperMaterial = makeMaterial(texture);
    const paperMesh = new THREE.Mesh(box(0.5, 0.03, 0.36, 0), paperMaterial);
    paperMesh.position.y = 0.24;
    paperMesh.rotation.y = -0.25;
    group.add(paperMesh);
    const fold = new THREE.Mesh(box(0.5, 0.028, 0.12, 0), createToonMaterial({ color: '#ebe2cc' }));
    fold.position.set(0, 0.26, 0.12);
    fold.rotation.y = -0.25;
    group.add(fold);
  }

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return group;
}
