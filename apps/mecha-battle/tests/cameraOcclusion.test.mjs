import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { buildingOccludesSegment } from '../src/world/cameraOcclusion.js';
const b={x:0,z:0,w:20,d:8,h:12};
test('occlusion catches wide facade corners and low cover without fading skyline',()=>{
 assert.ok(buildingOccludesSegment(b,new Vector3(9,8,20),new Vector3(9,2,-20)));
 assert.equal(buildingOccludesSegment(b,new Vector3(11,8,20),new Vector3(11,2,-20)),false);
 assert.ok(buildingOccludesSegment(b,new Vector3(11,8,20),new Vector3(11,2,-20),2));
 assert.equal(buildingOccludesSegment(b,new Vector3(0,25,20),new Vector3(0,25,-20)),false);
 assert.equal(buildingOccludesSegment(b,new Vector3(0,8,20),new Vector3(0,8,10)),false);
 // Torso clears a short building, but the foot corridor is still hidden.
 const low={...b,h:4};
 assert.equal(buildingOccludesSegment(low,new Vector3(0,10,20),new Vector3(0,12,-20)),false);
 assert.ok(buildingOccludesSegment(low,new Vector3(0,5,20),new Vector3(0,0,-20)));
});
test('camera inside a tower fades it, parallel misses remain opaque',()=>{
 assert.ok(buildingOccludesSegment(b,new Vector3(0,6,0),new Vector3(0,6,-30)));
 assert.equal(buildingOccludesSegment(b,new Vector3(30,6,0),new Vector3(30,6,-30)),false);
});
