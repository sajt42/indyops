/* IndyOps – Aggregated stock and blueprint views, market prices, ore reprocessing. */
"use strict";
/* ============ összesített nézetek ============ */
function allLocs(){const m=new Map();for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const a of d.assets)m.set(a.l,true);for(const b of d.bps)m.set(b.l,true)}return [...m.keys()]}
function locName(l){const mn=S.locNames&&S.locNames[l];if(mn)return mn;if(LOCINFO[l]&&LOCINFO[l].name){const n=LOCINFO[l].name;if(n.startsWith('Ismeretlen hely #'))return T('Ismeretlen hely #{0}',n.slice(17));return n.endsWith(' (űrben)')?n.slice(0,-8)+' '+T('(űrben)'):n}if(l===JITA_STATION)return 'Jita IV - Moon 4 - Caldari Navy Assembly Plant';return '#'+l}
function charName(id){const c=CHARS.find(x=>x.id==id);return c?c.name:'#'+id}
function planLocs(){return S.locs?new Set(S.locs.map(Number)):new Set(allLocs())}
function allBPs(){const out=[];for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const b of d.bps)out.push(Object.assign({cid:Number(cid)},b))}return out}
function inJob(itemId){for(const d of Object.values(DATA))for(const j of d.jobs)if(j.bpi===itemId&&j.st==='active')return j;return null}
// készlet: typeId -> [{l,cid,q}]
function stockMap(onlyPlan){
  const allow=onlyPlan?planLocs():null;const m=new Map();
  for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;
    for(const a of d.assets){if(allow&&!allow.has(a.l))continue;if(a.f&&/Slot\d|SubSystemSlot|FighterTube/.test(a.f))continue;
      let arr=m.get(a.t);if(!arr){arr=[];m.set(a.t,arr)}const c=a.c??null;const ex=arr.find(x=>x.l===a.l&&x.cid==cid&&x.c===c);if(ex)ex.q+=a.q;else arr.push({l:a.l,cid:Number(cid),q:a.q,c})}}
  return m;
}
// kik dolgoznak: a javaslatok (gyártás, invention, kutatás, eladás, reprocess) csak közülük választanak; a készlet mindenkié számít
function workChars(){const all=CHARS.map(c=>c.id).filter(id=>DATA[id]);const w=Array.isArray(S.workChars)?all.filter(id=>S.workChars.includes(id)):all;return w.length?w:all}
const lvlOf=(cid,id)=>((DATA[cid]&&DATA[cid].skills)||{})[id]||0;
function missingSkills(cid,rec){return Object.entries((rec&&rec.rs)||{}).filter(([sk,l])=>lvlOf(cid,sk)<l).map(([sk,l])=>[Number(sk),l,lvlOf(cid,sk)])}
function recOf(bpType){const b=REFC.b[bpType];if(!b)return null;return b.m||b.r}
function slotsOf(cid){return {m:1+lvlOf(cid,SK.massProd)+lvlOf(cid,SK.advMassProd),r:1+lvlOf(cid,SK.massReac)+lvlOf(cid,SK.advMassReac),s:1+lvlOf(cid,SK.labOp)+lvlOf(cid,SK.advLabOp)}}
function busyOf(cid){const d=DATA[cid];const o={m:0,r:0,s:0};if(!d)return o;for(const j of d.jobs){if(j.st!=='active')continue;if(j.act===1)o.m++;else if(j.act===9||j.act===11)o.r++;else if([3,4,5,7,8].includes(j.act))o.s++}return o}
// eladási díjak karakterenként (a Beállításokban megadott érték mindenkire felülírja)
function salesTaxOf(cid){return S.salesTax!==''&&S.salesTax!=null?Number(S.salesTax)/100:0.075*(1-0.11*lvlOf(cid,SK.accounting))}
// standing: a nyers értéket a Connections (pozitív) / Diplomacy (negatív) skill javítja; null, ha nincs meg az engedély
function hasStd(cid){return !!(DATA[cid]&&DATA[cid].std)}
function effStd(cid,from){const d=DATA[cid];if(!d||!d.std||from==null)return 0;const r=d.std[from]||0;const sk=r>=0?lvlOf(cid,SK.connections):lvlOf(cid,SK.diplomacy);return r+(10-r)*0.04*sk}
let CORPFAC=load('corpfac',{});
function stationOwner(l){const i=LOCINFO[l];if(!i||i.owner==null)return null;return {corp:i.owner,fac:CORPFAC[i.owner]??null}}
async function ensureOwners(locs){let ch=false;
  for(const l of locs){if(!l||locKind(l)!=='npc')continue;let i=LOCINFO[l];
    if(!i||i.owner===undefined){try{const s=await esi('/universe/stations/'+l+'/');i=LOCINFO[l]=Object.assign(i||{},{name:s.name,system:s.system_id},stationRepro(s));ch=true}catch(e){continue}}
    if(i.owner!=null&&CORPFAC[i.owner]===undefined){try{const c=await esi('/corporations/'+i.owner+'/');CORPFAC[i.owner]=c.faction_id??0}catch(e){CORPFAC[i.owner]=0}store('corpfac',CORPFAC)}}
  if(ch)store('locinfo',LOCINFO)}
