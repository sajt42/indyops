/* IndyOps – EVE SSO login (PKCE), ESI requests, name and location lookups, character data. */
'use strict';
/* ============ PKCE / SSO ============ */
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
function randStr(n = 48) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return b64url(a);
}
async function sha256(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
}
function callbackUrl() {
  return HOSTED ? APP.home : CALLBACK_LOCAL;
}
function clientId() {
  return (S.clientId || '').trim() || (HOSTED ? APP.clientId : '');
}
async function startLogin() {
  const cid = clientId();
  if (!cid) {
    alertBox('Előbb add meg a Client ID-t.');
    return;
  }
  const verifier = randStr(48),
    state = randStr(16);
  store('pkce', { verifier, state, cid });
  const u = new URL('https://login.eveonline.com/v2/oauth/authorize');
  u.search = new URLSearchParams({
    response_type: 'code',
    redirect_uri: callbackUrl(),
    client_id: cid,
    scope: scopesNeeded().join(' '),
    code_challenge: b64url(await sha256(verifier)),
    code_challenge_method: 'S256',
    state
  }).toString();
  if (HOSTED) {
    location.assign(u.toString());
    return;
  } // on the web: same tab, CCP redirects back here
  $('#authLink').href = u.toString();
  $('#loginPaste').hidden = false;
  $('#cbPaste').value = '';
  window.open(u.toString(), '_blank', 'noopener');
}
function jwtPayload(t) {
  const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(decodeURIComponent(escape(atob(p + '='.repeat((4 - (p.length % 4)) % 4)))));
}
let ESI_TIMEOUT = 30000,
  ESI_BACKOFF = 1000; // tests may shorten these
async function tokenCall(params) {
  // timeout here too: a stuck token request must not hold up every call waiting for it
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), ESI_TIMEOUT);
  let r, txt;
  try {
    r = await fetch('https://login.eveonline.com/v2/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
      signal: ac.signal
    });
    txt = await r.text();
  } catch (e) {
    throw new Error(T('Token hiba: {0}', e.name === 'AbortError' ? T('időtúllépés') : T('hálózati hiba')));
  } finally {
    clearTimeout(to);
  }
  let j = null;
  try {
    j = JSON.parse(txt);
  } catch (e) {}
  if (!r.ok || !j || !j.access_token)
    throw new Error(
      T('Token hiba ({0}): {1}', r.status, (j && (j.error_description || j.error)) || T('ismeretlen válasz'))
    );
  return j;
}
async function finishLogin() {
  const raw = $('#cbPaste').value.trim();
  let u;
  try {
    u = new URL(raw);
  } catch (e) {
    alertBox('Ez nem egy teljes cím. A címsorból másold ki, https://localhost/callback?code=… kezdettel.');
    return;
  }
  await completeLogin(u.searchParams.get('code'), u.searchParams.get('state'));
}
async function completeLogin(code, state) {
  const pk = load('pkce', null);
  if (!code || !pk) {
    alertBox('Nem találok kódot a címben. Kezdd újra a karakter hozzáadását.');
    return;
  }
  if (state !== pk.state) {
    alertBox('A cím egy korábbi bejelentkezéshez tartozik. Kezdd újra a karakter hozzáadását.');
    return;
  }
  status('bejelentkezés…');
  try {
    const cid = pk.cid || clientId();
    const j = await tokenCall({ grant_type: 'authorization_code', code, client_id: cid, code_verifier: pk.verifier });
    const p = jwtPayload(j.access_token);
    const id = Number(String(p.sub).split(':').pop());
    const c = {
      id,
      name: p.name,
      refresh: j.refresh_token,
      access: j.access_token,
      exp: Date.now() + j.expires_in * 1000,
      scp: scpOf(j.access_token),
      cid
    };
    CHARS = CHARS.filter(x => x.id !== id).concat(c);
    store('chars', CHARS);
    store('pkce', null);
    $('#loginPaste').hidden = true;
    renderChars();
    log('Bejelentkezve: ' + c.name);
    await refreshChar(c);
  } catch (e) {
    alertBox(e.message);
    log(e.message);
  }
  status('kész');
}
async function handleRedirect() {
  // on the web CCP redirects back here with ?code=…&state=…
  if (!HOSTED) return;
  const q = new URLSearchParams(location.search);
  const code = q.get('code'),
    state = q.get('state');
  if (!code) return;
  try {
    history.replaceState(null, '', APP.home);
  } catch (e) {}
  await completeLogin(code, state);
}
// one token refresh per character at a time; parallel requests wait for the same one
const TOKREF = new Map();
async function accessToken(c) {
  if (c.access && c.exp > Date.now() + 60000) return c.access;
  if (TOKREF.has(c.id)) return TOKREF.get(c.id);
  const p = (async () => {
    const j = await tokenCall({
      grant_type: 'refresh_token',
      refresh_token: c.refresh,
      client_id: c.cid || clientId()
    });
    c.access = j.access_token;
    c.exp = Date.now() + j.expires_in * 1000;
    c.scp = scpOf(j.access_token);
    if (j.refresh_token) c.refresh = j.refresh_token;
    store('chars', CHARS);
    return c.access;
  })();
  TOKREF.set(c.id, p);
  try {
    return await p;
  } finally {
    TOKREF.delete(c.id);
  }
}

