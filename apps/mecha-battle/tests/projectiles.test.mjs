import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { capsuleEntry, boxEntry, traceProjectile, steerDirection } from '../src/combat/projectileFlight.js';
import { updatePlayerProjectiles } from '../src/combat/playerProjectiles.js';
const v=(x,y,z)=>new THREE.Vector3(x,y,z);
const body={id:'torso',a:v(0,2,20),b:v(0,8,20),radius:2};
const building={x:0,z:10,w:8,d:2,h:12,destroyed:false};

test('fast projectile returns first capsule surface, grazing and degenerate rays are bounded',()=>{
  assert.ok(Math.abs(capsuleEntry(v(0,5,0),v(0,5,100),body,.5)-.175)<1e-6);
  assert.equal(capsuleEntry(v(0,5,40),v(0,5,100),body,.5),null,'target behind the shot cannot register a hit');
  assert.equal(capsuleEntry(v(3,5,0),v(3,5,100),body,.5),null);
  assert.equal(capsuleEntry(v(0,5,20),v(0,5,20),body),0);
  assert.equal(capsuleEntry(v(0,5,0),v(0,5,0),body),null);
  assert.ok(capsuleEntry(v(0,0,20),v(0,20,20),body)>-1);
  assert.ok(capsuleEntry(v(2.5,5,0),v(2.5,5,100),body,.5)!==null);
});
test('facade before monster blocks shot, facade behind monster does not steal hit',()=>{
  const hit=traceProjectile(v(0,5,0),v(0,5,100),.5,[building],[body]);
  assert.equal(hit.kind,'building');assert.ok(Math.abs(hit.point.z-8.5)<1e-8);
  assert.equal(traceProjectile(v(0,5,0),v(0,5,100),.5,[{...building,z:40}],[body]).kind,'boss');
  assert.equal(traceProjectile(v(0,5,0),v(0,5,100),.5,[{...building,destroyed:true}],[body]).kind,'boss');
});
test('misses, starting inside a facade, parallel slab and ground collision',()=>{
  assert.equal(traceProjectile(v(15,5,0),v(15,5,100),.5,[building],[body]),null);
  assert.equal(traceProjectile(v(0,5,10),v(0,5,12),.5,[building],[]).t,0);
  assert.equal(boxEntry(v(9,0,0),v(9,0,10),v(-2,-2,-2),v(2,2,2)),null);
  const ground=traceProjectile(v(0,5,0),v(0,-5,20),.5,[],[]);
  assert.equal(ground.kind,'ground');assert.ok(Math.abs(ground.point.y-.5)<1e-8);
});
test('moving target crosses the projectile between ticks; retreating target avoids old position',()=>{
  const old={...body,a:v(-10,2,20),b:v(-10,8,20)};
  const next={...body,a:v(10,2,20),b:v(10,8,20)};
  assert.equal(traceProjectile(v(0,5,0),v(0,5,40),.5,[],[next],[old]).kind,'boss');
  const retreat={...body,a:v(20,2,20),b:v(20,8,20)};
  assert.equal(traceProjectile(v(0,5,0),v(0,5,22),.5,[],[retreat],[body]),null);
});
test('missile steering is limited and handles a target directly behind',()=>{
  const dir=v(0,0,1);steerDirection(dir,v(1,0,0),.1);
  assert.ok(Math.abs(dir.angleTo(v(0,0,1))-.1)<1e-7);
  const reverse=v(0,0,1);steerDirection(reverse,v(0,0,-1),.1);
  assert.ok(Math.abs(reverse.angleTo(v(0,0,1))-.1)<1e-7);
});
function fixture(){
  const g={monster:{alive:false},city:{buildings:[]},time:0,playerProjectiles:[],hits:[],removed:[],
    effects:{trail(){},smokePuff(){}},impactPlayerProjectile(p,point){this.hits.push({kind:p.hitKind,point});},removePlayerProjectile(p){this.removed.push(p);}};
  const p={kind:'plasma',group:new THREE.Group(),direction:v(0,0,1),speed:115,radius:.65,ttl:.1,t:0,delay:0,trailTimer:0};
  p.group.position.set(0,5,0);g.playerProjectiles.push(p);return {g,p};
}
test('expired miss never triggers impact/damage, disposal happens exactly once',()=>{
  const {g}=fixture();for(let i=0;i<60;i++)updatePlayerProjectiles(g,1/60);
  assert.equal(g.hits.length,0);assert.equal(g.removed.length,1);assert.equal(g.playerProjectiles.length,0);
});
test('one collision removes shot immediately and cannot impact again',()=>{
  const {g,p}=fixture();p.ttl=3;g.city.buildings=[building];
  for(let i=0;i<60;i++)updatePlayerProjectiles(g,1/60);
  assert.equal(g.hits.length,1);assert.equal(g.hits[0].kind,'building');assert.equal(p.building,building);
  assert.equal(g.removed.length,1);
});

test('breath hurt volume shares 3D path, is blocked by cover, and misses above the stream', async()=>{
  const {breathVolume}=await import('../src/combat/breathVolume.js');
  assert.ok(breathVolume(v(0,5,0),v(0,5,78),[],[body]).contact);
  assert.equal(breathVolume(v(0,5,0),v(0,5,78),[building],[body]).contact,null);
  const airborne={...body,a:v(0,22,20),b:v(0,28,20)};
  assert.equal(breathVolume(v(0,5,0),v(0,5,78),[],[airborne]).contact,null);
  const clipped=breathVolume(v(0,5,0),v(0,5,78),[building],[]);
  assert.equal(clipped.obstruction.kind,'building');assert.ok(clipped.end.z<10);assert.ok(clipped.endRadius<3);
});