// broker fee egy adott helyen: NPC állomáson a tulaj corp és faction felé vett standinggel csökken
function structBrokerOf(l){const v=S.structBroker&&S.structBroker[l];return v!=null&&v!==''?Number(v):null}
function brokerFeeOf(cid,l){if(l!=null&&locKind(l)==='struct'){const v=structBrokerOf(l);return v==null?null:(v+0.5)/100}
  if(S.broker!==''&&S.broker!=null)return Number(S.broker)/100;
  let f=0.03-0.003*lvlOf(cid,SK.broker);const o=l!=null&&locKind(l)==='npc'?stationOwner(l):null;
  if(o&&hasStd(cid))f-=0.0003*effStd(cid,o.fac)+0.0002*effStd(cid,o.corp);return Math.max(0.01,f)}
function sellers(l=JITA_STATION){return workChars().map(id=>({cid:id,tax:salesTaxOf(id),broker:brokerFeeOf(id,l),b2:m2On()?brokerFeeOf(id,Number(S.market2)):null})).map(x=>Object.assign(x,{fee:x.tax+x.broker})).sort((a,b)=>a.fee-b.fee)}
// a második piacon a legolcsóbb eladó díja (null, ha a struktúra díja nincs megadva)
function m2Fee(){const b=sellers().filter(x=>x.b2!=null).map(x=>x.tax+x.b2).sort((a,b)=>a-b)[0];return b??null}
function bestSeller(){return sellers()[0]||null} // akinek a legkisebb az eladási díja
function salesTax(){const b=bestSeller();return b?b.tax:salesTaxOf(null)}
function brokerFee(){const b=bestSeller();return b?b.broker:brokerFeeOf(null)}
function sellerHtml(){const ss=sellers();if(!ss.length)return '';const m2=m2On();const m2l=m2?Number(S.market2):null;const isStr=m2&&locKind(m2l)==='struct';const noStd=workChars().some(id=>!hasStd(id));
  const tot2=x=>x.b2==null?null:x.tax+x.b2;
  return `<div class="sellerbox"><h3>Ki adjon el?</h3><div class="tablewrap"><table class="seltab"><thead><tr><th>Karakter</th><th class="num">Sales tax</th><th class="num">Broker fee<div class="small muted" data-noi18n>Jita</div></th>${m2?`<th class="num">Broker fee<div class="small muted" data-noi18n>${esc(m2Short())}</div></th>`:''}<th class="num">Összesen<div class="small muted" data-noi18n>Jita</div></th>${m2?`<th class="num">Összesen<div class="small muted" data-noi18n>${esc(m2Short())}</div></th>`:''}<th></th></tr></thead><tbody>${ss.map((x,i)=>`<tr><td>${esc(charName(x.cid))}</td><td class="num">${fmt(x.tax*100,2)}%</td><td class="num">${fmt(x.broker*100,2)}%</td>${m2?`<td class="num">${x.b2!=null?fmt(x.b2*100,2)+'%':'?'}</td>`:''}<td class="num"><b>${fmt(x.fee*100,2)}%</b></td>${m2?`<td class="num"><b>${tot2(x)!=null?fmt(tot2(x)*100,2)+'%':'?'}</b></td>`:''}<td>${i===0?'<span class="pill ok">javasolt</span>':''}</td></tr>`).join('')}</tbody></table></div>
  ${isStr?`<div class="row" style="margin-top:6px"><label class="small">${T('{0} broker fee (a tulaj állítja), %',esc(m2Short()))} <input type="number" step="0.1" min="0" max="100" style="width:80px" data-sbroker="${m2l}" value="${structBrokerOf(m2l)??''}" placeholder="?"></label><span class="small muted">${T('+ 0,5% SCC pótdíj. A játékban egy eladási order feladásakor látod. Skillek és standing itt nem számítanak.')}</span></div>`:''}
  <p class="small muted" style="margin-top:4px">${noStd?T('A díjak a skillekből jönnek (Accounting, Broker Relations). A standinghez jelentkezz be újra a karakterekkel; addig a broker fee a valóságban kicsit kisebb lehet.'):T('A díjak a skillekből (Accounting, Broker Relations) és az állomás tulajdonosához fűződő standingből jönnek (Connections, Diplomacy beszámítva). Játékos-struktúrában a broker fee-t a tulaj állítja.')}</p></div>`}
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||t.dataset.sbroker==null)return;S.structBroker=S.structBroker||{};const v=t.value.trim();if(v==='')delete S.structBroker[t.dataset.sbroker];else S.structBroker[t.dataset.sbroker]=Number(v);saveS();
  document.querySelectorAll('.sellerbox').forEach(b=>{const w=document.createElement('div');w.innerHTML=sellerHtml();b.replaceWith(w.firstElementChild)})});
