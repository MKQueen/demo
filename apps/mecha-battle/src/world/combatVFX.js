import { createPlasmaRig, updatePlasmaRig } from './plasmaRig.js';
import { clawTrailActive } from '../combat/attackTiming.js';
import { updateSkillPresentation } from './skillPresentation.js';
import * as THREE from 'three';

// Weapon geometry stays attached to the visible imported hand, not the old rig.
export function installWeaponRig(mech) {
  const group = new THREE.Group(); group.name = 'hardlight-blade';
  const shape = new THREE.Shape();
  shape.moveTo(-.42, 0); shape.lineTo(-.6, 6.7); shape.lineTo(0, 10.5);
  shape.lineTo(.6, 6.7); shape.lineTo(.42, 0); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: true, bevelThickness: .1, bevelSize: .12, bevelSegments: 1, steps: 1 });
  const outer = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#91eaff', metalness: .65, roughness: .22, emissive: '#24aaff', emissiveIntensity: 1.4, side: THREE.DoubleSide }));
  outer.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, 8.5), new THREE.MeshBasicMaterial({ color: '#f1ffff', toneMapped: false }));
  core.position.z = 4.3;
  group.add(outer, core); group.visible = false; mech.root.add(group);
  const leftBlade = group.clone(); leftBlade.name = 'left-hardlight-blade'; mech.root.add(leftBlade);
  mech.weaponRig = { group, leftBlade, plasma: createPlasmaRig(mech.root), previous: null };
}

export function updateCombatVFX(game, dt) {
  const { mech, monster, effects } = game;
  if (!mech || !monster) return;
  updateSkillPresentation(game, dt);
  const w = mech.weaponRig, action = mech.action;
  mech.root.updateMatrixWorld(true);
  const bladeAction = action?.type === 'blade';
  const dual = mech.config.id === 'raptor';
  for (const [side, blade] of [['left', w.leftBlade], ['right', w.group]]) {
    blade.visible = bladeAction && (dual || (action.side || 'right') === side);
    if (!blade.visible) continue;
    const hand = mech.imported.bones[side === 'left' ? 'middle1l' : 'middle1r'];
    const p = hand.getWorldPosition(new THREE.Vector3());
    blade.position.copy(mech.root.worldToLocal(p));
    const k = mech.actionT / mech.actionDuration;
    const sign = side === 'left' ? -1 : 1;
    blade.rotation.set(.08, sign * (-1.1 + THREE.MathUtils.smoothstep(k, .2, .6) * 2.1), -sign * .12);
    blade.scale.setScalar((dual ? 1.2 : 1) * Math.min(1, k * 8, (1 - k) * 7));
  }
  updatePlasmaRig(w.plasma,mech,monster,game.time);
  updateRibbons(mech, dt);
  updateRibbons(monster, dt);
  game.combatFxClock = (game.combatFxClock || 0) + dt;
  if (game.combatFxClock < .035) return;
  game.combatFxClock = 0;
  const actorTrail = (actor, side, color, active) => {
    const point = actor === mech ? actor.getFistWorld(side, new THREE.Vector3()) : actor.getClawWorld(side, new THREE.Vector3());
    actor.vfxPrevious ||= {};
    const previous = actor.vfxPrevious[side];
    if (previous && active && previous.distanceToSquared(point) < 225) {
      effects.trail(previous, point, color, .2, actor === mech ? .4 : .65);
      if (actor === monster) {
        for (const y of [-.6, .6]) effects.trail(previous.clone().add(new THREE.Vector3(0, y, 0)), point.clone().add(new THREE.Vector3(0, y, 0)), color, .16, .13);
      }
    }
    actor.vfxPrevious[side] = point;
    if (active) {
      if (actor === mech && action?.type === 'blade') {
        const tip = (side === 'left' ? w.leftBlade : w.group).localToWorld(new THREE.Vector3(0, 0, 10));
        sampleRibbon(actor, side + '-blade', point, tip, '#7edcff');
      } else {
        const width = actor === mech ? .55 : 1.15;
        sampleRibbon(actor, side, point.clone().add(new THREE.Vector3(0, -width, 0)), point.clone().add(new THREE.Vector3(0, width, 0)), color);
      }
    }
  };
  const mk = mech.actionT / (mech.actionDuration || 1);
  const punch = action?.type === 'punch' && mk > (action.heavy ? .3 : .18) && mk < (action.heavy ? .61 : .53);
  actorTrail(mech, 'left', '#9ffaff', (punch && action.side === 'left') || (bladeAction && (dual || action.side === 'left')));
  actorTrail(mech, 'right', '#9ffaff', (punch && action.side === 'right') || (bladeAction && (dual || action.side === 'right')));
  const a = game.monsterAttack;
  actorTrail(monster, 'left', '#ffbd79', clawTrailActive(a,'left'));
  actorTrail(monster, 'right', '#ffbd79', clawTrailActive(a,'right'));
  if (a && !a.resolved && ['slam', 'eruption', 'charge'].includes(a.type)) {
    const intensity = Math.min(1, a.t / a.impact);
    effects.glowBurst(monster.getChestWorld(new THREE.Vector3()), '#ff662b', 4 + intensity * 5, .12, null, .13 + intensity * .15);
  }

}

// Continuous world-space swept surfaces retain the path of the weapon, with a
// bounded history and per-vertex fade. Unlike impact sprites these show its arc.
function sampleRibbon(actor, key, a, b, color) {
  actor.combatRibbons ||= new Map();
  let ribbon = actor.combatRibbons.get(key);
  if (!ribbon) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(24 * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    mesh.frustumCulled = false; mesh.name = 'weapon-sweep-' + key;
    actor.root.add(mesh); ribbon = { mesh, points: [], color: new THREE.Color(color) }; actor.combatRibbons.set(key, ribbon);
  }
  ribbon.points.push({ a, b, age: 0 });
  if (ribbon.points.length > 25) ribbon.points.shift();
}
function updateRibbons(actor, dt) {
  for (const r of actor.combatRibbons?.values() || []) {
    for (const p of r.points) p.age += dt;
    r.points = r.points.filter(p => p.age < .3);
    const pos = r.mesh.geometry.attributes.position, colors = r.mesh.geometry.attributes.color;
    let n = 0;
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      if (a.a.distanceToSquared(b.a) > 225) continue;
      for (const [p, age] of [[a.a,a.age],[a.b,a.age],[b.a,b.age],[b.a,b.age],[a.b,a.age],[b.b,b.age]]) {
        const local = actor.root.worldToLocal(p.clone());
        pos.setXYZ(n, local.x, local.y, local.z);
        const fade = Math.pow(1 - age / .3, 1.5);
        colors.setXYZ(n++, r.color.r * fade, r.color.g * fade, r.color.b * fade);
      }
    }
    r.mesh.geometry.setDrawRange(0, n); pos.needsUpdate = colors.needsUpdate = true;
    r.mesh.visible = n > 0;
  }
}

