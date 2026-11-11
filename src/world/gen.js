// generateCell: (site context, cx, cz) -> everything needed to render, collide and simulate one
// place. Pure and deterministic. Runs in the cell worker (and in Node for the checks).
// Site context: { worldSeed, siteId, night }.

import { rngFor } from '../core/rng.js';
import { N, TILE } from './constants.js';
import { cellDoors, cellKindId } from './grid.js';
import { cellSeed } from './site.js';
import { KINDS } from './kinds/index.js';
import { Plan } from './plan.js';
import { SceneBuilder } from './builder.js';
import { buildProp } from './props.js';

// footstep surfaces: 0 soft (carpet), 1 hard (concrete, tile), 2 metal (steel plate)
const SURFACE = {
  concrete: 1,
  sealedConcrete: 1,
  asphalt: 1,
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
  plan.openBoundaryDoors(kind.doorMats || {});
  return { plan, kind, seed };
}

export function generateCell(ctx, cx, cz, { kindOverride = null, bake = true } = {}) {
  const t0 = performance.now();
  const { plan, kind, seed } = planCell(ctx, cx, cz, kindOverride);
  const b = new SceneBuilder(plan);
  b.shell();
  const propRng = rngFor(seed, 'props');
  for (const p of plan.props) buildProp(b, p, propRng.fork(`${p.type}:${p.x.toFixed(2)}:${p.z.toFixed(2)}`));
  kind.build(b, rngFor(seed, 'build'));
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
