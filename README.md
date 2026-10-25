# Ecotox ID

Ecotox ID is a free, offline-friendly organism-identification quiz with a retro battle-screen presentation. Players identify real organisms from iNaturalist photos, learn brief ecotoxicology and ecology notes, and build a persistent Field guide.

**Play:** [revdwd.github.io/ecotox-id-battle](https://revdwd.github.io/ecotox-id-battle/)

**Current version:** shown on the Credits screen and sourced from `package.json`.

The game is an unofficial personal project. Its notes are general educational context, not authoritative scientific, regulatory, or risk-assessment advice. Have a domain expert verify material before using it for teaching or decisions.

## For players

### Gameplay

Choose an answer from the organism photo. A correct answer damages the opponent, earns points and experience, and records the organism in your Field guide. A wrong answer costs one of your five health points and breaks your streak. The battle continues until your health runs out; you can then start another run.

| Mode | Identification task | Choices |
|---|---|---:|
| Easy | Name the genus | 4 |
| Medium | Name the species; the genus is shown | 4 |
| Hard | Name the complete genus and species | 6 |

After three consecutive correct answers, a Challenge round presents a silhouette. Winning gives bonus points and experience, restores some health, and raises the identification difficulty when another mode is available. Challenge encounters prefer organisms with silhouettes.

Rare organisms are kept out of the normal pool and can appear unexpectedly in non-challenge rounds (4% chance). The soybean looper is both in the regular pool and eligible for a special gold-glow legendary encounter (1.5% chance in non-challenge rounds).

### Controls

- Select a difficulty with the mouse, touch, or keyboard arrow keys.
- Press **1–4** to answer in Easy and Medium; **1–6** in Hard.
- Press **Enter** or **Space** to advance/skip battle dialogue.
- Use **Escape** to close an open dialog.
- Use **Tab**, **Shift+Tab**, and **Enter** to navigate interface controls.

### Field guide

The Field guide includes all organisms in the deck, not only those already identified. Cards show the common name where available, otherwise the scientific name. Unknown organisms retain their silhouette/mystery-image reveal behavior; identified cards show the photo and organism details. Search by common or scientific name, or filter by role. Your discovery progress is saved locally in your browser.

The **Distribution map** lets you explore the deck by broad geographic region. Select a map area or region button to filter organisms, then open an organism to see its Field guide details. These region labels are approximate, may include introduced populations, and are not verified range maps or ecological advice.

The title screen also lets you select a role-based battle deck and change the scout palette. These preferences and discovery progress are stored in `localStorage`; they are not sent to a server.

## Organism deck

There are **143 unique organisms**: 140 regular encounters and three rare encounters. The deck covers crop pests, natural enemies, pollinators, and test/indicator species. All 143 are present in the Field guide. Seven regular organisms have no silhouette asset, so they do not appear in the silhouette-based Challenge pool while eligible silhouettes are available.

The deck and generated media are committed to the repository. The game itself loads only same-origin files and does not make runtime requests to iNaturalist, PhyloPic, or other third parties. Photo and silhouette credits and links are available in the game.

## Run and develop locally

### Requirements

- Node.js 20 or newer
- npm

```powershell
npm ci
npm start
```

Open <http://localhost:8123>. There is no bundler or build step for the web app.

### Checks and browser tests

```powershell
npm run check
npx playwright install chromium   # one-time browser setup
npm run test:smoke
```

`npm run check` validates generated deck/media, region metadata, credits, quiz-choice rules, role pools, service-worker shell, and gameplay simulations. `npm run test:smoke` uses Playwright to test difficulty counts, keyboard selection and battle progression, Field guide search/filter/cards, region selection, Credits, and responsive layouts. The GitHub Actions Check workflow runs both.

For a browser test failure, Playwright keeps traces in `test-results/` when configured to retain on failure; these local artifacts are ignored by Git.

### Organism content

- Edit `data/species.json` for the organism list, role-specific notes, and each organism's broad `regions` array. Choose one or more supported regions. Edit `data/facts.json` for additional facts. Do not hand-edit generated `data/deck.json` or media.
- To rebuild generated content after editing the list, run `npm run build-deck`. The builder queries iNaturalist and PhyloPic during development/build time, selects photos with supported Creative Commons licenses, and writes generated deck/media files.
- New entries need accepted two-word scientific names, usable iNaturalist photos, a valid role, and enough regular organisms per role to support question generation. The build can take time and may fail when external services or suitable licensed media are unavailable.
- Structured facts can include a checked source URL and ISO review date. Do not claim a fact was reviewed unless its claim and source were actually checked.

To edit content without coding, use Pages CMS as configured in `.pages.yml`, or edit the source JSON in GitHub. The “Build deck” workflow updates generated files when source content changes.

## Version, credits, and licensing

The visible app version is `package.json`'s `version` field, prefixed with `v` on the Credits screen. Increment it for a release. When changing app-shell files for a release, also bump the cache `VERSION` in `sw.js` and keep its `SHELL` file list accurate.

Organism photos come from iNaturalist and are used under supported Creative Commons licenses; individual photographers and observation links are credited in the app. Silhouettes are sourced from PhyloPic and artists are credited. The font is Press Start 2P by CodeMan38 (SIL Open Font License). Sprites and scenes are original project art.

Some educational notes cite peer-reviewed papers with Bayer or Monsanto co-authors. This project is not a Bayer product and is not endorsed by Bayer. Ecotoxicology notes and general facts have not received formal expert review.

## Known limitations and deferred ideas

- Content notes and facts need expert review; most legacy facts do not yet have structured source/review metadata.
- Seven regular organisms lack silhouette assets and are omitted from silhouette challenges when other silhouettes are available.
- The deck builder depends on live iNaturalist/PhyloPic APIs and usable licensed media; Pages CMS has not been tested end-to-end.
- The project has no Content Security Policy and no automated offline/browser installation test.
- Broad region assignments are preliminary approximations and need domain-expert review before being treated as distribution data.
- Other deferred ideas include collection statistics, a post-game review/study mode, progress export, and broader learning tools.

## For contributors and AI coding agents

Read [AGENTS.md](AGENTS.md) before making changes. It documents architecture, gameplay decisions, dataset audit results, safety/licensing rules, testing expectations, and deferred roadmap items.
