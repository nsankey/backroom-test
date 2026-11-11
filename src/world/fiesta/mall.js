// The whole mall as one plan, shared by every cell of a mall block. Built once per worker, lazily.
//
// What is real: the outline of the building and of the parking structure (OpenStreetMap, see
// outline.js), the four department-store wings at the ends of the cross, two levels, a food court
// upstairs, entrances in the notches between the wings. What is guessed: everything inside the
// outline (concourse widths, court sizes, store bands, voids, escalators, lights). See
// docs/experiments/fiesta-notes.md.
//
// Coordinates: "mall metres" are the outline's own (0..300 x 0..428). Everything stored here is in
// "block metres": mall metres + MARGIN, with (0, 0) at the block's corner cell. Tiles are 0.5 m,
// W x H of them over the whole block.

import { MALL_OUTLINE, PARKING_OUTLINE } from './outline.js';
import { STORE_NAMES, FOOD_NAMES, shopSignIndex } from './names.js';
import { RNG, hash } from '../../core/rng.js';
import { TILE, CELL, N } from '../constants.js';
import { BW, BH, MARGIN } from './place.js';

export const UP_Y = 5.5; // floor-to-floor
export const W = BW * N;
export const H = BH * N;
export const C = { SOLID: 0, LOT: 1, CONC: 2, STORE: 3, ENTRY: 4, FOOD: 5, RAMP: 6, FRONT: 7, STALL: 8, VEST: 9, FOODSKY: 10 };
export const LOW_CEIL = 4.6; // lower concourse under the upper walkways
export const SKY_CEIL = 10.6; // skylights over the open wells
export const UP_CEIL = 9.4; // upper walkways

const tb = (m) => Math.round((m + MARGIN) / TILE); // mall metres -> block tile boundary
const B = (m) => m + MARGIN; // mall metres -> block metres

/** Fill tiles whose centres fall inside a polygon (mall metres). */
function scan(poly, fn) {
  for (let J = 0; J < H; J++) {
    const z = (J + 0.5) * TILE - MARGIN;
    const xs = [];
    for (let k = 0; k < poly.length; k++) {
      const [xa, za] = poly[k];
      const [xb, zb] = poly[(k + 1) % poly.length];
      if (za <= z !== zb <= z) xs.push(xa + ((z - za) * (xb - xa)) / (zb - za));
    }
    xs.sort((a, b) => a - b);
    for (let p = 0; p + 1 < xs.length; p += 2) {
      const i0 = Math.max(0, Math.ceil((xs[p] + MARGIN) / TILE - 0.5));
      const i1 = Math.min(W - 1, Math.ceil((xs[p + 1] + MARGIN) / TILE - 0.5) - 1);
      for (let I = i0; I <= i1; I++) fn(J * W + I);
    }
  }
}

// ---- the plan, in mall metres -------------------------------------------------------------------

