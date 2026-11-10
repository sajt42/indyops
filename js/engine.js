/* IndyOps – Production engine: material trees, BPC runs, invention, job cost and time. */
'use strict';
/* ============ planning engine ============ */
let BPPROD = {}; // bpTypeId -> {prod, qty, act}
async function indexBPProducts() {
  const types = [...new Set(allBPs().map(b => b.t))];
  status('receptek: ' + types.length + ' blueprint…');
  await Promise.all(
    types.map(async t => {
      const b = await refGet('b', t);
      if (!b) return;
      const a = b.m ? 'm' : b.r ? 'r' : null;
      if (!a) return;
      const p = b[a].p[0];
      if (p) BPPROD[t] = { prod: p[0], qty: p[1], act: a };
    })
  );
  status('kész');
}
function ownedFor(prodType) {
  // own copies, best first
  const list = allBPs().filter(b => BPPROD[b.t] && BPPROD[b.t].prod === prodType);
  return list.sort((a, b) => (b.r === -1) - (a.r === -1) || b.me - a.me || b.te - a.te);
}
/* stock pool: hangars + (optionally) ore + products of running jobs */
async function buildPool(opt) {
  const pool = new Map();
  if (opt.useStock) {
    const sm = stockMap(false);
    for (const [t, arr] of sm)
      pool.set(
        t,
        arr.map(x => Object.assign({}, x))
      );
    if (opt.ore) await addOreToPool(pool);
  }
  if (opt.incoming) {
    for (const [cid, d] of Object.entries(DATA)) {
      if (!CHARS.find(c => c.id == cid)) continue;
      for (const j of d.jobs) {
        if (j.st !== 'active' || !(j.act === 1 || j.act === 9 || j.act === 11) || !j.prod) continue;
        const meta = BPPROD[j.bp];
        const q = j.runs * (meta ? meta.qty : 1);
        let a = pool.get(j.prod);
        if (!a) {
          a = [];
          pool.set(j.prod, a);
        }
        a.push({ l: 'job', cid: Number(cid), q });
      }
    }
  }
  return pool;
}
/* ---- material trees for several items from one stock ----
 * makeMulti(items, opt, shared) builds one tree per item. All items draw from the same stock pool and the same
 * blueprint runs; pass shared={pool,runsLeft} to share them between calls (projects calculated one after another).
 * Result: {trees:[{item,tree,made}], buyList: Map type->qty, usedList: Map type->qty taken from own stock,
 *          jobs: [job], warn: [{t,miss}|{txt}]}
 * A tree node: {t, need, stock:[taken pool entries], build:{act,jobs:[{c,r,short}],made}|null, buy, ch:[nodes], jobsRef:[jobs]}
 */
function planContext(opt, pool, runsLeft) {
  return {
    opt,
    pool,
    runsLeft,
    resv: reservedMap(),
    filters: new Map(), // per item: which stock entries it may take
    buyList: new Map(),
    usedList: new Map(),
    jobs: [],
    warn: [],
    structME: Number(S.structME || 0) / 100
  };
}

function stockAllowed(ctx, item) {
  let f = ctx.filters.get(item);
  if (!f) {
    f = stockFilter(item, ctx.resv);
    ctx.filters.set(item, f);
  }
  return f;
}

// takes up to q of type t from the pool entries the item may use; returns what was taken
function takeStock(ctx, t, q, item) {
  const arr = ctx.pool.get(t);
  if (!arr) return [];
  const ok = stockAllowed(ctx, item);
  const used = [];
  let rem = q;
  for (const x of arr) {
    if (rem <= 0) break;
    if (!ok(x)) continue;
    const k = Math.min(x.q, rem);
    if (k > 0) {
      x.q -= k;
      rem -= k;
      used.push({ l: x.l, cid: x.cid, q: k, ore: x.ore, c: x.c ?? null });
    }
  }
  return used;
}

// what a job makes beyond the need goes back to the pool for later nodes and items
function addSurplus(ctx, t, q) {
  if (q <= 0) return;
  let arr = ctx.pool.get(t);
  if (!arr) {
    arr = [];
    ctx.pool.set(t, arr);
  }
  arr.push({ l: 'surplus', cid: 0, q });
}

