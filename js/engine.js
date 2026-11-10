/* IndyOps – Production engine: material trees, BPC runs, invention, job cost and time. */
"use strict";
/* ============ tervező motor ============ */
let BPPROD={}; // bpTypeId -> {prod, qty, act}
async function indexBPProducts(){
  const types=[...new Set(allBPs().map(b=>b.t))];
  status('receptek: '+types.length+' blueprint…');
  await Promise.all(types.map(async t=>{const b=await refGet('b',t);if(!b)return;const a=b.m?'m':(b.r?'r':null);if(!a)return;const p=b[a].p[0];if(p)BPPROD[t]={prod:p[0],qty:p[1],act:a}}));
  status('kész');
}
function ownedFor(prodType){ // saját példányok, legjobb elöl
  const list=allBPs().filter(b=>BPPROD[b.t]&&BPPROD[b.t].prod===prodType);
  return list.sort((a,b)=>(b.r===-1)-(a.r===-1)||b.me-a.me||b.te-a.te);
}
/* készlet-pool: raktár + (opcionálisan) érc + futó jobok termékei */
async function buildPool(opt){
  const pool=new Map();
  if(opt.useStock){const sm=stockMap(false);for(const [t,arr] of sm)pool.set(t,arr.map(x=>Object.assign({},x)));if(opt.ore)await addOreToPool(pool)}
  if(opt.incoming){for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;
    for(const j of d.jobs){if(j.st!=='active'||!(j.act===1||j.act===9||j.act===11)||!j.prod)continue;
      const meta=BPPROD[j.bp];const q=j.runs*(meta?meta.qty:1);let a=pool.get(j.prod);if(!a){a=[];pool.set(j.prod,a)}a.push({l:'job',cid:Number(cid),q})}}}
  return pool;
}
/* több tétel közös készletből; shared={pool,runsLeft} projektek között is közös */
async function makeMulti(items,opt,shared){
  const pool=(shared&&shared.pool)||await buildPool(opt);
  const runsLeft=(shared&&shared.runsLeft)||new Map();
  const resv=reservedMap();const filt=new Map(); // tételenként: melyik készletből vehet
  const allowFor=item=>{let f=filt.get(item);if(!f){f=stockFilter(item,resv);filt.set(item,f)}return f};
  const take=(t,q,item)=>{const arr=pool.get(t);if(!arr)return [];const ok=allowFor(item);const used=[];let rem=q;for(const x of arr){if(rem<=0)break;if(!ok(x))continue;const k=Math.min(x.q,rem);if(k>0){x.q-=k;rem-=k;used.push({l:x.l,cid:x.cid,q:k,ore:x.ore,c:x.c??null})}}return used};
  const addPool=(t,q)=>{if(q<=0)return;let arr=pool.get(t);if(!arr){arr=[];pool.set(t,arr)}arr.push({l:'surplus',cid:0,q})};
  const buyList=new Map(),usedList=new Map(),jobs=[];const warn=[];
  const structME=Number(S.structME||0)/100;
  async function node(t,need,depth,forced,item){
    const n={t,need,stock:[],build:null,buy:0,ch:[],jobsRef:[]};
    if(depth>0&&opt.useStock!==false){n.stock=take(t,need,item);const got=n.stock.reduce((s,x)=>s+x.q,0);need-=got;n.stock.forEach(x=>{if(x.l!=='surplus'&&x.l!=='job')usedList.set(t,(usedList.get(t)||0)+x.q)})}
    if(need<=0)return n;
    let copies=forced?forced:ownedFor(t);if(copies.length)copies=copies.filter(c=>c.t===copies[0].t);
    const override=S.buyOverride[t];
    const wantBuild=depth===0||(opt.buildOwn&&copies.length&&override!==true);
    let meta=null,rec=null;
    if(wantBuild&&copies.length){meta=BPPROD[copies[0].t];const bpr=meta?await refGet('b',copies[0].t):null;rec=bpr&&bpr[meta.act];
      if(!rec){if(depth===0)throw new Error((NAMES[copies[0].t]||('#'+copies[0].t))+': nem találtam a gyártási receptjét az EVE Ref adatbázisban.');log('Recept hiányzik, vásárlásként számolom: '+(NAMES[copies[0].t]||copies[0].t))}}
    if(rec){
      const act=meta.act;
      let runsNeed=Math.ceil(need/meta.qty);const jl=[];
      for(const c of copies){if(runsNeed<=0)break;
        let avail=c.r===-1?Infinity:(runsLeft.has(c.i)?runsLeft.get(c.i):c.r);
        if(avail<=0)continue;const r=Math.min(avail,runsNeed);runsNeed-=r;if(c.r!==-1)runsLeft.set(c.i,avail-r);jl.push({c,r})}
      if(runsNeed>0){warn.push({t,miss:runsNeed});jl.push({c:copies[0],r:runsNeed,short:true});runsNeed=0}
      const totalRuns=jl.reduce((s,x)=>s+x.r,0);const made=totalRuns*meta.qty;
      n.build={act,jobs:jl,made};
      const matNeed=new Map();
      for(const j of jl){const me=act==='m'?j.c.me:0;
        for(const [m,q] of rec.m){const qty=Math.max(j.r,Math.ceil(Math.round(q*j.r*(1-me/100)*(1-(act==='m'?structME:0))*100)/100));matNeed.set(m,(matNeed.get(m)||0)+qty)}
        const job={t,bp:j.c,runs:j.r,act,time:rec.t,short:!!j.short,base:rec.m,miss:missingSkills(j.c.cid,rec),item,top:depth===0};jobs.push(job);n.jobsRef.push(job);
      }
      for(const [m,q] of matNeed){n.ch.push(await node(m,q,depth+1,null,item))}
      addPool(t,made-need);
      if(depth===0) n.made=made;
    }else{
      n.buy=need;buyList.set(t,(buyList.get(t)||0)+need);
    }
    return n;
  }
  async function addInvention(it,tree){
    const t1=it.inv.t1;const t1bp=await refGet('b',t1.t);const inv=t1bp&&t1bp.i;if(!inv||!tree.build)return;
    const info=invInfo(t1bp,it.inv.dec,it.inv.pi||0);
    const t2runs=tree.build.jobs.reduce((s,j)=>s+j.r,0);const bpcs=Math.ceil(t2runs/info.runsPer);
    const attempts=it.inv.expected?bpcs/info.chance:Math.ceil(bpcs/info.chance);
    const invNode={t:it.copies[0].t,need:bpcs,stock:[],build:{act:'i',jobs:[],made:bpcs},buy:0,ch:[],jobsRef:[],inv:{attempts,chance:info.chance,runsPer:info.runsPer,dec:it.inv.dec}};
    for(const [m,q] of inv.m)invNode.ch.push(await node(m,q*attempts,1,null,it));
    if(it.inv.dec)invNode.ch.push(await node(it.inv.dec,attempts,1,null,it));
    const t2b=await refGet('b',it.copies[0].t);const t2rec=t2b&&t2b.m;if(!t2rec)return;
    const job={t:it.copies[0].t,bp:Object.assign({},t1),runs:attempts,act:'i',time:inv.t,base:t2rec.m,cm:0.02,rs:inv.rs,miss:missingSkills(t1.cid,{rs:inv.rs}),item:it,top:false,invInfo:info};
    jobs.push(job);invNode.jobsRef.push(job);
    if(t1.r===-1){const cj={t:t1.t,bp:Object.assign({},t1),runs:Math.ceil(attempts),act:'c',time:t1bp.ct||0,base:((t1bp.m||t1bp.r)||{m:[]}).m,cm:0.02,rs:null,miss:[],item:it,top:false};jobs.push(cj);invNode.jobsRef.push(cj)}
    else{const left=runsLeft.has(t1.i)?runsLeft.get(t1.i):t1.r;const need=Math.ceil(attempts);if(need>left)warn.push({txt:T('{0}: a T1 BPC-n {1} run van, az inventionhöz {2} kellene. Húzz copyt a BPO-ról, vagy szerezz BPC-t.',NAMES[t1.t]||t1.t,left,need)});runsLeft.set(t1.i,Math.max(0,left-need))}
    tree.ch.unshift(invNode);
  }
  const trees=[];
  for(const it of items){const meta=BPPROD[it.copies[0].t];const tree=await node(meta.prod,it.runs*meta.qty,0,it.copies,it);if(it.inv)await addInvention(it,tree);trees.push({item:it,tree,made:tree.made||0})}
  return {trees,buyList,usedList,jobs,warn};
}
const DECS={34201:{n:'Accelerant Decryptor',p:1.2,me:2,te:10,runs:1},34202:{n:'Attainment Decryptor',p:1.8,me:-1,te:4,runs:4},34203:{n:'Augmentation Decryptor',p:0.6,me:-2,te:2,runs:9},34204:{n:'Parity Decryptor',p:1.5,me:1,te:-2,runs:3},34205:{n:'Process Decryptor',p:1.1,me:3,te:6,runs:0},34206:{n:'Symmetry Decryptor',p:1,me:1,te:8,runs:2},34207:{n:'Optimized Attainment Decryptor',p:1.9,me:1,te:-2,runs:2},34208:{n:'Optimized Augmentation Decryptor',p:0.9,me:2,te:0,runs:7}};
function invChance(cid,inv,dec,pi=0){let sci=0,enc=0;for(const sk of Object.keys(inv.rs||{})){const l=lvlOf(cid,sk);if(/Encryption/i.test(NAMES[sk]||''))enc=l;else sci+=l}return Math.min(1,inv.p[pi][2]*(1+sci/30+enc/40)*(dec?DECS[dec].p:1))}
function invInfo(t1bp,dec,pi=0){const inv=t1bp.i;pi=Math.min(pi,inv.p.length-1);const cs=workChars();let best=cs[0]??null,bc=-1;for(const c of cs){const ch=invChance(c,inv,dec,pi);if(ch>bc){bc=ch;best=c}}const d=dec?DECS[dec]:null;
  return {chance:bc<0?inv.p[pi][2]*(d?d.p:1):bc,runsPer:Math.max(1,inv.p[pi][1]+(d?d.runs:0)),me:2+(d?d.me:0),te:4+(d?d.te:0),char:best,t2bp:inv.p[pi][0],pi}}
