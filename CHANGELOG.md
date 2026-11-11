# Changelog

## 1.14.3 – 2026-11-11

- Fix: removing a character (or restoring a backup) while that character was refreshing wrote its data back when the refresh finished, and it stayed in the browser storage. Characters and their data now change only through a few functions in core.js; a refresh drops its result if the character was removed meanwhile, and data of removed characters left by older versions is cleared at start-up.
- Code: one helper (charEntries) lists the data of logged-in characters instead of eight separate checks; tests/lint.js fails if CHARS or DATA is changed elsewhere.
- Tests: outputs that contain a date or time no longer depend on the day the tests run.

## 1.14.2 – 2026-11-10

- Where to buy cheaper?: the result spans the full width under the shopping list and the jobs, grouped per material (needed quantity and Jita price in the group row), with short station names (full name on hover), the largest possible saving at the top, and the materials that are not cheaper nearby listed below.

## 1.14.1 – 2026-11-10

- Hauling: one card per route that wraps instead of scrolling sideways; each card says what moves (purchase, from stock, intermediate product, for sale), shows short station names (full name on hover), the items, and the ship suggestions below.

## 1.14.0 – 2026-11-10

- Where to buy: in the shopping list (Planner and Projects) every material can have a manual price (bought outside the market; such items are not hauled), and 'Where to buy cheaper?' searches the sell orders of the regions picked in Settings. For each material it shows the stations cheaper than Jita with jumps from the production location, highsec check, how much is available and the average price over the order book for the needed quantity. 'Buy here' picks a station; what it lacks comes from Jita. Settings: regions, maximum jumps (10), highsec only (on), and the lists of manual prices and picked sources.
- The second market is now for selling and valuation only: the 'buy at the second market when cheaper' switch is gone. A player structure set as second market is included in the search.
- Fix: the note about items without a price said they count as 0; they make the profit not computable.

## 1.13.3 – 2026-11-10

- Selling: the broker fee is at least 100 ISK per order, as in the game; Planner, Projects, What pays? and Invention count it (it matters only for orders below about 8,000 ISK).

## 1.13.2 – 2026-11-10

- Security: every view builds its markup with the html`` template tag, which escapes every value by default, and sets it only through setHtml/appendHtml. A string that was not converted is shown as text instead of being run as markup. The rendered pages are identical to 1.13.1 in all 21 test scenarios.
- Tests: lint.js fails on any other way of setting HTML; in tests setHtml also warns when markup ends up as visible text (which caught several conversion mistakes before release).

## 1.13.1 – 2026-11-10

- Security: new test (tests/xss.js) that gives every name coming from outside an HTML payload and draws every tab. It found one hole: the clues for unknown locations showed character names and hangar flags without escaping. Fixed.
- Code: escaping also covers the apostrophe; new html`` template helpers that escape by default (html, raw, setHtml), used by the next releases.
- Code: tabs.js is split into one file per tab (js/tab-*.js); no change in behavior.

## 1.13.0 – 2026-11-10

- Parallel manufacturing (Settings → Manufacturing, off by default): with several blueprints for one item (BPCs, BPOs, or a stack of BPOs) the runs are split into jobs that run at the same time, up to the number of blueprints and free slots, with at least one hour of base time per job. Mode 'less material' splits only as far as no extra material is needed (ME rounds up per job); 'more speed' splits as far as possible. The plan lists the split items and the extra material in ISK.
- Fix: two jobs could be assigned to the same blueprint when the planner moved a job to another character's copy.

## 1.12.13 – 2026-11-10

- Selling: the in-game standing in the broker fee tooltip is rounded like the game's Standings window (1.12.10 cut it off, which showed 4.76 where the game shows 4.77). The fee itself was right.

## 1.12.12 – 2026-11-10

- Fix: the faction of a station owner corp now comes from EVE Ref. ESI's corporation data has no faction for NPC corps (checked: Spacelane Patrol, Caldari Navy), so every corp was stored as 'no faction' and the faction standing never counted in the broker fee; 1.12.10 and 1.12.11 did not fix this. The stored values are reloaded once.
- Selling: the note under the seller table says that the broker fee uses the raw standings towards the owner's corp and faction.
- Tests: a regression check for the faction lookup (fails on 1.12.11); the reprocess scenario mocks the EVE Ref endpoint instead of the ESI one.

