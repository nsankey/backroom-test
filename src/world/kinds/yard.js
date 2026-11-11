// THE YARD: where the Strongbox parks. Open to the night: worn asphalt inside a corrugated
// hoarding, sodium lamps, and the facility's blank precast front with one door in it.
// The van is reversed up to the building, its rear time-locked door facing the entrance.
// The van's interior (the crew's hub) is part of this cell: a steel box on its own zone.

import { rngFor } from '../../core/rng.js';
import { TILE } from '../constants.js';

// the van, in tiles: interior i 19..22, j 16..24; walls one tile thick; cab j 26..29
export const VAN = {
  i0: 18,
  i1: 23,
  j0: 15,
  j1: 29,
  inner: { x0: 9.5, z0: 8.0, x1: 11.5, z1: 12.5 },
  door: { x: 10.5, z: 7.5, w: 1.0, h: 1.95 },
};

export default {
  id: 'yard',
  name: 'The Yard',
  weight: 0,
  power: 'own', // lit by its own lamps and the van; the facility's brownout never reaches it

  layout(seed, plan) {
    const rng = rngFor(seed, 'layout');
    // sodium skyglow off low cloud: the yard is never fully black
    plan.ambient = [0.06, 0.045, 0.034];
    const yard = plan.zone({ name: 'yard', sky: true, wallH: 2.6, floor: 'asphalt', wall: 'corrugated', baseboard: false });
    const apron = plan.zone({ name: 'apron', sky: true, wallH: 8.4, floor: 'concrete', wall: 'facade', baseboard: false });
    plan.fill(1, 2, 30, 30, yard);
    plan.fill(1, 1, 30, 1, apron);
    plan.paintFloor(1, 1, 30, 3, 'concrete');

    // the van: a steel box on its own zone, ringed by solid tiles the kind draws itself
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

    // inside the van: night-safe chute on the bulkhead, terminal and bench to port, tools to starboard
    plan.prop('chute', 10.5, 12.5, Math.PI);
    plan.prop('terminal', 9.5, 11.2, Math.PI / 2);
    plan.prop('bench', 9.72, 9.2, Math.PI / 2, { len: 1.5 });
    plan.prop('toolRack', 11.5, 10.5, -Math.PI / 2);
    plan.prop('governor', 11.5, 11.85, -Math.PI / 2);
    plan.prop('cageLamp', 10.5, 10.3, 0, { y: 2.1, power: 1.5 });
    plan.prop('sign', 11.5, 11.85, -Math.PI / 2, { text: 'SHUT OFF AT 04:00', y: 1.62, w: 0.42, h: 0.05, board: false });
    plan.interactions.push({ type: 'terminal', x: 9.95, y: 1.1, z: 11.2, radius: 1.5, prompt: 'Use the terminal' });
    plan.interactions.push({ type: 'chute', x: 10.5, y: 1.0, z: 12.15, radius: 1.5, prompt: 'Night safe' });
    plan.interactions.push({ type: 'governor', x: 11.3, y: 1.25, z: 11.85, radius: 1.2, prompt: 'Pull the governor (leave now)' });
    plan.point('spawn', 10.5, 9.7, { yaw: 0 });
    plan.point('rack', 11.22, 10.5, { y: 0.6 });
    plan.point('van', VAN.inner.x0, VAN.inner.z0, { x1: VAN.inner.x1, z1: VAN.inner.z1 });
    plan.point('vanDoor', VAN.door.x, VAN.door.z, { w: VAN.door.w, h: VAN.door.h });

    // the yard: lamps, a skip, drums, pallets against the front, bollards at the door
    plan.prop('lampPost', 1.0, 8.5, Math.PI / 2, { h: 6.4 });
    plan.prop('lampPost', 15.0, 4.0, -Math.PI / 2, { h: 6.6, power: 7.5 });
    plan.prop('lampPost', 15.0, 13.5, -Math.PI / 2, { h: 6.6, dead: true });
    plan.prop('wallPack', 7.75, 0.5, 0, { y: 2.9, power: 2.6, flicker: rng.chance(0.5) });
    plan.prop('dumpster', 2.4, 13.4, Math.PI / 2 + rng.float(-0.1, 0.1));
    for (let k = 0; k < 3; k++) plan.prop('oilDrum', 1.2 + k * 0.62, 2.3 + rng.float(0, 0.2), 0, { mat: rng.pick(['oxblood', 'steelPaint', 'metalGrey']) });
    plan.prop('pallet', 4.2, 1.35, rng.float(-0.05, 0.05), { load: rng.chance(0.5) });
    plan.prop('pallet', 13.9, 1.4, Math.PI / 2 + rng.float(-0.05, 0.05), {});
    for (const x of [5.9, 9.6]) plan.prop('bollard', x, 2.2);
    plan.prop('bayLines', 8.6, 11.0, 0, { len: 6 });
    plan.prop('bayLines', 12.4, 11.0, 0, { len: 6 });
    plan.prop('rollerShutter', 12.4, 0.5, 0, { w: 2.8, h: 3.4 });
    plan.prop('sign', 7.75, 0.5, 0, { text: 'HALVARD', y: 3.6, w: 2.4, h: 0.28 });
    plan.prop('sign', 12.4, 0.5, 0, { text: 'GOODS IN', y: 4.15, w: 1.6, h: 0.16 });
    plan.prop('sign', 7.75, 0.5, 0, { text: 'NO WORKING ALONE', y: 2.42, w: 1.3, h: 0.08 });
    return plan;
  },

  build(b, rng) {
    // the Strongbox's body, drawn around the interior zone: a bottle-green armoured box on a
    // dark chassis, a cab nosed toward the hoarding, amber clearance lamps
    const T = TILE;
    const x0 = VAN.i0 * T;
    const x1 = (VAN.i1 + 1) * T;
    const z0 = VAN.j0 * T - 0.01; // a hair proud of the yard's soffit behind it
    const zb = (25 + 1) * T; // end of the box body (the bulkhead)
    const z1 = (VAN.j1 + 1) * T;
    const H = 2.75;
    const cx = (x0 + x1) / 2;
    const base = 0.32;
    // chassis skirts (inside the wall tiles, so they never show through the van floor) and wheels
    for (const sx of [x0 + 0.27, x1 - 0.27]) b.box('steelDark', sx, 0, (z0 + z1) / 2, 0.42, base, z1 - z0 - 0.3);
    for (const z of [z0 + 1.4, zb - 0.6, z1 - 0.7])
      for (const sx of [x0 + 0.05, x1 - 0.05]) {
        b.push(sx, z, Math.PI / 2);
        b.cyl('rubber', 0, 0.46, -0.16, 0.46, 0.32, { segs: 16, rx: true });
        b.cyl('metalGrey', 0, 0.46, sx < cx ? -0.17 : 0.15, 0.24, 0.02, { segs: 12, rx: true });
        b.pop();
      }
    // body sides, roof and rear (the rear has the door opening)
    const dx0 = VAN.door.x - VAN.door.w / 2;
    const dx1 = VAN.door.x + VAN.door.w / 2;
    b.face('vanPaint', [x0, base, z0], [0, 0, zb - z0], [0, H - base, 0], [0, 0]);
    b.face('vanPaint', [x1, base, zb], [0, 0, z0 - zb], [0, H - base, 0], [0, 0]);
    // under-body valances down to the ground, so the lit load floor never shows beneath the box
    b.face('steelDark', [x0 + 0.004, 0, z0], [0, 0, z1 - z0], [0, base + 0.01, 0], [0, 0]);
    b.face('steelDark', [x1 - 0.004, 0, z1], [0, 0, z0 - z1], [0, base + 0.01, 0], [0, 0]);
    b.face('steelDark', [x1, 0, z0 + 0.004], [x0 - x1, 0, 0], [0, base + 0.01, 0], [0, 0]);
    b.face('vanPaint', [x0, H, zb], [x1 - x0, 0, 0], [0, 0, z0 - zb], [0, 0]);
    // rear face, around the door
    b.face('vanPaint', [dx0, base, z0], [x0 - dx0, 0, 0], [0, H - base, 0], [0, 0]);
    b.face('vanPaint', [x1, base, z0], [dx1 - x1, 0, 0], [0, H - base, 0], [0, 0]);
    b.face('vanPaint', [dx1, VAN.door.h, z0], [dx0 - dx1, 0, 0], [0, H - VAN.door.h, 0], [0, 0]);
    // door frame, step bumper and hinges
    b.box('steelDark', VAN.door.x, 0.0, z0 - 0.12, 2.6, 0.32, 0.24);
    b.box('hazard', VAN.door.x, 0.32, z0 - 0.24, 2.6, 0.04, 0.005);
    for (const sx of [dx0 - 0.04, dx1 + 0.04]) b.box('chrome', sx, 0.3, z0 - 0.02, 0.06, VAN.door.h - 0.3, 0.04);
    b.box('chrome', VAN.door.x, VAN.door.h, z0 - 0.02, VAN.door.w + 0.14, 0.06, 0.04);
    // roof rails and amber clearance lamps
    for (const sx of [x0 + 0.08, x1 - 0.08]) b.box('steelDark', sx, H, (z0 + zb) / 2, 0.06, 0.05, zb - z0);
    for (const [lx, lz] of [[x0 + 0.15, z0 + 0.02], [x1 - 0.15, z0 + 0.02], [x0 + 0.15, zb - 0.1], [x1 - 0.15, zb - 0.1]]) {
      b.box('lamp', lx, H - 0.14, lz - 0.03, 0.12, 0.07, 0.04, { glow: [2.4, 1.1, 0.2] });
    }
    b.light({ x: cx, y: H - 0.1, z: z0 - 0.3, color: [1.0, 0.55, 0.15], power: 0.35, range: 4 });
    // the rear work lamp over the door: the light you walk back toward
    b.box('steelDark', VAN.door.x, H - 0.32, z0 - 0.09, 0.42, 0.16, 0.18);
    b.box('lamp', VAN.door.x, H - 0.33, z0 - 0.181, 0.36, 0.12, 0.004, { glow: [2.6, 2.3, 1.9] });
    b.light({ x: VAN.door.x, y: H - 0.45, z: z0 - 0.7, type: 'spotDown', color: [1.0, 0.92, 0.8], power: 4.5, range: 10 });
    // red tail lamps low on the rear corners
    for (const lx of [x0 + 0.2, x1 - 0.2]) b.box('lamp', lx, 0.5, z0 - 0.02, 0.16, 0.12, 0.02, { glow: [1.8, 0.12, 0.08] });
    b.light({ x: cx, y: 0.5, z: z0 - 0.4, color: [1.0, 0.1, 0.06], power: 0.25, range: 3 });
    // livery: the firm's name down both flanks
    b.push(x1 + 0.006, (z0 + zb) / 2, Math.PI / 2);
    b.sign('GRISHOLM & DAUGHTERS', 0, 1.55, 0, 2.6, 0.2, {});
    b.pop();
    b.push(x0 - 0.006, (z0 + zb) / 2, -Math.PI / 2);
    b.sign('GRISHOLM & DAUGHTERS', 0, 1.55, 0, 2.6, 0.2, {});
    b.pop();
    // the cab: lower than the box, a dark windscreen, headlamps off
    const ch = 2.25;
    b.box('vanPaint', cx, base, (zb + z1) / 2, x1 - x0 - 0.04, ch - base, z1 - zb, { skip: 'nz' });
    b.box('glass', cx, 1.35, z1 - 0.02, x1 - x0 - 0.3, 0.7, 0.04);
    for (const sx of [x0 - 0.002, x1 + 0.002]) b.box('glass', sx, 1.35, zb + 0.9, 0.01, 0.6, 1.0);
    b.box('steelDark', cx, 0.35, z1 + 0.05, x1 - x0, 0.32, 0.12);
    for (const sx of [x0 + 0.35, x1 - 0.35]) b.box('beigePlastic', sx, 0.75, z1 + 0.01, 0.3, 0.16, 0.03);
    // roof coping on the facility front, so the precast wall ends in a parapet
    b.box('steelDark', 8, 8.4, 0.35, 15.2, 0.12, 0.4);
    // weeds of litter by the hoarding: a few flattened cartons
    for (let k = 0; k < 4; k++) b.box('cardboard', rng.float(1.5, 7.5), 0.004, rng.float(13, 15), rng.float(0.4, 0.7), 0.006, rng.float(0.3, 0.5), { rot: rng.float(0, 3) });
  },

  sounds: { hum: { base: 50, buzz: 0.1, level: 0.25, hvac: 0.1 }, room: 'outdoor', ambience: ['dogFar', 'traffic', 'windGust'] },
};
