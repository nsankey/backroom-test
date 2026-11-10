// HUNTER: THE UNLIT. A patch of hall where the lights have gone out, drifting toward you slower
// than you walk. Telegraphed: tubes pop and die ahead of it, the hum drops away, the tape warps.
// Inside the dark stands someone from the night staff who let their lights go out. Counterplay is
// the opposite of the porter's: turn the flashlight on and hold it on them; they cannot stand it,
// and after a few seconds they withdraw. Let the dark reach you unlit and you are checked out.

import * as THREE from 'three';
import { hash, RNG } from '../core/rng.js';
import { person } from './figure.js';

const WINDOW = 90 * 60;
const FIRST = 240 * 60; // never before 4 minutes in
const VISIT = 80 * 60;
const RADIUS = 3.4;
const SPEED = 0.8; // m/s: slower than walking (1.75)
const HOLD = 150; // ticks of steady torchlight to drive it off
const CATCH = 1.4;

export default {
  id: 'unlit',
  role: 'hunter',
  name: 'The Unlit',
  card: {
    title: 'The Unlit',
    blurb: 'Where a light was let go out. It moves slower than you walk, and it cannot stand being looked at with a torch.',
  },

  schedule(seed, tick) {
    if (tick < FIRST || tick % WINDOW !== 0) return false;
    return hash(seed, 'unlit', tick / WINDOW) % 100 < 40;
  },

  spawn(ctx) {
    const { world, player, seed, tick } = ctx;
    const rng = new RNG(hash(seed, 'unlit-spawn', tick));
    let best = null;
    let pathChecks = 0;
    for (let k = 0; k < 80 && !best && pathChecks < 5; k++) {
      const a = rng.float(0, Math.PI * 2);
      const d = rng.float(12, 20);
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
      type: 'unlit',
      x: best.x,
      z: best.z,
      prevX: best.x,
      prevZ: best.z,
      yaw: 0,
      mode: 'stalk',
      t: 0,
      home: best,
      path: null,
      pathAt: -999,
      rngSeed: hash(seed, 'unlit', tick),
      R: 0, // current radius of the dark
      held: 0, // ticks of torchlight taken
      lit: false, // in the torch beam this tick
      nextPop: 40,
      pop: null, // { x, z, n }: a tube giving out ahead of it (the view plays it)
      popN: 0,
      speed: 0,
    };
  },

  tick(s, ctx) {
    const { world, player } = ctx;
    s.t++;
    s.prevX = s.x;
    s.prevZ = s.z;
    const rng = new RNG(hash(s.rngSeed, s.t));
    const dx = s.x - player.x;
    const dz = s.z - player.z;
    const d = Math.hypot(dx, dz);

    // the torch: on, charged, pointed at it, close enough and nothing in the way
    const look = (dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw)) / (d || 1);
    s.lit =
      s.mode === 'stalk' &&
      player.flashlight &&
      player.battery > 0 &&
      d < 9 &&
      (look > 0.85 || d < 1.6) &&
      world.lineOfSight(player.x, player.z, s.x, s.z, 1.2);
    if (s.lit) {
      if (++s.held >= HOLD) {
        s.mode = 'retreat';
        s.retreatAt = s.t;
        s.path = null;
      }
    } else s.held = Math.max(0, s.held - 0.5);

    if (s.mode === 'stalk' && s.t > VISIT) {
      s.mode = 'leave';
      s.path = null;
    }

    // the dark swells in, flinches under the torch, and drains away when it goes
    const wantR = s.mode === 'stalk' ? RADIUS * (1 - 0.35 * (s.held / HOLD)) : 0;
    s.R += (wantR - s.R) * (s.mode === 'stalk' ? 0.02 : 0.035);
    if (s.mode !== 'stalk' && s.R < 0.08) {
      s.done = true;
      return;
    }
    if (s.mode === 'retreat' && s.t - s.retreatAt > 8 * 60) s.done = true;

    // movement: toward you while stalking (it always knows roughly where you are), away when driven off
    const target = s.mode === 'stalk' ? { x: player.x, z: player.z } : s.home;
    const speed = s.lit ? 0 : s.mode === 'retreat' ? 1.7 : s.mode === 'leave' ? 0.4 : SPEED;
    if (!s.path || s.t - s.pathAt > 45 || !s.path.length) {
      s.path = world.findPath(s.x, s.z, target.x, target.z, 2500) || [];
      s.pathAt = s.t;
      if (s.path.length) s.path.shift();
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
    // face the way it drifts, or turn to face the torch
    const want = s.lit ? Math.atan2(-dx, -dz) : s.speed > 0.05 ? Math.atan2(mx, mz) : s.yaw;
    let dy = want - s.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    s.yaw += dy * 0.06;

    // telegraph: tubes give out a few metres ahead of it
    if (s.mode === 'stalk' && --s.nextPop <= 0) {
      s.nextPop = rng.int(70, 170);
      let ax = s.x;
      let az = s.z;
      let along = 0;
      const want2 = rng.float(3.5, 6.5);
      let prev = { x: s.x, z: s.z };
      for (const w of s.path || []) {
        along += Math.hypot(w.x - prev.x, w.z - prev.z);
        ax = w.x;
        az = w.z;
        prev = w;
        if (along >= want2) break;
      }
      s.pop = { x: ax, z: az, n: ++s.popN };
    }

    // caught: the dark closes over you with the torch off (or pointed elsewhere)
    if (s.mode === 'stalk' && d < CATCH && !s.lit && s.R > RADIUS * 0.6 && !ctx.checkingOut) {
      ctx.checkOut('unlit');
      s.mode = 'leave';
    }
  },

  /** Lights brown out mildly around it; the real blackout is the patch itself (uDark). */
  dimAt(s, d) {
    const k = Math.min(1, Math.max(0, (d - 2) / 12));
    const dim = 0.55 + 0.45 * k;
    const f = Math.min(1, s.R / RADIUS);
    return 1 - (1 - dim) * f;
  },

  /** How much of the environment light reaches a point (figures, the light meter). */
  darkAt(s, x, z) {
    const d = Math.hypot(x - s.x, z - s.z);
    const e = s.R;
    if (e <= 0.01) return 1;
    const t = Math.min(1, Math.max(0, (d - e * 0.6) / (e * 0.4)));
    const inside = 1 - t * t * (3 - 2 * t);
    return 1 - 0.96 * inside;
  },

  view(game) {
    // a night-shift attendant in a grey tunic, very still, head tilted back toward the ceiling
    // as if listening for a tube. Never lit by anything but your torch.
    const f = person({ height: 1.92, coat: 0x8a8c84, trousers: 0x5a5c56, skin: 0xa8a49a });
    f.parts.head.rotation.x = -0.35;
    f.parts.head.scale.set(0.82, 1.2, 0.9);
    f.parts.torso.scale.set(0.9, 1.04, 0.56);
    // long arms, hanging a little forward
    for (const side of [-1, 1]) {
      const arm = side < 0 ? f.parts.armL : f.parts.armR;
      arm.scale.set(0.9, 1.18, 0.9);
      arm.position.y -= 0.06;
    }
    // the right arm comes up across the face when the torch finds it
    const pivot = new THREE.Group();
    pivot.position.set(0.27, 1.6, 0);
    f.group.add(pivot);
    f.parts.armR.position.set(0, -0.42, 0);
    f.parts.armR.rotation.set(0, 0, 0);
    pivot.add(f.parts.armR);
    // a name badge, blank
    f.add('', new THREE.BoxGeometry(0.07, 0.03, 0.005), f.mat(0xc8c0a8), -0.08, 1.36, 0.12);
    // no ambient glow at all: setLight is never called, so it is black unless the torch is on it
    const uDark = game.mats.shared.uDark.value;
    const hush = game.audio.loop('hush', { x: 0, z: 0 }, { ref: 3, wet: 0.6, level: 0 });
    let lastPop = 0;
    let raise = 0;
    return {
      object: f.group,
      update(s, alpha, light, t) {
        const x = s.prevX + (s.x - s.prevX) * alpha;
        const z = s.prevZ + (s.z - s.prevZ) * alpha;
        f.group.position.set(x, 0, z);
        f.group.rotation.y = s.yaw;
        // glides more than walks: a slight sway, no stride
        f.group.rotation.z = Math.sin(t * 0.9) * 0.025;
        f.group.visible = s.R > 0.6;
        raise += ((s.lit ? 1 : 0) - raise) * 0.08;
        pivot.rotation.x = -0.15 - raise * 2.1;
        pivot.rotation.z = raise * 0.5;
        f.parts.head.rotation.x = -0.35 + raise * 0.55;
        // flinch: the patch shudders while held
        const shudder = s.lit ? 0.12 * Math.sin(t * 37) : 0;
        uDark.set(x, z, Math.max(0.01, s.R * (1 + shudder)), s.R > 0.02 ? 0.96 : 0);
        if (hush) {
          hush.setPos({ x, y: 1.2, z });
          hush.setLevel(Math.min(1, s.R / RADIUS), 0.4);
        }
        if (s.pop && s.pop.n !== lastPop) {
          lastPop = s.pop.n;
          game.audio.play('tubePop', { x: s.pop.x, y: 2.6, z: s.pop.z }, { ref: 3, wet: 0.5 });
          game.audio.crackle(0.5);
        }
      },
      dispose() {
        uDark.set(0, 0, 1, 0);
        hush?.stop();
        f.dispose();
      },
    };
  },
};
