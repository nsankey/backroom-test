// THE DIMMER. What the lights were kept on against. A man-shaped absence, like a coat hung in
// a doorway with nobody in it, that only stands where it is dark. Light goes out around it:
// the tubes nearest it pop and die. In the dark it comes quickly; it can push into light only
// by putting it out, slowly, one fitting at a time. Its territory grows with the brownout.
// Tell: lights dying in a ring, tubes popping, a pressure in the ears. Counterplay: stay under
// working light, keep moving toward the van; a headlamp held on it drives it back.

import { pathTo, follow, randomSpot, prey, nearest, roll } from './common.js';

const KILL_R = 0.8;
export const DARK = 0.08; // below this light level a place counts as dark
export const DIMMER_R = 2.8; // the radius of the dark it carries

/** Light level (0..) at a point, ignoring the Dimmer's own dark. */
function lum(ctx, x, z) {
  const l = ctx.world.lightAt(x, 1.2, z, ctx.tmp);
  return l[0] * 0.3 + l[1] * 0.55 + l[2] * 0.15;
}

export default {
  id: 'dimmer',
  name: 'The Dimmer',

  create(ctx, spot) {
    return { x: spot.x, z: spot.z, yaw: 0, mode: 'drift', path: null, pi: 0, goal: null, t: 0, grow: 0, burn: 0, pLit: 1, popAt: 0 };
  },

  tick(s, ctx) {
    s.t++;
    s.moving = 0;
    s.grow = Math.min(1, s.grow + 1 / 180); // the dark gathers when it arrives
    const target = nearest(prey(ctx), s.x, s.z);
    // a headlamp held on it burns: it backs off into the dark
    if (s.burn > 0) {
      s.burn--;
      s.mode = 'recoil';
    }
    if (target && s.t % 10 === 0) s.pLit = lum(ctx, target.p.x, target.p.z);
    const dark = target && (s.pLit < DARK || target.d < DIMMER_R * 0.9);
    if (s.mode === 'recoil') {
      if (target && s.t % 20 === 0) {
        // back away from the beam: the first open spot roughly behind it
        const away = Math.atan2(s.x - target.p.x, s.z - target.p.z);
        let found = false;
        for (const [da, r] of [[0, 6], [0.5, 6], [-0.5, 6], [1, 5], [-1, 5], [0, 3.5], [1.6, 4], [-1.6, 4]]) {
          const x = s.x + Math.sin(away + da) * r;
          const z = s.z + Math.cos(away + da) * r;
          if (ctx.world.isWalkable(x, z) && pathTo(s, ctx, x, z, 1500)) {
            found = true;
            break;
          }
        }
        // cornered: slip off anywhere further from the beam
        for (let k = 0; k < 4 && !found; k++) {
          const p = randomSpot(ctx, s, 'flee' + k);
          if (p && Math.hypot(p.x - target.p.x, p.z - target.p.z) > target.d + 3) found = pathTo(s, ctx, p.x, p.z, 3000);
        }
      }
      follow(s, 2.4);
      if (s.burn <= 0) s.mode = 'drift';
    } else if (target && target.d < 22 && (dark || target.d < 9)) {
      // it comes for you: fast through the dark, a crawl into light
      s.mode = dark ? 'rush' : 'creep';
      if (s.t % 24 === 0 || !s.path) pathTo(s, ctx, target.p.x, target.p.z, 5000);
      follow(s, dark ? 2.0 : 0.32);
      if (!dark && s.t >= s.popAt) {
        s.popAt = s.t + 70 + Math.floor(roll(ctx, s, 'pop') * 60);
        ctx.emit({ type: 'pop', creature: s.id, x: s.x, z: s.z });
      }
      if (target.d < KILL_R) ctx.kill(target.p.pid, 'dimmer', s);
    } else {
      s.mode = 'drift';
      if (!s.path || s.pi >= s.path.length) {
        if (s.t % 90 === 0) {
          const p = randomSpot(ctx, s, 'drift');
          if (p) pathTo(s, ctx, p.x, p.z);
        }
      } else follow(s, 0.7);
    }
  },
};
