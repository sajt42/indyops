const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push(e.message));
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'https://example.org/',
  virtualConsole: vc,
  beforeParse(w) {
    w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu' }));
  }
});
const w = dom.window,
  d = w.document;
const tick = () => new Promise(r => setTimeout(r, 40));
const vis = () =>
  [...d.querySelectorAll('#tab-help [data-lang]')]
    .filter(x => !x.hidden)
    .map(x => x.dataset.lang + ': ' + x.querySelector('h2').textContent)
    .join(',');
(async () => {
  await tick();
  console.log(
    'intro visible (no chars):',
    !d.querySelector('#introBox').hidden,
    '|',
    d.querySelector('#introBox h2').textContent
  );
  d.querySelector('.fwrap [data-goto="help"]').click();
  await tick();
  console.log('footer link opens help:', !d.querySelector('#tab-help').hidden, '| visible:', vis());
  for (const l of ['en', 'de', 'hu']) {
    const s = d.querySelector('#langSel');
    s.value = l;
    s.dispatchEvent(new w.Event('change'));
    await tick();
    console.log(
      l,
      '→ tab label:',
      d.querySelector('[data-tab="help"]').textContent,
      '| help:',
      vis(),
      '| intro:',
      d.querySelector('#introBox h2').textContent,
      '| link:',
      d.querySelector('#introBox a').textContent
    );
  }
  console.log('errors:', errs.length ? errs : 'none');
})();
