// HUD and screens: the camcorder overlay (REC, timestamp), interaction prompt, captions,
// title screen and pause screen. Plain DOM.

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor() {
    this.hud = $('#hud');
    this.prompt = $('#prompt');
    this.captionEl = $('#caption');
    this.stamp = $('#stamp');
    this.rec = $('#rec');
    this.debugEl = $('#debug');
    this.battery = $('#battery');
    this.captionTimer = 0;
    this.captionQueue = [];
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

  setPrompt(text) {
    if (text) {
      this.prompt.textContent = text;
      this.prompt.classList.add('on');
    } else this.prompt.classList.remove('on');
  }

  /** The tape clock: seconds tick, but the minute never moves on. */
  setStamp(seconds) {
    const s = Math.floor(seconds) % 60;
    const glitch = Math.floor(seconds / 60) % 7 === 6 && s < 3;
    const time = glitch ? '--:--:--' : `3:14:${String(s).padStart(2, '0')} AM`;
    this.stamp.innerHTML = `MAR. 14 1979<br>${time}`;
  }

  setRec(blink) {
    this.rec.classList.toggle('dim', blink);
  }

  setBattery(level, on) {
    if (!this.battery) return;
    const bars = Math.ceil(level * 4);
    this.battery.textContent = on ? '[' + '|'.repeat(bars) + ' '.repeat(4 - bars) + ']' : '';
  }

  debug(text) {
    if (this.debugEl) this.debugEl.textContent = text;
  }
}
