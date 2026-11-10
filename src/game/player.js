// Player simulation: plain serializable state, advanced by a fixed-timestep tick from actions.

export const PLAYER_RADIUS = 0.28;
const WALK = 1.75;
const RUN = 3.7;
const CROUCH = 0.95;
const EYE = 1.62;
const EYE_CROUCH = 1.02;

export function createPlayer(x, z, yaw = 0) {
  return {
    x,
    z,
    yaw,
    pitch: 0,
    vx: 0,
    vz: 0,
    crouch: 0,
    eye: EYE,
    stamina: 1,
    bob: 0,
    speed: 0,
    flashlight: false,
    battery: 1,
    lastStep: 0,
  };
}

export function applyLook(p, look) {
  p.yaw += look.yaw;
  p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch + look.pitch));
}

const _boxes = [];

/** One tick. Returns events (footsteps) for audio. */
export function stepPlayer(p, a, world, dt, events) {
  // crouch / run
  const wantCrouch = a.crouch ? 1 : 0;
  p.crouch += (wantCrouch - p.crouch) * Math.min(1, dt * 9);
  let len = Math.hypot(a.moveX, a.moveZ);
  const mx = len ? a.moveX / len : 0;
  const mz = len ? a.moveZ / len : 0;
  const running = a.run && len > 0 && p.crouch < 0.5 && p.stamina > 0.02;
  if (running) p.stamina = Math.max(0, p.stamina - dt / 9);
  else p.stamina = Math.min(1, p.stamina + dt / 6);
  const top = p.crouch > 0.5 ? CROUCH : running ? RUN : WALK;
  // camera-relative direction: forward is -z rotated by yaw
  const sy = Math.sin(p.yaw);
  const cy = Math.cos(p.yaw);
  const tx = (mx * cy - mz * sy) * top;
  const tz = (-mx * sy - mz * cy) * top;
  const k = 1 - Math.exp(-dt * (len ? 9 : 12));
  p.vx += (tx - p.vx) * k;
  p.vz += (tz - p.vz) * k;

  const ox = p.x;
  const oz = p.z;
  move(p, world, p.vx * dt, p.vz * dt);
  const moved = Math.hypot(p.x - ox, p.z - oz);
  p.speed = moved / dt;
  // keep velocity honest after sliding along walls
  p.vx = (p.x - ox) / dt;
  p.vz = (p.z - oz) / dt;

  // head bob & footsteps
  const stride = p.crouch > 0.5 ? 0.55 : running ? 0.95 : 0.72;
  const before = Math.floor(p.bob / Math.PI);
  p.bob += (moved / stride) * Math.PI;
  if (Math.floor(p.bob / Math.PI) !== before && moved > 0.001) {
    events.push({ type: 'step', x: p.x, z: p.z, run: running, crouch: p.crouch > 0.5 });
  }
  if (moved < 0.0005) p.bob += (Math.round(p.bob / Math.PI) * Math.PI - p.bob) * Math.min(1, dt * 4);
  p.eye = EYE + (EYE_CROUCH - EYE) * p.crouch;

  if (a.flashlight) {
    p.flashlight = !p.flashlight;
    events.push({ type: 'flashlight', on: p.flashlight });
  }
  if (p.flashlight) p.battery = Math.max(0, p.battery - dt / 900);
  else p.battery = Math.min(1, p.battery + dt / 1800);
}

function move(p, world, dx, dz) {
  // sub-step so fast moves never tunnel through thin walls
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  for (let s = 0; s < steps; s++) {
    p.x += dx / steps;
    p.z += dz / steps;
    for (let it = 0; it < 3; it++) {
      world.collidersNear(p.x, p.z, PLAYER_RADIUS, _boxes);
      let pushed = false;
      for (const b of _boxes) {
        const cx = Math.max(b[0], Math.min(p.x, b[2]));
        const cz = Math.max(b[1], Math.min(p.z, b[3]));
        let ex = p.x - cx;
        let ez = p.z - cz;
        const d2 = ex * ex + ez * ez;
        if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) continue;
        if (d2 < 1e-9) {
          // centre inside the box: push out along the shallowest axis
          const l = p.x - b[0];
          const r = b[2] - p.x;
          const t = p.z - b[1];
          const bt = b[3] - p.z;
          const mn = Math.min(l, r, t, bt);
          if (mn === l) p.x = b[0] - PLAYER_RADIUS;
          else if (mn === r) p.x = b[2] + PLAYER_RADIUS;
          else if (mn === t) p.z = b[1] - PLAYER_RADIUS;
          else p.z = b[3] + PLAYER_RADIUS;
        } else {
          const d = Math.sqrt(d2);
          const push = PLAYER_RADIUS - d;
          ex /= d;
          ez /= d;
          p.x += ex * push;
          p.z += ez * push;
        }
        pushed = true;
      }
      if (!pushed) break;
    }
  }
}