// concourses and courts (lower level; the upper level repeats them around open wells)
const CONCOURSES = [
  [151, 126, 165, 333], // north-south, between the two long-axis department stores
  [62, 226, 218, 240], // east-west, between the two short-axis department stores
  [138, 213, 178, 253], // centre court at the crossing
  [62, 220, 78, 246], // court in front of the west store
  [202, 220, 218, 246], // court in front of the east store
];
// open wells in the upper floor, and bridges across them
const VOIDS = [
  [154.5, 131, 161.5, 213],
  [154.5, 253, 161.5, 277],
  [80, 229.5, 138, 236.5],
  [178, 229.5, 202, 236.5],
  [146, 221, 170, 245],
];
const BRIDGES = [
  [154.5, 168, 161.5, 172],
  [104, 229.5, 108, 236.5],
];
// store bands: rects of shops sharing a frontage. front: the side facing the concourse
const BANDS = [
  { r: [129, 126.5, 151, 139.5], front: 'E', key: 'nwa' },
  { r: [129, 146.5, 151, 213], front: 'E', key: 'nwb' },
  { r: [165, 133.5, 187, 203.5], front: 'W', key: 'ne' },
  { r: [165, 204, 177.5, 212.5], front: 'W', key: 'nec' },
  { r: [78.5, 204, 128.5, 226], front: 'S', key: 'wn' },
  { r: [129, 213.5, 137.5, 226], front: 'S', key: 'wnc', service: true },
  { r: [78.5, 240, 128.5, 262], front: 'N', key: 'ws' },
  { r: [129, 240, 137.5, 252.5], front: 'N', key: 'wsc' },
  { r: [178.5, 204, 201.5, 226], front: 'S', key: 'en' },
  { r: [178.5, 240, 201.5, 262], front: 'N', key: 'es' },
  { r: [165, 253.5, 178, 262], front: 'W', key: 'esc' },
  { r: [129, 253.5, 151, 275.5], front: 'E', key: 'swa' },
  { r: [129, 282.5, 151, 332.5], front: 'E', key: 'swb', lowerOnly: true },
  { r: [165, 262.5, 187, 295.5], front: 'W', key: 'sea', repeat: true, upper: [165, 262.5, 187, 276.5] },
  { r: [165, 302.5, 187, 332.5], front: 'W', key: 'seb', lowerOnly: true },
];
// entrances: corridors from the concourse out through the wall to the lot (lower level only)
const ENTRIES = [
  { r: [100, 140, 151, 146], out: 'W' },
  { r: [165, 127, 206, 133], out: 'E' },
  { r: [102, 276, 151, 282], out: 'W' },
  { r: [165, 296, 221, 302], out: 'E' },
];
// the food court, upstairs over the south wing
const FOOD = [129, 277, 187, 317.5];
const FOOD_SKY = [151, 277, 165, 317.5];
const STALL_BANDS = [
  { r: [121.5, 279, 129, 311], front: 'E', n: 4 },
  { r: [187, 279, 194.5, 315], front: 'W', n: 4 },
  { r: [133, 317.5, 150.5, 325], front: 'N', n: 2 },
  { r: [165.5, 317.5, 183, 325], front: 'N', n: 2 },
];
const UPPER_EXTRA = [[151, 317.5, 165, 333]]; // the passage past the stalls to the south store
// escalators: rise along +z (dir 1) or -z (dir -1)
const RAMPS = [
  { r: [148.5, 233, 150.5, 245], dir: 1 },
  { r: [165.5, 221, 167.5, 233], dir: -1 },
  { r: [157, 265, 159, 277], dir: 1 },
];
// department-store fronts: blank, nothing behind them
const ANCHORS = [
  { x: 158, z: 126, rot: 0, w: 14 },
  { x: 158, z: 333, rot: Math.PI, w: 14 },
  { x: 62, z: 233, rot: Math.PI / 2, w: 26 },
  { x: 218, z: 233, rot: -Math.PI / 2, w: 26 },
];

const ROT = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 };

// ---- build -----------------------------------------------------------------------------------------

