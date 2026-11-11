// CARGO HOLD: a tall hold of teal pallet racking between the hull frames, under the deck above. Back-to-back runs with wide
// aisles between them and a perimeter aisle that keeps every door connected. High-bays hang
// over the aisles; the tops of the racks disappear into the dark.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors } from '../kit.js';

export default {
  id: 'racking',
  name: 'Cargo Hold',
  weight: 1,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const cold = plan.siteId === 'coldstore';
    const room = plan.zone({ name: 'racking', ceil: 6.2, floor: 'sealedConcrete', wall: cold ? 'panelWhite' : 'corrugated', ceilMat: 'deckSteel', baseboard: !cold });
    plan.fill(1, 1, 30, 30, room);
    plan.ambient = [0.016, 0.018, 0.02];

    // runs along x or z; each run is back-to-back racking (2 x 1.1 m deep)
    const alongX = rng.chance(0.5);
    const pt = (a, c) => (alongX ? { x: a, z: c } : { x: c, z: a });
    const runs = rng.chance(0.5) ? [4.6, 11.4] : [5.2];
    const bays = rng.int(3, 4);
    const bw = 2.7;
    const len = bays * bw;
    const a0 = 8 - len / 2 + rng.float(-0.4, 0.4);
    const aisles = [];
    for (const c of runs) {
      for (const side of [-0.56, 0.56]) {
        for (let k = 0; k < bays; k++) {
          const a = a0 + bw * (k + 0.5);
          const p = pt(a, c + side);
          const half = alongX ? [bw / 2 + 0.1, 0.56] : [0.56, bw / 2 + 0.1];
          if (!clearOfDoors(plan, p.x - half[0], p.z - half[1], p.x + half[0], p.z + half[1], 2.0)) continue;
          const rot = (alongX ? 0 : Math.PI / 2) + (side > 0 ? 0 : Math.PI);
          plan.prop('palletRack', p.x, p.z, rot, { w: bw, empty: 0.3 });
          plan.block(p.x - half[0], p.z - half[1], p.x + half[0], p.z + half[1]);
          // loot set down in front of the bay
          if (rng.chance(0.55)) {
            const f = pt(a + rng.float(-0.8, 0.8), c + side * 2.1);
            plan.loot(f.x, f.z, 0);
          }
        }
      }
      aisles.push(c);
    }
    // aisle centres: between runs and outside them
    const aisleCs = runs.length === 2 ? [2.1, 8, 13.9] : [2.3, 9.4];
    for (const c of aisleCs)
      for (let a = 2.5; a < 14; a += 2.8) {
        const p = pt(a, c);
        plan.highbay(p.x, p.z, { power: 1.15, flicker: rng.chance(0.15), dead: rng.chance(0.1), drop: 1.6 });
        if (rng.chance(0.25)) plan.loot(p.x + rng.float(-0.6, 0.6), p.z + rng.float(-0.4, 0.4), 0);
      }
    // a few pallets and drums against the walls
    for (let k = 0; k < 3; k++) {
      const p = pt(rng.float(2, 14), rng.pick([1.2, 14.8]));
      if (!clearOfDoors(plan, p.x - 0.7, p.z - 0.7, p.x + 0.7, p.z + 0.7, 2)) continue;
      if (rng.chance(0.5)) plan.prop('pallet', p.x, p.z, alongX ? 0 : Math.PI / 2, { load: true });
      else plan.prop('oilDrum', p.x, p.z, 0, { mat: rng.pick(['oxblood', 'steelPaint']) });
    }
    plan.loot(1.3, 1.3, 0);
    plan.loot(14.7, 14.7, 0);
    if (rng.chance(0.5)) plan.prop('sign', 8, 0.5, 0, { text: 'ALL STOCK IS COUNTED', y: 3.0, w: 2.2, h: 0.14 });
    return plan;
  },

  build() {},

  sounds: { hum: { base: 50, buzz: 0.3, level: 0.6, hvac: 0.7 }, room: 'large', ambience: ['rackCreak', 'drip', 'ventTick'] },
};
