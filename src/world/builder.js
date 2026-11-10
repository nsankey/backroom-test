// SceneBuilder: turns a Plan into raw geometry arrays (no three.js), then bakes lighting into
// the vertices. Runs in a worker. Kinds call its box/cyl/glow methods from build(scene, rng).

import { N, TILE } from './constants.js';
import { SIGN_ROWS, SIGN_ROW_COUNT } from './signs.js';

const SEG = 0.6; // max face subdivision for vertex lighting

class Buf {
  constructor(mat, glow) {
    this.mat = mat;
    this.glow = glow;
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.a = []; // steady light (or emissive colour)
    this.b = []; // flicker-group light
    this.idx = [];
    this.lit = []; // per-vertex: should bake (1) or not (0)
  }
  get count() {
    return this.pos.length / 3;
  }
}

export class SceneBuilder {
  constructor(plan) {
    this.plan = plan;
    this.bufs = new Map();
    this.colliders = []; // [x0, z0, x1, z1, yTop] cell-local metres
    this.stack = [{ x: 0, y: 0, z: 0, c: 1, s: 0 }];
  }

  buf(mat, glow = false) {
    const key = glow ? `glow:${mat}` : mat;
    let b = this.bufs.get(key);
    if (!b) {
      b = new Buf(mat, glow);
      this.bufs.set(key, b);
    }
    return b;
  }

  // ---- transforms -------------------------------------------------------------------------

  /** Push a local frame: translate (x, y, z) then rotate rot radians about Y. */
  push(x = 0, z = 0, rot = 0, y = 0) {
    const t = this.stack[this.stack.length - 1];
    const wx = t.x + x * t.c + z * t.s;
    const wz = t.z - x * t.s + z * t.c;
    const ang = Math.atan2(t.s, t.c) + rot;
    this.stack.push({ x: wx, y: t.y + y, z: wz, c: Math.cos(ang), s: Math.sin(ang) });
  }
  pop() {
    this.stack.pop();
  }
  _p(x, y, z) {
    const t = this.stack[this.stack.length - 1];
    return [t.x + x * t.c + z * t.s, t.y + y, t.z - x * t.s + z * t.c];
  }
  _n(x, y, z) {
    const t = this.stack[this.stack.length - 1];
    return [x * t.c + z * t.s, y, -x * t.s + z * t.c];
  }

  // ---- primitives -------------------------------------------------------------------------

  /**
   * A subdivided quad. o: origin corner, u/v: edge vectors (full length), local space.
   * Normal is u x v. uv0: texture coords (metres) at origin; uv runs along u and v in metres.
   * opts: { glow: [r,g,b], flicker, seg, uvScale }
   */
  face(mat, o, u, v, uv0 = [0, 0], opts = {}) {
    const lu = Math.hypot(u[0], u[1], u[2]);
    const lv = Math.hypot(v[0], v[1], v[2]);
    const seg = opts.seg ?? SEG;
    const nu = Math.max(1, Math.ceil(lu / seg - 0.01));
    const nv = Math.max(1, Math.ceil(lv / seg - 0.01));
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n = this._n(n[0] / nl, n[1] / nl, n[2] / nl);
    const glow = !!opts.glow;
    const b = this.buf(mat, glow);
    const base = b.count;
    const us = opts.uvScale ?? 1;
    for (let jv = 0; jv <= nv; jv++)
      for (let iu = 0; iu <= nu; iu++) {
        const fu = iu / nu;
        const fv = jv / nv;
        const p = this._p(o[0] + u[0] * fu + v[0] * fv, o[1] + u[1] * fu + v[1] * fv, o[2] + u[2] * fu + v[2] * fv);
        b.pos.push(p[0], p[1], p[2]);
        b.nrm.push(n[0], n[1], n[2]);
        if (opts.uvRect) {
          const r = opts.uvRect;
          b.uv.push(r[0] + (r[2] - r[0]) * fu, r[1] + (r[3] - r[1]) * fv);
        } else b.uv.push((uv0[0] + lu * fu) * us, (uv0[1] + lv * fv) * us);
        if (glow) {
          const g = opts.glow;
          if (opts.flicker) b.a.push(0, 0, 0), b.b.push(g[0], g[1], g[2]);
          else b.a.push(g[0], g[1], g[2]), b.b.push(0, 0, 0);
          b.lit.push(0);
        } else {
          b.a.push(0, 0, 0);
          b.b.push(0, 0, 0);
          b.lit.push(1);
        }
      }
    const row = nu + 1;
    for (let jv = 0; jv < nv; jv++)
      for (let iu = 0; iu < nu; iu++) {
        const a = base + jv * row + iu;
        b.idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
      }
  }

