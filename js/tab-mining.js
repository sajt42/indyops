/* IndyOps – Mining tab: survey scan, ore value, minerals for the plan. */
'use strict';
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
  setHtml(
    $('#scanOut'),
    html`<div class="grid2"><div><h3>Ércek</h3><div class="tablewrap"><table><thead><tr><th>Érc</th><th class="num">Egység</th><th class="num">m³</th><th>Ki reprocesszálja</th><th>Termék</th></tr></thead><tbody>${rows.map(
      r =>
        r.miss
          ? html`<tr><td>${r.name}</td><td class="num">${fmt(r.q)}</td><td colspan="3" class="muted">ismeretlen név</td></tr>`
          : html`<tr><td>${r.name}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.m3)}</td><td class="small">${r.who != null ? charName(r.who) + ' · ' : ''}<span class="mono">${fmt(r.y * 100, 1)}%</span></td><td class="small">${hjoin(
              r.mins.map(([m, v]) => (NAMES[m] || m) + ' ' + fmt(v)),
              ', '
            )}</td></tr>`
    )}</tbody></table></div></div>
  <div><h3>Ásványok összesen</h3><div class="tablewrap"><table><thead><tr><th>Ásvány</th><th class="num">Mennyiség</th><th class="num">Érték (Jita sell)</th>${m2On() ? html`<th class="num">${m2Short()}</th>` : ''}</tr></thead><tbody>${[...minerals].map(([m, v]) => html`<tr><td>${NAMES[m] || m}</td><td class="num">${fmt(v)}</td><td class="num">${isk(v * unitPrice(m))}</td>${m2On() ? html`<td class="num">${m2Cell(unitPrice(m), sell2(m))}</td>` : ''}</tr>`)}<tr><td><b>Összesen</b></td><td></td><td class="num"><b>${isk(tot)}</b></td>${m2On() ? html`<td class="num"><b>${isk([...minerals].reduce((s, [m, v]) => s + v * (sell2(m) || 0), 0))}</b></td>` : ''}</tr></tbody></table></div>${m2Hint()}</div></div>`
  );
  // yield per character and per processing skill
  const groups = [...new Set(rows.filter(r => !r.miss).map(r => r.rs || 0))];
  const cs = workChars().map(id => CHARS.find(c => c.id === id));
  if (cs.length > 1 && groups.length) {
    appendHtml(
      $('#scanOut'),
      html`<h3>Reprocess hozam karakterenként</h3><div class="tablewrap"><table><thead><tr><th>Feldolgozó skill</th>${cs.map(c => html`<th class="num">${c.name}</th>`)}</tr></thead><tbody>${groups.map(
        g => {
          const ys = cs.map(c => oreYieldFor(c.id, g || null));
          const mx = Math.max(...ys);
          return html`<tr><td>${g ? NAMES[g] || g : 'nincs külön skill'}</td>${hjoin(
            ys.map(y => html`<td class="num ${y === mx ? 'pos' : ''}">${fmt(y * 100, 1)}%</td>`),
            ''
          )}</tr>`;
        }
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
    setHtml(el, T('A legutóbbi tervhez ({0}) nem kell ásványt vagy reprocess-terméket venni.', LASTPLAN.title || ''));
    return;
  }
  setHtml(
    el,
    html`<p>Terv: <b>${LASTPLAN.title || ''}</b></p><div class="tablewrap"><table><thead><tr><th>Termék</th><th class="num">Hiány</th><th class="num">A beltből</th><th class="num">Fedezet</th></tr></thead><tbody>${need.map(
      ([t, q]) => {
        const b = LASTSCAN ? LASTSCAN.minerals.get(t) || 0 : null;
        return html`<tr><td>${NAMES[t] || t}</td><td class="num">${fmt(q)}</td><td class="num">${b == null ? '–' : fmt(b)}</td><td class="num">${b == null ? '–' : html`<span class="pill ${b >= q ? 'ok' : 'warn'}">${fmt(Math.min(100, (b / q) * 100))}%</span>`}</td></tr>`;
      }
    )}</tbody></table></div>`
  );
}
