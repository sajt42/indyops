/* IndyOps – Constants, i18n engine, formatting, local storage, settings and state. */
"use strict";
/* ============ alapok ============ */
const CALLBACK_LOCAL='https://localhost/callback';
const SCOPES=['esi-assets.read_assets.v1','esi-characters.read_blueprints.v1','esi-skills.read_skills.v1','esi-industry.read_character_jobs.v1','esi-universe.read_structures.v1','esi-markets.read_character_orders.v1','esi-clones.read_implants.v1','esi-markets.structure_markets.v1','esi-characters.read_standings.v1'];
const WALLET_SCOPE='esi-wallet.read_character_wallet.v1';
function scopesNeeded(){return S.wallet?SCOPES.concat([WALLET_SCOPE]):SCOPES.slice()}
function scpOf(token){try{const v=jwtPayload(token).scp;return Array.isArray(v)?v:(v?[v]:[])}catch(e){return []}}
const hasScope=(c,sc)=>!!(c&&c.scp&&c.scp.includes(sc));
const ESI='https://esi.evetech.net/latest';
const REF='https://ref-data.everef.net';
const JITA_REGION=10000002, JITA_STATION=60003760;
const SK={connections:3359,diplomacy:3357,industry:3380,advInd:3388,accounting:16622,broker:3446,repro:3385,reproEff:3389,massProd:3387,advMassProd:24625,massReac:45748,advMassReac:45749,science:3402,labOp:3406,advLabOp:24624,metallurgy:3409,research:3403};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
/* ============ nyelv / i18n ============ */
const LANGS={en:{loc:'en-US',name:'English',dur:['d','h','m']},de:{loc:'de-DE',name:'Deutsch',dur:['T','h','min']},hu:{loc:'hu-HU',name:'Magyar',dur:['n','ó','p']}};
const APP={name:'IndyOps',version:'1.7.1',built:'2026-11-10',repo:'sajt42/indyops',home:'https://sajt42.github.io/indyops/',clientId:'b02779a9ea1c427bb46c9d70a697a4c7',author:'SajT'};
const HOSTED=typeof location!=='undefined'&&(location.href.split(/[?#]/)[0]===APP.home||location.href.split(/[?#]/)[0]===APP.home+'index.html');
const SP='indyops.';
try{if(!localStorage.getItem(SP+'settings')){Object.keys(localStorage).filter(k=>k.startsWith('gyp.')).forEach(k=>localStorage.setItem(SP+k.slice(4),localStorage.getItem(k)))}}catch(e){} // régi Gyártópult-adatok átvétele
let LANG=(()=>{try{const st=JSON.parse(localStorage.getItem(SP+'settings')||'{}');if(st.lang&&LANGS[st.lang])return st.lang}catch(e){}const n=String(navigator.language||'en').slice(0,2).toLowerCase();return LANGS[n]?n:'en'})();
const LOC=()=>LANGS[LANG].loc;
const DICT=()=>(window.I18N&&window.I18N[LANG])||{};
function T(hu,...a){const tr=LANG==='hu'?hu:(DICT()[hu]??hu);return a.length?tr.replace(/\{(\d+)\}/g,(m,i)=>a[i]??''):tr}
const NUMRE=/\d+(?:[   .,]\d+)*/g;
function trString(src){
  if(LANG==='hu')return src;const m=src.match(/^(\s*)([\s\S]*?)(\s*)$/);const core=m[2].replace(/\s+/g,' ');
  if(!core||!/[A-Za-zÀ-ž]/.test(core))return src;const d=DICT();
  if(d[core]!=null)return m[1]+d[core]+m[3];
  const nums=[];const key=core.replace(NUMRE,x=>{nums.push(x);return '#'});const t=d[key];if(t==null)return src;
  let i=0;return m[1]+t.replace(/#/g,()=>nums[i++]??'')+m[3];
}
const I18N_SKIP=new Set(['SCRIPT','STYLE','CODE','TEXTAREA','OPTION_SKIP']);
function trText(n){
  const p=n.parentNode;if(!p||I18N_SKIP.has(p.nodeName)||(p.closest&&p.closest('[data-noi18n]')))return;
  if(n.__hu===undefined||(n.nodeValue!==n.__tr&&n.nodeValue!==n.__hu))n.__hu=n.nodeValue;
  const out=trString(n.__hu);n.__tr=out;if(n.nodeValue!==out)n.nodeValue=out;
}
const I18N_ATTRS=['placeholder','title','aria-label'];
function trAttrs(el){
  if(el.closest&&el.closest('[data-noi18n]'))return;
  for(const a of I18N_ATTRS){if(!el.hasAttribute||!el.hasAttribute(a))continue;const k='data-hu-'+a;const cur=el.getAttribute(a);
    if(!el.hasAttribute(k)||(cur!==el.getAttribute(k)&&cur!==el.__trA?.[a]))el.setAttribute(k,cur);
    const out=trString(el.getAttribute(k));el.__trA=el.__trA||{};el.__trA[a]=out;if(cur!==out)el.setAttribute(a,out)}
}
function trTree(root){
  if(!root)return;if(root.nodeType===3){trText(root);return}if(root.nodeType!==1)return;
  trAttrs(root);const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let n;
  while((n=w.nextNode())){if(n.nodeType===3)trText(n);else trAttrs(n)}
}
let I18N_OBS=null;
function startI18n(){
  trTree(document.body);document.documentElement.lang=LANG;
  if(I18N_OBS)return;
  I18N_OBS=new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='characterData'){if(m.target.nodeValue!==m.target.__tr)trText(m.target)}
    else if(m.type==='attributes'){trAttrs(m.target)}
    else m.addedNodes.forEach(trTree)}});
  I18N_OBS.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS});
}
function updateHelpLang(){document.querySelectorAll('#tab-help [data-lang]').forEach(d=>d.hidden=d.dataset.lang!==(document.querySelector('#tab-help [data-lang="'+LANG+'"]')?LANG:'en'))}
function setLang(l){if(!LANGS[l])return;LANG=l;try{S.lang=l;saveS()}catch(e){}trTree(document.body);document.documentElement.lang=LANG;updateHelpLang();try{renderAll();LASTRENDER&&LASTRENDER()}catch(e){}}
const fmt=(n,d=0)=>n==null||isNaN(n)?'–':Number(n).toLocaleString(LOC(),{maximumFractionDigits:d,minimumFractionDigits:d});
const isk=n=>{if(n==null||isNaN(n))return'–';const a=Math.abs(n);if(a>=1e9)return fmt(n/1e9,2)+' B';if(a>=1e6)return fmt(n/1e6,1)+' M';if(a>=1e3)return fmt(n/1e3,1)+' k';return fmt(n,a<100?2:0)};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dur=s=>{s=Math.round(s);const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);const u=LANGS[LANG].dur;return (d?d+u[0]+' ':'')+(h||d?h+u[1]+' ':'')+m+u[2]};
function store(k,v){try{localStorage.setItem(SP+k,JSON.stringify(v));return true}catch(e){log('Tárolási hiba ('+k+'): '+e.message);storageWarn();return false}}
function storageWarn(){const el=document.getElementById('storageWarn');if(el)el.hidden=false}
function load(k,def){try{const v=localStorage.getItem(SP+k);return v==null?def:JSON.parse(v)}catch(e){return def}}
function log(m){const el=$('#log');el.textContent=(new Date().toLocaleTimeString(LOC())+'  '+m+'\n')+el.textContent.slice(0,20000)}
function status(m){$('#status').textContent=m}

let S=Object.assign({clientId:'',structME:0,structTE:0,prodLoc:'',facTax:0.25,scc:4,salesTax:'',broker:'',yieldBase:50,implant:0,system:'',skillChar:null,locs:null,buyOverride:{}},load('settings',{}));
let CHARS=load('chars',[]);           // [{id,name,refresh,access,exp}]
let DATA=load('data',{});             // charId -> {assets,bps,skills,jobs,at}
let NAMES=load('names',{});           // id -> name
let LOCINFO=load('locinfo',{});       // locId -> {name,system}
let REFC=load('ref',{t:{},b:{},v3:1});     // everef cache
if(!REFC.v3)REFC={t:REFC.t||{},b:{},v3:1}; // régi cache: BP-k újratöltése (invention/research adatok miatt)
let PRICES=load('prices',{at:0,p:{}});// typeId -> {s,b,at}
let ADJ=load('adj',{at:0,p:{}});      // adjusted prices
let IDX=load('idx2',{at:0,p:{}});     // systemId -> {activity: cost index}
let ORES=load('ores',null);           // [typeIds] category 25
const saveS=()=>store('settings',S);
