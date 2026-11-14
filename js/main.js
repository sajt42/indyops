/* IndyOps – Event wiring, backup/restore, bug report, start-up. */
'use strict';
/* ============ events ============ */
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  showTab(b.dataset.tab);
});
function showTab(t) {
  $$('#tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.tab === t));
  $$('main>section').forEach(s => (s.hidden = s.id !== 'tab-' + t));
  if (t === 'mine') renderMineNeed();
  if (t === 'repro') renderRepro();
  if (t === 'profit') fillOwnCats($('#prCat'));
  if (t === 'canbuild') fillOwnCats($('#cbCat'));
  if (t === 'inv') fillInvFilters();
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goto]');
  if (a) {
    e.preventDefault();
    showTab(a.dataset.goto);
  }
});
$('#saveClientId').onclick = () => {
  setSetting('clientId', $('#clientIdInput').value.trim());
};
$('#addChar').onclick = startLogin;
$('#cbSubmit').onclick = finishLogin;
$('#cbCancel').onclick = () => ($('#loginPaste').hidden = true);
$('#refreshAll').onclick = refreshAll;
$('#charList').addEventListener('click', e => {
  const r = e.target.closest('[data-ref]'),
    d = e.target.closest('[data-del]');
  if (e.target.closest('[data-relog]')) {
    startLogin();
    return;
  }
  if (r) {
    const c = CHARS.find(x => x.id == r.dataset.ref);
    c && refreshChar(c);
  }
  if (d) {
    removeChar(d.dataset.del);
    renderAll();
  }
});
['#bpFilter', '#bpKind', '#bpNotMax'].forEach(s => $(s).addEventListener('input', renderBPs));
$$('#bpTable th.sortable').forEach(th =>
  th.addEventListener('click', () => {
    const k = th.dataset.k;
    bpSort = bpSort.k === k ? { k, d: -bpSort.d } : { k, d: 1 };
    renderBPs();
  })
);
['#stFilter', '#stLoc', '#stOnlyPlan'].forEach(s => $(s).addEventListener('input', renderStock));
$('#planSearch').addEventListener('input', updateCopySelect);
$('#planGo').onclick = runPlan;
$('#optStockFree').addEventListener('change', () => LASTRENDER && LASTRENDER());
$('#pAdd').onclick = () => {
  const n = $('#pNew').value.trim();
  if (!n) {
    alertBox('Adj nevet a projektnek.');
    return;
  }
  createProject(n);
  $('#pNew').value = '';
  renderProjects();
};
$('#pList').addEventListener('click', e => {
  const sel = e.target.closest('[data-psel]'),
    up = e.target.closest('[data-pup]'),
    dn = e.target.closest('[data-pdown]');
  if (sel) {
    selectProject(Number(sel.dataset.psel));
    renderProjects();
  }
  if (up) {
    moveProject(Number(up.dataset.pup), -1);
    renderProjects();
  }
  if (dn) {
    moveProject(Number(dn.dataset.pdown), 1);
    renderProjects();
  }
});
$('#pList').addEventListener('change', e => {
  const c = e.target.closest('[data-pact]');
  if (c) {
    updateProject(Number(c.dataset.pact), p => (p.active = c.checked));
  }
});
$('#pAll').onclick = () => {
  const act = PROJ.filter(p => p.active);
  if (!act.length) {
    alertBox('Nincs aktív projekt. Pipáld be, melyik számítson.');
    return;
  }
  calcProjects(act);
};
$('#prGo').onclick = () =>
  runProfit().catch(e => {
    setHtml($('#prOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    status('kész');
  });
['#prOnlyPos', '#prMinVol'].forEach(x => $(x).addEventListener('input', () => PROFROWS.length && renderProfit()));
$('#ivGo').onclick = () =>
  runInvention().catch(e => {
    setHtml($('#ivOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    log(e.stack || e.message);
    status('kész');
  });
// invention filters: they narrow the list on screen at once (a wider one needs a new calculation)
fillInvDecs();
['#ivCat', '#ivName', '#ivDec'].forEach(x => $(x).addEventListener('input', () => INVROWS.length && renderInvention()));
$('#ivGoal').addEventListener('change', () => {
  const g = invGoal();
  SRT.inv = { f: g.f, d: g.d };
  if (INVROWS.length) renderInvention();
});
$('#rsGo').onclick = () =>
  runResearch().catch(e => {
    setHtml($('#rsOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    log(e.stack || e.message);
    status('kész');
  });
['#rsFilter', '#rsNotMax'].forEach(x => $(x).addEventListener('input', () => RESROWS.length && renderResearch()));
$('#slGo').onclick = async () => {
  try {
    await ensurePrices([...new Set(CHARS.flatMap(c => ((DATA[c.id] || {}).tx || []).map(x => x.t)))]);
    await runSales();
  } catch (e) {
    setHtml($('#slOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    status('kész');
  }
};
$('#cbGo').onclick = () =>
  runCanBuild().catch(e => {
    setHtml($('#cbOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    status('kész');
  });
$('#scanGo').onclick = () => runScan().catch(e => alertBox(e.message));
$('#locList').addEventListener('change', () => {
  setSetting(
    'locs',
    $$('#locList input[data-loc]')
      .filter(x => x.checked)
      .map(x => Number(x.dataset.loc))
  );
});
$('#locAll').onclick = () => {
  setSetting('locs', null);
};
$('#locNone').onclick = () => {
  setSetting('locs', []);
};
const bind = (sel, key, num) =>
  $(sel).addEventListener('change', e => {
    setSetting(key, num && e.target.value !== '' ? Number(e.target.value) : e.target.value);
  });
bind('#sStructME', 'structME', 1);
bind('#sStructRes', 'structRes', 1);
bind('#sStructTE', 'structTE', 1);
bind('#sFacTax', 'facTax', 1);
bind('#sScc', 'scc', 1);
bind('#sSalesTax', 'salesTax', 1);
bind('#sBroker', 'broker', 1);
bind('#sYieldBase', 'yieldBase', 1);
bind('#sImplant', 'implant', 1);
bind('#sSystem', 'system', 0);
bind('#sClientId', 'clientId', 0);
$('#sProdLoc').addEventListener('change', e => {
  setSetting('prodLoc', e.target.value);
});
$('#sWallet').addEventListener('change', e => {
  setSetting('wallet', e.target.checked);
});
$('#sParallel').addEventListener('change', e => {
  setSetting('parallel', e.target.checked);
});
$('#sParMode').addEventListener('change', e => {
  setSetting('parMode', e.target.value === 'speed' ? 'speed' : 'material');
});
$('#sMktJumps').addEventListener('change', e => {
  const v = Math.round(Number(e.target.value));
  setSetting('mktMaxJumps', v > 0 ? v : 10);
});
$('#sMktHs').addEventListener('change', e => {
  setSetting('mktHsOnly', e.target.checked);
});
$('#sMarket2').addEventListener('change', e => {
  setSetting('market2', e.target.value ? Number(e.target.value) : '');
});
/* ---- after the character data changed: calculate again what is on screen ----
 * Lists and the stock are drawn from the current data anyway (renderAll). Calculated results (plan or project, What
 * pays?, Invention, Research, Selling, Builds without buying, Reprocess, the mining scan) are run again, one after the
 * other, a moment after the last change (refreshing all characters changes the data several times).
 */
const DATA_RECALC = [
  ['plan', () => LASTPLAN && LASTRERUN, () => LASTRERUN()],
  ['profit', () => PROFROWS.length, () => runProfit()],
  ['invention', () => INVROWS.length, () => runInvention()],
  ['research', () => RESROWS.length, () => runResearch()],
  ['sales', () => SLROWS.length, () => runSales()],
  ['canbuild', () => CBROWS.length, () => runCanBuild()],
  ['reprocess', () => REP.rows, () => repLoad()],
  ['mining', () => LASTSCAN, () => runScan()]
];
let dataRecalcTimer = null,
  dataRecalcBusy = false;
async function recalcAfterData() {
  if (dataRecalcBusy) return void (dataRecalcTimer = setTimeout(recalcAfterData, 1500));
  dataRecalcBusy = true;
  try {
    for (const [name, has, run] of DATA_RECALC) {
      if (!has()) continue;
      try {
        await run();
      } catch (e) {
        log('Újraszámolás (' + name + '): ' + e.message);
      }
    }
  } finally {
    dataRecalcBusy = false;
  }
}
onCharData(() => {
  // new blueprints can bring new categories into the open tab's list
  if (!$('#tab-profit').hidden) fillOwnCats($('#prCat'));
  if (!$('#tab-canbuild').hidden) fillOwnCats($('#cbCat'));
  if (!$('#tab-inv').hidden) fillInvFilters();
  clearTimeout(dataRecalcTimer);
  dataRecalcTimer = setTimeout(recalcAfterData, DATA_RECALC_DELAY);
});
/* ---- what a setting change redraws ----
 * Every stored setting change ends up here (onSetting), so the handlers above only store the value. Settings the
 * calculation itself uses mark the open plan as out of date (a note with a recalculate button); the others redraw.
 */
const RECALC_SETTINGS = {
  structME: 'struktúra ME bónusz',
  buyOverride: 'gyártom / veszem',
  leave: 'otthagyott készlet',
  parallel: 'párhuzamos gyártás',
  parMode: 'párhuzamos gyártás',
  locs: 'készlet helyszínei',
  srcShips: 'hajók a nyersanyag-forrásokban',
  system: 'gyártási rendszer'
};
// the timeline's own settings redraw only the timeline (bindTimeline)
const QUIET_SETTINGS = new Set([
  'lang',
  'mktRegions',
  'mktMaxJumps',
  'mktHsOnly',
  'tlStart',
  'tlActive',
  'tlBuyLead',
  'slotRes'
]);
onSetting(key => {
  if (QUIET_SETTINGS.has(key)) return;
  if (key === 'market2') return refreshMarket2();
  if (LASTPLAN && (key === '*' || RECALC_SETTINGS[key])) {
    LASTPLAN.stale = LASTPLAN.stale || new Set();
    LASTPLAN.stale.add(key === '*' ? T('visszatöltött beállítások') : T(RECALC_SETTINGS[key]));
  }
  if (['*', 'clientId', 'locNames', 'workChars', 'wallet', 'locs'].includes(key)) renderAll();
  else renderSettings();
  redrawSellerBoxes();
  try {
    LASTRENDER && LASTRENDER();
  } catch (e) {
    console.error(e);
  }
});
// After the second market changed: load its owner (broker fee standing) and its prices for what is on screen,
// then redraw every result that shows second-market columns.
async function refreshMarket2() {
  renderSettings();
  status(T('Második piac: {0}…', S.market2 ? m2Short() : T('nincs')));
  const types = new Set(SLROWS.map(r => r.o.t));
  if (LASTPLAN) LASTPLAN.trees.forEach(x => collectTypes(x.tree, types));
  for (const r of INVROWS) if (r.prod) types.add(r.prod);
  try {
    if (m2On()) await ensureOwners([JITA_STATION, Number(S.market2)]);
    if (types.size) await ensurePrices([...types]);
  } catch (e) {
    log('Második piac: ' + e.message);
  }
  try {
    LASTRENDER && LASTRENDER();
  } catch (e) {}
  if (SLROWS.length) renderSales();
  for (const k of Object.keys(PGR)) {
    try {
      PGR[k]();
    } catch (e) {}
  }
  if (typeof REP !== 'undefined' && REP.rows) renderRepro();
  status(T('Második piac: {0}', S.market2 ? m2Short() : T('nincs')));
}
$('#sWorkChars').addEventListener('change', e => {
  const ids = $$('#sWorkChars input[data-wc]')
    .filter(x => x.checked)
    .map(x => Number(x.dataset.wc));
  const all = CHARS.filter(c => DATA[c.id]).length;
  setSetting('workChars', ids.length && ids.length < all ? ids : null);
});
$('#clearPrices').onclick = () => {
  PRICES = { at: 0, p: {} };
  store('prices', PRICES);
  status('árak törölve');
};
$('#clearRef').onclick = () => {
  REFC = { t: {}, b: {}, v3: 1 };
  BPPROD = {};
  store('ref', REFC);
  status('receptek törölve');
};
$('#clearAllBtn').onclick = () => ($('#clearConfirm').hidden = false);
$('#clearNo').onclick = () => ($('#clearConfirm').hidden = true);
$('#clearYes').onclick = () => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(SP) || k.startsWith('gyp.'))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  location.reload();
};

/* ---- backup / restore ---- */
$('#expTokens').addEventListener('change', e => ($('#expWarn').hidden = !e.target.checked));
function makeBackup(withTok) {
  return {
    app: 'indyops',
    version: APP.version,
    v: 1,
    at: new Date().toISOString(),
    settings: S,
    projects: PROJ,
    selp: SELP,
    chars: withTok ? CHARS : CHARS.map(c => ({ id: c.id, name: c.name })),
    withTokens: withTok
  };
}
$('#expBtn').onclick = () => {
  const withTok = $('#expTokens').checked;
  const data = makeBackup(withTok);
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'indyops-backup-' + new Date().toISOString().slice(0, 10) + (withTok ? '-with-logins' : '') + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
  status('mentés letöltve');
};
// backup validation per field: a known setting passes only with the expected type, unknown fields are dropped;
// never throws on bad input, and applies nothing when there is an error
function validSettings(d, out, err) {
  if (d.settings != null && !isObj(d.settings)) err.push(T('a beállítások nem objektum'));
  else
    for (const [k, v] of Object.entries(d.settings || {})) {
      const t = SET_SCHEMA[k];
      if (!t) continue;
      if (SET_TYPES[t](v)) out.settings[k] = v;
      else err.push(T('hibás beállítás: {0}', k));
    }
}
// material sources of a project or item: {mode:'all'|'sel', locs, conts, excl} with numeric id lists
const validSrc = x =>
  x == null ||
  (isObj(x) &&
    (x.mode === 'all' || x.mode === 'sel') &&
    ['locs', 'conts', 'excl'].every(f => x[f] == null || (Array.isArray(x[f]) && x[f].every(isNum))));
const cleanSrc = x =>
  x
    ? { mode: x.mode, locs: (x.locs || []).slice(), conts: (x.conts || []).slice(), excl: (x.excl || []).slice() }
    : undefined;
function validProjects(d, out, err) {
  if (d.projects != null && !Array.isArray(d.projects)) err.push(T('a projektek nem lista'));
  for (const [i, p] of (Array.isArray(d.projects) ? d.projects : []).entries()) {
    if (!isObj(p) || !isNum(p.id) || typeof p.name !== 'string' || !Array.isArray(p.items)) {
      err.push(T('{0}. projekt hibás', i + 1));
      continue;
    }
    if (!validSrc(p.src)) {
      err.push(T('„{0}” projekt: hibás nyersanyag-forrás', p.name));
      continue;
    }
    const items = [];
    let bad = 0;
    for (const it of p.items) {
      if (
        !isObj(it) ||
        !isNum(it.runs) ||
        !(it.runs > 0) ||
        !(isNum(it.bpType) || isNum(it.invT1)) ||
        !validSrc(it.src)
      ) {
        bad++;
        continue;
      }
      const c = { runs: it.runs };
      if (isNum(it.bpType)) {
        c.bpType = it.bpType;
        // the blueprint (item id) the player picked to use first
        if (/^\d+$/.test(String(it.prefer ?? ''))) c.prefer = String(it.prefer);
      } else {
        c.invT1 = it.invT1;
        if (isNum(it.t2)) c.t2 = it.t2;
        c.dec = isNum(it.dec) ? it.dec : null;
        c.pi = isNum(it.pi) ? it.pi : 0;
      }
      if (it.src) c.src = cleanSrc(it.src);
      items.push(c);
    }
    if (bad) err.push(T('„{0}” projekt: {1} hibás tétel', p.name, bad));
    const q = { id: p.id, name: p.name, active: p.active !== false, items, src: cleanSrc(p.src) };
    if (['off', 'material', 'speed'].includes(p.par)) q.par = p.par;
    out.projects.push(q);
  }
}
function validChars(d, out, err) {
  if (d.chars != null && !Array.isArray(d.chars)) err.push(T('hibás karakter-bejegyzés'));
  for (const c of Array.isArray(d.chars) ? d.chars : []) {
    if (!isObj(c) || !isNum(c.id) || typeof c.name !== 'string') {
      err.push(T('hibás karakter-bejegyzés'));
      continue;
    }
    out.chars.push({
      id: c.id,
      name: c.name,
      refresh: typeof c.refresh === 'string' ? c.refresh : undefined,
      cid: typeof c.cid === 'string' ? c.cid : undefined,
      scp: Array.isArray(c.scp) ? c.scp.filter(x => typeof x === 'string') : undefined
    });
  }
}
function validateBackup(d) {
  const err = [];
  const out = { settings: {}, projects: [], chars: [], selp: null };
  try {
    out.app = d.app;
    out.at = d.at;
    out.withTokens = !!d.withTokens;
    validSettings(d, out, err);
    validProjects(d, out, err);
    out.selp = isNum(d.selp) ? d.selp : null;
    validChars(d, out, err);
  } catch (e) {
    err.push(T('váratlan hiba: {0}', e.message));
  }
  return { err, d: out };
}
$('#impFile').addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    let d;
    try {
      d = JSON.parse(rd.result);
    } catch (x) {
      alertBox('Ez nem egy IndyOps mentésfájl (nem olvasható JSON).');
      return;
    }
    if (!d || (d.app !== 'indyops' && d.app !== 'gyartopult')) {
      alertBox('Ez nem egy IndyOps mentésfájl.');
      return;
    }
    const v = validateBackup(d);
    if (v.err.length) {
      alertBox(T('A mentésfájl hibás, nem töltöttem vissza: {0}', v.err.slice(0, 5).join('; ')));
      e.target.value = '';
      return;
    }
    d = v.d;
    const box = $('#impConfirm');
    box.hidden = false;
    setHtml(
      box,
      html`<p>Mentés dátuma: <b>${new Date(d.at).toLocaleString(LOC())}</b> · ${(d.projects || []).length} projekt · ${(d.chars || []).length} karakter${d.withTokens ? ' (bejelentkezésekkel)' : ' (bejelentkezések nélkül)'}.</p><p>A visszatöltés felülírja a mostani beállításokat és projekteket.${d.withTokens ? ' A karakterek bejelentkezései is visszaállnak.' : ' A karaktereket utána újra be kell jelentkeztetni, ha ebben a böngészőben még nincsenek.'}</p><div class="row"><button class="btn primary" id="impYes">Visszatöltés</button><button class="btn" id="impNo">Mégse</button></div>`
    );
    $('#impNo').onclick = () => {
      box.hidden = true;
      e.target.value = '';
    };
    $('#impYes').onclick = () => {
      replaceSettings(d.settings || {});
      replaceProjects(d.projects || [], d.selp);
      if (d.withTokens && Array.isArray(d.chars)) {
        for (const c of d.chars) if (c.refresh) putChar(c);
      }
      box.hidden = true;
      e.target.value = '';
      renderAll();
      status('visszatöltve');
    };
  };
  rd.readAsText(f);
});

setHtml(
  $('#langSel'),
  hjoin(
    Object.entries(LANGS).map(
      ([k, v]) => html`<option value="${k}" ${k === LANG ? 'selected' : ''}>${v.name}</option>`
    ),
    ''
  )
);
$('#langSel').addEventListener('change', e => setLang(e.target.value));
$('#appVer').textContent = 'v' + APP.version;
$('#hdrVer').textContent = 'v' + APP.version;
$('#hdrVer').title = APP.built;
$('#srcLink').href = 'https://github.com/' + APP.repo;
$('#cidNote').hidden = !HOSTED;
$('#bugBtn').addEventListener('click', () => {
  const logTxt = ($('#log').textContent || '').split('\n').slice(0, 30).join('\n').slice(0, 2500);
  const tab = ((document.querySelector('#tabs button[aria-selected="true"]') || {}).dataset || {}).tab || '';
  const body =
    T('**Mi történt?**') +
    '\n\n\n' +
    T('**Mit vártál helyette?**') +
    '\n\n\n---\n' +
    APP.name +
    ' v' +
    APP.version +
    ' (' +
    APP.built +
    ') · ' +
    LANG +
    ' · ' +
    (HOSTED ? 'web' : 'local') +
    ' · tab: ' +
    tab +
    '\n' +
    navigator.userAgent +
    '\n\n' +
    T('Napló (a jelentés nyilvános: küldés előtt töröld belőle, amit nem szeretnél megosztani):') +
    '\n```\n' +
    logTxt +
    '\n```\n';
  $('#bugBtn').href =
    'https://github.com/' + APP.repo + '/issues/new?' + new URLSearchParams({ title: '[bug] ', body }).toString();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.locname) {
    setSettingIn('locNames', t.dataset.locname, t.value.trim() || null);
  }
});
$('#unkEveref').addEventListener('click', async e => {
  e.target.disabled = true;
  const n = await everefLocs(true);
  e.target.disabled = false;
  status(
    n
      ? T('EVE Ref: {0} ismeretlen hely neve meglett.', n)
      : T('EVE Ref: nem találtam az ismeretlen helyeket (valószínűleg privát struktúrák).')
  );
});
renderAll();
updateHelpLang();
startI18n();
handleRedirect();
everefLocs(false);
loadMarketOwners();
