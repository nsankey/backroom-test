// THE STOCKTAKER. Halvard's last inventory clerk, still at its post beside the stock it was told
// to count: a stooped figure in a brown warehouse coat with a brass tally counter for a head.
// Every twenty seconds it counts the pile, one click per item. If the count comes up short it
// goes after whoever is carrying one of its items, and keeps coming until that item is put down;
// then it fetches the item back. It only counts: swap something cheap onto the pile and the
// numbers add up. Tell: the clicking. Counterplay: grab between counts, or swap.

import { pathTo, follow, face, prey, nearest } from './common.js';
import { TICK_HZ } from '../game/constants.js';

const COUNT_EVERY = 20 * TICK_HZ;
const CLICK = 22; // ticks per item counted
const PILE_R = 1.5;
const KILL_R = 0.9;

export default {
  id: 'stocktaker',
  name: 'The Stocktaker',

  /** spot: { x, z, pile: { x, z }, owned: [item ids] } (the session lays out the pile). */
  create(ctx, spot) {
    return {
      x: spot.x,
      z: spot.z,
      yaw: Math.atan2(-(spot.pile.x - spot.x), -(spot.pile.z - spot.z)),
      home: [spot.x, spot.z],
      pile: [spot.pile.x, spot.pile.z],
      owned: spot.owned,
      count: spot.owned.length,
      next: COUNT_EVERY,
      mode: 'guard',
      t: 0,
      n: 0,
      prey: null,
      fetch: null,
      giveUp: 0,
      path: null,
      pi: 0,
      goal: null,
    };
  },

  tick(s, ctx) {
    s.t++;
    s.moving = 0;
    const onPile = () => ctx.items.filter((i) => !i.holder && Math.hypot(i.x - s.pile[0], i.z - s.pile[1]) < PILE_R);
    switch (s.mode) {
      case 'guard':
        face(s, s.pile[0], s.pile[1], 0.05);
        if (--s.next <= 0) {
          s.mode = 'count';
          s.n = 0;
          s.clicks = Math.max(1, onPile().length);
          s.wait = s.clicks * CLICK + 20;
        }
        break;
      case 'count': {
        if (s.wait % CLICK === 0 && s.n < s.clicks) {
          s.n++;
          ctx.emit({ type: 'tally', creature: s.id, x: s.x, z: s.z, n: s.n });
        }
        if (--s.wait > 0) break;
        const here = onPile();
        if (here.length >= s.count) {
          // the numbers add up (whatever they are made of)
          s.count = here.length;
          s.mode = 'guard';
          s.next = COUNT_EVERY;
          break;
        }
        ctx.emit({ type: 'short', creature: s.id, x: s.x, z: s.z });
        const missing = s.owned.filter((id) => !here.some((i) => i.id === id));
        const held = ctx.items.find((i) => missing.includes(i.id) && i.holder && !String(i.holder).startsWith('c'));
        const loose = ctx.items.find((i) => missing.includes(i.id) && !i.holder);
        if (held) this.hunt(s, held.holder);
        else if (loose) this.fetchItem(s, ctx, loose);
        else {
          // gone down the night safe: it takes it out on whoever is nearest, then adjusts the books
          const t = nearest(prey(ctx), s.x, s.z);
          if (t) this.hunt(s, t.p.pid, 20 * TICK_HZ);
          else this.goHome(s, ctx);
          s.count = here.length;
          s.owned = s.owned.filter((id) => !missing.includes(id) || ctx.items.some((i) => i.id === id));
        }
        break;
      }
      case 'hunt': {
        const p = ctx.players.find((q) => q.pid === s.prey);
        const stillHeld = ctx.items.find((i) => s.owned.includes(i.id) && i.holder === s.prey);
        const loose = ctx.items.find((i) => s.owned.includes(i.id) && !i.holder && Math.hypot(i.x - s.pile[0], i.z - s.pile[1]) >= PILE_R);
        if (!stillHeld && s.giveUp <= 0) {
          // put down: it goes for the item instead
          if (loose) this.fetchItem(s, ctx, loose);
          else this.goHome(s, ctx);
          break;
        }
        if (s.giveUp > 0 && --s.giveUp === 0) {
          this.goHome(s, ctx);
          break;
        }
        if (!p || !p.alive || !prey(ctx).includes(p)) {
          // out of reach (in the yard or the van): it waits a while, then gives up
          s.wait = (s.wait || 0) + 1;
          if (s.wait > 10 * TICK_HZ) this.goHome(s, ctx);
          break;
        }
        s.wait = 0;
        if (s.t % 20 === 0 || !s.path) pathTo(s, ctx, p.x, p.z, 6000);
        follow(s, 2.55);
        if (Math.hypot(p.x - s.x, p.z - s.z) < KILL_R) ctx.kill(p.pid, 'stocktaker', s);
        break;
      }
      case 'fetch': {
        const it = ctx.items.find((i) => i.id === s.fetch);
        if (!it || (it.holder && it.holder !== s.id)) {
          if (it && it.holder) this.hunt(s, it.holder);
          else this.goHome(s, ctx);
          break;
        }
        if (it.holder === s.id) {
          it.x = s.x;
          it.z = s.z;
          if (follow(s, 1.5)) {
            // set it back on the pile
            it.holder = null;
            it.x = s.pile[0] + Math.sin(s.t) * 0.5;
            it.z = s.pile[1] + Math.cos(s.t) * 0.5;
            it.y = 0;
            ctx.emit({ type: 'restock', creature: s.id, x: it.x, z: it.z });
            this.goHome(s, ctx);
          }
          break;
        }
        if (follow(s, 1.8) || Math.hypot(it.x - s.x, it.z - s.z) < 0.7) {
          it.holder = s.id;
          it.y = 0.95;
          pathTo(s, ctx, s.pile[0], s.pile[1], 6000);
        }
        break;
      }
      case 'home':
        if (follow(s, 1.4)) {
          s.mode = 'guard';
          s.next = 3 * TICK_HZ; // recount soon after coming back
        }
        break;
    }
  },

  hunt(s, pid, giveUp = 0) {
    s.mode = 'hunt';
    s.prey = pid;
    s.giveUp = giveUp;
    s.path = null;
    s.wait = 0;
  },

  fetchItem(s, ctx, it) {
    s.mode = 'fetch';
    s.fetch = it.id;
    pathTo(s, ctx, it.x, it.z, 6000);
  },

  goHome(s, ctx) {
    s.mode = 'home';
    s.prey = null;
    s.giveUp = 0;
    if (!pathTo(s, ctx, s.home[0], s.home[1], 6000)) {
      s.x = s.home[0];
      s.z = s.home[1];
      s.mode = 'guard';
      s.next = 3 * TICK_HZ;
    }
  },
};