/* ============ network ============ */
let inflight = 0;
const queue = [];
function limit(fn) {
  return new Promise((res, rej) => {
    const run = async () => {
      inflight++;
      try {
        res(await fn());
      } catch (e) {
        rej(e);
      } finally {
        inflight--;
        const n = queue.shift();
        if (n) n();
      }
    };
    inflight < 6 ? run() : queue.push(run);
  });
}
// EVE Ref static CDN: separate, higher concurrency so it does not take ESI slots
let refIn = 0;
const refQ = [];
function refLimit(fn) {
  return new Promise((res, rej) => {
    const run = async () => {
      refIn++;
      try {
        res(await fn());
      } catch (e) {
        rej(e);
      } finally {
        refIn--;
        const n = refQ.shift();
        if (n) n();
      }
    };
    refIn < 16 ? run() : refQ.push(run);
  });
}
async function fetchT(u, ms = 30000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(u, { signal: ac.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('időtúllépés: ' + u);
    throw e;
  } finally {
    clearTimeout(t);
  }
}
async function esi(path, { char, method = 'GET', body, paged = false, meta = false } = {}) {
  const go = async page =>
    limit(async () => {
      const u = new URL(ESI + path);
      u.searchParams.set('datasource', 'tranquility');
      if (page) u.searchParams.set('page', page);
      const h = { Accept: 'application/json' };
      if (body) h['Content-Type'] = 'application/json';
      if (char) h.Authorization = 'Bearer ' + (await accessToken(char));
      for (let attempt = 0; attempt < 3; attempt++) {
        // timeout covers the whole response (headers + body): a stuck request must not hold a slot forever;
        // retried on timeout, network error and broken body
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), ESI_TIMEOUT);
        let res = null,
          httpErr = null;
        try {
          const r = await fetch(u, {
            method,
            headers: h,
            body: body ? JSON.stringify(body) : undefined,
            signal: ac.signal
          });
          const rem = r.headers.get('x-esi-error-limit-remain');
          if (r.ok) {
            const data = await r.json();
            res = {
              data,
              pages: Number(r.headers.get('x-pages') || 1),
              lm: Date.parse(r.headers.get('last-modified') || '') || null,
              exp: Date.parse(r.headers.get('expires') || '') || null
            };
          } else {
            const t = await r.text();
            httpErr = { status: r.status, t };
          }
          if (rem != null && Number(rem) < 20) {
            log('ESI hibakeret alacsony (' + rem + '), várakozás…');
            await new Promise(z => setTimeout(z, 5000));
          }
        } catch (e) {
          clearTimeout(to);
          const msg = e.name === 'AbortError' ? 'időtúllépés (' + ESI_TIMEOUT / 1000 + ' s)' : 'hálózati hiba';
          if (attempt < 2) {
            await new Promise(z => setTimeout(z, ESI_BACKOFF * (attempt + 1)));
            continue;
          }
          const er = new Error('ESI ' + msg + ' ' + path);
          er.status = 0;
          throw er;
        }
        clearTimeout(to);
        if (res) return res;
        if (httpErr.status >= 500 && attempt < 2) {
          await new Promise(z => setTimeout(z, ESI_BACKOFF * (attempt + 1)));
          continue;
        }
        const e = new Error('ESI ' + httpErr.status + ' ' + path + ': ' + httpErr.t.slice(0, 140));
        e.status = httpErr.status;
        throw e;
      }
    });
  if (!paged) {
    const r = await go(0);
    return meta ? { data: r.data, lm: r.lm, exp: r.exp } : r.data;
  }
  const first = await go(1);
  let all = first.data;
  if (first.pages > 1) {
    const rest = await Promise.all(Array.from({ length: first.pages - 1 }, (_, i) => go(i + 2)));
    rest.forEach(x => (all = all.concat(x.data)));
  }
  return meta ? { data: all, lm: first.lm, exp: first.exp } : all;
}
async function refGet(kind, id) {
  // kind 't' types, 'b' blueprints
  const c = REFC[kind][id];
  if (c !== undefined) return c;
  const path = kind === 't' ? '/types/' : '/blueprints/';
  const j = await refLimit(async () => {
    const r = await fetchT(REF + path + id);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('EVE Ref ' + r.status + ' ' + path + id);
    return r.json();
  });
  let v = null;
  if (j && kind === 't') {
    v = {
      n: j.name && (j.name.en || j.name),
      g: j.group_id,
      c: j.category_id,
      p: j.portion_size || 1,
      vol: j.packaged_volume || j.volume || 0,
      pb: Object.values(j.produced_by_blueprints || {}).map(x => [x.blueprint_type_id, x.blueprint_activity]),
      tm: Object.values(j.type_materials || {}).map(x => [x.material_type_id, x.quantity]),
      rs: j.dogma_attributes && j.dogma_attributes['790'] ? j.dogma_attributes['790'].value : null
    };
    if (v.n) NAMES[id] = v.n;
  } else if (j && kind === 'b') {
    const a = j.activities || {};
    const conv = x =>
      x
        ? {
            t: x.time || 0,
            m: Object.values(x.materials || {}).map(y => [y.type_id, y.quantity]),
            p: Object.values(x.products || {}).map(y => [y.type_id, y.quantity, y.probability]),
            rs: x.required_skills || {}
          }
        : null;
    v = {
      m: conv(a.manufacturing),
      r: conv(a.reaction),
      i: conv(a.invention),
      ct: a.copying ? a.copying.time : 0,
      rme: a.research_material ? a.research_material.time : 0,
      rte: a.research_time ? a.research_time.time : 0,
      lim: j.max_production_limit || 0
    };
  }
  REFC[kind][id] = v;
  scheduleSave('ref');
  return v;
}
const saveTimers = {};
function scheduleSave(k) {
  clearTimeout(saveTimers[k]);
  saveTimers[k] = setTimeout(() => {
    if (k === 'ref') store('ref', REFC);
    if (k === 'names') store('names', NAMES);
  }, 800);
}