function build() {
  const lo = new Uint8Array(W * H).fill(C.LOT);
  const hi = new Uint8Array(W * H);
  const inMall = new Uint8Array(W * H);
  scan(MALL_OUTLINE, (k) => {
    inMall[k] = 1;
    lo[k] = C.SOLID;
  });
  // the parking structure runs past the block's west edge: stop it 4 m short so the lot goes round
  scan(PARKING_OUTLINE, (k) => {
    const I = k % W;
    const J = (k / W) | 0;
    if (!inMall[k] && I >= 8 && J >= 8 && I < W - 8 && J < H - 8) lo[k] = C.SOLID;
  });
  for (let I = 0; I < W; I++) lo[I] = lo[(H - 1) * W + I] = C.SOLID;
  for (let J = 0; J < H; J++) lo[J * W] = lo[J * W + W - 1] = C.SOLID;

  const interior = (I, J) => {
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const i = I + di;
        const j = J + dj;
        if (i < 0 || j < 0 || i >= W || j >= H || !inMall[j * W + i]) return false;
      }
    return true;
  };
  const fill = (arr, r, code, mode = 'interior') => {
    const [x0, z0, x1, z1] = r;
    for (let J = Math.max(0, tb(z0)); J < Math.min(H, tb(z1)); J++)
      for (let I = Math.max(0, tb(x0)); I < Math.min(W, tb(x1)); I++) {
        const k = J * W + I;
        if (mode === 'interior' && !interior(I, J)) continue;
        if (mode === 'mall' && !inMall[k]) continue;
        arr[k] = code;
      }
  };

  const rng = new RNG(hash('fiesta-layout-1979'));
  const stores = [];
  const props = [];
  const lights = [];

  // concourses: both levels, with wells cut in the upper one
  for (const r of CONCOURSES) {
    fill(lo, r, C.CONC);
    fill(hi, r, C.CONC);
  }
  for (const r of VOIDS) fill(hi, r, 0, 'any');
  for (const r of BRIDGES) fill(hi, r, C.CONC);

  // shops: bands cut into storefronts of varied width, separated by half-metre partitions
  const names = rng.shuffle(STORE_NAMES.filter((n) => n !== 'CUSTOMER SERVICE' && n !== 'EVERLIT CANDLES'));
  let nameAt = 0;
  const nextName = () => (rng.chance(0.3) || nameAt >= names.length ? null : names[nameAt++]); // ~30% vacant
  // mostly half down: the last tenants rolled their grilles to waist height and walked off
  const STATES = [['open', 0.2], ['half', 0.42], ['closed', 0.2], ['bare', 0.18]];
  const FLOORS = ['vinylCheck', 'carpetBlue', 'laminate', 'whiteTile', 'carpetRust', 'vinylBrown'];
  const STYLES = [['racks', 3], ['shelves', 3], ['cases', 2], ['gutted', 2]];

  const cutBand = (band, level, rect) => {
    const [x0, z0, x1, z1] = rect;
    const alongZ = band.front === 'E' || band.front === 'W';
    const a0 = alongZ ? z0 : x0;
    const a1 = alongZ ? z1 : x1;
    const widths = [];
    if (band.repeat) widths.push(8, 8, 8); // the same shop, three times in a row
    let used = widths.reduce((s, w) => s + w, 0);
    while (a1 - a0 - used >= 6) {
      let w = rng.pick([6, 7, 8, 9, 10, 10, 12, 14, 16]);
      if (a1 - a0 - used - w < 6) w = a1 - a0 - used; // last one takes the rest
      widths.push(w);
      used += w;
    }
    if (!widths.length) widths.push(a1 - a0);
    else widths[widths.length - 1] += a1 - a0 - used;
    let a = a0;
    let repeatProto = null;
    widths.forEach((w, n) => {
      const last = n === widths.length - 1;
      const b = a + w;
      const end = last ? b : b - 0.5; // partition
      // the store rect including its front row, in mall metres
      const sr = alongZ ? [x0, a, x1, end] : [a, z0, end, z1];
      const tiles = level ? hi : lo;
      fill(tiles, sr, C.STORE);
      // front row: pilasters at both ends, the opening between
      let fr;
      if (band.front === 'E') fr = [x1 - 0.5, a, x1, end];
      else if (band.front === 'W') fr = [x0, a, x0 + 0.5, end];
      else if (band.front === 'S') fr = [a, z1 - 0.5, end, z1];
      else fr = [a, z0, end, z0 + 0.5];
      fill(tiles, fr, C.SOLID);
      const op = alongZ ? [fr[0], a + 1, fr[2], end - 1] : [a + 1, fr[1], end - 1, fr[3]];
      fill(tiles, op, C.FRONT);
      const inner = band.front === 'E' ? [x0, a, x1 - 0.5, end] : band.front === 'W' ? [x0 + 0.5, a, x1, end] : band.front === 'S' ? [a, z0, end, z1 - 0.5] : [a, z0 + 0.5, end, z1];
      let s;
      if (band.repeat && n < 3) {
        if (!repeatProto) repeatProto = { name: level ? null : 'EVERLIT CANDLES', state: 'open', floor: 'vinylBrown', style: 'shelves', seed: hash('everlit', level) };
        s = { ...repeatProto };
        if (level) s.name = names[nameAt++] || null;
        if (level) s.seed = hash('repeat-up', n);
      } else {
        s = { name: nextName(), state: rng.weighted(STATES), floor: rng.pick(FLOORS), style: rng.weighted(STYLES), seed: hash('store', band.key, level, n) };
      }
      if (band.service && !level) Object.assign(s, { name: 'CUSTOMER SERVICE', state: 'open', style: 'service', floor: 'carpetBlue' });
      if (s.style === 'gutted') s.floor = 'concrete';
      if (!s.name && s.state === 'open') s.state = 'bare';
      const opW = (alongZ ? op[3] - op[1] : op[2] - op[0]);
      // the storefront plane: outer face of the front row, facing the concourse
      const fx = band.front === 'E' ? fr[2] : band.front === 'W' ? fr[0] : (op[0] + op[2]) / 2;
      const fz = band.front === 'S' ? fr[3] : band.front === 'N' ? fr[1] : (op[1] + op[3]) / 2;
      const store = {
        id: stores.length,
        level,
        key: band.key,
        front: band.front,
        rect: inner.map(B),
        ...s,
        w: opW,
        fx: B(fx),
        fz: B(fz),
        rot: ROT[band.front],
      };
      stores.push(store);
      a = b;
    });
  };
  for (const band of BANDS) {
    cutBand(band, 0, band.r);
    if (!band.lowerOnly) cutBand(band, 1, band.upper || band.r);
  }

  // entrances: corridors through the store bands to the outer wall, glass doors at the end
  const entries = [];
  for (const e of ENTRIES) {
    fill(lo, e.r, C.ENTRY, 'mall');
    const [x0, z0, x1, z1] = e.r;
    // find the outer wall: the first lot tile walking outward along the centre line
    const zc = (z0 + z1) / 2;
    const xc = (x0 + x1) / 2;
    let doorX = e.out === 'W' ? x0 : x1;
    const J = tb(zc);
    if (e.out === 'W') {
      for (let I = tb(x1) - 1; I >= tb(x0); I--) if (!inMall[J * W + I]) { doorX = (I + 1) * TILE - MARGIN; break; }
    } else {
      for (let I = tb(x0); I < tb(x1); I++) if (!inMall[J * W + I]) { doorX = I * TILE - MARGIN; break; }
    }
    // vestibule: the last 3 m inside the doors
    const vr = e.out === 'W' ? [doorX, z0, doorX + 3, z1] : [doorX - 3, z0, doorX, z1];
    fill(lo, vr, C.VEST, 'mall');
    entries.push({ x: B(doorX), z: B(zc), rot: e.out === 'W' ? -Math.PI / 2 : Math.PI / 2, w: z1 - z0, xc: B(xc) });
  }

  // the food court, upstairs
  fill(hi, FOOD, C.FOOD);
  fill(hi, FOOD_SKY, C.FOODSKY);
  for (const r of UPPER_EXTRA) fill(hi, r, C.CONC);
  const foodNames = rng.shuffle([...FOOD_NAMES]);
  let foodAt = 0;
  const stalls = [];
  for (const sb of STALL_BANDS) {
    const [x0, z0, x1, z1] = sb.r;
    const alongZ = sb.front === 'E' || sb.front === 'W';
    const len = alongZ ? z1 - z0 : x1 - x0;
    const w = len / sb.n;
    for (let n = 0; n < sb.n; n++) {
      const a = (alongZ ? z0 : x0) + n * w;
      const end = n === sb.n - 1 ? a + w : a + w - 0.5;
      const sr = alongZ ? [x0, a, x1, end] : [a, z0, end, z1];
      fill(hi, sr, C.STALL);
      let fr;
      if (sb.front === 'E') fr = [x1 - 0.5, a, x1, end];
      else if (sb.front === 'W') fr = [x0, a, x0 + 0.5, end];
      else fr = [a, z0, end, z0 + 0.5];
      fill(hi, fr, C.SOLID);
      const op = alongZ ? [fr[0], a + 0.5, fr[2], end - 0.5] : [a + 0.5, fr[1], end - 0.5, fr[3]];
      fill(hi, op, C.FRONT);
      const fx = sb.front === 'E' ? fr[2] : sb.front === 'W' ? fr[0] : (op[0] + op[2]) / 2;
      const fz = sb.front === 'N' ? fr[1] : (op[1] + op[3]) / 2;
      const inner = sb.front === 'E' ? [x0, a, x1 - 0.5, end] : sb.front === 'W' ? [x0 + 0.5, a, x1, end] : [a, z0 + 0.5, end, z1];
      stalls.push({
        name: rng.chance(0.15) ? null : foodNames[foodAt++ % foodNames.length],
        state: rng.weighted([['half', 0.5], ['closed', 0.3], ['open', 0.2]]),
        w: alongZ ? op[3] - op[1] : op[2] - op[0],
        fx: B(fx),
        fz: B(fz),
        rot: ROT[sb.front],
        rect: inner.map(B),
        seed: hash('stall', sb.front, n, x0),
      });
    }
  }

  // escalators: both levels see the ramp
  const ramps = RAMPS.map((rp) => {
    fill(lo, rp.r, C.RAMP, 'any');
    fill(hi, rp.r, C.RAMP, 'any');
    const [x0, z0, x1, z1] = rp.r.map(B);
    return { x0, z0, x1, z1, axis: 'z', dir: rp.dir };
  });

  // ---- lights ------------------------------------------------------------------------------------
  const lightSeen = new Set();
  const addLight = (l) => {
    const key = `${l.level}:${Math.round(l.x / 1.5)},${Math.round(l.z / 1.5)}`;
    if (lightSeen.has(key)) return;
    lightSeen.add(key);
    lights.push(l);
  };
  const tileAt = (arr, x, z) => {
    const I = Math.floor(x / TILE);
    const J = Math.floor(z / TILE);
    return I < 0 || J < 0 || I >= W || J >= H ? -1 : arr[J * W + I];
  };
  const isVoid = (x, z) => {
    const l = tileAt(lo, x, z);
    return (l === C.CONC || l === C.RAMP) && tileAt(hi, x, z) === 0;
  };
  const WARM = [1.0, 0.9, 0.74];
  for (const r of CONCOURSES) {
    const [x0, z0, x1, z1] = r.map(B);
    const nx = Math.max(1, Math.round((x1 - x0) / 3.5));
    const nz = Math.max(1, Math.round((z1 - z0) / 3.5));
    for (let a = 0; a < nx; a++)
      for (let b = 0; b < nz; b++) {
        const x = x0 + ((a + 0.5) * (x1 - x0)) / nx;
        const z = z0 + ((b + 0.5) * (z1 - z0)) / nz;
        const l0 = tileAt(lo, x, z);
        if (l0 !== C.CONC) continue;
        if (isVoid(x, z)) {
          // big globes hang in the wells, every other grid point
          if ((a + b) % 2 === 0) addLight({ x, z, y: 8.6, type: 'point', color: [1.0, 0.92, 0.78], power: 5.5, range: 12, level: 0, fixture: 'globe' });
        } else addLight({ x, z, y: LOW_CEIL - 0.04, type: 'troffer', color: WARM, power: 2.0, range: 7.5, level: 0, fixture: 'can' });
        if (tileAt(hi, x, z) === C.CONC) addLight({ x, z, y: UP_CEIL - 0.04, type: 'troffer', color: WARM, power: 1.7, range: 7, level: 1, fixture: 'can' });
      }
  }
  // the upper passage to the south store
  for (const r of UPPER_EXTRA) {
    const [x0, z0, x1, z1] = r.map(B);
    for (let z = z0 + 2; z < z1; z += 3.5) for (const x of [x0 + 3.5, x1 - 3.5]) addLight({ x, z, y: UP_CEIL - 0.04, type: 'troffer', color: WARM, power: 1.7, range: 7, level: 1, fixture: 'can' });
  }
  for (const s of stores) {
    const [x0, z0, x1, z1] = s.rect;
    const ceil = s.level ? UP_Y + 3.6 : 3.6;
    const nx = Math.max(1, Math.round((x1 - x0) / 4));
    const nz = Math.max(1, Math.round((z1 - z0) / 4));
    for (let a = 0; a < nx; a++)
      for (let b = 0; b < nz; b++) {
        const x = x0 + ((a + 0.5) * (x1 - x0)) / nx;
        const z = z0 + ((b + 0.5) * (z1 - z0)) / nz;
        lights.push({ x, z, y: ceil - 0.03, type: 'troffer', color: [0.86, 1.0, 0.84], power: s.state === 'closed' ? 1.4 : 2.2, range: 8, level: s.level, fixture: 'troffer', rot: (z1 - z0) > (x1 - x0) ? Math.PI / 2 : 0 });
      }
  }
  for (const e of ENTRIES) {
    const [x0, z0, x1, z1] = e.r.map(B);
    for (let x = x0 + 2; x < x1 - 0.5; x += 4) {
      if (tileAt(lo, x, (z0 + z1) / 2) !== C.ENTRY && tileAt(lo, x, (z0 + z1) / 2) !== C.VEST) continue;
      lights.push({ x, z: (z0 + z1) / 2, y: 3.57, type: 'troffer', color: [0.86, 1.0, 0.84], power: 2.0, range: 8, level: 0, fixture: 'troffer', rot: 0 });
    }
  }
  {
    const [x0, z0, x1, z1] = FOOD.map(B);
    for (let x = x0 + 2.5; x < x1; x += 5)
      for (let z = z0 + 2.5; z < z1; z += 5) addLight({ x, z, y: UP_Y + 3.2, type: 'point', color: [1.0, 0.86, 0.66], power: 2.2, range: 8.5, level: 1, fixture: 'pendant' });
  }
  for (const s of stalls) {
    const [x0, z0, x1, z1] = s.rect;
    lights.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, y: UP_Y + 3.07, type: 'troffer', color: [0.9, 1.0, 0.86], power: 1.8, range: 7, level: 1, fixture: 'troffer', rot: 0 });
  }
  // parking lot: sodium poles on a loose grid, kept off the walls
  for (let z = 14; z < H * TILE - 6; z += 26)
    for (let x = 14; x < W * TILE - 6; x += 26) {
      let ok = true;
      for (let dz = -4; dz <= 4 && ok; dz += 2) for (let dx = -4; dx <= 4 && ok; dx += 2) if (tileAt(lo, x + dx, z + dz) !== C.LOT) ok = false;
      // (bright enough to pool on the asphalt, about 0.5 under a pole and dark between them;
      // at 16 the lot baked to black and the building vanished)
      if (ok) lights.push({ x, z, y: 9.5, type: 'point', color: [1.0, 0.62, 0.26], power: 48, range: 28, level: 0, fixture: 'pole' });
    }

  // ---- props -------------------------------------------------------------------------------------
  const prop = (type, x, z, rot, level, params = {}) => props.push({ type, x, z, rot, level, ...params });
  for (const s of stores) {
    prop('storefront', s.fx, s.fz, s.rot, s.level, { w: s.w, state: s.state, sign: s.name ? shopSignIndex(s.name) : -1, h: 3.0, bulk: s.level ? UP_CEIL - UP_Y - 3.0 : LOW_CEIL - 3.0, store: s.id });
    storeInterior(s, prop);
  }
  for (const s of stalls) {
    prop('stallFront', s.fx, s.fz, s.rot, 1, { w: s.w, state: s.state, sign: s.name ? shopSignIndex(s.name) : -1 });
    // the counter just inside, and a menu board on the back wall
    const r = new RNG(s.seed);
    const [x0, z0, x1, z1] = s.rect;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const back = 0.5 + (s.rot === ROT.N || s.rot === ROT.S ? z1 - z0 : x1 - x0) / 2 - 0.6;
    const bx = cx - Math.sin(s.rot) * back;
    const bz = cz - Math.cos(s.rot) * back;
    prop('stallBack', bx, bz, s.rot, 1, { w: s.w, seed: r.int(0, 1e6) });
  }
  for (const e of entries) prop('entryDoors', e.x, e.z, e.rot, 0, { w: e.w });
  for (const a of ANCHORS) {
    prop('anchorFront', B(a.x), B(a.z), a.rot, 0, { w: a.w, h: LOW_CEIL });
    prop('anchorFront', B(a.x), B(a.z), a.rot, 1, { w: a.w, h: UP_CEIL - UP_Y, upper: true });
  }
  for (const rp of ramps) {
    const len = rp.z1 - rp.z0;
    prop('escalator', (rp.x0 + rp.x1) / 2, (rp.z0 + rp.z1) / 2, rp.dir > 0 ? 0 : Math.PI, 0, { len, w: rp.x1 - rp.x0, rise: UP_Y });
  }
  prop('fountain', B(158), B(233), 0, 0, { r: 3.2 });
  prop('kiosk', B(158), B(216.6), 0, 0, {});
  prop('elevator', B(168.75), B(242.75), Math.PI, 0, { h: SKY_CEIL, up: UP_Y });
  // benches, bins and dead planters along the concourses (skipping courts and escalators)
  const clear = (x, z, r) => {
    for (let dz = -r; dz <= r; dz += 0.5)
      for (let dx = -r; dx <= r; dx += 0.5) {
        const t = tileAt(lo, x + dx, z + dz);
        if (t !== C.CONC) return false;
      }
    return true;
  };
  const nearAny = (x, z, d) => props.some((p) => p.level === 0 && Math.hypot(p.x - x, p.z - z) < d);
  // along the north-south concourse: benches under the walkways, planters in the well
  for (let z = 134; z < 330; z += 9) {
    const side = Math.round(z / 9) % 2 ? 152.3 : 163.7;
    if (clear(B(side), B(z), 1) && !nearAny(B(side), B(z), 4)) prop('bench', B(side), B(z), side < 158 ? Math.PI / 2 : -Math.PI / 2, 0, {});
    if (Math.round(z / 9) % 3 === 0 && clear(B(158), B(z), 1.5) && !nearAny(B(158), B(z), 6)) prop('planter', B(158), B(z), 0, 0, { s: 2.2 });
  }
  for (let x = 84; x < 216; x += 9) {
    const side = Math.round(x / 9) % 2 ? 227.3 : 238.7;
    if (clear(B(x), B(side), 1) && !nearAny(B(x), B(side), 4)) prop('bench', B(x), B(side), side < 233 ? 0 : Math.PI, 0, {});
    if (Math.round(x / 9) % 3 === 0 && clear(B(x), B(233), 1.5) && !nearAny(B(x), B(233), 6)) prop('planter', B(x), B(233), 0, 0, { s: 2.2 });
  }
  // bins beside some benches
  for (const p of props.filter((q) => q.type === 'bench')) {
    const dx = Math.cos(p.rot) * 1.6;
    const dz = -Math.sin(p.rot) * 1.6;
    if (clear(p.x + dx, p.z + dz, 0.5)) prop('bin', p.x + dx, p.z + dz, p.rot, 0, {});
  }
  // five years of nobody sweeping: papers and cups across both floors, and leaves that blew in
  // through the propped entry doors, thickest near them
  {
    const lr = new RNG(hash('litter'));
    const walk0 = (x, z) => {
      const t = tileAt(lo, x, z);
      return t === C.CONC || t === C.ENTRY || t === C.VEST;
    };
    for (let k = 0; k < 2400; k++) {
      const x = lr.float(B(62), B(218));
      const z = lr.float(B(126), B(333));
      const level = lr.chance(0.35) ? 1 : 0;
      const seed = lr.int(0, 1e6);
      const rot = lr.float(0, Math.PI * 2);
      if (level ? tileAt(hi, x, z) !== C.CONC : !walk0(x, z)) continue;
      const entry = !level && tileAt(lo, x, z) !== C.CONC;
      if (!entry && !lr.chance(0.07)) continue;
      if (props.some((p) => p.level === level && Math.abs(p.x - x) < 1.5 && Math.abs(p.z - z) < 1.5)) continue;
      prop('litter', x, z, rot, level, { seed, leaves: entry || lr.chance(0.15) });
    }
  }
  // upstairs: benches along the walkways, backs to the shops
  for (let z = 138; z < 276; z += 12) {
    for (const side of [152.2, 163.8]) {
      const x = B(side);
      if (tileAt(hi, x, B(z)) === C.CONC && tileAt(hi, x, B(z) + 1) === C.CONC && tileAt(hi, x, B(z) - 1) === C.CONC && Math.round(z / 12 + side) % 2) prop('bench', x, B(z), side < 158 ? Math.PI / 2 : -Math.PI / 2, 1, {});
    }
  }
  // food court: tables with their chairs still out
  {
    const [x0, z0, x1, z1] = FOOD.map(B);
    const fr = new RNG(hash('food-tables'));
    for (let x = x0 + 3; x < x1 - 2; x += 3.6)
      for (let z = z0 + 3.2; z < z1 - 2; z += 3.4) {
        if (Math.abs(x - B(158)) < 3.4 && z < z0 + 5) continue; // top of the escalator
        // seven years of nobody: some tables taken away, the rest shoved about. On the side
        // nearest the east stalls someone started stacking chairs for the night and stopped.
        const gone = fr.chance(0.14);
        const jx = fr.float(-0.7, 0.7);
        const jz = fr.float(-0.6, 0.6);
        const rot = fr.pick([0, Math.PI / 2]) + fr.float(-0.45, 0.45);
        const seed = fr.int(0, 1e6);
        const stacked = x > B(170) && fr.chance(0.7);
        if (!gone) prop('foodTable', x + jx, z + jz, rot, 1, { seed, stacked });
      }
  }
  // parking-lot poles get their fixture from the light list; cart corrals by a few of them
  return { lo, hi, inMall, stores, stalls, entries, lights, props, ramps };
}

