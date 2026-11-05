import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { combatFrame } from '../src/world/combatCamera.js';
test('combat framing holds both actors in view across arena, flight and narrow windows',()=>{
  for(const aspect of [16/9,1,.6])for(const [x,y,z] of [[0,0,18],[130,0,130],[0,45,70],[-200,0,-180]]){
    const player=new THREE.Vector3(0,y,0),boss=new THREE.Vector3(x,0,z);
    const frame=combatFrame(player,boss,aspect);
    const camera=new THREE.PerspectiveCamera(frame.fov,aspect,.4,1000);
    camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
    for(const [root,height,width] of [[player,23,8],[boss,30,11]])for(const h of [0,height])for(const side of [-width,width]){
      const p=root.clone().add(new THREE.Vector3(side,h,0)).project(camera);
      assert.ok(Math.abs(p.x)<.9 && Math.abs(p.y)<.85 && p.z<1,`cropped actor ${aspect} ${x},${y},${z}: ${p.toArray()}`);
    }
  }
});
