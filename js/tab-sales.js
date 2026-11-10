/* IndyOps – Selling tab: active market orders, undercuts, sales history. */
'use strict';
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