function m2Hint(){return m2On()?'':`<p class="small muted m2hint">${T('Tipp: a Jita mellé egy második piacot is beállíthatsz (pl. Amarr, vagy egy állomás vagy struktúra, ahol van cuccod), és az árai itt is megjelennek.')} <a href="#" data-goto="settings">Beállítások</a></p>`}

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
// vásárlás: a második piacon, ha ott olcsóbb (Beállítások: buyM2, alapból be)
const buyM2On=()=>m2On()&&S.buyM2!==false;
function buyAt(t){const j=unitPrice(t),m=sell2(t);return buyM2On()&&m&&(!j||m<j)?Number(S.market2):JITA_STATION}
function buyPrice(t){return buyAt(t)===JITA_STATION?unitPrice(t):sell2(t)}

/* ============ árak ============ */
async function ensurePrices(typeIds){
  const now=Date.now();const m2=m2On()?Number(S.market2):null;const isStr=m2&&m2>1e12;const reg2=m2&&!isStr?await regionOf(m2):null;PRICES.p2=PRICES.p2||{};
  const stale=(x,loc)=>!x||now-x.at>30*60000||(loc!=null&&x.loc!==loc);
  const all=[...new Set(typeIds)];const need=all.filter(t=>stale(PRICES.p[t])||(m2&&reg2===JITA_REGION&&stale(PRICES.p2[t],m2)));
  const need2=m2&&reg2&&reg2!==JITA_REGION?all.filter(t=>stale(PRICES.p2[t],m2)):[];
  const best=(o,loc)=>{let s=Infinity,b=0;for(const x of o){if(x.location_id!==loc)continue;if(x.is_buy_order){if(x.price>b)b=x.price}else if(x.price<s)s=x.price}return {s:s===Infinity?null:s,b:b||null,at:now,loc}};
  if(isStr){const n2=all.filter(t=>stale(PRICES.p2[t],m2));if(n2.length){const bk=await structBook(m2);for(const t of n2){const x=bk&&bk.m.get(t);PRICES.p2[t]={s:x&&x.s<Infinity?x.s:null,b:x&&x.b||null,at:bk?bk.at:now,loc:m2}}}}
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
  try{await ensureOwners([JITA_STATION,m2])}catch(e){}
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
  let who=null,y=-1;for(const id of workChars()){const v=oreYieldFor(id,rsSkill);if(v>y){y=v;who=id}}
  if(who==null)return {who:null,y:(Number(S.yieldBase)/100)*(1+Number(S.implant||0)/100)};return {who,y};
}
function oreYield(rsSkill){return bestRepro(rsSkill).y}
async function oreToMinerals(typeId,units,cid){
  const t=await refGet('t',typeId);if(!t||!t.tm.length)return [];
  const b=cid!=null?{who:cid,y:oreYieldFor(cid,t.rs)}:bestRepro(t.rs);const portions=Math.floor(units/(t.p||1));
  const out=t.tm.map(([m,q])=>[m,Math.floor(portions*q*b.y)]);out.who=b.who;out.y=b.y;out.rs=t.rs;return out;
}
function m2Cell(jita,v,buying){if(v==null||!v)return '–';const better=jita?(buying?v<jita:v>jita):false;const d=jita?(v/jita-1)*100:null;return `<span class="${better?'pos':''}">${isk(v)}</span>${d!=null?`<div class="small muted">${d>0?'+':''}${fmt(d,1)}%</div>`:''}`}
// játékos-struktúra teljes piaca egyszerre (esi-markets.structure_markets.v1, dokkolási jog kell), 30 percig tárolva
const STRBOOKS={},STRFAIL={};
async function structBook(id){
  const hit=STRBOOKS[id];if(hit&&Date.now()-hit.at<30*60000)return hit;if(STRFAIL[id]&&Date.now()-STRFAIL[id]<30*60000)return null;
  const cs=CHARS.filter(c=>hasScope(c,'esi-markets.structure_markets.v1'));
  if(!cs.length){log('Struktúra piac: egyik karakternek sincs meg az engedély, jelentkezz be újra.');return null}
  for(const c of cs){try{status(T('{0} piaca…',locName(id)));const o=await esi('/markets/structures/'+id+'/',{char:c,paged:true});const m=new Map(),raw=new Map();
    for(const x of o){let r=m.get(x.type_id);if(!r){r={s:Infinity,b:0};m.set(x.type_id,r)}if(x.is_buy_order){if(x.price>r.b)r.b=x.price}else if(x.price<r.s)r.s=x.price;if(!raw.has(x.type_id))raw.set(x.type_id,[]);raw.get(x.type_id).push(x)}
    STRBOOKS[id]={id,at:Date.now(),m,raw};log(T('{0} piaca: {1} order',locName(id),fmt(o.length)));return STRBOOKS[id]}catch(e){log('Struktúra piac ('+c.name+'): '+e.message)}}
  STRFAIL[id]=Date.now();log(T('A(z) {0} piacát egyik karaktered sem éri el (dokkolási jog kell, vagy nincs piac modul).',locName(id)));if(Number(S.market2)===id)alertBox(T('A(z) {0} piacát egyik karaktered sem éri el (dokkolási jog kell, vagy nincs piac modul).',locName(id)));return null;
}

