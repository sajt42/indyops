/* IndyOps – Tabs: projects, profit ranking, invention, research, selling, no-buy builds, mining. */
'use strict';
/* ---- projects ---- */
let PROJ = load('projects', []);
let SELP = load('selp', null);
const saveP = () => {
  store('projects', PROJ);
  store('selp', SELP);
};
function bpTypeByName(n) {
  const b = allBPs().find(x => NAMES[x.t] === n);
  return b ? b.t : null;
}
function renderProjects() {
  $('#pList').innerHTML = PROJ.length
    ? PROJ.map(
        (p, i) =>
          `<div class="prow ${p.id === SELP ? 'sel' : ''}" data-pid="${p.id}"><label class="inline" title="Aktív: beleszámít az összesített tervbe"><input type="checkbox" data-pact="${p.id}" ${p.active ? 'checked' : ''}></label><button class="plink" data-psel="${p.id}">${esc(p.name)}<span class="small muted"> · ${p.items.length} tétel${p.src && p.src.mode === 'sel' ? ' · 📦' : ''}</span></button><span class="pord"><button class="btn mini" data-pup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Feljebb">▲</button><button class="btn mini" data-pdown="${i}" ${i === PROJ.length - 1 ? 'disabled' : ''} aria-label="Lejjebb">▼</button></span></div>`
      ).join('')
    : '<p class="small muted">Még nincs projekt. Adj egy nevet, pl. „Orca rendelés”, és hozd létre.</p>';
  const p = PROJ.find(x => x.id === SELP);
  const ed = $('#pEdit');
  if (!p) {
    ed.innerHTML = '<h2>Projekt</h2><p class="muted">Válassz vagy hozz létre egy projektet a bal oldalon.</p>';
    return;
  }
  ed.innerHTML = `<div class="row" style="justify-content:space-between"><label style="flex:1;min-width:200px">Projekt neve<input id="pName" value="${esc(p.name)}"></label><button class="btn" id="pDel">Projekt törlése</button></div>
  <div id="pDelConfirm" class="notice err" hidden><p>${T('Biztosan törlöd a(z) „{0}” projektet?', esc(p.name))}</p><div class="row"><button class="btn primary" id="pDelYes">Igen, törlöm</button><button class="btn" id="pDelNo">Mégse</button></div></div>
  <h3>Tételek</h3><div class="tablewrap"><table><thead><tr><th>Blueprint</th><th class="num">Run</th><th>Saját példányok</th><th>Nyersanyag</th><th></th></tr></thead><tbody>${
    p.items
      .map((it, i) => {
        if (it.invT1) {
          const c1 = copiesOf(it.invT1);
          return `<tr><td>${esc(NAMES[it.t2] || 'T2 BPC')} <span class="pill">invention</span><div class="src">${esc(it.dec ? DECS[it.dec].n : 'decryptor nélkül')}</div></td><td class="num"><input type="number" min="1" value="${it.runs}" data-iruns="${i}" style="width:80px"></td><td class="small">${c1.length ? 'T1: ' + esc(NAMES[it.invT1] || it.invT1) + ' · ' + (c1[0].r === -1 ? 'BPO' : 'BPC ' + c1[0].r + ' run') : '<span class="pill bad">nincs T1 BP</span>'}</td><td>${itemSrcSel(it, i)}</td><td><button class="btn mini" data-idel="${i}" aria-label="Tétel törlése">✕</button></td></tr>${itemSrcRow(it, i, p)}`;
        }
        const cp = copiesOf(it.bpType);
        const runs = cp.reduce((s, c) => (c.r === -1 ? Infinity : s + c.r), 0);
        return `<tr><td>${esc(NAMES[it.bpType] || it.bpType)}</td><td class="num"><input type="number" min="1" value="${it.runs}" data-iruns="${i}" style="width:80px"></td><td class="small">${cp.length ? cp.length + ' db · legjobb: ' + (cp[0].r === -1 ? 'BPO' : 'BPC') + ' ME' + cp[0].me + (runs !== Infinity ? ' · összesen ' + runs + ' run' + (runs < it.runs ? ' <span class="pill bad">kevés</span>' : '') : '') : '<span class="pill bad">nincs saját példány</span>'}</td><td>${itemSrcSel(it, i)}</td><td><button class="btn mini" data-idel="${i}" aria-label="Tétel törlése">✕</button></td></tr>${itemSrcRow(it, i, p)}`;
      })
      .join('') || '<tr><td colspan="5" class="muted">Még nincs tétel.</td></tr>'
  }</tbody></table></div>
  ${projSrcHtml(p)}
  <div class="row" style="margin-top:10px"><label style="flex:1;min-width:220px">Új tétel (saját BP)<input id="pItemName" list="bpOptions" placeholder="pl. Hurricane Blueprint"></label><label>Run<input type="number" id="pItemRuns" min="1" value="1"></label><button class="btn" id="pItemAdd">Hozzáadás</button></div>
  <div class="row" style="margin-top:14px"><button class="btn primary" id="pCalc">Ennek a projektnek a számolása</button></div>`;
  $('#pName').addEventListener('change', e => {
    p.name = e.target.value.trim() || p.name;
    saveP();
    renderProjects();
  });
  $('#pDel').onclick = () => ($('#pDelConfirm').hidden = false);
  $('#pDelNo').onclick = () => ($('#pDelConfirm').hidden = true);
  $('#pDelYes').onclick = () => {
    PROJ = PROJ.filter(x => x.id !== p.id);
    SELP = PROJ[0] ? PROJ[0].id : null;
    saveP();
    renderProjects();
  };
  ed.querySelectorAll('[data-iruns]').forEach(inp =>
    inp.addEventListener('change', e => {
      p.items[Number(e.target.dataset.iruns)].runs = Math.max(1, Number(e.target.value) || 1);
      saveP();
      renderProjects();
    })
  );
  ed.querySelectorAll('[data-idel]').forEach(b =>
    b.addEventListener('click', () => {
      p.items.splice(Number(b.dataset.idel), 1);
      saveP();
      renderProjects();
    })
  );
  $('#pItemAdd').onclick = () => {
    const t = bpTypeByName($('#pItemName').value.trim());
    if (!t) {
      alertBox('Ilyen saját blueprintet nem találok. Válassz a listából.');
      return;
    }
    p.items.push({ bpType: t, runs: Math.max(1, Number($('#pItemRuns').value) || 1) });
    saveP();
    renderProjects();
  };
  $('#pCalc').onclick = () => calcProjects([p]);
}
/* ---- project material sources ---- */
function itemSrcSel(it, i) {
  const sel = it.src && it.src.mode === 'sel';
  return `<select data-isrc="${i}"><option value="">${T('projekt szerint')}</option><option value="sel" ${sel ? 'selected' : ''}>${T('saját források')}</option></select>`;
}
function itemSrcRow(it, i, p) {
  if (!(it.src && it.src.mode === 'sel')) return '';
  return `<tr class="srcrow"><td colspan="5">${srcEditor(it.src, 'i' + i, false, p.id)}</td></tr>`;
}
function projSrcHtml(p) {
  const s = p.src || { mode: 'all' };
  const sel = s.mode === 'sel';
  return `<h3>Nyersanyag-források</h3><div class="row"><label class="inline"><input type="radio" name="psrcm" value="all" ${sel ? '' : 'checked'}> Mindenhonnan (a Beállításokban kijelölt helyekről)</label><label class="inline"><input type="radio" name="psrcm" value="sel" ${sel ? 'checked' : ''}> Kiválasztott forrásokból</label></div>
  ${sel ? srcEditor(s, 'p', true, p.id) : '<p class="small muted">A projekt a közös készletből dolgozik, prioritás szerint a többi aktív projekttel együtt. Válts a „Kiválasztott forrásokból” módra, ha a projektnek saját állomása, konténere vagy foglalt doboza van.</p>'}`;
}
function srcEditor(spec, key, withExcl, pid) {
  const all = allConts();
  const resv = reservedMap();
  const hasCont = Object.values(DATA).some(d => d.cont);
  const selL = new Set((spec.locs || []).map(Number)),
    selC = new Set((spec.conts || []).map(Number)),
    ex = new Set((spec.excl || []).map(Number));
  const kinds = new Map(),
    ckinds = new Map();
  for (const [cid, d] of Object.entries(DATA)) {
    if (!CHARS.find(c => c.id == cid)) continue;
    for (const a of d.assets) {
      if (a.f && /Slot\d|SubSystemSlot|FighterTube/.test(a.f)) continue;
      (kinds.get(a.l) || kinds.set(a.l, new Set()).get(a.l)).add(a.t);
      if (a.c != null) (ckinds.get(a.c) || ckinds.set(a.c, new Set()).get(a.c)).add(a.t);
    }
  }
  const showShips = S.srcShips !== false;
  const byLoc = new Map();
  for (const c of [...all.values()].sort(
    (a, b) =>
      contIsShip(a) - contIsShip(b) || String(a.n || NAMES[a.t] || '').localeCompare(String(b.n || NAMES[b.t] || ''))
  )) {
    if (!showShips && contIsShip(c)) continue;
    if (!ckinds.has(c.id) && ![...all.values()].some(x => x.pc === c.id)) continue;
    if (!byLoc.has(c.l)) byLoc.set(c.l, []);
    byLoc.get(c.l).push(c);
  }
  const pname = id => {
    const q = PROJ.find(x => x.id === id);
    return q ? q.name : '?';
  };
  const contRow = (c, d) => {
    const other = resv.has(c.id) && resv.get(c.id) !== pid;
    return (
      `<div class="srcc" style="padding-left:${22 + d * 18}px"><label class="inline"><input type="checkbox" data-scont="${key}|${c.id}" ${selC.has(c.id) ? 'checked' : ''}> ${esc(contLabel(c.id, all))}</label> <span class="small muted">${esc(charName(c.cid))} · ${T('{0} féle tárgy', fmt((ckinds.get(c.id) || new Set()).size))}</span>${withExcl ? ` <label class="inline small"><input type="checkbox" data-sexcl="${key}|${c.id}" ${ex.has(c.id) ? 'checked' : ''}> ${T('csak ez a projekt')}</label>` : ''}${other ? ` <span class="pill warn">${T('foglalja: {0}', esc(pname(resv.get(c.id))))}</span>` : ''}</div>` +
      [...all.values()]
        .filter(x => x.pc === c.id && byLoc.get(c.l) && byLoc.get(c.l).includes(x))
        .map(x => contRow(x, d + 1))
        .join('')
    );
  };
  const locs = [...kinds.keys()].sort((a, b) => locName(a).localeCompare(locName(b)));
  const nL = selL.size,
    nC = selC.size;
  return `<div class="srcbox"><p class="small"><label class="inline" style="float:right"><input type="checkbox" data-srcships ${showShips ? 'checked' : ''}> ${T('hajók is')}</label>${T('Kiválasztva: {0} helyszín, {1} konténer.', nL, nC)} ${withExcl && ex.size ? T('Foglalt doboz: {0}.', ex.size) : ''}${nL + nC ? '' : ` <span class="pill warn">${T('Még nincs kiválasztva forrás: így minden anyagot venni kell.')}</span>`}</p>
  ${hasCont ? '' : `<p class="small muted">${T('A konténerek listájához frissítsd egyszer a karaktereket.')}</p>`}
  ${locs
    .map(l => {
      const cs = (byLoc.get(l) || []).filter(c => c.pc == null || !all.has(c.pc) || all.get(c.pc).l !== l);
      const open = [...(byLoc.get(l) || [])].some(c => selC.has(c.id) || ex.has(c.id));
      return `<details data-dl="${key}|${l}" ${open || SRCOPEN.has(key + '|' + l) ? 'open' : ''}><summary><input type="checkbox" data-sloc="${key}|${l}" ${selL.has(l) ? 'checked' : ''} aria-label="${esc(locName(l))}"> ${esc(locName(l))} <span class="small muted">${T('{0} féle tárgy', fmt(kinds.get(l).size))}${byLoc.get(l) ? ' · ' + T('{0} konténer', byLoc.get(l).length) : ''}</span></summary>${cs.map(c => contRow(c, 0)).join('') || `<div class="srcc small muted" style="padding-left:22px">${T('nincs konténer')}</div>`}</details>`;
    })
    .join('')}
  <p class="small muted" style="margin-top:6px">${T('A helyszín pipája a hangárt és az összes ottani konténert jelenti (a más projekt által foglaltak kivételével). Konténert külön is pipálhatsz, a helyszín nélkül.')}${withExcl ? ' ' + T('„Csak ez a projekt”: a dobozhoz más projekt nem nyúl, akkor sem, ha mindenhonnan dolgozik; két foglalásnál a prioritásban előbb álló projekt nyer.') : ''}</p></div>`;
}
let SRCOPEN = new Set();
function srcRerender() {
  const ed = $('#pEdit');
  SRCOPEN = new Set([...ed.querySelectorAll('details[data-dl][open]')].map(d => d.dataset.dl));
  const sc = [...ed.querySelectorAll('.srcbox')].map(x => x.scrollTop);
  renderProjects();
  [...ed.querySelectorAll('.srcbox')].forEach((x, i) => {
    if (sc[i]) x.scrollTop = sc[i];
  });
}
function srcChange(e) {
  const t = e.target;
  const p = PROJ.find(x => x.id === SELP);
  if (!p) return;
  const specOf = k =>
    k === 'p'
      ? (p.src = p.src || { mode: 'sel' })
      : (p.items[Number(k.slice(1))].src = p.items[Number(k.slice(1))].src || { mode: 'sel' });
  const tog = (arr, id, on) => {
    arr = (arr || []).map(Number).filter(x => x !== id);
    if (on) arr.push(id);
    return arr;
  };
  if (t.dataset.srcships != null) {
    S.srcShips = t.checked;
    saveS();
    srcRerender();
    return;
  }
  if (t.name === 'psrcm') {
    p.src = p.src || {};
    p.src.mode = t.value;
    saveP();
    renderProjects();
    return;
  }
  if (t.dataset.isrc != null) {
    const it = p.items[Number(t.dataset.isrc)];
    if (t.value === 'sel') it.src = Object.assign(it.src || {}, { mode: 'sel' });
    else delete it.src;
    saveP();
    renderProjects();
    return;
  }
  for (const [k, arr] of [
    ['sloc', 'locs'],
    ['scont', 'conts'],
    ['sexcl', 'excl']
  ]) {
    const v = t.dataset[k];
    if (v == null) continue;
    const [key, id] = v.split('|');
    const sp = specOf(key);
    sp[arr] = tog(sp[arr], Number(id), t.checked);
    if (arr === 'excl' && t.checked) sp.conts = tog(sp.conts, Number(id), true);
    saveP();
    srcRerender();
    return;
  }
}
document.getElementById('pEdit').addEventListener('change', srcChange);

