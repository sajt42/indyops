const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const errs = [];
const vc = new (require('jsdom').VirtualConsole)();
vc.on('jsdomError', e => errs.push(e.message));
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://example.org/',
  virtualConsole: vc,
  beforeParse(w) {
    w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: process.env.LANGX || 'hu' }));
  }
});
const w = dom.window;
w.__htmlCheck = true;
const d = w.document;
setTimeout(() => {
  console.log('errors:', errs.length ? errs : 'none');
  console.log(
    'setup visible:',
    !d.querySelector('#setupBox').hidden,
    '| tabs:',
    [...d.querySelectorAll('#tabs button')].map(b => b.textContent).join(', ')
  );
  for (const t of [
    'plan',
    'proj',
    'profit',
    'inv',
    'research',
    'sales',
    'canbuild',
    'bps',
    'stock',
    'mine',
    'settings'
  ]) {
    d.querySelector(`[data-tab="${t}"]`).click();
    if (!d.querySelector('#tab-' + t) || d.querySelector('#tab-' + t).hidden) console.log('TAB FAIL', t);
  }
  d.querySelector('#slGo').click();
  setTimeout(() => {
    console.log('sales empty:', d.querySelector('#slOut').textContent.slice(0, 90));
    console.log('errors after:', errs.length ? errs : 'none');
  }, 300);
}, 300);
