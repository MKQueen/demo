import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { buildCombatClips } from './combatAnimations.js';
import { updateLocomotion, selectLocomotion, solveFoot } from './locomotion.js';
import { monsterClipPhase } from '../combat/attackTiming.js';
import { assetUrl } from '../assetPaths.js';

const templates = new Map();
const ASSETS = { mech: assetUrl('models/pacific/JaegerMotion.glb'), monster: assetUrl('models/pacific/KaijuMotion.glb') };
const BONE_NAMES = {
  Head: 'head', Hip: 'hips', Waist: 'waist', Spine01: 'spine', Spine02: 'torso1',
  L_Upperarm: 'upperarml', L_Forearm: 'lowerarml', L_Hand: 'middle1l', L_Clavicle: 'shoulderl',
  R_Upperarm: 'upperarmr', R_Forearm: 'lowerarmr', R_Hand: 'middle1r', R_Clavicle: 'shoulderr',
  L_Thigh: 'thighl', R_Thigh: 'thighr', L_Calf: 'calfl', R_Calf: 'calfr', L_Foot: 'footl', R_Foot: 'footr',
};
export async function preloadCharacters() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(ASSETS).map(async ([kind, url]) => {
    const source = await loader.loadAsync(url);
    const required = ['idle', 'walk', 'run', 'slash', 'hurt'];
    if (!required.every(name => source.animations.some(c => c.name.endsWith(name)))) throw new Error(`${kind}: 模型缺少必需的骨骼动作`);
    templates.set(kind, source);
  }));
}

export function attachImportedCharacter(actor, kind) {
  const source = templates.get(kind);
  if (!source) throw new Error(`角色资源未加载：${kind}`);
  actor.visual.visible = false;
  const model = clone(source.scene), holder = new THREE.Group(), facing = new THREE.Group();
  facing.rotation.y = -Math.PI / 2;
  facing.add(model); holder.add(facing); actor.root.add(holder);
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(source.animations.map(clip => [clip.name.split(':').pop(), clip.clone()]));
  const idle = mixer.clipAction(clips.idle); idle.play(); mixer.update(0);
  model.updateMatrixWorld(true);
  // Measure a skinned pose, not the conservative accessor bounds.
  const box = new THREE.Box3().setFromObject(model, true), size = box.getSize(new THREE.Vector3());
  const scale = (kind === 'mech' ? 20 : 25) / size.y;
  // Box is in actor world space. Normalize before gameplay moves the root.
  model.scale.multiplyScalar(scale);
  model.position.y -= (box.min.y - actor.root.position.y) * scale;
  model.updateMatrixWorld(true);
  const bones = {};
  const materials = [];
  model.traverse(o => {
    if (o.isBone) bones[BONE_NAMES[o.name] || o.name] = o;
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    o.geometry = o.geometry.clone();
    const convert = mat => {
      const next = mat.clone();
      for (const v of Object.values(next)) if (v?.isTexture) v.userData.shared = true;
      // Preserve the downloaded texture atlas, panel detail and skin colour.
      next.metalness = kind === 'mech' ? .92 : .015;
      next.roughness = kind === 'mech' ? .78 : .92;
      next.envMapIntensity = kind === 'mech' ? .72 : .38;
      next.normalScale?.setScalar(kind==='mech'?1.1:1.2);
      if (next.emissive) materials.push(next);
      return next;
    };
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
  });
  if (!bones.head || !bones.upperarml || !bones.footl) throw new Error(`${kind}: 骨骼不完整`);
  const rig = { model, holder, facing, mixer, clips, bones, current: '', action: null, token: null, kind, elapsed: 0, recoil: 0 };
  actor.imported = rig;
  // Bake real multi-joint clips for boxing, block, flinch and collapse, alongside
  // the downloaded walk/run and full-body overhead attack.
  Object.assign(clips, buildCombatClips(actor, rig));
  for (const name of Object.keys(clips)) {
    if (!name.startsWith('v10_')) continue;
    const key=name.slice(4).replace(/^monster_/, 'beast_');
    // Authored combat clips take precedence over legacy source aliases.
    if (!clips[key]) clips[key]=clips[name];
  }
  rig.sourceScale=scale;
  clips.heavy = THREE.AnimationUtils.subclip(clips.slash, 'heavy', 18, 85, 30);
  idle.stop(); mixer.stopAllAction();
  actor.flashMats = materials;
  actor.root.userData.asset = kind === 'mech' ? 'Pacific Breach Jaeger / rigged' : 'Pacific Breach Kaiju / rigged';
  actor.root.userData.animationClips = Object.keys(clips);
  actor.root.updateMatrixWorld(true);
  const floor = Math.min(bones.footl.getWorldPosition(new THREE.Vector3()).y, bones.footr.getWorldPosition(new THREE.Vector3()).y) - actor.root.position.y;
  rig.footRest = Math.min(floor, .5);
  rig.baseGroundOffset = Math.min(0, rig.footRest - floor);
  holder.position.y = rig.baseGroundOffset;
}

