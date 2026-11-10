# Changelog

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
