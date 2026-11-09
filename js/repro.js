/* IndyOps – Reprocess calculator: what your stock (ore, ice, loot, modules) gives when reprocessed,
 * with each character's skills and implants and each location's yield (NPC station / Upwell structure, rigs, security, tax). */
"use strict";
const SCRAP=12196,ATHANOR=35835,TATARA=35836;
let SYSSEC=load('syssec',{});
const REP={rows:null,sel:new Set(),busy:false};
const repKey=r=>r.l+'|'+r.t;
let REPLOG=[];
function repLog(m){const el=$('#repLog');if(!el)return;el.hidden=false;REPLOG.push(new Date().toLocaleTimeString(LOC())+'  '+m);if(REPLOG.length>300)REPLOG=REPLOG.slice(-300);
  const atEnd=el.scrollTop+el.clientHeight>=el.scrollHeight-20;el.textContent=REPLOG.join('\n');if(atEnd)el.scrollTop=el.scrollHeight}
function repCfg(){if(!S.repro)S.repro={};const c=S.repro;c.loc=c.loc||{};c.imp=c.imp||{};if(c.char==null)c.char='';return c}
// reprocess implant az ESI-ből (Zainou 'Beancounter' Reprocessing RX-801/802/804 = 1/2/4%); null, ha nincs meg az engedély
function impAuto(cid){const d=DATA[cid];if(!d||!Array.isArray(d.imp))return null;let v=0;for(const t of d.imp){const m=/Beancounter.{0,3} Reprocessing RX-80(\d)/i.exec(NAMES[t]||'');if(m)v=Math.max(v,{1:1,2:2,4:4}[m[1]]||0)}return v}
function impOf(cid){const v=repCfg().imp[cid];if(v!=null&&v!==''&&v!=='auto')return Number(v);const a=impAuto(cid);return a!=null?a:Number(S.implant||0)}
function locKind(l){l=Number(l);return l>=60000000&&l<64000000?'npc':l>1e12?'struct':'none'}
function secMod(sys){if(!sys)return 0;if(sys>=31000000&&sys<32000000)return 0.12;const s=SYSSEC[sys];if(s==null)return 0;return s>=0.45?0:s>0?0.06:0.12}
function locStats(l){
  const k=locKind(l),info=LOCINFO[l]||{},c=repCfg().loc[l]||{},st=info.stype||0;
  return {k,sys:info.system,sec:SYSSEC[info.system],st,
    rig:k==='struct'?Number(c.rig||0):0,
    base:k==='npc'&&c.base!=null&&c.base!==''?Number(c.base):50,
    sm:st===TATARA?0.055:st===ATHANOR?0.02:0,
    secm:secMod(info.system),
    tax:c.tax!=null&&c.tax!==''?Number(c.tax):(k==='npc'?5:0)};
}
// hozam az adó előtt (g) és után (y); null, ha ott nem lehet reprocesszálni
function repYield(cid,l,ti){
  const L=locStats(l);if(L.k==='none')return null;let g;
  if(!ti.rs)g=(L.k==='npc'?L.base:50)/100*(1+0.02*lvlOf(cid,SCRAP)); // modul, loot: csak Scrapmetal Processing, rig és implant nem számít
  else{const sk=(1+0.03*lvlOf(cid,SK.repro))*(1+0.02*lvlOf(cid,SK.reproEff))*(1+0.02*lvlOf(cid,ti.rs))*(1+impOf(cid)/100);
    g=L.k==='struct'?(50+L.rig)/100*(1+(L.rig?L.secm:0))*(1+L.sm)*sk:L.base/100*sk}
  return {g,y:g*(1-L.tax/100)};
}
function repChars(){const c=repCfg().char;const all=CHARS.filter(x=>DATA[x.id]).map(x=>x.id);return c&&all.includes(Number(c))?[Number(c)]:all}
function repPick(r){
  const ti=REFC.t[r.t];let best=null;
  for(const cid of repChars()){const y=repYield(cid,r.l,ti);if(!y)continue;
    if(!best||y.y>best.y.y+1e-9||(Math.abs(y.y-best.y.y)<=1e-9&&r.own.has(cid)&&!r.own.has(best.cid)))best={cid,y}}
  return best;
}
function repOut(r,pick){const ti=REFC.t[r.t];const portions=Math.floor(r.q/(ti.p||1));return ti.tm.map(([m,q])=>[m,Math.floor(portions*q*pick.y.y)]).filter(x=>x[1]>0)}
function repPrice(t){const p=PRICES.p[t];if(p&&(p.s||p.b))return {v:p.s??p.b,a:false};const a=ADJ.p&&ADJ.p[t];return {v:a||0,a:true}}
const repIsOre=ti=>ti.c===25;

