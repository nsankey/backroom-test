// THE HUSHWARDEN. Halvard's night quiet-keeper, still on its rounds: a tall thin figure in a
// grey dust coat with a brass listening horn where its head should be. It is blind. It walks
// the bays turning its horn toward every sound, goes to look (listen) where it heard one, and
// if it hears you again close by it locks on (a rising whistle) and runs at the last place it
// heard you. Tell: a tuning-fork drone that carries a long way. Counterplay: crouch, stand
// still, put things down gently; make noise somewhere else.

import { pathTo, follow, face, randomSpot, prey, roll } from './common.js';

const HEAR = 15; // metres of hearing per unit of loudness
const KILL_R = 0.85;

export default {
  id: 'hushwarden',
  name: 'The Hushwarden',

  create(ctx, spot) {
    return { x: spot.x, z: spot.z, yaw: 0, mode: 'wander', wait: 60, path: null, pi: 0, goal: null, heard: null, t: 0, lock: 0 };
  },

  tick(s, ctx) {
    s.t++;
    s.moving = 0;
    // listen: the loudest thing it can hear this tick (late at night it hears further)
    const range = HEAR * (1 + Math.min(0.4, Math.max(0, ctx.min - 180) / 600));
    let best = null;
    for (const n of ctx.noises) {
      const d = Math.hypot(n.x - s.x, n.z - s.z);
      const reach = n.loud * range * (ctx.world.lineOfSight(s.x, s.z, n.x, n.z, 1.0) ? 1 : 0.55);
      if (d < reach && (!best || n.loud / (d + 1) > best.k)) best = { n, d, k: n.loud / (d + 1) };
    }
    if (best) {
      const { n, d } = best;
      const close = d < 7 && n.pid;
      if ((s.mode === 'investigate' || s.mode === 'hunt' || s.mode === 'listen') && close) {
        if (s.mode !== 'hunt') ctx.emit({ type: 'lock', creature: s.id, x: s.x, z: s.z });
        s.mode = 'hunt';
        s.lock = 240;
        pathTo(s, ctx, n.x, n.z, 4000);
      } else if (s.mode === 'wander' || s.mode === 'listen') {
        s.mode = 'listen';
        s.wait = 50;
        s.heard = [n.x, n.z];
      } else if (s.mode === 'investigate') pathTo(s, ctx, n.x, n.z, 6000);
    }
    switch (s.mode) {
      case 'wander':
        if (s.wait > 0) {
          s.wait--;
          break;
        }
        if (!s.path || s.pi >= s.path.length) {
          const p = randomSpot(ctx, s, 'wander');
          if (p && pathTo(s, ctx, p.x, p.z)) break;
          s.wait = 60;
          break;
        }
        if (follow(s, 1.0)) s.wait = 120 + Math.floor(roll(ctx, s, 'w') * 240);
        break;
      case 'listen':
        // turn the horn toward what it heard, then go
        if (s.heard) face(s, s.heard[0], s.heard[1], 0.1);
        if (--s.wait <= 0) {
          s.mode = s.heard && pathTo(s, ctx, s.heard[0], s.heard[1], 6000) ? 'investigate' : 'wander';
          s.wait = 0;
        }
        break;
      case 'investigate':
        if (follow(s, 1.55)) {
          s.mode = 'listen';
          s.heard = null;
          s.wait = 240;
          s.after = 'wander';
        }
        break;
      case 'hunt':
        s.lock--;
        if (follow(s, 4.1) || s.lock <= 0) {
          s.mode = 'listen';
          s.heard = null;
          s.wait = 180;
        }
        for (const p of prey(ctx)) if (Math.hypot(p.x - s.x, p.z - s.z) < KILL_R) ctx.kill(p.pid, 'hushwarden', s);
        break;
    }
    if (s.mode === 'listen' && s.wait <= 0 && !s.heard) s.mode = 'wander';
  },
};
