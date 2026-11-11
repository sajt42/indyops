/* IndyOps – Constants, i18n engine, formatting, local storage, settings and state. */
'use strict';
/* ============ basics ============ */
const CALLBACK_LOCAL = 'https://localhost/callback';
const SCOPES = [
  'esi-assets.read_assets.v1',
  'esi-characters.read_blueprints.v1',
  'esi-skills.read_skills.v1',
  'esi-industry.read_character_jobs.v1',
  'esi-universe.read_structures.v1',
  'esi-markets.read_character_orders.v1',
  'esi-clones.read_implants.v1',
  'esi-markets.structure_markets.v1',
  'esi-characters.read_standings.v1'
];
const WALLET_SCOPE = 'esi-wallet.read_character_wallet.v1';
function scopesNeeded() {
  return S.wallet ? SCOPES.concat([WALLET_SCOPE]) : SCOPES.slice();
}
function scpOf(token) {
  try {
    const v = jwtPayload(token).scp;
    return Array.isArray(v) ? v : v ? [v] : [];
  } catch (e) {
    return [];
  }
}
const hasScope = (c, sc) => !!(c && c.scp && c.scp.includes(sc));
const ESI = 'https://esi.evetech.net/latest';
const REF = 'https://ref-data.everef.net';
const JITA_REGION = 10000002,
  JITA_STATION = 60003760;
const SK = {
  connections: 3359,
  diplomacy: 3357,
  industry: 3380,
  advInd: 3388,
  accounting: 16622,
  broker: 3446,
  repro: 3385,
  reproEff: 3389,
  massProd: 3387,
  advMassProd: 24625,
  massReac: 45748,
  advMassReac: 45749,
  science: 3402,
  labOp: 3406,
  advLabOp: 24624,
  metallurgy: 3409,
  research: 3403
};
const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
/* ============ language / i18n ============ */
const LANGS = {
  en: { loc: 'en-US', name: 'English', dur: ['d', 'h', 'm'] },
  de: { loc: 'de-DE', name: 'Deutsch', dur: ['T', 'h', 'min'] },
  hu: { loc: 'hu-HU', name: 'Magyar', dur: ['n', 'ó', 'p'] }
};
// dataVersion: raise it when a release reads new ESI data and users must refresh their characters (the app shows a banner)
const APP = {
  dataVersion: 3,
  name: 'IndyOps',
  version: '1.16.0',
  built: '2026-11-11',
  repo: 'sajt42/indyops',
  home: 'https://sajt42.github.io/indyops/',
  clientId: 'b02779a9ea1c427bb46c9d70a697a4c7',
  author: 'SajT'
};
const HOSTED =
  typeof location !== 'undefined' &&
  (location.href.split(/[?#]/)[0] === APP.home || location.href.split(/[?#]/)[0] === APP.home + 'index.html');
const SP = 'indyops.';
try {
  if (!localStorage.getItem(SP + 'settings')) {
    Object.keys(localStorage)
      .filter(k => k.startsWith('gyp.'))
      .forEach(k => localStorage.setItem(SP + k.slice(4), localStorage.getItem(k)));
  }
} catch (e) {} // take over data stored under the tool's old name (Gyártópult)
let LANG = (() => {
  try {
    const st = JSON.parse(localStorage.getItem(SP + 'settings') || '{}');
    if (st.lang && LANGS[st.lang]) return st.lang;
  } catch (e) {}
  const n = String(navigator.language || 'en')
    .slice(0, 2)
    .toLowerCase();
  return LANGS[n] ? n : 'en';
})();
const LOC = () => LANGS[LANG].loc;
const DICT = () => (window.I18N && window.I18N[LANG]) || {};
// T(text, ...args): translated text with {0}, {1}… filled in. It returns a plain string, except when the text itself is
// markup (written in this code base, e.g. '<b>{0} ugrás</b>') or an argument is an html`` template: then it returns
// an html`` result in which the text and the plain arguments are escaped.
function T(hu, ...a) {
  const tr = LANG === 'hu' ? hu : (DICT()[hu] ?? hu);
  if (!a.length) return /<[a-z]/i.test(hu) ? raw(tr) : tr;
  const markup = /<[a-z]/i.test(hu);
  if (markup || a.some(x => x instanceof SafeHtml)) {
    const parts = tr.split(/\{(\d+)\}/);
    let out = '';
    parts.forEach((p, i) => (out += i % 2 ? htmlPart(a[p] ?? '') : markup ? p : esc(p)));
    return new SafeHtml(out);
  }
  return tr.replace(/\{(\d+)\}/g, (m, i) => a[i] ?? '');
}
const NUMRE = /\d+(?:[   .,]\d+)*/g;
function trString(src) {
  if (LANG === 'hu') return src;
  const m = src.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const core = m[2].replace(/\s+/g, ' ');
  if (!core || !/[A-Za-zÀ-ž]/.test(core)) return src;
  const d = DICT();
  if (d[core] != null) return m[1] + d[core] + m[3];
  const nums = [];
  const key = core.replace(NUMRE, x => {
    nums.push(x);
    return '#';
  });
  const t = d[key];
  if (t == null) return src;
  let i = 0;
  return m[1] + t.replace(/#/g, () => nums[i++] ?? '') + m[3];
}
const I18N_SKIP = new Set(['SCRIPT', 'STYLE', 'CODE', 'TEXTAREA', 'OPTION_SKIP']);
function trText(n) {
  const p = n.parentNode;
  if (!p || I18N_SKIP.has(p.nodeName) || (p.closest && p.closest('[data-noi18n]'))) return;
  if (n.__hu === undefined || (n.nodeValue !== n.__tr && n.nodeValue !== n.__hu)) n.__hu = n.nodeValue;
  const out = trString(n.__hu);
  n.__tr = out;
  if (n.nodeValue !== out) n.nodeValue = out;
}
const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];
function trAttrs(el) {
  if (el.closest && el.closest('[data-noi18n]')) return;
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const k = 'data-hu-' + a;
    const cur = el.getAttribute(a);
    if (!el.hasAttribute(k) || (cur !== el.getAttribute(k) && cur !== el.__trA?.[a])) el.setAttribute(k, cur);
    const out = trString(el.getAttribute(k));
    el.__trA = el.__trA || {};
    el.__trA[a] = out;
    if (cur !== out) el.setAttribute(a, out);
  }
}
function trTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    trText(root);
    return;
  }
  if (root.nodeType !== 1) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) trText(n);
    else trAttrs(n);
  }
}
let I18N_OBS = null;
function startI18n() {
  trTree(document.body);
  document.documentElement.lang = LANG;
  if (I18N_OBS) return;
  I18N_OBS = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') {
        if (m.target.nodeValue !== m.target.__tr) trText(m.target);
      } else if (m.type === 'attributes') {
        trAttrs(m.target);
      } else m.addedNodes.forEach(trTree);
    }
  });
  I18N_OBS.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: I18N_ATTRS
  });
}
function updateHelpLang() {
  document
    .querySelectorAll('#tab-help [data-lang]')
    .forEach(
      d =>
        (d.hidden = d.dataset.lang !== (document.querySelector('#tab-help [data-lang="' + LANG + '"]') ? LANG : 'en'))
    );
}
function setLang(l) {
  if (!LANGS[l]) return;
  LANG = l;
  try {
    setSetting('lang', l);
  } catch (e) {}
  trTree(document.body);
  document.documentElement.lang = LANG;
  updateHelpLang();
  try {
    renderAll();
    LASTRENDER && LASTRENDER();
  } catch (e) {}
}
const fmt = (n, d = 0) =>
  n == null || isNaN(n) ? '–' : Number(n).toLocaleString(LOC(), { maximumFractionDigits: d, minimumFractionDigits: d });
