# Ecotox ID

A retro battle-screen game for learning to identify insects, spiders and other wildlife. A real [iNaturalist](https://www.inaturalist.org) photo appears, you pick the scientific name from four choices, and every correct answer wins the round.

**Play it:** https://dwdyck.github.io/ecotox-id-battle/

## How it plays

| Difficulty | You name | Example |
|---|---|---|
| Easy | the genus | *Danaus* |
| Medium | the species | *Danaus plexippus* |
| Hard | genus and species | *Danaus plexippus* (no hints from the genus) |

- Pick one of four answers. Right answers drain the wild organism's HP and earn EXP; a wrong answer costs you 1 of your 5 HP and breaks your streak.
- After 3 correct in a row a **Challenge** round shows only a silhouette. Clear it for bonus points, +2 HP and a step up in difficulty.
- Every organism you meet is added to your **Field guide** (progress is saved in your browser). Use the **Show** menu in the guide to look at one group at a time (butterflies, beetles, spiders and so on).
- Works on phones and desktops, with keyboard play (1-4 or arrow keys + Enter), and offline once loaded.

The deck has **130 organisms** plus one rare surprise, grouped by role: **crop pests** (caterpillars, beetles, aphids, mites and other pests of corn, soybean, cotton, vegetables and orchards), **natural enemies** (ladybirds, parasitoid wasps, predatory bugs, mites and spiders), **pollinators** (honey bees, bumble bees, native bees, hoverflies) and **test and indicator species** (organisms used in ecotoxicology tests, such as *Daphnia*, *Chironomus* and *Eisenia*). Pick a deck on the title screen, or play everything. After every answer you get a one-line ecotox note about the organism, and the Field guide lists all of its notes. The notes are brief general remarks, not regulatory advice, so check them against primary sources before relying on them.

**Rare encounter:** an entry marked `"rare": true` in `data/species.json` stays out of the normal rotation and appears in about 1 of 25 battles, with an optional `"intro"` line (the current one is a bombardier beetle, *Brachinus fumans*).

## Add or remove species (no coding)

1. Sign in at [app.pagescms.org](https://app.pagescms.org) with GitHub and open **ecotox-id-battle**.
2. Edit **Species list**: one scientific name per line, two words, exactly as on iNaturalist (e.g. `Danaus plexippus`).
3. Save. A GitHub Action fetches the photos, silhouettes and look-alike answers, then the site updates in a few minutes (about 20-30 seconds per new species, so a batch of about 25-30 names takes roughly 12 minutes; adding in batches makes a typo easy to find).

If a name can't be found (usually a typo, or iNaturalist renamed the species), the other species are still added, the run in the Actions tab turns red, GitHub emails you, and the log names the species to fix.

Prefer GitHub directly? Edit `data/species.json`, or run the **Build deck** action from the Actions tab (tick *refresh* to re-pick every photo).

## Run locally

Requires Node 20+.

```
npm start            # http://localhost:8123
npm run build-deck   # fetch new photos/silhouettes for species.json
npm run check        # validate the deck, the game rules and the offline file list
```

## Credits

Photos come from iNaturalist observers under Creative Commons licenses; the photographer and license are shown in the game and in the Field guide. Silhouettes come from [PhyloPic](https://www.phylopic.org). Font: Press Start 2P (OFL). Sprites and scenes are original pixel art.

Wild ID is an unaffiliated, non-commercial homage to classic creature-battle games and is not connected to Nintendo, Game Freak or The Pokemon Company.

Developer notes for humans and AI agents: see [AGENTS.md](AGENTS.md).
