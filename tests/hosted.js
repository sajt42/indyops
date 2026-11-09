const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync(process.env.HTML||'../dist/indyops.html','utf8').replace(/<link[^>]+>/g,'');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errs.push(e.message));
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
const jwt='x.'+b64({sub:'CHARACTER:EVE:777',name:'Pilot A',scp:['esi-assets.read_assets.v1']})+'.y';
let tokenBody=null;
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://sajt42.github.io/indyops/?code=CODE123&state=ST1',virtualConsole:vc,beforeParse(w){
  // régi Gyártópult-adatok + folyamatban lévő bejelentkezés
  w.localStorage.setItem('gyp.settings',JSON.stringify({lang:'en',structME:1}));
  w.localStorage.setItem('gyp.projects',JSON.stringify([{id:1,name:'Old project',active:true,items:[]}]));
  w.localStorage.setItem('indyops.pkce',JSON.stringify({verifier:'VER',state:'ST1',cid:'b02779a9ea1c427bb46c9d70a697a4c7'}));
  w.fetch=async(u,o)=>{u=String(u);if(u.includes('/oauth/token')){tokenBody=o.body;return {ok:true,status:200,text:async()=>JSON.stringify({access_token:jwt,refresh_token:'R',expires_in:1200})}}
    return {ok:false,status:500,headers:{get:()=>null},text:async()=>'no',json:async()=>({})}};
}});
const w=dom.window,d=w.document;
setTimeout(()=>{
  console.log('token request:',tokenBody);
  console.log('chars:',w.localStorage.getItem('indyops.chars'));
  console.log('url after:',w.location.href);
  console.log('migrated settings:',w.localStorage.getItem('indyops.settings'),'| projects:',w.localStorage.getItem('indyops.projects'));
  console.log('setup box hidden (built-in client id):',d.querySelector('#setupBox').hidden,'| cidNote visible:',!d.querySelector('#cidNote').hidden);
  d.querySelector('#bugBtn').dispatchEvent(new w.Event('click'));
  const href=d.querySelector('#bugBtn').href;console.log('bug link:',href.slice(0,70),'... len',href.length);
  console.log('body has version:',decodeURIComponent(href).includes('IndyOps v1.0.0'),'| lang:',d.documentElement.lang,'| bug label:',d.querySelector('#bugBtn').textContent);
  console.log('footer:',d.querySelector('.fwrap').textContent.replace(/\s+/g,' ').trim().slice(0,240));
  console.log('errors:',errs.length?errs:'none');
},400);
