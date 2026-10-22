// Sanity checks for the pure game rules and the built deck. Run: node scripts/check.mjs
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODE_ORDER, makeQuestion, labelFor, pickEntry, recentLimit, addExp, expNeeded, nextMode } from '../js/game.js';

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
const photoFiles = deck.map((e) => e.photo.file);
if (new Set(photoFiles).size !== photoFiles.length) fail('two species share one photo file');
const noLookAlikes = deck.filter((e) => !Object.values(e.decoys).some((list) => list.length)).map((e) => e.scientific);
if (noLookAlikes.length) console.warn(`note: no look-alike decoys for ${noLookAlikes.join(', ')} (choices will be random)`);

// sw.js: SHELL must list exactly the app files that exist, or the service worker install fails silently.
const swSource = await readFile(path.join(ROOT, 'sw.js'), 'utf8');
const shellMatch = swSource.match(/const SHELL = \[([\s\S]*?)\];/);
if (!shellMatch) fail('sw.js: could not find the SHELL list');
else {
  const shell = [...shellMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  const wanted = ['index.html', 'icon.svg', 'manifest.webmanifest'];
  for (const dir of ['css', 'js', 'fonts']) {
    for (const f of await readdir(path.join(ROOT, dir))) if (/\.(css|js|woff2)$/.test(f)) wanted.push(`${dir}/${f}`);
  }
  for (const f of shell) await access(path.join(ROOT, f)).catch(() => fail(`sw.js SHELL lists a missing file: ${f}`));
  for (const f of wanted) if (!shell.includes(f)) fail(`sw.js SHELL is missing ${f}`);
}
if (!/const VERSION = 'wildid-v\d+'/.test(swSource)) fail('sw.js: VERSION should look like wildid-v<number>');

// Picking: simulate long runs; nothing repeats within the recent window, and challenges get silhouettes.
{
  const limit = recentLimit(deck.length);
  const recent = [];
  const lastSeen = new Map();
  for (let round = 0; round < 400; round++) {
    const challenge = round % 4 === 3;
    const pick = pickEntry(deck, recent, { needSilhouette: challenge });
    if (lastSeen.has(pick.id) && round - lastSeen.get(pick.id) <= limit) fail(`pickEntry repeated ${pick.scientific} within ${limit} rounds`);
    if (challenge && deck.some((e) => e.silhouette) && !pick.silhouette) fail(`challenge round picked ${pick.scientific} without a silhouette`);
    lastSeen.set(pick.id, round);
    recent.push(pick.id);
    if (recent.length > limit) recent.shift();
  }
}
if (nextMode('genus') !== 'species' || nextMode('species') !== 'both' || nextMode('both') !== 'both') fail('nextMode');
const st = { exp: 0, level: 1 };
if (addExp(st, expNeeded(1) + 5) !== 1 || st.level !== 2 || st.exp !== 5) fail('addExp level up');
const recent = deck.slice(0, deck.length - 1).map((e) => e.id);
if (pickEntry(deck, recent).id !== deck[deck.length - 1].id) fail('pickEntry should avoid recent');
if (!pickEntry(deck, deck.map((e) => e.id))) fail('pickEntry falls back when all are recent');
const sil = deck.filter((e) => e.silhouette).length;
console.log(`${deck.length} species, ${sil} with silhouettes. ${failures ? failures + ' failure(s)' : 'All checks passed.'}`);
process.exit(failures ? 1 : 0);