async function virtualItem(t1copy,dec,runs,label,expected,pi=0){ // inventálandó T2 BPC mint "virtuális" példány
  const t1bp=await refGet('b',t1copy.t);if(!t1bp||!t1bp.i||!t1bp.i.p.length)return null;
  await resolveNames(Object.keys(t1bp.i.rs||{}).map(Number));
  const info=invInfo(t1bp,dec,pi);const t2bp=await refGet('b',info.t2bp);if(!t2bp||!t2bp.m)return null;
  BPPROD[info.t2bp]={prod:t2bp.m.p[0][0],qty:t2bp.m.p[0][1],act:'m'};
  const vc={virtual:true,i:'v'+info.t2bp+'_'+(dec||0)+'_'+info.pi,t:info.t2bp,me:info.me,te:info.te,r:-1,cid:t1copy.cid,l:t1copy.l};
  return {copies:[vc],runs:runs||info.runsPer,label,inv:{t1:t1copy,dec,expected,pi:info.pi},info};
}
async function makePlan(topBP,runs,opt){const r=await makeMulti([{copies:[topBP],runs}],opt);return {tree:r.trees[0].tree,buyList:r.buyList,usedList:r.usedList,jobs:r.jobs,warn:r.warn,top:topBP,runs}}
async function addOreToPool(pool){
  const ores=new Set(await ensureOres());const add=new Map();
  for(const [t,arr] of [...pool]){if(!ores.has(t))continue;
    for(const x of arr){if(x.q<=0)continue;const mins=await oreToMinerals(t,x.q);for(const [m,q] of mins){if(q<=0)continue;let a=pool.get(m);if(!a){a=[];pool.set(m,a)}a.push({l:x.l,cid:x.cid,q,ore:t,c:x.c??null})}x.q=0}}
}
async function prefetchTree(prodType,seen=new Set()){ // receptek előtöltése párhuzamosan
  if(seen.has(prodType))return;seen.add(prodType);
  const copies=ownedFor(prodType);if(!copies.length)return;
  const meta=BPPROD[copies[0].t];const bp=await refGet('b',copies[0].t);const rec=bp&&bp[meta.act];if(!rec)return;
  await Promise.all(rec.m.map(([m])=>prefetchTree(m,seen)));
}
function warnText(w){if(w.txt)return w.txt;return T('{0}: a saját BPC-ken nincs elég run ({1} hiányzik). A hiányzó runokat a legjobb példány ME-jével számoltam.',NAMES[w.t]||('#'+w.t),fmt(w.miss))}
function collectTypes(n,s=new Set()){s.add(n.t);n.ch.forEach(c=>collectTypes(c,s));return s}

