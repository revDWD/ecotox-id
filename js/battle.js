import { Flow, TextBox, Cancelled, prefersReducedMotion } from './ui.js';
import {
  MODES, CHAIN_GOAL, MAX_HP, makeQuestion, pickEntry, nextMode, expNeeded, expFor, pointsFor, addExp,
} from './game.js';
import { store } from './storage.js';
import { sound } from './sound.js';
import { playerSprite } from './sprites.js';

const $ = (id) => document.getElementById(id);
const PHOTO_DIR = 'data/photos/';
const SIL_DIR = 'data/silhouettes/';

const fullName = (e) => (e.common ? `the ${e.common} (*${e.scientific}*)` : `*${e.scientific}*`);

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

function pixelate(canvas, img, blocks = 12) {
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = blocks;
  tiny.getContext('2d').drawImage(img, (img.naturalWidth - size) / 2, (img.naturalHeight - size) / 2, size, size, 0, 0, blocks, blocks);
  canvas.width = canvas.height = 240;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, blocks, blocks, 0, 0, 240, 240);
}

export class Battle {
  constructor({ deck, onExit }) {
    this.deck = deck;
    this.onExit = onExit;
    this.el = {
      scene: $('scene'), foe: $('foe'), frame: $('foe-frame'), img: $('foe-img'), canvas: $('foe-canvas'),
      player: $('player'), flash: $('flash'), wipe: $('wipe'),
      foeName: $('foe-name'), foeLv: $('foe-lv'), foeHp: $('foe-hp'), foeHpLabel: $('foe-hp-label'),
      pLv: $('p-lv'), pHp: $('p-hp'), pHpLabel: $('p-hp-label'), pHpNum: $('p-hp-num'), pMode: $('p-mode'),
      pExp: $('p-exp'), pExpLabel: $('p-exp-label'), streak: $('streak'), zoomBtn: $('foe-zoom'),
      menu: $('menu'), credit: $('credit'), results: $('results'), resultsStats: $('results-stats'),
      textbox: $('textbox'), panel: $('panel'), soundBtn: $('btn-sound'),
    };
    this.choiceButtons = [...this.el.menu.querySelectorAll('.choice')];
    this.keyboard = false;
    this.active = false;
    this.flow = null;
    this.text = null;
    this.s = null;

    this.el.player.innerHTML = playerSprite();
    this.el.wipe.innerHTML = '<i></i>'.repeat(8);
    this.bind();
  }

