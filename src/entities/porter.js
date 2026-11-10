// HUNTER: THE NIGHT PORTER. He makes his rounds with a room-service cart, collecting what was
// left in the halls. Telegraphed: the wheel squeaks long before you see him, and the lights
// brown out around him. He hunts by sound; a lit flashlight lets him see you from further.
// Avoid him by listening, walking or crouching instead of running, and breaking his line of
// sight. If he reaches you, you are "checked out" and wake up somewhere else. No harm shown.

import * as THREE from 'three';
import { hash, RNG } from '../core/rng.js';
import { person } from './figure.js';

const WINDOW = 75 * 60; // ticks per scheduling window
const FIRST = 150 * 60; // never before 2.5 minutes in
const VISIT = 70 * 60;

export default {
  id: 'porter',
  role: 'hunter',
  name: 'The Night Porter',
  card: {
    title: 'The Night Porter',
    blurb: 'You hear the cart first. He collects whatever is left in the halls, and he listens for it.',
  },

  /** Should a visit begin at this tick? Pure function of seed and tick. */
  schedule(seed, tick) {
    if (tick < FIRST || tick % WINDOW !== 0) return false;
    return hash(seed, 'porter', tick / WINDOW) % 100 < 45;
  },

  spawn(ctx) {
    const { world, player, seed, tick } = ctx;
    const rng = new RNG(hash(seed, 'porter-spawn', tick));
    // a hidden walkable spot 14-24 m from the player
    let best = null;
    let pathChecks = 0;
    for (let k = 0; k < 80 && !best && pathChecks < 5; k++) {
      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(14, 24);
      const x = player.x + Math.cos(a) * d;
      const z = player.z + Math.sin(a) * d;
      if (!world.isWalkable(x, z)) continue;
      if (world.lineOfSight(player.x, player.z, x, z, 1.5)) continue;
      pathChecks++;
      if (!world.findPath(x, z, player.x, player.z, 4000)) continue;
      best = { x, z };
    }
    if (!best) return null;
    return {
      type: 'porter',
      x: best.x,
      z: best.z,
      prevX: best.x,
      prevZ: best.z,
      yaw: 0,
      mode: 'arrive',
      t: 0,
      home: best,
      target: { x: player.x, z: player.z },
      path: null,
      pathAt: -999,
      lost: 0,
      searchT: 0,
      rngSeed: hash(seed, 'porter', tick),
      seen: false,
      speed: 0,
    };
  },

  tick(s, ctx) {
    const { world, player, events } = ctx;
    s.t++;
    s.prevX = s.x;
    s.prevZ = s.z;
    const rng = new RNG(hash(s.rngSeed, s.t));
    const dx = player.x - s.x;
    const dz = player.z - s.z;
    const d = Math.hypot(dx, dz);

    // perception: sight (cone + range; the flashlight gives you away) and hearing (footsteps)
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    const facing = (dx * fx + dz * fz) / (d || 1);
    let range = player.flashlight ? 15 : 8;
    if (player.crouch > 0.5) range *= 0.6;
    const los = d < range + 1 && world.lineOfSight(s.x, s.z, player.x, player.z, 1.5);
    const sees = los && (d < 2.2 || (d < range && facing > 0.35));
    if (s.mode !== 'leave' && !ctx.checkingOut) {
      if (sees) {
        if (s.mode !== 'chase') ctx.onChase?.(s);
        s.mode = 'chase';
        s.lost = 0;
        s.target = { x: player.x, z: player.z };
      } else if (s.mode === 'chase') {
        if (++s.lost > 100) {
          s.mode = 'search';
          s.searchT = 0;
        }
      }
      for (const e of events) {
        if (e.type !== 'step') continue;
        const r = e.run ? 13 : e.crouch ? 1.4 : 5.5;
        if (d < r && s.mode !== 'chase') {
          s.mode = 'search';
          s.searchT = 0;
          s.target = { x: player.x, z: player.z };
        }
      }
    }
    if (s.mode === 'search' && ++s.searchT > 20 * 60) s.mode = 'leave';
    if (s.t > VISIT && s.mode !== 'chase') s.mode = 'leave';
    if (s.mode === 'leave') s.target = s.home;

    // reached the target: look around nearby, or finish leaving
    const tx = s.target.x - s.x;
    const tz = s.target.z - s.z;
    if (Math.hypot(tx, tz) < 0.6) {
      if (s.mode === 'leave') {
        s.done = true;
        return;
      }
      if (s.mode !== 'chase') {
        for (let k = 0; k < 12; k++) {
          const nx = s.target.x + rng.float(-6, 6);
          const nz = s.target.z + rng.float(-6, 6);
          if (world.isWalkable(nx, nz)) {
            s.target = { x: nx, z: nz };
            break;
          }
        }
      }
    }
    if (s.mode === 'leave' && s.t > VISIT + 25 * 60) {
      s.done = true;
      return;
    }

    // path following
    const speed = s.mode === 'chase' ? 2.45 : s.mode === 'leave' ? 1.4 : 1.15;
    if (!s.path || s.t - s.pathAt > (s.mode === 'chase' ? 20 : 60) || !s.path.length) {
      s.path = world.findPath(s.x, s.z, s.target.x, s.target.z, 2500) || [];
      s.pathAt = s.t;
      if (s.path.length) s.path.shift();
      if (!s.path.length && s.mode !== 'chase' && Math.hypot(s.target.x - s.x, s.target.z - s.z) > 1) {
        // unreachable target: settle for a nearby open spot instead
        s.target = { x: s.x, z: s.z };
      }
    }
    let step = speed / 60;
    while (step > 0 && s.path.length) {
      const w = s.path[0];
      const wx = w.x - s.x;
      const wz = w.z - s.z;
      const wd = Math.hypot(wx, wz);
      if (wd <= step) {
        s.x = w.x;
        s.z = w.z;
        s.path.shift();
        step -= wd;
      } else {
        s.x += (wx / wd) * step;
        s.z += (wz / wd) * step;
        step = 0;
      }
    }
    const mx = s.x - s.prevX;
    const mz = s.z - s.prevZ;
    s.speed = Math.hypot(mx, mz) * 60;
    if (s.speed > 0.05) {
      const want = Math.atan2(mx, mz);
      let dy = want - s.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      s.yaw += dy * 0.12;
    }

    // caught
    if (d < 0.95 && !ctx.checkingOut) {
      ctx.checkOut('porter');
      s.mode = 'leave';
    }
  },

  /** How strongly this hunter browns out the lights at a distance d. */
  dimAt(s, d) {
    const k = Math.min(1, Math.max(0, (d - 3) / 11));
    return 0.18 + 0.82 * k * k;
  },

  view(game) {
    const f = person({ height: 1.97, coat: 0x4a1814, trousers: 0x1a1414, skin: 0x8c8478, hat: 'pillbox' });
    // no face: the head is smooth, tipped a little forward as if reading a room number
    f.parts.head.rotation.x = 0.22;
    f.parts.head.scale.set(0.84, 1.18, 0.9);
    f.parts.hat.rotation.x = 0.22;
    f.parts.hat.position.z += 0.03;
    // a stiff white collar and brass buttons down the jacket
    f.add('', new THREE.CylinderGeometry(0.07, 0.075, 0.05, 10), f.mat(0xb8b2a2), 0, 1.53 * (1.97 / 1.8), 0);
    const brass = f.mat(0x9a7a3a);
    for (let i = 0; i < 4; i++) f.add('', new THREE.SphereGeometry(0.012, 6, 4), brass, 0.035, 1.38 - i * 0.12, 0.125);
    // arms hang from the shoulders and reach down to the cart's push bar, hands closed on it
    const skinM = f.parts.head.material;
    for (const side of [-1, 1]) {
      const arm = side < 0 ? f.parts.armL : f.parts.armR;
      const pivot = new THREE.Group();
      pivot.position.set(0.25 * side, 1.58, 0);
      pivot.rotation.x = -0.75;
      pivot.rotation.z = 0.05 * side;
      f.group.add(pivot);
      arm.position.set(0, -0.36, 0);
      arm.rotation.set(0, 0, 0);
      pivot.add(arm);
      const hand = f.add('', new THREE.SphereGeometry(0.048, 8, 6), skinM, 0, -0.73, 0, pivot);
      hand.scale.set(0.8, 1.2, 1);
    }
    // his cart, out in front: tarnished steel, a grey-white cloth, a cloche and a push bar
    const cart = new THREE.Group();
    const steel = f.mat(0x6e706c);
    const cloth = f.mat(0x858176);
    const dark = f.mat(0x111111);
    f.add('', new THREE.BoxGeometry(0.6, 0.02, 0.9), steel, 0, 0.82, 0, cart);
    // the cloth hangs over the sides in a skirt that stops short of the floor
    f.add('', new THREE.BoxGeometry(0.64, 0.015, 0.94), cloth, 0, 0.835, 0, cart);
    for (const sx of [-1, 1]) f.add('', new THREE.BoxGeometry(0.01, 0.3, 0.94), cloth, 0.32 * sx, 0.69, 0, cart);
    f.add('', new THREE.BoxGeometry(0.64, 0.3, 0.01), cloth, 0, 0.69, 0.47, cart);
    f.add('', new THREE.BoxGeometry(0.58, 0.02, 0.86), steel, 0, 0.2, 0, cart);
    f.add('', new THREE.BoxGeometry(0.3, 0.12, 0.22), f.mat(0x3a3028), 0.08, 0.27, 0.15, cart); // a covered tray below
    for (const [x, z] of [[-0.28, -0.42], [0.28, -0.42], [0.28, 0.42], [-0.28, 0.42]]) {
      f.add('', new THREE.CylinderGeometry(0.012, 0.012, 0.8, 5), steel, x, 0.42, z, cart);
      f.add('', new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), dark, x, 0.045, z, cart).rotation.z = Math.PI / 2;
    }
    // push bar on the near end
    for (const sx of [-1, 1]) f.add('', new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), steel, 0.26 * sx, 0.93, -0.46, cart);
    f.add('', new THREE.CylinderGeometry(0.014, 0.014, 0.56, 6), steel, 0, 1.03, -0.46, cart).rotation.z = Math.PI / 2;
    const dome = f.add('', new THREE.SphereGeometry(0.17, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0.05, 0.84, 0.1, cart);
    dome.scale.y = 0.8;
    f.add('', new THREE.SphereGeometry(0.02, 6, 4), steel, 0.05, 0.98, 0.1, cart);
    cart.position.z = 0.98;
    f.group.add(cart);

    const wheel = game.audio.loop('wheel', { x: 0, z: 0 }, { ref: 2.5, wet: 0.5, level: 1.0 });
    return {
      object: f.group,
      update(s, alpha, light, t) {
        f.group.position.set(s.prevX + (s.x - s.prevX) * alpha, 0, s.prevZ + (s.z - s.prevZ) * alpha);
        f.group.rotation.y = s.yaw;
        // a slow, too-even gait
        const ph = t * (s.speed > 2 ? 7 : 3.5);
        const sw = Math.min(1, s.speed) * 0.35;
        f.parts.legL.rotation.x = Math.sin(ph) * sw;
        f.parts.legR.rotation.x = -Math.sin(ph) * sw;
        f.group.position.y = Math.abs(Math.sin(ph)) * 0.015 * sw;
        f.setLight(light);
        if (wheel) {
          wheel.setPos({ x: f.group.position.x, y: 0.5, z: f.group.position.z + 0 });
          wheel.setLevel(s.speed > 0.1 ? 1.0 : 0.0, 0.2);
        }
      },
      dispose() {
        wheel?.stop();
        f.dispose();
      },
    };
  },
};