// recipe of the first copy; null means "buy it" (a missing recipe on the top item is an error)
async function recipeOf(copies, depth) {
  const meta = BPPROD[copies[0].t];
  const bpr = meta ? await refGet('b', copies[0].t) : null;
  const rec = bpr && bpr[meta.act];
  if (!rec) {
    const name = NAMES[copies[0].t] || '#' + copies[0].t;
    if (depth === 0) throw new Error(name + ': nem találtam a gyártási receptjét az EVE Ref adatbázisban.');
    log('Recept hiányzik, vásárlásként számolom: ' + (NAMES[copies[0].t] || copies[0].t));
    return null;
  }
  return { meta, rec };
}

// spreads the needed runs over the copies in order (BPOs are unlimited, BPC runs are tracked in ctx.runsLeft);
// runs that fit nowhere go on the first copy marked short, with a warning
function allocateRuns(ctx, t, copies, runsNeed) {
  const jl = [];
  for (const c of copies) {
    if (runsNeed <= 0) break;
    const avail = c.r === -1 ? Infinity : ctx.runsLeft.has(c.i) ? ctx.runsLeft.get(c.i) : c.r;
    if (avail <= 0) continue;
    const r = Math.min(avail, runsNeed);
    runsNeed -= r;
    if (c.r !== -1) ctx.runsLeft.set(c.i, avail - r);
    jl.push({ c, r });
  }
  if (runsNeed > 0) {
    ctx.warn.push({ t, miss: runsNeed });
    jl.push({ c: copies[0], r: runsNeed, short: true });
  }
  return jl;
}

// material quantity of one job: blueprint ME and structure ME apply to manufacturing only, rounded up per job,
// never less than one unit per run
function jobMaterialQty(q, runs, act, me, structME) {
  const m = act === 'm';
  return Math.max(
    runs,
    Math.ceil(Math.round(q * runs * (1 - (m ? me : 0) / 100) * (1 - (m ? structME : 0)) * 100) / 100)
  );
}

async function planNode(ctx, t, need, depth, forced, item) {
  const n = { t, need, stock: [], build: null, buy: 0, ch: [], jobsRef: [] };
  if (depth > 0 && ctx.opt.useStock !== false) {
    n.stock = takeStock(ctx, t, need, item);
    need -= n.stock.reduce((s, x) => s + x.q, 0);
    for (const x of n.stock)
      if (x.l !== 'surplus' && x.l !== 'job') ctx.usedList.set(t, (ctx.usedList.get(t) || 0) + x.q);
  }
  if (need <= 0) return n;
  let copies = forced ? forced : ownedFor(t);
  if (copies.length) copies = copies.filter(c => c.t === copies[0].t);
  const wantBuild = depth === 0 || (ctx.opt.buildOwn && copies.length && S.buyOverride[t] !== true);
  const recipe = wantBuild && copies.length ? await recipeOf(copies, depth) : null;
  if (!recipe) {
    n.buy = need;
    ctx.buyList.set(t, (ctx.buyList.get(t) || 0) + need);
    return n;
  }
  const { meta, rec } = recipe;
  const act = meta.act;
  const jl = allocateRuns(ctx, t, copies, Math.ceil(need / meta.qty));
  const made = jl.reduce((s, x) => s + x.r, 0) * meta.qty;
  n.build = { act, jobs: jl, made };
  const matNeed = new Map();
  for (const j of jl) {
    for (const [m, q] of rec.m)
      matNeed.set(m, (matNeed.get(m) || 0) + jobMaterialQty(q, j.r, act, j.c.me, ctx.structME));
    const job = {
      t,
      bp: j.c,
      runs: j.r,
      act,
      time: rec.t,
      short: !!j.short,
      base: rec.m,
      miss: missingSkills(j.c.cid, rec),
      item,
      top: depth === 0
    };
    ctx.jobs.push(job);
    n.jobsRef.push(job);
  }
  for (const [m, q] of matNeed) n.ch.push(await planNode(ctx, m, q, depth + 1, null, item));
  addSurplus(ctx, t, made - need);
  if (depth === 0) n.made = made;
  return n;
}

