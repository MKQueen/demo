// Sweep in short steps so jets, lunges and knockback cannot skip a facade.
// Radius is a horizontal body approximation; an actor above the roof can pass.
export function moveAgainstBuildings(from, to, buildings, radius, onContact = () => {}) {
  const contacts = new Set();
  const distance = Math.hypot(to.x-from.x,to.z-from.z);
  const steps = Math.max(1,Math.ceil(distance/Math.max(.5,radius*.4)));
  const dx=(to.x-from.x)/steps,dz=(to.z-from.z)/steps;
  const result={x:from.x,y:to.y,z:from.z};
  for(let step=0;step<steps;step++) {
    result.x+=dx;result.z+=dz;
    const altitude=Math.min(from.y,to.y);
    for(let pass=0;pass<3;pass++)for(const b of buildings) {
      if(b.destroyed || b.h+.26<=altitude)continue;
      const x=Math.max(b.x-b.w/2,Math.min(b.x+b.w/2,result.x));
      const z=Math.max(b.z-b.d/2,Math.min(b.z+b.d/2,result.z));
      const ox=result.x-x,oz=result.z-z,len=Math.hypot(ox,oz);
      if(len>=radius)continue;
      if(!contacts.has(b)){contacts.add(b);onContact(b,{x,y:Math.min(b.h,altitude+8),z});}
      if(b.destroyed)continue;
      if(len>1e-7){result.x+=ox/len*(radius-len);result.z+=oz/len*(radius-len);}
      else {
        const edges=[{axis:'x',value:b.x-b.w/2-radius},{axis:'x',value:b.x+b.w/2+radius},
          {axis:'z',value:b.z-b.d/2-radius},{axis:'z',value:b.z+b.d/2+radius}];
        edges.sort((a,b)=>Math.abs(result[a.axis]-a.value)-Math.abs(result[b.axis]-b.value));
        result[edges[0].axis]=edges[0].value;
      }
    }
  }
  return {position:result,contacts:[...contacts]};
}
