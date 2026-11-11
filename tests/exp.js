const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.__htmlCheck = true;
w.fetch = async () => {
  throw new Error('no net');
};
let blobText = null;
w.URL.createObjectURL = b => {
  const r = new w.FileReader();
  r.onload = () => (blobText = r.result);
  r.readAsText(b);
  return 'blob:x';
};
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {
  this.__clicked = this.download;
};
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: process.env.LANGX || 'hu' }));
w.eval(
  code +
    `;window.__t={setProj:a=>{PROJ=a;saveP()},setChars:c=>{CHARS=c;store('chars',CHARS)},get PROJ(){return PROJ},get CHARS(){return CHARS},get S(){return S}};`
);
const T = w.__t,
  d = w.document;
(async () => {
  T.setProj([{ id: 5, name: 'Orca rendelés', active: true, items: [{ bpType: 28607, runs: 1 }] }]);
  T.setChars([{ id: 1, name: 'Pilot A', refresh: 'SECRET', access: 'a', exp: 1 }]);
  d.querySelector('#expBtn').click();
  await new Promise(r => setTimeout(r, 50));
  const j = JSON.parse(blobText);
  console.log('export no-token: chars=', JSON.stringify(j.chars), 'projects=', j.projects.length);
  d.querySelector('#expTokens').checked = true;
  d.querySelector('#expTokens').dispatchEvent(new w.Event('change'));
  console.log('warn visible:', !d.querySelector('#expWarn').hidden);
  d.querySelector('#expBtn').click();
  await new Promise(r => setTimeout(r, 50));
  const j2 = JSON.parse(blobText);
  console.log('export token: has refresh=', !!j2.chars[0].refresh);
  // import into fresh state
  T.setProj([]);
  T.setChars([]);
  const file = new w.File([JSON.stringify(j2)], 'm.json', { type: 'application/json' });
  const inp = d.querySelector('#impFile');
  Object.defineProperty(inp, 'files', { value: [file] });
  inp.dispatchEvent(new w.Event('change'));
  await new Promise(r => setTimeout(r, 100));
  console.log(
    'confirm:',
    d
      .querySelector('#impConfirm')
      .textContent.replace(/\s+/g, ' ')
      .replace(/\d{4}\. \d{2}\. \d{2}\.( \d{1,2}:\d{2}(:\d{2})?)?/g, '<DATE>')
      .slice(0, 160)
  );
  w.localStorage.removeItem('indyops.projects');
  d.querySelector('#impYes').click();
  {
    const lp = JSON.parse(w.localStorage.getItem('indyops.projects') || '[]'),
      lc = JSON.parse(w.localStorage.getItem('indyops.chars') || '[]');
    console.log(
      lp.length === 1 && lp[0].name === 'Orca rendelés' && lc.length === 1 && lc[0].refresh === 'SECRET'
        ? 'persisted: ok'
        : 'FAIL: restore not persisted to localStorage'
    );
  }
  console.log(
    'after import: projects=',
    T.PROJ.length,
    T.PROJ[0].name,
    'chars=',
    T.CHARS.length,
    T.CHARS[0].name,
    'pList=',
    d.querySelector('#pList').textContent.replace(/\s+/g, ' ').trim()
  );
})().catch(e => console.error('FAIL', e));
