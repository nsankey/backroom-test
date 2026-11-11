// What the crew sees and hears of the creatures: a model per creature, eased toward the
// session's state, lit from the baked light where it stands, with its tell (a sound loop, the
// Dimmer's travelling dark, the Stocktaker's number wheels). Reads state; never changes it.
// Also draws the other crew in co-op (the same figure the Plus-One borrows).

import * as THREE from 'three';
import { bakeShade, lightMats } from '../game/items.js';
import { DIMMER_R } from './dimmer.js';

const _l = [0, 0, 0];

// ---- model kit -----------------------------------------------------------------------------------

function kit() {
  const g = new THREE.Group();
  const mats = [];
  const fixed = []; // materials that ignore the light (lamps, the Dimmer)
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, vertexColors: true, ...opts });
    m.userData.base = new THREE.Color(color);
    mats.push(m);
    return m;
  };
  const flat = (color, opts = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, ...opts });
    fixed.push(m);
    return m;
  };
  const add = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  };
  const pivot = (parent, x, y, z) => {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  };
  return { g, mats, fixed, mat, flat, add, pivot };
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, s = 10) => new THREE.CylinderGeometry(r0, r1, h, s);

/** A limb hanging from a pivot: a cylinder whose top is at the pivot. */
function limb(k, parent, x, y, z, r0, r1, len, m) {
  const p = k.pivot(parent, x, y, z);
  k.add(p, cyl(r0, r1, len, 8), m, 0, -len / 2, 0);
  return p;
}

/**
 * The Hushwarden: tall and thin in a grey dust coat that hangs to the shins, long empty-looking
 * arms, and where the head should be, a brass listening horn on a pipe of a neck.
 */
function hushwardenModel() {
  const k = kit();
  const coat = k.mat(0x3f403b);
  const coatDark = k.mat(0x2c2d29);
  const dark = k.mat(0x161615);
  const brass = k.mat(0x7c6532);
  const verd = k.mat(0x4c5c48);
  const body = k.pivot(k.g, 0, 0, 0);
  const legL = limb(k, body, -0.1, 0.62, 0, 0.045, 0.04, 0.62, dark);
  const legR = limb(k, body, 0.1, 0.62, 0, 0.045, 0.04, 0.62, dark);
  // the coat's skirt hangs in two panels, split at the back, over a narrower lining
  k.add(body, cyl(0.15, 0.17, 1.2, 10), coatDark, 0, 1.15, 0);
  for (const s of [-1, 1]) {
    const panel = k.add(body, new THREE.CylinderGeometry(0.18, 0.235, 1.2, 10, 1, true, s < 0 ? Math.PI * 0.06 : Math.PI * 1.0, Math.PI * 0.94), coat, 0, 1.15, 0);
    panel.material.side = THREE.DoubleSide;
    panel.rotation.z = s * 0.025; // hanging a little apart
  }
  k.add(body, cyl(0.185, 0.185, 0.05, 12), dark, 0, 1.72, 0); // belt
  k.add(body, cyl(0.21, 0.18, 0.42, 12), coat, 0, 1.94, 0); // chest
  const cape = k.add(body, new THREE.CylinderGeometry(0.2, 0.29, 0.2, 14, 1, true), coat, 0, 2.03, 0); // shoulder cape
  cape.material.side = THREE.DoubleSide;
  k.add(body, box(0.56, 0.08, 0.22), coat, 0, 2.13, 0); // shoulders
  const armL = limb(k, body, -0.29, 2.1, 0, 0.05, 0.04, 1.2, coat);
  const armR = limb(k, body, 0.29, 2.1, 0, 0.05, 0.04, 1.2, coat);
  for (const a of [armL, armR]) k.add(a, box(0.07, 0.2, 0.04), dark, 0, -1.3, 0); // gloved hands
  k.add(body, cyl(0.03, 0.03, 0.26, 8), brass, 0, 2.27, 0); // neck pipe
  const head = k.pivot(body, 0, 2.38, 0);
  k.add(head, new THREE.SphereGeometry(0.07, 10, 8), brass, 0, 0, 0);
  // the horn: a flared cone, mouth forward (-z)
  const horn = k.add(head, new THREE.CylinderGeometry(0.3, 0.035, 0.62, 18, 1, true), brass, 0, 0.02, -0.3, -Math.PI / 2);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.03, 0.6, 18, 1, true), k.flat(0x020202, { side: THREE.BackSide }));
  throat.position.copy(horn.position);
  throat.rotation.copy(horn.rotation);
  throat.userData.noShade = true;
  head.add(throat);
  k.add(head, new THREE.TorusGeometry(0.3, 0.018, 6, 24), verd, 0, 0.02, -0.61);
  k.add(head, new THREE.TorusGeometry(0.12, 0.012, 6, 18), verd, 0, 0.02, -0.15); // a seam
  bakeShade(k.g);
  return { ...k, parts: { body, legL, legR, armL, armR, head }, height: 2.6, eye: 2.4 };
}

