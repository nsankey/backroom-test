// Prop recipes. Each draws into a SceneBuilder `b` in a local frame where the prop's front
// faces +z and its origin is on the floor (wall props: origin on the wall surface).
// Recipes are pure: geometry comes only from params and the rng passed in.

const PI = Math.PI;

function legs(b, mat, w, d, h, inset = 0.04, r = 0.018) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    b.cyl(mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), r, h, { segs: 6, noCap: true });
}

/** A cardboard carton with a tape strip, slightly irregular. */
function carton(b, rng, x, y, z, w, h, d) {
  const rot = rng ? rng.float(-0.06, 0.06) : 0;
  b.box('cardboard', x, y, z, w, h, d, { rot, seg: 0.5 });
}

export const PROPS = {
  // ---- general ----
  sign(b, p) {
    const y = p.y || 2.0;
    const w = p.w || 1.4;
    const h = p.h || w / 10;
    if (p.board !== false) b.box(p.boardMat || 'steelDark', 0, y - 0.04, 0.012, w + 0.08, h + 0.08, 0.024);
    b.sign(p.text, 0, y, p.board !== false ? 0.025 : 0.004, w, h, p.glow ? { glow: p.glow } : {});
  },

  exitSign(b, p) {
    const y = p.y || 2.25;
    b.box('beigePlastic', 0, y, 0.06, 0.34, 0.16, 0.1);
    b.push(0, 0.111, 0);
    b.sign('EXIT', 0, y + 0.02, 0, 0.3, 0.12, { glow: [0.3, 1.9, 0.6] });
    b.pop();
    b.light({ x: 0, y: y + 0.05, z: 0.3, color: [0.2, 1, 0.4], power: 0.1, range: 3 });
  },

  desk(b, p, rng) {
    const w = p.w || 1.4;
    b.box('laminate', 0, 0.72, 0, w, 0.03, 0.75);
    b.box('metalGrey', w / 2 - 0.22, 0, 0, 0.4, 0.72, 0.7);
    for (let k = 0; k < 3; k++) b.box('chrome', w / 2 - 0.22, 0.15 + k * 0.22, 0.352, 0.1, 0.02, 0.01);
    b.box('metalGrey', -w / 2 + 0.03, 0, 0, 0.04, 0.72, 0.7);
    b.box('metalGrey', 0, 0.3, -0.34, w - 0.1, 0.4, 0.02);
    b.collideBox(0, 0, w, 0.76, 0.76);
    if (p.typewriter) {
      b.push(-0.15, 0.05, rng ? rng.float(-0.2, 0.2) : 0, 0.75);
      b.box('steelPaint', 0, 0, 0, 0.44, 0.1, 0.36);
      b.box('steelPaint', 0, 0.1, -0.08, 0.44, 0.08, 0.2);
      b.box('rubber', 0, 0.17, -0.1, 0.5, 0.06, 0.06);
      b.box('blackPlastic', 0, 0.1, 0.1, 0.36, 0.02, 0.12, { rot: 0 });
      b.box('paper', 0, 0.18, -0.13, 0.22, 0.22, 0.004);
      b.pop();
    }
    if (p.papers) {
      b.box('paper', 0.25, 0.75, 0.05, 0.3, 0.02, 0.22, { rot: 0.2 });
      b.box('paper', 0.35, 0.77, -0.08, 0.22, 0.03, 0.3, { rot: -0.1 });
    }
  },

  officeChair(b) {
    b.cyl('blackPlastic', 0, 0, 0, 0.28, 0.05, { segs: 5 });
    b.cyl('chrome', 0, 0.05, 0, 0.025, 0.35, { segs: 6, noCap: true });
    b.box('partition', 0, 0.4, 0, 0.48, 0.08, 0.46);
    b.box('partition', 0, 0.55, -0.22, 0.44, 0.45, 0.06);
    b.collideBox(0, 0, 0.56, 0.56, 1);
  },

  filing(b) {
    b.box('metalGrey', 0, 0, 0, 0.46, 1.32, 0.62, { seg: 0.35 });
    for (let k = 0; k < 4; k++) b.box('chrome', 0, 0.22 + k * 0.32, 0.312, 0.14, 0.025, 0.012);
    b.collideBox(0, 0, 0.46, 0.62, 1.32);
  },

  shelf(b, p, rng) {
    // steel shelving with boxes and files
    const w = p.w || 1.2;
    const d = p.d || 0.45;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metalGrey', sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02), 0.03, 2.0, 0.03);
    for (let k = 0; k < 5; k++) {
      const y = 0.08 + k * 0.46;
      b.box('metalGrey', 0, y, 0, w, 0.02, d);
      if (k < 4 && rng) {
        let x = -w / 2 + 0.05;
        while (x < w / 2 - 0.2) {
          const bw = rng.float(0.22, 0.4);
          if (rng.chance(p.full ?? 0.75)) carton(b, rng, x + bw / 2, y + 0.02, rng.float(-0.03, 0.03), bw - 0.03, rng.float(0.18, 0.36), d - 0.08);
          x += bw;
        }
      }
    }
    b.collideBox(0, 0, w, d, 2.0);
  },

  vending(b, p) {
    b.box('oxblood', 0, 0, 0, 0.95, 1.85, 0.8, { seg: 0.4 });
    b.face('vendingGlow', [-0.38, 0.55, 0.402], [0.6, 0, 0], [0, 1.15, 0], [0, 0], { glow: [1.1, 1.2, 1.3], seg: 0.4, uvRect: [0, 0, 1, 1], flicker: !!p.flicker });
    b.box('blackPlastic', 0.33, 0.9, 0.4, 0.18, 0.5, 0.02);
    b.box('blackPlastic', 0, 0.15, 0.4, 0.6, 0.22, 0.02);
    b.light({ x: 0, y: 1.1, z: 0.8, color: [0.8, 0.92, 1.0], power: 0.4, range: 4, flicker: !!p.flicker });
    b.collideBox(0, 0, 0.97, 0.82, 1.9);
  },

  carton(b, p, rng) {
    const s = p.s || 0.5;
    carton(b, rng, 0, 0, 0, s, s * 0.75, s * 1.1);
    if (p.stack) carton(b, rng, rng ? rng.float(-0.05, 0.05) : 0, s * 0.75, 0, s * 0.9, s * 0.6, s);
    b.collideBox(0, 0, s, s * 1.1, s * (p.stack ? 1.35 : 0.75));
  },

  pallet(b, p, rng) {
    // a 1.2 x 1.0 m pallet, optionally loaded with wrapped cartons
    const w = 1.2;
    const d = 1.0;
    for (const sz of [-0.42, 0, 0.42]) b.box('palletWood', 0, 0, sz, w, 0.1, 0.12);
    for (let k = 0; k < 7; k++) b.box('palletWood', -w / 2 + 0.07 + k * ((w - 0.14) / 6), 0.1, 0, 0.12, 0.03, d);
    let top = 0.13;
    if (p.load && rng) {
      const layers = rng.int(1, p.tall ? 4 : 3);
      for (let l = 0; l < layers; l++) {
        const h = rng.float(0.28, 0.4);
        for (const sx of [-0.3, 0.3])
          for (const sz of [-0.25, 0.25]) if (rng.chance(l === layers - 1 ? 0.8 : 1)) carton(b, rng, sx, top, sz, 0.56, h, 0.46);
        top += h;
      }
    }
    b.collideBox(0, 0, w, d, Math.max(0.15, top));
  },

  crate(b, p, rng) {
    const w = p.w || 0.9;
    const h = p.h || 0.7;
    const d = p.d || 0.7;
    b.box('palletWood', 0, 0, 0, w, h, d, { seg: 0.4 });
    for (const y of [0.04, h - 0.1]) b.box('palletWood', 0, y, d / 2 + 0.01, w + 0.02, 0.07, 0.02);
    b.box('safetyYellow', -w / 4, h * 0.45, d / 2 + 0.012, 0.22, 0.12, 0.004);
    b.collideBox(0, 0, w, d, h);
    if (p.stack && rng && rng.chance(0.7)) {
      b.push(rng.float(-0.05, 0.05), rng.float(-0.05, 0.05), rng.float(-0.1, 0.1), h);
      b.box('palletWood', 0, 0, 0, w * 0.86, h * 0.8, d * 0.9, { seg: 0.4 });
      b.pop();
    }
  },

  palletRack(b, p, rng) {
    // one bay of adjustable pallet racking: teal uprights, oxblood beams, 3 levels.
    // Front faces +z. Width w along x, depth 1.1 m.
    const w = p.w || 2.7;
    const d = 1.1;
    const levels = p.levels || [0, 1.6, 3.2];
    const H = p.h || 4.6;
    for (const sx of [-w / 2, w / 2]) {
      for (const sz of [-d / 2 + 0.05, d / 2 - 0.05]) b.box('steelPaint', sx, 0, sz, 0.08, H, 0.06);
      // diagonal bracing between the frame's front and back post
      for (let y = 0.4; y < H - 0.6; y += 1.0) b.box('steelPaint', sx, y, 0, 0.03, 0.5, d - 0.1, { rot: 0 });
      b.box('steelDark', sx, 0, 0, 0.14, 0.02, d + 0.05);
    }
    for (const y of levels) {
      if (y > 0) for (const sz of [-d / 2 + 0.05, d / 2 - 0.05]) b.box('oxblood', 0, y - 0.1, sz, w, 0.1, 0.05);
      // what sits on this level: a pallet of stock, a crate, or nothing
      if (!rng) continue;
      const base = y > 0 ? y : 0;
      for (const sx of [-w / 4, w / 4]) {
        const r = rng.next();
        if (r < (p.empty ?? 0.25)) continue;
        b.push(sx, 0, PI / 2, base);
        if (r < 0.8) PROPS.pallet(b, { load: true }, rng);
        else PROPS.crate(b, { w: 0.9, h: 0.75, d: 0.8 }, rng);
        b.pop();
      }
    }
    // a load notice on the upright
    b.box('safetyYellow', -w / 2 + 0.12, 1.2, d / 2 - 0.02, 0.16, 0.22, 0.004);
    b.collideBox(0, 0, w + 0.1, d, H);
  },

  rollerShutter(b, p) {
    // a closed roller shutter door, origin on the wall: slatted steel, box at the top, guides
    const w = p.w || 3.0;
    const h = p.h || 3.2;
    for (let y = 0.0; y < h; y += 0.1) b.box('oxblood', 0, y, 0.03, w, 0.085, 0.02, { seg: 1 });
    b.box('steelDark', 0, 0, 0.04, w, 0.06, 0.04);
    b.box('metalGrey', 0, h, 0.12, w + 0.3, 0.45, 0.24, { seg: 0.6 });
    for (const sx of [-1, 1]) b.box('metalGrey', sx * (w / 2 + 0.06), 0, 0.05, 0.1, h, 0.1);
    b.box('hazard', 0, 0, 0.065, w, 0.12, 0.005);
    b.box('safetyYellow', w / 2 + 0.3, 1.1, 0.03, 0.14, 0.24, 0.06);
  },

  noticeboard(b, p) {
    const y = p.y || 1.2;
    const w = p.w || 1.2;
    b.box('doorFrame', 0, y - 0.03, 0.015, w + 0.06, 0.86, 0.03);
    b.face('noticeboard', [-w / 2, y, 0.032], [w, 0, 0], [0, 0.8, 0], [0, 0], { seg: 1, uvRect: [0, 0, 1, 1] });
  },

  clockStation(b) {
    // a wall time recorder between two card racks; every card is in the IN column
    b.box('steelDark', 0, 1.15, 0.09, 0.36, 0.48, 0.18);
    b.box('beigePlastic', 0, 1.42, 0.181, 0.22, 0.14, 0.004);
    b.box('chrome', 0, 1.18, 0.181, 0.06, 0.06, 0.02);
    for (const sx of [-0.62, 0.62]) {
      b.box('metalGrey', sx, 0.9, 0.025, 0.5, 0.9, 0.05);
      b.face('timecards', [sx - 0.24, 0.92, 0.051], [0.48, 0, 0], [0, 0.86, 0], [0, 0], { seg: 1, uvRect: [0, 0, 1, 1] });
    }
  },

  locker(b, p, rng) {
    // a bank of grey lockers, one or two doors ajar
    const n = p.n || 4;
    const w = 0.38;
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * w;
      b.box('metalGrey', x, 0.1, 0, w - 0.01, 1.8, 0.48, { seg: 0.4 });
      const open = rng && rng.chance(0.18);
      if (open) {
        b.box('steelDark', x, 0.12, 0.2, w - 0.04, 1.76, 0.04);
        b.push(x - w / 2 + 0.02, 0.24, -1.1);
        b.box('metalGrey', w / 2 - 0.02, 0.12, 0, w - 0.03, 1.76, 0.02);
        b.pop();
      } else {
        for (let s = 0; s < 3; s++) b.box('steelDark', x, 1.55 + s * 0.04, 0.242, w * 0.5, 0.012, 0.004);
        b.box('chrome', x + w / 2 - 0.07, 1.0, 0.245, 0.02, 0.08, 0.01);
      }
    }
    b.box('steelDark', 0, 0, 0, n * w, 0.1, 0.46);
    b.collideBox(0, 0, n * w, 0.5, 1.9);
  },

  workbench(b, p, rng) {
    const w = p.w || 2.0;
    legs(b, 'steelDark', w, 0.75, 0.88, 0.04, 0.025);
    b.box('palletWood', 0, 0.88, 0, w, 0.06, 0.75);
    b.box('steelDark', 0, 0.2, 0, w - 0.1, 0.03, 0.7);
    // pegboard and a vice
    b.box('cardboard', 0, 0.94, -0.36, w, 0.8, 0.02);
    b.box('steelPaint', w / 2 - 0.25, 0.94, 0.2, 0.18, 0.14, 0.2);
    if (rng) for (let k = 0; k < 6; k++) b.box('steelDark', rng.float(-w / 2 + 0.2, w / 2 - 0.2), rng.float(1.1, 1.6), -0.33, rng.float(0.04, 0.2), rng.float(0.04, 0.3), 0.02);
    b.collideBox(0, 0, w, 0.78, 0.95);
  },

  // ---- cold storage ----
  evaporator(b, p) {
    // a ceiling-hung evaporator unit: a white casing with fan grilles, frosted fins
    const y = p.y || 2.6;
    b.box('panelWhite', 0, y, 0, 2.0, 0.55, 0.7, { seg: 0.5 });
    for (const sx of [-0.55, 0, 0.55]) {
      b.cyl('steelDark', sx, y + 0.1, 0.36, 0.2, 0.02, { segs: 14, rx: true });
      b.cyl('ice', sx, y + 0.1, 0.375, 0.05, 0.01, { segs: 8, rx: true });
    }
    b.box('ice', 0, y - 0.02, -0.05, 1.9, 0.04, 0.6);
    for (const sx of [-0.9, 0.9]) b.box('steelDark', sx, y + 0.55, 0, 0.02, 0.6, 0.02);
  },

  frostStack(b, p, rng) {
    // cartons of frozen stock on a pallet, rimed white along the tops
    PROPS.pallet(b, { load: true, tall: true }, rng);
    b.box('ice', 0, 0.13, 0, 1.18, 0.012, 0.98);
  },

  // ---- records / offices ----
  compactor(b, p, rng) {
    // a run of mobile shelving on floor rails, each unit with a crank wheel on its end
    const len = p.len || 4;
    const n = p.n || 4;
    for (const sx of [-len / 2 + 0.3, len / 2 - 0.3]) b.box('steelDark', sx, 0, 0, 0.06, 0.02, n * 1.05 + 0.4);
    for (let k = 0; k < n; k++) {
      const z = (k - (n - 1) / 2) * 1.05;
      b.push(0, z, 0);
      b.box('beigePlastic', 0, 0.02, 0, len, 2.1, 0.08, { seg: 0.5 });
      for (let s = 0; s < 6; s++) {
        const y = 0.12 + s * 0.34;
        b.box('beigePlastic', 0, y, 0.24, len - 0.1, 0.02, 0.42);
        b.box('beigePlastic', 0, y, -0.24, len - 0.1, 0.02, 0.42);
        if (rng)
          for (const side of [0.24, -0.24]) {
            let x = -len / 2 + 0.1;
            while (x < len / 2 - 0.3) {
              const bw = rng.float(0.28, 0.36);
              if (rng.chance(p.full ?? 0.8)) b.box(rng.chance(0.85) ? 'cardboard' : 'paper', x + bw / 2, y + 0.02, side, bw - 0.02, rng.float(0.24, 0.28), 0.36);
              x += bw;
            }
          }
      }
      // the end panel faces the aisle (+x) with its crank wheel
      b.box('steelPaint', len / 2, 0, 0, 0.04, 2.15, 0.96);
      b.push(len / 2 + 0.08, 0, PI / 2, 0);
      b.cyl('chrome', 0, 1.1, 0, 0.16, 0.025, { segs: 14, rx: true });
      b.pop();
      b.pop();
    }
    b.collideBox(0, 0, len, n * 1.05, 2.2);
  },

  cubicle(b, p, rng) {
    // two desks facing each other across a low fabric screen, chairs pulled out
    const w = 1.5;
    b.box('partition', 0, 0, 0, w * 2 + 0.06, 1.45, 0.06, { seg: 0.5 });
    b.box('steelDark', 0, 1.45, 0, w * 2 + 0.08, 0.03, 0.08);
    for (const side of [-1, 1]) b.box('partition', side * (w + 0.03), 0, 0, 0.05, 1.3, 1.6, { seg: 0.5 });
    for (const [sx, sz, r] of [[-w / 2, 0.42, 0], [w / 2, 0.42, 0], [-w / 2, -0.42, PI], [w / 2, -0.42, PI]]) {
      if (rng && rng.chance(0.12)) continue;
      b.push(sx, sz, r);
      PROPS.desk(b, { w: 1.35, typewriter: rng ? rng.chance(0.5) : false, papers: rng ? rng.chance(0.6) : true }, rng);
      b.push(rng ? rng.float(-0.3, 0.3) : 0, 0.75, rng ? rng.float(-0.6, 0.6) : 0);
      if (!rng || rng.chance(0.85)) PROPS.officeChair(b);
      b.pop();
      b.pop();
    }
  },

  // ---- bottling ----
  tank(b, p) {
    // a stainless process vessel on legs with a dished top, a ladder and a manway
    const r = p.r || 1.1;
    const h = p.h || 3.4;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + PI / 4;
      b.cyl('steelDark', Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8, 0.05, 0.6, { segs: 6 });
    }
    b.cyl('tankSteel', 0, 0.45, 0, r * 0.6, 0.3, { r1: r, segs: 20, noCap: true });
    b.cyl('tankSteel', 0, 0.75, 0, r, h, { segs: 20, noCap: true });
    b.cyl('tankSteel', 0, 0.75 + h, 0, r, 0.4, { r1: r * 0.25, segs: 20 });
    // bands and a gauge
    for (const y of [1.4, 2.4, 3.4]) if (y < h) b.cyl('steelDark', 0, y, 0, r + 0.015, 0.05, { segs: 20, noCap: true });
    b.cyl('chrome', 0, 1.4, r + 0.02, 0.1, 0.04, { segs: 12, rx: true });
    // ladder up the front
    for (const sx of [-0.2, 0.2]) b.box('steelDark', sx, 0.6, r + 0.12, 0.04, h + 0.4, 0.04);
    for (let y = 0.8; y < h + 0.9; y += 0.3) b.box('steelDark', 0, y, r + 0.12, 0.4, 0.025, 0.03);
    b.box('safetyYellow', 0, 1.0, r + 0.02, 0.3, 0.2, 0.004);
    b.collideBox(0, 0, r * 2 + 0.1, r * 2 + 0.3, h + 1);
  },

  conveyor(b, p, rng) {
    // a bottling line: a roller bed on legs with green bottles queued along it, guard rails
    const len = p.len || 6;
    for (let x = -len / 2 + 0.3; x <= len / 2 - 0.3 + 1e-6; x += 1.2)
      for (const sz of [-0.2, 0.2]) b.cyl('steelDark', x, 0, sz, 0.025, 0.82, { segs: 6, noCap: true });
    b.box('stainless', 0, 0.82, 0, len, 0.08, 0.5);
    b.box('rubber', 0, 0.9, 0, len, 0.01, 0.4);
    for (const sz of [-0.24, 0.24]) b.box('chrome', 0, 1.02, sz, len, 0.03, 0.02);
    if (rng) {
      let x = -len / 2 + 0.2;
      while (x < len / 2 - 0.2) {
        if (rng.chance(0.85)) {
          b.cyl('glass', x, 0.91, 0, 0.04, 0.2, { segs: 8 });
          b.cyl('glass', x, 1.11, 0, 0.04, 0.06, { r1: 0.014, segs: 8 });
        }
        x += rng.chance(0.2) ? 0.3 : 0.1;
      }
    }
    b.collideBox(0, 0, len, 0.55, 1.05);
  },

  pipeRun(b, p) {
    // overhead pipes along x at a height, with hangers up to the ceiling
    const len = p.len || 8;
    const y = p.y || 3.6;
    const ceil = p.ceil || 6;
    for (const [z, r, mat] of [[0, 0.12, 'steelPaint'], [0.34, 0.08, 'copper'], [-0.3, 0.06, 'metalGrey']]) {
      b.push(0, z, PI / 2);
      b.cyl(mat, 0, y, -len / 2, r, len, { segs: 10, rx: true, noCap: true });
      b.pop();
    }
    for (let x = -len / 2 + 0.5; x < len / 2; x += 2.5) b.box('steelDark', x, y + 0.12, 0, 0.03, ceil - y - 0.12, 0.03);
  },

  controlDesk(b, p, rng) {
    b.box('steelPaint', 0, 0, 0, 2.0, 0.85, 0.8, { seg: 0.5 });
    // sloped panel with dials
    b.push(0, -0.1, 0, 0.85);
    b.box('steelPaint', 0, 0, -0.1, 2.0, 0.35, 0.5);
    for (let k = 0; k < 8; k++) {
      const x = -0.85 + k * 0.24;
      b.cyl('chrome', x, 0.2, 0.16, 0.05, 0.02, { segs: 10, rx: true });
      b.box('lamp', x, 0.08, 0.152, 0.03, 0.03, 0.004, { glow: rng && rng.chance(0.4) ? [2.0, 0.4, 0.1] : [0.1, 0.03, 0.02] });
    }
    b.pop();
    b.collideBox(0, 0, 2.0, 0.85, 1.2);
  },

  // ---- yard ----
  lampPost(b, p) {
    // a sodium lamp on a tall pole with an outreach arm; the light pools orange on the asphalt
    const h = p.h || 6.5;
    b.cyl('steelDark', 0, 0, 0, 0.09, 0.25, { segs: 8 });
    b.cyl('metalGrey', 0, 0.25, 0, 0.06, h - 0.25, { r1: 0.045, segs: 8, noCap: true });
    b.box('metalGrey', 0, h - 0.05, 0.6, 0.05, 0.05, 1.2);
    b.box('steelDark', 0, h - 0.12, 1.25, 0.24, 0.14, 0.55);
    b.box('lamp', 0, h - 0.125, 1.25, 0.18, 0.005, 0.46, { glow: p.dead ? [0.05, 0.03, 0.01] : [2.6, 1.2, 0.3] });
    if (!p.dead) {
      b.light({ x: 0, y: h - 0.3, z: 1.25, type: 'spotDown', color: [1.0, 0.55, 0.18], power: p.power ?? 9, range: 16 });
      b.light({ x: 0, y: h - 0.4, z: 1.25, color: [1.0, 0.55, 0.2], power: 1.2, range: 14 });
    }
    b.collideBox(0, 0, 0.2, 0.2, h);
  },

  wallPack(b, p) {
    // a bulkhead floodlight over a door, origin on the wall
    const y = p.y || 2.8;
    b.box('steelDark', 0, y, 0.08, 0.32, 0.22, 0.16);
    b.box('lamp', 0, y + 0.02, 0.161, 0.26, 0.16, 0.004, { glow: [2.0, 1.6, 1.0], flicker: !!p.flicker });
    b.light({ x: 0, y: y - 0.1, z: 0.6, type: 'spotDown', color: [1.0, 0.82, 0.6], power: p.power ?? 3.2, range: 9, flicker: !!p.flicker });
  },

  dumpster(b) {
    b.box('steelPaint', 0, 0.15, 0, 1.9, 1.15, 1.1, { seg: 0.5 });
    b.box('steelDark', 0, 1.3, -0.02, 1.95, 0.06, 1.16, { rot: 0.04 });
    for (const sx of [-0.8, 0.8]) for (const sz of [-0.45, 0.45]) b.cyl('rubber', sx, 0, sz, 0.07, 0.15, { segs: 8 });
    b.box('hazard', 0, 0.3, 0.552, 1.6, 0.08, 0.004);
    b.collideBox(0, 0, 2.0, 1.2, 1.35);
  },

  oilDrum(b, p) {
    const mat = p.mat || 'oxblood';
    b.cyl(mat, 0, 0, 0, 0.29, 0.88, { segs: 14 });
    for (const y of [0.29, 0.58]) b.cyl('steelDark', 0, y, 0, 0.3, 0.025, { segs: 14, noCap: true });
    b.collideBox(0, 0, 0.6, 0.6, 0.9);
  },

  bollard(b) {
    b.cyl('safetyYellow', 0, 0, 0, 0.1, 1.0, { segs: 10 });
    b.cyl('rubber', 0, 0.75, 0, 0.102, 0.08, { segs: 10, noCap: true });
    b.collideBox(0, 0, 0.22, 0.22, 1.0);
  },

  bayLines(b, p) {
    // painted parking lines on the asphalt (flat, no collision)
    const len = p.len || 5;
    b.box('safetyYellow', 0, 0.002, 0, 0.1, 0.003, len, { seg: 2 });
  },

  // ---- the Strongbox (inside the van) ----
  terminal(b) {
    // a dot-matrix-era terminal on a shelf bolted to the van wall, origin on the wall
    b.box('steelDark', 0, 0.9, 0.22, 0.7, 0.04, 0.42);
    b.box('steelDark', 0, 0.6, 0.06, 0.04, 0.3, 0.1);
    b.box('beigePlastic', 0, 0.94, 0.2, 0.42, 0.36, 0.34);
    b.face('screen', [-0.15, 1.0, 0.371], [0.3, 0, 0], [0, 0.22, 0], [0, 0], { glow: [1.4, 1.2, 1.0], seg: 1, uvRect: [0, 0, 1, 1] });
    b.box('beigePlastic', 0, 0.94, 0.48, 0.44, 0.03, 0.16, { rot: 0 });
    b.light({ x: 0, y: 1.1, z: 0.6, color: [1.0, 0.62, 0.22], power: 0.25, range: 2.2 });
  },

  chute(b) {
    // the night-safe chute in the bulkhead: a steel hopper with a hinged flap, origin on the wall
    b.box('steelDark', 0, 0.75, 0.15, 0.7, 0.55, 0.3, { seg: 0.4 });
    b.box('chrome', 0, 1.0, 0.31, 0.56, 0.22, 0.02);
    b.box('rubber', 0, 1.02, 0.322, 0.46, 0.14, 0.004);
    b.box('safetyYellow', 0, 0.82, 0.302, 0.6, 0.1, 0.004);
    b.sign('NIGHT SAFE', 0, 1.3, 0.02, 0.6, 0.06, {});
    b.box('lamp', 0.3, 1.18, 0.31, 0.03, 0.03, 0.006, { glow: [0.2, 2.2, 0.4] });
    b.collideBox(0, 0.15, 0.7, 0.3, 1.3);
  },

  toolRack(b) {
    // a mesh rack on the van wall where requisitioned tools are clipped, origin on the wall
    b.box('steelDark', 0, 0.55, 0.2, 1.2, 0.04, 0.38);
    b.box('steelDark', 0, 1.25, 0.12, 1.2, 0.03, 0.22);
    for (let x = -0.55; x <= 0.56; x += 0.1) b.box('metalGrey', x, 0.58, 0.02, 0.008, 1.0, 0.008);
    b.collideBox(0, 0.2, 1.2, 0.4, 0.6);
  },

  governor(b) {
    // the governor: a sealed box with a red pull-handle, origin on the wall
    b.box('oxblood', 0, 1.15, 0.07, 0.3, 0.4, 0.14);
    b.box('chrome', 0, 1.22, 0.15, 0.2, 0.05, 0.05);
    b.box('safetyYellow', 0, 1.42, 0.141, 0.26, 0.06, 0.004);
    b.box('lamp', 0.1, 1.48, 0.141, 0.025, 0.025, 0.004, { glow: [2.2, 0.3, 0.1] });
  },

  cageLamp(b, p) {
    // a caged bulkhead bulb on the van ceiling
    const y = p.y || 2.1;
    b.cyl('steelDark', 0, y - 0.06, 0, 0.1, 0.06, { segs: 10 });
    b.cyl('shade', 0, y - 0.16, 0, 0.07, 0.1, { segs: 10, glow: [2.2, 1.7, 1.0] });
    for (let k = 0; k < 4; k++) b.box('steelDark', Math.cos((k * PI) / 2) * 0.08, y - 0.18, Math.sin((k * PI) / 2) * 0.08, 0.01, 0.13, 0.01);
    b.light({ x: 0, y: y - 0.2, z: 0, color: [1.0, 0.8, 0.55], power: p.power ?? 1.6, range: 5 });
  },

  bench(b, p) {
    const len = p.len || 2;
    b.box('steelDark', 0, 0.42, 0, len, 0.04, 0.4);
    b.box('vanInterior', 0, 0, -0.15, len, 0.42, 0.08);
    b.collideBox(0, 0, len, 0.42, 0.46);
  },
};

/** Run a prop recipe at its place. */
export function buildProp(b, p, rng) {
  const fn = PROPS[p.type];
  if (!fn) return;
  b.push(p.x, p.z, p.rot || 0, p.y0 || 0);
  fn(b, p, rng);
  b.pop();
}

/** Rotation so a prop against the given wall faces into the room. */
export function wallRot(dir) {
  return { N: 0, S: PI, W: PI / 2, E: -PI / 2 }[dir];
}
