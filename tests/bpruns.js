// BPC runs: jobs started after ESI's cached blueprint snapshot are subtracted
const {JSDOM}=require('jsdom');const fs=require('fs');
const html=fs.readFileSync('../dist/indyops.html','utf8').replace(/<link[^>]+>/g,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://example.org/'});const w=dom.window;
const LM='Tue, 10 Nov 2026 07:00:00 GMT',EXP='Tue, 10 Nov 2026 08:00:00 GMT';
w.fetch=async(u,o)=>{u=String(u);const J=(d,h={})=>({ok:true,status:200,headers:{get:k=>h[k.toLowerCase()]??null},json:async()=>d,text:async()=>JSON.stringify(d)});
  if(u.includes('/blueprints/'))return J([{item_id:5,type_id:688,runs:6,material_efficiency:10,time_efficiency:20,quantity:-2,location_id:60000004},{item_id:6,type_id:688,runs:1,material_efficiency:10,time_efficiency:20,quantity:-2,location_id:60000004},{item_id:7,type_id:688,runs:3,material_efficiency:10,time_efficiency:20,quantity:-2,location_id:60000004}],{'last-modified':LM,expires:EXP});
  if(u.includes('include_completed'))return J([{job_id:9,blueprint_id:7,blueprint_type_id:688,activity_id:1,runs:2,start_date:'2026-11-10T06:20:00Z',end_date:'2026-11-10T06:50:00Z',completed_date:'2026-11-10T07:50:00Z',facility_id:60000004,product_type_id:638,status:'delivered'}]);
  if(u.includes('/industry/jobs/'))return J([{job_id:1,blueprint_id:5,blueprint_type_id:688,activity_id:1,runs:1,start_date:'2026-11-10T07:30:00Z',end_date:'2026-11-11T07:30:00Z',facility_id:60000004,product_type_id:638,status:'active'},
    {job_id:2,blueprint_id:6,blueprint_type_id:688,activity_id:1,runs:1,start_date:'2026-11-10T07:40:00Z',end_date:'2026-11-11T07:30:00Z',facility_id:60000004,product_type_id:638,status:'active'},
    {job_id:3,blueprint_id:7,blueprint_type_id:688,activity_id:1,runs:1,start_date:'2026-11-09T21:00:00Z',end_date:'2026-11-09T22:00:00Z',facility_id:60000004,product_type_id:638,status:'ready'}]);
  if(u.includes('/skills/'))return J({skills:[]});
  if(u.includes('/assets/'))return J([]);
  if(u.includes('/universe/names/'))return J([]);
  if(u.includes('/universe/stations/'))return J({name:'Test Station I',system_id:30001});
  return J([]);};
const code=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
w.localStorage.setItem('indyops.settings',JSON.stringify({lang:'hu'}));
w.eval(code+`;window.__t={refreshChar,setChars:c=>{CHARS=c},get DATA(){return DATA}};`);
const T=w.__t,d=w.document;
(async()=>{const c={id:1,name:'Pilot A',refresh:'x',access:'x',exp:Date.now()+1e9,scp:[]};T.setChars([c]);await T.refreshChar(c);
  console.log('runs:',T.DATA[1].bps.map(b=>b.i+':'+b.r+(b.adj?'*':'')).join(' '));
  console.log('bp tab:',[...d.querySelectorAll('#bpTable tbody tr')].map(r=>r.children[4].textContent).join(' | '));
  console.log('banner:',d.querySelector('#dvNote').textContent.trim()||'(none)');
  T.DATA[1].dv=1;w.eval('renderAll()');console.log('banner old:',d.querySelector('#dvNote').textContent.trim().slice(0,90));
  console.log('count:',d.querySelector('#bpCount').textContent);
})().catch(e=>console.error('FAIL',e));