function selectClip(actor) {
  const type = actor.action?.type;
  if (type === 'dead' || type === 'death') return 'death';
  if (type === 'hit') return 'flinch';
  if (type === 'stagger') return 'stagger';
  if (type === 'punch') return actor.action.heavy ? `heavy_${actor.action.side}` : `punch_${actor.action.side}`;
  if (type === 'swipe') return riggedBeast(actor) ? `beast_swipe_${actor.action.side || 'right'}` : `punch_${actor.action.side || 'right'}`;
  if (type === 'blade') return `blade_${actor.action.side || 'right'}`;
  if (['doubleClaw', 'slam', 'eruption'].includes(type)) return riggedBeast(actor) ? `beast_${type === 'doubleClaw' ? 'doubleclaw' : 'slam'}` : 'heavy';
  if (type === 'blast') return 'plasma';
  if (type === 'missile') return 'missile';
  if (type === 'ultimate') return 'guard';
  if (type === 'breath') return riggedBeast(actor) ? 'beast_breath' : 'guard';
  if (type === 'charge') return riggedBeast(actor) ? 'beast_run' : 'run';
  if (type === 'dodge') return 'boost';
  if (type === 'jet') return 'jet';
  if (type === 'landing') return 'landing';
  if (type === 'tail') return 'beast_slam';
  if (type === 'enrage' || type === 'roar') return riggedBeast(actor) ? 'beast_roar' : 'stagger';
  if (actor.guarding) return 'mech_guard';
  return selectLocomotion(actor);
}

function riggedBeast(actor) { return actor.imported?.kind === 'monster'; }

