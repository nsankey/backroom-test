// THE TYPING POOL: grey carpet tile, cream walls, a suspended ceiling, clusters of desks behind
// low fabric screens. Typewriters with a sheet still in them. A supervisor's glass box in a corner.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors, hitsDoor } from '../kit.js';

export default {
  id: 'office',
  name: 'Typing Pool',
  weight: 1,
  doorMats: { wall: 'doorFrame', floor: 'threshold' },

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const room = plan.zone({ name: 'office', ceil: 2.7, floor: 'carpetTile', wall: 'plasterOffice', ceilMat: 'ceilTile' });
    plan.fill(1, 1, 30, 30, room);
    plan.ambient = [0.026, 0.026, 0.026];

    // the supervisor's office: a partitioned corner with a doorway
    // corners as [box i0, box j0]: an 8 x 8 tile box, its inner wall one tile thick on the room side
    const corners = [[1, 1], [23, 1], [1, 23], [23, 23]].filter(([i, j]) => clearOfDoors(plan, i * 0.5, j * 0.5, (i + 8) * 0.5, (j + 8) * 0.5, 1.4));
    let boss = null;
    if (corners.length) {
      const [i0, j0] = rng.pick(corners);
      const left = i0 === 1;
      const top = j0 === 1;
      const inner = plan.zone({ name: 'supervisor', ceil: 2.7, floor: 'carpetTile', wall: 'partition', ceilMat: 'ceilTile' });
      plan.fill(i0, j0, i0 + 7, j0 + 7, 0);
      plan.fill(left ? 1 : 24, top ? 1 : 24, left ? 7 : 30, top ? 7 : 30, inner);
      const dj = top ? 8 : 23;
      const di = left ? 3 : 26;
      plan.doorway(di, dj, di + 2, dj, { wall: 'doorFrame', floor: 'threshold' });
      const cx = (left ? 4 : 27) * 0.5 + 0.25;
      const cz = (top ? 3.5 : 27.5) * 0.5;
      plan.prop('desk', cx, cz, top ? 0 : Math.PI, { w: 1.5, papers: true });
      plan.prop('officeChair', cx + 0.1, cz + (top ? -0.75 : 0.75), top ? 0 : Math.PI);
      plan.prop('filing', left ? 0.85 : 15.15, top ? 1.1 : 14.9, left ? Math.PI / 2 : -Math.PI / 2);
      plan.loot(cx - 0.4, cz, 0.75);
      plan.loot(cx + 0.4, cz + 0.05, 0.75);
      plan.troffer(cx, top ? 2.4 : 13.6, { power: 0.8, flicker: rng.chance(0.3) });
      boss = { x0: i0 * 0.5, z0: j0 * 0.5, x1: (i0 + 8) * 0.5, z1: (j0 + 8) * 0.5 };
    }

    // desk clusters on a grid (a cluster is two pairs of desks across a screen, 3.1 x 1.9 m)
    for (const cx of [3.3, 8.0, 12.7])
      for (const cz of [3.6, 8.0, 12.4]) {
        const x = cx + rng.float(-0.2, 0.2);
        let z = null;
        for (const dz of [0, 0.9, -0.9]) {
          const zz = cz + dz + rng.float(-0.15, 0.15);
          if (boss && x + 1.8 > boss.x0 && x - 1.8 < boss.x1 && zz + 1.2 > boss.z0 && zz - 1.2 < boss.z1) continue;
          if (clearOfDoors(plan, x - 1.6, zz - 1.0, x + 1.6, zz + 1.0, 1.3)) {
            z = zz;
            break;
          }
        }
        if (z === null || rng.chance(0.08)) continue;
        plan.prop('cubicle', x, z, 0);
        plan.block(x - 1.58, z - 0.95, x + 1.58, z + 0.95);
        for (const [sx, sz] of [[-0.75, 0.42], [0.75, 0.42], [-0.75, -0.42], [0.75, -0.42]]) if (rng.chance(0.38)) plan.loot(x + sx + rng.float(-0.3, 0.3), z + sz + (sz > 0 ? 0.08 : -0.08), 0.75);
      }
    // filing along the walls
    for (const d of ['N', 'S']) {
      for (let a = 2; a < 14.5; a += rng.float(1.6, 3)) {
        if (hitsDoor(plan, d, a - 0.4, a + 0.4, 1.2)) continue;
        const z = d === 'N' ? 0.85 : 15.15;
        const i = Math.floor(a / 0.5);
        const j = Math.floor(z / 0.5);
        if (!plan.isFloor(i, j) || plan.zoneAt(i, j).name !== 'office' || plan.blocked[plan.idx(i, j)]) continue;
        if (!clearOfDoors(plan, a - 0.4, z - 0.4, a + 0.4, z + 0.4, 1.4)) continue;
        plan.prop('filing', a, z, d === 'N' ? 0 : Math.PI);
        plan.block(a - 0.25, z - 0.32, a + 0.25, z + 0.32);
        if (rng.chance(0.3)) plan.loot(a, z + (d === 'N' ? 0.6 : -0.6), 0);
      }
    }
    if (!hitsDoor(plan, 'E', 7, 9.4)) plan.prop('noticeboard', 15.5, 8.2, -Math.PI / 2, { w: 1.4 });
    if (!hitsDoor(plan, 'W', 7, 9.4)) plan.prop('sign', 0.5, 8.2, Math.PI / 2, { text: plan.siteId === 'records' ? 'TYPING POOL' : 'QUIET PLEASE', y: 2.15, w: 1.4, h: 0.1 });
    plan.troffers(1.2, 1.2, 14.8, 14.8, { spacing: 2.6, flickerChance: 0.12, rng, power: 0.9, skipChance: 0.12 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.5, level: 0.8, hvac: 0.5 }, room: 'medium', ambience: ['typeKey', 'phoneFar', 'ventTick'] },
};
