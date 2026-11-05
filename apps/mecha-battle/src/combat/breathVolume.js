import * as THREE from 'three';
import { closestSegments } from '../world/contact.js';
import { traceProjectile } from './projectileFlight.js';

export function breathVolume(from,requestedEnd,buildings,bodies,width=8) {
  const obstruction=traceProjectile(from,requestedEnd,.6,buildings,[]);
  const end=obstruction?obstruction.point:requestedEnd.clone();
  const requestedLength=from.distanceTo(requestedEnd),length=from.distanceTo(end);
  const fraction=length/(requestedLength||1);
  // The visible envelope and hurt envelope share the same taper; clipping a
  // short stream must not make it expand to its full long-range radius.
  const startRadius=width*.18,endRadius=width*(.18+.75*fraction);
  const contact=breathContact(from,end,startRadius,endRadius,bodies);
  return {from:from.clone(),end,width:width*fraction,startRadius,endRadius,obstruction,contact};
}

export function breathContact(from,end,startRadius,endRadius,bodies) {
  let contact=null;
  for(let i=0;i<12&&!contact;i++) {
    const a=from.clone().lerp(end,i/12),b=from.clone().lerp(end,(i+1)/12);
    const radius=THREE.MathUtils.lerp(startRadius,endRadius,(i+.5)/12)*.82;
    for(const body of bodies) {
      const pair=closestSegments(a,b,body.a,body.b);
      if(pair.distanceSq<=(radius+body.radius)**2) { contact={point:pair.b,part:body.id};break; }
    }
  }
  return contact;
}
