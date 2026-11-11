// Sites: the derelict Halvard craft named on Grisholm's writs. A site is a FINITE run of cells,
// generated purely from (worldSeed, siteId, night): every client that knows those three numbers
// builds the same craft. Cell (0,0) is always the docking deck where the Strongbox sets down;
// the craft's insides grow north of it from the airlock cell (0,-1).

import { hash, hashFloat, RNG } from '../core/rng.js';
import { DOOR_TILES } from './constants.js';

export const SITES = {
  coldstore: {
    id: 'coldstore',
    writ: 'WRIT 4471',
    name: 'Reefer Freighter Halvard Constant',
    place: 'Adrift in the Pell Reach',
    blurb: 'Refrigerated freighter, lost power in transit. Cargo holds, cold holds, plant. Believed largely intact.',
    hazard: 1,
    cells: [8, 10],
    kinds: [['racking', 3], ['coldRoom', 3], ['corridor', 1.2], ['office', 0.8]],
    loot: [['busbar', 3], ['gauge', 3], ['fanMotor', 1.5], ['urn', 2], ['plaque', 2], ['ledgerBook', 2], ['teleprinter', 1], ['meterHead', 2.5], ['typeball', 0.5]],
    lootPerCell: [3, 5],
    tint: 'cold',
  },
  records: {
    id: 'records',
    writ: 'WRIT 4502',
    name: 'Halvard Mutual Records Hulk',
    place: 'Parked at Grise Anchorage',
    blurb: 'The insurer’s orbiting back office. Typing pools and the records store. Small, light, valuable items.',
    hazard: 2,
    cells: [10, 12],
    kinds: [['office', 3], ['archive', 3], ['corridor', 1.5], ['racking', 0.5]],
    loot: [['typeball', 3], ['seal', 2], ['reel', 3], ['globe', 1.5], ['dictaphone', 2], ['penCase', 1], ['ledgerBook', 3], ['stockCert', 1.2], ['plaque', 2]],
    lootPerCell: [3, 6],
    tint: 'office',
  },
  bottling: {
    id: 'bottling',
    writ: 'WRIT 4519',
    name: 'Halvard Ice-Water Bottling Tender',
    place: 'Tethered in the Ottery Ring',
    blurb: 'Cut comet ice and bottled it. Bottling hall, tank decks, packing. Heavy plant of real value. Report of activity.',
    hazard: 3,
    cells: [11, 13],
    kinds: [['plant', 3], ['racking', 1.5], ['corridor', 1], ['office', 0.8], ['coldRoom', 0.5]],
    loot: [['carboy', 2], ['gauge', 3], ['busbar', 2.5], ['fanMotor', 2], ['meterHead', 2], ['teleprinter', 1.2], ['urn', 1.5], ['seal', 0.6]],
    lootPerCell: [3, 6],
    tint: 'plant',
  },
};
export const SITE_LIST = Object.values(SITES);

const EXTRA_DOOR_CHANCE = 0.32;
const DOOR_STARTS = [5, 9, 14, 14, 19, 23];
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const MAX_X = 3; // the building is at most 7 cells wide

const cache = new Map();
const key = (cx, cz) => `${cx},${cz}`;

/**
 * The layout of a site for one night: { seed, siteId, night, cells: Map<"cx,cz", { cx, cz, kindId,
 * doors: { N, E, S, W } }> }. Doors are { start, end, mid } tile ranges along the edge, or null.
 */
export function siteLayout(worldSeed, siteId, night) {
  const ck = `${worldSeed}|${siteId}|${night}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const site = SITES[siteId];
  const seed = hash(worldSeed, 'site', siteId, night);
  const rng = new RNG(seed);
  const target = rng.int(site.cells[0], site.cells[1]);

  // grow a tree of cells north from the entry
  const cells = new Map();
  const links = new Set(); // "a|b" edges with a door
  const link = (a, b) => links.add(a < b ? `${a}|${b}` : `${b}|${a}`);
  const add = (cx, cz, kindId) => cells.set(key(cx, cz), { cx, cz, kindId, doors: { N: null, E: null, S: null, W: null } });
  add(0, 0, 'yard');
  add(0, -1, 'dock');
  link('0,0', '0,-1');
  let guard = 0;
  while (cells.size < target + 1 && guard++ < 500) {
    const list = [...cells.values()].filter((c) => c.kindId !== 'yard');
    // favour growing from recent cells (long wings) but sometimes branch from old ones
    const from = rng.chance(0.6) ? list[list.length - 1 - rng.int(0, Math.min(2, list.length - 1))] : rng.pick(list);
    const dir = rng.weighted([['N', 3], ['E', 2], ['W', 2], ['S', 0.6]]);
    const [dx, dz] = DIRS[dir];
    const nx = from.cx + dx;
    const nz = from.cz + dz;
    if (nz > -1 || Math.abs(nx) > MAX_X || cells.has(key(nx, nz))) continue;
    add(nx, nz, null);
    link(key(from.cx, from.cz), key(nx, nz));
  }
  // loops: extra doors between neighbours that are both inside
  for (const c of cells.values()) {
    if (c.kindId === 'yard') continue;
    for (const dir of ['E', 'S']) {
      const [dx, dz] = DIRS[dir];
      const n = cells.get(key(c.cx + dx, c.cz + dz));
      if (!n || n.kindId === 'yard') continue;
      if (hashFloat(seed, 'loop', c.cx, c.cz, dir) < EXTRA_DOOR_CHANCE) link(key(c.cx, c.cz), key(n.cx, n.cz));
    }
  }
  // kinds: weighted by the site; re-roll once if it repeats the cell to the south
  const order = [...cells.values()].filter((c) => !c.kindId).sort((a, b) => b.cz - a.cz || a.cx - b.cx);
  for (const c of order) {
    c.kindId = rng.weighted(site.kinds);
    const south = cells.get(key(c.cx, c.cz + 1));
    if (south && south.kindId === c.kindId) c.kindId = rng.weighted(site.kinds);
  }
  // doors: positions hashed per edge so both cells agree
  for (const l of links) {
    const [a, b] = l.split('|');
    const ca = cells.get(a);
    const cb = cells.get(b);
    const dir = Object.keys(DIRS).find((d) => ca.cx + DIRS[d][0] === cb.cx && ca.cz + DIRS[d][1] === cb.cz);
    const yardEdge = ca.kindId === 'yard' || cb.kindId === 'yard';
    const s = yardEdge ? 14 : DOOR_STARTS[hash(seed, 'dp', l) % DOOR_STARTS.length];
    const door = { start: s, end: s + DOOR_TILES - 1, mid: s + (DOOR_TILES - 1) / 2 };
    ca.doors[dir] = door;
    cb.doors[OPP[dir]] = door;
  }
  const out = { seed, siteId, night, cells };
  cache.set(ck, out);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return out;
}

/** The cell record for (cx, cz) on a site, or null if the cell is not part of it. */
export function siteCell(worldSeed, siteId, night, cx, cz) {
  return siteLayout(worldSeed, siteId, night).cells.get(key(cx, cz)) || null;
}

/** Seed for everything inside one cell on one night. */
export function cellSeed(worldSeed, siteId, night, cx, cz) {
  // the docking deck (and the ship on it) is the same every night
  if (cx === 0 && cz === 0) return hash(worldSeed, 'yard');
  return hash(worldSeed, siteId, night, 'cell', cx, cz);
}
