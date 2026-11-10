// THE LOBBY: front desk, key board with too many keys still hanging, a clock with no hands.

import { rngFor } from '../../core/rng.js';
import { DIRS } from '../constants.js';
import { wallPoint, freeSpans, placeLore, hitsDoor } from '../kit.js';

export default {
  id: 'lobby',
  name: 'The Lobby',
  weight: 0.5,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    plan.ambient = [0.028, 0.026, 0.02];
    const hall = plan.zone({ name: 'lobby', ceil: 3.4, floor: 'terrazzo', wall: 'wainscot', ceilMat: 'acoustic' });
    plan.fill(1, 1, 30, 30, hall);

    // four square columns
    for (const [i, j] of [[9, 9], [21, 9], [9, 21], [21, 21]]) plan.fill(i, j, i + 1, j + 1, 0);

    // desk wall: a wall whose middle is free of doors, else any
    const order = rng.shuffle([...DIRS]);
    let deskWall = order.find((d) => !plan.doors[d]) || order.find((d) => !hitsDoor(plan, d, 5.5, 10.5, 0.5)) || order[0];
    let deskAt = 8;
    if (hitsDoor(plan, deskWall, deskAt - 2.4, deskAt + 2.4, 0.4)) {
      deskAt = hitsDoor(plan, deskWall, 2.6, 7.4, 0.4) ? 11 : 5;
    }
    const desk = wallPoint(deskWall, deskAt, 1.75);
    plan.prop('deskCounter', desk.x, desk.z, desk.rot, { len: 4 });
    const kb = wallPoint(deskWall, deskAt, 0);
    plan.prop('keyBoard', kb.x, kb.z, kb.rot, { w: 2.2 });
    plan.prop('sign', kb.x, kb.z, kb.rot, { text: 'MERIDIAN LODGE', y: 2.55, w: 2.6, h: 0.26 });
    const ring = wallPoint(deskWall, deskAt + 1.1, 2.3);
    plan.interactions.push({ type: 'ringBell', x: ring.x, y: 1.1, z: ring.z, radius: 1.4, prompt: 'Ring the bell' });
    plan.point('desk', desk.x, desk.z, { rot: desk.rot, wall: deskWall });
    for (const off of [-1.2, 1.2]) {
      const pp = wallPoint(deskWall, deskAt + off, 1.9);
      plan.prop('pendant', pp.x, pp.z, 0, { ceil: 3.4, drop: 1.25, power: 2.0 });
    }
    const lampAt = wallPoint(deskWall, deskAt - 1.6, 1.6);
    plan.prop('tableLamp', lampAt.x, lampAt.z, 0, { y: 1.06, power: 0.6 });

    // clock on another wall
    const clockWall = order.find((d) => d !== deskWall && !hitsDoor(plan, d, 7, 9)) || order[1];
    const cp = wallPoint(clockWall, 8);
    plan.prop('clock', cp.x, cp.z, cp.rot, { y: 2.55 });

    // windows with drawn blinds on a free wall
    const winWall = order.find((d) => d !== deskWall && d !== clockWall) || order[2];
    for (const [a, b] of freeSpans(plan, winWall, 1.5, 14.5, 0.6)) {
      for (let x = a + 1.1; x + 1.1 <= b; x += 2.6) {
        const wp = wallPoint(winWall, x);
        plan.prop('window', wp.x, wp.z, wp.rot, { w: 1.7, h: 1.6, y: 0.85, power: 0.6 });
      }
    }

    // seating island in the middle, on a rust rug
    plan.paintFloor(11, 12, 20, 19, 'carpetRust');
    plan.prop('sofa', 8, 6.6 + 0.1, 0, { w: 2.0 });
    plan.prop('sofa', 8, 9.4, Math.PI, { w: 2.0 });
    plan.prop('coffeeTable', 8, 8, 0, { w: 1.3, d: 0.65 });
    plan.prop('chair', 6.2, 8, Math.PI / 2);
    plan.prop('chair', 9.8, 8, -Math.PI / 2, { mat: 'vinylBrown' });
    plan.prop('ashtray', 10.3, 6.4, 0);

    // plants by the columns
    for (const [x, z] of [[4.1, 4.1], [11.9, 4.1], [4.1, 11.9], [11.9, 11.9]]) {
      if (rng.chance(0.7)) plan.prop('plant', x, z, rng.float(0, 6));
    }

    // sconces on walls, skipping doors
    for (const d of DIRS) {
      if (d === deskWall) continue;
      for (const along of [3, 13]) {
        if (hitsDoor(plan, d, along - 0.4, along + 0.4)) continue;
        if (d === winWall) continue;
        const sp = wallPoint(d, along);
        plan.prop('sconce', sp.x, sp.z, sp.rot, { y: 2.0, flicker: rng.chance(0.15) });
      }
    }

    plan.troffers(1.5, 1.5, 14.5, 14.5, { spacing: 2.6, rng, flickerChance: 0.12, skipChance: 0.08, power: 1.05 });
    placeLore(plan);
    plan.point('spawn', 8, 11.5, { yaw: Math.PI });
    plan.point('resident', 8, 9.4);
    return plan;
  },

  build(scene, rng) {
    // all geometry comes from props and the shell; nothing extra here
    void scene;
    void rng;
  },

  interactions: {
    ringBell(m) {
      m.sound('deskBell', m.at);
      m.after(2.2, () => m.caption(m.pick(['Nobody comes.', 'Somewhere far off, another bell answers.', 'The keys on the board sway, just slightly.']), 3));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.35, level: 0.8 }, room: 'large', ambience: ['elevatorChime', 'distantPhone', 'hvac'] },

  card: {
    title: 'The Lobby',
    blurb: 'A front desk that still takes reservations. Ring for service.',
  },
};
