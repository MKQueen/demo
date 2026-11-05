import * as THREE from 'three';
export function installLoadout(mech) {
  const c = mech.config;
  const metal = new THREE.MeshStandardMaterial({ color: '#34454e', metalness: .8, roughness: .34 });
  const trim = new THREE.MeshStandardMaterial({ color: c.color, metalness: .6, roughness: .35, emissive: c.color, emissiveIntensity: .3 });
  mech.loadoutMounts = [];
  const addMount = (bone, side) => {
    const group = new THREE.Group(); group.name = `equipment-${c.id}-${side}`;
    mech.root.add(group); mech.loadoutMounts.push({ group, bone }); return group;
  };
  // The source chassis already has complete shoulder armor. The balanced refit
  // needs no floating decorative geometry over it.
  if (c.id === 'vanguard') { metal.dispose(); trim.dispose(); return; }
  for (const [side, bone] of [['left', 'upperarml'], ['right', 'upperarmr']]) {
    const group = addMount(bone, side), sign = side === 'left' ? -1 : 1;
    if (c.id === 'bastion') {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.4, 3.8), metal);
      armor.position.set(sign * .7, .8, 0); group.add(armor);
      for (let i = 0; i < 6; i++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, 2.8, 12), metal);
        tube.rotation.x = Math.PI / 2; tube.position.set(sign * .7 + (i % 3 - 1) * .9, 1.8 + Math.floor(i / 3) * .85, .1); group.add(tube);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, .08, 12), trim);
        cap.rotation.x = Math.PI / 2; cap.position.copy(tube.position); cap.position.z += 1.43; group.add(cap);
      }
    } else if (c.id === 'raptor') {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 3), metal);
      fin.position.set(sign * 1.1, .4, -.5); fin.rotation.z = -sign * .7; group.add(fin);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(.18, 3.7, .3), trim);
      strip.position.set(sign * 1.2, .6, .1); strip.rotation.z = -sign * .7; group.add(strip);
    }
  }
}
export function updateLoadout(mech) {
  mech.root.updateMatrixWorld(true);
  for (const { group, bone } of mech.loadoutMounts || []) {
    group.position.copy(mech.root.worldToLocal(mech.imported.bones[bone].getWorldPosition(new THREE.Vector3())));
    // Mount orientation is in chassis space, so shoulder tubes always point forward.
  }
}
