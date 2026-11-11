// Prop recipes for the mall. Same contract as world/props.js: a local frame where the prop's front
// faces +z and its origin is on its floor (wall props: on the wall plane). Pure: geometry comes only
// from params and the rng passed in.

import { RNG } from '../../core/rng.js';
import { SHOP_SIGN_COLS, SHOP_SIGN_ROWS } from './names.js';

const PI = Math.PI;

/** UV rect of a shop name in the sign atlas. */
function signUV(idx) {
  const c = idx % SHOP_SIGN_COLS;
  const r = Math.floor(idx / SHOP_SIGN_COLS);
  return [c / SHOP_SIGN_COLS, 1 - (r + 1) / SHOP_SIGN_ROWS, (c + 1) / SHOP_SIGN_COLS, 1 - r / SHOP_SIGN_ROWS];
}

/** A thin bar running in the local y-z plane from (y0, z0) to (y1, z1), at x, w wide, t thick. */
function slopeBar(b, mat, x, y0, z0, y1, z1, w, t) {
  const dy = y1 - y0;
  const dz = z1 - z0;
  const l = Math.hypot(dy, dz);
  // normal to the bar in the y-z plane (pointing up-back)
  const ny = dz / l;
  const nz = -dy / l;
  const o = [x - w / 2, y0, z0];
  const u = [0, dy, dz];
  b.face(mat, [o[0], o[1] + ny * t, o[2] + nz * t], u, [w, 0, 0], [0, 0]); // top
  b.face(mat, [o[0], o[1], o[2]], [w, 0, 0], u, [0, 0]); // bottom
  b.face(mat, [o[0], o[1], o[2]], u, [0, ny * t, nz * t], [0, 0]); // side -x
  b.face(mat, [o[0] + w, o[1] + ny * t, o[2] + nz * t], u, [0, -ny * t, -nz * t], [0, 0]); // side +x
}

/** A sloped pane facing both ways (glass balustrades on the escalators). */
function slopePane(b, mat, x, y0, z0, y1, z1, h) {
  b.face(mat, [x, y0, z0], [0, y1 - y0, z1 - z0], [0, h, 0], [0, 0], { seg: 2 });
  b.face(mat, [x, y0 + h, z0], [0, y1 - y0, z1 - z0], [0, -h, 0], [0, 0], { seg: 2 });
}

/** A roll-down security grille across an opening: bottom at yb, housing at the top. */
function grille(b, w, h, yb, z) {
  b.box('steelDark', 0, h - 0.28, z, w + 0.1, 0.28, 0.3);
  if (yb < h - 0.3) {
    // subdivided so the baked light has vertices out in the opening, not just in the jambs
    b.face('grille', [-w / 2, yb, z + 0.02], [w, 0, 0], [0, h - 0.28 - yb, 0], [0, yb], { seg: 0.7 });
    b.face('grille', [w / 2, yb, z - 0.02], [-w, 0, 0], [0, h - 0.28 - yb, 0], [0, yb], { seg: 0.7 });
    b.box('steelDark', 0, yb - 0.05, z, w, 0.06, 0.08); // bottom bar
    // side guide channels
    for (const s of [-1, 1]) b.box('steelDark', (s * w) / 2, 0, z, 0.06, h - 0.28, 0.1);
  }
}

