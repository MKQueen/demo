export const DEFAULT_SETTINGS = Object.freeze({ difficulty:'veteran', quality:'auto', comfort:false, volume:.8, music:.5 });
export function normaliseSettings(value={}) {
  if(!value || typeof value!=='object')value={};
  const number=(v,f)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):f;
  return {difficulty:['recruit','veteran','nightmare'].includes(value.difficulty)?value.difficulty:'veteran',
    quality:['auto','high','balanced','low'].includes(value.quality)?value.quality:'auto',
    comfort:value.comfort===true,volume:number(value.volume,.8),music:number(value.music,.5)};
}
export function readSettings(storage) {
  try{return normaliseSettings(JSON.parse(storage.getItem('steel-settings')));}catch{return {...DEFAULT_SETTINGS};}
}
export function writeSettings(storage,value){try{storage.setItem('steel-settings',JSON.stringify(normaliseSettings(value)));return true;}catch{return false;}}
export function recordBattle(storage,stats,win) {
  const score=win?Math.max(0,Math.round(stats.saved*10+stats.city*10+stats.parries*100+2000-stats.time*5-stats.hits*40)):0;
  const report={...stats,win,score,date:new Date().toISOString()};
  try{
    let history=JSON.parse(storage.getItem('steel-battles')||'[]');
    if(!Array.isArray(history))history=[];
    const valid=history.filter(r=>r&&Number.isFinite(r.score));
    let records=JSON.parse(storage.getItem('steel-records')||'{}');
    if(!records || Array.isArray(records) || typeof records!=='object')records={};
    const previous=Number.isFinite(records[stats.difficulty])?records[stats.difficulty]:0;
    const best=Math.max(previous,0,...valid.filter(r=>r.difficulty===stats.difficulty).map(r=>r.score));
    records[stats.difficulty]=Math.max(best,score);
    storage.setItem('steel-records',JSON.stringify(records));
    storage.setItem('steel-battles',JSON.stringify([report,...valid].slice(0,20)));
    return {score,best:Math.max(score,best),isBest:win&&score>best,saved:true};
  }catch{return {score,best:score,isBest:false,saved:false};}
}
