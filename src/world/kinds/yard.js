// THE DOCKING DECK: where the Strongbox sets down. A landing pad on the derelict's back, open
// to space behind a waist-high coaming and the field that holds the air in: deck plate, mast
// floodlights, and the craft's blank hull front with its airlock in it. The ship is backed up
// to the airlock, its rear cargo door facing the way in. The ship's hold (the crew's hub) is
// part of this cell: a steel box on its own zone. (The constant is still called VAN: the code
// that knows where the hold is did not need to change.)

import { rngFor } from '../../core/rng.js';
import { TILE } from '../constants.js';

// the ship, in tiles: hold i 19..22, j 16..24; walls one tile thick; hull, engines and nose
// fill the rest of i 15..26, j 15..29
export const VAN = {
  i0: 15,
  i1: 26,
  j0: 15,
  j1: 29,
  inner: { x0: 9.5, z0: 8.0, x1: 11.5, z1: 12.5 },
  door: { x: 10.5, z: 7.5, w: 1.0, h: 1.95 },
};

const COAMING = 1.1; // the pad's edge wall
const FACADE = 8.4; // the craft's hull front over the airlock

export default {
  id: 'yard',
  name: 'Docking Deck',
  weight: 0,
  power: 'own', // lit by its own masts and the ship; the derelict's brownout never reaches it

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    // planet-shine and starlight: the deck is never fully black, and it is cold
    plan.ambient = [0.03, 0.036, 0.05];
    const deck = plan.zone({ name: 'deck', sky: true, wallH: COAMING, floor: 'asphalt', wall: 'facade', baseboard: false });
    const apron = plan.zone({ name: 'apron', sky: true, wallH: FACADE, floor: 'diamondPlate', wall: 'facade', baseboard: false });
    plan.fill(1, 2, 30, 30, deck);
    plan.fill(1, 1, 30, 1, apron);
    plan.paintFloor(1, 1, 30, 3, 'diamondPlate');

    // the ship: a steel box on its own zone, ringed by solid tiles the kind draws itself
    const van = plan.zone({ name: 'van', ceil: 2.1, floor: 'diamondPlate', wall: 'vanInterior', ceilMat: 'vanInterior', baseboard: false });
    for (let j = VAN.j0; j <= VAN.j1; j++)
      for (let i = VAN.i0; i <= VAN.i1; i++) {
        plan.tiles[plan.idx(i, j)] = 0;
        plan.noFace[plan.idx(i, j)] = 1;
      }
    plan.fill(19, 16, 22, 24, van);
    const door = plan.zone({ name: 'vanDoor', ceil: VAN.door.h, floor: 'diamondPlate', wall: 'vanPaint', ceilMat: 'vanPaint', door: true, baseboard: false });
    plan.fill(20, 15, 21, 15, door);
    plan.noFace[plan.idx(20, 15)] = 0;
    plan.noFace[plan.idx(21, 15)] = 0;

    // in the hold: night-safe chute on the bulkhead, terminal and bench to port, tools to starboard
    plan.prop('chute', 10.5, 12.5, Math.PI);
    plan.prop('terminal', 9.5, 11.2, Math.PI / 2);
    plan.prop('bench', 9.72, 9.2, Math.PI / 2, { len: 1.5 });
    plan.prop('toolRack', 11.5, 10.5, -Math.PI / 2);
    plan.prop('governor', 11.5, 11.85, -Math.PI / 2);
    plan.prop('cageLamp', 10.5, 10.3, 0, { y: 2.1, power: 1.5 });
    plan.prop('sign', 11.5, 11.85, -Math.PI / 2, { text: 'SHUT OFF AT 04:00', y: 1.62, w: 0.42, h: 0.05, board: false });
    plan.prop('porthole', 9.5, 9.9, Math.PI / 2, { y: 1.45, r: 0.16 });
    plan.interactions.push({ type: 'terminal', x: 9.95, y: 1.1, z: 11.2, radius: 1.5, prompt: 'Use the terminal' });
    plan.interactions.push({ type: 'chute', x: 10.5, y: 1.0, z: 12.15, radius: 1.5, prompt: 'Night safe' });
    plan.interactions.push({ type: 'governor', x: 11.3, y: 1.25, z: 11.85, radius: 1.2, prompt: 'Pull the governor (undock now)' });
    plan.point('spawn', 10.5, 9.7, { yaw: 0 });
    plan.point('rack', 11.22, 10.5, { y: 0.6 });
    plan.point('van', VAN.inner.x0, VAN.inner.z0, { x1: VAN.inner.x1, z1: VAN.inner.z1 });
    plan.point('vanDoor', VAN.door.x, VAN.door.z, { w: VAN.door.w, h: VAN.door.h });

    // the deck: floodlight masts, a cargo skip, gas drums, pallets against the hull, mooring
    // bollards by the airlock, the pad's landing lines either side of the ship
    plan.prop('lampPost', 1.0, 8.5, Math.PI / 2, { h: 6.4 });
    plan.prop('lampPost', 15.0, 4.0, -Math.PI / 2, { h: 6.6, power: 7.5 });
    plan.prop('lampPost', 15.0, 13.5, -Math.PI / 2, { h: 6.6, dead: true });
    plan.prop('wallPack', 7.75, 0.5, 0, { y: 2.9, power: 2.6, flicker: rng.chance(0.5) });
    plan.prop('dumpster', 2.4, 13.4, Math.PI / 2 + rng.float(-0.1, 0.1));
    for (let k = 0; k < 3; k++) plan.prop('oilDrum', 1.2 + k * 0.62, 2.3 + rng.float(0, 0.2), 0, { mat: rng.pick(['oxblood', 'steelPaint', 'metalGrey']) });
    plan.prop('pallet', 4.2, 1.35, rng.float(-0.05, 0.05), { load: rng.chance(0.5) });
    plan.prop('pallet', 13.9, 1.4, Math.PI / 2 + rng.float(-0.05, 0.05), {});
    for (const x of [5.9, 9.6]) plan.prop('bollard', x, 2.2);
    plan.prop('bayLines', 7.0, 11.2, 0, { len: 8 });
    plan.prop('bayLines', 14.0, 11.2, 0, { len: 8 });
    plan.prop('rollerShutter', 12.4, 0.5, 0, { w: 2.8, h: 3.4 });
    plan.prop('sign', 7.75, 0.5, 0, { text: 'HALVARD LINES', y: 3.6, w: 2.8, h: 0.28 });
    plan.prop('sign', 12.4, 0.5, 0, { text: 'GOODS IN', y: 4.15, w: 1.6, h: 0.16 });
    plan.prop('sign', 7.75, 0.5, 0, { text: 'AIRLOCK', y: 2.56, w: 0.9, h: 0.1 });
    return plan;
  },

  build(b, rng) {
    const T = TILE;
    // the coaming: a cap along its top, a rail on posts, and the hull it stands on, running off
    // into the dark on every side but the craft's front
    // (the solid strip is boxed a hair narrower, so the shell's inner wall face stays in front)
    for (const [x, z, w, d, xo, zo] of [[0.25, 8.25, 0.5, 15.5, -0.015, 0], [15.75, 8.25, 0.5, 15.5, 0.015, 0], [8, 15.75, 16, 0.5, 0, 0.015]]) {
      b.box('steelDark', x, COAMING, z, w + 0.04, 0.07, d + 0.04);
      b.box('facade', x + xo, 0, z + zo, w - Math.abs(xo) * 2, COAMING, d - Math.abs(zo) * 2, { skip: 'top' });
    }
    for (let z = 1.5; z < 16; z += 2.0) for (const x of [0.25, 15.75]) b.box('metalGrey', x, COAMING, z, 0.05, 0.55, 0.05);
    for (let x = 1.5; x < 15; x += 2.0) b.box('metalGrey', x, COAMING, 15.75, 0.05, 0.55, 0.05);
    for (const y of [COAMING + 0.28, COAMING + 0.53]) {
      b.box('safetyYellow', 0.25, y, 8.25, 0.045, 0.04, 15.5);
      b.box('safetyYellow', 15.75, y, 8.25, 0.045, 0.04, 15.5);
      b.box('safetyYellow', 8, y, 15.75, 15.5, 0.04, 0.045);
    }
    // the hull outside: a dull plain of plate under the stars, the fog takes it in the end
    const Y = -0.01;
    const big = { seg: 6 };
    b.quad('facade', [-140, Y, 0.5], [-140, Y, 140], [0, Y, 140], [0, Y, 0.5], big);
    b.quad('facade', [16, Y, 0.5], [16, Y, 140], [156, Y, 140], [156, Y, 0.5], big);
    b.quad('facade', [0, Y, 16], [0, Y, 140], [16, Y, 140], [16, Y, 16], big);
    // the craft's front, carried on either side of the airlock wall, stepping up to a bridge tower
    const front = (x0, x1, h) => b.face('facade', [x0, 0, 0.5], [x1 - x0, 0, 0], [0, h, 0], [x0, 0], { seg: 3 });
    // the tower's flank toward the deck (normal -x)
    const flank = (x, h0, h1) => b.face('facade', [x, h0, -12], [0, 0, 12.5], [0, h1 - h0, 0], [0, h0], { seg: 3 });
    front(-70, -14, 6.0);
    front(-14, 0.5, FACADE);
    front(15.5, 24, FACADE);
    front(24, 33, 13.5);
    flank(24, FACADE, 13.5);
    front(33, 90, 5.2);
    // the bridge's windows: long dead, two still lit by something on emergency power
    for (let k = 0; k < 6; k++) {
      const wx = 24.6 + k * 1.4;
      const lit = k === 1 || k === 4;
      b.face(lit ? 'lamp' : 'glass', [wx, 11.2, 0.52], [1.0, 0, 0], [0, 0.6, 0], [0, 0], lit ? { glow: k === 1 ? [0.9, 0.6, 0.25] : [0.25, 0.5, 0.45], seg: 2 } : { seg: 2 });
    }
    // marker lamps still running on the tower's corners and along the roofline of the hull front,
    // so the craft's shape shows against the stars
    for (const [lx, ly] of [[24.15, 13.4], [32.85, 13.4], [24.15, 8.3], [-13.9, 8.3], [0.3, 8.3], [15.7, 8.3], [-40, 5.9], [50, 5.1], [70, 5.1]]) {
      b.box('lamp', lx, ly - 0.12, 0.6, 0.26, 0.22, 0.16, { glow: [1.1, 0.04, 0.02] });
    }
    b.face('lamp', [24.4, 10.95, 0.53], [8.2, 0, 0], [0, 0.05, 0], [0, 0], { glow: [0.5, 0.42, 0.25], seg: 3 });
    // dorsal block set back above the airlock, an aerial farm on it, a red masthead lamp
    b.box('facade', 8, FACADE, -6, 11, 3.2, 12, { skip: 'bottom', seg: 2 });
    for (const [ax, h] of [[4.2, 4.5], [5.6, 2.6], [11.4, 3.4]]) b.cyl('metalGrey', ax, FACADE + 3.2, -2.5, 0.04, h, { segs: 5 });
    b.box('lamp', 4.2, FACADE + 7.7, -2.5, 0.16, 0.16, 0.16, { glow: [3.5, 0.15, 0.08] });
    b.cyl('metalGrey', 11.4, FACADE + 6.6, -2.5, 0.5, 0.06, { r1: 0.12, segs: 12 });
    // roof coping on the airlock wall, and the airlock's frame: a deep hazard-striped collar
    b.box('steelDark', 8, FACADE, 0.35, 15.2, 0.12, 0.4);
    for (const sx of [7.0 - 0.18, 8.5 + 0.18]) b.box('steelDark', sx, 0, 0.62, 0.36, 2.45, 0.24);
    b.box('steelDark', 7.75, 2.2, 0.62, 2.22, 0.25, 0.24);
    for (const sx of [7.0 - 0.18, 8.5 + 0.18]) b.box('hazard', sx, 0.1, 0.745, 0.3, 2.0, 0.004);
    b.box('hazard', 7.75, 2.24, 0.745, 1.9, 0.16, 0.004);
    // a deck floor under the ship (the footprint is solid; nothing would be under the hull)
    b.face('asphalt', [VAN.i0 * T, -0.004, VAN.j0 * T], [0, 0, (VAN.j1 + 1 - VAN.j0) * T], [(VAN.i1 + 1 - VAN.i0) * T, 0, 0], [VAN.i0 * T, VAN.j0 * T], { seg: 1 });
    // scorch from a thousand landings, and a few loose sheets of packing on the plate
    for (let k = 0; k < 4; k++) b.box('cardboard', rng.float(1.5, 6.0), 0.004, rng.float(13, 15), rng.float(0.4, 0.7), 0.006, rng.float(0.3, 0.5), { rot: rng.float(0, 3) });

    buildShip(b);
  },

  sounds: { hum: { base: 50, buzz: 0.06, level: 0.22, hvac: 0.25 }, room: 'outdoor', ambience: ['hullGroan', 'hullTick', 'fieldFlutter'] },
};

