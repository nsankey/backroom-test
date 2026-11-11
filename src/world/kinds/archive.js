// THE RECORDS STORE: runs of mobile shelving packed with file boxes, wound shut except for one
// aisle each; studded rubber deck, painted bulkheads, low ceilings and bare battens. A reading table.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors, hitsDoor } from '../kit.js';

export default {
  id: 'archive',
  name: 'Records Store',
  weight: 1,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const room = plan.zone({ name: 'archive', ceil: 2.65, floor: 'lino', wall: 'paintBlock', ceilMat: 'ceilTile' });
    plan.fill(1, 1, 30, 30, room);
    plan.ambient = [0.02, 0.02, 0.018];

    // two banks of compactor shelving, each a run of units along x; an aisle between banks
    const banks = rng.chance(0.5) ? [[4.2, 4], [11.8, 4]] : [[4.6, 5], [12.4, 3]];
    for (const [cz, n] of banks) {
      for (const cx of [4.3, 11.7]) {
        const len = 4.4;
        const depth = n * 1.05;
        if (!clearOfDoors(plan, cx - len / 2, cz - depth / 2, cx + len / 2 + 0.3, cz + depth / 2, 1.8)) continue;
        if (rng.chance(0.1)) continue;
        plan.prop('compactor', cx, cz, cx < 8 ? 0 : Math.PI, { len, n, full: rng.float(0.65, 0.92) });
        plan.block(cx - len / 2, cz - depth / 2, cx + len / 2, cz + depth / 2);
        // things left on the floor at the end of a run, and on the bottom shelves
        for (let k = 0; k < n; k++) if (rng.chance(0.3)) plan.loot(cx + (cx < 8 ? 1 : -1) * (len / 2 + 0.45), cz + (k - (n - 1) / 2) * 1.05, 0);
      }
    }
    // the reading table under the one good light
    const tx = 8 + rng.float(-0.4, 0.4);
    const tz = 8 + rng.float(-0.4, 0.4);
    if (clearOfDoors(plan, tx - 1, tz - 0.6, tx + 1, tz + 0.6, 1.4)) {
      plan.prop('desk', tx, tz, Math.PI / 2, { w: 1.6, papers: true });
      plan.prop('officeChair', tx - 0.85, tz, -Math.PI / 2 + 0.3);
      plan.loot(tx, tz - 0.4, 0.75);
      plan.loot(tx + 0.05, tz + 0.4, 0.75);
    }
    for (const [x, z] of [[1.3, 1.3], [14.7, 1.3], [1.3, 14.7], [14.7, 14.7], [8, 1.3], [8, 14.7]]) if (clearOfDoors(plan, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1.0)) plan.loot(x, z, 0);
    if (!hitsDoor(plan, 'N', 6.5, 9.5)) plan.prop('sign', 8, 0.5, 0, { text: 'RECORDS', y: 2.1, w: 1.2, h: 0.12 });
    if (!hitsDoor(plan, 'S', 6.5, 9.5)) plan.prop('sign', 8, 15.5, Math.PI, { text: 'QUIET PLEASE', y: 2.1, w: 1.3, h: 0.1 });
    // battens over the aisles, sparse: the store was never lit for reading
    for (let x = 2; x < 15; x += 3.2) for (const z of [1.9, 8, 14.1]) plan.batten(x, z, { power: 0.75, flicker: rng.chance(0.2), dead: rng.chance(0.12), drop: 0.25 });
    plan.fillDarkGaps([room], { gap: 4.6, power: 0.55, rng, style: 'batten', drop: 0.25 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.4, level: 0.6, hvac: 0.3 }, room: 'small', ambience: ['paperSlide', 'ventTick', 'crankTurn'] },
};
