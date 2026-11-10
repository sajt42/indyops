/* IndyOps – Rendering: characters, blueprints, stock, settings, plan results, hauling. */
"use strict";
/* ============ lapozás és rendezés (közös) ============ */
const PG={},PGR={},SRT={};
// rows: teljes (szűrt) lista; sig: a szűrők aláírása (ha változik, vissza az első oldalra); render: újrarajzoló függvény
function pageOf(key,rows,sig,render){const s=PG[key]||(PG[key]={p:0,n:100,sig});if(s.sig!==sig){s.sig=sig;s.p=0}PGR[key]=render;
  const n=s.n||rows.length||1;const pages=Math.max(1,Math.ceil(rows.length/n));if(s.p>=pages)s.p=pages-1;const a=s.p*n,b=Math.min(rows.length,a+n);
  return {rows:rows.slice(a,b),html:pagerHtml(key,rows.length,pages,s,a,b)}}
function pagerHtml(key,total,pages,s,a,b){if(total<=25)return '';
  const sizes=[25,50,100,250,500,0];
  return `<div class="pager" data-noi18n><button class="btn mini" data-pg="${key}|first" ${s.p?'':'disabled'} aria-label="${esc(T('Első oldal'))}">«</button><button class="btn mini" data-pg="${key}|prev" ${s.p?'':'disabled'} aria-label="${esc(T('Előző oldal'))}">‹</button>
  <span class="small">${fmt(a+1)}–${fmt(b)} / ${fmt(total)}</span>
  <button class="btn mini" data-pg="${key}|next" ${s.p<pages-1?'':'disabled'} aria-label="${esc(T('Következő oldal'))}">›</button><button class="btn mini" data-pg="${key}|last" ${s.p<pages-1?'':'disabled'} aria-label="${esc(T('Utolsó oldal'))}">»</button>
  <label class="small">${esc(T('Soronként'))} <select data-pgn="${key}">${sizes.map(z=>`<option value="${z}" ${s.n===z?'selected':''}>${z||esc(T('mind'))}</option>`).join('')}</select></label></div>`}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pg]');if(!b)return;const [k,act]=b.dataset.pg.split('|');const s=PG[k];if(!s)return;
  if(act==='first')s.p=0;else if(act==='prev')s.p=Math.max(0,s.p-1);else if(act==='next')s.p++;else if(act==='last')s.p=1e9;PGR[k]&&PGR[k]()});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||t.dataset.pgn==null)return;const k=t.dataset.pgn;const s=PG[k];if(!s)return;s.n=Number(t.value);s.p=0;PGR[k]&&PGR[k]()});
// rendezhető fejléc: sortTh(kulcs,mező,felirat,szám?) ; sortRows(kulcs,sorok,alap)
function sortTh(key,f,label,num,dflt){const s=SRT[key]||(SRT[key]=dflt||{f,d:num?-1:1});const on=s.f===f;
  return `<th class="${num?'num ':''}sortable" data-srt="${key}|${f}|${num?1:0}" aria-sort="${on?(s.d>0?'ascending':'descending'):'none'}">${label}${on?(s.d>0?' ▲':' ▼'):''}</th>`}
function sortRows(key,rows,get){const s=SRT[key];if(!s)return rows;return rows.sort((a,b)=>{const va=get(a,s.f),vb=get(b,s.f);return (typeof va==='number'&&typeof vb==='number'?va-vb:String(va??'').localeCompare(String(vb??''),LOC()))*s.d})}
document.addEventListener('click',e=>{const th=e.target.closest('[data-srt]');if(!th)return;const [k,f,num]=th.dataset.srt.split('|');const s=SRT[k]||{};SRT[k]=s.f===f?{f,d:-s.d}:{f,d:num==='1'?-1:1};if(PG[k])PG[k].p=0;PGR[k]&&PGR[k]()});

/* ============ RENDER ============ */
function renderDataNote(){const el=document.getElementById('dvNote');if(!el)return;
  const old=CHARS.filter(c=>DATA[c.id]&&(DATA[c.id].dv||1)<APP.dataVersion);
  el.innerHTML=old.length?`<div class="notice" style="margin:12px 0"><p>${T('Az IndyOps frissült (v{0}). Ehhez a verzióhoz újra le kell tölteni a karakterek adatait: {1}.',APP.version,esc(old.map(c=>c.name).join(', ')))} <button class="btn primary" id="dvRefresh">${T('Minden adat frissítése')}</button> <a href="https://github.com/${APP.repo}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${T('Mi változott?')}</a></p></div>`:'';
  const b=document.getElementById('dvRefresh');if(b)b.onclick=async()=>{b.disabled=true;await refreshAll()}}
