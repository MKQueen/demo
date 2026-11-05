import test from 'node:test';
import assert from 'node:assert/strict';
import { moveAgainstBuildings } from '../src/world/buildingCollision.js';
const tower=()=>({x:0,z:0,w:10,d:10,h:45,destroyed:false});
test('high-speed motion cannot tunnel through a tower; contact emits once',()=>{
  const b=tower();let hits=0;
  const {position}=moveAgainstBuildings({x:-30,y:0,z:0},{x:30,y:0,z:0},[b],4,()=>hits++);
  assert.ok(position.x<=-9+1e-8);assert.equal(hits,1);
});
test('wall sliding preserves tangential movement and resolves an embedded spawn',()=>{
  const b=tower();
  const {position}=moveAgainstBuildings({x:-10,y:0,z:-3},{x:-6,y:0,z:3},[b],4);
  assert.ok(position.x<=-9+1e-8);assert.equal(position.z,3);
  const inside=moveAgainstBuildings({x:0,y:0,z:0},{x:0,y:0,z:0},[b],4).position;
  assert.ok(Math.abs(inside.x)>=9||Math.abs(inside.z)>=9);
});
test('flight clears low roofs, intact towers block flight, destruction opens route',()=>{
  const from={x:-30,y:14,z:0},to={x:30,y:14,z:0};
  assert.ok(Math.abs(moveAgainstBuildings(from,to,[{...tower(),h:8}],4).position.x-30)<1e-8);
  assert.ok(moveAgainstBuildings(from,to,[tower()],4).position.x<0);
  const b=tower();
  assert.ok(Math.abs(moveAgainstBuildings(from,to,[b],4,building=>building.destroyed=true).position.x-30)<1e-8);
});
