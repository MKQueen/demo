import test from 'node:test';
import assert from 'node:assert/strict';
import { Evacuation } from '../src/combat/evacuation.js';
const buildings=()=>[[-68,-68],[68,-68],[68,68]].map(([x,z])=>({x,z,h:30,destroyed:false}));
test('evacuation pauses under proximity or bombardment and rewards each shelter exactly once',()=>{
 const m=new Evacuation(buildings());const first=m.active;
 m.step(30,{x:-68,z:-68});assert.equal(first.progress,0);
 m.step(30,{x:200,z:200},first.building);assert.equal(first.progress,0);
 assert.equal(m.step(24,{x:200,z:200})[0].type,'saved');assert.equal(m.saved,100);
 assert.notEqual(m.active,first);m.step(1,{x:200,z:200});assert.equal(m.saved,100);
});
test('destroyed shelters are lost even when not currently active; early victory secures only survivors',()=>{
 const b=buildings(),m=new Evacuation(b);b[2].destroyed=true;
 assert.equal(m.step(0,{x:200,z:200})[0].type,'lost');
 m.secure();m.secure();assert.equal(m.saved,200);assert.equal(m.lost,100);assert.equal(m.active,undefined);
});