  /**
   * Axis-aligned box in the current frame. (x, y, z) is the centre of the bottom face.
   * opts: { rot, skip: 'top,bottom,...', collide, glow, flicker, seg, uvScale }
   */
  box(mat, x, y, z, sx, sy, sz, opts = {}) {
    const rot = opts.rot || 0;
    if (rot) this.push(x, z, rot, 0);
    const cx = rot ? 0 : x;
    const cz = rot ? 0 : z;
    const hx = sx / 2;
    const hz = sz / 2;
    const y0 = y;
    const y1 = y + sy;
    const skip = opts.skip || '';
    const f = (name, o, u, v, uv0) => {
      if (!skip.includes(name)) this.face(mat, o, u, v, uv0, opts);
    };
    f('px', [cx + hx, y0, cz + hz], [0, 0, -sz], [0, sy, 0], [0, y0]);
    f('nx', [cx - hx, y0, cz - hz], [0, 0, sz], [0, sy, 0], [0, y0]);
    f('pz', [cx - hx, y0, cz + hz], [sx, 0, 0], [0, sy, 0], [0, y0]);
    f('nz', [cx + hx, y0, cz - hz], [-sx, 0, 0], [0, sy, 0], [0, y0]);
    f('top', [cx - hx, y1, cz + hz], [sx, 0, 0], [0, 0, -sz], [0, 0]);
    f('bottom', [cx - hx, y0, cz - hz], [sx, 0, 0], [0, 0, sz], [0, 0]);
    if (opts.collide) this.collideBox(cx, cz, sx, sz, y1);
    if (rot) this.pop();
  }

