const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const fx = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
const prices = {
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
  if (u.includes('/universe/names/')) return J([]);
  if (u.includes('/route/')) {
    const m = u.match(/route\/(\d+)\/(\d+)/);
    const n = m[1] === '30000142' || m[2] === '30000142' ? 11 : 4;
    return J(Array.from({ length: n }, (_, i) => i));
  }
  if (u.includes('/universe/stations/')) return J({ name: 'Test Station I', system_id: 30001 });
  throw new Error('unmocked ' + u);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: process.env.LANGX || 'hu' }));
w.eval(
  code +
    `;window.__t={renderResult,get LASTPLAN(){return LASTPLAN},runPlan,runCanBuild,renderAll,updateCopySelect,makePlan,indexBPProducts,ensurePrices,jobCost,jobTime,salesTax,brokerFee,oreToMinerals,get S(){return S},setData:(d)=>{DATA=d},setChars:c=>{CHARS=c},names:NAMES,LI:LOCINFO,get ADJ(){return ADJ},get IDX(){return IDX},sysFor};`
);
const T = w.__t;
(async () => {
  const L = 60000004,
    L2 = 1000000000001;
  T.LI[L] = { name: 'Test Station I', system: 30001 };
  T.LI[L2] = { name: 'Test Citadel', system: 30002 };
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
      assets: st
        .map(([t, q]) => ({ t, q, l: L, f: 'Hangar' }))
        .concat([
          { t: 648, q: 1, l: L, f: 'Hangar', s: 1 },
          { t: 20187, q: 1, l: L, f: 'Hangar', s: 1 }
        ]),
      bps: [
        { i: 101, t: 688, me: 10, te: 20, r: 8, q: -2, l: L2 },
        { i: 102, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 103, t: 57523, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 104, t: 57516, me: 10, te: 18, r: -1, q: -1, l: L }
      ],
      skills: { 3380: 5, 3388: 4, 16622: 4, 3446: 3, 3385: 5, 3389: 4, 60377: 4, 3387: 4, 24625: 2, 3342: 4 },
      jobs: [{ act: 1, st: 'active', bpi: 999, bp: 688, runs: 1, end: '2030-01-01', loc: L }],
      at: Date.now()
    },
    2: {
      assets: [{ t: 28606, q: 1, l: L2, f: 'Hangar', s: 1 }],
      bps: [
        { i: 201, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 202, t: 57516, me: 10, te: 20, r: -1, q: -1, l: L }
      ],
      skills: { 3380: 5, 3388: 5, 3402: 5, 3387: 5, 24625: 4, 28374: 1 },
      jobs: [],
      at: Date.now()
    }
  });
  T.setData(mk(stock));
  await T.indexBPProducts();
  const show = async (label, runs, opt, st) => {
    if (st) T.setData(mk(st));
    const bp = { cid: 1, i: 101, t: 688, me: 10, te: 20, r: 8, l: L2 };
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
  d.querySelector('#planSearch').value = 'Raven Blueprint';
  T.updateCopySelect();
  console.log('copy options:', d.querySelector('#planCopy').textContent);
  d.querySelector('#planRuns').value = '2';
  await T.runPlan();
  const out = d.querySelector('#planOut');
  console.log(
    'KPIs:',
    [...out.querySelectorAll('.kpi')].map(k => k.textContent.replace(/\s+/g, ' ').trim()).join(' | ')
  );
  console.log(
    'buy rows:',
    [...out.querySelectorAll('table')[0].querySelectorAll('tbody tr')]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim())
      .join(' / ')
  );
  console.log(
    'JOBS:',
    [...out.querySelectorAll('table')[1].querySelectorAll('tbody tr')]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim())
      .join(' / ')
  );
  console.log(
    'LOAD:',
    [...out.querySelectorAll('table')[2].querySelectorAll('tbody tr')]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim())
      .join(' / ')
  );
  console.log('tree rows:', out.querySelectorAll('table.tree tbody tr').length);
  {
    const hs = [...out.querySelectorAll('h3')].find(h => h.textContent === 'Szállítás');
    let el = hs.nextElementSibling;
    const txt = [];
    while (el && el.tagName !== 'H3') {
      txt.push(el.textContent.replace(/\s+/g, ' ').trim());
      el = el.nextElementSibling;
    }
    console.log('HAUL:', txt.join(' || '));
  }
  console.log(
    'TREE:',
    [...out.querySelectorAll('table.tree tbody tr')]
      .slice(0, 5)
      .map(r => r.textContent.replace(/\s+/g, ' ').trim())
      .join(' / ')
  );
  console.log(
    'bp rows:',
    d.querySelectorAll('#bpTable tbody tr').length,
    'stock rows:',
    d.querySelectorAll('#stTable tbody tr').length
  );
  await T.runCanBuild();
  console.log(
    'canbuild:',
    [...d.querySelectorAll('#cbOut tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()).join(' / ')
  );
})().catch(e => console.error('FAIL', e));
