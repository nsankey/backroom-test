// Deterministic light flicker: a pure function of (cell seed, tick), so every client agrees.

import { hash } from '../core/rng.js';

const SLOT = 6; // ticks per flicker slot (0.1 s at 60 Hz)

/** Flicker level 0..1 for a cell's flicker group at a tick. */
export function flickerLevel(seed, tick) {
  // bursts: every ~4-12 s a burst lasting ~0.6-2 s
  const window = Math.floor(tick / 480); // 8 s windows
  const h = hash(seed, 'fw', window);
  const burstStart = (h % 360) | 0;
  const burstLen = 36 + ((h >>> 9) % 84);
  const local = tick % 480;
  if (local < burstStart || local > burstStart + burstLen) {
    // steady, with a faint 1-2 % ripple
    return 0.97 + 0.03 * ((hash(seed, 'r', Math.floor(tick / 3)) & 255) / 255);
  }
  const slot = Math.floor(tick / SLOT);
  const v = hash(seed, 'fs', slot) & 255;
  if (v < 70) return 0.04;
  if (v < 120) return 0.35;
  if (v < 150) return 1.25;
  return 1;
}
