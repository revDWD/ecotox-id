import { store } from './storage.js';
import { sound } from './sound.js';
import { backdropSvg } from './sprites.js';
import { Battle } from './battle.js';
import { renderGuide, openCard } from './guide.js';
import { MODES } from './game.js';

const $ = (id) => document.getElementById(id);
const screens = ['title', 'battle', 'guide', 'credits'];
let deck = [];
let battle = null;
let mode = MODES[store.settings.mode] ? store.settings.mode : 'genus';

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

function setMode(next) {
  mode = next;
  store.setSetting('mode', mode);
  renderTitle();
}

function bindTitle() {
  $('btn-start').addEventListener('click', () => {
    sound.set(store.settings.sound);
    sound.blip();
    show('battle');
    battle.start(mode);
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
  renderTitle();
  show('title');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