// T2 item: adds an invention node in front of the tree (datacores, decryptor, the invention job, and a copy job
// when the T1 blueprint is a BPO; with a T1 BPC its runs are used up and checked)
async function addInvention(ctx, it, tree) {
  const t1 = it.inv.t1;
  const t1bp = await refGet('b', t1.t);
  const inv = t1bp && t1bp.i;
  if (!inv || !tree.build) return;
  const info = invInfo(t1bp, it.inv.dec, it.inv.pi || 0);
  const t2runs = tree.build.jobs.reduce((s, j) => s + j.r, 0);
  const bpcs = Math.ceil(t2runs / info.runsPer);
  const attempts = it.inv.expected ? bpcs / info.chance : Math.ceil(bpcs / info.chance);
  const invNode = {
    t: it.copies[0].t,
    need: bpcs,
    stock: [],
    build: { act: 'i', jobs: [], made: bpcs },
    buy: 0,
    ch: [],
    jobsRef: [],
    inv: { attempts, chance: info.chance, runsPer: info.runsPer, dec: it.inv.dec }
  };
  for (const [m, q] of inv.m) invNode.ch.push(await planNode(ctx, m, q * attempts, 1, null, it));
  if (it.inv.dec) invNode.ch.push(await planNode(ctx, it.inv.dec, attempts, 1, null, it));
  const t2b = await refGet('b', it.copies[0].t);
  const t2rec = t2b && t2b.m;
  if (!t2rec) return;
  const job = {
    t: it.copies[0].t,
    bp: Object.assign({}, t1),
    runs: attempts,
    act: 'i',
    time: inv.t,
    base: t2rec.m,
    cm: 0.02,
    rs: inv.rs,
    miss: missingSkills(t1.cid, { rs: inv.rs }),
    item: it,
    top: false,
    invInfo: info
  };
  ctx.jobs.push(job);
  invNode.jobsRef.push(job);
  if (t1.r === -1) {
    const cj = {
      t: t1.t,
      bp: Object.assign({}, t1),
      runs: Math.ceil(attempts),
      act: 'c',
      time: t1bp.ct || 0,
      base: (t1bp.m || t1bp.r || { m: [] }).m,
      cm: 0.02,
      rs: null,
      miss: [],
      item: it,
      top: false
    };
    ctx.jobs.push(cj);
    invNode.jobsRef.push(cj);
  } else {
    const left = ctx.runsLeft.has(t1.i) ? ctx.runsLeft.get(t1.i) : t1.r;
    const need = Math.ceil(attempts);
    if (need > left)
      ctx.warn.push({
        txt: T(
          '{0}: a T1 BPC-n {1} run van, az inventionhöz {2} kellene. Húzz copyt a BPO-ról, vagy szerezz BPC-t.',
          NAMES[t1.t] || t1.t,
          left,
          need
        )
      });
    ctx.runsLeft.set(t1.i, Math.max(0, left - need));
  }
  tree.ch.unshift(invNode);
}

