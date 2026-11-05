import { canvasTexture } from '../utils.js';
import { assetUrl } from '../assetPaths.js';
import * as THREE from 'three';

// Poly Haven CC0 scans, hosted locally. Cache source textures across scene reloads.
const maps = new Map();
function texture(file, color = false) {
  if (!maps.has(file)) {
    const map = new THREE.TextureLoader().load(assetUrl('textures/polyhaven/' + file));
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4; map.userData.shared = true;
    if (color) map.colorSpace = THREE.SRGBColorSpace;
    maps.set(file, map);
  }
  return maps.get(file);
}
export function concreteMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, map: texture('concrete-neutral.jpg',true), normalMap: texture('concrete-normal.jpg'), normalScale: new THREE.Vector2(.3,.3), roughness:.88, metalness:.04 });
}
export function asphaltMaterial() {
  // Repeat is constant and source maps are dedicated to the ground plane.
  const map=texture('asphalt-diff.jpg',true), normalMap=texture('asphalt-normal.jpg');
  map.repeat.set(125,125);normalMap.repeat.set(125,125);
  return new THREE.MeshStandardMaterial({color:'#9aa6ae',map,normalMap,normalScale:new THREE.Vector2(.45,.45),roughness:.94,metalness:.02});
}
export function scaleBuildingUV(geometry,w,h,d) {
  const uv=geometry.attributes.uv;
  for(let i=0;i<uv.count;i++){
    const face=Math.floor(i/4);
    const width=face<2?d:w, height=face===2||face===3?d:h;
    uv.setXY(i,uv.getX(i)*width/6,uv.getY(i)*height/6);
  }
  uv.needsUpdate=true;
}

let windowMap;
export function windowMaterial() {
  if(!windowMap){
    windowMap=canvasTexture(256,256,(ctx,w,h)=>{
      ctx.fillStyle='#68747a';ctx.fillRect(0,0,w,h);
      const glass=ctx.createLinearGradient(0,8,0,h-8);
      glass.addColorStop(0,'#f0f7fa');glass.addColorStop(.25,'#d4e2e9');
      glass.addColorStop(.65,'#afc3cf');glass.addColorStop(1,'#8b9fa9');
      ctx.fillStyle=glass;ctx.fillRect(8,8,w-16,h-16);
      // Subtle interior blind slats, recessed edge and a thin aluminium sill.
      ctx.fillStyle='rgba(18,27,34,.12)';
      for(let y=38;y<h-12;y+=14)ctx.fillRect(11,y,w-22,2);
      ctx.fillStyle='rgba(240,249,255,.25)';ctx.fillRect(9,9,w-18,3);
      ctx.fillStyle='rgba(9,16,20,.25)';ctx.fillRect(8,8,3,h-16);ctx.fillRect(8,h-12,w-16,4);
      ctx.fillStyle='#808d91';ctx.fillRect(4,h-7,w-8,4);
    });
    windowMap.userData.shared=true;
  }
  return new THREE.MeshStandardMaterial({map:windowMap,color:'#ffffff',roughness:.27,metalness:.15,envMapIntensity:1.1});
}