/**
 * The Dimmer: a coat hung in a doorway with nobody in it. Shoulders, a collar with nothing
 * above it, sleeves that end at the cuff. Pure black, unlit: it is seen only against light.
 */
function dimmerModel() {
  const k = kit();
  const black = k.flat(0x000000);
  const body = k.pivot(k.g, 0, 0, 0);
  k.add(body, cyl(0.2, 0.36, 1.25, 12), black, 0, 0.95, 0);
  k.add(body, cyl(0.24, 0.2, 0.45, 12), black, 0, 1.78, 0);
  k.add(body, box(0.62, 0.1, 0.26), black, 0, 1.98, 0);
  k.add(body, new THREE.TorusGeometry(0.11, 0.035, 6, 16), black, 0, 2.05, 0, Math.PI / 2);
  const armL = limb(k, body, -0.31, 1.96, 0, 0.065, 0.075, 0.95, black);
  const armR = limb(k, body, 0.31, 1.96, 0, 0.065, 0.075, 0.95, black);
  return { ...k, parts: { body, armL, armR }, height: 2.1, eye: 2.0, dark: true };
}

/** A canvas showing the tally's four number wheels. */
function tallyFace() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 48;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (n) => {
    const g = cv.getContext('2d');
    g.fillStyle = '#141210';
    g.fillRect(0, 0, 128, 48);
    const s = String(Math.max(0, n) % 10000).padStart(4, '0');
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#d8d2c0';
      g.fillRect(6 + i * 30, 6, 26, 36);
      g.fillStyle = '#18140e';
      g.font = 'bold 30px monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s[i], 19 + i * 30, 26);
    }
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw };
}

/**
 * The Stocktaker: stooped in a brown warehouse coat, with a brass hand-tally counter the size
 * of a head where its head should be: the round case, the number window, the plunger on top.
 */
