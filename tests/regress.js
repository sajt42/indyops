// Regression tests with real assertions for the review fixes. Prints "FAIL: …" on any failed check.
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('../dist/indyops.html','utf8').replace(/<link[^>]+>/g,'');
const fx=JSON.parse(fs.readFileSync('fixture.json','utf8'));
let prices={34:3.81,35:15.87,36:56.685,37:219.8,38:777,39:1137.5,40:2093.5,57478:48300,57479:3.93e6,57486:91385,638:152.3e6};
let failPrice=new Set(),tokenCalls=0,route=null,sec={};
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.org/'});const w=dom.window;
w.fetch=async(u,o)=>{u=String(u);const J=(d,h={})=>({ok:true,status:200,headers:{get:k=>h[k]??null},json:async()=>d,text:async()=>JSON.stringify(d)});let m;
  if(u.includes('login.eveonline.com/v2/oauth/token')){tokenCalls++;await new Promise(r=>setTimeout(r,30));return J({access_token:'a.'+Buffer.from(JSON.stringify({scp:[]})).toString('base64')+'.c',expires_in:1200,refresh_token:'r2'})}
  if(m=u.match(/everef\.net\/blueprints\/(\d+)/))return fx.B[m[1]]?J(fx.B[m[1]]):{ok:false,status:404,headers:{get:()=>null}};
  if(m=u.match(/everef\.net\/types\/(\d+)/))return fx.T[m[1]]?J(fx.T[m[1]]):{ok:false,status:404,headers:{get:()=>null}};
  if(m=u.match(/orders\/\?type_id=(\d+)/)){if(failPrice.has(Number(m[1])))return {ok:false,status:503,headers:{get:()=>null},text:async()=>'down'};const p=prices[m[1]];return J(p?[{location_id:60003760,is_buy_order:false,price:p}]:[])}
  if(u.includes('/markets/prices/'))return J([{type_id:34,adjusted_price:3.2},{type_id:35,adjusted_price:13},{type_id:36,adjusted_price:40},{type_id:37,adjusted_price:200},{type_id:38,adjusted_price:700},{type_id:39,adjusted_price:1000},{type_id:40,adjusted_price:2000}]);
  if(u.includes('/industry/systems/'))return J([{solar_system_id:30001,cost_indices:[{activity:'manufacturing',cost_index:0.02}]},{solar_system_id:30002,cost_indices:[{activity:'manufacturing',cost_index:0.08}]}]);
  if(m=u.match(/\/route\/(\d+)\/(\d+)\/(\?flag=secure)?/)){const r=route(Number(m[1]),Number(m[2]),!!m[3]);return r?J(r):{ok:false,status:404,headers:{get:()=>null},text:async()=>'no route'}}
  if(m=u.match(/universe\/systems\/(\d+)/))return J({security_status:sec[m[1]]??0.9});
  if(u.includes('/universe/names/'))return J([]);
  if(m=u.match(/universe\/stations\/(\d+)/))return J({name:'Station '+m[1],system_id:m[1]==='60000005'?30002:30001});
  throw new Error('unmocked '+u)};
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
w.localStorage.setItem('indyops.settings',JSON.stringify({lang:'hu'}));
w.eval(code+`;window.__t={makePlan,makeMulti,indexBPProducts,ensurePrices,finishResult,renderResult,ensureRoute,haulList,assignChars,accessToken,validateBackup,priceFail,jobCost,assignJobSys,
  get PRICES(){return PRICES},get IDX(){return IDX},get ADJ(){return ADJ},get S(){return S},setData:d=>{DATA=d},setChars:c=>{CHARS=c},names:NAMES,LI:LOCINFO,SYSSEC};`);
