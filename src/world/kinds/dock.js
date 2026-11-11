// CARGO AIRLOCK: the receiving bay just inside the craft's airlock. High deckhead, deck plate,
// cargo shutters on the hull side, pallets left where the last shift put them down, and the
// clock station by the airlock, every card still in the IN column.

import { rngFor } from '../../core/rng.js';
import { clearOfDoors, clearAround, hitsDoor } from '../kit.js';

export default {
  id: 'dock',
  name: 'Cargo Airlock',
  weight: 0,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const room = plan.zone({ name: 'dock', ceil: 5.2, floor: 'sealedConcrete', wall: 'paintBlock', ceilMat: 'deckSteel' });
    plan.fill(1, 1, 30, 30, room);
    plan.ambient = [0.022, 0.024, 0.026];

    // hull side (south, toward the docking deck): the shutter matching the one outside, the clock station by the door
    plan.prop('rollerShutter', 12.4, 15.5, Math.PI, { w: 2.8, h: 3.4 });
    plan.prop('clockStation', 4.0, 15.5, Math.PI);
    plan.prop('sign', 4.0, 15.5, Math.PI, { text: 'CLOCK IN  -  CLOCK OUT', y: 2.1, w: 1.6, h: 0.1 });
    for (const z of [12.5, 5.5]) {
      if (hitsDoor(plan, 'W', z - 0.8, z + 0.8)) continue;
      plan.prop('noticeboard', 0.5, z, Math.PI / 2, { w: 1.4 });
      break;
    }
    plan.prop('exitSign', 7.75, 15.5, Math.PI, { y: 2.3 });
    plan.interactions.push({ type: 'cards', x: 4.0, y: 1.3, z: 15.0, radius: 1.4, prompt: 'Look at the time cards' });

    // the goods-in desk near the door
    plan.prop('desk', 4.4, 12.3, 0, { w: 1.5, papers: true });
    plan.prop('officeChair', 4.2, 13.1, Math.PI + 0.4);
    plan.loot(4.0, 12.25, 0.75);
    plan.loot(4.9, 12.35, 0.75);

    // pallets set down in loose lanes, never across a door
    const lanes = [];
    for (let z = 3; z <= 10.5; z += 2.2) for (let x = 2.4; x <= 13.6; x += 1.7) lanes.push([x + rng.float(-0.2, 0.2), z + rng.float(-0.3, 0.3)]);
    rng.shuffle(lanes);
    let placed = 0;
    for (const [x, z] of lanes) {
      if (placed >= 9) break;
      if (!clearOfDoors(plan, x - 0.8, z - 0.7, x + 0.8, z + 0.7, 2.2)) continue;
      if (!clearAround(plan, x, z, 0.7)) continue;
      const rot = rng.chance(0.8) ? (rng.chance(0.5) ? 0 : Math.PI / 2) + rng.float(-0.08, 0.08) : rng.float(0, 3);
      const kind = rng.next();
      if (kind < 0.6) plan.prop('pallet', x, z, rot, { load: true, tall: rng.chance(0.3) });
      else if (kind < 0.8) plan.prop('crate', x, z, rot, { stack: true });
      else {
        plan.prop('pallet', x, z, rot, { load: false });
        plan.loot(x + rng.float(-0.25, 0.25), z + rng.float(-0.2, 0.2), 0.13);
      }
      plan.block(x - 0.7, z - 0.6, x + 0.7, z + 0.6);
      placed++;
      if (rng.chance(0.55)) plan.loot(x + (rng.chance(0.5) ? 1 : -1) * 0.95, z + rng.float(-0.4, 0.4), 0);
    }
    // more spots along the walls
    for (const [x, z] of [[1.2, 4], [1.2, 8], [14.8, 6], [14.8, 10], [8, 1.2], [11, 1.2]]) if (clearOfDoors(plan, x - 0.3, z - 0.3, x + 0.3, z + 0.3, 1.2)) plan.loot(x, z, 0);

    // high-bays over the floor; one bank on the emergency circuit flickers
    for (let x = 3; x < 15; x += 5)
      for (let z = 3; z < 15; z += 5) plan.highbay(x + 0.2, z, { power: 1.25, flicker: rng.chance(0.18), dead: rng.chance(0.08) });
    plan.prop('wallPack', 7.75, 15.5, Math.PI, { y: 2.85, power: 1.2 });
    return plan;
  },

  build() {},

  interactions: {
    cards(m) {
      m.sound('click', m.at);
      m.after(0.5, () => m.caption('Every card is in the IN column. Clocked in 21:00, 9 November. None of them clocked out.', 5));
    },
  },

  sounds: { hum: { base: 50, buzz: 0.35, level: 0.7, hvac: 0.5 }, room: 'large', ambience: ['shutterRattle', 'drip', 'ventTick'] },
};
