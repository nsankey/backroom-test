// World: streams cells around the player from the cell worker, builds their meshes, and
// answers spatial queries (walkable? ceiling? colliders?) for the simulation.

import * as THREE from 'three';
import { CELL, TILE, N, cellKey } from './constants.js';
import { KINDS } from './kinds/index.js';

const LOAD_RADIUS = 1; // 3 x 3 cells around the player
const KEEP_RADIUS = 2;

export class World {
  constructor(scene, materials, worldSeed) {
    this.scene = scene;
    this.mats = materials;
    this.seed = worldSeed;
    this.cells = new Map(); // key -> cell
    this.requested = new Map(); // key -> promise
    this.worker = new Worker(new URL('./cell.worker.js', import.meta.url), { type: 'module' });
    this.nextId = 1;
    this.waiting = new Map();
    this.worker.onmessage = (e) => {
      const { id, data, error } = e.data;
      const w = this.waiting.get(id);
      this.waiting.delete(id);
      if (error) {
        console.error('cell generation failed', error);
        w?.reject(new Error(error));
      } else w?.resolve(data);
    };
    this.buildQueue = [];
    this.onCellAdded = null;
    this.kindOverrides = new Map(); // debug: force a kind at a cell ("jump to a kind")
  }

  generate(cx, cz, kindOverride = this.kindOverrides.get(cellKey(cx, cz)) || null) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.worker.postMessage({ id, worldSeed: this.seed, cx, cz, kindOverride });
    });
  }

  /** Make sure the cells around (x, z) are loaded; returns a promise for the centre cell. */
  ensureAround(x, z) {
    const ccx = Math.floor(x / CELL);
    const ccz = Math.floor(z / CELL);
    const order = [];
    for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++)
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) order.push([ccx + dx, ccz + dz, Math.abs(dx) + Math.abs(dz)]);
    order.sort((a, b) => a[2] - b[2]);
    for (const [cx, cz] of order) this.request(cx, cz);
    // unload far cells
    for (const [key, cell] of this.cells) {
      if (Math.abs(cell.cx - ccx) > KEEP_RADIUS || Math.abs(cell.cz - ccz) > KEEP_RADIUS) this.unload(key);
    }
    return this.requested.get(cellKey(ccx, ccz));
  }

  request(cx, cz) {
    const key = cellKey(cx, cz);
    if (this.requested.has(key)) return this.requested.get(key);
    const p = this.generate(cx, cz).then((data) => {
      if (!this.requested.has(key)) return null; // unloaded while generating
      return new Promise((resolve) => this.buildQueue.push({ data, resolve }));
    });
    this.requested.set(key, p);
    return p;
  }

  /** Build at most one queued cell per frame, to keep frame times flat. */
  update(maxMs = 4) {
    const t0 = performance.now();
    while (this.buildQueue.length && performance.now() - t0 < maxMs) {
      const { data, resolve } = this.buildQueue.shift();
      const key = cellKey(data.cx, data.cz);
      if (!this.requested.has(key)) {
        resolve(null);
        continue;
      }
      const cell = this.buildCell(data);
      this.cells.set(key, cell);
      if (this.onCellAdded) this.onCellAdded(cell);
      resolve(cell);
    }
  }

  buildCell(data) {
    const group = new THREE.Group();
    group.position.set(data.cx * CELL, 0, data.cz * CELL);
    group.name = `cell ${data.cx},${data.cz} ${data.kindId}`;
    const uniforms = { uFlicker: { value: 1 }, uDim: { value: 1 } };
    const materials = [];
    for (const m of data.meshes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      g.setAttribute('bakeA', new THREE.BufferAttribute(m.bakeA, 3));
      g.setAttribute('bakeB', new THREE.BufferAttribute(m.bakeB, 3));
      g.setIndex(new THREE.BufferAttribute(m.index, 1));
      g.computeBoundingSphere();
      const mat = this.mats.instance(m.mat, m.glow, uniforms);
      materials.push(mat);
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    group.updateMatrixWorld(true);
    this.scene.add(group);
    if (data.notes?.length) console.warn(`cell ${data.cx},${data.cz} (${data.kindId}):`, data.notes.join('; '));
    return {
      ...data,
      key: cellKey(data.cx, data.cz),
      kind: KINDS[data.kindId],
      group,
      uniforms,
      materials,
      ox: data.cx * CELL,
      oz: data.cz * CELL,
      flicker: { phase: 0, level: 1 },
    };
  }

  unload(key) {
    const cell = this.cells.get(key);
    this.requested.delete(key);
    if (!cell) return;
    this.cells.delete(key);
    this.scene.remove(cell.group);
    cell.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    for (const m of cell.materials) m.dispose();
    if (this.onCellRemoved) this.onCellRemoved(cell);
  }

  cellAt(x, z) {
    return this.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
  }

  /** Tile info at a world position: { cell, i, j, floor, ceil, door } or null if unloaded. */
  tileAt(x, z) {
    const cell = this.cellAt(x, z);
    if (!cell) return null;
    const i = Math.floor((x - cell.ox) / TILE);
    const j = Math.floor((z - cell.oz) / TILE);
    if (i < 0 || j < 0 || i >= N || j >= N) return null;
    const zi = cell.tiles[j * N + i];
    return {
      cell,
      i,
      j,
      floor: zi !== 0,
      ceil: cell.zoneCeil[zi],
      door: cell.zoneDoor[zi] === 1,
      blocked: cell.blocked[j * N + i] === 1,
      hard: cell.hard[j * N + i] === 1,
    };
  }

  isFloor(x, z) {
    const t = this.tileAt(x, z);
    return !!t && t.floor;
  }

  isWalkable(x, z) {
    const t = this.tileAt(x, z);
    return !!t && t.floor && !t.blocked;
  }

  /**
   * Axis-aligned boxes near (x, z) that a body of radius r collides with: solid tiles and
   * prop colliders, in world coordinates. Out-of-world (unloaded) tiles count as solid.
   */
  collidersNear(x, z, r, out = []) {
    out.length = 0;
    const reach = r + TILE;
    const i0 = Math.floor((x - reach) / TILE);
    const i1 = Math.floor((x + reach) / TILE);
    const j0 = Math.floor((z - reach) / TILE);
    const j1 = Math.floor((z + reach) / TILE);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const wx = (i + 0.5) * TILE;
        const wz = (j + 0.5) * TILE;
        const t = this.tileAt(wx, wz);
        if (!t || !t.floor) out.push([i * TILE, j * TILE, (i + 1) * TILE, (j + 1) * TILE]);
      }
    const seen = new Set();
    for (const [dx, dz] of [[0, 0], [-reach, 0], [reach, 0], [0, -reach], [0, reach]]) {
      const cell = this.cellAt(x + dx, z + dz);
      if (!cell || seen.has(cell)) continue;
      seen.add(cell);
      for (const c of cell.colliders) {
        const bx0 = c[0] + cell.ox;
        const bz0 = c[1] + cell.oz;
        const bx1 = c[2] + cell.ox;
        const bz1 = c[3] + cell.oz;
        if (bx1 < x - reach || bx0 > x + reach || bz1 < z - reach || bz0 > z + reach) continue;
        if (c[4] < 0.25) continue; // low enough to ignore (rugs, papers)
        out.push([bx0, bz0, bx1, bz1]);
      }
    }
    return out;
  }

  /**
   * Approximate light level at a world point from the baked fixtures of nearby cells
   * (no occlusion), including flicker and dimming. Used to light moving figures.
   */
  lightAt(x, y, z, out = [0, 0, 0]) {
    out[0] = out[1] = out[2] = 0;
    const seen = new Set();
    for (const [dx, dz] of [[0, 0], [-6, 0], [6, 0], [0, -6], [0, 6]]) {
      const cell = this.cellAt(x + dx, z + dz);
      if (!cell || seen.has(cell)) continue;
      seen.add(cell);
      const dim = cell.uniforms.uDim.value;
      const fl = cell.uniforms.uFlicker.value;
      for (const l of cell.lights) {
        const lx = l.x + cell.ox - x;
        const ly = l.y - y;
        const lz = l.z + cell.oz - z;
        const d2 = lx * lx + ly * ly + lz * lz;
        if (d2 > 64) continue;
        if (!this.lineOfSight(x, z, l.x + cell.ox, l.z + cell.oz, Math.min(y, 1.2))) continue;
        const k = (l.power * 0.5 * dim * (l.flicker ? fl : 1)) / (d2 + 1.5);
        out[0] += l.color[0] * k;
        out[1] += l.color[1] * k;
        out[2] += l.color[2] * k;
      }
    }
    return out;
  }

  /**
   * A* over walkable tiles across loaded cells. Returns world-space waypoints (tile centres)
   * or null. Bounded so it never stalls a tick.
   */
  findPath(ax, az, bx, bz, maxNodes = 3000) {
    const T = TILE;
    const si = Math.floor(ax / T);
    const sj = Math.floor(az / T);
    const gi = Math.floor(bx / T);
    const gj = Math.floor(bz / T);
    if (!this.isWalkable((gi + 0.5) * T, (gj + 0.5) * T)) return null;
    const key = (i, j) => i * 100003 + j;
    const open = new Heap();
    open.push([si, sj, 0, Math.hypot(gi - si, gj - sj)]);
    const came = new Map();
    const g = new Map([[key(si, sj), 0]]);
    const closed = new Set();
    let n = 0;
    const walkCache = new Map();
    const walk = (i, j) => {
      const k = key(i, j);
      let v = walkCache.get(k);
      if (v === undefined) walkCache.set(k, (v = this.isWalkable((i + 0.5) * T, (j + 0.5) * T)));
      return v;
    };
    while (open.size && n++ < maxNodes) {
      const [i, j, gc] = open.pop();
      const ck = key(i, j);
      if (closed.has(ck)) continue;
      closed.add(ck);
      if (i === gi && j === gj) {
        const pts = [];
        let k = key(i, j);
        let cur = [i, j];
        while (cur) {
          pts.push({ x: (cur[0] + 0.5) * T, z: (cur[1] + 0.5) * T });
          cur = came.get(k);
          if (cur) k = key(cur[0], cur[1]);
        }
        return pts.reverse();
      }
      for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
        const ni = i + di;
        const nj = j + dj;
        if (!walk(ni, nj)) continue;
        if (di && dj && (!walk(i + di, j) || !walk(i, j + dj))) continue;
        const ng = gc + c;
        const nk = key(ni, nj);
        if (g.has(nk) && g.get(nk) <= ng) continue;
        g.set(nk, ng);
        came.set(nk, [i, j]);
        open.push([ni, nj, ng, ng + Math.hypot(gi - ni, gj - nj)]);
      }
    }
    return null;
  }

  /** Line of sight in xz across loaded tiles at a given height. (See Heap below.) */
  lineOfSight(ax, az, bx, bz, y = 1.5) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.2);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const tile = this.tileAt(ax + dx * t, az + dz * t);
      if (!tile || !tile.floor || tile.ceil < y) return false;
    }
    return true;
  }

  dispose() {
    for (const key of [...this.cells.keys()]) this.unload(key);
    this.worker.terminate();
  }
}

/** Minimal binary min-heap on item[3] (f-score) for A*. */
class Heap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][3] <= a[i][3]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][3] < a[m][3]) m = l;
        if (r < a.length && a[r][3] < a[m][3]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}
