// Sanity checks for the pure game rules and the built deck. Run: node scripts/check.mjs
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MODE_ORDER, ROLES, ROLE_ORDER, MODES, poolFor, makeQuestion, labelFor, pickEntry, recentLimit, addExp, expNeeded, nextMode } from '../js/game.js';
import { SCOUT_PALETTES, playerSprite } from '../js/sprites.js';
import { REGIONS } from '../js/regions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deck = JSON.parse(await readFile(path.join(ROOT, 'data', 'deck.json'), 'utf8')).species;
const sourceSpecies = JSON.parse(await readFile(path.join(ROOT, 'data', 'species.json'), 'utf8')).species;
const sourceByName = new Map(sourceSpecies.map((entry) => [entry.name, entry]));
const facts = JSON.parse(await readFile(path.join(ROOT, 'data', 'facts.json'), 'utf8'));
let failures = 0;
const fail = (msg) => { failures++; console.error(`FAIL: ${msg}`); };
const validHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

if (labelFor('species', 'Danaus plexippus') !== 'plexippus') fail('medium mode should keep its existing answer labels');
if (MODES.genus.choiceCount !== 4 || MODES.species.choiceCount !== 4 || MODES.both.choiceCount !== 6) {
  fail('difficulty modes should independently configure 4, 4, and 6 choices');
}
if (new Set(SCOUT_PALETTES.map((palette) => palette.id)).size !== SCOUT_PALETTES.length) {
  fail('scout palette ids must be unique');
}
if (SCOUT_PALETTES.length !== 4 || new Set(SCOUT_PALETTES.map((palette) => playerSprite(palette.id))).size !== 4) {
  fail('the four scout palettes should render distinct sprites');
}
const appHtml = await readFile(path.join(ROOT, 'index.html'), 'utf8');
const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) fail('package.json: version should use major.minor.patch format');
if (!/id="app-version"/.test(appHtml)) fail('Credits should include an app version display');
if (!/data-mode="species"[^>]*>[\s\S]*?<small>Species<\/small>/.test(appHtml)) {
  fail('medium difficulty subtitle should be exactly "Species"');
}
if (/specific epithet/i.test(appHtml)) fail('medium difficulty subtitle should not say "specific epithet"');
const answerIndexes = [...appHtml.matchAll(/class="choice"[^>]*data-i="(\d+)"/g)].map((match) => Number(match[1]));
if (answerIndexes.length !== 6 || answerIndexes.some((index, position) => index !== position)) {
  fail('index.html should define six answer buttons indexed 0 through 5');
}
const mapRegions = [...appHtml.matchAll(/class="region-map__area" data-region="([^"]+)"/g)].map((match) => match[1]);
if (JSON.stringify(mapRegions) !== JSON.stringify(REGIONS)) {
  fail('index.html map areas should match the shared region list');
}

let legacyFacts = 0;
for (const [name, value] of Object.entries(facts)) {
  const entries = Array.isArray(value) ? value : [value];
  for (const [index, fact] of entries.entries()) {
    if (typeof fact === 'string') {
      if (!fact.trim()) fail(`facts.json: ${name}[${index}] is empty`);
      legacyFacts++;
      continue;
    }
    const date = typeof fact?.reviewedOn === 'string' ? new Date(`${fact.reviewedOn}T00:00:00Z`) : null;
    if (
      !fact || typeof fact !== 'object' || typeof fact.text !== 'string' || !fact.text.trim() ||
      !validHttpUrl(fact.source) ||
      !date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== fact.reviewedOn
    ) {
      fail(`facts.json: ${name}[${index}] must have non-empty text, an http(s) source URL, and a valid reviewedOn date`);
    }
  }
}
if (legacyFacts) console.warn(`note: ${legacyFacts} legacy fact(s) have no structured source or review date`);

