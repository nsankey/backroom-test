// GUEST ROOMS: a short hall with rooms you can walk into. Beds made, lamps on, the television
// showing snow to nobody. Every window has its blinds drawn against a light that never sets.

import { rngFor, hash } from '../../core/rng.js';
import { TILE } from '../constants.js';
import { mainAxis, axisFrame, placeLore } from '../kit.js';

export default {
  id: 'guestRooms',
  name: 'Occupied Rooms',
  weight: 2,

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    const axis = mainAxis(plan, rng);
    const f = axisFrame(axis);
    plan.ambient = [0.02, 0.019, 0.016];
    const hall = plan.zone({ name: 'hall', ceil: 2.5, floor: 'carpetGold', wall: 'wallpaperStripe', ceilMat: 'acoustic' });
    const c0 = 14 + rng.int(-1, 1);
    const c1 = c0 + 2;
    f.fill(plan, 1, c0, 30, c1, hall);
    // branches to the other doors first; rooms then only go where no branch runs
    plan.connectDoors(f.tile(15, c0 + 1), 3, hall);

    // rooms on both sides: three per side, split by one-tile partitions
    const spans = [[1, 9], [11, 20], [22, 30]];
    const rooms = [];
    let num = 100 * (1 + (hash(seed, 'floor') % 4)) + (hash(seed, 'n') % 30);
    for (const side of ['lo', 'hi']) {
      for (const [a0, a1] of spans) {
        if (rng.chance(0.18)) continue; // a room that isn't there: solid wall
        const b0 = side === 'lo' ? 1 : c1 + 2;
        const b1 = side === 'lo' ? c0 - 2 : 30;
        // skip if a branch corridor already passes through (or right beside) this footprint
        let crossed = false;
        for (let a = a0 - 1; a <= a1 + 1 && !crossed; a++)
          for (let b = b0 - 1; b <= b1 + 1 && !crossed; b++) {
            if (b >= c0 && b <= c1) continue;
            const [ti, tj] = f.tile(a, b);
            if (plan.isFloor(ti, tj)) crossed = true;
          }
        if (crossed) continue;
        const carpet = rng.pick(['carpetRust', 'carpetBlue', 'carpetAvocado']);
        const paper = rng.pick(['wallpaperOval', 'wallpaperStripe']);
        const z = plan.zone({ name: 'room', ceil: 2.45, floor: carpet, wall: paper, ceilMat: 'acoustic' });
        f.fill(plan, a0, b0, a1, b1, z);
        // doorway through the hall wall near the far end of the room
        const da = a1 - 3;
        const wallC = side === 'lo' ? c0 - 1 : c1 + 1;
        const [di0, dj0] = f.tile(da, wallC);
        const [di1, dj1] = f.tile(da + 1, wallC);
        plan.doorway(di0, dj0, di1, dj1);
        rooms.push({ side, a0, a1, b0, b1, num: (num += rng.int(1, 3)), da });
      }
    }

    for (const r of rooms) furnish(plan, f, r, rng);

    // hall lighting
    const mid = (c0 + c1 + 1) * 0.5 * TILE;
    for (let a = 2; a < 15; a += 3.4) {
      const p = f.pt(a, mid);
      if (plan.isFloor(Math.floor(p.x / TILE), Math.floor(p.z / TILE)) && !rng.chance(0.2))
        plan.troffer(p.x, p.z, { flicker: rng.chance(0.25), power: 0.7, rot: axis === 'x' ? 0 : Math.PI / 2 });
    }
    placeLore(plan);
    plan.point('hall', 0, 0, { axis, c0, c1 });
    const p = f.pt(8, mid);
    plan.point('resident', p.x, p.z);
    return plan;
  },

  build() {},

  interactions: {
    tv(m) {
      m.sound('click', m.at);
      m.after(0.4, () => m.caption(m.pick(['The knob turns, but the snow stays on.', 'Off. On again by itself.', 'Under the static, a test pattern you almost recognize.']), 3.5));
    },
    sitBed(m) {
      m.sit(m.at);
      m.after(1.2, () => m.caption(m.pick(['The bedspread is warm, like someone just got up.', 'The mattress remembers a shape that is not yours.', 'You could rest here. You do not feel tired.']), 4));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.2, level: 0.5, hvac: 0.6 }, room: 'small', ambience: ['tvStaticBurst', 'distantPhone'] },

  card: {
    title: 'Occupied Rooms',
    blurb: 'Beds turned down. Lamps on. The TV left on for somebody who is coming right back.',
  },
};

function furnish(plan, f, r, rng) {
  const T = TILE;
  const lo = r.side === 'lo';
  const aMin = r.a0 * T;
  const aMax = (r.a1 + 1) * T;
  const back = lo ? r.b0 * T : (r.b1 + 1) * T; // the outer wall
  const hallWall = lo ? (r.b1 + 1) * T : r.b0 * T;
  const inward = lo ? 1 : -1; // from the back wall toward the hall
  const depth = Math.abs(hallWall - back);
  const midB = back + inward * depth * 0.45;
  const P = (a, b) => f.pt(a, b);
  const faceIn = lo ? f.rotLo : f.rotHi;

  // window on the back wall
  let p = P((aMin + aMax) / 2, back);
  plan.prop('window', p.x, p.z, faceIn, { w: 1.5, h: 1.3, y: 0.9, power: 0.75 });

  // bed with its head against the near partition
  p = P(aMin, midB);
  plan.prop('bed', p.x, p.z, f.rotFwd, { w: 1.4, cover: rng.pick(['fabricFloral', 'fabricFloral', 'fabricOrange']) });
  for (const s of [-1, 1]) {
    p = P(aMin + 0.26, midB + s * 1.0);
    plan.prop('nightstand', p.x, p.z, f.rotFwd, { lamp: s === 1 || rng.chance(0.5), power: 0.8 });
  }
  // dresser + TV facing the bed from the far partition
  p = P(aMax - 0.26, midB);
  const tvOn = rng.chance(0.7);
  plan.prop('dresser', p.x, p.z, f.rotBack, { w: 1.5, tv: true, static: tvOn, tvX: 0.25 });
  const tvp = P(aMax - 0.6, midB);
  plan.interactions.push({ type: 'tv', x: tvp.x, y: 1.0, z: tvp.z, radius: 1.7, prompt: 'Turn off the TV' });
  // sitting spot on the foot of the bed
  const sp = P(aMin + 1.75, midB);
  plan.interactions.push({ type: 'sitBed', x: sp.x, y: 0.6, z: sp.z, radius: 1.3, prompt: 'Sit on the bed' });
  // armchair in the window corner
  if (rng.chance(0.7)) {
    p = P(aMax - 0.6, back + inward * 0.75);
    plan.prop('chair', p.x, p.z, f.rotBack - inward * 0.6, { mat: 'vinylBrown' });
  }
  if (rng.chance(0.3)) {
    p = P(aMin + 2.6, hallWall - inward * 0.45);
    plan.prop('cardboardBox', p.x, p.z, faceIn, { s: 0.42 });
  }
}
