/**
 * world/index.js —— 场景拼装：把四个模块的产物合到一棵树上。
 * 由 Lead 维护，各模块只关心自己返回的 Group。
 */
import * as THREE from 'three';
import { buildTerrain } from './terrain.js';
import { buildCity } from './city.js';
import { buildLandmarks } from './landmarks.js';
import { buildWater } from './water.js';
import { buildNature } from './nature.js';
import { buildOutskirts } from './outskirts.js';
import { buildBackdrop } from './backdrop.js';
import { buildModern } from './modern.js';

export function buildWorld(ctx) {
  const root = new THREE.Group();
  root.name = 'world';

  root.add(buildBackdrop(ctx));
  const terrain = buildTerrain(ctx);
  root.add(terrain);
  root.add(buildWater(ctx));
  root.add(buildCity(ctx));
  root.add(buildLandmarks(ctx));
  root.add(buildModern(ctx));
  root.add(buildOutskirts(ctx));
  root.add(buildNature(ctx));

  return root;
}
