export class Cancelled extends Error {
  constructor() { super('cancelled'); this.name = 'Cancelled'; }
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every await in a battle goes through a Flow so "Run" can cancel the whole thing at once.
export class Flow {
  constructor() {
    this.pending = new Set();
    this.cancelled = false;
  }

  wait(setup) {
    return new Promise((resolve, reject) => {
      if (this.cancelled) { reject(new Cancelled()); return; }
      const entry = { reject, cleanup: null };
      this.pending.add(entry);
      entry.cleanup = setup((value) => {
        this.pending.delete(entry);
        resolve(value);
      });
    });
  }

  delay(ms) {
    const wait = prefersReducedMotion() ? Math.min(ms, 60) : ms;
    return this.wait((done) => {
      const t = setTimeout(done, wait);
      return () => clearTimeout(t);
    });
  }

  cancel() {
    this.cancelled = true;
    for (const entry of this.pending) {
      entry.cleanup?.();
      entry.reject(new Cancelled());
    }
    this.pending.clear();
  }
}

// Typewriter dialogue box. "*text*" renders in italics (used for scientific names).
export class TextBox {
  constructor(flow, { textEl, liveEl, moreEl }) {
    this.flow = flow;
    this.textEl = textEl;
    this.liveEl = liveEl;
    this.moreEl = moreEl;
    this.finish = null;
    this.release = null;
  }

  clear() {
    this.textEl.textContent = '';
    this.liveEl.textContent = '';
    this.moreEl.hidden = true;
  }

  build(markup) {
    this.textEl.textContent = '';
    const chars = [];
    markup.split('*').forEach((segment, index) => {
      if (!segment) return;
      const host = index % 2 === 1 ? document.createElement('i') : this.textEl;
      for (const ch of segment) {
        const span = document.createElement('span');
        span.className = 'ch';
        span.textContent = ch;
        host.appendChild(span);
        chars.push(span);
      }
      if (host !== this.textEl) this.textEl.appendChild(host);
    });
    return chars;
  }

  async say(markup, { hold = false, speed = 22 } = {}) {
    this.liveEl.textContent = markup.replaceAll('*', '');
    const chars = this.build(markup);
    await this.flow.wait((done) => {
      if (prefersReducedMotion()) {
        chars.forEach((c) => c.classList.add('on'));
        done();
        return null;
      }
      let i = 0;
      let timer = 0;
      const tick = () => {
        if (i < chars.length) {
          chars[i++].classList.add('on');
          timer = setTimeout(tick, speed);
        } else {
          this.finish = null;
          done();
        }
      };
      this.finish = () => {
        clearTimeout(timer);
        chars.forEach((c) => c.classList.add('on'));
        this.finish = null;
        done();
      };
      tick();
      return () => { clearTimeout(timer); this.finish = null; };
    });
    if (hold) {
      await this.flow.wait((done) => {
        this.moreEl.hidden = false;
        this.release = () => { this.moreEl.hidden = true; this.release = null; done(); };
        return () => { this.moreEl.hidden = true; this.release = null; };
      });
    }
  }

  // Called on tap / Enter / Space: skips typing first, then dismisses the "more" arrow.
  advance() {
    if (this.finish) this.finish();
    else if (this.release) this.release();
  }
}