for (const entry of deck) {
  if (!Array.isArray(entry.regions) || !entry.regions.length || new Set(entry.regions).size !== entry.regions.length ||
    entry.regions.some((region) => !REGIONS.includes(region))) {
    fail(`${entry.scientific}: regions must be a non-empty array of unique supported regions`);
  }
  const source = sourceByName.get(entry.scientific);
  if (!source) fail(`${entry.scientific}: missing from species.json`);
  else if (JSON.stringify(entry.regions) !== JSON.stringify(source.regions)) {
    fail(`${entry.scientific}: deck regions do not match species.json`);
  }
  for (const f of [`data/photos/${entry.photo.file}`, entry.silhouette && `data/silhouettes/${entry.silhouette.file}`].filter(Boolean)) {
    await access(path.join(ROOT, f)).catch(() => fail(`${entry.scientific}: missing file ${f}`));
  }
  if (!entry.photo.credit || !entry.photo.link) fail(`${entry.scientific}: missing photo credit`);
  for (const mode of MODE_ORDER) {
    for (let i = 0; i < 25; i++) {
      const q = makeQuestion(entry, mode, deck);
      const unique = new Set(q.choices);
      const expectedChoices = MODES[mode].choiceCount;
      if (q.choices.length !== expectedChoices) fail(`${entry.scientific}/${mode}: expected ${expectedChoices} choices, got ${q.choices.length}`);
      if (unique.size !== q.choices.length) fail(`${entry.scientific}/${mode}: duplicate choices ${q.choices}`);
      if (q.choices[q.correctIndex] !== labelFor(mode, entry.scientific)) fail(`${entry.scientific}/${mode}: wrong correctIndex`);
      if (q.choices.filter((c) => c === labelFor(mode, entry.scientific)).length !== 1) fail(`${entry.scientific}/${mode}: correct answer repeated`);
    }
  }
}

for (const entry of sourceSpecies) {
  if (!Array.isArray(entry.regions) || !entry.regions.length || new Set(entry.regions).size !== entry.regions.length ||
    entry.regions.some((region) => !REGIONS.includes(region))) {
    fail(`${entry.name}: species.json regions must be a non-empty array of unique supported regions`);
  }
  if (!deck.some((species) => species.scientific === entry.name)) fail(`${entry.name}: species.json entry is missing from deck.json`);
}

if (new Set(deck.map((e) => e.id)).size !== deck.length) fail('duplicate species ids in deck');
for (const entry of deck) {
  if (!ROLES[entry.role]) fail(`${entry.scientific}: bad role ${entry.role}`);
  if (!Array.isArray(entry.notes) || entry.notes.length < 1) fail(`${entry.scientific}: no ecotox notes`);
  if (entry.factSources !== undefined && !Array.isArray(entry.factSources)) {
    fail(`${entry.scientific}: factSources must be an array`);
  }
  for (const fact of Array.isArray(entry.factSources) ? entry.factSources : []) {
    if (!fact || typeof fact !== 'object') {
      fail(`${entry.scientific}: malformed fact source metadata`);
      continue;
    }
    const date = typeof fact.reviewedOn === 'string' ? new Date(`${fact.reviewedOn}T00:00:00Z`) : null;
    if (
      typeof fact.note !== 'string' || !fact.note.trim() || !validHttpUrl(fact.source) ||
      !date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== fact.reviewedOn
    ) {
      fail(`${entry.scientific}: malformed fact source metadata`);
    }
  }
}
for (const role of ROLE_ORDER) {
  const pool = poolFor(deck, role);
  if (pool.length < 4) fail(`role ${role} has too few species`);
  if (pool.some((e) => e.rare)) fail(`role ${role}: rare entries must stay out of the normal pool`);
  for (const mode of MODE_ORDER) {
    const q = makeQuestion(pool[0], mode, pool);
    const expectedChoices = MODES[mode].choiceCount;
    if (q.choices.length !== expectedChoices || new Set(q.choices).size !== expectedChoices) {
      fail(`role ${role}/${mode}: expected ${expectedChoices} unique choices from the pool`);
    }
    if (/specific epithet/i.test(`${MODES.species.named} ${MODES.species.short}`)) {
      fail('medium mode prompts and status terminology should use "species"');
    }
  }
}
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
  const wanted = ['index.html', 'package.json', 'icon.svg', 'manifest.webmanifest'];
  for (const dir of ['css', 'js', 'fonts']) {
    for (const f of await readdir(path.join(ROOT, dir))) if (/\.(css|js|woff2)$/.test(f)) wanted.push(`${dir}/${f}`);
  }
  for (const f of shell) await access(path.join(ROOT, f)).catch(() => fail(`sw.js SHELL lists a missing file: ${f}`));
  for (const f of wanted) if (!shell.includes(f)) fail(`sw.js SHELL is missing ${f}`);
}
if (!/const VERSION = 'ecotoxid-v\d+'/.test(swSource)) fail('sw.js: VERSION should look like ecotoxid-v<number>');

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
