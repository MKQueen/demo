import * as THREE from 'three';
import { SkillTimeline, PLAYER_CUES } from '../combat/skillTimeline.js';
const direction = new THREE.Vector3();
const point = new THREE.Vector3();
const start = new THREE.Vector3();
const end = new THREE.Vector3();

export function updateSkillPresentation(game, dt) {
  game.skillTimeline ||= new SkillTimeline();
  const { mech, monster, effects, skillTimeline } = game;
  const action = mech.action;
  const time = mech.actionT;
  for (const cue of skillTimeline.sample(action, time, PLAYER_CUES[action?.type] || [])) {
    if (action.type === 'missile') {
      mech.getShoulderWorld(cue.side, point);
      effects.glowBurst(point, '#fff0c4', 3.5, .09, null, .65);
      effects.smokePuff(point, 2, .55, '#adada7');
    } else if (cue.id === 'vent') {
      effects.smokePuff(mech.getFistWorld('right', point), 2, .45, '#b9c9c9');
    } else {
      mech.getFistWorld(action.side || 'right', point);
      direction.subVectors(monster.getChestWorld(end), point).normalize();
      // Muzzle pressure faces the firing direction; blade has a short edge flash.
      if (action.type === 'blast') {
        effects.screenShake(.09,.1);
        effects.contactVFX.emit(point,{normal:direction, surface:'metal'});
      }
      effects.glowBurst(point, '#eaffff', action.type === 'blade' ? 3 : 5, .08, null, .7);
    }
  }
  const attack = game.monsterAttack;
  if (attack) {
    for (const cue of skillTimeline.sample(attack, attack.t, [{id:'release',at:attack.impact}])) {
      if (['slam','eruption'].includes(attack.type)) {
        point.copy(monster.root.position); point.y = .3;
        effects.shockwave(point, '#d8b392', 2, attack.type === 'slam' ? 22 : 15, .55);
        effects.dustRise(point, 5, 2.5, '#a99c8a');
      } else if (attack.type === 'breath') {
        effects.glowBurst(monster.getMouthWorld(point), '#fff0bd', 7, .12, null, .85);
      } else if (attack.type === 'charge') {
        effects.dustRise(monster.root.position, 4, 2, '#b5aa93');
      }
    }
  }
  // Fixed emission budget, independent of render rate. Particles converge on the
  // muzzle instead of covering the character in a large, opaque glow.
  game.skillEmissionClock = (game.skillEmissionClock || 0) + dt;
  if (game.skillEmissionClock < .055) return;
  game.skillEmissionClock %= .055;
  let color, charge;
  if (attack?.type === 'breath' && attack.t < attack.impact) {
    monster.getMouthWorld(point); charge = attack.t/attack.impact; color = '#ffb75a';
  } else return;
  for (let i=0; i<3; i++) {
    const angle = game.time*13 + i*Math.PI*2/3;
    start.copy(point).add(new THREE.Vector3(Math.cos(angle)*(3-charge), Math.sin(angle)*(3-charge), Math.sin(angle*.7)*2));
    end.copy(start).lerp(point,.65);
    effects.trail(start,end,color,.12,.08+charge*.1);
  }
}
