// RESIDENT: THE GUEST WHO WAITS. A man in a brown suit with a packed suitcase, standing very
// still, waiting to check out. Harmless. Talk to him once and he tells you how to get past the
// porter; look away afterwards and he is gone.

import * as THREE from 'three';
import { hash } from '../core/rng.js';
import { person } from './figure.js';

export default {
  id: 'waitingGuest',
  role: 'resident',
  name: 'The Guest Who Waits',
  card: {
    title: 'The Guest Who Waits',
    blurb: 'Packed, dressed, suitcase in hand. Checkout is at noon. It has been nearly noon for years.',
  },

  /** Does he appear in this cell? Pure function of seed + cell. */
  appearsIn(seed, cell) {
    if (!cell.points.resident) return false;
    const roll = hash(seed, 'waitingGuest', cell.cx, cell.cz) % 100;
    if (cell.cx === 0 && cell.cz === 0) return false; // never on the first screen
    return roll < (cell.kindId === 'lobby' ? 45 : 9);
  },

  spawn(ctx, cell) {
    const p = cell.points.waitingGuest || cell.points.resident;
    const spot = ctx.findOpenSpot(cell, p);
    return {
      type: 'waitingGuest',
      x: spot.x,
      z: spot.z,
      prevX: spot.x,
      prevZ: spot.z,
      yaw: p.yaw ?? (hash(cell.seed, 'wg-yaw') % 628) / 100,
      cellKey: cell.key,
      phase: 'idle',
      t: 0,
      talkedAt: 0,
    };
  },

  tick(s, ctx) {
    s.t++;
    if (s.phase === 'after') {
      // gone the moment you are not looking at him
      const p = ctx.player;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      const look = (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / (d || 1);
      if (look < 0.2 || d > 12 || s.t - s.talkedAt > 40 * 60) s.done = true;
    }
  },

  interactions(s) {
    if (s.phase !== 'idle') return [];
    return [{ x: s.x, y: 1.4, z: s.z, radius: 1.8, prompt: 'Talk to the guest', entity: s }];
  },

  interact(s, m) {
    s.phase = 'talking';
    s.talkedAt = s.t;
    const at = { x: s.x, y: 1.6, z: s.z };
    m.sound('whisper', at);
    m.caption('"Is it noon yet?"', 3);
    m.after(3.5, () => m.caption('"Checkout is at noon. I have been waiting since they turned the lights on."', 4.5));
    m.after(8.5, () => m.caption('"If you hear the cart, don\'t run. He listens for footsteps. He thinks we\'re luggage."', 5.5));
    m.after(14.5, () => {
      m.caption('He looks at his watch. It has no hands.', 3.5);
      m.discover('resident:waitingGuest', 'A guest waiting to check out told me the porter listens for footsteps. Walk, don\'t run, and keep the flashlight off when the cart is near.');
      s.phase = 'after';
    });
  },

  view() {
    const f = person({ height: 1.78, coat: 0x5a4430, trousers: 0x3e3022, skin: 0xc4ae94, hat: 'fedora' });
    const case_ = f.add('', new THREE.BoxGeometry(0.5, 0.36, 0.14), f.mat(0x6a4a2a), 0.34, 0.24, 0.0);
    case_.rotation.y = Math.PI / 2;
    f.add('', new THREE.BoxGeometry(0.03, 0.03, 0.12), f.mat(0x222018), 0.3, 0.44, 0.0);
    f.parts.armR.rotation.z = -0.02;
    return {
      object: f.group,
      update(s, alpha, light, t) {
        f.group.position.set(s.x, 0, s.z);
        f.group.rotation.y = s.yaw;
        // breathing, barely
        f.parts.torso.scale.y = 1 + Math.sin(t * 1.3) * 0.006;
        f.setLight(light);
      },
      dispose() {
        f.dispose();
      },
    };
  },
};
