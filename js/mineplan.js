'use strict';
// Mining from the shopping list: rows ticked "I mine it" (S.mineSel) stay on the list with a * and price 0; the box
// under the list says how much of which ore that is (units, m³) and how long at the given yield (m³/s).
// Mode (S.mineMode): simple = per material the ore that gives most of it per m³; smart = the mix with the least m³
// (by-products count). Ores can be switched off (S.mineOff). Yield per ore: as on the Mining tab (bestRepro).

let OREDATA = null; // [{ t, n, vol, p, tm, rs, g }] belt and moon ores (no ice, no compressed)
const ICE_GROUP = 465;
async function ensureOreData() {
  if (OREDATA) return OREDATA;
  const ids = await ensureOres();
  await Promise.all(ids.map(t => refGet('t', t).catch(() => null)));
  OREDATA = ids
    .map(t => Object.assign({ t }, REFC.t[t] || {}))
    .filter(o => o.n && o.tm && o.tm.length && o.g !== ICE_GROUP && !/compressed/i.test(o.n) && o.vol > 0)
    // unpublished test types have no adjusted price
    .filter(o => !ADJ.p || !Object.keys(ADJ.p).length || ADJ.p[o.t] != null);
  return OREDATA;
}
// materials that come out of some ore (only these can be marked "I mine it")
function minable(t) {
  return !!OREDATA && OREDATA.some(o => o.tm.some(([m]) => m === t));
}

/* Small dense LP: minimise c·x with A·x >= b, x >= 0 (b >= 0, c >= 0). Solved through the dual
 * (max b·y, Aᵀy <= c, y >= 0), whose origin is feasible, with the simplex method (Bland's rule).
 * A: rows = constraints (materials), cols = variables (ores). Returns x, or null when b cannot be met. */
function lpMinCover(A, b, c) {
  const m = A.length,
    n = c.length;
  // dual tableau: n rows (one per ore: Aᵀy + s = c), m + n columns (y, slacks), objective row
  const T = [];
  for (let j = 0; j < n; j++) {
    const row = new Array(m + n + 1).fill(0);
    for (let i = 0; i < m; i++) row[i] = A[i][j];
    row[m + j] = 1;
    row[m + n] = c[j];
    T.push(row);
  }
  const z = new Array(m + n + 1).fill(0);
  for (let i = 0; i < m; i++) z[i] = -b[i];
  const basis = Array.from({ length: n }, (_, j) => m + j);
  for (let it = 0; it < 5000; it++) {
    let col = -1;
    for (let k = 0; k < m + n; k++)
      if (z[k] < -1e-9) {
        col = k;
        break;
      }
    if (col < 0) break;
    let row = -1,
      best = Infinity;
    for (let r = 0; r < n; r++)
      if (T[r][col] > 1e-12) {
        const q = T[r][m + n] / T[r][col];
        if (q < best - 1e-12 || (Math.abs(q - best) <= 1e-12 && basis[r] < basis[row])) {
          best = q;
          row = r;
        }
      }
    if (row < 0) return null; // dual unbounded: the materials cannot all be covered with these ores
    const pv = T[row][col];
    for (let k = 0; k <= m + n; k++) T[row][k] /= pv;
    for (let r = 0; r < n; r++)
      if (r !== row && T[r][col]) {
        const f = T[r][col];
        for (let k = 0; k <= m + n; k++) T[r][k] -= f * T[row][k];
      }
    const f = z[col];
    for (let k = 0; k <= m + n; k++) z[k] -= f * T[row][k];
    basis[row] = col;
  }
  // primal solution: the reduced costs of the slack columns
  return Array.from({ length: n }, (_, j) => Math.max(0, z[m + j]));
}

// per portion of an ore: materials after reprocessing and its volume
function orePer(o) {
  const y = bestRepro(o.rs).y;
  return { o, out: new Map(o.tm.map(([m, q]) => [m, q * y])), vol: o.vol * (o.p || 1) };
}
// need: Map(material -> qty). Returns { rows: [{ o, units, m3, for: [materials] }], m3, missing: [materials] }
function solveMine(need, ores, mode) {
  const per = ores.map(orePer);
  const mats = [...need.keys()];
  const missing = mats.filter(m => !per.some(p => p.out.get(m) > 0));
  const use = mats.filter(m => !missing.includes(m));
  const portions = per.map(() => 0);
  if (mode === 'smart' && use.length) {
    const x = lpMinCover(
      use.map(m => per.map(p => p.out.get(m) || 0)),
      use.map(m => need.get(m)),
      per.map(p => p.vol)
    );
    if (x) x.forEach((v, i) => (portions[i] = Math.ceil(v - 1e-9)));
    // the rounding of the yield can leave a material a little short: top up with its best ore
    for (let k = 0; k < 50; k++) {
      const out = new Map();
      per.forEach((p, i) => p.out.forEach((q, m) => out.set(m, (out.get(m) || 0) + Math.floor(q * portions[i]))));
      const short = use.find(m => (out.get(m) || 0) < need.get(m));
      if (!short) break;
      portions[bestFor(per, short)]++;
    }
  } else
    for (const m of use) {
      // simple: each material on its own, from the ore that gives most of it per m³ (by-products not counted)
      const i = bestFor(per, m);
      const each = per[i].out.get(m);
      let k = Math.ceil(need.get(m) / each - 1e-9);
      while (Math.floor(k * each) < need.get(m)) k++; // reprocessing rounds down
      portions[i] += k;
    }
  const forOf = i => use.filter(m => (mode === 'smart' ? per[i].out.get(m) > 0 : bestFor(per, m) === i));
  const rows = per
    .map((p, i) => ({ o: p.o, units: portions[i] * (p.o.p || 1), m3: portions[i] * p.vol, for: forOf(i) }))
    .filter(r => r.units > 0)
    .sort((a, b) => b.m3 - a.m3);
  return { rows, m3: rows.reduce((s, r) => s + r.m3, 0), missing };
}
const bestFor = (per, m) =>
  per.reduce((bi, p, j) => ((p.out.get(m) || 0) / p.vol > (per[bi].out.get(m) || 0) / per[bi].vol ? j : bi), 0);

