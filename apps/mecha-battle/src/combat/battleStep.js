import { clamp } from '../utils.js';
import { updateCombatVFX } from '../world/combatVFX.js';
import { updateMelee, updateMonsterMelee } from '../world/melee.js';
import { moveAgainstBuildings } from '../world/buildingCollision.js';

function constrainActor(game, actor, from, dt) {
  const beast=actor===game.monster,position=actor.root.position;
  const speed=position.distanceTo(from)/Math.max(dt,.00001);
  const collision=moveAgainstBuildings(from,position,game.city.buildings,beast?5.5:3.8,(b,point)=>{
    if(speed>.2)game.city.damageBuilding(b,dt*(beast?320:game.dodgeTimer>0?480:160),from);
    if(speed>3 && (actor.wallEffectAt||0)<=game.battleTime){
      actor.wallEffectAt=game.battleTime+.18;
      const p=position.clone().set(point.x,point.y,point.z);
      game.effects.punchImpact(p,'#b4a795',false,{surface:'concrete',normal:from.clone().sub(p).setY(.3).normalize()});
      game.effects.dustRise(p,2,2.5,'#93887b');
      game.audio.impact(.5,false);
    }
  });
  const blocked=Math.hypot(position.x-collision.position.x,position.z-collision.position.z)>.001;
  position.set(collision.position.x,collision.position.y,collision.position.z);
  if(blocked){
    const velocity=beast?actor.driveVelocity:game.playerVel;
    if(velocity){
      const nx=from.x+velocity.x*dt-position.x,nz=from.z+velocity.z*dt-position.z,len=Math.hypot(nx,nz);
      if(len>.001){const dot=(velocity.x*nx+velocity.z*nz)/len;if(dot>0){velocity.x-=nx/len*dot;velocity.z-=nz/len*dot;}}
    }
    if(!beast&&game.jetState)game.jetState.descending=true;
  }
}

// Order matters: input → movement → animation → swept contact → world effects.
export function stepBattle(game, dt) {
  if (!game.battle) return;
  if(game.inputMode==='pose'){
    const state=game.pose.getState();
    game.poseState=state;game.poseVisible=state.visible;
    game.motionLossTime=state.controlReady?0:(game.motionLossTime||0)+dt;
    if(game.motionLossTime>.9){
      game.motionPaused=true;game.pauseGame();
      game.ui.toast('玩家追踪中断，战斗已暂停 · 恢复锁定后点击继续', 'warn',4500);
      return;
    }
  }else game.motionLossTime=0;
  game.battleTime += dt;
  const mechFrom=game.mech.root.position.clone(),monsterFrom=game.monster.root.position.clone();
  let sdt = dt;
  if (game.hitStop > 0) {
    sdt = dt * 0.08;
  }
  game.hitStop = Math.max(0, game.hitStop - dt);
  game.dodgeCooldown = Math.max(0, game.dodgeCooldown - sdt);
  game.jetCooldown = Math.max(0, game.jetCooldown - sdt);
  game.fuelRegenDelay = Math.max(0, game.fuelRegenDelay - sdt);
  if (!game.jetState && game.jetCooldown <= 0 && game.fuelRegenDelay <= 0) game.jetFuel = Math.min(100, game.jetFuel + sdt * 18);
  game.blastCooldown = Math.max(0, game.blastCooldown - sdt);
  game.missileCooldown = Math.max(0, game.missileCooldown - sdt);
  game.bladeCooldown = Math.max(0, game.bladeCooldown - sdt);
  game.invuln = Math.max(0, game.invuln - sdt);
  game.dodgeTimer = Math.max(0, game.dodgeTimer - sdt);
  game.comboTimer = Math.max(0, game.comboTimer - sdt);
  game.playerBlockHold = game.blocking ? game.playerBlockHold + sdt : 0;
  if (game.comboTimer <= 0 && game.combo > 0) {
    game.combo = 0;
    game.ui.setCombo(0);
  }
  if (!game.ultimateActive && game.hp > 0) {
    game.energy = clamp(game.energy + sdt * 1.25, 0, 100);
  }
  if (game.ultimateActive) {
    game.updateUltimate(sdt);
  } else {
    game.updateCombatInput(sdt);
    game.updatePlayerMovement(sdt);
    game.updatePendingImpacts(sdt);
    game.updatePlayerProjectiles(sdt);
  }
  game.updateCombo(dt);
  game.updateMonster(sdt);
  constrainActor(game,game.mech,mechFrom,sdt);
  constrainActor(game,game.monster,monsterFrom,sdt);
  game.updateCityAttack(sdt);
  game.updateHazards(sdt);
  game.updateMission(sdt);
  game.updateHints(dt);
  game.updateMechVisuals(sdt);
  updateCombatVFX(game, sdt);
  updateMelee(game);
  updateMonsterMelee(game);
  const mechContactFrom=game.mech.root.position.clone(),monsterContactFrom=game.monster.root.position.clone();
  game.updateContactMotion(sdt);
  constrainActor(game,game.mech,mechContactFrom,sdt);
  constrainActor(game,game.monster,monsterContactFrom,sdt);

  for(const [actor,from,radius]of [[game.mech,mechFrom,3.5],[game.monster,monsterFrom,5]]) {
    game.city.streetFurniture?.sweep(from,actor.root.position,radius,p=>{
      // Limit audiovisual impulses when a dash crosses several objects.
      if((actor.streetEffectAt||0)>game.battleTime)return;
      actor.streetEffectAt=game.battleTime+.12;
      const point=actor.root.position.clone().set(p.x,.6,p.z);
      game.effects.dustRise(point,2,1.4,'#a19785');game.effects.debrisBurst(point,3,.45);
      game.audio.impact(.25,false);
    });
  }
  // City simulation must advance during combat as well as intro/outcome.
  // Otherwise a destroyed tower remains frozen in its first collapse pose.
  game.city.update(sdt, game.time);
  game.environment.update(dt, game.time);
  game.effects.update(dt, game.time);

}
