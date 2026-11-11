// All sound is synthesized with WebAudio: the fluorescent hum bed, HVAC, footsteps and
// positional one-shots. Nothing is loaded from files.

import { RNG } from '../core/rng.js';

// reverb tail length per room type; outdoors is a short slap off the facade and the hoarding
const ROOM_IR = { large: 2.6, medium: 1.6, corridor: 1.9, small: 0.45, outdoor: 0.9 };

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
    const outdoor = type === 'outdoor';
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const t = i / d.length;
        // outdoors: sparse echoes instead of a dense tail
        const sparse = outdoor ? (this.rng.next() < 0.02 ? 3 : 0.15) : 1;
        d[i] = (this.rng.next() * 2 - 1) * Math.pow(1 - t, outdoor ? 5 : 3.2) * sparse * (i < sr * (outdoor ? 0.03 : 0.004) ? 0 : 1);
      }
    }
    this.verb.buffer = b;
    this.verbGain.gain.setTargetAtTime(outdoor ? 0.2 : type === 'small' ? 0.25 : 0.35, this.ctx.currentTime, 0.3);
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

  step(surface, run, crouch, heavy = false) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = (run ? 1.25 : crouch ? 0.45 : 0.85) * (heavy ? 1.2 : 1) * this.rng.float(0.8, 1.1);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (surface === 'metal') {
      // diamond plate and grating: a ringing clank under the boot
      f.type = 'bandpass';
      f.frequency.value = 2300 + this.rng.float(-300, 300);
      f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.14 * vol, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
      for (const fr of [410, 1130]) {
        const o = ctx.createOscillator();
        o.frequency.value = fr * this.rng.float(0.97, 1.03);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.025 * vol, t);
        og.gain.exponentialRampToValueAtTime(0.0003, t + 0.22);
        o.connect(og).connect(this.master);
        o.start(t);
        o.stop(t + 0.25);
      }
    } else if (surface === 'hard') {
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
    send.gain.value = surface === 'soft' ? 0.08 : 0.35;
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

function sweep(ae, out, t, f0, f1, dur, type = 'sine', peak = 0.1, a = 0.01) {
  const o = ae.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ae.ctx.createGain();
  env(g, t, a, peak, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + a + dur + 0.05);
  return o;
}

const SOUNDS = {
  // ---- the work ----
  click(ae, out, t) {
    noiseBurst(ae, out, t, { freq: 3500, q: 2, peak: 0.25, d: 0.015 });
    tone(ae, out, t, 900, 'square', 0.03, 0.001, 0.01);
  },
  paper(ae, out, t) {
    for (let k = 0; k < 6; k++) noiseBurst(ae, out, t + k * 0.06 + ae.rng.float(0, 0.04), { freq: ae.rng.float(3000, 6000), q: 0.8, peak: 0.07, d: 0.08 });
  },
  take(ae, out, t) {
    // a scuff and a grunt of effort: cloth on metal
    noiseBurst(ae, out, t, { freq: 1800, q: 0.7, peak: 0.14, a: 0.01, d: 0.12 });
    noiseBurst(ae, out, t + 0.05, { type: 'lowpass', freq: 400, peak: 0.12, d: 0.08 });
  },
  footfall(ae, out, t, opts = {}) {
    // another receiver's boot: a heel strike and a scuff (crew in co-op)
    const k = opts.soft ? 0.4 : 1;
    noiseBurst(ae, out, t, { freq: ae.rng.float(1100, 1600), q: 0.9, peak: 0.12 * k, d: 0.06 });
    noiseBurst(ae, out, t + 0.012, { type: 'lowpass', freq: 300, peak: 0.1 * k, d: 0.05 });
  },
  setDown(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 900, peak: 0.22, d: 0.07 });
    tone(ae, out, t, 210, 'sine', 0.08, 0.002, 0.08);
  },
  thud(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 260, peak: 0.6, d: 0.22 });
    tone(ae, out, t, 62, 'sine', 0.45, 0.002, 0.25);
    noiseBurst(ae, out, t + 0.01, { freq: 2600, q: 4, peak: 0.06, d: 0.12 });
  },
  smash(ae, out, t) {
    // glass: a crack, a shower of bright ticks
    noiseBurst(ae, out, t, { freq: 4800, q: 1, peak: 0.4, d: 0.05 });
    for (let k = 0; k < 14; k++) noiseBurst(ae, out, t + 0.02 + ae.rng.float(0, 0.5), { freq: ae.rng.float(3500, 8000), q: 8, peak: ae.rng.float(0.04, 0.12), d: 0.04 });
    tone(ae, out, t + 0.01, 2400, 'sine', 0.05, 0.001, 0.4);
  },
  chute(ae, out, t) {
    // the night safe's drum: a hinge, a long metal slide, a heavy drop into the strongroom
    sweep(ae, out, t, 420, 300, 0.25, 'sawtooth', 0.03);
    noiseBurst(ae, out, t + 0.15, { freq: 1300, q: 1.2, peak: 0.12, a: 0.08, d: 0.55 });
    noiseBurst(ae, out, t + 0.75, { type: 'lowpass', freq: 220, peak: 0.7, d: 0.3 });
    tone(ae, out, t + 0.75, 55, 'sine', 0.4, 0.002, 0.35);
    noiseBurst(ae, out, t + 0.76, { freq: 3100, q: 5, peak: 0.08, d: 0.2 });
  },
  appraise(ae, out, t) {
    // the appraisal bell: two struck notes from the strongroom, a ticket chattering out
    for (const [f, dt] of [[1318, 0], [1975, 0.16]]) for (const [m, g, d] of [[1, 0.12, 1.4], [2.4, 0.04, 0.6]]) tone(ae, out, t + dt, f * m, 'sine', g, 0.002, d);
    for (let k = 0; k < 10; k++) noiseBurst(ae, out, t + 0.45 + k * 0.035, { freq: 2600, q: 3, peak: 0.05, d: 0.02 });
  },
  lever(ae, out, t) {
    sweep(ae, out, t, 180, 90, 0.3, 'sawtooth', 0.05, 0.02);
    noiseBurst(ae, out, t + 0.28, { type: 'lowpass', freq: 500, peak: 0.4, d: 0.1 });
    noiseBurst(ae, out, t + 0.29, { freq: 3800, q: 4, peak: 0.1, d: 0.03 });
  },
  doorUnlock(ae, out, t) {
    // the time-lock lets go: three bolts withdraw, then the door rolls aside
    for (let k = 0; k < 3; k++) {
      noiseBurst(ae, out, t + k * 0.18, { type: 'lowpass', freq: 600, peak: 0.45, d: 0.08 });
      noiseBurst(ae, out, t + k * 0.18, { freq: 3000, q: 5, peak: 0.06, d: 0.03 });
    }
    noiseBurst(ae, out, t + 0.7, { freq: 700, q: 0.8, peak: 0.12, a: 0.1, d: 0.9 });
    noiseBurst(ae, out, t + 1.7, { type: 'lowpass', freq: 300, peak: 0.5, d: 0.2 });
  },
  horn(ae, out, t) {
    // the Strongbox's air horn: two flat blasts, the second longer
    for (const [t0, d] of [[0, 0.7], [1.0, 1.6]]) {
      for (const f of [233, 277, 349]) {
        const o = ae.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const fl = ae.ctx.createBiquadFilter();
        fl.type = 'lowpass';
        fl.frequency.value = 1400;
        const g = ae.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + t0);
        g.gain.linearRampToValueAtTime(0.06, t + t0 + 0.05);
        g.gain.setValueAtTime(0.06, t + t0 + d);
        g.gain.linearRampToValueAtTime(0.0001, t + t0 + d + 0.15);
        o.connect(fl).connect(g).connect(out);
        o.start(t + t0);
        o.stop(t + t0 + d + 0.2);
      }
    }
  },
  engine(ae, out, t) {
    // a diesel turning over and pulling away, heard from inside the box
    const o = ae.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(28, t);
    o.frequency.linearRampToValueAtTime(42, t + 1.2);
    o.frequency.linearRampToValueAtTime(36, t + 3.5);
    const f = ae.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    const g = ae.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.6);
    g.gain.setValueAtTime(0.35, t + 2.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.0);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 4.1);
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 160, peak: 0.25, a: 0.4, d: 3.4 });
  },
  breaker(ae, out, t) {
    // somewhere a breaker trips: a flat bang and the hum under it dropping away
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 700, peak: 0.6, d: 0.12 });
    sweep(ae, out, t + 0.02, 100, 40, 1.4, 'sawtooth', 0.06);
  },
  tubePop(ae, out, t) {
    // a fluorescent tube giving out: a hard tick, a glassy ping, the ballast buzz dying away
    noiseBurst(ae, out, t, { freq: 4200, q: 1.5, peak: 0.32, d: 0.02 });
    tone(ae, out, t + 0.004, 2900 + ae.rng.float(-300, 300), 'sine', 0.03, 0.001, 0.25);
    const o = ae.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.6);
    const f = ae.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    const g = ae.ctx.createGain();
    env(g, t + 0.01, 0.01, 0.05, 0.6);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.7);
  },
  sting(ae, out, t) {
    // a low swell: the building leaning in
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

  // ---- what is in the building with you ----
  tally(ae, out, t) {
    // a brass hand tally pressed once: the plunger's clack and the number wheel's tick
    noiseBurst(ae, out, t, { freq: 2400, q: 4, peak: 0.32, d: 0.025 });
    noiseBurst(ae, out, t + 0.035, { freq: 5200, q: 7, peak: 0.18, d: 0.012 });
    tone(ae, out, t + 0.002, 3150, 'sine', 0.035, 0.001, 0.12);
  },
  tallyShort(ae, out, t) {
    // the count does not come out: the reset knob spun hard, the wheels whirring back to nought
    for (let k = 0; k < 14; k++) noiseBurst(ae, out, t + k * 0.028, { freq: 4600 - k * 90, q: 6, peak: 0.1, d: 0.012 });
    tone(ae, out, t + 0.45, 210, 'square', 0.035, 0.005, 0.5);
    tone(ae, out, t + 0.45, 222, 'square', 0.03, 0.005, 0.5);
  },
  lockOn(ae, out, t) {
    // the listening horn finds you: a tuning-fork note bent sharply upward, wavering
    const o = ae.ctx.createOscillator();
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(1900, t + 0.9);
    const vib = ae.ctx.createOscillator();
    vib.frequency.value = 9;
    const vg = ae.ctx.createGain();
    vg.gain.value = 22;
    vib.connect(vg).connect(o.frequency);
    const g = ae.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.25);
    g.gain.setValueAtTime(0.16, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(g).connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + 1.35);
    vib.stop(t + 1.35);
  },
  signalLost(ae, out, t) {
    // the helmet feed dropping: a burst of hash, then the transmitter's line-up tone
    noiseBurst(ae, out, t, { freq: 2600, q: 0.4, peak: 0.55, a: 0.003, d: 0.9 });
    tone(ae, out, t + 0.85, 1000, 'sine', 0.07, 0.01, 2.6);
  },
  blast(ae, out, t) {
    // a CO2 discharge: a hard, cold roar of gas through the horn
    noiseBurst(ae, out, t, { type: 'highpass', freq: 900, q: 0.5, peak: 0.7, a: 0.01, d: 1.1 });
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 300, peak: 0.35, a: 0.005, d: 0.5 });
  },
  beep(ae, out, t, opts = {}) {
    // the tag gun: a beep and the printer's chatter
    tone(ae, out, t, opts.low ? 620 : 2100, 'square', 0.045, 0.002, 0.09);
    if (!opts.low) for (let k = 0; k < 7; k++) noiseBurst(ae, out, t + 0.12 + k * 0.03, { freq: 3800, q: 4, peak: 0.08, d: 0.015 });
  },
  lampOut(ae, out, t) {
    tone(ae, out, t, 180, 'sine', 0.03, 0.005, 0.3);
    noiseBurst(ae, out, t, { freq: 3000, q: 2, peak: 0.15, d: 0.02 });
  },
  restock(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 700, peak: 0.25, d: 0.09 });
  },

  // ---- ambience: the building settling, far off ----
  drip(ae, out, t) {
    sweep(ae, out, t, 1400 + ae.rng.float(0, 600), 2600, 0.05, 'sine', 0.05, 0.002);
  },
  ventTick(ae, out, t) {
    for (let k = 0; k < 3; k++) noiseBurst(ae, out, t + k * ae.rng.float(0.2, 0.5), { freq: 2200, q: 6, peak: 0.07, d: 0.02 });
  },
  rackCreak(ae, out, t) {
    sweep(ae, out, t, 160, 120, 1.2, 'sawtooth', 0.025, 0.3);
    noiseBurst(ae, out, t + 1.1, { type: 'lowpass', freq: 400, peak: 0.2, d: 0.1 });
  },
  compressor(ae, out, t) {
    // a refrigeration compressor cutting in, running a few seconds, cutting out
    const o = ae.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 49;
    const f = ae.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    const g = ae.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.4);
    g.gain.setValueAtTime(0.08, t + 4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + 5.1);
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 500, peak: 0.25, d: 0.1 });
  },
  iceTick(ae, out, t) {
    for (let k = 0; k < 4; k++) noiseBurst(ae, out, t + ae.rng.float(0, 1.2), { freq: ae.rng.float(4000, 7000), q: 9, peak: 0.05, d: 0.015 });
  },
  paperSlide(ae, out, t) {
    noiseBurst(ae, out, t, { freq: 4200, q: 0.6, peak: 0.06, a: 0.2, d: 0.6 });
    noiseBurst(ae, out, t + 0.8, { type: 'lowpass', freq: 600, peak: 0.12, d: 0.08 });
  },
  crankTurn(ae, out, t) {
    // a mobile shelving bay's wheel turned by someone, a few clicks and a heavy roll
    for (let k = 0; k < 5; k++) noiseBurst(ae, out, t + k * 0.22, { freq: 2600, q: 5, peak: 0.05, d: 0.02 });
    noiseBurst(ae, out, t + 0.3, { type: 'lowpass', freq: 200, peak: 0.25, a: 0.2, d: 0.9 });
  },
  typeKey(ae, out, t) {
    // one typewriter key, struck, and then nothing
    noiseBurst(ae, out, t, { freq: 2800, q: 3, peak: 0.2, d: 0.03 });
    noiseBurst(ae, out, t + 0.012, { type: 'lowpass', freq: 500, peak: 0.12, d: 0.04 });
  },
  phoneFar(ae, out, t) {
    // an internal phone: a single electronic warble, twice
    for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) tone(ae, out, t + r * 1.4 + k * 0.05, k % 2 ? 1180 : 940, 'square', 0.012, 0.002, 0.045);
  },
  lockerBang(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 900, peak: 0.4, d: 0.15 });
    noiseBurst(ae, out, t, { freq: 1900, q: 6, peak: 0.12, d: 0.5 });
    tone(ae, out, t, 340, 'sine', 0.06, 0.001, 0.4);
  },
  pipeKnock(ae, out, t) {
    for (let k = 0; k < 3; k++) {
      noiseBurst(ae, out, t + k * 0.33, { type: 'lowpass', freq: 600, peak: 0.3, d: 0.06 });
      tone(ae, out, t + k * 0.33, 520 + k * 15, 'sine', 0.05, 0.001, 0.6);
    }
  },
  bottleClink(ae, out, t) {
    for (let k = 0; k < 4; k++) tone(ae, out, t + k * ae.rng.float(0.08, 0.2), ae.rng.float(2600, 3600), 'sine', 0.04, 0.001, 0.3);
  },
  shutterRattle(ae, out, t) {
    for (let k = 0; k < 12; k++) noiseBurst(ae, out, t + k * 0.05 + ae.rng.float(0, 0.02), { freq: ae.rng.float(600, 1400), q: 3, peak: 0.08, d: 0.04 });
  },
  dogFar(ae, out, t) {
    // a dog a long way off: two short barks
    for (let k = 0; k < 2; k++) {
      sweep(ae, out, t + k * 0.42, 520, 330, 0.14, 'sawtooth', 0.04, 0.01);
      noiseBurst(ae, out, t + k * 0.42, { freq: 900, q: 2, peak: 0.05, d: 0.12 });
    }
  },
  traffic(ae, out, t) {
    noiseBurst(ae, out, t, { type: 'lowpass', freq: 350, peak: 0.1, a: 2.2, d: 3.5 });
  },
  windGust(ae, out, t) {
    noiseBurst(ae, out, t, { freq: 500, q: 0.6, peak: 0.08, a: 1.4, d: 2.4 });
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
  hush(ae, out) {
    // the sound of a room with its lights out: pressure, a slow sub-tone, no hum at all
    const ctx = ae.ctx;
    const src = ctx.createBufferSource();
    src.buffer = ae.pinkBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    const o = ctx.createOscillator();
    o.frequency.value = 36;
    const og = ctx.createGain();
    og.gain.value = 0.1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = ctx.createGain();
    lg.gain.value = 0.06;
    lfo.connect(lg).connect(og.gain);
    src.connect(f).connect(g).connect(out);
    o.connect(og).connect(out);
    src.start();
    o.start();
    lfo.start();
    return [() => src.stop(), () => o.stop(), () => lfo.stop()];
  },
  drone(ae, out) {
    // the Hushwarden's tell: a struck tuning fork that never decays, two near notes beating
    const ctx = ae.ctx;
    const stops = [];
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.31;
    const lg = ctx.createGain();
    lg.gain.value = 0.018;
    lfo.connect(lg).connect(g.gain);
    for (const [f, a] of [[293.7, 1], [296.1, 0.8], [881, 0.18]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start();
      stops.push(() => o.stop());
    }
    g.connect(out);
    lfo.start();
    stops.push(() => lfo.stop());
    return stops;
  },
  whistle(ae, out) {
    // the Plus-One's tell: someone whistling a little tune to themselves, never quite the same
    const ctx = ae.ctx;
    const o = ctx.createOscillator();
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.value = 9;
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    const breath = ctx.createBufferSource();
    breath.buffer = ae.noiseBuf;
    breath.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = 1500;
    bf.Q.value = 2;
    const bg = ctx.createGain();
    bg.gain.value = 0.08;
    breath.connect(bf).connect(bg).connect(g);
    o.connect(g).connect(out);
    o.start();
    vib.start();
    breath.start();
    // a phrase every few seconds: notes from a five-note scale, some slurred
    const scale = [0, 2, 5, 7, 9, 12, 14];
    let at = ctx.currentTime + 0.3;
    const plan = () => {
      while (at < ctx.currentTime + 4) {
        const n = 4 + Math.floor(ae.rng.float(0, 4));
        let deg = Math.floor(ae.rng.float(1, 5));
        for (let k = 0; k < n; k++) {
          deg = Math.max(0, Math.min(scale.length - 1, deg + Math.floor(ae.rng.float(-2, 3))));
          const f = 1046 * 2 ** (scale[deg] / 12);
          const len = ae.rng.float(0, 1) < 0.25 ? 0.5 : 0.24;
          o.frequency.setTargetAtTime(f, at, 0.025);
          g.gain.setTargetAtTime(0.09, at, 0.02);
          g.gain.setTargetAtTime(ae.rng.float(0, 1) < 0.5 ? 0.0 : 0.04, at + len * 0.8, 0.03);
          at += len;
        }
        g.gain.setTargetAtTime(0, at, 0.05);
        at += ae.rng.float(1.2, 3.2);
      }
    };
    plan();
    const timer = setInterval(plan, 1000);
    return [() => clearInterval(timer), () => o.stop(), () => vib.stop(), () => breath.stop()];
  },
  tape(ae, out) {
    // the foreman's tape: hiss, a man's voice murmuring an inventory (too worn to make out), and
    // footsteps on concrete, recorded somewhere with a lot of echo
    const ctx = ae.ctx;
    const hiss = ctx.createBufferSource();
    hiss.buffer = ae.noiseBuf;
    hiss.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 4000;
    const hg = ctx.createGain();
    hg.gain.value = 0.025;
    hiss.connect(hf).connect(hg).connect(out);
    // the voice: band-limited noise shaped by a syllable rhythm, over a low buzz
    const voice = ctx.createBufferSource();
    voice.buffer = ae.pinkBuf;
    voice.loop = true;
    const vf = ctx.createBiquadFilter();
    vf.type = 'bandpass';
    vf.frequency.value = 520;
    vf.Q.value = 2.5;
    const vg = ctx.createGain();
    vg.gain.value = 0;
    const buzz = ctx.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.value = 108;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 700;
    buzz.connect(bf).connect(vg);
    voice.connect(vf).connect(vg);
    vg.connect(out);
    hiss.start();
    voice.start();
    buzz.start();
    let at = ctx.currentTime + 0.1;
    const plan = () => {
      while (at < ctx.currentTime + 3) {
        const words = 3 + Math.floor(ae.rng.float(0, 5));
        for (let k = 0; k < words; k++) {
          const syl = 1 + Math.floor(ae.rng.float(0, 3));
          for (let j = 0; j < syl; j++) {
            vg.gain.setTargetAtTime(0.16, at, 0.015);
            buzz.frequency.setTargetAtTime(100 + ae.rng.float(0, 30), at, 0.03);
            vf.frequency.setTargetAtTime(380 + ae.rng.float(0, 500), at, 0.02);
            at += ae.rng.float(0.09, 0.16);
            vg.gain.setTargetAtTime(0.02, at, 0.02);
            at += 0.03;
          }
          at += ae.rng.float(0.08, 0.2);
        }
        // a pause, with footsteps in it
        const pause = ae.rng.float(0.8, 1.8);
        for (let s = 0.2; s < pause; s += 0.55) noiseBurst(ae, out, at + s, { freq: 1300, q: 1, peak: 0.12, d: 0.08 });
        at += pause;
      }
    };
    plan();
    const timer = setInterval(plan, 800);
    return [() => clearInterval(timer), () => hiss.stop(), () => voice.stop(), () => buzz.stop()];
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
