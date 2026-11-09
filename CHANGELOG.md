# Changelog

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
