export const CONFIG = {
  // planet radius is derived from geometry bounds at runtime (≈36.6)
  CAMERA_FOV: 42,
  PLAYER_HEIGHT: 1.64,
  // gameplay outline / sky palette mirrored from the reference site
  SKY: {
    color1: '#75bdc3',
    color2: '#9fe2e0',
    color3: '#b9ebea',
  },
  SUN: {
    color: '#fff2dc',
    intensity: 3.1,
    // direction in planet space (points from surface towards sun)
    direction: [-0.55, 0.78, 0.32],
  },
  FOG: {
    near: '#93a2bf',
    far: '#9ea7b8',
    distance: 0.8,
    density: 0.011,
  },
  STORAGE_KEY: 'beijing-courier-v2',
};
