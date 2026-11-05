import { PLASMA } from './plasmaCycle.js';
// Presentation markers are tied to animation time; each marker fires once per action.
// These never apply damage: contact/projectile systems remain authoritative.
export class SkillTimeline {
  constructor() { this.actions = new WeakMap(); }
  sample(action, time, markers) {
    if (!action || !Number.isFinite(time)) return [];
    let fired = this.actions.get(action);
    if (!fired) { fired = new Set(); this.actions.set(action, fired); }
    return markers.filter(marker => {
      if (time < marker.at || fired.has(marker.id)) return false;
      fired.add(marker.id); return true;
    });
  }
}
export const PLAYER_CUES = {
  blast: [{ id: 'release', at: PLASMA.release }, { id: 'vent', at: PLASMA.vent }],
  missile: [0,1,2,3].map(i => ({ id: 'launch-'+i, at: .24+i*.075, side: i%2 ? 'right':'left' })),
  blade: [{ id: 'release', at: .22 }],
};
