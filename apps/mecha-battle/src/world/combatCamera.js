import * as THREE from 'three';
const UP = new THREE.Vector3(0, 1, 0);

// Frame actual upright bounds instead of giant bounding spheres. A lower eye
// keeps buildings behind the actors and the horizon near their shoulders.
export function combatFrame(player, monster, aspect, fov = 54) {
  const heading = new THREE.Vector3(monster.x-player.x, 0, monster.z-player.z);
  if (heading.lengthSq() < .001) heading.set(0,0,-1);
  heading.normalize();
  const side = heading.clone().cross(UP).normalize();
  const eyeAxis = heading.clone().multiplyScalar(-1).addScaledVector(side,.7).setY(.24).normalize();
  const right = UP.clone().cross(eyeAxis).normalize();
  const up = eyeAxis.clone().cross(right).normalize();
  const target = player.clone().lerp(monster,.46).add(new THREE.Vector3(0,12,0));
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov/2));
  const tanH = tanV*Math.max(.4,aspect);
  let distance=36;
  for(const [root,width,height] of [[player,8,23],[monster,11,30]]){
    for(const x of [-width,width])for(const z of [-width,width])for(const y of [0,height]){
      const offset=root.clone().add(new THREE.Vector3(x,y,z)).sub(target);
      distance=Math.max(distance,offset.dot(eyeAxis)+Math.abs(offset.dot(right))/(tanH*.86),
        offset.dot(eyeAxis)+Math.abs(offset.dot(up))/(tanV*.78));
    }
  }
  return {target,position:target.clone().addScaledVector(eyeAxis,distance),fov};
}
