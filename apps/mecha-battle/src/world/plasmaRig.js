import * as THREE from 'three';
import { PLASMA, plasmaCycle } from '../combat/plasmaCycle.js';
import { createFlow, setFlow } from './flowVFX.js';

const zAxis = new THREE.Vector3(0,0,1);
// A bounded forearm weapon assembly. No per-frame geometry/material allocation.
export function createPlasmaRig(root) {
  const group = new THREE.Group(); group.name = 'forearm-plasma-assembly';
  const shell = new THREE.MeshStandardMaterial({color:'#334650',metalness:.85,roughness:.35});
  const hot = new THREE.MeshStandardMaterial({color:'#b6eaff',emissive:'#48baff',emissiveIntensity:0,metalness:.4,roughness:.25});
  const fins = [];
  for(let i=0;i<4;i++) {
    const pivot = new THREE.Group(); pivot.rotation.z=i*Math.PI/2;
    const armor = new THREE.Mesh(new THREE.BoxGeometry(.35,.32,1.85),shell);
    armor.position.set(.68,0,.2);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.09,.16,1.55),hot);
    rail.position.set(.48,0,.35); pivot.add(armor,rail);group.add(pivot);fins.push(pivot);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(.34,12,8),new THREE.MeshBasicMaterial({color:'#e6fcff',transparent:true,opacity:0,toneMapped:false}));
  core.position.z=1.1; group.add(core);
  const flash=createFlow({color:'#8edfff'});flash.position.z=1.1;group.add(flash);
  const arcs = new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#a6edff',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  arcs.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(4*8*2*3),3).setUsage(THREE.DynamicDrawUsage));
  group.add(arcs);group.visible=false;root.add(group);
  return {group,fins,hot,core,flash,arcs};
}
export function updatePlasmaRig(rig,mech,monster,time) {
  const active=mech.action?.type==='blast'; rig.group.visible=active;
  if(!active)return;
  const t=mech.actionT,cycle=plasmaCycle(t);
  const p=mech.getFistWorld('right',new THREE.Vector3());
  rig.group.position.copy(mech.root.worldToLocal(p.clone()));
  const aim=monster.getChestWorld(new THREE.Vector3()).sub(p).normalize();
  rig.group.quaternion.copy(mech.root.getWorldQuaternion(new THREE.Quaternion()).invert())
    .multiply(new THREE.Quaternion().setFromUnitVectors(zAxis,aim));
  rig.group.scale.setScalar(.65+.35*cycle.brace);
  for(const pivot of rig.fins)pivot.children.forEach(mesh=>{mesh.position.x=(mesh === pivot.children[0] ? .68 : .48)+.22*cycle.brace;});
  rig.hot.emissiveIntensity=t<PLASMA.release?cycle.charge*2:cycle.heat*2.5;
  rig.core.visible=t<PLASMA.release;rig.core.material.opacity=cycle.charge*.9;
  rig.core.scale.setScalar(.35+cycle.charge*.8);
  rig.flash.visible=cycle.muzzle>0;
  setFlow(rig.flash,time,cycle.muzzle*1.6, .8+cycle.muzzle*.65,2+cycle.muzzle*5);
  rig.arcs.visible=t<PLASMA.release&&cycle.charge>.15;
  rig.arcs.material.opacity=cycle.charge*.75;
  const attr=rig.arcs.geometry.attributes.position;
  let n=0;
  for(let a=0;a<4;a++)for(let i=0;i<8;i++)for(const k of [i,i+1]) {
    const u=k/8,angle=a*Math.PI/2+u*1.7;
    const jitter=Math.sin(k*19+a*7+time*85)*Math.sin(u*Math.PI)*.12;
    const radius=(.7+.2*cycle.brace)*(1-u)+jitter;
    attr.setXYZ(n++,Math.cos(angle)*radius,Math.sin(angle)*radius,-.4+u*1.5);
  }
  attr.needsUpdate=true;
}
