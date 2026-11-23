/**
 * terrain.js —— 一张纸。
 *
 * 整个北京不是「岛屿」，而是画在宣纸上的一片山河：地面就是纸本身。
 * 这里只做三件事：
 *   1. 一张足够大的纸面（比可视范围更大，边缘交给雾和纸色化掉）；
 *   2. 叠一层很淡的墨晕，让平原不至于是死白；
 *   3. 沿中轴与城外撒几块留白，给后面的城、湖留呼吸。
 *
 * 山体不在这里，由 world/nature.js 用 layout.terrainHeight() 生成。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { GROUND_Y } from '../layout.js';
import { u } from '../lib/units.js';

export function buildTerrain(ctx) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const { tex } = ctx;

  // —— 纸面 ——
  const paperTex = tex.paper.clone();
  paperTex.needsUpdate = true;
  paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;
  paperTex.repeat.set(14, 16);
  paperTex.colorSpace = THREE.SRGBColorSpace;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(u(64000), u(72000)),
    new THREE.MeshBasicMaterial({ map: paperTex, color: 0xffffff, toneMapped: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, GROUND_Y - 0.02, -u(6000));
  ground.receiveShadow = true;
  group.add(ground);

  // —— 大块墨晕：让平原上有浓淡，不是一块死纸 ——
  const washTex = tex.wash.clone();
  washTex.needsUpdate = true;
  washTex.wrapS = washTex.wrapT = THREE.RepeatWrapping;
  washTex.repeat.set(6, 7);
  const wash = new THREE.Mesh(
    new THREE.PlaneGeometry(u(52000), u(60000)),
    new THREE.MeshBasicMaterial({
      map: washTex,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  wash.rotation.x = -Math.PI / 2;
  wash.position.set(0, GROUND_Y - 0.01, -u(6000));
  group.add(wash);

  // —— 城下的一圈纸色「托底」：把城市从平原里提出来 ——
  const plate = new THREE.Mesh(
    new THREE.CircleGeometry(u(9000), 64),
    new THREE.MeshBasicMaterial({ color: 0xf6efe0, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }),
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.set(0, GROUND_Y + 0.001, u(1500));
  group.add(plate);

  group.userData.ground = ground;
  return group;
}