/** Fill a store with fixtures, in block metres. Same seed, same store (the repeating shop). */
function storeInterior(s, prop) {
  const r = new RNG(s.seed);
  const [x0, z0, x1, z1] = s.rect;
  // work in a frame where the front is at +across (toward the concourse)
  const alongZ = s.front === 'E' || s.front === 'W';
  const A0 = alongZ ? z0 : x0;
  const A1 = alongZ ? z1 : x1;
  const D0 = alongZ ? x0 : z0;
  const D1 = alongZ ? x1 : z1;
  const frontHigh = s.front === 'E' || s.front === 'S';
  // depth measured from the front, inward
  const pt = (along, depth) => {
    const d = frontHigh ? D1 - depth : D0 + depth;
    return alongZ ? { x: d, z: along } : { x: along, z: d };
  };
  const faceFront = s.rot;
  const span = A1 - A0;
  const depth = D1 - D0;
  const items = [];
  const add = (type, along, dep, rot, params = {}) => {
    const p = pt(along, dep);
    items.push([type, p.x, p.z, rot, params]);
  };
  if (s.style === 'service') {
    add('serviceDesk', (A0 + A1) / 2, 3.2, faceFront, { len: Math.min(5, span - 2) });
  } else if (s.style === 'racks') {
    for (let dep = 3; dep < depth - 2; dep += 2.6)
      for (let a = A0 + 1.6; a < A1 - 1.4; a += 2.4) if (r.chance(0.75)) add('rack', a, dep, faceFront + (r.chance(0.5) ? Math.PI / 2 : 0) + r.float(-0.1, 0.1), { empty: r.chance(0.6), seed: r.int(0, 1e6) });
    add('cashWrap', A0 + span * 0.7, depth - 2.2, faceFront, {});
  } else if (s.style === 'shelves') {
    for (let a = A0 + 1.8; a < A1 - 1.6; a += 2.6) add('gondola', a, depth / 2 + 0.5, faceFront + Math.PI / 2, { len: Math.max(2, depth - 7), seed: r.int(0, 1e6) });
    add('cashWrap', A0 + 1.6, 2.6, faceFront + Math.PI / 2, {});
  } else if (s.style === 'cases') {
    for (let a = A0 + 1.5; a < A1 - 1.5; a += 2.1) add('showcase', a, 3.4, faceFront, {});
    for (let a = A0 + 1.5; a < A1 - 1.5; a += 2.1) if (depth > 9) add('showcase', a, depth - 3, faceFront + Math.PI, {});
  } else {
    // gutted: drop cloth, a ladder, boxes
    const n = r.int(2, 5);
    for (let k = 0; k < n; k++) add('cardboardBox', r.float(A0 + 1, A1 - 1), r.float(3, depth - 1), r.float(0, 6.28), { s: r.float(0.35, 0.6) });
    if (r.chance(0.5)) add('ladder', r.float(A0 + 1.5, A1 - 1.5), r.float(4, Math.max(4.5, depth - 2)), r.float(0, 6.28), {});
  }
  if (r.chance(0.35) && s.style !== 'service') add('mannequin', A0 + r.float(1.2, span - 1.2), 1.8, faceFront + r.float(-0.6, 0.6), {});
  for (const [type, x, z, rot, params] of items) prop(type, x, z, rot, s.level, { ...params, storeId: s.id });
}

