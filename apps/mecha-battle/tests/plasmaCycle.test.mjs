import { clawTrailActive } from '../src/combat/attackTiming.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLASMA, plasmaCycle } from '../src/combat/plasmaCycle.js';
import { PLAYER_CUES } from '../src/combat/skillTimeline.js';
test('plasma braces before release, recoils after firing and completely recovers',()=>{
  assert.equal(PLAYER_CUES.blast[0].at,PLASMA.release);
  const ready=plasmaCycle(PLASMA.release-.001);
  assert.ok(ready.brace>.99);assert.equal(ready.recoil,0);assert.equal(ready.muzzle,0);
  const fired=plasmaCycle(PLASMA.release+.045);
  assert.ok(fired.recoil>.99&&fired.muzzle>0);
  const end=plasmaCycle(PLASMA.duration);
  assert.equal(end.brace,0);assert.equal(end.recoil,0);assert.equal(end.muzzle,0);assert.equal(end.heat,0);
});
test('monster claw trails identify each actual strike, including opposite second claw',()=>{
  const a={type:'doubleClaw',side:'right',impact:1,t:1};
  assert.ok(clawTrailActive(a,'left'));assert.equal(clawTrailActive(a,'right'),false);
  a.t=1.72;assert.ok(clawTrailActive(a,'right'));assert.equal(clawTrailActive(a,'left'),false);
  a.type='swipe';assert.equal(clawTrailActive(a,'right'),false);
  a.t=.2;assert.equal(clawTrailActive(a,'left'),false);
});
