// THE STARLIGHT BALLROOM: parquet, flocked red walls, chandeliers, banquet rounds laid for a
// welcome dinner that is always about to start. The band left their stands. The music didn't.

import { rngFor } from '../../core/rng.js';
import { DIRS, TILE, CELL } from '../constants.js';
import { wallPoint, freeSpans, placeLore, hitsDoor } from '../kit.js';

const CEIL = 4.2;

export default {
  id: 'ballroom',
  name: 'The Starlight Ballroom',
  weight: 0.7,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    plan.ambient = [0.03, 0.022, 0.016];
    const room = plan.zone({ name: 'ballroom', ceil: CEIL, floor: 'parquet', wall: 'flockRed', ceilMat: 'plasterWarm' });
    plan.fill(2, 2, 29, 29, room);
    plan.connectDoors([16, 16], 3, room);
    // a rust carpet border around the dance floor
    plan.paintFloor(2, 2, 29, 4, 'carpetRust');
    plan.paintFloor(2, 27, 29, 29, 'carpetRust');
    plan.paintFloor(2, 5, 4, 26, 'carpetRust');
    plan.paintFloor(27, 5, 29, 26, 'carpetRust');

    // the bandstand against the wall with the most free length
    let stageWall = null;
    let best = 0;
    let stageAt = 8;
    for (const d of rng.shuffle([...DIRS])) {
      for (const [a, b] of freeSpans(plan, d, 1.5, CELL - 1.5, 0.6)) {
        if (b - a > best) {
          best = b - a;
          stageWall = d;
          stageAt = (a + b) / 2;
        }
      }
    }
    const stageW = Math.min(5, Math.max(3, best - 1));
    const sp = wallPoint(stageWall, stageAt, 0.5 + 1.1);
    plan.prop('stage', sp.x, sp.z, sp.rot, { w: stageW, d: 2.2 });
    const banner = wallPoint(stageWall, stageAt, 0.5);
    plan.prop('sign', banner.x, banner.z, banner.rot, { text: 'CHECK-OUT IS AT NOON', y: 3.35, w: 3.2, h: 0.2, boardMat: 'brass' });
    plan.point('muzak', sp.x, sp.z);
    const stageLit = [sp.x, sp.z];
    const mic = wallPoint(stageWall, stageAt + 0.3, 0.5 + 2.6);
    plan.interactions.push({ type: 'microphone', x: mic.x, y: 1.4, z: mic.z, radius: 1.6, prompt: 'Tap the microphone' });

    // banquet rounds in a ring around the dance floor, clear of the door paths and the stage
    const doorPts = DIRS.filter((d) => plan.doors[d]).map((d) => {
      const door = plan.doors[d];
      const mid = (door.mid + 0.5) * TILE;
      return d === 'N' ? { x: mid, z: 0 } : d === 'S' ? { x: mid, z: CELL } : d === 'W' ? { x: 0, z: mid } : { x: CELL, z: mid };
    });
    const distToSeg = (px, pz, a, b) => {
      const vx = b.x - a.x;
      const vz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
      return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
    };
    const center = { x: 8, z: 8 };
    let tables = 0;
    for (const x of [3.6, 6.8, 9.2, 12.4])
      for (const z of [3.6, 6.8, 9.2, 12.4]) {
        if (Math.hypot(x - 8, z - 8) < 3) continue; // the dance floor
        if (Math.hypot(x - sp.x, z - sp.z) < 3.6) continue;
        if (doorPts.some((d) => distToSeg(x, z, d, center) < 2.1)) continue;
        if (rng.chance(0.12)) continue;
        plan.prop('roundTable', x + rng.float(-0.2, 0.2), z + rng.float(-0.2, 0.2), rng.float(0, 6.28), { r: 0.72, seats: rng.pick([5, 6, 6, 7]) });
        if (tables++ === 1) plan.interactions.push({ type: 'placeCard', x, y: 0.9, z, radius: 1.9, prompt: 'Read a place card' });
      }

    // chandeliers over the floor and the tables
    const lit = [[8, 8], stageLit];
    plan.prop('chandelier', 8, 8, 0, { ceil: CEIL, drop: 1.2, power: 2.6, R: 0.7, tiers: 2 });
    for (const [x, z] of [[4.2, 4.2], [11.8, 4.2], [4.2, 11.8], [11.8, 11.8]]) {
      plan.prop('chandelier', x, z, 0, { ceil: CEIL, drop: 1.0, power: 1.8, flicker: rng.chance(0.2) });
      lit.push([x, z]);
    }

    // sconces between, skipping doors and the stage wall
    for (const d of DIRS) {
      if (d === stageWall) continue;
      for (const along of [4, 8, 12]) {
        if (hitsDoor(plan, d, along - 0.5, along + 0.5)) continue;
        const w = wallPoint(d, along, 0.5);
        plan.prop('sconce', w.x, w.z, w.rot, { y: 2.3, power: 0.9, flicker: rng.chance(0.1) });
        lit.push([w.x, w.z]);
      }
    }
    // only the door passages can be left without a fixture; the room itself is lit by its own lamps
    plan.fillDarkGaps([room], { gap: 5.5, power: 0.5, rng, extra: lit });

    placeLore(plan);
    plan.point('resident', 8 + rng.float(-1, 1), 8 + rng.float(-1, 1), { yaw: rng.float(0, 6.28) });
    plan.point('spawn', 8, 8);
    return plan;
  },

  build() {},

  interactions: {
    placeCard(m) {
      m.sound('paper', m.at);
      m.caption(
        m.pick([
          'The place card has your name on it, in a careful hand. The ink is still wet.',
          'Every card at this table says "GUEST". One says "STAFF", and the chair is pulled out.',
          'Table 9. Welcome, Continuous Habitation volunteers! Dinner will be served shortly.',
        ]),
        5,
      );
    },
    microphone(m) {
      m.sound('click', m.at);
      m.after(0.9, () => m.sound('knockFar', m.at));
      m.after(1.6, () => m.caption(m.pick(['You tap the microphone. A speaker somewhere else in the building taps back.', 'Feedback, then a voice, very far away: "...and please welcome our newest guests..."']), 5));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.15, level: 0.45, hvac: 0.4 }, room: 'large', ambience: ['elevatorChime', 'distantPhone'] },

  card: {
    title: 'The Starlight Ballroom',
    blurb: 'Tables laid for a welcome dinner. Chandeliers lit. The band left their stands, but the music stayed.',
  },
};
