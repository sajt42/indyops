/* IndyOps – Where to buy: manual prices, and a search of the sell orders in the regions picked in Settings. */
'use strict';

/* ---- price sources of a material ----
 * 1. manual price (S.manPrice[type] = ISK per unit): bought outside the market, not in the haul list
 * 2. a station picked from the market search (S.buySrc[type] = station id): as much as its sell orders give,
 *    cheapest first; the rest comes from the default source
 * 3. default: Jita (buyAt)
 */
const MKT = {}; // type -> { at, orders: [{l, sys, p, v}] } sell orders in the picked regions (memory only)
const MKT_TTL = 10 * 60000;
const mktRegions = () => (Array.isArray(S.mktRegions) ? S.mktRegions.map(Number).filter(Boolean) : [JITA_REGION]);
const manPrice = t => {
  const v = S.manPrice && S.manPrice[t];
  return v > 0 ? v : null;
};
const ordersAt = (t, l) => (MKT[t] ? MKT[t].orders.filter(o => o.l === l).sort((a, b) => a.p - b.p) : []);
// buys q from the orders, cheapest first: {q: bought, cost}
function fillFrom(orders, q) {
  let got = 0,
    cost = 0;
  for (const o of orders) {
    if (got >= q) break;
    const k = Math.min(o.v, q - got);
    got += k;
    cost += k * o.p;
  }
  return { q: got, cost };
}
// where q units of t come from: [{l, q, p, src}] (l null: manual, not hauled)
function buyParts(t, q) {
  const mp = manPrice(t);
  if (mp) return [{ l: null, q, p: mp, src: 'manual' }];
  const parts = [];
  let rest = q;
  const src = S.buySrc && S.buySrc[t];
  if (src) {
    const f = fillFrom(ordersAt(t, src), q);
    if (f.q > 0) {
      parts.push({ l: src, q: f.q, p: f.cost / f.q, src: 'market' });
      rest -= f.q;
    }
  }
  if (rest > 0) {
    parts.push({ l: buyAt(t), q: rest, p: unitPrice(t), src: 'default' });
  }
  return parts;
}
// unit price of buying t: the average over q units when q is given, otherwise the price of the first source
function buyPrice(t, q) {
  if (!q) {
    const mp = manPrice(t);
    if (mp) return mp;
    const src = S.buySrc && S.buySrc[t];
    const o = src ? ordersAt(t, src)[0] : null;
    if (o) return o.p;
    return unitPrice(t);
  }
  const parts = buyParts(t, q);
  if (parts.some(x => !x.p)) return null;
  return parts.reduce((s, x) => s + x.q * x.p, 0) / q;
}
// average purchase price per material over the whole shopping list (null: no price)
function buyAvgMap(R) {
  return new Map([...R.buyList].map(([t, q]) => [t, buyPrice(t, q)]));
}
// short text of where t comes from
function buyFromText(t, q) {
  return buyParts(t, q)
    .map(x =>
      x.src === 'manual'
        ? T('kézi ár')
        : x.src === 'market'
          ? shortLoc(x.l) + (MKT_JUMPS[x.l] != null ? ' (' + T('{0} ugrás', MKT_JUMPS[x.l]) + ')' : '')
          : 'Jita'
    )
    .join(' + ');
}
// station name without the corporation part ("Isinokka V - Moon 10"); the full name goes in the title
const shortLoc = l => String(locName(l)).split(' - ').slice(0, 2).join(' - ');

