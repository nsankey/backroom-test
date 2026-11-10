// Doorway tile helpers (no imports from kinds, so layout code can use them without cycles).
import { N } from './constants.js';

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
