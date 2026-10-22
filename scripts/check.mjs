// Sanity checks for the pure game rules and the built deck. Run: node scripts/check.mjs
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODE_ORDER, makeQuestion, labelFor, pickEntry, addExp, expNeeded, nextMode } from '../js/game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deck = JSON.parse(await readFile(path.join(ROOT, 'data', 'deck.json'), 'utf8')).species;
let failures = 0;
const fail = (msg) => { failures++; console.error(`FAIL: ${msg}`); };

for (const entry of deck) {
  for (const f of [`data/photos/${entry.photo.file}`, entry.silhouette && `data/silhouettes/${entry.silhouette.file}`].filter(Boolean)) {
    await access(path.join(ROOT, f)).catch(() => fail(`${entry.scientific}: missing file ${f}`));
  }
  if (!entry.photo.credit || !entry.photo.link) fail(`${entry.scientific}: missing photo credit`);
  for (const mode of MODE_ORDER) {
    for (let i = 0; i < 25; i++) {
      const q = makeQuestion(entry, mode, deck);
      const unique = new Set(q.choices);
      if (q.choices.length !== 4) fail(`${entry.scientific}/${mode}: ${q.choices.length} choices`);
      if (unique.size !== q.choices.length) fail(`${entry.scientific}/${mode}: duplicate choices ${q.choices}`);
      if (q.choices[q.correctIndex] !== labelFor(mode, entry.scientific)) fail(`${entry.scientific}/${mode}: wrong correctIndex`);
      if (q.choices.filter((c) => c === labelFor(mode, entry.scientific)).length !== 1) fail(`${entry.scientific}/${mode}: correct answer repeated`);
    }
  }
}

if (new Set(deck.map((e) => e.id)).size !== deck.length) fail('duplicate species ids in deck');
if (nextMode('genus') !== 'species' || nextMode('species') !== 'both' || nextMode('both') !== 'both') fail('nextMode');
const st = { exp: 0, level: 1 };
if (addExp(st, expNeeded(1) + 5) !== 1 || st.level !== 2 || st.exp !== 5) fail('addExp level up');
const recent = deck.slice(0, deck.length - 1).map((e) => e.id);
if (pickEntry(deck, recent).id !== deck[deck.length - 1].id) fail('pickEntry should avoid recent');
if (!pickEntry(deck, deck.map((e) => e.id))) fail('pickEntry falls back when all are recent');
const sil = deck.filter((e) => e.silhouette).length;
console.log(`${deck.length} species, ${sil} with silhouettes. ${failures ? failures + ' failure(s)' : 'All checks passed.'}`);
process.exit(failures ? 1 : 0);
