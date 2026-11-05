import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerfectGuard, difficultyFor, attackWeight } from '../src/combat/balance.js';
test('perfect guard is a fresh, single-use defensive window, not permanent immunity', () => {
  const guard={blocking:true,guardStartedAt:10,now:10.15,consumed:false,unblockable:false,window:.22};
  assert.equal(canPerfectGuard(guard),true);
  for(const patch of [{now:10.3},{consumed:true},{unblockable:true},{guardStartedAt:-Infinity},{blocking:false}])
    assert.equal(canPerfectGuard({...guard,...patch}),false);
});
test('difficulty increases pressure without shortening telegraph windup',()=>{
  assert.ok(difficultyFor('nightmare').damage>difficultyFor('recruit').damage);
  assert.ok(difficultyFor('nightmare').recovery<difficultyFor('recruit').recovery);
  assert.equal(difficultyFor('invalid'),difficultyFor('veteran'));
  assert.ok(attackWeight('swipe',3,['swipe','slam','swipe'])<attackWeight('breath',3,['swipe','slam','swipe']));
});
