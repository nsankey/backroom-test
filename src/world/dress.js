// Dressing for the derelicts' rooms: whatever the room was built as, it is inside a ship. Walls
// meet the ceiling and the deck on angled panels; structural frames stand along the walls every
// few metres and close over narrow spaces as ribs; pipe runs ride under the chamfers; wall bays
// carry dead control panels, vents and emergency strips; doorways get heavy collars with a
// status lamp. Each room keeps one lighting mood (cold, sodium amber or red emergency), and the
// shadows between the pools stay deep. Runs after the props, before the fixtures and the bake.

import { N, TILE } from './constants.js';

const SIDES = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const DEFAULT_COLOURS = [[0.86, 1.0, 0.84], [0.95, 1.0, 0.9]];

const MOODS = {
  cold: { light: [0.7, 0.86, 1.0], strip: [0.12, 0.3, 0.45], led: [0.15, 0.7, 1.0] },
  amber: { light: [1.0, 0.64, 0.32], strip: [0.55, 0.26, 0.05], led: [1.2, 0.55, 0.1] },
  red: { light: [1.0, 0.13, 0.07], strip: [0.6, 0.04, 0.02], led: [1.4, 0.08, 0.04] },
};

export function dress(b, plan, rng) {
  const moods = zoneMoods(plan, rng);
  relight(plan, moods, rng);
  // a colour-coded band along each room's walls (most rooms), the ship's wayfinding
  const bands = plan.zones.map(() => (rng.chance(0.65) ? rng.pick(['safetyYellow', 'oxblood', 'steelPaint', 'oxblood']) : null));
  const ctx = { b, plan, rng, moods, bands };
  for (const run of wallRuns(plan)) dressRun(ctx, run);
  doorCollars(ctx);
}

/** One lighting mood per room, chosen from the cell's seed. */
function zoneMoods(plan, rng) {
  const out = plan.zones.map(() => 'cold');
  for (let k = 1; k < plan.zones.length; k++) {
    const r = rng.next();
    out[k] = r < 0.5 ? 'cold' : r < 0.8 ? 'amber' : 'red';
  }
  return out;
}

function sameColour(a, b) {
  return a && Math.abs(a[0] - b[0]) < 1e-3 && Math.abs(a[1] - b[1]) < 1e-3 && Math.abs(a[2] - b[2]) < 1e-3;
}

/**
 * Recolour the stock fittings to the room's mood. Red rooms run on emergency power: dimmer and
 * tighter pools. Every light gets a narrower lobe, so the dark between fittings stays dark.
 */
function relight(plan, moods, rng) {
  for (const l of plan.lights) {
    if (!l.fixture) continue;
    const zi = plan.tiles[plan.idx(Math.floor(l.x / TILE), Math.floor(l.z / TILE))];
    const mood = moods[zi] || 'cold';
    if (DEFAULT_COLOURS.some((c) => sameColour(l.color, c))) l.color = MOODS[mood].light.slice();
    if (mood === 'red') l.power *= 0.6;
    // the ship's power is failing: more fittings dead, the rest a little harder, so the light
    // falls in pools with real dark between them
    else if (rng.chance(0.22)) l.power = 0;
    else l.power *= 1.15;
    if (l.lobe) l.lobe *= 1.6;
  }
}

// ---- walls --------------------------------------------------------------------------------------

/**
 * Straight runs of wall, per room: tiles in a row whose neighbour on one side is solid (or a low
 * doorway, so the chamfer carries on over the door). solid[] marks which tiles have a full wall.
 */
