// Layout helpers shared by kinds. Pure functions over a Plan.

import { N, TILE, CELL, DIRS } from './constants.js';
import { wallRot } from './props.js';

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

/** Place the lore document just inside the first door, nudged off the walking line. */
export function placeLore(plan, { depth = 1.6, lateral = 1.1, onSurface = null } = {}) {
  const d = firstDoor(plan);
  if (!d) return;
  let p = insideDoor(d, plan.doors[d], depth, lateral);
  const ti = Math.floor(p.x / TILE);
  const tj = Math.floor(p.z / TILE);
  if (!plan.isFloor(ti, tj) || plan.zoneAt(ti, tj).door) p = insideDoor(d, plan.doors[d], depth, -lateral);
  if (onSurface) {
    plan.prop('loreDoc', p.x, p.z, p.rot, { onSurface: true, y: onSurface });
  } else plan.prop('loreDoc', p.x, p.z, p.rot);
  plan.point('lore', p.x, p.z, { y: (onSurface || 0.74) + 0.02, dir: d });
  plan.interactions.push({ type: 'readLore', x: p.x, y: (onSurface || 0.74) + 0.05, z: p.z, radius: 1.6, prompt: 'Read' });
}

/** Tile rect -> metre rect helpers. */
export const m = (t) => t * TILE;
export const t = (metres) => Math.floor(metres / TILE);

/** Inner tile bounds of the cell. */
export const LO = 1;
export const HI = N - 2;
