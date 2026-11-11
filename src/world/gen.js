// generateCell: (site context, cx, cz) -> everything needed to render, collide and simulate one
// place. Pure and deterministic. Runs in the cell worker (and in Node for the checks).
// Site context: { worldSeed, siteId, night }.

import { rngFor } from '../core/rng.js';
import { N, TILE } from './constants.js';
import { cellDoors, cellKindId } from './grid.js';
import { cellSeed, siteCell } from './site.js';
import { KINDS } from './kinds/index.js';
import { Plan } from './plan.js';
import { SceneBuilder } from './builder.js';
import { buildProp } from './props.js';
import { dress } from './dress.js';

// footstep surfaces: 0 soft (carpet), 1 hard (tile, rubber), 2 metal (steel plate)
// (the deck materials keep their old names: sealedConcrete, concrete and asphalt are all
// painted steel deck plate now)
const SURFACE = {
  concrete: 2,
  sealedConcrete: 2,
  asphalt: 2,
  freezerFloor: 1,
  quarryTile: 1,
  threshold: 1,
  lino: 1,
  diamondPlate: 2,
  steelGrate: 2,
};

export function planCell(ctx, cx, cz, kindOverride = null) {
  const kindId = kindOverride || cellKindId(ctx, cx, cz);
  const kind = KINDS[kindId];
  if (!kind) throw new Error(`no kind for cell ${cx},${cz} (${kindId})`);
  const doors = cellDoors(ctx, cx, cz);
  const seed = cellSeed(ctx.worldSeed, ctx.siteId, ctx.night, cx, cz);
  const plan = new Plan({ seed, cx, cz, doors, kindId, siteId: ctx.siteId });
  kind.layout(seed, plan);
  if (kindId !== 'yard' && ctx.siteId) portholes(ctx, plan, seed);
  plan.openBoundaryDoors(kind.doorMats || {});
  return { plan, kind, seed };
}

/**
 * Portholes in the walls that face space: on every edge of the cell with no cell of the craft
 * beyond it, a few round ports along the first wall in from the edge, clear of props.
 */
function portholes(ctx, plan, seed) {
  const rng = rngFor(seed, 'ports');
  const near = (x, z, r) => plan.props.some((p) => Math.hypot(p.x - x, p.z - z) < r);
  for (const [dir, dx, dz, rot] of [['N', 0, -1, 0], ['S', 0, 1, Math.PI], ['W', -1, 0, Math.PI / 2], ['E', 1, 0, -Math.PI / 2]]) {
    if (siteCell(ctx.worldSeed, ctx.siteId, ctx.night, plan.cx + dx, plan.cz + dz)) continue;
    // depth of the first floor tile in from the edge, at position k along it
    const tileAt = (k, d) => (dir === 'N' ? [k, d] : dir === 'S' ? [k, N - 1 - d] : dir === 'W' ? [d, k] : [N - 1 - d, k]);
    const depth = (k) => {
      for (let d = 1; d < 10; d++) {
        const [i, j] = tileAt(k, d);
        if (plan.isFloor(i, j)) return d;
      }
      return -1;
    };
    let last = -99;
    for (let k = 3; k < N - 3; k++) {
      if (k - last < 6) continue;
      const d = depth(k);
      if (d < 0 || depth(k - 1) !== d || depth(k + 1) !== d) continue;
      const [i, j] = tileAt(k, d);
      const zone = plan.zoneAt(i, j);
      if (zone.sky || zone.door || zone.ceil < 2.3) continue;
      // the wall face, in metres, and the port's centre on it
      const along = (k + 0.5) * TILE;
      const face = dir === 'N' || dir === 'W' ? d * TILE : (N - d) * TILE;
      const x = dir === 'N' || dir === 'S' ? along : face;
      const z = dir === 'N' || dir === 'S' ? face : along;
      if (near(x, z, 1.8)) continue;
      if (!rng.chance(0.55)) continue;
      const big = zone.ceil > 4;
      plan.prop('porthole', x, z, rot, { y: big ? 1.9 : Math.min(1.55, zone.ceil - 0.7), r: big ? 0.34 : 0.24 });
      last = k;
    }
  }
}

export function generateCell(ctx, cx, cz, { kindOverride = null, bake = true } = {}) {
  const t0 = performance.now();
  const { plan, kind, seed } = planCell(ctx, cx, cz, kindOverride);
  const b = new SceneBuilder(plan);
  b.shell();
  const propRng = rngFor(seed, 'props');
  for (const p of plan.props) buildProp(b, p, propRng.fork(`${p.type}:${p.x.toFixed(2)}:${p.z.toFixed(2)}`));
  kind.build(b, rngFor(seed, 'build'));
  if (plan.kindId !== 'yard') dress(b, plan, rngFor(seed, 'dress'));
  b.fixtures();

  // props block navigation where their colliders cover a tile centre
  for (const [x0, z0, x1, z1, top] of b.colliders) {
    if (top < 0.25) continue;
    for (let j = Math.max(0, Math.floor(z0 / TILE)); j <= Math.min(N - 1, Math.floor(z1 / TILE)); j++)
      for (let i = Math.max(0, Math.floor(x0 / TILE)); i <= Math.min(N - 1, Math.floor(x1 / TILE)); i++) {
        const cxm = (i + 0.5) * TILE;
        const czm = (j + 0.5) * TILE;
        if (cxm > x0 - 0.1 && cxm < x1 + 0.1 && czm > z0 - 0.1 && czm < z1 + 0.1) plan.blocked[j * N + i] = 1;
      }
  }
  const chk = plan.checkDoors();
  if (!chk.ok) plan.notes.push(`unreachable doors: ${chk.unreachable.join(',')}`);
  // loot spots must be reachable too (a spot behind a prop is useless)
  if (chk.seen) {
    plan.lootSpots = plan.lootSpots.filter((s) => {
      for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const i = Math.floor(s.x / TILE) + di;
        const j = Math.floor(s.z / TILE) + dj;
        if (i >= 0 && j >= 0 && i < N && j < N && chk.seen[j * N + i]) return true;
      }
      return false;
    });
  }

  if (bake) b.bake();
  const { meshes, transfer } = b.export();
  const zoneCeil = new Float32Array(plan.zones.map((z) => z.ceil));
  const zoneDoor = new Uint8Array(plan.zones.map((z) => (z.door ? 1 : 0)));
  const tiles = plan.tiles;
  const blocked = plan.blocked;
  const hard = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) if (tiles[k]) hard[k] = SURFACE[plan.floorAt(k % N, (k / N) | 0)] || 0;
  transfer.push(zoneCeil.buffer, zoneDoor.buffer, hard.buffer);
  return {
    data: {
      cx,
      cz,
      seed,
      kindId: plan.kindId,
      doors: plan.doors,
      tiles,
      blocked,
      hard,
      zoneCeil,
      zoneDoor,
      colliders: b.colliders,
      lights: plan.lights.map((l) => ({ type: l.type, x: l.x, y: l.y, z: l.z, color: l.color, power: l.power, flicker: !!l.flicker })),
      points: plan.points,
      interactions: plan.interactions,
      lootSpots: plan.lootSpots,
      notes: plan.notes,
      meshes,
      ms: performance.now() - t0,
    },
    transfer: [...transfer, tiles.buffer, blocked.buffer],
  };
}
