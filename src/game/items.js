// Items: everything a crew member can pick up. Salvage (loot) has a value in halvers (ħ) and a
// weight; tools are requisitioned from the terminal. Definitions are plain data; models are
// built from primitives on demand (presentation only, never read by the simulation).

import * as THREE from 'three';

// slots: how many of the three carry slots it takes (2 = needs both hands)
// fragile: loses part of its value each time it is dropped rather than set down in the van
export const ITEMS = {
  // ---- salvage ----
  typeball: { name: 'Typewriter golf-ball', kind: 'loot', value: [8, 14], kg: 0.2, slots: 1 },
  seal: { name: 'Embossing seal press', kind: 'loot', value: [24, 38], kg: 3.2, slots: 1 },
  reel: { name: 'Reel of data tape', kind: 'loot', value: [10, 18], kg: 1.1, slots: 1 },
  globe: { name: 'Boardroom star globe', kind: 'loot', value: [22, 36], kg: 3.5, slots: 1, fragile: true },
  dictaphone: { name: 'Dictation machine', kind: 'loot', value: [16, 26], kg: 2.0, slots: 1 },
  penCase: { name: 'Presentation pen set', kind: 'loot', value: [28, 48], kg: 0.4, slots: 1 },
  ledgerBook: { name: 'Bound ledger', kind: 'loot', value: [10, 20], kg: 2.4, slots: 1 },
  stockCert: { name: 'Framed bond certificate', kind: 'loot', value: [32, 55], kg: 1.2, slots: 1, fragile: true },
  plaque: { name: 'Long-service plaque', kind: 'loot', value: [4, 9], kg: 1.4, slots: 1 },
  busbar: { name: 'Copper bus bar', kind: 'loot', value: [28, 44], kg: 8.5, slots: 1 },
  gauge: { name: 'Brass pressure gauge', kind: 'loot', value: [14, 24], kg: 1.6, slots: 1 },
  meterHead: { name: 'Power-deck meter', kind: 'loot', value: [14, 24], kg: 3.4, slots: 1 },
  fanMotor: { name: 'Air scrubber fan motor', kind: 'loot', value: [42, 70], kg: 21, slots: 2 },
  urn: { name: 'Galley tea urn', kind: 'loot', value: [18, 30], kg: 7, slots: 2 },
  carboy: { name: 'Glass carboy', kind: 'loot', value: [34, 58], kg: 16, slots: 2, fragile: true },
  teleprinter: { name: 'Teleprinter', kind: 'loot', value: [45, 72], kg: 24, slots: 2 },

  // ---- tools (requisitioned from the STORES; kept in the van between nights) ----
  lamp: {
    name: 'Bull’s-eye lamp',
    kind: 'tool',
    price: 20,
    kg: 1.2,
    slots: 1,
    charge: 1,
    blurb: 'A battery hand lamp with a thick lens. F switches it on while carried. About four minutes of light a night; recharged in the hold. Held steady on something that hides in the dark, it drives it back.',
  },
  extinguisher: {
    name: 'CO₂ extinguisher',
    kind: 'tool',
    price: 45,
    kg: 6.5,
    slots: 1,
    charge: 4,
    blurb: 'Four blasts a night. A blast stops anything in front of you within five metres for a few seconds. It is very loud. Refilled in the hold.',
  },
  pricegun: {
    name: 'Appraiser’s tag gun',
    kind: 'tool',
    price: 30,
    kg: 0.8,
    slots: 1,
    blurb: 'Point it at salvage and pull the trigger: it prints the strongroom’s valuation on a tag and hangs it on the item. It beeps.',
  },
  harness: {
    name: 'Porter’s back frame',
    kind: 'tool',
    price: 60,
    kg: 3,
    slots: 1,
    blurb: 'A frame and straps. While you carry it, two-handed salvage takes one slot and the load weighs on you a good deal less.',
  },
  recorder: {
    name: 'The foreman’s recorder',
    kind: 'tool',
    price: 35,
    kg: 1.4,
    slots: 1,
    strange: true,
    blurb: 'Found aboard a Halvard tender; the stores will not say which. Use it to play the tape: footsteps and a voice reading out an inventory, loud enough to draw a listener to wherever you leave it. It sometimes plays by itself.',
  },
};

export const SLOTS = 3;
export const isLoot = (type) => ITEMS[type]?.kind === 'loot';
export const isTool = (type) => ITEMS[type]?.kind === 'tool';
export const TOOL_LIST = Object.keys(ITEMS).filter(isTool);

