/* IndyOps – Invention tab: T2 invention candidates, chance, decryptors. */
'use strict';
/* ---- invention ---- */
let INVROWS = [],
  INVSKIP = [],
  INVCALC = null; // the filter of the last calculation: the list on screen can narrow it, not widen it
const INVOPEN = new Set(); // groups whose variants are open

// Invention candidates: own T1 blueprint × invention product, with the T2 product (for category and name filters)
async function invCandidates() {
  await indexBPProducts();
  const t1s = [...new Set(allBPs().map(b => b.t))];
  await Promise.all(t1s.map(t => refGet('b', t)));
  const out = [];
  for (const t of t1s) {
    const b = REFC.b[t];
    if (!b || !b.i || !b.i.p || !b.i.p.length) continue;
    for (let pi = 0; pi < b.i.p.length; pi++) out.push({ t1: t, pi, t2bp: b.i.p[pi][0] });
  }
  await Promise.all(out.map(c => refGet('b', c.t2bp)));
  for (const c of out) {
    const b2 = REFC.b[c.t2bp];
    c.prod = b2 && b2.m && b2.m.p && b2.m.p[0] ? b2.m.p[0][0] : null;
  }
  const prods = [...new Set(out.map(c => c.prod).filter(Boolean))];
  await Promise.all(prods.map(t => refGet('t', t)));
  await resolveNames([...prods, ...t1s]);
  return out;
}
const invFilter = () => ({
  cat: $('#ivCat').value,
  name: $('#ivName').value.trim().toLowerCase(),
  dec: $('#ivDec').value // '' all, '0' none, else a decryptor type
});
const invCatOk = (f, prod) => !f.cat || (REFC.t[prod] && String(REFC.t[prod].c) === f.cat);
const invNameOk = (f, prod, t1) =>
  !f.name || (NAMES[prod] || '').toLowerCase().includes(f.name) || (NAMES[t1] || '').toLowerCase().includes(f.name);
