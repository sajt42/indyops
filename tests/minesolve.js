// Mining plan: the ore mix solver (least m³ / least surplus), rounding and missing materials.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('../dist/indyops.html', 'utf8').replace(/<link[^>]+>/g, '');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.org/' });
const w = dom.window;
w.fetch = async () => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  json: async () => [],
  text: async () => '[]'
});
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
w.localStorage.setItem('indyops.settings', JSON.stringify({ lang: 'hu' }));
w.eval(code + `;window.__t={lpMinCover,solveMine,setP:(t,v)=>{PRICES.p[t]={s:v}},S};`);
const T = w.__t;
let checks = 0,
  fails = 0;
const ok = (c, m) => {
  checks++;
  if (!c) {
    fails++;
    console.log('FAIL: ' + m);
  }
};
T.S.yieldBase = 100; // no characters: yield 100%, so the numbers are the ore's own
T.S.implant = 0;
[34, 35, 36].forEach((t, i) => T.setP(t, [5, 10, 50][i]));
const ore = (t, n, tm, vol, p = 1) => ({ t, n, tm, vol, p, rs: null });
const sumBy = (rows, f) => rows.reduce((s, r) => s + f(r), 0);

// 1. the LP itself: covering 100 / 100 with a mixed ore beats two pure ones
{
  const x = T.lpMinCover(
    [
      [10, 0, 10],
      [0, 10, 10]
    ],
    [100, 100],
    [1, 1, 1.5]
  );
  ok(x && Math.abs(x[2] - 10) < 1e-6 && x[0] < 1e-9 && x[1] < 1e-9, 'mixed ore: ' + JSON.stringify(x));
}
// 2. least m³ vs least surplus
{
  const ores = [
    ore(1, 'Pure', [[34, 10]], 1),
    ore(
      2,
      'Mixed',
      [
        [34, 10],
        [35, 10]
      ],
      0.5
    )
  ];
  const need = new Map([[34, 100]]);
  const a = T.solveMine(need, ores, 'm3');
  const b = T.solveMine(need, ores, 'waste');
  ok(
    a.rows.length === 1 && a.rows[0].o.n === 'Mixed' && a.m3 === 5 && a.surplus.get(35) === 100,
    'least m³: the mixed ore, Pyerite left over'
  );
  ok(
    b.rows.length === 1 && b.rows[0].o.n === 'Pure' && b.m3 === 10 && !b.surplus.size,
    'least surplus: the pure ore, nothing left over'
  );
}
// 3. whole portions, and every marked material covered after rounding
{
  const ores = [
    ore(
      1,
      'Batch',
      [
        [34, 333],
        [36, 7]
      ],
      10,
      100
    )
  ];
  const need = new Map([
    [34, 1000],
    [36, 22]
  ]);
  const r = T.solveMine(need, ores, 'm3');
  ok(
    r.rows[0].units % 100 === 0 && r.out.get(34) >= 1000 && r.out.get(36) >= 22,
    'portions of 100, all covered: ' + r.rows[0].units + ' → ' + [...r.out]
  );
}
// 4. a material no allowed ore gives
{
  const r = T.solveMine(
    new Map([
      [34, 10],
      [11399, 5]
    ]),
    [ore(1, 'Pure', [[34, 10]], 1)],
    'm3'
  );
  ok(
    r.missing.length === 1 && r.missing[0] === 11399 && r.out.get(34) >= 10,
    'missing Morphite reported, Tritanium still planned'
  );
}
console.log(`minesolve: ${checks - fails}/${checks} checks passed`);
