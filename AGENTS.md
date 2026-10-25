# AGENTS.md — Ecotox ID

Quick-start guide for contributors and AI agents. Read this before changing code. When this guide disagrees with the implementation, the code is authoritative; update this document with relevant behavior changes.

**Live site:** https://revdwd.github.io/ecotox-id-battle/
**Repository:** `revDWD/ecotox-id-battle` (public)
**App version:** `package.json` (`0.1.0` currently); visible in Credits.

```powershell
npm ci
npm run check
npx playwright install chromium   # one-time browser setup
npm run test:smoke
npm start                          # http://localhost:8123
```

## Purpose and audience

Ecotox ID is a static, phone-friendly organism identification quiz with a retro battle interface. Its intended audience is curious learners, players, and educators interested in crop pests, natural enemies, pollinators, and ecotoxicology test organisms.

The educational goal is play-first familiarity with organism names and brief ecology/ecotoxicology context. Notes are not authoritative, have not had formal expert review, and must not be presented as regulatory or risk-assessment advice. The project is an unofficial personal project, not endorsed by Bayer.

Product priorities: no accounts, tracking, ads, or runtime third-party calls; offline support; accessible keyboard and screen-reader interaction; lightweight static assets; content edits approachable to non-coders.

## Gameplay and product decisions

- **Easy:** identify genus; four answer choices.
- **Medium:** identify the species with genus shown; four answer choices. Player-facing terminology is “species,” not “specific epithet.” The answer label is still the epithet internally, with the genus shown in the prompt.
- **Hard:** identify full genus and species; exactly six answer choices.
- Choice counts are explicit, independent `MODES.*.choiceCount` values in `js/game.js`. Preserve 4/4/6 and unique randomized choices.
- Correct answers award points/experience and record discovery. Incorrect answers reduce player health and break streaks.
- Three correct answers in a row trigger a silhouette Challenge. Victory restores some health, grants bonus rewards, and steps difficulty upward. Challenges prefer entries with silhouettes.
- Rare entries (`rare: true`) are excluded from the regular pool and can appear with 4% probability in non-challenge rounds. The legendary soybean looper remains in the regular pool and has a 1.5% gold-glow encounter chance.
- Field guide cards always show an organism name (common name when present; scientific-name fallback). The Field guide and Distribution map share the same card component and unknown/seen/identified image reveal states. Card dialogs and detail workflows remain intact. Search matches common and scientific names; role and discovery-status filters and visible-subset progress counts are supported.
- Battle answer labels render on screen entry and remain disabled until the opening encounter and prompt are ready, avoiding a late menu pop-in without allowing premature answers.
- The Field guide contains all organisms, including rare organisms. Discovery progress, best scores, settings, and preferences are stored locally using `ecotoxid.v1`.
- The Distribution map filters organisms by broad geographic region. Its preliminary approximations may include introduced populations and are not verified range maps; each organism’s multi-region labels are stored as `regions` in `data/species.json` and copied into the generated deck. It shares the Field guide card renderer and reveal states.
- The Home screen supports a role-based battle deck and four saved scout palettes.
- App version shown in Credits comes from `package.json`; do not duplicate the version string in UI source. Bump the service-worker cache version on app releases.

## Dataset audit (2026-10-24)

- 143 source organisms and 143 generated deck entries.
- All 143 organisms now have one or more preliminary region labels from seven broad regions; these labels are approximate and need expert review.
- The collection intentionally includes Common Duckweed (`Lemna minor`) as an ecotoxicology test plant (OECD Test Guideline 221), alongside animal test organisms.
- 143 unique scientific names and unique IDs; no duplicates.
- No source/deck mismatches and no invalid binomial/genus/epithet mismatches were found.
- No unusable quiz entries; all 143 appear in the Field guide.
- 140 regular organisms and 3 rare organisms.
- Seven regular organisms have no silhouette asset. They are skipped for silhouette Challenges when other eligible silhouettes are available; they still appear in regular rounds and the Field guide.
- 133 entries have a common name; 10 display their scientific name instead.
- Most legacy facts lack structured source and review-date metadata. Content needs domain-expert review.

## Architecture

No framework or bundler. Browser loads static first-party files. The build/content pipeline is separate from runtime:

```text
data/species.json + data/facts.json
    -> scripts/build-deck.mjs (iNaturalist + PhyloPic build-time APIs)
    -> data/deck.json + data/photos/ + data/silhouettes/
    -> GitHub Pages -> browser app
```