let MAP = null;
/** The mall plan (built once). */
export function mallMap() {
  if (!MAP) {
    MAP = build();
    // index lights and props by owning cell (block-local cell coords)
    MAP.lightsByCell = new Map();
    MAP.propsByCell = new Map();
    const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    for (const l of MAP.lights) {
      const k = key(l.x, l.z);
      if (!MAP.lightsByCell.has(k)) MAP.lightsByCell.set(k, []);
      MAP.lightsByCell.get(k).push(l);
    }
    for (const p of MAP.props) {
      const k = key(p.x, p.z);
      if (!MAP.propsByCell.has(k)) MAP.propsByCell.set(k, []);
      MAP.propsByCell.get(k).push(p);
    }
  }
  return MAP;
}

/** Tile code at block tile (I, J) on a level; outside the block is solid. */
export function codeAt(map, level, I, J) {
  if (I < 0 || J < 0 || I >= W || J >= H) return C.SOLID;
  return (level ? map.hi : map.lo)[J * W + I];
}

/** Walkable for the connectivity check: which codes can be stood on, per level. */
const WALK0 = new Set([C.LOT, C.CONC, C.ENTRY, C.VEST, C.RAMP]);
const WALK1 = new Set([C.CONC, C.FOOD, C.FOODSKY, C.RAMP]);

