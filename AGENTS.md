# AGENTS.md - Ecotox ID

Guide for AI coding agents and human contributors. Where this file and the code disagree, the code wins: fix this file in the same change.

Ecotox ID is a fork of Wild ID (`DWDyck/wild-id-battle`) refocused on ecotoxicology and crop science. Live: https://dwdyck.github.io/ecotox-id-battle/ - Repo: `DWDyck/ecotox-id-battle` (public).

```
npm run check     # validates deck + game rules; must say "All checks passed"
npm start         # http://localhost:8123 (static server, no build step)
```

## 1. What it is

A retro creature-battle quiz. A real iNaturalist photo appears; the player picks the scientific name from four choices (Easy = genus, Medium = specific epithet with genus shown, Hard = both). Three correct answers in a row trigger a silhouette **Challenge** round. Progress is kept in a **Field guide** in `localStorage` (key `ecotoxid.v1`).

- **Deck:** about 143 organisms in four **roles**: `pest`, `enemy`, `pollinator`, `test`. The title screen has a Deck selector (all or one role, saved as `group` in settings); the Field guide filters by role. Each species has several one-line ecotox notes (one shown after each answer, all shown in the guide).
- **Rare encounters:** `"rare": true` entries stay out of the normal pool (`poolFor`) and appear with probability `RARE_CHANCE` in non-challenge rounds, with an optional `intro` line.
- **Legendary:** `"legendary": true` entries stay in the normal pool and also appear in a gold-glow encounter (`LEGEND_CHANCE`, CSS class `is-legend`). Today: the soybean looper, honoring the creator, DWD.
- **Fun facts:** `data/facts.json` maps a scientific name to engaging, concise lines; the builder prefixes "Fun fact:" and appends them (max 8 notes per species). Prefer a surprising behavior or ecological connection that helps explain crop pests, beneficials, pollinators, or test organisms. Keep peer-reviewed DOI citations as separate reference notes; don't turn every fun fact into a paper summary. Be accurate and accessible, avoid Bayer/product claims or promotional language, and do not present a general fact as regulatory advice. Structured sourced facts may use `{ "text", "source", "reviewedOn" }`; only set `reviewedOn` after checking the source and claim. Legacy strings remain supported but lack structured provenance.
- **Reference notes:** about 57 notes cite peer-reviewed papers with Bayer or Monsanto (now Bayer) co-authors, found via PubMed affiliations. Format: `Bayer co-authored: <First> et al. <year>, <journal> - <paraphrased title>; co-authors incl. <names>. doi:<doi>`. `guide.js` turns a trailing `doi:` into a link. Keep each note at 220 characters or less (the builder truncates silently, which would cut the DOI). Only add a reference after checking its authors and affiliation in PubMed; never invent citations or people.
- **Not authoritative:** the notes and facts come from general knowledge and have had no formal review. Have a domain expert check them before teaching use. The app states it is an unofficial personal project, not endorsed by Bayer.

**Goals:** play-first learning, zero running cost, no accounts or tracking, content edits by non-coders (the species list), phone-friendly and offline, keyboard and screen-reader usable.
**Non-goals:** accounts, leaderboards, analytics, ads, runtime third-party calls, frameworks or bundlers, Nintendo/Pokemon assets (the look is an unaffiliated homage with original art).

## 2. Architecture

A static site plus an offline content pipeline. The browser only loads files from its own origin.

```
data/species.json (+ data/facts.json)  --push-->  Action "Build deck": scripts/build-deck.mjs
   -> iNaturalist + PhyloPic APIs -> data/deck.json + data/photos/* + data/silhouettes/*
   -> committed by github-actions[bot] -> GitHub Pages -> browser (index.html, js/*, css, sw.js)
```

| File | Responsibility |
|---|---|
| `js/main.js` | Load `deck.json`, show/hide screens (`title`, `battle`, `guide`, `credits`), title controls, register the service worker |
| `js/battle.js` (~540 lines) | One run: HUD, question flow, reveal, effects, challenge/rare/legendary rounds, keyboard, zoom, results |
| `js/game.js` | Pure rules (no DOM): modes, `makeQuestion`, `pickEntry`, `poolFor`, `rarePoolFor`, chances, scoring |
| `js/guide.js` | Field guide grid, role filter, card dialog, DOI links |
| `js/ui.js` | `Flow` (cancellable timed steps), `TextBox` (typewriter), reduced-motion helper |
| `js/storage.js`, `sprites.js`, `sound.js` | `localStorage` wrapper, SVG pixel art, WebAudio effects (off by default) |
| `sw.js` | App-shell cache + cache-first media |
| `scripts/build-deck.mjs`, `check.mjs`, `serve.mjs` | Deck builder, validator, local server |
| `.pages.yml` | Pages CMS form for `data/species.json` |

**Data shape.** `data/species.json` is `{ "species": [ { name, role, notes[], rare?, legendary?, intro? } ] }`. `deck.json` and the media are generated; never hand-edit them.

