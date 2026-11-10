// Hostile names: every string that comes from outside (EVE Ref type names, station and structure names, container
// and ship names, manual location names, character names, project names, pasted scan text, market data) carries an
// HTML/attribute payload. Every view is drawn; the test fails when the payload became markup (an element or an
// attribute) or when text shows double escaping (&amp; &lt; &#39; &quot;).
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const fx = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
const P = `<img src=x class=pwn>" data-pwn="1' data-pwn2='1&`;
const bad = s => s + ' ' + P;
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
  638: 152.3e6,
  1230: 20
};
const L = 60000004,
  CIT = 1030000000001,
  UNK = 1030000000002;
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
  const NF = { ok: false, status: 404, headers: { get: () => null }, text: async () => '' };
  let m;
  if ((m = u.match(/everef\.net\/blueprints\/(\d+)/))) return fx.B[m[1]] ? J(fx.B[m[1]]) : NF;
  if ((m = u.match(/everef\.net\/types\/(\d+)/))) {
    const t =
      fx.T[m[1]] ||
      (m[1] === '1230'
        ? {
            type_id: 1230,
            name: { en: 'Veldspar' },
            group_id: 462,
            category_id: 25,
            portion_size: 100,
            volume: 0.1,
            type_materials: { 34: { material_type_id: 34, quantity: 400 } }
          }
        : null);
    if (!t) return NF;
    const n = (t.name && (t.name.en || t.name)) || 'Type ' + m[1];
    return J(Object.assign({}, t, { name: { en: bad(n) } }));
  }
  if (u.includes('everef.net/npc_corporations/')) return J({ faction_id: 500001 });
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
    return J(Object.entries(prices).map(([t, p]) => ({ type_id: +t, adjusted_price: p * 0.9 })));
  if (u.includes('/industry/systems/'))
    return J([
      {
        solar_system_id: 30001,
        cost_indices: [
          { activity: 'manufacturing', cost_index: 0.02 },
          { activity: 'invention', cost_index: 0.02 }
        ]
      }
    ]);
  if (u.includes('/universe/names/')) return J([]);
  if (u.includes('/universe/stations/'))
    return J({
      name: bad('Station'),
      system_id: 30001,
      owner: 1000041,
      services: ['reprocessing-plant'],
      reprocessing_efficiency: 0.5,
      reprocessing_stations_take: 0.05
    });
  if (u.includes('/universe/structures/'))
    return { ok: false, status: 403, headers: { get: () => null }, text: async () => 'forbidden' };
  if (u.includes('/history/')) return J([]);
  if (u.includes('/route/')) return J([30001]);
  if (u.includes('/universe/systems/')) return J({ name: bad('System'), security_status: 0.9 });
  return J([]);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu', locNames: { [UNK]: bad('Manual name') } }));
w.eval(
  code +
    `;window.__t={runPlan,runCanBuild,runProfit,runInvention,runResearch,runSales,runScan,calcProjects,renderProjects,renderAll,renderUnknownLocs,updateCopySelect,indexBPProducts,repLoad,renderRepro,renderRepSum,showTab,REP,get S(){return S},setData:d=>{DATA=d},setChars:c=>{CHARS=c},setProj:a=>{PROJ=a},names:NAMES,LI:LOCINFO,SYSSEC};`
);
const T = w.__t;
const d = w.document;
let fails = 0,
  shown = 0;
