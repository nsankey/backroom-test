// RESIDENT: THE MAINTENANCE MAN. Grey coveralls, a cap, a stepladder and a spare tube under his
// arm. He has been changing tubes since 1979 and he has not stopped. Harmless. He tells you how
// to drive off the Unlit; look away afterwards and he is gone, ladder and all.

import * as THREE from 'three';
import { hash } from '../core/rng.js';
import { person } from './figure.js';

const PLACES = { guestCorridor: 12, ballroom: 14, laundry: 18, iceVending: 8 };

export default {
  id: 'maintenanceMan',
  role: 'resident',
  name: 'The Maintenance Man',
  card: {
    title: 'The Maintenance Man',
    blurb: 'Coveralls, a stepladder, a spare tube under his arm. Every light in the Lodge is his job, and he is not behind.',
  },

  appearsIn(seed, cell) {
    if (!cell.points.resident) return false;
    if (cell.cx === 0 && cell.cz === 0) return false;
    const chance = PLACES[cell.kindId] || 0;
    return hash(seed, 'maintenanceMan', cell.cx, cell.cz) % 100 < chance;
  },

  spawn(ctx, cell) {
    const p = cell.points.resident;
    const spot = ctx.findOpenSpot(cell, p);
    return {
      type: 'maintenanceMan',
      x: spot.x,
      z: spot.z,
      prevX: spot.x,
      prevZ: spot.z,
      yaw: p.yaw ?? (hash(cell.seed, 'mm-yaw') % 628) / 100,
      cellKey: cell.key,
      phase: 'idle',
      t: 0,
      talkedAt: 0,
    };
  },

  tick(s, ctx) {
    s.t++;
    if (s.phase === 'after') {
      const p = ctx.player;
      const dx = s.x - p.x;
      const dz = s.z - p.z;
      const d = Math.hypot(dx, dz);
      const look = (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / (d || 1);
      if (look < 0.2 || d > 12 || s.t - s.talkedAt > 40 * 60) s.done = true;
    }
  },

  interactions(s) {
    if (s.phase !== 'idle') return [];
    return [{ x: s.x, y: 1.4, z: s.z, radius: 1.9, prompt: 'Talk to the maintenance man', entity: s }];
  },

  interact(s, m) {
    s.phase = 'talking';
    s.talkedAt = s.t;
    const at = { x: s.x, y: 1.6, z: s.z };
    m.sound('whisper', at);
    m.caption('"Evening. Don\'t mind me. Tube\'s going in this one."', 3.5);
    m.after(4, () => m.caption('"I keep them lit. All of them. Something comes along wherever one goes out."', 4.5));
    m.after(9, () => m.caption('"If you hear them popping, get your torch on it and hold it there. It can\'t stand being looked at."', 5.5));
    m.after(15, () => {
      m.sound('click', at);
      m.caption('He turns back to his ladder. The spare tube under his arm is already lit.', 4);
      m.discover('resident:maintenanceMan', 'The maintenance man said that when tubes start popping, something is coming through the dark. Hold the torch on it and keep it there.');
      s.phase = 'after';
    });
  },

  view() {
    const f = person({ height: 1.74, coat: 0x6c6e66, trousers: 0x6c6e66, skin: 0xc0a88e });
    const s = 1.74 / 1.8;
    // cap: crown and a short brim
    const cap = f.mat(0x3a3e44);
    f.add('', new THREE.CylinderGeometry(0.105 * s, 0.11 * s, 0.07 * s, 12), cap, 0, 1.79 * s, -0.005);
    f.add('', new THREE.BoxGeometry(0.16 * s, 0.012, 0.1 * s), cap, 0, 1.765 * s, 0.11 * s);
    // tool belt, chest pocket, a ring of keys
    f.add('', new THREE.BoxGeometry(0.4 * s, 0.06, 0.26 * s), f.mat(0x3a2a1c), 0, 0.98 * s, 0);
    f.add('', new THREE.BoxGeometry(0.1, 0.1, 0.02), f.mat(0x5e605a), -0.09, 1.34 * s, 0.11);
    f.add('', new THREE.TorusGeometry(0.03, 0.006, 4, 10), f.mat(0x9a8a5a), 0.17, 0.92 * s, 0.1);
    // a spare tube tucked under the left arm, glowing faintly
    const tubeM = new THREE.MeshBasicMaterial({ color: 0xd8f0d4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.22, 8), tubeM);
    tube.position.set(-0.3, 1.12 * s, 0.05);
    tube.rotation.set(Math.PI / 2 - 0.25, 0, 0.08);
    f.group.add(tube);
    f.parts.armL.rotation.z = 0.28;
    f.parts.armL.position.x -= 0.03;
    // stepladder beside him
    const lad = new THREE.Group();
    const al = f.mat(0x8c8e88);
    // an A-frame: front rails (with the treads) lean back, rear rails lean forward, meeting under the top
    const H = 1.7;
    const foot = 0.3;
    const top = 0.06;
    const tilt = Math.atan((foot - top) / H);
    const L = Math.hypot(foot - top, H);
    for (const side of [-1, 1])
      for (const x of [-0.21, 0.21]) {
        const rail = f.add('', new THREE.BoxGeometry(0.035, L, 0.025), al, x, H / 2, side * (foot + top) / 2, lad);
        rail.rotation.x = side * -tilt;
      }
    for (let k = 0; k < 4; k++) {
      const y = 0.34 + k * 0.37;
      f.add('', new THREE.BoxGeometry(0.42, 0.02, 0.09), al, 0, y, -(foot - (foot - top) * (y / H)) + 0.02, lad);
    }
    f.add('', new THREE.BoxGeometry(0.46, 0.03, 0.2), al, 0, H, 0, lad);
    lad.position.set(0.85, 0, 0.15);
    lad.rotation.y = 0.3;
    f.group.add(lad);
    return {
      object: f.group,
      update(st, alpha, light, t) {
        f.group.position.set(st.x, 0, st.z);
        f.group.rotation.y = st.yaw;
        f.parts.torso.scale.y = 1 + Math.sin(t * 1.1) * 0.006;
        tubeM.color.setRGB(0.6 + 0.25 * light[1], 0.75 + 0.2 * light[1], 0.6 + 0.2 * light[1]);
        f.setLight(light);
      },
      dispose() {
        tube.geometry.dispose();
        tubeM.dispose();
        f.dispose();
      },
    };
  },
};
