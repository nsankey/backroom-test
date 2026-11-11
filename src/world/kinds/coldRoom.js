// COLD ROOM: insulated white panels, a frosted epoxy floor, stacks of rimed stock on pallets
// and evaporators breathing along one wall. Sealed blue-white fittings. Still cold.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors, hitsDoor } from '../kit.js';

export default {
  id: 'coldRoom',
  name: 'Cold Room',
  weight: 1,
  doorMats: { wall: 'panelWhite', floor: 'freezerFloor' },

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const room = plan.zone({ name: 'cold', ceil: 3.6, floor: 'freezerFloor', wall: 'panelWhite', ceilMat: 'panelWhite', baseboard: false });
    // an anteroom band along one side, kept as part of the room, and a solid plant void in a corner
    plan.fill(1, 1, 30, 30, room);
    const corner = rng.pick([[1, 1], [24, 1], [1, 24], [24, 24]]);
    const voidRect = [corner[0], corner[1], corner[0] + 5, corner[1] + 5];
    if (clearOfDoors(plan, voidRect[0] * 0.5, voidRect[1] * 0.5, (voidRect[2] + 1) * 0.5, (voidRect[3] + 1) * 0.5, 1.6)) plan.fill(...voidRect, 0);
    plan.ambient = [0.02, 0.024, 0.03];

    // stock stacks in a grid with cross aisles
    const alongX = rng.chance(0.5);
    for (let a = 3; a <= 13; a += 2.5)
      for (const c of [4.2, 6.6, 9.4, 11.8]) {
        const p = alongX ? { x: a, z: c } : { x: c, z: a };
        if (rng.chance(0.18)) continue;
        if (!clearOfDoors(plan, p.x - 0.75, p.z - 0.75, p.x + 0.75, p.z + 0.75, 2.0)) continue;
        const ti = Math.floor(p.x / 0.5);
        const tj = Math.floor(p.z / 0.5);
        if (!plan.isFloor(ti, tj) || !plan.isFloor(ti + 1, tj + 1) || !plan.isFloor(ti - 1, tj - 1)) continue;
        plan.prop('frostStack', p.x, p.z, (alongX ? 0 : Math.PI / 2) + rng.float(-0.05, 0.05));
        plan.block(p.x - 0.65, p.z - 0.55, p.x + 0.65, p.z + 0.55);
        if (rng.chance(0.4)) plan.loot(p.x + rng.float(-0.4, 0.4), p.z + (rng.chance(0.5) ? 1 : -1) * 0.95, 0);
      }
    // evaporators high on a wall without a door
    const wall = ['N', 'S', 'E', 'W'].find((d) => !plan.doors[d]) || 'N';
    for (const along of [4, 11]) {
      if (hitsDoor(plan, wall, along - 1, along + 1)) continue;
      const p = wall === 'N' ? { x: along, z: 0.9, r: 0 } : wall === 'S' ? { x: along, z: 15.1, r: Math.PI } : wall === 'W' ? { x: 0.9, z: along, r: Math.PI / 2 } : { x: 15.1, z: along, r: -Math.PI / 2 };
      plan.prop('evaporator', p.x, p.z, p.r, { y: 2.85 });
    }
    // sealed fittings in rows
    for (let a = 2.6; a < 15; a += 3.6)
      for (let c = 2.6; c < 15; c += 3.6) {
        const p = alongX ? { x: a, z: c } : { x: c, z: a };
        if (plan.isFloor(Math.floor(p.x / 0.5), Math.floor(p.z / 0.5))) plan.troffer(p.x, p.z, { style: 'sealed', power: 0.9, color: [0.82, 0.94, 1.0], flicker: rng.chance(0.15), dead: rng.chance(0.08), rot: alongX ? 0 : Math.PI / 2 });
      }
    for (const [x, z] of [[1.4, 8], [14.6, 8], [8, 1.4], [8, 14.6]]) if (plan.isFloor(Math.floor(x / 0.5), Math.floor(z / 0.5)) && clearOfDoors(plan, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1.2)) plan.loot(x, z, 0);
    if (!hitsDoor(plan, 'N', 6, 10)) plan.prop('sign', 8, 0.5, 0, { text: 'COLD STORE  -  KEEP DOOR SHUT', y: 2.4, w: 2.4, h: 0.12 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.15, level: 0.5, hvac: 1.0 }, room: 'medium', ambience: ['compressor', 'iceTick', 'drip'] },
};