function stocktakerModel() {
  const k = kit();
  const coat = k.mat(0x5e4630);
  const dark = k.mat(0x2a241e);
  const shoe = k.mat(0x141210);
  const brass = k.mat(0x94763a);
  const brassDark = k.mat(0x5a4624);
  const steel = k.mat(0x8d918c);
  const body = k.pivot(k.g, 0, 0, 0);
  const legL = limb(k, body, -0.12, 0.82, 0, 0.078, 0.066, 0.82, dark);
  const legR = limb(k, body, 0.12, 0.82, 0, 0.078, 0.066, 0.82, dark);
  for (const l of [legL, legR]) k.add(l, box(0.12, 0.08, 0.26), shoe, 0, -0.8, -0.05);
  const torso = k.pivot(body, 0, 0.82, 0);
  torso.rotation.x = -0.42; // the stoop
  k.add(torso, cyl(0.23, 0.28, 0.75, 14), coat, 0, 0.36, 0);
  const hunch = k.add(torso, new THREE.SphereGeometry(0.25, 14, 10), coat, 0, 0.66, 0.05);
  hunch.scale.set(1.05, 0.55, 0.9);
  k.add(torso, box(0.52, 0.08, 0.27), coat, 0, 0.72, 0);
  k.add(torso, cyl(0.12, 0.16, 0.1, 12), coat, 0, 0.79, -0.02); // turned-up collar
  k.add(torso, cyl(0.25, 0.34, 0.46, 14), coat, 0, -0.15, 0); // coat skirt
  for (const y of [0.15, 0.32, 0.49]) k.add(torso, new THREE.SphereGeometry(0.018, 6, 4), dark, 0, y, -0.235); // buttons
  const armL = limb(k, torso, -0.27, 0.7, 0, 0.055, 0.045, 0.66, coat);
  const armR = limb(k, torso, 0.27, 0.7, 0, 0.055, 0.045, 0.66, coat);
  armL.rotation.x = 0.5;
  armR.rotation.x = 0.5;
  const thumb = k.add(armR, box(0.06, 0.12, 0.05), dark, 0, -0.7, 0);
  k.add(armL, box(0.06, 0.12, 0.05), dark, 0, -0.7, 0);
  const head = k.pivot(torso, 0, 0.82, -0.04);
  head.rotation.x = 0.42; // the counter faces forward though the body stoops
  // the case: a drum with a domed back, a steel bezel round the face, a window with a dark surround
  k.add(head, cyl(0.19, 0.19, 0.12, 24), brass, 0, 0.17, 0, Math.PI / 2);
  const dome = k.add(head, new THREE.SphereGeometry(0.19, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), brassDark, 0, 0.17, 0.06, Math.PI / 2);
  dome.scale.set(1, 0.35, 1);
  k.add(head, new THREE.TorusGeometry(0.185, 0.02, 8, 26), steel, 0, 0.17, -0.062);
  k.add(head, cyl(0.17, 0.17, 0.01, 24), brassDark, 0, 0.17, -0.058, Math.PI / 2); // face plate
  k.add(head, box(0.3, 0.13, 0.02), shoe, 0, 0.17, -0.066);
  k.add(head, cyl(0.035, 0.04, 0.05, 10), brass, 0, 0.375, 0); // plunger housing
  const plunger = k.add(head, cyl(0.022, 0.022, 0.12, 8), steel, 0, 0.44, 0);
  k.add(plunger, cyl(0.05, 0.05, 0.03, 14), steel, 0, 0.07, 0);
  k.add(head, cyl(0.025, 0.025, 0.04, 8), steel, 0.2, 0.17, 0, 0, 0, Math.PI / 2); // reset knob
  k.add(head, new THREE.TorusGeometry(0.08, 0.016, 6, 16), steel, 0, -0.06, 0, 0, Math.PI / 2); // finger ring
  bakeShade(k.g);
  const face = tallyFace();
  // the number window is lit like the rest (so it can't be read in the dark)
  const wm = new THREE.MeshBasicMaterial({ color: 0xffffff, map: face.tex });
  wm.userData.base = new THREE.Color(0xffffff);
  k.mats.push(wm);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.1), wm);
  win.position.set(0, 0.17, -0.077);
  win.rotation.y = Math.PI;
  head.add(win);
  return { ...k, parts: { body, legL, legR, armL, armR, head, plunger, thumb }, face, win, height: 1.9, eye: 1.7 };
}

/**
 * A Grisholm receiver: drab overalls with a reflective band, a pale hard hat with the helmet
 * camera on its side. The crew's own figure (in co-op) and the Plus-One's borrowed one, which
 * has its visor down and its camera's tally lamp dark.
 */
