import { monsterClawWindows } from '../combat/attackTiming.js';
import * as THREE from 'three';
import { bodyCapsules, sweepWeapon, weaponSegment } from './contact.js';

export function startMelee(game, type, action, options = {}) {
  game.lastMeleeContact = null;
  game.meleeStrike = { type, action, previous: new Map(), bodies: bodyCapsules(game.monster), hitBoss: false, buildings: new Set(), ...options };
}

export function updateMelee(game) {
  const strike = game.meleeStrike;
  if (!strike) return;
  const m = game.mech, b = game.monster;
  if (m.action !== strike.action || !m.alive || !b.alive) { game.meleeStrike = null; return; }
  const k = m.actionT / m.actionDuration;
  const active = strike.type === 'blade' ? k >= .22 && k <= .65 : k >= (strike.heavy ? .36 : .24) && k <= (strike.heavy ? .7 : .62);
  const bodies = bodyCapsules(b);
  const sides = strike.type === 'blade' && m.config.id === 'raptor' ? ['left','right'] : [strike.side];
  for (const side of sides) {
    const current = weaponSegment(m, side, strike.type === 'blade');
    const previous = strike.previous.get(side) || current;
    if (active) {
      if (!strike.hitBoss) {
        const contact = sweepWeapon(previous, current, strike.type === 'blade' ? .55 : strike.heavy ? 1.6 : 1.25, bodies, strike.bodies);
        if (contact) {
          strike.hitBoss = true;
          game.resolveMeleeContact(strike, contact);
        }
      }
      // Contact with the facade follows the same swept weapon, not a nearby
      // building selected automatically behind the player's back.
      const min = new THREE.Vector3().copy(current.a).min(current.b).min(previous.a).min(previous.b).addScalar(-1.5);
      const max = new THREE.Vector3().copy(current.a).max(current.b).max(previous.a).max(previous.b).addScalar(1.5);
      const box = new THREE.Box3(min, max);
      for (const building of game.city.buildings) {
        if (building.destroyed || strike.buildings.has(building)) continue;
        const bounds = new THREE.Box3(new THREE.Vector3(building.x-building.w/2,0,building.z-building.d/2),new THREE.Vector3(building.x+building.w/2,building.h,building.z+building.d/2));
        if (!box.intersectsBox(bounds)) continue;
        const samples = Math.max(2, Math.ceil(Math.max(previous.a.distanceTo(current.a),previous.b.distanceTo(current.b))/.7));
        let point = null;
        for(let i=0;i<=samples && !point;i++) {
          const a=previous.a.clone().lerp(current.a,i/samples), tip=previous.b.clone().lerp(current.b,i/samples);
          const delta=tip.clone().sub(a), length=delta.length();
          if(bounds.distanceToPoint(a)<1.3)point=bounds.clampPoint(a,new THREE.Vector3());
          else if(length>.001) {
            const ray=new THREE.Ray(a,delta.divideScalar(length));
            const intersection=ray.intersectBox(bounds,new THREE.Vector3());
            if(intersection && intersection.distanceTo(a)<=length+1.3)point=intersection;
          }
        }
        if (point) {
          strike.buildings.add(building);
          game.city.damageBuilding(building,strike.type==='blade'?210:strike.heavy?160:85,m.root.position);
          game.effects.punchImpact(point,'#c9e5ed',strike.heavy||strike.type==='blade',
            {surface:'concrete',normal:m.root.position.clone().sub(point).setY(.5).normalize()});
          game.audio.impact(.8,true); game.energy=Math.min(100,game.energy+4);
          game.hitStop=Math.max(game.hitStop,.045);
        }
      }
    }
    strike.previous.set(side, current);
  }
  strike.bodies = bodies;
}

export function updateMonsterMelee(game) {
  const a=game.monsterAttack;
  if(!a || !['swipe','doubleClaw'].includes(a.type))return;
  const bodies=bodyCapsules(game.mech);
  a.contactHistory ||= new Map(); a.contactHits ||= new Set();
  const windows=monsterClawWindows(a);
  for(const window of windows){
    const point=game.monster.getClawWorld(window.side,new THREE.Vector3());
    const current={a:point,b:point.clone()};
    const previous=a.contactHistory.get(window.id)||current;
    if(a.t>=window.opens && a.t<=window.closes && !a.contactHits.has(window.id)){
      const contact=sweepWeapon(previous,current,2,bodies,a.contactBodies||bodies);
      if(contact){
        a.contactHits.add(window.id); a.hit=true;
        if(window.id===0)a.firstContactTime=a.t;
        game.damagePlayer(a.type==='doubleClaw'?(game.phase===2?19:16):(game.phase===2?27:22),a.type,{point:contact.point});
        game.effects.sparkBurst(contact.point,12,'#d1b08b',.7);
        game.audio.impact(.8,false);
      }
    }
    a.contactHistory.set(window.id,current);
  }
  a.contactBodies=bodies;
}
