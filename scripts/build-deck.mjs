// Builds data/deck.json from data/species.json using the iNaturalist and PhyloPic APIs.
// Usage: node scripts/build-deck.mjs [--refresh] [--only "Genus species"]
//   default   only fetches species that are new in species.json (and drops removed ones)
//   --refresh rebuilds every species from scratch
import { readFile, writeFile, mkdir, access, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const PHOTOS = path.join(DATA, 'photos');
const SILS = path.join(DATA, 'silhouettes');
const INAT = 'https://api.inaturalist.org/v1';
const PHYLOPIC = 'https://api.phylopic.org';
const UA = 'ecotox-id-battle/1.0 (educational game; github.com/DWDyck/ecotox-id-battle)';
const ROLES = ['pest', 'enemy', 'pollinator', 'test'];
const stripFlags = ({ rare, legendary, intro, factSources, ...rest }) => rest;
const PHOTO_LICENSES = ['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa'];
const validHttpUrl = (value) => {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].toLowerCase() : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
let lastInat = 0;

async function getJson(url, { inat = false } = {}) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (inat) {
      const wait = 750 - (Date.now() - lastInat);
      if (wait > 0) await sleep(wait);
      lastInat = Date.now();
    }
    let retryable = true;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) return await res.json();
      retryable = res.status === 429 || res.status >= 500;
      if (!retryable) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (attempt === 5 || !retryable) throw err;
    }
    await sleep(1500 * attempt);
  }
  throw new Error(`Gave up on ${url}`);
}

// Saves the file as <taxonId>-<hash of its bytes>.<ext> and returns that name. The hash changes whenever
// the picture changes, so the service worker's cache-first media can never serve a stale image.
async function download(url, dir, taxonId, ext) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const name = `${taxonId}-${createHash('sha1').update(bytes).digest('hex').slice(0, 8)}${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return name;
}

const poolCache = new Map();
async function namePool(taxonId, rank) {
  const key = `${taxonId}:${rank}`;
  if (!poolCache.has(key)) {
    const data = await getJson(
      `${INAT}/taxa?taxon_id=${taxonId}&rank=${rank}&is_active=true&order_by=observations_count&per_page=20`,
      { inat: true },
    );
    poolCache.set(
      key,
      (data.results || [])
        .filter((t) => t.rank === rank && /^[A-Z][a-z-]+( [a-z-]+)?$/.test(t.name))
        .map((t) => t.name),
    );
  }
  return poolCache.get(key);
}

async function resolveTaxon(name) {
  const search = await getJson(
    `${INAT}/taxa?q=${encodeURIComponent(name)}&rank=species&is_active=true&per_page=5`,
    { inat: true },
  );
  const hit = (search.results || []).find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (!hit) return null;
  const full = await getJson(`${INAT}/taxa/${hit.id}`, { inat: true });
  return full.results?.[0] || null;
}

async function pickPhoto(taxonId) {
  const url =
    `${INAT}/observations?taxon_id=${taxonId}&quality_grade=research&photos=true&captive=false` +
    `&photo_license=${PHOTO_LICENSES.join(',')}&order_by=votes&order=desc&per_page=8`;
  const data = await getJson(url, { inat: true });
  for (const obs of data.results || []) {
    const photo = obs.photos?.[0];
    if (!photo || !PHOTO_LICENSES.includes(photo.license_code)) continue;
    if ((photo.original_dimensions?.width || 0) < 600) continue;
    return {
      sourceUrl: photo.url.replace('/square.', '/medium.'),
      license: photo.license_code,
      credit: photo.attribution,
      link: `https://www.inaturalist.org/observations/${obs.id}`,
    };
  }
  return null;
}

