import * as THREE from 'three';
import { createFlow, setFlow } from './flowVFX.js';

// Four persistent turbulent exhausts, emitted from the back and soles.
export function installJetRig(mech) {
  const group=new THREE.Group();group.name='flight-exhausts';mech.root.add(group);
  const jets=Array.from({length:4},(_,i)=>{
    const node=new THREE.Group(),flow=createFlow({color:'#4cbcff'});
    node.add(flow);group.add(node);
    return {node,flow,foot:i>=2,side:i%2?1:-1};
  });
  mech.jetRig={group,jets,intensity:0,trailTimer:0};
}
export function updateJetRig(mech,dt,time,effects,flight=null,dodge=null) {
  const rig=mech.jetRig,target=flight ? 1 : dodge ? .9 : mech.speed>20 ? .3 : 0;
  rig.intensity=THREE.MathUtils.damp(rig.intensity,target,target?22:10,dt);
  rig.group.visible=rig.intensity>.02;if(!rig.group.visible)return;
  const bones=mech.imported.bones;mech.root.updateMatrixWorld(true);
  for(const jet of rig.jets){
    const bone=jet.foot?bones[jet.side<0?'footl':'footr']:bones.torso1;
    const p=bone.getWorldPosition(new THREE.Vector3());mech.root.worldToLocal(p);
    if(!jet.foot){p.x+=jet.side*1.55;p.z-=1.8;}else p.y-=.25;
    jet.node.position.copy(p);
    const direction=new THREE.Vector3(0,-1,flight?-.35:-.95).normalize();
    if(dodge)direction.copy(dodge).applyQuaternion(mech.root.quaternion.clone().invert()).multiplyScalar(-1).add(new THREE.Vector3(0,-.4,0)).normalize();
    jet.node.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),direction);
    const pulse=1+Math.sin(time*41+jet.side)*.06;
    setFlow(jet.flow,time+jet.side*.17,rig.intensity,.65,(jet.foot?5.5:7.5)*rig.intensity*pulse);
  }
  rig.trailTimer-=dt;
  if(rig.trailTimer<=0){
    rig.trailTimer=.09;
    // Surface interaction adds scale without opaque flame meshes or full-screen light.
    if(mech.root.position.y<5)effects.dustRise(mech.root.position,1,2.2,'#aaa99e');
  }
}
