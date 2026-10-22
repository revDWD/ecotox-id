// Tiny square-wave sound effects (no audio files). Off by default; unlocked by a user tap.
let ctx = null;
let enabled = false;

function context() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, { type = 'square', gain = 0.06 } = {}) {
  const c = context();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(gain, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

const play = (notes) => {
  if (!enabled) return;
  notes.forEach(([f, s, d, opts]) => tone(f, s, d, opts));
};

export const sound = {
  get enabled() { return enabled; },
  set(on) { enabled = on; if (on) context(); },
  blip: () => play([[880, 0, 0.05]]),
  appear: () => play([[330, 0, 0.08], [440, 0.09, 0.08], [554, 0.18, 0.12]]),
  correct: () => play([[659, 0, 0.1], [880, 0.1, 0.1], [1319, 0.2, 0.22]]),
  wrong: () => play([[196, 0, 0.18, { type: 'sawtooth' }], [147, 0.16, 0.3, { type: 'sawtooth' }]]),
  challenge: () => play([[262, 0, 0.1], [262, 0.12, 0.1], [262, 0.24, 0.1], [349, 0.36, 0.3]]),
  levelUp: () => play([[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.35]]),
  faint: () => play([[440, 0, 0.1], [370, 0.1, 0.1], [294, 0.2, 0.1], [220, 0.3, 0.25]]),
};
