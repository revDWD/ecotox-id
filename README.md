# Wild ID

A retro battle-screen game for learning to identify insects, spiders and other wildlife. A real [iNaturalist](https://www.inaturalist.org) photo appears, you pick the scientific name from four choices, and every correct answer wins the round.

**Play it:** https://dwdyck.github.io/wild-id-battle/

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

The deck has **174 organisms**: butterflies and moths, beetles, bees, wasps and ants, flies, true bugs, dragonflies, grasshoppers, mantises, spiders and other arthropods, with a focus on commonly seen North American species including the Gulf Coast. Together the photos weigh about 33 MB, but the game only downloads what it shows (about 370 KB on first load) and remembers it for offline play.

## Add or remove species (no coding)

1. Sign in at [app.pagescms.org](https://app.pagescms.org) with GitHub and open **wild-id-battle**.
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