function wallRuns(plan) {
  const runs = [];
  for (const [di, dj] of SIDES) {
    const alongX = dj !== 0;
    for (let line = 0; line < N; line++) {
      let cur = null;
      for (let s = 0; s <= N; s++) {
        const i = alongX ? s : line;
        const j = alongX ? line : s;
        let ok = false;
        let solid = false;
        let zi = 0;
        if (s < N && plan.isFloor(i, j)) {
          zi = plan.tiles[plan.idx(i, j)];
          const zone = plan.zones[zi];
          if (!zone.sky && !zone.door) {
            const ni = i + di;
            const nj = j + dj;
            const C = chamferSize(zone.ceil);
            if (!plan.isFloor(ni, nj)) ok = solid = true;
            else {
              const nz = plan.zoneAt(ni, nj);
              if (nz.door && nz.ceil <= zone.ceil - C - 0.05) ok = true;
            }
          }
        }
        if (ok && cur && cur.zi === zi) {
          cur.s1 = s;
          cur.solid.push(solid);
          continue;
        }
        if (cur) runs.push(cur);
        cur = ok ? { di, dj, line, zi, s0: s, s1: s, solid: [solid] } : null;
      }
      if (cur) runs.push(cur);
    }
  }
  return runs;
}

const chamferSize = (ceil) => (ceil > 4 ? 0.7 : 0.38);

/** Point on a run's wall: `a` metres along it, `out` metres into the room, height y. */
function framer(run) {
  const { di, dj, line } = run;
  const T = TILE;
  const alongX = dj !== 0;
  // the wall plane: on the tile's far side in the wall's direction
  const w = alongX ? (dj < 0 ? line * T : (line + 1) * T) : di < 0 ? line * T : (line + 1) * T;
  const nIn = alongX ? [0, -dj] : [-di, 0];
  return {
    alongX,
    nIn,
    P: (a, out, y) => (alongX ? [a, y, w + nIn[1] * out] : [w + nIn[0] * out, y, a]),
  };
}

