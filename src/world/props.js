// Prop recipes. Each draws into a SceneBuilder `b` in a local frame where the prop's front
// faces +z and its origin is on the floor (wall props: origin on the wall surface).
// Recipes are pure: geometry comes only from params and the rng passed in.

const PI = Math.PI;

function legs(b, mat, w, d, h, inset = 0.04, r = 0.018) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    b.cyl(mat, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), r, h, { segs: 6, noCap: true });
}

export const PROPS = {
  chair(b, p) {
    const m = p.mat || 'vinylOrange';
    legs(b, 'chrome', 0.62, 0.6, 0.26);
    b.box(m, 0, 0.26, 0, 0.66, 0.16, 0.62, { seg: 0.35 });
    b.box(m, 0, 0.42, -0.26, 0.66, 0.42, 0.12, { seg: 0.35 });
    // tubular chrome arms
    for (const sx of [-0.35, 0.35]) {
      b.box('chrome', sx, 0.6, -0.02, 0.035, 0.035, 0.56);
      b.cyl('chrome', sx, 0.26, 0.24, 0.016, 0.36, { segs: 6, noCap: true });
    }
    b.collideBox(0, 0, 0.72, 0.64, 0.8);
  },

  sofa(b, p) {
    const m = p.mat || 'vinylOrange';
    const w = p.w || 1.9;
    legs(b, 'chrome', w, 0.7, 0.22);
    b.box(m, 0, 0.22, 0.02, w, 0.2, 0.68, { seg: 0.4 });
    b.box(m, 0, 0.42, -0.28, w, 0.42, 0.14, { seg: 0.4 });
    b.box(m, -w / 2 + 0.07, 0.42, 0.02, 0.14, 0.16, 0.66);
    b.box(m, w / 2 - 0.07, 0.42, 0.02, 0.14, 0.16, 0.66);
    b.collideBox(0, 0, w + 0.05, 0.75, 0.84);
  },

  coffeeTable(b, p) {
    const w = p.w || 1.2;
    const d = p.d || 0.6;
    legs(b, 'chrome', w, d, 0.38, 0.06, 0.015);
    b.box('walnut', 0, 0.38, 0, w, 0.04, d);
    b.collideBox(0, 0, w, d, 0.42);
  },

  deskCounter(b, p, rng) {
    const len = p.len || 3;
    b.box('blackPlastic', 0, 0, 0.06, len - 0.04, 0.1, 0.62);
    b.box('walnut', 0, 0.1, 0.33, len, 0.92, 0.06, { seg: 0.4 });
    b.box('walnut', 0, 0.1, -0.3, len, 0.92, 0.06);
    b.box('laminate', 0, 1.02, 0.03, len + 0.06, 0.04, 0.78);
    b.box('laminate', 0, 0.74, -0.15, len - 0.1, 0.03, 0.4);
    b.collideBox(0, 0, len + 0.06, 0.8, 1.06);
    if (p.bell !== false) {
      b.cyl('brass', len * 0.28, 1.06, 0.18, 0.05, 0.015, { segs: 10 });
      b.cyl('brass', len * 0.28, 1.075, 0.18, 0.04, 0.03, { r1: 0.012, segs: 10 });
      b.cyl('chrome', len * 0.28, 1.105, 0.18, 0.004, 0.012, { segs: 4 });
    }
    // ledger and a pen
    b.box('paper', -len * 0.2, 1.06, 0.12, 0.42, 0.02, 0.3, { rot: 0.08 });
    b.box('blackPlastic', -len * 0.2 + 0.1, 1.08, 0.12, 0.13, 0.008, 0.008, { rot: 0.7 });
    // rotary phone behind the counter
    b.push(len * 0.38, -0.12, -0.2 + (rng ? rng.float(-0.2, 0.2) : 0), 0);
    PROPS.phone(b, { y: 1.06 });
    b.pop();
  },

  phone(b, p) {
    const y = p.y || 0;
    b.box('beigePlastic', 0, y, 0, 0.2, 0.08, 0.22);
    b.box('beigePlastic', 0, y + 0.08, -0.02, 0.17, 0.03, 0.14);
    b.cyl('chrome', 0, y + 0.08, 0.06, 0.05, 0.006, { segs: 10 });
    b.box('beigePlastic', 0, y + 0.11, -0.02, 0.22, 0.04, 0.05);
  },

  keyBoard(b, p, rng) {
    // wall-mounted key cabinet, origin on the wall
    const w = p.w || 1.6;
    const h = 1.0;
    const y0 = 1.25;
    b.box('walnut', 0, y0, 0.03, w, h, 0.06, { seg: 0.4 });
    const cols = 10;
    const rows = 4;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = -w / 2 + (w / cols) * (c + 0.5);
        const y = y0 + h - 0.2 - r * 0.24;
        b.box('brass', x, y, 0.07, 0.012, 0.012, 0.03);
        const taken = rng ? rng.chance(0.55) : true;
        if (taken) {
          b.box('brass', x, y - 0.075, 0.07, 0.022, 0.065, 0.006);
          b.box('paperTag', x, y - 0.15, 0.075, 0.038, 0.06, 0.004);
        }
      }
  },

  plant(b, p, rng) {
    b.cyl('ceramic', 0, 0, 0, 0.2, 0.4, { r1: 0.24, segs: 12 });
    b.cyl('soil', 0, 0.38, 0, 0.22, 0.01, { segs: 12 });
    // a rubber plant: a stem with broad flat leaves radiating at different heights
    b.cyl('walnut', 0, 0.38, 0, 0.018, 0.95, { segs: 5, noCap: true });
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = k * 2.4 + (rng ? rng.float(0, 0.4) : 0);
      const y = 0.55 + (k / n) * 0.75;
      const len = 0.34 - (k / n) * 0.12;
      b.push(0, 0, a, y);
      b.box('leaf', 0, 0, len / 2 + 0.02, 0.11, 0.012, len);
      b.pop();
    }
    b.collideBox(0, 0, 0.48, 0.48, 1);
  },

  ashtray(b) {
    b.cyl('chrome', 0, 0, 0, 0.14, 0.02, { segs: 10 });
    b.cyl('chrome', 0, 0.02, 0, 0.025, 0.55, { segs: 8, noCap: true });
    b.cyl('chrome', 0, 0.57, 0, 0.13, 0.05, { r1: 0.15, segs: 12 });
    b.cyl('sand', 0, 0.615, 0, 0.13, 0.004, { segs: 12 });
    b.collideBox(0, 0, 0.3, 0.3, 0.62);
  },

  clock(b, p) {
    // wall clock with no hands, origin on the wall
    const y = p.y || 2.1;
    b.box('walnut', 0, y - 0.2, 0.02, 0.42, 0.42, 0.04);
    b.face('clockFace', [-0.18, y - 0.18, 0.041], [0.36, 0, 0], [0, 0.36, 0], [0, 0], { seg: 1, uvRect: [0, 0, 1, 1] });
  },

  tableLamp(b, p) {
    const y = p.y || 0;
    b.cyl('brass', 0, y, 0, 0.08, 0.02, { segs: 10 });
    b.cyl('brass', 0, y + 0.02, 0, 0.012, 0.32, { segs: 6, noCap: true });
    b.cyl('shade', 0, y + 0.3, 0, 0.17, 0.2, { r1: 0.11, segs: 12, noCap: true, glow: [0.8, 0.52, 0.28] });
    b.light({ x: 0, y: y + 0.42, z: 0, color: [1.0, 0.72, 0.42], power: p.power ?? 0.9, range: 5 });
  },

  pendant(b, p) {
    // a drum pendant hanging from the ceiling, throwing a pool of warm light downward
    const ceil = p.ceil || 3;
    const y = ceil - (p.drop || 0.9);
    b.cyl('brass', 0, y + 0.22, 0, 0.006, ceil - y - 0.22, { segs: 4, noCap: true });
    b.cyl('brass', 0, y, 0, 0.24, 0.22, { r1: 0.2, segs: 14, noCap: true });
    b.cyl('lamp', 0, y + 0.01, 0, 0.22, 0.004, { segs: 14, glow: [1.6, 1.15, 0.7], flicker: !!p.flicker });
    b.light({ x: 0, y: y - 0.05, z: 0, type: 'spotDown', color: [1.0, 0.78, 0.5], power: p.power ?? 2.2, range: 6, flicker: !!p.flicker });
    b.light({ x: 0, y: y + 0.1, z: 0, color: [1.0, 0.75, 0.45], power: 0.25, range: 3 });
  },

  sconce(b, p) {
    const y = p.y || 1.8;
    b.box('brass', 0, y - 0.12, 0.01, 0.1, 0.24, 0.02);
    b.cyl('shade', 0, y - 0.05, 0.11, 0.08, 0.16, { r1: 0.1, segs: 10, glow: [0.75, 0.5, 0.28], flicker: !!p.flicker, noCap: true });
    b.light({ x: 0, y: y + 0.05, z: 0.2, color: [1.0, 0.7, 0.4], power: p.power ?? 0.7, range: 5, flicker: !!p.flicker });
  },

  hotelDoor(b, p) {
    // a closed guest-room door set into the wall, origin on the wall surface
    const w = 0.92;
    const h = 2.05;
    b.box('doorFrame', -w / 2 - 0.04, 0, 0.02, 0.08, h + 0.04, 0.04);
    b.box('doorFrame', w / 2 + 0.04, 0, 0.02, 0.08, h + 0.04, 0.04);
    b.box('doorFrame', 0, h, 0.02, w + 0.16, 0.08, 0.04);
    b.box(p.mat || 'woodDoor', 0, 0, 0.012, w, h, 0.024, { skip: 'nz', seg: 0.5 });
    b.cyl('brass', w / 2 - 0.1, 0.98, 0.045, 0.028, 0.02, { segs: 8 });
    b.box('brass', w / 2 - 0.1, 0.94, 0.026, 0.05, 0.12, 0.006);
    if (p.num) {
      b.box('brass', 0, 1.52, 0.026, 0.26, 0.12, 0.006);
      b.digits(String(p.num), 0, 1.545, 0.03, 0.07);
    }
    if (p.hanger) b.box('paperTag', w / 2 - 0.1, 0.76, 0.06, 0.09, 0.2, 0.004);
  },

  exitSign(b, p) {
    const y = p.y || 2.25;
    b.box('beigePlastic', 0, y, 0.06, 0.34, 0.16, 0.1);
    b.push(0, 0.111, 0);
    b.sign('EXIT', 0, y + 0.02, 0, 0.3, 0.12, { glow: [2.4, 0.25, 0.18] });
    b.pop();
    b.light({ x: 0, y: y + 0.05, z: 0.3, color: [1, 0.12, 0.08], power: 0.12, range: 3 });
  },

  sign(b, p) {
    const y = p.y || 2.0;
    const w = p.w || 1.4;
    const h = p.h || w / 10;
    if (p.board !== false) b.box(p.boardMat || 'walnut', 0, y - 0.04, 0.012, w + 0.08, h + 0.08, 0.024);
    b.sign(p.text, 0, y, p.board !== false ? 0.025 : 0.004, w, h, p.glow ? { glow: p.glow } : {});
  },

  iceMachine(b) {
    b.box('stainless', 0, 0, 0, 0.8, 1.55, 0.72, { seg: 0.4 });
    b.box('blackPlastic', 0, 0.55, 0.36, 0.5, 0.42, 0.02);
    b.box('stainless', 0, 1.05, 0.37, 0.6, 0.06, 0.04);
    b.sign('ICE', 0, 1.25, 0.362, 0.4, 0.18, {});
    b.box('lamp', 0.3, 1.4, 0.362, 0.03, 0.03, 0.005, { glow: [0.1, 1.6, 0.4] });
    b.light({ x: 0, y: 1.0, z: 0.6, color: [0.6, 0.85, 1.0], power: 0.15, range: 2.5 });
    b.collideBox(0, 0, 0.82, 0.74, 1.6);
  },

  vending(b, p) {
    b.box('vendingBody', 0, 0, 0, 0.95, 1.85, 0.8, { seg: 0.4 });
    b.face('vendingGlow', [-0.38, 0.55, 0.402], [0.6, 0, 0], [0, 1.15, 0], [0, 0], { glow: [1.4, 1.5, 1.6], seg: 0.4, uvRect: [0, 0, 1, 1], flicker: !!p.flicker });
    b.box('blackPlastic', 0.33, 0.9, 0.4, 0.18, 0.5, 0.02);
    b.box('blackPlastic', 0, 0.15, 0.4, 0.6, 0.22, 0.02);
    b.light({ x: 0, y: 1.1, z: 0.8, color: [0.8, 0.92, 1.0], power: 0.55, range: 4, flicker: !!p.flicker });
    b.collideBox(0, 0, 0.97, 0.82, 1.9);
  },

  cart(b) {
    legs(b, 'chrome', 0.9, 0.55, 0.78, 0.03, 0.012);
    b.box('stainless', 0, 0.2, 0, 0.88, 0.02, 0.53);
    b.box('linen', 0, 0.62, 0, 0.94, 0.18, 0.6, { skip: 'bottom' });
    b.box('linen', 0, 0.78, 0, 0.94, 0.02, 0.6);
    b.cyl('chrome', 0.15, 0.8, 0, 0.16, 0.14, { r1: 0.05, segs: 12 });
    b.cyl('ceramic', -0.25, 0.8, 0.1, 0.05, 0.08, { segs: 8 });
    b.collideBox(0, 0, 0.96, 0.62, 0.95);
  },

  bed(b, p) {
    const w = p.w || 1.4;
    const l = 2.0;
    b.box('walnut', 0, 0, l / 2, w + 0.06, 0.3, l, { seg: 0.5 });
    b.box('mattress', 0, 0.3, l / 2, w, 0.2, l - 0.04, { seg: 0.5 });
    b.box(p.cover || 'fabricFloral', 0, 0.5, l / 2 + 0.2, w + 0.04, 0.05, l - 0.4, { seg: 0.35 });
    b.box(p.cover || 'fabricFloral', 0, 0.12, l / 2 + 0.2, w + 0.1, 0.43, 0.02, { skip: 'nz' });
    b.box('linen', -w / 4, 0.5, 0.25, w / 2 - 0.08, 0.12, 0.38);
    b.box('linen', w / 4, 0.5, 0.25, w / 2 - 0.08, 0.12, 0.38);
    b.box('walnut', 0, 0, 0.03, w + 0.2, 1.15, 0.06, { seg: 0.4 });
    b.collideBox(0, l / 2, w + 0.2, l, 0.6);
  },

  nightstand(b, p) {
    b.box('walnut', 0, 0, 0, 0.5, 0.55, 0.42);
    b.box('blackPlastic', 0, 0.38, 0.212, 0.3, 0.02, 0.006);
    b.collideBox(0, 0, 0.5, 0.42, 0.55);
    if (p.lamp) {
      b.push(0, -0.03);
      PROPS.tableLamp(b, { y: 0.55, power: p.power ?? 0.75 });
      b.pop();
    }
  },

  dresser(b, p) {
    const w = p.w || 1.6;
    b.box('walnut', 0, 0, 0, w, 0.78, 0.5, { seg: 0.4 });
    for (let k = 0; k < 3; k++) b.box('blackPlastic', 0, 0.2 + k * 0.22, 0.252, w - 0.3, 0.012, 0.006);
    b.collideBox(0, 0, w, 0.5, 0.78);
    if (p.tv) {
      b.push(p.tvX ?? 0.3, 0, p.tvRot ?? 0, 0.78);
      PROPS.tv(b, p);
      b.pop();
    }
  },

  tv(b, p) {
    // a 1970s console set; screen glows with static when p.static
    b.box('woodVeneer', 0, 0, 0, 0.62, 0.48, 0.45);
    b.box('blackPlastic', -0.06, 0.06, 0.226, 0.44, 0.36, 0.006);
    const on = p.static !== false;
    b.face(on ? 'tvStatic' : 'glass', [-0.25, 0.09, 0.231], [0.38, 0, 0], [0, 0.3, 0], [0, 0], on ? { glow: [0.9, 0.95, 1.05], seg: 1, uvRect: [0, 0, 1, 1] } : { seg: 1 });
    b.cyl('chrome', 0.22, 0.25, 0.23, 0.018, 0.01, { segs: 8 });
    b.cyl('chrome', 0.22, 0.15, 0.23, 0.018, 0.01, { segs: 8 });
    b.push(0, 0, 0.4, 0.48);
    b.box('chrome', -0.12, 0, 0, 0.008, 0.36, 0.008, { rot: 0.0 });
    b.pop();
    if (on) b.light({ x: -0.06, y: 0.25, z: 0.45, color: [0.62, 0.72, 0.95], power: 0.35, range: 3.5, flicker: true });
  },

  window(b, p) {
    // blinds drawn over a window that is always lit from outside; origin on the wall
    const w = p.w || 1.6;
    const h = p.h || 1.3;
    const y = p.y || 0.9;
    b.box('doorFrame', 0, y - 0.06, 0.05, w + 0.12, 0.06, 0.12);
    b.box('doorFrame', 0, y + h, 0.02, w + 0.12, 0.06, 0.04);
    b.box('doorFrame', -w / 2 - 0.03, y, 0.02, 0.06, h, 0.04);
    b.box('doorFrame', w / 2 + 0.03, y, 0.02, 0.06, h, 0.04);
    b.face('blinds', [-w / 2, y, 0.01], [w, 0, 0], [0, h, 0], [0, 0], { glow: [0.62, 0.66, 0.58], seg: 0.5, uvScale: 1 });
    // the pull cord and bottom rail
    b.box('doorFrame', 0, y + 0.02, 0.025, w, 0.03, 0.02);
    b.box('linen', w / 2 - 0.12, y + 0.1, 0.03, 0.006, h - 0.15, 0.006);
    b.light({ x: 0, y: y + h / 2, z: 0.35, color: [0.92, 0.95, 0.88], power: (p.power ?? 1) * 1.2, range: 6 });
  },

  labBed(b) {
    legs(b, 'chrome', 0.9, 1.95, 0.55, 0.05, 0.02);
    b.box('chrome', 0, 0.5, 0, 0.92, 0.05, 1.96);
    b.box('mattress', 0, 0.55, 0, 0.86, 0.14, 1.9, { seg: 0.5 });
    b.box('linen', 0, 0.69, 0.2, 0.9, 0.03, 1.4, { seg: 0.5 });
    b.box('linen', 0, 0.69, -0.72, 0.6, 0.1, 0.34);
    b.box('chrome', -0.47, 0.75, 0.1, 0.02, 0.2, 1.2);
    b.box('chrome', 0, 0.55, -0.98, 0.9, 0.6, 0.03);
    b.collideBox(0, 0, 0.96, 2.0, 0.85);
  },

  eegCart(b, p, rng) {
    legs(b, 'chrome', 0.6, 0.45, 0.7, 0.03, 0.014);
    b.box('beigePlastic', 0, 0.7, 0, 0.62, 0.55, 0.47);
    b.box('blackPlastic', -0.08, 0.9, 0.236, 0.34, 0.26, 0.006);
    b.face('scope', [-0.23, 0.92, 0.24], [0.3, 0, 0], [0, 0.22, 0], [0, 0], { glow: [0.25, 1.3, 0.55], seg: 1, uvRect: [0, 0, 1, 1] });
    for (let k = 0; k < 4; k++) b.cyl('blackPlastic', 0.17, 0.8 + k * 0.1, 0.24, 0.022, 0.02, { segs: 8 });
    const on = rng ? rng.int(0, 3) : 1;
    for (let k = 0; k < 4; k++) b.box('lamp', -0.22 + k * 0.06, 0.78, 0.236, 0.02, 0.02, 0.004, { glow: k === on ? [2.2, 0.3, 0.2] : [0.15, 0.04, 0.03] });
    b.light({ x: 0, y: 1.0, z: 0.4, color: [0.4, 1.0, 0.6], power: 0.08, range: 2 });
    b.collideBox(0, 0, 0.64, 0.5, 1.25);
  },

  desk(b, p) {
    const w = p.w || 1.4;
    b.box('laminate', 0, 0.72, 0, w, 0.04, 0.72);
    b.box('metalGrey', w / 2 - 0.22, 0, 0, 0.4, 0.72, 0.68);
    for (let k = 0; k < 3; k++) b.box('chrome', w / 2 - 0.22, 0.15 + k * 0.22, 0.342, 0.1, 0.02, 0.01);
    b.box('metalGrey', -w / 2 + 0.03, 0, 0, 0.04, 0.72, 0.68);
    b.box('metalGrey', 0, 0.3, -0.33, w - 0.1, 0.4, 0.02);
    b.collideBox(0, 0, w, 0.74, 0.76);
    if (p.papers) {
      b.box('paper', -0.2, 0.76, 0.05, 0.3, 0.02, 0.22, { rot: 0.2 });
      b.box('paper', 0.05, 0.76, -0.05, 0.22, 0.03, 0.3, { rot: -0.1 });
    }
  },

  officeChair(b) {
    b.cyl('blackPlastic', 0, 0, 0, 0.28, 0.05, { segs: 5 });
    b.cyl('chrome', 0, 0.05, 0, 0.025, 0.35, { segs: 6, noCap: true });
    b.box('vinylBrown', 0, 0.4, 0, 0.48, 0.08, 0.46);
    b.box('vinylBrown', 0, 0.55, -0.22, 0.44, 0.45, 0.06);
    b.collideBox(0, 0, 0.56, 0.56, 1);
  },

  filing(b) {
    b.box('metalGrey', 0, 0, 0, 0.46, 1.32, 0.62, { seg: 0.35 });
    for (let k = 0; k < 4; k++) b.box('chrome', 0, 0.22 + k * 0.32, 0.312, 0.14, 0.025, 0.012);
    b.collideBox(0, 0, 0.46, 0.62, 1.32);
  },

  shelf(b, p, rng) {
    const w = p.w || 1.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('metalGrey', sx * (w / 2 - 0.02), 0, sz * 0.18, 0.03, 1.9, 0.03);
    for (let k = 0; k < 5; k++) {
      const y = 0.08 + k * 0.44;
      b.box('metalGrey', 0, y, 0, w, 0.02, 0.4);
      if (k < 4 && rng) {
        let x = -w / 2 + 0.05;
        while (x < w / 2 - 0.2) {
          const bw = rng.float(0.18, 0.36);
          if (rng.chance(0.75)) b.box(rng.pick(['cardboard', 'cardboard', 'paper', 'linen']), x + bw / 2, y + 0.02, rng.float(-0.04, 0.04), bw - 0.02, rng.float(0.12, 0.34), 0.32);
          x += bw;
        }
      }
    }
    b.collideBox(0, 0, w, 0.42, 1.9);
  },

  obsWindow(b, p) {
    // one-way observation glass, origin on the wall
    const w = p.w || 2.2;
    b.box('doorFrame', 0, 0.95, 0.03, w + 0.14, 0.07, 0.08);
    b.box('doorFrame', 0, 2.05, 0.02, w + 0.14, 0.07, 0.05);
    b.face('mirror', [-w / 2, 1.02, 0.012], [w, 0, 0], [0, 1.03, 0], [0, 0], { seg: 0.6 });
    b.box('doorFrame', -w / 2 - 0.035, 1.0, 0.02, 0.07, 1.06, 0.05);
    b.box('doorFrame', w / 2 + 0.035, 1.0, 0.02, 0.07, 1.06, 0.05);
  },

  fireExt(b) {
    b.box('chrome', 0, 1.0, 0.02, 0.12, 0.08, 0.04);
    b.cyl('redPaint', 0, 0.55, 0.11, 0.075, 0.5, { segs: 10 });
    b.cyl('blackPlastic', 0, 1.05, 0.11, 0.03, 0.08, { segs: 6 });
  },

  payphone(b) {
    b.box('chrome', 0, 1.05, 0.11, 0.32, 0.6, 0.22, { seg: 0.3 });
    b.box('blackPlastic', -0.1, 1.2, 0.225, 0.07, 0.24, 0.05);
    b.box('chrome', 0.06, 1.35, 0.222, 0.14, 0.18, 0.006);
  },

  paperStack(b, p) {
    const y = p.y || 0;
    b.box('paper', 0, y, 0, 0.24, 0.015, 0.31, { rot: p.r || 0 });
  },

  loreDoc(b, p) {
    // the found document for this place: a folder on a small table just inside the first door
    if (!p.onSurface) {
      b.box('walnut', 0, 0.7, 0, 0.55, 0.035, 0.45);
      b.cyl('chrome', 0, 0, 0, 0.02, 0.7, { segs: 6, noCap: true });
      b.cyl('chrome', 0, 0, 0, 0.18, 0.015, { segs: 10 });
      b.collideBox(0, 0, 0.5, 0.45, 0.75);
    }
    const y = p.onSurface ? p.y : 0.735;
    b.box('manila', 0.02, y, 0, 0.24, 0.012, 0.31, { rot: 0.12 });
    b.box('paper', -0.01, y + 0.012, 0.01, 0.21, 0.004, 0.28, { rot: 0.05 });
  },

  // ---- ballroom ----

  roundTable(b, p, rng) {
    // a banquet round with a floor-length cloth, a brass centrepiece and chairs pulled up (or not)
    const r = p.r || 0.75;
    b.cyl('tablecloth', 0, 0.02, 0, r + 0.04, 0.74, { r1: r + 0.1, segs: 18, noCap: true });
    b.cyl('tablecloth', 0, 0.74, 0, r + 0.04, 0.02, { segs: 18 });
    b.cyl('brass', 0, 0.76, 0, 0.07, 0.02, { segs: 10 });
    b.cyl('brass', 0, 0.78, 0, 0.012, 0.22, { segs: 6, noCap: true });
    b.cyl('shade', 0, 0.98, 0, 0.035, 0.07, { r1: 0.045, segs: 8, glow: [1.0, 0.62, 0.3] });
    b.light({ x: 0, y: 1.05, z: 0, color: [1.0, 0.7, 0.4], power: 0.28, range: 2.5 });
    // place settings
    const n = p.seats || 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const sx = Math.sin(a);
      const sz = Math.cos(a);
      b.cyl('ceramic', sx * (r - 0.2), 0.755, sz * (r - 0.2), 0.11, 0.012, { segs: 12 });
      if (rng && rng.chance(0.4)) b.box('paperTag', sx * (r - 0.38), 0.765, sz * (r - 0.38), 0.07, 0.03, 0.02, { rot: a });
      // gilt banquet chair, some pushed back, one or two knocked askew
      const out = r + 0.28 + (rng ? rng.float(0, 0.25) : 0);
      const skew = rng ? rng.float(-0.3, 0.3) : 0;
      b.push(sx * out, sz * out, a + Math.PI + skew);
      legs(b, 'brass', 0.42, 0.42, 0.45, 0.03, 0.012);
      b.box('velvet', 0, 0.45, 0, 0.44, 0.06, 0.42);
      // gilt frame back: two posts and a top rail around a velvet pad
      for (const s of [-1, 1]) b.box('brass', s * 0.2, 0.5, -0.2, 0.025, 0.5, 0.025);
      b.box('brass', 0, 0.96, -0.2, 0.42, 0.04, 0.03);
      b.box('velvet', 0, 0.6, -0.2, 0.36, 0.32, 0.03);
      b.pop();
    }
    b.collideBox(0, 0, (r + 0.5) * 2, (r + 0.5) * 2, 0.8);
  },

  chandelier(b, p) {
    // a brass hoop of candle bulbs with hanging drops, warm and a little too bright
    const ceil = p.ceil || 4;
    const y = ceil - (p.drop || 1.1);
    const R = p.R || 0.55;
    const fl = !!p.flicker;
    // chain and ceiling rose
    b.cyl('brass', 0, ceil - 0.04, 0, 0.12, 0.04, { r1: 0.08, segs: 12 });
    b.cyl('brass', 0, y + 0.3, 0, 0.012, ceil - y - 0.3, { segs: 5, noCap: true });
    // central column: a turned brass stem with a bowl underneath
    b.cyl('brass', 0, y - 0.05, 0, 0.05, 0.4, { r1: 0.03, segs: 10 });
    b.cyl('brass', 0, y - 0.22, 0, 0.11, 0.17, { r1: 0.02, segs: 12 });
    const tiers = p.tiers || 1;
    for (let t = 0; t < tiers; t++) {
      const r = t ? R * 0.55 : R;
      const ty = y + t * 0.32;
      const n = t ? 6 : 10;
      // the hoop itself: short tangent bars around the ring
      for (let k = 0; k < n * 2; k++) {
        const a = ((k + 0.5) / (n * 2)) * Math.PI * 2;
        b.box('brass', Math.sin(a) * r, ty, Math.cos(a) * r, (2 * Math.PI * r) / (n * 2) + 0.02, 0.025, 0.025, { rot: a });
      }
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = Math.sin(a) * r;
        const z = Math.cos(a) * r;
        b.box('brass', x / 2, ty - 0.02, z / 2, 0.015, 0.015, r, { rot: a });
        b.cyl('brass', x, ty + 0.02, z, 0.045, 0.02, { segs: 8 });
        b.cyl('enamel', x, ty + 0.04, z, 0.016, 0.11, { segs: 6 });
        b.cyl('lamp', x, ty + 0.15, z, 0.03, 0.07, { r1: 0.008, segs: 6, glow: [2.4, 1.6, 0.85], flicker: fl });
        // strings of glass drops hanging off the hoop
        for (let d = 0; d < 3; d++) b.box('chrome', Math.sin(a + 0.3) * r, ty - 0.07 - d * 0.07, Math.cos(a + 0.3) * r, 0.025, 0.05, 0.025, { rot: a });
      }
    }
    // the bulbs shade the ceiling a little: light sits under the hoop
    b.light({ x: 0, y: y - 0.25, z: 0, color: [1.0, 0.76, 0.48], power: p.power ?? 2.2, range: 9, flicker: fl });
  },

  stage(b, p) {
    // a low bandstand with a velvet backdrop, an empty music stand and a microphone
    const w = p.w || 4;
    const d = p.d || 2.2;
    b.box('walnut', 0, 0, 0, w, 0.45, d, { seg: 0.5 });
    b.box('parquet', 0, 0.45, 0, w, 0.005, d, { seg: 0.5 });
    b.box('velvet', 0, 0.45, -d / 2 + 0.05, w, 2.6, 0.08, { seg: 0.6 });
    b.cyl('chrome', 0.3, 0.45, 0.4, 0.012, 1.45, { segs: 6, noCap: true });
    b.cyl('blackPlastic', 0.3, 1.9, 0.4, 0.025, 0.08, { segs: 8 });
    b.cyl('chrome', 0.3, 0.45, 0.4, 0.13, 0.015, { segs: 10 });
    for (const sx of [-1.2, -0.6, 0.9]) {
      b.cyl('chrome', sx, 0.45, -0.2, 0.01, 0.95, { segs: 5, noCap: true });
      b.box('blackPlastic', sx, 1.35, -0.18, 0.4, 0.28, 0.02, { rot: 0 });
    }
    b.box('walnut', 0, 0, d / 2 + 0.2, 1.0, 0.22, 0.4);
    // footlights along the lip and a warm wash on the curtain
    b.box('brass', 0, 0.44, d / 2 - 0.06, w - 0.2, 0.04, 0.08);
    for (let x = -w / 2 + 0.35; x < w / 2 - 0.2; x += 0.5) b.box('lamp', x, 0.48, d / 2 - 0.06, 0.1, 0.025, 0.04, { glow: [2.0, 1.3, 0.7] });
    b.light({ x: 0, y: 0.7, z: d / 2 - 0.3, color: [1.0, 0.72, 0.45], power: 0.9, range: 4.5 });
    b.light({ x: 0, y: 2.6, z: 0.2, color: [1.0, 0.78, 0.55], power: 1.1, range: 5 });
    b.collideBox(0, 0, w, d + 0.4, 0.45);
  },

  // ---- laundry ----

  washer(b, p) {
    // a coin-op front loader (or a dryer: p.dryer), enamel, chrome porthole
    b.box('blackPlastic', 0, 0, 0.02, 0.62, 0.07, 0.6);
    b.box('enamel', 0, 0.07, 0, 0.68, 0.85, 0.66, { seg: 0.35 });
    b.box('metalGrey', 0, 0.918, 0, 0.69, 0.008, 0.67);
    // console: coin slide, a dial, a slot of a display
    b.box('enamel', 0, 0.92, -0.25, 0.68, 0.16, 0.16);
    b.box('steelDark', -0.13, 0.98, -0.168, 0.28, 0.07, 0.006);
    b.box('chrome', 0.18, 0.96, -0.172, 0.14, 0.09, 0.016);
    b.cyl('blackPlastic', 0.04, 1.01, -0.17, 0.025, 0.02, { segs: 8, rx: true });
    // porthole: chrome bezel, smoked glass, a hinge and a handle
    b.cyl('chrome', 0, 0.5, 0.33, 0.215, 0.03, { segs: 18, rx: true });
    const lit = p.dryer && p.on;
    b.cyl(lit ? 'lamp' : 'glass', 0, 0.5, 0.36, 0.165, 0.008, lit ? { segs: 16, rx: true, glow: [0.85, 0.58, 0.3] } : { segs: 16, rx: true });
    b.box('chrome', -0.215, 0.42, 0.33, 0.03, 0.16, 0.025);
    b.box('chrome', 0.215, 0.47, 0.33, 0.03, 0.06, 0.035);
    if (lit) b.light({ x: 0, y: 0.5, z: 0.6, color: [1.0, 0.7, 0.4], power: 0.18, range: 2 });
    b.collideBox(0, 0, 0.7, 0.68, 1.06);
  },

  foldingTable(b, p, rng) {
    const w = p.w || 1.8;
    legs(b, 'chrome', w, 0.75, 0.86, 0.06, 0.016);
    b.box('laminate', 0, 0.86, 0, w, 0.03, 0.75);
    // folded linen in stacks
    let x = -w / 2 + 0.2;
    while (x < w / 2 - 0.25) {
      const n = rng ? rng.int(2, 7) : 4;
      for (let k = 0; k < n; k++) b.box('linen', x + (rng ? rng.float(-0.01, 0.01) : 0), 0.89 + k * 0.05, rng ? rng.float(-0.1, 0.1) : 0, 0.34, 0.045, 0.3, { rot: rng ? rng.float(-0.05, 0.05) : 0 });
      x += 0.42;
    }
    b.collideBox(0, 0, w, 0.75, 0.9);
  },

  breakerPanel(b, p) {
    // wall-mounted main panel, every breaker thrown; and beside it the meter. Origin on the wall.
    const y = 1.0;
    b.box('metalGrey', 0, y, 0.06, 0.62, 1.0, 0.12, { seg: 0.35 });
    b.box('metalGrey', 0, y + 0.02, 0.122, 0.56, 0.94, 0.006);
    for (let k = 0; k < 20; k++)
      for (const sx of [-0.12, 0.12]) {
        b.box('blackPlastic', sx, y + 0.1 + k * 0.042, 0.13, 0.11, 0.028, 0.014);
        b.box('blackPlastic', sx + 0.04, y + 0.1 + k * 0.042, 0.142, 0.022, 0.016, 0.022, { rot: 0 });
      }
    b.box('paperTag', 0, y + 0.93, 0.13, 0.4, 0.05, 0.004);
    // the meter: a glass dome over a disc, and a red tag hung on it
    b.box('metalGrey', 0.62, y + 0.55, 0.05, 0.3, 0.42, 0.1);
    b.cyl('glass', 0.62, y + 0.76, 0.1, 0.12, 0.1, { segs: 14, rx: true });
    b.box('chrome', 0.62, y + 0.73, 0.16, 0.16, 0.008, 0.004);
    b.box('redPaint', 0.62, y + 0.42, 0.11, 0.08, 0.12, 0.004);
    // conduit up to the ceiling
    b.cyl('metalGrey', -0.2, y + 1.0, 0.05, 0.03, 2, { segs: 6, noCap: true });
    b.cyl('metalGrey', 0.2, y + 1.0, 0.05, 0.03, 2, { segs: 6, noCap: true });
  },

  // ---- drafting room ----

  draftingTable(b, p, rng) {
    // a tilted drawing board on a steel stand with a plan taped to it and a clamp-arm lamp
    // steel trestle: a post and a foot each side, a stretcher between
    for (const sx of [-0.55, 0.55]) {
      b.box('steelDark', sx, 0, 0, 0.05, 0.02, 0.66);
      b.box('steelDark', sx, 0.02, -0.05, 0.045, 0.9, 0.045);
      b.box('steelDark', sx, 0.86, -0.05, 0.05, 0.05, 0.5);
    }
    b.box('steelDark', 0, 0.22, -0.05, 1.1, 0.04, 0.035);
    // the board, tilted toward the draftsman (front edge low, at +z)
    const t = 0.28;
    const D = 0.9;
    const W = 1.3;
    const yF = 0.86;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const o = [-W / 2, yF, D / 2];
    const v = [0, D * st, -D * ct];
    b.face('draftBoard', o, [W, 0, 0], v, [0, 0], { seg: 0.7 });
    b.face('steelDark', [o[0], o[1] - 0.025, o[2]], v, [W, 0, 0], [0, 0], { seg: 0.7 });
    b.box('draftBoard', 0, yF - 0.025, D / 2 - 0.01, W, 0.028, 0.02);
    const n = [0, ct, st];
    const sheet = rng && rng.chance(0.5) ? 'planSheet' : 'blueprint';
    const sv0 = 0.14; // sheet starts this far up the board
    const so = [-0.42, yF + st * sv0 + n[1] * 0.004, D / 2 - ct * sv0 + n[2] * 0.004];
    b.face(sheet, so, [0.84, 0, 0], [0, st * 0.6, -ct * 0.6], [0, 0], { seg: 1, uvRect: rng ? [rng.float(0, 0.3), rng.float(0, 0.3), 0.7, 0.7] : [0, 0, 1, 1] });
    // parallel rule across the board, and a pencil
    const ry = yF + st * 0.5 + 0.012;
    b.box('chrome', 0, ry, D / 2 - ct * 0.5, 1.22, 0.012, 0.035);
    b.box('shade', 0.2, yF + st * 0.2 + 0.01, D / 2 - ct * 0.2, 0.16, 0.008, 0.008, { rot: 0.5 });
    // lamp on a clamp arm from the back corner
    b.cyl('chrome', 0.6, yF + D * st, -D / 2 * ct, 0.012, 0.45, { segs: 5, noCap: true });
    b.box('chrome', 0.52, yF + D * st + 0.43, -0.2, 0.015, 0.015, 0.5);
    b.cyl('shade', 0.45, 1.5, 0.02, 0.09, 0.13, { r1: 0.04, segs: 10, glow: [0.95, 0.85, 0.6], noCap: true });
    b.light({ x: 0.35, y: 1.42, z: 0.1, type: 'spotDown', color: [1.0, 0.9, 0.7], power: p.power ?? 0.9, range: 3 });
    b.collideBox(0, 0, 1.35, 0.95, 1.1);
  },

  flatFile(b, p, rng) {
    const w = p.w || 1.3;
    b.box('metalGrey', 0, 0, 0, w, 0.9, 0.9, { seg: 0.4 });
    for (let k = 0; k < 8; k++) b.box('chrome', 0, 0.12 + k * 0.1, 0.452, 0.22, 0.012, 0.01);
    // rolled plans on top
    const n = rng ? rng.int(2, 6) : 3;
    for (let k = 0; k < n; k++) {
      b.push(rng ? rng.float(-w / 2 + 0.2, w / 2 - 0.2) : 0, rng ? rng.float(-0.25, 0.25) : 0, Math.PI / 2 + (rng ? rng.float(-0.3, 0.3) : 0), 0.95);
      b.cyl(rng && rng.chance(0.4) ? 'blueprint' : 'paper', 0, 0.04, -0.4, 0.04, 0.8, { segs: 8, rx: true });
      b.pop();
    }
    b.collideBox(0, 0, w, 0.9, 0.95);
  },

  pinnedPlan(b, p, rng) {
    // a floor plan pinned to the wall, origin on the wall
    const w = p.w || 0.9;
    const h = p.h || 0.65;
    const y = p.y || 1.2;
    const sheet = p.sheet || (rng && rng.chance(0.45) ? 'planSheet' : 'blueprint');
    const dz = 0.006 + (p.layer || 0) * 0.005;
    b.face(sheet, [-w / 2, y, dz], [w, 0, 0], [0, h, 0], [0, 0], { seg: 1, uvRect: rng ? [rng.float(0, 0.2), rng.float(0, 0.2), 0.8, 0.8] : [0, 0, 1, 1] });
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box('redPaint', (sx * w) / 2.15, y + h / 2 + (sy * h) / 2.15, dz + 0.004, 0.012, 0.012, 0.01);
  },

  cardboardBox(b, p, rng) {
    const s = p.s || 0.45;
    b.box('cardboard', 0, 0, 0, s, s * 0.8, s * 1.1);
    b.collideBox(0, 0, s, s * 1.1, s * 0.8);
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