## 1.12.11 – 2026-11-10

- Fix: the station owners of Jita and the second market (corp and faction, needed for the broker fee) are loaded at start-up. Before, after 1.12.10 reset the faction cache, the seller table showed 'faction not known' until prices were loaded.
- Tests: outputs that are cut to a length no longer depend on the length of the version number.

## 1.12.10 – 2026-11-10

- Fix: the broker fee at NPC stations uses the raw standings, without Connections/Diplomacy, as the game does (checked against an in-game order: 1.23%, where the adjusted standings gave 1.27–1.18%).
- Fix: a failed lookup of a station owner's faction was stored as 'no faction' for good, so the faction standing was left out of the broker fee; failures are now retried and old entries are reloaded once.
- Selling: the broker fee tooltip names the faction and the corp and shows both the raw standing used and the value the game's Standings window shows.
- Changelog wording of 1.12.9.

## 1.12.9 – 2026-11-10

- Fix: on the Profit tab the Jita profit per run was empty on every row since 1.10.0 (the value was not stored with the row). This also broke the 'only profitable' filter and sorting by profit per run; the remaining-runs value was right.
- Tests: the profit scenario checks that every row has a profit per run (the reference output had recorded the empty column).

## 1.12.8 – 2026-11-10

- Selling: changing the second market in Settings now loads its station owner and prices for what is on screen and redraws the Selling, Plan, Reprocess and list tabs right away (before, the Selling tab showed the old market until a reload). Profit rows calculated with another second market show empty columns for it with a note, instead of stale numbers.
- Selling: hovering over a broker fee in the seller table shows the formula with the character's Broker Relations, Connections and Diplomacy levels and the raw and adjusted standings, so it can be compared with the fee shown in game.
- Docs: the Settings note no longer says that standings are ignored; Help explains the broker fee tooltip.

## 1.12.7 – 2026-11-10

- Docs: ARCHITECTURE.md describes the modules and their load order, every global and who writes it, and the data flow (login and refresh, network layer, planning pipeline, rendering and translation, backup).

## 1.12.6 – 2026-11-10

- Code: the long functions are split into named steps: character refresh (refreshChar), the planning engine (makeMulti → planNode, allocateRuns, jobMaterialQty, addInvention), plan rendering (renderResult → planTotals and one function per section), backup validation, and the reprocess summary and loading. No change in behavior: the tests and the rendered plan HTML are identical.
- Tests: new characterization test for the character refresh (containers, ships, orders, standings, implants, wallet, failing and missing scopes).

## 1.12.5 – 2026-11-10

- Code: the whole codebase is formatted with Prettier (one statement per line instead of long one-line functions) and all code comments are in English. No change in behavior: every test produces the same output.

## 1.12.4 – 2026-11-10

- Tests: every scenario is now checked against a reviewed reference output (golden files), and errors printed by a scenario count as failures. This uncovered an invention scenario that never waited for its project result; fixed.
- Tests: restoring a backup is checked to be saved in the browser storage.
- Code: drawing a plan no longer changes it. Character assignment and haul preparation run before drawing (showResult/refreshHaul); renderResult only renders.

## 1.12.3 – 2026-11-10

