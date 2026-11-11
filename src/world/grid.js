// Which kind sits in each cell of a site, and where its doors are. A thin layer over site.js so
// the generator only ever asks "what is at (cx, cz) tonight?". Pure functions of the site context
// { worldSeed, siteId, night }.

import { siteCell } from './site.js';

const NO_DOORS = { N: null, E: null, S: null, W: null };

export function cellDoors(ctx, cx, cz) {
  return siteCell(ctx.worldSeed, ctx.siteId, ctx.night, cx, cz)?.doors || NO_DOORS;
}

export function cellKindId(ctx, cx, cz) {
  return siteCell(ctx.worldSeed, ctx.siteId, ctx.night, cx, cz)?.kindId || null;
}

export { doorTiles, doorInside } from './doors.js';
