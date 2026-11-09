# IndyOps

**Less spreadsheet, more ISK.**

IndyOps reads your characters' assets, blueprints, skills and jobs through ESI and turns them into a production plan: what to build, what you already have, what to buy, which character should build it, and where to haul it.

**Open it:** https://sajt42.github.io/indyops/ · new here? Open the **Help** tab in the app.

[Magyar leírás lent](#magyarul)

---

## Features

- **Several characters, several locations**: stock and blueprints per character and per location; you choose which locations count.
- **Full material trees**: down to raw materials wherever you own the BP, using the ME/TE of each individual copy. BPC runs are split across copies.
- **Projects**: combine items ("3 Hurricane + 2 Maelstrom"); active projects share one stock pool in priority order. Output of running jobs counts as incoming stock.
- **Who builds what**: jobs are assigned by skills, job time and free slots, and the tool tells you when a BP has to be handed over.
- **What pays?**: profit per run, margin, profit per build hour and daily market volume for every BP you own.
- **Invention & T2**: chance from your skills, all 8 decryptors compared, invention cost per BPC; invention jobs, datacores and T1 copies included in projects.
- **Research & copy**: time and cost of the next ME level, saving per run, payback, full ME10/TE20 time, copy time, science slots.
- **Selling**: your market orders, who undercut you and the suggested new price; optional 30-day sales from wallet transactions.
- **Hauling**: what goes from where to where, packaged m³, jumps, and which of your ships (with your skills) can carry it in how many trips.
- **Mining**: paste a survey scan; yields per character from your reprocessing skills, coverage of your plan's mineral shortfall.
- **Build or buy**: per component, the unit price built yourself vs. Jita.
- **Languages**: English, Deutsch, Magyar.

## Privacy

- **No server, no tracking.** IndyOps is a static web page. Everything (tokens, stock, projects) stays in your own browser's local storage.
- It connects only to CCP (EVE SSO login, ESI) and to [EVE Ref](https://everef.net) for blueprint recipes.
- **Read-only permissions**: assets, blueprints, skills, industry jobs, structure names, market orders, wallet transactions (optional). Your wallet balance is never read.
- You can revoke access any time under *Third Party Applications* in your EVE account settings.

## Using it locally

Download `dist/indyops.html` and open it in your browser. When running from a local file you need your own application on [developers.eveonline.com](https://developers.eveonline.com/applications):

- Callback URL: `https://localhost/callback`
- Scopes: `esi-assets.read_assets.v1 esi-characters.read_blueprints.v1 esi-skills.read_skills.v1 esi-industry.read_character_jobs.v1 esi-universe.read_structures.v1 esi-markets.read_character_orders.v1 esi-wallet.read_character_wallet.v1`

Enter its **Client ID** (never the secret) in IndyOps. After logging in, the browser lands on an unreachable `https://localhost/callback?...` page; copy that address back into IndyOps.

## Bugs and ideas

Use the **Report a bug** button in the app (it pre-fills version, browser and log), or open an [issue](https://github.com/sajt42/indyops/issues). Reports are public, so check the log before sending.

## Development

No build step is needed to run it: `index.html` loads `css/`, `js/` and `i18n/` directly.

```
index.html          page structure
css/style.css       styles (light and dark theme)
js/core.js          constants, i18n engine, formatting, storage, settings
js/esi.js           EVE SSO (PKCE), ESI requests, names, character data
js/data.js          aggregated stock/blueprints, prices, ore reprocessing
js/engine.js        production engine: trees, BPC runs, invention, cost, time
js/views.js         rendering: characters, blueprints, stock, plans, hauling
js/tabs.js          projects, profit, invention, research, selling, mining
js/main.js          event wiring, backup/restore, bug report, start-up
i18n/en.js, de.js   translations (keys are the Hungarian source strings)
tools/bundle.mjs    builds the single-file dist/indyops.html
tests/              headless tests (jsdom) against dist/indyops.html
```

```
node tools/bundle.mjs          # rebuild dist/indyops.html
cd tests && npm install && npm test
```

**Versioning:** every change that goes to `main` gets a new version ([semver](https://semver.org): fix → patch, feature → minor, breaking → major), a CHANGELOG entry and a git tag. The version is shown in the header and footer and included in bug reports, so `vX.Y.Z` in a report points straight at the tag.

```
node tools/release.mjs patch "What changed"     # bumps version, CHANGELOG, cache busting, rebuilds dist/
git commit -am "vX.Y.Z: what changed" && git push origin main
```

The `Tag versions` GitHub Action then tags the release (`vX.Y.Z`) automatically.

**Translations:** copy `i18n/en.js` to a new language file, translate the values (keep `#` and `{0}` placeholders), add it to `index.html` and to `LANGS` in `js/core.js`.

## Legal

IndyOps is a fan-made tool and is not affiliated with or endorsed by CCP hf.

© 2014 CCP hf. All rights reserved. "EVE", "EVE Online", "CCP", and all related logos and images are trademarks or registered trademarks of CCP hf.

Blueprint recipe data: [EVE Ref](https://everef.net). Game data: [ESI](https://esi.evetech.net).

Code: [MIT License](LICENSE) © 2026 SajT – *Temporary solution since a while.*

---

## Magyarul

**Kevesebb táblázat, több ISK.**

Az IndyOps az ESI-n keresztül olvassa a karaktereid asseteit, blueprintjeit, skilljeit és jobjait, és gyártási tervet készít belőlük: mit érdemes gyártani, mi van már meg, mit kell venni, melyik karakter gyártsa, és mit hova kell vinni.

**Megnyitás:** https://sajt42.github.io/indyops/ · új vagy? Az oldalon a **Súgó** fül mindent elmagyaráz.

- **Több karakter, több helyszín**, a teljes anyagfa saját BP-kkel, példányonkénti ME/TE-vel.
- **Projektek** közös készletből, sorrendben; a futó jobok termékei beszámítanak.
- **Ki gyártsa**: skillek, idő és szabad slotok alapján, BP-átadási javaslattal.
- **Mit érdemes?**: profit/run, margó, profit/óra, napi forgalom.
- **Invention**, **kutatás & copy**, **eladás** (alá-ígérés figyelés), **szállítás** saját hajókkal, **bányászat** survey scanből.
- **Nyelvek**: angol, német, magyar.

**Adatkezelés:** nincs szerver és nincs követés. Minden a te böngésződben marad, az eszköz csak a CCP-hez (bejelentkezés, ESI) és az EVE Refhez kapcsolódik. Csak olvasási jogot kér, a wallet egyenlegét sosem olvassa.

**Helyi használat:** töltsd le a `dist/indyops.html` fájlt. Ehhez saját alkalmazás kell a developers.eveonline.com-on (callback: `https://localhost/callback`, a fenti engedélyekkel), és a **Client ID**-ját kell megadni (a Secretet soha).

**Hibajelentés:** az alkalmazásban a „Hiba jelentése” gombbal, vagy GitHub issue-ként.
