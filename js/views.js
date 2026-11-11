/* IndyOps – Rendering: characters, blueprints, stock, settings, plan results, hauling. */
'use strict';
/* ============ paging and sorting (shared) ============ */
const PG = {},
  PGR = {},
  SRT = {};
// rows: the whole (filtered) list; sig: signature of the filters (a change goes back to page 1); render: redraw function
function pageOf(key, rows, sig, render) {
  const s = PG[key] || (PG[key] = { p: 0, n: 100, sig });
  if (s.sig !== sig) {
    s.sig = sig;
    s.p = 0;
  }
  PGR[key] = render;
  const n = s.n || rows.length || 1;
  const pages = Math.max(1, Math.ceil(rows.length / n));
  if (s.p >= pages) s.p = pages - 1;
  const a = s.p * n,
    b = Math.min(rows.length, a + n);
  return { rows: rows.slice(a, b), html: pagerHtml(key, rows.length, pages, s, a, b) };
}
function pagerHtml(key, total, pages, s, a, b) {
  if (total <= 25) return '';
  const sizes = [25, 50, 100, 250, 500, 0];
  return html`<div class="pager" data-noi18n><button class="btn mini" data-pg="${key}|first" ${s.p ? '' : 'disabled'} aria-label="${T('Első oldal')}">«</button><button class="btn mini" data-pg="${key}|prev" ${s.p ? '' : 'disabled'} aria-label="${T('Előző oldal')}">‹</button>
  <span class="small">${fmt(a + 1)}–${fmt(b)} / ${fmt(total)}</span>
  <button class="btn mini" data-pg="${key}|next" ${s.p < pages - 1 ? '' : 'disabled'} aria-label="${T('Következő oldal')}">›</button><button class="btn mini" data-pg="${key}|last" ${s.p < pages - 1 ? '' : 'disabled'} aria-label="${T('Utolsó oldal')}">»</button>
  <label class="small">${T('Soronként')} <select data-pgn="${key}">${sizes.map(z => html`<option value="${z}" ${s.n === z ? 'selected' : ''}>${z || T('mind')}</option>`)}</select></label></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pg]');
  if (!b) return;
  const [k, act] = b.dataset.pg.split('|');
  const s = PG[k];
  if (!s) return;
  if (act === 'first') s.p = 0;
  else if (act === 'prev') s.p = Math.max(0, s.p - 1);
  else if (act === 'next') s.p++;
  else if (act === 'last') s.p = 1e9;
  PGR[k] && PGR[k]();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (!t.dataset || t.dataset.pgn == null) return;
  const k = t.dataset.pgn;
  const s = PG[k];
  if (!s) return;
  s.n = Number(t.value);
  s.p = 0;
  PGR[k] && PGR[k]();
});
// sortable header: sortTh(key, field, label, numeric?); sortRows(key, rows, getter)
function sortTh(key, f, label, num, dflt) {
  const s = SRT[key] || (SRT[key] = dflt || { f, d: num ? -1 : 1 });
  const on = s.f === f;
  return html`<th class="${num ? 'num ' : ''}sortable" data-srt="${key}|${f}|${num ? 1 : 0}" aria-sort="${on ? (s.d > 0 ? 'ascending' : 'descending') : 'none'}">${label}${on ? (s.d > 0 ? ' ▲' : ' ▼') : ''}</th>`;
}
function sortRows(key, rows, get) {
  const s = SRT[key];
  if (!s) return rows;
  return rows.sort((a, b) => {
    const va = get(a, s.f),
      vb = get(b, s.f);
    return (
      (typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va ?? '').localeCompare(String(vb ?? ''), LOC())) * s.d
    );
  });
}
document.addEventListener('click', e => {
  const th = e.target.closest('[data-srt]');
  if (!th) return;
  const [k, f, num] = th.dataset.srt.split('|');
  const s = SRT[k] || {};
  SRT[k] = s.f === f ? { f, d: -s.d } : { f, d: num === '1' ? -1 : 1 };
  if (PG[k]) PG[k].p = 0;
  PGR[k] && PGR[k]();
});

/* ============ RENDER ============ */
function renderDataNote() {
  const el = document.getElementById('dvNote');
  if (!el) return;
  const old = CHARS.filter(c => DATA[c.id] && (DATA[c.id].dv || 1) < APP.dataVersion);
  setHtml(
    el,
    old.length
      ? html`<div class="notice" style="margin:12px 0"><p>${T('Az IndyOps frissült (v{0}). Ehhez a verzióhoz újra le kell tölteni a karakterek adatait: {1}.', APP.version, old.map(c => c.name).join(', '))} <button class="btn primary" id="dvRefresh">${T('Minden adat frissítése')}</button> <a href="https://github.com/${APP.repo}/blob/main/CHANGELOG.md" target="_blank" rel="noopener">${T('Mi változott?')}</a></p></div>`
      : ''
  );
  const b = document.getElementById('dvRefresh');
  if (b)
    b.onclick = async () => {
      b.disabled = true;
      await refreshAll();
    };
}
function renderAll() {
  renderDataNote();
  renderProjects();
  renderChars();
  renderJobs();
  renderBPs();
  renderStock();
  renderLocList();
  renderPlanOptions();
  renderSettings();
  renderUnknownLocs();
}
function alertBox(msg) {
  const d = document.createElement('div');
  d.className = 'notice err';
  setHtml(d, html`<p>${msg}</p>`);
  const host = document.querySelector('section:not([hidden])') || document.body;
  host.prepend(d);
  setTimeout(() => d.remove(), 12000);
}
function renderChars() {
  $('#setupBox').hidden = !!clientId();
  {
    const ib = document.getElementById('introBox');
    if (ib) ib.hidden = CHARS.length > 0;
  }
  $('#cbUrl').textContent = callbackUrl();
  $('#scopeList').textContent = scopesNeeded().join(' ');
  $('#noChars').hidden = CHARS.length > 0;
  setHtml(
    $('#charList'),
    hjoin(
      CHARS.map(c => {
        const d = DATA[c.id];
        return html`<div class="card char"><img alt="" src="https://images.evetech.net/characters/${c.id}/portrait?size=64"><div style="flex:1;min-width:0"><div class="nm">${c.name}</div><div class="small muted">${d ? T('{0} tárgy · {1} BP · frissítve {2}', fmt(d.assets.length), fmt(d.bps.length), new Date(d.at).toLocaleString(LOC())) : T('még nincs letöltve')}</div>${(() => {
          if (!c.scp) return '';
          const miss = scopesNeeded().filter(x => !c.scp.includes(x));
          return miss.length
            ? html`<div class="notice" style="margin:6px 0 0"><p class="small">${HOSTED ? html`${T('Új funkciókhoz új engedély kell ehhez a karakterhez. Nyomd meg az „Újra bejelentkezés” gombot.')} <code>${hjoin(miss, ' ')}</code>` : html`Új engedély kell ehhez a karakterhez: <code>${hjoin(miss, ' ')}</code>. Előbb add hozzá az alkalmazásodhoz a developers.eveonline.com-on, aztán jelentkezz be újra ezzel a karakterrel.`}</p></div>`
            : '';
        })()}<div class="row" style="margin-top:6px"><button class="btn" data-ref="${c.id}">Frissítés</button><button class="btn" data-relog="${c.id}">Újra bejelentkezés</button><button class="btn" data-del="${c.id}">Eltávolítás</button></div></div></div>`;
      }),
      ''
    )
  );
}
function renderJobs() {
  const rows = [];
  const acts = {
    1: 'Gyártás',
    3: 'TE kutatás',
    4: 'ME kutatás',
    5: 'Másolás',
    8: 'Invention',
    9: 'Reakció',
    11: 'Reakció'
  };
  for (const [cid, d] of charEntries()) {
    for (const j of d.jobs) rows.push({ cid, j });
  }
  rows.sort((a, b) => a.j.end.localeCompare(b.j.end));
  setHtml(
    $('#jobsTable tbody'),
    rows.length
      ? hjoin(
          rows.map(
            ({ cid, j }) =>
              html`<tr><td>${charName(cid)}</td><td>${acts[j.act] || j.act}</td><td>${NAMES[j.bp] || j.bp}</td><td class="num">${j.runs}</td><td>${locName(j.loc)}</td><td class="mono">${new Date(j.end) < new Date() ? html`<span class="pill ok">kész, átvehető</span>` : new Date(j.end).toLocaleString(LOC())}</td></tr>`
          ),
          ''
        )
      : html`<tr><td colspan="6" class="muted">Nincs futó job.</td></tr>`
  );
}
let bpSort = { k: 'name', d: 1 };
function renderBPs() {
  const f = $('#bpFilter').value.toLowerCase(),
    kind = $('#bpKind').value,
    nm = $('#bpNotMax').checked;
  let list = allBPs().map(b => ({
    b,
    name: NAMES[b.t] || '#' + b.t,
    char: charName(b.cid),
    loc: locName(b.l) + (b.cn ? ' › ' + b.cn : ''),
    me: b.me,
    te: b.te,
    runs: b.r
  }));
  list = list.filter(
    x =>
      (!f || x.name.toLowerCase().includes(f) || x.loc.toLowerCase().includes(f)) &&
      (!kind || (kind === 'bpo') === (x.b.r === -1)) &&
      (!nm || (x.b.r === -1 && (x.me < 10 || x.te < 20)))
  );
  list.sort((a, b) => {
    const k = bpSort.k;
    const va = a[k],
      vb = b[k];
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'hu')) * bpSort.d;
  });
  const pg = pageOf('bp', list, [f, kind, nm, bpSort.k, bpSort.d].join('|'), renderBPs);
  setHtml($('#bpPg1'), pg.html);
  setHtml($('#bpPg2'), pg.html);
  setHtml(
    $('#bpTable tbody'),
    hjoin(
      pg.rows.map(x => {
        const j = inJob(x.b.i);
        const max = x.b.r === -1 && x.me >= 10 && x.te >= 20;
        return html`<tr><td>${x.name}</td><td><span class="pill ${x.b.r === -1 ? 'bpo' : 'bpc'}">${x.b.r === -1 ? 'BPO' : 'BPC'}</span></td><td class="num">${x.me}</td><td class="num">${x.te}</td><td class="num">${x.b.r === -1 ? '∞' : x.b.r}${x.b.adj ? html`<span title="${T('Az ESI még a job leadása előtti állapotot mutatja ({0} runnal többet). Ezt itt már javítottam; az ESI következő frissítése után a * eltűnik.', x.b.adj)}">*</span>` : ''}${x.b.r === 0 ? html` <span class="pill warn">${T('elfogyott')}</span>` : ''}</td><td>${x.char}</td><td class="small">${x.loc}</td><td>${j ? html`<span class="pill warn">jobban</span> ` : ''}${x.b.r === -1 ? (max ? html`<span class="pill ok">max</span>` : html`<span class="pill warn">kutatható</span>`) : ''}</td></tr>`;
      }),
      ''
    ) ||
      html`<tr><td colspan="8" class="muted">Nincs találat. Ha még nem frissítettél, a Karakterek fülön tedd meg.</td></tr>`
  );
  const ats = charEntries()
      .map(([, d]) => d.bpAt)
      .filter(Boolean),
    exps = charEntries()
      .map(([, d]) => d.bpExp)
      .filter(Boolean);
  const tf = v => {
    const d = new Date(v);
    const today = d.toDateString() === new Date().toDateString();
    return (
      (today ? '' : d.toLocaleDateString(LOC(), { month: '2-digit', day: '2-digit' }) + ' ') +
      d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' })
    );
  };
  const per = CHARS.filter(c => DATA[c.id] && DATA[c.id].bpAt)
    .map(c => c.name + ' ' + tf(DATA[c.id].bpAt))
    .join(', ');
  $('#bpCount').textContent =
    T('{0} blueprint', list.length) +
    (ats.length
      ? ' · ' +
        T(
          'ESI állapot: {0}, legközelebb {1} után frissül. A *: az ESI még nem tud egy gyártásról (fut, vagy a leadás az ESI állapota után történt), ezért a runokat itt javítottam. Az ESI frissülése után eltűnik.',
          per,
          tf(Math.max(...exps))
        )
      : '');
}
function renderStock() {
  const f = $('#stFilter').value.toLowerCase(),
    lf = $('#stLoc').value,
    only = $('#stOnlyPlan').checked;
  const sm = stockMap(only);
  let rows = [];
  for (const [t, arr] of sm) {
    const name = NAMES[t] || '#' + t;
    if (f && !name.toLowerCase().includes(f)) continue;
    const a = lf ? arr.filter(x => String(x.l) === lf) : arr;
    const tot = a.reduce((s, x) => s + x.q, 0);
    if (!tot) continue;
    rows.push({ t, name, tot, a });
  }
  if (!SRT.st) SRT.st = { f: 'name', d: 1 };
  sortRows('st', rows, (r, f) => (f === 'name' ? r.name : f === 'tot' ? r.tot : r.a.length));
  setHtml(
    $('#stHead'),
    html`${sortTh('st', 'name', T('Tárgy'))}${sortTh('st', 'tot', T('Összesen'), 1)}${sortTh('st', 'where', T('Hol'), 1)}`
  );
  const pg = pageOf('st', rows, [f, lf, only].join('|'), renderStock);
  const shown = pg.rows;
  setHtml($('#stPg1'), pg.html);
  setHtml($('#stPg2'), pg.html);
  setHtml(
    $('#stTable tbody'),
    hjoin(
      shown.map(
        r =>
          html`<tr><td>${r.name}</td><td class="num">${fmt(r.tot)}</td><td class="small">${hjoin(
            r.a.map(x => html`${charName(x.cid)} · ${locName(x.l)}: <span class="mono">${fmt(x.q)}</span>`),
            html`<br>`
          )}</td></tr>`
      ),
      ''
    ) || html`<tr><td colspan="3" class="muted">Nincs adat.</td></tr>`
  );
  $('#stCount').textContent = T('{0} tételtípus', fmt(rows.length));
  const sel = $('#stLoc'),
    cur = sel.value;
  setHtml(
    sel,
    html`<option value="">minden hely</option>${allLocs()
      .sort((a, b) => locName(a).localeCompare(locName(b)))
      .map(l => html`<option value="${l}">${locName(l)}</option>`)}`
  );
  sel.value = cur;
}
function renderLocList() {
  const ls = allLocs();
  if (!ls.length) return;
  const sel = planLocs();
  setHtml(
    $('#locList'),
    hjoin(
      ls
        .sort((a, b) => locName(a).localeCompare(locName(b)))
        .map(
          l =>
            html`<label class="inline"><input type="checkbox" data-loc="${l}" ${sel.has(l) ? 'checked' : ''}> ${locName(l)}</label>`
        ),
      ''
    )
  );
}
function renderSettings() {
  $('#sStructME').value = S.structME;
  $('#sWallet').checked = !!S.wallet;
  $('#sStructRes').value = S.structRes || 0;
  $('#sStructTE').value = S.structTE;
  $('#sFacTax').value = S.facTax;
  $('#sScc').value = S.scc;
  $('#sSalesTax').value = S.salesTax;
  $('#sBroker').value = S.broker;
  $('#sYieldBase').value = S.yieldBase;
  $('#sImplant').value = S.implant;
  $('#sSystem').value = S.system;
  $('#sClientId').value = S.clientId;
  $('#sSalesTax').placeholder = fmt(salesTax() * 100, 2);
  $('#sBroker').placeholder = fmt(brokerFee() * 100, 2);
  {
    const sel = $('#sProdLoc');
    setHtml(
      sel,
      html`<option value="">automatikus: a BP helye</option>${allLocs()
        .sort((a, b) => locName(a).localeCompare(locName(b)))
        .map(l => html`<option value="${l}">${locName(l)}</option>`)}`
    );
    sel.value = S.prodLoc || '';
  }
  {
    const sel = $('#sMarket2');
    const hubs = HUBS.filter(h => h[0] !== JITA_STATION);
    const own = allLocs()
      .filter(l => locKind(l) === 'npc' && l !== JITA_STATION && !hubs.some(h => h[0] === l))
      .sort((a, b) => locName(a).localeCompare(locName(b)));
    setHtml(
      sel,
      html`<option value="">nincs</option><optgroup label="${T('Kereskedelmi központok')}">${hubs.map(h => html`<option value="${h[0]}">${h[2]}</option>`)}</optgroup>${
        own.length
          ? html`<optgroup label="${T('Állomások, ahol van cuccod')}">${own.map(l => html`<option value="${l}">${locName(l)}</option>`)}</optgroup>`
          : ''
      }${(() => {
        const st = allLocs()
          .filter(l => locKind(l) === 'struct')
          .sort((a, b) => locName(a).localeCompare(locName(b)));
        return st.length
          ? html`<optgroup label="${T('Struktúrák, ahol van cuccod')}">${st.map(l => html`<option value="${l}">${locName(l)}</option>`)}</optgroup>`
          : '';
      })()}`
    );
    sel.value = S.market2 || '';
    $('#sMktJumps').value = Number(S.mktMaxJumps) > 0 ? S.mktMaxJumps : 10;
    $('#sMktHs').checked = S.mktHsOnly !== false;
    renderMktSettings();
    $('#sParallel').checked = !!S.parallel;
    $('#sParMode').value = S.parMode === 'speed' ? 'speed' : 'material';
    $('#sParMode').disabled = !S.parallel;
    const mb = $('#sM2Broker');
    if (mb) {
      const l = Number(S.market2);
      setHtml(
        mb,
        S.market2 && locKind(l) === 'struct'
          ? html`<label class="small">${T('{0} broker fee (a tulaj állítja), %', m2Short())} <input type="number" step="0.1" min="0" max="100" style="width:80px" data-sbroker="${l}" value="${structBrokerOf(l) ?? ''}" placeholder="?"></label> <span class="small muted">${T('+ 0,5% SCC pótdíj. A játékban egy eladási order feladásakor látod. Skillek és standing itt nem számítanak.')}</span>`
          : ''
      );
    }
  }
  {
    const w = workChars();
    const cs = CHARS.filter(c => DATA[c.id]);
    setHtml(
      $('#sWorkChars'),
      cs.length
        ? hjoin(
            cs.map(
              c =>
                html`<label class="inline"><input type="checkbox" data-wc="${c.id}" ${w.includes(c.id) ? 'checked' : ''}> ${c.name}</label>`
            ),
            ''
          )
        : html`<span class="muted small">${T('Még nincs karakter.')}</span>`
    );
  }
}
function renderPlanOptions() {
  const names = [
    ...new Set(
      allBPs()
        .map(b => NAMES[b.t])
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, 'hu'));
  setHtml(
    $('#bpOptions'),
    hjoin(
      names.map(n => html`<option value="${n}">`),
      ''
    )
  );
  updateCopySelect();
}
function updateCopySelect() {
  const n = $('#planSearch').value.trim();
  const list = allBPs()
    .filter(b => NAMES[b.t] === n)
    .sort((a, b) => (b.r === -1) - (a.r === -1) || b.me - a.me);
  setHtml(
    $('#planCopy'),
    hjoin(
      list.map(b => {
        const j = inJob(b.i);
        return html`<option value="${b.i}">${b.r === -1 ? 'BPO' : 'BPC ' + b.r + ' run'} · ME${b.me} TE${b.te} · ${charName(b.cid)} · ${locName(b.l)}${j ? ' · ' + T('jobban') : ''}</option>`;
      }),
      ''
    ) || html`<option value="">nincs ilyen saját BP</option>`
  );
}

/* ---- plan display ---- */
let LASTPLAN = null,
  LASTRENDER = null,
  LASTRERUN = null; // calculates the plan on screen again (after the character data changed)
function getOpt() {
  return {
    buildOwn: $('#optBuildOwn').checked,
    useStock: $('#optUseStock').checked,
    ore: $('#optOre').checked,
    incoming: $('#optIncoming').checked,
    leave: true // honours the stock places left out of the haul plan (S.leave)
  };
}
function copiesOf(bpType) {
  return allBPs()
    .filter(b => b.t === bpType)
    .sort((a, b) => (b.r === -1) - (a.r === -1) || b.me - a.me || b.te - a.te);
}
// A project item's copies with the one the player picked (it.prefer = the blueprint's item id) first: the plan
// uses it first and the others only when its runs run out. Without a pick, or when the pick is gone: best first.
function itemCopies(it) {
  const cp = copiesOf(it.bpType);
  const i = it.prefer != null ? cp.findIndex(c => String(c.i) === String(it.prefer)) : -1;
  return i > 0 ? [cp[i]].concat(cp.filter((_, k) => k !== i)) : cp;
}
const bpLabel = c =>
  (c.r === -1 ? 'BPO' : 'BPC ' + c.r + ' run') +
  ' · ME' +
  c.me +
  ' TE' +
  c.te +
  ' · ' +
  charName(c.cid) +
  ' · ' +
  shortLoc(c.l);
async function finishResult(R, firstBP) {
  const types = new Set();
  R.trees.forEach(x => collectTypes(x.tree, types));
  await resolveNames([...types]);
  await ensurePrices([...types]);
  await Promise.all([...types].map(t => refGet('t', t).catch(() => null)));
  await resolveNames(R.jobs.flatMap(j => j.miss.map(m => m[0])));
  R.sys = firstBP ? await sysFor(firstBP) : null;
  // order: first the final character/BP assignment, then systems and hauling
  assignChars(R.jobs);
  await assignJobSys(R.jobs);
  await resolveNames([...new Set(R.jobs.map(j => jobSysOf(j, R.sys)).filter(Boolean))]);
  // purchase sources picked from the market search need their current orders
  const picked = [...R.buyList.keys()].filter(t => S.buySrc && S.buySrc[t]);
  if (picked.length) {
    try {
      await loadMarket(picked);
      for (const t of picked) await resolveLoc(S.buySrc[t], CHARS[0]);
    } catch (e) {
      log('Piackereső: ' + e.message);
    }
  }
  try {
    await prepHaul(R);
  } catch (e) {
    log('Szállítás előkészítés: ' + e.message);
  }
  return R;
}
async function runPlan() {
  const itemId = Number($('#planCopy').value);
  const bp = allBPs().find(b => b.i === itemId);
  if (!bp) {
    alertBox('Válassz egy saját blueprintet a listából.');
    return;
  }
  const runs = Math.max(1, Number($('#planRuns').value) || 1);
  setHtml($('#planOut'), html`<div class="card muted">Számolás…</div>`);
  try {
    await indexBPProducts();
    if (!BPPROD[bp.t]) {
      setHtml($('#planOut'), html`<div class="card">Ennek a blueprintnek nincs gyártási vagy reakció receptje.</div>`);
      return;
    }
    await prefetchTree(BPPROD[bp.t].prod);
    // the selected copy first, then the other copies of the same BP (when the runs do not fit on one BPC)
    const copies = [bp].concat(copiesOf(bp.t).filter(c => c.i !== bp.i));
    const R = await makeMulti([{ copies, runs, label: '' }], getOpt());
    await finishResult(R, bp);
    R.title = fmt(R.trees[0].made) + ' × ' + (NAMES[R.trees[0].tree.t] || '');
    LASTPLAN = R;
    LASTRENDER = () => showResult($('#planOut'), R, runPlan);
    LASTRERUN = runPlan;
    LASTRENDER();
    renderMineNeed();
  } catch (e) {
    setHtml($('#planOut'), html`<div class="notice err"><p>${e.message}</p></div>`);
    log(e.stack || e.message);
  }
}
function assignChars(jobs) {
  // who does it: by skills, time and free slots, LPT scheduling
  const cs = workChars();
  if (!cs.length) return;
  const load = {},
    cnt = {};
  cs.forEach(c => {
    load[c] = { m: 0, r: 0, s: 0 };
    cnt[c] = { m: 0, r: 0, s: 0 };
  });
  const free = (c, k) => {
    const sl = slotsOf(c),
      bz = busyOf(c);
    return Math.max(1, sl[k] - bz[k]);
  };
  const tFor = (j, c) => {
    const o = j.who;
    j.who = c;
    const t = jobTime(j);
    j.who = o;
    return t;
  };
  jobs.forEach(j => {
    if (j.bp0) j.bp = j.bp0;
    else j.bp0 = j.bp;
    j.who = null;
  });
  // a blueprint item runs one job at a time: a job may move to another character's copy only if no other job uses it
  const taken = new Set(jobs.map(j => j.bp.i).filter(i => i != null));
  const order = jobs.slice().sort((a, b) => tFor(b, b.bp.cid) - tFor(a, a.bp.cid));
  for (const j of order) {
    const rec = j.rs ? { rs: j.rs } : recOf(j.bp.t);
    const k = slotKey(j.act);
    let cand = cs.filter(c => !missingSkills(c, rec).length);
    const noone = !cand.length;
    if (noone) cand = cs;
    let best = null,
      bv = Infinity;
    const own = c => {
      if (j.bp.virtual) return j.bp;
      if (c === j.bp.cid) return j.bp;
      return allBPs().find(
        b => b.cid === c && b.t === j.bp.t && b.me >= j.bp.me && (b.r === -1 || b.r >= j.runs) && !taken.has(b.i)
      );
    };
    for (const c of cand) {
      const v =
        (load[c][k] + tFor(j, c)) / free(c, k) - (own(c) ? 1 : 0) - (j.invInfo && j.invInfo.char === c ? 1e9 : 0);
      if (v < bv) {
        bv = v;
        best = c;
      }
    }
    const mine = own(best);
    if (mine && mine !== j.bp && !j.bp.virtual) {
      j.bp = Object.assign({}, mine);
      taken.add(mine.i);
    }
    if (j.bp.virtual) j.bp = Object.assign({}, j.bp, { cid: best });
    j.who = best;
    j.miss = missingSkills(best, rec);
    j.noone = noone;
    load[best][k] += tFor(j, best);
    // more jobs than free slots: the rest waits for a running job to end (an estimate, not a scheduler)
    cnt[best][k]++;
    const realFree = slotsOf(best)[k] - busyOf(best)[k];
    j.wait = cnt[best][k] > Math.max(0, realFree);
  }
}
// avg: optional Map type -> average purchase price over the whole shopping list (see buyAvgMap)
function nodeCost(n, free, avg) {
  // material cost of a tree: purchases + own stock
  let c = n.buy * ((avg && avg.get(n.t)) ?? buyPrice(n.t));
  if (!free) c += n.stock.filter(x => x.l !== 'surplus' && x.l !== 'job').reduce((s, x) => s + x.q, 0) * unitPrice(n.t);
  n.ch.forEach(ch => (c += nodeCost(ch, free, avg)));
  return c;
}
// production location: the one set in Settings, otherwise the (assigned) BP's location
function prodLocOf(n) {
  if (S.prodLoc) return Number(S.prodLoc);
  if (n.jobsRef && n.jobsRef[0] && n.jobsRef[0].bp) return n.jobsRef[0].bp.l;
  return n.build && n.build.jobs[0] ? n.build.jobs[0].c.l : null;
}
function haulSig(R) {
  const H = haulList(R);
  return [...H.moves.keys(), ...[...H.sale.keys()].map(f => f + '|J')].sort().join(',');
}
function haulList(R) {
  // what has to go where
  const moves = new Map(),
    oreRoutes = new Set();
  const left = new Map();
  const buyLeft = t => {
    if (!left.has(t))
      left.set(
        t,
        buyParts(t, R.buyList.get(t) || 0).map(x => Object.assign({}, x))
      );
    return left.get(t);
  };
  const kinds = new Map(); // route -> Set('buy' | 'stock' | 'built')
  const stockQ = new Map(); // route -> Map(type -> qty) of the stock part (what 'leave it there' would buy instead)
  const dests = new Set(); // every place a job of this result runs at
  const add = (from, to, t, q, kind) => {
    if (!q || from == null || to == null || from === to) return;
    const k = from + '|' + to;
    if (!kinds.has(k)) kinds.set(k, new Set());
    kinds.get(k).add(kind);
    let m = moves.get(k);
    if (!m) {
      m = new Map();
      moves.set(k, m);
    }
    m.set(t, (m.get(t) || 0) + q);
    if (kind === 'stock') {
      if (!stockQ.has(k)) stockQ.set(k, new Map());
      stockQ.get(k).set(t, (stockQ.get(k).get(t) || 0) + q);
    }
  };
  const walk = n => {
    if (!n.build) return;
    const to = prodLocOf(n);
    if (to != null) dests.add(to);
    for (const c of n.ch) {
      for (const x of c.stock) {
        if (x.l === 'surplus' || x.l === 'job') continue;
        add(x.l, to, c.t, x.q, 'stock');
        if (x.ore) oreRoutes.add(x.l + '|' + to);
      }
      // purchases: each node takes its share from the sources of the whole list, cheapest source first
      if (c.buy) {
        let need = c.buy;
        for (const x of buyLeft(c.t)) {
          if (need <= 0) break;
          const k = Math.min(x.q, need);
          x.q -= k;
          need -= k;
          add(x.l, to, c.t, k, 'buy');
        }
      }
      if (c.build) {
        const got = c.stock.reduce((s, x) => s + x.q, 0);
        add(prodLocOf(c), to, c.t, Math.max(0, c.need - got), 'built');
      }
      walk(c);
    }
  };
  R.trees.forEach(x => walk(x.tree));
  // ore source: the amount cannot be traced back exactly from the pool entry -> marked separately
  // to Jita for sale: grouped by origin (from -> type -> qty)
  const sale = new Map();
  R.trees.forEach(x => {
    const from = prodLocOf(x.tree);
    if (from == null || from === JITA_STATION) return;
    if (!sale.has(from)) sale.set(from, new Map());
    const m = sale.get(from);
    m.set(x.tree.t, (m.get(x.tree.t) || 0) + x.made);
  });
  return { moves, sale, oreRoutes, kinds, stockQ, dests };
}
const volOf = t => (REFC.t[t] && REFC.t[t].vol) || 0;
/* ---- ships and routes for hauling ---- */
const ROUTE_RETRY = 5 * 60000;
let SHIPC = load('shipc', {}),
  ROUTES = load('routes2', {}); // {n: jumps, hs: highsec all the way (null: unknown), min: lowest security}
async function getShipType(t) {
  if (SHIPC[t] !== undefined) return SHIPC[t];
  const j = await limit(async () => {
    const r = await fetch(REF + '/types/' + t);
    return r.ok ? r.json() : null;
  });
  let v = null;
  if (j && j.category_id === 6) {
    const tr = j.traits || {};
    const cb = [];
    for (const [sk, o] of Object.entries(tr.types || {}))
      for (const b of Object.values(o || {})) {
        const tx = (b.bonus_text && b.bonus_text.en) || '';
        if (/cargo capacity/i.test(tx) && !/ore hold|fleet hangar/i.test(tx)) cb.push([Number(sk), b.bonus]);
      }
    let rb = 0;
    for (const b of Object.values(tr.role_bonuses || {})) {
      const tx = (b.bonus_text && b.bonus_text.en) || '';
      if (/cargo capacity/i.test(tx) && !/ore hold|fleet hangar/i.test(tx)) rb += b.bonus;
    }
    v = { n: j.name && j.name.en, g: j.group_id, cap: j.capacity || 0, rs: j.required_skills || {}, cb, rb };
  } else v = { notShip: true };
  SHIPC[t] = v;
  store('shipc', SHIPC);
  return v;
}
async function ownShips() {
  // assembled ships in the characters' hangars that their owner can fly
  const cand = [];
  for (const c of CHARS) {
    const d = DATA[c.id];
    if (!d) continue;
    for (const a of d.assets) if (a.s && a.f === 'Hangar' && a.q === 1) cand.push({ cid: c.id, t: a.t, l: a.l });
  }
  await Promise.all([...new Set(cand.map(x => x.t))].map(t => getShipType(t).catch(() => null)));
  const out = [];
  for (const x of cand) {
    const st = SHIPC[x.t];
    if (!st || st.notShip || !st.cap) continue;
    const canFly = Object.entries(st.rs).every(([sk, l]) => lvlOf(x.cid, sk) >= l);
    let cap = st.cap;
    for (const [sk, b] of st.cb) cap *= 1 + (b * lvlOf(x.cid, sk)) / 100;
    cap *= 1 + st.rb / 100;
    out.push(Object.assign({}, x, { n: st.n, g: st.g, cap, canFly }));
  }
  return out;
}
// rough seconds per highsec jump (align, warp across the system, jump) by ship group: freighter, jump freighter,
// industrial command ship, industrial, deep space transport, blockade runner, mining barge, exhumer
const JUMP_SEC = { 513: 180, 902: 150, 941: 140, 28: 75, 380: 80, 1202: 50, 463: 70, 543: 75 };
// docking, loading or unloading and undocking at each end of a trip
const TRIP_END_SEC = 120;
function sysOfLoc(l) {
  if (l === JITA_STATION) return 30000142;
  return LOCINFO[l] && LOCINFO[l].system;
}
async function ensureRoute(a, b) {
  if (a == null || b == null) return null;
  if (a === b) return { n: 0, hs: SYSSEC[a] != null ? SYSSEC[a] >= 0.45 : null, min: SYSSEC[a] ?? null };
  const k = a + '|' + b;
  // a failed or incomplete (unknown security) result is kept for 5 minutes only, then retried
  const c = ROUTES[k];
  if (c !== undefined && c !== null) {
    const weak = c.fail || c.hs == null;
    if (!weak || Date.now() - (c.at || 0) < ROUTE_RETRY) return c.fail ? null : c;
  }
  let r = null;
  try {
    r = await esi('/route/' + a + '/' + b + '/?flag=secure');
  } catch (e) {}
  if (!r) {
    try {
      r = await esi('/route/' + a + '/' + b + '/');
    } catch (e) {}
  }
  let res = null;
  if (Array.isArray(r) && r.length) {
    // security is checked per system, not guessed from how the route was requested
    const need = r.filter(id => SYSSEC[id] == null);
    await Promise.all(
      need.map(async id => {
        try {
          SYSSEC[id] = (await esi('/universe/systems/' + id + '/')).security_status;
        } catch (e) {}
      })
    );
    store('syssec', SYSSEC);
    const known = r.every(id => SYSSEC[id] != null);
    const min = known ? Math.min(...r.map(id => SYSSEC[id])) : null;
    res = { n: r.length - 1, hs: known ? min >= 0.45 : null, min, at: Date.now() };
  }
  ROUTES[k] = res || { fail: true, at: Date.now() };
  store('routes2', ROUTES);
  return res;
}
// haul context: works from a snapshot taken at call time, and only the most recently started preparation may publish
async function prepHaul(R) {
  const gen = (R.haulGen = (R.haulGen || 0) + 1);
  const sig = haulSig(R);
  const H = haulList(R);
  const pairs = [];
  for (const k of H.moves.keys()) {
    const [f, t] = k.split('|').map(Number);
    pairs.push([f, t]);
  }
  for (const f of H.sale.keys()) pairs.push([f, JITA_STATION]);
  for (const [f, t] of pairs) {
    for (const l of [f, t]) if (l !== JITA_STATION && !LOCINFO[l]) await resolveLoc(l);
  }
  const jumps = {};
  for (const [f, t] of pairs) jumps[f + '|' + t] = await ensureRoute(sysOfLoc(f), sysOfLoc(t));
  const ships = await ownShips();
  // the ship first has to fly (empty) from where it is to the pickup point
  const pos = {};
  for (const x of ships)
    for (const [f] of pairs) {
      const k = x.l + '|' + f;
      if (!(k in pos)) {
        if (x.l !== JITA_STATION && !LOCINFO[x.l]) await resolveLoc(x.l);
        const r = await ensureRoute(sysOfLoc(x.l), sysOfLoc(f));
        pos[k] = r ? r.n : null;
      }
    }
  const ctx = { jumps, ships, pos };
  // only the newest run AND one matching the current assignment may publish (a newer one started, or the assignment switched back)
  if (gen !== R.haulGen || sig !== haulSig(R)) return false;
  R.haulCtx = ctx;
  R.haulSig = sig;
  return true;
}
function shipAdvice(R, key, vol, maxUnit) {
  const ctx = R.haulCtx;
  if (!ctx || !vol) return '';
  const rt = ctx.jumps[key];
  const j = rt ? rt.n : null;
  const safety =
    rt == null
      ? ''
      : rt.hs === true
        ? T('highsec útvonal')
        : rt.hs === false
          ? '⚠ ' + T('az útvonal low- vagy nullsecen visz át (legalacsonyabb sec: {0})', fmt(rt.min, 1))
          : T('az útvonal biztonsága nem ismert');
  const flyable = ctx.ships.filter(x => x.canFly);
  const ships = flyable.filter(x => x.cap >= (maxUnit || 0));
  if (!flyable.length)
    return html`<div class="small muted">${j != null ? T('{0} ugrás', j) + ' (' + safety + '). ' : ''}Nincs olyan saját hajó, amit a tulajdonosa vezetni tud.</div>`;
  if (!ships.length)
    return html`<div class="small muted">${j != null ? T('{0} ugrás', j) + ' (' + safety + '). ' : ''}Egy darab ${fmt(maxUnit)} m³: egyik vezethető hajód rakterébe sem fér bele. Ehhez freighter vagy contract (courier) kell.</div>`;
  const opts = ships.map(x => {
    const trips = Math.ceil(vol / x.cap);
    const per = JUMP_SEC[x.g] || 75;
    // empty flight to the pickup point, then loaded legs and the empty legs back between them
    const from = Number(key.split('|')[0]);
    const pj = ctx.pos ? ctx.pos[x.l + '|' + from] : 0;
    const jumpsAll = j == null || pj == null ? null : pj + (2 * trips - 1) * j;
    const time = jumpsAll == null ? null : jumpsAll * per + trips * 2 * TRIP_END_SEC;
    return Object.assign({ trips, time, pj }, x);
  });
  opts.sort((a, b) => (a.time ?? a.trips * 1e6) - (b.time ?? b.trips * 1e6) || a.trips - b.trips);
  const seen = new Set();
  const best = opts
    .filter(o => {
      const k = o.t + '|' + o.cid;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 3);
  return html`<div class="small">${j == null ? T('Útvonal nem ismert.') + ' ' : j === 0 ? T('Ugyanabban a rendszerben.') + ' ' : html`<b>${T('{0} ugrás', j)}</b> (${rt.hs === false ? html`<span class="neg">${safety}</span>` : safety}). `}${best.map((o, i) => html`${i ? html`<br>` : ''}${o.n} <span class="muted">(${charName(o.cid)}, ${locName(o.l)}, ${T('raktér {0} m³', fmt(o.cap))})</span>: <b>${T('{0} forduló', o.trips)}</b>${o.pj ? ' · ' + T('előtte {0} ugrás üresen odáig', o.pj) : ''}${o.time != null ? ' · ' + T('kb. {0}', dur(o.time)) : ''}`)}</div>`;
}
// The stock part of one route: what buying it instead would cost, and a button to leave it where it is.
function leaveLine(H, k) {
  const sq = H.stockQ.get(k);
  if (!sq) return '';
  let cost = 0,
    known = true;
  for (const [t, q] of sq) {
    const p = buyPrice(t, q);
    if (p == null) known = false;
    else cost += p * q;
  }
  return html`<div class="small leave">${T('A készletrész megvéve kb. {0}', known ? isk(cost) : '?')} <button class="btn mini" data-leave="${k}" title="${T('Ezt a készletet a terv ott hagyja, és a hiányt megveszi. A Szállítás alján visszaveheted.')}">${T('Hagyd ott, vedd meg')}</button></div>`;
}
// Places the player left out of the haul plan for this result's production places, each with a way back.
function leftList(H) {
  const keys = Object.keys(S.leave || {}).filter(k => S.leave[k] && H.dests.has(Number(k.split('|')[1])));
  if (!keys.length) return '';
  return html`<p class="small" style="margin-top:6px">${T('Otthagyott készlet (helyette veszem):')} ${hjoin(
    keys.map(k => {
      const [from, to] = k.split('|').map(Number);
      return html`<span class="pill"><span title="${locName(from)}">${shortLoc(from)}</span> → <span title="${locName(to)}">${shortLoc(to)}</span> <button class="btn mini" data-unleave="${k}">${T('Visszaveszem')}</button></span>`;
    }),
    ' '
  )}</p>`;
}
function renderHaul(R) {
  const H = haulList(R);
  if (!H.moves.size && !H.sale.size)
    return html`<h3>Szállítás</h3><p class="small muted">Semmit nem kell mozgatni: minden a gyártás helyén van.</p>${leftList(H)}`;
  let tot = 0;
  let h = html`<h3>Szállítás</h3><p class="small muted">Mit kell a gyártás helyére vinni. A gyártási helyszín a BP helye, vagy amit a Beállításokban megadsz. A térfogat csomagolt m³. A hajójavaslat a karaktereid hangárjában lévő hajókból választ, amit a tulajdonosuk vezetni tud, a raktér a skillbónuszokkal együtt számít. Az idő durva becslés: a hajó üres útja oda, ahol a rakomány van, utána a fordulók (megrakva oda, üresen vissza), ugrásonként a hajótípustól függően 50–180 mp, fordulónként dokkolással és pakolással 2 × 2 perc. Csak a cargo hold számít, az ore hold és a fittelt bővítők nem.</p><div class="haulgrid">`;
  for (const [k, m] of H.moves) {
    const [from, to] = k.split('|').map(Number);
    const rows = [...m].map(([t, q]) => ({ t, q, v: q * volOf(t) }));
    const sum = rows.reduce((s, r) => s + (r.v || 0), 0);
    tot += sum;
    const ks = H.kinds.get(k) || new Set();
    const kind = [
      ks.has('buy') && T('Vásárlás'),
      ks.has('stock') && T('Készletből'),
      ks.has('built') && T('Köztes termék')
    ]
      .filter(Boolean)
      .join(' + ');
    h = html`${h}<div class="haul"><div class="haulhead"><span class="pill">${kind}</span> <b title="${locName(from)}">${from === JITA_STATION ? 'Jita' : shortLoc(from)}</b> → <b title="${locName(to)}">${to === JITA_STATION ? 'Jita' : shortLoc(to)}</b> · <span class="mono">${fmt(sum)} m³</span></div><table class="haultab"><tbody>${rows
      .sort((a, b) => (b.v || 0) - (a.v || 0))
      .map(
        r =>
          html`<tr><td>${NAMES[r.t] || r.t}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.v)} m³</td></tr>`
      )}</tbody></table>${
      H.oreRoutes.has(k)
        ? html`<div class="small muted">Az ásvány egy része ott még ércként van: vagy helyben reprocesszálod, vagy az ércet viszed (más térfogat).</div>`
        : ''
    }${leaveLine(H, k)}<div class="haulships">${shipAdvice(R, k, sum, Math.max(0, ...rows.map(r => volOf(r.t))))}</div></div>`;
  }
  for (const [from, m] of H.sale) {
    const rows = [...m].map(([t, q]) => ({ t, q, v: q * volOf(t) }));
    const sum = rows.reduce((s, r) => s + r.v, 0);
    h = html`${h}<div class="haul"><div class="haulhead"><span class="pill">${T('Eladásra')}</span> <b title="${locName(from)}">${shortLoc(from)}</b> → <b>Jita</b> · <span class="mono">${fmt(sum)} m³</span></div><table class="haultab"><tbody>${rows.map(r => html`<tr><td>${NAMES[r.t] || r.t}</td><td class="num">${fmt(r.q)}</td><td class="num">${fmt(r.v)} m³</td></tr>`)}</tbody></table><div class="haulships">${shipAdvice(R, from + '|' + JITA_STATION, sum, Math.max(0, ...rows.map(r => volOf(r.t))))}</div></div>`;
  }
  h = html`${h}</div>${leftList(H)}`;
  if (tot)
    h = html`${h}<p class="small muted" style="margin-top:6px">Odaszállítás összesen: <span class="mono">${fmt(tot)} m³</span></p>`;
  return h;
}
function buildUnit(n, sys) {
  // unit cost of building: subtree at market prices + the node's jobs
  if (!n.build || !n.build.made) return null;
  const mat = n.ch.reduce((s, c) => s + nodeCost(c, false), 0);
  const jc = n.jobsRef.reduce((s, j) => s + jobCost(j, sys), 0);
  return (mat + jc) / n.build.made;
}
// Shows a plan: recomputes the character assignment (work characters or slots may have changed), draws it,
// and if the assignment changed since the haul context was prepared, prepares it again and redraws.
function showResult(el, R, rerun) {
  assignChars(R.jobs);
  renderResult(el, R, rerun);
  refreshHaul(R).then(fresh => {
    if (fresh && el.isConnected) renderResult(el, R, rerun);
  });
}
// Re-prepares the haul context when the assignment signature changed. Resolves true only when a new context was published
// for the current assignment; one preparation runs per signature, and only a successful one updates R.haulSig.
async function refreshHaul(R) {
  const sig = haulSig(R);
  if (R.haulSig === sig || R.haulPending === sig) return false;
  R.haulPending = sig;
  try {
    await assignJobSys(R.jobs);
    const fresh = await prepHaul(R);
    return fresh && R.haulSig === sig;
  } catch (e) {
    log('Szállítás előkészítés: ' + e.message);
    return false;
  } finally {
    if (R.haulPending === sig) R.haulPending = null;
  }
}
// Totals of a plan, the same numbers the KPIs and the per-product table show.
// free: own stock counts as free; fees: selling fees {tax, broker} (the broker fee is at least 100 ISK per order).
// Items without a price make the profit "not computable" (unk) instead of being counted as 0.
function planTotals(R, free, fees) {
  const unkOf = tree => {
    const u = new Set();
    const scan = n => {
      if (n.buy > 0 && !buyPrice(n.t)) u.add(n.t);
      if (!free && n.stock.some(x => x.l !== 'surplus' && x.l !== 'job' && x.q > 0) && !unitPrice(n.t)) u.add(n.t);
      n.ch.forEach(scan);
    };
    scan(tree);
    if (!sell(tree.t)) u.add(tree.t);
    return u;
  };
  const unkAll = new Set();
  R.trees.forEach(x => unkOf(x.tree).forEach(t => unkAll.add(t)));
  const avg = buyAvgMap(R);
  const rows = R.trees.map(x => {
    const p = x.tree.t;
    const gross = x.made * (sell(p) || 0);
    const jc = R.jobs.filter(j => j.item === x.item).reduce((s, j) => s + jobCost(j, R.sys), 0);
    const mat = nodeCost(x.tree, free, avg);
    const tm = R.jobs.filter(j => j.item === x.item && j.top).reduce((m, j) => Math.max(m, jobTime(j)), 0);
    return {
      x,
      p,
      net: netOfFees(gross, fees),
      jc,
      mat,
      profit: netOfFees(gross, fees) - jc - mat,
      tm,
      unk: unkOf(x.tree).size > 0
    };
  });
  const buyCost = [...R.buyList].reduce((s, [t, q]) => s + q * (avg.get(t) || 0), 0);
  const stockCost = free ? 0 : [...R.usedList].reduce((s, [t, q]) => s + q * unitPrice(t), 0);
  const jcT = R.jobs.reduce((s, j) => s + jobCost(j, R.sys), 0);
  const net = rows.reduce((s, r) => s + r.net, 0);
  const profit = net - buyCost - stockCost - jcT;
  return { rows, unkAll, buyCost, stockCost, jcT, net, profit };
}
function resultKpis(R, P, free, multi) {
  const { unkAll, buyCost, stockCost, jcT, net, profit } = P;
  return html`<div class="kpis">
    <div class="kpi"><div class="k">${multi ? 'Termékek' : 'Termék'}</div><div class="v" style="font-size:16px">${multi ? R.trees.length + ' tétel' : R.title || ''}</div></div>
    <div class="kpi"><div class="k">Vásárolni kell</div><div class="v">${isk(buyCost)}</div></div>
    <div class="kpi"><div class="k">Saját készlet értéke</div><div class="v">${free ? 'ingyen' : isk(stockCost)}</div></div>
    <div class="kpi"><div class="k">Job költség</div><div class="v">${isk(jcT)}</div></div>
    <div class="kpi"><div class="k">Eladás (Jita sell, díjak után)</div><div class="v">${isk(net)}</div>${
      m2On()
        ? (() => {
            const g = R.trees.reduce((s, x) => s + x.made * (sell2(x.tree.t) || 0), 0);
            const f2 = m2Fees();
            return html`<div class="small muted">${m2Short()}: ${f2 ? isk(netOfFees(g, f2)) : isk(g) + ' ' + T('(díjak nélkül)')}</div>`;
          })()
        : ''
    }</div>
    <div class="kpi"><div class="k">Profit</div>${unkAll.size ? html`<div class="v">${T('nem számolható')}</div><div class="small muted">${T('becslés ár nélküli tételek nélkül: {0}', isk(profit))}</div>` : html`<div class="v ${profit >= 0 ? 'pos' : 'neg'}">${isk(profit)}</div>`}</div>
  </div>${unkAll.size ? html`<div class="notice" style="margin:8px 0"><p class="small">${T('Ezeknek nincs piaci ára, ezért a költség és a profit nem pontos: {0}. Ha hálózati hiba volt, pár perc múlva számolj újra.', [...unkAll].map(t => NAMES[t] || t).join(', '))}</p></div>` : ''}`;
}
// production systems with their cost index, and the selling fees used
function resultSystems(R) {
  const syss = [...new Set(R.jobs.map(j => jobSysOf(j, R.sys)).filter(Boolean))];
  return html`<p class="small muted">${syss.length > 1 ? T('Gyártási rendszerek: {0}', syss.map(s => (NAMES[s] || s) + ((IDX.p[s] || {}).manufacturing != null ? ' (' + fmt(IDX.p[s].manufacturing * 100, 2) + '%)' : '')).join(', ')) : T('Gyártási rendszer: {0}', NAMES[syss[0] || R.sys] || syss[0] || R.sys || T('ismeretlen')) + ((IDX.p[syss[0] || R.sys] || {}).manufacturing != null ? ' · cost index ' + fmt(IDX.p[syss[0] || R.sys].manufacturing * 100, 2) + '%' : '')} · sales tax ${fmt(salesTax() * 100, 2)}% · broker ${fmt(brokerFee() * 100, 2)}%${bestSeller() ? ' · ' + T('eladó: {0}', charName(bestSeller().cid)) : ''}</p>${m2Hint()}`;
}
// parallel manufacturing: which items were split into more jobs, and the extra material against the default
function resultParallel(R) {
  if (!S.parallel) return '';
  const par = R.par || [];
  if (!par.length)
    return html`<div class="notice"><p class="small">${T('Párhuzamos gyártás ({0}): egy tételt sem érdemes több jobra bontani (kevés blueprint, szabad slot vagy idő, vagy több anyag kellene).', parModeName())}</p></div>`;
  let extra = 0;
  const byType = new Map();
  for (const p of par) {
    for (const [t, q] of p.extra) extra += q * buyPrice(t);
    const o = byType.get(p.t) || { before: 0, jobs: 0 };
    o.before += p.before;
    o.jobs += p.jobs;
    byType.set(p.t, o);
  }
  const list = [...byType].map(([t, o]) => T('{0}: {1} → {2} job', NAMES[t] || '#' + t, o.before, o.jobs)).join(', ');
  return html`<div class="notice"><p class="small">${T('Párhuzamos gyártás ({0}): {1}.', parModeName(), list)} ${
    extra > 0 ? T('Többletanyag a sorban gyártáshoz képest: {0} ISK.', isk(extra)) : T('Nem kell hozzá több anyag.')
  }</p></div>`;
}
const parModeName = () => (S.parMode === 'speed' ? T('gyorsabb') : T('kevesebb anyag'));
function resultProducts(R, rows, multi) {
  let h = html`<h3>Termékenként</h3><div class="tablewrap"><table><thead><tr>${multi ? html`<th>Projekt</th>` : ''}<th>Termék</th><th class="num">Db</th><th class="num">Jita sell / db</th>${m2On() ? html`<th class="num">${m2Short()} sell / db</th>` : ''}<th class="num">Eladás díjak után</th><th class="num">Anyag</th><th class="num">Job</th><th class="num">Profit</th><th class="num">Fő job ideje</th></tr></thead><tbody>${rows.map(r => html`<tr>${multi ? html`<td>${r.x.item.label || ''}</td>` : ''}<td>${NAMES[r.p] || r.p}</td><td class="num">${fmt(r.x.made)}</td><td class="num">${isk(sell(r.p))}</td>${m2On() ? html`<td class="num">${m2Cell(sell(r.p), sell2(r.p))}</td>` : ''}<td class="num">${isk(r.net)}</td><td class="num">${isk(r.mat)}</td><td class="num">${isk(r.jc)}</td><td class="num ${r.unk ? '' : r.profit >= 0 ? 'pos' : 'neg'}">${r.unk ? html`<span title="${T('Nincs ára valaminek ebben a tételben.')}">?</span>` : isk(r.profit)}</td><td class="num">${dur(r.tm)}</td></tr>`)}</tbody></table></div>`;
  if (multi)
    h = html`${h}<p class="small muted" style="margin-top:4px">A tételenkénti anyagköltségben a másik tétel jobjából maradt felesleg ingyen számít, ezért a sorok összege kicsit eltérhet a fenti összesítéstől.</p>`;
  return h;
}
// shopping list (bl: what to buy, most expensive first); its closing </div> comes after the jobs table (grid2)
// shopping list: where each material comes from (Jita, a station picked in the market search, or a manual price),
// the average unit price over the needed quantity, and a field for a manual price
function resultShopping(bl) {
  const row = ([t, q]) => {
    const p = buyPrice(t, q);
    const mp = manPrice(t);
    const parts = buyParts(t, q);
    const picked = S.buySrc && S.buySrc[t];
    return html`<tr><td>${NAMES[t] || t}</td><td class="num">${fmt(q)}</td><td class="num">${unitPrice(t) ? isk(unitPrice(t)) : html`<span class="pill warn">nincs ár</span>`}</td><td class="small" data-noi18n>${buyFromText(t, q)}${
      picked && !mp && !parts.some(x => x.src === 'market')
        ? html`<div class="src">${T('a kiválasztott helyen most nincs eladó')}</div>`
        : ''
    }</td><td class="num">${p ? isk(p) : '–'}</td><td class="num">${p ? isk(q * p) : '–'}</td><td><input type="number" min="0" step="0.01" class="manp" data-manp="${t}" value="${mp ?? ''}" placeholder="${T('kézi ár')}" aria-label="${T('Kézi ár, ISK / db')}"></td></tr>`;
  };
  return html`<div class="grid2" style="margin-top:12px"><div><h3>Bevásárlólista</h3><div class="tablewrap"><table><thead><tr><th>Tárgy</th><th class="num">Mennyiség</th><th class="num">Jita sell</th><th>Honnan</th><th class="num">Egységár</th><th class="num">Összesen</th><th>Kézi ár</th></tr></thead><tbody>${
    hjoin(bl.map(row), '') || html`<tr><td colspan="7" class="pos">Semmit nem kell venni, minden megvan.</td></tr>`
  }</tbody></table></div>
  ${bl.some(([t, q]) => !buyPrice(t, q)) ? html`<p class="small" style="margin-top:6px;color:var(--warn)">Néhány tételnek nincs ára, ezért a profit nem számolható. Adj meg kézi árat, vagy keress forrást.</p>` : ''}
  <p class="small muted" style="margin-top:6px"><button class="btn" data-copybuy>Lista másolása (multibuy formátum)</button> ${
    bl.length ? html`<button class="btn" data-mktsearch>Hol vegyem olcsóbban?</button>` : ''
  }</p><p class="small muted">A kézi ár (ISK / db) mindenhol felülírja a piaci árat, például ha piacon kívül veszed; az ilyen tétel nem kerül a szállítási listába. A „Hol vegyem olcsóbban?” a Beállításokban kijelölt régiók eladási ordereit nézi.</p></div>`;
}
function resultJobs(R, multi) {
  return html`<div><h3>Gyártási jobok</h3><div class="tablewrap"><table><thead><tr><th>Mit</th><th>Ki gyártja</th><th>Melyik BP</th><th class="num">Run</th><th class="num">Idő</th><th class="num">Job költség</th></tr></thead><tbody>${R.jobs
    .slice()
    .reverse()
    .map(
      j =>
        html`<tr><td>${NAMES[j.t] || j.t}${j.act === 'r' ? html` <span class="pill">reakció</span>` : ''}${j.act === 'i' ? html` <span class="pill">invention</span><div class="src">esély ${fmt(j.invInfo.chance * 100, 1)}% · ${fmt(j.invInfo.runsPer)} run/BPC · ME${j.invInfo.me} TE${j.invInfo.te}</div>` : ''}${j.act === 'c' ? html` <span class="pill">copy</span>` : ''}${multi && j.item && j.item.label ? html`<div class="src">${j.item.label}</div>` : ''}</td><td><b>${charName(j.who ?? j.bp.cid)}</b> ${j.wait ? html`<span class="pill warn" title="${T('Nincs szabad slot; a javaslat későbbi indítással számol, a várakozási időt nem tartalmazza.')}">${T('nincs szabad slot')}</span> ` : ''}${j.who != null && j.who !== j.bp.cid ? html`<span class="pill warn">BP átadása</span><div class="src">${T('most {0}-nál van → add át {1}-nak', charName(j.bp.cid), charName(j.who))}</div>` : ''}${
          j.miss.length
            ? html`<span class="pill bad">hiányzó skill</span><div class="src">${hjoin(
                j.miss.map(m => (NAMES[m[0]] || m[0]) + ' ' + m[2] + ' → ' + m[1]),
                ', '
              )}</div>`
            : html`<span class="pill ok">skill ok</span>`
        }</td><td class="small">${j.bp.virtual ? T('inventált BPC') : (j.act === 'i' ? 'T1 ' : '') + (j.bp.r === -1 ? 'BPO' : 'BPC')} ME${j.act === 'm' ? j.bp.me : j.bp.virtual ? j.bp.me : j.bp.me} · ${locName(j.bp.l)}${j.short ? html` <span class="pill bad">nincs elég run</span>` : ''}</td><td class="num">${j.act === 'i' ? fmt(Math.ceil(j.runs)) + ' kísérlet' : fmt(j.runs)}</td><td class="num">${dur(jobTime(j))}</td><td class="num">${isk(jobCost(j, R.sys))}</td></tr>`
    )}</tbody></table></div></div></div>`;
}
// load per character: jobs per activity against free slots, total time and an estimated wall-clock time
function resultCharLoad(R) {
  const per = new Map();
  for (const j of R.jobs) {
    const c = j.who ?? j.bp.cid;
    let x = per.get(c);
    if (!x) {
      x = { m: 0, r: 0, s: 0, tm: 0, tr: 0, ts: 0, miss: 0, mx: 0 };
      per.set(c, x);
    }
    const jt = jobTime(j);
    x.mx = Math.max(x.mx, jt);
    const k = slotKey(j.act);
    x[k]++;
    x['t' + k] += jt;
    if (j.miss.length) x.miss++;
  }
  return html`<h3>Karakterek terhelése</h3><p class="small muted">Minden jobot annak a karakternek ajánl, akinek megvannak a skilljei, és akinél a szabad slotok és a gyártási idő alapján a leghamarabb elkészül. Egyenlő esetben marad annál, akinél a BP most van, vagy akinél ugyanilyen BP is van.</p><div class="tablewrap"><table><thead><tr><th>Karakter</th><th class="num">Gyártó job</th><th class="num">Szabad gyártó slot</th><th class="num">Reakció job</th><th class="num">Szabad reakció slot</th><th class="num">Science job</th><th class="num">Szabad science slot</th><th class="num">Össz. idő</th><th class="num">Becsült átfutás</th><th>Megjegyzés</th></tr></thead><tbody>${[
    ...per
  ].map(([c, x]) => {
    const sl = slotsOf(c),
      bz = busyOf(c);
    const fm = Math.max(0, sl.m - bz.m),
      fr = Math.max(0, sl.r - bz.r),
      fs = Math.max(0, sl.s - bz.s);
    const wall = Math.max(
      x.mx,
      x.m ? x.tm / Math.max(1, fm) : 0,
      x.r ? x.tr / Math.max(1, fr) : 0,
      x.s ? x.ts / Math.max(1, fs) : 0
    );
    const notes = [];
    if (x.miss) notes.push(T('{0} jobhoz egyik karakternek sincs meg a skill', x.miss));
    if (x.m > fm) notes.push(T('több gyártó job, mint szabad slot: sorban kell futtatni'));
    if (x.r > fr) notes.push(T('több reakció job, mint szabad slot'));
    if (x.s > fs) notes.push(T('több science job, mint szabad slot'));
    return html`<tr><td><b>${charName(c)}</b></td><td class="num">${x.m}</td><td class="num">${fm} / ${sl.m}</td><td class="num">${x.r}</td><td class="num">${fr} / ${sl.r}</td><td class="num">${x.s}</td><td class="num">${fs} / ${sl.s}</td><td class="num">${dur(x.tm + x.tr + x.ts)}</td><td class="num">${dur(wall)}</td><td class="small ${notes.length ? '' : 'muted'}">${notes.join('; ') || T('rendben')}</td></tr>`;
  })}</tbody></table></div>`;
}
function resultTrees(R, multi) {
  let h = html`<h3>Anyagfa</h3><p class="small muted">Komponens sorára kattintva: gyártom ↔ veszem. A „Gyártva / Jita” oszlop egy darab árát mutatja: saját gyártásban (anyag piaci áron + job) és megvéve. A zöld az olcsóbb. A „Honnan” oszlopban a hely is látszik.</p>`;
  R.trees.forEach(x => {
    h = html`${h}<details ${multi ? '' : 'open'} style="margin-bottom:8px"><summary>${(x.item.label ? x.item.label + ' · ' : '') + fmt(x.made) + ' × ' + (NAMES[x.tree.t] || x.tree.t)}</summary><div class="tablewrap" style="margin-top:6px"><table class="tree"><thead><tr><th>Tárgy</th><th class="num">Kell</th><th class="num">Készletből</th><th class="num">Gyártom</th><th class="num">Veszem</th><th class="num">Gyártva / Jita (db)${m2On() ? html`<span data-noi18n> · ${m2Short()}</span>` : ''}</th><th>Honnan</th></tr></thead><tbody>${treeRows(x.tree, 0, R.sys)}</tbody></table></div></details>`;
  });
  return h;
}
// Pure rendering of a finished plan (finishResult or showResult has already assigned characters and prepared hauling).
function renderResult(el, R, rerun) {
  const free = $('#optStockFree').checked;
  const P = planTotals(R, free, sellFees());
  const multi = R.trees.length > 1;
  const bl = [...R.buyList].sort((a, b) => b[1] * (buyPrice(b[0], b[1]) || 0) - a[1] * (buyPrice(a[0], a[1]) || 0));
  let h = resultKpis(R, P, free, multi);
  if (R.stale && R.stale.size)
    h = html`${h}<div class="notice"><p>${T('A számolás óta megváltozott: {0}. Az eredmény ehhez már nem friss.', [...R.stale].join(', '))} <button class="btn mini" data-rerun>${T('Újraszámolás')}</button></p></div>`;
  h = html`${h}${resultSystems(R)}`;
  R.warn.forEach(w => (h = html`${h}<div class="notice">${warnText(w)}</div>`));
  h = html`${h}${resultParallel(R)}`;
  h = html`${h}${resultProducts(R, P.rows, multi)}`;
  h = html`${h}${resultShopping(bl)}`;
  h = html`${h}${resultJobs(R, multi)}`;
  // the market search result spans the full width, under the shopping list and the jobs
  h = html`${h}<div class="mktout"></div>`;
  h = html`${h}${resultCharLoad(R)}`;
  h = html`${h}${renderHaul(R)}`;
  h = html`${h}${resultTrees(R, multi)}`;
  setHtml(el, h);
  bindBuySources(el, R);
  const rr = el.querySelector('[data-rerun]');
  if (rr) rr.onclick = () => rerun();
  const cb = el.querySelector('[data-copybuy]');
  cb &&
    cb.addEventListener('click', () => {
      const txt = bl.map(([t, q]) => (NAMES[t] || t) + '\t' + q).join('\n');
      navigator.clipboard.writeText(txt).then(
        () => status('lista vágólapon'),
        () => status('másolás nem sikerült')
      );
    });
  el.querySelectorAll('[data-leave]').forEach(b =>
    b.addEventListener('click', () => {
      setSettingIn('leave', b.dataset.leave, true);
      rerun();
    })
  );
  el.querySelectorAll('[data-unleave]').forEach(b =>
    b.addEventListener('click', () => {
      setSettingIn('leave', b.dataset.unleave, null);
      rerun();
    })
  );
  el.querySelectorAll('tr[data-toggle]').forEach(tr =>
    tr.addEventListener('click', () => {
      const t = Number(tr.dataset.toggle);
      setSettingIn('buyOverride', t, S.buyOverride && S.buyOverride[t] ? null : true);
      rerun();
    })
  );
}
function bbCell(n, d, sys) {
  const up = unitPrice(n.t);
  const m2 = m2On() && sell2(n.t) ? html`<div class="small muted">${m2Short()} ${isk(sell2(n.t))}</div>` : '';
  return html`${bbCell0(n, d, sys, up)}${m2}`;
}
function bbCell0(n, d, sys, up) {
  if (!n.build) return up ? isk(up) : '–';
  const ub = buildUnit(n, sys);
  if (ub == null) return '–';
  if (!up) return isk(ub) + ' / –';
  const cheaper = ub <= up;
  return html`<span class="${cheaper ? 'pos' : ''}">${isk(ub)}</span> / <span class="${cheaper ? '' : 'pos'}">${isk(up)}</span>`;
}
// where the unused stock of a material is (largest first, at most 4 places)
function whyAt(at) {
  const list = [...at].sort((a, b) => b[1] - a[1]);
  const txt = list.slice(0, 4).map(([k, q]) => {
    const [l, c] = k.split('|');
    return shortLoc(Number(l)) + (c ? ' · ' + contLabel(Number(c)) : '') + ': ' + fmt(q);
  });
  if (list.length > 4) txt.push(T('és még {0} hely', list.length - 4));
  return txt.join(', ');
}
// when a run makes more than one piece: how many runs of how many, and how many are left over
function madeNote(n) {
  const runs = n.build.jobs.reduce((s, j) => s + j.r, 0);
  const per = runs ? n.build.made / runs : 0;
  if (!(per > 1)) return '';
  const extra = n.build.made - (n.need - n.stock.reduce((s, x) => s + x.q, 0));
  // short in the cell (the column is narrow), the full sentence on hover
  const full = T('{0} run × {1} db', fmt(runs), fmt(per)) + (extra > 0 ? ' · ' + T('{0} felesleg', fmt(extra)) : '');
  return html`<div class="small muted" title="${full}" style="white-space:nowrap">${qtyShort(runs)}×${fmt(per)}${extra > 0 ? ' +' + qtyShort(extra) : ''}</div>`;
}
function treeRows(n, d, sys) {
  const st = n.stock.reduce((s, x) => s + x.q, 0);
  const canToggle = d > 0 && ownedFor(n.t).length > 0;
  // where the stock comes from, with the quantity per place (several entries of one place are added up)
  const from = new Map();
  for (const x of n.stock) {
    const k =
      x.l === 'surplus'
        ? T('felesleg más jobból')
        : x.l === 'job'
          ? T('futó job ({0})', charName(x.cid))
          : locName(x.l) + (x.c != null ? ' · ' + contLabel(x.c) : '') + (x.ore ? ' ' + T('(ércből)') : '');
    from.set(k, (from.get(k) || 0) + x.q);
  }
  const where = [...from]
    .sort((a, b) => b[1] - a[1])
    .map(([k, q]) => (from.size > 1 ? k + ' (' + qtyShort(q) + ')' : k))
    .join(', ');
  // stock that is there but this item may not take (see stockWhy)
  const why = n.why
    ? [
        n.why.src && T('{0} nincs a nyersanyag-források között', fmt(n.why.src)),
        n.why.resv && T('{0} másik projekt konténerében van', fmt(n.why.resv)),
        n.why.plan && T('{0} a tervezőben nem számító helyen van', fmt(n.why.plan)),
        n.why.left && T('{0} otthagyva (a Szállításnál kizártad)', fmt(n.why.left))
      ].filter(Boolean)
    : [];
  const mark = n.inv
    ? html`<span class="pill">invention</span> <span class="src">${T('{0}% esély · {1} kísérlet', fmt(n.inv.chance * 100, 1), n.inv.attempts % 1 ? T('átlag {0}', fmt(n.inv.attempts, 2)) : fmt(n.inv.attempts))}${n.inv.dec ? ' · ' + DECS[n.inv.dec].n : ''}</span>`
    : canToggle
      ? S.buyOverride[n.t]
        ? html`<span class="pill warn">veszem</span>`
        : n.build
          ? html`<span class="pill ok">gyártom</span>`
          : ''
      : '';
  let h = html`<tr ${canToggle ? html`data-toggle="${n.t}" style="cursor:pointer" title="Kattints: gyártom / veszem"` : ''}><td class="name" style="padding-left:${10 + d * 18}px">${NAMES[n.t] || n.t} ${mark}</td><td class="num">${fmt(n.need)}</td><td class="num">${st ? fmt(st) : '–'}</td><td class="num">${n.build ? html`${fmt(n.build.made)}${madeNote(n)}` : '–'}</td><td class="num">${n.buy ? fmt(n.buy) : '–'}</td><td class="num small">${bbCell(n, d, sys)}</td><td class="src">${where}${
    why.length
      ? html`<div class="warnline">${T('Készletben még: {0}.', why.join('; '))} ${T('Itt: {0}.', whyAt(n.why.at))}</div>`
      : ''
  }</td></tr>`;
  n.ch.forEach(c => (h = html`${h}${treeRows(c, d + 1, sys)}`));
  return h;
}