/* ============ ismeretlen helyek ============ */
const unkInfo=i=>!!i&&!i.ev&&!i.system&&(!!i.unk||String(i.name||'').startsWith('Ismeretlen hely #'));
const isUnknownLoc=l=>unkInfo(LOCINFO[l]);
function unknownLocs(){return allLocs().filter(l=>isUnknownLoc(l)||(S.locNames&&S.locNames[l]))}
// az EVE Ref nyilvános struktúralistájából próbálja kitalálni a nevet (csak ha van ismeretlen hely; naponta egyszer)
async function everefLocs(force){
  const un=allLocs().filter(l=>isUnknownLoc(l)&&l>1e12);if(!un.length)return 0;
  const last=load('everef_at',0);if(!force&&Date.now()-last<24*3600000)return 0;
  try{status(T('ismeretlen helyek keresése az EVE Refben…'));const r=await fetchT('https://data.everef.net/structures/structures-latest.v2.json',60000);if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();store('everef_at',Date.now());let n=0;
    for(const l of un){const x=j[l];if(x&&x.name){LOCINFO[l]={name:x.name,system:x.solar_system_id,stype:x.type_id||0,ev:1,tried:Date.now()};n++}}
    if(n){store('locinfo',LOCINFO);log(T('EVE Ref: {0} ismeretlen hely neve meglett.',n))}else log(T('EVE Ref: nem találtam az ismeretlen helyeket (valószínűleg privát struktúrák).'));
    status('kész');if(n)renderAll();return n}
  catch(e){log('EVE Ref struktúralista: '+e.message);status('kész');return 0}
}
// nyomok egy ismeretlen helyhez: ESI hely-típus, hangár-flagek, konténernevek, orderek régiója, jobok, ki birtokolja
function locClues(l){
  const c=[];const fl={};let lt=null;const cn=new Set(),who=new Set();let reg=null,jobs=0,tx=0;
  for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(x=>x.id==cid))continue;const m=d.lm&&d.lm[l];if(m){lt=m.t;for(const [k,v] of Object.entries(m.f))fl[k]=(fl[k]||0)+v}
    let has=false;for(const a of d.assets)if(a.l===l){has=true;if(a.cn)cn.add(a.cn)}for(const b of d.bps)if(b.l===l)has=true;if(has)who.add(Number(cid));
    for(const o of d.orders||[])if(o.l===l)reg=o.reg;for(const j of d.jobs||[])if(j.loc===l)jobs++;for(const x of d.tx||[])if(x.l===l)tx++}
  if(who.size)c.push(T('kinél: {0}',[...who].map(charName).join(', ')));
  if(Object.keys(fl).length)c.push(T('hangár: {0}',Object.entries(fl).map(([k,v])=>k+' ×'+v).join(', ')));
  if(fl.AssetSafety)c.push(T('Asset safety: a tárgyak egy megszűnt vagy elérhetetlen struktúrából kerültek ki; a játékban az Assets ablak „Asset Safety” részén látszanak, onnan kivehetők.'));
  if(lt)c.push(T('ESI hely-típus: {0}',lt));
  if(cn.size)c.push(T('konténerek: {0}',[...cn].slice(0,5).map(esc).join(', ')));
  if(reg)c.push(T('market ordered van itt, régió: {0}',esc(NAMES[reg]||reg)));
  if(jobs)c.push(T('{0} industry job fut itt',jobs));
  if(tx)c.push(T('{0} tranzakció történt itt',tx));
  if(lt==='other')c.push(T('egyéb hely (pl. asset safety vagy deliveries)'));
  return c.length?`<div class="src">${c.join(' · ')}</div>`:''}
