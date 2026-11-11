// Where the mall sits in the endless grid. Pure functions of (worldSeed, cell), no imports from
// kinds, so the grid can ask "is this cell part of a mall block?" without a cycle.
//
// The mall is built at true scale, so it does not fit in one 16 m cell: it reserves a block of
// BW x BH cells (its outline plus a parking lot around it). Every cell in the block is the
// 'fiesta' kind and shares one plan of the whole building (see mall.js). There is one block per
// REGION x REGION cells: always in the region around the origin, a few cells east of the lobby,
// and in a quarter of the other regions.

import { hash, hashFloat } from '../../core/rng.js';

export const BW = 21; // cells across (x)
export const BH = 29; // cells deep (z)
export const MARGIN = 17.75; // metres of parking lot between the block edge and the outline's bounding box
const REGION = 50;
const HALF = REGION / 2;

/** Block origin (cell coordinates) for the region holding (cx, cz), or null if it has none. */
function regionBlock(seed, rx, rz) {
  if (rx === 0 && rz === 0) {
    // near the start: the lot begins 3 or 4 cells east of the lobby, which is level with its middle
    return { bx: 3 + (hash(seed, 'mallx') % 2), bz: -14 - (hash(seed, 'mallz') % 6) };
  }
  if (hashFloat(seed, 'mall', rx, rz) >= 0.25) return null;
  return {
    bx: rx * REGION - HALF + 2 + (hash(seed, 'mallx', rx, rz) % (REGION - BW - 3)),
    bz: rz * REGION - HALF + 2 + (hash(seed, 'mallz', rx, rz) % (REGION - BH - 3)),
  };
}

/** The mall block containing cell (cx, cz): { bx, bz, lx, lz } (lx, lz: cell within block), or null. */
export function mallBlockAt(seed, cx, cz) {
  const rx = Math.floor((cx + HALF) / REGION);
  const rz = Math.floor((cz + HALF) / REGION);
  const b = regionBlock(seed, rx, rz);
  if (!b) return null;
  const lx = cx - b.bx;
  const lz = cz - b.bz;
  if (lx < 0 || lz < 0 || lx >= BW || lz >= BH) return null;
  return { bx: b.bx, bz: b.bz, lx, lz };
}

/** The block of the region around the origin (always present). */
export function homeMallBlock(seed) {
  return regionBlock(seed, 0, 0);
}
