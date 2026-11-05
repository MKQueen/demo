import { PLASMA, plasmaCycle } from '../combat/plasmaCycle.js';
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const smooth = t => t * t * (3 - 2 * t);
function envelope(t, peak = .47) {
  const release=peak-.12;
  if(t<release)return -smooth(t/release)*.28;
  if(t<peak)return -.28+smooth((t-release)/(peak-release))*1.28;
  if(t<peak+.1)return 1-smooth((t-peak)/.1)*.08;
  return .92*(1-smooth(Math.min(1,(t-peak-.1)/(1-peak-.1))));
}

// Bake a whole-body boxing motion on the downloaded skeleton. Two-bone IK
// gives the elbow a real bend; pelvis, spine and planted leg supply the strike.
// These are animation tracks, not per-frame hand-position cheats.
export function buildCombatClips(actor, rig) {
  const { bones, model } = rig;
  const all = Object.values(bones).filter((b, i, a) => a.indexOf(b) === i);
  const rest = all.map(b => ({ bone: b, q: b.quaternion.clone(), p: b.position.clone() }));
  const restore = () => { for (const r of rest) { r.bone.quaternion.copy(r.q); r.bone.position.copy(r.p); } };
  const root = actor.root;
  const world = p => root.localToWorld(p.clone());
  const local = b => root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const stance=rig.clips[rig.kind==='monster'?'v10_monster_idle':'v10_mech_ready'];
  const applyStance=()=>{
    if (!stance) return;
    for(const track of stance.tracks){
      const [boneName,property]=track.name.split('.');
      const bone=all.find(b=>b.name===boneName);
      if(bone && ['quaternion','position','scale'].includes(property))bone[property].fromArray(track.values,0);
    }
  };
  // All attack targets must share the authored body's shoulder/chest frame.
  // The downloaded upright idle has different shoulder positions after crouching.
  applyStance();
  root.updateMatrixWorld(true);
  const headY = local(bones.head).y;
  const chest = local(bones.torso1);
  const hips = local(bones.hips);
  const axisInWorld = b => Y.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()))
    .applyQuaternion(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  function twist(b, angle) {
    if (!b) return;
    root.updateMatrixWorld(true);
    b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisInWorld(b), angle));
  }
  function point(bone, child, target) {
    root.updateMatrixWorld(true);
    const now = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    const desired = target.clone().sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(now, desired);
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    bone.quaternion.copy(parentQ.multiply(worldQ));
  }
  function arm(side, wrist, elbowOut = 1) {
    const suffix = side === 'left' ? 'l' : 'r';
    const upper = bones[`upperarm${suffix}`], lower = bones[`lowerarm${suffix}`], hand = bones[`middle1${suffix}`];
    root.updateMatrixWorld(true);
    const s = upper.getWorldPosition(new THREE.Vector3());
    const e = lower.getWorldPosition(new THREE.Vector3()), h = hand.getWorldPosition(new THREE.Vector3());
    const a = s.distanceTo(e), b = e.distanceTo(h);
    const target = world(wrist);
    const direction = target.clone().sub(s);
    const distance = Math.min(a + b - .01, Math.max(Math.abs(a - b) + .01, direction.length()));
    direction.normalize(); target.copy(s).addScaledVector(direction, distance);
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const sideSign = local(upper).x < 0 ? -1 : 1;
    const pole = new THREE.Vector3(sideSign * elbowOut, rig.kind === 'monster' ? -1.4 : -.65, rig.kind === 'monster' ? -.35 : -.4).transformDirection(root.matrixWorld);
    pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    const elbow = s.clone().addScaledVector(direction, along).addScaledVector(pole, Math.sqrt(Math.max(0, a * a - along * along)));
    point(upper, lower, elbow); point(lower, hand, target);
  }
  const shoulder = Object.fromEntries(['left', 'right'].map(side => [side, local(bones[side === 'left' ? 'upperarml' : 'upperarmr'])]));
  const clips = {};
  const bake = (name, duration, pose) => {
    const times = [], values = new Map(all.map(b => [b, []])), positions=new Map(all.map(b=>[b,[]]));
    const count = Math.ceil(duration * 50);
    for (let i = 0; i <= count; i++) {
      restore(); root.updateMatrixWorld(true);
      applyStance();
      root.updateMatrixWorld(true);
      pose(i / count);
      times.push(i / count * duration);
      for (const b of all){values.get(b).push(...b.quaternion.toArray());positions.get(b).push(...b.position.toArray());}
    }
    const tracks = all.map(b => new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values.get(b)));
    tracks.push(...all.map(b=>new THREE.VectorKeyframeTrack(`${b.name}.position`,times,positions.get(b))));
    clips[name] = new THREE.AnimationClip(name, duration, tracks);
  };
  const guardPose = () => {
    for (const side of ['left', 'right']) {
      const s = shoulder[side];
      arm(side, new THREE.Vector3(s.x * .72, chest.y + headY * .07, headY * .16));
    }
  };
  bake('guard', 1, () => guardPose());
  if (rig.kind === 'mech') {
    bake('jet', 1.2, t => {
      const lift = Math.sin(Math.min(1, t * 2) * Math.PI / 2);
      bones.torso1.rotateX(.16 * lift);
      bones.head.rotateX(-.12 * lift);
      bones.thighl.rotateX(-.26 * lift); bones.thighr.rotateX(.08 * lift);
      bones.calfl.rotateX(-.58 * lift); bones.calfr.rotateX(-.38 * lift);
      for (const side of ['left', 'right']) {
        const s = shoulder[side];
        arm(side, new THREE.Vector3(s.x * .95, chest.y - headY * .14, headY * .07), .8);
      }
    });
    bake('boost', .55, t => {
      const lean = Math.sin(t * Math.PI);
      guardPose(); bones.torso1.rotateX(.2 * lean);
      bones.thighl.rotateX(-.4 * lean); bones.calfl.rotateX(-.8 * lean);
      bones.thighr.rotateX(.3 * lean); bones.calfr.rotateX(-.4 * lean);
    });
    bake('landing', .75, t => {
      const k = Math.sin(t * Math.PI);
      guardPose(); bones.torso1.rotateX(.22 * k); bones.head.rotateX(-.16 * k);
      bones.thighl.rotateX(-.35 * k); bones.thighr.rotateX(-.35 * k);
      bones.calfl.rotateX(-.7 * k); bones.calfr.rotateX(-.7 * k);
    });
    bake('plasma', PLASMA.duration, t => {
      const { brace, recoil } = plasmaCycle(t * PLASMA.duration);
      guardPose();
      // Left arm braces the weapon; the firing arm is extended BEFORE release.
      // Recoil draws the shoulder back, then the gun returns before lowering.
      arm('right', new THREE.Vector3(shoulder.right.x * .85, chest.y + headY * .025,
        headY * (.14 + .34 * brace - .075 * recoil)), .7);
      arm('left', new THREE.Vector3(shoulder.left.x * (1 - .9 * brace),
        chest.y - headY * .025, headY * (.13 + .23 * brace)), .85);
      twist(bones.waist, -.13 * brace + .08 * recoil);
      twist(bones.torso1, -.18 * brace + .12 * recoil);
      bones.torso1.rotateX(-.09 * recoil);
      bones.head.rotateX(.055 * recoil);
    });
    for (const side of ['left', 'right']) bake(`blade_${side}`, .95, t => {
      const strike = smooth(Math.max(0, Math.min(1, (t - .22) / .3)));
      const recovery = smooth(Math.max(0, (t - .58) / .42));
      const sign = side === 'right' ? 1 : -1;
      guardPose();
      twist(bones.hips, sign * (-.22 + .5 * strike - .28 * recovery));
      twist(bones.torso1, sign * (-.38 + .8 * strike - .42 * recovery));
      for (const hand of actor.config?.id === 'raptor' ? ['left','right'] : [side]) {
        const s = shoulder[hand];
        arm(hand, new THREE.Vector3(s.x * (1.4 - 2.1 * strike + 1.1 * recovery),
          chest.y + headY * (.12 - .15 * strike), headY * (.2 + .22 * Math.sin(strike * Math.PI))), .8);
      }
    });
    bake('missile', .95, t => {
      const k = Math.sin(t * Math.PI);
      bones.torso1.rotateX(-.15 * k); bones.head.rotateX(.12 * k);
      for (const side of ['left', 'right']) {
        const s = shoulder[side];
        arm(side, new THREE.Vector3(s.x * 1.1, chest.y - headY * .12, headY * .09), 1);
      }
    });
  }
  for (const side of ['left', 'right']) {
    const s = shoulder[side], sign = s.x < 0 ? -1 : 1;
    bake(`punch_${side}`, .82, t => {
      const hit = envelope(t), coil = Math.sin(t * Math.PI);
      twist(bones.hips, -sign * hit * .20);
      twist(bones.torso1, -sign * hit * .42);
      twist(bones.head, sign * hit * .18);
      if (bones[side === 'left' ? 'thighr' : 'thighl']) twist(bones[side === 'left' ? 'thighr' : 'thighl'], sign * hit * .12);
      guardPose();
      const target = new THREE.Vector3(s.x * (1 - hit * .48), chest.y + headY * (.045 + hit * .015), headY * (.13 + hit * .35));
      if (side === 'right') target.x += Math.sin(Math.max(0, hit) * Math.PI) * sign * headY * .1;
      arm(side, target, side === 'right' ? 1.2 : .7);
      twist(bones.waist, -sign * coil * .12);
    });
  }
  if (rig.kind === 'mech') for (const side of ['left','right']) bake(`heavy_${side}`,1.05,t=>{
    const s=shoulder[side], sign=s.x<0?-1:1;
    const hit=envelope(t,.56), coil=Math.sin(t*Math.PI);
    twist(bones.hips,-sign*hit*.34);
    twist(bones.waist,-sign*hit*.18);
    twist(bones.torso1,-sign*hit*.48);
    twist(bones.head,sign*hit*.2);
    guardPose();
    arm(side,new THREE.Vector3(s.x*(1-hit*.7),chest.y+headY*(.025+.015*hit),headY*(.12+.4*hit)),1.1);
    twist(bones[side==='left'?'thighr':'thighl'],sign*coil*.1);
  });
  bake('flinch', .48, t => {
    const hit = Math.sin(t * Math.PI);
    bones.torso1.rotateX(-hit * .28); bones.head.rotateX(hit * .22);
    twist(bones.hips, hit * .12); guardPose();
  });
  bake('stagger', 1.4, t => {
    bones.torso1.rotateX(.24 + Math.sin(t * Math.PI * 2) * .035);
    bones.head.rotateX(.28); bones.hips.rotateX(-.12);
    if (bones.calfl) bones.calfl.rotateX(-.22);
    if (bones.calfr) bones.calfr.rotateX(-.22);
  });
  bake('death', 2.3, t => {
    const k = smooth(Math.min(1, t * 1.3));
    bones.torso1.rotateX(k * .5); bones.head.rotateX(k * .35);
    if (bones.calfl) bones.calfl.rotateX(-k * .8);
    if (bones.calfr) bones.calfr.rotateX(-k * .8);
  });
  if (rig.kind === 'monster') {
    bake('beast_idle', 2.4, t => {
      const breath = Math.sin(t * Math.PI * 2);
      for (const side of ['left', 'right']) {
        const s = shoulder[side];
        arm(side, new THREE.Vector3(s.x * 1.12, chest.y - headY * (.22 + .008 * breath), s.z + headY * .12), .65);
      }
    });
    // Preserve downloaded leg locomotion while replacing the backwards arm swing.
    for (const name of ['walk', 'run']) {
      const base = (rig.clips['v10_monster_' + name] || rig.clips[name]).clone();
      const armNames = ['upperarml', 'upperarmr', 'lowerarml', 'lowerarmr', 'middle1l', 'middle1r'].map(k => bones[k].name + '.quaternion');
      base.tracks = base.tracks.filter(tr => !armNames.includes(tr.name));
      for (const tr of clips.beast_idle.tracks.filter(tr => armNames.includes(tr.name))) {
        const copy = tr.clone();
        for (let i = 0; i < copy.times.length; i++) copy.times[i] *= base.duration / 2.4;
        base.tracks.push(copy);
      }
      clips['beast_' + name] = base;
    }
    // The imported skeleton is humanoid, but the kaiju attack language is not:
    // it crouches low, winds the whole shoulder girdle, throws the torso and
    // keeps the head tracking the target instead of boxing from guard.
    const beastFrame = (t, side = 1, mode = 'swipe') => {
      const wind = smooth(Math.min(1, t / .34));
      const strike = t < .34 ? 0 : smooth(Math.min(1, (t - .34) / .18));
      const recover = t < .62 ? 0 : smooth(Math.min(1, (t - .62) / .38));
      twist(bones.hips, side * (-.22 * wind + .32 * strike));
      twist(bones.waist, side * (-.14 * wind + .22 * strike));
      twist(bones.torso1, side * (-.38 * wind + .65 * strike - .18 * recover));
      twist(bones.head, side * (.18 * wind - .28 * strike));
      if (bones.thighl) twist(bones.thighl, side * .14 * wind);
      if (bones.thighr) twist(bones.thighr, side * -.14 * wind);
      const active = side < 0 ? 'left' : 'right';
      const other = active === 'left' ? 'right' : 'left';
      const s = shoulder[active];
      const target = mode === 'slam'
        ? new THREE.Vector3(s.x * .8, chest.y - headY * (.12 + .06 * strike), s.z + headY * (.16 + .17 * strike))
        : new THREE.Vector3(s.x * (.72 - .24 * strike), chest.y - headY * (.09 - .06 * strike), s.z + headY * (.16 + .26 * strike));
      target.lerp(new THREE.Vector3(s.x*.9,chest.y-headY*.14,s.z+headY*.19),recover);
      arm(active, target, 1.1);
      const so = shoulder[other];
      arm(other, new THREE.Vector3(so.x * .85, chest.y - headY * .12, so.z + headY * .16), .65);
      if (mode === 'slam') {
        twist(bones.torso1, -side * .26 * strike);
        twist(bones.head, side * .2 * strike);
        if (bones.calfl) twist(bones.calfl, -.22 * wind + .36 * strike);
        if (bones.calfr) twist(bones.calfr, -.22 * wind + .36 * strike);
      }
    };
    bake('beast_swipe_left', 1, t => beastFrame(t, -1));
    bake('beast_swipe_right', 1, t => beastFrame(t, 1));
    bake('beast_doubleclaw', 1.2, t => {
      const pulse = (peak, width) => Math.exp(-Math.pow((t - peak) / width, 2));
      const left = pulse(.42, .15), right = pulse(.78, .15);
      twist(bones.hips, .14 * (left - right));
      twist(bones.torso1, .5 * (left - right));
      twist(bones.head, -.2 * (left - right));
      bones.torso1.rotateX(.12 * Math.sin(t * Math.PI));
      for (const side of ['left', 'right']) {
        const s = shoulder[side], hit = side === 'left' ? left : right;
        arm(side, new THREE.Vector3(s.x * (1 - .4 * hit), chest.y - headY * (.1 - .09 * hit), s.z + headY * (.16 + .28 * hit)), 1.4);
      }
    });
    bake('beast_slam', 1.25, t => {
      const lift = smooth(Math.min(1, t / .38));
      const strike = smooth(Math.max(0, Math.min(1, (t - .38) / .22)));
      const recovery = smooth(Math.max(0, (t - .68) / .32));
      for (const side of ['left', 'right']) {
        const s = shoulder[side];
        arm(side, new THREE.Vector3(s.x * .85,
          chest.y + headY * (-.12 + .32 * lift - .5 * strike + .18 * recovery),
          s.z + headY * (.17 + .15 * lift + .08 * strike - .23 * recovery)), .7);
      }
      twist(bones.torso1, .08 * Math.sin(t * Math.PI));
    });
    bake('beast_breath', 1.35, t => {
      const charge = smooth(Math.min(1, t / .52));
      const release = t < .52 ? 0 : smooth(Math.min(1, (t - .52) / .25));
      twist(bones.hips, -.12 * charge);
      twist(bones.waist, -.1 * charge);
      twist(bones.torso1, -.3 * charge + .16 * release);
      twist(bones.head, -.22 * charge + .12 * release);
      arm('left', new THREE.Vector3(shoulder.left.x * .65, chest.y - headY * .13, shoulder.left.z + headY * (.17 + .06 * charge)), .65);
      arm('right', new THREE.Vector3(shoulder.right.x * .65, chest.y - headY * .13, shoulder.right.z + headY * (.17 + .06 * charge)), .65);
    });
    bake('beast_roar', 1.1, t => {
      const roar = Math.sin(Math.min(1, t) * Math.PI);
      twist(bones.hips, .14 * roar);
      twist(bones.torso1, -.5 * roar);
      twist(bones.head, -.42 * roar);
      arm('left', new THREE.Vector3(shoulder.left.x * 1.08, chest.y - headY * (.12 - .08 * roar), shoulder.left.z + headY * .19), .7);
      arm('right', new THREE.Vector3(shoulder.right.x * 1.08, chest.y - headY * (.12 - .08 * roar), shoulder.right.z + headY * .19), .7);
    });
  }
  restore(); model.updateMatrixWorld(true);
  rig.rest = rest;
  rig.metrics = { headY, chestY: chest.y, hipsY: hips.y };
  return clips;
}
