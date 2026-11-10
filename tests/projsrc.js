// Project material sources: locations, containers, reserved containers, item-level override
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const fx = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.__htmlCheck = true;
w.fetch = async u => {
  u = String(u);
  const J = d => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => d,
    text: async () => JSON.stringify(d)
  });
  let m;
  if ((m = u.match(/everef\.net\/blueprints\/(\d+)/)))
    return fx.B[m[1]] ? J(fx.B[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if ((m = u.match(/everef\.net\/types\/(\d+)/)))
    return fx.T[m[1]] ? J(fx.T[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if (u.includes('/universe/names/')) return J([]);
  if (u.includes('/markets/') || u.includes('/industry/')) return J([]);
  throw new Error('unmocked ' + u);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu' }));
w.eval(
  code +
    `;window.__t={buyAt,buyPrice,PRICES,makeMulti,buildPool,indexBPProducts,setProj:a=>{PROJ=a;SELP=a[0].id},renderProjects,setData:d=>{DATA=d},setChars:c=>{CHARS=c},LI:LOCINFO,names:NAMES,get S(){return S},get PROJ(){return PROJ}};`
);
const T = w.__t,
  d = w.document,
  tick = () => new Promise(r => setTimeout(r, 20));
(async () => {
  const L = 60000004,
    L2 = 60000005;
  T.LI[L] = { name: 'Test Station I', system: 30001 };
  T.LI[L2] = { name: 'Test Station II', system: 30001 };
  T.setChars([{ id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
  T.setData({
    1: {
      assets: [
        { t: 34, q: 1000, l: L, f: 'Hangar', c: 9001 },
        { t: 34, q: 5000000, l: L, f: 'Hangar', c: null },
        { t: 34, q: 300, l: L2, f: 'Hangar', c: null },
        { t: 3466, q: 1, l: L, f: 'Hangar', c: null, s: 1 }
      ],
      bps: [{ i: 101, t: 688, me: 10, te: 20, r: 8, q: -2, l: L }],
      skills: {},
      jobs: [],
      cont: { 9001: { n: 'Raven doboz', t: 3466, l: L, pc: null, f: 'Hangar' } },
      at: Date.now()
    }
  });
  Object.assign(T.names, { 3466: 'Large Secure Container', 34: 'Tritanium' });
  T.S.locs = null;
  await T.indexBPProducts();
  const opt = { useStock: true, buildOwn: false, incoming: false, ore: false };
  const run = async items => {
    const shared = { pool: await T.buildPool(opt), runsLeft: new Map() };
    const out = [];
    for (const it of items) {
      const r = await T.makeMulti([it], opt, shared);
      out.push(r);
    }
    return out;
  };
  const bp = { cid: 1, i: 101, t: 688, me: 10, te: 20, r: 8, l: L };
  const used = r => r.usedList.get(34) || 0,
    buy = r => r.buyList.get(34) || 0;
  // 1. default: everything from plan locations
  let [r] = await run([{ copies: [bp], runs: 1 }]);
  const need = used(r) + buy(r);
  console.log('need trit:', need, 'default used:', used(r), 'buy:', buy(r));
  // 2. only container 9001
  [r] = await run([{ copies: [bp], runs: 1, src: { mode: 'sel', conts: [9001] }, pid: 1 }]);
  console.log('container only used:', used(r), 'buy:', buy(r));
  // 3. only station 2
  [r] = await run([{ copies: [bp], runs: 1, src: { mode: 'sel', locs: [L2] }, pid: 1 }]);
  console.log('station2 used:', used(r), 'buy:', buy(r));
  // 4. reserved container: project 1 reserves 9001; project 2 (default) must not touch it
  T.setProj([
    { id: 1, name: 'Raven', active: true, items: [], src: { mode: 'sel', conts: [9001], excl: [9001] } },
    { id: 2, name: 'Other', active: true, items: [] }
  ]);
  const [r1, r2] = await run([
    { copies: [bp], runs: 1, pid: 2 },
    { copies: [bp], runs: 1, src: { mode: 'sel', conts: [9001], excl: [9001] }, pid: 1 }
  ]);
  const fromC = r => {
    let s = 0;
    const walk = n => {
      n.stock.forEach(x => {
        if (x.c === 9001) s += x.q;
      });
      n.ch.forEach(walk);
    };
    r.trees.forEach(t => walk(t.tree));
    return s;
  };
  console.log('reserved: other project took from box:', fromC(r1), '| owner project took from box:', fromC(r2));
  // 5. UI
  T.setProj([{ id: 1, name: 'Raven', active: true, items: [{ bpType: 688, runs: 1 }] }]);
  T.renderProjects();
  const radio = d.querySelector('input[name="psrcm"][value="sel"]');
  radio.checked = true;
  radio.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();
  const ex = d.querySelector('[data-sexcl="p|9001"]');
  ex.checked = true;
  ex.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();
  const sl = d.querySelector('[data-sloc="p|' + L2 + '"]');
  sl.checked = true;
  sl.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();
  const isel = d.querySelector('[data-isrc="0"]');
  isel.value = 'sel';
  isel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick();
  console.log('saved project src:', JSON.stringify(T.PROJ[0].src), 'item src:', JSON.stringify(T.PROJ[0].items[0].src));
  console.log('editor text:', d.querySelector('#pEdit .srcbox').textContent.replace(/\s+/g, ' ').trim().slice(0, 260));
  // buy at second market when cheaper
  T.S.market2 = 60008494;
  const now = Date.now();
  T.PRICES.p[34] = { s: 5, b: 4, at: now, loc: 60003760 };
  T.PRICES.p2 = T.PRICES.p2 || {};
  T.PRICES.p2[34] = { s: 4.5, b: 4, at: now, loc: 60008494 };
  T.PRICES.p[35] = { s: 10, b: 9, at: now };
  T.PRICES.p2[35] = { s: 11, b: 9, at: now, loc: 60008494 };
  console.log('BUY trit:', T.buyAt(34), T.buyPrice(34), '| pye:', T.buyAt(35), T.buyPrice(35));
  T.S.buyM2 = false;
  console.log('BUY off:', T.buyAt(34), T.buyPrice(34));
  T.S.market2 = '';
})().catch(e => console.error('FAIL', e));
