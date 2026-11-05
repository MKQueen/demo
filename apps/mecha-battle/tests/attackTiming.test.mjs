import test from 'node:test';
import assert from 'node:assert/strict';
import { strikeTravel, comboBufferLifetime, monsterClipPhase } from '../src/combat/attackTiming.js';

test('anticipation stays planted and root travel is monotonic through release', () => {
  for (const action of [{type:'punch'}, {type:'punch',heavy:true}, {type:'blade'}]) {
    assert.equal(strikeTravel(action, .1), 0);
    assert.equal(strikeTravel(action, .8), 1);
    let previous = 0;
    for (let i=0;i<=100;i++) {
      const current=strikeTravel(action,i/100);
      assert.ok(current>=previous && current<=1); previous=current;
    }
  }
});

test('one queued punch survives both normal and heavy recovery', () => {
  for (const duration of [.72, 1.05]) {
    assert.equal(comboBufferLifetime(.1*duration,duration),0);
    for (const phase of [.25,.51,.9]) assert.ok(comboBufferLifetime(duration*phase,duration)>duration*(1-phase)+1/60);
  }
});

test('monster release poses stay aligned to both phases and both claw contacts', () => {
  for (const scale of [.83,.95]) {
    for (const [type,impact,duration,pose] of [['swipe',.78,1.72,.52],['doubleClaw',.98,2.12,.42],['slam',.94,1.82,.60],['breath',1.18,2.18,.52]]) {
      const action={type,impact:impact*scale};
      assert.equal(monsterClipPhase(action,action.impact,duration),pose);
      if(type==='doubleClaw') assert.equal(monsterClipPhase(action,action.impact+.72,duration),.78);
      assert.equal(monsterClipPhase(action,0,duration),0);
      assert.equal(monsterClipPhase(action,duration,duration),1);
    }
  }
  assert.equal(monsterClipPhase(null,0,1),null);
  assert.equal(monsterClipPhase({type:'charge'},.5,2),null);
});