/* ============ names and locations ============ */
async function resolveNames(ids) {
  const need = [...new Set(ids.map(Number))].filter(i => i && NAMES[i] == null && i < 1e12);
  for (let i = 0; i < need.length; i += 900) {
    const chunk = need.slice(i, i + 900);
    try {
      (await esi('/universe/names/', { method: 'POST', body: chunk })).forEach(x => (NAMES[x.id] = x.name));
    } catch (e) {
      // one bad id spoils the batch -> retry in smaller pieces
      if (chunk.length > 1) {
        const h = Math.ceil(chunk.length / 2);
        await resolveNames(chunk.slice(0, h));
        await resolveNames(chunk.slice(h));
      } else NAMES[chunk[0]] = '#' + chunk[0];
    }
  }
  scheduleSave('names');
}
// reprocess data of an NPC station: efficiency (e.g. 0.5), base tax (e.g. 0.05), whether it has a reprocessing service
function stationRepro(s) {
  return {
    owner: s.owner ?? null,
    reff: s.reprocessing_efficiency ?? null,
    rtake: s.reprocessing_stations_take ?? null,
    rsvc: Array.isArray(s.services) ? s.services.includes('reprocessing-plant') : null
  };
}
async function resolveLoc(locId, char) {
  const old = LOCINFO[locId];
  if (old && !(unkInfo(old) && Date.now() - (old.tried || 0) > 6 * 3600000)) return old;
  let info = { name: 'Ismeretlen hely #' + locId, system: null, unk: 1, tried: Date.now() };
  try {
    if (locId >= 60000000 && locId < 64000000) {
      const s = await esi('/universe/stations/' + locId + '/');
      info = Object.assign({ name: s.name, system: s.system_id }, stationRepro(s));
    } else if (locId >= 30000000 && locId < 33000000) {
      await resolveNames([locId]);
      info = { name: (NAMES[locId] || locId) + ' (űrben)', system: locId };
    } else if (locId > 1e12) {
      for (const c of (char ? [char] : []).concat(CHARS)) {
        try {
          const s = await esi('/universe/structures/' + locId + '/', { char: c });
          info = { name: s.name, system: s.solar_system_id, stype: s.type_id || 0 };
          break;
        } catch (e) {}
      }
    }
  } catch (e) {
    log('Hely feloldása sikertelen: ' + locId);
  }
  if (info.unk && old && old.ev) {
    old.tried = info.tried;
    info = old;
  }
  LOCINFO[locId] = info;
  store('locinfo', LOCINFO);
  return info;
}