- Hauling: a route preparation is published only if it still matches the current assignment (switching A → B → back to A no longer lets B's result in)
- Tests: switch-back race case; full order-insensitive comparison of the backup round trip (41 checks)

## 1.12.2 – 2026-11-10

- Fix: restoring a backup with “buy instead of build” overrides failed validation (they are booleans); numeric settings may also be empty
- Hauling: only the most recent route preparation may publish its result (an older, slower one can no longer overwrite it); the marker is updated only on success
- Tests: no always-true check; full export → import round trip; reversed-completion race test (38 checks)

## 1.12.1 – 2026-11-10

- Backup restore: every setting and project field is type-checked, unknown fields are dropped, and bad input never throws
- ESI: the 30 s timeout now covers reading the response body; body read errors are retried; the token request has a timeout too, and a failed refresh can be retried
- Job system and hauling are resolved after the final character/blueprint assignment (a reassigned BP moves the job to its own system)
- Failed price download: the last good price is kept and the next attempt waits 5 minutes (separate retry time)
- Failed or incomplete routes are retried after 5 minutes instead of being cached forever
- Offline file: Content-Security-Policy allows only its own script blocks by SHA-256 hash (no 'unsafe-inline')
- 32 assertion-based regression checks

## 1.12.0 – 2026-11-10

- Prices: a failed download keeps the last good price and retries in 5 minutes; items without a price make profit “can't be calculated” (with the missing items listed) instead of counting them as free
- Hauling: “highsec route” only when every system on the route is highsec; otherwise a warning with the lowest security
- Job costs: each job uses the cost index of its own system; the production location setting is respected
- Hauling to Jita grouped by origin when products are built in several places
- ESI requests time out after 30 s and retry; one token refresh per character for parallel requests
- Backup restore validates the file before applying it
- Jobs beyond a character's free slots are marked “no free slot” (later start assumed, waiting time not included)
- Content-Security-Policy: the page can only contact ESI, EVE SSO and EVE Ref
- Assertion-based regression tests

## 1.11.0 – 2026-11-10

- Sort by clicking the column header on every list page: Stock, Invention, Research, Selling (orders), No-buy builds (Blueprints, What pays? and Reprocess already had it)

## 1.10.6 – 2026-11-10

- Help: FAQ on BPC runs marked * and on the refresh banner; ships in project sources; buying at the second market in Settings. README brought up to date

## 1.10.5 – 2026-11-10

- Project sources: containers and ships show their type next to your name (e.g. “sün (Vargur)”), ships get 🚀 and are listed after containers; a “ships too” switch hides ship cargo holds; needs one data refresh

## 1.10.4 – 2026-11-10

- Blueprints tab: clearer explanation of runs marked * (ESI hasn't caught up with a job yet)

## 1.10.3 – 2026-11-10

- Fix: BPC runs – ESI only lowers runs when a job is delivered, so runs of jobs still running or not yet delivered at ESI's snapshot are subtracted (marked *)
- After an update that needs fresh data, a banner asks you to refresh all data (with a button and a link to what changed)

## 1.10.2 – 2026-11-10

- BPC runs: jobs already delivered are also checked against ESI's blueprint snapshot; the Blueprints tab shows the ESI snapshot time per character (with date if not today)

## 1.10.1 – 2026-11-10

- Fix: BPC runs looked stale after starting a job, because ESI caches the blueprint list for up to an hour; runs of jobs started since ESI's snapshot are now subtracted (marked *), used-up copies are flagged, and the Blueprints tab shows when ESI will update

## 1.10.0 – 2026-11-10

- Shopping list buys at the second market when it's cheaper (“Where to buy” column, hauling from there; switch in Settings); costs and profits use that price
- What pays?: profit per run at the second market, with that market's fees
- No-buy builds list is paged

## 1.9.1 – 2026-11-10

- Pager layout: page size selector on one line

## 1.9.0 – 2026-11-10

- Long lists are paged (25/50/100/250/500/all) instead of cut off: Reprocess, Stock, Blueprints, What pays?, Invention, Research
- Reprocess list: sortable columns, character filter, “selected only”, select all filtered items
- Player structure as second market: broker fee entered by hand (+0.5% SCC) in the seller table and Settings; Planner shows the net at the second market
- Selling: undercuts on orders in player structures checked on the structure market

## 1.8.0 – 2026-11-10

- Projects: material sources per project or per item: from everywhere (as before) or only from chosen stations, structures and containers
- Containers can be reserved for one project (“this project only”); other projects never take from them
- Material tree shows which container stock comes from; container data needs one character refresh

## 1.7.1 – 2026-11-10

- Help and README updated for the latest features (seller, second market, reprocessing with station data, standings and implants, who does the work, unknown locations)

## 1.7.0 – 2026-11-10

- Standings (new permission): broker fee at NPC stations uses standing towards the owner corporation and faction (Connections/Diplomacy included); the seller table shows the broker fee at Jita and at the second market
- Reprocess: NPC station tax per character from standing towards the owner corporation (0% at 6.67); the locations table shows the tax next to the yield

## 1.6.0 – 2026-11-10

- Reprocess: NPC stations' own reprocessing efficiency, base tax and reprocessing service read from ESI; stations without reprocessing are marked and never suggested

## 1.5.4 – 2026-11-10

- README: Hungarian section removed (the app itself still speaks Hungarian)

## 1.5.3 – 2026-11-10

- Link previews (Discord, forums, social): title, description and a preview image
- Search: better page description and keywords; README intro

## 1.5.2 – 2026-11-10

- Favicon: an orange hex nut on a dark tile (original artwork, no CCP logos), embedded so it also works in the offline file

## 1.5.1 – 2026-11-09

- Reprocess: separate columns per market (Jita and the second market) for “as is” and “reprocessed”; the verdict says which market is better; summary table per market
- Unknown locations: clues to identify them (which character, hangar flags such as Asset Safety, ESI location type, container names, market orders' region, industry jobs, transactions); needs a data refresh

## 1.5.0 – 2026-11-09

- Settings: “Who does the work?” checklist replaces the single skill-character dropdown; suggestions (build, invent, research, sell, reprocess) pick the best among the ticked characters, everyone's stock still counts
- Reprocess: the price button also refreshes the second market and says so; the output table has a second-market column

## 1.4.0 – 2026-11-09

- Unknown locations: names looked up in EVE Ref's public structure list (once a day, only if you have unknown locations)
- Unknown locations can be named by hand in Settings; the name shows everywhere; the Stock tab points there
- Unknown structures are retried every 6 hours (e.g. after you get docking rights back)

## 1.3.1 – 2026-11-09

- Settings: the second-market selector no longer breaks the card layout with long station names
- Second market shown wherever Jita prices are: Planner (sales KPI, products, shopping list, material tree), What pays?, Invention, Selling, Mining, Reprocess; when not set, a tip links to Settings
- Who should sell: the same table everywhere (character, sales tax, broker fee, total, suggested)

## 1.3.0 – 2026-11-09

- Implants read from ESI (active clone): the Beancounter reprocessing implant is detected automatically; manual override stays
- Second market can be a player structure where you have stuff (structure market, docking rights needed)
- Characters tab: on the web, a missing permission only needs a new login

## 1.2.0 – 2026-11-09

- Selling: suggests which character should sell (lowest sales tax + broker fee from skills); profit calculations use that character
- Second market next to Jita (Settings): trade hub or an NPC station where you have stuff; its prices appear in Planner, What pays?, Selling and Reprocess

## 1.1.1 – 2026-11-09

- Reprocess: live log while reading the stock (each item type, locations, prices) and a progress counter on the button
- Faster recipe loading: EVE Ref requests run 16 at a time on their own queue, with a 30 s timeout, without blocking ESI calls

## 1.1.0 – 2026-11-09

- New Reprocess tab: everything reprocessable in your stock (ore, ice, modules, loot), what comes out and who gets the best yield
- Per-location yield: NPC station or Upwell structure (Athanor, Tatara), rig, system security, tax
- Per-character skills and implant; select items one by one or all; sell vs. reprocess comparison; coverage of the latest plan's shortfall
- Mining: the implant set per character is used there too

## 1.0.5 – 2026-11-09

- Help and README: questions go to GitHub Discussions

## 1.0.4 – 2026-11-09

- Help: Contact section (bug reports, source code, author) in every language; direct link to the offline file and the README
- Footer: SajT links to the author's GitHub profile

## 1.0.3 – 2026-11-09

- Fix: the Help page showed all three languages at once; now only the selected language is shown
- Hidden elements stay hidden everywhere, regardless of their own styling

## 1.0.2 – 2026-11-09

- Version shown in the header next to the name; build date in bug reports
- Cache busting: file URLs carry the version so browsers load the new code right after an update
- Release tool (tools/release.mjs) and versioning rules in the README

## 1.0.1 – 2026-11-09

- In-app Help tab (English, German, Hungarian): what IndyOps is, getting started, every tab, how it calculates, privacy, FAQ
- Welcome box for new visitors on the Characters tab, Help link in the footer

## 1.0.0 – 2026-11-09

First public version (formerly the private "Gyártópult" tool).

- Planner with full material trees, per-copy ME/TE and BPC run splitting
- Projects with a shared stock pool; output of running jobs counted as incoming stock
- Character assignment by skills, job time and free slots
- Profit ranking, invention & T2 with decryptor comparison, research & copy planner
- Selling: undercut detection with suggested price, optional wallet sales history
- Hauling list with jumps, own ships, cargo skill bonuses and trip estimates
- Mining: survey scan import, per-character reprocessing yields
- Build vs. buy per component
- English, German and Hungarian UI
- Web version with automatic EVE SSO login; local single-file version (dist/indyops.html)
- Backup and restore, bug report button, storage-full warning