const isk = n => {
  if (n == null || isNaN(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e9) return fmt(n / 1e9, 2) + ' B';
  if (a >= 1e6) return fmt(n / 1e6, 1) + ' M';
  if (a >= 1e3) return fmt(n / 1e3, 1) + ' k';
  return fmt(n, a < 100 ? 2 : 0);
};
// quantity in short form for running text: 4,2 M, 18,5 k, 950
const qtyShort = n => (Math.abs(n) >= 1e4 ? isk(n) : fmt(n));
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/* ---- HTML templates that escape by default ----
 * html`<td>${name}</td>` escapes every interpolated value. Exceptions, which are passed through as they are:
 * - another html`` result (SafeHtml), - an array (each element by the same rules), - null, undefined and false (nothing).
 * raw(s) marks markup written in this code base (never data) as safe; hjoin(list, sep) joins a list.
 * setHtml(el, h) (and appendHtml) is the only way to set innerHTML: a plain string is shown as text (and logged), so a view that was
 * not converted cannot inject markup.
 */
class SafeHtml {
  constructor(s) {
    this.s = s;
  }
  toString() {
    return this.s;
  }
}
const htmlPart = v =>
  v == null || v === false ? '' : v instanceof SafeHtml ? v.s : Array.isArray(v) ? v.map(htmlPart).join('') : esc(v);
function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += htmlPart(vals[i]) + strings[i + 1];
  return new SafeHtml(out);
}
const raw = s => new SafeHtml(String(s ?? ''));
// joins a list into one template; the separator follows the same rules as a value
// (an empty list gives '', so `hjoin(list) || '–'` works)
const hjoin = (list, sep) => (list.length ? new SafeHtml(list.map(htmlPart).join(htmlPart(sep))) : '');
// tests only (window.__htmlCheck): markup that ended up as visible text means a template was turned into a string
const TAGTEXT =
  /<\/?(div|span|td|tr|th|table|thead|tbody|label|input|p|b|i|a|details|summary|option|select|button|h[1-6]|ul|li|br|small|code)[\s>\/]/;
