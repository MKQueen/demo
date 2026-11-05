// Seconds, shared by animation, release scheduling and presentation.
export const PLASMA = Object.freeze({ release: .32, vent: .6, duration: .85 });
const clamp = t => Math.max(0, Math.min(1, t));
const smooth = t => { const k = clamp(t); return k*k*(3-2*k); };
export function plasmaCycle(time) {
  const charge = smooth(time / PLASMA.release);
  const recover = smooth((time - .48) / (PLASMA.duration - .48));
  const recoil = time < PLASMA.release ? 0 :
    smooth((time - PLASMA.release) / .045) * (1 - smooth((time - .365) / .2));
  return { charge, brace: charge*(1-recover), recoil,
    muzzle: time >= PLASMA.release ? 1-clamp((time-PLASMA.release)/.14) : 0,
    heat: time >= PLASMA.release ? 1-smooth((time-PLASMA.release)/.53) : 0 };
}