  /** Register a collider for a box in the current frame (AABB of its rotated footprint). */
  collideBox(cx, cz, sx, sz, top = 2) {
    const hx = sx / 2;
    const hz = sz / 2;
    const pts = [
      this._p(cx - hx, 0, cz - hz),
      this._p(cx + hx, 0, cz - hz),
      this._p(cx + hx, 0, cz + hz),
      this._p(cx - hx, 0, cz + hz),
    ];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      z0 = Math.min(z0, p[2]);
      z1 = Math.max(z1, p[2]);
    }
    this.colliders.push([x0, z0, x1, z1, top]);
  }

  /** Vertical cylinder (or cone if r1 != r0). (x, y, z) = centre of the bottom. */
  cyl(mat, x, y, z, r0, h, opts = {}) {
    const r1 = opts.r1 ?? r0;
    const segs = opts.segs ?? 10;
    const glow = !!opts.glow;
    const b = this.buf(mat, glow);
    const push = (p, n, uv) => {
      const wp = this._p(p[0], p[1], p[2]);
      const wn = this._n(n[0], n[1], n[2]);
      b.pos.push(wp[0], wp[1], wp[2]);
      b.nrm.push(wn[0], wn[1], wn[2]);
      b.uv.push(uv[0], uv[1]);
      if (glow) {
        const g = opts.glow;
        if (opts.flicker) b.a.push(0, 0, 0), b.b.push(...g);
        else b.a.push(...g), b.b.push(0, 0, 0);
        b.lit.push(0);
      } else {
        b.a.push(0, 0, 0);
        b.b.push(0, 0, 0);
        b.lit.push(1);
      }
    };
    const slope = (r0 - r1) / h;
    let base = b.count;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const nl = Math.hypot(1, slope);
      push([x + c * r0, y, z + sn * r0], [c / nl, slope / nl, sn / nl], [(s / segs) * 2 * Math.PI * r0, 0]);
      push([x + c * r1, y + h, z + sn * r1], [c / nl, slope / nl, sn / nl], [(s / segs) * 2 * Math.PI * r0, h]);
    }
    for (let s = 0; s < segs; s++) {
      const a = base + s * 2;
      b.idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    if (!opts.noCap) {
      for (const [yy, rr, ny] of [[y + h, r1, 1], [y, r0, -1]]) {
        if (rr <= 0.001) continue;
        base = b.count;
        push([x, yy, z], [0, ny, 0], [0, 0]);
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          push([x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr], [0, ny, 0], [Math.cos(a) * rr, Math.sin(a) * rr]);
        }
        for (let s = 0; s < segs; s++) {
          if (ny > 0) b.idx.push(base, base + s + 2, base + s + 1);
          else b.idx.push(base, base + s + 1, base + s + 2);
        }
      }
    }
    if (opts.collide) this.collideBox(x, z, r0 * 2, r0 * 2, y + h);
  }

  /** Add a light given in the current frame (baked into this cell). */
  light(l) {
    const p = this._p(l.x || 0, l.y || 0, l.z || 0);
    this.plan.light({ ...l, x: p[0], y: p[1], z: p[2] });
  }

  /** A flat sign facing +z in the current frame. (x, y, z) = bottom centre. */
  sign(text, x, y, z, w, h, opts = {}) {
    let row = SIGN_ROWS.indexOf(text);
    if (row < 0) row = 0;
    const R = SIGN_ROW_COUNT;
    const mat = opts.glow ? 'signsGlow' : 'signs';
    this.face(mat, [x - w / 2, y, z], [w, 0, 0], [0, h, 0], [0, 0], {
      ...opts,
      seg: 10,
      uvRect: [0, 1 - (row + 1) / R, 1, 1 - row / R],
    });
  }

  /** Brass digits on a plate, facing +z. */
  digits(str, x, y, z, h = 0.07) {
    const w = h * 0.62;
    const total = w * str.length;
    for (let k = 0; k < str.length; k++) {
      const d = str.charCodeAt(k) - 48;
      if (d < 0 || d > 9) continue;
      this.face('digits', [x - total / 2 + k * w, y, z], [w, 0, 0], [0, h, 0], [0, 0], {
        seg: 1,
        uvRect: [d / 10, 0, (d + 1) / 10, 1],
      });
    }
  }

  // ---- shell: floors, walls, ceilings from the plan's tile grid ----------------------------

  shell() {
    const p = this.plan;
    const T = TILE;
    // shared-vertex floor and ceiling grids per material
    const grids = new Map();
    const gridVert = (mat, i, j, y, ny) => {
      const key = `${mat}|${y}|${ny}`;
      let g = grids.get(key);
      if (!g) grids.set(key, (g = new Map()));
      const k = j * (N + 1) + i;
      let v = g.get(k);
      if (v === undefined) {
        const b = this.buf(mat);
        v = b.count;
        b.pos.push(i * T, y, j * T);
        b.nrm.push(0, ny, 0);
        b.uv.push(i * T, j * T);
        b.a.push(0, 0, 0);
        b.b.push(0, 0, 0);
        b.lit.push(1);
        g.set(k, v);
      }
      return v;
    };
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        if (!p.isFloor(i, j)) continue;
        const zone = p.zoneAt(i, j);
        const fm = p.floorAt(i, j);
        const a = gridVert(fm, i, j, 0, 1);
        const bq = gridVert(fm, i + 1, j, 0, 1);
        const c = gridVert(fm, i + 1, j + 1, 0, 1);
        const d = gridVert(fm, i, j + 1, 0, 1);
        this.buf(fm).idx.push(a, d, c, a, c, bq);
        const cm = zone.ceilMat;
        const h = zone.ceil;
        const a2 = gridVert(cm, i, j, h, -1);
        const b2 = gridVert(cm, i + 1, j, h, -1);
        const c2 = gridVert(cm, i + 1, j + 1, h, -1);
        const d2 = gridVert(cm, i, j + 1, h, -1);
        this.buf(cm).idx.push(a2, c2, d2, a2, b2, c2);
        // walls and soffits on each side
        for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const ni = i + di;
          const nj = j + dj;
          let y0;
          if (!p.isFloor(ni, nj)) y0 = 0;
          else {
            const nc = p.ceilAt(ni, nj);
            if (nc >= h - 0.001) continue;
            y0 = nc;
          }
          this.wallFace(zone.wall, i, j, di, dj, y0, h, y0 === 0 && !zone.door);
        }
      }
  }

  wallFace(mat, i, j, di, dj, y0, y1, baseboard) {
    const T = TILE;
    const x0 = i * T;
    const z0 = j * T;
    const hgt = y1 - y0;
    let o, u, uv0;
    if (dj === -1) (o = [x0, y0, z0]), (u = [T, 0, 0]), (uv0 = [x0, y0]);
    else if (dj === 1) (o = [x0 + T, y0, z0 + T]), (u = [-T, 0, 0]), (uv0 = [-x0 - T, y0]);
    else if (di === -1) (o = [x0, y0, z0 + T]), (u = [0, 0, -T]), (uv0 = [-z0 - T, y0]);
    else (o = [x0 + T, y0, z0]), (u = [0, 0, T]), (uv0 = [z0, y0]);
    this.face(mat, o, u, [0, hgt, 0], uv0);
    if (baseboard) {
      // inward normal is (-di, 0, -dj); the cove base sits just in front of the wall
      const off = 0.012;
      const ox = o[0] - di * off;
      const oz = o[2] - dj * off;
      this.face('baseboard', [ox, 0, oz], u, [0, 0.1, 0], [uv0[0], 0]);
      this.face('baseboard', [ox, 0.1, oz], u, [di * off, 0, dj * off], [uv0[0], 0]);
    }
  }

  // ---- fixtures -----------------------------------------------------------------------------

  fixtures() {
    for (const l of this.plan.lights) {
      if (!l.fixture) continue;
      if (l.type === 'troffer') {
        this.push(l.x, l.z, l.rot || 0);
        const g = l.color.map((c) => c * 2.0 * Math.min(1.4, l.power / 2.6));
        this.box('troffer', 0, l.y - 0.015, 0, 1.24, 0.05, 0.64, { skip: 'top', seg: 2 });
        this.face('lamp', [-0.58, l.y - 0.018, -0.29], [1.16, 0, 0], [0, 0, 0.58], [0, 0], { glow: g, flicker: l.flicker, seg: 2 });
        this.pop();
      }
    }
  }

  // ---- lighting bake --------------------------------------------------------------------------

  visible(ax, ay, az, bx, by, bz) {
    const p = this.plan;
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / 0.17);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = ax + dx * t;
      const z = az + dz * t;
      const y = ay + dy * t;
      const i = Math.floor(x / TILE);
      const j = Math.floor(z / TILE);
      if (!p.isFloor(i, j)) return false;
      if (y > p.ceilAt(i, j) + 0.02 || y < -0.02) return false;
    }
    return true;
  }

  /** Fraction of solid tiles in a 2x2 sample around (x, z). */
  solidFrac(x, z) {
    const p = this.plan;
    let s = 0;
    for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      if (!p.isFloor(Math.floor((x + ox) / TILE), Math.floor((z + oz) / TILE))) s++;
    }
    return s / 4;
  }

  bake() {
    const p = this.plan;
    const lights = p.lights;
    const amb = p.ambient;
    for (const b of this.bufs.values()) {
      if (b.glow) continue;
      const n = b.count;
      for (let v = 0; v < n; v++) {
        if (!b.lit[v]) continue;
        const px = b.pos[v * 3];
        const py = b.pos[v * 3 + 1];
        const pz = b.pos[v * 3 + 2];
        const nx = b.nrm[v * 3];
        const ny = b.nrm[v * 3 + 1];
        const nz = b.nrm[v * 3 + 2];
        // nudge off the surface so occlusion tests start in open space
        const sx = px + nx * 0.06;
        const sy = py + ny * 0.06;
        const sz = pz + nz * 0.06;
        const ti = Math.floor(sx / TILE);
        const tj = Math.floor(sz / TILE);
        const ceil = p.isFloor(ti, tj) ? p.ceilAt(ti, tj) : 2.8;
        const sf = this.solidFrac(sx, sz);
        const hf = Math.min(1, Math.exp(-Math.max(0, sy) / 0.45) + Math.exp(-Math.max(0, ceil - sy) / 0.5) * 0.6);
        const ao = 1 - 0.75 * sf * hf - 0.12 * hf;
        // contact shadows: floor under and around furniture
        let contact = 1;
        if (ny > 0.5 && py < 0.05) {
          for (const c of this.colliders) {
            const ex = Math.max(c[0] - px, 0, px - c[2]);
            const ez = Math.max(c[1] - pz, 0, pz - c[3]);
            const dd = Math.hypot(ex, ez);
            if (dd < 0.45) contact = Math.min(contact, 0.3 + 0.7 * (dd / 0.45) * (dd / 0.45));
          }
        }
        let ar = amb[0] * ao * contact;
        let ag = amb[1] * ao * contact;
        let ab = amb[2] * ao * contact;
        let br = 0;
        let bg = 0;
        let bb = 0;
        for (const l of lights) {
          const dx = l.x - sx;
          const dy = l.y - sy;
          const dz = l.z - sz;
          const d2 = dx * dx + dy * dy + dz * dz;
          const r2 = l.range * l.range;
          if (d2 > r2) continue;
          const d = Math.sqrt(d2);
          const w = Math.max(0, 1 - (d2 * d2) / (r2 * r2));
          const win = w * w;
          const vis = this.visible(l.x, l.y, l.z, sx, sy, sz);
          let ndl = (nx * dx + ny * dy + nz * dz) / (d || 1);
          ndl = Math.max(0, ndl);
          let lobe = 1;
          if (l.type === 'troffer') lobe = Math.pow(Math.max(0, dy / (d || 1)), 1.3) * 0.97 + 0.03;
          else if (l.type === 'spotDown') lobe = Math.pow(Math.max(0, dy / (d || 1)), 3);
          const direct = vis ? (l.power * lobe * ndl) / (d2 + 0.35) : 0;
          // fake bounce: a soft, wide fill, weaker on ceilings (they get little bounced light)
          const up = ny < -0.5 ? 0.45 : Math.abs(ny) < 0.5 ? 1.7 : 1;
          const bounce = (l.power * 0.085 * up * (vis ? 1 : 0.35) * ao) / (d2 + 6);
          const k = (direct * (0.55 + 0.45 * ao) + bounce) * win * contact;
          if (l.flicker) {
            br += l.color[0] * k;
            bg += l.color[1] * k;
            bb += l.color[2] * k;
          } else {
            ar += l.color[0] * k;
            ag += l.color[1] * k;
            ab += l.color[2] * k;
          }
        }
        b.a[v * 3] = ar;
        b.a[v * 3 + 1] = ag;
        b.a[v * 3 + 2] = ab;
        b.b[v * 3] = br;
        b.b[v * 3 + 1] = bg;
        b.b[v * 3 + 2] = bb;
      }
    }
  }

  /** Export typed arrays, ready to transfer out of a worker. */
  export() {
    const meshes = [];
    const transfer = [];
    for (const b of this.bufs.values()) {
      if (!b.idx.length) continue;
      const m = {
        mat: b.mat,
        glow: b.glow,
        position: new Float32Array(b.pos),
        normal: new Float32Array(b.nrm),
        uv: new Float32Array(b.uv),
        bakeA: new Float32Array(b.a),
        bakeB: new Float32Array(b.b),
        index: b.count > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx),
      };
      transfer.push(m.position.buffer, m.normal.buffer, m.uv.buffer, m.bakeA.buffer, m.bakeB.buffer, m.index.buffer);
      meshes.push(m);
    }
    return { meshes, transfer };
  }
}