async function makeMulti(items, opt, shared) {
  const pool = (shared && shared.pool) || (await buildPool(opt));
  const runsLeft = (shared && shared.runsLeft) || new Map();
  const ctx = planContext(opt, pool, runsLeft);
  const trees = [];
  for (const it of items) {
    const meta = BPPROD[it.copies[0].t];
    const tree = await planNode(ctx, meta.prod, it.runs * meta.qty, 0, it.copies, it);
    if (it.inv) await addInvention(ctx, it, tree);
    trees.push({ item: it, tree, made: tree.made || 0 });
  }
  return { trees, buyList: ctx.buyList, usedList: ctx.usedList, jobs: ctx.jobs, warn: ctx.warn };
}
const DECS = {
  34201: { n: 'Accelerant Decryptor', p: 1.2, me: 2, te: 10, runs: 1 },
  34202: { n: 'Attainment Decryptor', p: 1.8, me: -1, te: 4, runs: 4 },
  34203: { n: 'Augmentation Decryptor', p: 0.6, me: -2, te: 2, runs: 9 },
  34204: { n: 'Parity Decryptor', p: 1.5, me: 1, te: -2, runs: 3 },
  34205: { n: 'Process Decryptor', p: 1.1, me: 3, te: 6, runs: 0 },
  34206: { n: 'Symmetry Decryptor', p: 1, me: 1, te: 8, runs: 2 },
  34207: { n: 'Optimized Attainment Decryptor', p: 1.9, me: 1, te: -2, runs: 2 },
  34208: { n: 'Optimized Augmentation Decryptor', p: 0.9, me: 2, te: 0, runs: 7 }
};
function invChance(cid, inv, dec, pi = 0) {
  let sci = 0,
    enc = 0;
  for (const sk of Object.keys(inv.rs || {})) {
    const l = lvlOf(cid, sk);
    if (/Encryption/i.test(NAMES[sk] || '')) enc = l;
    else sci += l;
  }
  return Math.min(1, inv.p[pi][2] * (1 + sci / 30 + enc / 40) * (dec ? DECS[dec].p : 1));
}
function invInfo(t1bp, dec, pi = 0) {
  const inv = t1bp.i;
  pi = Math.min(pi, inv.p.length - 1);
  const cs = workChars();
  let best = cs[0] ?? null,
    bc = -1;
  for (const c of cs) {
    const ch = invChance(c, inv, dec, pi);
    if (ch > bc) {
      bc = ch;
      best = c;
    }
  }
  const d = dec ? DECS[dec] : null;
  return {
    chance: bc < 0 ? inv.p[pi][2] * (d ? d.p : 1) : bc,
    runsPer: Math.max(1, inv.p[pi][1] + (d ? d.runs : 0)),
    me: 2 + (d ? d.me : 0),
    te: 4 + (d ? d.te : 0),
    char: best,
    t2bp: inv.p[pi][0],
    pi
  };
}
async function virtualItem(t1copy, dec, runs, label, expected, pi = 0) {
  // T2 BPC still to be invented, as a "virtual" copy
  const t1bp = await refGet('b', t1copy.t);
  if (!t1bp || !t1bp.i || !t1bp.i.p.length) return null;
  await resolveNames(Object.keys(t1bp.i.rs || {}).map(Number));
  const info = invInfo(t1bp, dec, pi);
  const t2bp = await refGet('b', info.t2bp);
  if (!t2bp || !t2bp.m) return null;
  BPPROD[info.t2bp] = { prod: t2bp.m.p[0][0], qty: t2bp.m.p[0][1], act: 'm' };
  const vc = {
    virtual: true,
    i: 'v' + info.t2bp + '_' + (dec || 0) + '_' + info.pi,
    t: info.t2bp,
    me: info.me,
    te: info.te,
    r: -1,
    cid: t1copy.cid,
    l: t1copy.l
  };
  return { copies: [vc], runs: runs || info.runsPer, label, inv: { t1: t1copy, dec, expected, pi: info.pi }, info };
}
async function makePlan(topBP, runs, opt) {
  const r = await makeMulti([{ copies: [topBP], runs }], opt);
  return {
    tree: r.trees[0].tree,
    buyList: r.buyList,
    usedList: r.usedList,
    jobs: r.jobs,
    warn: r.warn,
    top: topBP,
    runs
  };
}
async function addOreToPool(pool) {
  const ores = new Set(await ensureOres());
  const add = new Map();
  for (const [t, arr] of [...pool]) {
    if (!ores.has(t)) continue;
    for (const x of arr) {
      if (x.q <= 0) continue;
      const mins = await oreToMinerals(t, x.q);
      for (const [m, q] of mins) {
        if (q <= 0) continue;
        let a = pool.get(m);
        if (!a) {
          a = [];
          pool.set(m, a);
        }
        a.push({ l: x.l, cid: x.cid, q, ore: t, c: x.c ?? null });
      }
      x.q = 0;
    }
  }
}
async function prefetchTree(prodType, seen = new Set()) {
  // prefetch recipes in parallel
  if (seen.has(prodType)) return;
  seen.add(prodType);
  const copies = ownedFor(prodType);
  if (!copies.length) return;
  const meta = BPPROD[copies[0].t];
  const bp = await refGet('b', copies[0].t);
  const rec = bp && bp[meta.act];
  if (!rec) return;
  await Promise.all(rec.m.map(([m]) => prefetchTree(m, seen)));
}
function warnText(w) {
  if (w.txt) return w.txt;
  return T(
    '{0}: a saját BPC-ken nincs elég run ({1} hiányzik). A hiányzó runokat a legjobb példány ME-jével számoltam.',
    NAMES[w.t] || '#' + w.t,
    fmt(w.miss)
  );
}
function collectTypes(n, s = new Set()) {
  s.add(n.t);
  n.ch.forEach(c => collectTypes(c, s));
  return s;
}

