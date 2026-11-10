// All sound is synthesized with WebAudio: the fluorescent hum bed, HVAC, footsteps and
// positional one-shots. Nothing is loaded from files.

import { RNG } from '../core/rng.js';

const ROOM_IR = { large: 2.6, medium: 1.6, corridor: 1.9, small: 0.8 };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.rng = new RNG(1234);
    this.loops = new Set();
    this.volume = 0.9;
  }

  /** Must be called from a user gesture. */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    // reverb send
    this.verb = ctx.createConvolver();
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain).connect(this.master);
    this.roomType = null;
    this.setRoomType('large');

    this.noiseBuf = this._noiseBuffer(3);
    this.pinkBuf = this._pinkBuffer(4);
    this._buildBed();
    this.ready = true;
  }

  _noiseBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = this.rng.next() * 2 - 1;
    return b;
  }

  _pinkBuffer(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = this.rng.next() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return b;
  }

  setRoomType(type) {
    if (!this.ctx || type === this.roomType) return;
    this.roomType = type;
    const len = ROOM_IR[type] || 1.6;
    const sr = this.ctx.sampleRate;
    const b = this.ctx.createBuffer(2, Math.floor(sr * len), sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length;
        d[i] = (this.rng.next() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < sr * 0.004 ? 0 : 1);
      }
    }
    this.verb.buffer = b;
  }

  // ---- the bed: ballast hum + HVAC ---------------------------------------------------------

  _buildBed() {
    const ctx = this.ctx;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 900;
    humFilter.Q.value = 0.7;
    this.humFilter = humFilter;
    this.humOsc = [];
    const partials = [
      [60, 0.5, 'sine'],
      [120, 0.85, 'sine'],
      [180, 0.25, 'triangle'],
      [240, 0.3, 'sine'],
      [360, 0.12, 'sine'],
    ];
    for (const [f, g, type] of partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const gg = ctx.createGain();
      gg.gain.value = g * 0.05;
      o.connect(gg).connect(humFilter);
      o.start();
      this.humOsc.push({ o, base: f });
    }
    // buzz: a clipped 120 Hz sawtooth through a bandpass, the "angry" part of a bad ballast
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 120;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    shaper.curve = curve;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.4;
    this.buzzGain = ctx.createGain();
    this.buzzGain.gain.value = 0.004;
    buzz.connect(shaper).connect(bp).connect(this.buzzGain).connect(humFilter);
    buzz.start();
    this.humOsc.push({ o: buzz, base: 120 });
    humFilter.connect(this.humGain).connect(this.master);

    // HVAC: pink noise, low-passed, slowly breathing
    const hv = ctx.createBufferSource();
    hv.buffer = this.pinkBuf;
    hv.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    this.hvacGain = ctx.createGain();
    this.hvacGain.gain.value = 0.0;
    hv.connect(lp).connect(this.hvacGain).connect(this.master);
    hv.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();
  }

  /** Blend the bed toward a kind's sound settings. light: 0..1 how lit the spot is. */
  setBed({ base = 60, buzz = 0.3, level = 0.8, hvac = 0.5 } = {}, light = 1, dim = 1) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const humLevel = 0.26 * level * (0.35 + 0.65 * light) * dim;
    this.humGain.gain.setTargetAtTime(humLevel, t, 0.6);
    this.buzzGain.gain.setTargetAtTime(0.012 * buzz * dim, t, 0.6);
    this.hvacGain.gain.setTargetAtTime(0.11 * hvac, t, 1.2);
    for (const h of this.humOsc) h.o.frequency.setTargetAtTime((h.base * base) / 60, t, 0.8);
  }

  /** A crackle from a failing tube, intensity 0..1. */
  crackle(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3000 + this.rng.float(0, 3000);
    bp.Q.value = 2;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.06 * intensity, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + this.rng.float(0, 0.08));
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, this.rng.float(0, 2));
    src.stop(t + 0.2);
  }

  // ---- listener & positional plumbing -------------------------------------------------------

  setListener(x, y, z, yaw) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(0, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  /** An output chain at a position: returns { input, panner, filter, dispose }. */
  _spot(pos, { ref = 1.5, muffled = false, wet = 0.4 } = {}) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = muffled ? 900 : 16000;
    let out = filter;
    let panner = null;
    if (pos) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = ref;
      panner.rolloffFactor = 1.1;
      panner.maxDistance = 60;
      this._setPannerPos(panner, pos);
      filter.connect(panner);
      out = panner;
    }
    input.connect(filter);
    out.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = wet;
    out.connect(send).connect(this.verb);
    return { input, panner, filter };
  }

  _setPannerPos(p, pos) {
    const y = pos.y ?? 1.2;
    if (p.positionX) {
      p.positionX.value = pos.x;
      p.positionY.value = y;
      p.positionZ.value = pos.z;
    } else p.setPosition(pos.x, y, pos.z);
  }

  // ---- one-shots ----------------------------------------------------------------------------

  play(name, pos = null, opts = {}) {
    if (!this.ready) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    const spot = this._spot(pos, opts);
    fn(this, spot.input, this.ctx.currentTime + (opts.delay || 0), opts);
  }

  step(surface, run, crouch) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = (run ? 1.25 : crouch ? 0.45 : 0.85) * this.rng.float(0.8, 1.1);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (surface === 'hard') {
      f.type = 'bandpass';
      f.frequency.value = 1400 + this.rng.float(-200, 300);
      f.Q.value = 0.9;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
      // heel thump
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.12 * vol, t);
      og.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
      o.connect(og).connect(this.master);
      const s2 = ctx.createGain();
      s2.gain.value = 0.5;
      og.connect(s2).connect(this.verb);
      o.start(t);
      o.stop(t + 0.1);
    } else {
      f.type = 'lowpass';
      f.frequency.value = 520 + this.rng.float(-80, 120);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.32 * vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    }
    src.connect(f).connect(g).connect(this.master);
    const send = ctx.createGain();
    send.gain.value = surface === 'hard' ? 0.35 : 0.08;
    g.connect(send).connect(this.verb);
    src.start(t, this.rng.float(0, 2.5));
    src.stop(t + 0.25);
  }

  /** A looping positional source (TV static, a cart wheel...). */
  loop(name, pos, opts = {}) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const spot = this._spot(pos, opts);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(spot.input);
    const stopFns = LOOPS[name](this, gain, opts);
    const handle = {
      setPos: (p) => spot.panner && this._setPannerPos(spot.panner, p),
      setLevel: (v, tc = 0.3) => gain.gain.setTargetAtTime(v, ctx.currentTime, tc),
      setMuffled: (m) => spot.filter.frequency.setTargetAtTime(m ? 900 : 16000, ctx.currentTime, 0.2),
      stop: () => {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        setTimeout(() => stopFns.forEach((f) => f()), 600);
        this.loops.delete(handle);
      },
    };
    handle.setLevel(opts.level ?? 1, 0.4);
    this.loops.add(handle);
    return handle;
  }

  setMasterVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }
}