/** A four-cornered panel, wound so its normal agrees with `hint`. */
function panel(b, mat, a, bb, c, d, hint, opts = {}) {
  const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const e2 = [d[0] - bb[0], d[1] - bb[1], d[2] - bb[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) b.quad(mat, a, d, c, bb, opts);
  else b.quad(mat, a, bb, c, d, opts);
}

/** Is any prop (or fitting) within r metres of (x, z)? */
function crowded(plan, x, z, r) {
  for (const p of plan.props) if (Math.hypot(p.x - x, p.z - z) < r) return true;
  return false;
}

function dressRun(ctx, run) {
  const { b, plan, rng, moods } = ctx;
  const T = TILE;
  const zone = plan.zones[run.zi];
  const ceil = zone.ceil;
  const C = chamferSize(ceil);
  const tall = ceil > 4;
  const f = framer(run);
  const a0 = run.s0 * T;
  const a1 = (run.s1 + 1) * T;
  const nI = f.nIn;
  const hintIn = f.alongX ? [0, 0.7, nI[1] * 0.7] : [nI[0] * 0.7, 0.7, 0];
  const hintDown = f.alongX ? [0, -0.7, nI[1] * 0.7] : [nI[0] * 0.7, -0.7, 0];
  const mood = MOODS[moods[run.zi]];

  // the angled panel where wall meets ceiling, with a cap where the run stops in the open
  panel(b, zone.wall, f.P(a0, 0, ceil - C), f.P(a1, 0, ceil - C), f.P(a1, C, ceil), f.P(a0, C, ceil), hintDown, { seg: 1.2 });
  const capAt = (a, s, dir) => {
    const i = f.alongX ? s : run.line;
    const j = f.alongX ? run.line : s;
    if (!plan.isFloor(i, j)) return; // an inside corner: the next wall carries on
    const h = f.alongX ? [dir, 0, 0] : [0, 0, dir];
    panel(b, zone.wall, f.P(a, 0, ceil - C), f.P(a, 0, ceil), f.P(a, C, ceil), f.P(a, C, ceil), h, { seg: 2 });
  };
  capAt(a0, run.s0 - 1, -1);
  capAt(a1, run.s1 + 1, 1);

  // solid stretches: kick plate, frames, pipes, wall bays
  const spans = [];
  for (let k = 0; k < run.solid.length; k++) {
    if (!run.solid[k]) continue;
    const s = run.s0 + k;
    const last = spans[spans.length - 1];
    if (last && last[1] === s) last[1] = s + 1;
    else spans.push([s, s + 1]);
  }
  const K = 0.16;
  const RIB = tall ? 4 : 2;
  for (const [s0, s1] of spans) {
    const b0 = s0 * T;
    const b1 = s1 * T;
    if (zone.baseboard !== false) {
      panel(b, 'baseboard', f.P(b0, 0, K), f.P(b1, 0, K), f.P(b1, K, 0), f.P(b0, K, 0), hintIn, { seg: 1.2 });
    }
    const band = ctx.bands[run.zi];
    if (band) {
      const hn = f.alongX ? [0, 0, nI[1]] : [nI[0], 0, 0];
      panel(b, band, f.P(b0, 0.004, 1.02), f.P(b1, 0.004, 1.02), f.P(b1, 0.004, 1.2), f.P(b0, 0.004, 1.2), hn, { seg: 1.2 });
    }
    // frames, on a grid shared by every wall so opposite frames line up
    const ribs = [];
    for (let a = Math.ceil((b0 + 0.35) / RIB) * RIB; a < b1 - 0.35; a += RIB) {
      const wp = f.P(a, 0.2, 0);
      if (crowded(plan, wp[0], wp[2], 0.75)) continue;
      ribs.push(a);
      frame(ctx, f, a, ceil, C);
    }
    // pipes under the chamfer on some runs, held off the wall by the frames
    if (b1 - b0 >= 3 && rng.chance(tall ? 0.55 : 0.4)) pipes(ctx, f, b0, b1, ceil, C, ribs, tall);
    // the bays between frames
    const edges = [b0, ...ribs, b1];
    for (let k = 0; k < edges.length - 1; k++) {
      const c0 = edges[k] + 0.2;
      const c1 = edges[k + 1] - 0.2;
      if (c1 - c0 < 0.9) continue;
      const mid = (c0 + c1) / 2;
      const wp = f.P(mid, 0.3, 0);
      if (crowded(plan, wp[0], wp[2], 1.0)) continue;
      bay(ctx, f, mid, ceil, C, mood, tall);
    }
    // guide lights along the deck, under the kick plate, one per frame
    for (const a of ribs) {
      if (rng.chance(0.3)) continue;
      const p = f.P(a, K + 0.02, 0);
      const gl = mood.strip.map((c) => c * 1.6);
      if (f.alongX) b.box('lamp', p[0], 0.005, p[2], 0.16, 0.02, 0.03, { glow: gl });
      else b.box('lamp', p[0], 0.005, p[2], 0.03, 0.02, 0.16, { glow: gl });
    }
  }
}

/** A structural frame: a flat column up the wall, a rib up the chamfer, and across low ceilings. */
function frame(ctx, f, a, ceil, C) {
  const { b, plan } = ctx;
  const w = 0.22;
  const e = 0.07;
  const top = ceil - C;
  const c = f.P(a, e / 2, 0);
  if (f.alongX) b.box('steelDark', c[0], 0, c[2], w, top, e + 0.002);
  else b.box('steelDark', c[0], 0, c[2], e + 0.002, top, w);
  // the rib over the chamfer: a face lifted off it, and its two sides
  const r = e / Math.SQRT2;
  const hint = f.alongX ? [0, -0.7, f.nIn[1] * 0.7] : [f.nIn[0] * 0.7, -0.7, 0];
  panel(b, 'steelDark', f.P(a - w / 2, r, top - r), f.P(a + w / 2, r, top - r), f.P(a + w / 2, C + r, ceil - r), f.P(a - w / 2, C + r, ceil - r), hint, { seg: 1 });
  for (const sd of [-1, 1]) {
    const x = a + (sd * w) / 2;
    const h = f.alongX ? [sd, 0, 0] : [0, 0, sd];
    panel(b, 'steelDark', f.P(x, 0, top), f.P(x, C, ceil), f.P(x, C + r, ceil - r), f.P(x, r, top - r), h, { seg: 1 });
  }
  // across a narrow space: find the facing wall and close the frame over the ceiling
  if (f.nIn[0] + f.nIn[1] < 0) return; // build each beam once, from the low side
  const T = TILE;
  let d = 0;
  for (let k = 1; k < 34; k++) {
    let ok = true;
    for (const da of [-T / 2, T / 2]) {
      const p = f.P(a + da, (k - 0.5) * T, 0);
      const i = Math.floor(p[0] / T);
      const j = Math.floor(p[2] / T);
      if (!plan.isFloor(i, j) || plan.ceilAt(i, j) !== ceil || plan.zoneAt(i, j).door) ok = false;
    }
    if (!ok) {
      // the far side must be wall on both sides of the line
      for (const da of [-T / 2, T / 2]) {
        const p = f.P(a + da, (k - 0.5) * T, 0);
        if (plan.isFloor(Math.floor(p[0] / T), Math.floor(p[2] / T))) return;
      }
      d = (k - 1) * T;
      break;
    }
  }
  if (!d) return;
  // narrow spaces close every frame; wide rooms carry a beam on every other one
  if (d > 5.5 && Math.round(a / 2) % 2 !== 0) return;
  const s0 = C;
  const s1 = d - C;
  if (s1 - s0 < 0.3) return;
  const m0 = f.P(a, s0, 0);
  const m1 = f.P(a, s1, 0);
  // keep the beam off the light fittings: test points along it against each fitting's footprint
  const tall = ceil > 4;
  const depth = tall ? 0.34 : r;
  for (const l of plan.lights) {
    if (l.y < ceil - depth - 0.15) continue;
    const c = Math.cos(l.rot || 0);
    const s = Math.sin(l.rot || 0);
    const hl = l.fixture ? 0.78 + w / 2 : 0.25;
    const hc = l.fixture ? 0.38 + w / 2 : 0.25;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const qx = m0[0] + (m1[0] - m0[0]) * t - l.x;
      const qz = m0[2] + (m1[2] - m0[2]) * t - l.z;
      // the fitting's long axis is its local x: world (cos, -sin)
      if (Math.abs(qx * c - qz * s) < hl && Math.abs(qx * s + qz * c) < hc) return;
    }
  }
  const cx = (m0[0] + m1[0]) / 2;
  const cz = (m0[2] + m1[2]) / 2;
  const len = s1 - s0 + 0.04;
  if (f.alongX) b.box('steelDark', cx, ceil - depth - 0.002, cz, tall ? 0.3 : w, depth + 0.004, len, { skip: 'top' });
  else b.box('steelDark', cx, ceil - depth - 0.002, cz, len, depth + 0.004, tall ? 0.3 : w, { skip: 'top' });
  if (tall) {
    // a girder: a lighter web with lightening holes under the flange
    if (f.alongX) b.box('metalGrey', cx, ceil - depth - 0.08, cz, 0.36, 0.08, len, { skip: 'top' });
    else b.box('metalGrey', cx, ceil - depth - 0.08, cz, len, 0.08, 0.36, { skip: 'top' });
  }
}