/* ============ cost ============ */
const ACT_IDX = {
  m: 'manufacturing',
  r: 'reaction',
  i: 'invention',
  c: 'copying',
  rme: 'researching_material_efficiency',
  rte: 'researching_time_efficiency'
};
// every job uses the system of its own production location; the Settings "system" field overrides everything, "production location" overrides the location
const SYSNAME = {};
async function sysByName(n) {
  if (SYSNAME[n] !== undefined) return SYSNAME[n];
  try {
    const r = await esi('/universe/ids/', { method: 'POST', body: [n] });
    SYSNAME[n] = r.systems && r.systems[0] ? r.systems[0].id : null;
  } catch (e) {
    SYSNAME[n] = null;
  }
  return SYSNAME[n];
}
// preparation: the system override and the system of every possible BP location must be known,
// so a job's system can be computed synchronously from the FINAL (post-assignment) BP location
async function assignJobSys(jobs) {
  if (S.system) await sysByName(S.system);
  const types = new Set(jobs.map(j => j.bp && j.bp.t));
  const locs = new Set(
    allBPs()
      .filter(b => types.has(b.t))
      .map(b => b.l)
  );
  if (S.prodLoc) locs.add(Number(S.prodLoc));
  jobs.forEach(j => j.bp && locs.add(j.bp.l));
  for (const l of locs) {
    if (l == null || LOCINFO[l]) continue;
    try {
      await resolveLoc(l);
    } catch (e) {}
  }
}
function jobSysOf(j, fallback) {
  if (S.system && SYSNAME[S.system]) return SYSNAME[S.system];
  const l = S.prodLoc ? Number(S.prodLoc) : j.bp && j.bp.l;
  const li = l != null ? LOCINFO[l] : null;
  return (li && li.system) || fallback || null;
}
function jobCost(j, sysId) {
  const eiv = j.base.reduce((s, [m, q]) => s + (ADJ.p[m] || 0) * q, 0) * j.runs * (j.cm || 1);
  const index = (IDX.p[jobSysOf(j, sysId)] || {})[ACT_IDX[j.act]] || 0;
  return eiv * (index + Number(S.facTax || 0) / 100 + Number(S.scc || 0) / 100);
}
function jobTime(j) {
  const c = j.who != null ? j.who : j.bp.cid;
  if (j.act === 'i') return j.runs * j.time * (1 - 0.03 * lvlOf(c, SK.advInd));
  if (j.act === 'c') return j.runs * j.time * (1 - 0.05 * lvlOf(c, SK.science)) * (1 - 0.03 * lvlOf(c, SK.advInd));
  const te = j.act === 'm' ? j.bp.te : 0;
  const sk =
    j.act === 'm' ? (1 - 0.04 * lvlOf(c, SK.industry)) * (1 - 0.03 * lvlOf(c, SK.advInd)) : 1 - 0.04 * lvlOf(c, 45746);
  return j.runs * j.time * (1 - te / 100) * sk * (1 - Number(S.structTE || 0) / 100);
}
const slotKey = a => (a === 'm' ? 'm' : a === 'r' ? 'r' : 's');
async function sysFor(bp) {
  if (S.system) {
    const id = await sysByName(S.system);
    if (id) return id;
  }
  const l = S.prodLoc ? Number(S.prodLoc) : bp.l;
  const li = LOCINFO[l] || (await resolveLoc(l));
  return li && li.system;
}
