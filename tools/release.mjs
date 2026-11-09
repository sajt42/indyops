// Release helper: bumps the version, adds a CHANGELOG entry, updates cache-busting
// query strings in index.html and rebuilds dist/indyops.html.
// Usage: node tools/release.mjs <patch|minor|major> "Change 1" "Change 2" ...
// Then: git commit -am "vX.Y.Z: ..." && git push origin main  (the Tag versions action creates the tag)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (f) => join(root, f);
const [kind, ...notes] = process.argv.slice(2);
if (!['patch', 'minor', 'major'].includes(kind) || !notes.length) {
  console.error('Usage: node tools/release.mjs <patch|minor|major> "change" ["change" ...]');
  process.exit(1);
}

// 1. version in js/core.js
let core = readFileSync(p('js/core.js'), 'utf8');
const m = core.match(/version:'(\d+)\.(\d+)\.(\d+)'/);
if (!m) throw new Error('version not found in js/core.js');
let [maj, min, pat] = m.slice(1).map(Number);
if (kind === 'major') { maj++; min = 0; pat = 0; } else if (kind === 'minor') { min++; pat = 0; } else pat++;
const ver = `${maj}.${min}.${pat}`;
const date = new Date().toISOString().slice(0, 10);
core = core.replace(m[0], `version:'${ver}'`).replace(/built:'[^']*'/, `built:'${date}'`);
writeFileSync(p('js/core.js'), core);

// 2. cache busting in index.html
let html = readFileSync(p('index.html'), 'utf8');
html = html.replace(/((?:src|href)="(?:js|i18n|css)\/[^"?]+)(?:\?v=[^"]*)?"/g, `$1?v=${ver}"`);
writeFileSync(p('index.html'), html);

// 3. CHANGELOG
let log = readFileSync(p('CHANGELOG.md'), 'utf8');
log = log.replace('# Changelog\n', `# Changelog\n\n## ${ver} – ${date}\n\n${notes.map((n) => '- ' + n).join('\n')}\n`);
writeFileSync(p('CHANGELOG.md'), log);

// 4. single-file build
execFileSync('node', [p('tools/bundle.mjs')], { stdio: 'inherit' });
console.log(`Released ${ver}. Next: git commit -am "v${ver}: ..." && git push origin main  (tag v${ver} is created by the Tag versions action)`);
