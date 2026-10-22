# AGENTS.md - Wild ID

Context for AI agents and contributors. Read this before changing anything.

## What this is

A static, no-build, no-dependency web game (plain HTML/CSS/ES modules) hosted on GitHub Pages at `https://dwdike-maker.github.io/wild-id-battle/`. The player sees an iNaturalist photo of an organism and picks its scientific name from 4 choices, inside a retro creature-battle screen. The owner is a research entomologist and not a developer: keep things simple, avoid tooling, and prefer changes that can be made through Pages CMS or GitHub's web UI.

## Hard constraints

- **No build step, no npm dependencies at runtime.** `package.json` only holds scripts. Scripts use Node 20+ built-ins (`fetch`, `fs`, `http`) only.
- **No runtime network calls to third parties.** All photos and silhouettes are pre-downloaded into `data/` by the deck builder. The game only loads its own files.
- **Everything shipped must be redistributable.** Photos are restricted to cc0 / cc-by / cc-by-sa / cc-by-nc / cc-by-nc-sa, with credit stored in the deck and displayed in-game. Sprites and backdrops are original (drawn in `js/sprites.js`); do not add Nintendo / Pokemon assets, names or audio.
- **Public site:** never commit secrets, personal data, tokens or API keys.

## Layout

```
index.html              All screens (title, battle, guide, credits) + dialogs (card, zoom)
css/style.css           All styling. Layout sizes use cqw units inside .game (container query)
js/main.js              Boot: load deck, route between screens, inject backdrops, register sw.js
js/battle.js            Battle screen: HUD, rounds, effects, keyboard, zoom, challenge/silhouette
js/game.js              PURE rules (no DOM): modes, makeQuestion, pickEntry, scoring, EXP/levels
js/guide.js             Field guide grid + card dialog + credits
js/sprites.js           Pixel-art player sprite and scene backdrops (SVG strings)
js/sound.js             WebAudio chiptune effects (off by default)
js/storage.js           localStorage wrapper, key `wildid.v1`
js/ui.js                Tiny DOM helpers
data/species.json       HUMAN-EDITED list of scientific names (via Pages CMS)
data/deck.json          GENERATED. Do not hand-edit
data/photos/, data/silhouettes/   GENERATED media
scripts/build-deck.mjs  Deck builder (iNaturalist + PhyloPic)
scripts/check.mjs       Validates deck.json and game.js rules; run after any change
scripts/serve.mjs       Local static server (npm start, default port 8123)
sw.js                   Service worker (offline shell + media cache)
.pages.yml              Pages CMS schema for data/species.json
.github/workflows/build-deck.yml   Rebuilds the deck on species.json changes
```

## Game rules (js/game.js is the source of truth)

- Modes: `genus` (Easy x1), `species` (Medium x2), `both` (Hard x3). Points = 100 x multiplier, x3 for challenges. EXP 10 per correct, 30 per challenge.
- 5 HP. Wrong answer: -1 HP, streak and chain reset. HP 0 shows the results screen.
- `CHAIN_GOAL = 3` correct in a row triggers a Challenge round (silhouette, or a pixelated photo when no silhouette exists). Clearing it gives +2 HP and promotes the mode (genus -> species -> both).
- Distractors come from `entry.decoys` (same family/genus from iNaturalist, computed at build time), topped up from the rest of the deck. `makeQuestion` returns `{choices, correctIndex}`.
- Progress (field guide, best score, settings) lives in `localStorage` under `wildid.v1`. If the saved shape changes incompatibly, bump the key (e.g. `wildid.v2`) and handle the old one in `js/storage.js`.

## The deck pipeline

`data/species.json` -> `scripts/build-deck.mjs` -> `data/deck.json` + `data/photos/*` + `data/silhouettes/*`.

- Per species it queries the iNaturalist API (taxon lookup, a CC-licensed research-grade photo, taxonomy/ancestry, observation count -> level, same-genus/family look-alikes) and PhyloPic (silhouette, exact-name match with species -> genus -> family fallback; 404 means "no match").
- Incremental by default (skips species already in the deck). `--refresh` rebuilds everything; `--only "Genus species"` rebuilds one. Calls are throttled (~750 ms); a full 60-species build takes ~20 minutes.
- iNaturalist taxa are renamed over time. If a name 404s, search iNaturalist for the current name (e.g. `Papilio cresphontes` is now `Heraclides cresphontes`; `Agraulis vanillae` is now `Dione vanillae`) and fix `species.json`.
- The Action (`build-deck.yml`) runs on pushes touching `data/species.json` and via manual **Run workflow** (optional `refresh`). It commits `data/` as `github-actions[bot]`. Pushes made with `GITHUB_TOKEN` may not trigger a further Pages build on their own; if the live site lags after an Action run, re-run the Pages deployment or push any small commit.
- Level = clamp(5, 90, round(100 - log10(observations) x 12)), so rarer species are higher level.

## Layout and CSS notes

- `.game` is a size container (`container-type: inline-size`); almost every size is in `cqw`, with `max()` floors on fonts so text stays readable on phones.
- `.scene` is 3:2 on wide containers and square below 560px (`@container (max-width: 559px)`), swapping to the tall backdrop and repositioning `.foe`, `.player` and the infoboxes.
- `.choice` is also a container; label font size is derived from the longest word via the `--n` custom property set in `Battle.setChoices`, so scientific names never break mid-word.
- Top-layer `<dialog>` elements (`.card`, `.zoom`) use px/vw units, not cqw.
- Respect `prefers-reduced-motion`. Keep tap targets >= 44px.

## Testing

1. `npm run check` - must print "All checks passed".
2. `npm start`, open `http://localhost:8123/`, play a few rounds on a phone-width window (about 390 px) and on desktop. Check: photo frame fully inside the scene, no infobox/photo overlap, no horizontal scroll, choice labels not wrapped mid-word, field guide tiles uniform, zoom dialog opens/closes.
3. Keyboard: 1-4 answers, Enter/Space advances, Escape closes dialogs.

## Releasing

- **Bump `VERSION` in `sw.js`** whenever any shipped app file changes, or returning players may see stale files.
- **Keep `SHELL` in `sw.js` in sync** with the files in `js/`, `css/`, `fonts/`, `icon.svg`, `manifest.webmanifest` (a missing file makes the service worker install fail).
- Deploy = push to `main`; Pages serves the repo root. Allow 1-5 minutes, then hard-refresh.

## Gotchas

- Windows + PowerShell 5 is the owner's environment: no `&&` / `||`; use `;`.
- Photo credits can contain non-Latin characters; the pixel font falls back to the system font for those. That is expected.
- The Field guide shows silhouettes for organisms you have not met yet; that is intentional (collection feel), not a spoiler leak, because the silhouette is not tied to the answer choices.
- Sound is off by default and only starts after a user gesture (browser autoplay rules).
