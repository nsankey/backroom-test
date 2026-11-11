// Game: owns the renderer, the world, the local player and the presentation. The contract's
// rules live in Session (host-authoritative, plain state); this class turns input into intents,
// moves the local player on a fixed 60 Hz tick, loads sites, and draws.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { RNG, hash } from '../core/rng.js';
import { Input } from '../core/input.js';
import { AudioEngine } from '../audio/audio.js';
import { MaterialLibrary } from '../render/materials.js';
import { HelmetCamShader } from '../render/helmetcam.js';
import { World } from '../world/world.js';
import { CELL } from '../world/constants.js';
import { SITES } from '../world/site.js';
import { VAN } from '../world/kinds/yard.js';
import { createPlayer, applyLook, stepPlayer } from './player.js';
import { flickerLevel } from './flicker.js';
import { Moments } from './moments.js';
import { Ambience } from './ambience.js';
import { TICK, TICK_HZ } from './constants.js';
import { Session, inVan, REACH } from './session.js';
import { ITEMS, SLOTS, carriedKg, isLoot, fmtH } from './items.js';
import { spawnLoot } from './loot.js';
import { facilityPower, bankTripMin, fmtClock, shiftMinutes, ticksAt, LAST_CALL_MIN } from './clock.js';
import { Views } from './views.js';

export const LOCAL = 'p1';

export class Game {
  constructor({ canvas, ui, save, debug = false }) {
    this.canvas = canvas;
    this.ui = ui;
    this.save = save;
    this.debug = debug;
    this.tick = 0;
    this.time = 0;
    this.paused = true;
    this.listeners = new Set(); // per-frame/tick systems: { tick?(game, actions, events), frame?(game, dt) }
    this.session = null;
    this.pid = LOCAL;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.quality = 0.8;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x06080a);
    scene.fog = new THREE.FogExp2(0x07090b, 0.048);
    const camera = (this.camera = new THREE.PerspectiveCamera(78, 16 / 9, 0.05, 90));
    scene.add(camera);
    this.sky = skyDome();
    scene.add(this.sky);

    this.mats = new MaterialLibrary(renderer);
    this.world = new World(scene, this.mats);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.moments = new Moments(this);
    this.momentRng = new RNG(1);
    this.listeners.add(new Ambience(this));
    this.views = new Views(this);
    this.world.onCellRemoved = (cell) => this.visited?.delete(cell.key);
    this.fade = 0;
    this.fadeTarget = 1;
    this.exposure = { v: 1.4, vel: 0 };
    this.travel = null; // { stage, t } while the Strongbox drives
    this.onUiAction = null; // (name, arg) => void, set by main
    this.visited = new Set(); // cell keys walked tonight (for the site plan)
    this.tripped = new Set(); // cells whose bank has tripped tonight

