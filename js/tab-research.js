/* IndyOps – Research & copy tab: ME/TE research and copying. */
'use strict';
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