export function crewModel({ visor = false, color = 0x4f5a4a } = {}) {
  const k = kit();
  const suit = k.mat(color);
  const band = k.mat(0xc9c37a);
  const boot = k.mat(0x1e1c1a);
  const hat = k.mat(0xb3ab90);
  const face = k.mat(0x8c705c);
  const body = k.pivot(k.g, 0, 0, 0);
  const legL = limb(k, body, -0.11, 0.86, 0, 0.08, 0.068, 0.86, suit);
  const legR = limb(k, body, 0.11, 0.86, 0, 0.08, 0.068, 0.86, suit);
  for (const l of [legL, legR]) k.add(l, box(0.13, 0.1, 0.26), boot, 0, -0.83, -0.04);
  k.add(body, cyl(0.2, 0.18, 0.62, 10), suit, 0, 1.17, 0);
  k.add(body, cyl(0.205, 0.205, 0.055, 10), band, 0, 1.3, 0);
  k.add(body, cyl(0.19, 0.19, 0.055, 10), band, 0, 1.0, 0);
  const sh = k.add(body, new THREE.SphereGeometry(0.22, 12, 8), suit, 0, 1.45, 0); // shoulders
  sh.scale.set(1.25, 0.5, 0.8);
  k.add(body, cyl(0.06, 0.07, 0.1, 8), face, 0, 1.55, 0); // neck
  const armL = limb(k, body, -0.27, 1.47, 0, 0.065, 0.055, 0.64, suit);
  const armR = limb(k, body, 0.27, 1.47, 0, 0.065, 0.055, 0.64, suit);
  for (const a of [armL, armR]) k.add(a, box(0.085, 0.13, 0.07), boot, 0, -0.68, 0);
  const head = k.pivot(body, 0, 1.7, 0);
  const skull = k.add(head, new THREE.SphereGeometry(0.115, 14, 10), face, 0, 0, 0);
  skull.scale.set(1, 1.15, 1.05);
  k.add(head, new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 0.05, 0);
  k.add(head, cyl(0.19, 0.19, 0.018, 18), hat, 0, 0.05, -0.02);
  k.add(head, box(0.06, 0.07, 0.11), k.mat(0x2a2c2c), 0.165, 0.06, -0.02); // helmet camera
  const lamp = k.add(head, box(0.015, 0.015, 0.01), k.flat(visor ? 0x140504 : 0xff2a14), 0.165, 0.08, -0.08);
  lamp.userData.noShade = true;
  if (visor) {
    // a wraparound smoked visor, pulled down over the face, a highlight across it
    const vis = k.add(head, new THREE.CylinderGeometry(0.145, 0.13, 0.17, 18, 1, true, Math.PI * 0.62, Math.PI * 0.76), k.mat(0x0b0d0f), 0, -0.015, 0);
    vis.material.side = THREE.DoubleSide;
    const hl = k.add(head, new THREE.CylinderGeometry(0.147, 0.144, 0.012, 18, 1, true, Math.PI * 0.75, Math.PI * 0.3), k.mat(0x58646a), 0, 0.04, 0);
    hl.material.side = THREE.DoubleSide;
  }
  bakeShade(k.g);
  return { ...k, parts: { body, legL, legR, armL, armR, head }, height: 1.9, eye: 1.7 };
}

