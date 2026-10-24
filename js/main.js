import { store } from './storage.js';
import { sound } from './sound.js';
import { backdropSvg, playerSprite, SCOUT_PALETTES, scoutPalette } from './sprites.js';
import { Battle } from './battle.js';
import { renderGuide, openCard } from './guide.js';
import { MODES, ROLES, ROLE_ORDER } from './game.js';

const $ = (id) => document.getElementById(id);
const screens = ['title', 'battle', 'guide', 'credits'];
let deck = [];
let battle = null;
let mode = MODES[store.settings.mode] ? store.settings.mode : 'genus';
let group = 'all';
let scout = scoutPalette(store.settings.scout).id;

function show(name, focusId) {
  for (const s of screens) $(`screen-${s}`).hidden = s !== name;
  window.scrollTo(0, 0);
  if (focusId) $(focusId)?.focus({ preventScroll: true });
}

function renderTitle() {
  const stats = $('title-stats');
  stats.textContent = '';
  const items = [
    ['Identified', `${store.identifiedCount()}/${deck.length}`],
    ['Best streak', String(store.best.streak)],
    ['Best score', String(store.best.score)],
  ];
  for (const [label, value] of items) {
    const span = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = value;
    span.append(`${label} `, b);
    stats.append(span);
  }
  document.querySelectorAll('.level').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.setAttribute('aria-checked', String(on));
    btn.tabIndex = on ? 0 : -1;
  });
  renderScout();
  const withSil = deck.filter((e) => e.silhouette);
  const mystery = $('title-mystery');
  mystery.textContent = '';
  if (withSil.length) {
    const pick = withSil[Math.floor(Math.random() * withSil.length)];
    const img = document.createElement('img');
    img.src = `data/silhouettes/${pick.silhouette.file}`;
    img.alt = '';
    mystery.append(img);
  }
}

function renderScout() {
  const palette = scoutPalette(scout);
  $('scout-preview').innerHTML = playerSprite(palette.id);
  $('scout-name').textContent = palette.name;
  $('scout-status').textContent = `Scout palette: ${palette.name}`;
  const swatches = $('scout-swatches');
  swatches.replaceChildren();
  for (const color of ['h', 't', 'p', 'b']) {
    const swatch = document.createElement('span');
    swatch.className = 'scout-picker__swatch';
    swatch.style.backgroundColor = palette.colors[color];
    swatches.append(swatch);
  }
  $('btn-scout').setAttribute('aria-label', `Scout appearance: ${palette.name}. Select next color palette.`);
}

function renderGroups() {
  const select = $('deck-group');
  const counts = new Map();
  const regular = deck.filter((e) => !e.rare);
  regular.forEach((e) => counts.set(e.role, (counts.get(e.role) || 0) + 1));
  if (!counts.has(store.settings.group)) group = 'all';
  else group = store.settings.group;
  select.textContent = '';
  const add = (value, text) => select.append(Object.assign(document.createElement('option'), { value, textContent: text }));
  add('all', `Everything (${regular.length})`);
  for (const role of ROLE_ORDER) if (counts.has(role)) add(role, `${ROLES[role].group} (${counts.get(role)})`);
  select.value = group;
}

function setMode(next) {
  mode = next;
  store.setSetting('mode', mode);
  renderTitle();
}

function bindTitle() {
  $('btn-scout').addEventListener('click', () => {
    const current = SCOUT_PALETTES.findIndex((palette) => palette.id === scout);
    scout = SCOUT_PALETTES[(current + 1) % SCOUT_PALETTES.length].id;
    store.setSetting('scout', scout);
    renderScout();
    battle.setScout(scout);
  });
  $('btn-start').addEventListener('click', () => {
    sound.set(store.settings.sound);
    sound.blip();
    show('battle');
    battle.start(mode, group);
  });
  const levels = [...document.querySelectorAll('.level')];
  levels.forEach((btn, i) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
    btn.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = levels[(i + step + levels.length) % levels.length];
      setMode(next.dataset.mode);
      next.focus();
    });
  });
  $('deck-group').addEventListener('change', (e) => {
    group = e.target.value;
    store.setSetting('group', group);
  });
  $('btn-guide').addEventListener('click', () => {
    renderGuide(deck, openCard);
    show('guide', 'btn-guide-back');
  });
  $('btn-credits').addEventListener('click', () => show('credits', 'btn-credits-back'));
  $('btn-guide-back').addEventListener('click', () => { renderTitle(); show('title', 'btn-guide'); });
  $('btn-credits-back').addEventListener('click', () => show('title', 'btn-credits'));
  $('card').addEventListener('click', (e) => { if (e.target === $('card')) $('card').close(); });
}

async function boot() {
  document.querySelectorAll('[data-backdrop]').forEach((scene) => {
    const html = scene.dataset.backdrop.split(' ').map(backdropSvg).join('');
    scene.insertAdjacentHTML('afterbegin', html);
  });
  try {
    const res = await fetch('data/deck.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    deck = data.species;
    $('deck-info').textContent = `Deck: ${data.count} species, built ${data.generated}.`;
  } catch (err) {
    console.error(err);
    $('title-stats').textContent = 'Could not load the species deck. Check your connection and reload.';
    $('btn-start').disabled = true;
    return;
  }
  battle = new Battle({ deck, onExit: () => { renderTitle(); show('title', 'btn-start'); } });
  bindTitle();
  renderGroups();
  renderTitle();
  show('title');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
