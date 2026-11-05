import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerTracker, personBoxes, cropForPerson, mapCropLandmarks } from '../src/pose/playerTracker.js';
import { MotionSession } from '../src/pose/motionSession.js';
import { makeSyntheticPose, LM } from '../src/pose/gesture.js';
const player={x:.25,y:.08,width:.5,height:.87,score:.95};
function lock(tracker){for(const t of [0,200,400])tracker.update([player],t);}
function warm(session){
  lock(session.tracker);const p=makeSyntheticPose();
  for(let t=400;t<2100;t+=33){session.tracker.update([player],t);session.update(p.normalized,p.world,t,{width:1280,height:720});}
  return p;
}
test('person detection excludes non-people and malformed/undersized boxes',()=>{
  const detection=(name,boundingBox,score=.9)=>({categories:[{categoryName:name,score}],boundingBox});
  const box={originX:200,originY:20,width:600,height:680};
  const boxes=personBoxes({detections:[detection('person',box),detection('cat',box),detection('person',{...box,width:2}),detection('person',{...box,width:NaN}),detection('person',box,.2)]},1280,720);
  assert.equal(boxes.length,1);assert.equal(boxes[0].x,200/1280);
});
test('player needs stable detection and does not switch to an off-center bystander on occlusion',()=>{
  const tracker=new PlayerTracker();
  tracker.update([player],0);assert.equal(tracker.snapshot(0).phase,'acquiring');
  tracker.update([player],200);assert.equal(tracker.snapshot(200).phase,'acquiring');
  tracker.update([player],400);assert.equal(tracker.snapshot(400).phase,'tracked');
  const id=tracker.generation;
  const bystander={x:.8,y:.1,width:.16,height:.7,score:.99};
  tracker.update([bystander],600);assert.equal(tracker.snapshot(600).phase,'lost');assert.equal(tracker.generation,id);
  tracker.update([player,bystander],800);assert.equal(tracker.snapshot(800).phase,'tracked');assert.equal(tracker.generation,id);
  tracker.update([bystander],3000);assert.equal(tracker.snapshot(3000).phase,'searching');
});
test('interrupted acquisition must restart its confirmation window',()=>{
  const tracker=new PlayerTracker();tracker.update([player],0);tracker.update([player],200);
  tracker.update([],400);tracker.update([player],600);assert.equal(tracker.snapshot(600).phase,'acquiring');
  tracker.update([player],800);assert.equal(tracker.snapshot(800).phase,'acquiring');tracker.update([player],1000);assert.equal(tracker.snapshot(1000).phase,'tracked');
});
test('crop maps pose coordinates back to full camera space without double mirroring',()=>{
  const crop=cropForPerson(player,1280,720);
  assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=1&&crop.y+crop.height<=1);
  const [point]=mapCropLandmarks([{x:.2,y:.3,z:-.4,visibility:.9}],crop);
  assert.equal(point.x,crop.x+.2*crop.width);assert.equal(point.y,crop.y+.3*crop.height);
  assert.equal(point.z,-.4*crop.width);assert.equal(point.visibility,.9);
});
test('unlocked or calibrating pose cannot drive controls or enqueue skills',()=>{
  const session=new MotionSession(),p=makeSyntheticPose();
  session.update(p.normalized,p.world,0);assert.equal(session.state.visible,false);
  lock(session.tracker);const state=session.update(p.normalized,p.world,410);
  assert.equal(state.tracking.phase,'calibrating');assert.equal(state.controlReady,false);assert.equal(state.strafe,0);
  assert.deepEqual(session.takeEvents(410),[]);
  warm(session);assert.equal(session.state.controlReady,true);
});
test('loss clears held inputs/events immediately; reacquisition recalibrates and has no velocity spike',()=>{
  const session=new MotionSession(),p=warm(session);
  session.events=[{type:'punch',at:2.05}];session.state.blocking=true;session.state.move=1;
  const lost=session.update(null,null,2100);
  assert.equal(lost.visible,false);assert.equal(lost.blocking,false);assert.equal(lost.move,0);assert.deepEqual(session.takeEvents(2100),[]);
  session.tracker.update([player],2150);const recovered=session.update(p.normalized,p.world,2150);
  assert.equal(recovered.tracking.phase,'calibrating');assert.equal(recovered.controlReady,false);assert.deepEqual(session.takeEvents(2150),[]);
});
test('stalled video and stale actions cannot keep moving a native or web player',()=>{
  const session=new MotionSession();warm(session);session.events=[{type:'punch',at:1.2}];
  assert.deepEqual(session.takeEvents(2085),[]);
  const frame=session.frame(2700);assert.equal(frame.version,1);assert.equal(frame.controlReady,false);assert.equal(frame.controls.move,0);assert.deepEqual(frame.events,[]);
});
test('nonfinite skeletons, hidden shoulders and poses outside the locked person are rejected',()=>{
  for(const mutate of [p=>p[LM.L_SHOULDER].x=NaN,p=>p[LM.L_SHOULDER].visibility=.01,p=>p[LM.L_WRIST].visibility=.01,p=>{p[LM.L_SHOULDER].x=.01;p[LM.R_SHOULDER].x=.05;}]){
    const session=new MotionSession(),p=warm(session);mutate(p.normalized);
    assert.equal(session.update(p.normalized,p.world,2100).controlReady,false);
  }
  const session=new MotionSession(),p=warm(session);p.world[LM.L_WRIST].z=Infinity;
  assert.equal(session.update(p.normalized,p.world,2100).controlReady,false);
});