/** A soft dark blob under a figure, so it stands on the floor rather than over it. */
let _blobTex = null;
function blobShadow(r = 0.45, opacity = 0.55) {
  if (!_blobTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    _blobTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: _blobTex, transparent: true, opacity, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  m.renderOrder = 1;
  return m;
}

/**
 * The floor round the Stocktaker's post, chalked with years of tally marks in fives: a grid of
 * strokes, thick near the pile and thinning out, some rubbed half away.
 */
function chalkFloor(seed) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  let r = seed >>> 0 || 1;
  const rnd = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.lineCap = 'round';
  for (let k = 0; k < 120; k++) {
    const a = rnd() * Math.PI * 2;
    const d = 70 + Math.sqrt(rnd()) * 175;
    const x = 256 + Math.cos(a) * d;
    const y = 256 + Math.sin(a) * d;
    const fade = 1 - (d - 70) / 190;
    g.strokeStyle = `rgba(235,232,220,${(0.12 + rnd() * 0.3) * fade})`;
    g.lineWidth = 2 + rnd() * 1.5;
    const rot = rnd() * 0.5 - 0.25;
    const h = 16 + rnd() * 5;
    const n = rnd() < 0.8 ? 5 : 1 + Math.floor(rnd() * 4);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    for (let i = 0; i < Math.min(4, n); i++) {
      g.beginPath();
      g.moveTo(i * 6 + rnd() * 1.5, -h / 2);
      g.lineTo(i * 6 + rnd() * 1.5, h / 2);
      g.stroke();
    }
    if (n === 5) {
      g.beginPath();
      g.moveTo(-4, h / 2 - 3);
      g.lineTo(24, -h / 2 + 3);
      g.stroke();
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  mat.userData.base = new THREE.Color(0xffffff);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.008;
  return m;
}

const BUILD = {
  hushwarden: () => hushwardenModel(),
  dimmer: () => dimmerModel(),
  stocktaker: () => stocktakerModel(),
  plusOne: () => crewModel({ visor: true }),
};

const LOOP = {
  hushwarden: { name: 'drone', ref: 4, level: 1 },
  dimmer: { name: 'hush', ref: 2.2, level: 1.4 },
  plusOne: { name: 'whistle', ref: 2.5, level: 1 },
};

// ---- the views -----------------------------------------------------------------------------------

export class CreatureViews {
  constructor(game) {
    this.game = game;
    this.views = new Map(); // creature id -> view
    this.dark = game.mats.shared.uDark.value; // the Dimmer's patch (x, z, radius, strength)
  }

  /** How much of the baked light survives at (x, z) (the Dimmer's dark). */
  darkK(x, z) {
    const d = this.dark;
    if (d.w <= 0) return 1;
    const r = Math.hypot(x - d.x, z - d.y);
    const inside = 1 - Math.min(1, Math.max(0, (r - d.z * 0.6) / (d.z * 0.4)));
    return 1 - d.w * inside;
  }

  frame(dt) {
    const g = this.game;
    const st = g.session?.state;
    const list = st?.phase === 'night' ? st.creatures : [];
    const seen = new Set();
    let patch = null;
    for (const s of list) {
      seen.add(s.id);
      let v = this.views.get(s.id);
      if (!v) v = this.create(s);
      this.update(v, s, dt);
      if (s.type === 'dimmer') patch = v;
    }
    for (const [id, v] of this.views) if (!seen.has(id)) this.remove(id, v);
    // the Dimmer's dark goes where it goes, gathering when it arrives
    const d = this.dark;
    if (patch) {
      const s = patch.state;
      d.set(patch.model.g.position.x, patch.model.g.position.z, DIMMER_R * (0.4 + 0.6 * (s.grow ?? 1)), Math.min(0.94, (patch.fadeIn += dt * 0.4)));
    } else d.w = Math.max(0, d.w - dt);
  }

  create(s) {
    const g = this.game;
    const model = BUILD[s.type]();
    model.g.position.set(s.x, 0, s.z);
    model.g.rotation.y = s.yaw || 0;
    g.scene.add(model.g);
    const blob = blobShadow(s.type === 'dimmer' ? 0.7 : 0.42, s.type === 'dimmer' ? 0.8 : 0.5);
    model.g.add(blob);
    model.fixed.push(blob.material);
    const v = { model, state: s, phase: 0, loop: null, fadeIn: 0, litAt: -1, muffle: false, press: 0, extra: [] };
    if (s.type === 'stocktaker' && s.pile) {
      const c = chalkFloor(parseInt(s.id.slice(1), 10) * 7919 + Math.round(s.pile[0] * 13));
      c.position.x = s.pile[0];
      c.position.z = s.pile[1];
      g.scene.add(c);
      g.world.lightAt(s.pile[0], 0.5, s.pile[1], _l);
      lightMats([c.material], _l, 0.9, 0.02);
      v.extra.push(c);
    }
    this.views.set(s.id, v);
    return v;
  }

  update(v, s, dt) {
    const g = this.game;
    const m = v.model;
    v.state = s;
    const o = m.g;
    // ease toward the simulated position (smooths 60 Hz ticks and co-op snapshots)
    const e = Math.min(1, dt * 18);
    const dx = s.x - o.position.x;
    const dz = s.z - o.position.z;
    if (dx * dx + dz * dz > 9) o.position.set(s.x, 0, s.z);
    else {
      o.position.x += dx * e;
      o.position.z += dz * e;
    }
    let dy = (s.yaw || 0) - o.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    o.rotation.y += dy * e;
    this.animate(v, s, dt);
    // light from where it stands (the Dimmer is never lit)
    if (!m.dark && (g.tick !== v.litAt || v.litAt < 0)) {
      v.litAt = g.tick;
      g.world.lightAt(o.position.x, 1.3, o.position.z, _l);
      const k = this.darkK(o.position.x, o.position.z);
      _l[0] *= k;
      _l[1] *= k;
      _l[2] *= k;
      lightMats(m.mats, _l, 1.25, 0.03);
    }
    this.sound(v, s);
  }

  animate(v, s, dt) {
    const P = v.model.parts;
    const moving = s.moving || 0;
    v.phase += dt * moving * 3.4;
    const sw = Math.sin(v.phase) * Math.min(1, moving / 1.5);
    if (P.legL) {
      P.legL.rotation.x = sw * 0.55;
      P.legR.rotation.x = -sw * 0.55;
    }
    const t = this.game.time;
    switch (s.type) {
      case 'hushwarden': {
        P.armL.rotation.x = -sw * 0.25;
        P.armR.rotation.x = sw * 0.25;
        P.body.position.y = Math.abs(Math.cos(v.phase)) * 0.04 * Math.min(1, moving);
        // listening: the horn sweeps; hunting: it points dead ahead and dips
        const listen = s.mode === 'listen' ? 1 : 0;
        P.head.rotation.y += ((listen ? Math.sin(t * 1.3) * 0.7 : 0) - P.head.rotation.y) * Math.min(1, dt * 3);
        P.head.rotation.x += ((s.mode === 'hunt' ? -0.25 : listen ? 0.12 : 0) - P.head.rotation.x) * Math.min(1, dt * 4);
        P.body.rotation.x = s.mode === 'hunt' ? -0.12 : 0;
        break;
      }
      case 'dimmer': {
        // it hangs, as if from a hook, and stirs
        P.body.rotation.z = Math.sin(t * 0.7) * 0.03;
        P.body.position.y = Math.sin(t * 0.45) * 0.03;
        P.armL.rotation.x = Math.sin(t * 0.9) * 0.08 - sw * 0.3;
        P.armR.rotation.x = Math.sin(t * 0.8 + 1) * 0.08 + sw * 0.3;
        break;
      }
      case 'stocktaker': {
        // a press of the plunger with every count
        v.press = Math.max(0, v.press - dt * 6);
        P.plunger.position.y = 0.44 - v.press * 0.05;
        P.armR.rotation.x = 0.5 + v.press * 0.25 + (s.mode === 'count' ? 1.6 : 0) - sw * 0.2;
        P.armL.rotation.x = 0.5 + sw * 0.2;
        P.head.rotation.z = s.mode === 'guard' ? Math.sin(t * 0.35) * 0.05 : 0;
        break;
      }
      case 'plusOne':
      default: {
        P.armL.rotation.x = -sw * 0.4;
        P.armR.rotation.x = sw * 0.4;
        P.body.position.y = Math.abs(Math.cos(v.phase)) * 0.03 * Math.min(1, moving);
        // its head cocked a little to one side, as if listening for something you said
        if (s.type === 'plusOne') P.head.rotation.z = 0.18 + Math.sin(t * 0.3) * 0.03;
      }
    }
  }

  sound(v, s) {
    const a = this.game.audio;
    const L = LOOP[s.type];
    if (!L || !a.ready) return;
    const o = v.model.g.position;
    if (!v.loop) v.loop = a.loop(L.name, { x: o.x, y: v.model.eye, z: o.z }, { ref: L.ref, level: L.level, wet: 0.5 });
    if (!v.loop) return;
    v.loop.setPos({ x: o.x, y: v.model.eye, z: o.z });
    if (this.game.tick % 15 === 0) {
      const p = this.game.player;
      const m = !this.game.world.lineOfSight(p.x, p.z, o.x, o.z, 1.4);
      if (m !== v.muffle) v.loop.setMuffled((v.muffle = m));
    }
  }

  /** A session event about a creature (counts, pops...). */
  onEvent(e) {
    const v = this.views.get(e.creature);
    if (!v) return;
    if (e.type === 'tally' && v.model.face) {
      v.model.face.draw(e.n);
      v.press = 1;
    }
    if (e.type === 'short' && v.model.face) v.model.face.draw(0);
  }

  /** The head of the nearest creature (for the death cut's last look). */
  headOf(id) {
    const v = this.views.get(id);
    if (!v) return null;
    const p = v.model.g.position;
    return { x: p.x, y: v.model.eye, z: p.z };
  }

  remove(id, v) {
    this.game.scene.remove(v.model.g);
    v.model.g.traverse((o) => o.isMesh && o.geometry.dispose());
    for (const m of [...v.model.mats, ...v.model.fixed]) {
      if (m.map && m.map !== _blobTex) m.map.dispose();
      m.dispose();
    }
    for (const o of v.extra) {
      this.game.scene.remove(o);
      o.geometry.dispose();
      o.material.map?.dispose();
      o.material.dispose();
    }
    v.loop?.stop();
    this.views.delete(id);
  }

  clear() {
    for (const [id, v] of this.views) this.remove(id, v);
    this.dark.w = 0;
  }
}
