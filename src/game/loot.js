// Salvage placement: which items lie where tonight. A pure function of the site context and the
// cells' loot spots, so the host and every client agree without sending the list.

import { RNG, hash } from '../core/rng.js';
import { SITES, cellSeed } from '../world/site.js';
import { ITEMS } from './items.js';
import { siteValueK } from './run.js';
import { CELL } from '../world/constants.js';

/**
 * ctx: { worldSeed, siteId, night }; cells: [{ cx, cz, kindId, lootSpots }].
 * Returns item records: { id, type, value, x, y, z, yaw, holder: null, slot: 0, origin }.
 */
export function spawnLoot(ctx, cells) {
  const site = SITES[ctx.siteId];
  const k = siteValueK(ctx.siteId);
  const out = [];
  for (const c of cells) {
    if (c.kindId === 'yard') continue;
    const rng = new RNG(hash(cellSeed(ctx.worldSeed, ctx.siteId, ctx.night, c.cx, c.cz), 'loot'));
    const spots = [...c.lootSpots];
    // deeper cells are a little richer: the easy pickings near the door went first
    const depth = Math.abs(c.cz) + Math.abs(c.cx) * 0.5;
    let n = rng.int(site.lootPerCell[0], site.lootPerCell[1]) + (depth > 3 && rng.chance(0.5) ? 1 : 0);
    n = Math.min(n, spots.length);
    const used = [];
    for (let m = 0; m < n && spots.length; m++) {
      const s = spots.splice(rng.int(0, spots.length - 1), 1)[0];
      if (used.some((u) => Math.hypot(u.x - s.x, u.z - s.z) < 0.9)) {
        m--;
        continue;
      }
      used.push(s);
      const type = rng.weighted(site.loot);
      const [v0, v1] = ITEMS[type].value;
      out.push({
        id: `${c.cx},${c.cz}:${m}`,
        type,
        value: Math.round(rng.float(v0, v1) * k * (1 + Math.min(depth, 6) * 0.03)),
        x: +(c.cx * CELL + s.x).toFixed(3),
        y: s.y,
        z: +(c.cz * CELL + s.z).toFixed(3),
        yaw: +rng.float(0, Math.PI * 2).toFixed(3),
        holder: null,
        slot: 0,
        dropped: 0,
      });
    }
  }
  return out;
}
