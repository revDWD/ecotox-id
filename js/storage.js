const KEY = 'ecotoxid.v1';
const DEFAULTS = {
  discovered: {},
  best: { streak: 0, score: 0 },
  stats: { rounds: 0, correct: 0 },
  settings: { sound: false, mode: 'genus', group: 'all', scout: 'classic' },
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        discovered: raw.discovered || {},
        best: { ...DEFAULTS.best, ...raw.best },
        stats: { ...DEFAULTS.stats, ...raw.stats },
        settings: { ...DEFAULTS.settings, ...raw.settings },
      };
    }
  } catch { /* storage blocked or corrupt: start fresh */ }
  return structuredClone(DEFAULTS);
}

let state = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export const store = {
  get settings() { return state.settings; },
  get best() { return state.best; },
  get stats() { return state.stats; },
  setSetting(name, value) { state.settings[name] = value; save(); },
  status(id) {
    const d = state.discovered[id];
    if (!d) return 'unknown';
    return d.correct > 0 ? 'identified' : 'seen';
  },
  entry(id) {
    return state.discovered[id] || { seen: 0, correct: 0 };
  },
  record(id, correct) {
    const d = (state.discovered[id] ||= { seen: 0, correct: 0 });
    d.seen += 1;
    if (correct) d.correct += 1;
    state.stats.rounds += 1;
    if (correct) state.stats.correct += 1;
    save();
  },
  identifiedCount() {
    return Object.values(state.discovered).filter((d) => d.correct > 0).length;
  },
  submitRun({ streak, score }) {
    const record = { streak: streak > state.best.streak, score: score > state.best.score };
    state.best.streak = Math.max(state.best.streak, streak);
    state.best.score = Math.max(state.best.score, score);
    save();
    return record;
  },
};
