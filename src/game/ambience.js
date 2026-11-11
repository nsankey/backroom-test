// Ambience: distant one-shots from the current place's sound list, plus a crackle when the
// lights in this place stutter. Presentation only (not simulation), but still seeded.

import { RNG } from '../core/rng.js';

export class Ambience {
  constructor() {
    this.rng = new RNG(4471);
    this.next = 6;
    this.lastFlicker = 1;
  }

  frame(game, dt) {
    if (game.paused || !game.audio.ready || game.travel) return;
    const cell = game.currentCell;
    if (!cell) return;
    this.next -= dt;
    if (this.next <= 0) {
      this.next = this.rng.float(10, 30);
      const list = cell.kind.sounds?.ambience || [];
      if (list.length) {
        const name = this.rng.pick(list);
        const p = game.player;
        const a = this.rng.float(0, Math.PI * 2);
        const d = this.rng.float(7, 18);
        game.audio.play(name, { x: p.x + Math.cos(a) * d, y: 1.4, z: p.z + Math.sin(a) * d }, { muffled: true, wet: 0.7 });
      }
    }
    // light stutter -> crackle
    const f = cell.uniforms.uFlicker.value;
    if (Math.abs(f - this.lastFlicker) > 0.4 && this.rng.chance(0.6)) game.audio.crackle(0.6 + this.rng.float(0, 0.4));
    this.lastFlicker = f;
  }
}