/* ---- market search ---- */
const MKT_JUMPS = {}; // station -> jumps from the production location (last search)
async function regionOrders(region, t) {
  return (await esi('/markets/' + region + '/orders/?order_type=sell&type_id=' + t, { paged: true }))
    .filter(o => !o.is_buy_order)
    .map(o => ({ l: o.location_id, sys: o.system_id, p: o.price, v: o.volume_remain }));
}
async function loadMarket(types, force) {
  const regs = mktRegions();
  const now = Date.now();
  await Promise.all(
    types.map(async t => {
      if (!force && MKT[t] && now - MKT[t].at < MKT_TTL) return;
      const orders = [];
      for (const r of regs) {
        try {
          orders.push(...(await regionOrders(r, t)));
        } catch (e) {
          log('Piackereső (' + (NAMES[r] || r) + '): ' + e.message);
        }
      }
      // a player structure as second market: its own market (not in the regional orders)
      const m2 = m2On() ? Number(S.market2) : null;
      if (m2 && m2 > 1e12) {
        const b = await structBook(m2);
        const sys = LOCINFO[m2] && LOCINFO[m2].system;
        for (const o of (b && b.raw.get(t)) || [])
          if (!o.is_buy_order) orders.push({ l: m2, sys, p: o.price, v: o.volume_remain });
      }
      MKT[t] = { at: now, orders };
    })
  );
}
// the plan's production location (where the materials go)
function planHome(R) {
  const l = R.trees[0] ? prodLocOf(R.trees[0].tree) : null;
  return l != null ? { l, sys: LOCINFO[l] && LOCINFO[l].system } : null;
}
// candidate stations per material, cheaper than Jita and within the jump limit: {t, q, jita, cands:[{l, sys, q, p, save, n, hs}]}
async function mktSearch(R) {
  const bl = [...R.buyList].filter(([t]) => !manPrice(t));
  await loadMarket(
    bl.map(([t]) => t),
    true
  );
  const home = planHome(R);
  const maxJ = Number(S.mktMaxJumps) > 0 ? Number(S.mktMaxJumps) : 10;
  const hsOnly = S.mktHsOnly !== false;
  const out = [];
  const routes = new Map();
  const route = async sys => {
    if (!home || !home.sys || !sys) return null;
    if (!routes.has(sys)) routes.set(sys, ensureRoute(home.sys, sys));
    return routes.get(sys);
  };
  for (const [t, q] of bl) {
    const jita = unitPrice(t);
    const byLoc = new Map();
    for (const o of (MKT[t] && MKT[t].orders) || []) {
      if (o.l === JITA_STATION) continue;
      if (!byLoc.has(o.l)) byLoc.set(o.l, []);
      byLoc.get(o.l).push(o);
    }
    let cands = [...byLoc].map(([l, os]) => {
      os.sort((a, b) => a.p - b.p);
      const f = fillFrom(os, q);
      return { l, sys: os[0].sys, q: f.q, p: f.cost / f.q, best: os[0].p };
    });
    cands = cands
      .filter(c => !jita || c.p < jita)
      .sort((a, b) => a.p - b.p)
      .slice(0, 8);
    for (const c of cands) {
      const r = await route(c.sys);
      c.n = r ? r.n : null;
      c.hs = r ? r.hs : null;
      c.save = jita ? (jita - c.p) * c.q : null;
    }
    cands = cands
      .filter(c => c.n == null || c.n <= maxJ)
      .filter(c => !hsOnly || c.hs === true)
      .slice(0, 3);
    for (const c of cands) MKT_JUMPS[c.l] = c.n;
    out.push({ t, q, jita, cands });
  }
  const locs = new Set(out.flatMap(x => x.cands.map(c => c.l)));
  const char = CHARS[0];
  for (const l of locs) await resolveLoc(l, char);
  await resolveNames(out.flatMap(x => x.cands.map(c => c.sys)));
  return { home, rows: out, maxJ, hsOnly };
}
function mktHtml(res) {
  const regs = mktRegions()
    .map(r => NAMES[r] || r)
    .join(', ');
  const rows = res.rows.filter(x => x.cands.length || (S.buySrc && S.buySrc[x.t]));
  return html`<div class="notice" style="margin-top:10px"><p class="small">${T(
    'Keresés: {0}; legfeljebb {1} ugrás {2} innen: {3}. A közeli ár az order book átlaga a szükséges mennyiségre; ami ott nem kapható, az a Jitáról jön.',
    regs,
    res.maxJ,
    res.hsOnly ? T('highsec úton') : '',
    res.home ? locName(res.home.l) : '?'
  )}</p></div>${
    rows.length
      ? html`<div class="tablewrap"><table><thead><tr><th>Tárgy</th><th class="num">Kell</th><th class="num">Jita</th><th>Hol</th><th class="num">Ugrás</th><th class="num">Kapható</th><th class="num">Átlagár</th><th class="num">Megtakarítás</th><th></th></tr></thead><tbody>${rows.map(
          x =>
            html`${x.cands.map(
              (c, i) =>
                html`<tr><td>${i ? '' : NAMES[x.t] || x.t}</td><td class="num">${i ? '' : fmt(x.q)}</td><td class="num">${i ? '' : isk(x.jita)}</td><td class="small">${locName(c.l)}${c.l > 1e12 ? html` <span class="pill warn">${T('struktúra: dokkolási jog kell')}</span>` : ''}</td><td class="num">${c.n != null ? fmt(c.n) : '?'}${c.hs === true ? '' : c.hs === false ? html` <span class="pill warn">ls/ns</span>` : ''}</td><td class="num">${fmt(c.q)}${c.q < x.q ? html`<div class="src">${T('a többi Jitáról')}</div>` : ''}</td><td class="num">${isk(c.p)}</td><td class="num pos">${c.save != null ? isk(c.save) : '–'}</td><td>${
                  S.buySrc && S.buySrc[x.t] === c.l
                    ? html`<span class="pill ok">${T('innen')}</span> <button class="btn mini" data-mktpick="${x.t}|">${T('vissza')}</button>`
                    : html`<button class="btn mini" data-mktpick="${x.t}|${c.l}">${T('Innen veszem')}</button>`
                }</td></tr>`
            )}`
        )}</tbody></table></div>`
      : html`<p class="small muted">${T('Nincs a Jitánál olcsóbb ajánlat a megadott régiókban és távolságon belül.')}</p>`
  }`;
}

