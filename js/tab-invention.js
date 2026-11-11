/* IndyOps – Invention tab: T2 invention candidates, chance, decryptors. */
'use strict';
/* ---- invention ---- */
let INVROWS = [],
  INVSKIP = [];
async function runInvention() {
  const out = $('#ivOut');
  setHtml(out, html`<div class="card muted">Receptek betöltése…</div>`);
  await indexBPProducts();
  const t1s = [...new Set(allBPs().map(b => b.t))];
  await Promise.all(t1s.map(t => refGet('b', t)));
  const cands = t1s.filter(t => {
    const b = REFC.b[t];
    return b && b.i && b.i.p && b.i.p.length;
  });
  if (!cands.length) {
    setHtml(out, html`<div class="card muted">Egyik saját blueprintedből sem lehet inventálni.</div>`);
    return;
  }
  const decOpts = [null, ...Object.keys(DECS).map(Number)];
  const opt = { buildOwn: $('#ivBuildOwn').checked, useStock: false, ore: false, incoming: false };
  const calc = [];
  let i = 0;
  const skipped = [];
  for (const t of cands) {
    i++;
    status('invention: ' + i + '/' + cands.length);
    const copy = copiesOf(t)[0];
    const np = REFC.b[t].i.p.length;
    try {
      for (let pi = 0; pi < np; pi++)
        for (const dec of decOpts) {
          const it = await virtualItem(copy, dec, null, '', true, pi);
          if (!it) {
            if (dec == null) skipped.push(T('{0}: a T2 blueprint receptje nem érhető el', NAMES[t] || t));
            break;
          }
          const R = await makeMulti([it], opt);
          calc.push({ t, copy, dec, it, R, pi });
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
    if (!best.has(k)) best.set(k, { none: null, best: null, all: [] });
    const b = best.get(k);
    b.all.push(row);
    if (x.dec == null) b.none = row;
    if (!b.best || row.profit > b.best.profit) b.best = row;
  }
  INVROWS = [...best.values()];
  status('kész');
  renderInvention();
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
  if (!SRT.inv) SRT.inv = { f: 'profit', d: -1 };
  const ig = (g, f) => {
    const r = g.best;
    if (!r) return f === 'name' || f === 't1' || f === 'dec' ? '' : -Infinity;
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
      none: g.none ? g.none.profit : -Infinity,
      vol: r.vol
    }[f];
  };
  const pg = pageOf('inv', sortRows('inv', INVROWS.slice(), ig), String(INVROWS.length), renderInvention);
  const rows = pg.rows;
  setHtml(
    out,
    html`${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('inv', 'name', T('T2 termék'))}${sortTh('inv', 't1', T('T1 BP'))}${sortTh('inv', 'dec', T('Legjobb decryptor'))}${sortTh('inv', 'chance', T('Esély'), 1)}${sortTh('inv', 'runs', T('Run / BPC'), 1)}${sortTh('inv', 'me', T('ME / TE'), 1)}${sortTh('inv', 'cost', T('Invention költség / BPC'), 1)}${sortTh('inv', 'profit', T('Profit / BPC'), 1)}${sortTh('inv', 'perRun', T('Profit / run'), 1)}${sortTh('inv', 'none', T('Decryptor nélkül / BPC'), 1)}${sortTh('inv', 'vol', T('Napi forgalom'), 1)}<th></th></tr></thead><tbody>${rows.map(
      g => {
        const r = g.best;
        if (!r) return '';
        const unsure = r.noPrice.length > 0;
        return html`<tr><td>${NAMES[r.prod] || r.prod}${r.price ? html`<div class="src">Jita ${isk(r.price)}${m2On() && sell2(r.prod) ? ' · ' + m2Short() + ' ' + isk(sell2(r.prod)) : ''}</div>` : ''}${r.price ? '' : html` <span class="pill warn">nincs Jita ár</span>`}${unsure ? html`<div class="src">${T('Nincs Jita ára: {0}', r.noPrice.map(t => NAMES[t] || t).join(', '))}</div>` : ''}</td><td class="small">${NAMES[r.t1] || r.t1}<br>${r.copy.r === -1 ? 'BPO' : 'BPC ' + r.copy.r + ' run'} · ${charName(r.copy.cid)}</td><td class="small">${r.dec ? DECS[r.dec].n : 'nincs'}</td><td class="num">${fmt(r.info.chance * 100, 1)}%</td><td class="num">${fmt(r.info.runsPer)}</td><td class="num">${r.info.me} / ${r.info.te}</td><td class="num">${isk(r.invCost)}</td><td class="num ${unsure ? '' : r.profit >= 0 ? 'pos' : 'neg'}">${unsure ? '? ' : ''}${isk(r.profit)}</td><td class="num">${isk(r.perRun)}</td><td class="num">${g.none ? isk(g.none.profit) : '–'}</td><td class="num">${fmt(r.vol, r.vol < 10 ? 1 : 0)}</td><td><button class="btn mini" data-invadd="${r.t1}" data-invdec="${r.dec || ''}" data-invt2="${r.t2}" data-invruns="${r.info.runsPer}" data-invpi="${r.info.pi || 0}">+ projekt</button></td></tr>`;
      }
    )}</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">Az esélyt a legjobb skillű karaktered skilljeivel számolja (két science skill és az encryption skill). Az invention költsége átlagos értékre van számolva: datacore-ok, decryptor, invention job és T1 copy job, osztva az eséllyel. A T2 gyártás anyagköltsége a teljes anyagfával, piaci áron számít. A „+ projekt” egy BPC-nyi runt ad a kiválasztott projekthez a legjobb decryptorral.</p>${m2Hint()}${skipHtml}`
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