// the ticked rows of a shopping list
const minedList = bl => bl.filter(([t]) => mined(t));
function renderMinePlan(bl) {
  const need = new Map(minedList(bl));
  if (!need.size) return '';
  const cands = (OREDATA || []).filter(o => o.tm.some(([m]) => need.has(m)));
  const off = S.mineOff || {};
  const on = cands.filter(o => !off[o.t]);
  const mode = S.mineMode === 'smart' ? 'smart' : 'simple';
  const res = solveMine(need, on, mode);
  const rate = Number(S.mineRate) || 0; // m³ per second
  const time = m3 => (rate ? dur(m3 / rate) : '–');
  const rows = res.rows.map(
    r =>
      html`<tr><td>${r.o.n}<div class="src">${T('ezért: {0}', r.for.map(m => NAMES[m] || m).join(', '))}</div></td><td class="num">${fmt(r.units)}</td><td class="num">${fmt(r.m3)}</td><td class="num">${time(r.m3)}</td><td><button class="btn mini" data-mineoff="${r.o.t}" title="${T('Ezt az ércet nem akarom fúrni')}">✕</button></td></tr>`
  );
  const offList = cands.filter(o => off[o.t]);
  return html`<div class="card" style="margin-top:8px"><h3>${T('Bányászat')}</h3><div class="row"><label>${T('Mód')} <select data-minemode><option value="simple" ${mode === 'simple' ? 'selected' : ''}>simple</option><option value="smart" ${mode === 'smart' ? 'selected' : ''}>smart</option></select></label><label>${T('Hozam (m³/s)')} <input type="number" min="0" step="0.1" data-minerate value="${S.mineRate ?? ''}" style="width:90px"></label></div>
  ${res.missing.length ? html`<p class="small neg">${T('Ezekhez nincs bekapcsolt érc: {0}.', res.missing.map(m => NAMES[m] || m).join(', '))}</p>` : ''}
  <div class="tablewrap" style="margin-top:6px"><table><thead><tr><th>${T('Érc')}</th><th class="num">${T('Egység')}</th><th class="num">m³</th><th class="num">${T('Idő')}</th><th></th></tr></thead><tbody>${hjoin(rows, '')}<tr><td><b>${T('Összesen')}</b></td><td></td><td class="num"><b>${fmt(res.m3)}</b></td><td class="num"><b>${time(res.m3)}</b></td><td></td></tr></tbody></table></div>
  ${
    offList.length
      ? html`<p class="small">${T('Kikapcsolva:')} ${hjoin(
          offList.map(
            o => html`<button class="btn mini" data-mineon="${o.t}" title="${T('Visszakapcsolom')}">${o.n} ↺</button>`
          ),
          ' '
        )}</p>`
      : ''
  }
  <p class="small muted">${T('simple: anyagonként az az érc, amelyik m³-enként a legtöbbet adja belőle (a melléktermék nem számít be). smart: a legkevesebb m³-t adó keverék, a melléktermékek is beszámítanak. A hozam a Bányászat fül szerinti reprocess-hozammal számol. A ✕ kikapcsolja az ércet, ha azt nem akarod fúrni.')}</p></div>`;
}
function bindMinePlan(el) {
  el.querySelectorAll('[data-minesel]').forEach(c =>
    c.addEventListener('change', () => setSettingIn('mineSel', c.dataset.minesel, c.checked ? true : null))
  );
  el.querySelectorAll('[data-mineoff]').forEach(b =>
    b.addEventListener('click', () => setSettingIn('mineOff', b.dataset.mineoff, true))
  );
  el.querySelectorAll('[data-mineon]').forEach(b =>
    b.addEventListener('click', () => setSettingIn('mineOff', b.dataset.mineon, null))
  );
  const m = el.querySelector('[data-minemode]');
  if (m) m.addEventListener('change', () => setSetting('mineMode', m.value));
  const r = el.querySelector('[data-minerate]');
  if (r)
    r.addEventListener('change', () =>
      setSetting('mineRate', r.value === '' ? '' : String(Math.max(0, Number(r.value) || 0)))
    );
}
