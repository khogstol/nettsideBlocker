# CLAUDE.md

## Goal of the app

A Chrome extension (Manifest V3) that:

1. **Blocks websites** that I choose.
2. **Keeps stats** for a given list of websites, so I can see my usage and how many times I open each site.

## Project structure

- `manifest.json` – extension config (permissions, background worker, rule files).
- `background.js` – service worker. Logic for blocking and tracking goes here.
- `rules.json` – static block rules for `declarativeNetRequest`.
- `blocked.html` + `blocked.js` – the page shown when a tracked site is blocked by the limits.- `lib/idb.js` – the `idb` library (version 8.0.0), downloaded from unpkg. Don't edit this file. To update it, download a new version and replace the file.

## Security

Security is important. Think about it **every time** you write or change code, and tell me if a change has a security risk.

- Ask for as few permissions as possible in `manifest.json`. Explain why when a new permission is needed.
- Never use `eval`, `new Function` or `innerHTML` with data that isn't fixed text. Use `textContent` instead.
- Treat all URLs and page data as untrusted. Check them before using them.
- Keep all data on this computer. Never send browsing data or stats anywhere.
- Don't load code from the internet at runtime. All code must be inside the extension folder.
- Only add dependencies from trusted sources, pin the exact version, and check the file before adding it.

## How to write code

- Keep the code **simple and easy to read**. No fancy code.
- Use plain JavaScript. No frameworks.
- Prefer clear names over short names.
- Small functions that do one thing.
- Prefer simple `for` loops and `if` statements over clever one-liners.
- Add a short comment when something is not obvious.
- Small, well-known dependencies are OK when they make the code simpler (for example `idb`). Ask before adding anything big.

## Decisions made

- **Stats storage:** IndexedDB, using the `idb` library to keep the code simple.
- **Stats format:** one record per site per day: `{ domain: "x.com", day: "2026-11-09", count: 3, lastSeen: "14-05-30" }`. The key is `["domain", "day"]`. `day` is the local date. Each visit adds 1 to `count` and sets `lastSeen` to the local time of the visit.
- **What counts as a visit:** coming to a site from somewhere else (typing it, clicking a link to it, opening it in a new tab). Moving between pages inside the same site does not count.
- **Limits:** the rules are set by two variables at the top of `background.js`. They have no fixed values, so change them freely:
  - `limitPerDay` – how many times a tracked site can be opened per day.
  - `timeBetween` – the shortest time allowed between two visits to the same site, as `"hh-mm-ss"`.
  - A site is blocked if it has reached `limitPerDay` today **or** if less than `timeBetween` has passed since the last visit. The tab is then sent to `blocked.html`.
  - Clicking around inside the site during a visit is allowed. Blocked attempts are not counted. The count resets by itself the next day.
- **Tracked sites list:** for now it's the `trackedSites` list at the top of `background.js`. Later it will move to a settings page.
- **Loading `idb`:** the library file is saved in `lib/idb.js` and imported directly. No npm or bundler.

## Design choices

When there is a design choice to make, **do not just pick one**.
Stop and give me:

1. **The choice** – what needs to be decided, in one sentence.
2. **The options** – a short list, each with pros and cons.
3. **Your recommendation** – which one you would pick and why.

Then wait for my answer before building it.
