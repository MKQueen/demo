import { GestureAnalyzer, emptyState, LM } from './gesture.js';
import { PlayerTracker } from './playerTracker.js';

// Engine-independent boundary: detections/landmarks in; safe controls/events out.
export class MotionSession {
  constructor(){
    this.tracker=new PlayerTracker();this.analyzer=new GestureAnalyzer();
    this.generation=-1;this.events=[];this.sequence=0;this.lastPoseAt=-Infinity;
    this.lastGoodPoseAt=-Infinity;this.wasValid=false;this.state=emptyState();
  }
  tracking(now){return this.tracker.snapshot(now);}
  invalidate(now,reason='lost'){
    if(this.wasValid){this.analyzer.reset();this.wasValid=false;}
    this.events=[];this.analyzer.takeEvents();
    this.state={...emptyState(),tracking:{...this.tracking(now),phase:reason},controlReady:false};
    return this.state;
  }
  update(landmarks,world,now,video){
    const tracking=this.tracking(now);
    if(tracking.phase!=='tracked')return this.invalidate(now,tracking.phase);
    if(this.generation!==tracking.generation){
      this.analyzer.reset();this.events=[];this.generation=tracking.generation;
    }
    const finite=p=>p&&[p.x,p.y,p.z??0,p.visibility??1].every(Number.isFinite);
    const valid=landmarks?.length===33&&landmarks.every(finite)&&(!world?.length||(world.length===33&&world.every(finite)));
    if(!valid)return this.invalidate(now,'skeleton-lost');
    const shoulders=[landmarks[LM.L_SHOULDER],landmarks[LM.R_SHOULDER]];
    const hands=[landmarks[LM.L_WRIST],landmarks[LM.R_WRIST]];
    const box=tracking.box;
    const cx=(shoulders[0].x+shoulders[1].x)/2,cy=(shoulders[0].y+shoulders[1].y)/2;
    if(shoulders.some(p=>(p.visibility??0)<.35)||hands.some(p=>(p.visibility??0)<.12)||cx<box.x||cx>box.x+box.width||cy<box.y||cy>box.y+box.height){
      return this.invalidate(now,'skeleton-lost');
    }
    const state=this.analyzer.update(landmarks,world,now,video);
    if(!state.visible)return this.invalidate(now,'skeleton-lost');
    this.wasValid=true;this.lastPoseAt=now;this.lastGoodPoseAt=now;
    const ready=state.calibration>=1&&state.quality>=.35;
    const events=this.analyzer.takeEvents();
    if(ready)this.events.push(...events);
    else this.events=[];
    if(this.events.length>40)this.events.splice(0,this.events.length-40);
    this.state=ready?{...state,controlReady:true,tracking:{...tracking,phase:'active'}}:
      {...emptyState(),quality:state.quality,calibration:state.calibration,fullBody:state.fullBody,
        upperBody:state.upperBody,skeletonVisible:true,controlReady:false,tracking:{...tracking,phase:'calibrating'}};
    return this.state;
  }
  watchdog(now){
    if(now-this.lastGoodPoseAt>500||this.tracking(now).phase!=='tracked'){
      const phase=this.tracking(now).phase;
      return this.invalidate(now,phase==='tracked'?'stale':phase);
    }
    return this.state;
  }
  takeEvents(now){this.watchdog(now);const events=this.events;this.events=[];return events.filter(e=>now-e.at*1000<200);}
  reset(now){this.tracker.reset();this.analyzer.reset();this.wasValid=false;return this.invalidate(now,'searching');}
  frame(now){
    const state=this.watchdog(now);
    return {version:1,sequence:++this.sequence,timestampMs:now,playerId:this.tracking(now).generation,
      tracking:state.tracking?.phase||'searching',controlReady:state.controlReady===true,
      quality:state.quality,calibration:state.calibration,
      controls:{move:state.move,strafe:state.strafe,lean:state.lean,speed:state.speed,blocking:state.blocking,running:state.running},
      body:{leftArm:{...state.arms.left},rightArm:{...state.arms.right},shoulderTilt:state.shoulderTilt,headX:state.headX},
      events:this.takeEvents(now)};
  }
}
