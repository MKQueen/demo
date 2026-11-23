/**
 * world/index.js —— 把长卷拼起来。
 *
 * 顺序：绢底与河岸 → 汴河与船 → 虹桥 → 郊野 → 城与街市 → 远山雾带 → 人。
 * 各模块只画自己那一块，人物通过 ctx.people.push(...) 交给 people.js 统一画。
 */
import * as THREE from 'three';
import { buildTerrain } from './terrain.js';
import { buildRiver } from './river.js';
import { buildBridge } from './bridge.js';
import { buildCountry } from './country.js';
import { buildTown } from './town.js';
import { buildCityInner } from './city-inner.js';
import { buildOuterCity } from './outer-city.js';
import { buildCityBlocks } from './city-blocks.js';
import { buildLandmarks2 } from './landmarks2.js';
import { buildSuburbs } from './suburbs.js';
import { buildBackdrop } from './backdrop.js';
import { buildPeople } from './people.js';

export function buildWorld(ctx) {
  const root = new THREE.Group();
  root.name = 'world';
  ctx.people = [];

  const parts = [
    ['terrain', buildTerrain],
    ['river', buildRiver],
    ['bridge', buildBridge],
    ['country', buildCountry],
    ['outer-city', buildOuterCity],
    ['town', buildTown],
    ['city-blocks', buildCityBlocks],
    ['landmarks2', buildLandmarks2],
    ['suburbs', buildSuburbs],
    ['city-inner', buildCityInner],
    ['backdrop', buildBackdrop],
    ['people', buildPeople],
  ];
  for (const [name, fn] of parts) {
    try {
      const group = fn(ctx);
      if (group) root.add(group);
    } catch (error) {
      console.error(`[ink-qingming] ${name} 模块构建失败：`, error);
    }
  }
  return root;
}