// ---- synth library ------------------------------------------------------------------------

function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(ae, out, t, f, type, peak, a, d) {
  const o = ae.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  const g = ae.ctx.createGain();
  env(g, t, a, peak, d);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + d + 0.05);
  return o;
}

function noiseBurst(ae, out, t, { type = 'bandpass', freq = 2000, q = 1, peak = 0.2, a = 0.005, d = 0.1 } = {}) {
  const ctx = ae.ctx;
  const src = ctx.createBufferSource();
  src.buffer = ae.noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, a, peak, d);
  src.connect(f).connect(g).connect(out);
  src.start(t, ae.rng.float(0, 2));
  src.stop(t + a + d + 0.05);
}

const SOUNDS = {
  deskBell(ae, out, t) {
    for (const [m, g, d] of [[1, 0.22, 2.4], [2.76, 0.1, 1.4], [5.4, 0.05, 0.8], [8.9, 0.02, 0.4]]) tone(ae, out, t, 1820 * m, 'sine', g, 0.002, d);
    noiseBurst(ae, out, t, { freq: 6000, peak: 0.08, d: 0.02 });
  },
  elevatorChime(ae, out, t) {
    tone(ae, out, t, 659, 'sine', 0.12, 0.01, 2.2);
    tone(ae, out, t, 1318, 'sine', 0.03, 0.01, 1.2);
    tone(ae, out, t + 0.55, 523, 'sine', 0.12, 0.01, 2.6);
    tone(ae, out, t + 0.55, 1046, 'sine', 0.03, 0.01, 1.4);
  },
  distantPhone(ae, out, t) {
    // two rings of an old bell phone
    for (let r = 0; r < 2; r++) {
      const t0 = t + r * 3.2;
      const ctx = ae.ctx;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
      g.gain.setValueAtTime(0.07, t0 + 1.6);
      g.gain.linearRampToValueAtTime(0, t0 + 1.7);
      const am = ctx.createGain();
      am.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 20;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      lfo.connect(lg).connect(am.gain);
      for (const f of [1046, 1560, 2350]) {
        const o = ctx.createOscillator();
        o.frequency.value = f;
        o.connect(am);
        o.start(t0);
        o.stop(t0 + 1.8);
      }
      lfo.start(t0);
      lfo.stop(t0 + 1.8);
      am.connect(g).connect(out);
    }
  },
  iceDrop(ae, out, t) {
    for (let k = 0; k < 9; k++) noiseBurst(ae, out, t + ae.rng.float(0, 0.5), { freq: ae.rng.float(2500, 5000), q: 4, peak: 0.12, d: 0.04 });
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 300, peak: 0.12, d: 0.3 });
  },
  knock(ae, out, t) {
    for (let k = 0; k < 3; k++) {
      noiseBurst(ae, out, t + k * 0.28, { type: 'lowpass', freq: 380, peak: 0.6, d: 0.12 });
      tone(ae, out, t + k * 0.28, 95, 'sine', 0.35, 0.002, 0.12);
    }
  },
  paper(ae, out, t) {
    for (let k = 0; k < 6; k++) noiseBurst(ae, out, t + k * 0.06 + ae.rng.float(0, 0.04), { freq: ae.rng.float(3000, 6000), q: 0.8, peak: 0.07, d: 0.08 });
  },
  click(ae, out, t) {
    noiseBurst(ae, out, t, { freq: 3500, q: 2, peak: 0.25, d: 0.015 });
    tone(ae, out, t, 900, 'square', 0.03, 0.001, 0.01);
  },
  doorClose(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 220, peak: 0.6, d: 0.35 });
    tone(ae, out, t, 70, 'sine', 0.4, 0.002, 0.3);
    noiseBurst(ae, out, t + 0.05, { freq: 2200, q: 3, peak: 0.08, d: 0.06 });
  },
  hvac() {},
  cartRattle(ae, out, t) {
    for (let k = 0; k < 5; k++) noiseBurst(ae, out, t + k * 0.09 + ae.rng.float(0, 0.03), { freq: ae.rng.float(1800, 4200), q: 6, peak: 0.08, d: 0.05 });
  },
  squeak(ae, out, t) {
    const o = ae.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1350, t);
    o.frequency.linearRampToValueAtTime(1620, t + 0.18);
    o.frequency.linearRampToValueAtTime(1410, t + 0.32);
    const g = ae.ctx.createGain();
    env(g, t, 0.03, 0.05, 0.3);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
  },
  whisper(ae, out, t) {
    // breathy formant noise: not words, just the shape of them
    for (let k = 0; k < 7; k++) noiseBurst(ae, out, t + k * 0.13 + ae.rng.float(0, 0.05), { freq: ae.rng.pick([900, 1300, 2200, 2700]), q: 5, peak: 0.07, a: 0.04, d: 0.12 });
  },
  sting(ae, out, t) {
    // not a sting: a low swell, the building leaning in
    const o = ae.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.linearRampToValueAtTime(52, t + 3);
    const f = ae.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 240;
    const g = ae.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 3.6);
  },
  checkIn(ae, out, t) {
    // the bell, reversed-feeling: soft attack, sudden stop
    for (const [m, gg] of [[1, 0.15], [2.76, 0.06]]) {
      const o = ae.ctx.createOscillator();
      o.frequency.value = 1820 * m;
      const g = ae.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gg, t + 1.6);
      g.gain.linearRampToValueAtTime(0, t + 1.62);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.7);
    }
  },
};

