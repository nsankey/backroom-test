// The endless graph: which kind sits in each cell, and where the doors between cells are.
// Everything here is a pure function of (worldSeed, cell coordinates), so every client that
// shares a seed builds the same world without talking to anyone.

import { hash, hashFloat } from '../core/rng.js';
import { N, DOOR_TILES } from './constants.js';
import { KINDS, KIND_LIST } from './kinds/index.js';

const EXTRA_DOOR_CHANCE = 0.38;
const DOOR_STARTS = [5, 9, 14, 14, 14, 19, 23];

// Each cell links to its north or west neighbour (a binary-tree maze), which keeps the whole
// infinite grid connected. Extra doors add loops so it doesn't feel like a maze.
function mazeDir(seed, cx, cz) {
  return hash(seed, 'maze', cx, cz) & 1 ? 'N' : 'W';
}

function isOrigin(cx, cz) {
  return cx === 0 && cz === 0;
}

/** Door on the vertical line between (cx,cz) and (cx+1,cz)? */
function vEdge(seed, cx, cz) {
  if (isOrigin(cx, cz) || isOrigin(cx + 1, cz)) return true;
  if (mazeDir(seed, cx + 1, cz) === 'W') return true;
  return hashFloat(seed, 'xv', cx, cz) < EXTRA_DOOR_CHANCE;
}

/** Door on the horizontal line between (cx,cz) and (cx,cz+1)? */
function hEdge(seed, cx, cz) {
  if (isOrigin(cx, cz) || isOrigin(cx, cz + 1)) return true;
  if (mazeDir(seed, cx, cz + 1) === 'N') return true;
  return hashFloat(seed, 'xh', cx, cz) < EXTRA_DOOR_CHANCE;
}

function doorStart(seed, tag, cx, cz) {
  return DOOR_STARTS[hash(seed, 'dp', tag, cx, cz) % DOOR_STARTS.length];
}

/**
 * Doors of a cell: { N, E, S, W }, each null or { start, end } (tile index range along that
 * edge, inclusive). N/S edges run along x, E/W edges run along z.
 */
export function cellDoors(seed, cx, cz) {
  const mk = (s) => ({ start: s, end: s + DOOR_TILES - 1, mid: s + (DOOR_TILES - 1) / 2 });
  return {
    N: hEdge(seed, cx, cz - 1) ? mk(doorStart(seed, 'h', cx, cz - 1)) : null,
    S: hEdge(seed, cx, cz) ? mk(doorStart(seed, 'h', cx, cz)) : null,
    W: vEdge(seed, cx - 1, cz) ? mk(doorStart(seed, 'v', cx - 1, cz)) : null,
    E: vEdge(seed, cx, cz) ? mk(doorStart(seed, 'v', cx, cz)) : null,
  };
}

/** Which kind of place lives in this cell. */
export function cellKindId(seed, cx, cz) {
  if (isOrigin(cx, cz)) return 'lobby';
  const items = KIND_LIST.filter((k) => k.weight > 0).map((k) => [k.id, k.weight]);
  let total = 0;
  for (const [, w] of items) total += w;
  let r = hashFloat(seed, 'kind', cx, cz) * total;
  for (const [id, w] of items) {
    r -= w;
    if (r <= 0) return id;
  }
  return items[items.length - 1][0];
}

export function cellKind(seed, cx, cz) {
  return KINDS[cellKindId(seed, cx, cz)];
}

/** Tile coordinates of the doorway tiles on an edge, as [i, j] pairs. */
export function doorTiles(dir, door) {
  const out = [];
  for (let s = door.start; s <= door.end; s++) {
    if (dir === 'N') out.push([s, 0]);
    if (dir === 'S') out.push([s, N - 1]);
    if (dir === 'W') out.push([0, s]);
    if (dir === 'E') out.push([N - 1, s]);
  }
  return out;
}

/** The tile just inside a door, where a corridor should connect to. */
export function doorInside(dir, door) {
  const m = Math.round(door.mid);
  if (dir === 'N') return [m, 1];
  if (dir === 'S') return [m, N - 2];
  if (dir === 'W') return [1, m];
  return [N - 2, m];
}