/** Two pipes along the wall, just below the chamfer, on brackets at the frames. */
function pipes(ctx, f, b0, b1, ceil, C, ribs, tall) {
  const { b, rng } = ctx;
  const y1 = ceil - C - (tall ? 0.3 : 0.14);
  const specs = [
    { r: tall ? 0.09 : 0.055, y: y1, out: 0.08, mat: rng.pick(['metalGrey', 'steelPaint', 'copper']) },
    { r: tall ? 0.05 : 0.032, y: y1 - (tall ? 0.28 : 0.15), out: 0.08, mat: rng.pick(['metalGrey', 'steelDark', 'safetyYellow']) },
  ];
  const len = b1 - b0 - 0.1;
  for (const s of specs) {
    const o = s.out + s.r;
    const p = f.P(b0 + 0.05, o, 0);
    // a lying cylinder runs along local +z: turn the frame so it runs along the wall
    b.push(p[0], p[2], f.alongX ? Math.PI / 2 : 0);
    b.cyl(s.mat, 0, s.y, 0, s.r, len, { rx: true, segs: 8 });
    b.pop();
  }
  for (const a of ribs) {
    const p = f.P(a, 0.14, 0);
    const sy = specs[1].y - specs[1].r - 0.03;
    const h = y1 + specs[0].r - sy;
    if (f.alongX) b.box('steelDark', p[0], sy, p[2], 0.05, h + 0.02, 0.2);
    else b.box('steelDark', p[0], sy, p[2], 0.2, h + 0.02, 0.05);
  }
}