async function repLocExtra(locs){
  let ch=false;
  for(const l of locs){const info=LOCINFO[l];if(!info)continue;
    if(locKind(l)==='struct'&&info.stype===undefined){info.stype=0;
      for(const c of CHARS){try{const s=await esi('/universe/structures/'+l+'/',{char:c});info.stype=s.type_id||0;if(!info.system)info.system=s.solar_system_id;break}catch(e){}}ch=true}
    if(info.system&&SYSSEC[info.system]==null){try{const s=await esi('/universe/systems/'+info.system+'/');SYSSEC[info.system]=s.security_status}catch(e){}}
  }
  if(ch)store('locinfo',LOCINFO);store('syssec',SYSSEC);
  const st=[...new Set(locs.map(l=>LOCINFO[l]&&LOCINFO[l].stype).filter(Boolean))];if(st.length)await resolveNames(st);
}
async function repLoad(){
  if(REP.busy)return;if(!Object.keys(DATA).length){alertBox('Előbb jelentkezz be, és frissítsd az adatokat.');return}
  REP.busy=true;$('#repLoad').disabled=true;
  try{
    const t0=Date.now();REPLOG=[];const sm=stockMap(false);const types=[...sm.keys()];
    repLog(T('{0} tárgytípus a készletben, receptek lekérése az EVE Refről…',fmt(types.length)));
    const btn=$('#repLoad');let done=0;const prog=()=>{const m=T('Beolvasás: {0} / {1} tárgytípus',fmt(done),fmt(types.length));btn.textContent=m;status(m)};prog();
    const tick=setInterval(prog,400);
    try{await Promise.all(types.map(t=>(REFC.t[t]!==undefined?Promise.resolve(REFC.t[t]):refGet('t',t).then(v=>{repLog((v&&v.n||'#'+t)+(v&&v.tm&&v.tm.length?'  ✓ '+T('reprocesszálható'):''));return v})).catch(e=>{repLog('✗ #'+t+'  '+e.message);log('EVE Ref: '+t+' '+e.message);return null}).finally(()=>done++)))}finally{clearInterval(tick)}
    btn.textContent=T('Helyszínek és árak…');status(T('Helyszínek és árak…'));
    const rows=[],locs=new Set();
    for(const [t,arr] of sm){const ti=REFC.t[t];if(!ti||!ti.tm||!ti.tm.length||ti.c===9)continue;
      const byL=new Map();
      for(const x of arr){if(!(x.q>0))continue;let r=byL.get(x.l);if(!r){r={t,l:x.l,q:0,own:new Map()};byL.set(x.l,r)}r.q+=x.q;r.own.set(x.cid,(r.own.get(x.cid)||0)+x.q)}
      for(const r of byL.values()){rows.push(r);locs.add(r.l)}}
    repLog(T('{0} reprocesszálható tétel, {1} helyszín. Helyszínek lekérése…',fmt(rows.length),fmt(locs.size)));
    await Promise.all([...locs].map(l=>resolveLoc(l).catch(()=>null)));
    await repLocExtra([...locs]);for(const l of locs){const L=locStats(l);repLog(locName(l)+'  · '+(L.k==='npc'?T('NPC állomás'):L.k==='struct'?(NAMES[L.st]||'Upwell'):T('űrben – itt nem lehet'))+(L.sec!=null?'  sec '+fmt(L.sec,2):''))}
    const mats=new Set(rows.flatMap(r=>REFC.t[r.t].tm.map(x=>x[0])));
    await resolveNames([...mats,...rows.map(r=>r.t),...rows.map(r=>REFC.t[r.t].rs).filter(Boolean),SCRAP,SK.repro,SK.reproEff]);
    const its=[...new Set(rows.map(r=>r.t))];repLog(T('Jita árak lekérése: {0} típus…',fmt(its.length<=200?mats.size+its.length:mats.size)));await ensurePrices(its.length<=200?[...mats,...its]:[...mats]); // sok tételnél csak a kijelöltekre, gombbal
    repLog(T('Kész: {0} tétel, {1} mp.',fmt(rows.length),fmt((Date.now()-t0)/1000,1)));
    REP.rows=rows;for(const k of [...REP.sel])if(!rows.some(r=>repKey(r)===k))REP.sel.delete(k);
  }catch(e){repLog('✗ '+e.message);log('Reprocess hiba: '+e.message);alertBox(T('Hiba: {0}',e.message))}
  finally{REP.busy=false;const b=$('#repLoad');b.disabled=false;b.textContent=T('Készlet beolvasása');status('kész')}
  renderRepro();
}
async function repPrices(){
  const sel=(REP.rows||[]).filter(r=>REP.sel.has(repKey(r)));if(!sel.length){alertBox('Jelölj ki legalább egy tételt.');return}
  const mats=new Set(sel.flatMap(r=>REFC.t[r.t].tm.map(x=>x[0])));await ensurePrices([...sel.map(r=>r.t),...mats]);renderRepro();
}