/* ============ költség ============ */
const ACT_IDX={m:'manufacturing',r:'reaction',i:'invention',c:'copying',rme:'researching_material_efficiency',rte:'researching_time_efficiency'};
// minden job a saját gyártási helyének rendszerével számol; a Beállítások „rendszer” mezője mindent felülír, a „gyártási hely” a helyet
const SYSNAME={};
async function sysByName(n){if(SYSNAME[n]!==undefined)return SYSNAME[n];try{const r=await esi('/universe/ids/',{method:'POST',body:[n]});SYSNAME[n]=r.systems&&r.systems[0]?r.systems[0].id:null}catch(e){SYSNAME[n]=null}return SYSNAME[n]}
async function assignJobSys(jobs){
  const ov=S.system?await sysByName(S.system):null;const cache={};
  for(const j of jobs){if(ov){j.sys=ov;continue}const l=S.prodLoc?Number(S.prodLoc):(j.bp&&j.bp.l);if(l==null)continue;
    if(cache[l]===undefined){let li=LOCINFO[l];if(!li){try{li=await resolveLoc(l)}catch(e){li=null}}cache[l]=li&&li.system||null}j.sys=cache[l]||j.sys||null}
}
function jobCost(j,sysId){
  const eiv=j.base.reduce((s,[m,q])=>s+(ADJ.p[m]||0)*q,0)*j.runs*(j.cm||1);
  const index=((IDX.p[j.sys??sysId]||{})[ACT_IDX[j.act]])||0;
  return eiv*(index+Number(S.facTax||0)/100+Number(S.scc||0)/100);
}
function jobTime(j){
  const c=j.who!=null?j.who:j.bp.cid;
  if(j.act==='i')return j.runs*j.time*(1-0.03*lvlOf(c,SK.advInd));
  if(j.act==='c')return j.runs*j.time*(1-0.05*lvlOf(c,SK.science))*(1-0.03*lvlOf(c,SK.advInd));
  const te=j.act==='m'?j.bp.te:0;
  const sk=j.act==='m'?(1-0.04*lvlOf(c,SK.industry))*(1-0.03*lvlOf(c,SK.advInd)):(1-0.04*lvlOf(c,45746));
  return j.runs*j.time*(1-te/100)*sk*(1-Number(S.structTE||0)/100);
}
const slotKey=a=>a==='m'?'m':a==='r'?'r':'s';
async function sysFor(bp){
  if(S.system){const id=await sysByName(S.system);if(id)return id}
  const l=S.prodLoc?Number(S.prodLoc):bp.l;const li=LOCINFO[l]||await resolveLoc(l);return li&&li.system;
}
