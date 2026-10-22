# AGENTS.md - Ecotox ID

> **Fork note.** Ecotox ID is a copy of Wild ID (`DWDyck/wild-id-battle`) refocused on ecotoxicology and crop science. Differences from the sections below: the deck is organised by **role** (`pest`, `enemy`, `pollinator`, `test`) instead of taxonomic group; each `data/species.json` entry is `{ name, role, notes[] }` plus optional `rare: true` and `intro` (a rare entry is kept out of `poolFor`, appears with probability `RARE_CHANCE` in non-challenge rounds, and is excluded from the Deck selector counts) (several one-line ecotox notes, one shown at random after each answer, all shown in the Field guide); the title screen has a **Deck** selector (all or one role, saved as `group` in settings); `GROUP_BY_ORDER` no longer exists (the guide filter uses `role`); the storage key is `ecotoxid.v1` and the service-worker cache prefix is `ecotoxid-` (so it can share the `dwdyck.github.io` origin with Wild ID). Wherever the text below says `wildid` or "Wild ID" read the Ecotox ID equivalent. The notes are brief general remarks written without a formal literature review; have a domain expert check them before the game is used for teaching.

Guide for AI coding agents (and human contributors). Read it top to bottom once; it is written so you can be productive in about five minutes. Where this file and the code disagree, the code wins: fix this file in the same change.

Quick start:

```
npm run check     # validates deck + game rules; must say "All checks passed"
npm start         # http://localhost:8123  (static server, no build step)
```

Live site: https://dwdyck.github.io/ecotox-id-battle/ - Repo: `DWDyck/ecotox-id-battle` (public).

---

## 1. Project Overview

**What it does.** Ecotox ID is a browser game styled as a retro creature-battle screen. A real iNaturalist photo of an insect, spider or other organism appears; the player picks its scientific name from four choices. Difficulty controls what you name: Easy = genus, Medium = species, Hard = genus + species. Three correct answers in a row trigger a **Challenge** round that shows only a silhouette. Progress is kept in a **Field guide** (a collection screen), stored in the browser.

**Primary users.**
- *Players:* students, naturalists and curious people, mostly on phones. They want a quick, fun way to learn to recognize taxa. They are not expected to know taxonomy.
- *Maintainer/owner:* a research entomologist who is **not a developer**. They maintain the species list through a web form (Pages CMS) and never run code. Anything that requires a terminal for routine upkeep is a regression.

**Main goals.**
1. Make learning scientific names feel like play, with accurate, properly credited real photos.
2. Zero running cost and zero servers: static hosting, no accounts, no tracking.
3. Content updates by non-coders: edit a list of names, wait a few minutes, the game updates.
4. Works well on phones, offline once loaded, keyboard and screen-reader usable.

**Explicit non-goals.**
- No user accounts, leaderboards, multiplayer, analytics, ads or server-side state.
- No runtime calls to third-party APIs from the browser (everything is pre-fetched into `data/`).
- No framework, bundler, transpiler or runtime npm dependency.
- No Nintendo/Pokemon assets, names, audio or trade dress. The look is an *unaffiliated homage* made of original pixel art; keep it that way.
- Not a field-identification tool: the game teaches names, it does not claim authoritative identification.

---

## 2. Architecture

### High-level design

A **static site** plus an **offline content pipeline**. The browser only ever loads files from its own origin.

```
 Maintainer (Pages CMS form)          GitHub Action "Build deck"
        |  edits                              |  runs scripts/build-deck.mjs
        v                                     v
 data/species.json  ---push--->  iNaturalist API + PhyloPic API
 (list of scientific names)              |  photos, taxonomy, look-alikes, silhouettes
                                         v
                          data/deck.json + data/photos/* + data/silhouettes/*
                                         |  committed by github-actions[bot]
                                         v
                              GitHub Pages serves the repo root
                                         v
                       Browser: index.html + js/*.js + css/style.css (+ sw.js cache)
```

### Major components