function renderAll(){renderDataNote();renderProjects();renderChars();renderJobs();renderBPs();renderStock();renderLocList();renderPlanOptions();renderSettings();renderUnknownLocs()}
function alertBox(msg){const d=document.createElement('div');d.className='notice err';d.innerHTML='<p>'+esc(msg)+'</p>';const host=document.querySelector('section:not([hidden])')||document.body;host.prepend(d);setTimeout(()=>d.remove(),12000)}
function renderChars(){
  $('#setupBox').hidden=!!clientId();
  {const ib=document.getElementById('introBox');if(ib)ib.hidden=CHARS.length>0}
  $('#cbUrl').textContent=callbackUrl();$('#scopeList').textContent=scopesNeeded().join(' ');
  $('#noChars').hidden=CHARS.length>0;
  $('#charList').innerHTML=CHARS.map(c=>{const d=DATA[c.id];return `<div class="card char"><img alt="" src="https://images.evetech.net/characters/${c.id}/portrait?size=64"><div style="flex:1;min-width:0"><div class="nm">${esc(c.name)}</div><div class="small muted">${d?T('{0} tárgy · {1} BP · frissítve {2}',fmt(d.assets.length),fmt(d.bps.length),new Date(d.at).toLocaleString(LOC())):T('még nincs letöltve')}</div>${(()=>{if(!c.scp)return '';const miss=scopesNeeded().filter(x=>!c.scp.includes(x));return miss.length?`<div class="notice" style="margin:6px 0 0"><p class="small">${HOSTED?`${T('Új funkciókhoz új engedély kell ehhez a karakterhez. Nyomd meg az „Újra bejelentkezés” gombot.')} <code>${esc(miss.join(' '))}</code>`:`Új engedély kell ehhez a karakterhez: <code>${esc(miss.join(' '))}</code>. Előbb add hozzá az alkalmazásodhoz a developers.eveonline.com-on, aztán jelentkezz be újra ezzel a karakterrel.`}</p></div>`:''})()}<div class="row" style="margin-top:6px"><button class="btn" data-ref="${c.id}">Frissítés</button><button class="btn" data-relog="${c.id}">Újra bejelentkezés</button><button class="btn" data-del="${c.id}">Eltávolítás</button></div></div></div>`}).join('');
}
function renderJobs(){
  const rows=[];const acts={1:'Gyártás',3:'TE kutatás',4:'ME kutatás',5:'Másolás',8:'Invention',9:'Reakció',11:'Reakció'};
  for(const [cid,d] of Object.entries(DATA)){if(!CHARS.find(c=>c.id==cid))continue;for(const j of d.jobs)rows.push({cid,j})}
  rows.sort((a,b)=>a.j.end.localeCompare(b.j.end));
  $('#jobsTable tbody').innerHTML=rows.length?rows.map(({cid,j})=>`<tr><td>${esc(charName(cid))}</td><td>${acts[j.act]||j.act}</td><td>${esc(NAMES[j.bp]||j.bp)}</td><td class="num">${j.runs}</td><td>${esc(locName(j.loc))}</td><td class="mono">${new Date(j.end)<new Date()?'<span class="pill ok">kész, átvehető</span>':new Date(j.end).toLocaleString(LOC())}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">Nincs futó job.</td></tr>';
}
let bpSort={k:'name',d:1};
function renderBPs(){
  const f=$('#bpFilter').value.toLowerCase(),kind=$('#bpKind').value,nm=$('#bpNotMax').checked;
  let list=allBPs().map(b=>({b,name:NAMES[b.t]||'#'+b.t,char:charName(b.cid),loc:locName(b.l)+(b.cn?' › '+b.cn:''),me:b.me,te:b.te,runs:b.r}));
  list=list.filter(x=>(!f||x.name.toLowerCase().includes(f)||x.loc.toLowerCase().includes(f))&&(!kind||(kind==='bpo')===(x.b.r===-1))&&(!nm||(x.b.r===-1&&(x.me<10||x.te<20))));
  list.sort((a,b)=>{const k=bpSort.k;const va=a[k],vb=b[k];return (typeof va==='number'?va-vb:String(va).localeCompare(String(vb),'hu'))*bpSort.d});
  const pg=pageOf('bp',list,[f,kind,nm,bpSort.k,bpSort.d].join('|'),renderBPs);$('#bpPg1').innerHTML=pg.html;$('#bpPg2').innerHTML=pg.html;
  $('#bpTable tbody').innerHTML=pg.rows.map(x=>{const j=inJob(x.b.i);const max=x.b.r===-1&&x.me>=10&&x.te>=20;
    return `<tr><td>${esc(x.name)}</td><td><span class="pill ${x.b.r===-1?'bpo':'bpc'}">${x.b.r===-1?'BPO':'BPC'}</span></td><td class="num">${x.me}</td><td class="num">${x.te}</td><td class="num">${x.b.r===-1?'∞':x.b.r}${x.b.adj?`<span title="${esc(T('Az ESI még a job leadása előtti állapotot mutatja ({0} runnal többet). Ezt itt már javítottam; az ESI következő frissítése után a * eltűnik.',x.b.adj))}">*</span>`:''}${x.b.r===0?' <span class="pill warn">'+esc(T('elfogyott'))+'</span>':''}</td><td>${esc(x.char)}</td><td class="small">${esc(x.loc)}</td><td>${j?'<span class="pill warn">jobban</span> ':''}${x.b.r===-1?(max?'<span class="pill ok">max</span>':'<span class="pill warn">kutatható</span>'):''}</td></tr>`}).join('')||'<tr><td colspan="8" class="muted">Nincs találat. Ha még nem frissítettél, a Karakterek fülön tedd meg.</td></tr>';
  const ats=Object.values(DATA).map(d=>d.bpAt).filter(Boolean),exps=Object.values(DATA).map(d=>d.bpExp).filter(Boolean);
  const tf=v=>{const d=new Date(v);const today=d.toDateString()===new Date().toDateString();return (today?'':d.toLocaleDateString(LOC(),{month:'2-digit',day:'2-digit'})+' ')+d.toLocaleTimeString(LOC(),{hour:'2-digit',minute:'2-digit'})};
  const per=CHARS.filter(c=>DATA[c.id]&&DATA[c.id].bpAt).map(c=>c.name+' '+tf(DATA[c.id].bpAt)).join(', ');
  $('#bpCount').textContent=T('{0} blueprint',list.length)+(ats.length?' · '+T('ESI állapot: {0}, legközelebb {1} után frissül. A *: az ESI még nem tud egy gyártásról (fut, vagy a leadás az ESI állapota után történt), ezért a runokat itt javítottam. Az ESI frissülése után eltűnik.',per,tf(Math.max(...exps))):'');
}
function renderStock(){
  const f=$('#stFilter').value.toLowerCase(),lf=$('#stLoc').value,only=$('#stOnlyPlan').checked;
  const sm=stockMap(only);let rows=[];
  for(const [t,arr] of sm){const name=NAMES[t]||'#'+t;if(f&&!name.toLowerCase().includes(f))continue;const a=lf?arr.filter(x=>String(x.l)===lf):arr;const tot=a.reduce((s,x)=>s+x.q,0);if(!tot)continue;rows.push({t,name,tot,a})}
  rows.sort((a,b)=>a.name.localeCompare(b.name,'hu'));
  const pg=pageOf('st',rows,[f,lf,only].join('|'),renderStock);const shown=pg.rows;$('#stPg1').innerHTML=pg.html;$('#stPg2').innerHTML=pg.html;
  $('#stTable tbody').innerHTML=shown.map(r=>`<tr><td>${esc(r.name)}</td><td class="num">${fmt(r.tot)}</td><td class="small">${r.a.map(x=>esc(charName(x.cid))+' · '+esc(locName(x.l))+': <span class="mono">'+fmt(x.q)+'</span>').join('<br>')}</td></tr>`).join('')||'<tr><td colspan="3" class="muted">Nincs adat.</td></tr>';
  $('#stCount').textContent=T('{0} tételtípus',fmt(rows.length));
  const sel=$('#stLoc'),cur=sel.value;sel.innerHTML='<option value="">minden hely</option>'+allLocs().sort((a,b)=>locName(a).localeCompare(locName(b))).map(l=>`<option value="${l}">${esc(locName(l))}</option>`).join('');sel.value=cur;
}
function renderLocList(){
  const ls=allLocs();if(!ls.length)return;const sel=planLocs();
  $('#locList').innerHTML=ls.sort((a,b)=>locName(a).localeCompare(locName(b))).map(l=>`<label class="inline"><input type="checkbox" data-loc="${l}" ${sel.has(l)?'checked':''}> ${esc(locName(l))}</label>`).join('');
}
function renderSettings(){
  $('#sStructME').value=S.structME;$('#sWallet').checked=!!S.wallet;$('#sStructRes').value=S.structRes||0;$('#sStructTE').value=S.structTE;$('#sFacTax').value=S.facTax;$('#sScc').value=S.scc;
  $('#sSalesTax').value=S.salesTax;$('#sBroker').value=S.broker;$('#sYieldBase').value=S.yieldBase;$('#sImplant').value=S.implant;$('#sSystem').value=S.system;$('#sClientId').value=S.clientId;
  $('#sSalesTax').placeholder=fmt(salesTax()*100,2);$('#sBroker').placeholder=fmt(brokerFee()*100,2);
  {const sel=$('#sProdLoc');sel.innerHTML='<option value="">automatikus: a BP helye</option>'+allLocs().sort((a,b)=>locName(a).localeCompare(locName(b))).map(l=>`<option value="${l}">${esc(locName(l))}</option>`).join('');sel.value=S.prodLoc||''}
  {const sel=$('#sMarket2');const hubs=HUBS.filter(h=>h[0]!==JITA_STATION);const own=allLocs().filter(l=>locKind(l)==='npc'&&l!==JITA_STATION&&!hubs.some(h=>h[0]===l)).sort((a,b)=>locName(a).localeCompare(locName(b)));
    sel.innerHTML='<option value="">nincs</option><optgroup label="'+esc(T('Kereskedelmi központok'))+'">'+hubs.map(h=>`<option value="${h[0]}">${esc(h[2])}</option>`).join('')+'</optgroup>'+(own.length?'<optgroup label="'+esc(T('Állomások, ahol van cuccod'))+'">'+own.map(l=>`<option value="${l}">${esc(locName(l))}</option>`).join('')+'</optgroup>':'')+(()=>{const st=allLocs().filter(l=>locKind(l)==='struct').sort((a,b)=>locName(a).localeCompare(locName(b)));return st.length?'<optgroup label="'+esc(T('Struktúrák, ahol van cuccod'))+'">'+st.map(l=>`<option value="${l}">${esc(locName(l))}</option>`).join('')+'</optgroup>':''})();sel.value=S.market2||'';$('#sBuyM2').checked=S.buyM2!==false;$('#sBuyM2').disabled=!S.market2;const mb=$('#sM2Broker');if(mb){const l=Number(S.market2);mb.innerHTML=S.market2&&locKind(l)==='struct'?`<label class="small">${T('{0} broker fee (a tulaj állítja), %',esc(m2Short()))} <input type="number" step="0.1" min="0" max="100" style="width:80px" data-sbroker="${l}" value="${structBrokerOf(l)??''}" placeholder="?"></label> <span class="small muted">${T('+ 0,5% SCC pótdíj. A játékban egy eladási order feladásakor látod. Skillek és standing itt nem számítanak.')}</span>`:''}}
  {const w=workChars();const cs=CHARS.filter(c=>DATA[c.id]);$('#sWorkChars').innerHTML=cs.length?cs.map(c=>`<label class="inline"><input type="checkbox" data-wc="${c.id}" ${w.includes(c.id)?'checked':''}> ${esc(c.name)}</label>`).join(''):'<span class="muted small">'+esc(T('Még nincs karakter.'))+'</span>'}
}
function renderPlanOptions(){
  const names=[...new Set(allBPs().map(b=>NAMES[b.t]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'hu'));
  $('#bpOptions').innerHTML=names.map(n=>`<option value="${esc(n)}">`).join('');
  updateCopySelect();
}
function updateCopySelect(){
  const n=$('#planSearch').value.trim();const list=allBPs().filter(b=>NAMES[b.t]===n).sort((a,b)=>(b.r===-1)-(a.r===-1)||b.me-a.me);
  $('#planCopy').innerHTML=list.map(b=>{const j=inJob(b.i);return `<option value="${b.i}">${b.r===-1?'BPO':'BPC '+b.r+' run'} · ME${b.me} TE${b.te} · ${esc(charName(b.cid))} · ${esc(locName(b.l))}${j?' · '+T('jobban'):''}</option>`}).join('')||'<option value="">nincs ilyen saját BP</option>';
}

/* ---- terv megjelenítés ---- */
let LASTPLAN=null,LASTRENDER=null;
function getOpt(){return {buildOwn:$('#optBuildOwn').checked,useStock:$('#optUseStock').checked,ore:$('#optOre').checked,incoming:$('#optIncoming').checked}}
function copiesOf(bpType){return allBPs().filter(b=>b.t===bpType).sort((a,b)=>(b.r===-1)-(a.r===-1)||b.me-a.me||b.te-a.te)}
async function finishResult(R,firstBP){
  const types=new Set();R.trees.forEach(x=>collectTypes(x.tree,types));
  await resolveNames([...types]);await ensurePrices([...types]);
  await Promise.all([...types].map(t=>refGet('t',t).catch(()=>null)));
  await resolveNames(R.jobs.flatMap(j=>j.miss.map(m=>m[0])));
  R.sys=firstBP?await sysFor(firstBP):null;
  try{await prepHaul(R)}catch(e){log('Szállítás előkészítés: '+e.message)}
  return R;
}
async function runPlan(){
  const itemId=Number($('#planCopy').value);const bp=allBPs().find(b=>b.i===itemId);
  if(!bp){alertBox('Válassz egy saját blueprintet a listából.');return}
  const runs=Math.max(1,Number($('#planRuns').value)||1);
  $('#planOut').innerHTML='<div class="card muted">Számolás…</div>';
  try{
    await indexBPProducts();
    if(!BPPROD[bp.t]){$('#planOut').innerHTML='<div class="card">Ennek a blueprintnek nincs gyártási vagy reakció receptje.</div>';return}
    await prefetchTree(BPPROD[bp.t].prod);
    // a kiválasztott példány az első, utána a többi ugyanilyen BP (ha a runok nem férnek el egy BPC-n)
    const copies=[bp].concat(copiesOf(bp.t).filter(c=>c.i!==bp.i));
    const R=await makeMulti([{copies,runs,label:''}],getOpt());
    await finishResult(R,bp);R.title=fmt(R.trees[0].made)+' × '+(NAMES[R.trees[0].tree.t]||'');
    LASTPLAN=R;LASTRENDER=()=>renderResult($('#planOut'),R,runPlan);LASTRENDER();renderMineNeed();
  }catch(e){$('#planOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';log(e.stack||e.message)}
}
function assignChars(jobs){ // ki csinálja: skill + idő + szabad slot alapján, LPT elosztás
  const cs=workChars();if(!cs.length)return;
  const load={};cs.forEach(c=>load[c]={m:0,r:0,s:0});
  const free=(c,k)=>{const sl=slotsOf(c),bz=busyOf(c);return Math.max(1,sl[k]-bz[k])};
  const tFor=(j,c)=>{const o=j.who;j.who=c;const t=jobTime(j);j.who=o;return t};
  jobs.forEach(j=>{if(j.bp0)j.bp=j.bp0;else j.bp0=j.bp;j.who=null});
  const order=jobs.slice().sort((a,b)=>tFor(b,b.bp.cid)-tFor(a,a.bp.cid));
  for(const j of order){
    const rec=j.rs?{rs:j.rs}:recOf(j.bp.t);const k=slotKey(j.act);
    let cand=cs.filter(c=>!missingSkills(c,rec).length);const noone=!cand.length;if(noone)cand=cs;
    let best=null,bv=Infinity;
    const own=c=>{if(j.bp.virtual)return j.bp;if(c===j.bp.cid)return j.bp;return allBPs().find(b=>b.cid===c&&b.t===j.bp.t&&b.me>=j.bp.me&&(b.r===-1||b.r>=j.runs))};
    for(const c of cand){const v=(load[c][k]+tFor(j,c))/free(c,k)-(own(c)?1:0)-(j.invInfo&&j.invInfo.char===c?1e9:0);if(v<bv){bv=v;best=c}}
    const mine=own(best);if(mine&&mine!==j.bp&&!j.bp.virtual)j.bp=Object.assign({},mine);
    if(j.bp.virtual)j.bp=Object.assign({},j.bp,{cid:best});
    j.who=best;j.miss=missingSkills(best,rec);j.noone=noone;load[best][k]+=tFor(j,best);
  }
}
function nodeCost(n,free){ // egy fa anyagköltsége: vásárlás + saját készlet
  let c=n.buy*buyPrice(n.t);if(!free)c+=n.stock.filter(x=>x.l!=='surplus'&&x.l!=='job').reduce((s,x)=>s+x.q,0)*unitPrice(n.t);
  n.ch.forEach(ch=>c+=nodeCost(ch,free));return c;
}
function prodLocOf(n){if(S.prodLoc)return Number(S.prodLoc);return n.build&&n.build.jobs[0]?n.build.jobs[0].c.l:null}
function haulList(R){ // mit honnan hova kell vinni
  const moves=new Map(),oreRoutes=new Set();
  const add=(from,to,t,q)=>{if(!q||from==null||to==null||from===to)return;const k=from+'|'+to;let m=moves.get(k);if(!m){m=new Map();moves.set(k,m)}m.set(t,(m.get(t)||0)+q)};
  const walk=n=>{if(!n.build)return;const to=prodLocOf(n);
    for(const c of n.ch){
      for(const x of c.stock){if(x.l==='surplus'||x.l==='job')continue;add(x.l,to,c.t,x.q);if(x.ore)oreRoutes.add(x.l+'|'+to)}
      if(c.buy)add(buyAt(c.t),to,c.t,c.buy);
      if(c.build){const got=c.stock.reduce((s,x)=>s+x.q,0);add(prodLocOf(c),to,c.t,Math.max(0,c.need-got))}
      walk(c)}};
  R.trees.forEach(x=>walk(x.tree));
  // érc forrás: mennyiség a pool bejegyzésből nem visszakövethető pontosan -> külön jelöljük
  const sale=new Map();R.trees.forEach(x=>{const from=prodLocOf(x.tree);if(from!=null&&from!==JITA_STATION)sale.set(x.tree.t,(sale.get(x.tree.t)||0)+x.made)});
  return {moves,sale,oreRoutes,from:R.trees[0]?prodLocOf(R.trees[0].tree):null};
}
const volOf=t=>(REFC.t[t]&&REFC.t[t].vol)||0;
/* ---- hajók és útvonalak a szállításhoz ---- */
let SHIPC=load('shipc',{}),ROUTES=load('routes',{});
async function getShipType(t){
  if(SHIPC[t]!==undefined)return SHIPC[t];
  const j=await limit(async()=>{const r=await fetch(REF+'/types/'+t);return r.ok?r.json():null});
  let v=null;
  if(j&&j.category_id===6){const tr=j.traits||{};const cb=[];
    for(const [sk,o] of Object.entries(tr.types||{}))for(const b of Object.values(o||{})){const tx=(b.bonus_text&&b.bonus_text.en)||'';if(/cargo capacity/i.test(tx)&&!/ore hold|fleet hangar/i.test(tx))cb.push([Number(sk),b.bonus])}
    let rb=0;for(const b of Object.values(tr.role_bonuses||{})){const tx=(b.bonus_text&&b.bonus_text.en)||'';if(/cargo capacity/i.test(tx)&&!/ore hold|fleet hangar/i.test(tx))rb+=b.bonus}
    v={n:j.name&&j.name.en,g:j.group_id,cap:j.capacity||0,rs:j.required_skills||{},cb,rb};}
  else v={notShip:true};
  SHIPC[t]=v;store('shipc',SHIPC);return v;
}
async function ownShips(){ // a karakterek hangárjában lévő összerakott hajók, amit a tulajdonos vezetni tud
  const cand=[];for(const c of CHARS){const d=DATA[c.id];if(!d)continue;for(const a of d.assets)if(a.s&&a.f==='Hangar'&&a.q===1)cand.push({cid:c.id,t:a.t,l:a.l})}
  await Promise.all([...new Set(cand.map(x=>x.t))].map(t=>getShipType(t).catch(()=>null)));
  const out=[];
  for(const x of cand){const st=SHIPC[x.t];if(!st||st.notShip||!st.cap)continue;
    const canFly=Object.entries(st.rs).every(([sk,l])=>lvlOf(x.cid,sk)>=l);
    let cap=st.cap;for(const [sk,b] of st.cb)cap*=1+b*lvlOf(x.cid,sk)/100;cap*=1+st.rb/100;
    out.push(Object.assign({},x,{n:st.n,g:st.g,cap,canFly}))}
  return out;
}
const JUMP_SEC={513:120,902:120,941:110,28:75,380:75,1202:45,463:60,543:70};
function sysOfLoc(l){if(l===JITA_STATION)return 30000142;return LOCINFO[l]&&LOCINFO[l].system}
async function ensureRoute(a,b){
  if(a==null||b==null)return null;if(a===b)return 0;const k=a+'|'+b;if(ROUTES[k]!==undefined)return ROUTES[k];
  let n=null;try{const r=await esi('/route/'+a+'/'+b+'/?flag=secure');n=r.length-1}catch(e){try{const r=await esi('/route/'+a+'/'+b+'/');n=r.length-1}catch(e2){n=null}}
  ROUTES[k]=n;store('routes',ROUTES);return n;
}
async function prepHaul(R){
  const H=haulList(R);const pairs=[];
  for(const k of H.moves.keys()){const [f,t]=k.split('|').map(Number);pairs.push([f,t])}
  if(H.sale.size&&H.from!=null)pairs.push([H.from,JITA_STATION]);
  for(const [f,t] of pairs){for(const l of [f,t])if(l!==JITA_STATION&&!LOCINFO[l])await resolveLoc(l)}
  const jumps={};for(const [f,t] of pairs)jumps[f+'|'+t]=await ensureRoute(sysOfLoc(f),sysOfLoc(t));
  R.haulCtx={jumps,ships:await ownShips()};
}
function shipAdvice(R,key,vol,maxUnit){
  const ctx=R.haulCtx;if(!ctx||!vol)return '';const j=ctx.jumps[key];
  const flyable=ctx.ships.filter(x=>x.canFly);const ships=flyable.filter(x=>x.cap>=(maxUnit||0));
  if(!flyable.length)return `<tr><td colspan="3" class="small muted">${j!=null?j+' ugrás (highsec). ':''}Nincs olyan saját hajó, amit a tulajdonosa vezetni tud.</td></tr>`;
  if(!ships.length)return `<tr><td colspan="3" class="small muted">${j!=null?j+' ugrás (highsec). ':''}Egy darab ${fmt(maxUnit)} m³: egyik vezethető hajód rakterébe sem fér bele. Ehhez freighter vagy contract (courier) kell.</td></tr>`;
  const opts=ships.map(x=>{const trips=Math.ceil(vol/x.cap);const per=JUMP_SEC[x.g]||60;const time=j==null?null:(j===0?trips*300:(2*trips-1)*j*per);return Object.assign({trips,time},x)});
  opts.sort((a,b)=>(a.time??a.trips*1e6)-(b.time??b.trips*1e6)||a.trips-b.trips);
  const seen=new Set();const best=opts.filter(o=>{const k=o.t+'|'+o.cid;if(seen.has(k))return false;seen.add(k);return true}).slice(0,3);
  return `<tr><td colspan="3" class="small">${j==null?T('Útvonal nem ismert.')+' ':(j===0?T('Ugyanabban a rendszerben.')+' ':T('<b>{0} ugrás</b> (highsec útvonal).',j)+' ')}${best.map((o,i)=>`${i?'<br>':''}${esc(o.n)} <span class="muted">(${esc(charName(o.cid))}, ${esc(locName(o.l))}, ${T('raktér {0} m³',fmt(o.cap))})</span>: <b>${T('{0} forduló',o.trips)}</b>${o.time!=null?' · '+T('kb. {0}',dur(o.time)):''}`).join('')}</td></tr>`;
}
function renderHaul(R){
  const H=haulList(R);if(!H.moves.size&&!H.sale.size)return '<h3>Szállítás</h3><p class="small muted">Semmit nem kell mozgatni: minden a gyártás helyén van.</p>';
  let tot=0;let h='<h3>Szállítás</h3><p class="small muted">Mit kell a gyártás helyére vinni. A gyártási helyszín a BP helye, vagy amit a Beállításokban megadsz. A térfogat csomagolt m³. A hajójavaslat a karaktereid hangárjában lévő hajókból választ, amit a tulajdonosuk vezetni tud, a raktér a skillbónuszokkal együtt számít. Az idő durva becslés: oda-vissza fordulók, ugrásonként a hajótípustól függő 45–120 mp, a hajó odaútja a kiindulási pontig nélkül. Csak a cargo hold számít, az ore hold és a fittelt bővítők nem.</p><div class="grid2">';
  for(const [k,m] of H.moves){const [from,to]=k.split('|').map(Number);const rows=[...m].map(([t,q])=>({t,q,v:q*volOf(t)}));const sum=rows.reduce((s,r)=>s+(r.v||0),0);tot+=sum;
    h+=`<div class="tablewrap"><table><thead><tr><th colspan="3">${esc(from===JITA_STATION?T('Jita (vásárlás)'):locName(from))} → ${esc(locName(to))} · <span class="mono">${fmt(sum)} m³</span></th></tr></thead><tbody>${rows.sort((a,b)=>(b.v||0)-(a.v||0)).map(r=>`<tr><td>${esc(NAMES[r.t]||r.t)}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.v)} m³</td></tr>`).join('')}${H.oreRoutes.has(k)?'<tr><td colspan="3" class="small muted">Az ásvány egy része ott még ércként van: vagy helyben reprocesszálod, vagy az ércet viszed (más térfogat).</td></tr>':''}${shipAdvice(R,k,sum,Math.max(0,...rows.map(r=>volOf(r.t))))}</tbody></table></div>`}
  if(H.sale.size){const rows=[...H.sale].map(([t,q])=>({t,q,v:q*volOf(t)}));const sum=rows.reduce((s,r)=>s+r.v,0);
    h+=`<div class="tablewrap"><table><thead><tr><th colspan="3">${T('Eladásra: {0} → Jita',esc(locName(H.from)))} · <span class="mono">${fmt(sum)} m³</span></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(NAMES[r.t]||r.t)}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.v)} m³</td></tr>`).join('')}${shipAdvice(R,H.from+'|'+JITA_STATION,sum,Math.max(0,...rows.map(r=>volOf(r.t))))}</tbody></table></div>`}
  h+='</div>';if(tot)h+=`<p class="small muted" style="margin-top:6px">Odaszállítás összesen: <span class="mono">${fmt(tot)} m³</span></p>`;
  return h;
}
function buildUnit(n,sys){ // gyártási egységár: részfa piaci áron + a csomópont jobjai
  if(!n.build||!n.build.made)return null;
  const mat=n.ch.reduce((s,c)=>s+nodeCost(c,false),0);const jc=n.jobsRef.reduce((s,j)=>s+jobCost(j,sys),0);
  return (mat+jc)/n.build.made;
}
function renderResult(el,R,rerun){
  assignChars(R.jobs);
  const free=$('#optStockFree').checked;const fee=salesTax()+brokerFee();
  const rows=R.trees.map(x=>{const p=x.tree.t;const gross=x.made*(sell(p)||0);const jc=R.jobs.filter(j=>j.item===x.item).reduce((s,j)=>s+jobCost(j,R.sys),0);const mat=nodeCost(x.tree,free);const tm=R.jobs.filter(j=>j.item===x.item&&j.top).reduce((m,j)=>Math.max(m,jobTime(j)),0);return {x,p,net:gross*(1-fee),jc,mat,profit:gross*(1-fee)-jc-mat,tm}});
  const buyCost=[...R.buyList].reduce((s,[t,q])=>s+q*buyPrice(t),0);
  const stockCost=free?0:[...R.usedList].reduce((s,[t,q])=>s+q*unitPrice(t),0);
  const jcT=R.jobs.reduce((s,j)=>s+jobCost(j,R.sys),0);
  const net=rows.reduce((s,r)=>s+r.net,0);const profit=net-buyCost-stockCost-jcT;
  const ix=IDX.p[R.sys];const multi=R.trees.length>1;const ixm=ix&&ix.manufacturing;
  let h=`<div class="kpis">
    <div class="kpi"><div class="k">${multi?'Termékek':'Termék'}</div><div class="v" style="font-size:16px">${multi?R.trees.length+' tétel':esc(R.title||'')}</div></div>
    <div class="kpi"><div class="k">Vásárolni kell</div><div class="v">${isk(buyCost)}</div></div>
    <div class="kpi"><div class="k">Saját készlet értéke</div><div class="v">${free?'ingyen':isk(stockCost)}</div></div>
    <div class="kpi"><div class="k">Job költség</div><div class="v">${isk(jcT)}</div></div>
    <div class="kpi"><div class="k">Eladás (Jita sell, díjak után)</div><div class="v">${isk(net)}</div>${m2On()?(()=>{const g=R.trees.reduce((s,x)=>s+x.made*(sell2(x.tree.t)||0),0);const f2=m2Fee();return `<div class="small muted">${esc(m2Short())}: ${f2!=null?isk(g*(1-f2)):isk(g)+' '+T('(díjak nélkül)')}</div>`})():''}</div>
    <div class="kpi"><div class="k">Profit</div><div class="v ${profit>=0?'pos':'neg'}">${isk(profit)}</div></div>
  </div>`;
  h+=`<p class="small muted">${T('Gyártási rendszer: {0}',esc(NAMES[R.sys]||R.sys||T('ismeretlen')))}${ixm!=null?' · cost index '+fmt(ixm*100,2)+'%':''} · sales tax ${fmt(salesTax()*100,2)}% · broker ${fmt(brokerFee()*100,2)}%${bestSeller()?' · '+T('eladó: {0}',esc(charName(bestSeller().cid))):''}</p>`+m2Hint();
  R.warn.forEach(w=>h+=`<div class="notice">${esc(warnText(w))}</div>`);
  // termékenként
  h+=`<h3>Termékenként</h3><div class="tablewrap"><table><thead><tr>${multi?'<th>Projekt</th>':''}<th>Termék</th><th class="num">Db</th><th class="num">Jita sell / db</th>${m2On()?`<th class="num">${esc(m2Short())} sell / db</th>`:''}<th class="num">Eladás díjak után</th><th class="num">Anyag</th><th class="num">Job</th><th class="num">Profit</th><th class="num">Fő job ideje</th></tr></thead><tbody>${rows.map(r=>`<tr>${multi?`<td>${esc(r.x.item.label||'')}</td>`:''}<td>${esc(NAMES[r.p]||r.p)}</td><td class="num">${fmt(r.x.made)}</td><td class="num">${isk(sell(r.p))}</td>${m2On()?`<td class="num">${m2Cell(sell(r.p),sell2(r.p))}</td>`:''}<td class="num">${isk(r.net)}</td><td class="num">${isk(r.mat)}</td><td class="num">${isk(r.jc)}</td><td class="num ${r.profit>=0?'pos':'neg'}">${isk(r.profit)}</td><td class="num">${dur(r.tm)}</td></tr>`).join('')}</tbody></table></div>`;
  if(multi)h+=`<p class="small muted" style="margin-top:4px">A tételenkénti anyagköltségben a másik tétel jobjából maradt felesleg ingyen számít, ezért a sorok összege kicsit eltérhet a fenti összesítéstől.</p>`;
  // bevásárlólista
  const bl=[...R.buyList].sort((a,b)=>b[1]*buyPrice(b[0])-a[1]*buyPrice(a[0]));const bm2=buyM2On();
  h+=`<div class="grid2" style="margin-top:12px"><div><h3>Bevásárlólista</h3><div class="tablewrap"><table><thead><tr><th>Tárgy</th><th class="num">Mennyiség</th><th class="num">Jita sell</th>${m2On()?`<th class="num">${esc(m2Short())} sell</th>`:''}${bm2?'<th>Hol veszed</th>':''}<th class="num">Összesen</th></tr></thead><tbody>${bl.map(([t,q])=>`<tr><td>${esc(NAMES[t]||t)}</td><td class="num">${fmt(q)}</td><td class="num">${unitPrice(t)?isk(unitPrice(t)):'<span class="pill warn">nincs ár</span>'}</td>${m2On()?`<td class="num">${m2Cell(unitPrice(t),sell2(t),true)}</td>`:''}${bm2?`<td class="small" data-noi18n>${buyAt(t)===JITA_STATION?'Jita':esc(m2Short())}</td>`:''}<td class="num">${buyPrice(t)?isk(q*buyPrice(t)):'–'}</td></tr>`).join('')||'<tr><td colspan="6" class="pos">Semmit nem kell venni, minden megvan.</td></tr>'}</tbody></table></div>
  ${bl.some(([t])=>!unitPrice(t))?'<p class="small" style="margin-top:6px;color:var(--warn)">Néhány tételnek nincs Jita ára, ezért 0-val számít a költségekben.</p>':''}
  <p class="small muted" style="margin-top:6px"><button class="btn" data-copybuy>Lista másolása (multibuy formátum)</button></p></div>`;
  // jobok
  h+=`<div><h3>Gyártási jobok</h3><div class="tablewrap"><table><thead><tr><th>Mit</th><th>Ki gyártja</th><th>Melyik BP</th><th class="num">Run</th><th class="num">Idő</th><th class="num">Job költség</th></tr></thead><tbody>${R.jobs.slice().reverse().map(j=>`<tr><td>${esc(NAMES[j.t]||j.t)}${j.act==='r'?' <span class="pill">reakció</span>':''}${j.act==='i'?` <span class="pill">invention</span><div class="src">esély ${fmt(j.invInfo.chance*100,1)}% · ${fmt(j.invInfo.runsPer)} run/BPC · ME${j.invInfo.me} TE${j.invInfo.te}</div>`:''}${j.act==='c'?' <span class="pill">copy</span>':''}${multi&&j.item&&j.item.label?`<div class="src">${esc(j.item.label)}</div>`:''}</td><td><b>${esc(charName(j.who??j.bp.cid))}</b> ${j.who!=null&&j.who!==j.bp.cid?`<span class="pill warn">BP átadása</span><div class="src">${T('most {0}-nál van → add át {1}-nak',esc(charName(j.bp.cid)),esc(charName(j.who)))}</div>`:''}${j.miss.length?`<span class="pill bad">hiányzó skill</span><div class="src">${esc(j.miss.map(m=>(NAMES[m[0]]||m[0])+' '+m[2]+' → '+m[1]).join(', '))}</div>`:'<span class="pill ok">skill ok</span>'}</td><td class="small">${j.bp.virtual?T('inventált BPC'):(j.act==='i'?'T1 ':'')+(j.bp.r===-1?'BPO':'BPC')} ME${j.act==='m'?j.bp.me:(j.bp.virtual?j.bp.me:j.bp.me)} · ${esc(locName(j.bp.l))}${j.short?' <span class="pill bad">nincs elég run</span>':''}</td><td class="num">${j.act==='i'?fmt(Math.ceil(j.runs))+' kísérlet':fmt(j.runs)}</td><td class="num">${dur(jobTime(j))}</td><td class="num">${isk(jobCost(j,R.sys))}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  // karakterek
  const per=new Map();for(const j of R.jobs){const c=j.who??j.bp.cid;let x=per.get(c);if(!x){x={m:0,r:0,s:0,tm:0,tr:0,ts:0,miss:0,mx:0};per.set(c,x)}const jt=jobTime(j);x.mx=Math.max(x.mx,jt);const k=slotKey(j.act);x[k]++;x['t'+k]+=jt;if(j.miss.length)x.miss++}
  h+=`<h3>Karakterek terhelése</h3><p class="small muted">Minden jobot annak a karakternek ajánl, akinek megvannak a skilljei, és akinél a szabad slotok és a gyártási idő alapján a leghamarabb elkészül. Egyenlő esetben marad annál, akinél a BP most van, vagy akinél ugyanilyen BP is van.</p><div class="tablewrap"><table><thead><tr><th>Karakter</th><th class="num">Gyártó job</th><th class="num">Szabad gyártó slot</th><th class="num">Reakció job</th><th class="num">Szabad reakció slot</th><th class="num">Science job</th><th class="num">Szabad science slot</th><th class="num">Össz. idő</th><th class="num">Becsült átfutás</th><th>Megjegyzés</th></tr></thead><tbody>${[...per].map(([c,x])=>{const sl=slotsOf(c),bz=busyOf(c);const fm=Math.max(0,sl.m-bz.m),fr=Math.max(0,sl.r-bz.r),fs=Math.max(0,sl.s-bz.s);const wall=Math.max(x.mx,x.m?x.tm/Math.max(1,fm):0,x.r?x.tr/Math.max(1,fr):0,x.s?x.ts/Math.max(1,fs):0);const notes=[];if(x.miss)notes.push(T('{0} jobhoz egyik karakternek sincs meg a skill',x.miss));if(x.m>fm)notes.push(T('több gyártó job, mint szabad slot: sorban kell futtatni'));if(x.r>fr)notes.push(T('több reakció job, mint szabad slot'));if(x.s>fs)notes.push(T('több science job, mint szabad slot'));return `<tr><td><b>${esc(charName(c))}</b></td><td class="num">${x.m}</td><td class="num">${fm} / ${sl.m}</td><td class="num">${x.r}</td><td class="num">${fr} / ${sl.r}</td><td class="num">${x.s}</td><td class="num">${fs} / ${sl.s}</td><td class="num">${dur(x.tm+x.tr+x.ts)}</td><td class="num">${dur(wall)}</td><td class="small ${notes.length?'':'muted'}">${esc(notes.join('; ')||T('rendben'))}</td></tr>`}).join('')}</tbody></table></div>`;
  h+=renderHaul(R);
  // fák
  h+=`<h3>Anyagfa</h3><p class="small muted">Komponens sorára kattintva: gyártom ↔ veszem. A „Gyártva / Jita” oszlop egy darab árát mutatja: saját gyártásban (anyag piaci áron + job) és megvéve. A zöld az olcsóbb. A „Honnan” oszlopban a hely is látszik.</p>`;
  R.trees.forEach(x=>{h+=`<details ${multi?'':'open'} style="margin-bottom:8px"><summary>${esc((x.item.label?x.item.label+' · ':'')+fmt(x.made)+' × '+(NAMES[x.tree.t]||x.tree.t))}</summary><div class="tablewrap" style="margin-top:6px"><table class="tree"><thead><tr><th>Tárgy</th><th class="num">Kell</th><th class="num">Készletből</th><th class="num">Gyártom</th><th class="num">Veszem</th><th class="num">Gyártva / Jita (db)${m2On()?'<span data-noi18n> · '+esc(m2Short())+'</span>':''}</th><th>Honnan</th></tr></thead><tbody>${treeRows(x.tree,0,R.sys)}</tbody></table></div></details>`});
  el.innerHTML=h;
  const cb=el.querySelector('[data-copybuy]');cb&&cb.addEventListener('click',()=>{const txt=bl.map(([t,q])=>(NAMES[t]||t)+'\t'+q).join('\n');navigator.clipboard.writeText(txt).then(()=>status('lista vágólapon'),()=>status('másolás nem sikerült'))});
  el.querySelectorAll('tr[data-toggle]').forEach(tr=>tr.addEventListener('click',()=>{const t=Number(tr.dataset.toggle);if(S.buyOverride[t])delete S.buyOverride[t];else S.buyOverride[t]=true;saveS();rerun()}));
}
function bbCell(n,d,sys){const up=unitPrice(n.t);const m2=m2On()&&sell2(n.t)?`<div class="small muted">${esc(m2Short())} ${isk(sell2(n.t))}</div>`:'';return bbCell0(n,d,sys,up)+m2}
function bbCell0(n,d,sys,up){if(!n.build)return up?isk(up):'–';const ub=buildUnit(n,sys);if(ub==null)return '–';if(!up)return isk(ub)+' / –';const cheaper=ub<=up;return `<span class="${cheaper?'pos':''}">${isk(ub)}</span> / <span class="${cheaper?'':'pos'}">${isk(up)}</span>`}
function treeRows(n,d,sys){
  const st=n.stock.reduce((s,x)=>s+x.q,0);const canToggle=d>0&&(ownedFor(n.t).length>0);
  const src=n.stock.map(x=>x.l==='surplus'?T('felesleg más jobból'):x.l==='job'?T('futó job ({0})',charName(x.cid)):locName(x.l)+(x.c!=null?' · '+contLabel(x.c):'')+(x.ore?' '+T('(ércből)'):''));
  const where=src.filter((v,i,a)=>a.indexOf(v)===i).map(esc).join(', ');
  const mark=n.inv?`<span class="pill">invention</span> <span class="src">${T('{0}% esély · {1} kísérlet',fmt(n.inv.chance*100,1),n.inv.attempts%1?T('átlag {0}',fmt(n.inv.attempts,2)):fmt(n.inv.attempts))}${n.inv.dec?' · '+esc(DECS[n.inv.dec].n):''}</span>`:canToggle?(S.buyOverride[n.t]?'<span class="pill warn">veszem</span>':(n.build?'<span class="pill ok">gyártom</span>':'')):'';
  let h=`<tr ${canToggle?`data-toggle="${n.t}" style="cursor:pointer" title="Kattints: gyártom / veszem"`:''}><td class="name" style="padding-left:${10+d*18}px">${esc(NAMES[n.t]||n.t)} ${mark}</td><td class="num">${fmt(n.need)}</td><td class="num">${st?fmt(st):'–'}</td><td class="num">${n.build?fmt(n.build.made):'–'}</td><td class="num">${n.buy?fmt(n.buy):'–'}</td><td class="num small">${bbCell(n,d,sys)}</td><td class="src">${where}</td></tr>`;
  n.ch.forEach(c=>h+=treeRows(c,d+1,sys));return h;
}
