// SERVICE CORRIDOR: the back-of-house runs that join everything up. Painted block, lino, bare
// battens, lockers, a vending machine picked half clean, a staff room off to one side.

import { rngFor } from '../../core/rng.js';
import { TILE } from '../constants.js';
import { mainAxis, axisFrame, corridorWallSlots, spaced } from '../kit.js';

export default {
  id: 'corridor',
  name: 'Service Corridor',
  weight: 1,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const axis = mainAxis(plan, rng);
    const f = axisFrame(axis);
    plan.ambient = [0.02, 0.02, 0.02];
    const hall = plan.zone({ name: 'hall', ceil: 2.6, floor: 'lino', wall: 'paintBlock', ceilMat: 'ceilTile' });
    const c0 = 14 + rng.int(-3, 3);
    const c1 = c0 + 3;
    f.fill(plan, 1, c0, 30, c1, hall);
    plan.connectDoors(f.tile(16, c0 + 1), 4, hall);

    // a staff room on one side of the corridor, through a doorway
    const side = rng.chance(0.5) ? 'lo' : 'hi';
    const room = plan.zone({ name: 'staff', ceil: 2.6, floor: 'quarryTile', wall: 'paintBlockTeal', ceilMat: 'ceilTile' });
    const r0 = side === 'lo' ? c0 - 9 : c1 + 2;
    const r1 = side === 'lo' ? c0 - 2 : c1 + 9;
    const a0 = rng.int(4, 12);
    f.fill(plan, a0, r0, a0 + 12, r1, room);
    const doorA = a0 + 5;
    const dc = side === 'lo' ? c0 - 1 : c1 + 1;
    if (axis === 'x') plan.doorway(doorA, dc, doorA + 2, dc);
    else plan.doorway(dc, doorA, dc, doorA + 2);
    const rc = ((r0 + r1 + 1) / 2) * TILE;
    const ra = ((a0 + a0 + 13) / 2) * TILE;
    const tp = f.pt(ra, rc);
    plan.prop('desk', tp.x, tp.z, f.rotFwd, { w: 1.4, papers: rng.chance(0.5) });
    plan.loot(tp.x, tp.z, 0.75);
    const vp = f.pt(a0 * TILE + 0.7, side === 'lo' ? r0 * TILE + 0.45 : (r1 + 1) * TILE - 0.45);
    plan.prop('vending', vp.x, vp.z, side === 'lo' ? f.rotLo : f.rotHi, { flicker: rng.chance(0.4) });
    const lk = f.pt((a0 + 13) * TILE - 1.2, side === 'lo' ? r0 * TILE + 0.3 : (r1 + 1) * TILE - 0.3);
    plan.prop('locker', lk.x, lk.z, side === 'lo' ? f.rotLo : f.rotHi, { n: 4 });
    const lp2 = f.pt((a0 + 13) * TILE - 1.2, rc);
    plan.loot(lp2.x, lp2.z, 0);
    plan.troffer(tp.x, tp.z, { power: 0.8, flicker: rng.chance(0.3), rot: axis === 'x' ? 0 : Math.PI / 2 });
    const w2 = f.pt(ra - 2.2, rc);
    plan.troffer(w2.x, w2.z, { power: 0.7, flicker: rng.chance(0.3), dead: rng.chance(0.2), rot: axis === 'x' ? 0 : Math.PI / 2 });

    // lockers and a noticeboard along the corridor walls
    const slots = corridorWallSlots(plan, f, c0, c1, { width: 1.6, depth: 2, from: 2, to: 14 });
    for (const s of spaced(slots, 3.2, rng, 0.35)) {
      const r = rng.next();
      if (r < 0.45) {
        const inward = s.side === 'lo' ? 0.26 : -0.26;
        const p = f.pt(s.along, (s.side === 'lo' ? c0 : c1 + 1) * TILE + inward);
        plan.prop('locker', p.x, p.z, s.rot, { n: 4 });
      } else if (r < 0.65) plan.prop('noticeboard', s.x, s.z, s.rot, { w: 1.2 });
      else if (r < 0.75) plan.prop('sign', s.x, s.z, s.rot, { text: rng.pick(['NO WORKING ALONE', 'MIND THE STEP', 'STAFF ONLY']), y: 2.0, w: 1.3, h: 0.09 });
      else {
        const p = f.pt(s.along, (s.side === 'lo' ? c0 : c1 + 1) * TILE + (s.side === 'lo' ? 0.4 : -0.4));
        plan.loot(p.x, p.z, 0);
      }
    }
    // things set down along the hall
    for (const a of [3.2, 7.4, 11.6]) {
      const p = f.pt(a + rng.float(-0.8, 0.8), rng.chance(0.5) ? c0 * TILE + 0.35 : (c1 + 1) * TILE - 0.35);
      plan.loot(p.x, p.z, 0);
    }
    for (let a = 1.8; a < 15; a += 2.6) {
      const p = f.pt(a, (c0 + c1 + 1) * 0.5 * TILE);
      plan.batten(p.x, p.z, { power: 0.7, flicker: rng.chance(0.25), dead: rng.chance(0.12), drop: 0.2, rot: axis === 'x' ? 0 : Math.PI / 2 });
    }
    plan.fillDarkGaps([hall], { gap: 4.4, power: 0.55, rng, style: 'batten', drop: 0.2 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.55, level: 0.8, hvac: 0.4 }, room: 'corridor', ambience: ['lockerBang', 'ventTick', 'drip'] },
};