async function findSilhouette(names) {
  const build = (await getJson(`${PHYLOPIC}/`)).build;
  for (const [rank, name] of names) {
    const url =
      `${PHYLOPIC}/nodes?build=${build}&filter_name=${encodeURIComponent(name.toLowerCase())}` +
      `&page=0&embed_items=true&embed_primaryImage=true`;
    let data;
    try {
      data = await getJson(url);
    } catch (err) {
      if (/HTTP 404/.test(err.message)) continue; // PhyloPic answers 404 when a name has no match
      throw err;
    }
    for (const node of data._embedded?.items || []) {
      const exact = (node.names || []).some((n) => n.some((p) => p.text?.toLowerCase() === name.toLowerCase()));
      const image = node._embedded?.primaryImage;
      const svg = image?._links?.vectorFile?.href;
      if (exact && svg) {
        return {
          sourceUrl: svg,
          rank,
          matched: name,
          credit: image.attribution || 'Unknown',
          link: `https://www.phylopic.org/images/${image.uuid}`,
        };
      }
    }
  }
  return null;
}

function ancestorOf(taxon, rank) {
  return (taxon.ancestors || []).find((a) => a.rank === rank) || null;
}

async function buildEntry(name) {
  const taxon = await resolveTaxon(name);
  if (!taxon) throw new Error('not found on iNaturalist');
  const genus = ancestorOf(taxon, 'genus');
  const family = ancestorOf(taxon, 'family');
  const order = ancestorOf(taxon, 'order');
  if (!genus || !family) throw new Error('missing genus/family');

  const photo = await pickPhoto(taxon.id);
  if (!photo) throw new Error('no suitable CC-licensed photo');
  const urlExt = path.extname(new URL(photo.sourceUrl).pathname).toLowerCase();
  const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(urlExt) ? urlExt : '.jpg';
  const photoFile = await download(photo.sourceUrl, PHOTOS, taxon.id, ext);

  let silhouette = null;
  const sil = await findSilhouette([['species', taxon.name], ['genus', genus.name], ['family', family.name]]);
  if (sil) {
    const silFile = await download(sil.sourceUrl, SILS, taxon.id, '.svg');
    silhouette = { file: silFile, rank: sil.rank, matched: sil.matched, credit: sil.credit, link: sil.link };
  }

  const [genusFam, genusOrder, speciesGenus, speciesFam] = await Promise.all([
    namePool(family.id, 'genus'),
    order ? namePool(order.id, 'genus') : [],
    namePool(genus.id, 'species'),
    namePool(family.id, 'species'),
  ]);
  const without = (list, ...bad) => list.filter((n) => !bad.includes(n));
  const epithet = taxon.name.split(' ')[1];

  return {
    id: taxon.id,
    scientific: taxon.name,
    genus: genus.name,
    epithet,
    common: taxon.preferred_common_name || null,
    family: family.name,
    order: order?.name || null,
    level: Math.max(5, Math.min(90, Math.round(100 - Math.log10(Math.max(taxon.observations_count, 10)) * 12))),
    photo: { file: photoFile, license: photo.license, credit: photo.credit, link: photo.link },
    silhouette,
    decoys: {
      genusFamily: without(genusFam, genus.name).slice(0, 10),
      genusOrder: without(genusOrder, genus.name, ...genusFam).slice(0, 10),
      speciesGenus: without(speciesGenus, taxon.name).filter((n) => n.split(' ')[1] !== epithet).slice(0, 10),
      speciesFamily: without(speciesFam, taxon.name, ...speciesGenus)
        .filter((n) => n.split(' ')[0] !== genus.name && n.split(' ')[1] !== epithet)
        .slice(0, 10),
    },
  };
}

