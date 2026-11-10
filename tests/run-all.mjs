// Runs every scenario against dist/indyops.html and fails if any of them throws.
// Build first: node ../tools/bundle.mjs
import { execFileSync } from 'node:child_process';
const tests = ['help','repro','unk','projsrc','run','ui','ui2','ui3','proj','prof','exp','inv','res','sales','mine','empty','switch','hosted'];
let failed = 0;
for (const t of tests) {
  let out = '';
  try { out = execFileSync('node', [t + '.js'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || '') + ' FAIL'; }
  const bad = /FAIL|TypeError|ReferenceError|SyntaxError/.test(out);
  if (bad) failed++;
  console.log((bad ? 'FAIL ' : 'ok   ') + t);
  if (bad || process.env.VERBOSE) console.log(out.split('\n').slice(0, 12).join('\n'));
}
process.exit(failed ? 1 : 0);
