import { store } from './storage.js';
import { ROLES, ROLE_ORDER } from './game.js';

const PHOTO_DIR = 'data/photos/';
const SIL_DIR = 'data/silhouettes/';

const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

// Turns a trailing "doi:<id>" in a note into a link.
const noteItem = (n) => {
  const m = n.match(/^(.*?)\s*doi:(\S+)$/);
  if (!m) return el('li', { textContent: n });
  return el('li', {}, `${m[1]} `, el('a', { href: `https://doi.org/${encodeURI(m[2])}`, target: '_blank', rel: 'noopener', textContent: `doi:${m[2]}` }));
};

// Groups by role first (pests, enemies, pollinators, test species), then taxonomy: order, family, species.
export function sortedDeck(deck) {
  return [...deck].sort((a, b) =>
    ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || (a.order || '').localeCompare(b.order || '') ||
    a.family.localeCompare(b.family) || a.scientific.localeCompare(b.scientific));
}

// Filter groups are the ecotox roles (pest, natural enemy, pollinator, test species).
const groupOf = (entry) => entry.role;
let activeGroup = 'all';
let activeSearch = '';
let activeStatus = 'all';

function fillFilter(select, list) {
  const counts = new Map();
  list.forEach((e) => counts.set(groupOf(e), (counts.get(groupOf(e)) || 0) + 1));
  if (!counts.has(activeGroup)) activeGroup = 'all';
  select.textContent = '';
  select.append(el('option', { value: 'all', textContent: `All (${list.length})` }));
  for (const group of ROLE_ORDER) {
    if (counts.has(group)) select.append(el('option', { value: group, textContent: `${ROLES[group].group} (${counts.get(group)})` }));
  }
  select.value = activeGroup;
}

function fillStatusFilter(select) {
  select.value = activeStatus;
}

function tileImage(entry, status) {
  // No silhouette and not yet identified: a "?" instead of the photo, which would otherwise show as a black box.
  if (status === 'unknown' && !entry.silhouette) return el('span', { className: 'card-tile__mystery', textContent: '?' });
  const img = el('img', { loading: 'lazy', decoding: 'async', alt: '' });
  img.src = status === 'unknown' ? SIL_DIR + entry.silhouette.file : PHOTO_DIR + entry.photo.file;
  return img;
}

export function createCardTile(entry, status, number, onOpen) {
  const known = status === 'identified';
  const tile = el('button', { type: 'button', className: `card-tile is-${status}` });
  const ordinal = Number.parseInt(number, 10);
  tile.setAttribute('aria-label', known ? `Number ${ordinal}, ${entry.common || entry.scientific}` : `Number ${ordinal}, not yet identified`);
  const name = el('span', { className: 'card-tile__name' });
  name.append(entry.common || el('i', { textContent: entry.scientific }));
  tile.append(
    el('span', { className: 'card-tile__img' }, tileImage(entry, status), el('span', { className: 'card-tile__no', textContent: number })),
    name,
  );
  tile.addEventListener('click', () => onOpen(entry, status, number));
  return el('li', {}, tile);
}

export function renderGuide(deck, onOpen) {
  const list = sortedDeck(deck);
  const select = document.getElementById('guide-filter');
  const status = document.getElementById('guide-status');
  const search = document.getElementById('guide-search');
  fillFilter(select, list);
  fillStatusFilter(status);
  search.value = activeSearch;
  select.onchange = () => { activeGroup = select.value; renderGrid(list, onOpen); };
  status.onchange = () => { activeStatus = status.value; renderGrid(list, onOpen); };
  search.oninput = () => { activeSearch = search.value.trim().toLowerCase(); renderGrid(list, onOpen); };
  renderGrid(list, onOpen);
}

function renderGrid(list, onOpen) {
  const grid = document.getElementById('guide-grid');
  grid.textContent = '';
  const visibleList = list
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      (activeGroup === 'all' || groupOf(entry) === activeGroup) &&
      (activeStatus === 'all' || store.status(entry.id) === activeStatus) &&
      (!activeSearch || `${entry.common || ''} ${entry.scientific}`.toLowerCase().includes(activeSearch)));
  visibleList.forEach(({ entry, index }) => {
    const status = store.status(entry.id);
    const number = String(index + 1).padStart(3, '0');
    grid.append(createCardTile(entry, status, number, onOpen));
  });
  if (!visibleList.length) grid.append(el('li', { className: 'guide__empty', textContent: 'No organisms match this search.' }));
  const identified = visibleList.filter(({ entry }) => store.status(entry.id) === 'identified').length;
  document.getElementById('guide-count').textContent = `Identified ${identified} of ${visibleList.length}`;
}

export function openCard(entry, status, number) {
  const dialog = document.getElementById('card');
  const body = document.getElementById('card-body');
  body.textContent = '';
  const known = status === 'identified';
  const heading = el('h3', { id: 'card-title' }, `No.${number} `);
  if (known) heading.append(entry.common ? `${entry.common}` : el('i', { textContent: entry.scientific }));
  else heading.append('???');
  body.append(heading);

  if (known) {
    body.append(el('img', { src: PHOTO_DIR + entry.photo.file, alt: `Photo of ${entry.common || entry.scientific}` }));
    body.append(el('p', {}, el('i', { textContent: entry.scientific })));
    if (entry.regions?.length) body.append(el('p', { className: 'card__regions', textContent: `Regions: ${entry.regions.join(', ')}` }));
    body.append(el('p', { textContent: `${entry.order ? entry.order + ' | ' : ''}${entry.family}` }));
    if (entry.role) {
      body.append(el('p', { className: 'card__role', textContent: ROLES[entry.role].single }));
      if (entry.notes?.length) body.append(el('ul', { className: 'card__notes' }, ...entry.notes.map(noteItem)));
    }
    if (entry.factSources?.length) {
      const sources = entry.factSources.map((fact) => {
        const note = typeof fact?.note === 'string' ? fact.note : 'an unknown fact';
        let source;
        try {
          source = new URL(fact?.source);
        } catch {
          return el('li', { textContent: `Invalid source URL for "${note}".` });
        }
        if (!['http:', 'https:'].includes(source.protocol)) {
          return el('li', { textContent: `Unsupported source URL for "${note}".` });
        }
        return el('li', {}, `Source for "${note}" (reviewed ${fact.reviewedOn}): `,
          el('a', { href: source.href, target: '_blank', rel: 'noopener', textContent: 'reference' }));
      });
      if (sources.length) body.append(el('ul', { className: 'card__notes card__sources' }, ...sources));
    }
    const rec = store.entry(entry.id);
    body.append(el('p', { textContent: `Identified ${rec.correct} of ${rec.seen} times` }));
    body.append(el('p', {}, `Photo ${entry.photo.credit} `, el('a', { href: entry.photo.link, target: '_blank', rel: 'noopener', textContent: 'iNaturalist' })));
    if (entry.silhouette) {
      body.append(el('p', {}, `Silhouette by ${entry.silhouette.credit} `, el('a', { href: entry.silhouette.link, target: '_blank', rel: 'noopener', textContent: 'PhyloPic' })));
    }
  } else {
    body.append(el('p', { textContent: status === 'seen' ? 'You have met this one but not named it yet. Try again!' : 'Not discovered yet. Keep battling to find it.' }));
  }
  const close = el('button', { type: 'button', className: 'tool', textContent: 'Close' });
  close.addEventListener('click', () => dialog.close());
  body.append(close);
  dialog.showModal();
  close.focus();
}
