// Unknown locations: EVE Ref lookup and manual names
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('../dist/indyops.html','utf8').replace(/<link[^>]+>/g,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.org/'});const w=dom.window;let evCalls=0;
w.fetch=async(u)=>{u=String(u);const J=d=>({ok:true,status:200,headers:{get:()=>null},json:async()=>d,text:async()=>JSON.stringify(d)});
  if(u.includes('data.everef.net/structures')){evCalls++;return J({1000000000009:{name:'Perimeter - Public Hall',solar_system_id:30000144,type_id:35832}})}
  if(u.includes('/universe/names/'))return J([]);
  throw new Error('unmocked '+u)};
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
w.localStorage.setItem('indyops.settings',JSON.stringify({lang:process.env.LANGX||'hu'}));
w.eval(code+`;window.__t={everefLocs,renderAll,locName,setData:d=>{DATA=d},setChars:c=>{CHARS=c},LI:LOCINFO,names:NAMES,get S(){return S}};`);
const T=w.__t,d=w.document,tick=()=>new Promise(r=>setTimeout(r,30));
(async()=>{await tick();
  T.setChars([{id:1,name:'Pilot A',refresh:'x',access:'x',exp:Date.now()+1e9}]);
  T.LI[1000000000009]={name:'Ismeretlen hely #1000000000009',system:null,unk:1,tried:Date.now()};
  T.LI[1000000000010]={name:'Ismeretlen hely #1000000000010',system:null}; // régi, jelző nélküli bejegyzés
  T.LI[60000004]={name:'Test Station I',system:30001};
  Object.assign(T.names,{638:'Raven',34:'Tritanium'});
  T.setData({1:{assets:[{t:638,q:1,l:1000000000009,f:'Hangar'},{t:34,q:500,l:1000000000010,f:'Hangar'},{t:638,q:1,l:1000000000010,f:'Hangar'},{t:34,q:1,l:60000004,f:'Hangar'}],bps:[],skills:{},jobs:[],lm:{1000000000010:{t:'item',f:{Hangar:1,AssetSafety:1}}}}});
  T.renderAll();
  console.log('before:',T.locName(1000000000009),'|',T.locName(1000000000010));
  console.log('stock note:',d.querySelector('#unkNote').textContent.trim());
  const n=await T.everefLocs(true);
  console.log('everef found:',n,'calls:',evCalls,'|',T.locName(1000000000009),'sys',T.LI[1000000000009].system);
  const rows=[...d.querySelectorAll('#unkLocs tbody tr')].map(r=>r.textContent.replace(/\s+/g,' ').trim());
  console.log('table:',rows.join(' / '),'| card hidden:',d.querySelector('#unkLocs').closest('.card').hidden);
  const inp=d.querySelector('[data-locname="1000000000010"]');inp.value='Isinokka - Malac kuckó';inp.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  console.log('named:',T.locName(1000000000010),'| note:',JSON.stringify(d.querySelector('#unkNote').textContent.trim()),'| saved:',JSON.stringify(T.S.locNames));
  console.log('second auto call skipped:',await T.everefLocs(false),'calls:',evCalls);
})().catch(e=>console.error('FAIL',e));
