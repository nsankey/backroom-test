// Layout helpers shared by kinds. Pure functions over a Plan.

import { N, TILE, CELL, DIRS } from './constants.js';
import { wallRot } from './props.js';
import { doorInside } from './doors.js';

const IN = TILE; // inner wall surfaces sit one tile in from the cell edge
const OUT = CELL - TILE;

/** A point on an outer wall: `along` metres along it, `out` metres into the room. */
export function wallPoint(dir, along, out = 0) {
  if (dir === 'N') return { x: along, z: IN + out, rot: wallRot('N') };
  if (dir === 'S') return { x: along, z: OUT - out, rot: wallRot('S') };
  if (dir === 'W') return { x: IN + out, z: along, rot: wallRot('W') };
  return { x: OUT - out, z: along, rot: wallRot('E') };
}

/** Door range along its wall, in metres: [a, b]. */
export function doorRange(door) {
  return [door.start * TILE, (door.end + 1) * TILE];
}

/** Does [a, b] on wall `dir` overlap a doorway (with margin)? */
export function hitsDoor(plan, dir, a, b, margin = 0.8) {
  const door = plan.doors[dir];
  if (!door) return false;
  const [da, db] = doorRange(door);
  return a < db + margin && b > da - margin;
}

/** Free spans of an outer wall between [lo, hi], excluding its doorway. */
export function freeSpans(plan, dir, lo = 1, hi = CELL - 1, margin = 0.8) {
  const door = plan.doors[dir];
  if (!door) return [[lo, hi]];
  const [da, db] = doorRange(door);
  const out = [];
  if (da - margin > lo) out.push([lo, da - margin]);
  if (db + margin < hi) out.push([db + margin, hi]);
  return out;
}

/** Spot just inside a door: `depth` metres in, `lateral` metres to the side. */
export function insideDoor(dir, door, depth = 1.5, lateral = 0) {
  const mid = (door.mid + 0.5) * TILE;
  // rot here faces the prop back toward the door (its front looks at whoever comes in)
  if (dir === 'N') return { x: mid + lateral, z: IN + depth, rot: Math.PI };
  if (dir === 'S') return { x: mid - lateral, z: OUT - depth, rot: 0 };
  if (dir === 'W') return { x: IN + depth, z: mid - lateral, rot: -Math.PI / 2 };
  return { x: OUT - depth, z: mid + lateral, rot: Math.PI / 2 };
}

export function firstDoor(plan) {
  for (const d of DIRS) if (plan.doors[d]) return d;
  return null;
}

/**
 * Make sure there is open floor just inside a door: carve a small vestibule (only through solid
 * tiles) using the zone found just inside it.
 */
export function vestibule(plan, dir, depth = 3, half = 1.75) {
  const door = plan.doors[dir];
  if (!door) return;
  const mid = (door.mid + 0.5) * TILE;
  let [ii, jj] = doorInside(dir, door);
  let zone = plan.tiles[plan.idx(ii, jj)];
  if (!zone || plan.zones[zone].door) zone = plan.fallbackZone();
  let x0, z0, x1, z1;
  if (dir === 'N') [x0, x1, z0, z1] = [mid - half, mid + half, IN, IN + depth];
  else if (dir === 'S') [x0, x1, z0, z1] = [mid - half, mid + half, OUT - depth, OUT];
  else if (dir === 'W') [x0, x1, z0, z1] = [IN, IN + depth, mid - half, mid + half];
  else [x0, x1, z0, z1] = [OUT - depth, OUT, mid - half, mid + half];
  for (let j = Math.floor(z0 / TILE); j < Math.ceil(z1 / TILE); j++)
    for (let i = Math.floor(x0 / TILE); i < Math.ceil(x1 / TILE); i++)
      if (i >= 1 && j >= 1 && i <= N - 2 && j <= N - 2 && plan.tiles[plan.idx(i, j)] === 0) plan.tiles[plan.idx(i, j)] = zone;
}

function clearAround(plan, x, z, r) {
  for (let j = Math.floor((z - r) / TILE); j <= Math.floor((z + r) / TILE); j++)
    for (let i = Math.floor((x - r) / TILE); i <= Math.floor((x + r) / TILE); i++) {
      if (!plan.isFloor(i, j) || plan.zoneAt(i, j).door) return false;
    }
  return true;
}

