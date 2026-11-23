'use strict';
// Mining plan: materials marked "I mine it" (S.mineMark) leave the shopping list; this finds a mix of ores that
// gives them after reprocessing, with the least m³ to mine or the least surplus (S.mineGoal), from the ores the
// player allows (S.mineOff: ores switched off). Yield: as on the Mining tab (bestRepro: skills, base yield).

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

// need: Map(material -> qty). Returns { rows: [{ o, units, m3 }], out: Map, surplus: Map, m3, missing: [material] }
function solveMine(need, ores, goal) {
  const mats = [...need.keys()];
  const per = ores.map(o => {
    const y = bestRepro(o.rs).y;
    // per portion: materials after reprocessing, its volume and its value
    const out = new Map(o.tm.map(([m, q]) => [m, q * y]));
    return { o, out, vol: o.vol * (o.p || 1), val: [...out].reduce((s, [m, q]) => s + q * unitPrice(m), 0) };
  });
  const missing = mats.filter(m => !per.some(p => p.out.get(m) > 0));
  const use = mats.filter(m => !missing.includes(m));
  const A = use.map(m => per.map(p => p.out.get(m) || 0));
  const b = use.map(m => need.get(m));
  // least m³; or least surplus value (the whole output's value), with a little m³ to break ties
  const c = per.map(p => (goal === 'waste' ? p.val + p.vol * 1e-3 : p.vol));
  const x = use.length ? lpMinCover(A, b, c) : per.map(() => 0);
  if (!x) return { rows: [], out: new Map(), surplus: new Map(), m3: 0, missing: mats };
  // whole portions; then top up any material the rounding of the yield left short
  const portions = x.map(v => Math.ceil(v - 1e-9));
  const total = () => {
    const out = new Map();
    per.forEach((p, i) => p.out.forEach((q, m) => out.set(m, (out.get(m) || 0) + Math.floor(q * portions[i]))));
    return out;
  };
  for (let k = 0; k < 50; k++) {
    const out = total();
    const short = use.find(m => (out.get(m) || 0) < need.get(m));
    if (!short) break;
    const i = per.reduce(
      (bi, p, j) => ((p.out.get(short) || 0) / p.vol > (per[bi].out.get(short) || 0) / per[bi].vol ? j : bi),
      0
    );
    portions[i]++;
  }
  const out = total();
  const surplus = new Map([...out].map(([m, q]) => [m, q - (need.get(m) || 0)]).filter(([, q]) => q > 0));
  const rows = per
    .map((p, i) => ({ o: p.o, units: portions[i] * (p.o.p || 1), m3: portions[i] * p.vol }))
    .filter(r => r.units > 0)
    .sort((a, b) => b.m3 - a.m3);
  return { rows, out, surplus, m3: rows.reduce((s, r) => s + r.m3, 0), missing };
}

// candidate ores: those that give at least one marked material, the switched-off ones apart
function mineCands(need) {
  return (OREDATA || []).filter(o => o.tm.some(([m]) => need.has(m)));
}