function repFiltered(){
  const loc=$('#repLoc').value,cat=$('#repCat').value,q=$('#repQ').value.trim().toLowerCase(),better=$('#repBetter').checked;
  return (REP.rows||[]).filter(r=>{const ti=REFC.t[r.t];
    if(loc&&String(r.l)!==loc)return false;if(cat==='ore'&&!repIsOre(ti))return false;if(cat==='loot'&&repIsOre(ti))return false;
    if(q&&!(NAMES[r.t]||'').toLowerCase().includes(q))return false;
    if(better){const c=repCalc(r);if(!c.pick||!(c.outV>c.inV))return false}
    return true});
}
function repCalc(r){
  const pick=repPick(r);if(!pick)return {pick:null,out:[],inV:0,outV:0,a:false};
  const out=repOut(r,pick);const pi=repPrice(r.t);let a=pi.a,outV=0;
  for(const [m,q] of out){const p=repPrice(m);if(p.a)a=true;outV+=q*p.v}
  const ti=REFC.t[r.t];const rest=r.q%(ti.p||1);
  const in2=(r.q-rest)*(sell2(r.t)||0),out2=out.reduce((s,[m,q])=>s+q*(sell2(m)||0),0);
  return {pick,out,inV:(r.q-rest)*pi.v,outV,a,rest,in2,out2};
}

