const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };

// Cumulative root travel: the planted anticipation must not slide forward.
export function strikeTravel(action, phase) {
  const [start, end] = action.type === 'blade' ? [.12, .5]
    : action.heavy ? [.30, .56] : [.18, .47];
  return smooth((phase - start) / (end - start));
}

export function comboBufferLifetime(time, duration) {
  return time >= duration * .24 ? Math.max(0, duration - time) + .12 : 0;
}

// Map gameplay impact times onto the authored clip's contact/release poses.
// Difficulty can change windup and recovery independently of the animation.
export function monsterClipPhase(action, time, duration) {
  const contact = { swipe: .52, doubleClaw: .42, slam: .60, eruption: .60, breath: .52 }[action?.type];
  if (contact === undefined || !(action.impact > 0) || !(duration > action.impact)) return null;
  const knots = [[0, 0], [action.impact, contact]];
  if (action.type === 'doubleClaw' && action.impact + .72 < duration) knots.push([action.impact + .72, .78]);
  knots.push([duration, 1]);
  const t = Math.max(0, Math.min(duration, time));
  for (let i = 1; i < knots.length; i++) {
    const [end, value] = knots[i], [start, previous] = knots[i - 1];
    if (t <= end) return previous + (value - previous) * (t - start) / (end - start);
  }
  return 1;
}

// The authored double-claw clip is left then right, irrespective of swipe side.
// The same windows drive swept collision and visible trails.
export function monsterClawWindows(attack) {
  if (!attack || !['swipe','doubleClaw'].includes(attack.type)) return [];
  const strikes = attack.type === 'doubleClaw'
    ? [{id:0,side:'left',time:attack.impact},{id:1,side:'right',time:attack.impact+.72}]
    : [{id:0,side:attack.side || 'right',time:attack.impact}];
  return strikes.map(w => ({...w,
    opens:w.id===1 ? Math.max(w.time-.06,(attack.firstContactTime ?? -1)+.65) : w.time-.28,
    closes:w.time+.24}));
}
export function clawTrailActive(attack, side) {
  return monsterClawWindows(attack).some(w => w.side===side && attack.t>=w.opens && attack.t<=w.closes);
}
