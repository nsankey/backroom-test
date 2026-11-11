// THE BOTTLING HALL: tread plate and teal bulkheads, a row of stainless vessels, a bottling
// line with its last bottles still queued, overhead pipe runs and a control desk.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors, hitsDoor } from '../kit.js';

export default {
  id: 'plant',
  name: 'Bottling Hall',
  weight: 1,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const room = plan.zone({ name: 'plant', ceil: 6.4, floor: 'diamondPlate', wall: 'paintBlockTeal', ceilMat: 'deckSteel' });
    plan.fill(1, 1, 30, 30, room);
    plan.ambient = [0.018, 0.02, 0.02];
    const alongX = rng.chance(0.5);
    const pt = (a, c) => (alongX ? { x: a, z: c } : { x: c, z: a });

    // vessels in a row along one side
    const tankC = rng.pick([3.4, 12.6]);
    for (let a = 3; a < 14; a += 3.4) {
      const p = pt(a + rng.float(-0.2, 0.2), tankC);
      if (!clearOfDoors(plan, p.x - 1.4, p.z - 1.4, p.x + 1.4, p.z + 1.4, 1.8)) continue;
      plan.prop('tank', p.x, p.z, (tankC < 8 ? 0 : Math.PI) + (alongX ? 0 : Math.PI / 2), { r: 1.1, h: rng.float(2.8, 3.6) });
      plan.block(p.x - 1.15, p.z - 1.15, p.x + 1.15, p.z + 1.15);
      if (rng.chance(0.5)) plan.loot(p.x + rng.float(-0.4, 0.4), p.z + (tankC < 8 ? 1.6 : -1.6), 0);
    }
    // the bottling line down the middle
    const lineC = tankC < 8 ? 9.0 : 7.0;
    const lp = pt(8, lineC);
    {
      const len = 7.5;
      const ok = alongX ? clearOfDoors(plan, 8 - len / 2, lineC - 0.4, 8 + len / 2, lineC + 0.4, 1.6) : clearOfDoors(plan, lineC - 0.4, 8 - len / 2, lineC + 0.4, 8 + len / 2, 1.6);
      if (ok) {
        plan.prop('conveyor', lp.x, lp.z, alongX ? 0 : Math.PI / 2, { len });
        if (alongX) plan.block(8 - len / 2, lineC - 0.3, 8 + len / 2, lineC + 0.3);
        else plan.block(lineC - 0.3, 8 - len / 2, lineC + 0.3, 8 + len / 2);
        for (let k = 0; k < 3; k++) if (rng.chance(0.5)) {
          const q = pt(8 + rng.float(-3, 3), lineC + (rng.chance(0.5) ? 0.9 : -0.9));
          plan.loot(q.x, q.z, 0);
        }
      }
    }
    // control desk and crates of empties on the far side
    const farC = tankC < 8 ? 13.6 : 2.4;
    const cd = pt(rng.float(4, 12), farC);
    if (clearOfDoors(plan, cd.x - 1.2, cd.z - 0.6, cd.x + 1.2, cd.z + 0.6, 1.6)) {
      plan.prop('controlDesk', cd.x, cd.z, (farC < 8 ? 0 : Math.PI) + (alongX ? 0 : Math.PI / 2));
      plan.block(cd.x - 1.1, cd.z - 1.1, cd.x + 1.1, cd.z + 1.1);
      const q = pt(rng.float(2, 14), farC + (farC < 8 ? 1.4 : -1.4));
      plan.loot(q.x, q.z, 0);
    }
    for (let k = 0; k < 4; k++) {
      const p = pt(rng.float(2, 14), farC + rng.float(-0.6, 0.6));
      if (!clearOfDoors(plan, p.x - 0.6, p.z - 0.6, p.x + 0.6, p.z + 0.6, 1.8)) continue;
      if (Math.hypot(p.x - cd.x, p.z - cd.z) < 2) continue;
      plan.prop('crate', p.x, p.z, rng.float(-0.2, 0.2), { stack: true, w: 0.8, h: 0.6, d: 0.6 });
    }
    // pipes overhead and high-bays between them
    const pp = pt(8, (tankC + lineC) / 2);
    plan.prop('pipeRun', pp.x, pp.z, alongX ? 0 : Math.PI / 2, { len: 15, y: 4.4, ceil: 6.4 });
    for (let a = 2.5; a < 15; a += 3.3)
      for (const c of [lineC, farC < 8 ? 3 : 13]) {
        const p = pt(a, c);
        plan.highbay(p.x, p.z, { power: 1.1, flicker: rng.chance(0.2), dead: rng.chance(0.1), drop: 1.8 });
      }
    for (const [x, z] of [[1.3, 8], [14.7, 8]]) if (clearOfDoors(plan, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1.0)) plan.loot(x, z, 0);
    if (!hitsDoor(plan, 'N', 5.5, 10.5)) plan.prop('sign', 8, 0.5, 0, { text: 'BOTTLING HALL', y: 3.4, w: 2.6, h: 0.2 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.3, level: 0.6, hvac: 0.8 }, room: 'large', ambience: ['pipeKnock', 'drip', 'bottleClink'] },
};