export const MALL_PROPS = {
  storefront(b, p, rng) {
    const w = p.w;
    const h = p.h || 3.0;
    const bulk = p.bulk || 1.0;
    // trim around the opening, and a kick plate of light where the floor changes
    for (const s of [-1, 1]) b.box('mallTrim', (s * (w + 0.12)) / 2, 0, -0.25, 0.12, h, 0.5);
    b.box('mallTrim', 0, h - 0.06, -0.02, w + 0.24, 0.08, 0.06);
    if (p.state === 'closed') grille(b, w, h, 0.02, -0.15);
    else if (p.state === 'half') grille(b, w, h, rng.float(0.95, 1.35), -0.15);
    else if (p.state === 'open') grille(b, w, h, h - 0.32, -0.15);
    if (p.state === 'closed' || p.state === 'half') b.collideBox(0, -0.2, w, 0.3, 2);
    // the sign on the bulkhead
    const sh = Math.min(0.62, bulk * 0.62);
    const sy = h + (bulk - sh) / 2;
    const sw = Math.min(w * 0.82, 6.2);
    if (p.sign >= 0) {
      const lit = (p.sign * 7 + 3) % 5 !== 0; // a few signs have died
      b.box('mallTrim', 0, sy - 0.05, 0.03, sw + 0.12, sh + 0.1, 0.06);
      b.face(lit ? 'shopSignsGlow' : 'shopSigns', [-sw / 2, sy, 0.065], [sw, 0, 0], [0, sh, 0], [0, 0], {
        seg: 10,
        uvRect: signUV(p.sign),
        ...(lit ? { glow: [1.35, 1.3, 1.2] } : {}),
      });
      if (lit) b.light({ x: 0, y: sy + sh / 2, z: 0.6, color: [1, 0.85, 0.7], power: 0.25, range: 3 });
    } else {
      // vacant: the sign came down, its raceway and a pale rectangle stayed
      b.box('mallTrim', 0, sy + sh * 0.4, 0.02, sw * 0.8, 0.08, 0.08);
      b.face('ghostSign', [-sw / 2, sy, 0.012], [sw, 0, 0], [0, sh, 0], [0, 0], { seg: 10, uvRect: [0, 0, 1, 1] });
    }
  },

  stallFront(b, p, rng) {
    const w = p.w;
    const h = 3.1;
    const bulk = 1.4;
    for (const s of [-1, 1]) b.box('mallTrim', (s * (w + 0.12)) / 2, 0, -0.25, 0.12, h, 0.5);
    // the serving counter just inside the opening
    b.box('mallTeal', 0, 0, -0.8, w, 0.95, 0.6, { seg: 0.5 });
    b.box('stainless', 0, 0.95, -0.8, w + 0.04, 0.04, 0.66);
    b.collideBox(0, -0.75, w, 0.8, 1.0);
    if (p.state === 'closed') grille(b, w, h, 0.02, -0.15);
    else if (p.state === 'half') grille(b, w, h, rng.float(1.3, 1.7), -0.15);
    else grille(b, w, h, h - 0.32, -0.15);
    // napkin dispensers and a tip jar left on the counter
    b.box('chrome', -w * 0.3, 0.99, -0.75, 0.16, 0.18, 0.1);
    b.cyl('glassDark', w * 0.25, 0.99, -0.8, 0.07, 0.16, { segs: 8 });
    const sh = 0.8;
    const sy = h + 0.3;
    const sw = Math.min(w * 0.85, 5);
    // the stall line falls mid-tile: the wall above stands a quarter metre proud of the opening
    const wz = 0.25;
    if (p.sign >= 0) {
      b.box('mallTrim', 0, sy - 0.05, wz + 0.03, sw + 0.12, sh + 0.1, 0.06);
      b.face('shopSignsGlow', [-sw / 2, sy, wz + 0.065], [sw, 0, 0], [0, sh, 0], [0, 0], { seg: 10, uvRect: signUV(p.sign), glow: [1.3, 1.25, 1.1] });
      b.light({ x: 0, y: sy + sh / 2, z: wz + 0.6, color: [1, 0.85, 0.7], power: 0.3, range: 3.5 });
    } else b.face('ghostSign', [-sw / 2, sy, wz + 0.012], [sw, 0, 0], [0, sh, 0], [0, 0], { seg: 10, uvRect: [0, 0, 1, 1] });
    void bulk;
  },

  stallBack(b, p) {
    // menu boards on the back wall (lit), a prep counter, a soda tower
    const w = Math.min(p.w - 1, 4.2);
    b.box('stainless', 0, 0, 0.3, p.w - 0.6, 0.9, 0.6, { seg: 0.5 });
    b.box('steelDark', 0, 1.9, 0.02, w + 0.1, 0.9, 0.04);
    b.face('menuBoard', [-w / 2, 1.95, 0.045], [w, 0, 0], [0, 0.8, 0], [0, 0], { seg: 10, uvRect: [0, 0, 1, 1], glow: [1.2, 1.15, 1.05] });
    b.box('chrome', p.w / 2 - 1.1, 0.9, 0.3, 0.5, 0.6, 0.4);
    b.collideBox(0, 0.3, p.w - 0.6, 0.6, 0.9);
  },

  entryDoors(b, p) {
    // aluminium storefront: fixed lites at the sides, two pairs of doors; one leaf propped open
    const w = p.w;
    const h = 3.0;
    const bays = 4;
    const bw = w / bays;
    for (let k = 0; k <= bays; k++) b.box('steelDark', -w / 2 + k * bw, 0, 0, 0.1, h, 0.14);
    b.box('steelDark', 0, 2.35, 0, w, 0.12, 0.14);
    b.box('steelDark', 0, h - 0.1, 0, w, 0.1, 0.14);
    b.box('steelDark', 0, 0, 0, w, 0.06, 0.14);
    for (let k = 0; k < bays; k++) {
      const x0 = -w / 2 + k * bw;
      const xc = x0 + bw / 2;
      // transom glass
      b.box('doorGlass', xc, 2.41, 0, bw - 0.1, h - 2.51, 0.02);
      if (k === 1) {
        // the propped leaf: hinged at its left jamb, swung out toward the lot
        b.push(x0 + 0.05, 0, -1.3, 0);
        b.box('steelDark', bw / 2 - 0.05, 0.06, 0, bw - 0.1, 0.1, 0.06);
        b.box('steelDark', bw / 2 - 0.05, 2.2, 0, bw - 0.1, 0.1, 0.06);
        b.box('doorGlass', bw / 2 - 0.05, 0.16, 0, bw - 0.2, 2.04, 0.02);
        b.box('chrome', bw - 0.25, 0.9, 0.06, 0.04, 0.6, 0.04);
        b.pop();
        b.box('rubber', x0 + bw - 0.2, 0, 0.6, 0.18, 0.06, 0.1); // the wedge holding it
        continue;
      }
      b.box('doorGlass', xc, 0.06, 0, bw - 0.1, 2.29, 0.02);
      if (k === 2) {
        b.box('chrome', x0 + 0.2, 0.9, 0.06, 0.04, 0.6, 0.04);
        b.box('chrome', x0 + 0.2, 0.9, -0.06, 0.04, 0.6, 0.04);
        // a notice taped to the glass, facing out
        b.box('paper', xc, 1.35, 0.025, 0.22, 0.28, 0.004);
      }
      b.collideBox(xc, 0, bw, 0.16, 2.4);
    }
  },

  anchorFront(b, p) {
    // a department-store front with nothing behind it: blank panels, a closed grille, and the
    // pale outline where the name came down. No name, no logo.
    const w = p.w;
    const h = p.h;
    const ow = Math.min(w * 0.62, 12);
    const oh = Math.min(3.0, h - 0.6);
    // the face panel, standing just proud of the wall
    for (const s of [-1, 1]) b.box('anchorPanel', (s * (w / 2 + ow / 2)) / 2, 0, 0.08, w / 2 - ow / 2, h, 0.16, { seg: 0.8 });
    b.box('anchorPanel', 0, oh, 0.08, ow, h - oh, 0.16, { seg: 0.8 });
    // dark behind the grille
    b.face('voidBlack', [-ow / 2, 0, 0.02], [ow, 0, 0], [0, oh, 0], [0, 0], { seg: 2 });
    grille(b, ow, oh, 0.02, 0.1);
    if (!p.upper) b.face('ghostSign', [-Math.min(ow, 9) / 2, oh + 0.35, 0.165], [Math.min(ow, 9), 0, 0], [0, Math.min(1.0, h - oh - 0.5), 0], [0, 0], { seg: 10, uvRect: [0, 0, 1, 1] });
    b.collideBox(0, 0.1, w, 0.3, 3);
  },

  escalator(b, p) {
    // rises along +z from (z = -len/2, y = 0) to (z = len/2, y = rise)
    const len = p.len;
    const w = p.w;
    const rise = p.rise;
    const z0 = -len / 2;
    const z1 = len / 2;
    const half = w / 2;
    // the incline proper starts 1.2 m in and ends 1.2 m early (flat landings at each end)
    const iz0 = z0 + 1.2;
    const iz1 = z1 - 1.2;
    const n = Math.ceil((iz1 - iz0) / 0.4);
    const run = (iz1 - iz0) / n;
    const rs = rise / n;
    // steps
    for (let k = 0; k < n; k++) b.box('escalatorStep', 0, k * rs, iz0 + (k + 0.5) * run, w - 0.36, rs, run, { skip: 'bottom', seg: 1 });
    b.box('escalatorStep', 0, 0, (z0 + iz0) / 2, w - 0.36, 0.04, iz0 - z0, { seg: 1 });
    b.box('escalatorStep', 0, rise - 0.04, (iz1 + z1) / 2, w - 0.36, 0.04, z1 - iz1, { seg: 1 });
    // the truss: side skirts and the underside
    const deep = 0.95;
    for (const s of [-1, 1]) {
      const x = s * (half - 0.09);
      slopeBar(b, 'mallTrim', x, -deep, iz0 - 0.3, rise - deep, iz1 + 0.3, 0.18, deep + 0.12);
      b.box('mallTrim', x, 0, (z0 + iz0) / 2, 0.18, 0.12, iz0 - z0);
    }
    slopeBar(b, 'mallTrim', 0, -deep - 0.02, iz0 - 0.3, rise - deep - 0.02, iz1 + 0.3, w, 0.04);
    // balustrades: glass over the skirts, a black rubber handrail on top
    for (const s of [-1, 1]) {
      const x = s * (half - 0.1);
      slopePane(b, 'railGlass', x, 0.12, iz0 - 0.4, rise + 0.12, iz1 + 0.4, 0.86);
      slopeBar(b, 'rubber', x, 0.98, iz0 - 0.6, rise + 0.98, iz1 + 0.6, 0.09, 0.07);
      // the newels: flat runs of rail at both ends
      b.box('rubber', x, 0.98, iz0 - 1.0, 0.09, 0.07, 0.8);
      b.box('rubber', x, rise + 0.98, iz1 + 0.6, 0.09, 0.07, 0.8);
      b.box('railGlass', x, 0.12, iz0 - 0.8, 0.02, 0.86, 0.8);
      b.box('railGlass', x, rise + 0.12, iz1 + 0.4, 0.02, 0.86, 0.8);
    }
    // comb plates where the steps meet the floor
    b.box('chrome', 0, 0, z0 + 0.1, w - 0.3, 0.02, 0.2);
    b.box('chrome', 0, rise, z1 - 0.1, w - 0.3, 0.02, 0.2);
    // stopped: a chain across the bottom, hanging slack (you can step over it)
    b.box('chrome', 0, 0.62, z0 + 0.25, w - 0.4, 0.02, 0.02);
    // lower level: you can only get on from the bottom end
    for (const s of [-1, 1]) b.collideBox(s * (half - 0.06), 0, 0.12, len, 1.1);
    b.collideBox(0, z1 - 0.35, w, 0.7, 1.1);
    // the underside, from below (lit grey)
    b.face('mallTrim', [-half, -deep, iz0 - 0.3], [w, 0, 0], [0, rise, iz1 - iz0 + 0.6], [0, 0]);
  },

  fountain(b, p, rng) {
    const r = p.r || 3;
    // rim: short tangent blocks around the ring
    const segs = 28;
    for (let k = 0; k < segs; k++) {
      const a = ((k + 0.5) / segs) * PI * 2;
      b.box('terrazzo', Math.sin(a) * (r - 0.15), 0, Math.cos(a) * (r - 0.15), (2 * PI * r) / segs + 0.04, 0.5, 0.32, { rot: a });
    }
    b.cyl('basinDry', 0, 0, 0, r - 0.3, 0.06, { segs: 24 });
    // the tiers, dry
    b.cyl('terrazzo', 0, 0.06, 0, 0.45, 1.1, { r1: 0.36, segs: 14 });
    b.cyl('basinDry', 0, 1.16, 0, 0.36, 0.34, { r1: 1.25, segs: 18 });
    b.cyl('terrazzo', 0, 1.5, 0, 0.18, 0.7, { r1: 0.14, segs: 10 });
    b.cyl('basinDry', 0, 2.2, 0, 0.16, 0.22, { r1: 0.62, segs: 14 });
    b.cyl('chrome', 0, 2.42, 0, 0.04, 0.14, { segs: 6 });
    // coins and leaves on the bottom
    for (let k = 0; k < 46; k++) {
      const a = rng.float(0, PI * 2);
      const d = Math.sqrt(rng.next()) * (r - 0.45);
      if (d < 0.6) continue;
      b.cyl(k % 5 ? 'brass' : 'chrome', Math.sin(a) * d, 0.062, Math.cos(a) * d, 0.012, 0.003, { segs: 6 });
    }
    for (let k = 0; k < 14; k++) {
      const a = rng.float(0, PI * 2);
      const d = rng.float(0.8, r - 0.5);
      b.box('deadLeaf', Math.sin(a) * d, 0.062, Math.cos(a) * d, 0.12, 0.004, 0.07, { rot: rng.float(0, 6.28) });
    }
    b.collideBox(0, 0, r * 2, r * 2, 0.5);
  },

  kiosk(b) {
    // a two-sided lit directory on a plinth
    b.box('mallTrim', 0, 0, 0, 1.5, 0.35, 0.62);
    b.box('mallTeal', 0, 0.35, 0, 1.38, 1.85, 0.34, { seg: 0.5 });
    b.box('mallTrim', 0, 2.2, 0, 1.46, 0.12, 0.4);
    for (const side of [0, PI]) {
      b.push(0, 0, side, 0);
      b.face('mallDirectory', [-0.6, 0.5, 0.172], [1.2, 0, 0], [0, 1.6, 0], [0, 0], { seg: 10, uvRect: [0, 0, 1, 1], glow: [1.25, 1.25, 1.25] });
      b.pop();
    }
    b.light({ x: 0, y: 1.3, z: 0.7, color: [0.85, 0.9, 1.0], power: 0.35, range: 3 });
    b.light({ x: 0, y: 1.3, z: -0.7, color: [0.85, 0.9, 1.0], power: 0.35, range: 3 });
    b.collideBox(0, 0, 1.5, 0.62, 2.3);
  },

  elevator(b, p) {
    // a glass shaft rising through the well, the car parked at the bottom, doors shut
    const s = 2.5;
    const h = p.h || 10;
    const up = p.up || 5.5;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box('chrome', (x * s) / 2, 0, (z * s) / 2, 0.12, h - 0.2, 0.12);
    for (const y of [0.0, up - 0.1, h - 0.6]) b.box('mallTrim', 0, y, 0, s + 0.1, 0.18, s + 0.1, { skip: y > 0 ? '' : 'bottom' });
    // glass on three sides, the front (+z) has the doors
    b.box('railGlass', 0, 0.18, -s / 2, s - 0.1, h - 0.8, 0.02);
    b.box('railGlass', -s / 2, 0.18, 0, 0.02, h - 0.8, s - 0.1);
    b.box('railGlass', s / 2, 0.18, 0, 0.02, h - 0.8, s - 0.1);
    b.box('railGlass', 0, 2.6, s / 2, s - 0.1, h - 3.2, 0.02);
    b.box('steelDark', 0, 0.18, s / 2, s - 0.3, 2.42, 0.06);
    b.box('chrome', 0, 0.18, s / 2 + 0.035, 0.02, 2.3, 0.01);
    // the car: a box of brushed steel with a glass back
    b.box('steelDark', 0, 0.18, 0, s - 0.4, 0.06, s - 0.4);
    b.box('steelDark', 0, 2.5, 0, s - 0.4, 0.1, s - 0.4);
    b.box('lamp', 0, 2.48, 0, 0.8, 0.01, 0.8, { glow: [1.4, 1.35, 1.2] });
    b.light({ x: 0, y: 2.3, z: 0, color: [1, 0.95, 0.85], power: 0.7, range: 4 });
    // call button on the post at the right of the doors
    b.box('steelDark', s / 2 + 0.12, 1.0, s / 2 + 0.05, 0.12, 0.3, 0.04);
    b.box('lamp', s / 2 + 0.12, 1.12, s / 2 + 0.075, 0.04, 0.04, 0.01, { glow: [2.2, 1.6, 0.6] });
    b.collideBox(0, 0, s + 0.2, s + 0.2, h);
  },

  bench(b) {
    // slatted wood on two cast legs, no back
    for (const x of [-0.75, 0.75]) b.box('steelDark', x, 0, 0, 0.1, 0.42, 0.5);
    for (let k = 0; k < 4; k++) b.box('walnut', 0, 0.42, -0.21 + k * 0.14, 2.0, 0.05, 0.1);
    b.collideBox(0, 0, 2.0, 0.56, 0.47);
  },

  planter(b, p, rng) {
    // a square tiled planter with a ficus that died in the dark that never came
    const s = p.s || 2;
    b.box('mallTile', 0, 0, 0, s, 0.62, s, { seg: 0.5 });
    b.box('mallTrim', 0, 0.62, 0, s + 0.08, 0.05, s + 0.08);
    b.box('soil', 0, 0.58, 0, s - 0.16, 0.06, s - 0.16);
    for (let t = 0; t < 3; t++) {
      const x = rng.float(-0.4, 0.4);
      const z = rng.float(-0.4, 0.4);
      const th = rng.float(1.4, 2.4);
      b.cyl('walnut', x, 0.62, z, 0.05, th, { r1: 0.03, segs: 6, noCap: true });
      for (let k = 0; k < 9; k++) {
        const a = rng.float(0, 6.28);
        const y = 0.62 + th * rng.float(0.55, 1.0);
        b.push(x, z, a, y);
        b.box('deadLeaf', 0, -0.05, 0.22, 0.09, 0.02, 0.42, { rot: rng.float(-0.3, 0.3) });
        b.pop();
      }
    }
    // fallen leaves around it
    for (let k = 0; k < 10; k++) b.box('deadLeaf', rng.float(-s, s), 0.005, rng.float(-s, s) * (k % 2 ? 1 : -1), 0.1, 0.004, 0.06, { rot: rng.float(0, 6.28) });
    b.collideBox(0, 0, s, s, 0.67);
  },

  bin(b) {
    b.cyl('mallTeal', 0, 0, 0, 0.28, 0.85, { segs: 12 });
    b.cyl('chrome', 0, 0.85, 0, 0.3, 0.12, { r1: 0.12, segs: 12 });
    b.collideBox(0, 0, 0.6, 0.6, 0.97);
  },

  litter(b, p) {
    // flat on the floor, never in the way: a few sheets, a cup, or a drift of leaves
    const rng = new RNG(p.seed || 1);
    if (p.leaves) {
      const n = rng.int(10, 22);
      for (let k = 0; k < n; k++) {
        const r = Math.sqrt(rng.next()) * 0.9;
        const a = rng.float(0, PI * 2);
        b.box('deadLeaf', Math.sin(a) * r * 1.4, 0.003 + k * 0.0004, Math.cos(a) * r, rng.float(0.05, 0.09), 0.003, rng.float(0.03, 0.06), { rot: rng.float(0, PI) });
      }
      return;
    }
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++)
      b.box('paper', rng.float(-0.5, 0.5), 0.003 + k * 0.002, rng.float(-0.5, 0.5), rng.float(0.18, 0.3), 0.003, rng.float(0.2, 0.28), { rot: rng.float(0, PI) });
    if (rng.chance(0.35)) {
      // a soda cup on its side
      b.push(rng.float(-0.4, 0.4), rng.float(-0.4, 0.4), rng.float(0, PI * 2), 0.045);
      b.box('paper', 0, -0.04, 0, 0.09, 0.09, 0.15);
      b.pop();
    }
  },

  foodTable(b, p) {
    const rng = new RNG(p.seed || 1);
    // a square laminate top on a pedestal, four moulded chairs still out
    b.cyl('steelDark', 0, 0, 0, 0.3, 0.03, { segs: 10 });
    b.cyl('steelDark', 0, 0.03, 0, 0.04, 0.7, { segs: 6, noCap: true });
    b.box('laminate', 0, 0.72, 0, 0.9, 0.04, 0.9);
    b.collideBox(0, 0, 0.9, 0.9, 0.76);
    if (rng.chance(0.3)) b.box('paper', rng.float(-0.25, 0.25), 0.762, rng.float(-0.25, 0.25), 0.3, 0.004, 0.22, { rot: rng.float(0, 3) });
    if (rng.chance(0.25)) b.cyl('paper', rng.float(-0.3, 0.3), 0.76, rng.float(-0.3, 0.3), 0.045, 0.15, { r1: 0.05, segs: 8 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + rng.float(-0.25, 0.25);
      if (p.stacked) {
        // upside down on the table top, legs in the air, back hanging over the edge
        if (k === 3 && rng.chance(0.5)) continue;
        b.push(Math.sin(a) * 0.26, Math.cos(a) * 0.26, a + PI + rng.float(-0.12, 0.12), 0.76);
        b.box('mallTeal', 0, 0, 0, 0.44, 0.04, 0.42);
        b.box('mallTeal', 0, -0.36, -0.2, 0.44, 0.4, 0.04);
        for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [0.19, 0.18], [-0.19, 0.18]]) b.cyl('chrome', x, 0.04, z, 0.012, 0.44, { segs: 5, noCap: true });
        b.pop();
        continue;
      }
      if (rng.chance(0.14)) continue; // carried off to another table, or out of the building
      const out = 0.62 + rng.float(0, 0.75);
      b.push(Math.sin(a) * out, Math.cos(a) * out, a + PI + rng.float(-0.9, 0.9), 0);
      if (rng.chance(0.12)) {
        // knocked over, lying on its back
        b.box('mallTeal', 0, 0, -0.1, 0.46, 0.05, 0.44);
        b.box('mallTeal', 0, 0.05, -0.42, 0.46, 0.42, 0.05);
        for (const x of [-0.2, 0.2]) b.box('chrome', x, 0.02, 0.15, 0.025, 0.025, 0.45);
      } else {
        for (const [x, z] of [[-0.19, -0.18], [0.19, -0.18], [0.19, 0.18], [-0.19, 0.18]]) b.cyl('chrome', x, 0, z, 0.012, 0.44, { segs: 5, noCap: true });
        b.box('mallTeal', 0, 0.44, 0, 0.44, 0.04, 0.42);
        b.box('mallTeal', 0, 0.48, -0.2, 0.44, 0.4, 0.04);
        b.collideBox(0, 0, 0.42, 0.42, 0.85);
      }
      b.pop();
    }
  },

  rack(b, p, rng) {
    // a chrome T-rack; most of them empty, a few still hung with something
    for (const s of [-1, 1]) {
      b.box('chrome', s * 0.55, 0, 0, 0.04, 0.03, 0.5);
      b.cyl('chrome', s * 0.55, 0.03, 0, 0.016, 1.37, { segs: 6, noCap: true });
    }
    b.box('chrome', 0, 1.4, 0, 1.2, 0.025, 0.025);
    if (!p.empty) {
      const col = rng.pick(['fabricOrange', 'linen', 'carpetBlue', 'velvet']);
      for (let x = -0.5; x <= 0.5; x += rng.float(0.05, 0.12)) b.box(col, x, 0.62, 0, 0.012, 0.76, 0.42 + rng.float(-0.05, 0.05));
    } else for (let k = 0; k < 6; k++) b.box('chrome', rng.float(-0.5, 0.5), 1.25, 0, 0.004, 0.15, 0.4);
    b.collideBox(0, 0, 1.25, 0.55, 1.4);
  },

  cashWrap(b) {
    b.box('laminate', 0, 0, 0, 2.4, 0.98, 0.8, { seg: 0.5 });
    b.box('mallTrim', 0, 0.98, 0, 2.46, 0.04, 0.86);
    b.box('beigePlastic', -0.5, 1.02, -0.1, 0.4, 0.14, 0.38);
    b.box('beigePlastic', -0.5, 1.16, -0.2, 0.36, 0.22, 0.04);
    b.collideBox(0, 0, 2.4, 0.8, 1.0);
  },

  gondola(b, p, rng) {
    const len = p.len || 3;
    b.box('metalGrey', 0, 0, 0, len, 0.12, 0.9);
    b.box('metalGrey', 0, 0.12, 0, len, 1.5, 0.06, { seg: 0.6 });
    for (const y of [0.3, 0.7, 1.1, 1.5])
      for (const s of [-1, 1]) {
        b.box('metalGrey', 0, y, s * 0.24, len, 0.025, 0.42);
        if (rng.chance(0.18)) b.box('cardboard', rng.float(-len / 2 + 0.3, len / 2 - 0.3), y + 0.025, s * 0.24, 0.3, 0.2, 0.25);
      }
    b.collideBox(0, 0, len, 0.9, 1.6);
  },

  showcase(b) {
    b.box('walnut', 0, 0, 0, 1.8, 0.62, 0.62, { seg: 0.5 });
    b.box('railGlass', 0, 0.62, 0, 1.76, 0.38, 0.58);
    b.box('chrome', 0, 1.0, 0, 1.82, 0.02, 0.64);
    b.box('enamel', 0, 0.62, 0, 1.7, 0.02, 0.5);
    b.collideBox(0, 0, 1.8, 0.62, 1.02);
  },

  serviceDesk(b, p) {
    const len = p.len || 4;
    b.box('mallTeal', 0, 0, 0, len, 1.05, 0.7, { seg: 0.5 });
    b.box('laminate', 0, 1.05, 0, len + 0.06, 0.04, 0.8);
    b.cyl('brass', len * 0.3, 1.09, 0.2, 0.05, 0.015, { segs: 10 });
    b.cyl('brass', len * 0.3, 1.105, 0.2, 0.04, 0.03, { r1: 0.012, segs: 10 });
    // a lost-and-found carton of wristwatches, none with hands
    b.box('cardboard', -len * 0.3, 1.09, 0.05, 0.4, 0.2, 0.3);
    b.collideBox(0, 0, len, 0.8, 1.1);
  },

  ladder(b, p, rng) {
    const h = 1.8;
    for (const s of [-1, 1]) {
      b.box('chrome', -0.22, 0, s * 0.28, 0.04, h, 0.04, { rot: s * 0.08 });
      b.box('chrome', 0.22, 0, s * 0.28, 0.04, h, 0.04, { rot: s * 0.08 });
    }
    for (let k = 1; k < 6; k++) b.box('chrome', 0, k * 0.3, -0.24 + k * 0.02, 0.46, 0.03, 0.1);
    b.box('linen', rng.float(-1, 1), 0.005, rng.float(-1, 1), 1.8, 0.01, 1.4, { rot: rng.float(0, 3) });
    b.collideBox(0, 0, 0.55, 0.7, h);
  },

  mannequin(b) {
    // a headless form on a chrome stand, turned a little toward the concourse
    b.cyl('chrome', 0, 0, 0, 0.18, 0.02, { segs: 10 });
    b.cyl('chrome', 0, 0.02, 0, 0.018, 0.95, { segs: 6, noCap: true });
    b.cyl('enamel', 0, 0.95, 0, 0.13, 0.25, { r1: 0.16, segs: 12 });
    b.cyl('enamel', 0, 1.2, 0, 0.16, 0.32, { r1: 0.2, segs: 12 });
    b.cyl('enamel', 0, 1.52, 0, 0.2, 0.06, { r1: 0.06, segs: 12 });
    b.cyl('enamel', 0, 1.58, 0, 0.05, 0.08, { segs: 8 });
    b.collideBox(0, 0, 0.45, 0.45, 1.6);
  },
};