**State.** No framework. Persistent state in `storage.js`; run state is a plain object in `Battle` mutated via `game.js` helpers; UI state is the DOM (`hidden`, `aria-*`). Every timed step in a battle goes through `Flow` (`flow.delay()` / `flow.wait()`), so "Run" cancels everything. Do not use bare `setTimeout` in battle logic.

## 3. Rules to keep

- **Service worker:** bump `VERSION` in `sw.js` (`ecotoxid-v<number>`) on every release of app files, and keep `SHELL` in sync with the real files in `js/`, `css/`, `fonts/`, `icon.svg`, `manifest.webmanifest`. A missing file makes the whole install fail silently. `check.mjs` checks the list and the name format, not that you bumped the number. The cache prefix `ecotoxid-` keeps it separate from Wild ID on the shared `dwdyck.github.io` origin.
- **Storage:** if the saved shape changes incompatibly, bump the key (`ecotoxid.v2`) and migrate.
- **Media:** read filenames from `deck.json` (they are content-hashed); never rebuild them from the taxon id. Do not precache media.
- **Licences and credits:** the builder only accepts cc0, cc-by, cc-by-sa, cc-by-nc and cc-by-nc-sa photos and stores `credit` and `link`. Do not widen this or drop the credits. NC licences matter if the app is ever used commercially.
- **`game.js` stays pure** and is covered by `check.mjs`; extend the check for any new rule.
- **`.pages.yml` field names** must match the JSON shape.
- **Windows/PowerShell:** no `&&`/`||`; use `;`. `git push` writes progress to stderr (not an error).

## 4. Security

Public repo and site. No secrets exist or are needed (both APIs are keyless).
- Render dynamic text with `textContent` / `el()`. `innerHTML` is allowed only for static app-authored SVG (`sprites.js`, wipe cells). Never inline downloaded SVGs; silhouettes load via `<img src>`.
- Links to iNaturalist/PhyloPic are built from numeric ids or UUIDs with `rel="noopener"`; DOI links use `https://doi.org/` + `encodeURI`.
- Never build file paths from species text or API strings.
- Workflow: `contents: write` only, first-party actions (`actions/checkout@v4`, `actions/setup-node@v4`), no `pull_request_target`.
- No third-party requests from the browser (no CDNs, fonts or trackers).
- Accepted risk: no Content-Security-Policy yet (see section 7).

## 5. How to work

1. Run `npm run check` and play a round before editing. Reuse existing patterns (pure rules in `game.js`, DOM in the screen modules, delays in `Flow`). One concern per change.
2. **Add or remove species:** edit `data/species.json` (and optionally `data/facts.json`), then `node scripts/build-deck.mjs` (about 25 s per new species) and `npm run check`. Names must be accepted two-word binomials on iNaturalist with a CC photo of at least 600 px; a name with no photo is dropped with a warning and the run exits non-zero. Facts keys that match no species also warn. Each role needs at least 4 species in the normal pool.
3. **Ship:** `npm run check` -> bump `sw.js` -> `git pull` -> commit (include the `Co-authored-by` trailer for AI-assisted commits) -> push -> `git pull --rebase` after the Action's bot commit -> hard-refresh the live site.
4. **Layout changes:** test about 390x844, 1280x800 and 844x390; no horizontal scroll, no mid-word breaks. Keep keyboard use (`1-4`, `Enter`, `Esc`), focus outlines, `aria-live` regions and `prefers-reduced-motion` working.
5. **Constraints:** no new frameworks or dependencies (explain first if you think one is needed); do not split `battle.js` or reorganize folders opportunistically; do not add tracking.

## 6. Testing

- `npm run check` (also run by the Action) verifies deck files and credits, 4 unique choices for every species in all modes, unique ids and filenames, the `SHELL` list and `VERSION`, role pool sizes, rare entries kept out of pools, and a 400-round simulation.
- Manual smoke test (about 5 minutes): title and difficulty, a right and a wrong answer, a challenge round, game over and retry, photo zoom, Field guide filter and cards, reload persistence, offline reload, no console errors.
- The legendary encounter was verified in Edge at 390x844 by forcing `Math.random` low: intro line, gold frame, correct species and reveal note, no console errors. It is random in production (about 1 in 65 battles).

## 7. Known gaps and ideas

- No committed browser test; no Content-Security-Policy (a `<meta>` tag is feasible but needs a test pass because backdrops use inline SVG styles).
- About 55 silhouette files are byte-identical copies shared by species in the same family (roughly 1 MB); storing one file per taxon would remove them.
- `battle.js` is the largest file; split only if features are added there.
- The builder is sequential and depends on live iNaturalist/PhyloPic; Pages CMS saving has not been exercised end to end.
- Ideas: play-by-role already exists; spaced repetition, progress export, guide thumbnails, a "featured authors" credits screen.

## 8. Status (2026-10-22)

Complete and live: 143 species (136 with silhouettes), 3 rare entries, 1 legendary, about 57 reference notes, fun facts for nearly every species, service worker `ecotoxid-v9`.
