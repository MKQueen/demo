import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from '../assetPaths.js';

let source;
export async function preloadUrbanTrees() {
  source = (await new GLTFLoader().loadAsync(assetUrl('models/environment/tree.glb'))).scene;
  source.updateMatrixWorld(true);
  source.traverse(o => {
    if (!o.isMesh) return;
    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
      for (const value of Object.values(mat)) if (value?.isTexture) value.userData.shared = true;
    }
  });
}

// One draw per source primitive, irrespective of the number of street trees.
export class UrbanTrees {
  constructor(parent, placements) {
    this.placements=placements.map(p=>({...p,broken:false}));
    this.meshes=[];
    const bounds=new THREE.Box3().setFromObject(source), size=bounds.getSize(new THREE.Vector3());
    this.sourceHeight=size.y;
    const center=bounds.getCenter(new THREE.Vector3());
    const normalize=new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z);
    const temp=new THREE.Object3D();
    source.traverse(o=>{
      if(!o.isMesh)return;
      const geometry=o.geometry.clone();geometry.applyMatrix4(normalize.clone().multiply(o.matrixWorld));
      const materials=(Array.isArray(o.material)?o.material:[o.material]).map(original=>{
        const m=original.clone();m.roughness=.9;m.envMapIntensity=.3;
        if(m.transparent){m.transparent=false;m.alphaTest=.42;m.depthWrite=true;m.side=THREE.DoubleSide;}
        return m;
      });
      const mesh=new THREE.InstancedMesh(geometry,Array.isArray(o.material)?materials:materials[0],placements.length);
      mesh.name='CC0 street trees';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for(let i=0;i<placements.length;i++){
        const p=placements[i];temp.position.set(p.x,p.y||.3,p.z);temp.rotation.set(0,p.yaw,0);temp.scale.setScalar(p.height/size.y);temp.updateMatrix();mesh.setMatrixAt(i,temp.matrix);
      }
      parent.add(mesh);this.meshes.push(mesh);
    });
  }
  crush(position,radius) {
    if(position.y>5)return;
    for(const p of this.placements){
      if(p.broken||Math.hypot(p.x-position.x,p.z-position.z)>radius+1)continue;
      p.broken=true;p.fallT=0;p.fallYaw=Math.atan2(p.x-position.x,p.z-position.z);
    }
  }
  update(dt) {
    const temp=new THREE.Object3D();
    for(let i=0;i<this.placements.length;i++){
      const p=this.placements[i];if(!p.broken||p.fallT>=1)continue;
      p.fallT=Math.min(1,p.fallT+dt/1.1);const k=p.fallT*p.fallT;
      temp.position.set(p.x,.3,p.z);temp.rotation.set(Math.PI*.49*k,p.fallYaw,0);temp.scale.setScalar(p.height/this.sourceHeight);temp.updateMatrix();
      for(const mesh of this.meshes){mesh.setMatrixAt(i,temp.matrix);mesh.instanceMatrix.addUpdateRange(i*16,16);mesh.instanceMatrix.needsUpdate=true;}
    }
  }
}
