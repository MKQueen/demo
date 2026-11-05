import * as THREE from 'three';
import { bodyCapsules } from '../world/contact.js';
import { steerDirection, traceProjectile } from './projectileFlight.js';

export function updatePlayerProjectiles(game,dt) {
  const bodies=game.monster?.alive?bodyCapsules(game.monster):[];
  for(let i=game.playerProjectiles.length-1;i>=0;i--) {
    const p=game.playerProjectiles[i];
    if(p.delay>0){p.delay-=dt;continue;}
    p.group.visible=true;p.t+=dt;
    if(p.kind==='missile' && p.t>.12) {
      const target=p.aimedBuilding&&!p.aimedBuilding.destroyed?p.target:
        !p.aimedBuilding&&game.monster?.alive?game.monster.getChestWorld(new THREE.Vector3()):null;
      if(target)steerDirection(p.direction,target.clone().sub(p.group.position).normalize(),p.turnRate*dt);
    }
    const from=p.group.position.clone(),to=from.clone().addScaledVector(p.direction,p.speed*dt);
    const hit=traceProjectile(from,to,p.radius,game.city?.buildings||[],bodies,p.previousBodies||bodies);
    const end=hit?hit.point:to;
    p.group.position.copy(end);
    p.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),p.direction);
    game.effects.trail(from,end,p.kind==='missile'?'#ffac63':'#83dfff',.1,p.kind==='missile'?.11:.23);
    p.trailTimer-=dt;
    if(p.trailTimer<=0) {
      p.trailTimer=p.kind==='missile'?.07:.09;
      if(p.kind==='missile')game.effects.smokePuff(end,1,.24,'#a9a8a2');
    }
    if(p.flow)for(const mesh of p.flow.children)if(mesh.material.uniforms){mesh.material.uniforms.uTime.value=game.time;}
    p.previousBodies=bodies;
    if(hit) {
      game.playerProjectiles.splice(i,1);
      p.hitNormal=hit.normal;
      p.hitKind=hit.kind;p.building=hit.kind==='building'?hit.object:null;
      game.impactPlayerProjectile(p,hit.contactPoint);
      game.removePlayerProjectile(p);
    } else if(p.t>=p.ttl||end.length()>650) {
      game.playerProjectiles.splice(i,1);game.removePlayerProjectile(p);
      // A miss expires quietly: no fake damage, explosion, hit stop or camera kick.
    }
  }
}
