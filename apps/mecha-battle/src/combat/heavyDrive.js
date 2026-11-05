// Ground-drive tuning in metres / seconds. Jet thrust has its own flight model.
export const DRIVE_PROFILES = Object.freeze({
  vanguard: { acceleration:18, braking:24, turnRate:1.65, mass:1 },
  bastion: { acceleration:12, braking:17, turnRate:1.15, mass:1.4 },
  raptor: { acceleration:25, braking:31, turnRate:2.25, mass:.8 },
  kaiju: { acceleration:8, braking:12, turnRate:.9, mass:3.4 },
});
export const driveProfile = id => DRIVE_PROFILES[id] || DRIVE_PROFILES.vanguard;
export function stepDrive(velocity, desired, dt, profile) {
  const speed=Math.hypot(velocity.x,velocity.z), targetSpeed=Math.hypot(desired.x,desired.z);
  const braking=targetSpeed<speed-.1 || velocity.x*desired.x+velocity.z*desired.z<0;
  const dx=desired.x-velocity.x,dz=desired.z-velocity.z,distance=Math.hypot(dx,dz);
  const limit=(braking?profile.braking:profile.acceleration)*dt;
  const amount=distance>0?Math.min(1,limit/distance):0;
  velocity.x+=dx*amount;velocity.z+=dz*amount;
  return velocity;
}
export function turnChassis(current, target, dt, rate) {
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+Math.max(-rate*dt,Math.min(rate*dt,delta));
}
export function actionStage(action,time,duration) {
  if(action?.type==='landing')return time/Math.max(.001,duration)<.65?'committed':'recovery';
  if(!action || !['punch','blade','blast','missile'].includes(action.type))return 'free';
  const k=time/Math.max(.001,duration);
  return k<.16?'windup':k<.78?'committed':'recovery';
}
export function contactImpulse(power,attackerMass,targetMass) {
  return Math.min(12,power*(2*attackerMass/(attackerMass+targetMass)));
}
