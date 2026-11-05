import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDrive,driveProfile,turnChassis,actionStage,contactImpulse } from '../src/combat/heavyDrive.js';
test('ground drive starts immediately but accelerates, brakes and reverses within physical limits',()=>{
 const v={x:0,z:0},p=driveProfile('vanguard');
 stepDrive(v,{x:0,z:22},1/60,p);assert.ok(v.z>0&&v.z<.31);
 for(let i=0;i<59;i++)stepDrive(v,{x:0,z:22},1/60,p);
 assert.ok(Math.abs(v.z-18)<1e-8);
 stepDrive(v,{x:0,z:-22},.1,p);assert.ok(v.z>0&&Math.abs(v.z-15.6)<1e-8,'instant reversal');
 for(let i=0;i<100;i++)stepDrive(v,{x:0,z:0},1/60,p);
 assert.equal(v.z,0);
});
test('heavy and agile chassis have different acceleration and a bounded shortest-arc turn',()=>{
 const heavy={x:0,z:0},light={x:0,z:0};
 stepDrive(heavy,{x:0,z:22},.25,driveProfile('bastion'));
 stepDrive(light,{x:0,z:22},.25,driveProfile('raptor'));
 assert.ok(light.z>heavy.z*1.7);
 assert.equal(turnChassis(0,Math.PI,.1,1),.1);
 assert.ok(Math.abs(turnChassis(Math.PI-.02,-Math.PI+.02,.1,1)-(Math.PI+.02))<1e-8);
});
test('committed swings cannot cancel and monster mass resists a light hit',()=>{
 const action={type:'punch'};
 assert.equal(actionStage(action,.05,1),'windup');
 assert.equal(actionStage(action,.4,1),'committed');
 assert.equal(actionStage(action,.85,1),'recovery');
 assert.equal(actionStage({type:'landing'},.2,.75),'committed');
 assert.equal(actionStage({type:'landing'},.6,.75),'recovery');
 assert.ok(contactImpulse(10,1,3.4)<contactImpulse(10,3.4,1));
});
