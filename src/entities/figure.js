// Figures for hunters and residents, built from primitives. They have no baked light, so each
// frame the entity system tells them how lit their spot is and they glow by that amount
// (the flashlight still lights them for real on top).

import * as THREE from 'three';

export class Figure {
  constructor() {
    this.group = new THREE.Group();
    this.mats = [];
    this.parts = {};
  }

  mat(color) {
    const m = new THREE.MeshLambertMaterial({ color });
    m.userData.base = new THREE.Color(color);
    this.mats.push(m);
    return m;
  }

  add(name, geo, mat, x, y, z, parent = this.group) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (name) this.parts[name] = mesh;
    return mesh;
  }

  /** Light the figure with an environment colour (linear rgb). */
  setLight(rgb) {
    const mx = Math.max(rgb[0], rgb[1], rgb[2]);
    const k = mx > 0.45 ? 0.45 / mx : 1;
    const c = new THREE.Color(rgb[0] * k, rgb[1] * k, rgb[2] * k);
    for (const m of this.mats) m.emissive.copy(m.userData.base).multiply(c);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
  }
}

/** A tall standing human shape. opts: { height, coat, trousers, skin, hat } */
export function person(opts = {}) {
  const f = new Figure();
  const h = opts.height || 1.8;
  const s = h / 1.8;
  const coat = f.mat(opts.coat ?? 0x4a2a22);
  const trousers = f.mat(opts.trousers ?? 0x221c18);
  const skin = f.mat(opts.skin ?? 0xc9b8a0);
  const shoe = f.mat(0x111010);
  const legGeo = new THREE.CapsuleGeometry(0.075 * s, 0.72 * s, 3, 8);
  f.add('legL', legGeo, trousers, -0.1 * s, 0.47 * s, 0);
  f.add('legR', legGeo, trousers, 0.1 * s, 0.47 * s, 0);
  const shoeGeo = new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.26 * s);
  f.add('', shoeGeo, shoe, -0.1 * s, 0.035 * s, 0.04 * s);
  f.add('', shoeGeo, shoe, 0.1 * s, 0.035 * s, 0.04 * s);
  const torso = f.add('torso', new THREE.CapsuleGeometry(0.19 * s, 0.5 * s, 4, 10), coat, 0, 1.18 * s, 0);
  torso.scale.set(1, 1, 0.62);
  const armGeo = new THREE.CapsuleGeometry(0.055 * s, 0.56 * s, 3, 8);
  const armL = f.add('armL', armGeo, coat, -0.26 * s, 1.15 * s, 0);
  const armR = f.add('armR', armGeo, coat, 0.26 * s, 1.15 * s, 0);
  armL.rotation.z = 0.06;
  armR.rotation.z = -0.06;
  f.add('', new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 0.1 * s, 8), skin, 0, 1.55 * s, 0);
  const head = f.add('head', new THREE.SphereGeometry(0.115 * s, 14, 10), skin, 0, 1.67 * s, 0.0);
  head.scale.set(0.9, 1.15, 0.95);
  if (opts.hat === 'pillbox') {
    f.add('hat', new THREE.CylinderGeometry(0.085 * s, 0.09 * s, 0.09 * s, 12), coat, 0, 1.8 * s, -0.01);
  } else if (opts.hat === 'fedora') {
    f.add('hat', new THREE.CylinderGeometry(0.1 * s, 0.11 * s, 0.11 * s, 12), trousers, 0, 1.8 * s, 0);
    f.add('', new THREE.CylinderGeometry(0.19 * s, 0.19 * s, 0.012 * s, 16), trousers, 0, 1.75 * s, 0);
  }
  f.height = h;
  return f;
}
