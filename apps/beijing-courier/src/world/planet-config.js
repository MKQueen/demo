// World-wide data: spawn points, NPC anchors, regions. Values extracted from
// the original site's `presentScene` / `createNPCS` configuration.

export const SPAWNS = [
  { position: [5.81095, 5.80205, 25.7794], rotation: Math.PI * 0.625, radius: 1.15 },
  { position: [13.9316, 19.3062, 8.38147], rotation: Math.PI * 0.55, radius: 1.15 },
];

// id, chinese name, model path, bone path, available clips, approximate location
export const NPCS = [
  {
    id: 'office-worker', kind: 'office-worker', name: '赶路的上班族', role: '午休中的职员',
    model: 'geometries/npcs/present/office-worker/office-worker-alt.drc',
    bones: 'geometries/npcs/present/office-worker/office-worker-bones.drc',
    clips: {
      idle: 'geometries/npcs/present/office-worker/office-worker-idle.drc',
      talk: 'geometries/npcs/present/office-worker/office-worker-talk.drc',
    },
    position: [27.9744, 1.40907, 0.538691], rotation: [0, 0, -1.547], region: 'village',
  },
  {
    id: 'office-worker-2', kind: 'office-worker', name: '写字楼主管', role: '正在午休',
    model: 'geometries/npcs/present/office-worker/office-worker.drc',
    bones: 'geometries/npcs/present/office-worker/office-worker-bones.drc',
    clips: {
      idle: 'geometries/npcs/present/office-worker/office-worker-idle.drc',
      talk: 'geometries/npcs/present/office-worker/office-worker-idle-talk.drc',
    },
    position: [26.2539, 9.70977, 1.39919], rotation: [0.061, -0.005, -1.214], region: 'city',
  },
  {
    id: 'chef', kind: 'chef', name: '面包店老板', role: '等着女儿回家',
    model: 'geometries/npcs/present/chef/chef.drc',
    bones: 'geometries/npcs/present/chef/chef-bones.drc',
    clips: { idle: 'geometries/npcs/present/chef/chef-idle.drc' },
    position: [20.3565, 19.1747, 2.20046], rotation: [1.116, 0.726, -1.18], region: 'village',
  },
  {
    id: 'flower-lady', kind: 'young-lady', name: '花店姑娘', role: '在等郁金香开花',
    model: 'geometries/npcs/present/young-lady/young-lady.drc',
    bones: 'geometries/npcs/present/young-lady/young-lady-bones.drc',
    clips: {
      idle: 'geometries/npcs/present/young-lady/young-lady-idle.drc',
      talk: 'geometries/npcs/present/young-lady/young-lady-talk.drc',
    },
    position: [27.4269, 4.65974, 3.58217], rotation: [4.954, -3.368, -4.643], region: 'village',
  },
  {
    id: 'oldwoman', kind: 'oldwoman', name: '巷口老奶奶', role: '收信的人',
    model: 'geometries/npcs/present/oldwoman/oldwoman.drc',
    bones: 'geometries/npcs/present/oldwoman/oldwoman-bones.drc',
    clips: { idle: 'geometries/npcs/present/oldwoman/oldwoman-idle.drc' },
    position: [23.3711, -16.514, 12.462], rotation: [1.754, -9.85, 1.09], region: 'countryside',
  },
  {
    id: 'musician', kind: 'musician', name: '街头乐手', role: '在等一首歌写完',
    model: 'geometries/npcs/present/musician/musician.drc',
    bones: 'geometries/npcs/present/musician/musician-bones.drc',
    clips: {
      idle: 'geometries/npcs/present/musician/musician-idle.drc',
      talk: 'geometries/npcs/present/musician/musician-talk.drc',
    },
    position: [15.0288, -14.7864, -7.09569], rotation: [-3.401, -10.128, 0.965], region: 'countryside',
  },
  {
    id: 'mountainman', kind: 'mountainman', name: '山顶大叔', role: '听风的人',
    model: 'geometries/npcs/present/mountainman/mountainman.drc',
    bones: 'geometries/npcs/present/mountainman/mountainman-bones.drc',
    clips: { idle: 'geometries/npcs/present/mountainman/mountainman-idle.drc' },
    position: [-8.17226, 32.3472, -1.76941], rotation: [0.385, -10.535, -0.557], region: 'mountain',
  },
  {
    id: 'diver', kind: 'diver', name: '船长', role: '在码头修船',
    model: 'geometries/npcs/present/diver/diver.drc',
    bones: 'geometries/npcs/present/diver/diver-bones.drc',
    clips: {
      idle: 'geometries/npcs/present/diver/diver-idle.drc',
      talk: 'geometries/npcs/present/diver/diver-talk.drc',
    },
    position: [15.8793, 16.9006, 11.2543], rotation: [0.472, -9.575, 0.642], region: 'harbor',
  },
  {
    id: 'scout', kind: 'scout', name: '放学的少年', role: '在等爸爸来接',
    model: 'geometries/npcs/present/scout/scout.drc',
    bones: 'geometries/npcs/present/scout/scout-bones.drc',
    clips: { idle: 'geometries/npcs/present/scout/scout-idle.drc' },
    position: [-8.91062, -21.1061, 0.906382], rotation: [1.088, 1.094, 2.086], region: 'countryside',
  },
  {
    id: 'fox', kind: 'fox', name: '小狐狸', role: '邮差的老朋友',
    model: 'geometries/npcs/present/fox/fox.drc',
    bones: 'geometries/npcs/present/fox/fox-bones.drc',
    clips: { idle: 'geometries/npcs/present/fox/fox-idle.drc' },
    position: [-8.36976, -20.368, 10.0339], rotation: [3.91, -13.902, 0.98], region: 'countryside',
  },
];

// Named anchor points used by quests / camera fly-through (approximate spots).
export const REGIONS = [
  { id: 'harbor', name: '海边码头', position: [15.8793, 16.9006, 11.2543] },
  { id: 'village', name: '春风村', position: [20.3565, 19.1747, 2.20046] },
  { id: 'city', name: '国贸街', position: [26.2539, 9.70977, 1.39919] },
  { id: 'countryside', name: '麦田与巷子', position: [-8.91062, -21.1061, 0.906382] },
  { id: 'mountain', name: '星背山顶', position: [-8.17226, 32.3472, -1.76941] },
];


// story spot id -> NPC anchor id (from src/game/story.js)
export const SPOT_TO_NPC = {
  spot_diver: 'diver',
  spot_chef: 'chef',
  spot_flowerlady: 'flower-lady',
  spot_worker: 'office-worker',
  spot_scout: 'scout',
  spot_oldwoman: 'oldwoman',
  spot_mountainman: 'mountainman',
  spot_musician: 'musician',
  spot_fox: 'fox',
};

// pickup spot id -> the NPC anchor whose vicinity the item waits at
export const PICKUP_TO_NPC = {
  pickup_letter: 'diver',
  pickup_postcard: 'flower-lady',
  pickup_note: 'office-worker',
  pickup_offering: 'oldwoman',
  pickup_record: 'chef',
};