function renderMinePlan(R) {
  const need = R.mineList;
  if (!need || !need.size) return '';
  const cands = mineCands(need);
  const off = S.mineOff || {};
  const on = cands.filter(o => !off[o.t]);
  const goal = S.mineGoal === 'waste' ? 'waste' : 'm3';
  const res = solveMine(need, on, goal);
  const rate = Number(S.mineRate) || 0;
  const surplusVal = [...res.surplus].reduce((s, [m, q]) => s + q * unitPrice(m), 0);
  const chips = cands
    .slice()
    .sort((a, b) => a.n.localeCompare(b.n))
    .map(
      o =>
        html`<label class="chip ${off[o.t] ? '' : 'on'}" title="${o.tm.map(([m, q]) => (NAMES[m] || m) + ' ' + q).join(', ')} / ${o.p} ${T('db')}"><input type="checkbox" data-mineore="${o.t}" ${off[o.t] ? '' : 'checked'}> ${o.n}</label>`
    );
  const table = res.rows.length
    ? html`<div class="tablewrap"><table><thead><tr><th>${T('Érc')}</th><th class="num">${T('Egység')}</th><th class="num">m³</th>${rate ? html`<th class="num">${T('Idő')}</th>` : ''}</tr></thead><tbody>${hjoin(
        res.rows.map(
          r =>
            html`<tr><td>${r.o.n}</td><td class="num">${fmt(r.units)}</td><td class="num">${fmt(r.m3)}</td>${rate ? html`<td class="num">${dur((r.m3 / rate) * 3600)}</td>` : ''}</tr>`
        ),
        ''
      )}<tr><td><b>${T('Összesen')}</b></td><td></td><td class="num"><b>${fmt(res.m3)}</b></td>${rate ? html`<td class="num"><b>${dur((res.m3 / rate) * 3600)}</b></td>` : ''}</tr></tbody></table></div>`
    : '';
  const need2 = html`<div class="tablewrap"><table><thead><tr><th>${T('Anyag')}</th><th class="num">${T('Kell')}</th><th class="num">${T('Kijön')}</th><th class="num">${T('Felesleg')}</th></tr></thead><tbody>${hjoin(
    [...new Set([...need.keys(), ...res.out.keys()])].map(m => {
      const q = need.get(m) || 0,
        o = res.out.get(m) || 0;
      return html`<tr><td>${NAMES[m] || m}${need.has(m) ? '' : html` <span class="muted small">${T('(melléktermék)')}</span>`}</td><td class="num">${q ? fmt(q) : '–'}</td><td class="num ${o < q ? 'neg' : ''}">${fmt(o)}</td><td class="num">${o > q ? fmt(o - q) : '–'}</td></tr>`;
    }),
    ''
  )}</tbody></table></div>`;
  const miss = res.missing.length
    ? html`<p class="small neg">${T('Ezekhez nincs kijelölt érc: {0}.', res.missing.map(m => NAMES[m] || m).join(', '))}</p>`
    : '';
  return html`<h3>${T('Bányászati terv')}</h3><p class="small muted">${T('A „bányászom”-ra állított anyagok ércben: a jelölt ércekből ennyit kell kibányászni, hogy reprocess után meglegyen (a Bányászat fül hozamával: alaphozam, skillek).')}</p>
  <div class="row"><label>${T('Cél')} <select data-minegoal><option value="m3" ${goal === 'm3' ? 'selected' : ''}>${T('legkevesebb m³')}</option><option value="waste" ${goal === 'waste' ? 'selected' : ''}>${T('legkevesebb felesleg')}</option></select></label><label>${T('Hozam (m³/óra, összesen)')} <input type="number" min="0" step="100" data-minerate value="${S.mineRate ?? ''}" style="width:110px"></label></div>
  ${miss}<div class="grid2" style="margin-top:8px"><div>${table}</div><div>${need2}${surplusVal > 0 ? html`<p class="small muted">${T('A felesleg értéke (Jita): {0}', isk(surplusVal))}</p>` : ''}</div></div>
  <details style="margin-top:6px"><summary class="small">${T('Ércek ({0} / {1} kijelölve)', on.length, cands.length)}</summary><div class="chips" style="margin-top:6px">${hjoin(chips, ' ')}</div><p class="small muted">${T('Vedd ki azokat, amelyek nincsenek ott, ahol bányászol. A változatok (pl. Concentrated, Dense) többet adnak egységenként.')}</p></details>`;
}

function bindMinePlan(el, R) {
  const box = el.querySelector('.minebox');
  if (!box) return;
  const redraw = () => {
    const open = box.querySelector('details') && box.querySelector('details').open;
    setHtml(box, renderMinePlan(R));
    if (open && box.querySelector('details')) box.querySelector('details').open = true;
    bindMinePlan(el, R);
  };
  box.querySelectorAll('[data-mineore]').forEach(c =>
    c.addEventListener('change', () => {
      setSettingIn('mineOff', c.dataset.mineore, c.checked ? null : true);
      redraw();
    })
  );
  const g = box.querySelector('[data-minegoal]');
  if (g)
    g.addEventListener('change', () => {
      setSetting('mineGoal', g.value);
      redraw();
    });
  const r = box.querySelector('[data-minerate]');
  if (r)
    r.addEventListener('change', () => {
      setSetting('mineRate', r.value === '' ? '' : String(Math.max(0, Number(r.value) || 0)));
      redraw();
    });
}
