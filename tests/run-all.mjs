// Runs every scenario against dist/indyops.html.
// - lint.js: HTML is set only through setHtml/appendHtml.
// - regress.js, xss.js: explicit assertions (print "FAIL: …"); xss.js poisons every outside string and checks
//   that no view turns it into markup or escapes it twice.
// - every other scenario: characterization ("golden") test – its normalized output must equal tests/golden/<name>.txt.
//   The golden files were reviewed when created; after an intended change, inspect the diff and refresh them with
//   UPDATE_GOLDEN=1 node run-all.mjs [names…]
// Build first: node ../tools/bundle.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
const ALL = [
  'lint',
  'regress',
  'xss',
  'help',
  'repro',
  'unk',
  'projsrc',
  'bpruns',
  'run',
  'ui',
  'ui2',
  'ui3',
  'proj',
  'prof',
  'exp',
  'inv',
  'res',
  'sales',
  'mine',
  'empty',
  'switch',
  'hosted'
];
// optional subset: node run-all.mjs exp inv
const tests = process.argv.length > 2 ? process.argv.slice(2) : ALL;
// time-dependent parts are masked so the comparison is stable
const norm = s =>
  s
    .replace(/\d{4}\. \d{2}\. \d{2}\.( \d{1,2}:\d{2}(:\d{2})?)?/g, '<DATE>')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '<TIME>')
    .replace(/\b1\d{12}\b/g, '<EPOCH>')
    .replace(/len \d+/g, 'len <N>')
    .replace(/\bv\d+\.\d+\.\d+\b(?<!v1\.0\.0)/g, 'v<VER>')
    .replace(/\s+$/gm, '');
mkdirSync('golden', { recursive: true });
let failed = 0;
for (const t of tests) {
  // stderr is part of the checked output: scenarios report async failures with console.error
  const r = spawnSync('node', [t + '.js'], { encoding: 'utf8', timeout: 120000 });
  let out = (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : '');
  if (r.status !== 0) out += '\nFAIL (exit ' + r.status + ')';
  let bad = /FAIL|TypeError|ReferenceError|SyntaxError/.test(out),
    why = bad ? 'error' : '';
  if (!bad && !['lint', 'regress', 'xss'].includes(t)) {
    const g = 'golden/' + t + '.txt',
      n = norm(out);
    if (process.env.UPDATE_GOLDEN || !existsSync(g)) writeFileSync(g, n);
    else if (readFileSync(g, 'utf8') !== n) {
      bad = true;
      why = 'output differs from ' + g;
      const a = readFileSync(g, 'utf8').split('\n'),
        b = n.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        if (a[i] !== b[i]) {
          out = 'expected: ' + (a[i] ?? '') + '\nactual:   ' + (b[i] ?? '');
          break;
        }
    }
  }
  if (bad) failed++;
  console.log((bad ? 'FAIL ' : 'ok   ') + t + (why ? '  (' + why + ')' : ''));
  if (bad || process.env.VERBOSE) console.log(out.split('\n').slice(0, 12).join('\n'));
}
process.exit(failed ? 1 : 0);