| File or folder | Responsibility |
|---|---|
| `index.html` | Screens, controls, semantic structure |
| `js/main.js` | Load deck; screen flow; title controls; version display; service worker |
| `js/battle.js` | Battle lifecycle, HUD, questions, reveals, effects, controls, results |
| `js/game.js` | Pure game rules and mode/pool/question/scoring helpers; no DOM |
| `js/guide.js` | Shared organism cards, sorted Field guide, role/status filtering, name search, card details |
| `js/map.js`, `js/regions.js` | Interactive broad-region map and shared region names |
| `js/ui.js` | Cancellable `Flow`, dialogue `TextBox`, reduced-motion helper |
| `js/storage.js` | Local persistence wrapper (`ecotoxid.v1`) |
| `js/sprites.js`, `js/sound.js` | Original SVG art and opt-in WebAudio effects |
| `css/style.css` | Responsive layouts, pixel-art styling, reduced motion |
| `data/species.json` | Editable source organism list |
| `data/facts.json` | Supplemental facts keyed by scientific name |
| `data/deck.json` | Generated runtime organism deck; never edit manually |
| `data/photos/`, `data/silhouettes/` | Generated, content-hashed media |
| `scripts/build-deck.mjs` | Build deck/media; requires live external APIs |
| `scripts/check.mjs` | Deck, media, rule, file-list, and simulation checks |
| `scripts/serve.mjs` | Minimal local static server |
| `tests/browser/`, `playwright.config.js` | Playwright browser smoke tests |
| `.github/workflows/check.yml` | CI runs project checks and browser smoke tests |
| `.github/workflows/build-deck.yml` | Rebuild generated deck on source-content changes |
| `sw.js` | App-shell offline cache and cache-first media |

### Data conventions

- Source file shape: `{ "species": [{ "name", "role", "regions", "notes", "rare?", "legendary?", "intro?" }] }`. Valid roles: `pest`, `enemy`, `pollinator`, `test`. Each organism's non-empty `regions` array uses one or more values from the shared region list in `js/regions.js`. These preliminary labels are not verified range maps.
- Scientific names are two-word binomials accepted by iNaturalist. Deck stores scientific name, genus, epithet, common name, taxonomy, role, notes, photo/silhouette credits, and decoy pools.
- Media paths come from generated `deck.json`; never reconstruct filenames from taxon IDs or species names.
- Only supported CC photo licenses are allowed: `cc0`, `cc-by`, `cc-by-sa`, `cc-by-nc`, `cc-by-nc-sa`. Preserve attribution and source links.
- Structured fact objects may contain `text`, `source`, and `reviewedOn`; only use a review date after verifying both claim and source. Legacy fact strings remain supported.
- Keep notes concise. Reference notes must be checked against PubMed affiliations and remain within the builder’s 220-character limit, including DOI.

## Project conventions and UX requirements

- One concern per change; inspect existing patterns first. Prefer pure rules in `game.js`, DOM operations in screen modules, and `Flow` for timed battle actions.
- Keep `game.js` DOM-free and extend `scripts/check.mjs` when game rules change.
- Use DOM `textContent`/element helpers for dynamic content. `innerHTML` is limited to static, app-authored SVG. Never inline downloaded SVG; load it as an image.
- Preserve semantic controls, visible focus, keyboard support, `aria-live` messages, and `prefers-reduced-motion`.
- Test responsive changes at approximately **390×844**, **1280×800**, and **844×390**. Avoid horizontal overflow and mid-word breaks.
- Keep interactions and presentation consistent across title, battle, guide, and credits. Names should improve discoverability without exposing unknown photos or changing discovery progression.
- No runtime third-party resources, trackers, accounts, or new frameworks. Playwright is a development-only dependency for browser tests.
- Do not split `battle.js` or reorganize the project opportunistically. If a larger refactor is justified, keep it separately scoped and tested.

## Testing expectations

1. `npm run check` — required after data/rule changes.
2. `npm run test:smoke` — required after UI/gameplay changes; installs Playwright Chromium once via `npx playwright install chromium`.
3. CI in `.github/workflows/check.yml` runs `npm ci`, `npm run check`, installs Chromium, and runs smoke tests.
4. Smoke coverage includes difficulty selection and answer counts, immediate battle choice rendering, keyboard answers and battle progression, Field guide names/search/role/status filters/card details, region map selection and results, Credits version, and mobile portrait/landscape plus desktop layout.
5. For layout or interaction changes, manually verify additional affected paths when appropriate: correct/wrong answer, Challenge, Run/retry, zoom, guide reveal, persistence, offline reload, and browser console.

## Release and safety rules

- Update `package.json` version for a release. Bump `VERSION` in `sw.js` (`ecotoxid-v<number>`) whenever app-shell files change.
- Keep `sw.js` `SHELL` synchronized with actual app-shell files. Missing files can make offline installation fail.
- The `ecotoxid-` cache prefix isolates this app from Wild ID on the shared GitHub Pages origin. Never precache media.
- Keep saved-state compatibility; if the `ecotoxid.v1` shape changes incompatibly, bump the key and provide a migration.
- Preserve `contents: read` for checks and `contents: write` only where the build-deck action needs it. Use first-party Actions only; do not add `pull_request_target`.
- `git push` may write progress to stderr; inspect exit status rather than treating stderr itself as failure. AI-assisted commits include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

## Deferred roadmap

Do not implement these without a focused user request:

- Collection progress statistics and progress export/import.
- Post-game review mode, missed-question practice, and other study tools.
- Additional browser coverage for offline install/reload, accessibility audits, and broader battle states.
- Expert review and structured provenance for legacy facts.
- Optional deduplication of identical silhouette files and eventual `battle.js` modularization if feature work warrants it.

## Current project status

Version `0.1.0`; service-worker cache `ecotoxid-v13` on the last deployed release. The latest deployed app includes scout palettes, per-mode 4/4/6 choices, Medium “species” wording, Field guide names/search/role filters, broad region map, Credits version, and browser smoke tests. Data totals and caveats are recorded above.