  bind() {
    const advance = () => this.text?.advance();
    this.el.scene.addEventListener('click', advance);
    this.el.textbox.addEventListener('click', advance);
    document.addEventListener('keydown', (e) => {
      if (!this.active || document.querySelector('dialog[open]')) return;
      this.keyboard = true;
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, a, dialog')) {
        e.preventDefault();
        advance();
      }
      if (/^[1-4]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const btn = this.choiceButtons[Number(e.key) - 1];
        if (btn && !btn.disabled) btn.click();
      }
      if (e.key.startsWith('Arrow') && this.el.menu.contains(document.activeElement)) this.moveFocus(e);
    });
    document.addEventListener('pointerdown', () => { this.keyboard = false; });
    $('btn-run').addEventListener('click', () => this.exit());
    this.el.zoomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const zoom = $('zoom');
      $('zoom-img').src = this.el.img.src;
      $('zoom-img').alt = this.el.img.alt;
      zoom.showModal();
    });
    $('zoom-close').addEventListener('click', () => $('zoom').close());
    $('zoom').addEventListener('click', (e) => { if (e.target === $('zoom')) $('zoom').close(); });
    $('btn-again').addEventListener('click', () => this.start(this.s.startMode));
    $('btn-results-title').addEventListener('click', () => this.exit());
    this.el.soundBtn.addEventListener('click', () => {
      const on = !sound.enabled;
      sound.set(on);
      store.setSetting('sound', on);
      this.syncSoundButton();
      sound.blip();
    });
    this.choiceButtons.forEach((btn) => btn.addEventListener('click', () => this.chosen?.(Number(btn.dataset.i))));
  }

  moveFocus(e) {
    const i = this.choiceButtons.indexOf(document.activeElement);
    if (i < 0) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
    const target = this.choiceButtons[i + delta];
    if (target && !target.disabled) { target.focus(); e.preventDefault(); }
  }

  syncSoundButton() {
    this.el.soundBtn.textContent = sound.enabled ? 'Sound on' : 'Sound off';
    this.el.soundBtn.setAttribute('aria-pressed', String(sound.enabled));
  }

  exit() {
    this.stop();
    this.onExit();
  }

  stop() {
    this.active = false;
    this.flow?.cancel();
    this.chosen = null;
  }

  async start(mode) {
    this.stop();
    this.flow = new Flow();
    this.text = new TextBox(this.flow, { textEl: $('text'), liveEl: $('live'), moreEl: $('more') });
    this.active = true;
    this.s = {
      mode, startMode: mode, hp: MAX_HP, level: 1, exp: 0, score: 0, streak: 0, bestStreak: 0, chain: 0,
      recent: [], rounds: 0, correct: 0, discovered: 0,
    };
    sound.set(store.settings.sound);
    this.syncSoundButton();
    this.resetScene();
    this.renderPlayer(false);
    try {
      await this.run();
    } catch (err) {
      if (!(err instanceof Cancelled)) {
        console.error(err);
        this.el.credit.textContent = 'Something went wrong. Press Run and try again.';
      }
    }
  }

  resetScene() {
    const { el } = this;
    el.results.hidden = true;
    el.scene.classList.remove('is-challenge', 'is-shaking');
    el.foe.className = 'foe';
    el.foe.style.visibility = 'hidden';
    el.player.className = 'player';
    el.credit.textContent = '';
    el.frame.classList.remove('is-silhouette');
    el.canvas.hidden = true;
    el.img.hidden = false;
    el.zoomBtn.hidden = true;
    el.wipe.className = 'wipe';
    this.text.clear();
    this.setChoices(null);
    this.setFoeBars(null);
  }

  // ----- HUD -----
  renderPlayer(animate = true) {
    const { s, el } = this;
    const pct = (s.hp / MAX_HP) * 100;
    el.pHp.style.width = `${pct}%`;
    el.pHp.className = pct <= 25 ? 'is-low' : pct <= 55 ? 'is-mid' : '';
    el.pHpNum.textContent = `${s.hp}/${MAX_HP}`;
    el.pHpLabel.setAttribute('aria-label', `Health ${s.hp} of ${MAX_HP}`);
    el.pLv.textContent = `Lv${s.level}`;
    el.pMode.textContent = MODES[s.mode].short;
    const expPct = (s.exp / expNeeded(s.level)) * 100;
    el.pExp.style.width = `${expPct}%`;
    el.pExpLabel.setAttribute('aria-label', `Experience ${Math.round(expPct)} percent`);
    [...el.streak.children].forEach((pip, i) => pip.classList.toggle('is-on', i < s.chain));
    el.streak.setAttribute('aria-label', `Streak ${Math.min(s.chain, CHAIN_GOAL)} of ${CHAIN_GOAL}`);
    if (!animate) el.pHp.style.transition = 'none';
    else el.pHp.style.transition = '';
  }

  setFoeBars(entry, { challenge = false, mode = null } = {}) {
    const { el } = this;
    el.foeHp.style.transition = 'none';
    el.foeHp.style.width = '100%';
    el.foeHp.className = '';
    void el.foeHp.offsetWidth;
    el.foeHp.style.transition = '';
    el.foeHpLabel.setAttribute('aria-label', 'Mystery meter full');
    if (!entry) {
      el.foeName.textContent = '???';
      el.foeLv.textContent = 'Lv?';
      return;
    }
    el.foeLv.textContent = `Lv${entry.level + (challenge ? 8 : 0)}`;
    this.setFoeName(mode, entry, false);
  }

  setFoeName(mode, entry, revealed) {
    const name = this.el.foeName;
    const italic = (text) => {
      const i = document.createElement('i');
      i.textContent = text;
      return i;
    };
    name.textContent = '';
    if (revealed) {
      if (entry.common) name.textContent = entry.common;
      else name.append(italic(entry.scientific));
    } else if (mode === 'species') {
      name.append(italic(entry.genus), ' ???');
    } else {
      name.textContent = '???';
    }
  }

  // ----- Foe visuals -----
  async prepareFoe(entry, visual) {
    const { el } = this;
    const photo = await loadImage(PHOTO_DIR + entry.photo.file);
    el.frame.classList.toggle('is-silhouette', visual === 'silhouette');
    el.canvas.hidden = visual !== 'pixel';
    el.img.hidden = visual === 'pixel';
    el.zoomBtn.hidden = visual !== 'photo';
    el.img.alt = 'A mystery organism. Guess what it is.';
    if (visual === 'silhouette') {
      el.img.src = SIL_DIR + entry.silhouette.file;
    } else if (visual === 'pixel') {
      pixelate(el.canvas, photo);
      el.canvas.setAttribute('role', 'img');
      el.canvas.setAttribute('aria-label', 'A blurred mystery organism. Guess what it is.');
    } else {
      el.img.src = photo.src;
    }
  }

  async revealPhoto(entry) {
    const { el } = this;
    el.frame.classList.remove('is-silhouette');
    el.canvas.hidden = true;
    el.img.hidden = false;
    el.zoomBtn.hidden = false;
    el.img.src = PHOTO_DIR + entry.photo.file;
    el.img.alt = `Photo of ${entry.common || entry.scientific}`;
  }

  showCredit(entry, visual) {
    const { credit } = this.el;
    credit.textContent = '';
    const add = (text) => credit.append(text);
    add(`Photo ${entry.photo.credit} `);
    const a = document.createElement('a');
    a.href = entry.photo.link;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'View on iNaturalist';
    credit.append(a);
    if (visual === 'silhouette' && entry.silhouette) {
      credit.append(` | Silhouette by ${entry.silhouette.credit} `);
      const p = document.createElement('a');
      p.href = entry.silhouette.link;
      p.target = '_blank';
      p.rel = 'noopener';
      p.textContent = 'PhyloPic';
      credit.append(p);
    }
  }

  // ----- Effects -----
  async flash(red = false) {
    const f = this.el.flash;
    f.classList.toggle('is-red', red);
    f.classList.remove('is-on');
    void f.offsetWidth;
    f.classList.add('is-on');
  }

  shake() {
    const s = this.el.scene;
    s.classList.remove('is-shaking');
    void s.offsetWidth;
    s.classList.add('is-shaking');
  }

  async wipe(close) {
    const w = this.el.wipe;
    w.className = `wipe ${close ? 'is-closing' : 'is-opening'}`;
    await this.flow.delay(prefersReducedMotion() ? 0 : 800);
  }

  async enterFoe() {
    const { foe } = this.el;
    foe.className = 'foe';
    foe.style.visibility = 'visible';
    void foe.offsetWidth;
    foe.classList.add('is-entering');
    sound.appear();
    await this.flow.delay(750);
    foe.classList.remove('is-entering');
  }

  hideFoe() {
    const { foe } = this.el;
    foe.className = 'foe';
    foe.style.visibility = 'hidden';
  }

  // ----- Menu -----
  setChoices(labels) {
    const longest = labels ? Math.max(...labels.flatMap((l) => l.split(' ').map((w) => w.length))) : 0;
    this.el.menu.style.setProperty('--n', String(longest + 0.4));
    this.choiceButtons.forEach((btn, i) => {
      btn.classList.remove('is-correct', 'is-wrong');
      const label = btn.querySelector('.choice__label');
      label.textContent = labels ? labels[i] : '';
      btn.disabled = !labels;
      btn.setAttribute('aria-label', labels ? `Answer ${i + 1}: ${labels[i]}` : '');
      if (!labels) btn.removeAttribute('aria-label');
    });
  }

  ask(q) {
    this.setChoices(q.choices);
    if (this.keyboard) this.choiceButtons[0].focus();
    return this.flow.wait((done) => {
      this.chosen = (index) => {
        this.chosen = null;
        done(index);
      };
      return () => { this.chosen = null; };
    });
  }

  markChoices(q, picked) {
    this.choiceButtons.forEach((btn, i) => {
      btn.disabled = true;
      if (i === q.correctIndex) btn.classList.add('is-correct');
      else if (i === picked) btn.classList.add('is-wrong');
    });
  }

  // ----- Game flow -----
  async run() {
    const { el, s } = this;
    el.player.classList.add('is-entering');
    this.renderPlayer(false);
    await this.flow.delay(700);
    el.player.classList.remove('is-entering');
    await this.text.say(`Wild organisms are hiding in the grass! Name the *${MODES[s.mode].named.toLowerCase()}* to win each battle.`, { hold: true });

    for (;;) {
      const challenge = s.chain >= CHAIN_GOAL;
      await this.round(challenge);
      if (s.hp <= 0) {
        await this.gameOver();
        return;
      }
    }
  }

  async round(challenge) {
    const { s, el } = this;
    let entry;
    let visual;
    let q;
    // A broken image should never end the game: try another species.
    for (let attempt = 0; attempt < 4; attempt++) {
      entry = pickEntry(this.deck, s.recent, { needSilhouette: challenge });
      visual = !challenge ? 'photo' : entry.silhouette ? 'silhouette' : 'pixel';
      q = makeQuestion(entry, s.mode, this.deck);
      try {
        if (challenge && attempt === 0) {
          sound.challenge();
          await this.wipe(true);
          el.scene.classList.add('is-challenge');
        }
        this.hideFoe();
        this.setChoices(null);
        await this.prepareFoe(entry, visual);
        break;
      } catch (err) {
        if (err instanceof Cancelled) throw err;
        if (attempt === 3) throw err;
      }
    }
    s.recent.push(entry.id);
    if (s.recent.length > 12) s.recent.shift();

    this.setFoeBars(entry, { challenge, mode: s.mode });
    el.credit.textContent = '';
    this.text.clear();
    if (challenge) await this.wipe(false);
    await this.enterFoe();

    await this.text.say(challenge ? 'Challenge! Something is lurking in the shadows!' : 'A wild organism appeared!');
    await this.flow.delay(350);
    const prompt = {
      genus: challenge ? "Who's that organism? Pick the *genus*." : 'Which genus is it?',
      species: `It looks like *${entry.genus}*! Which species?`,
      both: challenge ? "Who's that organism? Name its *genus and species*." : 'Name its genus and species!',
    }[s.mode];
    await this.text.say(prompt);

    const picked = await this.ask(q);
    const correct = picked === q.correctIndex;
    this.markChoices(q, picked);
    const wasNew = store.status(entry.id) !== 'identified' && correct;
    store.record(entry.id, correct);
    s.rounds += 1;

    if (visual !== 'photo') {
      this.flash();
      await this.revealPhoto(entry);
    }
    this.setFoeName(s.mode, entry, true);
    this.showCredit(entry, visual);

    if (correct) await this.onCorrect(entry, challenge, wasNew);
    else await this.onWrong(entry);

    if (challenge) {
      await this.wipe(true);
      el.scene.classList.remove('is-challenge');
      this.hideFoe();
      this.setChoices(null);
      await this.wipe(false);
    } else {
      this.hideFoe();
    }
    this.renderPlayer();
  }

  async onCorrect(entry, challenge, wasNew) {
    const { s, el } = this;
    sound.correct();
    el.foe.classList.add('is-hit');
    el.foeHp.style.width = '0%';
    el.foeHp.className = 'is-low';
    el.foeHpLabel.setAttribute('aria-label', 'Mystery meter empty');
    s.streak += 1;
    s.chain += 1;
    s.correct += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    s.score += pointsFor(s.mode, challenge);
    if (wasNew) s.discovered += 1;
    this.renderPlayer();
    this.flow.delay(550).then(() => {
      el.foe.classList.remove('is-hit');
      el.foe.classList.add('is-fainting');
      sound.faint();
    }, () => {});

    await this.text.say(`Correct! It's ${fullName(entry)}!`, { hold: true });

    const gain = expFor(challenge);
    const leveled = addExp(s, gain);
    this.renderPlayer();
    await this.text.say(wasNew ? `+${gain} EXP. New field guide entry!` : `+${gain} EXP.`);
    await this.flow.delay(leveled || challenge ? 450 : 750);

    if (leveled) {
      sound.levelUp();
      await this.text.say(`NATURALIST grew to Lv${s.level}!`, { hold: true });
    }
    if (challenge) {
      s.chain = 0;
      s.hp = Math.min(MAX_HP, s.hp + 2);
      const harder = nextMode(s.mode);
      let line = 'Challenge cleared! HP restored a little.';
      if (harder !== s.mode) {
        s.mode = harder;
        line += ` Now naming the *${MODES[harder].named.toLowerCase()}*.`;
      }
      this.renderPlayer();
      await this.text.say(line, { hold: true });
    }
  }

  async onWrong(entry) {
    const { s, el } = this;
    sound.wrong();
    this.shake();
    this.flash(true);
    s.hp = Math.max(0, s.hp - 1);
    s.streak = 0;
    s.chain = 0;
    this.renderPlayer();
    await this.text.say(`Oh no! It was ${fullName(entry)}.`, { hold: true });
    el.foe.classList.add('is-fainting');
    await this.flow.delay(s.hp > 0 ? 700 : 0);
  }

  async gameOver() {
    const { s, el } = this;
    sound.faint();
    await this.text.say('NATURALIST is out of HP!', { hold: true });
    const record = store.submitRun({ streak: s.bestStreak, score: s.score });
    el.resultsStats.innerHTML = '';
    const rows = [
      ['Score', `${s.score}${record.score ? ' NEW BEST!' : ''}`],
      ['Best streak', `${s.bestStreak}${record.streak ? ' NEW BEST!' : ''}`],
      ['Correct', `${s.correct}/${s.rounds}`],
      ['New entries', String(s.discovered)],
      ['Field guide', `${store.identifiedCount()}/${this.deck.length}`],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      el.resultsStats.append(dt, dd);
    }
    el.results.hidden = false;
    $('btn-again').focus();
  }
}