const invDecOk = (f, dec) => f.dec === '' || (f.dec === '0' ? dec == null : Number(f.dec) === dec);
// the list on screen can only be narrowed from the last calculation
function invNeedsRecalc(f) {
  const c = INVCALC;
  if (!c) return false;
  return (c.cat && f.cat !== c.cat) || (c.name && !f.name.includes(c.name)) || (c.dec !== '' && f.dec !== c.dec);
}
// before calculating: the categories of the T2 products you could invent, and the decryptor list
function fillInvDecs() {
  const ds = $('#ivDec');
  if (ds.options.length > 2) return;
  for (const [t, d] of Object.entries(DECS)) {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = d.n;
    ds.appendChild(o);
  }
}
async function fillInvFilters() {
  fillInvDecs();
  try {
    const c = await invCandidates();
    fillCatSelect($('#ivCat'), [...new Set(c.map(x => x.prod).filter(Boolean))]);
  } catch (e) {
    log('Invention kategóriák: ' + e.message);
  }
}
async function runInvention() {
  const out = $('#ivOut');
  setHtml(out, html`<div class="card muted">Receptek betöltése…</div>`);
  const f = invFilter();
  const all = await invCandidates();
  if (!all.length) {
    setHtml(out, html`<div class="card muted">Egyik saját blueprintedből sem lehet inventálni.</div>`);
    return;
  }
  const cands = all.filter(c => c.prod && invCatOk(f, c.prod) && invNameOk(f, c.prod, c.t1));
  if (!cands.length) {
    INVROWS = [];
    INVCALC = f;
    setHtml(out, html`<div class="card muted">${T('A szűrőnek egyik inventálható BP-d sem felel meg.')}</div>`);
    return;
  }
  const decOpts = f.dec === '' ? [null, ...Object.keys(DECS).map(Number)] : f.dec === '0' ? [null] : [Number(f.dec)];
  const opt = { buildOwn: $('#ivBuildOwn').checked, useStock: false, ore: false, incoming: false };
  const calc = [];
  let i = 0;
  const skipped = [];
  for (const c of cands) {
    i++;
    status('invention: ' + i + '/' + cands.length);
    const t = c.t1;
    const copy = copiesOf(t)[0];
    try {
      for (const dec of decOpts) {
        const it = await virtualItem(copy, dec, null, '', true, c.pi);
        if (!it) {
          skipped.push(T('{0}: a T2 blueprint receptje nem érhető el', NAMES[t] || t));
          break;
        }
        const R = await makeMulti([it], opt);
        calc.push({ t, copy, dec, it, R, pi: c.pi });
      }
    } catch (e) {
      skipped.push((NAMES[t] || t) + ': ' + e.message);
      log('Invention hiba (' + (NAMES[t] || t) + '): ' + (e.stack || e.message));
    }
  }
  INVSKIP = skipped;
  const types = new Set();
  calc.forEach(x => collectTypes(x.R.trees[0].tree, types));
  status('árak: ' + types.size + ' tétel…');
  await resolveNames([...types]);
  await ensurePrices([...types]);
  const prods = [...new Set(calc.map(x => x.R.trees[0].tree.t))];
  await resolveNames(prods);
  status('piaci forgalom…');
  await ensureHistory(prods);
  const fees = sellFees();
  const best = new Map();
  const sysCache = {};
  for (const x of calc) {
    const sys = sysCache[x.copy.l] !== undefined ? sysCache[x.copy.l] : (sysCache[x.copy.l] = await sysFor(x.copy));
    const tr = x.R.trees[0];
    const price = sell(tr.tree.t);
    const mat = [...x.R.buyList].reduce((s, [t, q]) => s + q * buyPrice(t), 0);
    const noPrice = [...x.R.buyList].filter(([t]) => !buyPrice(t)).map(([t]) => t);
    await assignJobSys(x.R.jobs);
    const jc = x.R.jobs.reduce((s, j) => s + jobCost(j, sys), 0);
    const net = price ? netOfFees(tr.made * price, fees) : 0;
    const profit = net - mat - jc;
    const invCost =
      nodeCost(tr.tree.ch.find(n => n.inv) || { t: 0, buy: 0, stock: [], ch: [] }, false) +
      x.R.jobs.filter(j => j.act === 'i' || j.act === 'c').reduce((s, j) => s + jobCost(j, sys), 0);
    const row = {
      t1: x.t,
      copy: x.copy,
      dec: x.dec,
      info: x.it.info,
      prod: tr.tree.t,
      t2: x.it.copies[0].t,
      made: tr.made,
      price,
      profit,
      perRun: profit / x.it.info.runsPer,
      margin: net ? profit / net : null,
      invCost,
      noPrice,
      vol: (HIST[tr.tree.t] || {}).vol || 0
    };
    const k = x.t + '_' + x.pi;
    if (!best.has(k)) best.set(k, { k, all: [] });
    const b = best.get(k);
    b.all.push(row);
  }
  INVROWS = [...best.values()];
  INVCALC = f;
  status('kész');
  renderInvention();
}
// the goal decides which variant stands in an item's row, and the default order
const INV_GOAL = {
  profit: { v: r => r.profit, f: 'profit', d: -1 },
  perRun: { v: r => r.perRun, f: 'perRun', d: -1 },
  runs: { v: r => r.info.runsPer, f: 'runs', d: -1 },
  me: { v: r => r.info.me, f: 'me', d: -1 },
  cost: { v: r => -r.invCost, f: 'cost', d: 1 }
};
const invGoal = () => INV_GOAL[$('#ivGoal').value] || INV_GOAL.profit;
// variants of a group allowed by the decryptor filter, best first for the goal (ties: profit)
function invVariants(g, f, goal) {
  return g.all.filter(r => invDecOk(f, r.dec)).sort((a, b) => goal.v(b) - goal.v(a) || b.profit - a.profit);
}
function renderInvention() {
  const out = $('#ivOut');
  const skipHtml = INVSKIP.length
    ? html`<details style="margin-top:10px"><summary>${INVSKIP.length} tételt kihagytam</summary><ul class="small muted">${INVSKIP.map(x => html`<li>${x}</li>`)}</ul></details>`
    : '';
  if (!INVROWS.length) {
    setHtml(out, html`<div class="card muted">Nincs számolható invention.</div>${skipHtml}`);
    return;
  }
  const f = invFilter(),
    goal = invGoal();
  const groups = INVROWS.map(g => Object.assign(g, { vars: invVariants(g, f, goal) }))
    .filter(g => g.vars.length && invCatOk(f, g.vars[0].prod) && invNameOk(f, g.vars[0].prod, g.vars[0].t1))
    .map(g => Object.assign(g, { best: g.vars[0] }));
  const recalc = invNeedsRecalc(f)
    ? html`<div class="notice"><p class="small">${T('A lista a legutóbbi számolásból szűr. Ehhez a szűrőhöz nyomd meg újra a Számolást.')}</p></div>`
    : '';
  if (!SRT.inv) SRT.inv = { f: goal.f, d: goal.d };
  const ig = (g, fl) => {
    const r = g.best;
    return {
      name: NAMES[r.prod] || '',
      t1: NAMES[r.t1] || '',
      dec: r.dec ? DECS[r.dec].n : '',
      chance: r.info.chance,
      runs: r.info.runsPer,
      me: r.info.me,
      cost: r.invCost,
      profit: r.profit,
      perRun: r.perRun,
      vol: r.vol
    }[fl];
  };
  const pg = pageOf('inv', sortRows('inv', groups, ig), String(groups.length), renderInvention);
  const add = r =>
    html`<button class="btn mini" data-invadd="${r.t1}" data-invdec="${r.dec || ''}" data-invt2="${r.t2}" data-invruns="${r.info.runsPer}" data-invpi="${r.info.pi || 0}">+ projekt</button>`;
  // the numbers of one variant (shared by the item row and its variant rows)
  const cells = r => {
    const unsure = r.noPrice.length > 0;
    return html`<td class="small">${r.dec ? DECS[r.dec].n : T('nincs')}</td><td class="num">${fmt(r.info.chance * 100, 1)}%</td><td class="num">${fmt(r.info.runsPer)}</td><td class="num">${r.info.me} / ${r.info.te}</td><td class="num">${isk(r.invCost)}</td><td class="num ${unsure ? '' : r.profit >= 0 ? 'pos' : 'neg'}">${unsure ? '? ' : ''}${isk(r.profit)}</td><td class="num">${isk(r.perRun)}</td>`;
  };
  const body = pg.rows.map(g => {
    const r = g.best;
    const unsure = r.noPrice.length > 0;
    const open = INVOPEN.has(g.k);
    const head = html`<tr><td>${NAMES[r.prod] || r.prod}${r.price ? html`<div class="src">Jita ${isk(r.price)}${m2On() && sell2(r.prod) ? ' · ' + m2Short() + ' ' + isk(sell2(r.prod)) : ''}</div>` : ''}${r.price ? '' : html` <span class="pill warn">nincs Jita ár</span>`}${unsure ? html`<div class="src">${T('Nincs Jita ára: {0}', r.noPrice.map(t => NAMES[t] || t).join(', '))}</div>` : ''}${g.vars.length > 1 ? html`<div><button class="btn mini" data-invopen="${g.k}">${open ? '▾' : '▸'} ${T('{0} változat', g.vars.length)}</button></div>` : ''}</td><td class="small">${NAMES[r.t1] || r.t1}<br>${r.copy.r === -1 ? 'BPO' : 'BPC ' + r.copy.r + ' run'} · ${charName(r.copy.cid)}</td>${cells(r)}<td class="num">${fmt(r.vol, r.vol < 10 ? 1 : 0)}</td><td>${add(r)}</td></tr>`;
    if (!open) return head;
    const subs = g.vars.map(
      v => html`<tr class="sub"><td class="small muted">↳</td><td></td>${cells(v)}<td></td><td>${add(v)}</td></tr>`
    );
    return html`${head}${hjoin(subs, '')}`;
  });
  setHtml(
    out,
    html`${recalc}${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('inv', 'name', T('T2 termék'))}${sortTh('inv', 't1', T('T1 BP'))}${sortTh('inv', 'dec', T('Decryptor'))}${sortTh('inv', 'chance', T('Esély'), 1)}${sortTh('inv', 'runs', T('Run / BPC'), 1)}${sortTh('inv', 'me', T('ME / TE'), 1)}${sortTh('inv', 'cost', T('Invention költség / BPC'), 1)}${sortTh('inv', 'profit', T('Profit / BPC'), 1)}${sortTh('inv', 'perRun', T('Profit / run'), 1)}${sortTh('inv', 'vol', T('Napi forgalom'), 1)}<th></th></tr></thead><tbody>${hjoin(body, '')}</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">${T('A tétel sorában a Cél szerint legjobb változat áll; a „▸ változat” gombbal látod az összeset, mindegyiket külön projekthez adhatod. Az esélyt a legjobb skillű karaktered skilljeivel számolja (két science skill és az encryption skill). Az invention költsége átlagos értékre van számolva: datacore-ok, decryptor, invention job és T1 copy job, osztva az eséllyel. A T2 gyártás anyagköltsége a teljes anyagfával, piaci áron számít. A „+ projekt” egy BPC-nyi runt ad a projekthez azzal a decryptorral, amelyik sorában megnyomod.')}</p>${m2Hint()}${skipHtml}`
  );
  out.querySelectorAll('[data-invopen]').forEach(b =>
    b.addEventListener('click', () => {
      const k = b.dataset.invopen;
      if (INVOPEN.has(k)) INVOPEN.delete(k);
      else INVOPEN.add(k);
      renderInvention();
    })
  );
  out.querySelectorAll('[data-invadd]').forEach(b =>
    b.addEventListener('click', () => {
      const p = addToProject(
        {
          invT1: Number(b.dataset.invadd),
          dec: b.dataset.invdec ? Number(b.dataset.invdec) : null,
          t2: Number(b.dataset.invt2),
          runs: Number(b.dataset.invruns),
          pi: Number(b.dataset.invpi || 0)
        },
        T('Invention')
      );
      renderProjects();
      b.textContent = '✓ ' + p.name;
    })
  );
}
