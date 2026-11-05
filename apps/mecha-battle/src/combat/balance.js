// Timing stays readable on every difficulty; pressure comes from recovery and damage.
export const DIFFICULTIES = Object.freeze({
  recruit: { name: '新兵', damage: .7, recovery: 1.35, bossHealth: .85, parry: .3 },
  veteran: { name: '老兵', damage: 1, recovery: 1, bossHealth: 1, parry: .22 },
  nightmare: { name: '灾厄', damage: 1.2, recovery: .8, bossHealth: 1.18, parry: .16 },
});
export const difficultyFor = id => DIFFICULTIES[id] || DIFFICULTIES.veteran;
export function canPerfectGuard({ blocking, guardStartedAt, now, consumed, unblockable, window }) {
  return blocking && !consumed && !unblockable && Number.isFinite(guardStartedAt)
    && now >= guardStartedAt && now - guardStartedAt <= window;
}
export function attackWeight(type, base, recent) {
  // Penalise the whole recent sequence, so a two-move loop is less likely.
  return base * Math.pow(.45, recent.slice(-3).filter(move => move === type).length);
}
