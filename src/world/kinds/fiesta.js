// THE CLOSED MALL: a two-level shopping center from 1979, at true scale, rebuilt from the outline
// of a real one (see src/world/fiesta/). Shut since 2018 with every light still on: dusty
// skylights, a dead fountain, shutters half down, food-court chairs still out.
//
// Unlike other kinds this one is not a whole place in one cell: a mall block reserves many cells,
// and each cell lays out its 16 m slice of the shared plan in mall.js. Walls only stand where the
// plan has them, so the concourse runs on from cell to cell.

import { TILE, CELL, N } from '../constants.js';
import { mallMap, C, UP_Y, LOW_CEIL, SKY_CEIL, UP_CEIL, W, H } from '../fiesta/mall.js';
import { mallBlockAt, MARGIN } from '../fiesta/place.js';
import { hash } from '../../core/rng.js';

// outside a mall block (tests, debug "jump to a kind") show the slice with the directory kiosk
const SAMPLE = [10, 14];

const ZONES = [
  ['lot', { ceil: 16, floor: 'asphalt', wall: 'stucco', ceilMat: 'nightSky' }],
  ['concourse', { ceil: LOW_CEIL, floor: 'mallTile', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['well', { ceil: SKY_CEIL, floor: 'mallTile', wall: 'mallWall', ceilMat: 'skylight' }],
  ['shop', { ceil: 3.6, floor: 'vinylCheck', wall: 'paintCream', ceilMat: 'acoustic' }],
  ['shopfront', { ceil: 3.0, floor: 'threshold', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['entry', { ceil: 3.6, floor: 'mallTile', wall: 'mallWall', ceilMat: 'acoustic' }],
  ['vestibule', { ceil: 3.0, floor: 'threshold', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['escalator', { ceil: SKY_CEIL, floor: 'mallTile', wall: 'mallWall', ceilMat: 'skylight' }],
  ['up-concourse', { ceil: UP_CEIL, floor: 'mallTile', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['up-shop', { ceil: UP_Y + 3.6, floor: 'vinylCheck', wall: 'paintCream', ceilMat: 'acoustic' }],
  ['up-shopfront', { ceil: UP_Y + 3.0, floor: 'threshold', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['food-court', { ceil: UP_Y + 4.5, floor: 'foodTile', wall: 'mallWall', ceilMat: 'mallCeil' }],
  ['food-skylight', { ceil: SKY_CEIL, floor: 'foodTile', wall: 'mallWall', ceilMat: 'skylight' }],
  ['food-stall', { ceil: UP_Y + 3.1, floor: 'whiteTile', wall: 'whiteTile', ceilMat: 'acoustic' }],
  ['up-escalator', { ceil: SKY_CEIL, floor: 'mallTile', wall: 'mallWall', ceilMat: 'skylight', ramp: true }],
  ['service', { ceil: 2.7, floor: 'concrete', wall: 'paintGrey', ceilMat: 'acoustic' }],
];

function makeZones(plan) {
  const z = {};
  for (const [name, def] of ZONES) z[name] = plan.zone({ name, ...def });
  const lower = (code, upper) => {
    switch (code) {
      case C.LOT: return z.lot;
      case C.CONC: return upper && upper !== C.RAMP ? z.concourse : z.well;
      case C.STORE: return z.shop;
      case C.FRONT: return z.shopfront;
      case C.ENTRY: return z.entry;
      case C.VEST: return z.vestibule;
      case C.RAMP: return z.escalator;
      default: return 0;
    }
  };
  const upper = (code) => {
    switch (code) {
      case C.CONC: return z['up-concourse'];
      case C.STORE: return z['up-shop'];
      case C.FRONT: return z['up-shopfront'];
      case C.FOOD: return z['food-court'];
      case C.FOODSKY: return z['food-skylight'];
      case C.STALL: return z['food-stall'];
      case C.RAMP: return z['up-escalator'];
      default: return 0;
    }
  };
  return { z, lower, upper };
}

/** Where a cell sits in its mall block: { lx, lz, sample }. */
function blockCell(plan) {
  const blk = mallBlockAt(plan.worldSeed, plan.cx, plan.cz);
  return blk ? { lx: blk.lx, lz: blk.lz, sample: false } : { lx: SAMPLE[0], lz: SAMPLE[1], sample: true };
}

export default {
  id: 'fiesta',
  name: 'The Closed Mall',
  weight: 0, // never picked at random: mall blocks place it (see fiesta/place.js)

  layout(seed, plan) {
    const map = mallMap();
    const { lx, lz, sample } = blockCell(plan);
    const ox = lx * CELL; // this cell's corner in block metres
    const oz = lz * CELL;
    const I0 = lx * N;
    const J0 = lz * N;
    plan.ambient = [0.032, 0.032, 0.03];
    const { z, lower, upper } = makeZones(plan);
    const up = plan.addUpper(UP_Y);

    const codes = (I, J) => {
      if (I < 0 || J < 0 || I >= W || J >= H) return [0, 0];
      const k = J * W + I;
      return [map.lo[k], map.hi[k]];
    };
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const [cl, ch] = codes(I0 + i, J0 + j);
        plan.tiles[j * N + i] = lower(cl, ch);
        up.tiles[j * N + i] = upper(ch);
      }
    // the place runs on into the neighbouring cells of the block
    if (!sample)
      plan.ext = (i, j) => {
        const [cl, ch] = codes(I0 + i, J0 + j);
        return [lower(cl, ch), upper(ch)];
      };

    // shop floors, and the centre court's terrazzo
    const paint = (rect, mat, level, onlyZone) => {
      const [x0, z0, x1, z1] = rect;
      for (let j = Math.max(0, Math.floor((z0 - oz) / TILE)); j < Math.min(N, Math.ceil((z1 - oz) / TILE)); j++)
        for (let i = Math.max(0, Math.floor((x0 - ox) / TILE)); i < Math.min(N, Math.ceil((x1 - ox) / TILE)); i++) {
          const k = j * N + i;
          if (level) {
            if (up.tiles[k] === onlyZone) up.floorMat[k] = mat;
          } else if (plan.tiles[k] === onlyZone) plan.floorMat[k] = mat;
        }
    };
    for (const s of map.stores) paint(s.rect, s.floor, s.level, s.level ? z['up-shop'] : z.shop);
    const court = [138 + MARGIN, 213 + MARGIN, 178 + MARGIN, 253 + MARGIN];
    paint(court, 'terrazzo', 0, z.well);
    paint(court, 'terrazzo', 0, z.concourse);

    // escalators that cross this cell (in cell metres)
    for (const r of map.ramps) {
      if (r.x1 <= ox || r.x0 >= ox + CELL || r.z1 <= oz || r.z0 >= oz + CELL) continue;
      plan.ramps.push({ x0: r.x0 - ox, z0: r.z0 - oz, x1: r.x1 - ox, z1: r.z1 - oz, axis: r.axis, dir: r.dir });
    }

    // lights: this cell's own, plus the neighbours' that reach in (baked, not drawn)
    plan.mallFixtures = [];
    const own = map.lightsByCell.get(`${lx},${lz}`) || [];
    for (const l of own) {
      const flicker = l.fixture === 'troffer' && (hash(plan.worldSeed, 'mallFlicker', Math.round(l.x * 2), Math.round(l.z * 2)) % 100) < 7;
      const L = { type: l.type, x: l.x - ox, y: l.y, z: l.z - oz, color: l.color, power: l.power, range: l.range, flicker, fixture: l.fixture === 'troffer', rot: l.rot || 0 };
      plan.lights.push(L);
      if (l.fixture !== 'troffer') plan.mallFixtures.push({ ...L, kind: l.fixture, level: l.level });
    }
    if (!sample)
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dz) continue;
          for (const l of map.lightsByCell.get(`${lx + dx},${lz + dz}`) || []) {
            const ex = Math.max(ox - l.x, 0, l.x - (ox + CELL));
            const ez = Math.max(oz - l.z, 0, l.z - (oz + CELL));
            if (ex * ex + ez * ez > l.range * l.range) continue;
            plan.extLights.push({ type: l.type, x: l.x - ox, y: l.y, z: l.z - oz, color: l.color, power: l.power, range: l.range, flicker: false });
          }
        }

    // props owned by this cell
    for (const p of map.propsByCell.get(`${lx},${lz}`) || []) {
      const { type, x, z: pz, rot, level, ...params } = p;
      // (the cut-out sample has hotel doors on its edges: its kiosk stands mid-concourse instead)
      const moved = sample && type === 'kiosk';
      const cxm = moved ? 10 : x - ox;
      const czm = moved ? 10 : pz - oz;
      plan.prop(type, cxm, czm, rot, { ...params, y0: level ? UP_Y : 0 });
      if (type === 'kiosk') {
        // the directory: this place's found document
        const fx = cxm + Math.sin(rot) * 0.7;
        const fz = czm + Math.cos(rot) * 0.7;
        plan.point('lore', fx, fz, { y: 1.3 });
        plan.interactions.push({ type: 'readLore', x: cxm, y: 1.3, z: czm, radius: 1.9, prompt: 'Read the directory' });
      }
      if (type === 'fountain') plan.interactions.push({ type: 'fountain', x: cxm, y: 0.6, z: czm, radius: (params.r || 3) + 1.2, prompt: 'Look into the fountain' });
      if (type === 'elevator') plan.interactions.push({ type: 'elevator', x: cxm - Math.sin(rot) * 1.4, y: 1.2, z: czm - Math.cos(rot) * 1.4, radius: 1.6, prompt: 'Press the call button' });
    }

    // a cut-out sample: walled at the cell edge, with service corridors to its doors
    if (sample) {
      // trace the corridors on an empty copy, so they show where they run through open floor too
      const kept = plan.tiles.slice();
      plan.tiles.fill(0);
      plan.connectDoors([24, 24], 3, z.service);
      const svc = [];
      for (let k = 0; k < N * N; k++)
        if (plan.tiles[k] === z.service) {
          svc.push([((k % N) + 0.5) * TILE, (((k / N) | 0) + 0.5) * TILE]);
          if (!kept[k]) kept[k] = z.service; // through walls: a service passage
        }
      plan.tiles.set(kept);
      // the doorways themselves, too
      for (const d of ['N', 'S', 'E', 'W']) {
        const door = plan.doors[d];
        if (!door) continue;
        for (let t = door.start; t <= door.end; t++) {
          const e = d === 'N' ? [t, 0] : d === 'S' ? [t, N - 1] : d === 'W' ? [0, t] : [N - 1, t];
          svc.push([(e[0] + 0.5) * TILE, (e[1] + 0.5) * TILE]);
        }
      }
      // and clear the lower-floor props the corridors cut through (shelves, shopfronts)
      plan.props = plan.props.filter((p) => {
        if (p.y0 || p.type === 'kiosk') return true;
        const reach = (p.w || 2) / 2 + 1.2;
        return !svc.some(([sx, sz]) => Math.abs(sx - p.x) < reach && Math.abs(sz - p.z) < reach);
      });
    }

    // somewhere to stand
    for (const [x, zz] of [[8, 8], [4, 4], [12, 12], [4, 12], [12, 4]]) {
      const t = plan.tiles[Math.floor(zz / TILE) * N + Math.floor(x / TILE)];
      if (t && t !== z.escalator) {
        plan.point('spawn', x, zz);
        break;
      }
    }
    return plan;
  },

  build(b) {
    const plan = b.plan;
    // fixtures for the lights that are not troffers
    for (const f of plan.mallFixtures || []) {
      b.push(f.x, f.z, 0, 0);
      if (f.kind === 'can') {
        // a recessed downlight: trim ring and a glowing lens
        b.cyl('chrome', 0, f.y - 0.01, 0, 0.17, 0.03, { segs: 12, noCap: true });
        b.cyl('lamp', 0, f.y - 0.012, 0, 0.13, 0.004, { segs: 12, glow: [1.9, 1.7, 1.35] });
      } else if (f.kind === 'globe') {
        // a cluster of opal globes on a stem from the skylight frame
        b.cyl('steelDark', 0, f.y + 0.35, 0, 0.02, SKY_CEIL - f.y - 0.35, { segs: 5, noCap: true });
        b.cyl('steelDark', 0, f.y + 0.3, 0, 0.5, 0.05, { segs: 14 });
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          b.cyl('shade', Math.cos(a) * 0.42, f.y - 0.05, Math.sin(a) * 0.42, 0.17, 0.3, { r1: 0.17, segs: 10, glow: [1.6, 1.45, 1.15] });
        }
        b.cyl('shade', 0, f.y - 0.2, 0, 0.2, 0.4, { r1: 0.2, segs: 10, glow: [1.6, 1.45, 1.15] });
      } else if (f.kind === 'pendant') {
        b.cyl('steelDark', 0, f.y + 0.3, 0, 0.008, UP_Y + 4.5 - f.y - 0.3, { segs: 4, noCap: true });
        b.cyl('mallTeal', 0, f.y, 0, 0.32, 0.3, { r1: 0.08, segs: 14, noCap: true });
        b.cyl('lamp', 0, f.y + 0.01, 0, 0.28, 0.004, { segs: 14, glow: [1.7, 1.3, 0.9] });
      } else if (f.kind === 'pole') {
        // a parking-lot pole: concrete base, steel mast, a shoebox head with a sodium lens
        b.cyl('concrete', 0, 0, 0, 0.35, 0.8, { segs: 10 });
        b.cyl('steelDark', 0, 0.8, 0, 0.11, f.y - 0.6, { r1: 0.07, segs: 8, noCap: true });
        b.box('steelDark', 0.45, f.y + 0.15, 0, 1.1, 0.16, 0.5);
        b.box('lamp', 0.45, f.y + 0.13, 0, 0.9, 0.01, 0.38, { glow: [2.6, 1.5, 0.6] });
        b.collideBox(0, 0, 0.7, 0.7, 0.8);
      }
      b.pop();
    }
    railings(b);
  },

  interactions: {
    fountain(m) {
      m.sound('paper', m.at);
      m.caption(
        m.pick([
          'The basin is dry. Coins all over the bottom, every one of them face down.',
          'Someone has written a wish on the tile in marker. The ink is fresh. It is your handwriting.',
          'A penny from 1979, polished bright, sitting on top of the dust.',
        ]),
        5,
      );
    },
    elevator(m) {
      m.sound('click', m.at);
      m.after(1.2, () => m.sound('elevatorChime', m.at));
      m.after(2.0, () => m.caption(m.pick(['The button lights. The car is on its way down. It has been on its way down for a long time.', 'A chime, the doors stay shut. Behind them, someone else presses the button from inside.']), 5));
    },
  },

  sounds: { hum: { base: 60, buzz: 0.08, level: 0.4, hvac: 0.75 }, room: 'large', ambience: ['elevatorChime', 'distantPhone'] },

  card: {
    title: 'The Closed Mall',
    blurb: 'Two levels, four department stores with nothing behind them, every light on. It closed years ago. Nobody told the lights.',
  },
};

/** Glass balustrades along every edge of the upper floor that looks down into a well. */
function railings(b) {
  const p = b.plan;
  const up = p.up;
  if (!up) return;
  const Z = p.zones;
  const y = up.y;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const zi = up.tiles[j * N + i];
      if (!zi || Z[zi].ramp) continue;
      for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nz = p.hiZ(i + di, j + dj);
        if (nz) continue;
        const lz = p.loZ(i + di, j + dj);
        if (!lz || Z[lz].ceil <= y + 0.01) continue;
        // the edge between this tile and the well, in cell metres
        const ex = (i + 0.5 + di * 0.5) * TILE;
        const ez = (j + 0.5 + dj * 0.5) * TILE;
        const along = di === 0; // edge runs along x
        const L = TILE;
        const inset = 0.06; // just on the walkway side of the slab edge
        const px = ex - di * inset;
        const pz = ez - dj * inset;
        // one pane (the material draws both sides): a box here stacked two layers of tint
        // and an end face every half metre, which read as a solid teal wall down the walkway
        b.face('railGlass', [px - (along ? L / 2 : 0), y + 0.08, pz - (along ? 0 : L / 2)], [along ? L : 0, 0, along ? 0 : L], [0, 0.92, 0], [0, 0]);
        b.box('chrome', px, y + 1.0, pz, along ? L : 0.07, 0.06, along ? 0.07 : L);
        b.box('mallTrim', px, y - 0.02, pz, along ? L : 0.1, 0.1, along ? 0.1 : L);
        // a post at every other tile
        if (((along ? i : j) & 1) === 0) b.box('chrome', px - (along ? L / 2 : 0), y, pz - (along ? 0 : L / 2), 0.05, 1.03, 0.05);
      }
    }
}