/**
 * The Strongbox: a squat salvage tug in the firm's bottle green, a hold for a body, two engine
 * pods on stub pylons, a stepped nose with a dark canopy. Built round the hold zone.
 */
function buildShip(b) {
  const cx = 10.5;
  const z0 = VAN.j0 * T0 - 0.01; // rear face, a hair proud of the deck behind it
  const zb = 13.0; // end of the body (the hold's bulkhead is at 12.5)
  // cross-sections: [half-width, y] round one side, bottom to top
  const BODY = [[1.25, 0.02], [1.7, 0.55], [1.7, 2.25], [1.15, 2.95]];
  const MID = [[0.95, 0.15], [1.35, 0.55], [1.35, 1.9], [0.8, 2.35]];
  const TIP = [[0.35, 0.55], [0.6, 0.8], [0.6, 1.35], [0.35, 1.6]];
  const axis = (z) => [cx, 1.5, z];
  // a quad with its normal turned to face away from `from`
  const q = (mat, a, bb, c, d, from, opts = {}) => {
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const e2 = [d[0] - bb[0], d[1] - bb[1], d[2] - bb[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m = [(a[0] + c[0]) / 2 - from[0], (a[1] + c[1]) / 2 - from[1], (a[2] + c[2]) / 2 - from[2]];
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] >= 0) b.quad(mat, a, bb, c, d, opts);
    else b.quad(mat, a, d, c, bb, opts);
  };
  // loft the skin between two sections; mats: per strip (bottom chamfer, side, upper chamfer, top)
  const loft = (A, za, B, zbb, mats, bottom = false) => {
    if (bottom) q('steelDark', [cx - A[0][0], A[0][1], za], [cx + A[0][0], A[0][1], za], [cx + B[0][0], B[0][1], zbb], [cx - B[0][0], B[0][1], zbb], axis((za + zbb) / 2));
    for (const s of [-1, 1]) {
      for (let k = 0; k < A.length - 1; k++) {
        const pa = [cx + s * A[k][0], A[k][1], za];
        const pb = [cx + s * B[k][0], B[k][1], zbb];
        const pc = [cx + s * B[k + 1][0], B[k + 1][1], zbb];
        const pd = [cx + s * A[k + 1][0], A[k + 1][1], za];
        q(mats[k], pa, pb, pc, pd, axis((za + zbb) / 2));
      }
    }
    const t = A.length - 1;
    q(mats[3], [cx - A[t][0], A[t][1], za], [cx + A[t][0], A[t][1], za], [cx + B[t][0], B[t][1], zbb], [cx - B[t][0], B[t][1], zbb], axis((za + zbb) / 2));
  };
  const P = ['vanPaint', 'vanPaint', 'vanPaint', 'vanPaint'];
  loft(BODY, z0, BODY, zb, P);
  loft(BODY, zb, MID, 14.2, ['vanPaint', 'vanPaint', 'glass', 'glass'], true);
  loft(MID, 14.2, TIP, 15.35, P, true);
  // the nose cap
  const tipZ = 15.35;
  for (let k = 0; k < TIP.length - 1; k++) {
    q('steelDark', [cx - TIP[k][0], TIP[k][1], tipZ], [cx + TIP[k][0], TIP[k][1], tipZ], [cx + TIP[k + 1][0], TIP[k + 1][1], tipZ], [cx - TIP[k + 1][0], TIP[k + 1][1], tipZ], axis(tipZ - 1));
  }

  // landing lamps under the chin, left burning: they pool on the deck in front of the nose
  for (const s of [-1, 1]) {
    b.box('steelDark', cx + s * 0.28, 0.5, 15.2, 0.2, 0.08, 0.2);
    b.box('lamp', cx + s * 0.28, 0.495, 15.2, 0.14, 0.004, 0.14, { glow: [2.4, 2.3, 2.0] });
  }
  b.light({ x: cx, y: 0.45, z: 15.6, type: 'spotDown', color: [1.0, 0.95, 0.85], power: 1.6, range: 5 });
  b.light({ x: cx, y: 1.0, z: 16.2, color: [0.9, 0.9, 0.85], power: 0.5, range: 4 });

  // the rear: round the cargo door
  const dx0 = VAN.door.x - VAN.door.w / 2;
  const dx1 = VAN.door.x + VAN.door.w / 2;
  const back = [cx, 1.5, z0 + 1];
  for (const s of [-1, 1]) {
    const xd = s < 0 ? dx0 : dx1;
    q('vanPaint', [cx + s * BODY[0][0], BODY[0][1], z0], [xd, BODY[0][1], z0], [xd, BODY[1][1], z0], [cx + s * BODY[1][0], BODY[1][1], z0], back);
    q('vanPaint', [cx + s * BODY[1][0], BODY[1][1], z0], [xd, BODY[1][1], z0], [xd, BODY[2][1], z0], [cx + s * BODY[2][0], BODY[2][1], z0], back);
    q('vanPaint', [cx + s * BODY[2][0], BODY[2][1], z0], [xd, BODY[2][1], z0], [xd, BODY[3][1], z0], [cx + s * BODY[3][0], BODY[3][1], z0], back);
  }
  q('vanPaint', [dx0, VAN.door.h, z0], [dx1, VAN.door.h, z0], [dx1, BODY[3][1], z0], [dx0, BODY[3][1], z0], back);
  // door frame, the loading lip, hinges, hazard chevrons either side
  b.box('steelDark', VAN.door.x, 0.0, z0 - 0.12, 1.6, 0.08, 0.24);
  b.box('hazard', VAN.door.x, 0.08, z0 - 0.12, 1.5, 0.004, 0.2);
  for (const sx of [dx0 - 0.04, dx1 + 0.04]) b.box('chrome', sx, 0.05, z0 - 0.02, 0.06, VAN.door.h - 0.05, 0.04);
  b.box('chrome', VAN.door.x, VAN.door.h, z0 - 0.02, VAN.door.w + 0.14, 0.06, 0.04);
  for (const sx of [dx0 - 0.3, dx1 + 0.3]) b.box('hazard', sx, 0.1, z0 - 0.004, 0.36, 1.7, 0.004);
  // the rear work lamp over the door: the light you walk back toward
  const H = BODY[3][1];
  b.box('steelDark', VAN.door.x, H - 0.55, z0 - 0.09, 0.42, 0.16, 0.18);
  b.box('lamp', VAN.door.x, H - 0.56, z0 - 0.181, 0.36, 0.12, 0.004, { glow: [2.6, 2.3, 1.9] });
  b.light({ x: VAN.door.x, y: H - 0.7, z: z0 - 0.7, type: 'spotDown', color: [0.92, 0.95, 1.0], power: 4.5, range: 10 });
  // red marker lamps low on the rear corners
  for (const s of [-1, 1]) b.box('lamp', cx + s * 1.45, 0.62, z0 - 0.02, 0.16, 0.12, 0.02, { glow: [1.8, 0.12, 0.08] });
  b.light({ x: cx, y: 0.6, z: z0 - 0.4, color: [1.0, 0.1, 0.06], power: 0.25, range: 3 });

  // the engine pods, on stub pylons, each on two landing legs
  for (const s of [-1, 1]) {
    const ex = cx + s * 2.35;
    const ey = 1.25;
    b.cyl('vanPaint', ex, ey, 8.3, 0.55, 4.1, { segs: 16, rx: true, noCap: true });
    b.cyl('steelDark', ex, ey, 12.4, 0.55, 0.6, { r1: 0.3, segs: 16, rx: true });
    b.cyl('hazard', ex, ey, 11.9, 0.556, 0.12, { segs: 16, rx: true, noCap: true });
    // the bell, open at the back, with the last of the burn still in it
    b.cyl('steelDark', ex, ey, 7.62, 0.6, 0.7, { r1: 0.46, segs: 16, rx: true, noCap: true });
    b.cyl('steelDark', ex, ey, 8.25, 0.44, 0.02, { segs: 16, rx: true });
    b.cyl('lamp', ex, ey, 8.22, 0.16, 0.02, { segs: 12, rx: true, glow: [0.22, 0.06, 0.015] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.box('metalGrey', ex + Math.cos(a) * 0.3, ey + Math.sin(a) * 0.3 - 0.02, 8.18, 0.05, 0.04, 0.06);
    }
    b.light({ x: ex, y: ey, z: 7.3, color: [1.0, 0.42, 0.12], power: 0.08, range: 2 });
    b.box('steelDark', cx + s * 1.95, ey - 0.15, 10.3, 0.55, 0.3, 2.6);
    for (const lz of [9.0, 11.7]) {
      b.box('metalGrey', ex, 0.05, lz, 0.1, ey - 0.5, 0.1);
      b.box('chrome', ex, 0.15, lz, 0.06, 0.3, 0.06);
      b.box('steelDark', ex, 0, lz, 0.42, 0.06, 0.42);
    }
  }
  // the dorsal spine: aerials, a sensor dome, the anti-collision beacon
  b.box('steelDark', cx, H, 10.2, 0.6, 0.2, 5.2);
  b.cyl('beigePlastic', cx, H + 0.2, 12.0, 0.32, 0.22, { r1: 0.16, segs: 12 });
  b.cyl('metalGrey', cx - 0.15, H + 0.2, 8.2, 0.025, 0.9, { segs: 5 });
  b.box('lamp', cx - 0.15, H + 1.1, 8.2, 0.07, 0.07, 0.07, { glow: [3.0, 0.2, 0.1] });
  // navigation lamps: red to port, green to starboard (port is +x, the ship faces +z)
  for (const [s, glow, color] of [[1, [2.6, 0.15, 0.1], [1, 0.1, 0.06]], [-1, [0.15, 2.4, 0.5], [0.1, 1, 0.3]]]) {
    b.box('lamp', cx + s * 1.71, 2.1, 12.6, 0.03, 0.09, 0.09, { glow });
    b.light({ x: cx + s * 2.1, y: 2.1, z: 12.6, color, power: 0.2, range: 2.5 });
  }
  // livery: a cream cheat-line down both flanks, the firm's name under it, the ship's name over
  // the door
  for (const s of [-1, 1]) b.box('beigePlastic', cx + s * 1.703, 2.13, (z0 + zb) / 2, 0.006, 0.09, zb - z0 - 0.1);
  for (const s of [-1, 1]) q('beigePlastic', [cx + s * 1.704, 2.13, zb], [cx + s * 1.354, 1.804, 14.2], [cx + s * 1.354, 1.876, 14.2], [cx + s * 1.704, 2.22, zb], axis(13.6));
  b.push(cx + 1.706, 10.3, Math.PI / 2);
  b.sign('GRISHOLM & DAUGHTERS', 0, 1.9, 0, 2.6, 0.2, {});
  b.pop();
  b.push(cx - 1.706, 10.3, -Math.PI / 2);
  b.sign('GRISHOLM & DAUGHTERS', 0, 1.9, 0, 2.6, 0.2, {});
  b.pop();
  b.push(cx, z0 - 0.006, Math.PI);
  b.sign('STRONGBOX', 0, 2.55, 0, 1.0, 0.13, {});
  b.pop();
}

const T0 = TILE;
