// Reprocess tab: yields per character / location, selection, summary
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('../dist/indyops.html','utf8').replace(/<link[^>]+>/g,'');
const L1=60000004,L2=1000000000001;
const types={
  1230:{name:{en:'Veldspar'},group_id:462,category_id:25,portion_size:100,volume:0.1,type_materials:{34:{material_type_id:34,quantity:400}},dogma_attributes:{790:{value:60377}}},
  2001:{name:{en:'Test Gun I'},group_id:55,category_id:7,portion_size:1,volume:5,type_materials:{34:{material_type_id:34,quantity:100},35:{material_type_id:35,quantity:50}}},
  2002:{name:{en:'Test Gun I Blueprint'},group_id:56,category_id:9,portion_size:1,volume:0.01,type_materials:{34:{material_type_id:34,quantity:1}}},
  34:{name:{en:'Tritanium'},category_id:4,portion_size:1},35:{name:{en:'Pyerite'},category_id:4,portion_size:1},
  3645:{name:{en:'Water'},category_id:17,portion_size:1}};
const prices={34:4,35:10,1230:15,2001:2000};
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.org/'});const w=dom.window;
w.fetch=async(u,o)=>{u=String(u);const J=d=>({ok:true,status:200,headers:{get:()=>null},json:async()=>d,text:async()=>JSON.stringify(d)});let m;
  if(m=u.match(/everef\.net\/types\/(\d+)/))return types[m[1]]?J(types[m[1]]):{ok:false,status:404,headers:{get:()=>null}};
  if(m=u.match(/orders\/\?type_id=(\d+)/)){const p=prices[m[1]];return J(p?[{location_id:60003760,is_buy_order:false,price:p}]:[])}
  if(u.includes('/markets/prices/'))return J([{type_id:34,adjusted_price:3},{type_id:35,adjusted_price:9},{type_id:2001,adjusted_price:1500}]);
  if(u.includes('/industry/systems/'))return J([]);
  if(u.includes('/universe/names/'))return J([]);
  if(u.includes('/universe/stations/'))return J({name:'Test Station I',system_id:30001});
  if(u.includes('/universe/structures/'))return J({name:'Test Citadel',solar_system_id:30002,type_id:35836});
  if(m=u.match(/universe\/systems\/(\d+)/))return J({security_status:m[1]==='30001'?0.9:0.3});
  throw new Error('unmocked '+u)};
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
w.localStorage.setItem('indyops.settings',JSON.stringify({lang:process.env.LANGX||'hu'}));
w.eval(code+`;window.__t={repLoad,renderRepro,setData:d=>{DATA=d},setChars:c=>{CHARS=c},names:NAMES,get S(){return S},REP,showTab};`);
const T=w.__t,d=w.document,tick=()=>new Promise(r=>setTimeout(r,30));
const rows=sel=>[...d.querySelectorAll(sel+' tbody tr')].map(r=>r.textContent.replace(/\s+/g,' ').trim());
(async()=>{
  T.setChars([{id:1,name:'Pilot A',refresh:'x',access:'x',exp:Date.now()+1e9},{id:2,name:'Pilot B',refresh:'x',access:'x',exp:Date.now()+1e9}]);
  T.setData({1:{assets:[{t:1230,q:1000,l:L1,f:'Hangar'},{t:2001,q:3,l:L1,f:'Hangar'},{t:2002,q:1,l:L1,f:'Hangar'},{t:3645,q:5,l:L1,f:'Hangar'},{t:2001,q:1,l:L1,f:'HiSlot0'}],bps:[],skills:{3385:5,3389:4,60377:4},jobs:[]},
             2:{assets:[{t:1230,q:1050,l:L2,f:'Hangar'}],bps:[],skills:{3385:5,3389:5,60377:5,12196:5},jobs:[]}});
  Object.assign(T.names,{34:'Tritanium',35:'Pyerite',60377:'Simple Ore Processing',35836:'Tatara'});
  T.showTab('repro');await T.repLoad();await tick();
  console.log('LOCS1:',rows('#repLocs').join(' / '));
  const rig=d.querySelector('[data-rig]');rig.value='3';rig.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  console.log('LOCS2:',rows('#repLocs').join(' / '));
  console.log('CHARS:',rows('#repChars').join(' / '));
  console.log('ROWS:',rows('#repOut').join(' / '));
  const all=d.querySelector('#repAll');all.checked=true;all.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  console.log('SUM:',d.querySelector('#repSum').textContent.replace(/\s+/g,' ').trim());
  const imp=d.querySelector('[data-imp="1"]');imp.value='4';imp.dispatchEvent(new w.Event('change',{bubbles:true}));
  const who=d.querySelector('#repWho');who.value='1';who.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  console.log('A ONLY:',rows('#repOut').join(' / '));
  const cat=d.querySelector('#repCat');cat.value='loot';cat.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
  console.log('LOOT:',rows('#repOut').join(' / '));
  console.log('saved:',JSON.stringify(T.S.repro));
})().catch(e=>console.error('FAIL',e));
