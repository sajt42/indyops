# Changelog

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
