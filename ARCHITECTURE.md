# IndyOps architecture

IndyOps is a static single-page app. It has no server and no build step at runtime. The browser talks to two public sources directly:

- **ESI** (`esi.evetech.net`) for character data, with the user's own EVE SSO login (PKCE, no client secret);
- **EVE Ref** (`ref-data.everef.net`, `data.everef.net`) for type and blueprint recipe data and the public structure list.

Everything the app knows is kept in the browser's `localStorage`.

## Files and load order

The scripts are classic (non-module) scripts. They load in this order from `index.html` and share one global scope:

| File | Role | Main entry points |
|---|---|---|
| `i18n/en.js`, `i18n/de.js` | translation dictionaries (`window.I18N.en/de`) | – |
| `js/core.js` | constants (`APP`, scopes, ids), i18n engine, formatting, storage, settings (`S`, `SET_SCHEMA`), persisted caches | `T`, `trTree`, `store`, `load`, `saveS` |
| `js/esi.js` | SSO login, token refresh, ESI/EVE Ref network layer, names and locations, character refresh | `startLogin`, `accessToken`, `esi`, `refGet`, `resolveNames`, `resolveLoc`, `refreshChar` |
| `js/data.js` | aggregated views over all characters: stock, blueprints, skills, fees, standings, prices, second market, ores, unknown locations, containers and project material sources | `allBPs`, `stockMap`, `ensurePrices`, `brokerFee`, `salesTax`, `stockFilter` |
| `js/market.js` | where to buy: manual prices, picked stations, regional sell-order search with jumps and order book depth | `buyParts`, `buyPrice`, `loadMarket`, `mktSearch`, `bindBuySources` |
| `js/engine.js` | planning engine: material trees, BPC runs, invention, job systems, job cost and time | `makeMulti`, `planNode`, `addInvention`, `assignJobSys`, `jobCost`, `jobTime` |
| `js/views.js` | paging and sorting, rendering of the Characters / Blueprints / Stock / Settings tabs, plan pipeline, character assignment, hauling | `renderAll`, `pageOf`, `sortTh`, `finishResult`, `assignChars`, `showResult`, `renderResult`, `prepHaul` |
| `js/tab-projects.js` | Projects tab, incl. material sources | `renderProjects`, `calcProjects` |
| `js/tab-profit.js` | What pays? (profit ranking) | `runProfit`, `renderProfit` |
| `js/tab-invention.js` | Invention | `runInvention`, `renderInvention` |
| `js/tab-research.js` | Research & copy | `runResearch`, `renderResearch` |
| `js/tab-sales.js` | Selling: orders, undercuts, history | `runSales`, `renderSales` |
| `js/tab-canbuild.js` | Builds without buying | `runCanBuild`, `renderCanBuild` |
| `js/tab-mining.js` | Mining: survey scan, ore value | `runScan`, `renderMineNeed` |
| `js/repro.js` | Reprocess calculator: rows from stock, location yield (structure, rig, security, NPC station), tax, skills, implants | `repLoad`, `repCalc`, `renderRepro`, `renderRepSum` |
| `js/main.js` | event wiring, backup and restore (`makeBackup`, `validateBackup`), bug report link, start-up | – |

`tools/bundle.mjs` inlines the CSS and all scripts (in the same order) into `dist/indyops.html` and replaces the CSP with SHA-256 hashes of exactly those script blocks.

## Global state

All state is global (`let` at the top level of a file). Persisted entries are stored under `indyops.<key>`.

