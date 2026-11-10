// Plan: the layout of one cell as plain data. Kinds fill it in from layout(seed, ctx).
// Coordinates: tile (i, j), i along +x, j along +z. Metres are cell-local (0..16).

import { N, TILE, DIRS, DOOR_HEIGHT, INNER_DOOR_HEIGHT } from './constants.js';
import { doorTiles, doorInside } from './doors.js';

export class Plan {
  constructor({ seed, cx, cz, doors, kindId }) {
    this.seed = seed;
    this.cx = cx;
    this.cz = cz;
    this.doors = doors;
    this.kindId = kindId;
    // zone 0 is "solid": no floor, no ceiling
    this.zones = [{ name: 'solid', ceil: 0 }];
    this.tiles = new Uint8Array(N * N);
    this.floorMat = new Array(N * N).fill(null);
    this.blocked = new Uint8Array(N * N);
    this.props = [];
    this.lights = [];
    this.points = {};
    this.interactions = [];
    this.ambient = [0.035, 0.04, 0.035];
    this.notes = [];
  }

  idx(i, j) {
    return j * N + i;
  }
  inside(i, j) {
    return i >= 0 && j >= 0 && i < N && j < N;
  }
  zoneAt(i, j) {
    return this.inside(i, j) ? this.zones[this.tiles[this.idx(i, j)]] : this.zones[0];
  }
  isFloor(i, j) {
    return this.inside(i, j) && this.tiles[this.idx(i, j)] !== 0;
  }
  isWalkable(i, j) {
    return this.isFloor(i, j) && !this.blocked[this.idx(i, j)];
  }
  ceilAt(i, j) {
    return this.zoneAt(i, j).ceil;
  }
  floorAt(i, j) {
    const k = this.idx(i, j);
    return this.floorMat[k] || this.zones[this.tiles[k]].floor;
  }

  /** Add a zone: { name, ceil, floor, wall, ceilMat }. Returns its index. */
  zone(z) {
    this.zones.push({ ceil: 2.8, floor: 'carpetGold', wall: 'wallpaperStripe', ceilMat: 'acoustic', ...z });
    return this.zones.length - 1;
  }

  /** Fill an inclusive tile rect with a zone (0 = solid). Clamped to the inner area. */
  fill(i0, j0, i1, j1, zone, { keepBoundary = true } = {}) {
    const lo = keepBoundary ? 1 : 0;
    const hi = keepBoundary ? N - 2 : N - 1;
    for (let j = Math.max(lo, Math.min(j0, j1)); j <= Math.min(hi, Math.max(j0, j1)); j++)
      for (let i = Math.max(lo, Math.min(i0, i1)); i <= Math.min(hi, Math.max(i0, i1)); i++)
        this.tiles[this.idx(i, j)] = zone;
  }

  /** Fill a rect given in metres (cell-local). */
  fillM(x0, z0, x1, z1, zone) {
    this.fill(Math.floor(x0 / TILE), Math.floor(z0 / TILE), Math.ceil(x1 / TILE) - 1, Math.ceil(z1 / TILE) - 1, zone);
  }

