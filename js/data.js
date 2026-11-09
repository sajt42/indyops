/* IndyOps – Aggregated stock and blueprint views, market prices, ore reprocessing. */
"use strict";
/* ============ összesített nézetek ============ */
function allLocs(){const m=new Map();for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const a of d.assets)m.set(a.l,true);for(const b of d.bps)m.set(b.l,true)}return [...m.keys()]}
function locName(l){if(LOCINFO[l]&&LOCINFO[l].name){const n=LOCINFO[l].name;if(n.startsWith('Ismeretlen hely #'))return T('Ismeretlen hely #{0}',n.slice(17));return n.endsWith(' (űrben)')?n.slice(0,-8)+' '+T('(űrben)'):n}if(l===JITA_STATION)return 'Jita IV - Moon 4 - Caldari Navy Assembly Plant';return '#'+l}
function charName(id){const c=CHARS.find(x=>x.id==id);return c?c.name:'#'+id}
function planLocs(){return S.locs?new Set(S.locs.map(Number)):new Set(allLocs())}
function allBPs(){const out=[];for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const b of d.bps)out.push(Object.assign({cid:Number(cid)},b))}return out}
function inJob(itemId){for(const d of Object.values(DATA))for(const j of d.jobs)if(j.bpi===itemId&&j.st==='active')return j;return null}
// készlet: typeId -> [{l,cid,q}]
function stockMap(onlyPlan){
  const allow=onlyPlan?planLocs():null;const m=new Map();
  for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;
    for(const a of d.assets){if(allow&&!allow.has(a.l))continue;if(a.f&&/Slot\d|SubSystemSlot|FighterTube/.test(a.f))continue;
      let arr=m.get(a.t);if(!arr){arr=[];m.set(a.t,arr)}const ex=arr.find(x=>x.l===a.l&&x.cid==cid);if(ex)ex.q+=a.q;else arr.push({l:a.l,cid:Number(cid),q:a.q})}}
  return m;
}
function skillsOf(){const c=S.skillChar!=null&&DATA[S.skillChar]?DATA[S.skillChar]:Object.values(DATA)[0];return c?c.skills:{}}
const lvl=id=>skillsOf()[id]||0;
const lvlOf=(cid,id)=>((DATA[cid]&&DATA[cid].skills)||{})[id]||0;
function missingSkills(cid,rec){return Object.entries((rec&&rec.rs)||{}).filter(([sk,l])=>lvlOf(cid,sk)<l).map(([sk,l])=>[Number(sk),l,lvlOf(cid,sk)])}
function recOf(bpType){const b=REFC.b[bpType];if(!b)return null;return b.m||b.r}
function slotsOf(cid){return {m:1+lvlOf(cid,SK.massProd)+lvlOf(cid,SK.advMassProd),r:1+lvlOf(cid,SK.massReac)+lvlOf(cid,SK.advMassReac),s:1+lvlOf(cid,SK.labOp)+lvlOf(cid,SK.advLabOp)}}
function busyOf(cid){const d=DATA[cid];const o={m:0,r:0,s:0};if(!d)return o;for(const j of d.jobs){if(j.st!=='active')continue;if(j.act===1)o.m++;else if(j.act===9||j.act===11)o.r++;else if([3,4,5,7,8].includes(j.act))o.s++}return o}
function salesTax(){return S.salesTax!==''&&S.salesTax!=null?Number(S.salesTax)/100:0.075*(1-0.11*lvl(SK.accounting))}
function brokerFee(){return S.broker!==''&&S.broker!=null?Number(S.broker)/100:Math.max(0.01,0.03-0.003*lvl(SK.broker))}

/* ============ árak ============ */
async function ensurePrices(typeIds){
  const now=Date.now();const need=[...new Set(typeIds)].filter(t=>!PRICES.p[t]||now-PRICES.p[t].at>30*60000);
  status('árak: '+need.length+' tétel…');
  await Promise.all(need.map(async t=>{
    try{const o=await esi('/markets/'+JITA_REGION+'/orders/?type_id='+t+'&order_type=all',{paged:true});
      let s=Infinity,b=0;for(const x of o){if(x.location_id!==JITA_STATION)continue;if(x.is_buy_order){if(x.price>b)b=x.price}else if(x.price<s)s=x.price}
      PRICES.p[t]={s:s===Infinity?null:s,b:b||null,at:now};
    }catch(e){PRICES.p[t]={s:null,b:null,at:now};log('Ár hiba '+t)}
  }));
  store('prices',PRICES);
  if(now-ADJ.at>6*3600000){try{const a=await esi('/markets/prices/');ADJ={at:now,p:{}};a.forEach(x=>ADJ.p[x.type_id]=x.adjusted_price||x.average_price||0);store('adj',ADJ)}catch(e){log('Adjusted ár hiba')}}
  if(now-IDX.at>3*3600000){try{const a=await esi('/industry/systems/');IDX={at:now,p:{}};a.forEach(x=>{const o={};x.cost_indices.forEach(y=>o[y.activity]=y.cost_index);IDX.p[x.solar_system_id]=o});store('idx2',IDX)}catch(e){log('Cost index hiba')}}
  status('kész');
}
const sell=t=>PRICES.p[t]&&PRICES.p[t].s, buy=t=>PRICES.p[t]&&PRICES.p[t].b;
const unitPrice=t=>sell(t)??buy(t)??0;

/* ============ ércek ============ */
async function ensureOres(){
  if(ORES&&ORES.length) return ORES;
  status('érctípusok…');const ids=[];
  try{const cat=await esi('/universe/categories/25/');for(const g of cat.groups){try{const gr=await esi('/universe/groups/'+g+'/');ids.push(...gr.types)}catch(e){}}}catch(e){log('Érclista hiba: '+e.message)}
  ORES=ids;store('ores',ORES);status('kész');return ORES;
}
function oreYieldFor(cid,rsSkill){
  return (Number(S.yieldBase)/100)*(1+0.03*lvlOf(cid,SK.repro))*(1+0.02*lvlOf(cid,SK.reproEff))*(1+0.02*(rsSkill?lvlOf(cid,rsSkill):0))*(1+Number(S.implant||0)/100);
}
function bestRepro(rsSkill){ // melyik karakter reprocesszálja ezt a fajtát a legjobb hozammal
  let who=null,y=-1;for(const c of CHARS){if(!DATA[c.id])continue;const v=oreYieldFor(c.id,rsSkill);if(v>y){y=v;who=c.id}}
  if(who==null)return {who:null,y:(Number(S.yieldBase)/100)*(1+Number(S.implant||0)/100)};return {who,y};
}
function oreYield(rsSkill){return bestRepro(rsSkill).y}
async function oreToMinerals(typeId,units,cid){
  const t=await refGet('t',typeId);if(!t||!t.tm.length)return [];
  const b=cid!=null?{who:cid,y:oreYieldFor(cid,t.rs)}:bestRepro(t.rs);const portions=Math.floor(units/(t.p||1));
  const out=t.tm.map(([m,q])=>[m,Math.floor(portions*q*b.y)]);out.who=b.who;out.y=b.y;out.rs=t.rs;return out;
}
