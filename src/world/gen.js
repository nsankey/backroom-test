// generateCell: (worldSeed, cx, cz) -> everything needed to render, collide and simulate one
// place. Pure and deterministic. Runs in the cell worker.

import { hash, rngFor } from '../core/rng.js';
import { N, TILE } from './constants.js';
import { cellDoors, cellKindId } from './grid.js';
import { KINDS } from './kinds/index.js';
import { Plan } from './plan.js';
import { SceneBuilder } from './builder.js';
import { buildProp } from './props.js';

const HARD = new Set(['terrazzo', 'vinylCheck', 'whiteTile', 'concrete', 'threshold', 'stainless', 'parquet']);

export function planCell(worldSeed, cx, cz, kindOverride = null) {
  const kindId = kindOverride || cellKindId(worldSeed, cx, cz);
  const kind = KINDS[kindId];
  const doors = cellDoors(worldSeed, cx, cz);
  const seed = hash(worldSeed, 'cell', cx, cz);
  const plan = new Plan({ seed, cx, cz, doors, kindId });
  kind.layout(seed, plan);
  plan.openBoundaryDoors(kind.doorMats || {});
  return { plan, kind, seed };
}

export function generateCell(worldSeed, cx, cz, { kindOverride = null, bake = true } = {}) {
  const t0 = performance.now();
  const { plan, kind, seed } = planCell(worldSeed, cx, cz, kindOverride);
  const b = new SceneBuilder(plan);
  b.shell();
  const propRng = rngFor(seed, 'props');
  for (const p of plan.props) buildProp(b, p, propRng.fork(`${p.type}:${p.x.toFixed(2)}:${p.z.toFixed(2)}`));
  kind.build(b, rngFor(seed, 'build'));
  b.fixtures();

  // props block navigation where their colliders cover a tile centre
  for (const [x0, z0, x1, z1] of b.colliders) {
    for (let j = Math.max(0, Math.floor(z0 / TILE)); j <= Math.min(N - 1, Math.floor(z1 / TILE)); j++)
      for (let i = Math.max(0, Math.floor(x0 / TILE)); i <= Math.min(N - 1, Math.floor(x1 / TILE)); i++) {
        const cxm = (i + 0.5) * TILE;
        const czm = (j + 0.5) * TILE;
        if (cxm > x0 - 0.1 && cxm < x1 + 0.1 && czm > z0 - 0.1 && czm < z1 + 0.1) plan.blocked[j * N + i] = 1;
      }
  }
  const chk = plan.checkDoors();
  if (!chk.ok) plan.notes.push(`unreachable doors: ${chk.unreachable.join(',')}`);

  if (bake) b.bake();
  const { meshes, transfer } = b.export();
  const zoneCeil = new Float32Array(plan.zones.map((z) => z.ceil));
  const zoneDoor = new Uint8Array(plan.zones.map((z) => (z.door ? 1 : 0)));
  const tiles = plan.tiles;
  const blocked = plan.blocked;
  const hard = new Uint8Array(N * N);
  for (let k = 0; k < N * N; k++) if (tiles[k] && HARD.has(plan.floorAt(k % N, (k / N) | 0))) hard[k] = 1;
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
      notes: plan.notes,
      meshes,
      ms: performance.now() - t0,
    },
    transfer: [...transfer, tiles.buffer, blocked.buffer],
  };
}
