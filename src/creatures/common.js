// Shared creature simulation helpers: pathing, moving along a path, picking spots. Pure: every
// random choice is hashed from (site seed, creature id, tick), so the host's run is reproducible.

import { hashFloat } from '../core/rng.js';
import { CELL } from '../world/constants.js';
import { inVan } from '../game/van.js';

export const TICK_DT = 1 / 60;

/** Deterministic float in [0, 1) for this creature at this tick. */
export const roll = (ctx, s, tag) => hashFloat(ctx.seed, s.id, ctx.tick, tag);

/** Plan a path to (x, z); keeps the old one if no path is found. Returns true on success. */
export function pathTo(s, ctx, x, z, maxNodes = 9000) {
  const p = ctx.world.findPath(s.x, s.z, x, z, maxNodes);
  if (!p || !p.length) return false;
  s.path = p.map((q) => [+q.x.toFixed(2), +q.z.toFixed(2)]);
  // the first node is the tile it stands on: heading back to its centre on every replan would
  // make a slow walker shuffle on the spot
  s.pi = s.path.length > 1 ? 1 : 0;
  s.goal = [x, z];
  return true;
}

/** Walk along the current path at `speed` m/s. Returns true when it has arrived. */
export function follow(s, speed) {
  if (!s.path || s.pi >= s.path.length) return true;
  let step = speed * TICK_DT;
  while (step > 0 && s.pi < s.path.length) {
    const [tx, tz] = s.path[s.pi];
    const dx = tx - s.x;
    const dz = tz - s.z;
    const d = Math.hypot(dx, dz);
    if (d <= step) {
      s.x = tx;
      s.z = tz;
      step -= d;
      s.pi++;
    } else {
      s.x += (dx / d) * step;
      s.z += (dz / d) * step;
      step = 0;
      // turn smoothly toward the direction of travel
      const want = Math.atan2(-dx, -dz);
      let dy = want - s.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      s.yaw += dy * 0.12;
    }
  }
  s.moving = speed;
  return s.pi >= s.path.length;
}

/** Face a point over a few ticks. */
export function face(s, x, z, rate = 0.08) {
  const want = Math.atan2(-(x - s.x), -(z - s.z));
  let dy = want - s.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  s.yaw += dy * rate;
}

/** Inside the building proper (not the yard, not the van). Creatures keep to the facility. */
export const inBuilding = (x, z) => z < 0;

/** Players a creature may go after: alive, outside the van. */
export const prey = (ctx, building = true) => ctx.players.filter((p) => p.alive && !inVan(p.x, p.z) && (!building || inBuilding(p.x, p.z)));

/** A random walkable spot in a random facility bay (or in `cell` if given). */
export function randomSpot(ctx, s, tag, cell = null) {
  const cells = ctx.cells.filter((c) => c.kindId !== 'yard');
  for (let k = 0; k < 24; k++) {
    const c = cell || cells[Math.floor(roll(ctx, s, tag + 'c' + k) * cells.length)];
    const x = c.cx * CELL + 1 + roll(ctx, s, tag + 'x' + k) * (CELL - 2);
    const z = c.cz * CELL + 1 + roll(ctx, s, tag + 'z' + k) * (CELL - 2);
    if (ctx.world.isWalkable(x, z) && ctx.world.isWalkable(x + 0.3, z) && ctx.world.isWalkable(x - 0.3, z)) return { x, z };
  }
  return null;
}

/** A spawn point deep in the building and out of every player's sight. */
export function spawnSpot(ctx, s, tag) {
  const cells = ctx.cells.filter((c) => c.kindId !== 'yard' && c.kindId !== 'dock').sort((a, b) => a.cz - b.cz || Math.abs(b.cx) - Math.abs(a.cx));
  const deep = cells.slice(0, Math.max(1, Math.ceil(cells.length / 2)));
  for (let k = 0; k < 16; k++) {
    const c = deep[Math.floor(roll(ctx, s, tag + k) * deep.length)];
    const p = randomSpot(ctx, s, tag + 'p' + k, c);
    if (!p) continue;
    const seen = ctx.players.some((q) => q.alive && Math.hypot(q.x - p.x, q.z - p.z) < 14 && ctx.world.lineOfSight(q.x, q.z, p.x, p.z, 1.2));
    if (!seen) return p;
  }
  return randomSpot(ctx, s, tag + 'any');
}

export function nearest(list, x, z) {
  let best = null;
  let bd = Infinity;
  for (const q of list) {
    const d = Math.hypot(q.x - x, q.z - z);
    if (d < bd) (bd = d), (best = q);
  }
  return best ? { p: best, d: bd } : null;
}
