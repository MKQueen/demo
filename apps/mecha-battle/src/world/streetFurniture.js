import * as THREE from 'three';

const up=new THREE.Vector3(0,1,0);
// Fixed instance count. Broken props remain as fallen street debris; no emitter
// or rigid body is created per collision, and settled props stop updating.
export class StreetFurniture {
  constructor(parent,placements) {
    this.items=placements.map(p=>({...p,broken:false,time:0}));
    this.meshes=[];this.temp=new THREE.Object3D();this.bounds={};
    this.scratchBounds=new THREE.Box3();
    const metal=new THREE.MeshStandardMaterial({color:'#424a4b',metalness:.72,roughness:.55});
    const timber=new THREE.MeshStandardMaterial({color:'#64574b',metalness:.02,roughness:.93});
    const concrete=new THREE.MeshStandardMaterial({color:'#a09b8b',metalness:.02,roughness:.95});
    const lamp=new THREE.MeshStandardMaterial({color:'#e6e3d2',metalness:.1,roughness:.45});
    const unit=(w,h,d,x,y,z)=>({geometry:new THREE.BoxGeometry(w,h,d).translate(x,y,z)});
    const parts={
      bench:[{...unit(2.2,.14,.65,0,.73,0),material:timber},{...unit(2.2,.48,.1,0,1.05,-.28),material:timber},
        {...unit(.14,.7,.55,-.83,.35,0),material:metal},{...unit(.14,.7,.55,.83,.35,0),material:metal}],
      lamp:[{geometry:new THREE.CylinderGeometry(.075,.13,6.8,6).translate(0,3.4,0),material:metal},
        {...unit(1.8,.12,.14,.85,6.65,0),material:metal},{...unit(.65,.12,.35,1.55,6.58,0),material:lamp}],
      barrier:[{...unit(3.4,.65,.55,0,.42,0),material:concrete},{...unit(2.5,.12,.6,0,.8,0),material:metal}],
    };
    // One draw per primitive type rather than one draw per furniture object.
    for(const [kind,recipes]of Object.entries(parts)) {
      this.bounds[kind]=new THREE.Box3();
      for(const recipe of recipes){recipe.geometry.computeBoundingBox();this.bounds[kind].union(recipe.geometry.boundingBox);}
      const ids=this.items.map((p,i)=>p.kind===kind?i:-1).filter(i=>i>=0);
      for(const recipe of recipes) {
        const mesh=new THREE.InstancedMesh(recipe.geometry,recipe.material,ids.length);
        mesh.name='breakable-street-'+kind;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(mesh);
        this.meshes.push({mesh,ids});
      }
    }
    this.writeAll();
  }
  matrix(item) {
    const object=this.temp;
    object.position.set(item.x,.12,item.z);object.scale.setScalar(1);
    object.quaternion.setFromAxisAngle(up,item.yaw||0);
    if(item.broken) {
      const t=Math.min(1,item.time/ .75),fall=t*t*(3-2*t);
      const axis=new THREE.Vector3(item.dz,0,-item.dx).normalize();
      object.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,fall*Math.PI*.49));
      object.position.x+=item.dx*fall*.7;object.position.z+=item.dz*fall*.7;
      object.position.y=.15+Math.sin(t*Math.PI)*.3;
    }
    object.updateMatrix();
    if(item.broken){
      this.scratchBounds.copy(this.bounds[item.kind]).applyMatrix4(object.matrix);
      object.position.y+=Math.max(0,.08-this.scratchBounds.min.y);object.updateMatrix();
    }
    return object.matrix;
  }
  writeAll() {
    for(const {mesh,ids}of this.meshes){ids.forEach((id,i)=>mesh.setMatrixAt(i,this.matrix(this.items[id])));mesh.instanceMatrix.needsUpdate=true;}
  }
  sweep(from,to,radius,onBreak) {
    const vx=to.x-from.x,vz=to.z-from.z,len=vx*vx+vz*vz;
    let count=0;
    for(const p of this.items) {
      if(p.broken)continue;
      const t=len>1e-8?THREE.MathUtils.clamp(((p.x-from.x)*vx+(p.z-from.z)*vz)/len,0,1):0;
      const height=THREE.MathUtils.lerp(from.y,to.y,t);
      if(height>(p.kind==='lamp'?6.8:1.2)+radius*.25)continue;
      if(Math.hypot(p.x-from.x-t*vx,p.z-from.z-t*vz)>radius+(p.kind==='lamp'?.3:1.2))continue;
      let dx=vx,dz=vz;
      if(len<.01){dx=p.x-from.x;dz=p.z-from.z;}
      const d=Math.hypot(dx,dz)||1;p.dx=dx/d;p.dz=dz/d;
      if(Math.abs(p.dx)+Math.abs(p.dz)<.01)p.dz=1;
      p.broken=true;p.time=0;count++;onBreak?.(p);
    }
    return count;
  }
  update(dt) {
    if(!(dt>0))return;
    const changed=new Set();
    this.items.forEach((p,i)=>{if(p.broken&&p.time<.75){p.time=Math.min(.75,p.time+dt);changed.add(i);}});
    if(!changed.size)return;
    for(const {mesh,ids}of this.meshes) {
      let dirty=false;
      ids.forEach((id,i)=>{if(changed.has(id)){mesh.setMatrixAt(i,this.matrix(this.items[id]));mesh.instanceMatrix.addUpdateRange(i*16,16);dirty=true;}});
      if(dirty)mesh.instanceMatrix.needsUpdate=true;
    }
  }
}
