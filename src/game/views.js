// Presentation of session state: meshes for every item lying about, the item in the local
// player's hands, and the van's time-locked rear door. Reads state; never changes it.

import * as THREE from 'three';
import { buildModel, ITEMS } from './items.js';
import { VAN } from '../world/kinds/yard.js';

const _light = [0, 0, 0];

export class Views {
  constructor(game) {
    this.game = game;
    this.items = new Map(); // id -> { model, key }
    this.hand = null; // { id, model }
    this.handGroup = new THREE.Group();
    this.handGroup.position.set(0.3, -0.34, -0.62);
    game.camera.add(this.handGroup);
    this.buildDoor();
  }

  buildDoor() {
    const g = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0x26302c });
    steel.userData.base = new THREE.Color(0x26302c);
    const bar = new THREE.MeshLambertMaterial({ color: 0x8a8d88 });
    bar.userData.base = new THREE.Color(0x8a8d88);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xff3a1a });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(VAN.door.w, VAN.door.h - 0.02, 0.06), steel);
    slab.position.set(0, VAN.door.h / 2, 0);
    g.add(slab);
    for (const y of [0.55, 1.4]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(VAN.door.w * 0.9, 0.05, 0.03), bar);
      b.position.set(0, y, -0.045);
      g.add(b);
      const b2 = b.clone();
      b2.position.z = 0.045;
      g.add(b2);
    }
    // the time-lock's lamp: red while locked, green when open
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), lamp);
    l.position.set(0.36, 1.7, 0.04);
    g.add(l);
    const l2 = l.clone();
    l2.position.z = -0.04;
    g.add(l2);
    g.position.set(VAN.door.x, 0, VAN.door.z + 0.25);
    this.door = { group: g, mats: [steel, bar], lamp, open: 0 };
    this.game.scene.add(g);
  }

  frame(dt) {
    const g = this.game;
    const s = g.session.state;
    // the door slides along the inside of the rear wall when the time-lock opens
    const d = this.door;
    const want = g.session.doorOpen ? 1 : 0;
    d.open += (want - d.open) * Math.min(1, dt * 2.5);
    d.group.position.x = VAN.door.x + d.open * 0.98;
    d.lamp.color.setHex(want ? 0x2aff6a : 0xff3a1a);
    if (!this._doorLit || g.tick % 30 === 0) {
      g.world.lightAt(VAN.door.x, 1.2, VAN.door.z + 0.6, _light);
      for (const m of d.mats) m.emissive.setRGB(m.userData.base.r * (_light[0] + 0.05), m.userData.base.g * (_light[1] + 0.05), m.userData.base.b * (_light[2] + 0.05));
      this._doorLit = true;
    }
    g.world.dynamic.length = 0;
    if (d.open < 0.6) g.world.dynamic.push([VAN.door.x - 0.6, VAN.door.z + 0.1, VAN.door.x + 0.6, VAN.door.z + 0.4]);

    // items on the floor
    const seen = new Set();
    for (const it of s.items) {
      if (it.holder) continue;
      seen.add(it.id);
      let v = this.items.get(it.id);
      const key = `${it.x},${it.y},${it.z},${it.yaw}`;
      if (!v) {
        v = { model: buildModel(it.type), key: '' };
        g.scene.add(v.model.object);
        this.items.set(it.id, v);
      }
      if (v.key !== key) {
        v.model.object.position.set(it.x, it.y, it.z);
        v.model.object.rotation.set(0, it.yaw, 0);
        g.world.lightAt(it.x, it.y + 0.3, it.z, _light);
        v.model.setLight(_light, 1.1);
        v.key = key;
      }
    }
    for (const [id, v] of this.items) {
      if (seen.has(id)) continue;
      g.scene.remove(v.model.object);
      v.model.dispose();
      this.items.delete(id);
    }

    // the active item in the local player's hands
    const held = g.localHeld();
    const active = held[g.localPlayer().active] || null;
    if ((active?.id || null) !== (this.hand?.id || null)) {
      if (this.hand) {
        this.handGroup.remove(this.hand.model.object);
        this.hand.model.dispose();
      }
      this.hand = null;
      if (active) {
        const model = buildModel(active.type);
        const box = new THREE.Box3().setFromObject(model.object);
        const size = box.getSize(new THREE.Vector3());
        const big = ITEMS[active.type].slots > 1;
        const k = Math.min(1, (big ? 0.55 : 0.3) / Math.max(size.x, size.y, size.z));
        model.object.scale.setScalar(k);
        model.object.position.set(big ? -0.3 : 0, big ? -0.12 : -0.05, big ? 0.05 : 0);
        model.object.rotation.set(0.25, big ? 0.1 : -0.5, 0);
        model.object.traverse((o) => (o.renderOrder = 10));
        this.handGroup.add(model.object);
        this.hand = { id: active.id, model };
      }
    }
    if (this.hand) {
      const p = g.player;
      g.world.lightAt(p.x, 1.2, p.z, _light);
      this.hand.model.setLight(_light, 1.3);
      // sway with the walk, sag under weight
      const bob = p.bob || 0;
      const sag = Math.min(0.08, g.carriedKg() / 300);
      this.handGroup.position.set(0.3 + Math.cos(bob) * 0.012, -0.34 - Math.abs(Math.sin(bob)) * 0.01 - sag, -0.62);
    }
  }

  clear() {
    for (const v of this.items.values()) {
      this.game.scene.remove(v.model.object);
      v.model.dispose();
    }
    this.items.clear();
  }
}
