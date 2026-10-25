import { store } from './storage.js';
import { createCardTile, sortedDeck } from './guide.js';
import { REGIONS } from './regions.js';

const el = (tag, props = {}, ...kids) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

let selectedRegion = null;

export function renderMap(deck, onOpen) {
  const counts = new Map(REGIONS.map((region) => [region, deck.filter((entry) => entry.regions.includes(region)).length]));
  const guideNumbers = new Map(sortedDeck(deck).map((entry, index) => [entry.id, String(index + 1).padStart(3, '0')]));
  const map = document.getElementById('distribution-map');
  const options = document.getElementById('region-options');
  const results = document.getElementById('region-results');

  const selectRegion = (region) => {
    selectedRegion = region;
    map.querySelectorAll('[data-region]').forEach((area) => {
      const active = area.dataset.region === selectedRegion;
      area.classList.toggle('is-selected', active);
      area.setAttribute('aria-pressed', String(active));
    });
    options.querySelectorAll('[data-region]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.region === selectedRegion));
    });

    const visible = selectedRegion ? deck.filter((entry) => entry.regions.includes(selectedRegion)) : deck;
    document.getElementById('region-count').textContent = selectedRegion
      ? `${selectedRegion}: ${visible.length} organisms`
      : `All regions: ${visible.length} organisms`;
    results.replaceChildren(...visible.map((entry) => {
      const status = store.status(entry.id);
      return createCardTile(entry, status, guideNumbers.get(entry.id), onOpen);
    }));
  };

  const regionButton = (region, label) => {
    const button = el('button', { type: 'button', className: 'tool', textContent: label });
    button.dataset.region = region;
    button.setAttribute('aria-pressed', 'false');
    return button;
  };
  options.replaceChildren(
    regionButton('', 'All regions'),
    ...REGIONS.map((region) => regionButton(region, `${region} (${counts.get(region)})`)),
  );
  options.querySelectorAll('[data-region]').forEach((button) => button.addEventListener('click', () => {
    selectRegion(button.dataset.region || null);
  }));

  map.querySelectorAll('[data-region]').forEach((area) => {
    const region = area.dataset.region;
    const count = counts.get(region);
    area.setAttribute('aria-label', `${region}: ${count} organisms`);
    area.querySelector('title').textContent = `${region}: ${count} organisms`;
    area.querySelector('.region-map__count').textContent = String(count);
    area.addEventListener('click', () => selectRegion(region));
    area.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRegion(region);
      }
    });
  });

  selectRegion(selectedRegion);
}