function renderRepro(){
  const box=$('#repOut');if(!box)return;
  renderRepChars();
  if(!REP.rows){box.innerHTML='<p class="muted">Nyomd meg a „Készlet beolvasása” gombot. A tool végignézi a készletet, és kilistázza, mi reprocesszálható belőle.</p>';$('#repLocs').innerHTML='';$('#repSum').innerHTML='';return}
  // szűrők
  const locs=[...new Set(REP.rows.map(r=>r.l))].sort((a,b)=>locName(a).localeCompare(locName(b)));
  const ls=$('#repLoc'),cur=ls.value;ls.innerHTML='<option value="">minden helyszín</option>'+locs.map(l=>`<option value="${l}">${esc(locName(l))}</option>`).join('');ls.value=locs.map(String).includes(cur)?cur:'';
  renderRepLocs(locs);
  const rows=repFiltered().map(r=>Object.assign({r},repCalc(r))).sort((a,b)=>b.outV-a.outV||b.inV-a.inV);
  const LIM=400;const shown=rows.slice(0,LIM);
  const allOn=shown.length&&shown.every(x=>REP.sel.has(repKey(x.r)));
  box.innerHTML=!rows.length?'<p class="muted">Nincs a szűrésnek megfelelő reprocesszálható tétel.</p>':
  `<div class="tablewrap"><table><thead><tr><th><input type="checkbox" id="repAll" ${allOn?'checked':''} aria-label="Mind kijelölése"></th><th>Tárgy</th><th>Helyszín</th><th class="num">Db</th><th>Ki · hozam</th><th>Mi jön ki belőle</th><th class="num">Egyben</th><th class="num">Szétszedve</th><th>Jobb</th></tr></thead><tbody>${shown.map(x=>{const r=x.r,k=repKey(r);
    const who=x.pick?`${esc(charName(x.pick.cid))} · <span class="mono">${fmt(x.pick.y.y*100,1)}%</span>${r.own.has(x.pick.cid)?'':` <span class="pill warn" title="${T('A tárgy másik karakternél van, át kell adni.')}">⇄</span>`}`:'<span class="muted">itt nem lehet</span>';
    const top=x.out.slice().sort((a,b)=>b[1]*repPrice(b[0]).v-a[1]*repPrice(a[0]).v).slice(0,4).map(([m,q])=>esc(NAMES[m]||m)+' '+fmt(q)).join(', ')+(x.out.length>4?' …':'');
    const verdict=!x.pick||!x.inV&&!x.outV?'':x.outV>x.inV?'<span class="pill ok">reprocess</span>':'<span class="pill warn">eladás</span>';
    return `<tr><td><input type="checkbox" data-rk="${k}" ${REP.sel.has(k)?'checked':''}></td><td>${esc(NAMES[r.t]||r.t)}</td><td class="small">${esc(locName(r.l))}</td><td class="num">${fmt(r.q)}${x.rest?`<div class="small muted">${T('{0} marad',fmt(x.rest))}</div>`:''}</td><td class="small">${who}</td><td class="small">${top||'–'}</td><td class="num">${x.inV?(repPrice(r.t).a?'~':'')+isk(x.inV):'–'}${m2On()&&x.in2?`<div class="small muted">${esc(m2Short())} ${isk(x.in2)}</div>`:''}</td><td class="num">${x.outV?(x.out.some(([m])=>repPrice(m).a)?'~':'')+isk(x.outV):'–'}${m2On()&&x.out2?`<div class="small muted">${esc(m2Short())} ${isk(x.out2)}</div>`:''}</td><td>${verdict}</td></tr>`}).join('')}</tbody></table></div>
  ${rows.length>LIM?`<p class="small muted">${T('Az első {0} tétel látszik ({1}-ból). Szűkíts a szűrőkkel.',LIM,fmt(rows.length))}</p>`:''}
  <p class="small muted" style="margin-top:6px">Az értékek Jita sell árak. A ~ jelű sorokhoz még nincs friss Jita ár, ott az ESI átlagár a becslés; a „Jita árak a kijelöltekre” gomb pontosítja. A „marad” a portion alatti maradék, az nem dolgozható fel.</p>`;
  renderRepSum();
}
function renderRepChars(){
  const el=$('#repChars');if(!el)return;const cs=CHARS.filter(c=>DATA[c.id]);
  if(!cs.length){el.innerHTML='<p class="muted">Még nincs karakter.</p>';return}
  const cfg=repCfg();const imps=[[0,'nincs'],[1,'RX-801 (1%)'],[2,'RX-802 (2%)'],[4,'RX-804 (4%)']];
  el.innerHTML=`<div class="tablewrap"><table><thead><tr><th>Karakter</th><th class="num">Reprocessing</th><th class="num" title="Reprocessing Efficiency">Efficiency</th><th class="num" title="Scrapmetal Processing">Scrapmetal</th><th>Implant</th></tr></thead><tbody>${cs.map(c=>`<tr><td>${esc(c.name)}</td><td class="num">${lvlOf(c.id,SK.repro)}</td><td class="num">${lvlOf(c.id,SK.reproEff)}</td><td class="num">${lvlOf(c.id,SCRAP)}</td><td>${(()=>{const man=cfg.imp[c.id];const isMan=man!=null&&man!==''&&man!=='auto';const a=impAuto(c.id);const an=a==null?T('nem ismert'):(imps.find(x=>x[0]===a)||[0,a+'%'])[1];return `<select data-imp="${c.id}"><option value="auto" ${isMan?'':'selected'}>${esc(T('ESI szerint: {0}',an))}</option>${imps.map(([v,n])=>`<option value="${v}" ${isMan&&Number(man)===v?'selected':''}>${n}</option>`).join('')}</select>${a==null?`<div class="small muted">${T('Jelentkezz be újra, hogy az implant automatikus legyen.')}</div>`:''}`})()}</td></tr>`).join('')}</tbody></table></div>
  <div class="row" style="margin-top:8px"><label>Ki reprocesszál <select id="repWho"><option value="">a legjobb hozamú karakter</option>${cs.map(c=>`<option value="${c.id}" ${String(cfg.char)===String(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div>
  <p class="small muted" style="margin-top:6px">Az érc- és ice-feldolgozó skilleket (pl. Simple Ore Processing) tárgyanként veszi figyelembe. Az implantot az ESI-ből olvassa (az aktív klónból); ha reprocesszáláshoz klónt váltasz, itt kézzel is beállíthatod. Modulra és lootra csak a Scrapmetal Processing hat.</p>`;
}
function renderRepLocs(locs){
  const el=$('#repLocs');const cs=repChars();
  const kindName=(L)=>L.k==='npc'?T('NPC állomás'):L.k==='struct'?(L.st?(NAMES[L.st]||'Upwell'):'Upwell'):T('űrben – itt nem lehet');
  el.innerHTML=`<div class="tablewrap"><table><thead><tr><th>Helyszín</th><th>Típus</th><th class="num">Sec</th><th>Rig</th><th class="num">Adó %</th><th class="num">Alap %</th><th class="num">Érc hozam</th><th class="num">Loot hozam</th></tr></thead><tbody>${locs.map(l=>{const L=locStats(l);const c=repCfg().loc[l]||{};
    const best=(ti)=>{let b=null;for(const cid of cs){const y=repYield(cid,l,ti);if(y&&(!b||y.y>b.y))b={y:y.y,cid}}return b};
    const yo=best({rs:-1,c:25,tm:[]}),yl=best({rs:null,c:7,tm:[]});
    const show=b=>b?`<span class="mono">${fmt(b.y*100,1)}%</span>${cs.length>1?`<div class="small muted">${esc(charName(b.cid))}</div>`:''}`:'–';
    return `<tr><td>${esc(locName(l))}</td><td class="small">${esc(kindName(L))}</td><td class="num">${L.sec!=null?fmt(L.sec,2):'–'}</td>
    <td>${L.k==='struct'?`<select data-rig="${l}">${[[0,'nincs'],[1,'T1'],[3,'T2']].map(([v,n])=>`<option value="${v}" ${L.rig===v?'selected':''}>${n}</option>`).join('')}</select>`:'<span class="muted">–</span>'}</td>
    <td class="num">${L.k==='none'?'–':`<input type="number" step="0.1" min="0" max="100" style="width:70px" data-tax="${l}" value="${c.tax!=null&&c.tax!==''?c.tax:''}" placeholder="${L.k==='npc'?5:0}">`}</td>
    <td class="num">${L.k==='npc'?`<input type="number" step="1" min="0" max="100" style="width:60px" data-base="${l}" value="${c.base!=null&&c.base!==''?c.base:''}" placeholder="50">`:L.k==='struct'?'50':'–'}</td>
    <td class="num">${show(yo)}</td><td class="num">${show(yl)}</td></tr>`}).join('')}</tbody></table></div>
  <p class="small muted" style="margin-top:6px">Érc hozam: érc-feldolgozó skill nélkül számolva, a tárgyankénti skill a listában benne van. Upwell struktúránál az alap 50%, plusz a rig (T1 +1, T2 +3), a rendszer biztonsága (lowsec +6%, null és WH +12%, csak riggel) és a struktúra bónusza (Athanor +2%, Tatara +5,5%). NPC állomáson az adó 0 standingnél 5%, 6,67 standingnél 0%; a struktúra adóját a tulajdonos állítja. Az adót a kinyert anyagból vonja le.</p>`;
}
function renderRepSum(){
  const el=$('#repSum');const sel=(REP.rows||[]).filter(r=>REP.sel.has(repKey(r)));
  if(!sel.length){el.innerHTML='<p class="muted">Jelölj ki tételeket a listában (vagy a fejlécben mindet), és itt összesíti, mi jön ki belőlük.</p>';return}
  const mats=new Map(),steps=new Map();let inV=0,outV=0,in2=0,out2=0,a=false,none=0;
  for(const r of sel){const c=repCalc(r);if(!c.pick){none++;continue}inV+=c.inV;outV+=c.outV;in2+=c.in2;out2+=c.out2;if(c.a)a=true;
    c.out.forEach(([m,q])=>mats.set(m,(mats.get(m)||0)+q));
    const k=r.l+'|'+c.pick.cid;let s=steps.get(k);if(!s){s={l:r.l,cid:c.pick.cid,n:0,from:new Set()};steps.set(k,s)}s.n++;
    for(const o of r.own.keys())if(o!==c.pick.cid)s.from.add(o)}
  const ml=[...mats].sort((x,y)=>y[1]*repPrice(y[0]).v-x[1]*repPrice(x[0]).v);
  let cover='';
  if(typeof LASTPLAN!=='undefined'&&LASTPLAN){const need=[...LASTPLAN.buyList].filter(([t])=>mats.has(t));
    cover=need.length?`<h3>${T('A „{0}” terv hiányából',esc(LASTPLAN.title||''))}</h3><div class="tablewrap"><table><thead><tr><th>Anyag</th><th class="num">Hiány</th><th class="num">Reprocessből</th><th class="num">Fedezet</th></tr></thead><tbody>${need.map(([t,q])=>{const b=mats.get(t)||0;return `<tr><td>${esc(NAMES[t]||t)}</td><td class="num">${fmt(q)}</td><td class="num">${fmt(b)}</td><td class="num"><span class="pill ${b>=q?'ok':'warn'}">${fmt(Math.min(100,b/q*100))}%</span></td></tr>`}).join('')}</tbody></table></div>`:`<p class="small muted">${T('A „{0}” terv hiányában nincs olyan anyag, ami ebből kijön.',esc(LASTPLAN.title||''))}</p>`}
  el.innerHTML=`<div class="row"><b>${T('{0} tétel kijelölve',fmt(sel.length))}</b><button class="btn" id="repPrice">Jita árak a kijelöltekre</button><button class="btn" id="repClear">Kijelölés törlése</button></div>
  <div class="grid2" style="margin-top:10px"><div>
  <h3>Mi jön ki</h3><div class="tablewrap"><table><thead><tr><th>Anyag</th><th class="num">Mennyiség</th><th class="num">Érték</th></tr></thead><tbody>${ml.map(([m,q])=>{const p=repPrice(m);return `<tr><td>${esc(NAMES[m]||m)}</td><td class="num">${fmt(q)}</td><td class="num">${p.a?'~':''}${isk(q*p.v)}</td></tr>`}).join('')}
  <tr><td><b>Összesen</b></td><td></td><td class="num"><b>${a?'~':''}${isk(outV)}</b></td></tr></tbody></table></div>
  <p class="small">${T('Egyben eladva: {0} · szétszedve: {1}',(a?'~':'')+isk(inV),(a?'~':'')+isk(outV))} · <span class="pill ${outV>inV?'ok':'warn'}">${outV>inV?T('reprocess +{0}',isk(outV-inV)):T('eladás +{0}',isk(inV-outV))}</span></p>
  ${m2On()&&(in2||out2)?`<p class="small">${esc(m2Short())}: ${T('Egyben eladva: {0} · szétszedve: {1}',isk(in2),isk(out2))}</p>`:''}
  ${sellerHtml()}
  ${none?`<p class="small muted">${T('{0} tétel olyan helyen van, ahol nem lehet reprocesszálni (pl. űrben).',none)}</p>`:''}
  </div><div>
  <h3>Hol és ki</h3><div class="tablewrap"><table><thead><tr><th>Helyszín</th><th>Karakter</th><th class="num">Tétel</th><th>Megjegyzés</th></tr></thead><tbody>${[...steps.values()].map(s=>`<tr><td>${esc(locName(s.l))}</td><td>${esc(charName(s.cid))}</td><td class="num">${fmt(s.n)}</td><td class="small">${s.from.size?T('Át kell adni tőle: {0}',[...s.from].map(charName).join(', ')):''}</td></tr>`).join('')}</tbody></table></div>
  ${cover}</div></div>`;
}

// események
(function(){
  const tab=document.getElementById('tab-repro');if(!tab)return;
  const save=()=>{saveS();renderRepro()};
  tab.addEventListener('click',e=>{
    if(e.target.id==='repLoad')repLoad();
    else if(e.target.id==='repPrice')repPrices();
    else if(e.target.id==='repClear'){REP.sel.clear();renderRepro()}
  });
  tab.addEventListener('change',e=>{const t=e.target,cfg=repCfg();
    if(t.dataset.rk){t.checked?REP.sel.add(t.dataset.rk):REP.sel.delete(t.dataset.rk);renderRepSum();
      const all=$('#repAll');if(all){const bs=[...tab.querySelectorAll('[data-rk]')];all.checked=bs.length&&bs.every(b=>b.checked)}}
    else if(t.id==='repAll'){tab.querySelectorAll('[data-rk]').forEach(b=>{b.checked=t.checked;t.checked?REP.sel.add(b.dataset.rk):REP.sel.delete(b.dataset.rk)});renderRepSum()}
    else if(t.dataset.imp){if(t.value==='auto')delete cfg.imp[t.dataset.imp];else cfg.imp[t.dataset.imp]=Number(t.value);save()}
    else if(t.id==='repWho'){cfg.char=t.value;save()}
    else if(t.dataset.rig){(cfg.loc[t.dataset.rig]=cfg.loc[t.dataset.rig]||{}).rig=Number(t.value);save()}
    else if(t.dataset.tax!=null&&t.dataset.tax!==''){(cfg.loc[t.dataset.tax]=cfg.loc[t.dataset.tax]||{}).tax=t.value;save()}
    else if(t.dataset.base){(cfg.loc[t.dataset.base]=cfg.loc[t.dataset.base]||{}).base=t.value;save()}
    else if(['repLoc','repCat','repBetter'].includes(t.id))renderRepro();
  });
  let qt=null;tab.addEventListener('input',e=>{if(e.target.id==='repQ'){clearTimeout(qt);qt=setTimeout(renderRepro,200)}});
})();
