import * as THREE from 'three';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function selectLocomotion(actor) {
 const rig=actor.imported,beast=rig.kind==='monster';
 const prefix=beast?'beast':'mech';
 const motion=rig.motion;
 const yawDelta=motion?wrap(actor.root.rotation.y-motion.rootYaw):0;
 if(actor.speed>.35)return prefix+(actor.speed>(beast?4:14)?'_run':'_walk');
 if(Math.abs(yawDelta)>.004 || (motion?.turnHold||0)>0){
  const direction=Math.abs(yawDelta)>.004?Math.sign(yawDelta):motion.turnDirection;
  return prefix+(direction>0?'_turn_left':'_turn_right');
 }
 return beast?'beast_idle':actor.combatReady?'mech_ready':'mech_stand';
}

// Preserve sole orientation while solving the support leg toward a world anchor.
export function solveFoot(rig,side,target) {
 const upper=rig.bones['thigh'+side],lower=rig.bones['calf'+side],foot=rig.bones['foot'+side];
 rig.model.updateWorldMatrix(true,true);
 const orientation=foot.getWorldQuaternion(new THREE.Quaternion());
 const s=upper.getWorldPosition(new THREE.Vector3()),e=lower.getWorldPosition(new THREE.Vector3()),h=foot.getWorldPosition(new THREE.Vector3());
 const a=s.distanceTo(e),b=e.distanceTo(h),delta=target.clone().sub(s);
 const distance=THREE.MathUtils.clamp(delta.length(),Math.abs(a-b)+.01,a+b-.01),direction=delta.normalize();
 const actor=rig.holder.parent;
 const pole=new THREE.Vector3(side==='l'?.12:-.12,0,1).transformDirection(actor.matrixWorld);
 pole.addScaledVector(direction,-pole.dot(direction)).normalize();
 const knee=s.clone().addScaledVector(direction,(a*a-b*b+distance*distance)/(2*distance));
 const along=(a*a-b*b+distance*distance)/(2*distance);
 knee.addScaledVector(pole,Math.sqrt(Math.max(0,a*a-along*along)));
 const point=(bone,child,to)=>{
  rig.model.updateWorldMatrix(true,true);
  const origin=bone.getWorldPosition(new THREE.Vector3());
  const current=child.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
  const desired=to.clone().sub(origin).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(current,desired).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));
 };
 point(upper,lower,knee);point(lower,foot,s.clone().addScaledVector(direction,distance));
 rig.model.updateWorldMatrix(true,true);
 foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
}

export function updateLocomotion(actor,dt,key) {
 const rig=actor.imported,position=actor.root.position;
 const motion=rig.motion ||= {rootPosition:position.clone(),rootYaw:actor.root.rotation.y,visualYaw:actor.root.rotation.y,anchors:{},contacts:{},turnHold:0,turnDirection:1};
 const delta=position.clone().sub(motion.rootPosition),yawDelta=wrap(actor.root.rotation.y-motion.rootYaw);
 const teleport=delta.length()>8;
 if(Math.abs(yawDelta)>.004 && actor.speed<.35){motion.turnHold=.3;motion.turnDirection=Math.sign(yawDelta);}
 else motion.turnHold=Math.max(0,motion.turnHold-dt);
 const turn=/_turn_/.test(key),gait=/_(walk|run)$/.test(key);
 const idle=/_(idle|ready|stand|guard)$/.test(key);
 const grounded=position.y<.2;
 if(teleport){motion.anchors={};motion.visualYaw=actor.root.rotation.y;}
 if(turn && !actor.action){
  motion.visualYaw+=wrap(actor.root.rotation.y-motion.visualYaw)*(1-Math.exp(-5*dt));
  rig.holder.rotation.y+=wrap(motion.visualYaw-actor.root.rotation.y);
 }else motion.visualYaw=actor.root.rotation.y;
 actor.root.updateMatrixWorld(true);
 if(grounded && !actor.action && (gait||turn||idle) && rig.transitionAge>.15){
  const phase=rig.action.time/rig.action.getClip().duration;
  const stance=rig.kind==='monster'?.66:.64;
  const current={l:rig.bones.footl.getWorldPosition(new THREE.Vector3()),r:rig.bones.footr.getWorldPosition(new THREE.Vector3())};
  const center=current.l.clone().add(current.r).multiplyScalar(.5);
  // Reorient the stride for strafing/backpedaling while the torso faces its target.
  if(gait && delta.lengthSq()>.00001){
   const localDelta=delta.clone().applyQuaternion(actor.root.quaternion.clone().invert()).setY(0).normalize();
   const direction=new THREE.Vector3(localDelta.x,0,localDelta.z);
   for(const side of ['l','r']){
    const local=actor.root.worldToLocal(current[side].clone()),localCenter=actor.root.worldToLocal(center.clone());
    const stride=(local.z-localCenter.z)*(rig.gaitStrideScale||1);
    const lateral=local.x-localCenter.x;
    const target=new THREE.Vector3(localCenter.x+lateral+direction.x*stride,local.y,localCenter.z+direction.z*stride);
    current[side]=actor.root.localToWorld(target);
   }
  }
  for(const [i,side]of ['l','r'].entries()){
   const f=(phase+i*.5)%1,contact=idle||f<stance;
   if(contact){
    if(!motion.contacts[side]||!motion.anchors[side]){
     motion.anchors[side]=current[side].clone();motion.anchors[side].y=position.y+rig.footRest;
     if(!idle && motion.contacts[side]===false){
      if(rig.kind==='mech')actor.footstepCallback?.(side==='l'?-1:1,position);
      else actor.footstepCallback?.(position);
     }
    }
    solveFoot(rig,side,motion.anchors[side]);
   }else{
    delete motion.anchors[side];
    if(gait)solveFoot(rig,side,current[side]);
   }
   motion.contacts[side]=contact;
  }
 }else {motion.anchors={};motion.contacts={};}
 motion.rootPosition.copy(position);motion.rootYaw=actor.root.rotation.y;
 actor.root.updateMatrixWorld(true);
}