| Name | Contents | Stored as | Written by |
|---|---|---|---|
| `S` | settings (schema and expected types in `SET_SCHEMA`) | `settings` | settings inputs in `main.js` and the tabs (`S.x = …; saveS()`), restore |
| `LANG` | UI language | inside `settings` | `setLang` (`core.js`) |
| `CHARS` | logged-in characters `{id, name, refresh, access, exp, scp}` | `chars` | only the functions in `core.js`: `putChar` (login, restore), `removeChar`, `saveChars` (token refresh) |
| `DATA` | per character: `assets, bps, skills, jobs, orders, tx, imp, std, lm, cont, bpAt, bpExp, dv, at` | `data` | only `setCharData` (result of `refreshChar`) and `removeChar`; read through `charEntries()`, which skips removed characters |
| `NAMES` | id → name (types, systems, regions, characters, corps) | `names` | `resolveNames` |
| `LOCINFO` | location id → `{name, system, …}` | `locinfo` | `resolveLoc`, unknown-location naming in `data.js` |
| `REFC` | EVE Ref cache: `t` types, `b` blueprints | `ref` | `refGet`, cache reset in `main.js` |
| `PRICES` | type → `{s, b, at, err, retry}` Jita prices | `prices` | `ensurePrices`, cache reset in `main.js` |
| `ADJ`, `IDX` | adjusted prices; system → activity cost index | `adj`, `idx2` | `data.js` |
| `ORES`, `CORPFAC`, `SYSSEC`, `HIST`, `ROUTES`, `SHIPC` | ore types, NPC corp → faction (from EVE Ref), system security, market history, routes, ship capacities | own keys | the module that declares them |
| `PROJ`, `SELP` | projects and the selected project | `projects`, `selp` | `tab-projects.js`, restore |
| `MKT`, `MKT_JUMPS`, `REGIONS` | sell orders per material in the picked regions (10 minutes), jumps of the found stations, the k-space region list | `regions` (only `REGIONS`) | `market.js` |
| `BPPROD` | blueprint type → `{prod, qty, act}` index of recipes | – | `indexBPProducts` (`engine.js`), reset in `main.js` |
| `LASTPLAN`, `LASTRENDER` | the plan on screen and a function that redraws it | – | `runPlan` (`views.js`), `calcProjects` (`tab-projects.js`) |
| `REP`, `REPLOG` | reprocess rows, selection, load log | – | `repro.js` |
| `PROFROWS`, `INVROWS`, `RESROWS`, `SLROWS`, `CBROWS`, `PG`, `PGR`, `SRT` | last result rows of the list tabs, their paging and sort state | – | the tab that owns them |

`DATA` and `CHARS` are the only inputs that come from the user's characters. A removal raises the character's generation (`charGen`); `refreshChar` remembers the generation it started with, and `setCharData` drops a result that belongs to a removed character. `tests/lint.js` fails if `CHARS` or `DATA` is changed anywhere else. Everything a tab shows is derived from them, the settings and the caches.

## Data flow

### Login and character refresh

1. `startLogin` opens EVE SSO with PKCE. `finishLogin` exchanges the code and stores the character in `CHARS`.
2. `accessToken(c)` refreshes the access token when needed. Only one refresh per character runs at a time; parallel callers wait for the same one.
3. `refreshChar(c)` downloads assets, blueprints, skills and jobs, plus standings, implants, orders and wallet transactions when the scope exists. It converts them to the compact `DATA[c.id]` form:
   - `assetTree` resolves root locations and direct containers;
   - `subtractUndeliveredRuns` corrects BPC runs, because ESI lowers them only when a job is delivered (`b.adj` marks the correction, shown as `*`).
4. Names and locations are resolved, then `renderAll()` redraws the data tabs.

`APP.dataVersion` is stored in each `DATA` entry as `dv`. When a release needs data that older entries lack, raising `dataVersion` shows a refresh banner.

### Network layer (`esi.js`)

- `esi(path, opts)` runs at most 6 requests at a time. It handles paging, and retries up to two more times with back-off (`ESI_BACKOFF`) on timeouts, network errors and server errors. Its timeout (`ESI_TIMEOUT`) covers the whole response, body included. With `meta: true` it also returns `Last-Modified`/`Expires`.
- `refGet(kind, id)` fetches EVE Ref data through its own queue, so it does not take ESI slots. Results are cached in `REFC`.
- Prices (`ensurePrices`) come from ESI market orders. A failed download keeps the last good price, marked with `err`, and is retried after 5 minutes. An item without a price is never counted as 0; the profit becomes "not computable".

### Planning pipeline

The same pipeline serves the Plan, Projects, Profit, Invention and Build-without-buying tabs:

