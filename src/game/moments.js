// The moment-scripting API. Kinds, hunters and residents script small scenes with it:
//   caption(text, secs)   subtitle at the bottom of the frame
//   sound(name, pos)      positional one-shot (pos = {x, y, z} world, or null for 2D)
//   after(secs, fn)       run fn later, on the simulation tick (deterministic timing)
//   use(point, prompt, fn)  register a temporary "press E" interaction at a world point
//   sit(point)            seat the player there until they move
//   discover(key, text)   add a logbook entry once
// Timers run off the shared tick, never wall-clock time.

import { TICK_HZ } from './constants.js';

export class Moments {
  constructor(game) {
    this.game = game;
    this.timers = []; // { at: tick, fn }
    this.temp = []; // temporary interactions
  }

  /** A moment context bound to a place (cell) and point. */
  ctx(cell, point) {
    const g = this.game;
    const at = point ? { x: (cell ? cell.ox : 0) + point.x, y: point.y ?? 1.2, z: (cell ? cell.oz : 0) + point.z } : null;
    const rng = g.momentRng;
    return {
      at,
      cell,
      point,
      game: g,
      caption: (text, secs = 3) => g.ui.caption(text, secs),
      sound: (name, pos = at, opts) => g.audio.play(name, pos, opts),
      after: (secs, fn) => this.after(secs, fn),
      use: (p, prompt, fn, radius = 1.4) => this.use(p, prompt, fn, radius),
      sit: (p, yaw) => g.sit(p, yaw),
      discover: (key, text) => g.discover(key, text),
      pick: (arr) => arr[Math.floor(rng.next() * arr.length)],
      chance: (p) => rng.next() < p,
      player: g.player,
      tick: g.tick,
    };
  }

  after(secs, fn) {
    this.timers.push({ at: this.game.tick + Math.round(secs * TICK_HZ), fn });
  }

  use(p, prompt, fn, radius = 1.4) {
    const it = { type: '__temp', x: p.x, y: p.y ?? 1.0, z: p.z, radius, prompt, fn, world: true };
    this.temp.push(it);
    return () => (this.temp = this.temp.filter((t) => t !== it));
  }

  update(tick) {
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.at <= tick);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.at > tick);
    for (const t of due) t.fn();
  }

  clear() {
    this.timers = [];
    this.temp = [];
  }
}
