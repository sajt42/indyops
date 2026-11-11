// Regression tests with real assertions for the review fixes. Prints "FAIL: …" on any failed check.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const fx = JSON.parse(fs.readFileSync('fixture.json', 'utf8'));
let prices = {
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
let failPrice = new Set(),
  tokenCalls = 0,
  corpCalls = 0,
  mktOrders = {},
  route = null,
  sec = {};
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.__htmlCheck = true;
let hang = null,
  tokenHang = false;
w.fetch = async (u, o) => {
  u = String(u);
  if (hang) {
    const h = hang(u, o);
    if (h) return h;
  }
  const J = (d, h = {}) => ({
    ok: true,
    status: 200,
    headers: { get: k => h[k] ?? null },
    json: async () => d,
    text: async () => JSON.stringify(d)
  });
  let m;
  if (u.includes('login.eveonline.com/v2/oauth/token')) {
    tokenCalls++;
    if (tokenHang)
      return new Promise((_, rej) =>
        o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      );
    await new Promise(r => setTimeout(r, 30));
    return J({
      access_token: 'a.' + Buffer.from(JSON.stringify({ scp: [] })).toString('base64') + '.c',
      expires_in: 1200,
      refresh_token: 'r2'
    });
  }
  if (u.includes('/corporations/')) corpCalls++;
  if ((m = u.match(/everef\.net\/npc_corporations\/(\d+)/)))
    return m[1] === '1000041' ? J({ corporation_id: 1000041, faction_id: 500001 }) : J({ corporation_id: +m[1] });
  if ((m = u.match(/universe\/stations\/(6000777\d)/)))
    return J({
      name: 'Owner Test Station',
      system_id: 30001,
      owner: m[1] === '60007771' ? 1000041 : 1000099,
      services: []
    });
  if ((m = u.match(/everef\.net\/blueprints\/(\d+)/)))
    return fx.B[m[1]] ? J(fx.B[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if ((m = u.match(/everef\.net\/types\/(\d+)/)))
    return fx.T[m[1]] ? J(fx.T[m[1]]) : { ok: false, status: 404, headers: { get: () => null } };
  if ((m = u.match(/orders\/\?type_id=(\d+)/))) {
    if (failPrice.has(Number(m[1])))
      return { ok: false, status: 503, headers: { get: () => null }, text: async () => 'down' };
    const p = prices[m[1]];
    return J(p ? [{ location_id: 60003760, is_buy_order: false, price: p }] : []);
  }
  if (u.includes('/markets/prices/'))
    return J([
      { type_id: 34, adjusted_price: 3.2 },
      { type_id: 35, adjusted_price: 13 },
      { type_id: 36, adjusted_price: 40 },
      { type_id: 37, adjusted_price: 200 },
      { type_id: 38, adjusted_price: 700 },
      { type_id: 39, adjusted_price: 1000 },
      { type_id: 40, adjusted_price: 2000 }
    ]);
  if (u.includes('/industry/systems/'))
    return J([
      { solar_system_id: 30001, cost_indices: [{ activity: 'manufacturing', cost_index: 0.02 }] },
      { solar_system_id: 30002, cost_indices: [{ activity: 'manufacturing', cost_index: 0.08 }] }
    ]);
  if ((m = u.match(/\/markets\/(\d+)\/orders\/\?order_type=sell&type_id=(\d+)/)))
    return J(mktOrders[m[1] + '|' + m[2]] || []);
  if ((m = u.match(/\/route\/(\d+)\/(\d+)\/(\?flag=secure)?/))) {
    const r = route(Number(m[1]), Number(m[2]), !!m[3]);
    if (r && r.delay) {
      await new Promise(z => setTimeout(z, r.delay));
      return J(r.path);
    }
    return r ? J(r) : { ok: false, status: 404, headers: { get: () => null }, text: async () => 'no route' };
  }
  if ((m = u.match(/universe\/systems\/(\d+)/))) return J({ security_status: sec[m[1]] ?? 0.9 });
  if (u.includes('/universe/names/')) return J([]);
  if ((m = u.match(/universe\/stations\/(\d+)/)))
    return J({ name: 'Station ' + m[1], system_id: m[1] === '60000005' ? 30002 : 30001 });
  throw new Error('unmocked ' + u);
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu' }));
w.eval(
  code +
    `;window.__t={SCH:SET_SCHEMA,shipAdvice,dur,madeNote:typeof madeNote==='function'?madeNote:null,get PROJ(){return PROJ},makeBackup,prepHaul,setProj:a=>{PROJ=a},esi,jobSysOf,setTimeouts:(t,b)=>{ESI_TIMEOUT=t;ESI_BACKOFF=b},get ROUTES(){return ROUTES},makePlan,makeMulti,showResult,refreshHaul,indexBPProducts,ensurePrices,finishResult,renderResult,ensureRoute,haulList,assignChars,accessToken,validateBackup,priceFail,jobCost,assignJobSys,
  get PRICES(){return PRICES},get IDX(){return IDX},get ADJ(){return ADJ},get S(){return S},setData:d=>{DATA=d},setChars:c=>{CHARS=c},names:NAMES,LI:LOCINFO,SYSSEC,brokerFeeOf,brokerExplain,CORPFAC,ensureOwners,stationOwner,assignChars,html,raw,setHtml,esc,netOfFees,buyParts,buyPrice,loadMarket,mktSearch,MKT,setSetting,setSettingIn,onSetting,setLast:(p,r)=>{LASTPLAN=p;LASTRENDER=r},createProject,updateProject,addToProject,moveProject,deleteProject,selectProject,get PROJ(){return PROJ},get SELP(){return SELP},charDataChanged,setRerun:f=>{LASTRERUN=f},setRecalcDelay:ms=>{DATA_RECALC_DELAY=ms},sellerHtml,setSales:r=>{SLROWS=r},refreshMarket2,get PROFM2(){return PROFM2}};`
);
const T = w.__t,
  d = w.document;
let fails = 0,
  checks = 0;
const ok = (c, msg) => {
  checks++;
  if (!c) {
    fails++;
    console.log('FAIL: ' + msg);
  }
};
(async () => {
  const L = 60000004,
    L2 = 60000005;
  T.LI[L] = { name: 'Test Station I', system: 30001 };
  T.LI[L2] = { name: 'Test Station II', system: 30002 };
  T.setChars([{ id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
  const bps = [
    { i: 101, t: 688, me: 10, te: 20, r: 8, q: -2, l: L },
    { i: 102, t: 57515, me: 10, te: 20, r: -1, q: -1, l: L2 },
    { i: 103, t: 57523, me: 10, te: 20, r: -1, q: -1, l: L },
    { i: 104, t: 57516, me: 10, te: 18, r: -1, q: -1, l: L }
  ];
  T.setData({ 1: { assets: [], bps, skills: { 3380: 5, 3388: 4 }, jobs: [], at: Date.now() } });
  await T.indexBPProducts();

  // 1. failed price fetch keeps the last good price; a type without any price stays "no price", not 0-cost-fresh
  await T.ensurePrices([34]);
  const good = T.PRICES.p[34].s;
  T.PRICES.p[34].at = Date.now() - 31 * 60000;
  failPrice = new Set([34, 35]);
  delete T.PRICES.p[35];
  await T.ensurePrices([34, 35]);
  ok(T.PRICES.p[34].s === good, 'price 34 kept after failure (' + T.PRICES.p[34].s + ')');
  ok(!!T.PRICES.p[34].err, 'price 34 marked as error');
  ok(
    T.PRICES.p[35].s == null && Date.now() - T.PRICES.p[35].at >= 24 * 60000,
    'price 35 unknown and retried within ~5 minutes'
  );
  failPrice = new Set();

  // 2. unpriced material → profit "nem számolható"
  delete prices[39];
  delete T.PRICES.p[39];
  const R = await T.makeMulti([{ copies: [{ cid: 1, ...bps[0] }], runs: 2 }], {
    useStock: true,
    buildOwn: true,
    incoming: false,
    ore: false
  });
  R.title = 'Raven';
  await T.finishResult(R, { cid: 1, ...bps[0] });
  const el = d.createElement('div');
  d.body.appendChild(el);
  T.renderResult(el, R, () => {});
  ok(/nem számolható/.test(el.textContent), 'profit KPI says not computable when a material has no price');
  ok(/nincs piaci ára/.test(el.textContent), 'notice lists unpriced items');
  prices[39] = 1137.5;

  // 3. per-job system: component BP in another system gets that system's index
  const sys = new Set(R.jobs.map(j => T.jobSysOf(j)));
  ok(sys.has(30001) && sys.has(30002), 'jobs use their own systems (' + [...sys].join(',') + ')');
  const jA = R.jobs.find(j => T.jobSysOf(j) === 30002);
  const j2 = Object.assign({}, jA, { base: [[34, 1000]] }),
    c2 = T.jobCost(j2),
    c1 = T.jobCost(Object.assign({}, j2, { bp: Object.assign({}, j2.bp, { l: L }) }));
  ok(
    c2 > c1 && c1 > 0,
    'higher index in system 30002 gives higher job cost (' + c1.toFixed(0) + ' vs ' + c2.toFixed(0) + ')'
  );
  T.S.prodLoc = L;
  await T.assignJobSys(R.jobs);
  ok(
    R.jobs.every(j => T.jobSysOf(j) === 30001),
    'production location override puts all jobs in its system'
  );
  T.S.prodLoc = '';

  // 4. route safety: label highsec only if every system is highsec
  sec = { 30010: 0.9, 30011: 0.3, 30012: 0.8, 30020: 0.9, 30021: 0.6, 30022: 0.5 };
  route = (a, b, secure) => (a === 30010 ? (secure ? null : [30010, 30011, 30012]) : [30020, 30021, 30022]);
  const r1 = await T.ensureRoute(30010, 30012),
    r2 = await T.ensureRoute(30020, 30022);
  ok(r1 && r1.hs === false && r1.n === 2, 'fallback route through lowsec is not highsec');
  ok(r2 && r2.hs === true, 'all-highsec route is highsec');

  // 5. sale hauling grouped by origin
  const mkTree = (t, l) => ({ tree: { t, buy: 0, stock: [], ch: [], build: { jobs: [{ c: { l } }] } }, made: 1 });
  const H = T.haulList({ trees: [mkTree(638, L), mkTree(639, L2)], jobs: [] });
  ok(H.sale.size === 2 && H.sale.get(L).has(638) && H.sale.get(L2).has(639), 'sale grouped by origin');

  // 6. one token refresh for parallel calls
  const c = { id: 9, name: 'X', refresh: 'r', access: null, exp: 0 };
  T.setChars([c]);
  tokenCalls = 0;
  await Promise.all([1, 2, 3, 4, 5].map(() => T.accessToken(c)));
  ok(tokenCalls === 1, 'token refreshed once for 5 parallel calls (' + tokenCalls + ')');

  // 7. backup validation
  ok(
    T.validateBackup({
      app: 'indyops',
      projects: [{ id: 1, name: 'A', items: [{ bpType: 688, runs: 1 }] }],
      settings: {}
    }).err.length === 0,
    'valid backup accepted'
  );
  ok(T.validateBackup({ app: 'indyops', projects: 'x' }).err.length > 0, 'projects not a list rejected');
  ok(
    T.validateBackup({ app: 'indyops', projects: [{ id: 1, name: 'A', items: [{ runs: -1 }] }] }).err.length > 0,
    'invalid item rejected'
  );
  ok(T.validateBackup({ app: 'indyops', settings: [1] }).err.length > 0, 'settings array rejected');

  // 8. waiting for slot when no free slot
  T.setChars([{ id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
  T.setData({
    1: {
      assets: [],
      bps,
      skills: {},
      jobs: [{ act: 1, st: 'active', runs: 1, bp: 688, bpi: 999, loc: L }],
      at: Date.now()
    }
  });
  const jobs = [
    {
      t: 638,
      bp: { cid: 1, t: 688, l: L, me: 10, te: 20, r: 8 },
      runs: 1,
      act: 'm',
      time: 3600,
      base: [],
      miss: [],
      item: {}
    }
  ];
  T.assignChars(jobs);
  ok(jobs[0].wait === true, 'job flagged as waiting when the only manufacturing slot is busy');

  // 9. import: field-level validation, never throws
  let v1,
    v2,
    thrown = false;
  try {
    v1 = T.validateBackup({ app: 'indyops', settings: { locs: 'nem-tömb', buyOverride: null }, projects: [] });
    v2 = T.validateBackup({
      app: 'indyops',
      projects: [{ id: 1, name: 'Teszt', items: [], src: { mode: 'sel', locs: 'hibás' } }]
    });
  } catch (e) {
    thrown = true;
  }
  ok(!thrown, 'validator does not throw on bad input');
  ok(v1 && v1.err.length > 0, 'bad settings fields rejected (' + (v1 && v1.err.join('; ')) + ')');
  ok(v2 && v2.err.length > 0, 'bad project source rejected');
  {
    const rn = T.validateBackup(null);
    ok(rn.err.length > 0, 'null backup is rejected');
  }
  const v3 = T.validateBackup({ app: 'indyops', settings: { facTax: 1, unknownKey: 5 }, projects: [] });
  ok(
    v3.err.length === 0 && v3.d.settings.facTax === 1 && !('unknownKey' in v3.d.settings),
    'unknown setting dropped, known kept'
  );

  // 10. timeout covers the response body; body error retried; then success
  T.setTimeouts(80, 5);
  hang = (u, o) =>
    u.includes('/hangbody/')
      ? Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: () =>
            new Promise((_, rej) =>
              o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
            ),
          text: async () => ''
        })
      : null;
  let te = null;
  const t0 = Date.now();
  try {
    await T.esi('/hangbody/');
  } catch (e) {
    te = e;
  }
  ok(te && /időtúllépés/.test(te.message), 'hanging body times out (' + (te && te.message) + ')');
  ok(Date.now() - t0 < 2000, 'timeout fires quickly');
  let n = 0;
  hang = (u, o) =>
    u.includes('/flaky/')
      ? ++n < 2
        ? Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: () => Promise.reject(new TypeError('network'))
          })
        : Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ fine: 1 }) })
      : null;
  const fl = await T.esi('/flaky/').catch(e => e);
  ok(fl && fl.fine === 1 && n === 2, 'body read error retried and then succeeded');
  hang = null;

  // 11. token endpoint hang: callers fail; a later call can retry
  const cY = { id: 10, name: 'Y', refresh: 'r', access: null, exp: 0 };
  T.setChars([cY]);
  tokenHang = true;
  tokenCalls = 0;
  const rs = await Promise.allSettled([T.accessToken(cY), T.accessToken(cY)]);
  ok(
    rs.every(r => r.status === 'rejected') && tokenCalls === 1,
    'hanging token request rejects all waiters, one request'
  );
  tokenHang = false;
  const tok = await T.accessToken(cY).catch(e => null);
  ok(!!tok && tokenCalls === 2, 'later token call retries and succeeds');
  T.setTimeouts(30000, 1000);

  // 12. price retry: old good price kept and next attempt only after 5 minutes
  failPrice = new Set([34]);
  T.PRICES.p[34] = { s: 3.81, b: 3, at: Date.now() - 31 * 60000 };
  await T.ensurePrices([34]);
  const ra = T.PRICES.p[34];
  ok(ra.s === 3.81 && ra.retry - Date.now() > 4 * 60000, 'old price kept with retry in ~5 min');
  let reqs = 0;
  const of = w.fetch;
  w.fetch = async (u, o) => {
    if (String(u).includes('type_id=34')) reqs++;
    return of(u, o);
  };
  await T.ensurePrices([34]);
  w.fetch = of;
  ok(reqs === 0, 'no new request before retry time');
  failPrice = new Set();

  // 13. failed route not cached forever
  route = (a, b, secure) => null;
  const rf = await T.ensureRoute(30030, 30031);
  ok(rf === null, 'failed route returns null');
  T.ROUTES['30030|30031'].at = Date.now() - 6 * 60000;
  sec[30030] = 0.9;
  sec[30031] = 0.8;
  route = (a, b) => [30030, 30031];
  const rok = await T.ensureRoute(30030, 30031);
  ok(rok && rok.hs === true, 'route retried after the short cache expired');

  // 14. job system follows the final BP assignment
  T.setChars([
    { id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 },
    { id: 2, name: 'Pilot B', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }
  ]);
  T.setData({
    1: {
      assets: [],
      bps: [{ i: 201, t: 688, me: 10, te: 20, r: 8, q: -2, l: L }],
      skills: {},
      jobs: [],
      at: Date.now()
    },
    2: {
      assets: [],
      bps: [{ i: 202, t: 688, me: 10, te: 20, r: 8, q: -2, l: L2 }],
      skills: { 3380: 5 },
      jobs: [],
      at: Date.now()
    }
  });
  const jb = [
    {
      t: 638,
      bp: { cid: 1, i: 201, t: 688, l: L, me: 10, te: 20, r: 8 },
      runs: 1,
      act: 'm',
      time: 3600,
      base: [[34, 1000]],
      miss: [],
      item: {}
    }
  ];
  T.assignChars(jb);
  await T.assignJobSys(jb);
  ok(
    jb[0].who === 2 && jb[0].bp.l === L2 && T.jobSysOf(jb[0]) === 30002,
    'reassigned BP moves the job to its system (who ' + jb[0].who + ', sys ' + T.jobSysOf(jb[0]) + ')'
  );

  // 15. boolean buy override survives validation; full export → import round trip
  {
    const r = T.validateBackup({ app: 'indyops', settings: { buyOverride: { 57478: true } }, projects: [] });
    ok(
      r.err.length === 0 && r.d.settings.buyOverride[57478] === true,
      'boolean buy override survives backup validation'
    );
  }
  Object.assign(T.S, {
    buyOverride: { 57478: true },
    locs: [L, L2],
    workChars: [1],
    market2: 60008494,
    buyM2: false,
    srcShips: false,
    salesTax: '',
    broker: '2.5',
    facTax: '',
    structBroker: { 1000000000001: 1.5 },
    locNames: { 1000000000010: 'Malac kuckó' },
    repro: { loc: { [L]: { rig: 3, tax: '1.2', base: '' } }, imp: { 1: 4, 2: 'auto' }, char: '' },
    structME: 1,
    system: '',
    prodLoc: '',
    wallet: true,
    lang: 'hu'
  });
  T.setProj([
    {
      id: 1,
      name: 'Ravenek',
      active: true,
      items: [
        { bpType: 688, runs: 2, src: { mode: 'sel', locs: [L2], conts: [], excl: [] } },
        { invT1: 688, t2: 999, dec: null, runs: 1, pi: 0 }
      ],
      src: { mode: 'sel', locs: [], conts: [9001], excl: [9001] }
    },
    { id: 2, name: 'B', active: false, items: [] }
  ]);
  const back = JSON.parse(JSON.stringify(T.makeBackup(false)));
  const rt = T.validateBackup(back);
  ok(rt.err.length === 0, 'own export validates (' + rt.err.join('; ') + ')');
  ok(
    rt.d.settings.buyOverride[57478] === true &&
      rt.d.settings.repro.loc[L].rig === 3 &&
      rt.d.settings.locNames[1000000000010] === 'Malac kuckó' &&
      rt.d.settings.market2 === 60008494,
    'settings survive round trip'
  );
  ok(
    rt.d.projects.length === 2 &&
      rt.d.projects[0].src.excl[0] === 9001 &&
      rt.d.projects[0].items[0].src.locs[0] === L2 &&
      rt.d.projects[0].items[1].invT1 === 688 &&
      rt.d.projects[1].active === false,
    'projects survive round trip'
  );

  // 16. haul preparation: an older, slower run must not overwrite a newer one
  T.setChars([{ id: 1, name: 'Pilot A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
  T.setData({ 1: { assets: [], bps: [], skills: {}, jobs: [], at: Date.now() } });
  const tree = l => ({ tree: { t: 638, buy: 0, stock: [], ch: [], build: { jobs: [{ c: { l } }] } }, made: 1 });
  T.LI[60000006] = { name: 'S6', system: 30040 };
  T.LI[60000007] = { name: 'S7', system: 30041 };
  sec[30040] = 0.9;
  sec[30041] = 0.9;
  sec[30000142] = 0.9;
  route = (a, b) => ({ delay: a === 30040 ? 200 : 10, path: [a, b] });
  const RH = { trees: [tree(60000006)], jobs: [] };
  const pA = T.prepHaul(RH);
  RH.trees = [tree(60000007)];
  const pB = T.prepHaul(RH);
  const [fa, fb] = await Promise.all([pA, pB]);
  ok(fb === true && fa === false, 'only the newest preparation publishes (A ' + fa + ', B ' + fb + ')');
  ok(
    RH.haulCtx && '60000007|60003760' in RH.haulCtx.jumps && !('60000006|60003760' in RH.haulCtx.jumps),
    'final context belongs to the newest assignment'
  );

  // 17. switch A → B → back to A while B is still preparing: B must not publish, A's context stays
  {
    route = (a, b) => ({ delay: a === 30041 ? 200 : 5, path: [a, b] });
    const RA = { trees: [tree(60000006)], jobs: [] };
    await T.prepHaul(RA);
    const ctxA = RA.haulCtx,
      sigA = RA.haulSig;
    RA.trees = [tree(60000007)];
    const pB2 = T.prepHaul(RA);
    RA.trees = [tree(60000006)];
    const fB = await pB2;
    ok(
      fB === false && RA.haulCtx === ctxA && RA.haulSig === sigA,
      'stale preparation after switching back is not published'
    );
  }

  // 18. full normalized comparison of the round trip
  {
    const SCH = T.SCH;
    const exp = {};
    for (const k of Object.keys(SCH)) if (k in T.S) exp[k] = JSON.parse(JSON.stringify(T.S[k]));
    const canon = x =>
      Array.isArray(x)
        ? x.map(canon)
        : x && typeof x === 'object'
          ? Object.fromEntries(
              Object.keys(x)
                .sort()
                .filter(k => x[k] !== undefined)
                .map(k => [k, canon(x[k])])
            )
          : x;
    const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
    ok(same(rt.d.settings, exp), 'all supported settings survive the round trip unchanged');
    ok(same(rt.d.projects, JSON.parse(JSON.stringify(T.PROJ))), 'projects survive the round trip unchanged');
  }
  // 19. renderResult only draws: it must not change the plan
  {
    const before =
      JSON.stringify(R.jobs.map(j => [j.who, j.bp && j.bp.i, j.wait, j.noone, j.miss])) +
      '|' +
      R.haulSig +
      '|' +
      R.haulPending;
    const el2 = d.createElement('div');
    d.body.appendChild(el2);
    T.renderResult(el2, R, () => {});
    ok(
      JSON.stringify(R.jobs.map(j => [j.who, j.bp && j.bp.i, j.wait, j.noone, j.miss])) +
        '|' +
        R.haulSig +
        '|' +
        R.haulPending ===
        before,
      'renderResult does not mutate the plan'
    );
  }

  // 20. refreshHaul: no work while the signature is unchanged, one run per new signature, redraw only when fresh
  {
    route = (a, b) => ({ delay: 20, path: [a, b] });
    const RR = { trees: [tree(60000006)], jobs: [] };
    ok((await T.refreshHaul(RR)) === true && !!RR.haulSig, 'first refresh publishes');
    ok((await T.refreshHaul(RR)) === false, 'unchanged assignment is not prepared again');
    RR.trees = [tree(60000007)];
    const p1 = T.refreshHaul(RR),
      p2 = T.refreshHaul(RR);
    const [r1, r2] = await Promise.all([p1, p2]);
    ok(
      r1 === true && r2 === false && RR.haulPending == null,
      'one preparation per new assignment (' + r1 + ',' + r2 + ')'
    );
    const el3 = d.createElement('div');
    d.body.appendChild(el3);
    RR.trees = [tree(60000006)];
    RR.buyList = new Map();
    RR.usedList = new Map();
    RR.warn = [];
    let ok3 = true;
    try {
      T.showResult(el3, { ...R }, () => {});
    } catch (e) {
      ok3 = false;
      console.log(e.stack);
    }
    ok(ok3, 'showResult draws a full plan');
  }
  // 21. broker fee at an NPC station uses the RAW standings. Measured in game: Broker Relations 5, Connections 5,
  //     faction 4.77 / corp 8.61 shown in game (skill-adjusted, rounded), raw 3.46 / 8.27 from ESI -> order fee 1.2309%.
  //     Adjusted standings would give 1.18%.
  {
    T.setChars([{ id: 7, name: 'Broker', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
    T.setData({
      7: {
        assets: [],
        bps: [],
        skills: { 3446: 5, 3359: 5 },
        jobs: [],
        std: { 500001: 3.46, 1000035: 8.266 },
        at: Date.now()
      }
    });
    T.LI[60009999] = { name: 'Zzyzx Test Station', system: 30001, owner: 1000035 };
    T.CORPFAC[1000035] = 500001;
    T.names[500001] = 'Test Faction';
    T.names[1000035] = 'Test Corp';
    const savedBroker = T.S.broker;
    T.S.broker = '';
    const got = T.brokerFeeOf(7, 60009999);
    ok(
      Math.abs(got * 100 - 1.2309) < 0.001,
      'broker fee matches the in-game value 1.2309% (' + (got * 100).toFixed(4) + '%)'
    );
    const ex = T.brokerExplain(7, 60009999);
    ok(
      /Test Faction standing 3,46/.test(ex) &&
        /Test Corp standing 8,27/.test(ex) &&
        /4,77/.test(ex) &&
        /8,61/.test(ex) &&
        /= 1,23%/.test(ex),
      'tooltip names the faction and corp with raw and in-game values: ' + ex
    );
    ok(
      T.brokerFeeOf(7, 60009998) === 0.015 && /standing nélkül/.test(T.brokerExplain(7, 60009998)),
      'unknown owner: no standing reduction, said in the tooltip'
    );
    T.CORPFAC[1000035] = 0;
    ok(
      Math.abs(T.brokerFeeOf(7, 60009999) - (0.015 - 0.0002 * 8.266)) < 1e-12 &&
        /nincs, vagy nem ismert/.test(T.brokerExplain(7, 60009999)),
      'corp without faction: only the corp standing counts'
    );
    T.CORPFAC[1000035] = 500001;
    T.S.broker = savedBroker;
  }

  // 22a. station owner faction comes from EVE Ref (ESI gives none for NPC corps); a corp without faction is 0
  {
    await T.ensureOwners([60007771, 60007772]);
    const a = T.stationOwner(60007771),
      b = T.stationOwner(60007772);
    ok(
      a && a.corp === 1000041 && a.fac === 500001,
      'faction of the station owner corp from EVE Ref (' + JSON.stringify(a) + ')'
    );
    ok(b && b.fac === 0, 'corp without faction stored as 0 (' + JSON.stringify(b) + ')');
    ok(corpCalls === 0, 'no ESI /corporations/ call for the faction');
  }

  // 22. changing the second market redraws the selling tab and blanks stale profit columns
  {
    const ss = T.S;
    ss.market2 = 60009999;
    T.setSales([
      {
        o: {
          t: 34,
          cid: 7,
          buy: false,
          p: 4,
          rem: 1,
          tot: 1,
          l: 60003760,
          exp: Date.now() + 1e9,
          iss: new Date().toISOString(),
          dur: 90
        },
        best: null,
        state: 'egyedül',
        sugg: null
      }
    ]);
    await T.refreshMarket2();
    const sl = d.querySelector('#slOut') || d.querySelector('#tab-sales');
    ok(/Zzyzx/.test(sl.textContent), 'selling tab shows the new second market right after the change');
    ok(T.PROFM2 !== ss.market2, 'profit rows remember the market they were calculated with');
    ss.market2 = '';
  }
  // 23. parallel manufacturing: runs spread over several blueprints, limited by blueprints, slots and time
  {
    const opt = { useStock: false, buildOwn: false, incoming: false, ore: false };
    const slots7 = { 3380: 5, 3387: 4, 24625: 2 }; // Industry V, Mass Production IV, Advanced Mass Production II
    const bpc = (i, cid) => ({ i, t: 688, me: 10, te: 20, r: 4, q: -2, l: 60003760, cid });
    const setup = (skills, bps) => {
      T.setChars([
        { id: 1, name: 'A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 },
        { id: 2, name: 'B', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }
      ]);
      T.setData({
        1: { assets: [], bps: bps.filter(b => b.cid === 1), skills, jobs: [], at: Date.now() },
        2: { assets: [], bps: bps.filter(b => b.cid === 2), skills, jobs: [], at: Date.now() }
      });
    };
    const runsOf = R => R.jobs.filter(j => j.top).map(j => j.runs);
    const three = [bpc(301, 1), bpc(302, 1), bpc(303, 1)];
    setup(slots7, three);
    const S0 = T.S;
    S0.parallel = false;
    let R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    ok(JSON.stringify(runsOf(R)) === '[4]', 'parallel off: one job on the first copy (' + runsOf(R) + ')');
    S0.parallel = true;
    S0.parMode = 'speed';
    R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    ok(
      JSON.stringify(runsOf(R)) === '[2,1,1]' && R.par.length === 1,
      'speed: 4 runs over 3 copies (' + runsOf(R) + ')'
    );
    S0.parMode = 'material';
    // with structure ME 1% some materials round up per job, so splitting would need more: no split
    R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    ok(
      runsOf(R).length === 1 && R.par.length === 0,
      'less material: no split when it would need more (' + runsOf(R) + ')'
    );
    // without structure ME every quantity divides exactly: the split costs nothing and is kept
    const sme = S0.structME;
    S0.structME = '';
    R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    // 2+1+1 would need one more unit of a 75-per-run material (67.5 rounds up per job), 2+2 needs none
    ok(
      JSON.stringify(runsOf(R)) === '[2,2]' && R.par[0].extra.length === 0,
      'less material: the most jobs that need no extra material (' + runsOf(R) + ')'
    );
    S0.structME = sme;
    S0.parMode = 'speed';
    R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    ok(R.par[0].extra.length > 0, 'speed: the extra material is reported');
    await T.finishResult(R, three[0]);
    const elp = d.createElement('div');
    d.body.appendChild(elp);
    T.renderResult(elp, R, () => {});
    ok(
      /Párhuzamos gyártás \(gyorsabb\): .*1 → 3 job/.test(elp.textContent) && /Többletanyag/.test(elp.textContent),
      'plan shows the split and the extra material'
    );
    const stack = [{ i: 310, t: 688, me: 10, te: 20, r: -1, q: 3, l: 60003760, cid: 1 }];
    setup(slots7, stack);
    S0.parMode = 'speed';
    R = await T.makeMulti([{ copies: stack, runs: 6 }], opt);
    ok(JSON.stringify(runsOf(R)) === '[2,2,2]', 'a stack of 3 BPOs runs 3 jobs (' + runsOf(R) + ')');
    setup({}, three);
    R = await T.makeMulti([{ copies: three, runs: 4 }], opt);
    ok(runsOf(R).length === 1 && R.par.length === 0, 'one free slot: no split (' + runsOf(R) + ')');
    // two jobs on two characters' copies must not both move onto the same blueprint
    const two = [bpc(321, 1), bpc(322, 2)];
    setup(slots7, two);
    R = await T.makeMulti([{ copies: two, runs: 8 }], opt);
    T.assignChars(R.jobs);
    const ids = R.jobs.filter(j => j.top).map(j => j.bp.i);
    ok(ids.length === 2 && new Set(ids).size === 2, 'jobs keep separate blueprints after assignment (' + ids + ')');
    S0.parallel = false;
    S0.parMode = 'material';
  }
  // 24. html templates escape by default
  {
    const x = `<b a="1" b='2'>&`;
    const h = T.html`<td title="${x}">${x}${T.html`<i>${x}</i>`}${[x, T.raw('<u>ok</u>')]}${null}${false}${0}</td>`;
    ok(
      String(h) ===
        '<td title="&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;">&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;<i>&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;</i>&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;<u>ok</u>0</td>',
      'html`` escapes values and passes nested templates, arrays and raw()'
    );
    const el = d.createElement('div');
    T.setHtml(el, '<b class="pwn2">x</b>');
    ok(
      !el.querySelector('.pwn2') && el.textContent === '<b class="pwn2">x</b>',
      'setHtml shows a plain string as text'
    );
    T.setHtml(el, T.html`<table><tbody><tr>${h}</tr></tbody></table>`);
    ok(el.querySelector('td i') && el.querySelector('td u'), 'setHtml renders a template');
  }
  // 25. broker fee is at least 100 ISK per order
  {
    const f = { tax: 0.0337, broker: 0.0123 };
    ok(Math.abs(T.netOfFees(5000, f) - (5000 - 168.5 - 100)) < 1e-9, 'small order: broker fee 100 ISK minimum');
    ok(Math.abs(T.netOfFees(1e6, f) - (1e6 - 33700 - 12300)) < 1e-6, 'large order: broker fee by rate');
    ok(T.netOfFees(0, f) === 0 && T.netOfFees(NaN, f) === 0, 'no value, no fee');
  }
  // 26. where to buy: manual price, a picked station (order book depth, rest from Jita), market search
  {
    const ss = T.S;
    mktOrders['10000002|34'] = [
      { location_id: 60003760, system_id: 30000142, price: 3.7, volume_remain: 1e9, is_buy_order: false },
      { location_id: 60009001, system_id: 30001, price: 3.0, volume_remain: 1000, is_buy_order: false },
      { location_id: 60009001, system_id: 30001, price: 3.5, volume_remain: 5000, is_buy_order: false },
      { location_id: 60009002, system_id: 30002, price: 2.0, volume_remain: 1e6, is_buy_order: false }
    ];
    ss.mktRegions = [10000002];
    await T.loadMarket([34], true);
    ss.buySrc = { 34: 60009001 };
    let p = T.buyParts(34, 3000);
    ok(
      p.length === 1 && p[0].l === 60009001 && Math.abs(p[0].p - (1000 * 3 + 2000 * 3.5) / 3000) < 1e-9,
      'picked station: average over the order book'
    );
    p = T.buyParts(34, 10000);
    ok(
      p.length === 2 && p[0].q === 6000 && p[1].l === 60003760 && p[1].q === 4000,
      'what the station lacks comes from Jita (' + JSON.stringify(p.map(x => [x.l, x.q])) + ')'
    );
    ss.manPrice = { 34: 1.5 };
    p = T.buyParts(34, 10000);
    ok(p.length === 1 && p[0].l === null && T.buyPrice(34, 10000) === 1.5, 'manual price wins and is not hauled');
    ss.manPrice = {};
    ss.buySrc = {};
    ok(T.buyParts(34, 10)[0].l === 60003760, 'default source is Jita');
    // search: 60009002 is cheapest but its route leaves highsec, so with highsec only it is left out
    T.LI[60009001] = { name: 'Near Station', system: 30001 };
    T.LI[60009002] = { name: 'Far Station', system: 30002 };
    T.LI[60009000] = { name: 'Home', system: 30003 };
    route = (a, b) => (b === 30001 ? [a, 30004, b] : [a, 30005, b]);
    T.SYSSEC[30003] = 0.9;
    T.SYSSEC[30004] = 0.8;
    T.SYSSEC[30005] = 0.1;
    T.SYSSEC[30001] = 0.7;
    T.SYSSEC[30002] = 0.6;
    ss.prodLoc = 60009000;
    ss.mktHsOnly = true;
    ss.mktMaxJumps = 10;
    const RR = { trees: [{ tree: { t: 638, build: { jobs: [] }, jobsRef: [] } }], buyList: new Map([[34, 3000]]) };
    let res = await T.mktSearch(RR);
    const c = res.rows[0].cands;
    ok(
      c.length === 1 && c[0].l === 60009001 && c[0].n === 2 && c[0].hs === true,
      'highsec only: the station behind lowsec is left out (' + JSON.stringify(c.map(x => [x.l, x.n, x.hs])) + ')'
    );
    ss.mktHsOnly = false;
    res = await T.mktSearch(RR);
    ok(
      res.rows[0].cands[0].l === 60009002 && res.rows[0].cands.every(x => x.l !== 60003760),
      'without the limit the cheapest comes first; Jita itself is not a candidate'
    );
    ss.mktMaxJumps = 1;
    res = await T.mktSearch(RR);
    ok(res.rows[0].cands.length === 0, 'jump limit');
    ss.prodLoc = '';
    ss.mktHsOnly = true;
    ss.mktMaxJumps = 10;
  }
  // 27. settings change only through setSetting/setSettingIn: checked, saved, announced
  {
    const seen = [];
    T.onSetting(k => seen.push(k));
    const before = T.S.mktMaxJumps;
    ok(T.setSetting('mktMaxJumps', 7) === true && T.S.mktMaxJumps === 7, 'valid value is stored');
    ok(JSON.parse(w.localStorage.getItem('indyops.settings')).mktMaxJumps === 7, 'and saved');
    ok(T.setSetting('mktMaxJumps', 'sok') === false && T.S.mktMaxJumps === 7, 'wrong type is rejected');
    ok(T.setSetting('noSuchKey', 1) === false && !('noSuchKey' in T.S), 'unknown key is rejected');
    T.setSettingIn('manPrice', 34, 2.5);
    T.setSettingIn('manPrice', 35, 9);
    T.setSettingIn('manPrice', 34, null);
    ok(
      JSON.stringify(T.S.manPrice) === '{"35":9}',
      'map entries are set and removed (' + JSON.stringify(T.S.manPrice) + ')'
    );
    ok(
      seen.join(',') === 'mktMaxJumps,manPrice,manPrice,manPrice',
      'listeners hear every stored change (' + seen + ')'
    );
    T.setSetting('manPrice', {});
    T.setSetting('mktMaxJumps', before ?? 10);
  }
  // 28. a setting change redraws the open plan; settings the calculation uses mark it out of date
  {
    const el = d.createElement('div');
    d.body.appendChild(el);
    let reruns = 0;
    T.setLast(R, () => T.showResult(el, R, () => reruns++));
    const sme = T.S.structME;
    T.setSettingIn('manPrice', 34, 1.11);
    ok(
      /kézi ár/.test(el.textContent) && !/A számolás óta megváltozott/.test(el.textContent),
      'manual price: redrawn, still up to date'
    );
    T.setSetting('structME', 2);
    ok(
      /A számolás óta megváltozott: struktúra ME bónusz/.test(el.textContent),
      'structure ME: plan marked out of date'
    );
    el.querySelector('[data-rerun]').click();
    ok(reruns === 1, 'the note recalculates the plan');
    T.setSettingIn('manPrice', 34, null);
    T.setSetting('structME', sme ?? '');
    R.stale = null;
    T.setLast(null, null);
  }
  // 29. projects change only through the project functions
  {
    const keep = JSON.stringify(T.PROJ),
      keepSel = T.SELP;
    T.deleteProject && T.PROJ.slice().forEach(p => T.deleteProject(p.id));
    ok(T.PROJ.length === 0 && T.SELP === null, 'all projects deleted');
    const a = T.addToProject({ bpType: 688, runs: 1 }, 'Auto', x => x.bpType === 688);
    T.addToProject({ bpType: 688, runs: 1 }, 'Auto', x => x.bpType === 688);
    ok(
      T.PROJ.length === 1 && a.name === 'Auto' && T.PROJ[0].items[0].runs === 2,
      'add to project creates one and adds runs to the same item'
    );
    const b = T.createProject('B');
    ok(T.SELP === b.id && b.id !== a.id, 'new project is selected, ids differ even when created at once');
    T.moveProject(1, -1);
    ok(T.PROJ[0].id === b.id, 'move up changes the priority');
    T.updateProject(a.id, p => (p.active = false));
    ok(
      JSON.parse(w.localStorage.getItem('indyops.projects')).find(p => p.id === a.id).active === false,
      'changes are stored'
    );
    T.deleteProject(b.id);
    ok(T.SELP === a.id, 'deleting the selected project selects the first one');
    T.deleteProject(a.id);
    JSON.parse(keep).forEach(p => T.updateProject(T.createProject(p.name).id, q => Object.assign(q, p)));
    if (keepSel != null) T.selectProject(keepSel);
  }
  // 30. after the character data changed, the plan on screen is calculated again (once, after the last change)
  {
    T.setRecalcDelay(20);
    let n = 0;
    T.setLast(R, () => {});
    T.setRerun(async () => n++);
    T.charDataChanged();
    T.charDataChanged();
    T.charDataChanged();
    await new Promise(r => setTimeout(r, 150));
    ok(n === 1, 'one recalculation after three quick data changes (' + n + ')');
    T.setLast(null, null);
    T.setRerun(null);
    T.charDataChanged();
    await new Promise(r => setTimeout(r, 100));
    ok(n === 1, 'nothing on screen: nothing recalculated');
  }
  // 31. bought although stock is left: the material tree says how much, why and where
  {
    T.setChars([{ id: 1, name: 'A', refresh: 'x', access: 'x', exp: Date.now() + 1e9 }]);
    T.setData({
      1: {
        assets: [
          { t: 34, q: 1000, l: 60003760, f: 'Hangar', c: null },
          { t: 34, q: 5000, l: 60008494, f: 'Hangar', c: null }
        ],
        bps: [{ i: 401, t: 688, me: 10, te: 20, r: 5, q: -2, l: 60003760, cid: 1 }],
        skills: { 3380: 5 },
        jobs: [],
        at: Date.now()
      }
    });
    const bp = { i: 401, t: 688, me: 10, te: 20, r: 5, q: -2, l: 60003760, cid: 1 };
    const item = { copies: [bp], runs: 1, src: { mode: 'sel', locs: [60003760], conts: [], excl: [] } };
    const RR = await T.makeMulti([item], { useStock: true, buildOwn: false, incoming: false, ore: false });
    const trit = RR.trees[0].tree.ch.find(c => c.t === 34);
    ok(
      trit && trit.buy > 0 && trit.why && trit.why.src === 5000 && trit.why.at.get('60008494|') === 5000,
      'unused stock outside the sources is reported with its place (' +
        JSON.stringify(trit && trit.why && { src: trit.why.src, at: [...trit.why.at] }) +
        ')'
    );
    const el = d.createElement('div');
    d.body.appendChild(el);
    await T.finishResult(RR, bp);
    T.renderResult(el, RR, () => {});
    ok(/Készletben még: 5000 nincs a nyersanyag-források között\. Itt: /.test(el.textContent), 'and the tree shows it');
    // with both places among the sources the stock comes from two places, each with its quantity
    item.src.locs.push(60008494);
    const R2 = await T.makeMulti([item], { useStock: true, buildOwn: false, incoming: false, ore: false });
    await T.finishResult(R2, bp);
    T.renderResult(el, R2, () => {});
    const row = [...el.querySelectorAll('tr[data-toggle], tr')].find(
      tr => /^Tritanium/.test(tr.textContent.trim()) && tr.querySelector('td.src')
    );
    ok(
      row && /\(5000\)/.test(row.textContent) && /\(1000\)/.test(row.textContent),
      'quantity per source place: ' + (row && row.lastElementChild.textContent)
    );
    // 33. remote stock can be left out of the haul plan: the plan then buys the shortfall, and it can be taken back
    const key = '60008494|60003760';
    ok(!!el.querySelector('[data-leave="' + key + '"]'), 'the stock route has a "leave it, buy instead" button');
    const opt = { useStock: true, buildOwn: false, incoming: false, ore: false, leave: true };
    const before = (await T.makeMulti([item], opt)).trees[0].tree.ch.find(c => c.t === 34);
    T.setSettingIn('leave', key, true);
    const R3 = await T.makeMulti([item], opt);
    const t3 = R3.trees[0].tree.ch.find(c => c.t === 34);
    ok(
      t3.stock.every(x => x.l !== 60008494) && t3.buy === before.buy + 5000 && t3.why && t3.why.left === 5000,
      'left stock is not taken but bought (' +
        JSON.stringify({ buy: [before.buy, t3.buy], why: t3.why && t3.why.left }) +
        ')'
    );
    const other = (await T.makeMulti([item], Object.assign({}, opt, { leave: false }))).trees[0].tree.ch.find(
      c => c.t === 34
    );
    ok(other.buy === before.buy, 'callers without opt.leave (e.g. what can I build) are not affected');
    await T.finishResult(R3, bp);
    T.renderResult(el, R3, () => {});
    ok(
      !!el.querySelector('[data-unleave="' + key + '"]') && /5000 otthagyva/.test(el.textContent),
      'the haul plan lists it with a way back, the tree says why it is bought'
    );
    T.setSettingIn('leave', key, null);
  }
  {
    // 32. haul time: the ship first flies empty to the cargo, then loaded there and empty back between trips, plus docking
    const R = {
      haulCtx: {
        jumps: { '1|2': { n: 9, hs: true } },
        ships: [{ n: 'Hauler', t: 20183, g: 513, cid: 1, l: 3, cap: 500000, canFly: true }],
        pos: { '3|1': 9 }
      }
    };
    const el = d.createElement('div');
    T.setHtml(el, T.shipAdvice(R, '1|2', 48000, 1));
    const want = T.dur((9 + 9) * 180 + 2 * 120);
    ok(
      el.textContent.includes('9 ugrás üresen') && el.textContent.includes('kb. ' + want),
      'haul time counts the empty flight and docking (' + want + '): ' + el.textContent
    );
  }
  {
    // 34. a run that makes several pieces (3 per run): the build cell says how many runs and how many are left over
    const n = { t: 1, need: 270, stock: [{ l: 1, q: 268 }], build: { jobs: [{ r: 1 }], made: 3 } };
    const el = d.createElement('div');
    if (T.madeNote) T.setHtml(el, T.madeNote(n));
    const nd = el.firstElementChild;
    ok(
      !!nd && nd.textContent === '1×3 +1' && nd.title === '1 run × 3 db · 1 felesleg',
      'runs × pieces per run and the spare, short in the cell, full on hover: ' +
        (nd && nd.textContent + ' / ' + nd.title)
    );
    const one = { t: 1, need: 5, stock: [], build: { jobs: [{ r: 5 }], made: 5 } };
    ok(!T.madeNote || String(T.madeNote(one)) === '', 'nothing extra when a run makes one piece');
  }
  console.log(`regress: ${checks - fails}/${checks} checks passed`);
})().catch(e => console.error('FAIL', e));
