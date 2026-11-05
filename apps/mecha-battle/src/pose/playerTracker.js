// Camera-space boxes, before mirroring. Association is geometric, not face ID.
const clamp = v => Math.max(0, Math.min(1, v));
const area = b => b.width * b.height;
const center = b => ({x:b.x+b.width/2,y:b.y+b.height/2});
export function boxOverlap(a,b) {
  const intersection=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*
    Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  return intersection/(area(a)+area(b)-intersection||1);
}
export function personBoxes(result,width,height) {
  if (!(width>0&&height>0)) return [];
  return (result?.detections||[]).flatMap(d=>{
    const category=d.categories?.find(c=>c.categoryName==='person');
    const b=d.boundingBox;
    if(!category||category.score<.5||!b) return [];
    const x=clamp(b.originX/width),y=clamp(b.originY/height);
    const right=clamp((b.originX+b.width)/width),bottom=clamp((b.originY+b.height)/height);
    if(![x,y,right,bottom].every(Number.isFinite)||right-x<.06||bottom-y<.15)return [];
    return [{x,y,width:right-x,height:bottom-y,score:category.score}];
  });
}
export function cropForPerson(box,width,height) {
  const c=center(box);
  // Extra lateral room keeps extended arms inside the pose image.
  const pixels=Math.max(box.width*width*1.8,box.height*height*1.25);
  const w=Math.min(1,pixels/width),h=Math.min(1,pixels/height);
  return {x:Math.max(0,Math.min(1-w,c.x-w/2)),y:Math.max(0,Math.min(1-h,c.y-h/2)),width:w,height:h};
}
export function mapCropLandmarks(landmarks,crop) {
  return landmarks.map(p=>({...p,x:crop.x+p.x*crop.width,y:crop.y+p.y*crop.height,z:(p.z||0)*crop.width}));
}
function match(previous,boxes) {
  const p=center(previous);
  return boxes.map(b=>{
    const c=center(b),overlap=boxOverlap(previous,b);
    const distance=Math.hypot((c.x-p.x)/previous.width,(c.y-p.y)/previous.height);
    const ratio=area(b)/area(previous);
    return {b,score:overlap-distance*.2,valid:overlap>.18&&distance<.65&&ratio>.4&&ratio<2.5};
  }).filter(r=>r.valid).sort((a,b)=>b.score-a.score)[0]?.b;
}
export class PlayerTracker {
  constructor(){this.generation=0;this.reset();}
  reset(){this.box=null;this.candidate=null;this.phase='searching';this.lastSeen=-Infinity;this.people=[];}
  update(boxes,now){
    this.people=boxes;
    if(this.box){
      const next=match(this.box,boxes);
      if(next){
        // Time-based smoothing, so detector frame rate does not alter following.
        const alpha=1-Math.exp(-Math.max(1,now-this.lastSeen)/150);
        this.box=Object.fromEntries(['x','y','width','height','score'].map(k=>[k,this.box[k]+(next[k]-this.box[k])*alpha]));
        this.lastSeen=now;this.phase='tracked';return this.snapshot(now);
      }
      this.phase='lost';
      // Keep the original slot during brief occlusion. Never jump to a bystander.
      if(now-this.lastSeen<2000)return this.snapshot(now);
      this.box=null;this.candidate=null;
    }
    const candidate=this.candidate&&now-this.candidate.lastSeen<600?match(this.candidate.box,boxes):null;
    if(candidate){this.candidate.box=candidate;this.candidate.lastSeen=now;this.candidate.samples++;}
    else{
      const preferred=boxes.filter(b=>Math.abs(center(b).x-.5)<.25).sort((a,b)=>area(b)-area(a))[0];
      this.candidate=preferred?{box:preferred,since:now,lastSeen:now,samples:1}:null;
    }
    this.phase=this.candidate?'acquiring':'searching';
    if(this.candidate&&now-this.candidate.since>=350&&this.candidate.samples>=3){
      this.box={...this.candidate.box};this.lastSeen=now;this.phase='tracked';this.generation++;this.candidate=null;
    }
    return this.snapshot(now);
  }
  snapshot(now){
    const phase=this.box&&now-this.lastSeen>650?'lost':this.phase;
    return {phase,box:this.box||this.candidate?.box||null,people:this.people,personCount:this.people.length,generation:this.generation};
  }
}
