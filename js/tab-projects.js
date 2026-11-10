/* IndyOps – Projects tab: project list, items, material sources, calculation. */
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
  setHtml(
    $('#pList'),
    PROJ.length
      ? hjoin(
          PROJ.map(
            (p, i) =>
              html`<div class="prow ${p.id === SELP ? 'sel' : ''}" data-pid="${p.id}"><label class="inline" title="Aktív: beleszámít az összesített tervbe"><input type="checkbox" data-pact="${p.id}" ${p.active ? 'checked' : ''}></label><button class="plink" data-psel="${p.id}">${p.name}<span class="small muted"> · ${p.items.length} tétel${p.src && p.src.mode === 'sel' ? ' · 📦' : ''}</span></button><span class="pord"><button class="btn mini" data-pup="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Feljebb">▲</button><button class="btn mini" data-pdown="${i}" ${i === PROJ.length - 1 ? 'disabled' : ''} aria-label="Lejjebb">▼</button></span></div>`
          ),
          ''
        )
      : html`<p class="small muted">Még nincs projekt. Adj egy nevet, pl. „Orca rendelés”, és hozd létre.</p>`
  );
  const p = PROJ.find(x => x.id === SELP);
  const ed = $('#pEdit');
  if (!p) {
    setHtml(ed, html`<h2>Projekt</h2><p class="muted">Válassz vagy hozz létre egy projektet a bal oldalon.</p>`);
    return;
  }
  setHtml(
    ed,
    html`<div class="row" style="justify-content:space-between"><label style="flex:1;min-width:200px">Projekt neve<input id="pName" value="${p.name}"></label><button class="btn" id="pDel">Projekt törlése</button></div>
  <div id="pDelConfirm" class="notice err" hidden><p>${T('Biztosan törlöd a(z) „{0}” projektet?', p.name)}</p><div class="row"><button class="btn primary" id="pDelYes">Igen, törlöm</button><button class="btn" id="pDelNo">Mégse</button></div></div>
  <h3>Tételek</h3><div class="tablewrap"><table><thead><tr><th>Blueprint</th><th class="num">Run</th><th>Saját példányok</th><th>Nyersanyag</th><th></th></tr></thead><tbody>${
    hjoin(
      p.items.map((it, i) => {
        if (it.invT1) {
          const c1 = copiesOf(it.invT1);
          return html`<tr><td>${NAMES[it.t2] || 'T2 BPC'} <span class="pill">invention</span><div class="src">${it.dec ? DECS[it.dec].n : 'decryptor nélkül'}</div></td><td class="num"><input type="number" min="1" value="${it.runs}" data-iruns="${i}" style="width:80px"></td><td class="small">${c1.length ? 'T1: ' + (NAMES[it.invT1] || it.invT1) + ' · ' + (c1[0].r === -1 ? 'BPO' : 'BPC ' + c1[0].r + ' run') : html`<span class="pill bad">nincs T1 BP</span>`}</td><td>${itemSrcSel(it, i)}</td><td><button class="btn mini" data-idel="${i}" aria-label="Tétel törlése">✕</button></td></tr>${itemSrcRow(it, i, p)}`;
        }
        const cp = copiesOf(it.bpType);
        const runs = cp.reduce((s, c) => (c.r === -1 ? Infinity : s + c.r), 0);
        return html`<tr><td>${NAMES[it.bpType] || it.bpType}</td><td class="num"><input type="number" min="1" value="${it.runs}" data-iruns="${i}" style="width:80px"></td><td class="small">${cp.length ? cp.length + ' db · legjobb: ' + (cp[0].r === -1 ? 'BPO' : 'BPC') + ' ME' + cp[0].me + (runs !== Infinity ? ' · összesen ' + runs + ' run' + (runs < it.runs ? html` <span class="pill bad">kevés</span>` : '') : '') : html`<span class="pill bad">nincs saját példány</span>`}</td><td>${itemSrcSel(it, i)}</td><td><button class="btn mini" data-idel="${i}" aria-label="Tétel törlése">✕</button></td></tr>${itemSrcRow(it, i, p)}`;
      }),
      ''
    ) || html`<tr><td colspan="5" class="muted">Még nincs tétel.</td></tr>`
  }</tbody></table></div>
  ${projSrcHtml(p)}
  <div class="row" style="margin-top:10px"><label style="flex:1;min-width:220px">Új tétel (saját BP)<input id="pItemName" list="bpOptions" placeholder="pl. Hurricane Blueprint"></label><label>Run<input type="number" id="pItemRuns" min="1" value="1"></label><button class="btn" id="pItemAdd">Hozzáadás</button></div>
  <div class="row" style="margin-top:14px"><button class="btn primary" id="pCalc">Ennek a projektnek a számolása</button></div>`
  );
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
  return html`<select data-isrc="${i}"><option value="">${T('projekt szerint')}</option><option value="sel" ${sel ? 'selected' : ''}>${T('saját források')}</option></select>`;
}
function itemSrcRow(it, i, p) {
  if (!(it.src && it.src.mode === 'sel')) return '';
  return html`<tr class="srcrow"><td colspan="5">${srcEditor(it.src, 'i' + i, false, p.id)}</td></tr>`;
}
function projSrcHtml(p) {
  const s = p.src || { mode: 'all' };
  const sel = s.mode === 'sel';
  return html`<h3>Nyersanyag-források</h3><div class="row"><label class="inline"><input type="radio" name="psrcm" value="all" ${sel ? '' : 'checked'}> Mindenhonnan (a Beállításokban kijelölt helyekről)</label><label class="inline"><input type="radio" name="psrcm" value="sel" ${sel ? 'checked' : ''}> Kiválasztott forrásokból</label></div>
  ${sel ? srcEditor(s, 'p', true, p.id) : html`<p class="small muted">A projekt a közös készletből dolgozik, prioritás szerint a többi aktív projekttel együtt. Válts a „Kiválasztott forrásokból” módra, ha a projektnek saját állomása, konténere vagy foglalt doboza van.</p>`}`;
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
    return html`<div class="srcc" style="padding-left:${22 + d * 18}px"><label class="inline"><input type="checkbox" data-scont="${key}|${c.id}" ${selC.has(c.id) ? 'checked' : ''}> ${contLabel(c.id, all)}</label> <span class="small muted">${charName(c.cid)} · ${T('{0} féle tárgy', fmt((ckinds.get(c.id) || new Set()).size))}</span>${withExcl ? html` <label class="inline small"><input type="checkbox" data-sexcl="${key}|${c.id}" ${ex.has(c.id) ? 'checked' : ''}> ${T('csak ez a projekt')}</label>` : ''}${other ? html` <span class="pill warn">${T('foglalja: {0}', pname(resv.get(c.id)))}</span>` : ''}</div>${[
      ...all.values()
    ]
      .filter(x => x.pc === c.id && byLoc.get(c.l) && byLoc.get(c.l).includes(x))
      .map(x => contRow(x, d + 1))}`;
  };
  const locs = [...kinds.keys()].sort((a, b) => locName(a).localeCompare(locName(b)));
  const nL = selL.size,
    nC = selC.size;
  return html`<div class="srcbox"><p class="small"><label class="inline" style="float:right"><input type="checkbox" data-srcships ${showShips ? 'checked' : ''}> ${T('hajók is')}</label>${T('Kiválasztva: {0} helyszín, {1} konténer.', nL, nC)} ${withExcl && ex.size ? T('Foglalt doboz: {0}.', ex.size) : ''}${nL + nC ? '' : html` <span class="pill warn">${T('Még nincs kiválasztva forrás: így minden anyagot venni kell.')}</span>`}</p>
  ${hasCont ? '' : html`<p class="small muted">${T('A konténerek listájához frissítsd egyszer a karaktereket.')}</p>`}
  ${locs.map(l => {
    const cs = (byLoc.get(l) || []).filter(c => c.pc == null || !all.has(c.pc) || all.get(c.pc).l !== l);
    const open = [...(byLoc.get(l) || [])].some(c => selC.has(c.id) || ex.has(c.id));
    return html`<details data-dl="${key}|${l}" ${open || SRCOPEN.has(key + '|' + l) ? 'open' : ''}><summary><input type="checkbox" data-sloc="${key}|${l}" ${selL.has(l) ? 'checked' : ''} aria-label="${locName(l)}"> ${locName(l)} <span class="small muted">${T('{0} féle tárgy', fmt(kinds.get(l).size))}${byLoc.get(l) ? ' · ' + T('{0} konténer', byLoc.get(l).length) : ''}</span></summary>${
      hjoin(
        cs.map(c => contRow(c, 0)),
        ''
      ) || html`<div class="srcc small muted" style="padding-left:22px">${T('nincs konténer')}</div>`
    }</details>`;
  })}
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
  setHtml(out, html`<div class="card muted">Számolás…</div>`);
  try {
    await indexBPProducts();
    const opt = Object.assign(getOpt(), { incoming: $('#pIncoming').checked });
    const shared = { pool: await buildPool(opt), runsLeft: new Map() };
    const R = { trees: [], buyList: new Map(), usedList: new Map(), jobs: [], warn: [], par: [] };
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
      R.par.push(...r.par);
      for (const [t, q] of r.buyList) R.buyList.set(t, (R.buyList.get(t) || 0) + q);
      for (const [t, q] of r.usedList) R.usedList.set(t, (R.usedList.get(t) || 0) + q);
    }
    if (!R.trees.length) {
      setHtml(out, html`<div class="card muted">Nincs számolható tétel. Adj hozzá tételeket a projekthez.</div>`);
      return;
    }
    await finishResult(R, firstBP);
    R.title = list.map(p => p.name).join(' + ');
    LASTPLAN = R;
    setHtml(out, '');
    const head = document.createElement('h2');
    head.textContent = R.title;
    head.style.marginTop = '8px';
    const body = document.createElement('div');
    out.append(head, body);
    LASTRENDER = () => showResult(body, R, () => calcProjects(list));
    LASTRENDER();
    renderMineNeed();
  } catch (e) {
    setHtml(out, html`<div class="notice err"><p>${e.message}</p></div>`);
    log(e.stack || e.message);
  }
}
