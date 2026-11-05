// Rescue state refers to real destructible buildings, never a parallel HP bar.
export class Evacuation {
  constructor(buildings) {
    const used = new Set();
    this.shelters = [[-68,-68],[68,-68],[68,68]].map(([x,z],i) => {
      const building = buildings.filter(b=>!b.destroyed && b.h>22 && !used.has(b))
        .sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];
      if(!building)return null;
      used.add(building);
      return {building,name:['西港','北站','东岸'][i],progress:0,status:'waiting'};
    }).filter(Boolean);
    this.required = 24;
    this.saved = 0;
    this.lost = 0;
    this.blocked = false;
  }
  get active(){return this.shelters.find(s=>s.status==='waiting');}
  step(dt,monster,targetedBuilding) {
    const events=[];
    for(const shelter of this.shelters)if(shelter.status==='waiting' && shelter.building.destroyed){
      shelter.status='lost';this.lost+=100;events.push({type:'lost',shelter});
    }
    const active=this.active;
    this.blocked=false;
    if(!active)return events;
    const b=active.building;
    this.blocked=targetedBuilding===b || Math.hypot(monster.x-b.x,monster.z-b.z)<42;
    if(!this.blocked)active.progress=Math.min(this.required,active.progress+dt);
    if(active.progress>=this.required){
      active.status='evacuated';this.saved+=100;events.push({type:'saved',shelter:active});
    }
    return events;
  }
  secure() {
    for(const shelter of this.shelters)if(shelter.status==='waiting'){
      if(shelter.building.destroyed){shelter.status='lost';this.lost+=100;}
      else {shelter.status='evacuated';this.saved+=100;}
    }
  }
}
