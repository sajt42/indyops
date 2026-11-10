/* IndyOps – What pays? tab: profit ranking of the blueprints you own. */
'use strict';
/* ---- profit ranking ---- */
let HIST = load('hist', {}); // typeId -> {at, vol, avg}
async function ensureHistory(types) {
  const now = Date.now();
  const need = [...new Set(types)].filter(t => !HIST[t] || now - HIST[t].at > 12 * 3600000);
  await Promise.all(
    need.map(async t => {
      try {
        const h = await esi('/markets/' + JITA_REGION + '/history/?type_id=' + t);
        const last = h.slice(-30);
        const vol = last.length ? last.reduce((s, x) => s + x.volume, 0) / 30 : 0;
        const avg = last.length ? last.reduce((s, x) => s + x.average, 0) / last.length : null;
        HIST[t] = { at: now, vol, avg };
      } catch (e) {
        HIST[t] = { at: now, vol: 0, avg: null };
      }
    })
  );
  store('hist', HIST);
}
let PROFROWS = [],
  PROFM2 = null, // second market the profit rows were calculated with
  profSort = { k: 'pph', d: -1 };
async function runProfit() {
  const out = $('#prOut');
  setHtml(out, html`<div class="card muted">Receptek betöltése…</div>`);
  await indexBPProducts();
  const cat = $('#prCat').value;
  const byProd = new Map();
  for (const b of allBPs()) {
    const m = BPPROD[b.t];
    if (!m) continue;
    if (!byProd.has(m.prod)) byProd.set(m.prod, true);
  }
  const prods = [...byProd.keys()];
  await Promise.all(prods.map(t => refGet('t', t)));
  fillCatSelect($('#prCat'), prods);
  const sel = prods.filter(t => !cat || String(REFC.t[t] && REFC.t[t].c) === cat);
  const opt = { buildOwn: $('#prBuildOwn').checked, useStock: false, ore: false, incoming: false };
  const plans = [];
  let i = 0;
  for (const p of sel) {
    i++;
    status('anyagfák: ' + i + '/' + sel.length);
    const copies = ownedFor(p);
    if (!copies.length) continue;
    const best = copies[0];
    try {
      await prefetchTree(p);
      const runs = best.r === -1 ? 10 : Math.max(1, Math.min(best.r, 10));
      const R = await makeMulti(
        [{ copies: [best].concat(copies.filter(c => c.i !== best.i && c.t === best.t)), runs, label: '' }],
        opt
      );
      plans.push({ p, best, copies, runs, R });
    } catch (e) {
      log('Profit hiba (' + (NAMES[p] || p) + '): ' + (e.stack || e.message));
    }
  }
  const types = new Set();
  plans.forEach(x => {
    collectTypes(x.R.trees[0].tree, types);
  });
  status('árak: ' + types.size + ' tétel (első alkalommal eltarthat egy percig)…');
  await resolveNames([...types]);
  await ensurePrices([...types]);
  status('piaci forgalom…');
  await ensureHistory(plans.map(x => x.p));
  const fee = salesTax() + brokerFee();
  const fee2 = m2Fee();
  const sysCache = {};
  PROFROWS = [];
  PROFM2 = S.market2 || null;
  for (const x of plans) {
    const sysId = sysCache[x.best.l] !== undefined ? sysCache[x.best.l] : (sysCache[x.best.l] = await sysFor(x.best));
    const made = x.R.trees[0].made;
    const price = sell(x.p);
    const mat = [...x.R.buyList].reduce((s, [t, q]) => s + q * buyPrice(t), 0);
    const noPrice = [...x.R.buyList].filter(([t]) => !buyPrice(t)).map(([t]) => t);
    await assignJobSys(x.R.jobs);
    const jc = x.R.jobs.reduce((s, j) => s + jobCost(j, sysId), 0);
    const hours = x.R.jobs.reduce((s, j) => s + jobTime(j), 0) / 3600;
    const net = price ? made * price * (1 - fee) : 0;
    const profit = net - mat - jc;
    const perUnit = made ? profit / made : 0;
    const perRun = profit / x.runs;
    const runsLeft = x.copies.filter(c => c.t === x.best.t).reduce((s, c) => (c.r === -1 ? Infinity : s + c.r), 0);
    const h = HIST[x.p] || { vol: 0 };
    const perRunUnits = made / x.runs;
    const p2 = sell2(x.p);
    const perRun2 = m2On() && p2 && fee2 != null ? (made * p2 * (1 - fee2) - mat - jc) / x.runs : null;
    PROFROWS.push({
      p: x.p,
      best: x.best,
      name: NAMES[x.p] || '#' + x.p,
      price,
      price2: p2,
      perRun,
      perRun2,
      perUnit,
      margin: net ? profit / net : null,
      pph: hours ? profit / hours : 0,
      vol: h.vol,
      daysToSell: h.vol ? perRunUnits / h.vol : Infinity,
      pot: runsLeft === Infinity ? null : runsLeft * perRun,
      runsLeft,
      noMarket: !price,
      warn: x.R.warn.length > 0,
      noPrice
    });
    if (noPrice.length) {
      const r = PROFROWS[PROFROWS.length - 1];
      r.margin = null;
      r.unsure = true;
    }
  }
  status('kész');
  renderProfit();
}
function renderProfit() {
  const out = $('#prOut');
  if (!PROFROWS.length) {
    setHtml(out, html`<div class="card muted">Nincs eredmény. Előbb frissítsd a karakterek adatait.</div>`);
    return;
  }
  const onlyPos = $('#prOnlyPos').checked,
    minVol = Number($('#prMinVol').value || 0);
  let rows = PROFROWS.filter(r => (!onlyPos || r.perRun > 0) && r.vol >= minVol);
  // second-market values belong to the market they were calculated with
  const m2stale = m2On() && PROFM2 !== (S.market2 || null);
  if (m2stale) rows = rows.map(r => Object.assign({}, r, { price2: null, perRun2: null }));
  const k = profSort.k;
  rows.sort((a, b) => {
    const va = a[k],
      vb = b[k];
    if (typeof va === 'string') return va.localeCompare(vb, 'hu') * profSort.d;
    return ((va ?? -Infinity) - (vb ?? -Infinity)) * profSort.d;
  });
  const pg = pageOf('prof', rows, [onlyPos, minVol, profSort.k, profSort.d].join('|'), renderProfit);
  rows = pg.rows;
  const th = (key, label, num) =>
    html`<th class="sortable${num ? ' num' : ''}" data-psort="${key}">${label}${profSort.k === key ? html`<span> ${profSort.d > 0 ? '▲' : '▼'}</span>` : ''}</th>`;
  setHtml(
    out,
    html`${
      (m2stale
        ? html`<div class="notice"><p class="small">${T('A második piac megváltozott az utolsó számolás óta: a {0} oszlopok a következő számolásnál töltődnek ki.', m2Short())}</p></div>`
        : '') + pg.html
    }<div class="tablewrap"><table><thead><tr>${th('name', 'Termék')}<th>Legjobb saját BP</th>${th('price', 'Jita sell', 1)}${m2On() ? th('price2', m2Short() + ' sell', 1) : ''}${th('perRun', 'Profit / run', 1)}${m2On() ? th('perRun2', T('Profit / run') + ' · ' + m2Short(), 1) : ''}${th('margin', 'Margó', 1)}${th('pph', 'Profit / gyártási óra', 1)}${th('vol', 'Napi forgalom', 1)}${th('pot', 'Maradék runok értéke', 1)}<th></th></tr></thead><tbody>${
      hjoin(
        rows.map(
          r =>
            html`<tr><td>${r.name}${r.noMarket ? html` <span class="pill warn">nincs Jita ár</span>` : ''}${r.warn ? html` <span class="pill bad">kevés run</span>` : ''}${r.unsure ? html`<div class="src">${T('Nincs Jita ára: {0}. A profit emiatt túl magas lehet.', r.noPrice.map(t => NAMES[t] || t).join(', '))}</div>` : ''}</td><td class="small">${r.best.r === -1 ? 'BPO' : 'BPC ' + r.runsLeft + ' run'} · ME${r.best.me} · ${charName(r.best.cid)}</td><td class="num">${isk(r.price)}</td>${m2On() ? html`<td class="num">${m2Cell(r.price, r.price2)}</td>` : ''}<td class="num ${r.unsure ? '' : r.perRun >= 0 ? 'pos' : 'neg'}">${r.unsure ? '? ' : ''}${isk(r.perRun)}</td>${m2On() ? html`<td class="num ${r.perRun2 == null || r.unsure ? '' : r.perRun2 >= 0 ? 'pos' : 'neg'}">${r.perRun2 == null ? '?' : (r.unsure ? '? ' : '') + isk(r.perRun2)}</td>` : ''}<td class="num">${r.margin == null ? '–' : fmt(r.margin * 100, 1) + '%'}</td><td class="num ${r.pph >= 0 ? 'pos' : 'neg'}">${isk(r.pph)}</td><td class="num">${fmt(r.vol, r.vol < 10 ? 1 : 0)}${r.vol && r.daysToSell > 1 ? html` <span class="pill warn" title="Egy run termékének eladása több napi forgalom">lassú</span>` : ''}</td><td class="num">${r.pot == null ? '∞ (BPO)' : isk(r.pot)}</td><td><button class="btn mini" data-addproj="${r.best.t}">+ projekt</button></td></tr>`
        ),
        ''
      ) || html`<tr><td colspan="9" class="muted">A szűrőknek egy tétel sem felel meg.</td></tr>`
    }</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">Minden anyag piaci áron számít, a saját készlet is, mert azt el is adhatnád. Profit / gyártási óra: a run összes jobjának idejére vetítve (komponensekkel együtt), a BP-t tartó karakter skilljeivel. Napi forgalom: The Forge régió, az utolsó 30 nap átlaga. A „+ projekt” gomb a kiválasztott projekthez ad 1 runt (ha nincs kiválasztott, újat hoz létre).</p>${m2Hint()}`
  );
  out.querySelectorAll('[data-psort]').forEach(th =>
    th.addEventListener('click', () => {
      const k = th.dataset.psort;
      profSort = profSort.k === k ? { k, d: -profSort.d } : { k, d: k === 'name' ? 1 : -1 };
      renderProfit();
    })
  );
  out.querySelectorAll('[data-addproj]').forEach(b =>
    b.addEventListener('click', () => {
      const t = Number(b.dataset.addproj);
      let p = PROJ.find(x => x.id === SELP);
      if (!p) {
        p = { id: Date.now(), name: T('Profit-válogatás'), active: true, items: [] };
        PROJ.push(p);
        SELP = p.id;
      }
      const ex = p.items.find(x => x.bpType === t);
      if (ex) ex.runs++;
      else p.items.push({ bpType: t, runs: 1 });
      saveP();
      renderProjects();
      status(T('hozzáadva: {0}', p.name));
      b.textContent = '✓ ' + p.name;
    })
  );
}
function fillCatSelect(sel, prodTypes) {
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
  const cur = sel.value;
  setHtml(
    sel,
    html`<option value="">mind</option>${[...cats].map(c => html`<option value="${c}">${names[c] || 'Kategória ' + c}</option>`)}`
  );
  sel.value = cur;
}
