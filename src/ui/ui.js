// The helmet camera's overlay: crew ID, site, the 24-hour clock, the ledger, the three carry
// slots and the weight, the interaction prompt and captions. Plain DOM, fed from game.hud().

import { fmtH } from '../game/items.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class UI {
  constructor() {
    this.prompt = $('#prompt');
    this.captionEl = $('#caption');
    this.debugEl = $('#debug');
    this.captionTimer = 0;
    this.last = {};
  }

  show(id, on = true) {
    const el = typeof id === 'string' ? $(id) : id;
    if (el) el.classList.toggle('hidden', !on);
  }

  caption(text, secs = 3) {
    this.captionEl.textContent = text;
    this.captionEl.classList.add('on');
    clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => this.captionEl.classList.remove('on'), secs * 1000);
  }

  /** Only touch the DOM when a value changed. */
  set(key, el, html) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }

  update(h) {
    if (!h) return;
    this.set('crew', $('#hud-crew'), `${esc(h.crew)} &middot; NIGHT ${h.night}`);
    this.set('site', $('#hud-site'), esc(h.phase === 'brief' ? 'STRONGBOX · AWAITING WRIT' : `${h.site.writ} · ${h.site.name.toUpperCase()}`));
    this.set('clock', $('#hud-clock'), h.clock);
    $('#hud-clock').classList.toggle('late', !!h.late);
    const left = h.due - h.night + 1;
    this.set('ledger', $('#hud-ledger'), `LEDGER <b>${fmtH(h.ledger)}</b> &middot; INSTALMENT ${fmtH(h.target)} DUE ${left <= 1 ? 'TONIGHT' : `IN ${left} NIGHTS`}`);
    const slots = h.slots
      .map((s, k) => `<div class="slot${s.active ? ' active' : ''}${s.cont ? ' cont' : ''}"><div class="n">${k + 1}</div>${s.cont ? '(both hands)' : esc(s.name)}</div>`)
      .join('');
    this.set('slots', $('#hud-slots'), slots);
    const kg = h.kg;
    const felt = h.felt ?? kg;
    const frame = felt < kg - 0.05 ? ` (FRAME: FEELS ${felt.toFixed(1)})` : '';
    this.set('kg', $('#hud-kg'), kg > 0.05 ? `${kg.toFixed(1)} KG${frame}${felt > 25 ? ' · TOO HEAVY TO RUN' : ''}` : '');
    $('#hud-kg').classList.toggle('heavy', felt > 25);
    this.setPrompt(h.prompt);
  }

  setPrompt(text) {
    if (text) {
      if (this.last.prompt !== text) this.prompt.textContent = text;
      this.last.prompt = text;
      this.prompt.classList.add('on');
    } else this.prompt.classList.remove('on');
  }

  travelProgress(done, total) {
    $('#travel-bar').style.width = `${Math.round((done / total) * 100)}%`;
  }

  debug(text) {
    if (this.debugEl) this.debugEl.textContent = text;
  }
}
