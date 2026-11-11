// Character refresh: every part of DATA[charId] built from a rich ESI mock (containers, ships, names, orders,
// standings, implants, wallet, job runs). Also checks the failure paths of the optional calls.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.__htmlCheck = true;
const LM = 'Tue, 10 Nov 2026 07:00:00 GMT';
let broken = new Set();
let slow = 0; // delay (ms) for the wallet call, to remove a character while its refresh runs
const recent = new Date(Date.now() - 2 * 86400000).toISOString(),
  old = new Date(Date.now() - 40 * 86400000).toISOString();
w.fetch = async (u, o) => {
  u = String(u);
  const J = (d, h = {}) => ({
    ok: true,
    status: 200,
    headers: { get: k => h[k.toLowerCase()] ?? null },
    json: async () => d,
    text: async () => JSON.stringify(d)
  });
  for (const b of broken)
    if (u.includes(b)) return { ok: false, status: 500, headers: { get: () => null }, text: async () => 'x' };
  if (u.includes('/assets/names/'))
    return J(
      JSON.parse(o.body).map(id => ({ item_id: id, name: id === 100 ? 'Raktár' : id === 200 ? 'sün' : 'None' }))
    );
  if (u.includes('/assets/'))
    return J([
      {
        item_id: 100,
        type_id: 17366,
        quantity: 1,
        location_id: 60000004,
        location_flag: 'Hangar',
        location_type: 'station',
        is_singleton: true
      },
      {
        item_id: 101,
        type_id: 34,
        quantity: 5000,
        location_id: 100,
        location_flag: 'Unlocked',
        location_type: 'item',
        is_singleton: false
      },
      {
        item_id: 102,
        type_id: 17367,
        quantity: 1,
        location_id: 100,
        location_flag: 'Unlocked',
        location_type: 'item',
        is_singleton: true
      },
      {
        item_id: 103,
        type_id: 35,
        quantity: 70,
        location_id: 102,
        location_flag: 'Unlocked',
        location_type: 'item',
        is_singleton: false
      },
      {
        item_id: 200,
        type_id: 648,
        quantity: 1,
        location_id: 60000004,
        location_flag: 'Hangar',
        location_type: 'station',
        is_singleton: true
      },
      {
        item_id: 201,
        type_id: 36,
        quantity: 9,
        location_id: 200,
        location_flag: 'Cargo',
        location_type: 'item',
        is_singleton: false
      },
      {
        item_id: 300,
        type_id: 37,
        quantity: 3,
        location_id: 1030000000000,
        location_flag: 'Hangar',
        location_type: 'other',
        is_singleton: false
      },
      {
        item_id: 301,
        type_id: 688,
        quantity: 1,
        location_id: 100,
        location_flag: 'Unlocked',
        location_type: 'item',
        is_singleton: true,
        is_blueprint_copy: true
      }
    ]);
  if (u.includes('/blueprints/'))
    return J(
      [
        {
          item_id: 301,
          type_id: 688,
          runs: 4,
          material_efficiency: 10,
          time_efficiency: 20,
          quantity: -2,
          location_id: 100
        },
        {
          item_id: 302,
          type_id: 689,
          runs: -1,
          material_efficiency: 8,
          time_efficiency: 16,
          quantity: -1,
          location_id: 60000004
        }
      ],
      { 'last-modified': LM, expires: 'Tue, 10 Nov 2026 08:00:00 GMT' }
    );
  if (u.includes('include_completed')) return J([]);
  if (u.includes('/industry/jobs/'))
    return J([
      {
        job_id: 1,
        blueprint_id: 301,
        blueprint_type_id: 688,
        activity_id: 1,
        runs: 1,
        start_date: '2026-11-10T06:00:00Z',
        end_date: '2026-11-10T09:00:00Z',
        facility_id: 60000004,
        product_type_id: 638,
        status: 'active'
      }
    ]);
  if (u.includes('/skills/'))
    return J({
      skills: [
        { skill_id: 3380, active_skill_level: 5 },
        { skill_id: 3388, active_skill_level: 4 }
      ]
    });
  if (u.includes('/standings/'))
    return J([
      { from_id: 1000035, from_type: 'npc_corp', standing: 2.5 },
      { from_id: 500001, from_type: 'faction', standing: -1 }
    ]);
  if (u.includes('/implants/')) return J([27174]);
  if (u.includes('/orders/'))
    return J([
      {
        order_id: 7,
        type_id: 34,
        location_id: 60003760,
        region_id: 10000002,
        price: 4.1,
        volume_remain: 900,
        volume_total: 1000,
        is_buy_order: false,
        issued: recent,
        duration: 90
      }
    ]);
  if (u.includes('/wallet/transactions/') && slow) await new Promise(r => setTimeout(r, slow));
  if (u.includes('/wallet/transactions/'))
    return J([
      { date: recent, type_id: 35, quantity: 10, unit_price: 12, is_buy: true, location_id: 60003760 },
      { date: old, type_id: 36, quantity: 1, unit_price: 50, is_buy: false, location_id: 60003760 }
    ]);
  const m = u.match(/everef\.net\/types\/(\d+)/);
  if (m)
    return J({ type_id: +m[1], name: 'T' + m[1], group_id: 1, category_id: +m[1] === 648 ? 6 : 2, packaged_volume: 1 });
  if (u.includes('/universe/names/')) return J([]);
  if (u.includes('/universe/stations/')) return J({ name: 'Test Station I', system_id: 30001 });
  if (u.includes('/universe/structures/'))
    return { ok: false, status: 403, headers: { get: () => null }, text: async () => 'forbidden' };
  return J([]);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu', wallet: true }));
w.eval(
  code +
    `;window.__t={refreshChar,setChars:c=>{CHARS=c},get DATA(){return DATA},setTimeouts:(t,b)=>{ESI_TIMEOUT=t;ESI_BACKOFF=b},removeChar,putChar,get CHARS(){return CHARS}};`
);
const T = w.__t;
const dump = d => {
  const x = JSON.parse(JSON.stringify(d));
  delete x.at;
  for (const o of x.orders) o.iss = '<ISS>';
  for (const t of x.tx) t.d = '<D>';
  return Object.entries(x)
    .map(([k, v]) => '  ' + k + ': ' + JSON.stringify(v))
    .join('\n');
};
(async () => {
  T.setTimeouts(2000, 1);
  const scp = [
    'esi-characters.read_standings.v1',
    'esi-clones.read_implants.v1',
    'esi-markets.read_character_orders.v1',
    'esi-wallet.read_character_wallet.v1'
  ];
  const c = { id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9, scp };
  T.setChars([c]);
  await T.refreshChar(c);
  console.log('full:\n' + dump(T.DATA[1]));
  broken = new Set(['/standings/', '/implants/', '/orders/', '/wallet/']);
  await T.refreshChar(c);
  const d = T.DATA[1];
  console.log(
    'optional calls failing: std=' +
      JSON.stringify(d.std) +
      ' imp=' +
      JSON.stringify(d.imp) +
      ' orders=' +
      d.orders.length +
      ' tx=' +
      d.tx.length +
      ' assets=' +
      d.assets.length
  );
  broken = new Set();
  const c2 = { ...c, scp: [] };
  T.setChars([c2]);
  await T.refreshChar(c2);
  const d2 = T.DATA[1];
  console.log(
    'no scopes: std=' +
      JSON.stringify(d2.std) +
      ' imp=' +
      JSON.stringify(d2.imp) +
      ' orders=' +
      d2.orders.length +
      ' tx=' +
      d2.tx.length
  );

  // removing a character while it refreshes: the refresh must not write its data back
  T.setChars([]);
  T.putChar(c);
  slow = 300;
  const run = T.refreshChar(c);
  await new Promise(r => setTimeout(r, 100));
  T.removeChar(1);
  await run;
  slow = 0;
  const stored = Object.keys(JSON.parse(w.localStorage.getItem('indyops.data') || '{}'));
  console.log(
    !T.DATA[1] && !stored.includes('1') && !T.CHARS.length
      ? 'removed during refresh: no data written back'
      : 'FAIL: removed during refresh, data written back (memory ' + !!T.DATA[1] + ', stored ' + stored + ')'
  );
  // a refresh after logging in again works as before
  T.putChar(c);
  await T.refreshChar(c);
  console.log(
    T.DATA[1] && T.DATA[1].assets.length
      ? 'logged in again: refresh stores data'
      : 'FAIL: refresh after new login stored nothing'
  );

  // data of removed characters left behind by older versions is dropped at start-up
  const dom2 = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
  dom2.window.localStorage.setItem('indyops.chars', JSON.stringify([{ id: 5, name: 'Kept' }]));
  dom2.window.localStorage.setItem(
    'indyops.data',
    JSON.stringify({
      5: { assets: [], bps: [], jobs: [], skills: {} },
      9: { assets: [], bps: [], jobs: [], skills: {} }
    })
  );
  dom2.window.eval(code + ';window.__d=()=>Object.keys(DATA);');
  const left = dom2.window.__d();
  const left2 = Object.keys(JSON.parse(dom2.window.localStorage.getItem('indyops.data')));
  console.log(
    JSON.stringify(left) === '["5"]' && JSON.stringify(left2) === '["5"]'
      ? 'orphan data dropped at start-up'
      : 'FAIL: orphan data kept: ' + left + ' / ' + left2
  );
})().catch(e => console.error('FAIL', e));
