import test from 'node:test';
import assert from 'node:assert/strict';
import { readSettings,normaliseSettings,recordBattle } from '../src/runtime/profile.js';
test('preferences recover from corrupt storage and clamp audio values',()=>{
 assert.equal(readSettings({getItem(){throw Error('denied');}}).difficulty,'veteran');
 assert.deepEqual(normaliseSettings({difficulty:'godmode',volume:99,music:-3,comfort:'true'}),{difficulty:'veteran',quality:'auto',volume:1,music:0,comfort:false});
});
test('battle history is bounded and personal bests compare within difficulty',()=>{
 const map=new Map();const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 const stats={saved:300,city:80,parries:2,time:100,hits:2,difficulty:'veteran'};
 assert.equal(recordBattle(storage,stats,true).isBest,true);
 assert.equal(recordBattle(storage,stats,true).isBest,false);
 assert.equal(recordBattle(storage,{...stats,difficulty:'nightmare'},true).isBest,true);
 for(let i=0;i<30;i++)recordBattle(storage,stats,false);
 assert.equal(JSON.parse(map.get('steel-battles')).length,20);
 assert.equal(recordBattle(storage,stats,true).isBest,false,'pruning history lost the all-time record');
 assert.equal(recordBattle({getItem(){throw Error('denied');}},stats,true).saved,false);
});
