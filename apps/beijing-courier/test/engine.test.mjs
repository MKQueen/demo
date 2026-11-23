import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createDialogue } from '../src/game/dialogue.js';
import { GroundCollision } from '../src/world/collision.js';
import * as THREE from 'three';

function tick(dialogue, seconds, step = 1 / 60) {
  let left = seconds;
  while (left > 0) {
    dialogue.update(Math.min(step, left));
    left -= step;
  }
}

test('dialogue: typewriter reveals text then advances line by line', () => {
  const seen = [];
  const done = [];
  const d = createDialogue({
    charsPerSecond: 40,
    onLineStart: ({ index }) => seen.push(`start:${index}`),
    onLineEnd: ({ index }) => seen.push(`end:${index}`),
    onDone: () => done.push(true),
  });
  d.start([{ name: 'a', text: '你好' }, { name: 'b', text: '再见' }]);
  assert.equal(d.active, true);
  assert.equal(d.total, 2);
  tick(d, 1.0);
  assert.equal(d.visibleText, '你好');
  assert.equal(d.typing, false);
  assert.equal(d.advance(), true); // next line
  tick(d, 1.0);
  assert.equal(d.visibleText, '再见');
  d.advance(); // complete
  assert.equal(d.active, false);
  assert.deepEqual(done, [true]);
  assert.ok(seen.includes('start:0') && seen.includes('start:1'));
});

test('dialogue: one click finishes the current sentence before advancing', () => {
  const d = createDialogue({ charsPerSecond: 10 });
  d.start([{ text: '一二三四五六七八九十' }]);
  d.update(0.1); // ~1 char typed
  assert.equal(d.typing, true);
  d.advance();
  const current = d.current;
  assert.equal(current.visibleText, current.text);
  assert.equal(d.active, true);
});

test('dialogue: skipAll completes immediately', () => {
  let finished = 0;
  const d = createDialogue({ onDone: () => { finished += 1; } });
  d.start(['a', 'b', 'c']);
  d.skipAll();
  assert.equal(d.active, false);
  assert.equal(finished, 1);
});

function buildSphereMesh(radius = 10, segments = 32) {
  const geometry = new THREE.SphereGeometry(radius, segments, segments);
  geometry.computeBoundingSphere();
  return geometry;
}

test('collision: downward ray hits the ground at the expected height', () => {
  const collision = new GroundCollision(buildSphereMesh(10, 24));
  const dir = new THREE.Vector3(0.3, 0.9, 0.2).normalize();
  const hit = collision.groundAtDirection(dir);
  assert.ok(hit, 'ray hits the sphere');
  assert.ok(Math.abs(hit.point.length() - 10) < 0.35, `radius ${hit.point.length()}`);
  assert.ok(hit.normal.length() > 0.99);
  // hit normal should be roughly radial
  const radial = hit.point.clone().normalize();
  assert.ok(hit.normal.dot(radial) > 0.9);
});

test('collision: camera ray finds nearby walls and misses empty space', () => {
  const geometry = new THREE.BoxGeometry(4, 4, 4);
  const collision = new GroundCollision(geometry);
  const origin = new THREE.Vector3(-8, 0, 0);
  const hit = collision.raycast(origin, new THREE.Vector3(1, 0, 0));
  assert.ok(hit, 'ray hits the box');
  assert.ok(Math.abs(hit.distance - 6) < 0.6, `distance ${hit.distance}`);
  const miss = collision.raycast(origin, new THREE.Vector3(0, 1, 0));
  assert.equal(miss, null);
});

test('collision: groundAt prefers the nearest surface below', () => {
  const group = new THREE.Group();
  const low = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 24));
  group.add(low);
  const collision = new GroundCollision(low.geometry);
  const hit = collision.groundAt(new THREE.Vector3(0, 8, 0));
  assert.ok(hit);
  assert.ok(hit.point.length() > 8.5 && hit.point.length() < 10.5);
});