/**
 * Tests: flood both levels from the lot (escalators join them) and count public tiles that cannot
 * be reached. Shops are left out (their shutters decide).
 */
export function checkMallConnectivity() {
  const map = mallMap();
  const seen = [new Uint8Array(W * H), new Uint8Array(W * H)];
  const start = 2 * W + 2;
  const stack = [[0, start]];
  seen[0][start] = 1;
  while (stack.length) {
    const [lv, k] = stack.pop();
    const I = k % W;
    const J = (k / W) | 0;
    const nb = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = I + di;
      const j = J + dj;
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      nb.push([lv, j * W + i]);
    }
    if ((lv ? map.hi : map.lo)[k] === C.RAMP) nb.push([1 - lv, k]);
    for (const [l2, k2] of nb) {
      if (seen[l2][k2]) continue;
      const code = (l2 ? map.hi : map.lo)[k2];
      if (!(l2 ? WALK1 : WALK0).has(code)) continue;
      seen[l2][k2] = 1;
      stack.push([l2, k2]);
    }
  }
  let lost = 0;
  let total = 0;
  const where = {};
  for (let lv = 0; lv < 2; lv++)
    for (let k = 0; k < W * H; k++) {
      const code = (lv ? map.hi : map.lo)[k];
      if (!(lv ? WALK1 : WALK0).has(code)) continue;
      total++;
      if (seen[lv][k]) continue;
      lost++;
      const key = `L${lv} code ${code}`;
      const x = (k % W) * TILE - MARGIN;
      const z = ((k / W) | 0) * TILE - MARGIN;
      const w = (where[key] ||= { n: 0, x0: x, x1: x, z0: z, z1: z });
      w.n++;
      w.x0 = Math.min(w.x0, x);
      w.x1 = Math.max(w.x1, x);
      w.z0 = Math.min(w.z0, z);
      w.z1 = Math.max(w.z1, z);
    }
  return { total, lost, where };
}