function renderUnknownLocs(){
  const el=document.getElementById('unkLocs');if(!el)return;const ls=unknownLocs();
  const card=el.closest('.card');if(card)card.hidden=!ls.length;
  const nn=ls.filter(l=>!(S.locNames&&S.locNames[l])).length;const note=document.getElementById('unkNote');if(note)note.innerHTML=nn?`<div class="notice"><p class="small">${T('{0} helynek nem ismert a neve (játékos-struktúra, ahol nincs dokkolási jogod).',nn)} <a href="#" data-goto="settings">${T('Elnevezés a Beállításokban')}</a></p></div>`:'';
  if(!ls.length){el.innerHTML='';return}
  el.innerHTML=`<div class="tablewrap"><table><thead><tr><th>Azonosító</th><th>Mi van ott</th><th>Név</th></tr></thead><tbody>${ls.map(l=>{
    const items=new Map();for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const a of d.assets)if(a.l===l)items.set(a.t,(items.get(a.t)||0)+a.q);for(const b of d.bps)if(b.l===l)items.set(b.t,(items.get(b.t)||0)+1)}
    const top=[...items.keys()].slice(0,5).map(t=>esc(NAMES[t]||t)).join(', ');
    return `<tr><td class="mono small">${l}</td><td class="small">${T('{0} féle tárgy',fmt(items.size))}${top?': '+top+(items.size>5?' …':''):''}${locClues(l)}</td><td><input data-locname="${l}" value="${esc((S.locNames&&S.locNames[l])||'')}" placeholder="${esc(T('pl. a játék Assets ablakából'))}" style="width:100%"></td></tr>`}).join('')}</tbody></table></div>`;
}

/* ============ konténerek és projekt-források ============ */
function allConts(){const m=new Map();for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid)||!d.cont)continue;for(const [id,c] of Object.entries(d.cont))m.set(Number(id),Object.assign({id:Number(id),cid:Number(cid)},c))}return m}
// konténer/hajó felirata: saját név (típus), hajónál 🚀, konténernél 📦
const contIsShip=c=>c.k===6;
function contLabel(id,all){const c=(all||allConts()).get(Number(id));if(!c)return '#'+id;const tn=NAMES[c.t]||('#'+c.t);return (contIsShip(c)?'🚀 ':'📦 ')+(c.n&&c.n!==tn?c.n+' ('+tn+')':tn)}
// a konténer és minden benne lévő konténer
function contTree(ids,all){all=all||allConts();const kids=new Map();for(const c of all.values())if(c.pc!=null){if(!kids.has(c.pc))kids.set(c.pc,[]);kids.get(c.pc).push(c.id)}
  const out=new Set();const st=[...ids].map(Number);while(st.length){const x=st.pop();if(out.has(x))continue;out.add(x);(kids.get(x)||[]).forEach(k=>st.push(k))}return out}
// foglalt konténerek: konténer -> projekt id (a prioritásban előbb álló projekt nyer)
function reservedMap(){const m=new Map();if(typeof PROJ==='undefined')return m;const all=allConts();
  for(const p of PROJ){const s=p.src;if(!p.active||!s||s.mode!=='sel'||!s.excl)continue;for(const d of contTree(s.excl,all))if(!m.has(d))m.set(d,p.id)}return m}
// melyik készlet-bejegyzést veheti el egy tétel: a projekt/tétel forrásai szerint, vagy a Beállítások helyszínei szerint
function stockFilter(item,resv){
  const pid=item&&item.pid;const own=x=>x.c==null||!resv.has(x.c)||resv.get(x.c)===pid;
  const sp=item&&item.src&&item.src.mode==='sel'?item.src:null;
  if(!sp){const pl=planLocs();return x=>x.l==='job'||x.l==='surplus'||(pl.has(x.l)&&own(x))}
  const locs=new Set((sp.locs||[]).map(Number));const conts=contTree(sp.conts||[]);
  return x=>x.l==='job'||x.l==='surplus'||(own(x)&&(locs.has(x.l)||(x.c!=null&&conts.has(x.c))));
}
