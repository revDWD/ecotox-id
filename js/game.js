// Pure game rules: no DOM, so it can be unit-tested in Node.

export const MODES = {
  genus: { label: 'Easy', named: 'Genus', short: 'GENUS', multiplier: 1 },
  species: { label: 'Medium', named: 'Species', short: 'SPECIES', multiplier: 2 },
  both: { label: 'Hard', named: 'Genus + species', short: 'BOTH', multiplier: 3 },
};
export const MODE_ORDER = ['genus', 'species', 'both'];
export const CHAIN_GOAL = 3;
export const MAX_HP = 5;

const genusOf = (name) => name.split(' ')[0];
const epithetOf = (name) => name.split(' ')[1];

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const nextMode = (mode) => MODE_ORDER[Math.min(MODE_ORDER.indexOf(mode) + 1, MODE_ORDER.length - 1)];
export const expNeeded = (level) => 40 + 20 * (level - 1);
export const pointsFor = (mode, challenge) => 100 * MODES[mode].multiplier * (challenge ? 3 : 1);
export const expFor = (challenge) => (challenge ? 30 : 10);

export function labelFor(mode, scientific) {
  if (mode === 'genus') return genusOf(scientific);
  if (mode === 'species') return epithetOf(scientific);
  return scientific;
}

// Fills `count` unique labels, taking one from each source in turn so the mix stays varied.
function fill(sources, count, taken, toLabel, rng) {
  const queues = sources.map((s) => shuffle(s, rng));
  const out = [];
  let guard = 0;
  while (out.length < count && queues.some((q) => q.length) && guard++ < 500) {
    for (const q of queues) {
      while (q.length) {
        const label = toLabel(q.shift());
        if (label && !taken.has(label)) {
          taken.add(label);
          out.push(label);
          break;
        }
      }
      if (out.length === count) break;
    }
  }
  return out;
}

export function makeQuestion(entry, mode, deck, rng = Math.random) {
  const others = deck.filter((e) => e.id !== entry.id);
  const correct = labelFor(mode, entry.scientific);
  const taken = new Set([correct]);
  const d = entry.decoys;
  let sources;

  if (mode === 'genus') {
    sources = [d.genusFamily, d.genusOrder, others.map((e) => e.genus)];
  } else if (mode === 'species') {
    const sameGenusDeck = others.filter((e) => e.genus === entry.genus).map((e) => e.scientific);
    sources = [d.speciesGenus.concat(sameGenusDeck), d.speciesFamily, others.map((e) => e.scientific)];
  } else {
    const sameGenusDeck = others.filter((e) => e.genus === entry.genus).map((e) => e.scientific);
    const sameFamilyDeck = others.filter((e) => e.family === entry.family).map((e) => e.scientific);
    sources = [
      d.speciesGenus.concat(sameGenusDeck),
      d.speciesFamily.concat(sameFamilyDeck),
      d.speciesGenus.concat(sameGenusDeck),
      others.map((e) => e.scientific),
    ];
  }

  // genus sources hold bare genus names; species and both sources hold full binomials
  const decoys = fill(sources, 3, taken, mode === 'genus' ? (v) => v : (v) => labelFor(mode, v), rng);

  const labels = shuffle([correct, ...decoys], rng);
  return {
    mode,
    entry,
    correctLabel: correct,
    correctIndex: labels.indexOf(correct),
    choices: labels,
  };
}

export function pickEntry(deck, recent, { needSilhouette = false } = {}, rng = Math.random) {
  let pool = deck.filter((e) => !recent.includes(e.id));
  if (needSilhouette) {
    const withSil = pool.filter((e) => e.silhouette);
    if (withSil.length) pool = withSil;
  }
  if (!pool.length) pool = deck;
  return pool[Math.floor(rng() * pool.length)];
}

export function addExp(state, amount) {
  state.exp += amount;
  let leveled = 0;
  while (state.exp >= expNeeded(state.level)) {
    state.exp -= expNeeded(state.level);
    state.level += 1;
    leveled += 1;
  }
  return leveled;
}
