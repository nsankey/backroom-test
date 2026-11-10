// LINEN & LAUNDRY: painted block, a concrete floor with a drain, rows of coin-op machines, a few
// dryers still turning. The building's main panel is down here. Every breaker is thrown.

import { rngFor } from '../../core/rng.js';
import { TILE, CELL } from '../constants.js';
import { mainAxis, axisFrame, corridorWallSlots, spaced, placeLore } from '../kit.js';

export default {
  id: 'laundry',
  name: 'Linen & Laundry',
  weight: 0.9,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const axis = mainAxis(plan, rng);
    const f = axisFrame(axis);
    plan.ambient = [0.02, 0.022, 0.02];
    const room = plan.zone({ name: 'laundry', ceil: 2.75, floor: 'concrete', wall: 'paintGrey', ceilMat: 'acoustic' });
    const c0 = 9 + rng.int(-1, 1);
    const c1 = c0 + 13;
    f.fill(plan, 2, c0, 29, c1, room);
    plan.connectDoors(f.tile(16, (c0 + c1) >> 1), 3, room);

    // washers along one long wall, dryers along the other (backs to solid wall only)
    const slots = corridorWallSlots(plan, f, c0, c1, { width: 0.72, depth: 2, from: 1.6, to: CELL - 1.6 });
    const dryersOn = rng.pick(['lo', 'hi']);
    for (const s of spaced(slots, 0.74, rng, 0.06)) {
      const inward = s.side === 'lo' ? 0.36 : -0.36;
      const across = (s.side === 'lo' ? c0 : c1 + 1) * TILE + inward;
      const p = f.pt(s.along, across);
      const dryer = s.side === dryersOn;
      plan.prop('washer', p.x, p.z, s.rot, { dryer, on: dryer && rng.chance(0.45) });
    }

    // folding tables and carts down the middle
    const midC = (c0 + c1 + 1) * 0.5 * TILE;
    for (const a of [4.5, 11.2]) {
      const p = f.pt(a + rng.float(-0.3, 0.3), midC);
      plan.prop('foldingTable', p.x, p.z, f.rotFwd + Math.PI / 2, { w: 2.0 });
    }
    const cp = f.pt(8, midC + rng.pick([-1.6, 1.6]));
    plan.prop('cart', cp.x, cp.z, f.rotFwd + rng.float(-0.4, 0.4));
    plan.interactions.push({ type: 'dryer', ...pick(slots, dryersOn, f, c0, c1), y: 0.6, radius: 1.5, prompt: 'Open a dryer' });

    // the main panel on an end wall that is solid
    const endWall = (a) => {
      for (let c = ((c0 + c1) >> 1) - 2; c <= ((c0 + c1) >> 1) + 3; c++) {
        const [i, j] = f.tile(a, c);
        if (plan.isFloor(i, j)) return false;
      }
      return true;
    };
    let panel = null;
    if (endWall(1)) panel = { along: 2 * TILE, rot: f.rotFwd };
    else if (endWall(30)) panel = { along: 30 * TILE, rot: f.rotBack };
    if (panel) {
      const p = f.pt(panel.along, midC - 0.3);
      plan.prop('breakerPanel', p.x, p.z, panel.rot, {});
      plan.prop('sign', p.x, p.z, panel.rot, { text: 'NO ONE IS TO TURN OFF THE LIGHTS', y: 2.35, w: 2.4, h: 0.12, boardMat: 'paperTag' });
      const ip = f.pt(panel.along + (panel.rot === f.rotFwd ? 1 : -1), midC - 0.1);
      plan.interactions.push({ type: 'breakers', x: ip.x, y: 1.3, z: ip.z, radius: 1.5, prompt: 'Look at the panel' });
    }

    // staff sign by the first slot and a shelf of linen
    const sh = slots.find((s) => s.side !== dryersOn && s.along > 12);
    if (sh) {
      const p = f.pt(sh.along, (sh.side === 'lo' ? c0 : c1 + 1) * TILE);
      plan.prop('sign', p.x, p.z, sh.rot, { text: 'LAUNDRY', y: 2.2, w: 1.1, h: 0.14 });
    }

    // bare troffers in two rows
    for (let a = 2.4; a < 15; a += 2.6)
      for (const off of [-1.7, 1.7]) {
        const p = f.pt(a, midC + off);
        if (plan.isFloor(Math.floor(p.x / TILE), Math.floor(p.z / TILE)) && !rng.chance(0.1))
          plan.troffer(p.x, p.z, { power: 0.85, flicker: rng.chance(0.2), rot: axis === 'x' ? 0 : Math.PI / 2 });
      }
    plan.fillDarkGaps([room], { gap: 4.2, power: 0.6, rng });

    placeLore(plan);
    const rp = f.pt(8, midC + 1.2);
    plan.point('resident', rp.x, rp.z, { yaw: f.rotFwd });
    plan.point('spawn', rp.x, rp.z);
    return plan;
  },

  build() {},

  interactions: {
    dryer(m) {
      m.sound('doorClose', m.at);
      m.after(0.7, () => m.caption(m.pick(['Warm. Someone\'s clothes, still turning, though nothing is plugged in.', 'A Lodge watch rattles around the drum. No hands.', 'Bed linen, warm and folded, as if it had been waiting for you.']), 4.5));
    },
    breakers(m) {
      m.sound('click', m.at);
      m.after(0.6, () => m.caption('Every breaker on the panel is thrown to OFF. A red tag hangs from the meter. The disc is still turning.', 6));
    },
  },

  sounds: { hum: { base: 50, buzz: 0.45, level: 0.8, hvac: 0.8 }, room: 'medium', ambience: ['cartRattle', 'hvac', 'knockFar'] },

  card: {
    title: 'Linen & Laundry',
    blurb: 'Coin-op machines, warm linen, and the main panel. Every breaker is off. The meter keeps turning.',
  },
};

/** A dryer to interact with: the middle slot on the dryer side, in cell coordinates. */
function pick(slots, side, f, c0, c1) {
  const mine = slots.filter((s) => s.side === side);
  const s = mine[Math.floor(mine.length / 2)] || slots[0] || { along: 8 };
  const across = side === 'lo' ? c0 * TILE + 1.0 : (c1 + 1) * TILE - 1.0;
  const p = f.pt(s.along, across);
  return { x: p.x, z: p.z };
}
