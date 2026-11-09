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
// eladási díjak karakterenként (a Beállításokban megadott érték mindenkire felülírja)
function salesTaxOf(cid){return S.salesTax!==''&&S.salesTax!=null?Number(S.salesTax)/100:0.075*(1-0.11*lvlOf(cid,SK.accounting))}
function brokerFeeOf(cid){return S.broker!==''&&S.broker!=null?Number(S.broker)/100:Math.max(0.01,0.03-0.003*lvlOf(cid,SK.broker))}
function sellers(){return CHARS.filter(c=>DATA[c.id]).map(c=>({cid:c.id,tax:salesTaxOf(c.id),broker:brokerFeeOf(c.id)})).map(x=>Object.assign(x,{fee:x.tax+x.broker})).sort((a,b)=>a.fee-b.fee)}
function bestSeller(){return sellers()[0]||null} // akinek a legkisebb az eladási díja
function salesTax(){const b=bestSeller();return b?b.tax:salesTaxOf(null)}
function brokerFee(){const b=bestSeller();return b?b.broker:brokerFeeOf(null)}
function sellerHtml(){const ss=sellers();if(!ss.length)return '';const b=ss[0];
  return `<p class="small">${T('Eladásra javasolt karakter: {0} (sales tax {1}%, broker {2}%).',`<b>${esc(charName(b.cid))}</b>`,fmt(b.tax*100,2),fmt(b.broker*100,2))}${ss.length>1?' '+ss.slice(1).map(x=>T('{0}: {1}% összesen',esc(charName(x.cid)),fmt(x.fee*100,2))).join(' · '):''}</p>`}

/* ============ második piac ============ */
const HUBS=[[60003760,10000002,'Jita IV - Moon 4 - Caldari Navy Assembly Plant'],[60008494,10000043,'Amarr VIII (Oris) - Emperor Family Academy'],[60011866,10000032,'Dodixie IX - Moon 20 - Federation Navy Assembly Plant'],[60004588,10000030,'Rens VI - Moon 8 - Brutor Tribe Treasury'],[60005686,10000042,'Hek VIII - Moon 12 - Boundless Creation Factory']];
const m2On=()=>!!S.market2&&Number(S.market2)!==JITA_STATION;
function m2Short(){const l=Number(S.market2);const h=HUBS.find(x=>x[0]===l);const n=h?h[2]:locName(l);return n.split(' ')[0]}
async function regionOf(l){l=Number(l);const h=HUBS.find(x=>x[0]===l);if(h)return h[1];
  const info=LOCINFO[l]||await resolveLoc(l);if(info.region)return info.region;if(!info.system)return null;
  try{const s=await esi('/universe/systems/'+info.system+'/');const c=await esi('/universe/constellations/'+s.constellation_id+'/');info.region=c.region_id;store('locinfo',LOCINFO);return info.region}catch(e){log('Régió nem található: '+l);return null}}
const sell2=t=>m2On()&&PRICES.p2&&PRICES.p2[t]&&PRICES.p2[t].loc===Number(S.market2)?PRICES.p2[t].s:null;
const buy2=t=>m2On()&&PRICES.p2&&PRICES.p2[t]&&PRICES.p2[t].loc===Number(S.market2)?PRICES.p2[t].b:null;
const unitPrice2=t=>sell2(t)??buy2(t)??0;

/* ============ árak ============ */
async function ensurePrices(typeIds){
  const now=Date.now();const m2=m2On()?Number(S.market2):null;const reg2=m2?await regionOf(m2):null;PRICES.p2=PRICES.p2||{};
  const stale=(x,loc)=>!x||now-x.at>30*60000||(loc!=null&&x.loc!==loc);
  const all=[...new Set(typeIds)];const need=all.filter(t=>stale(PRICES.p[t])||(m2&&reg2===JITA_REGION&&stale(PRICES.p2[t],m2)));
  const need2=m2&&reg2&&reg2!==JITA_REGION?all.filter(t=>stale(PRICES.p2[t],m2)):[];
  const best=(o,loc)=>{let s=Infinity,b=0;for(const x of o){if(x.location_id!==loc)continue;if(x.is_buy_order){if(x.price>b)b=x.price}else if(x.price<s)s=x.price}return {s:s===Infinity?null:s,b:b||null,at:now,loc}};
  status('árak: '+(need.length+need2.length)+' tétel…');
  await Promise.all(need.map(async t=>{
    try{const o=await esi('/markets/'+JITA_REGION+'/orders/?type_id='+t+'&order_type=all',{paged:true});
      PRICES.p[t]=best(o,JITA_STATION);if(m2&&reg2===JITA_REGION)PRICES.p2[t]=best(o,m2);
    }catch(e){PRICES.p[t]={s:null,b:null,at:now};log('Ár hiba '+t)}
  }).concat(need2.map(async t=>{
    try{const o=await esi('/markets/'+reg2+'/orders/?type_id='+t+'&order_type=all',{paged:true});PRICES.p2[t]=best(o,m2)}
    catch(e){PRICES.p2[t]={s:null,b:null,at:now,loc:m2};log('Ár hiba ('+m2Short()+') '+t)}
  })));
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
  return (Number(S.yieldBase)/100)*(1+0.03*lvlOf(cid,SK.repro))*(1+0.02*lvlOf(cid,SK.reproEff))*(1+0.02*(rsSkill?lvlOf(cid,rsSkill):0))*(1+impOf(cid)/100);
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
function m2Cell(jita,v,buying){if(v==null||!v)return '–';const better=jita?(buying?v<jita:v>jita):false;const d=jita?(v/jita-1)*100:null;return `<span class="${better?'pos':''}">${isk(v)}</span>${d!=null?`<div class="small muted">${d>0?'+':''}${fmt(d,1)}%</div>`:''}`}