export function updateImportedCharacter(actor, dt) {
  const rig = actor.imported;
  if (!rig) return;
  rig.elapsed += dt;
  const type = actor.action?.type;
  const recentHit = !type && (actor.flinchTimer || 0) > 0;
  const key = recentHit ? 'flinch' : selectClip(actor), token = recentHit ? actor.hitToken : actor.action;
  actor.flinchTimer = Math.max(0, (actor.flinchTimer || 0) - dt);
  const changed = key !== rig.current || (token && token !== rig.token);
  if (changed) {
    const gaitChange=/_(walk|run)$/.test(key)&&/_(walk|run)$/.test(rig.current);
    const phase=gaitChange?rig.action.time/rig.action.getClip().duration:0;
    const next = rig.mixer.clipAction(rig.clips[key]);
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    const once = (!!type || recentHit) && !['charge', 'stagger', 'enrage', 'roar'].includes(type);
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    if (once) next.setDuration(recentHit ? .36 : key === 'jet' ? .75 : actor.actionDuration || next.getClip().duration);
    next.play();
    if (gaitChange)next.time=phase*next.getClip().duration;
    const locomotionChange=!type&&!recentHit;
    if (rig.action && rig.action !== next) rig.action.crossFadeTo(next, key === 'flinch' ? .045 : locomotionChange ? .23 : .10, false);
    rig.action = next; rig.current = key; rig.token = token;
    rig.transitionAge = 0;
    if (type) next.time = actor.actionT * next.getEffectiveTimeScale();
  }
  if ((!type || type==='charge') && /_(walk|run)$/.test(key)) {
    const run=key.endsWith('_run'), beast=rig.kind==='monster';
    const stride=beast?(run?.42:.28):(run?.36:.23);
    const stance=beast?.66:.64;
    const speed=actor.speed || (type==='charge'?24:0);
    const displacement=rig.motion?actor.root.position.clone().sub(rig.motion.rootPosition).setY(0):new THREE.Vector3(0,0,1);
    const direction=displacement.lengthSq()>.000001?displacement.normalize().applyQuaternion(actor.root.quaternion.clone().invert()):new THREE.Vector3(0,0,1);
    rig.gaitStrideScale=(.5+.5*Math.abs(direction.z))*(direction.z<-.2?.6:1);
    rig.action.setEffectiveTimeScale(Math.max(.08,speed*rig.action.getClip().duration*stance/(stride*rig.sourceScale*rig.gaitStrideScale)));
  }
  const contactPhase = rig.kind === 'monster' ? monsterClipPhase(actor.action, actor.actionT, actor.actionDuration) : null;
  if (contactPhase !== null) {
    rig.action.setEffectiveTimeScale(0);
    rig.action.time = contactPhase * rig.action.getClip().duration;
  }
  rig.mixer.update(dt);
  rig.transitionAge=(rig.transitionAge||0)+dt;
  const k = type ? Math.min(1, actor.actionT / actor.actionDuration) : 0;
  const pulse = Math.sin(k * Math.PI);
  rig.holder.position.set(0, rig.baseGroundOffset, 0); rig.holder.rotation.set(0, 0, 0);
  if(actor.root.position.y<.2 && !['dead','death'].includes(type)) {
    rig.loadLean ||= new THREE.Vector2();
    const acceleration=actor.driveAcceleration?.clone().applyQuaternion(actor.root.quaternion.clone().invert());
    const pitch=acceleration?THREE.MathUtils.clamp(acceleration.z/24,-1,1)*.065:0;
    const roll=acceleration?THREE.MathUtils.clamp(-acceleration.x/24,-1,1)*.045:0;
    rig.loadLean.x=THREE.MathUtils.damp(rig.loadLean.x,pitch,6,dt);
    rig.loadLean.y=THREE.MathUtils.damp(rig.loadLean.y,roll,6,dt);
    rig.holder.rotation.x+=rig.loadLean.x;rig.holder.rotation.z+=rig.loadLean.y;
    actor.groundCompression=THREE.MathUtils.damp(actor.groundCompression||0,0,9,dt);
    rig.loadCompression=actor.groundCompression*(rig.kind==='monster'?.23:.16);
  }
  if (['punch', 'swipe'].includes(type)) {
    // Plant, coil, step through, recover. Actual root lunge is handled by combat.
    rig.holder.rotation.x += pulse * .07;
    rig.holder.position.z = Math.sin(k * Math.PI) * (actor.action.heavy ? 1 : .45);
  }
  if (type === 'slam' || type === 'doubleClaw') rig.holder.rotation.x = pulse * .11;
  if (type === 'breath') {
    rig.bones.torso1.rotateX(-pulse * .1); rig.bones.head.rotateX(-pulse * .15);
  }
  if (type === 'dodge') rig.holder.rotation.z = pulse * (actor.action.side || 1) * .2;
  if (type === 'jet') rig.holder.rotation.x = .16;
  if (type === 'tail') {
    const spin = THREE.MathUtils.smoothstep(k, .12, .72);
    rig.holder.rotation.y = (actor.action.reverse ? -1 : 1) * Math.PI * 2 * spin;
  }
  if (actor.recoil > 0 && rig.kind === 'monster' && !['death', 'stagger'].includes(type)) {
    rig.bones.torso1.rotateX(-actor.recoil * .22);
    rig.bones.head.rotateX(actor.recoil * .15);
    rig.holder.position.z -= actor.recoil * .55;
  }
  if (actor.contactReaction && !['death','dead','stagger'].includes(type)) {
    const r=actor.contactReaction;
    r.time+=dt;
    const pulse=Math.sin(Math.min(1,r.time/r.duration)*Math.PI)*r.strength;
    // World hit direction becomes actor-local roll/pitch, while the struck side
    // drives the torso yaw. Reactions never overwrite an attack's arm IK.
    rig.holder.rotation.z += -r.x*pulse*.13;
    rig.holder.rotation.x += r.z*pulse*.10;
    rig.holder.rotation.y += -r.side*pulse*.12;
    rig.holder.position.x += r.x*pulse*.45;
    rig.holder.position.z += r.z*pulse*.45;
    if(r.time>=r.duration)actor.contactReaction=null;
  }
  // Keep authored poses on the pavement. The imported attack has a large
  // vertical excursion; feet supply a cheap ground correction each frame.
  actor.root.updateMatrixWorld(true);
  const footY = Math.min(rig.bones.footl.getWorldPosition(new THREE.Vector3()).y, rig.bones.footr.getWorldPosition(new THREE.Vector3()).y) - actor.root.position.y;
  rig.holder.position.y += THREE.MathUtils.clamp(rig.footRest - footY, -12, 12);
  if(actor.root.position.y<.2 && (rig.loadCompression||0)>.001 && !['dead','death'].includes(type)){
    const planted=Object.fromEntries(['l','r'].map(side=>[side,rig.bones['foot'+side].getWorldPosition(new THREE.Vector3())]));
    const parent=rig.bones.hips.parent;
    const delta=new THREE.Vector3(0,-rig.loadCompression,0)
      .applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert())
      .divide(parent.getWorldScale(new THREE.Vector3()));
    rig.bones.hips.position.add(delta);
    // Apply after ground correction, then retain both sole positions: otherwise
    // lifting the holder would silently erase the pelvis compression.
    for(const side of ['l','r'])solveFoot(rig,side,planted[side]);
  }
  updateLocomotion(actor,dt,key);
  if (rig.kind === 'mech' && ['punch','blade','blast','missile'].includes(type) && actor.root.position.y < .2) {
    const side=actor.action.side==='left'?'r':'l';
    if(rig.plantToken!==actor.action) {
      rig.plantToken=actor.action; rig.plantPosition=null;
    }
    if(k>=.18 && k<.76) {
      const foot=rig.bones['foot'+side];
      rig.plantPosition ||= foot.getWorldPosition(new THREE.Vector3());
      solveFoot(rig,side,rig.plantPosition);
    } else rig.plantPosition=null;
  } else { rig.plantPosition=null; rig.plantToken=null; }
  if (type === 'death' || type === 'dead') {
    const collapse = THREE.MathUtils.smoothstep(k, .12, .9);
    rig.holder.rotation.x = -collapse * 1.48;
    rig.holder.position.y = -collapse * 1.4;
    rig.holder.position.z = -collapse * 3.5;
  }
  actor.root.updateMatrixWorld(true);
}

export function importedAnchor(actor, name, out) {
  const rig = actor.imported;
  if (!rig) return null;
  const aliases = { torso: 'torso1' };
  const bone = rig.bones[aliases[name] || name];
  if (!bone) return null;
  actor.root.updateMatrixWorld(true);
  return bone.getWorldPosition(out);
}