/** One wall bay: a dead control panel, a vent, an emergency strip or a hazard plate. */
function bay(ctx, f, a, ceil, C, mood, tall) {
  const { b, rng } = ctx;
  const r = rng.next();
  const along = f.alongX ? [1, 0, 0] : [0, 0, 1];
  const n = f.alongX ? [0, 0, f.nIn[1]] : [f.nIn[0], 0, 0];
  // a face in the wall's plane, `out` metres off it, centred at `a`, from y0, w x h
  const plate = (mat, out, y0, w, h, opts = {}) => {
    const o = f.P(a - w / 2, out, y0);
    let u = along.map((v) => v * w);
    let v = [0, h, 0];
    // face() normal is u x v; flip u when it points into the wall
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cr[0] * n[0] + cr[2] * n[2] < 0) {
      const o2 = f.P(a + w / 2, out, y0);
      b.face(mat, o2, u.map((x) => -x), v, [0, 0], opts);
    } else b.face(mat, o, u, v, [0, 0], opts);
  };
  const block = (mat, out, y0, w, h, d) => {
    const c = f.P(a, out + d / 2, 0);
    if (f.alongX) b.box(mat, c[0], y0, c[2], w, h, d);
    else b.box(mat, c[0], y0, c[2], d, h, w);
  };
  if (r < 0.22) {
    // a control panel: a housing, a dead screen with a little light left in it, three lamps
    block('steelDark', 0, 1.0, 0.56, 0.7, 0.06);
    const scr = rng.chance(0.6) ? [0.03, 0.14, 0.08] : [0.12, 0.08, 0.02];
    plate('lamp', 0.061, 1.36, 0.36, 0.24, { glow: scr, seg: 1 });
    for (let k = 0; k < 3; k++) {
      const dead = rng.chance(0.35);
      const c = dead ? [0.02, 0.02, 0.02] : rng.pick([mood.led, [0.1, 0.9, 0.3], [1.4, 0.1, 0.05]]);
      const p = f.P(a - 0.12 + k * 0.12, 0.062, 1.17);
      if (f.alongX) b.box('lamp', p[0], p[1], p[2], 0.035, 0.035, 0.008, { glow: c });
      else b.box('lamp', p[0], p[1], p[2], 0.008, 0.035, 0.035, { glow: c });
    }
  } else if (r < 0.42) {
    // a vent grille, low or high, slats over the dark
    const y0 = rng.chance(0.5) ? 0.32 : Math.min(ceil - C - 0.75, tall ? 3 : 1.75);
    block('steelDark', 0, y0, 0.66, 0.4, 0.04);
    plate('glass', 0.041, y0 + 0.04, 0.58, 0.32, { seg: 1 });
    for (let k = 0; k < 5; k++) block('metalGrey', 0.04, y0 + 0.06 + k * 0.06, 0.58, 0.022, 0.025);
  } else if (r < 0.55) {
    // an emergency strip, upright, in the room's colour; some have died
    const c = rng.chance(0.25) ? [0.02, 0.02, 0.02] : mood.strip.map((x) => x * 2.2);
    block('steelDark', 0, 0.5, 0.1, 1.3, 0.03);
    plate('lamp', 0.031, 0.55, 0.05, 1.2, { glow: c, seg: 1 });
  } else if (r < 0.65) {
    plate('hazard', 0.004, 0.18, 0.6, 0.5, { seg: 1 });
  }
}

// ---- doorways -----------------------------------------------------------------------------------

