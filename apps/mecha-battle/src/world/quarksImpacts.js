import * as THREE from 'three';
import { assetUrl } from '../assetPaths.js';
import {
  BatchedRenderer, ParticleSystem, ConstantValue, IntervalValue, ConstantColor,
  ConeEmitter, RenderMode, ApplyForce, ColorOverLife, Gradient, SizeOverLife,
  PiecewiseBezier, Bezier,
} from 'three.quarks';

const FORWARD=new THREE.Vector3(0,0,1);
const RECIPES={
  metal:{streaks:28,chips:12,color:[1,.55,.16],dust:[.48,.47,.43]},
  carapace:{streaks:7,chips:24,color:[.23,.52,.48],dust:[.35,.46,.43]},
  concrete:{streaks:4,chips:24,color:[.53,.48,.39],dust:[.56,.52,.45]},
};

// Three shared batches, bounded reusable emitters, local CC0 artwork. This is
// an authored contact effect, not a replacement for every skill's presentation.
export class QuarksImpacts {
  constructor(parent) {
    this.renderer=new BatchedRenderer();this.renderer.name='quarks-contact-vfx';
    parent.add(this.renderer);this.parent=parent;this.cursor=0;
    const loader=new THREE.TextureLoader();
    this.sparkTexture=loader.load(assetUrl('textures/kenney-particles/spark_05.png'));
    this.smokeTexture=loader.load(assetUrl('textures/kenney-particles/smoke_05.png'));
    for(const texture of [this.sparkTexture,this.smokeTexture])texture.colorSpace=THREE.SRGBColorSpace;
    this.sparkMaterial=new THREE.MeshBasicMaterial({map:this.sparkTexture,transparent:true,
      depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    this.smokeMaterial=new THREE.MeshBasicMaterial({map:this.smokeTexture,transparent:true,
      depthWrite:false,blending:THREE.NormalBlending});
    this.chipMaterial=new THREE.MeshStandardMaterial({roughness:.95,metalness:.05});
    this.chipGeometry=new THREE.TetrahedronGeometry(1,0);
    this.slots=Array.from({length:10},()=>({
      streaks:this.create('streaks'),chips:this.create('chips'),dust:this.create('dust'),life:0,
    }));
  }

  create(kind) {
    const dust=kind==='dust',chip=kind==='chips';
    const alpha=new Gradient(undefined,dust?[[0,0],[.32,.12],[0,1]]:[[1,0],[.8,.35],[0,1]]);
    const system=new ParticleSystem({
      autoDestroy:false,looping:false,duration:.08,worldSpace:true,
      startLife:new IntervalValue(dust?.42:.15,dust?.85:chip?.55:.38),
      startSpeed:new IntervalValue(dust?1.5:chip?5:12,dust?3:chip?11:25),
      startSize:new IntervalValue(dust?.85:chip?.12:.11,dust?1.5:chip?.28:.22),
      startRotation:new IntervalValue(0,Math.PI*2),
      startColor:new ConstantColor(new THREE.Vector4(1,1,1,1)),
      emissionOverTime:new ConstantValue(0),
      emissionBursts:[{time:0,count:new ConstantValue(dust?7:20),cycle:1,interval:0,probability:1}],
      shape:new ConeEmitter({radius:.16,angle:dust?.85:chip?1.1:.75}),
      renderMode:chip?RenderMode.Mesh:dust?RenderMode.BillBoard:RenderMode.StretchedBillBoard,
      material:chip?this.chipMaterial:dust?this.smokeMaterial:this.sparkMaterial,
      ...(chip?{instancingGeometry:this.chipGeometry}:{}),
      speedFactor:.075,
      behaviors:[new ApplyForce(new THREE.Vector3(0,1,0),new ConstantValue(dust?1:-20)),
        new ColorOverLife(alpha),new SizeOverLife(new PiecewiseBezier([[new Bezier(1,dust?1.8:1,dust?2.4:.65,dust?3:.05),0]]))],
    });
    this.parent.add(system.emitter);this.renderer.addSystem(system);system.stop();
    return system;
  }

  emit(position,{normal,heavy=false,surface='metal'}={}) {
    const slot=this.slots.find(s=>s.life<=0)||this.slots[this.cursor++%this.slots.length];
    const recipe=RECIPES[surface]||RECIPES.metal;
    const direction=normal?.clone()||new THREE.Vector3(0,1,0);
    if(direction.lengthSq()<.001)direction.set(0,1,0);
    direction.normalize();
    for(const kind of ['streaks','chips','dust']) {
      const system=slot[kind],dust=kind==='dust';
      const color=dust?recipe.dust:kind==='streaks'?(surface==='carapace'?[.65,1.5,1.3]:[3.2,1.7,.45]):recipe.color;
      system.startColor=new ConstantColor(new THREE.Vector4(...color,1));
      system.emissionBursts[0].count=new ConstantValue(Math.round((dust?7:recipe[kind])*(heavy?1.5:1)));
      system.emitter.position.copy(position);
      system.emitter.quaternion.setFromUnitVectors(FORWARD,dust?new THREE.Vector3(0,1,0):direction);
      system.emitter.scale.setScalar(heavy?1.3:1);
      system.emitter.updateWorldMatrix(true,false);
      system.restart();
    }
    slot.life=1.2;
  }

  update(dt) {
    if(!(dt>0))return;
    this.renderer.update(Math.min(dt,.1));
    for(const slot of this.slots)if(slot.life>0){
      slot.life=Math.max(0,slot.life-dt);
      if(slot.life===0)for(const key of ['streaks','chips','dust'])slot[key].stop();
    }
  }

  clear() {
    for(const slot of this.slots){slot.life=0;for(const key of ['streaks','chips','dust'])slot[key].stop();}
    this.renderer.update(0);
  }

  dispose() {
    this.clear();
    for(const slot of this.slots)for(const key of ['streaks','chips','dust'])slot[key].dispose();
    for(const batch of this.renderer.batches)batch.dispose();
    this.renderer.removeFromParent();
    for(const resource of [this.sparkMaterial,this.smokeMaterial,this.chipMaterial,this.chipGeometry,this.sparkTexture,this.smokeTexture])resource.dispose();
  }
}
