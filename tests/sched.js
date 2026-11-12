// Timeline scheduler: slots, running jobs, dependencies, blueprints, materials and the active window.
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
w.eval(code + `;window.__t={scheduleJobs,slotList,inWindow};`);
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
const H = 3600e3;
// a fixed local day, 10:00
const day = new Date(2026, 10, 13, 10, 0, 0).getTime();
const at = (h, m = 0) => new Date(2026, 10, 13, h, m, 0).getTime();

// 1. active window
const win = { from: 18, to: 23 };
ok(T.inWindow(at(10), win) === at(18), 'before the window: its start the same day');
ok(T.inWindow(at(19), win) === at(19), 'inside the window: unchanged');
ok(T.inWindow(at(23, 30), win) === new Date(2026, 10, 14, 18).getTime(), 'after the window: next day');
const wrap = { from: 22, to: 2 };
ok(T.inWindow(at(1), wrap) === at(1), 'window past midnight: 01:00 is inside');
ok(T.inWindow(at(3), wrap) === at(22), 'window past midnight: 03:00 waits for 22:00');
ok(T.inWindow(at(3), null) === at(3), 'no window: any time');

// 2. usable slots: running jobs sit in slots until they end, the reserve is kept out
const e3w = day + 21 * 24 * H;
ok(
  JSON.stringify(T.slotList(5, 0, [e3w], day)) === JSON.stringify([day, day, day, day, e3w]),
  '5 slots, one running for 3 weeks'
);
ok(JSON.stringify(T.slotList(5, 2, [e3w], day)) === JSON.stringify([day, day, e3w]), 'reserve 2 of 5');
ok(
  JSON.stringify(T.slotList(3, 1, [day + 5 * H, day + 2 * H, day + 9 * H], day)) ===
    JSON.stringify([day + 2 * H, day + 5 * H]),
  'more running than usable: the ones that end first'
);
ok(T.slotList(2, 0, [day - H], day)[0] === day, 'a job already over frees its slot at the start');

const run = (jobs, slots, extra = {}) => T.scheduleJobs(Object.assign({ t0: day, win: null, jobs, slots }, extra));
const J = (id, dur, o = {}) =>
  Object.assign({ id, lane: '1|m', bp: null, dur: dur * H, ready: 0, prio: 0, deps: [] }, o);
const rel = (r, id) => {
  const x = r.rows.get(id);
  return x.s == null ? null : [(x.s - day) / H, (x.e - day) / H, x.why];
};

// 3. one slot, two components and their parent: the longer chain first, the parent after both
{
  const r = run(
    [
      J('A', 2),
      J('B', 3),
      J('P', 1, {
        deps: [
          { id: 'A', lag: 0 },
          { id: 'B', lag: 0 }
        ]
      })
    ],
    { '1|m': [day] }
  );
  ok(JSON.stringify(rel(r, 'B')) === '[0,3,"start"]', 'B first: ' + rel(r, 'B'));
  ok(JSON.stringify(rel(r, 'A')) === '[3,5,"slot"]', 'A waits for the slot: ' + rel(r, 'A'));
  ok(JSON.stringify(rel(r, 'P')) === '[5,6,"dep"]', 'P after both: ' + rel(r, 'P'));
  ok(
    (r.end - day) / H === 6 && r.crit.has('P') && r.crit.has('A') && r.crit.has('B'),
    'end and critical path (through the slot wait)'
  );
}
// 4. two slots: in parallel
{
  const r = run(
    [
      J('A', 2),
      J('B', 3),
      J('P', 1, {
        deps: [
          { id: 'A', lag: 0 },
          { id: 'B', lag: 0 }
        ]
      })
    ],
    { '1|m': [day, day] }
  );
  ok((r.end - day) / H === 4 && JSON.stringify(rel(r, 'A')) === '[0,2,"start"]', 'two slots: end after 4 h');
}
// 5. a running job holds the only slot
{
  const r = run([J('A', 1)], { '1|m': [day + 10 * H] });
  ok(JSON.stringify(rel(r, 'A')) === '[10,11,"slot"]', 'waits for the running job: ' + rel(r, 'A'));
}
// 6. the same blueprint runs one job at a time, even with free slots
{
  const r = run([J('A', 2, { bp: '7' }), J('B', 2, { bp: '7' })], { '1|m': [day, day] });
  const s = [rel(r, 'A'), rel(r, 'B')].sort((a, b) => a[0] - b[0]);
  ok(s[0][0] === 0 && s[1][0] === 2 && s[1][2] === 'bp', 'one blueprint, one job at a time: ' + JSON.stringify(s));
}
// 7. haul between places, and materials that arrive later
{
  const r = run(
    [J('A', 1), J('P', 1, { deps: [{ id: 'A', lag: 2 * H }] }), J('M', 1, { ready: day + 5 * H, lane: '2|m' })],
    {
      '1|m': [day],
      '2|m': [day]
    }
  );
  ok(JSON.stringify(rel(r, 'P')) === '[3,4,"dep"]', 'the haul time between the places: ' + rel(r, 'P'));
  ok(JSON.stringify(rel(r, 'M')) === '[5,6,"mat"]', 'waits for its materials: ' + rel(r, 'M'));
}
// 8. jobs start only in the active window
{
  const r = run([J('A', 1), J('B', 30, { lane: '2|m' })], { '1|m': [day], '2|m': [day] }, { win });
  ok(JSON.stringify(rel(r, 'A')) === '[8,9,"active"]', 'starts at 18:00: ' + rel(r, 'A'));
}
// 9. no usable slot
{
  const r = run([J('A', 1)], { '1|m': [] });
  ok(rel(r, 'A') === null && r.rows.get('A').why === 'noslot', 'no slot: not placed');
}
// 10. priority: the first project's jobs take the slot first
{
  const r = run([J('A', 5, { prio: 1 }), J('B', 1, { prio: 0 })], { '1|m': [day] });
  ok(rel(r, 'B')[0] === 0 && rel(r, 'A')[0] === 1, 'project order is the priority');
}

console.log(`sched: ${checks - fails}/${checks} checks passed`);