async function calcProjects(list) {
  const out = $('#pOut');
  out.innerHTML = '<div class="card muted">Számolás…</div>';
  try {
    await indexBPProducts();
    const opt = Object.assign(getOpt(), { incoming: $('#pIncoming').checked });
    const shared = { pool: await buildPool(opt), runsLeft: new Map() };
    const R = { trees: [], buyList: new Map(), usedList: new Map(), jobs: [], warn: [] };
    let firstBP = null;
    for (const p of list) {
      const items = [];
      for (const it of p.items) {
        const src = it.src && it.src.mode === 'sel' ? it.src : p.src || null;
        if (it.invT1) {
          const c1 = copiesOf(it.invT1)[0];
          const vi = c1 && (await virtualItem(c1, it.dec, it.runs, p.name, false, it.pi || 0));
          if (!vi) {
            R.warn.push({
              txt: T('{0}: {1} – nincs meg a T1 BP, kihagytam.', p.name, NAMES[it.t2] || T('invention tétel'))
            });
            continue;
          }
          vi.src = src;
          vi.pid = p.id;
          items.push(vi);
          if (!firstBP) firstBP = c1;
          continue;
        }
        const copies = copiesOf(it.bpType);
        if (!copies.length || !BPPROD[it.bpType]) {
          R.warn.push({
            txt: T('{0}: {1} – nincs saját példány vagy recept, kihagytam.', p.name, NAMES[it.bpType] || it.bpType)
          });
          continue;
        }
        await prefetchTree(BPPROD[it.bpType].prod);
        items.push({ copies, runs: it.runs, label: p.name, src, pid: p.id });
        if (!firstBP) firstBP = copies[0];
      }
      if (!items.length) continue;
      const r = await makeMulti(items, opt, shared);
      R.trees.push(...r.trees);
      R.jobs.push(...r.jobs);
      R.warn.push(...r.warn);
      for (const [t, q] of r.buyList) R.buyList.set(t, (R.buyList.get(t) || 0) + q);
      for (const [t, q] of r.usedList) R.usedList.set(t, (R.usedList.get(t) || 0) + q);
    }
    if (!R.trees.length) {
      out.innerHTML = '<div class="card muted">Nincs számolható tétel. Adj hozzá tételeket a projekthez.</div>';
      return;
    }
    await finishResult(R, firstBP);
    R.title = list.map(p => p.name).join(' + ');
    LASTPLAN = R;
    out.innerHTML = '';
    const head = document.createElement('h2');
    head.textContent = R.title;
    head.style.marginTop = '8px';
    const body = document.createElement('div');
    out.append(head, body);
    LASTRENDER = () => showResult(body, R, () => calcProjects(list));
    LASTRENDER();
    renderMineNeed();
  } catch (e) {
    out.innerHTML = '<div class="notice err"><p>' + esc(e.message) + '</p></div>';
    log(e.stack || e.message);
  }
}

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
  out.innerHTML = '<div class="card muted">Receptek betöltése…</div>';
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
    out.innerHTML = '<div class="card muted">Nincs eredmény. Előbb frissítsd a karakterek adatait.</div>';
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
    `<th class="sortable${num ? ' num' : ''}" data-psort="${key}">${label}${profSort.k === key ? '<span> ' + (profSort.d > 0 ? '▲' : '▼') + '</span>' : ''}</th>`;
  out.innerHTML =
    (m2stale
      ? `<div class="notice"><p class="small">${T('A második piac megváltozott az utolsó számolás óta: a {0} oszlopok a következő számolásnál töltődnek ki.', esc(m2Short()))}</p></div>`
      : '') +
    pg.html +
    `<div class="tablewrap"><table><thead><tr>${th('name', 'Termék')}<th>Legjobb saját BP</th>${th('price', 'Jita sell', 1)}${m2On() ? th('price2', esc(m2Short()) + ' sell', 1) : ''}${th('perRun', 'Profit / run', 1)}${m2On() ? th('perRun2', T('Profit / run') + ' · ' + esc(m2Short()), 1) : ''}${th('margin', 'Margó', 1)}${th('pph', 'Profit / gyártási óra', 1)}${th('vol', 'Napi forgalom', 1)}${th('pot', 'Maradék runok értéke', 1)}<th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name)}${r.noMarket ? ' <span class="pill warn">nincs Jita ár</span>' : ''}${r.warn ? ' <span class="pill bad">kevés run</span>' : ''}${r.unsure ? `<div class="src">${T('Nincs Jita ára: {0}. A profit emiatt túl magas lehet.', esc(r.noPrice.map(t => NAMES[t] || t).join(', ')))}</div>` : ''}</td><td class="small">${r.best.r === -1 ? 'BPO' : 'BPC ' + r.runsLeft + ' run'} · ME${r.best.me} · ${esc(charName(r.best.cid))}</td><td class="num">${isk(r.price)}</td>${m2On() ? `<td class="num">${m2Cell(r.price, r.price2)}</td>` : ''}<td class="num ${r.unsure ? '' : r.perRun >= 0 ? 'pos' : 'neg'}">${r.unsure ? '? ' : ''}${isk(r.perRun)}</td>${m2On() ? `<td class="num ${r.perRun2 == null || r.unsure ? '' : r.perRun2 >= 0 ? 'pos' : 'neg'}">${r.perRun2 == null ? '?' : (r.unsure ? '? ' : '') + isk(r.perRun2)}</td>` : ''}<td class="num">${r.margin == null ? '–' : fmt(r.margin * 100, 1) + '%'}</td><td class="num ${r.pph >= 0 ? 'pos' : 'neg'}">${isk(r.pph)}</td><td class="num">${fmt(r.vol, r.vol < 10 ? 1 : 0)}${r.vol && r.daysToSell > 1 ? ' <span class="pill warn" title="Egy run termékének eladása több napi forgalom">lassú</span>' : ''}</td><td class="num">${r.pot == null ? '∞ (BPO)' : isk(r.pot)}</td><td><button class="btn mini" data-addproj="${r.best.t}">+ projekt</button></td></tr>`).join('') || '<tr><td colspan="9" class="muted">A szűrőknek egy tétel sem felel meg.</td></tr>'}</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">Minden anyag piaci áron számít, a saját készlet is, mert azt el is adhatnád. Profit / gyártási óra: a run összes jobjának idejére vetítve (komponensekkel együtt), a BP-t tartó karakter skilljeivel. Napi forgalom: The Forge régió, az utolsó 30 nap átlaga. A „+ projekt” gomb a kiválasztott projekthez ad 1 runt (ha nincs kiválasztott, újat hoz létre).</p>` +
    m2Hint();
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
  sel.innerHTML =
    '<option value="">mind</option>' +
    [...cats].map(c => `<option value="${c}">${names[c] || 'Kategória ' + c}</option>`).join('');
  sel.value = cur;
}

