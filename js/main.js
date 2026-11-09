/* IndyOps – Event wiring, backup/restore, bug report, start-up. */
"use strict";
/* ============ események ============ */
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;showTab(b.dataset.tab)});
function showTab(t){$$('#tabs button').forEach(x=>x.setAttribute('aria-selected',x.dataset.tab===t));$$('main>section').forEach(s=>s.hidden=s.id!=='tab-'+t);if(t==='mine')renderMineNeed();if(t==='repro')renderRepro()}
document.addEventListener('click',e=>{const a=e.target.closest('[data-goto]');if(a){e.preventDefault();showTab(a.dataset.goto)}});
$('#saveClientId').onclick=()=>{S.clientId=$('#clientIdInput').value.trim();saveS();renderAll()};
$('#addChar').onclick=startLogin;$('#cbSubmit').onclick=finishLogin;$('#cbCancel').onclick=()=>$('#loginPaste').hidden=true;
$('#refreshAll').onclick=refreshAll;
$('#charList').addEventListener('click',e=>{const r=e.target.closest('[data-ref]'),d=e.target.closest('[data-del]');if(e.target.closest('[data-relog]')){startLogin();return}
  if(r){const c=CHARS.find(x=>x.id==r.dataset.ref);c&&refreshChar(c)}
  if(d){CHARS=CHARS.filter(x=>x.id!=d.dataset.del);delete DATA[d.dataset.del];store('chars',CHARS);store('data',DATA);renderAll()}});