export const holds = (items, pid, type) => items.some((it) => it.holder === pid && it.type === type);

/** Slots an item of `type` would take for this player (a back frame makes two-handed items one). */
export function slotsNeeded(items, pid, type) {
  const n = ITEMS[type].slots;
  return n > 1 && holds(items, pid, 'harness') ? 1 : n;
}

/** Total weight carried by a player, from the item list. */
export function carriedKg(items, pid) {
  let kg = 0;
  for (const it of items) if (it.holder === pid) kg += ITEMS[it.type].kg;
  return kg;
}

/** The weight a player feels (for speed): a back frame takes 45% of the rest off. */
export function feltKg(items, pid) {
  const kg = carriedKg(items, pid);
  return holds(items, pid, 'harness') ? ITEMS.harness.kg + (kg - ITEMS.harness.kg) * 0.55 : kg;
}

/** Slot occupancy for a player: an array of SLOTS item ids (a 2-slot item fills two). */
export function slotsOf(items, pid) {
  const out = new Array(SLOTS).fill(null);
  for (const it of items) {
    if (it.holder !== pid) continue;
    const n = it.n || ITEMS[it.type].slots;
    for (let k = 0; k < n; k++) if (it.slot + k < SLOTS) out[it.slot + k] = it.id;
  }
  return out;
}

/** First run of `n` free slots, preferring the active one; -1 if none. */
export function freeSlot(items, pid, n, prefer = 0) {
  const s = slotsOf(items, pid);
  const fits = (k) => k + n <= SLOTS && s.slice(k, k + n).every((v) => v === null);
  if (fits(prefer)) return prefer;
  for (let k = 0; k < SLOTS; k++) if (fits(k)) return k;
  return -1;
}

export const fmtH = (v) => `ħ${Math.round(v)}`;

// ---- models ------------------------------------------------------------------------------------

/**
 * A model for an item: { object, mats, height } with materials collected so the caller can light
 * them. The origin sits on the floor under the item's centre; +z is its front.
 */
/**
 * Bake a fixed shade into every face's vertex colours (lit from above and a little from one
 * side), so unlit models read as solid shapes. Uses each mesh's transform within the group.
 */
