import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3, Matrix4, Box3 } from 'three';
import { StreetFurniture } from '../src/world/streetFurniture.js';
const v=(x,y,z)=>new Vector3(x,y,z);
function fixture(){return new StreetFurniture(new Group(),[{kind:'lamp',x:0,z:0},{kind:'bench',x:9,z:0},{kind:'barrier',x:16,z:0}]);}
test('fast swept body knocks street props once, not just those at its end position',()=>{
 const f=fixture();let hits=0;
 assert.equal(f.sweep(v(-20,0,0),v(20,0,0),2,()=>hits++),3);
 assert.equal(hits,3);assert.equal(f.sweep(v(-20,0,0),v(20,0,0),2,()=>hits++),0);assert.equal(hits,3);
 const count=f.meshes.reduce((n,{mesh})=>n+mesh.count,0);
 for(let i=0;i<90;i++)f.update(1/60);
 for(const {mesh}of f.meshes)assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
 assert.equal(f.meshes.reduce((n,{mesh})=>n+mesh.count,0),count);
 const settled=f.meshes.map(({mesh})=>[...mesh.instanceMatrix.array]);
 f.update(1);assert.deepEqual(f.meshes.map(({mesh})=>[...mesh.instanceMatrix.array]),settled);
 // Fallen lamp points forward and stays above the pavement.
 const {mesh}=f.meshes.find(({mesh})=>mesh.name==='breakable-street-lamp');
 const matrix=new Matrix4();mesh.getMatrixAt(0,matrix);
 const bounds=new Box3().setFromBufferAttribute(mesh.geometry.attributes.position).applyMatrix4(matrix);
 assert.ok(bounds.max.x>6);assert.ok(bounds.min.y>-.02);
});
test('flight above lamps misses furniture; low flight hits tall lamps but not benches',()=>{
 const f=fixture();assert.equal(f.sweep(v(-20,15,0),v(20,15,0),2),0);
 assert.equal(f.sweep(v(-20,5,0),v(20,5,0),2),1);
 assert.equal(f.items.find(p=>p.kind==='bench').broken,false);
});
test('zero-length blast remains finite and respects radius',()=>{
 const f=fixture();assert.equal(f.sweep(v(0,0,0),v(0,0,0),2),1);
 f.update(.5);assert.ok(f.meshes.every(({mesh})=>[...mesh.instanceMatrix.array].every(Number.isFinite)));
});
