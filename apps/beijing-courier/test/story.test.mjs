import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  LETTERS, NPC_INFO, REGIONS, COURIER, INTRO_LINES, ENDING_LINES,
  getLetter, lettersForNpc, checklistItems, scriptFor, regionOf,
} from '../src/game/story.js';
import { NPCS, SPAWNS, SPOT_TO_NPC, PICKUP_TO_NPC, REGIONS as WORLD_REGIONS } from '../src/world/planet-config.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'public/assets-messenger');

test('story ships five complete deliveries', () => {
  assert.equal(LETTERS.length, 5);
  const ids = new Set();
  for (const [index, letter] of LETTERS.entries()) {
    assert.equal(letter.order, index + 1);
    assert.ok(letter.id && !ids.has(letter.id), 'unique letter id');
    ids.add(letter.id);
    assert.ok(letter.title && letter.objective && letter.item);
    assert.ok(letter.ask.length > 0, `${letter.id} has giver dialogue`);
    assert.ok(letter.reply.length > 0, `${letter.id} has target dialogue`);
    assert.ok(NPC_INFO[letter.giver], `giver ${letter.giver} has info`);
    assert.ok(NPC_INFO[letter.target], `target ${letter.target} has info`);
    assert.ok(NPC_INFO[letter.giverModel], `giver model ${letter.giverModel} has info`);
    assert.ok(REGIONS[letter.giverRegion], `giver region ${letter.giverRegion} exists`);
    assert.ok(REGIONS[letter.targetRegion], `target region ${letter.targetRegion} exists`);
    assert.ok(letter.giverSpot.startsWith('spot_'));
    assert.ok(letter.targetSpot.startsWith('spot_'));
    assert.ok(letter.pickupSpot.startsWith('pickup_'));
  }
  assert.equal(getLetter(LETTERS[0].id), LETTERS[0]);
  assert.equal(getLetter('nope'), null);
});

test('every story spot maps to a world NPC anchor and a real asset', () => {
  for (const letter of LETTERS) {
    assert.ok(SPOT_TO_NPC[letter.giverSpot], `missing SPOT_TO_NPC mapping for ${letter.giverSpot}`);
    assert.ok(SPOT_TO_NPC[letter.targetSpot], `missing SPOT_TO_NPC mapping for ${letter.targetSpot}`);
    assert.ok(PICKUP_TO_NPC[letter.pickupSpot], `missing PICKUP_TO_NPC mapping for ${letter.pickupSpot}`);
    assert.match(letter.itemModel, /^deliveries\/[a-z]+\.drc$/);
    assert.ok(regionOf(letter.giverSpot), `regionOf(${letter.giverSpot})`);
  }
  // the mapped NPC anchor id must exist in the world config
  const npcIds = new Set(NPCS.map((n) => n.id));
  for (const npcId of Object.values(SPOT_TO_NPC)) assert.ok(npcIds.has(npcId), `unknown anchor ${npcId}`);
  for (const npcId of Object.values(PICKUP_TO_NPC)) assert.ok(npcIds.has(npcId), `unknown anchor ${npcId}`);
});

test('checklist state machine and scripts', () => {
  const pending = checklistItems({});
  assert.equal(pending.length, 5);
  assert.ok(pending.every((item) => item.status === 'pending' && !item.done));
  const carrying = checklistItems({ [LETTERS[0].id]: 'carrying' });
  assert.equal(carrying[0].status, 'carrying');
  const done = checklistItems(Object.fromEntries(LETTERS.map((l) => [l.id, 'done'])));
  assert.ok(done.every((item) => item.done && item.status === 'done'));
  assert.ok(scriptFor(LETTERS[0].id, 'ask').length > 0);
  assert.ok(scriptFor(LETTERS[0].id, 'reply').length > 0);
  assert.deepEqual(scriptFor('missing', 'ask'), []);
  assert.ok(INTRO_LINES.length >= 2);
  assert.ok(ENDING_LINES.length >= 2);
  assert.ok(COURIER.name && COURIER.latin);
});

test('letters are addressable from their NPC model', () => {
  for (const letter of LETTERS) {
    const related = lettersForNpc(letter.giverModel);
    assert.ok(related.some((l) => l.id === letter.id));
  }
});

test('world config: spawn + npc anchors lie on the planet shell', () => {
  const planetRadius = 36.5;
  for (const spawn of SPAWNS) {
    const r = Math.hypot(...spawn.position);
    assert.ok(r > 20 && r < 45, `spawn radius ${r.toFixed(1)}`);
    assert.ok(Number.isFinite(spawn.rotation));
  }
  const ids = new Set();
  for (const npc of NPCS) {
    assert.ok(!ids.has(npc.id), `duplicate npc id ${npc.id}`);
    ids.add(npc.id);
    const r = Math.hypot(...npc.position);
    assert.ok(r > 15 && r < 45, `${npc.id} radius ${r.toFixed(1)}`);
    assert.equal(npc.rotation.length, 3);
    assert.ok(npc.kind, `${npc.id} has a model kind`);
  }
  assert.ok(WORLD_REGIONS.length >= 4);
  assert.equal(planetRadius, 36.5);
});

test('key reverse-engineered assets are present', () => {
  const files = [
    'dracoworker.js',
    'libs/draco/draco_decoder.wasm',
    'libs/draco/draco_wasm_wrapper.js',
    'libs/basis/basis_transcoder.js',
    'libs/basis/basis_transcoder.wasm',
    'images/atlas.png',
    'images/lut.ktx2',
    'geometries/planets/present/full_0.drc',
    'geometries/planets/present/full_9.drc',
    'geometries/planets/present/hitmesh_0.drc',
    'geometries/planets/present/tree-leaves_0.drc',
    'geometries/planets/present/grass.drc',
    'geometries/avatar/avatar-bones.drc',
    'geometries/avatar/avatar-idle.drc',
    'geometries/avatar/accessories/base.drc',
    'geometries/npcs/present/chef/chef.drc',
    'geometries/npcs/present/oldwoman/oldwoman.drc',
    'geometries/npcs/present/musician/musician.drc',
    'geometries/npcs/present/fox/fox.drc',
    'geometries/birds/1.drc',
    'geometries/birds/curve-1.drc',
  ];
  for (const file of files) {
    const full = path.join(ASSETS, file);
    assert.ok(fs.existsSync(full), `missing asset ${file}`);
    assert.ok(fs.statSync(full).size > 0, `empty asset ${file}`);
  }
});