/* ============ character data ============ */
async function refreshChar(c) {
  status(T('frissítés: {0}…', c.name));
  log('Adatok letöltése: ' + c.name);
  try {
    const [assets, bpm, skills, jobs] = await Promise.all([
      esi('/characters/' + c.id + '/assets/', { char: c, paged: true }),
      esi('/characters/' + c.id + '/blueprints/', { char: c, paged: true, meta: true }),
      esi('/characters/' + c.id + '/skills/', { char: c }),
      esi('/characters/' + c.id + '/industry/jobs/', { char: c })
    ]);
    const bps = bpm.data;
    const bpLM = bpm.lm,
      bpExp = bpm.exp;
    // root location: walk up the container chain
    const byItem = new Map(assets.map(a => [a.item_id, a]));
    const root = id => {
      let cur = id,
        guard = 0;
      while (byItem.has(cur) && guard++ < 10) cur = byItem.get(cur).location_id;
      return cur;
    };
    const contNames = {};
    const contIds = assets
      .filter(a => a.is_singleton && assets.some(b => b.location_id === a.item_id))
      .map(a => a.item_id);
    for (let i = 0; i < contIds.length; i += 900) {
      try {
        (
          await esi('/characters/' + c.id + '/assets/names/', {
            char: c,
            method: 'POST',
            body: contIds.slice(i, i + 900)
          })
        ).forEach(x => {
          if (x.name && x.name !== 'None') contNames[x.item_id] = x.name;
        });
      } catch (e) {}
    }
    const inC = id => (byItem.has(id) ? id : null); // direct container (if any)
    const A = assets
      .filter(a => !a.is_blueprint_copy)
      .map(a => ({
        t: a.type_id,
        q: a.quantity,
        l: root(a.location_id),
        f: a.location_flag,
        cn: contNames[a.location_id] || null,
        c: inC(a.location_id),
        s: a.is_singleton ? 1 : 0
      }));
    const B = bps.map(b => ({
      i: b.item_id,
      t: b.type_id,
      me: b.material_efficiency,
      te: b.time_efficiency,
      r: b.runs,
      q: b.quantity,
      l: root(b.location_id),
      cn: contNames[b.location_id] || null,
      c: inC(b.location_id)
    }));
    // containers (and ships with cargo): name, type, location, parent container
    const CONT = {};
    for (const id of contIds) {
      const a = byItem.get(id);
      CONT[id] = {
        n: contNames[id] || null,
        t: a.type_id,
        l: root(a.location_id),
        pc: inC(a.location_id),
        f: a.location_flag
      };
    }
    await Promise.all([...new Set(Object.values(CONT).map(x => x.t))].map(t => refGet('t', t).catch(() => null)));
    for (const x of Object.values(CONT)) {
      const ti = REFC.t[x.t];
      x.k = ti ? ti.c : null;
    }
    const LM = {};
    for (const a of assets) {
      if (byItem.has(a.location_id)) continue;
      const m = (LM[a.location_id] = LM[a.location_id] || { t: a.location_type, f: {} });
      m.f[a.location_flag] = (m.f[a.location_flag] || 0) + 1;
    }
    const SKL = {};
    (skills.skills || []).forEach(s => (SKL[s.skill_id] = s.active_skill_level));
    const J = jobs.map(j => ({
      act: j.activity_id,
      bp: j.blueprint_type_id,
      bpi: j.blueprint_id,
      runs: j.runs,
      start: j.start_date,
      end: j.end_date,
      loc: j.facility_id,
      prod: j.product_type_id,
      st: j.status
    }));
    // ESI may cache the blueprint list for up to an hour.
    // Jobs already delivered count too when the ESI snapshot is older than the delivery.
    // ESI lowers BPC runs only when the job is delivered; while it runs, or is ready but not delivered, the old number comes back.
    // So the runs of every job not yet delivered at the time of the ESI snapshot are subtracted.
    const mapJ = j => ({
      bpi: j.blueprint_id,
      act: j.activity_id,
      runs: j.runs,
      st: j.status,
      done: j.completed_date || null,
      id: j.job_id
    });
    let JA = jobs.map(mapJ);
    if (bpLM) {
      try {
        const all = await esi('/characters/' + c.id + '/industry/jobs/?include_completed=true', { char: c });
        const seen = new Set(JA.map(x => x.id));
        all.forEach(j => {
          if (!seen.has(j.job_id)) JA.push(mapJ(j));
        });
      } catch (e) {}
    }
    const openAt = (j, t) =>
      j.st === 'active' || j.st === 'ready' || j.st === 'paused' || (j.done && Date.parse(j.done) > t);
    for (const b of B) {
      if (!(b.r > 0)) continue;
      for (const j of JA) {
        if (j.bpi !== b.i || !(j.act === 1 || j.act === 8) || !bpLM) continue;
        if (openAt(j, bpLM)) {
          b.r = Math.max(0, b.r - j.runs);
          b.adj = (b.adj || 0) + j.runs;
        }
      }
    }
    let O = [],
      TX = [],
      IMP = null,
      STD = null;
    if (hasScope(c, 'esi-characters.read_standings.v1')) {
      try {
        STD = {};
        (await esi('/characters/' + c.id + '/standings/', { char: c })).forEach(x => (STD[x.from_id] = x.standing));
      } catch (e) {
        log('Standingek: ' + e.message);
      }
    }
    if (hasScope(c, 'esi-clones.read_implants.v1')) {
      try {
        IMP = await esi('/characters/' + c.id + '/implants/', { char: c });
        await resolveNames(IMP);
      } catch (e) {
        log('Implantok: ' + e.message);
      }
    }
    if (hasScope(c, 'esi-markets.read_character_orders.v1')) {
      try {
        O = (await esi('/characters/' + c.id + '/orders/', { char: c })).map(o => ({
          id: o.order_id,
          t: o.type_id,
          l: o.location_id,
          reg: o.region_id,
          p: o.price,
          rem: o.volume_remain,
          tot: o.volume_total,
          buy: !!o.is_buy_order,
          iss: o.issued,
          dur: o.duration
        }));
      } catch (e) {
        log('Orderek: ' + e.message);
      }
    }
    if (S.wallet && hasScope(c, WALLET_SCOPE)) {
      try {
        const lim = Date.now() - 30 * 86400000;
        TX = (await esi('/characters/' + c.id + '/wallet/transactions/', { char: c }))
          .filter(x => new Date(x.date).getTime() >= lim)
          .map(x => ({ d: x.date, t: x.type_id, q: x.quantity, p: x.unit_price, buy: x.is_buy, l: x.location_id }));
      } catch (e) {
        log('Wallet: ' + e.message);
      }
    }
    DATA[c.id] = {
      assets: A,
      bps: B,
      skills: SKL,
      jobs: J,
      orders: O,
      tx: TX,
      imp: IMP,
      std: STD,
      lm: LM,
      cont: CONT,
      bpAt: bpLM,
      bpExp: bpExp,
      dv: APP.dataVersion,
      at: Date.now()
    };
    await resolveNames(
      O.map(o => o.t).concat(
        TX.map(x => x.t),
        O.map(o => o.reg)
      )
    );
    for (const l of new Set(O.map(o => o.l))) await resolveLoc(l, c);
    await resolveNames(
      A.map(a => a.t).concat(
        B.map(b => b.t),
        J.map(j => j.bp)
      )
    );
    const locs = [
      ...new Set(
        A.map(a => a.l).concat(
          B.map(b => b.l),
          J.map(j => j.loc)
        )
      )
    ];
    for (const l of locs) await resolveLoc(l, c);
    if (!store('data', DATA))
      log('Figyelem: a böngésző tárhelye megtelt, az adatok csak a lap bezárásáig maradnak meg.');
    log(c.name + ': ' + A.length + ' tárgy, ' + B.length + ' blueprint, ' + J.length + ' job');
  } catch (e) {
    log('Hiba (' + c.name + '): ' + e.message);
    alertBox(T('Nem sikerült frissíteni: {0}. {1}', c.name, e.message));
  }
  status('kész');
  renderAll();
}
async function refreshAll() {
  for (const c of CHARS) await refreshChar(c);
  await everefLocs(true);
}