```
makeMulti(items, opt, shared)        engine.js   trees, jobs, buy list, used stock, warnings
  └ planContext / planNode / allocateRuns / jobMaterialQty / addInvention
finishResult(R, firstBP)             views.js    names, prices, recipes; then, in this order:
  assignChars(R.jobs)                            who runs each job (skills, time, free slots; LPT)
  assignJobSys(R.jobs)                           systems of the final BP locations (cost index)
  prepHaul(R)                                    routes and ships for hauling (async, guarded)
showResult(el, R, rerun)             views.js    re-assigns characters, draws, refreshes hauling
  renderResult(el, R, rerun)                     pure rendering: planTotals + one function per section
  refreshHaul(R)                                 prepares hauling again only if the assignment changed
```

- `makeMulti` takes a shared stock pool (`buildPool`): hangars, optionally ore, and products of running jobs. A project's or item's material sources limit which pool entries it may take (`stockFilter`, `reservedMap`).
- `allocateRuns` fills the copies one after the other by default. With parallel manufacturing (`S.parallel`, `S.parMode`) it spreads the runs over several blueprint items (`parallelRuns`), limited by the items, the free slots and a one-hour minimum per job; in "material" mode only when no material is added. Splits are listed in `R.par`. `assignChars` never moves two jobs onto the same blueprint item.
- Surplus from a job goes back to the pool for later nodes and items. With `shared = {pool, runsLeft}`, several projects use one pool and one set of BPC runs.
- `renderResult` does not change the plan. Anything that changes the assignment (working characters, settings) calls `LASTRENDER`, which goes through `showResult`.
- Purchases: `buyParts(t, q)` splits a material into sources: a manual price (`S.manPrice`, not hauled), a station picked from the market search (`S.buySrc`, as much as its orders give, cheapest first), and Jita for the rest. Costs use the average over the whole shopping list; the haul list takes each node's share from these sources. The second market is for selling and valuation only.
- Haul preparation uses a generation counter and an assignment signature (`haulSig`). Only the newest preparation that still matches the current assignment may publish `R.haulCtx`.
- Job slots are a model limit, not a scheduler. Jobs beyond the free slots are marked "no free slot" and their waiting time is not included.

### Rendering and translation

- Views build markup with the `html` template tag (`core.js`), which escapes every interpolated value. Nested `html` templates, arrays of them (`hjoin` with a separator) and `raw()` markup pass through unchanged. `T()` returns an `html` result when its text is markup written in the code or an argument is one; otherwise a plain string.
- Markup reaches the page only through `setHtml(el, h)` / `appendHtml(el, h)`. A plain string given to them is shown as text, so a view that builds a string by mistake cannot inject markup. `tests/lint.js` fails on any other way of setting HTML, and in tests (`window.__htmlCheck`) `setHtml` warns when markup ends up as visible text.
- Long lists use the shared pager and sortable headers (`pageOf`, `pagerHtml`, `sortTh`, `sortRows`).
- UI strings in the code are the Hungarian source texts. A `MutationObserver` (`startI18n`) translates every text node and the `placeholder`/`title`/`aria-label` attributes using the dictionaries. Lookup is first by the exact text, then with numbers replaced by `#`. `T('… {0}', x)` is used where a string is assembled from parts. Elements marked `data-noi18n` are left alone.

### Backup and restore

- `makeBackup(withTokens)` exports the settings, projects and characters. Login tokens are included only on request.
- `validateBackup` checks each field against `SET_SCHEMA`/`BACKUP_TYPES`, drops unknown keys and never throws. The restore is applied only if there are no errors and the user confirms.

## Security notes

- There is no client secret: login uses PKCE. The hosted version has its own client id (`APP.clientId`); the offline file needs the user's own application and its client id (see the README).
- `index.html` and the offline file have a CSP. The offline file allows only its own inline scripts, by hash. Network requests (`connect-src`) are limited to ESI, EVE SSO and EVE Ref; images come only from the EVE image server.
- Tokens stay in the browser's `localStorage`. They leave it only in a backup file, and only when the user asks for that.

## Tests

`tests/` runs the bundled `dist/indyops.html` in jsdom with a mocked `fetch`:

- `regress.js` holds assertion checks;
- `xss.js` poisons every outside string with an HTML payload and checks every tab (no markup, no double escaping);
- every other scenario is a characterization test compared with `tests/golden/<name>.txt`.

See the README for commands. Build with `node tools/bundle.mjs` before running them.