    // post: render -> bloom -> tonemap/sRGB -> helmet cam
    const composer = (this.composer = new EffectComposer(renderer));
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.22, 0.3, 0.92);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.cam = new ShaderPass(HelmetCamShader);
    composer.addPass(this.cam);

    this.player = createPlayer(VAN.door.x, 10, 0);
    this.prev = { x: this.player.x, z: this.player.z, eye: this.player.eye, bob: 0 };
    this.currentCell = null;
    this.nearInteraction = null;
    this.fps = { frames: 0, t: 0, value: 0, worst: 0 };

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 1.5) * this.quality;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cam.uniforms.uRes.value.set(w * pr, h * pr);
  }

  async boot(onProgress = () => {}) {
    onProgress('warming the sensor');
    await this.mats.loadAll();
    this.ensureLoop();
  }

  /** Take up a contract (new or saved) and stand in the van for the night's brief. */
  async startContract(run, onProgress = () => {}) {
    this.session = new Session(run, { solo: true });
    this.session.addPlayer(this.pid, crewId(run.seed));
    await this.loadBrief(onProgress);
  }

  /** Load the yard (and the writ's building behind its locked door) and stand at the bench. */
  async loadBrief(onProgress = () => {}) {
    const run = this.session.state.run;
    this.views.clear();
    onProgress('parking up');
    await this.loadSite({ worldSeed: run.seed, siteId: run.siteId, night: run.night }, (d, n) => onProgress(`surveying ${d}/${n}`));
    this.placeAtSpawn();
    this.fadeTarget = 1;
  }

  async loadSite(site, onProgress) {
    const pump = setInterval(() => this.world.update(40), 16);
    try {
      await this.world.setSite(site, onProgress);
    } finally {
      clearInterval(pump);
    }
    this.visited.clear();
    this.tripped.clear();
    this.renderer.compile(this.scene, this.camera);
  }

  placeAtSpawn() {
    const yard = this.world.cells.get('0,0');
    const sp = yard.points.spawn;
    const p = this.player;
    p.x = sp.x;
    p.z = sp.z;
    p.yaw = Math.PI; // facing the rear door
    p.pitch = -0.05;
    p.vx = p.vz = 0;
    this.prev = { x: p.x, z: p.z, eye: p.eye, bob: p.bob };
    this.session.updatePlayer(this.pid, p);
  }

  ensureLoop() {
    if (this._looping) return;
    this._looping = true;
    this.last = performance.now();
    const frame = (now) => {
      this.frame(now);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  start() {
    this.paused = false;
    this.debugFreeze(false);
    this.audio.init();
    this.input.clear();
  }

  pause() {
    this.paused = true;
    this.input.clear();
  }

  // ---- helpers for views and HUD ----------------------------------------------------------------

  localPlayer() {
    return this.session.state.players[this.pid];
  }
  localHeld() {
    return this.session ? this.session.carried(this.pid) : [];
  }
  carriedKg() {
    return this.session ? carriedKg(this.session.state.items, this.pid) : 0;
  }
  get minutes() {
    return this.session ? shiftMinutes(this.session.state.shiftTick) : 0;
  }

  // ---- simulation tick ------------------------------------------------------------------------

  simTick() {
    this.tick++;
    const s = this.session;
    const p = this.player;
    const actions = this.input.takeActions();
    const frozen = !s || this.travel || s.phase === 'report' || s.phase === 'over';
    if (frozen) {
      actions.moveX = actions.moveZ = 0;
      actions.run = false;
      actions.interact = actions.drop = false;
    }
    const events = [];
    this.prev.x = p.x;
    this.prev.z = p.z;
    this.prev.eye = p.eye;
    this.prev.bob = p.bob;
    stepPlayer(p, actions, this.world, TICK, events, this.carriedKg());
    if (!s) return;
    s.updatePlayer(this.pid, p);

    // slots, take, drop, interact: all become intents
    const me = this.localPlayer();
    if (actions.slot >= 0) s.applyIntent(this.pid, { type: 'slot', slot: actions.slot });
    if (actions.cycle) s.applyIntent(this.pid, { type: 'slot', slot: (me.active + actions.cycle + SLOTS) % SLOTS });
    this.nearInteraction = frozen ? null : this.findInteraction();
    if (actions.interact && this.nearInteraction) this.interact(this.nearInteraction);
    if (actions.drop) this.dropActive();
    if (actions.map) this.onUiAction?.('map');

    // the session's own clock, alarms and departure
    s.tick();
    for (const e of s.drain()) this.onSessionEvent(e);

    // current place
    const cell = this.world.cellAt(p.x, p.z);
    if (cell !== this.currentCell) this.enterCell(cell);

    this.updateLights();
    this.moments.update(this.tick);
    for (const sys of this.listeners) sys.tick?.(this, actions, events);
    for (const e of events) this.handleEvent(e);
    this.updateTravel();
  }

  /** Brownout and flicker for every cell, from the shift clock (the same on every client). */
  updateLights() {
    const s = this.session;
    const night = s.phase === 'night';
    const min = this.minutes;
    const power = night ? facilityPower(min) : 1;
    const siteSeed = this.world.layout?.seed || 0;
    for (const c of this.world.cells.values()) {
      const own = c.kind.power === 'own';
      let fl = flickerLevel(c.seed, this.tick);
      if (!own && night) {
        const trip = bankTripMin(siteSeed, c.cx, c.cz);
        if (min >= trip) {
          fl = 0;
          if (!this.tripped.has(c.key)) {
            this.tripped.add(c.key);
            if (this.currentCell === c || this.dist2Cell(c) < 20 * 20) {
              this.audio.play('breaker', { x: c.ox + 8, y: 3, z: c.oz + 8 }, { wet: 0.6 });
              this.audio.play('tubePop', { x: this.player.x + 3, y: 3, z: this.player.z - 2 }, { wet: 0.5 });
            }
          }
        } else if (min >= trip - 8) fl = Math.min(fl, (this.tick >> 2) % 3 === 0 ? 0.1 : 0.8); // stuttering before it goes
      }
      c.uniforms.uFlicker.value = fl;
      c.uniforms.uDim.value = own ? 1 : power;
    }
  }

  dist2Cell(c) {
    const p = this.player;
    const nx = Math.max(c.ox, Math.min(p.x, c.ox + CELL));
    const nz = Math.max(c.oz, Math.min(p.z, c.oz + CELL));
    return (nx - p.x) ** 2 + (nz - p.z) ** 2;
  }

  onSessionEvent(e) {
    const s = this.session;
    const mine = e.pid === undefined || e.pid === this.pid;
    const pos = e.x !== undefined ? { x: e.x, y: e.y ?? 1, z: e.z } : null;
    switch (e.type) {
      case 'take':
        this.audio.play('take', pos);
        if (mine) this.ui.caption(`${ITEMS[e.itemType].name}`, 1.6);
        break;
      case 'full':
        if (mine) this.ui.caption(e.need > 1 ? 'Both hands needed. Put something down (G).' : 'Hands full. Put something down (G).', 2.4);
        break;
      case 'drop':
        this.audio.play(e.broke ? 'smash' : e.kg > 6 ? 'thud' : 'setDown', pos);
        if (mine && e.broke) this.ui.caption('Something gave. That cost you. (Crouch to set fragile things down.)', 3.5);
        break;
      case 'deposit':
        this.audio.play('chute', { x: VAN.door.x, y: 1, z: 12.2 });
        this.audio.play('appraise', { x: VAN.door.x, y: 1.2, z: 12.3 }, { delay: 1.1 });
        if (mine) setTimeout(() => this.ui.caption(`Banked ${e.n} item${e.n > 1 ? 's' : ''}: ${fmtH(e.total)}. Ledger ${fmtH(s.state.run.ledger)}.`, 3.5), 1100);
        break;
      case 'chuteEmpty':
        if (mine) this.ui.caption('The night safe takes salvage. Bring something back.', 2.5);
        break;
      case 'leverArmed':
        this.audio.play('lever', { x: 11.3, y: 1.3, z: 11.85 });
        if (mine) this.ui.caption(e.outside ? `Pull again to leave. ${e.outside} of the crew still outside.` : 'Pull again to leave now.', 4);
        break;
      case 'leverReset':
        break;
      case 'travel':
        this.beginTravel();
        break;
      case 'doorOpen':
        this.audio.play('doorUnlock', { x: VAN.door.x, y: 1.2, z: VAN.door.z + 0.3 });
        break;
      case 'lastCall':
        this.audio.play('horn', { x: VAN.door.x, y: 2.5, z: 14 });
        this.ui.caption('03:00. LAST CALL. The Strongbox leaves at 04:00. Overtime is charged from now.', 6);
        break;
      case 'depart':
        this.beginDeparture(e);
        break;
      case 'writ':
        this.audio.play('click');
        break;
    }
  }

  // ---- travel (brief -> night) and departure (night -> report) ---------------------------------

  beginTravel() {
    this.travel = { stage: 'out', t: 0 };
    this.fadeTarget = 0;
    this.audio.play('lever', { x: 11.3, y: 1.3, z: 11.85 });
    this.audio.play('engine', null, { wet: 0.1 });
  }

  async updateTravel() {
    const tr = this.travel;
    if (!tr) return;
    tr.t++;
    if (tr.stage === 'out' && tr.t > 50) {
      tr.stage = 'loading';
      const run = this.session.state.run;
      const site = { worldSeed: run.seed, siteId: run.siteId, night: run.night };
      this.onUiAction?.('travel', { site: SITES[site.siteId], night: run.night });
      await this.loadSite(site, (d, n) => this.ui.travelProgress?.(d, n));
      const cells = [...this.world.cells.values()].map((c) => ({ cx: c.cx, cz: c.cz, kindId: c.kindId, lootSpots: c.lootSpots }));
      this.session.beginNight(site, spawnLoot(site, cells));
      for (const e of this.session.drain()) this.onSessionEvent(e);
      this.placeAtSpawn();
      tr.stage = 'in';
      tr.t = 0;
      this.onUiAction?.('travelDone');
      this.fadeTarget = 1;
      const S = SITES[site.siteId];
      this.ui.caption(`${S.writ} · ${S.name.toUpperCase()} · ${S.place.toUpperCase()}`, 5);
    } else if (tr.stage === 'in' && tr.t > 60) this.travel = null;
  }

  beginDeparture(e) {
    this.fadeTarget = 0;
    this.audio.play('engine', null, { wet: 0.1 });
    const left = e.leftBehind.includes(this.pid);
    if (left) this.audio.play('horn', { x: VAN.door.x, y: 2.5, z: 14 });
    this.departing = { t: 0, left };
    setTimeout(() => {
      this.views.clear();
      this.onUiAction?.('report', this.session.state.report);
    }, left ? 2600 : 1500);
  }

  /** Called by the UI once the report has been read. */
  async afterReport(onProgress) {
    this.departing = null;
    this.session.toBrief();
    if (this.session.phase === 'over') return 'over';
    this.save.checkpoint(this.session.state.run);
    await this.loadBrief(onProgress);
    return 'brief';
  }

  // ---- interactions -----------------------------------------------------------------------------

  handleEvent(e) {
    if (e.type === 'step') {
      const t = this.world.tileAt(e.x, e.z);
      const surf = !t ? 0 : t.cell.hard[t.j * 32 + t.i];
      this.audio.step(surf === 2 ? 'metal' : surf === 1 ? 'hard' : 'soft', e.run, e.crouch, e.heavy);
    }
  }

  enterCell(cell) {
    const prev = this.currentCell;
    this.currentCell = cell;
    if (!cell) return;
    this.visited.add(cell.key);
    const s = cell.kind.sounds || {};
    this.audio.setRoomType(inVan(this.player.x, this.player.z) ? 'small' : s.room || 'medium');
    for (const sys of this.listeners) sys.enterCell?.(this, cell, prev);
  }

  /** What E would act on: a fixed point in the place, or an item on the floor. */
  findInteraction() {
    const p = this.player;
    const s = this.session;
    const fx = -Math.sin(p.yaw) * Math.cos(p.pitch);
    const fy = Math.sin(p.pitch);
    const fz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    const ex = p.x;
    const ey = p.eye;
    const ez = p.z;
    let best = null;
    let bestScore = Infinity;
    const consider = (it, wx, wy, wz, radius) => {
      const dx = wx - ex;
      const dy = wy - ey;
      const dz = wz - ez;
      const d = Math.hypot(dx, dz);
      if (d > radius) return;
      const d3 = Math.hypot(dx, dy, dz) || 1;
      const facing = (dx * fx + dy * fy + dz * fz) / d3;
      if (d3 > 0.6 && facing < 0.82) return;
      const score = d3 * (1.8 - facing);
      if (score < bestScore && this.world.lineOfSight(ex, ez, wx, wz, Math.min(1.0, wy + 0.1))) {
        bestScore = score;
        best = { it, x: wx, y: wy, z: wz };
      }
    };
    const cell = this.currentCell;
    if (cell) for (const it of cell.interactions) consider(it, cell.ox + it.x, it.y, cell.oz + it.z, it.radius);
    for (const it of this.moments.temp) consider(it, it.x, it.y, it.z, it.radius);
    for (const item of s.state.items) {
      if (item.holder) continue;
      consider({ type: 'item', item }, item.x, item.y + 0.12, item.z, REACH - 0.2);
    }
    if (best) {
      best.cell = cell;
      best.prompt = this.promptFor(best.it);
    }
    return best;
  }

  promptFor(it) {
    const s = this.session;
    if (it.type === 'item') {
      const d = ITEMS[it.item.type];
      return `Take ${d.name} · ${d.kg} kg${d.slots > 1 ? ' · both hands' : ''}${d.fragile ? ' · fragile' : ''}`;
    }
    if (it.type === 'chute') {
      const n = this.localHeld().filter((i, k, a) => i && isLoot(i.type) && a.indexOf(i) === k).length;
      if (s.phase !== 'night') return 'Night safe (sealed until the shift)';
      return n ? `Night safe: bank ${n} item${n > 1 ? 's' : ''}` : 'Night safe: carry salvage here';
    }
    if (it.type === 'governor') {
      if (s.phase === 'brief') return `Pull the governor: drive to ${SITES[s.state.run.siteId].name}`;
      if (s.state.lever >= 0 && s.state.tick - s.state.lever < TICK_HZ * 4) return 'Pull again: leave now';
      return 'Pull the governor: leave now';
    }
    if (it.type === 'terminal') return 'Use the terminal';
    return it.prompt || 'Use';
  }

  interact(near) {
    const { it, cell } = near;
    const s = this.session;
    if (it.fn) return it.fn(this.moments.ctx(null, { x: near.x, y: near.y, z: near.z }));
    if (it.type === 'item') return s.applyIntent(this.pid, { type: 'take', id: it.item.id });
    if (it.type === 'chute') return s.applyIntent(this.pid, { type: 'deposit' });
    if (it.type === 'governor') return s.applyIntent(this.pid, { type: 'lever' });
    if (it.type === 'terminal') {
      this.audio.play('click');
      return this.onUiAction?.('terminal');
    }
    const handler = cell?.kind?.interactions?.[it.type];
    if (handler) handler(this.moments.ctx(cell, it), it);
  }

  /** Put the active item down in front of you (gently if crouched). */
  dropActive() {
    const s = this.session;
    const me = this.localPlayer();
    const it = this.localHeld()[me.active];
    if (!it) return;
    const p = this.player;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    let x = p.x + fx * 0.65;
    let z = p.z + fz * 0.65;
    if (!this.world.isWalkable(x, z) || !this.world.lineOfSight(p.x, p.z, x, z, 0.5)) {
      x = p.x + fx * 0.15;
      z = p.z + fz * 0.15;
    }
    s.applyIntent(this.pid, { type: 'drop', id: it.id, x: +x.toFixed(3), y: 0, z: +z.toFixed(3), yaw: +(p.yaw + 0.4).toFixed(3), gentle: p.crouch > 0.5 });
  }

  // ---- frame ------------------------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.trackFps(dt);
    if (!this.session) {
      this.world.update(8);
      return;
    }
    if (!this.paused) {
      applyLook(this.player, this.input.takeLook());
      this.acc = (this.acc || 0) + dt;
      let n = 0;
      while (this.acc >= TICK && n < 8) {
        this.simTick();
        this.acc -= TICK;
        n++;
      }
      if (n === 8) this.acc = 0;
      this.time += dt;
    }
    const alpha = this.paused ? 1 : this.acc / TICK;
    this.present(alpha, dt);
    this.world.update(this.paused ? 8 : 3);
    this.world.cull(this.camera.position.x, this.camera.position.z);
    this.mats.update(this.time);
    this.views.frame(dt);
    for (const sys of this.listeners) sys.frame?.(this, dt, alpha);
    this.composer.render();
  }

  present(alpha, dt) {
    const p = this.player;
    const x = this.prev.x + (p.x - this.prev.x) * alpha;
    const z = this.prev.z + (p.z - this.prev.z) * alpha;
    const eye = this.prev.eye + (p.eye - this.prev.eye) * alpha;
    const bob = this.prev.bob + (p.bob - this.prev.bob) * alpha;
    const t = this.time;
    const kg = this.carriedKg();
    const speedK = Math.min(1, p.speed / 3.7);
    // a helmet camera: the head's bob, heavier and slower under a load
    const bobY = Math.abs(Math.sin(bob)) * (0.04 + kg / 900) * (0.4 + speedK);
    const bobX = Math.cos(bob) * 0.022 * (0.4 + speedK);
    const swayY = Math.sin(t * 0.6) * 0.005 + Math.sin(t * 1.7 + 1.3) * 0.002;
    const swayP = Math.sin(t * 0.8 + 0.5) * 0.004 + Math.sin(t * 2.1) * 0.0015;
    const cam = this.camera;
    const sy = Math.sin(p.yaw);
    const cy = Math.cos(p.yaw);
    cam.position.set(x + cy * bobX, eye + bobY - 0.02 - kg / 600, z - sy * bobX);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = p.yaw + swayY;
    cam.rotation.x = p.pitch + swayP - kg / 900;
    const side = p.vx * cy - p.vz * sy;
    this.roll = (this.roll || 0) + (-side * 0.014 - (this.roll || 0)) * Math.min(1, dt * 5);
    cam.rotation.z = this.roll + Math.sin(t * 0.5) * 0.003;
    this.sky.position.copy(cam.position);

    // auto-exposure: meters the scene ahead, hunts a little (a spring that overshoots)
    const l = this.world.lightAt(x - sy * 1.5, 1.4, z - cy * 1.5, this._lit || (this._lit = [0, 0, 0]));
    const lum = (l[0] * 0.3 + l[1] * 0.55 + l[2] * 0.15) * 2.2;
    const target = Math.max(0.85, Math.min(3.0, 0.55 / (lum + 0.12)));
    const ex = this.exposure;
    ex.vel += ((target - ex.v) * 7 - ex.vel * 3.2) * Math.min(dt, 0.05);
    ex.v += ex.vel * Math.min(dt, 0.05) * 3;
    ex.v = Math.max(0.6, Math.min(3.4, ex.v));
    const u = this.cam.uniforms;
    u.uExposure.value = ex.v;
    u.uGain.value = Math.max(0, Math.min(1, (ex.v - 0.9) / 2.2));
    u.uTime.value = t;
    u.uFrame.value = (u.uFrame.value + 1) % 4096;

    this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * (this.fadeTarget ? 1.4 : 2.5));
    u.uFade.value = this.fade;
    this.audio.setListener(x, eye, z, p.yaw);
    const cell = this.currentCell;
    if (cell) {
      const snd = cell.kind.sounds || {};
      const aboard = inVan(p.x, p.z);
      this.audio.setBed(aboard ? { base: 50, buzz: 0.05, level: 0.35, hvac: 0.25 } : snd.hum, 1, cell.uniforms.uDim.value);
      this.audio.setRoomType(aboard ? 'small' : snd.room || 'medium');
    }
  }

  trackFps(dt) {
    const f = this.fps;
    f.frames++;
    f.t += dt;
    f.worst = Math.max(f.worst, dt);
    if (f.t >= 1) {
      f.value = f.frames / f.t;
      f.lastWorst = f.worst * 1000;
      f.frames = 0;
      f.t = 0;
      f.worst = 0;
    }
  }

  /** What the HUD shows, as plain values. */
  hud() {
    const s = this.session;
    if (!s) return null;
    const st = s.state;
    const run = st.run;
    const me = this.localPlayer();
    const held = this.localHeld();
    const min = this.minutes;
    return {
      crew: crewId(run.seed),
      night: run.night,
      phase: st.phase,
      clock: st.phase === 'night' ? fmtClock(min) : st.phase === 'brief' ? '20:50' : '--:--',
      late: st.phase === 'night' && min >= LAST_CALL_MIN,
      ledger: run.ledger,
      target: run.instalment.target,
      due: run.instalment.due,
      slots: held.map((it, k) => ({ name: it ? ITEMS[it.type].name : '', cont: !!it && k > 0 && held[k - 1] === it, active: k === me.active })),
      kg: this.carriedKg(),
      prompt: this.nearInteraction && !this.paused ? this.nearInteraction.prompt : '',
      site: st.site ? SITES[st.site.siteId] : SITES[run.siteId],
      aboard: inVan(this.player.x, this.player.z),
    };
  }

  /** The site plan: every cell walked tonight, from the loaded tiles. */
  planData() {
    const cells = [...this.world.cells.values()].filter((c) => this.visited.has(c.key) || c.key === '0,0');
    return { cells, player: this.player, items: this.session?.state.items || [] };
  }

  // ---- debug / test hooks (used by automated checks and screenshots) -------------------------

  /** Put the camera somewhere and render one frame immediately. */
  debugView(x, z, yaw = this.player.yaw, pitch = 0, opts = {}) {
    const p = this.player;
    p.x = x;
    p.z = z;
    p.yaw = yaw;
    p.pitch = pitch;
    p.vx = p.vz = 0;
    this.roll = 0;
    this.prev = { x, z, eye: p.eye, bob: p.bob };
    for (let k = 0; k < 4; k++) this.world.update(100);
    const cell = this.world.cellAt(x, z);
    if (cell !== this.currentCell) this.enterCell(cell);
    for (let k = 0; k < (opts.ticks ?? 1); k++) this.simTick();
    p.vx = p.vz = 0;
    this.roll = 0;
    this.exposure.vel = 0;
    for (let k = 0; k < 40; k++) this.present(1, 1 / 30); // let the exposure settle
    this.world.cull(this.camera.position.x, this.camera.position.z);
    this.views.frame(1 / 60);
    this.mats.update(this.time);
    this.composer.render();
    if (opts.freeze !== false) this.debugFreeze();
    return { cell: cell ? `${cell.cx},${cell.cz} ${cell.kindId}` : null };
  }

  /** Copy the frame just rendered into a fixed overlay canvas so screenshots show exactly it. */
  debugFreeze(on = true) {
    let cv = document.getElementById('debug-freeze');
    if (!on) return cv?.remove();
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'debug-freeze';
      cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;pointer-events:none';
      document.body.appendChild(cv);
    }
    const src = this.renderer.domElement;
    cv.width = src.width;
    cv.height = src.height;
    cv.getContext('2d').drawImage(src, 0, 0);
    this._frozen = cv;
  }

  /** Dev server only: save the frozen frame to shots/<name>.jpg. */
  async debugSave(name = 'shot') {
    const cv = this._frozen || this.renderer.domElement;
    const body = cv.toDataURL('image/jpeg', 0.88);
    const r = await fetch(`${import.meta.env.BASE_URL}__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body });
    return r.ok ? `shots/${name}.jpg` : 'failed';
  }

  /**
   * Tests in a hidden page (where animation frames stall): step frames by hand at 60 Hz for
   * `secs` of game time, yielding between them so workers and promises progress. Stops early
   * when until() is true.
   */
  async debugRun(secs, until = null) {
    const yieldNow = () => new Promise((r) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => r();
      ch.port2.postMessage(0);
    });
    const was = this.paused;
    this.paused = false;
    for (let k = 0; k < secs * 60; k++) {
      this.frame(this.last + 1000 / 60);
      this.world.update(30);
      if (until && until()) break;
      if (k % 4 === 0) await yieldNow();
    }
    this.paused = was;
    this.last = performance.now();
  }

  /** Run n simulation ticks immediately (tests). */
  debugTicks(n) {
    for (let k = 0; k < n; k++) this.simTick();
  }

  /** Jump the shift clock to hh:mm (tests). */
  debugClock(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const min = (h < 12 ? h + 24 : h) * 60 + m - 21 * 60;
    this.session.state.shiftTick = ticksAt(min);
  }

  /** Render n frames synchronously and return average ms per frame (GPU-synced). */
  benchmark(n = 60) {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    this.composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let k = 0; k < n; k++) {
      this.time += 1 / 60;
      this.present(1, 1 / 60);
      this.mats.update(this.time);
      this.composer.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    const ms = (performance.now() - t0) / n;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    return { msPerFrame: +ms.toFixed(2), fps: +(1000 / ms).toFixed(0), buffer: `${size.x}x${size.y}`, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }
}

/**
 * The night sky over the yard: low cloud lit from beneath by a town's sodium lamps, brownish at
 * the horizon and nearly black overhead. Drawn behind everything, unaffected by fog.
 */
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vDir;
      float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float y = max(vDir.y, 0.0);
        vec3 horizon = vec3(0.16, 0.1, 0.06);
        vec3 zenith = vec3(0.012, 0.014, 0.02);
        vec3 c = mix(horizon, zenith, pow(y, 0.45));
        // the cloud deck: soft lumps catching the glow
        vec2 q = vDir.xz / (vDir.y + 0.25) * 2.0;
        float cl = n(q) * 0.6 + n(q * 2.3) * 0.3 + n(q * 5.1) * 0.1;
        c *= 0.75 + 0.5 * cl;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
}

/** The crew member's insurance ID, as stencilled on the helmet. */
export function crewId(seed) {
  return `GD-${String(1000 + (hash(seed, 'crew') % 9000))}`;
}
