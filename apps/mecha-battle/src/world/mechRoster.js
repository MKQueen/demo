// These are equipment refits of the downloaded Jaeger chassis, not film assets.
export const MECH_ROSTER = [
  { id: 'vanguard', name: '先锋', serial: 'JAEGER / 01', role: '均衡突击型', color: '#63ddff', speed: 1, armor: 1, melee: 1, plasma: 1.15, missile: 1, blade: 1, description: '双臂等离子加速器 · 平衡机动与火力', equipment: '标准装甲 / 等离子增幅', stats: [72, 72, 78] },
  { id: 'bastion', name: '堡垒', serial: 'JAEGER / 02', role: '重装火力型', color: '#ffb456', speed: .8, armor: .78, melee: 1.2, plasma: .9, missile: 1.6, blade: .9, description: '双肩六联导弹舱 · 强化装甲与近战冲击', equipment: '重型肩甲 / 六联导弹舱', stats: [95, 48, 91] },
  { id: 'raptor', name: '游隼', serial: 'JAEGER / 03', role: '高速近战型', color: '#91ffbd', speed: 1.2, armor: 1.15, melee: .95, plasma: .9, missile: .8, blade: 1.4, description: '双侧光刃组件 · 高速走位与强化斩击', equipment: '轻装推进翼 / 双光刃', stats: [53, 96, 84] },
];
export const getMechConfig = id => MECH_ROSTER.find(m => m.id === id) || MECH_ROSTER[0];
