'use strict';
// Timeline: when each job of a plan can run, on the characters' real slots.
//
// scheduleJobs() is a pure function (no globals, no clock) so it can be tested on its own. timelineInput() builds
// its input from a result (R) and the live data: slots from the skills, running jobs, the dependencies of the
// material tree, purchase lead time and haul estimates. renderTimeline() draws it as an SVG Gantt chart.

const HOUR = 3600e3;
// zoom of the timeline (1 = the whole plan fits), and the box width it was drawn for (0 = not measured yet)
let TL_ZOOM = 1,
  TL_WIDTH = 0;
const TL_ZOOM_MAX = 64;
// a label cut to fit a width (px), with an ellipsis; '' when not even a few letters fit. per: px per letter
function fitText(s, px, per) {
  const n = Math.floor(px / per);
  if (n < 4) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// Start times may be limited to a daily window (when the player is online), e.g. { from: 18, to: 23 }; from > to
// wraps past midnight. Returns the first moment at or after t inside the window (local time).
function inWindow(t, win) {
  if (!win) return t;
  const d = new Date(t);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const inside = win.from <= win.to ? h >= win.from && h < win.to : h >= win.from || h < win.to;
  if (inside) return t;
  const n = new Date(t);
  n.setHours(win.from, 0, 0, 0);
  if (n.getTime() <= t) n.setDate(n.getDate() + 1);
  return n.getTime();
}

/* Serial schedule: jobs are placed one by one, in an order where every job comes after the jobs it needs (by
 * priority, then the longest chain still ahead of it), each at the earliest moment when
 *  - every job it needs has finished (plus the haul time between their places, lag),
 *  - its materials have arrived (ready),
 *  - a slot of its character and kind is free, and its blueprint is not in another job,
 *  - it is inside the active window, when there is one.
 * in: { t0, win, jobs: [{ id, lane: 'cid|k', bp, dur (ms), ready (ms), prio, deps: [{ id, lag }] }],
 *       slots: { 'cid|k': [free-from times, one per usable slot] } }
 * out: { rows: Map(id -> { s, e, lane, slot, why }), end, crit: Set(id) }  why: what decided the start. */
function scheduleJobs(inp) {
  const byId = new Map(inp.jobs.map(j => [j.id, j]));
  // longest chain of work from a job to the end (its own duration included): long chains go first
  const succ = new Map(inp.jobs.map(j => [j.id, []]));
  for (const j of inp.jobs) for (const d of j.deps) if (succ.has(d.id)) succ.get(d.id).push({ id: j.id, lag: d.lag });
  const tail = new Map();
  const tailOf = id => {
    if (tail.has(id)) return tail.get(id);
    tail.set(id, 0); // guards a cycle (should not happen)
    const v = byId.get(id).dur + Math.max(0, ...succ.get(id).map(s => s.lag + tailOf(s.id)));
    tail.set(id, v);
    return v;
  };
  inp.jobs.forEach(j => tailOf(j.id));
  // order: ready jobs first by priority, then by the longest tail
  const left = new Map(inp.jobs.map(j => [j.id, j.deps.filter(d => byId.has(d.id)).length]));
  const order = [];
  let avail = inp.jobs.filter(j => !left.get(j.id));
  while (avail.length) {
    avail.sort(
      (a, b) => a.prio - b.prio || tail.get(b.id) - tail.get(a.id) || String(a.id).localeCompare(String(b.id))
    );
    const j = avail.shift();
    order.push(j);
    for (const s of succ.get(j.id)) {
      left.set(s.id, left.get(s.id) - 1);
      if (!left.get(s.id)) avail.push(byId.get(s.id));
    }
  }
  const slots = {};
  for (const [k, v] of Object.entries(inp.slots)) slots[k] = v.slice();
  const bpFree = new Map(),
    bpLast = new Map(),
    slotLast = {}; // who held the slot / blueprint before: the critical path follows waits, too
  const rows = new Map();
  for (const j of order) {
    let est = Math.max(inp.t0, j.ready || 0),
      why = j.ready > inp.t0 ? 'mat' : 'start',
      from = null;
    for (const d of j.deps) {
      const r = rows.get(d.id);
      if (r && r.e + d.lag > est) {
        est = r.e + d.lag;
        why = 'dep';
        from = d.id;
      }
    }
    const lane = slots[j.lane] || [];
    if (!lane.length) {
      rows.set(j.id, { s: null, e: null, lane: j.lane, slot: -1, why: 'noslot' });
      continue;
    }
    // the slot that lets it start first
    let best = -1,
      bs = Infinity,
      bwhy = why;
    lane.forEach((free, i) => {
      let s = est,
        w = why;
      for (let k = 0; k < 4; k++) {
        // the blueprint first: when both hold it back, the blueprint is the reason (a free slot would not help)
        const bf = j.bp != null ? bpFree.get(j.bp) || 0 : 0;
        if (bf > s) {
          s = bf;
          w = 'bp';
        }
        if (free > s) {
          s = free;
          w = 'slot';
        }
        const a = inWindow(s, inp.win);
        if (a > s) {
          s = a;
          w = w === 'start' ? 'active' : w;
        }
        if (free <= s && (j.bp == null || (bpFree.get(j.bp) || 0) <= s)) break;
      }
      if (s < bs) {
        bs = s;
        best = i;
        bwhy = w;
      }
    });
    const e = bs + j.dur;
    const sk = j.lane + '#' + best;
    const prev = bwhy === 'dep' ? from : bwhy === 'slot' ? slotLast[sk] : bwhy === 'bp' ? bpLast.get(j.bp) : null;
    lane[best] = e;
    slotLast[sk] = j.id;
    if (j.bp != null) {
      bpFree.set(j.bp, e);
      bpLast.set(j.bp, j.id);
    }
    rows.set(j.id, { s: bs, e, lane: j.lane, slot: best, why: bwhy, from: prev ?? null });
  }
  let end = inp.t0,
    last = null;
  for (const [id, r] of rows)
    if (r.e != null && r.e > end) {
      end = r.e;
      last = id;
    }
  // critical path: back from the last job along what decided each start (a job it needs, or the one before it
  // in its slot or on its blueprint); a wait for a running job ends it
  const crit = new Set();
  for (let id = last; id != null; id = rows.get(id).from) {
    if (crit.has(id)) break;
    crit.add(id);
  }
  return { rows, end, crit };
}

// Usable slot list of one character and kind: running jobs sit in slots until they end; the reserve keeps that
// many slots out of the plan altogether (the player's own use). Each entry is the time that slot becomes free.
function slotList(total, reserve, runningEnds, t0) {
  const usable = Math.max(0, total - Math.max(0, reserve || 0));
  const ends = runningEnds.map(e => Math.max(e, t0)).sort((a, b) => a - b);
  const list = ends.slice(0, usable);
  while (list.length < usable) list.push(t0);
  return list.sort((a, b) => a - b);
}

const TL_KIND = { m: 'gyártó', r: 'reakció', s: 'science' };
const jobKindOf = act => (act === 1 ? 'm' : act === 9 || act === 11 ? 'r' : [3, 4, 5, 7, 8].includes(act) ? 's' : null);

// when the plan starts: the time set on the timeline, or now
function tlStart(now) {
  const v = S.tlStart;
  const t = v ? new Date(v).getTime() : NaN;
  return isFinite(t) && t > now ? t : now;
}
function tlWindow() {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(S.tlActive || '');
  if (!m) return null;
  const from = Number(m[1]),
    to = Number(m[2]);
  return from === to || from > 23 || to > 24 ? null : { from, to };
}

// Haul time of every route of the result (best of the player's ships), ms; null when it is not known.
function routeTimes(R) {
  const H = haulList(R);
  const out = new Map();
  for (const [k, m] of H.moves) {
    const rows = [...m].map(([t, q]) => ({ t, q, v: q * volOf(t) }));
    const vol = rows.reduce((s, r) => s + (r.v || 0), 0);
    const best = shipOptions(R, k, vol, Math.max(0, ...rows.map(r => volOf(r.t))))[0];
    out.set(k, {
      time: best && best.time != null ? best.time * 1000 : null,
      kinds: H.kinds.get(k) || new Set(),
      ship: best
    });
  }
  return out;
}

// The scheduler input of a result. now: the current time (ms).
function timelineInput(R, now) {
  const t0 = tlStart(now);
  const win = tlWindow();
  const lead = Math.max(0, Number(S.tlBuyLead) || 0) * HOUR;
  const routes = routeTimes(R);
  const ids = new Map(R.jobs.map((j, i) => [j, 'j' + i]));
  const cidOf = j => (j.who != null ? j.who : j.bp.cid);
  const deps = new Map(R.jobs.map(j => [j, []]));
  const ready = new Map(R.jobs.map(j => [j, 0]));
  const unknown = { haul: false };
  // materials coming into a place: wait for the purchase lead time (when something is bought) and the hauls into it
  const arrive = new Map(); // destination -> ms after t0
  for (const [k, r] of routes) {
    const to = Number(k.split('|')[1]);
    if (!r.kinds.has('buy') && !r.kinds.has('stock')) continue;
    if (r.time == null) unknown.haul = true;
    const base = r.kinds.has('buy') ? lead : 0;
    arrive.set(to, Math.max(arrive.get(to) || 0, base + (r.time || 0)));
  }
  const walk = n => {
    if (!n.ch) return;
    const mine = n.jobsRef || [];
    const to = prodLocOf(n);
    for (const c of n.ch) {
      walk(c);
      const cj = c.jobsRef || [];
      for (const p of cj) {
        const pl = p.bp && p.bp.l;
        const k = pl + '|' + to;
        const lag = pl != null && to != null && pl !== to && routes.has(k) ? routes.get(k).time || 0 : 0;
        for (const q of mine) deps.get(q).push({ id: ids.get(p), lag });
      }
      // raw materials (bought or from stock elsewhere) for this node's jobs
      const raw = c.buy > 0 || (c.stock || []).some(x => typeof x.l === 'number' && x.l !== to);
      if (raw && to != null && arrive.has(to))
        for (const q of mine) ready.set(q, Math.max(ready.get(q), t0 + arrive.get(to)));
    }
    // invention needs its copy first
    const copy = mine.filter(j => j.act === 'c'),
      inv = mine.filter(j => j.act === 'i');
    for (const i of inv) for (const c of copy) deps.get(i).push({ id: ids.get(c), lag: 0 });
  };
  const prio = new Map();
  (R.trees || []).forEach((x, i) => {
    walk(x.tree);
    const mark = n => {
      (n.jobsRef || []).forEach(j => prio.has(j) || prio.set(j, i));
      (n.ch || []).forEach(mark);
    };
    mark(x.tree);
  });
  // slots: every character with a job here, plus its running jobs
  const lanes = new Set(R.jobs.map(j => cidOf(j) + '|' + slotKey(j.act)));
  const slots = {},
    running = [];
  for (const lane of lanes) {
    const [cid, k] = lane.split('|');
    const ends = [];
    for (const x of (DATA[cid] && DATA[cid].jobs) || []) {
      if (jobKindOf(x.act) !== k || (x.st !== 'active' && x.st !== 'ready')) continue;
      const e = x.st === 'ready' ? t0 : new Date(x.end).getTime();
      ends.push(e);
      running.push({ lane, s: new Date(x.start).getTime(), e, t: x.prod || x.bp, act: x.act });
    }
    slots[lane] = slotList(slotsOf(Number(cid))[k], (S.slotRes || {})[lane], ends, t0);
  }
  const jobs = R.jobs.map(j => ({
    id: ids.get(j),
    lane: cidOf(j) + '|' + slotKey(j.act),
    bp: j.bp && j.bp.i != null && !j.bp.virtual ? String(j.bp.i) : null,
    dur: jobTime(j) * 1000,
    ready: ready.get(j),
    prio: prio.has(j) ? prio.get(j) : 99,
    deps: deps.get(j)
  }));
  return { inp: { t0, win, jobs, slots }, ids, running, unknown, lead, routes };
}

// how long until a moment, in words (for the finish date)
const tlWhen = t =>
  new Date(t).toLocaleString(LOC(), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// The timeline of a result: the plan on real slots, as an SVG Gantt chart, with its assumptions and settings.
function renderTimeline(R, now = Date.now()) {
  if (!R.jobs || !R.jobs.length) return '';
  const T0 = timelineInput(R, now);
  const { inp, ids, running } = T0;
  const sch = scheduleJobs(inp);
  const byId = new Map([...ids].map(([j, id]) => [id, j]));
  const cidOf = lane => Number(lane.split('|')[0]);
  // lanes: character, then kind (manufacturing, reactions, science); one row per usable slot
  const kOrder = { m: 0, r: 1, s: 2 };
  const lanes = Object.keys(inp.slots).sort(
    (a, b) => charName(cidOf(a)).localeCompare(charName(cidOf(b))) || kOrder[a.split('|')[1]] - kOrder[b.split('|')[1]]
  );
  const end = Math.max(sch.end, inp.t0 + HOUR);
  const span = end - inp.t0;
  // the labels stay put on the left; the chart beside them is as wide as the box times the zoom, and scrolls
  const LABW = 190,
    RH = 22,
    TOP = 26,
    LW = 0;
  const PW = Math.max(300, (TL_WIDTH || 1000) - LABW - 34) * TL_ZOOM;
  const W = PW + 10;
  const x = t => ((Math.min(Math.max(t, inp.t0), end) - inp.t0) / span) * PW;
  let rowsSvg = [],
    labSvg = [],
    y = TOP;
  const items = (R.trees || []).map(x => x.item);
  const colorOf = j => 'tl-c' + (Math.max(0, items.indexOf(j.item)) % 6);
  for (const lane of lanes) {
    const n = inp.slots[lane].length;
    const [cid, k] = lane.split('|');
    const kept = running
      .filter(r => r.lane === lane)
      .sort((a, b) => a.e - b.e)
      .slice(0, n);
    // only the slots that hold something get a row; the empty ones are counted in the label
    const used = new Set(kept.map((_, i) => n - kept.length + i));
    for (const r of sch.rows.values()) if (r.lane === lane && r.s != null) used.add(r.slot);
    const rowOf = new Map([...used].sort((a, b) => a - b).map((s, i) => [s, i]));
    const free = n - used.size;
    labSvg.push(
      html`<text x="4" y="${y + 15}" class="tl-lab">${fitText(charName(Number(cid)), LABW - 8, 7)}<title>${charName(Number(cid))}</title></text><text x="4" y="${y + 28}" class="tl-small">${T(TL_KIND[k])} · ${n ? T('{0} slot', n) + (free > 0 ? ' · ' + T('{0} üres', free) : '') : T('nincs szabad slot')}</text>`
    );
    const nRows = Math.max(2, used.size);
    for (let i = 0; i < nRows; i++)
      rowsSvg.push(
        html`<rect x="${LW}" y="${y + i * RH}" width="${W - LW - 10}" height="${RH - 2}" class="tl-row"></rect>`
      );
    // running jobs sit in the last slots (they become free after the empty ones)
    kept.forEach((r, i) => {
      const row = rowOf.get(n - kept.length + i);
      const x2 = x(r.e);
      rowsSvg.push(
        html`<rect x="${LW}" y="${y + row * RH + 2}" width="${Math.max(2, x2 - LW)}" height="${RH - 6}" class="tl-run"><title>${T('Futó job')}: ${NAMES[r.t] || r.t} · ${T('vége')} ${tlWhen(r.e)}</title></rect>`
      );
      if (r.e > end)
        rowsSvg.push(
          html`<text x="${W - 14}" y="${y + row * RH + 15}" text-anchor="end" class="tl-small">→ ${tlWhen(r.e)}</text>`
        );
    });
    for (const [id, r] of sch.rows) {
      if (r.lane !== lane || r.s == null) continue;
      const j = byId.get(id);
      const job = inp.jobs.find(q => q.id === id);
      const yy = y + rowOf.get(r.slot) * RH + 2;
      // waiting for materials (purchase / haul): hatched, it is an estimate
      if (job.ready > inp.t0 && r.s >= job.ready - 1)
        rowsSvg.push(
          html`<rect x="${x(inp.t0)}" y="${yy + 6}" width="${Math.max(1, x(job.ready) - x(inp.t0))}" height="${RH - 18}" class="tl-wait"><title>${T('Anyagra vár (vásárlás, fuvar): becslés')}</title></rect>`
        );
      const x1 = x(r.s),
        x2 = x(r.e);
      const label = (NAMES[j.t] || j.t) + ' ×' + j.runs;
      rowsSvg.push(
        html`<g><rect x="${x1}" y="${yy}" width="${Math.max(2, x2 - x1)}" height="${RH - 6}" rx="2" class="tl-bar ${colorOf(j)}${sch.crit.has(id) ? ' tl-crit' : ''}"></rect>${fitText(label, x2 - x1 - 8, 6) ? html`<text x="${x1 + 4}" y="${yy + 12}" class="tl-in">${fitText(label, x2 - x1 - 8, 6)}</text>` : ''}<title>${label} · ${tlWhen(r.s)} → ${tlWhen(r.e)} (${dur((r.e - r.s) / 1000)})${r.why === 'slot' ? ' · ' + T('slotra vár') : r.why === 'bp' ? ' · ' + T('a BP másik jobban van') : r.why === 'mat' ? ' · ' + T('anyagra vár') : r.why === 'active' ? ' · ' + T('az aktív időszakra vár') : ''}${sch.crit.has(id) ? ' · ' + T('kritikus út') : ''}</title></g>`
      );
    }
    y += nRows * RH + 6;
  }
  // time axis
  const day = 24 * HOUR;
  // the smallest step that leaves room for its label
  const pxPerMs = PW / span;
  const step =
    [HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, day, 2 * day, 7 * day, 14 * day, 30 * day].find(
      s => s * pxPerMs >= 70
    ) || 30 * day;
  const ticks = [];
  const first = new Date(inp.t0);
  first.setMinutes(0, 0, 0);
  // ticks on round hours of the day (00, 06, 12…), so midnight gets its date
  if (step >= day) first.setHours(0);
  else first.setHours(Math.floor(first.getHours() / (step / HOUR)) * (step / HOUR));
  for (let t = first.getTime() + step; t < end; t += step) {
    const xx = x(t);
    if (t <= inp.t0 || xx > PW - 36) continue; // before the start, or no room for the label at the right edge
    const lab = new Date(t).toLocaleString(
      LOC(),
      step >= day || new Date(t).getHours() === 0
        ? { month: '2-digit', day: '2-digit' }
        : { hour: '2-digit', minute: '2-digit' }
    );
    ticks.push(
      html`<line x1="${xx}" x2="${xx}" y1="${TOP - 4}" y2="${y}" class="tl-tick"></line><text x="${xx + 2}" y="${TOP - 8}" class="tl-small">${lab}</text>`
    );
  }
  const none = [...sch.rows.values()].filter(r => r.s == null).length;
  const H2 = y + 4;
  const labels = html`<svg class="tl tl-labels" width="${LABW}" height="${H2}" viewBox="0 0 ${LABW} ${H2}">${hjoin(labSvg, '')}</svg>`;
  const svg = html`<svg class="tl" width="${W}" height="${H2}" viewBox="0 0 ${W} ${H2}" role="img" aria-label="${T('Idővonal')}">${hjoin(ticks, '')}${hjoin(rowsSvg, '')}<line x1="${x(sch.end)}" x2="${x(sch.end)}" y1="${TOP - 4}" y2="${y}" class="tl-end"></line></svg>`;
  const zoom = html`<div class="row tlzoom small"><button class="btn mini" data-tlzoom="out" title="${T('Kicsinyítés')}" ${TL_ZOOM <= 1 ? 'disabled' : ''}>−</button><button class="btn mini" data-tlzoom="in" title="${T('Nagyítás')}" ${TL_ZOOM >= TL_ZOOM_MAX ? 'disabled' : ''}>+</button><button class="btn mini" data-tlzoom="fit" ${TL_ZOOM === 1 ? 'disabled' : ''}>${T('Egész')}</button><span class="muted">${TL_ZOOM > 1 ? '×' + TL_ZOOM + ' · ' : ''}${T('Ctrl + görgő: nagyítás az egér körül')}</span></div>`;
  return html`<h3>${T('Idővonal')}</h3>${timelineSummary(R, T0, sch, now, none)}${zoom}<div class="tlwrap">${labels}<div class="tlscroll">${svg}</div></div>${timelineSettings(R)}`;
}

function timelineSummary(R, T0, sch, now, none) {
  const { inp, unknown, lead } = T0;
  const win = inp.win;
  const assume = [
    T('kezdés: {0}', inp.t0 > now + 60e3 ? tlWhen(inp.t0) : T('most')),
    win ? T('jobot indítasz: {0}–{1} óra között', win.from, win.to) : T('jobot bármikor indítasz'),
    T('beszerzés: {0}', lead ? dur(lead / 1000) : T('azonnal')),
    unknown.haul ? T('fuvar: egy útvonal ideje nem ismert, 0-val számolva') : T('fuvar: a Szállítás becslése')
  ];
  const left = sch.end - now;
  return html`<p><b>${T('Kész: {0}', tlWhen(sch.end))}</b> <span class="muted">(${T('{0} múlva', dur(Math.max(0, left) / 1000))})</span>${none ? html` <span class="pill bad">${T('{0} job nem fér el: nincs hozzá szabad slot (tartalék?)', none)}</span>` : ''}</p><p class="small muted">${T('Valódi slotokkal: a futó jobok a lejártukig foglalnak egy slotot. A tömör sáv a gyártás ideje, a sraffozott a becsült várakozás anyagra (vásárlás, fuvar). A vastag keretes sávok a kritikus út: ezeken múlik a befejezés. Feltételezések:')} ${assume.join(' · ')}.</p>`;
}

function timelineSettings(R) {
  const lanes = [...new Set(R.jobs.map(j => (j.who != null ? j.who : j.bp.cid) + '|' + slotKey(j.act)))];
  const res = S.slotRes || {};
  const win = tlWindow();
  const hours = Array.from({ length: 25 }, (_, i) => i);
  return html`<details class="tlset"><summary class="small">${T('Idővonal beállításai')}</summary><div class="row" style="margin-top:6px"><label>${T('Kezdés')} <input type="datetime-local" data-tl="start" value="${S.tlStart || ''}"></label><label>${T('Jobot indítok (óra)')} <span class="row" style="gap:4px"><select data-tl="from"><option value="">${T('bármikor')}</option>${hjoin(
    hours.slice(0, 24).map(h => html`<option value="${h}" ${win && win.from === h ? 'selected' : ''}>${h}</option>`),
    ''
  )}</select>–<select data-tl="to">${hjoin(
    hours
      .slice(1)
      .map(
        h =>
          html`<option value="${h}" ${win ? (win.to === h ? 'selected' : '') : h === 24 ? 'selected' : ''}>${h}</option>`
      ),
    ''
  )}</select></span></label><label>${T('Beszerzés ideje (óra)')} <input type="number" min="0" step="1" data-tl="lead" value="${S.tlBuyLead ?? ''}" style="width:80px"></label></div><div class="row" style="margin-top:6px">${hjoin(
    lanes.map(l => {
      const [cid, k] = l.split('|');
      const tot = slotsOf(Number(cid))[k];
      return html`<label>${charName(Number(cid))} · ${T(TL_KIND[k])}: ${T('tartalék slot (összesen {0})', tot)} <input type="number" min="0" max="${tot}" step="1" data-tlres="${l}" value="${res[l] ?? ''}" style="width:70px"></label>`;
    }),
    ''
  )}</div></details>`;
}

// the timeline's settings only redraw the timeline (no new calculation)
function bindTimeline(el, R) {
  const box = el.querySelector('.tlbox');
  if (!box) return;
  // keep: the settings panel open, and the time under the given point (fraction of the visible width) in place
  const redraw = (keepAt = 0.5) => {
    const open = box.querySelector('details.tlset') && box.querySelector('details.tlset').open;
    const sc = box.querySelector('.tlscroll');
    const frac = sc && sc.scrollWidth ? (sc.scrollLeft + sc.clientWidth * keepAt) / sc.scrollWidth : 0;
    setHtml(box, renderTimeline(R));
    if (open) box.querySelector('details.tlset').open = true;
    const sc2 = box.querySelector('.tlscroll');
    if (sc2 && sc2.scrollWidth) sc2.scrollLeft = frac * sc2.scrollWidth - sc2.clientWidth * keepAt;
    bindTimeline(el, R);
  };
  const zoomTo = (z, keepAt) => {
    z = Math.min(TL_ZOOM_MAX, Math.max(1, z));
    if (z === TL_ZOOM) return;
    TL_ZOOM = z;
    redraw(keepAt);
  };
  // drawn for another width (first time, or the window changed): draw again for this one
  const wNow = box.clientWidth;
  if (wNow && Math.abs(wNow - TL_WIDTH) > 4) {
    TL_WIDTH = wNow;
    return redraw();
  }
  box.querySelectorAll('[data-tlzoom]').forEach(b =>
    b.addEventListener('click', () => {
      const a = b.dataset.tlzoom;
      zoomTo(a === 'fit' ? 1 : a === 'in' ? TL_ZOOM * 2 : TL_ZOOM / 2);
    })
  );
  const sc = box.querySelector('.tlscroll');
  if (sc)
    sc.addEventListener(
      'wheel',
      e => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const r = sc.getBoundingClientRect();
        zoomTo(e.deltaY < 0 ? TL_ZOOM * 2 : TL_ZOOM / 2, r.width ? (e.clientX - r.left) / r.width : 0.5);
      },
      { passive: false }
    );
  box.querySelectorAll('[data-tl]').forEach(inp =>
    inp.addEventListener('change', () => {
      const k = inp.dataset.tl;
      if (k === 'start') setSetting('tlStart', inp.value || '');
      else if (k === 'lead')
        setSetting('tlBuyLead', inp.value === '' ? '' : String(Math.max(0, Number(inp.value) || 0)));
      else {
        const f = box.querySelector('[data-tl="from"]').value,
          t = box.querySelector('[data-tl="to"]').value;
        setSetting('tlActive', f === '' ? '' : f + '-' + t);
      }
      redraw();
    })
  );
  box.querySelectorAll('[data-tlres]').forEach(inp =>
    inp.addEventListener('change', () => {
      const v = inp.value === '' ? null : String(Math.max(0, Math.round(Number(inp.value) || 0)));
      setSettingIn('slotRes', inp.dataset.tlres, v === '0' ? null : v);
      redraw();
    })
  );
}