const seen = new Set();
// reports every new place where the payload became markup or text was escaped twice
const check = (label, ...where) => {
  const found = [];
  // the hostile names must actually be shown (as text) in the views of this step
  for (const sel of where) {
    const el = d.querySelector(sel);
    if (!el || !el.textContent.includes('class=pwn>')) found.push('no hostile name shown in ' + sel);
  }
  for (const e of d.querySelectorAll('.pwn, img[src="x"], [data-pwn], [data-pwn2]')) {
    const host = e.closest('[id]');
    found.push(
      'markup in #' +
        (host && host.id) +
        ': ' +
        (e.parentElement ? e.parentElement.outerHTML : e.outerHTML).slice(0, 140)
    );
  }
  const tw = d.createTreeWalker(d.body, 4);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) continue;
    if (n.nodeValue.includes('class=pwn>')) shown++;
    if (/&amp;|&lt;|&gt;|&#39;|&quot;/.test(n.nodeValue)) {
      const host = n.parentElement.closest('[id]');
      found.push('double escaping in #' + (host && host.id) + ': ' + n.nodeValue.trim().slice(0, 100));
    }
  }
  const fresh = found.filter(f => !seen.has(f));
  fresh.forEach(f => seen.add(f));
  if (fresh.length) {
    fails += fresh.length;
    console.log('FAIL: ' + label + ':');
    fresh.forEach(f => console.log('   ' + f));
  } else console.log('ok: ' + label);
};
(async () => {
  T.LI[L] = { name: bad('Station'), system: 30001, owner: 1000041 };
  T.LI[CIT] = { name: bad('Citadel'), system: 30001 };
  T.SYSSEC[30001] = 0.9;
  T.names[30001] = bad('System');
  T.names[1000041] = bad('Corp');
  T.names[500001] = bad('Faction');
  T.names[10000002] = bad('Region');
  T.setChars([
    {
      id: 1,
      name: bad('Pilot A'),
      refresh: 'x',
      access: 'x',
      exp: Date.now() + 1e9,
      scp: ['esi-markets.read_character_orders.v1']
    },
    { id: 2, name: bad('Pilot B'), refresh: 'x', access: 'x', exp: Date.now() + 1e9 }
  ]);
  const stock = [
    [34, 1756090],
    [35, 6200787],
    [36, 1317970],
    [37, 344026],
    [38, 103783],
    [39, 34668],
    [40, 14972],
    [57486, 403],
    [1230, 50000],
    [638, 1]
  ];
  T.setData({
    1: {
      assets: stock
        .map(([t, q]) => ({ t, q, l: L, f: 'Hangar', c: null }))
        .concat([
          { t: 34, q: 500, l: L, f: 'Unlocked', c: 9001, cn: bad('Box') },
          { t: 35, q: 300, l: L, f: 'Cargo', c: 9002, cn: bad('Ship') },
          { t: 1230, q: 900, l: CIT, f: 'Hangar', c: null },
          { t: 36, q: 7, l: UNK, f: 'Hangar', c: null },
          { t: 37, q: 1, l: UNK, f: 'Hangar', c: 9003, cn: bad('Crate') }
        ]),
      bps: [
        { i: 101, t: 688, me: 10, te: 20, r: 8, q: -2, l: L, c: 9001, cn: bad('Box') },
        { i: 102, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L },
        { i: 103, t: 57523, me: 10, te: 20, r: -1, q: -1, l: CIT },
        { i: 104, t: 57516, me: 10, te: 18, r: -1, q: -1, l: L }
      ],
      cont: {
        9001: { n: bad('Box'), t: 17366, l: L, pc: null, f: 'Hangar', k: 2 },
        9002: { n: bad('Ship'), t: 648, l: L, pc: null, f: 'Hangar', k: 6 }
      },
      skills: { 3380: 5, 3388: 4, 16622: 4, 3446: 3, 3385: 5, 3389: 4, 60377: 4, 3387: 4, 24625: 2, 3402: 4 },
      jobs: [{ act: 1, st: 'active', bpi: 999, bp: 688, runs: 1, end: '2030-01-01', loc: L, prod: 638 }],
      orders: [
        {
          id: 8,
          t: 35,
          l: UNK,
          reg: 10000002,
          p: 16,
          rem: 10,
          tot: 10,
          buy: false,
          iss: new Date().toISOString(),
          dur: 90
        },
        {
          id: 7,
          t: 34,
          l: CIT,
          reg: 10000002,
          p: 4.1,
          rem: 900,
          tot: 1000,
          buy: false,
          iss: new Date().toISOString(),
          dur: 90
        }
      ],
      tx: [],
      std: { 1000041: 2, 500001: 1 },
      lm: { [UNK]: { t: 'other', f: { Hangar: 1 } } },
      at: Date.now()
    },
    2: {
      assets: [],
      bps: [{ i: 201, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L }],
      skills: { 3380: 5, 3387: 5 },
      jobs: [],
      at: Date.now()
    }
  });
  const typeNames = {
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
    57486: 'Life Support Backup Unit',
    1230: 'Veldspar'
  };
  for (const [t, n] of Object.entries(typeNames)) T.names[t] = bad(n);
  await T.indexBPProducts();
  T.renderAll();
  check('characters, blueprints, stock, settings', '#bpTable', '#stTable', '#unkLocs');
  T.renderUnknownLocs && T.renderUnknownLocs();
  check('unknown locations');

  d.querySelector('#planSearch').value = T.names[688];
  T.updateCopySelect();
  d.querySelector('#planRuns').value = '2';
  await T.runPlan();
  check('planner result (tree, jobs, hauling)', '#planOut');

  T.setProj([
    {
      id: 1,
      name: bad('Project'),
      active: true,
      items: [{ bpType: 688, runs: 2, label: bad('Item') }],
      src: { mode: 'sel', locs: [L], conts: [9001], excl: [] }
    }
  ]);
  T.renderProjects();
  check('project list and material sources', '#pList');
  await T.calcProjects([{ id: 1, name: bad('Project'), active: true, items: [{ bpType: 688, runs: 2 }] }]);
  check('project result', '#pOut');

  await T.runProfit();
  check('what pays', '#prOut');
  await T.runResearch();
  check('research and copy', '#rsOut');
  await T.runCanBuild();
  check('builds without buying', '#cbOut');
  await T.runSales();
  check('selling', '#slOut');

  d.querySelector('#scanIn').value = bad('Veldspar') + '\t1,000\t100 m3\t1 000 ISK\t12 km';
  await T.runScan();
  check('mining scan', '#scanOut');

  T.showTab('repro');
  await T.repLoad();
  const all = d.querySelector('#repAll');
  if (all) {
    all.checked = true;
    all.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  T.renderRepSum();
  check('reprocess list and summary', '#repOut', '#repSum');

  if (!shown) {
    fails++;
    console.log('FAIL: the payload was never shown as text (the views did not render the hostile names)');
  }
  console.log(fails ? `xss: ${fails} problem(s)` : 'xss: no injection, no double escaping');
})().catch(e => console.error('FAIL', e));
