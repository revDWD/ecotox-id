# Wild ID

A retro battle-screen game for learning to identify insects, spiders and other wildlife. A real [iNaturalist](https://www.inaturalist.org) photo appears, you pick the scientific name from four choices, and every correct answer wins the round.

**Play it:** https://dwdike-maker.github.io/wild-id-battle/

## How it plays

| Difficulty | You name | Example |
|---|---|---|
| Easy | the genus | *Danaus* |
| Medium | the species | *Danaus plexippus* |
| Hard | genus and species | *Danaus plexippus* (no hints from the genus) |

- Pick one of four answers. Right answers drain the wild organism's HP and earn EXP; a wrong answer costs you 1 of your 5 HP and breaks your streak.
- After 3 correct in a row a **Challenge** round shows only a silhouette. Clear it for bonus points, +2 HP and a step up in difficulty.
- Every organism you meet is added to your **Field guide** (progress is saved in your browser).
- Works on phones and desktops, with keyboard play (1-4 or arrow keys + Enter), and offline once loaded.

## Add or remove species (no coding)

1. Sign in at [app.pagescms.org](https://app.pagescms.org) with GitHub and open **wild-id-battle**.
2. Edit **Species list**: one scientific name per line, two words, exactly as on iNaturalist (e.g. `Danaus plexippus`).
3. Save. A GitHub Action fetches the photos, silhouettes and look-alike answers, then the site updates in a few minutes.

Prefer GitHub directly? Edit `data/species.json`, or run the **Build deck** action from the Actions tab (tick *refresh* to re-pick every photo).

## Run locally

Requires Node 20+.

```
npm start            # http://localhost:8123
npm run build-deck   # fetch new photos/silhouettes for species.json
npm run check        # validate the deck and the game rules
```

## Credits

Photos come from iNaturalist observers under Creative Commons licenses; the photographer and license are shown in the game and in the Field guide. Silhouettes come from [PhyloPic](https://www.phylopic.org). Font: Press Start 2P (OFL). Sprites and scenes are original pixel art.

Wild ID is an unaffiliated, non-commercial homage to classic creature-battle games and is not connected to Nintendo, Game Freak or The Pokemon Company.

Developer notes for humans and AI agents: see [AGENTS.md](AGENTS.md).
