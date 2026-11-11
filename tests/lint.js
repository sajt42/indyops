// Source checks: HTML reaches the page only through setHtml/appendHtml (js/core.js), which take html`` templates;
// characters and their data (CHARS, DATA) and the settings (S) change only through the functions in js/core.js,
// projects (PROJ, SELP) only through the functions in js/tab-projects.js.
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
    if (
      f !== 'core.js' &&
      /\bCHARS\s*=[^=]|\bDATA\s*=[^=]|\bDATA\[[^\]]+\]\s*=[^=]|delete DATA\[|CHARS\.(push|splice)\(/.test(line)
    ) {
      fails++;
      console.log(
        `FAIL: ${f}:${i + 1}: CHARS/DATA changed outside core.js (use putChar/removeChar/setCharData): ${line.trim().slice(0, 100)}`
      );
    }
    if (
      f !== 'core.js' &&
      /(^|[^\w.])S(\.\w+|\[[^\]]+\])+\s*=[^=]|delete S[.[]|(^|[^\w.])S\s*=[^=]/.test(
        line.replace(/\/\/.*$|^\s*\*.*$/, '')
      )
    ) {
      fails++;
      console.log(
        `FAIL: ${f}:${i + 1}: setting written outside core.js (use setSetting/setSettingIn): ${line.trim().slice(0, 100)}`
      );
    }
    if (
      f !== 'tab-projects.js' &&
      /\b(PROJ|SELP)\s*=[^=]|\bPROJ(\[[^\]]+\])+\s*=[^=]|\bPROJ\.(push|splice|pop|shift|unshift|sort)\(|\.items\.(push|splice)\(/.test(
        line
      )
    ) {
      fails++;
      console.log(
        `FAIL: ${f}:${i + 1}: projects changed outside tab-projects.js (use createProject/updateProject/addToProject…): ${line.trim().slice(0, 100)}`
      );
    }
    if (/\braw\(/.test(line) && f !== 'core.js') {
      fails++;
      console.log(
        `FAIL: ${f}:${i + 1}: raw() outside core.js (only markup written in code may be raw): ${line.trim().slice(0, 100)}`
      );
    }
  });
}
console.log(
  fails
    ? `lint: ${fails} problem(s)`
    : 'lint: HTML only through setHtml/appendHtml; CHARS, DATA and S only through core.js; projects only through tab-projects.js'
);
