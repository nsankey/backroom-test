// THE PLUS-ONE. Halvard's rule was NO WORKING ALONE, and something still sees that it is kept.
// When one of the crew has been on their own too long, it is there: dressed like crew, a
// Grisholm helmet with the visor down, a little behind and out of sight. It whistles. It only
// comes closer while you stand still; while you keep moving it hangs back, keeping pace.
// Tell: the whistled tune, and the helmet camera's face counter reading PERSONS: 2.
// Counterplay: keep moving, regroup with the crew, or get back in the van.

import { pathTo, follow, face, roll } from './common.js';
import { inVan } from '../game/van.js';

const KILL_R = 1.0;
const HOLD = 9; // how far back it keeps while you move

export default {
  id: 'plusOne',
  name: 'The Plus-One',

  /** spot: { x, z, pid } */
  create(ctx, spot) {
    return { x: spot.x, z: spot.z, yaw: 0, prey: spot.pid, mode: 'follow', t: 0, path: null, pi: 0, goal: null, gone: false };
  },

  tick(s, ctx) {
    s.t++;
    s.moving = 0;
    const p = ctx.players.find((q) => q.pid === s.prey);
    // it leaves when you are not alone any more (or safe in the van), once you are not looking
    if (!p || !p.alive || inVan(p.x, p.z) || p.alone < 1) {
      const seen = p && p.alive && ctx.world.lineOfSight(p.x, p.z, s.x, s.z, 1.4) && Math.hypot(p.x - s.x, p.z - s.z) < 20;
      if (!seen || !p.alive || inVan(p.x, p.z)) s.gone = true;
      return;
    }
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    face(s, p.x, p.z, 0.06);
    if (p.still > 0.45) {
      // you stopped: it closes
      s.mode = 'close';
      if (s.t % 15 === 0 || !s.path) pathTo(s, ctx, p.x, p.z, 4000);
      follow(s, 1.6);
    } else {
      // you are moving: it keeps its distance, walking when you walk
      s.mode = 'follow';
      if (d > HOLD + 2) {
        if (s.t % 20 === 0 || !s.path) pathTo(s, ctx, p.x, p.z, 4000);
        follow(s, Math.min(3.6, Math.max(1.2, p.speed)));
      }
    }
    if (d < KILL_R) ctx.kill(p.pid, 'plusOne', s);
    // now and then it changes its tune
    if (s.t % 600 === 0 && roll(ctx, s, 'tune') < 0.5) ctx.emit({ type: 'tune', creature: s.id });
  },
};

/** Seconds alone before it comes, by the writ's hazard. */
export const ALONE_LIMIT = [0, 150, 120, 95];