  paintFloor(i0, j0, i1, j1, mat) {
    for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++)
      for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++)
        if (this.isFloor(i, j)) this.floorMat[this.idx(i, j)] = mat;
  }

  /** Carve an L-shaped corridor between two tiles. Only carves through solid tiles. */
  corridor(a, b, width, zone, xFirst = true) {
    const [ai, aj] = a;
    const [bi, bj] = b;
    const lo = -Math.floor((width - 1) / 2);
    const hi = lo + width - 1;
    const carve = (i, j) => {
      for (let d = lo; d <= hi; d++)
        for (let e = lo; e <= hi; e++) {
          const ii = i + d;
          const jj = j + e;
          if (ii >= 1 && jj >= 1 && ii <= N - 2 && jj <= N - 2 && this.tiles[this.idx(ii, jj)] === 0)
            this.tiles[this.idx(ii, jj)] = zone;
        }
    };
    const stepTo = (from, to, fn) => {
      const s = Math.sign(to - from) || 1;
      for (let v = from; v !== to + s; v += s) fn(v);
    };
    if (xFirst) {
      stepTo(ai, bi, (i) => carve(i, aj));
      stepTo(aj, bj, (j) => carve(bi, j));
    } else {
      stepTo(aj, bj, (j) => carve(ai, j));
      stepTo(ai, bi, (i) => carve(i, bj));
    }
  }

  /** Carve a corridor from every boundary door to a target tile. */
  connectDoors(target, width, zone) {
    for (const d of DIRS) {
      const door = this.doors[d];
      if (!door) continue;
      const inside = doorInside(d, door);
      this.corridor(inside, target, width, zone, d === 'E' || d === 'W');
    }
  }

  /** A doorway through a wall: tiles become a low-ceilinged door zone. */
  doorway(i0, j0, i1, j1, { wall = 'doorFrame', floor = 'threshold' } = {}) {
    const z = this.zone({ name: 'doorway', ceil: INNER_DOOR_HEIGHT, floor, wall, ceilMat: wall, door: true });
    this.fill(i0, j0, i1, j1, z);
    return z;
  }

  /** Open the boundary doorways (called by the generator after layout). */
  openBoundaryDoors(mats) {
    for (const d of DIRS) {
      const door = this.doors[d];
      if (!door) continue;
      const z = this.zone({
        name: 'boundary-door',
        ceil: DOOR_HEIGHT,
        floor: mats.floor || 'threshold',
        wall: mats.wall || 'doorFrame',
        ceilMat: mats.wall || 'doorFrame',
        door: true,
        boundary: d,
      });
      for (const [i, j] of doorTiles(d, door)) this.tiles[this.idx(i, j)] = z;
      // make sure the tile just inside is floor so the door never opens onto a wall
      const [ii, jj] = doorInside(d, door);
      for (let k = -1; k <= 1; k++) {
        const ti = d === 'N' || d === 'S' ? ii + k : ii;
        const tj = d === 'N' || d === 'S' ? jj : jj + k;
        if (this.tiles[this.idx(ti, tj)] === 0) {
          this.notes.push(`door ${d} opened onto solid; patched`);
          this.tiles[this.idx(ti, tj)] = this.fallbackZone();
        }
      }
    }
  }

  fallbackZone() {
    for (let k = 1; k < this.zones.length; k++) if (!this.zones[k].door) return k;
    return this.zone({ name: 'fallback' });
  }

  /** Ceiling troffers over a metre rect, on a grid; only placed above floor of a non-door zone. */
  troffers(x0, z0, x1, z1, { spacing = 2.4, flickerChance = 0, rng = null, power = 1, color, skipChance = 0 } = {}) {
    const nx = Math.max(1, Math.round((x1 - x0) / spacing));
    const nz = Math.max(1, Math.round((z1 - z0) / spacing));
    const sx = (x1 - x0) / nx;
    const sz = (z1 - z0) / nz;
    for (let a = 0; a < nx; a++)
      for (let b = 0; b < nz; b++) {
        const x = x0 + sx * (a + 0.5);
        const z = z0 + sz * (b + 0.5);
        const i = Math.floor(x / TILE);
        const j = Math.floor(z / TILE);
        if (!this.isFloor(i, j) || this.zoneAt(i, j).door) continue;
        if (rng && skipChance && rng.chance(skipChance)) continue;
        const flicker = rng && flickerChance ? rng.chance(flickerChance) : false;
        this.troffer(x, z, { flicker, power, color, rot: sx >= sz ? 0 : Math.PI / 2 });
      }
  }

  /**
   * The lights never turned off: put a troffer over any floor tile of the given zones that has no
   * light within `gap` metres (branch corridors carved by connectDoors, mostly). Deterministic
   * scan order; flicker comes from the caller's rng.
   */
  fillDarkGaps(zones, { gap = 4, power = 0.7, rng = null, flickerChance = 0.2 } = {}) {
    const set = new Set(zones);
    for (let j = 1; j < N - 1; j++)
      for (let i = 1; i < N - 1; i++) {
        const zi = this.tiles[this.idx(i, j)];
        if (!set.has(zi) || this.zones[zi].door) continue;
        const x = (i + 0.5) * TILE;
        const z = (j + 0.5) * TILE;
        let near = false;
        for (const l of this.lights) if ((l.x - x) ** 2 + (l.z - z) ** 2 < gap * gap) near = true;
        if (near) continue;
        // centre the fixture across a narrow corridor
        const wide = (di, dj) => {
          let n = 0;
          while (n < 4 && set.has(this.tiles[this.idx(i + di * (n + 1), j + dj * (n + 1))])) n++;
          return n;
        };
        const ox = (wide(1, 0) - wide(-1, 0)) * 0.5 * TILE;
        const oz = (wide(0, 1) - wide(0, -1)) * 0.5 * TILE;
        const alongX = wide(1, 0) + wide(-1, 0) >= wide(0, 1) + wide(0, -1);
        const cx = alongX ? x : x + Math.max(-0.5, Math.min(0.5, ox));
        const cz = alongX ? z + Math.max(-0.5, Math.min(0.5, oz)) : z;
        this.troffer(cx, cz, { power, flicker: rng ? rng.chance(flickerChance) : false, rot: alongX ? 0 : Math.PI / 2 });
      }
  }

  troffer(x, z, { flicker = false, power = 1, color = [0.86, 1.0, 0.84], rot = 0 } = {}) {
    const i = Math.floor(x / TILE);
    const j = Math.floor(z / TILE);
    const ceil = this.ceilAt(i, j);
    this.lights.push({ type: 'troffer', x, y: ceil - 0.03, z, color, power: 2.6 * power, range: 9, flicker, rot, fixture: true });
  }

  /** A generic light. type: 'point' (omni) or 'troffer' (down-facing). fixture: draw geometry. */
  light(l) {
    this.lights.push({ type: 'point', color: [1, 0.8, 0.55], power: 1, range: 6, flicker: false, fixture: false, ...l });
  }

  /** Record a prop for build(). x, z in metres; rot in radians. */
  prop(type, x, z, rot = 0, params = {}) {
    const p = { type, x, z, rot, ...params };
    this.props.push(p);
    return p;
  }

  /** Mark tiles under a metre rect as blocked for navigation. */
  block(x0, z0, x1, z1) {
    for (let j = Math.floor(Math.min(z0, z1) / TILE); j <= Math.floor((Math.max(z0, z1) - 0.001) / TILE); j++)
      for (let i = Math.floor(Math.min(x0, x1) / TILE); i <= Math.floor((Math.max(x0, x1) - 0.001) / TILE); i++)
        if (this.inside(i, j)) this.blocked[this.idx(i, j)] = 1;
  }

  /** Named point (spawn spots, lore prop spot, resident spot...). */
  point(name, x, z, extra = {}) {
    this.points[name] = { x, z, ...extra };
  }

  /** Flood fill over walkable tiles from the first door; returns the set of reachable doors. */
  checkDoors() {
    const doorDirs = DIRS.filter((d) => this.doors[d]);
    if (!doorDirs.length) return { ok: true, unreachable: [] };
    const seen = new Uint8Array(N * N);
    const [si, sj] = doorTiles(doorDirs[0], this.doors[doorDirs[0]])[1];
    const stack = [[si, sj]];
    seen[this.idx(si, sj)] = 1;
    while (stack.length) {
      const [i, j] = stack.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (!this.inside(ni, nj)) continue;
        const k = this.idx(ni, nj);
        if (seen[k] || !this.isWalkable(ni, nj)) continue;
        seen[k] = 1;
        stack.push([ni, nj]);
      }
    }
    const unreachable = doorDirs.filter((d) => {
      const [i, j] = doorTiles(d, this.doors[d])[1];
      return !seen[this.idx(i, j)];
    });
    return { ok: unreachable.length === 0, unreachable, seen };
  }
}