function htmlCheck(el) {
  const tw = document.createTreeWalker(el, 4);
  for (let n = tw.nextNode(); n; n = tw.nextNode())
    if (TAGTEXT.test(n.nodeValue)) console.warn('setHtml: markup shown as text: ' + n.nodeValue.trim().slice(0, 120));
}
// appends a template at the end of el (same rules as setHtml)
function appendHtml(el, h) {
  if (!el) return;
  const box = document.createElement('div');
  setHtml(box, h);
  el.append(...box.childNodes);
}
function setHtml(el, h) {
  if (!el) return;
  if (h instanceof SafeHtml) {
    el.innerHTML = h.s;
    if (globalThis.__htmlCheck) htmlCheck(el);
  } else if (h === '' || h == null) el.innerHTML = '';
  else {
    console.warn('setHtml: plain string shown as text');
    el.textContent = String(h ?? '');
  }
}
const dur = s => {
  s = Math.round(s);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  const u = LANGS[LANG].dur;
  return (d ? d + u[0] + ' ' : '') + (h || d ? h + u[1] + ' ' : '') + m + u[2];
};
function store(k, v) {
  try {
    localStorage.setItem(SP + k, JSON.stringify(v));
    return true;
  } catch (e) {
    log('Tárolási hiba (' + k + '): ' + e.message);
    storageWarn();
    return false;
  }
}
function storageWarn() {
  const el = document.getElementById('storageWarn');
  if (el) el.hidden = false;
}
function load(k, def) {
  try {
    const v = localStorage.getItem(SP + k);
    return v == null ? def : JSON.parse(v);
  } catch (e) {
    return def;
  }
}
function log(m) {
  const el = $('#log');
  el.textContent = new Date().toLocaleTimeString(LOC()) + '  ' + m + '\n' + el.textContent.slice(0, 20000);
}
function status(m) {
  $('#status').textContent = m;
}

let S = Object.assign(
  {
    clientId: '',
    structME: 0,
    structTE: 0,
    prodLoc: '',
    facTax: 0.25,
    scc: 4,
    salesTax: '',
    broker: '',
    yieldBase: 50,
    implant: 0,
    system: '',
    skillChar: null,
    locs: null,
    buyOverride: {},
    leave: {}
  },
  load('settings', {})
);
let CHARS = load('chars', []); // [{id,name,refresh,access,exp}]
let DATA = load('data', {}); // charId -> {assets,bps,skills,jobs,at}
/* ---- characters and their data ----
 * CHARS and DATA change only through these functions (tests/lint.js checks it). Removing a character raises its
 * generation, so a refresh that started before the removal cannot write its result back (setCharData).
 */
const CHARGEN = {};
const charGen = id => CHARGEN[id] || 0;
const charExists = id => CHARS.some(c => c.id == id);
// [charId, data] of the logged-in characters
const charEntries = () => Object.entries(DATA).filter(([cid]) => charExists(cid));
// adds a character, or replaces the one with the same id (login, restore)
function putChar(c) {
  CHARS = CHARS.filter(x => x.id !== c.id).concat(c);
  store('chars', CHARS);
}
// saves the token fields changed in place on a character
const saveChars = () => store('chars', CHARS);
function removeChar(id) {
  id = Number(id);
  CHARS = CHARS.filter(x => x.id !== id);
  delete DATA[id];
  CHARGEN[id] = charGen(id) + 1;
  store('chars', CHARS);
  store('data', DATA);
  charDataChanged();
}
// fn() runs after the data of a character changed (refresh stored, character removed)
const CHARDATA_LISTENERS = [];
let DATA_RECALC_DELAY = 1500; // ms after the last data change before results are calculated again
const onCharData = fn => CHARDATA_LISTENERS.push(fn);
function charDataChanged() {
  for (const fn of CHARDATA_LISTENERS)
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
}
// stores the result of a refresh started at generation gen: 'stale' if the character was removed meanwhile,
// 'full' if the browser storage is full (the data stays in memory), otherwise 'saved'
function setCharData(c, gen, d) {
  if (!charExists(c.id) || charGen(c.id) !== gen) return 'stale';
  DATA[c.id] = d;
  const r = store('data', DATA) ? 'saved' : 'full';
  charDataChanged();
  return r;
}
// data of removed characters left behind by versions before 1.14.3
if (Object.keys(DATA).some(id => !charExists(id))) {
  for (const id of Object.keys(DATA)) if (!charExists(id)) delete DATA[id];
  store('data', DATA);
}
let NAMES = load('names', {}); // id -> name
let LOCINFO = load('locinfo', {}); // locId -> {name,system}
let REFC = load('ref', { t: {}, b: {}, v3: 1 }); // everef cache
if (!REFC.v3) REFC = { t: REFC.t || {}, b: {}, v3: 1 }; // old cache: reload blueprints (they now carry invention/research data)
let PRICES = load('prices', { at: 0, p: {} }); // typeId -> {s,b,at}
let ADJ = load('adj', { at: 0, p: {} }); // adjusted prices
let IDX = load('idx2', { at: 0, p: {} }); // systemId -> {activity: cost index}
let ORES = load('ores', null); // [typeIds] category 25
const saveS = () => store('settings', S);
/* ---- settings: read anywhere, written only here ----
 * setSetting / setSettingIn check the value against SET_SCHEMA (the same check a restored backup goes through),
 * save it and announce the change to the onSetting listeners. tests/lint.js fails on any other write to S.
 */
