// Presentation of the crew's tools: real spotlights for the bull's-eye lamps (the baked world is
// Lambert, so a real light still adds on top, even inside the Dimmer's dark), price tags hung on
// appraised salvage, the extinguisher's cloud, and the foreman's tape playing. Reads session
// state; never changes it.

import * as THREE from 'three';

const MAX_LAMPS = 4;
const LAMP_RANGE = 14;
const LAMP_COLOR = [1.0, 0.9, 0.72];
const COS_OUT = Math.cos(0.56);
const COS_IN = Math.cos(0.12);
const _v = new THREE.Vector3();
const _l = [0, 0, 0];

let _puffTex = null;
function puffTexture() {
  if (_puffTex) return _puffTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 1, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _puffTex = new THREE.CanvasTexture(cv);
  return _puffTex;
}

/** A manila tag with the strongroom's valuation stamped on it. */
function tagSprite(value) {
  const cv = document.createElement('canvas');
  cv.width = 96;
  cv.height = 48;
  const g = cv.getContext('2d');
  g.fillStyle = '#cdb98a';
  g.beginPath();
  g.moveTo(14, 2);
  g.lineTo(94, 2);
  g.lineTo(94, 46);
  g.lineTo(14, 46);
  g.lineTo(2, 24);
  g.closePath();
  g.fill();
  g.fillStyle = '#3a2e1c';
  g.beginPath();
  g.arc(13, 24, 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1e10';
  g.font = 'bold 26px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`ħ${value}`, 56, 25);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(0.2, 0.1, 1);
  s.renderOrder = 5;
  return s;
}

export class ToolViews {
  constructor(game) {
    this.game = game;
    // a fixed pool of spotlights, so turning one on never changes the shader programs
    this.lamps = [];
    for (let k = 0; k < MAX_LAMPS; k++) {
      const l = new THREE.SpotLight(0xffe6b8, 0, LAMP_RANGE, 0.56, 0.95, 1.4);
      l.castShadow = false;
      game.scene.add(l);
      game.scene.add(l.target);
      this.lamps.push(l);
    }
    this.active = []; // [{ pos: Vector3, dir: Vector3, k }] lit this frame
    this.puffs = [];
    this.tapes = new Map(); // item id -> loop handle
  }

  get anyLamp() {
    return this.active.length > 0;
  }

  /** Add the light of every lit lamp at a point to `out` (for unlit models and the exposure). */
  addLamp(x, y, z, out) {
    for (const a of this.active) {
      _v.set(x - a.pos.x, y - a.pos.y, z - a.pos.z);
      const d = _v.length();
      if (d > LAMP_RANGE || d < 0.01) continue;
      const c = _v.dot(a.dir) / d;
      if (c < COS_OUT) continue;
      const edge = Math.min(1, (c - COS_OUT) / (COS_IN - COS_OUT));
      const k = (a.k * 1.6 * edge * edge) / (1 + d * d * 0.18);
      out[0] += LAMP_COLOR[0] * k;
      out[1] += LAMP_COLOR[1] * k;
      out[2] += LAMP_COLOR[2] * k;
    }
    return out;
  }

  frame(dt) {
    const g = this.game;
    const st = g.session?.state;
    this.active.length = 0;
    let n = 0;
    if (st) {
      for (const p of Object.values(st.players)) {
        if (!p.lamp || n >= MAX_LAMPS) continue;
        const lamp = st.items.find((i) => i.holder === p.pid && i.type === 'lamp');
        const charge = lamp?.charge ?? 0;
        // a weak battery browns the beam and makes it stutter
        let k = charge > 0.15 ? 1 : 0.35 + charge * 4;
        if (charge < 0.15 && Math.random() < 0.08) k *= 0.2;
        const l = this.lamps[n++];
        const pos = new THREE.Vector3();
        const dir = new THREE.Vector3();
        if (p.pid === g.pid) {
          const cam = g.camera;
          cam.getWorldDirection(dir);
          pos.copy(cam.position).addScaledVector(dir, 0.15);
          pos.y -= 0.18;
        } else {
          const cp = Math.cos(p.pitch || 0);
          dir.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch || 0), -Math.cos(p.yaw) * cp);
          pos.set(p.x, 1.35, p.z);
        }
        l.position.copy(pos);
        l.target.position.copy(pos).add(dir);
        l.intensity = 9 * k;
        this.active.push({ pos, dir, k });
      }
    }
    for (let k = n; k < MAX_LAMPS; k++) this.lamps[k].intensity = 0;
    this.updatePuffs(dt);
    this.updateTapes();
  }

  // ---- the extinguisher ----

  blast(e) {
    const g = this.game;
    const tex = puffTexture();
    const fx = -Math.sin(e.yaw) * Math.cos(e.pitch);
    const fy = Math.sin(e.pitch);
    const fz = -Math.cos(e.yaw) * Math.cos(e.pitch);
    g.world.lightAt(e.x, 1.2, e.z, _l);
    this.addLamp(e.x + fx, 1.2, e.z + fz, _l);
    const lum = Math.min(1, 0.2 + (_l[0] + _l[1] + _l[2]) * 0.6);
    // a jet of gas from the horn at hip height, spreading into a cloud that rolls on and settles
    for (let k = 0; k < 60; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.0, rotation: Math.random() * 6.28 }));
      s.material.color.setRGB(lum, lum, lum * 1.02);
      const sp = 3 + Math.random() * 7;
      const jx = (Math.random() - 0.5) * 0.8;
      const jy = (Math.random() - 0.5) * 0.45;
      const jz = (Math.random() - 0.5) * 0.8;
      s.position.set(e.x + fx * 0.8 + fz * 0.15, 1.0 + fy * 0.6, e.z + fz * 0.8 - fx * 0.15);
      s.scale.setScalar(0.1);
      g.scene.add(s);
      this.puffs.push({ s, vx: (fx + jx) * sp, vy: (fy + jy) * sp - 0.3, vz: (fz + jz) * sp, t: 0, life: 1.2 + Math.random() * 1.2, delay: k * 0.009, grow: 1.6 + Math.random() * 1.4 });
    }
  }

  updatePuffs(dt) {
    const g = this.game;
    for (const p of this.puffs) {
      if (p.delay > 0) {
        p.delay -= dt;
        continue;
      }
      p.t += dt;
      const drag = Math.exp(-dt * 3.2);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const a = p.t / p.life;
      p.s.scale.setScalar(0.15 + Math.sqrt(a) * p.grow);
      p.s.material.opacity = Math.max(0, Math.min(0.16, (1 - a) * 0.22) * Math.min(1, p.t * 10));
    }
    const done = this.puffs.filter((p) => p.t >= p.life);
    for (const p of done) {
      g.scene.remove(p.s);
      p.s.material.dispose();
    }
    if (done.length) this.puffs = this.puffs.filter((p) => p.t < p.life);
  }

  // ---- the foreman's recorder ----

  updateTapes() {
    const g = this.game;
    const st = g.session?.state;
    const a = g.audio;
    const playing = new Set();
    if (st && a.ready) {
      for (const it of st.items) {
        if (it.type !== 'recorder' || !(it.play > 0)) continue;
        playing.add(it.id);
        const h = it.holder ? st.players[it.holder] : null;
        const pos = h ? { x: h.x, y: 1.1, z: h.z } : { x: it.x, y: 0.3, z: it.z };
        let loop = this.tapes.get(it.id);
        if (!loop) {
          loop = a.loop('tape', pos, { ref: 2.5, level: 1, wet: 0.5 });
          if (loop) this.tapes.set(it.id, loop);
        }
        loop?.setPos(pos);
      }
    }
    for (const [id, loop] of this.tapes) {
      if (playing.has(id)) continue;
      loop.stop();
      this.tapes.delete(id);
    }
  }

  // ---- tags ----

  /** Hang (or keep) a valuation tag on an item's model. */
  tagFor(v, it) {
    if (!it.tag || v.tag) return;
    const s = tagSprite(it.value);
    s.position.set(0, (v.model.height || 0.2) + 0.13, 0);
    v.model.object.add(s);
    v.tag = s;
  }

  clear() {
    for (const p of this.puffs) {
      this.game.scene.remove(p.s);
      p.s.material.dispose();
    }
    this.puffs = [];
    for (const loop of this.tapes.values()) loop.stop();
    this.tapes.clear();
  }
}
