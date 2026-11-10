// THE DRAFTING ROOM: the night architect's office. Rows of drawing boards under clamp lamps,
// flat files of plans, and the walls papered with floor plans that do not agree with each other.
// A private office in the corner where Desmond Hale kept redrawing the building.

import { rngFor } from '../../core/rng.js';
import { N, TILE, CELL } from '../constants.js';
import { placeLore, hitsDoor } from '../kit.js';

export default {
  id: 'draftingOffice',
  name: 'The Drafting Room',
  weight: 0.6,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    // mirror the layout so the private office lands in any corner
    const fx = rng.chance(0.5);
    const fz = rng.chance(0.5);
    const I = (i) => (fx ? N - 1 - i : i);
    const J = (j) => (fz ? N - 1 - j : j);
    const X = (x) => (fx ? CELL - x : x);
    const Z = (z) => (fz ? CELL - z : z);
    const R = (r) => {
      let o = r;
      if (fx) o = -o;
      if (fz) o = Math.PI - o;
      return o;
    };
    const F = (i0, j0, i1, j1, zone) => plan.fill(I(i0), J(j0), I(i1), J(j1), zone);
    const prop = (type, x, z, r, p) => plan.prop(type, X(x), Z(z), R(r), p);

    plan.ambient = [0.022, 0.022, 0.024];
    const room = plan.zone({ name: 'drafting', ceil: 2.7, floor: 'carpetBlue', wall: 'paintCream', ceilMat: 'acoustic' });
    const office = plan.zone({ name: 'office', ceil: 2.55, floor: 'carpetGold', wall: 'wainscot', ceilMat: 'acoustic' });
    // drafting room: x 1..10.5, z 1..15 ; office: x 11..15, z 1..6.5
    F(2, 2, 20, 29, room);
    F(22, 2, 29, 12, office);
    plan.doorway(I(21), J(9), I(21), J(10));
    plan.connectDoors([I(11), J(16)], 3, room);

    // drawing boards in rows, all facing the same way, every lamp on
    let boards = 0;
    for (const z of [3.6, 6.8, 10.0, 13.0])
      for (const x of [2.6, 5.6, 8.6]) {
        const ti = I(Math.floor(x / TILE));
        const tj = J(Math.floor(z / TILE));
        if (!plan.isFloor(ti, tj) || rng.chance(0.1)) continue;
        // keep clear of carved door paths: only on tiles still the room zone with room around
        let clear = true;
        for (let dj = -2; dj <= 2 && clear; dj++)
          for (let di = -3; di <= 3 && clear; di++) if (!plan.isFloor(ti + di, tj + dj)) clear = false;
        if (!clear) continue;
        prop('draftingTable', x, z, 0, { power: 0.75 });
        prop('officeChair', x + rng.float(-0.3, 0.3), z + 0.85, Math.PI + rng.float(-0.5, 0.5), {});
        if (boards++ === 2) plan.interactions.push({ type: 'board', x: X(x), y: 1.0, z: Z(z + 0.6), radius: 1.5, prompt: 'Look at the plan' });
      }

    // plans pinned along the long wall, overlapping, more of them than there is wall
    for (let z = 2.0; z < 14.5; z += 0.95) {
      const tj = J(Math.floor(z / TILE));
      if (plan.isFloor(I(1), tj)) continue; // a doorway there
      prop('pinnedPlan', 1.0, z, Math.PI / 2, { y: 1.05 + rng.float(-0.15, 0.25), w: 0.8, h: 0.6 });
      if (rng.chance(0.5)) prop('pinnedPlan', 1.0, z + 0.4, Math.PI / 2, { y: 1.75 + rng.float(-0.1, 0.15), w: 0.7, h: 0.5, layer: 1 });
    }
    // flat files against the far wall, wherever that wall has no doorway behind them
    const farWall = fz ? 'N' : 'S';
    let files = 0;
    for (const x of [9.6, 8.0, 6.4, 4.8, 3.2]) {
      if (files >= 2) break;
      if (hitsDoor(plan, farWall, X(x) - 0.75, X(x) + 0.75, 1.2)) continue;
      prop('flatFile', x, 14.5, Math.PI, { w: 1.4 });
      files++;
    }
    prop('sign', 10.5, 1.0, 0, { text: 'DRAFTING', y: 2.2, w: 1.2, h: 0.15 });

    // Hale's office: desk facing the door, filing cabinets, a lamp left on, plans on the floor
    prop('desk', 13.4, 3.4, Math.PI, { w: 1.5, papers: true });
    prop('officeChair', 13.4, 2.5, 0, {});
    prop('tableLamp', 13.9, 3.6, 0, { y: 0.74, power: 0.7 });
    prop('filing', 14.75, 5.2, -Math.PI / 2, {});
    prop('filing', 14.75, 5.75, -Math.PI / 2, {});
    prop('pinnedPlan', 15.0, 3.2, -Math.PI / 2, { y: 1.2, w: 1.1, h: 0.8 });
    for (let k = 0; k < 4; k++) prop('paperStack', 11.8 + rng.float(0, 1.6), 4.8 + rng.float(0, 1.2), 0, { y: 0.005, r: rng.float(0, 3) });
    plan.interactions.push({ type: 'halesDesk', x: X(13.4), y: 0.9, z: Z(4.2), radius: 1.4, prompt: 'Look at the desk' });

    // light: rows of troffers, the office dimmer
    for (const z of [2.6, 5.4, 8.2, 11.0, 13.8])
      for (const x of [3.0, 7.6]) plan.troffer(X(x), Z(z), { power: 0.8, flicker: rng.chance(0.15), rot: Math.PI / 2 });
    plan.troffer(X(13.0), Z(4.4), { power: 0.5, flicker: true });
    plan.fillDarkGaps([room], { gap: 4.2, power: 0.6, rng });

    placeLore(plan);
    plan.point('resident', X(6.0), Z(8.4), { yaw: R(0) });
    plan.point('spawn', X(6.0), Z(8.4));
    return plan;
  },

  build() {},

  interactions: {
    board(m) {
      m.sound('paper', m.at);
      m.after(0.5, () => m.caption(m.pick(['The plan on the board is of this room. In one corner, someone has started drawing a figure standing exactly where you are.', 'A corridor drawn in ink, then rubbed out, then drawn again a little longer.', 'Room numbers in pencil: 240, 241, 242. None of them are on the other sheets.']), 6));
    },
    halesDesk(m) {
      m.sound('paper', m.at);
      m.after(0.5, () => m.caption(m.pick(['A ruler, a pencil worn to a stub, and a page with one word written over and over: "AGAIN".', 'Under the blotter: a Lodge watch with no hands, and a note, "D.H. - for the hours you put in."']), 6));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.2, level: 0.55, hvac: 0.5 }, room: 'medium', ambience: ['paper', 'distantPhone', 'knockFar'] },

  card: {
    title: 'The Drafting Room',
    blurb: 'Drawing boards under clamp lamps. Every wall papered with floor plans that disagree with each other.',
  },
};