// type of every setting; a key that is not listed here is not stored
const SET_SCHEMA = {
  clientId: 'str',
  system: 'str',
  lang: 'str',
  prodLoc: 'numOrEmpty',
  salesTax: 'numOrEmpty',
  broker: 'numOrEmpty',
  market2: 'numOrEmpty',
  structME: 'numOrEmpty',
  structTE: 'numOrEmpty',
  structRes: 'numOrEmpty',
  facTax: 'numOrEmpty',
  scc: 'numOrEmpty',
  yieldBase: 'numOrEmpty',
  implant: 'numOrEmpty',
  locs: 'numArrOrNull',
  workChars: 'numArrOrNull',
  wallet: 'bool',
  mktRegions: 'numArrOrNull',
  mktMaxJumps: 'num',
  mktHsOnly: 'bool',
  manPrice: 'mapNum',
  buySrc: 'mapNum',
  parallel: 'bool',
  parMode: 'str',
  srcShips: 'bool',
  buyOverride: 'mapBool',
  leave: 'mapBool', // 'from|to' -> true: stock at 'from' is left there when it would be hauled to 'to'
  locNames: 'mapStr',
  structBroker: 'mapNum',
  repro: 'repro'
};
const isNum = x => typeof x === 'number' && isFinite(x);
const isObj = x => x != null && typeof x === 'object' && !Array.isArray(x);
const isNumish = x => isNum(x) || (typeof x === 'string' && x.trim() !== '' && isFinite(Number(x)));
const everyValue = (o, f) => isObj(o) && Object.values(o).every(f);
// checks of the types SET_SCHEMA names
const SET_TYPES = {
  str: x => typeof x === 'string',
  num: isNumish,
  numOrEmpty: x => x === '' || x == null || isNumish(x),
  bool: x => typeof x === 'boolean',
  numArrOrNull: x => x === null || (Array.isArray(x) && x.every(isNum)),
  mapBool: x => everyValue(x, v => typeof v === 'boolean'),
  mapStr: x => everyValue(x, v => typeof v === 'string'),
  mapNum: x => everyValue(x, isNumish),
  repro: x =>
    isObj(x) &&
    (x.loc == null ||
      everyValue(x.loc, v => isObj(v) && Object.values(v).every(y => y === '' || y == null || isNumish(y)))) &&
    (x.imp == null || everyValue(x.imp, v => isNumish(v) || v === 'auto')) &&
    (x.char == null || x.char === '' || isNumish(x.char))
};
const SETTING_LISTENERS = [];
// fn(key) runs after a setting changed; key is '*' when all settings were replaced (restore)
const onSetting = fn => SETTING_LISTENERS.push(fn);
function settingChanged(key) {
  for (const fn of SETTING_LISTENERS)
    try {
      fn(key);
    } catch (e) {
      console.error(e);
    }
}
function setSetting(key, value) {
  const t = SET_SCHEMA[key];
  if (!t || !SET_TYPES[t](value)) {
    console.warn('setSetting: rejected ' + key);
    return false;
  }
  S[key] = value;
  saveS();
  settingChanged(key);
  return true;
}
// one entry of a map setting (manual prices, sources, location names…); null or undefined removes it
function setSettingIn(key, sub, value) {
  const m = Object.assign({}, S[key] || {});
  if (value == null) delete m[sub];
  else m[sub] = value;
  return setSetting(key, m);
}
// restore: the settings of a checked backup over the current ones
function replaceSettings(obj) {
  S = Object.assign({}, S, obj);
  saveS();
  settingChanged('*');
}
