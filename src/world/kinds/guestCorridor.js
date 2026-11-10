// THE GUEST WING: a long hall of numbered doors that never open. Gold carpet, striped paper.

import { rngFor, hash } from '../../core/rng.js';
import { TILE } from '../constants.js';
import { mainAxis, axisFrame, corridorWallSlots, spaced, placeLore } from '../kit.js';

export default {
  id: 'guestCorridor',
  name: 'The Guest Wing',
  weight: 3,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const axis = mainAxis(plan, rng);
    const f = axisFrame(axis);
    const carpet = rng.pick(['carpetGold', 'carpetGold', 'carpetRust', 'carpetAvocado']);
    const paper = rng.pick(['wallpaperStripe', 'wallpaperStripe', 'wallpaperOval']);
    const hall = plan.zone({ name: 'hall', ceil: 2.55, floor: carpet, wall: paper, ceilMat: 'acoustic' });
    plan.ambient = [0.018, 0.02, 0.014];

    // the main hall runs the full width, 2 m wide, through the middle (offset a little)
    const off = rng.int(-3, 3);
    const c0 = 14 + off;
    const c1 = c0 + 3;
    f.fill(plan, 1, c0, 30, c1, hall);
    // branches to doors on the other walls
    plan.connectDoors(f.tile(15, c0 + 1), 3, hall);

    // guest-room doors on both walls
    const slots = corridorWallSlots(plan, f, c0, c1, { width: 1.3, depth: 3 });
    const doors = spaced(slots, 3.4, rng, 0.12);
    const floorNo = 1 + (hash(seed, 'floor') % 4);
    let num = floorNo * 100 + (hash(seed, 'num') % 40);
    const used = [];
    for (const s of doors) {
      num += rng.int(1, 2);
      plan.prop('hotelDoor', s.x, s.z, s.rot, { num, mat: 'woodDoor', hanger: rng.chance(0.15) });
      used.push(s);
      plan.interactions.push({
        type: 'knock',
        x: s.x + Math.sin(s.rot) * 0.6,
        y: 1.3,
        z: s.z + Math.cos(s.rot) * 0.6,
        radius: 1.2,
        prompt: `Knock on ${num}`,
        num,
      });
    }

    // sconces between doors, troffers down the middle
    const free = slots.filter((s) => used.every((u) => u.side !== s.side || Math.abs(u.along - s.along) > 1.3));
    for (const s of spaced(free, 4.2, rng, 0.2)) plan.prop('sconce', s.x, s.z, s.rot, { y: 1.85, flicker: rng.chance(0.12), power: 0.55 });
    const mid = (c0 + c1 + 1) * 0.5 * TILE;
    for (let a = 1.6; a < 15; a += 3.1) {
      const p = f.pt(a, mid);
      const ti = Math.floor(p.x / TILE);
      const tj = Math.floor(p.z / TILE);
      if (!plan.isFloor(ti, tj)) continue;
      if (rng.chance(0.1)) continue; // a dead tube
      plan.troffer(p.x, p.z, { flicker: rng.chance(0.18), power: 0.85, rot: axis === 'x' ? 0 : Math.PI / 2 });
    }

    // things left in the hall
    const extra = free.filter((s) => used.every((u) => u.side !== s.side || Math.abs(u.along - s.along) > 1.8));
    if (extra.length && rng.chance(0.55)) {
      const s = rng.pick(extra);
      const inward = 0.36;
      plan.prop('cart', s.x + Math.sin(s.rot) * inward, s.z + Math.cos(s.rot) * inward, s.rot);
      plan.point('cart', s.x, s.z);
    }
    if (extra.length && rng.chance(0.5)) {
      const s = rng.pick(extra);
      plan.prop('fireExt', s.x, s.z, s.rot);
    }
    // exit signs over the hall ends
    for (const a of [1.2, 14.8]) {
      const p = f.pt(a, c0 * TILE);
      if (rng.chance(0.6)) plan.prop('exitSign', p.x, p.z, f.rotLo, { y: 2.2 });
    }
    if (rng.chance(0.35)) {
      const s = rng.pick(slots);
      if (s) plan.prop('sign', s.x, s.z, s.rot, { text: 'GUEST ROOMS 100-140', y: 2.15, w: 0.9, h: 0.09 });
    }

    placeLore(plan);
    plan.point('resident', ...Object.values(f.pt(8, mid)));
    plan.point('hall', 0, 0, { axis, c0, c1 });
    return plan;
  },

  build() {},

  interactions: {
    knock(m, it) {
      m.sound('knock', m.at);
      const roll = m.pick([0, 0, 0, 1, 2]);
      if (roll === 1) m.after(2.4, () => m.sound('knock', { ...m.at, y: 1.0 }, { muffled: true }));
      else if (roll === 2) m.after(1.8, () => m.caption(`Behind ${it.num}, a television changes channel.`, 3.5));
      else m.after(1.6, () => m.caption(m.pick(['No answer.', 'Nothing. The hum gets a little louder.', 'Somebody inside is holding very still.']), 3));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.45, level: 0.95, hvac: 0.35 }, room: 'corridor', ambience: ['distantPhone', 'elevatorChime', 'knockFar'] },

  card: {
    title: 'The Guest Wing',
    blurb: 'Numbered doors on both sides. None of the numbers repeat. None of the doors open.',
  },
};
