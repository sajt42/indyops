const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const fx = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
const prices = {
  28710: 1.75e9,
  20411: 60000,
  25887: 80000,
  3828: 1500,
  11399: 18450,
  11478: 60000,
  11533: 9000,
  11534: 12000,
  11540: 3000,
  11544: 900,
  11550: 20000,
  11552: 4000,
  11558: 3500,
  34201: 1.2e6,
  34202: 1.1e6,
  34203: 0.4e6,
  34204: 1.5e6,
  34205: 0.8e6,
  34206: 0.9e6,
  34207: 3e6,
  34208: 1e6,
  2312: 5000,
  2463: 12000,
  57457: 3600,
  2319: 7000,
  3775: 7000,
  2401: 8000,
  3645: 470,
  57456: 2900,
  34: 3.81,
  35: 15.87,
  36: 56.685,
  37: 219.8,
  38: 777,
  39: 1137.5,
  40: 2093.5,
  57478: 48300,
  57479: 3.93e6,
  57486: 91385,
  638: 152.3e6
};
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.fetch = async (u, o) => {
  u = String(u);
  const J = (d, h = {}) => ({
    ok: true,
    status: 200,
    headers: { get: k => h[k] || null },
    json: async () => d,
    text: async () => JSON.stringify(d)
  });
  let m;
  if ((m = u.match(/everef\.net\/blueprints\/(\d+)/)))
    return fx.B[m[1]] ? J(fx.B[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if ((m = u.match(/everef\.net\/types\/(\d+)/)))
    return fx.T[m[1]] ? J(fx.T[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if ((m = u.match(/orders\/\?type_id=(\d+)/))) {
    const p = prices[m[1]];
    return J(
      p
        ? [
            { location_id: 60003760, is_buy_order: false, price: p },
            { location_id: 60003760, is_buy_order: true, price: p * 0.9 }
          ]
        : []
    );
  }
  if (u.includes('/markets/prices/'))
    return J([
      { type_id: 34, adjusted_price: 3.2 },
      { type_id: 35, adjusted_price: 13 },
      { type_id: 36, adjusted_price: 40 },
      { type_id: 37, adjusted_price: 200 },
      { type_id: 38, adjusted_price: 700 },
      { type_id: 39, adjusted_price: 1000 },
      { type_id: 40, adjusted_price: 2000 },
      { type_id: 57478, adjusted_price: 40000 },
      { type_id: 57479, adjusted_price: 3e6 },
      { type_id: 57486, adjusted_price: 80000 }
    ]);
  if (u.includes('/industry/systems/'))
    return J([{ solar_system_id: 30001, cost_indices: [{ activity: 'manufacturing', cost_index: 0.02 }] }]);
  if (u.includes('/history/'))
    return J(
      Array.from({ length: 30 }, (_, i) => ({
        average: 150e6,
        volume: u.includes('type_id=638') ? 123 : 40,
        date: '2026-10-' + (i + 1)
      }))
    );
  if (u.includes('/universe/names/')) return J([]);
  if (u.includes('/universe/stations/')) return J({ name: 'Test Station I', system_id: 30001 });
  throw new Error('unmocked ' + u);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: process.env.LANGX || 'hu' }));
w.eval(
  code +
    `;window.__t={runInvention,DECS,calcProjects,setProj:(a)=>{PROJ=a},runPlan,runCanBuild,renderAll,updateCopySelect,makePlan,indexBPProducts,ensurePrices,jobCost,jobTime,salesTax,brokerFee,oreToMinerals,get S(){return S},setData:(d)=>{DATA=d},setChars:c=>{CHARS=c},names:NAMES,LI:LOCINFO,get ADJ(){return ADJ},get IDX(){return IDX},sysFor};`
);
const T = w.__t;
(async () => {
  const L = 60000004;
  T.LI[L] = { name: 'Test Station I', system: 30001 };
  T.setChars([
    { id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 },
    { id: 2, name: 'Pilot B', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }
  ]);
  const stock = [
    [34, 1756090],
    [35, 6200787],
    [36, 1317970],
    [37, 344026],
    [38, 103783],
    [39, 34668],
    [40, 14972],
    [57478, 0],
    [57486, 403],
    [57479, 0],
    [57457, 2],
    [3645, 24000],
    [17470, 0]
  ];
  const mk = st => ({
    1: {
      assets: st.map(([t, q]) => ({ t, q, l: L, f: 'Hangar' })),
      bps: [
        { i: 101, t: 688, me: 10, te: 20, r: 8, q: -2, l: L },
        { i: 102, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 103, t: 57523, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 104, t: 57516, me: 10, te: 18, r: -1, q: -1, l: L }
      ],
      skills: {
        3380: 5,
        3388: 4,
        16622: 4,
        3446: 3,
        3385: 5,
        3389: 4,
        60377: 4,
        3387: 4,
        24625: 2,
        11433: 4,
        11454: 4,
        21790: 4,
        3402: 4,
        3406: 4,
        24624: 1
      },
      jobs: [{ act: 1, st: 'active', bpi: 999, bp: 688, runs: 1, end: '2030-01-01', loc: L }],
      at: Date.now()
    },
    2: {
      assets: [],
      bps: [
        { i: 201, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 202, t: 57516, me: 10, te: 20, r: -1, q: -1, l: L }
      ],
      skills: { 3380: 5, 3388: 5, 3402: 5, 3387: 5, 24625: 4 },
      jobs: [],
      at: Date.now()
    }
  });
  T.setData(mk(stock));
  await T.indexBPProducts();
  const show = async (label, runs, opt, st) => {
    if (st) T.setData(mk(st));
    const bp = { cid: 1, i: 101, t: 688, me: 10, te: 20, r: 8, l: L };
    const p = await T.makePlan(bp, runs, opt);
    console.log('\n== ' + label + ' ==');
    console.log('buy:', JSON.stringify([...p.buyList]));
    console.log('used:', JSON.stringify([...p.usedList]));
    console.log('jobs:', p.jobs.map(j => j.t + ' x' + j.runs + (j.short ? ' SHORT' : '')).join(', '));
    console.log('warn:', p.warn);
    return p;
  };

  Object.assign(T.names, {
    688: 'Raven Blueprint',
    57515: 'Auto-Integrity Preservation Seal Blueprint',
    57523: 'Life Support Backup Unit Blueprint',
    57516: 'Core Temperature Regulator Blueprint',
    638: 'Raven',
    34: 'Tritanium',
    35: 'Pyerite',
    36: 'Mexallon',
    37: 'Isogen',
    38: 'Nocxium',
    39: 'Zydrine',
    40: 'Megacyte',
    57478: 'Auto-Integrity Preservation Seal',
    57479: 'Core Temperature Regulator',
    57486: 'Life Support Backup Unit'
  });
  T.renderAll();
  const d = w.document;
  T.setData(mk(stock));
  await T.indexBPProducts();
  Object.assign(T.names || {}, {
    11433: 'High Energy Physics',
    11454: 'Caldari Starship Engineering',
    21790: 'Caldari Encryption Methods'
  });
  T.renderAll();
  await T.runInvention();
  const out = d.querySelector('#ivOut');
  console.log(
    'INV:',
    [...out.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join('\n     ')
  );
  out.querySelector('[data-invadd]').click();
  console.log('pList:', d.querySelector('#pList').textContent.replace(/\s+/g, ' ').trim());
  console.log('pEdit:', d.querySelector('#pEdit tbody').textContent.replace(/\s+/g, ' ').trim());
  d.querySelector('#pCalc').click();
  for (let i = 0; i < 300 && /Számolás/.test(d.querySelector('#pOut').textContent); i++)
    await new Promise(r => setTimeout(r, 100));
  const po = d.querySelector('#pOut');
  const tabs = [...po.querySelectorAll('table')];
  console.log(
    'PROJ KPIs:',
    [...po.querySelectorAll('.kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ')
  );
  console.log(
    'PROJ JOBS:',
    [...tabs[2].querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join('\n     ')
  );
  console.log(
    'LOAD:',
    [...tabs[3].querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' / ')
  );
  console.log(
    'TREE top:',
    [...po.querySelectorAll('table.tree tbody tr')]
      .slice(0, 6)
      .map(r => r.textContent.replace(/\s+/g, ' ').trim())
      .join('\n     ')
  );
})().catch(e => console.error('FAIL', e));