/** Heavy collars round every doorway, on the faces that look into this cell's rooms. */
function doorCollars(ctx) {
  const { b, plan, rng, moods } = ctx;
  const T = TILE;
  for (let zi = 1; zi < plan.zones.length; zi++) {
    const zone = plan.zones[zi];
    if (!zone.door) continue;
    let i0 = N, i1 = -1, j0 = N, j1 = -1;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++)
        if (plan.tiles[plan.idx(i, j)] === zi) (i0 = Math.min(i0, i)), (i1 = Math.max(i1, i)), (j0 = Math.min(j0, j)), (j1 = Math.max(j1, j));
    if (i1 < 0) continue;
    const mi = Math.floor((i0 + i1) / 2);
    const mj = Math.floor((j0 + j1) / 2);
    // the passage runs along whichever axis has floor on both ends
    const alongZ = plan.isFloor(mi, j0 - 1) || plan.isFloor(mi, j1 + 1);
    const faces = alongZ
      ? [[mi, j0 - 1, (i0 + i1 + 1) / 2 * T, j0 * T, 0, -1, (i1 - i0 + 1) * T], [mi, j1 + 1, (i0 + i1 + 1) / 2 * T, (j1 + 1) * T, 0, 1, (i1 - i0 + 1) * T]]
      : [[i0 - 1, mj, i0 * T, (j0 + j1 + 1) / 2 * T, -1, 0, (j1 - j0 + 1) * T], [i1 + 1, mj, (i1 + 1) * T, (j0 + j1 + 1) / 2 * T, 1, 0, (j1 - j0 + 1) * T]];
    for (const [ri, rj, x, z, nx, nz, L] of faces) {
      if (!plan.isFloor(ri, rj)) continue;
      const room = plan.zoneAt(ri, rj);
      if (room.sky || room.door) continue;
      const mood = MOODS[moods[plan.tiles[plan.idx(ri, rj)]]];
      collar(b, plan, rng, x, z, Math.atan2(nx, nz), L, zone.ceil, room.ceil, mood);
    }
  }
}

function collar(b, plan, rng, x, z, rot, L, H, roomCeil, mood) {
  const T = TILE;
  const hw = L / 2;
  const jw = 0.3;
  const d = 0.12;
  b.push(x, z, rot);
  // a jamb only where there is room beside the opening for it
  const roomFor = (sx) => {
    const p = b._p(sx, 0, 0.3);
    return plan.isFloor(Math.floor(p[0] / T), Math.floor(p[2] / T));
  };
  const lt = Math.min(0.3, roomCeil - chamferSize(roomCeil) + 0.1 - H);
  for (const sd of [-1, 1]) {
    const sx = sd * (hw + jw / 2);
    if (!roomFor(sx)) continue;
    b.box('steelDark', sx, 0, d / 2, jw, H + Math.max(0, lt), d);
    // hazard bands low on the jambs
    b.face('hazard', [sx - jw / 2 + 0.03, 0.06, d + 0.001], [jw - 0.06, 0, 0], [0, 0.85, 0], [0, 0], { seg: 1 });
  }
  if (lt > 0.08) {
    b.box('steelDark', 0, H, d / 2, L + jw * 2, lt, d);
    // the opening's top corners cut off at 45 degrees
    const c = 0.28;
    for (const sd of [-1, 1]) {
      const ex = sd * hw;
      const ix = sd * (hw - c);
      panel(b, 'steelDark', [ex, H - c, d], [ex, H, d], [ix, H, d], [ix, H, d], [0, 0, 1], { seg: 1 });
      // the slope underneath, from the face back into the wall
      const lo = [ex, H - c, 0];
      const hi = [ix, H, 0];
      const lo2 = [ex, H - c, d];
      const hi2 = [ix, H, d];
      panel(b, 'steelDark', lo, hi, hi2, lo2, [-sd * 0.7, -0.7, 0], { seg: 1 });
    }
    // the status lamp over the door, and on some, a warning light that still turns the dark red
    {
      const r = rng.next();
      const col = r < 0.45 ? [1.6, 0.08, 0.04] : r < 0.7 ? mood.led : r < 0.85 ? [0.1, 1.0, 0.3] : [0.02, 0.02, 0.02];
      const ly = H + (lt - 0.05) / 2;
      b.box('lamp', 0, ly, d + 0.005, 0.26, 0.05, 0.012, { glow: col });
      if (r < 0.45 && rng.chance(0.6)) b.light({ x: 0, y: ly, z: 0.45, color: [1.0, 0.1, 0.05], power: 0.32, range: 4.5, flicker: rng.chance(0.3) });
    }
  }
  b.pop();
}