['#bpFilter','#bpKind','#bpNotMax'].forEach(s=>$(s).addEventListener('input',renderBPs));
$$('#bpTable th.sortable').forEach(th=>th.addEventListener('click',()=>{const k=th.dataset.k;bpSort=bpSort.k===k?{k,d:-bpSort.d}:{k,d:1};renderBPs()}));
['#stFilter','#stLoc','#stOnlyPlan'].forEach(s=>$(s).addEventListener('input',renderStock));
$('#planSearch').addEventListener('input',updateCopySelect);$('#planGo').onclick=runPlan;
$('#optStockFree').addEventListener('change',()=>LASTRENDER&&LASTRENDER());
$('#pAdd').onclick=()=>{const n=$('#pNew').value.trim();if(!n){alertBox('Adj nevet a projektnek.');return}const p={id:Date.now(),name:n,active:true,items:[]};PROJ.push(p);SELP=p.id;$('#pNew').value='';saveP();renderProjects()};
$('#pList').addEventListener('click',e=>{const sel=e.target.closest('[data-psel]'),up=e.target.closest('[data-pup]'),dn=e.target.closest('[data-pdown]');if(sel){SELP=Number(sel.dataset.psel);saveP();renderProjects()}if(up){const i=Number(up.dataset.pup);[PROJ[i-1],PROJ[i]]=[PROJ[i],PROJ[i-1]];saveP();renderProjects()}if(dn){const i=Number(dn.dataset.pdown);[PROJ[i+1],PROJ[i]]=[PROJ[i],PROJ[i+1]];saveP();renderProjects()}});
$('#pList').addEventListener('change',e=>{const c=e.target.closest('[data-pact]');if(c){const p=PROJ.find(x=>x.id==c.dataset.pact);p.active=c.checked;saveP()}});
$('#pAll').onclick=()=>{const act=PROJ.filter(p=>p.active);if(!act.length){alertBox('Nincs aktív projekt. Pipáld be, melyik számítson.');return}calcProjects(act)};
$('#prGo').onclick=()=>runProfit().catch(e=>{$('#prOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';status('kész')});
['#prOnlyPos','#prMinVol'].forEach(x=>$(x).addEventListener('input',()=>PROFROWS.length&&renderProfit()));
$('#ivGo').onclick=()=>runInvention().catch(e=>{$('#ivOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';log(e.stack||e.message);status('kész')});
$('#rsGo').onclick=()=>runResearch().catch(e=>{$('#rsOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';log(e.stack||e.message);status('kész')});
['#rsFilter','#rsNotMax'].forEach(x=>$(x).addEventListener('input',()=>RESROWS.length&&renderResearch()));
$('#slGo').onclick=async()=>{try{await ensurePrices([...new Set(CHARS.flatMap(c=>((DATA[c.id]||{}).tx||[]).map(x=>x.t)))]);await runSales()}catch(e){$('#slOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';status('kész')}};
$('#cbGo').onclick=()=>runCanBuild().catch(e=>{$('#cbOut').innerHTML='<div class="notice err"><p>'+esc(e.message)+'</p></div>';status('kész')});
$('#scanGo').onclick=()=>runScan().catch(e=>alertBox(e.message));
$('#locList').addEventListener('change',()=>{S.locs=$$('#locList input[data-loc]').filter(x=>x.checked).map(x=>Number(x.dataset.loc));saveS();renderStock()});
$('#locAll').onclick=()=>{S.locs=null;saveS();renderLocList()};$('#locNone').onclick=()=>{S.locs=[];saveS();renderLocList()};
const bind=(sel,key,num)=>$(sel).addEventListener('change',e=>{S[key]=num&&e.target.value!==''?Number(e.target.value):e.target.value;saveS();renderSettings()});
bind('#sStructME','structME',1);bind('#sStructRes','structRes',1);bind('#sStructTE','structTE',1);bind('#sFacTax','facTax',1);bind('#sScc','scc',1);bind('#sSalesTax','salesTax',1);bind('#sBroker','broker',1);bind('#sYieldBase','yieldBase',1);bind('#sImplant','implant',1);bind('#sSystem','system',0);bind('#sClientId','clientId',0);
$('#sProdLoc').addEventListener('change',e=>{S.prodLoc=e.target.value;saveS();LASTRENDER&&LASTRENDER()});
$('#sWallet').addEventListener('change',e=>{S.wallet=e.target.checked;saveS();renderChars()});
$('#sMarket2').addEventListener('change',e=>{S.market2=e.target.value?Number(e.target.value):'';saveS();renderSettings();status(T('Második piac: {0}. Az árak a következő számolásnál töltődnek le.',S.market2?m2Short():T('nincs')))});
$('#sWorkChars').addEventListener('change',e=>{const ids=$$('#sWorkChars input[data-wc]').filter(x=>x.checked).map(x=>Number(x.dataset.wc));const all=CHARS.filter(c=>DATA[c.id]).length;S.workChars=ids.length&&ids.length<all?ids:null;saveS();renderAll();try{LASTRENDER&&LASTRENDER()}catch(e){}});
$('#clearPrices').onclick=()=>{PRICES={at:0,p:{}};store('prices',PRICES);status('árak törölve')};
$('#clearRef').onclick=()=>{REFC={t:{},b:{},v3:1};BPPROD={};store('ref',REFC);status('receptek törölve')};
$('#clearAllBtn').onclick=()=>$('#clearConfirm').hidden=false;$('#clearNo').onclick=()=>$('#clearConfirm').hidden=true;
$('#clearYes').onclick=()=>{try{Object.keys(localStorage).filter(k=>k.startsWith(SP)||k.startsWith('gyp.')).forEach(k=>localStorage.removeItem(k))}catch(e){}location.reload()};

/* ---- mentés / visszatöltés ---- */
$('#expTokens').addEventListener('change',e=>$('#expWarn').hidden=!e.target.checked);
$('#expBtn').onclick=()=>{
  const withTok=$('#expTokens').checked;
  const data={app:'indyops',version:APP.version,v:1,at:new Date().toISOString(),settings:S,projects:PROJ,selp:SELP,
    chars:withTok?CHARS:CHARS.map(c=>({id:c.id,name:c.name})),withTokens:withTok};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='indyops-backup-'+new Date().toISOString().slice(0,10)+(withTok?'-with-logins':'')+'.json';
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);status('mentés letöltve');
};
$('#impFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;const rd=new FileReader();
  rd.onload=()=>{let d;try{d=JSON.parse(rd.result)}catch(x){alertBox('Ez nem egy IndyOps mentésfájl (nem olvasható JSON).');return}
    if(!d||(d.app!=='indyops'&&d.app!=='gyartopult')){alertBox('Ez nem egy IndyOps mentésfájl.');return}
    const box=$('#impConfirm');box.hidden=false;
    box.innerHTML=`<p>Mentés dátuma: <b>${esc(new Date(d.at).toLocaleString(LOC()))}</b> · ${(d.projects||[]).length} projekt · ${(d.chars||[]).length} karakter${d.withTokens?' (bejelentkezésekkel)':' (bejelentkezések nélkül)'}.</p><p>A visszatöltés felülírja a mostani beállításokat és projekteket.${d.withTokens?' A karakterek bejelentkezései is visszaállnak.':' A karaktereket utána újra be kell jelentkeztetni, ha ebben a böngészőben még nincsenek.'}</p><div class="row"><button class="btn primary" id="impYes">Visszatöltés</button><button class="btn" id="impNo">Mégse</button></div>`;
    $('#impNo').onclick=()=>{box.hidden=true;e.target.value=''};
    $('#impYes').onclick=()=>{
      S=Object.assign({},S,d.settings||{});saveS();PROJ=d.projects||[];SELP=d.selp??(PROJ[0]?PROJ[0].id:null);saveP();
      if(d.withTokens&&Array.isArray(d.chars)){for(const c of d.chars){if(!c.refresh)continue;CHARS=CHARS.filter(x=>x.id!==c.id).concat(c)}store('chars',CHARS)}
      box.hidden=true;e.target.value='';renderAll();status('visszatöltve');
    };
  };
  rd.readAsText(f);
});

$('#langSel').innerHTML=Object.entries(LANGS).map(([k,v])=>`<option value="${k}" ${k===LANG?'selected':''}>${v.name}</option>`).join('');
$('#langSel').addEventListener('change',e=>setLang(e.target.value));
$('#appVer').textContent='v'+APP.version;$('#hdrVer').textContent='v'+APP.version;$('#hdrVer').title=APP.built;$('#srcLink').href='https://github.com/'+APP.repo;$('#cidNote').hidden=!HOSTED;
$('#bugBtn').addEventListener('click',()=>{
  const logTxt=($('#log').textContent||'').split('\n').slice(0,30).join('\n').slice(0,2500);
  const tab=((document.querySelector('#tabs button[aria-selected="true"]')||{}).dataset||{}).tab||'';
  const body=T('**Mi történt?**')+'\n\n\n'+T('**Mit vártál helyette?**')+'\n\n\n---\n'+APP.name+' v'+APP.version+' ('+APP.built+') · '+LANG+' · '+(HOSTED?'web':'local')+' · tab: '+tab+'\n'+navigator.userAgent+'\n\n'+T('Napló (a jelentés nyilvános: küldés előtt töröld belőle, amit nem szeretnél megosztani):')+'\n```\n'+logTxt+'\n```\n';
  $('#bugBtn').href='https://github.com/'+APP.repo+'/issues/new?'+new URLSearchParams({title:'[bug] ',body}).toString();
});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.locname){S.locNames=S.locNames||{};const v=t.value.trim();if(v)S.locNames[t.dataset.locname]=v;else delete S.locNames[t.dataset.locname];saveS();renderAll()}});
$('#unkEveref').addEventListener('click',async e=>{e.target.disabled=true;const n=await everefLocs(true);e.target.disabled=false;status(n?T('EVE Ref: {0} ismeretlen hely neve meglett.',n):T('EVE Ref: nem találtam az ismeretlen helyeket (valószínűleg privát struktúrák).'))});
renderAll();
updateHelpLang();
startI18n();
handleRedirect();
everefLocs(false);
