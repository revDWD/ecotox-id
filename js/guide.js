import { store } from './storage.js';

const PHOTO_DIR = 'data/photos/';
const SIL_DIR = 'data/silhouettes/';

const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

// Teaches taxonomy by grouping neighbours: order, then family, then genus.
export function sortedDeck(deck) {
  return [...deck].sort((a, b) =>
    (a.order || '').localeCompare(b.order || '') || a.family.localeCompare(b.family) || a.scientific.localeCompare(b.scientific));
}

function tileImage(entry, status) {
  const img = el('img', { loading: 'lazy', decoding: 'async', alt: '' });
  if (status === 'unknown') {
    if (entry.silhouette) img.src = SIL_DIR + entry.silhouette.file;
    else img.src = PHOTO_DIR + entry.photo.file;
  } else {
    img.src = PHOTO_DIR + entry.photo.file;
  }
  return img;
}

export function renderGuide(deck, onOpen) {
  const grid = document.getElementById('guide-grid');
  grid.textContent = '';
  const list = sortedDeck(deck);
  list.forEach((entry, index) => {
    const status = store.status(entry.id);
    const number = String(index + 1).padStart(3, '0');
    const known = status === 'identified';
    const tile = el('button', { type: 'button', className: `card-tile is-${status}` });
    tile.setAttribute('aria-label', known ? `Number ${index + 1}, ${entry.common || entry.scientific}` : `Number ${index + 1}, not yet identified`);
    const name = el('span', { className: 'card-tile__name' });
    if (known) {
      if (entry.common) name.append(entry.common);
      else name.append(el('i', { textContent: entry.scientific }));
    } else {
      name.append('???');
    }
    tile.append(
      el('span', { className: 'card-tile__img' }, tileImage(entry, status), el('span', { className: 'card-tile__no', textContent: number })),
      name,
    );
    tile.addEventListener('click', () => onOpen(entry, status, number));
    grid.append(el('li', {}, tile));
  });
  document.getElementById('guide-count').textContent = `Identified ${store.identifiedCount()} of ${deck.length}`;
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
    body.append(el('p', { textContent: `${entry.order ? entry.order + ' | ' : ''}${entry.family}` }));
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
