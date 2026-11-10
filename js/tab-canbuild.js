/* IndyOps – Builds without buying tab: what the stock can build. */
'use strict';
/* ---- builds without buying ---- */
async function runCanBuild() {
  const out = $('#cbOut');
  setHtml(out, html`<div class="card muted">Receptek betöltése…</div>`);
  await indexBPProducts();
  const cat = $('#cbCat').value;
  const byProd = new Map();
  for (const b of allBPs()) {
    const m = BPPROD[b.t];
    if (!m) continue;
    if (!byProd.has(m.prod)) byProd.set(m.prod, b);
  }
  const prodTypes = [...byProd.keys()];
  await Promise.all(prodTypes.map(t => refGet('t', t)));
  fillCats(prodTypes);
  const sel = prodTypes.filter(t => !cat || String(REFC.t[t] && REFC.t[t].c) === cat);
  const opt = { buildOwn: true, useStock: true, ore: $('#cbOre').checked };
  const res = [];
  let i = 0;
  for (const p of sel) {
    i++;
    status('számolás ' + i + '/' + sel.length);
    const bp = ownedFor(p)[0];
    try {
      await prefetchTree(p);
      await makePlan(bp, 1, opt);
    } catch (e) {
      log('Kihagyva (' + (NAMES[p] || p) + '): ' + e.message);
      continue;
    }
    const ok = async r => {
      const pl = await makePlan(bp, r, opt);
      return pl.buyList.size === 0 && !pl.warn.length;
    };
    let lo = 0,
      hi = 1;
    const cap = bp.r === -1 ? 100000 : bp.r;
    while (hi <= cap && (await ok(hi))) {
      lo = hi;
      hi *= 2;
    }
    hi = Math.min(hi, cap + 1);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (await ok(mid)) lo = mid;
      else hi = mid;
    }
    let limiter = '';
    if (lo < cap) {
      const pl = await makePlan(bp, lo + 1, opt);
      const top = [...pl.buyList].sort((a, b) => b[1] * unitPrice(b[0]) - a[1] * unitPrice(a[0]))[0];
      if (top) await resolveNames([top[0]]);
      limiter = top
        ? T('{0} ({1} hiányzik)', NAMES[top[0]] || top[0], fmt(top[1]))
        : pl.warn[0]
          ? warnText(pl.warn[0])
          : '';
    }
    res.push({ p, bp, lo, limiter });
  }
  await resolveNames(res.flatMap(r => [r.p]));
  res.sort((a, b) => b.lo - a.lo || (NAMES[a.p] || '').localeCompare(NAMES[b.p] || ''));
  CBROWS = res;
  renderCanBuild();
  status('kész');
}
let CBROWS = [];
function renderCanBuild() {
  const out = $('#cbOut');
  if (!SRT.cb) SRT.cb = { f: 'lo', d: -1 };
  const cg = (r, f) =>
    ({ name: NAMES[r.p] || '', bp: r.bp.me * 1000 + (r.bp.r === -1 ? 999 : r.bp.r), lo: r.lo, lim: r.limiter || '' })[
      f
    ];
  const pg = pageOf('cb', sortRows('cb', CBROWS.slice(), cg), String(CBROWS.length), renderCanBuild);
  const res = pg.rows;
  setHtml(
    out,
    html`${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('cb', 'name', T('Termék'))}${sortTh('cb', 'bp', T('Legjobb saját BP'), 1)}${sortTh('cb', 'lo', T('Legyártható run'), 1)}${sortTh('cb', 'lim', T('Szűk keresztmetszet a következő runhoz'))}</tr></thead><tbody>${res.map(r => html`<tr><td>${NAMES[r.p] || r.p}</td><td class="small">${r.bp.r === -1 ? 'BPO' : 'BPC ' + r.bp.r + ' run'} · ME${r.bp.me} · ${charName(r.bp.cid)}</td><td class="num ${r.lo ? 'pos' : ''}">${fmt(r.lo)}</td><td class="small muted">${r.limiter}</td></tr>`)}</tbody></table></div>${pg.html}`
  );
  status('kész');
}
function fillCats(prodTypes) {
  const cats = new Set(prodTypes.map(t => REFC.t[t] && REFC.t[t].c).filter(Boolean));
  const names = {
    6: 'Hajók',
    7: 'Modulok',
    8: 'Töltetek',
    18: 'Drónok',
    4: 'Anyagok',
    17: 'Commodity',
    22: 'Deployable',
    23: 'Starbase',
    32: 'Subsystem',
    65: 'Struktúrák',
    66: 'Struktúra modulok',
    87: 'Fighterek',
    43: 'PI',
    20: 'Implantok',
    39: 'Infrastruktúra'
  };
  const sel = $('#cbCat'),
    cur = sel.value;
  setHtml(
    sel,
    html`<option value="">mind</option>${[...cats].map(c => html`<option value="${c}">${names[c] || 'Kategória ' + c}</option>`)}`
  );
  sel.value = cur;
}