const LOOPS = {
  static(ae, out) {
    const ctx = ae.ctx;
    const src = ctx.createBufferSource();
    src.buffer = ae.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f).connect(g).connect(out);
    src.start();
    return [() => src.stop()];
  },
  muzak(ae, out) {
    // a warped, slow easy-listening phrase from a ceiling speaker
    const ctx = ae.ctx;
    const notes = [392, 440, 494, 440, 392, 330, 349, 392, 330, 294];
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const wob = ctx.createOscillator();
    wob.frequency.value = 0.3;
    const wg = ctx.createGain();
    wg.gain.value = 6;
    wob.connect(wg);
    wob.start();
    g.connect(f).connect(out);
    let stopped = false;
    let k = 0;
    const tick = () => {
      if (stopped) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = notes[k % notes.length] * 0.97;
      wg.connect(o.detune);
      const e = ctx.createGain();
      env(e, t, 0.08, 0.5, 0.9);
      o.connect(e).connect(g);
      o.start(t);
      o.stop(t + 1.1);
      k++;
      setTimeout(tick, 820);
    };
    tick();
    return [() => (stopped = true), () => wob.stop()];
  },
  wheel(ae, out) {
    // a cart wheel: rhythmic squeak and rattle
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const t = ae.ctx.currentTime;
      SOUNDS.squeak(ae, out, t);
      if (ae.rng.chance(0.6)) SOUNDS.cartRattle(ae, out, t + 0.2);
      setTimeout(tick, 640 + ae.rng.float(-60, 60));
    };
    tick();
    return [() => (stopped = true)];
  },
  breath(ae, out) {
    const ctx = ae.ctx;
    const src = ctx.createBufferSource();
    src.buffer = ae.pinkBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.22;
    const lg = ctx.createGain();
    lg.gain.value = 0.12;
    lfo.connect(lg).connect(g.gain);
    src.connect(f).connect(g).connect(out);
    src.start();
    lfo.start();
    return [() => src.stop(), () => lfo.stop()];
  },
};