/* ---- invention ---- */
let INVROWS = [],
  INVSKIP = [];
async function runInvention() {
  const out = $('#ivOut');
  out.innerHTML = '<div class="card muted">Receptek betöltése…</div>';
  await indexBPProducts();
  const t1s = [...new Set(allBPs().map(b => b.t))];
  await Promise.all(t1s.map(t => refGet('b', t)));
  const cands = t1s.filter(t => {
    const b = REFC.b[t];
    return b && b.i && b.i.p && b.i.p.length;
  });
  if (!cands.length) {
    out.innerHTML = '<div class="card muted">Egyik saját blueprintedből sem lehet inventálni.</div>';
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
  const fee = salesTax() + brokerFee();
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
    const net = price ? tr.made * price * (1 - fee) : 0;
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
    ? `<details style="margin-top:10px"><summary>${INVSKIP.length} tételt kihagytam</summary><ul class="small muted">${INVSKIP.map(x => '<li>' + esc(x) + '</li>').join('')}</ul></details>`
    : '';
  if (!INVROWS.length) {
    out.innerHTML = '<div class="card muted">Nincs számolható invention.</div>' + skipHtml;
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
  out.innerHTML =
    `${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('inv', 'name', T('T2 termék'))}${sortTh('inv', 't1', T('T1 BP'))}${sortTh('inv', 'dec', T('Legjobb decryptor'))}${sortTh('inv', 'chance', T('Esély'), 1)}${sortTh('inv', 'runs', T('Run / BPC'), 1)}${sortTh('inv', 'me', T('ME / TE'), 1)}${sortTh('inv', 'cost', T('Invention költség / BPC'), 1)}${sortTh('inv', 'profit', T('Profit / BPC'), 1)}${sortTh('inv', 'perRun', T('Profit / run'), 1)}${sortTh('inv', 'none', T('Decryptor nélkül / BPC'), 1)}${sortTh('inv', 'vol', T('Napi forgalom'), 1)}<th></th></tr></thead><tbody>${rows
      .map(g => {
        const r = g.best;
        if (!r) return '';
        const unsure = r.noPrice.length > 0;
        return `<tr><td>${esc(NAMES[r.prod] || r.prod)}${r.price ? `<div class="src">Jita ${isk(r.price)}${m2On() && sell2(r.prod) ? ' · ' + esc(m2Short()) + ' ' + isk(sell2(r.prod)) : ''}</div>` : ''}${r.price ? '' : ' <span class="pill warn">nincs Jita ár</span>'}${unsure ? `<div class="src">${T('Nincs Jita ára: {0}', esc(r.noPrice.map(t => NAMES[t] || t).join(', ')))}</div>` : ''}</td><td class="small">${esc(NAMES[r.t1] || r.t1)}<br>${r.copy.r === -1 ? 'BPO' : 'BPC ' + r.copy.r + ' run'} · ${esc(charName(r.copy.cid))}</td><td class="small">${r.dec ? esc(DECS[r.dec].n) : 'nincs'}</td><td class="num">${fmt(r.info.chance * 100, 1)}%</td><td class="num">${fmt(r.info.runsPer)}</td><td class="num">${r.info.me} / ${r.info.te}</td><td class="num">${isk(r.invCost)}</td><td class="num ${unsure ? '' : r.profit >= 0 ? 'pos' : 'neg'}">${unsure ? '? ' : ''}${isk(r.profit)}</td><td class="num">${isk(r.perRun)}</td><td class="num">${g.none ? isk(g.none.profit) : '–'}</td><td class="num">${fmt(r.vol, r.vol < 10 ? 1 : 0)}</td><td><button class="btn mini" data-invadd="${r.t1}" data-invdec="${r.dec || ''}" data-invt2="${r.t2}" data-invruns="${r.info.runsPer}" data-invpi="${r.info.pi || 0}">+ projekt</button></td></tr>`;
      })
      .join('')}</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">Az esélyt a legjobb skillű karaktered skilljeivel számolja (két science skill és az encryption skill). Az invention költsége átlagos értékre van számolva: datacore-ok, decryptor, invention job és T1 copy job, osztva az eséllyel. A T2 gyártás anyagköltsége a teljes anyagfával, piaci áron számít. A „+ projekt” egy BPC-nyi runt ad a kiválasztott projekthez a legjobb decryptorral.</p>` +
    m2Hint() +
    skipHtml;
  out.querySelectorAll('[data-invadd]').forEach(b =>
    b.addEventListener('click', () => {
      let p = PROJ.find(x => x.id === SELP);
      if (!p) {
        p = { id: Date.now(), name: T('Invention'), active: true, items: [] };
        PROJ.push(p);
        SELP = p.id;
      }
      p.items.push({
        invT1: Number(b.dataset.invadd),
        dec: b.dataset.invdec ? Number(b.dataset.invdec) : null,
        t2: Number(b.dataset.invt2),
        runs: Number(b.dataset.invruns),
        pi: Number(b.dataset.invpi || 0)
      });
      saveP();
      renderProjects();
      b.textContent = '✓ ' + p.name;
    })
  );
}

/* ---- research & copy ---- */
const RLM = [0, 105, 250, 595, 1414, 3360, 8000, 19000, 45255, 107700, 256000];
function bestLvl(id) {
  let b = 0,
    who = null;
  for (const c of workChars()) {
    const l = lvlOf(c, id);
    if (l >= b) {
      b = l;
      who = c;
    }
  }
  return { l: b, who };
}
function resMod(kind) {
  // ME: Metallurgy, TE: Research, copy: Science; + Advanced Industry + structure
  const sk = kind === 'me' ? SK.metallurgy : kind === 'te' ? SK.research : SK.science;
  const a = bestLvl(sk),
    b = bestLvl(SK.advInd);
  return { m: (1 - 0.05 * a.l) * (1 - 0.03 * b.l) * (1 - Number(S.structRes || 0) / 100), who: a.who, l: a.l };
}
let RESROWS = [];
async function runResearch() {
  const out = $('#rsOut');
  out.innerHTML = '<div class="card muted">Receptek betöltése…</div>';
  await indexBPProducts();
  const bpos = allBPs().filter(b => b.r === -1);
  const types = [...new Set(bpos.map(b => b.t))];
  await Promise.all(types.map(t => refGet('b', t)));
  const mats = new Set();
  types.forEach(t => {
    const b = REFC.b[t];
    const rec = b && (b.m || b.r);
    if (rec) rec.m.forEach(([m]) => mats.add(m));
  });
  status('árak…');
  await resolveNames([...mats, ...types]);
  await ensurePrices([...mats]);
  const mME = resMod('me'),
    mTE = resMod('te'),
    mCP = resMod('cp');
  const sysCache = {};
  RESROWS = [];
  for (const bp of bpos) {
    const b = REFC.b[bp.t];
    if (!b) continue;
    const rec = b.m || b.r;
    if (!rec) continue;
    const sys = sysCache[bp.l] !== undefined ? sysCache[bp.l] : (sysCache[bp.l] = await sysFor(bp));
    const ix = IDX.p[sys] || {};
    const eiv = rec.m.reduce((s, [m, q]) => s + (ADJ.p[m] || 0) * q, 0);
    const fees = Number(S.facTax || 0) / 100 + Number(S.scc || 0) / 100;
    const matVal = rec.m.reduce((s, [m, q]) => s + unitPrice(m) * q, 0);
    const lvlME = bp.me,
      lvlTE = Math.round(bp.te / 2);
    const step = (kind, L) => {
      const base = kind === 'me' ? b.rme : b.rte;
      const t = ((base * RLM[L]) / 105) * (kind === 'me' ? mME.m : mTE.m);
      const c =
        ((eiv * 0.02 * RLM[L]) / 105) *
        ((ix[kind === 'me' ? 'researching_material_efficiency' : 'researching_time_efficiency'] || 0) + fees);
      return { t, c };
    };
    let meT = 0,
      meC = 0;
    for (let L = lvlME + 1; L <= 10; L++) {
      const x = step('me', L);
      meT += x.t;
      meC += x.c;
    }
    let teT = 0,
      teC = 0;
    for (let L = lvlTE + 1; L <= 10; L++) {
      const x = step('te', L);
      teT += x.t;
      teC += x.c;
    }
    const nextME = lvlME < 10 ? step('me', lvlME + 1) : null;
    const saving = b.r ? 0 : matVal * 0.01; // reactions have no ME
    const cpRun = b.ct * mCP.m;
    const lim = b.lim || 1;
    const cpCost = eiv * 0.02 * ((ix.copying || 0) + fees);
    const job = inJob(bp.i);
    RESROWS.push({
      bp,
      name: NAMES[bp.t] || '#' + bp.t,
      me: lvlME,
      te: bp.te,
      nextME,
      saving,
      payback: nextME && saving && nextME.c > 0 ? nextME.c / saving : null,
      meT,
      meC,
      teT,
      teC,
      cpRun,
      lim,
      cpCost,
      job,
      isReac: !!(b.r && !b.m),
      noMarket: !matVal
    });
  }
  status('kész');
  renderResearch(mME, mTE, mCP);
}
function renderResearch(mME, mTE, mCP) {
  const out = $('#rsOut');
  const f = $('#rsFilter').value.toLowerCase(),
    nm = $('#rsNotMax').checked;
  let rows = RESROWS.filter(r => (!f || r.name.toLowerCase().includes(f)) && (!nm || r.me < 10 || r.te < 20));
  if (!SRT.res) SRT.res = { f: 'payback', d: 1 };
  const rg = (r, k) =>
    ({
      name: r.name,
      me: r.me * 100 + r.te,
      next: r.nextME && !r.isReac ? r.nextME.t : Infinity,
      cost: r.nextME && !r.isReac ? r.nextME.c : Infinity,
      saving: r.isReac || !r.nextME ? -Infinity : r.saving,
      payback: r.payback != null && !r.isReac ? r.payback : Infinity,
      meT: r.me < 10 && !r.isReac ? r.meT : 0,
      teT: r.te < 20 ? r.teT : 0,
      cp: r.cpRun,
      lim: r.lim
    })[k];
  rows = sortRows('res', rows, rg);
  const pg = pageOf('res', rows, [f, nm, RESROWS.length].join('|'), renderResearch);
  rows = pg.rows;
  // research slots per character
  const slots = workChars()
    .map(id => CHARS.find(c => c.id === id))
    .map(c => {
      const sl = slotsOf(c.id),
        bz = busyOf(c.id);
      return T('{0}: {1} szabad', esc(c.name), `<span class="mono">${Math.max(0, sl.s - bz.s)} / ${sl.s}</span>`);
    })
    .join(' · ');
  const sk = x => (x.who != null ? T('{0} (szint {1})', esc(charName(x.who)), x.l) : '–');
  out.innerHTML = `<p class="small muted">${T('Science slotok (kutatás, copy, invention): {0}. Skillek: ME kutatás {1}, TE kutatás {2}, copy {3}.', slots || '–', sk(mME || resMod('me')), sk(mTE || resMod('te')), sk(mCP || resMod('cp')))}</p>
  ${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('res', 'name', T('BPO'))}${sortTh('res', 'me', T('ME / TE'), 1)}${sortTh('res', 'next', T('Következő ME szint'), 1)}${sortTh('res', 'cost', T('Költsége'), 1)}${sortTh('res', 'saving', T('Megtakarítás / run'), 1)}${sortTh('res', 'payback', T('Megtérül'), 1)}${sortTh('res', 'meT', T('ME → 10'), 1)}${sortTh('res', 'teT', T('TE → 20'), 1)}${sortTh('res', 'cp', T('Copy idő / run'), 1)}${sortTh('res', 'lim', T('Max run / BPC'), 1)}<th>Állapot</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.name)}<div class="src">${esc(charName(r.bp.cid))} · ${esc(locName(r.bp.l))}</div></td><td class="num">${r.me} / ${r.te}</td><td class="num">${r.isReac ? '–' : r.nextME ? dur(r.nextME.t) : '<span class="pill ok">max</span>'}</td><td class="num">${r.nextME && !r.isReac ? isk(r.nextME.c) : '–'}</td><td class="num">${r.isReac ? '–' : r.nextME ? isk(r.saving) : '–'}</td><td class="num">${r.payback != null && !r.isReac ? fmt(Math.ceil(r.payback)) + ' run' : '–'}</td><td class="num">${r.isReac ? '–' : r.me < 10 ? dur(r.meT) + '<div class="src">' + isk(r.meC) + '</div>' : '–'}</td><td class="num">${r.te < 20 ? dur(r.teT) + '<div class="src">' + isk(r.teC) + '</div>' : '–'}</td><td class="num">${dur(r.cpRun)}</td><td class="num">${fmt(r.lim)}<div class="src">${dur(r.cpRun * r.lim)}</div></td><td>${r.job ? '<span class="pill warn">jobban</span>' : ''}${r.isReac ? '<span class="pill">reakció</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="11" class="muted">Nincs találat.</td></tr>'}</tbody></table></div>${pg.html}
  <p class="small muted" style="margin-top:6px">Megtakarítás / run: a következő ME szint 1%-a az alapanyagok mai Jita-értékéből. Megtérül: hány gyártott run után hozza vissza a következő ME szint kutatási költségét. A kutatás költsége: EIV × 2% × szintszorzó × a BP helyének research cost indexe, plusz adók. A copy ideje egy runra szól; a „Max run / BPC” alatt egy teljes BPC másolási ideje látszik. Reakció formulát nem lehet ME-re kutatni.</p>`;
}

/* ---- selling ---- */
function priceTick(p) {
  if (!p || p <= 0) return 0.01;
  const d = Math.floor(Math.log10(p)) - 3;
  return Math.max(0.01, Math.pow(10, d));
} // 4 significant digits
async function runSales() {
  const out = $('#slOut');
  const orders = [];
  for (const c of CHARS) {
    const d = DATA[c.id];
    if (!d) continue;
    (d.orders || []).forEach(o => orders.push(Object.assign({ cid: c.id }, o)));
  }
  const noScope = CHARS.filter(c => c.scp && !hasScope(c, 'esi-markets.read_character_orders.v1'));
  if (!orders.length) {
    out.innerHTML =
      sellerHtml() +
      m2Hint() +
      `<div class="card muted">${noScope.length ? T('Nincs aktív market ordered, vagy ezeknél a karaktereknél még nincs meg az új engedély: {0}. Lásd a Karakterek fület.', esc(noScope.map(c => c.name).join(', '))) : T('Nincs aktív market ordered. Ha most adtad hozzá az engedélyt, frissítsd a karaktereket.')}</div>` +
      salesHistory();
    return;
  }
  out.innerHTML = '<div class="card muted">Piaci árak lekérése…</div>';
  if (S.wallet) {
    const tt = new Set();
    for (const c of CHARS) {
      const d = DATA[c.id];
      if (d && d.tx)
        d.tx.forEach(x => {
          if (!x.buy) tt.add(x.t);
        });
    }
    if (tt.size) await ensurePrices([...tt]);
  }
  const own = new Set(orders.map(o => o.id));
  const book = {};
  const strs = [...new Set(orders.filter(o => o.l > 1e12).map(o => o.l))];
  const sbook = {};
  for (const l of strs) {
    try {
      sbook[l] = await structBook(l);
    } catch (e) {
      sbook[l] = null;
    }
  }
  const keys = [...new Set(orders.filter(o => !(o.l > 1e12)).map(o => o.reg + '|' + o.t))];
  let i = 0;
  await Promise.all(
    keys.map(async k => {
      const [reg, t] = k.split('|');
      try {
        book[k] = await esi('/markets/' + reg + '/orders/?type_id=' + t + '&order_type=all', { paged: true });
      } catch (e) {
        book[k] = null;
      }
      i++;
      status('piac: ' + i + '/' + keys.length);
    })
  );
  const rows = orders.map(o => {
    const b =
      o.l > 1e12
        ? sbook[o.l]
          ? (sbook[o.l].raw.get(o.t) || []).map(x => Object.assign({ location_id: o.l }, x))
          : null
        : book[o.reg + '|' + o.t];
    if (!b) return { o, best: null, state: 'ismeretlen' };
    const comp = b.filter(x => x.location_id === o.l && x.is_buy_order === o.buy && !own.has(x.order_id));
    const best = comp.length
      ? o.buy
        ? Math.max(...comp.map(x => x.price))
        : Math.min(...comp.map(x => x.price))
      : null;
    let state = 'egyedül',
      sugg = null;
    if (best != null) {
      const beaten = o.buy ? best > o.p : best < o.p;
      state = beaten ? (o.buy ? 'túlígértek' : 'alá ígértek') : 'legjobb';
      if (beaten) {
        const tk = priceTick(best);
        sugg = o.buy ? best + tk : best - tk;
      }
    }
    return { o, best, state, sugg };
  });
  SLROWS = rows;
  status('kész');
  renderSales();
}
let SLROWS = [];
function renderSales() {
  const out = $('#slOut');
  PGR.sl = renderSales;
  if (!SRT.sl) SRT.sl = { f: 'state', d: 1 };
  const RK = { 'alá ígértek': 0, túlígértek: 0, legjobb: 1, egyedül: 2, ismeretlen: 3 };
  const sg = (r, f) =>
    ({
      name: NAMES[r.o.t] || '',
      char: charName(r.o.cid),
      type: r.o.buy ? 1 : 0,
      p: r.o.p,
      best: r.best ?? -1,
      state: RK[r.state] * 1e18 - r.o.p * r.o.rem,
      rem: r.o.rem,
      loc: locName(r.o.l),
      exp: new Date(r.o.iss).getTime() + r.o.dur * 86400000
    })[f];
  const rows = sortRows('sl', SLROWS.slice(), sg);
  const beaten = rows.filter(r => r.state === 'alá ígértek' || r.state === 'túlígértek').length;
  const sellVal = rows.filter(r => !r.o.buy).reduce((s, r) => s + r.o.p * r.o.rem, 0),
    buyVal = rows.filter(r => r.o.buy).reduce((s, r) => s + r.o.p * r.o.rem, 0);
  out.innerHTML =
    sellerHtml() +
    m2Hint() +
    `<div class="kpis"><div class="kpi"><div class="k">Aktív order</div><div class="v">${rows.length}</div></div><div class="kpi"><div class="k">Megelőztek</div><div class="v ${beaten ? 'neg' : 'pos'}">${beaten}</div></div><div class="kpi"><div class="k">Eladó orderek értéke</div><div class="v">${isk(sellVal)}</div></div><div class="kpi"><div class="k">Vételi orderek értéke</div><div class="v">${isk(buyVal)}</div></div></div>
  <div class="tablewrap"><table><thead><tr>${sortTh('sl', 'name', T('Tárgy'))}${sortTh('sl', 'char', T('Karakter'))}${sortTh('sl', 'type', T('Típus'))}${sortTh('sl', 'p', T('Ár'), 1)}${sortTh('sl', 'best', T('Legjobb másik'), 1)}${sortTh('sl', 'state', T('Állapot'))}<th class="num">Javasolt ár</th>${sortTh('sl', 'rem', T('Maradt / összes'), 1)}${sortTh('sl', 'loc', T('Hely'))}${sortTh('sl', 'exp', T('Lejár'), 1)}</tr></thead><tbody>${rows
    .map(r => {
      const exp = new Date(new Date(r.o.iss).getTime() + r.o.dur * 86400000);
      const pill = r.state === 'legjobb' ? 'ok' : r.state === 'egyedül' ? '' : r.state === 'ismeretlen' ? '' : 'bad';
      return `<tr><td>${esc(NAMES[r.o.t] || r.o.t)}</td><td>${esc(charName(r.o.cid))}</td><td>${r.o.buy ? 'vétel' : 'eladás'}</td><td class="num">${isk(r.o.p)}</td><td class="num">${r.best == null ? '–' : isk(r.best)}</td><td><span class="pill ${pill}">${r.state}</span></td><td class="num">${r.sugg != null ? `<button class="btn mini" data-copyprice="${r.sugg}" title="Ár másolása">${fmt(r.sugg, 2)}</button>` : '–'}</td><td class="num">${fmt(r.o.rem)} / ${fmt(r.o.tot)}</td><td class="small">${esc(locName(r.o.l))}</td><td class="num small">${exp.toLocaleDateString(LOC())}</td></tr>`;
    })
    .join('')}</tbody></table></div>
  <p class="small muted" style="margin-top:6px">A „Legjobb másik” ugyanazon az állomáson lévő, nem a te karaktereidhez tartozó orderek közül a legjobb ár. A javasolt ár egy ártickkel jobb (4 értékes jegy), a gombbal vágólapra másolhatod. Az orderek a karakterek frissítésekor töltődnek le, a piaci árak minden „Ellenőrzés” gombnyomáskor.</p>` +
    salesHistory();
  out.querySelectorAll('[data-copyprice]').forEach(b =>
    b.addEventListener('click', () => {
      const v = String(Number(b.dataset.copyprice).toFixed(2));
      navigator.clipboard.writeText(v).then(
        () => status('ár vágólapon: ' + v),
        () => status('másolás nem sikerült')
      );
    })
  );
}

function salesHistory() {
  if (!S.wallet)
    return '<h3>Eladások az elmúlt 30 napban</h3><p class="small muted">A wallet-tranzakciók olvasása ki van kapcsolva. A Beállításokban bekapcsolhatod, ha szeretnéd látni a ténylegesen eladott tételeket.</p>';
  const tx = [];
  for (const c of CHARS) {
    const d = DATA[c.id];
    if (d && d.tx) d.tx.forEach(x => tx.push(Object.assign({ cid: c.id }, x)));
  }
  if (!tx.length)
    return '<h3>Eladások az elmúlt 30 napban</h3><p class="small muted">Nincs tranzakció, vagy még nincs meg a wallet-engedély. Ha most kapcsoltad be, add hozzá az engedélyt az alkalmazásodhoz, jelentkezz be újra, és frissíts.</p>';
  const g = new Map();
  for (const x of tx) {
    let r = g.get(x.t);
    if (!r) {
      r = { t: x.t, sq: 0, sv: 0, bq: 0, bv: 0 };
      g.set(x.t, r);
    }
    if (x.buy) {
      r.bq += x.q;
      r.bv += x.q * x.p;
    } else {
      r.sq += x.q;
      r.sv += x.q * x.p;
    }
  }
  const rows = [...g.values()].filter(r => r.sq).sort((a, b) => b.sv - a.sv);
  const tot = rows.reduce((s, r) => s + r.sv, 0);
  return `<h3>Eladások az elmúlt 30 napban</h3><div class="tablewrap"><table><thead><tr><th>Tárgy</th><th class="num">Eladva (db)</th><th class="num">Bevétel</th><th class="num">Átlagár</th><th class="num">Mai Jita sell</th>${m2On() ? `<th class="num">${esc(m2Short())} sell</th>` : ''}</tr></thead><tbody>${rows.map(r => `<tr><td>${esc(NAMES[r.t] || r.t)}</td><td class="num">${fmt(r.sq)}</td><td class="num">${isk(r.sv)}</td><td class="num">${isk(r.sv / r.sq)}</td><td class="num">${isk(sell(r.t))}</td>${m2On() ? `<td class="num">${m2Cell(sell(r.t), sell2(r.t))}</td>` : ''}</tr>`).join('') || '<tr><td colspan="6" class="muted">Nem adtál el semmit.</td></tr>'}<tr><td><b>Összesen</b></td><td></td><td class="num"><b>${isk(tot)}</b></td><td></td><td></td>${m2On() ? '<td></td>' : ''}</tr></tbody></table></div><p class="small muted" style="margin-top:6px">A bevétel bruttó, az eladási adó és a broker díj nélkül.</p>`;
}

/* ---- builds without buying ---- */
async function runCanBuild() {
  const out = $('#cbOut');
  out.innerHTML = '<div class="card muted">Receptek betöltése…</div>';
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
  out.innerHTML = `${pg.html}<div class="tablewrap"><table><thead><tr>${sortTh('cb', 'name', T('Termék'))}${sortTh('cb', 'bp', T('Legjobb saját BP'), 1)}${sortTh('cb', 'lo', T('Legyártható run'), 1)}${sortTh('cb', 'lim', T('Szűk keresztmetszet a következő runhoz'))}</tr></thead><tbody>${res.map(r => `<tr><td>${esc(NAMES[r.p] || r.p)}</td><td class="small">${r.bp.r === -1 ? 'BPO' : 'BPC ' + r.bp.r + ' run'} · ME${r.bp.me} · ${esc(charName(r.bp.cid))}</td><td class="num ${r.lo ? 'pos' : ''}">${fmt(r.lo)}</td><td class="small muted">${esc(r.limiter)}</td></tr>`).join('')}</tbody></table></div>${pg.html}`;
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
  sel.innerHTML =
    '<option value="">mind</option>' +
    [...cats].map(c => `<option value="${c}">${names[c] || 'Kategória ' + c}</option>`).join('');
  sel.value = cur;
}

/* ---- mining ---- */
let LASTSCAN = null;
async function runScan() {
  const lines = $('#scanIn')
    .value.split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const items = new Map();
  for (const l0 of lines) {
    let l = l0;
    if (!l.includes('\t')) {
      const m = l.match(/^(.+?)\s+(\d{1,3}(?:[ .,\u00a0]\d{3})+|\d+)(?:\s+.*)?$/);
      if (m) l = m[1] + '\t' + m[2];
    }
    const parts = l.split('\t');
    const name = parts[0].replace(/^\s+|\s+$/g, '');
    const qtyPart = parts.slice(1).find(p => /^[\d\s., ]+$/.test(p.trim()));
    if (!qtyPart) continue;
    const q = Number(qtyPart.replace(/[\s., ]/g, ''));
    if (!q) continue;
    items.set(name, (items.get(name) || 0) + q);
  }
  if (!items.size) {
    alertBox('Nem találtam érc-sorokat. A Survey Scanner ablakából másold be a sorokat.');
    return;
  }
  let ids = {};
  try {
    const r = await esi('/universe/ids/', { method: 'POST', body: [...items.keys()] });
    (r.inventory_types || []).forEach(x => (ids[x.name] = x.id));
  } catch (e) {
    alertBox(T('Névfeloldás sikertelen: {0}', e.message));
    return;
  }
  const minerals = new Map();
  const rows = [];
  for (const [name, q] of items) {
    const t = ids[name];
    if (!t) {
      rows.push({ name, q, miss: true });
      continue;
    }
    const ti = await refGet('t', t);
    const mins = await oreToMinerals(t, q);
    mins.forEach(([m, v]) => minerals.set(m, (minerals.get(m) || 0) + v));
    rows.push({ name, q, t, m3: q * (ti ? ti.vol : 0), mins, who: mins.who, y: mins.y, rs: mins.rs });
  }
  await resolveNames([...minerals.keys(), ...rows.map(r => r.rs).filter(Boolean)]);
  await ensurePrices([...minerals.keys()]);
  LASTSCAN = { minerals, rows };
  const tot = [...minerals].reduce((s, [m, v]) => s + v * unitPrice(m), 0);
  $('#scanOut').innerHTML =
    `<div class="grid2"><div><h3>Ércek</h3><div class="tablewrap"><table><thead><tr><th>Érc</th><th class="num">Egység</th><th class="num">m³</th><th>Ki reprocesszálja</th><th>Termék</th></tr></thead><tbody>${rows.map(r => (r.miss ? `<tr><td>${esc(r.name)}</td><td class="num">${fmt(r.q)}</td><td colspan="3" class="muted">ismeretlen név</td></tr>` : `<tr><td>${esc(r.name)}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.m3)}</td><td class="small">${r.who != null ? esc(charName(r.who)) + ' · ' : ''}<span class="mono">${fmt(r.y * 100, 1)}%</span></td><td class="small">${r.mins.map(([m, v]) => esc(NAMES[m] || m) + ' ' + fmt(v)).join(', ')}</td></tr>`)).join('')}</tbody></table></div></div>
  <div><h3>Ásványok összesen</h3><div class="tablewrap"><table><thead><tr><th>Ásvány</th><th class="num">Mennyiség</th><th class="num">Érték (Jita sell)</th>${m2On() ? `<th class="num">${esc(m2Short())}</th>` : ''}</tr></thead><tbody>${[...minerals].map(([m, v]) => `<tr><td>${esc(NAMES[m] || m)}</td><td class="num">${fmt(v)}</td><td class="num">${isk(v * unitPrice(m))}</td>${m2On() ? `<td class="num">${m2Cell(unitPrice(m), sell2(m))}</td>` : ''}</tr>`).join('')}<tr><td><b>Összesen</b></td><td></td><td class="num"><b>${isk(tot)}</b></td>${m2On() ? `<td class="num"><b>${isk([...minerals].reduce((s, [m, v]) => s + v * (sell2(m) || 0), 0))}</b></td>` : ''}</tr></tbody></table></div>${m2Hint()}</div></div>`;
  // yield per character and per processing skill
  const groups = [...new Set(rows.filter(r => !r.miss).map(r => r.rs || 0))];
  const cs = workChars().map(id => CHARS.find(c => c.id === id));
  if (cs.length > 1 && groups.length) {
    $('#scanOut').insertAdjacentHTML(
      'beforeend',
      `<h3>Reprocess hozam karakterenként</h3><div class="tablewrap"><table><thead><tr><th>Feldolgozó skill</th>${cs.map(c => `<th class="num">${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${groups
        .map(g => {
          const ys = cs.map(c => oreYieldFor(c.id, g || null));
          const mx = Math.max(...ys);
          return `<tr><td>${esc(g ? NAMES[g] || g : 'nincs külön skill')}</td>${ys.map(y => `<td class="num ${y === mx ? 'pos' : ''}">${fmt(y * 100, 1)}%</td>`).join('')}</tr>`;
        })
        .join(
          ''
        )}</tbody></table></div><p class="small muted" style="margin-top:6px">Alaphozam ${fmt(Number(S.yieldBase), 1)}% (Beállítások), Reprocessing, Reprocessing Efficiency és az érchez tartozó feldolgozó skill. A zöld a jobb. Minden fajtát a jobb hozamú karakterrel számol.</p>`
    );
  }
  renderMineNeed();
}
function renderMineNeed() {
  const el = $('#mineNeed');
  {
    const b = bestRepro(60377);
    $('#yieldInfo').textContent =
      T('Legjobb hozam (Simple ore): {0}%', fmt(b.y * 100, 1)) + (b.who != null ? ' · ' + charName(b.who) : '');
  }
  if (!LASTPLAN) {
    return;
  }
  const prodSet = new Set([34, 35, 36, 37, 38, 39, 40, 11399].concat(LASTSCAN ? [...LASTSCAN.minerals.keys()] : []));
  const need = [...LASTPLAN.buyList].filter(([t]) => prodSet.has(t));
  if (!need.length) {
    el.innerHTML = T(
      'A legutóbbi tervhez ({0}) nem kell ásványt vagy reprocess-terméket venni.',
      esc(LASTPLAN.title || '')
    );
    return;
  }
  el.innerHTML = `<p>Terv: <b>${esc(LASTPLAN.title || '')}</b></p><div class="tablewrap"><table><thead><tr><th>Termék</th><th class="num">Hiány</th><th class="num">A beltből</th><th class="num">Fedezet</th></tr></thead><tbody>${need
    .map(([t, q]) => {
      const b = LASTSCAN ? LASTSCAN.minerals.get(t) || 0 : null;
      return `<tr><td>${esc(NAMES[t] || t)}</td><td class="num">${fmt(q)}</td><td class="num">${b == null ? '–' : fmt(b)}</td><td class="num">${b == null ? '–' : `<span class="pill ${b >= q ? 'ok' : 'warn'}">${fmt(Math.min(100, (b / q) * 100))}%</span>`}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}