const T=w.__t,d=w.document;let fails=0,checks=0;
const ok=(c,msg)=>{checks++;if(!c){fails++;console.log('FAIL: '+msg)}};
(async()=>{
  const L=60000004,L2=60000005;T.LI[L]={name:'Test Station I',system:30001};T.LI[L2]={name:'Test Station II',system:30002};
  T.setChars([{id:1,name:'Pilot A',refresh:'x',access:'x',exp:Date.now()+1e9}]);
  const bps=[{i:101,t:688,me:10,te:20,r:8,q:-2,l:L},{i:102,t:57515,me:10,te:20,r:-1,q:-1,l:L2},{i:103,t:57523,me:10,te:20,r:-1,q:-1,l:L},{i:104,t:57516,me:10,te:18,r:-1,q:-1,l:L}];
  T.setData({1:{assets:[],bps,skills:{3380:5,3388:4},jobs:[],at:Date.now()}});await T.indexBPProducts();

  // 1. failed price fetch keeps the last good price; a type without any price stays "no price", not 0-cost-fresh
  await T.ensurePrices([34]);const good=T.PRICES.p[34].s;
  T.PRICES.p[34].at=Date.now()-31*60000;failPrice=new Set([34,35]);delete T.PRICES.p[35];await T.ensurePrices([34,35]);
  ok(T.PRICES.p[34].s===good,'price 34 kept after failure ('+T.PRICES.p[34].s+')');ok(!!T.PRICES.p[34].err,'price 34 marked as error');
  ok(T.PRICES.p[35].s==null&&Date.now()-T.PRICES.p[35].at>=24*60000,'price 35 unknown and retried within ~5 minutes');
  failPrice=new Set();

  // 2. unpriced material → profit "nem számolható"
  delete prices[39];delete T.PRICES.p[39];
  const R=await T.makeMulti([{copies:[{cid:1,...bps[0]}],runs:2}],{useStock:true,buildOwn:true,incoming:false,ore:false});R.title='Raven';await T.finishResult(R,{cid:1,...bps[0]});
  const el=d.createElement('div');d.body.appendChild(el);T.renderResult(el,R,()=>{});
  ok(/nem számolható/.test(el.textContent),'profit KPI says not computable when a material has no price');
  ok(/nincs piaci ára/.test(el.textContent),'notice lists unpriced items');
  prices[39]=1137.5;

  // 3. per-job system: component BP in another system gets that system's index
  const sys=new Set(R.jobs.map(j=>j.sys));ok(sys.has(30001)&&sys.has(30002),'jobs use their own systems ('+[...sys].join(',')+')');
  const j2=Object.assign({},R.jobs.find(j=>j.sys===30002),{base:[[34,1000]]}),c2=T.jobCost(j2),c1=T.jobCost(Object.assign({},j2,{sys:30001}));ok(c2>c1&&c1>0,'higher index in system 30002 gives higher job cost ('+c1.toFixed(0)+' vs '+c2.toFixed(0)+')');
  T.S.prodLoc=L;await T.assignJobSys(R.jobs);ok(R.jobs.every(j=>j.sys===30001),'production location override puts all jobs in its system');T.S.prodLoc='';

  // 4. route safety: label highsec only if every system is highsec
  sec={30010:0.9,30011:0.3,30012:0.8,30020:0.9,30021:0.6,30022:0.5};
  route=(a,b,secure)=>a===30010?(secure?null:[30010,30011,30012]):[30020,30021,30022];
  const r1=await T.ensureRoute(30010,30012),r2=await T.ensureRoute(30020,30022);
  ok(r1&&r1.hs===false&&r1.n===2,'fallback route through lowsec is not highsec');ok(r2&&r2.hs===true,'all-highsec route is highsec');

  // 5. sale hauling grouped by origin
  const mkTree=(t,l)=>({tree:{t,buy:0,stock:[],ch:[],build:{jobs:[{c:{l}}]}},made:1});
  const H=T.haulList({trees:[mkTree(638,L),mkTree(639,L2)],jobs:[]});
  ok(H.sale.size===2&&H.sale.get(L).has(638)&&H.sale.get(L2).has(639),'sale grouped by origin');

  // 6. one token refresh for parallel calls
  const c={id:9,name:'X',refresh:'r',access:null,exp:0};T.setChars([c]);tokenCalls=0;
  await Promise.all([1,2,3,4,5].map(()=>T.accessToken(c)));ok(tokenCalls===1,'token refreshed once for 5 parallel calls ('+tokenCalls+')');

  // 7. backup validation
  ok(T.validateBackup({app:'indyops',projects:[{id:1,name:'A',items:[{bpType:688,runs:1}]}],settings:{}}).err.length===0,'valid backup accepted');
  ok(T.validateBackup({app:'indyops',projects:'x'}).err.length>0,'projects not a list rejected');
  ok(T.validateBackup({app:'indyops',projects:[{id:1,name:'A',items:[{runs:-1}]}]}).err.length>0,'invalid item rejected');
  ok(T.validateBackup({app:'indyops',settings:[1]}).err.length>0,'settings array rejected');

  // 8. waiting for slot when no free slot
  T.setChars([{id:1,name:'Pilot A',refresh:'x',access:'x',exp:Date.now()+1e9}]);
  T.setData({1:{assets:[],bps,skills:{},jobs:[{act:1,st:'active',runs:1,bp:688,bpi:999,loc:L}],at:Date.now()}});
  const jobs=[{t:638,bp:{cid:1,t:688,l:L,me:10,te:20,r:8},runs:1,act:'m',time:3600,base:[],miss:[],item:{}}];T.assignChars(jobs);
  ok(jobs[0].wait===true,'job flagged as waiting when the only manufacturing slot is busy');
  console.log(`regress: ${checks-fails}/${checks} checks passed`);
})().catch(e=>console.error('FAIL',e));
