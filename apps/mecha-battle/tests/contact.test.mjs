import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 as V } from 'three';
import { closestSegments, sweepWeapon } from '../src/world/contact.js';
const v = (x,y=0,z=0) => new V(x,y,z);
const body = {id:'torso',a:v(0,-2),b:v(0,2),radius:1};
const weapon = (x,z=0) => ({a:v(x,0,z),b:v(x,0,z)});
test('finite segments: crossing, parallel, endpoint and degenerate distances',()=>{
 assert.equal(closestSegments(v(-2),v(2),v(0,-2),v(0,2)).distanceSq,0);
 assert.equal(closestSegments(v(-2),v(2),v(-2,3),v(2,3)).distanceSq,9);
 assert.equal(closestSegments(v(2),v(4),v(0,-1),v(0,1)).distanceSq,4);
 assert.equal(closestSegments(v(2),v(2),v(0),v(0)).distanceSq,4);
});
test('fast fist sweeps hit without requiring an endpoint overlap',()=>{
 assert.ok(sweepWeapon(weapon(-7),weapon(7),.6,[body]));
 assert.equal(sweepWeapon(weapon(-7,4),weapon(7,4),.6,[body]),null);
});
test('rotating blade interior contacts while hand and tip both miss',()=>{
 const previous={a:v(-4,0,-4),b:v(4,0,-4)}, current={a:v(-4,0,4),b:v(4,0,4)};
 assert.ok(sweepWeapon(previous,current,.3,[body]));
});
test('moving target participates in relative sweep, and new actions do not sweep teleports',()=>{
 const old={...body,a:v(-5,-2),b:v(-5,2)}, next={...body,a:v(5,-2),b:v(5,2)};
 assert.ok(sweepWeapon(weapon(0),weapon(0),.5,[next],[old]));
 assert.equal(sweepWeapon(weapon(-40),weapon(40),.5,[body]),null);
});
