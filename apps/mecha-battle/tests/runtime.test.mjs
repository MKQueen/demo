import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStep } from '../src/runtime/fixedStep.js';
import { SkillTimeline, PLAYER_CUES } from '../src/combat/skillTimeline.js';
import { initDebrisPhysics, DebrisPhysics } from '../src/world/debrisPhysics.js';
import { Vector3, Euler } from 'three';

for (const fps of [30,60,144]) test(`fixed simulation runs 600 identical ticks over 10 seconds at ${fps} render fps`, () => {
  const clock = new FixedStep(); let position=0, events=['punch'], consumed=0;
  for(let i=0;i<fps*10;i++) clock.advance(1/fps, dt => {
    assert.equal(dt,1/60); position += 10*dt;
    consumed += events.length; events=[];
  });
  assert.equal(clock.ticks,600); assert.ok(Math.abs(position-100)<1e-8); assert.equal(consumed,1);
});
test('long stalls have bounded catch-up and visibility reset discards fractional backlog', () => {
  const clock=new FixedStep(); let ticks=0;
  clock.advance(8,()=>ticks++); assert.equal(ticks,5); assert.ok(clock.droppedTime>7.9);
  clock.advance(.008,()=>ticks++); clock.reset(); clock.advance(.009,()=>ticks++);
  assert.equal(ticks,5);
  clock.advance(NaN,()=>assert.fail()); clock.advance(-1,()=>assert.fail());
});
test('animation markers survive skipped samples, never repeat, and restart on a new action', () => {
  const timeline=new SkillTimeline(), a={type:'missile'};
  assert.equal(timeline.sample(a,.1,PLAYER_CUES.missile).length,0);
  assert.equal(timeline.sample(a,.5,PLAYER_CUES.missile).length,4);
  assert.equal(timeline.sample(a,.7,PLAYER_CUES.missile).length,0);
  assert.equal(timeline.sample({},.5,PLAYER_CUES.missile).length,4);
});

await initDebrisPhysics();
const particle = (x=0,y=4,z=0) => ({pos:new Vector3(x,y,z),vel:new Vector3(),spin:new Vector3(),rot:new Euler(),active:true});
test('Rapier debris falls, rests above the floor, and respects the body budget/reset', () => {
  const physics=new DebrisPhysics(2);
  try {
    const p=particle(); physics.spawn(p,.5);
    physics.update(1/60); assert.ok(p.pos.y<4);
    for(let i=0;i<240;i++) physics.update(1/60);
    assert.ok(p.pos.y>.45&&p.pos.y<.6,`resting height ${p.pos.y}`);
    physics.spawn(particle(2),.5); physics.spawn(particle(4),.5);
    assert.equal(physics.bodies.size,2); assert.equal(p.active,false);
    physics.clear(); assert.equal(physics.bodies.size,0); assert.equal(physics.statics.size,0);
    physics.spawn(particle(),.5); assert.equal(physics.bodies.size,1);
  } finally { physics.dispose(); }
});
test('debris collides with nearby tower; collapse removes its collider', () => {
  const physics=new DebrisPhysics();
  const tower={x:0,z:0,w:8,d:8,h:8,destroyed:false}; physics.buildings=()=>[tower];
  try {
    const p=particle(0,12,0); physics.spawn(p,.5);
    for(let i=0;i<120;i++) physics.update(1/60);
    assert.ok(p.pos.y>8.4&&p.pos.y<8.6,`tower resting height ${p.pos.y}`);
    assert.equal(physics.statics.size,1);
    tower.destroyed=true; physics.update(1/60);
    assert.equal(physics.statics.size,0);
    for(let i=0;i<120;i++) physics.update(1/60);
    assert.ok(p.pos.y<1);
  } finally { physics.dispose(); }
});