export function bakeShade(g) {
  g.updateMatrixWorld(true);
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  g.traverse((o) => {
    if (!o.isMesh || o.userData.noShade) return;
    const geo = o.geometry;
    const nrm = geo.attributes.normal;
    rel.multiplyMatrices(inv, o.matrixWorld);
    nm.getNormalMatrix(rel);
    const col = new Float32Array(nrm.count * 3);
    for (let k = 0; k < nrm.count; k++) {
      n.fromBufferAttribute(nrm, k).applyMatrix3(nm).normalize();
      const s = 0.5 + 0.42 * Math.max(0, n.y) + 0.14 * n.x + 0.08 * n.z - 0.12 * Math.max(0, -n.y);
      col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = s;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  });
}

/** Colour unlit materials by a light level (plus a floor so nothing vanishes outright). */
export function lightMats(mats, rgb, boost = 1, floor = 0.035) {
  const mx = Math.max(rgb[0], rgb[1], rgb[2]);
  const k = (mx > 0.6 ? 0.6 / mx : 1) * boost * 1.6;
  for (const m of mats) m.color.setRGB(m.userData.base.r * (rgb[0] * k + floor), m.userData.base.g * (rgb[1] * k + floor), m.userData.base.b * (rgb[2] * k + floor));
}

export function buildModel(type) {
  const g = new THREE.Group();
  const mats = [];
  // unlit materials: the colour is set from the light at the item's spot, and each face carries
  // a baked shade (lit from above and a little from one side) so the shape reads
  const mat = (color, opts = {}) => {
    const m = new THREE.MeshBasicMaterial({ color, vertexColors: true, ...opts });
    m.userData.base = new THREE.Color(color);
    mats.push(m);
    return m;
  };
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    g.add(mesh);
    return mesh;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, s = 12) => new THREE.CylinderGeometry(r0, r1, h, s);
  const steel = () => mat(0x7d827f);
  const dark = () => mat(0x222424);
  const brass = () => mat(0xb08c44);
  const MODELS = {
    typeball() {
      add(new THREE.SphereGeometry(0.03, 12, 8), mat(0x9a9e9c), 0, 0.03, 0);
      add(cyl(0.012, 0.012, 0.012, 8), dark(), 0, 0.062, 0);
      return 0.07;
    },
    seal() {
      const b = mat(0x3a3e38);
      add(box(0.12, 0.03, 0.2), b, 0, 0.015, 0);
      add(box(0.05, 0.16, 0.05), b, 0, 0.1, -0.07);
      add(box(0.06, 0.04, 0.17), b, 0, 0.19, -0.01, 0.15);
      add(cyl(0.012, 0.012, 0.14, 6), steel(), 0.02, 0.24, 0.09, 0, 0, Math.PI / 2 - 0.3);
      add(cyl(0.035, 0.035, 0.02, 14), brass(), 0, 0.04, 0.03);
      return 0.26;
    },
    reel() {
      const r = mat(0x6a5a8a);
      add(cyl(0.135, 0.135, 0.008, 20), r, 0, 0.004, 0);
      add(cyl(0.135, 0.135, 0.008, 20), r, 0, 0.032, 0);
      add(cyl(0.11, 0.11, 0.022, 20), mat(0x3a2e22), 0, 0.018, 0);
      add(cyl(0.03, 0.03, 0.04, 10), dark(), 0, 0.018, 0);
      return 0.04;
    },
    globe() {
      add(cyl(0.08, 0.1, 0.03, 14), mat(0x3a2414), 0, 0.015, 0);
      add(cyl(0.01, 0.01, 0.12, 6), brass(), 0, 0.08, 0);
      add(new THREE.SphereGeometry(0.15, 20, 14), mat(0x5c7c86), 0, 0.27, 0);
      const ring = add(new THREE.TorusGeometry(0.165, 0.008, 6, 28), brass(), 0, 0.27, 0, 0, 0, 0.4);
      ring.rotation.y = Math.PI / 2;
      add(new THREE.SphereGeometry(0.152, 10, 8, 0.4, 1.4, 0.6, 1.0), mat(0xb0a070), 0, 0.27, 0);
      return 0.43;
    },
    dictaphone() {
      add(box(0.24, 0.07, 0.18), mat(0x2a2a2c), 0, 0.035, 0);
      add(box(0.2, 0.012, 0.1), mat(0x7a7a72), 0, 0.075, -0.02);
      for (const x of [-0.05, 0.05]) add(cyl(0.025, 0.025, 0.01, 10), steel(), x, 0.082, -0.02);
      add(box(0.05, 0.03, 0.12), mat(0x1a1a1a), 0.15, 0.03, 0.02, 0, 0.2);
      return 0.09;
    },
    penCase() {
      add(box(0.22, 0.035, 0.09), mat(0x4a1418), 0, 0.0175, 0);
      add(box(0.22, 0.015, 0.09), mat(0x5a1c20), 0, 0.044, -0.02, -0.5);
      for (const z of [-0.012, 0.012]) add(cyl(0.007, 0.007, 0.16, 8), brass(), 0, 0.04, z, 0, 0, Math.PI / 2);
      return 0.06;
    },
    ledgerBook() {
      add(box(0.3, 0.06, 0.22), mat(0x2e3a2c), 0, 0.03, 0);
      add(box(0.29, 0.05, 0.005), mat(0xd8d0b4), 0.005, 0.03, 0.11);
      add(box(0.02, 0.064, 0.224), mat(0x6a4a24), -0.145, 0.03, 0);
      return 0.07;
    },
    stockCert() {
      add(box(0.36, 0.28, 0.025), mat(0x6a4a24), 0, 0.14, 0, -0.12);
      add(box(0.3, 0.22, 0.005), mat(0xd8cca4), 0, 0.145, 0.014, -0.12);
      add(box(0.1, 0.02, 0.006), mat(0x8a2a22), 0, 0.08, 0.02, -0.12);
      return 0.3;
    },
    plaque() {
      add(box(0.24, 0.3, 0.025), mat(0x4a2c18), 0, 0.15, 0, -0.1);
      add(box(0.16, 0.08, 0.005), brass(), 0, 0.2, 0.015, -0.1);
      add(cyl(0.04, 0.04, 0.005, 14), brass(), 0, 0.1, 0.015, Math.PI / 2 - 0.1);
      return 0.3;
    },
    busbar() {
      add(box(0.9, 0.04, 0.1), mat(0xb0643a), 0, 0.02, 0);
      for (const x of [-0.38, 0.38]) add(cyl(0.015, 0.015, 0.045, 8), steel(), x, 0.025, 0);
      return 0.05;
    },
    gauge() {
      add(cyl(0.09, 0.09, 0.045, 18), brass(), 0, 0.09, 0, Math.PI / 2);
      add(cyl(0.078, 0.078, 0.005, 18), mat(0xe0dccb), 0, 0.09, 0.024, Math.PI / 2);
      add(box(0.005, 0.06, 0.003), dark(), 0.01, 0.1, 0.028, 0, 0, -0.7);
      add(cyl(0.015, 0.015, 0.06, 8), brass(), 0, 0.025, 0);
      return 0.18;
    },
    meterHead() {
      add(box(0.2, 0.3, 0.14), mat(0x2c2c2a), 0, 0.15, 0);
      add(cyl(0.08, 0.08, 0.1, 16), mat(0x8a9a9a, { transparent: true, opacity: 0.6 }), 0, 0.2, 0.08, Math.PI / 2);
      add(cyl(0.06, 0.06, 0.005, 16), steel(), 0, 0.2, 0.1, 0, 0, 0);
      add(box(0.12, 0.04, 0.02), mat(0x6a5a3a), 0, 0.06, 0.075);
      return 0.3;
    },
    fanMotor() {
      add(cyl(0.18, 0.18, 0.36, 16), mat(0x3f5f5a), 0, 0.2, 0, 0, 0, Math.PI / 2);
      for (let k = 0; k < 8; k++) add(box(0.36, 0.01, 0.02), mat(0x33504c), 0, 0.2 + Math.sin((k / 8) * Math.PI * 2) * 0.18, Math.cos((k / 8) * Math.PI * 2) * 0.18);
      add(cyl(0.025, 0.025, 0.14, 8), steel(), 0.25, 0.2, 0, 0, 0, Math.PI / 2);
      add(box(0.32, 0.03, 0.3), dark(), 0, 0.015, 0);
      add(box(0.1, 0.08, 0.08), dark(), -0.05, 0.4, 0);
      return 0.42;
    },
    urn() {
      const s = mat(0xa8aca8);
      add(cyl(0.2, 0.22, 0.48, 18), s, 0, 0.3, 0);
      add(cyl(0.14, 0.2, 0.08, 18), s, 0, 0.58, 0);
      add(new THREE.SphereGeometry(0.03, 8, 6), dark(), 0, 0.63, 0);
      add(cyl(0.18, 0.18, 0.06, 18), dark(), 0, 0.03, 0);
      add(box(0.06, 0.05, 0.08), dark(), 0, 0.12, 0.22);
      for (const x of [-0.24, 0.24]) add(box(0.02, 0.1, 0.06), dark(), x, 0.48, 0);
      return 0.65;
    },
    carboy() {
      const gl = mat(0x5e8a6e, { transparent: true, opacity: 0.75 });
      add(new THREE.SphereGeometry(0.22, 18, 12), gl, 0, 0.27, 0).scale.set(1, 1.15, 1);
      add(cyl(0.05, 0.08, 0.12, 12), gl, 0, 0.56, 0);
      add(cyl(0.055, 0.055, 0.03, 12), mat(0x2a2a28), 0, 0.63, 0);
      // a wicker cradle
      add(cyl(0.23, 0.2, 0.2, 18, 1, true), mat(0x8a6a3a), 0, 0.1, 0);
      return 0.65;
    },
    teleprinter() {
      const body = mat(0x8a8670);
      add(box(0.6, 0.22, 0.45), body, 0, 0.11, 0);
      add(box(0.58, 0.16, 0.2), body, 0, 0.3, -0.11);
      add(box(0.5, 0.02, 0.16), dark(), 0, 0.225, 0.13, -0.15);
      add(cyl(0.05, 0.05, 0.5, 12), mat(0x1a1a1a), 0, 0.4, -0.1, 0, 0, Math.PI / 2);
      add(box(0.3, 0.12, 0.004), mat(0xe0dcc8), 0, 0.48, -0.08, -0.2);
      return 0.5;
    },

    // ---- tools ----
    lamp() {
      const body = mat(0x2e3a34);
      add(box(0.11, 0.13, 0.16), body, 0, 0.065, 0);
      add(cyl(0.065, 0.065, 0.05, 16), body, 0, 0.075, 0.1, Math.PI / 2);
      const lens = mat(0xd8d4b8);
      lens.userData.lens = true;
      add(cyl(0.055, 0.055, 0.006, 16), lens, 0, 0.075, 0.126, Math.PI / 2); // the lens
      add(new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), steel(), 0, 0.13, 0, 0, Math.PI / 2);
      return 0.19;
    },
    extinguisher() {
      const red = mat(0x8e1e16);
      add(cyl(0.075, 0.075, 0.5, 14), red, 0, 0.25, 0);
      add(new THREE.SphereGeometry(0.075, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 0.5, 0);
      add(cyl(0.02, 0.02, 0.06, 8), dark(), 0, 0.57, 0);
      add(box(0.03, 0.02, 0.16), steel(), 0, 0.6, -0.04);
      add(cyl(0.012, 0.012, 0.32, 6), dark(), 0.07, 0.42, 0.02, 0.2, 0, 0.1);
      add(cyl(0.035, 0.012, 0.1, 10), dark(), 0.09, 0.27, 0.05, Math.PI); // the horn
      add(box(0.1, 0.12, 0.004), mat(0xd8d0b0), 0, 0.3, 0.076); // the instruction label
      return 0.62;
    },
    pricegun() {
      const shell = mat(0x9a6a2c);
      add(box(0.05, 0.08, 0.2), shell, 0, 0.12, 0);
      add(box(0.045, 0.12, 0.05), dark(), 0, 0.05, 0.06, -0.25);
      add(box(0.03, 0.03, 0.05), steel(), 0, 0.14, -0.12);
      add(cyl(0.035, 0.035, 0.045, 12), mat(0xd8d2c0), 0, 0.17, 0.04, 0, 0, Math.PI / 2); // tag roll
      return 0.2;
    },
    harness() {
      // a porter's pack frame: bent-wood uprights, a canvas back band, padded shoulder straps and
      // a load shelf at the foot
      const wood = mat(0x6e5232);
      const canvas = mat(0x5e5a3e);
      const strap = mat(0x2a2620);
      for (const x of [-0.16, 0.16]) {
        add(box(0.035, 0.42, 0.035), wood, x, 0.23, 0.02, -0.08);
        add(box(0.035, 0.4, 0.035), wood, x, 0.62, 0, 0.1);
      }
      add(box(0.36, 0.035, 0.035), wood, 0, 0.8, -0.02);
      add(box(0.3, 0.2, 0.01), canvas, 0, 0.55, -0.04, 0.05); // the back band
      add(box(0.36, 0.03, 0.24), wood, 0, 0.03, 0.12); // the shelf at the foot
      for (const x of [-0.08, 0.08]) {
        const s = add(new THREE.TorusGeometry(0.17, 0.022, 6, 14, Math.PI), strap, x, 0.55, -0.06, 0, Math.PI / 2, Math.PI / 2);
        s.scale.set(1, 1.35, 1);
      }
      return 0.82;
    },
    recorder() {
      add(box(0.26, 0.09, 0.19), mat(0x4a3424), 0, 0.045, 0);
      add(box(0.24, 0.006, 0.17), mat(0x8a8670), 0, 0.093, 0);
      for (const x of [-0.06, 0.06]) {
        add(cyl(0.045, 0.045, 0.012, 14), dark(), x, 0.102, -0.015);
        add(cyl(0.012, 0.012, 0.016, 8), steel(), x, 0.106, -0.015);
      }
      add(box(0.18, 0.012, 0.03), mat(0x1a1a1a), 0, 0.1, 0.06);
      add(cyl(0.008, 0.008, 0.2, 6), steel(), -0.09, 0.2, 0.05, 0.25); // a microphone on a stalk
      add(new THREE.SphereGeometry(0.022, 10, 8), dark(), -0.09, 0.3, 0.075);
      return 0.33;
    },
  };
  const fn = MODELS[type];
  let height = 0.2;
  if (fn) height = fn();
  else add(box(0.2, 0.2, 0.2), mat(0xff00ff), 0, 0.1, 0);
  bakeShade(g);
  return {
    object: g,
    mats,
    height,
    /** Light the item from the light level at its spot (plus a floor so it never vanishes). */
    setLight(rgb, boost = 1) {
      lightMats(mats, rgb, boost);
    },
    dispose() {
      g.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
      });
      for (const m of mats) m.dispose();
    },
  };
}