// shopping list controls: manual price fields, the market search button and the "buy here" buttons
function bindBuySources(el, R) {
  el.querySelectorAll('[data-manp]').forEach(i =>
    i.addEventListener('change', () => {
      const t = Number(i.dataset.manp),
        v = Number(i.value);
      if (!S.manPrice) S.manPrice = {};
      if (i.value !== '' && v > 0) S.manPrice[t] = v;
      else delete S.manPrice[t];
      saveS();
      LASTRENDER && LASTRENDER();
    })
  );
  const btn = el.querySelector('[data-mktsearch]');
  const out = el.querySelector('.mktout');
  const show = res => {
    setHtml(out, mktHtml(res));
    out.querySelectorAll('[data-mktpick]').forEach(b =>
      b.addEventListener('click', () => {
        const [t, l] = b.dataset.mktpick.split('|');
        if (!S.buySrc) S.buySrc = {};
        if (l) S.buySrc[t] = Number(l);
        else delete S.buySrc[t];
        saveS();
        R.mkt = res;
        LASTRENDER && LASTRENDER();
      })
    );
  };
  if (R.mkt && out) show(R.mkt);
  btn &&
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setHtml(out, html`<p class="small muted">${T('Keresés…')}</p>`);
      try {
        R.mkt = await mktSearch(R);
        show(R.mkt);
      } catch (e) {
        setHtml(out, html`<div class="notice err"><p>${e.message}</p></div>`);
      }
      btn.disabled = false;
    });
}

/* ---- Settings: regions to search, manual prices and picked sources ---- */
let REGIONS = load('regions', null); // k-space region ids
async function ensureRegions() {
  if (!REGIONS) {
    const ids = await esi('/universe/regions/');
    REGIONS = ids.filter(id => id < 11000000);
    store('regions', REGIONS);
  }
  await resolveNames(REGIONS);
  return REGIONS;
}
function renderMktSettings() {
  const box = $('#sMktRegions');
  if (!box) return;
  const sel = new Set(mktRegions());
  const draw = () => {
    const ids = (REGIONS || [...sel])
      .slice()
      .sort((a, b) => String(NAMES[a] || a).localeCompare(String(NAMES[b] || b)));
    setHtml(
      box,
      html`<details${sel.size > 1 ? '' : html` open`}><summary>${T('Régiók a kereséshez ({0} kijelölve): {1}', sel.size, [...sel].map(r => NAMES[r] || r).join(', '))}</summary><div class="regionlist">${ids.map(
        r =>
          html`<label class="inline"><input type="checkbox" data-mreg="${r}"${sel.has(r) ? html` checked` : ''}> ${NAMES[r] || r}</label>`
      )}</div></details>`
    );
    box.querySelectorAll('[data-mreg]').forEach(c =>
      c.addEventListener('change', () => {
        const r = Number(c.dataset.mreg);
        if (c.checked) sel.add(r);
        else sel.delete(r);
        S.mktRegions = [...sel];
        saveS();
        draw();
      })
    );
  };
  draw();
  if (!REGIONS || REGIONS.some(r => !NAMES[r]))
    ensureRegions()
      .then(draw)
      .catch(e => log('Régiók: ' + e.message));
  renderBuyLists();
}
function renderBuyLists() {
  const box = $('#sBuyLists');
  if (!box) return;
  const man = Object.entries(S.manPrice || {});
  const src = Object.entries(S.buySrc || {});
  setHtml(
    box,
    html`${
      man.length
        ? html`<p class="small"><b>${T('Kézi árak')}</b>: ${hjoin(
            man.map(([t, p]) => html`${NAMES[t] || t} ${isk(p)} <button class="btn mini" data-unman="${t}">×</button>`),
            ' · '
          )}</p>`
        : ''
    }${
      src.length
        ? html`<p class="small"><b>${T('Kiválasztott beszerzési helyek')}</b>: ${hjoin(
            src.map(
              ([t, l]) => html`${NAMES[t] || t}: ${locName(l)} <button class="btn mini" data-unsrc="${t}">×</button>`
            ),
            ' · '
          )}</p>`
        : ''
    }`
  );
  box.querySelectorAll('[data-unman]').forEach(b =>
    b.addEventListener('click', () => {
      delete S.manPrice[b.dataset.unman];
      saveS();
      renderBuyLists();
    })
  );
  box.querySelectorAll('[data-unsrc]').forEach(b =>
    b.addEventListener('click', () => {
      delete S.buySrc[b.dataset.unsrc];
      saveS();
      renderBuyLists();
    })
  );
}