| Component | File | Responsibility |
|---|---|---|
| Boot / router | `js/main.js` | Load `deck.json`, inject scene backdrops, show/hide the four screens (`title`, `battle`, `guide`, `credits`), bind title-screen controls, register the service worker |
| Battle controller | `js/battle.js` (largest file, ~520 lines) | One run of the game: HUD, question flow, answer reveal, effects, challenge round, keyboard handling, photo zoom, results screen |
| Game rules (pure) | `js/game.js` | Modes, `makeQuestion`, `pickEntry`, `recentLimit` (size of the "don't repeat" window: `min(20, deck/2)`), scoring, EXP/levels. **No DOM**, unit-checked by `scripts/check.mjs` |
| Field guide | `js/guide.js` | Collection grid, group filter (`GROUP_BY_ORDER` maps an iNaturalist order to a friendly group; unmapped orders fall into "Other arthropods"), entry-card dialog |
| Async/text helpers | `js/ui.js` | `Flow` (cancellable timed steps), `TextBox` (typewriter dialogue, `*italic*` markup), `prefersReducedMotion` |
| Persistence | `js/storage.js` | `localStorage` wrapper (key `ecotoxid.v1`) |
| Art | `js/sprites.js` | Original pixel-art player sprite and scene backdrops, as SVG strings |
| Audio | `js/sound.js` | WebAudio chiptune effects, off by default |
| Offline | `sw.js` | App shell cache + cache-first media |
| Content pipeline | `scripts/build-deck.mjs` | Builds the deck from `data/species.json` |

### Data flow (one round)

1. `main.js` fetches `data/deck.json` (network-first via the service worker) and hands `deck.species` to `Battle`.
2. `Battle` asks `game.js#pickEntry` for an organism (avoids recent ones; needs a silhouette for challenges), then `makeQuestion(entry, mode, deck)` for four labels. Decoys come from `entry.decoys` (computed at build time from iNaturalist look-alikes in the same genus/family/order) topped up from the rest of the deck.
3. The photo loads from `data/photos/<file>`; the player answers; `Battle` updates HP/EXP/chain, reveals the name, credit and links, and calls `store.record(id, correct)`.
4. After `CHAIN_GOAL` (3) correct in a row, a challenge round runs with `data/silhouettes/<file>` (or a client-side pixelated photo if no silhouette exists). Clearing it promotes the mode (genus -> species -> both) and heals 2 HP.
5. HP 0 shows the results overlay and `store.submitRun` records best score/streak.

### State management

- **No framework, no store library.** Three kinds of state:
  - *Persistent:* `storage.js` (`discovered`, `best`, `stats`, `settings`) in `localStorage`. Reads are defensive (corrupt/blocked storage falls back to defaults).
  - *Run state:* a plain object inside `Battle` (hp, exp, level, chain, score, mode) mutated through `game.js` helpers such as `addExp`.
  - *UI state:* the DOM itself (`hidden` attributes for screens, `aria-*` for widgets). Screens are all present in `index.html` and toggled by `show()`.
- Every awaited delay/step in a battle goes through a `Flow`, so **"Run" cancels everything at once**. Do not use bare `setTimeout`/`await` inside battle logic; use `flow.delay()` / `flow.wait()` or "Run" will leave zombie timers.

---

## 3. Technology Stack