/** Place the lore document just inside the first door, nudged off the walking line. */
export function placeLore(plan, { depth = 1.6, lateral = 1.1, onSurface = null } = {}) {
  const d = firstDoor(plan);
  if (!d) return;
  if (!onSurface) vestibule(plan, d);
  let p = null;
  for (const dep of [depth, depth + 0.8, depth + 1.6])
    for (const lat of [lateral, -lateral]) {
      if (p) break;
      const c = insideDoor(d, plan.doors[d], dep, lat);
      if (onSurface || clearAround(plan, c.x, c.z, 0.45)) p = c;
    }
  if (!p) p = insideDoor(d, plan.doors[d], depth, lateral);
  if (onSurface) {
    plan.prop('loreDoc', p.x, p.z, p.rot, { onSurface: true, y: onSurface });
  } else plan.prop('loreDoc', p.x, p.z, p.rot);
  plan.point('lore', p.x, p.z, { y: (onSurface || 0.74) + 0.02, dir: d });
  plan.interactions.push({ type: 'readLore', x: p.x, y: (onSurface || 0.74) + 0.05, z: p.z, radius: 1.6, prompt: 'Read' });
}

/** Pick a corridor axis that suits the doors: 'x' (east-west) or 'z' (north-south). */
export function mainAxis(plan, rng) {
  const ew = !!(plan.doors.E || plan.doors.W);
  const ns = !!(plan.doors.N || plan.doors.S);
  if (ew && !ns) return 'x';
  if (ns && !ew) return 'z';
  return rng.chance(0.5) ? 'x' : 'z';
}

/**
 * Axis frame: work in (along, across) metres / tiles and map to cell coordinates.
 * 'lo' is the wall at the smaller across value, facing +across.
 */
export function axisFrame(axis) {
  const X = axis === 'x';
  return {
    axis,
    pt: (along, across) => (X ? { x: along, z: across } : { x: across, z: along }),
    tile: (a, c) => (X ? [a, c] : [c, a]),
    rotLo: X ? 0 : Math.PI / 2, // facing +across
    rotHi: X ? Math.PI : -Math.PI / 2, // facing -across
    rotFwd: X ? Math.PI / 2 : 0, // facing +along
    rotBack: X ? -Math.PI / 2 : Math.PI, // facing -along
    fill: (plan, a0, c0, a1, c1, zone) => (X ? plan.fill(a0, c0, a1, c1, zone) : plan.fill(c0, a0, c1, a1, zone)),
  };
}

/**
 * Candidate spots for wall-mounted things along both walls of a straight corridor occupying
 * across tiles c0..c1. A slot needs open corridor in front and `depth` solid tiles behind.
 * Returns [{ along, side: 'lo'|'hi', x, z, rot }].
 */
export function corridorWallSlots(plan, frame, c0, c1, { width = 1.0, depth = 2, from = 1.2, to = CELL - 1.2 } = {}) {
  const out = [];
  for (let a = from; a <= to + 1e-6; a += TILE) {
    const t0 = Math.floor((a - width / 2) / TILE);
    const t1 = Math.floor((a + width / 2 - 0.001) / TILE);
    for (const side of ['lo', 'hi']) {
      let ok = true;
      for (let t = t0; t <= t1 && ok; t++) {
        const front = side === 'lo' ? c0 : c1;
        const [fi, fj] = frame.tile(t, front);
        if (!plan.isFloor(fi, fj) || plan.zoneAt(fi, fj).door) ok = false;
        for (let k = 1; k <= depth && ok; k++) {
          const [bi, bj] = frame.tile(t, side === 'lo' ? c0 - k : c1 + k);
          if (plan.isFloor(bi, bj)) ok = false;
        }
      }
      if (!ok) continue;
      const across = side === 'lo' ? c0 * TILE : (c1 + 1) * TILE;
      const p = frame.pt(a, across);
      out.push({ along: a, side, x: p.x, z: p.z, rot: side === 'lo' ? frame.rotLo : frame.rotHi });
    }
  }
  return out;
}

/** Greedily pick slots at least `gap` apart per side. */
export function spaced(slots, gap, rng = null, skip = 0) {
  const last = { lo: -Infinity, hi: -Infinity };
  const out = [];
  for (const s of slots) {
    if (s.along - last[s.side] < gap) continue;
    if (rng && skip && rng.chance(skip)) {
      last[s.side] = s.along - gap * 0.5;
      continue;
    }
    out.push(s);
    last[s.side] = s.along;
  }
  return out;
}

/** Tile rect -> metre rect helpers. */
export const m = (t) => t * TILE;
export const t = (metres) => Math.floor(metres / TILE);

/** Inner tile bounds of the cell. */
export const LO = 1;
export const HI = N - 2;
