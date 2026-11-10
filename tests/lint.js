// Source checks: HTML reaches the page only through setHtml/appendHtml (js/core.js), which take html`` templates.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'js');
let fails = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  src.split('\n').forEach((line, i) => {
    if (f === 'core.js' && /el\.innerHTML = /.test(line)) return;
    if (/\.innerHTML\s*[+]?=|insertAdjacentHTML|outerHTML\s*=|document\.write/.test(line)) {
      fails++;
      console.log(`FAIL: ${f}:${i + 1}: HTML set without setHtml: ${line.trim().slice(0, 100)}`);
    }
    if (/\braw\(/.test(line) && f !== 'core.js') {
      fails++;
      console.log(
        `FAIL: ${f}:${i + 1}: raw() outside core.js (only markup written in code may be raw): ${line.trim().slice(0, 100)}`
      );
    }
  });
}
console.log(fails ? `lint: ${fails} problem(s)` : 'lint: HTML is set only through setHtml/appendHtml');
