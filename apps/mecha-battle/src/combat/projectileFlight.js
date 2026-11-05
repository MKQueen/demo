import * as THREE from 'three';

function sphereEntry(origin, direction, center, radius) {
  const offset = origin.clone().sub(center), b = offset.dot(direction);
  const c = offset.lengthSq() - radius * radius;
  if (c <= 0) return 0;
  const d = b*b-c;
  if(d<0)return Infinity;
  const entry=-b-Math.sqrt(d);
  return entry>=0?entry:Infinity;
}

// Analytic finite ray/capsule entry, including rays parallel to the capsule axis.
export function capsuleEntry(from, to, capsule, radius = 0) {
  const delta=to.clone().sub(from), length=delta.length();
  if (length < 1e-8) {
    const axis=capsule.b.clone().sub(capsule.a);
    const t=THREE.MathUtils.clamp(from.clone().sub(capsule.a).dot(axis)/(axis.lengthSq()||1),0,1);
    return from.distanceTo(capsule.a.clone().addScaledVector(axis,t))<=capsule.radius+radius ? 0 : null;
  }
  const rd=delta.divideScalar(length), ba=capsule.b.clone().sub(capsule.a), oa=from.clone().sub(capsule.a);
  const r=capsule.radius+radius, baba=ba.lengthSq(), bard=ba.dot(rd), baoa=ba.dot(oa);
  let distance=Math.min(sphereEntry(from,rd,capsule.a,r),sphereEntry(from,rd,capsule.b,r));
  if (baba>1e-8) {
    const projection=THREE.MathUtils.clamp(baoa/baba,0,1);
    if (from.distanceToSquared(capsule.a.clone().addScaledVector(ba,projection))<=r*r) return 0;
    const a=baba-bard*bard, b=baba*rd.dot(oa)-baoa*bard;
    const c=baba*oa.lengthSq()-baoa*baoa-r*r*baba, h=b*b-a*c;
    if (Math.abs(a)>1e-8 && h>=0) {
      const t=(-b-Math.sqrt(h))/a, y=baoa+t*bard;
      if(t>=0&&y>=0&&y<=baba)distance=Math.min(distance,t);
    }
  }
  return distance<=length ? distance/length : null;
}

export function boxEntry(from,to,min,max,radius=0) {
  const delta=to.clone().sub(from);let enter=0,exit=1;
  for(const axis of ['x','y','z']) {
    const lo=min[axis]-radius,hi=max[axis]+radius;
    if(Math.abs(delta[axis])<1e-9){if(from[axis]<lo||from[axis]>hi)return null;continue;}
    let a=(lo-from[axis])/delta[axis],b=(hi-from[axis])/delta[axis];
    if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);
    if(enter>exit)return null;
  }
  return enter;
}

export function steerDirection(direction, desired, maxRadians) {
  const angle=direction.angleTo(desired);
  if(angle<1e-7)return direction;
  const axis=new THREE.Vector3().crossVectors(direction,desired);
  if(axis.lengthSq()<1e-10)axis.crossVectors(direction,Math.abs(direction.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0));
  return direction.applyAxisAngle(axis.normalize(),Math.min(angle,maxRadians)).normalize();
}

// One authoritative earliest collision. Buildings block shots before actors.
export function traceProjectile(from,to,radius,buildings,bodies,previousBodies=bodies) {
  let hit=null;
  const consider=(t,kind,object)=>{
    if(t!==null&&t>=0&&t<=1&&(!hit||t<hit.t-1e-7))hit={t,kind,object,point:from.clone().lerp(to,t)};
  };
  if(from.y<=radius)consider(0,'ground');
  else if(to.y<=radius)consider((from.y-radius)/(from.y-to.y),'ground');
  for(const b of buildings)if(!b.destroyed)consider(boxEntry(from,to,
    new THREE.Vector3(b.x-b.w/2,0,b.z-b.d/2),new THREE.Vector3(b.x+b.w/2,b.h,b.z+b.d/2),radius),'building',b);
  for(const body of bodies) {
    const old=previousBodies.find(b=>b.id===body.id)||body;
    // Relative motion removes target translation from the projectile sweep.
    // Short substeps approximate rotating capsule axes, not fast projectile travel.
    const travel=Math.max(old.a.distanceTo(body.a),old.b.distanceTo(body.b));
    const count=Math.min(12,Math.max(1,Math.ceil(travel/.5)));
    for(let i=0;i<count;i++) {
      const t0=i/count,t1=(i+1)/count;
      const a=old.a.clone().lerp(body.a,t0),b=old.b.clone().lerp(body.b,t0);
      const motion=old.a.clone().lerp(body.a,t1).sub(a);
      const entry=capsuleEntry(from.clone().lerp(to,t0),from.clone().lerp(to,t1).sub(motion),{...body,a,b},radius);
      if(entry!==null)consider((i+entry)/count,'boss',body);
    }
  }
  if(hit){
    if(hit.kind==='ground')hit.normal=new THREE.Vector3(0,1,0);
    else if(hit.kind==='boss'){
      const axis=new THREE.Line3(hit.object.a,hit.object.b).closestPointToPoint(hit.point,true,new THREE.Vector3());
      hit.normal=hit.point.clone().sub(axis).normalize();
    }else{
      const b=hit.object,local=hit.point.clone().sub(new THREE.Vector3(b.x,b.h/2,b.z));
      const faces=[['x',b.w/2],['y',b.h/2],['z',b.d/2]].sort((a,b)=>Math.abs(Math.abs(local[a[0]])-a[1])-Math.abs(Math.abs(local[b[0]])-b[1]));
      hit.normal=new THREE.Vector3();hit.normal[faces[0][0]]=Math.sign(local[faces[0][0]])||1;
    }
    if(hit.normal.lengthSq()<.1)hit.normal=from.clone().sub(to).normalize();
    hit.contactPoint=hit.point.clone().addScaledVector(hit.normal,-radius);
  }
  return hit;
}
