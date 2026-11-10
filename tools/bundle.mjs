// Builds the single-file, offline version of IndyOps: dist/indyops.html
// It inlines css/style.css and every local <script src> from index.html.
// Usage: node tools/bundle.mjs   (no dependencies)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

let html = read('index.html');

html = html.replace(
  /<link rel="stylesheet" href="(css\/[^"?]+)(?:\?[^"]*)?">/g,
  (_, href) => `<style>\n${read(href)}</style>`
);

html = html.replace(
  /<script src="((?:js|i18n)\/[^"?]+)(?:\?[^"]*)?"><\/script>/g,
  (_, src) => `<script>\n/* ${src} */\n${read(src).replace(/<\/script/gi, '<\\/script')}</script>`
);

// the offline file has its scripts inline: allow exactly these blocks by SHA-256 hash (no 'unsafe-inline')
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
  m => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`
);
html = html.replace("script-src 'self';", `script-src ${hashes.join(' ')};`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'indyops.html'), html);
console.log(`dist/indyops.html written (${(html.length / 1024).toFixed(0)} KB)`);