| Area | Choice |
|---|---|
| Frontend | Plain HTML5, CSS (container queries, `cqw` units), ES modules. No framework, no TypeScript |
| Runtime libraries | **None** |
| Font | Press Start 2P (Latin subset, WOFF2, SIL OFL, self-hosted in `fonts/`) |
| Tooling | Node 20+ only for `scripts/` (built-in `fetch`, `fs`, `http`). `package.json` has scripts but no dependencies and no lockfile |
| Content sources | iNaturalist API v1 (no key), PhyloPic API v2 (no key). Server-side only, inside the Action |
| CMS | Pages CMS (https://app.pagescms.org), configured by `.pages.yml` |
| Hosting | GitHub Pages, branch `main`, path `/` (legacy branch build, no build step) |
| CI | One GitHub Actions workflow: `.github/workflows/build-deck.yml` |
| Testing | `scripts/check.mjs` (Node, no framework) + manual browser verification |

### Deployment process

- **Code/UI change:** commit to `main` and push. Pages publishes in about 1-5 minutes. Hard-refresh to see it.
- **Species change:** edit `data/species.json` (Pages CMS or GitHub). The push triggers *Build deck*, which fetches content, runs `check.mjs`, and commits `data/` as `github-actions[bot]`. That bot commit also triggers a Pages build (verified).
- **Manual rebuild:** Actions tab > *Build deck* > *Run workflow* (tick `refresh` to re-pick every photo).
- Because the bot commits to `main`, **always `git pull` before you push**, or your push may be rejected.
- **Service worker:** bump `VERSION` in `sw.js` whenever any shipped app file changes (see section 4).

### Verified pipeline behavior (tested live, 2026-10-22)

| Case | Result |
|---|---|
| New valid species | Built (about 20-30 s each; a batch of 29 took about 12 min, a full 174-species `refresh` would take over an hour), committed by the bot, Pages redeploys. Add species in batches of about 25-30 so a failure is easy to isolate |
| Duplicate name in `species.json` | Skipped with a warning (the builder dedupes case-insensitively); build succeeds |
| Unknown name / typo | Other species still build and commit; the run then ends **red** (annotated `Species not added`) and GitHub emails the owner |
| Name removed from the list | Entry and its photo/silhouette files are pruned |
| An occasional Pages build shows `errored` when two pushes land seconds apart | Self-heals on the next successful build; no action needed |

**Not yet verified:** a real sign-in and save through Pages CMS. `.pages.yml` follows the documented single-file JSON pattern and the same edit made directly in `data/species.json` was tested end to end, but the CMS form itself has not been exercised. If the owner reports that saving does nothing, check `.pages.yml` first (field name `species`, `path: data/species.json`, `format: json`).

---

## 4. File Structure

```
index.html                 All screens + dialogs (card, zoom). Single page, no router library
css/style.css              All styling (~400 lines). Sizes in cqw inside .game
js/                        See component table above
fonts/                     Self-hosted font + OFL.txt (keep the license file)
icon.svg, manifest.webmanifest   PWA metadata
sw.js                      Service worker (CAUTION: version + file list)
data/species.json          HUMAN-EDITED list of scientific names
data/deck.json             GENERATED deck (do not hand-edit)
data/photos/, data/silhouettes/   GENERATED media (do not hand-edit)
scripts/build-deck.mjs     Deck builder (iNaturalist + PhyloPic)
scripts/check.mjs          Deck + game-rule validator
scripts/serve.mjs          Local static server (port 8123)
.github/workflows/build-deck.yml   Automation (CAUTION: write access to main)
.pages.yml                 Pages CMS schema for data/species.json
.gitattributes             Forces LF line endings (Windows owner + Linux Action)
README.md                  Short public/user-facing description
AGENTS.md                  This file
```

### Areas that need special caution

1. **`data/deck.json`, `data/photos/`, `data/silhouettes/`** are generated. Hand edits are overwritten and can break attribution. Change `species.json` or the builder instead.
2. **`sw.js`.** Two rules: (a) bump `VERSION` on every app-file release; (b) keep `SHELL` in sync with the real files in `js/`, `css/`, `fonts/`, `icon.svg`, `manifest.webmanifest`. A missing file makes `cache.addAll` fail and the *whole service worker install fails silently*. `check.mjs` now fails if `SHELL` differs from the real files or `VERSION` is not `ecotoxid-v<number>`; it cannot tell whether you remembered to bump the number.
3. **`.github/workflows/build-deck.yml`** has `contents: write` and pushes to `main`. See Security Rules.
4. **`js/game.js`** is pure on purpose and validated by `check.mjs`. Keep it DOM-free.
5. **`storage.js` key `ecotoxid.v1`.** If you change the saved shape incompatibly, bump the key (e.g. `ecotoxid.v2`) and migrate the old one; otherwise returning players lose their Field guide.
6. **`.pages.yml` field names** must match the JSON shape (`{"species": [...]}`). Renaming one without the other breaks the maintainer's only editing path.
7. **Photo licensing.** The builder restricts to cc0, cc-by, cc-by-sa, cc-by-nc, cc-by-nc-sa. Do not widen this or drop the stored `credit`/`link`; both are displayed in the game.
8. **Cache-first media (fixed by content hashing).** The SW serves `data/photos|silhouettes/*` cache-first by URL. The builder now saves new downloads as `<taxonId>-<first 8 hex of sha1>.<ext>` and records the name in `deck.json` (`photo.file`, `silhouette.file`), so a different image always gets a different URL and a returning player can never see a stale photo with a new credit. `deck.json` itself is network-first. Code must always read filenames from `deck.json`, never rebuild them from the taxon id. The original 60 entries keep their old `<taxonId>.<ext>` names until a `--refresh` re-downloads them (that is harmless: filenames only matter when the image changes).

---

## 5. Development Principles

- **Simplicity first.** The owner cannot debug a build system. Prefer a boring 20-line function to an abstraction.
- **Maintainability over cleverness.** Small modules, pure rules, explicit names. No metaprogramming, no clever one-liners that need a comment to decode.
- **Minimize dependencies.** Zero runtime deps today. Keep it that way (see Agent Constraints).
- **Mobile-first.** Design for ~360-430 px portrait first, then widen. Test a phone viewport before desktop. Layout uses a single size container (`.game`) and `cqw` units, so text and art scale together; fonts have `max()` floors so they never get unreadably small.
- **Accessibility is a requirement, not polish:**
  - Everything operable by keyboard: `1-4` answer, `Enter`/`Space` advance, arrows move within the choices, `Esc` closes dialogs.
  - Visible `:focus-visible` outlines; tap targets >= 44 px.
  - Dynamic text is announced via the `aria-live` regions (`#live`, `#title-stats`, `#guide-count`); keep them updated when you change dialogue.
  - Meters use `role="img"` + descriptive `aria-label`; difficulty is a `radiogroup`.
  - Respect `prefers-reduced-motion` (`Flow.delay` shortens waits; CSS has a reduced-motion block). Never convey correctness by color alone: `.is-correct`/`.is-wrong` styling is always paired with the dialogue text ("Correct! It's ..."), which is also announced via the live region.
  - Sound is off by default and starts only after a user gesture.

---

## 6. Coding Standards

**Naming.** `camelCase` for functions/variables, `PascalCase` for classes (`Battle`, `Flow`, `TextBox`), `UPPER_SNAKE` for constants (`MAX_HP`, `CHAIN_GOAL`). CSS uses BEM-ish `block__element` / `block--modifier` and state classes `is-*` (e.g. `.card-tile.is-unknown`). Files are lowercase single words. Ids in HTML are `kebab-case`; `main.js` and `battle.js` read them with a local `$('id')` helper.

**File organization.** One responsibility per module. Rules logic -> `game.js`; anything that touches the DOM -> `battle.js`/`guide.js`/`main.js`; persistence -> `storage.js`. New cross-cutting helpers go in `ui.js`. Imports are relative ES modules with the `.js` extension. If you add a file to `js/`, add it to `SHELL` in `sw.js`.

**Component structure.** There are no components; there are modules that own a part of the page. Build DOM with `createElement`/`append`/`textContent` (see the `el()` helper in `guide.js`), not string templates. Keep each module's DOM lookups in one place (`Battle` collects them in `this.el`).

**Error handling.**
- Boundaries (network, storage, image loading) get `try/catch` with a **user-visible, plain-language fallback** (e.g. "Could not load the species deck. Check your connection and reload."; "Something went wrong. Press Run and try again.").
- Storage failures are swallowed deliberately (`catch { /* storage blocked or corrupt: start fresh */ }`); the game must work with storage disabled.
- Cancellation uses the `Cancelled` error class; swallow it where flows are cancelled, never show it to the user.
- Pure code (`game.js`) does not throw for normal inputs; `makeQuestion` always returns 4 unique choices (verified by `check.mjs`).
- Scripts: fail loudly. `build-deck.mjs` skips a bad species with a warning but exits non-zero (code 2) so the Action turns red; `check.mjs` exits 1 on any failure.

**Logging.** Browser: `console.error(err)` only for genuine failures at a boundary; no debug logging committed, no analytics, no tracking. Scripts: concise progress lines (`+ Name`, `Deck: N species...`), warnings prefixed `!`, GitHub annotations via `::error title=...::`. Never log secrets (there are none).

**Style.** Two-space indent, single quotes, semicolons, `const` by default, early returns. Comment only the *why* of non-obvious code (e.g. the cache-first trap, the `cqw` formulas). Match the surrounding file.

---

## 7. Security Rules

This is a **public repository and public site**. Treat everything committed as world-readable.

- **Never expose secrets.** There are currently none and none are needed (both APIs are keyless). Do not add API keys, tokens or `.env` files. If a future feature needs a secret, use GitHub Actions secrets and server-side use only; never ship it to the browser.
- **Never commit credentials,** personal data, emails, or analytics identifiers. Check `git diff --cached` before committing.
- **Sanitize untrusted input.** The only untrusted text is API data: photographer credits (`photo.attribution`), names and links. Current rules, keep them:
  - Render all dynamic text with `textContent` / `el()`; **never `innerHTML` with data**. The existing `innerHTML`/`insertAdjacentHTML` uses insert only static, app-authored SVG strings (`sprites.js`, wipe cells). Keep it that way.
  - Links are *constructed by the builder* from numeric ids (`inaturalist.org/observations/<id>`, `phylopic.org/images/<uuid>`), opened with `rel="noopener"`. Do not pass through API-provided URLs unchanged.
  - Silhouettes are loaded as `<img src>` (scripts in SVG do not run in `<img>`). **Never inline downloaded SVGs into the DOM, and never `fetch`+`innerHTML` them.**
  - Downloaded filenames are `<numeric taxonId>.<ext>` (original 60) or `<numeric taxonId>-<8 hex sha1>.<ext>` (new); the extension is whitelisted to jpg/jpeg/png/webp. Never build file paths from species text or API strings.
  - The species name is the one free-text input: it is only used inside `encodeURIComponent` in API URLs and as a lookup key. Keep it that way.
- **Least privilege.** The workflow's `permissions` is `contents: write`; do not widen it. Use only first-party pinned-major actions (`actions/checkout@v4`, `actions/setup-node@v4`). Do not add `pull_request_target`, third-party actions, or steps that interpolate untrusted text into `run:` scripts (the only input is the boolean `refresh`). Only the bot should write `data/`.
- **No third-party requests from the browser.** No CDNs, fonts, trackers or embeds; this also keeps the offline/PWA behavior valid.
- **Document any risk you introduce or discover** in this file's section 10 and in the PR/commit message.

Known residual risks (accepted, documented): no Content-Security-Policy (see section 10); the repo is public so anyone can fork it (data is CC-licensed and credited); Pages CMS acts with the maintainer's GitHub permissions.

---

## 8. Agent Workflows

When making any change, follow this order:

1. **Understand the existing implementation.** Read the relevant module and this file. Run `npm run check` and play a round locally *before* editing so you know the baseline.
2. **Reuse existing patterns.** Pure rule -> `game.js`; DOM -> existing modules; delays -> `Flow`; text -> `TextBox`; storage -> `store`. Look for an existing helper before writing a new one.
3. **Minimize scope.** One concern per change. No drive-by reformatting or renames.
4. **Explain architectural trade-offs** in your PR/commit message or reply when more than one reasonable approach existed (what you chose, what you rejected, why).
5. **Identify risks before coding:** player data loss (storage shape), stale caches (SW version), attribution/licensing, pipeline breakage (`species.json`/`.pages.yml` shape), accessibility regressions, layout on small screens.
6. **List impacted files** up front and again at the end. Include `sw.js` (version/list), `README.md`/`AGENTS.md`, and `.pages.yml` when relevant.

Typical task recipes:

- **Add or remove species:** edit `data/species.json` only (the Action does the rest). Names must be exact two-word binomials as on iNaturalist; check for renamed taxa (e.g. `Papilio cresphontes` is now `Heraclides cresphontes`; `Agraulis vanillae` is now `Dione vanillae`; `Abaeis nicippe` is now `Eurema nicippe`; `Speyeria cybele` is now `Argynnis cybele`; `Uca pugilator` is now `Leptuca pugilator`). Before adding, look each name up at `https://api.inaturalist.org/v1/taxa?q=<name>&rank=species&is_active=true` and confirm it is the accepted name with a CC-licensed photo of at least 600 px. Add about 25-30 names per push, `git pull` first, then `gh run watch` the build; a red run names the species to fix. Keep to about 4 species per genus and aim for look-alike groups so decoys stay meaningful. If a new iNaturalist *order* appears, add it to `GROUP_BY_ORDER` in `js/guide.js` (otherwise it lands in "Other arthropods").
- **Change a rule or score:** edit `game.js`, extend `check.mjs` for it, then update this file's rules summary: Easy x1, Medium x2, Hard x3 points (base 100, x3 for challenges), EXP 10 per correct / 30 per challenge, 5 HP, wrong answer = -1 HP and chain reset, challenge after 3 in a row (+2 HP, promotes difficulty).
- **Change layout/CSS:** test at ~390x844, ~1280x800 and a short landscape phone (~844x390). Check: photo frame fully inside the scene, no infobox/photo overlap, no horizontal scroll, labels not broken mid-word, tiles uniform. Guide tile names (`.card-tile__name`) use container-query font sizes (smaller under 350 px, larger over 560 px) tuned so the longest word (12 letters: Subterranean, Yellowjacket, Walkingstick, Calligrapher) fits; re-test with every species identified if you touch them.
- **Ship a release:** `npm run check` -> bump `sw.js` `VERSION` -> `git pull` -> commit (include the `Co-authored-by` trailer when an AI assisted) -> push -> wait for Pages -> hard-refresh and smoke-test the live URL.

---

## 9. Agent Constraints

- **No new frameworks or build tools** (React, Vite, TypeScript, Tailwind...). If you believe one is justified, stop and write up the problem, the alternatives and the cost to a non-developer owner *before* adding it.
- **No new dependencies** (runtime or dev) without an explicit explanation of why the platform/Node built-ins are insufficient, the license, and the maintenance burden. Browser code must stay dependency-free.
- **Prefer modifying existing code over rewriting.** Do not split `battle.js` or reorganize folders opportunistically; propose it first.
- **Avoid premature optimization.** The deck is 174 species and about 33 MB in `data/` (about 180 KB per photo), but the first load is only about 370 KB because media is fetched lazily and cached as it is used. Do **not** precache media in `sw.js`. Optimize only with a measured problem (see thumbnails in section 11).
- **Preserve the architecture** (static site + pre-built deck + Pages CMS + Action) unless the owner asks to change it.
- **Do not hand-edit generated data,** do not widen photo licenses, do not add copyrighted/Nintendo assets, do not add tracking.
- **Keep the owner's workflow non-technical.** Any new content type should be editable through Pages CMS (`.pages.yml`) and rebuilt by the Action.
- **Windows/PowerShell 5 is the owner's environment:** no `&&`/`||` in shell instructions; use `;`. `git push` writes progress to stderr (not an error); verify with `git status -sb`.

---

## 10. Testing Expectations

### What should be tested

- **Automated, always:** `npm run check`. It verifies every deck entry has its files and credit, every species yields 4 unique choices with the correct one exactly once in all three modes, ids and photo filenames are unique, `sw.js` `SHELL` matches the real shipped files, and the core rules (`nextMode`, `addExp`, `pickEntry`) behave, including a 400-round simulation (no repeats inside the `recentLimit` window; challenge rounds always get a silhouette). It prints a warning (not a failure) for any entry with no look-alike decoys. The Action runs it on every deck build.
- **Add checks to `check.mjs`** for any new rule in `game.js` or any new deck invariant.

### Manual verification (about 5 minutes)

1. `npm start`, open `http://localhost:8123/` in a phone-sized window (about 390 px wide), then desktop.
2. Title screen: difficulty radios work by tap and arrow keys; stats show.
3. Play: answer right and wrong; confirm HP/EXP change, the reveal shows name + credit + links, `Run` exits cleanly mid-animation.
4. Get 3 correct in a row: challenge round shows a silhouette (or pixelated photo), clearing it promotes the mode.
5. Lose all HP: results overlay shows and `Try again` works.
6. Photo zoom (+) opens and closes (button, backdrop, `Esc`).
7. Field guide: tiles uniform, unknown entries are silhouettes (a "?" if the species has none), the "Show" filter counts match the tiles, no name breaks mid-word (check 360, 390 and 1280 px with every species identified), tapping an entry opens its card with credits.
8. Reload: progress persists. Toggle Sound. Keyboard-only run (`1-4`, `Enter`).
9. DevTools: no console errors, no failed requests, no horizontal scroll. Test offline after one load (service worker).
10. After a release: open the live URL in a fresh profile and confirm the new version loads (SW `VERSION`).

### Edge cases to remember

- Species with no silhouette (pixelated-photo fallback) and with only a genus/family-rank silhouette.
- Genera with a single species in the deck (decoys must come from outside the deck).
- Very small decks (the game must still show 4 unique choices).
- Long scientific names and names with non-Latin photographer credits (must wrap/fall back, not overflow).
- Storage blocked or corrupt (`localStorage` throws): game must still run.
- Slow/failed image loads; deck fetch failure message.
- Rapid double-taps and tapping during animations; pressing `Run` mid-flow.
- `prefers-reduced-motion` on; screen-reader pass over the live regions.
- Duplicate/typo/renamed names in `species.json` (the pipeline behaviors listed in section 3).

---

## 11. Future Improvements

### Known opportunities
- **Multiple decks / filters:** the Field guide now has a "Show" group filter. Still open: let players *play* a chosen group (spiders, beetles, butterflies, "Gulf Coast"), driven by a field in `species.json` and a Pages CMS select.
- **Better learning loop:** spaced repetition for missed species; "review mistakes" mode; show a diagnostic feature after each answer.
- **Progress backup:** export/import of the Field guide (JSON) since it is only in `localStorage`.
- **Maintainer feedback:** a PR-less way to see "which names failed" other than the red run email (for example, a generated `data/build-report.json` shown in Pages CMS).
- **Installable app:** add PNG icons (192/512 and maskable) to the manifest; iOS ignores SVG-only icons.
- **Content depth:** more species, plants/fungi, regional sets, common-name quiz mode.

### Technical debt
1. **No automated browser tests in the repo.** An end-to-end harness (Puppeteer driving headless Edge, which plays a full run and captures screenshots at phone/desktop/landscape) was used during development but lives outside the repo in a temp folder. Recommendation: add it as an optional `scripts/e2e.mjs` that does not add a dependency to the shipped site.
2. ~~`check.mjs` does not verify `sw.js` `SHELL`~~ **Done:** `check.mjs` verifies `SHELL` and `VERSION`. Still unchecked: that HTML ids referenced in JS exist.
3. ~~Media filenames are not content-hashed~~ **Done:** see section 4, caution 8. Remaining wrinkle: the original 60 entries still carry unhashed names until the next `refresh`.
4. **No Content-Security-Policy.** Pages cannot set headers, but a `<meta http-equiv="Content-Security-Policy">` (`default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'` or stricter) is feasible; needs a test pass because backdrops use inline SVG styling.
5. **`battle.js` is ~520 lines** mixing HUD updates, round flow, visual effects, keyboard and zoom. If it grows, split into `hud.js` and `effects.js`; do it as its own reviewed change with no behavior edits.
6. **Builder is sequential and slow** (~25 s per species, over an hour for a full 174-species `refresh`). Fine for now; for large decks add bounded concurrency while keeping the API throttle, and cache taxon/ancestor lookups.
7. **Decoy quality** depends on iNaturalist's "most observed" lists, so very obscure or recently renamed taxa can appear. Consider filtering by observation count and excluding inactive names.
8. **English only,** strings are inline in JS/HTML. If localization is ever needed, extract them first.
9. **Typos are only caught after the Action runs.** Pages CMS cannot validate names; the red-run email is the only signal.
10. **Silhouette ranks** can fall back to family level and look generic; the builder records `silhouette.rank` so the UI could label or de-prioritize those.

### Recommended refactors (in priority order)
1. Commit the e2e harness as `scripts/e2e.mjs`.
2. Add the CSP meta tag after testing.
3. Guide thumbnails: identified tiles load the ~150 KB 500 px photo into a ~130 px tile. A small thumbnail per species (built by the Action) would cut guide image weight a lot.
4. Split `battle.js` only if you are adding features there.

---

## 12. Project Status (as of release `wildid-v2`, 2026-10-22)

**State:** complete and live. 174 species (164 with silhouettes; the 10 without are *Sphex ichneumoneus*, *Sceliphron caementarium*, *Diapheromera femorata*, *Anisomorpha buprestoides*, *Climaciella brunnea*, *Reticulitermes flavipes*, *Dolomedes tenebrosus*, *Loxosceles reclusa*, *Peucetia viridans*, *Apheloria virginiensis*). Guide groups: Butterflies & moths 38, Beetles 24, Bees/wasps/ants 21, Flies 11, True bugs & cicadas 15, Dragonflies & damselflies 15, Grasshoppers & crickets 8, Mantises 3, Other insects 9, Spiders 16, Other arthropods 14. Only *Papilio* and *Bombus* reach the 4-per-genus cap.

**Measured numbers:** `data/` is about 33 MB (photos about 31 MB, silhouettes 1.9 MB, `deck.json` 276 KB). First load is about 370 KB over 14 requests (shell + `deck.json` + one silhouette); media is cached lazily by the service worker and must **not** be precached. App shell is about 86 KB.

**How the deck grew 60 -> 174:** 114 names were verified against the iNaturalist API (accepted name, CC photo of at least 600 px, PhyloPic silhouette at species, genus or family rank) and added in four batches (29, 29, 29, 28). Names that failed and were replaced: *Abaeis nicippe* -> *Eurema nicippe*, *Speyeria cybele* -> *Argynnis cybele*, *Uca pugilator* -> *Leptuca pugilator*; *Narceus americanus* had no usable photo and became *Apheloria virginiensis*.

**Verified at 390x844, 1280x800 and 844x390 (and guide widths 360/430/1920):** 20-round runs with 0 repeats and 5 challenges each, uniform guide tiles, no mid-word breaks, no horizontal overflow, filter counts equal tile counts, offline reload works, no console errors or failed requests; the same on the live site in a fresh profile. The e2e harness (Puppeteer driving headless Edge) is not in the repo because it would need a dependency; if you rebuild it, the id regex for media files must allow hashed names: `(\d+)(?:-[0-9a-f]+)?\.\w+$`. The title/battle intro waits for a tap or `Enter` before the question appears.

**Known limitations:** Pages CMS saving has never been exercised; decoys are iNaturalist look-alikes topped up from the rest of the deck, so some are taxonomically distant (e.g. a dragonfly genus among moth choices); identified guide tiles load the ~150 KB photo into a ~130 px tile; the original 60 entries keep unhashed filenames until a `refresh`.

**Not implemented (owner's call):** play-by-group decks, review-mistakes/spaced repetition, guide thumbnails, progress export/import, a build-report file for the CMS, PNG icons for iOS install, a CSP meta tag, name search in the guide, a committed e2e script.