async function main() {
  await mkdir(PHOTOS, { recursive: true });
  await mkdir(SILS, { recursive: true });
  const wanted = JSON.parse(await readFile(path.join(DATA, 'species.json'), 'utf8')).species;
  const factsPath = path.join(DATA, 'facts.json');
  const facts = (await exists(factsPath)) ? JSON.parse(await readFile(factsPath, 'utf8')) : {};
  let legacyFactCount = 0;
  for (const [name, value] of Object.entries(facts)) {
    const entries = Array.isArray(value) ? value : [value];
    for (const [index, fact] of entries.entries()) {
      if (typeof fact === 'string') {
        if (!fact.trim()) throw new Error(`facts.json: ${name}[${index}] must not be empty`);
        legacyFactCount++;
        continue;
      }
      const date = typeof fact?.reviewedOn === 'string' ? new Date(`${fact.reviewedOn}T00:00:00Z`) : null;
      if (
        !fact || typeof fact !== 'object' || typeof fact.text !== 'string' || !fact.text.trim() ||
        !validHttpUrl(fact.source) ||
        !date || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== fact.reviewedOn
      ) {
        throw new Error(`facts.json: ${name}[${index}] must have non-empty text, an http(s) source URL, and a valid reviewedOn date (YYYY-MM-DD)`);
      }
    }
  }
  if (legacyFactCount) {
    console.warn(`! facts.json: ${legacyFactCount} legacy fact(s) have no structured source or review date`);
  }
  const listed = new Set(wanted.map((w) => String(typeof w === 'string' ? w : w?.name || '').trim()));
  for (const k of Object.keys(facts)) if (!listed.has(k)) console.warn(`! facts.json: "${k}" is not in species.json`);
  const deckPath = path.join(DATA, 'deck.json');
  const previous = !refresh && (await exists(deckPath)) ? JSON.parse(await readFile(deckPath, 'utf8')).species : [];
  const byName = new Map(previous.map((e) => [e.scientific.toLowerCase(), e]));

  const species = [];
  const problems = [];
  const seen = new Set();
  for (const raw of wanted) {
    const item = typeof raw === 'string' ? { name: raw } : raw || {};
    const name = String(item.name || '').trim();
    const role = String(item.role || '').trim();
    const factEntries = [].concat(facts[name] || []);
    const fun = factEntries.map((fact) => `Fun fact: ${String(typeof fact === 'string' ? fact : fact.text).trim()}`.slice(0, 220));
    const factSources = factEntries.filter((fact) => typeof fact !== 'string').map((fact) => ({
      note: `Fun fact: ${fact.text.trim()}`.slice(0, 220),
      source: fact.source,
      reviewedOn: fact.reviewedOn,
    }));
    const notes = [...(Array.isArray(item.notes) ? item.notes : [item.note])
      .map((n) => String(n || '').trim().slice(0, 220)).filter(Boolean).slice(0, 6), ...fun].slice(0, 8);
    const intro = String(item.intro || '').trim().slice(0, 120);
    const flags = { ...(item.rare === true ? { rare: true } : {}), ...(item.legendary === true ? { legendary: true } : {}) };
    const meta = { role, notes, factSources, ...flags, ...(intro && Object.keys(flags).length ? { intro } : {}) };
    if (name && !ROLES.includes(role)) {
      console.warn(`! ${name}: role must be one of ${ROLES.join(', ')} (got "${role}")`);
      problems.push(`${name}: role must be one of ${ROLES.join(', ')}`);
      continue;
    }
    if (!name || seen.has(name.toLowerCase())) {
      if (name) console.warn(`! ${name}: listed more than once, skipping the extra entry`);
      continue;
    }
    seen.add(name.toLowerCase());
    if (only && name.toLowerCase() !== only) {
      const kept = byName.get(name.toLowerCase());
      if (kept) species.push({ ...stripFlags(kept), ...meta });
      continue;
    }
    const kept = byName.get(name.toLowerCase());
    if (kept && (await exists(path.join(PHOTOS, kept.photo.file)))) {
      species.push({ ...stripFlags(kept), ...meta });
      continue;
    }
    try {
      console.log(`+ ${name}`);
      species.push({ ...(await buildEntry(name)), ...meta });
    } catch (err) {
      console.warn(`! ${name}: ${err.message}`);
      problems.push(`${name}: ${err.message}`);
    }
  }

  const keepFiles = new Set(species.map((e) => e.photo.file));
  for (const f of await readdir(PHOTOS)) if (!keepFiles.has(f)) await rm(path.join(PHOTOS, f));
  const keepSils = new Set(species.filter((e) => e.silhouette).map((e) => e.silhouette.file));
  for (const f of await readdir(SILS)) if (!keepSils.has(f)) await rm(path.join(SILS, f));

  const deck = { generated: new Date().toISOString().slice(0, 10), count: species.length, species };
  await writeFile(deckPath, JSON.stringify(deck, null, 1) + '\n');
  console.log(`Deck: ${species.length} species, ${species.filter((e) => e.silhouette).length} with silhouettes.`);
  if (problems.length) {
    console.log(`Skipped:\n  ${problems.join('\n  ')}`);
    for (const p of problems) console.log(`::error title=Species not added::${p}`);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
