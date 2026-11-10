// Game: owns the renderer, the world, the simulation tick and the per-frame presentation.
// Simulation (player, entities, flicker, timers) advances on a fixed 60 Hz tick from plain
// state objects; rendering interpolates between ticks.

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
import { CamcorderShader } from '../render/camcorder.js';
import { World } from '../world/world.js';
import { CELL, N } from '../world/constants.js';
import { packCellMask } from './save.js';
import FRAGMENTS from '../../lore/fragments.json';
import { createPlayer, applyLook, stepPlayer } from './player.js';
import { flickerLevel } from './flicker.js';
import { Moments } from './moments.js';
import { Ambience } from './ambience.js';
import { EntitySystem } from './entities.js';
import { hashFloat } from '../core/rng.js';
import { TICK, TICK_HZ } from './constants.js';

export class Game {
  constructor({ canvas, ui, save, worldSeed, debug = false, kindAtOrigin = null }) {
    this.canvas = canvas;
    this.ui = ui;
    this.save = save;
    this.debug = debug;
    this.worldSeed = worldSeed;
    this.tick = 0;
    this.time = 0;
    this.paused = true;
    this.momentRng = new RNG(hash(worldSeed, 'moments'));
    this.events = [];
    this.listeners = new Set(); // per-tick systems: { tick(game), frame?(game, dt) }

    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.quality = 0.8;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x050605);
    scene.fog = new THREE.FogExp2(0x0b0d09, 0.05);
    const camera = (this.camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 90));
    scene.add(camera);

    // the flashlight: the only real-time light in the game
    const flash = (this.flashlight = new THREE.SpotLight(0xfff0d6, 0, 20, 0.42, 0.6, 1.6));
    flash.position.set(0.18, -0.2, 0.05);
    flash.target.position.set(0.05, -0.15, -4);
    camera.add(flash, flash.target);

    this.mats = new MaterialLibrary(renderer);
    this.world = new World(scene, this.mats, worldSeed);
    if (kindAtOrigin) this.world.kindOverrides.set('0,0', kindAtOrigin);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.moments = new Moments(this);
    this.listeners.add(new Ambience(this));
    this.entities = new EntitySystem(this);
    this.listeners.add(this.entities);
    this.world.onCellAdded = (cell) => {
      for (const sys of this.listeners) sys.cellAdded?.(this, cell);
    };
    this.world.onCellRemoved = (cell) => {
      for (const sys of this.listeners) sys.cellRemoved?.(this, cell);
    };
    this.checkingOut = null;
    this.fade = 1;
    this.thumbQueue = []; // [{ key, at }] frames to capture for the discoveries screen
    this.onUiAction = null; // (name) => void, set by main: 'map' | 'log'

    // post: render -> bloom -> tonemap/sRGB -> camcorder
    const composer = (this.composer = new EffectComposer(renderer));
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(640, 360), 0.16, 0.2, 0.97);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.cam = new ShaderPass(CamcorderShader);
    composer.addPass(this.cam);

    this.player = null;
    this.prev = { x: 0, z: 0, eye: 1.6, bob: 0 };
    this.currentCell = null;
    this.nearInteraction = null;
    this.sitting = null;
    this.fps = { frames: 0, t: 0, value: 0, worst: 0, frameMs: [] };

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

  async load(onProgress = () => {}) {
    onProgress('developing textures');
    await this.mats.loadAll();
    onProgress('measuring rooms');
    const s = this.save.data;
    let px = s.player?.x;
    let pz = s.player?.z;
    let yaw = s.player?.yaw;
    // build the starting cell (the queue only drains when update() runs, so pump it)
    const pump = setInterval(() => this.world.update(50), 16);
    try {
      await this.world.ensureAround(px ?? CELL / 2, pz ?? CELL / 2);
    } finally {
      clearInterval(pump);
    }
    if (px === undefined) {
      const cell = this.world.cells.get('0,0');
      const sp = this.findOpenSpot(cell, cell.points.spawn || cell.points.resident || { x: 8, z: 8 });
      px = sp.x;
      pz = sp.z;
      const desk = cell.points.desk;
      yaw = desk ? Math.atan2(-(desk.x - sp.x), -(desk.z - sp.z)) : 0;
    }
    this.player = createPlayer(px, pz, yaw ?? 0);
    if (s.player?.flashlight) this.player.flashlight = true;
    this.prev = { x: px, z: pz, eye: this.player.eye, bob: 0 };
    // warm up: compile shaders, finish neighbours
    this.renderer.compile(this.scene, this.camera);
    for (let k = 0; k < 6; k++) this.world.update(50);
    this.ensureLoop();
  }

  /** Nearest walkable spot to a cell-local point, in world coordinates. */
  findOpenSpot(cell, p) {
    const ok = (x, z) => {
      for (const [dx, dz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) if (!this.world.isWalkable(x + dx, z + dz)) return false;
      return true;
    };
    const bx = cell.ox + p.x;
    const bz = cell.oz + p.z;
    for (let r = 0; r < 8; r += 0.25)
      for (let a = 0; a < 16; a++) {
        const x = bx + Math.cos((a / 16) * Math.PI * 2) * r;
        const z = bz + Math.sin((a / 16) * Math.PI * 2) * r;
        if (ok(x, z)) return { x, z };
      }
    return { x: bx, z: bz };
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
    this.autosave();
  }

  /** Persist where the player is (called every few seconds and on pause). */
  autosave() {
    const p = this.player;
    if (!p || this.checkingOut) return;
    this.save.data.player = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), flashlight: p.flashlight, battery: +p.battery.toFixed(3) };
    this.save.write();
  }

  // ---- simulation tick ------------------------------------------------------------------------

  simTick() {
    this.tick++;
    const p = this.player;
    const actions = this.input.takeActions();
    if (this.sitting && (actions.moveX || actions.moveZ)) this.standUp();
    if (this.sitting || this.checkingOut) {
      actions.moveX = 0;
      actions.moveZ = 0;
      actions.run = false;
    }
    this.updateCheckOut();
    const events = [];
    this.prev.x = p.x;
    this.prev.z = p.z;
    this.prev.eye = p.eye;
    this.prev.bob = p.bob;
    if (!this.checkingOut) stepPlayer(p, actions, this.world, TICK, events);
    else p.vx = p.vz = 0;
    if (this.sitting) p.eye = 1.1;

    // cell streaming & current place
    const cell = this.world.cellAt(p.x, p.z);
    if (cell !== this.currentCell) this.enterCell(cell);
    if (Math.floor(this.tick) % 15 === 0 && !(this.checkingOut && this.checkingOut.t >= 70)) this.world.ensureAround(p.x, p.z);

    // flicker per cell, from the shared tick
    for (const c of this.world.cells.values()) {
      c.uniforms.uFlicker.value = flickerLevel(c.seed, this.tick);
    }

    this.moments.update(this.tick);
    for (const sys of this.listeners) sys.tick?.(this, actions, events);

    // interactions
    this.nearInteraction = this.findInteraction();
    if (actions.interact && this.nearInteraction) this.interact(this.nearInteraction);

    for (const e of events) this.handleEvent(e);

    if (actions.map) this.onUiAction?.('map');
    if (actions.log) this.onUiAction?.('log');

    // play time and autosave every 5 s
    if (this.tick % (TICK_HZ * 5) === 0) {
      this.save.data.playSeconds += 5;
      this.save.data.tapeSeconds += 5;
      this.autosave();
    }
  }

  handleEvent(e) {
    if (e.type === 'step') {
      const t = this.world.tileAt(e.x, e.z);
      this.audio.step(t && t.hard ? 'hard' : 'soft', e.run, e.crouch);
    } else if (e.type === 'flashlight') {
      this.audio.play('click');
    }
  }

  enterCell(cell) {
    const prev = this.currentCell;
    this.currentCell = cell;
    if (!cell) return;
    const s = cell.kind.sounds || {};
    this.audio.setRoomType(s.room || 'medium');
    for (const sys of this.listeners) sys.enterCell?.(this, cell, prev);
    // the map remembers every place walked through, drawn from its real floor plan
    const sv = this.save.data;
    if (!sv.visited[cell.key]) {
      sv.visited[cell.key] = cell.kindId;
      sv.maps[cell.key] = packCellMask(cell, N);
      this.save.write();
    }
    const pk = 'place:' + cell.kindId;
    if (!this.discoverThing(pk, cell.kind.card, cell.kindId) && !this.save.thumbs[pk] && !this.thumbQueue.some((q) => q.key === pk))
      this.thumbQueue.push({ key: pk, at: this.time + 1.6, vantage: true, cellKey: cell.key }); // a photo missed last time
  }

  /**
   * First sight of a place or an occupant: a title caption, a logbook line, and a thumbnail
   * captured from the game a moment later for the discoveries screen.
   */
  discoverThing(key, card, kindId = this.currentCell?.kindId, thumbDelay = 1.6) {
    if (!card || !this.save.markDiscovered(key)) return false;
    this.addLog(key, `${card.title}. ${card.blurb}`, kindId);
    this.ui.caption(card.title.toUpperCase(), 3);
    const place = key.startsWith('place:');
    if (!this.save.thumbs[key]) this.thumbQueue.push({ key, at: this.time + thumbDelay, vantage: place, cellKey: place ? this.currentCell?.key : null });
    return true;
  }

  /**
   * A good spot to photograph a place from: the walkable point and heading inside the cell with
   * the longest, widest open view. Pure function of the loaded tile data.
   */
  findVantage(cell) {
    const w = this.world;
    const inCell = (x, z) => x > cell.ox && z > cell.oz && x < cell.ox + CELL && z < cell.oz + CELL;
    const ray = (x, z, yaw) => {
      const dx = -Math.sin(yaw);
      const dz = -Math.cos(yaw);
      let d = 0;
      while (d < 14) {
        d += 0.25;
        const px = x + dx * d;
        const pz = z + dz * d;
        if (!inCell(px, pz) || !w.isFloor(px, pz)) break;
      }
      return d;
    };
    const lit = [0, 0, 0];
    const light = (x, z) => {
      w.lightAt(x, 1.4, z, lit);
      return Math.min(1, (lit[0] + lit[1] + lit[2]) / 1.2);
    };
    let best = null;
    for (let j = 1.5; j < CELL; j += 1.25)
      for (let i = 1.5; i < CELL; i += 1.25) {
        const x = cell.ox + i;
        const z = cell.oz + j;
        if (!w.isWalkable(x, z) || !w.isWalkable(x + 0.45, z) || !w.isWalkable(x - 0.45, z) || !w.isWalkable(x, z + 0.45) || !w.isWalkable(x, z - 0.45)) continue;
        for (let a = 0; a < 16; a++) {
          const yaw = (a / 16) * Math.PI * 2;
          const d = ray(x, z, yaw);
          const open = d + 0.5 * (ray(x, z, yaw + 0.45) + ray(x, z, yaw - 0.45));
          if (best && open <= best.score) continue; // light can only lower the score
          const ahead = Math.min(d, 4);
          const lum = light(x - Math.sin(yaw) * ahead, z - Math.cos(yaw) * ahead);
          const score = open * (0.3 + 0.7 * lum);
          if (!best || score > best.score) best = { x, z, yaw, score };
        }
      }
    return best;
  }

  addLog(key, text, kind = this.currentCell?.kindId || null) {
    const log = this.save.data.log;
    if (log.some((e) => e.key === key)) return false;
    log.push({ key, text, kind, at: Math.round(this.save.data.playSeconds) });
    this.save.write();
    return true;
  }

  /** Copy the frame just rendered into a small JPEG for a discovery card. */
  captureThumb(key) {
    const src = this.renderer.domElement;
    const w = 320;
    const h = 200;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    // centre-crop to 16:10
    const sa = src.width / src.height;
    let sw = src.width;
    let sh = src.height;
    if (sa > w / h) sw = sh * (w / h);
    else sh = sw / (w / h);
    cv.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, w, h);
    try {
      this.save.setThumb(key, cv.toDataURL('image/jpeg', 0.72));
    } catch {
      /* ignore */
    }
  }

  findInteraction() {
    const p = this.player;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    let best = null;
    let bestScore = Infinity;
    const consider = (it, wx, wy, wz) => {
      const dx = wx - p.x;
      const dz = wz - p.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) return;
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d > 0.5 && facing < 0.35) return;
      const score = d * (1.6 - facing);
      if (score < bestScore && this.world.lineOfSight(p.x, p.z, wx, wz, 1.0)) {
        bestScore = score;
        best = { it, x: wx, y: wy, z: wz };
      }
    };
    const cell = this.currentCell;
    if (cell) for (const it of cell.interactions) if (!it.done) consider(it, cell.ox + it.x, it.y, cell.oz + it.z);
    for (const it of this.moments.temp) consider(it, it.x, it.y, it.z);
    for (const sys of this.listeners) if (sys.interactions) for (const it of sys.interactions(this)) consider(it, it.x, it.y, it.z);
    if (best) best.cell = cell;
    return best;
  }

  interact(near) {
    const { it, cell } = near;
    if (it.fn) {
      it.fn(this.moments.ctx(null, { x: near.x, y: near.y, z: near.z }));
      return;
    }
    for (const sys of this.listeners) if (sys.onInteract?.(this, near)) return;
    if (it.type === 'readLore' && cell) return this.readLore(cell.kindId, near);
    const handler = cell?.kind?.interactions?.[it.type];
    if (handler) handler(this.moments.ctx(cell, it), it);
  }

  /** Pick up the place's found document: paper overlay, logbook line, discoveries count. */
  readLore(kindId, near) {
    const doc = FRAGMENTS.fragments[kindId];
    if (!doc) return;
    this.audio.play('paper', near ? { x: near.x, y: near.y, z: near.z } : null);
    const first = !this.save.data.lore[kindId];
    this.save.data.lore[kindId] = true;
    this.save.markDiscovered('lore:' + kindId);
    this.addLog('lore:' + kindId, doc.log, kindId);
    this.save.write();
    this.onUiAction?.('paper', { ...doc, kindId, first });
  }

  sit(p, yaw) {
    this.sitting = { x: p.x, z: p.z };
    this.player.x = p.x;
    this.player.z = p.z;
    if (yaw !== undefined) this.player.yaw = yaw;
    this.player.vx = this.player.vz = 0;
  }

  standUp() {
    this.sitting = null;
  }

  discover(key, text) {
    if (!this.addLog(key, text)) return false;
    this.save.markDiscovered(key);
    this.ui.caption('(Noted in the logbook.)', 2.5);
    for (const sys of this.listeners) sys.discover?.(this, key, text);
    return true;
  }

  /**
   * Caught by a hunter: fade to black, skip the tape, wake up somewhere else. Deterministic:
   * where you wake depends on the seed and how many times this has happened.
   */
  checkOut(why) {
    if (this.checkingOut) return;
    const n = (this.save.data.checkouts = (this.save.data.checkouts || 0) + 1);
    const a = hashFloat(this.worldSeed, 'wake', n) * Math.PI * 2;
    const dist = 3 + Math.floor(hashFloat(this.worldSeed, 'wakeD', n) * 3);
    const cx = Math.floor(this.player.x / CELL) + Math.round(Math.cos(a) * dist);
    const cz = Math.floor(this.player.z / CELL) + Math.round(Math.sin(a) * dist);
    this.checkingOut = { why, t: 0, cx, cz, moved: false };
    this.audio.play('checkIn', null, { wet: 0.6 });
    this.standUp();
  }

  updateCheckOut() {
    const c = this.checkingOut;
    if (!c) return;
    c.t++;
    if (c.t === 70) {
      // black: move the player while nobody is looking
      for (const s of [...this.entities.states]) if (this.entities.isHunter(s)) this.entities.remove(s);
      this.world.ensureAround(c.cx * CELL + 8, c.cz * CELL + 8);
    }
    if (c.t > 70 && !c.moved) {
      const cell = this.world.cells.get(`${c.cx},${c.cz}`);
      if (cell) {
        const sp = this.findOpenSpot(cell, cell.points.resident || cell.points.spawn || { x: 8, z: 8 });
        this.player.x = this.prev.x = sp.x;
        this.player.z = this.prev.z = sp.z;
        this.player.vx = this.player.vz = 0;
        c.moved = true;
        c.movedAt = c.t;
      }
    }
    if (c.moved && c.t - c.movedAt === 90) {
      this.ui.caption(this.momentRng.next() < 0.5 ? 'The tape skips. You are somewhere else.' : 'Checked out. The lights are still on.', 4);
      const who = c.why === 'unlit' ? 'The dark closed over me with my torch off' : 'The porter reached me';
      this.discover('event:checkedOut', `${who}. Then the tape skipped, and I was standing in another part of the building.`);
    }
    if (c.moved && c.t - c.movedAt > 150) this.checkingOut = null;
  }

  // ---- frame ------------------------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.trackFps(dt);
    if (!this.player) return;

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
    this.mats.update(this.time);
    for (const sys of this.listeners) sys.frame?.(this, dt, alpha);
    this.composer.render();
    // thumbnails are taken right after a render, while the drawing buffer is still valid
    const q = this.thumbQueue[0];
    // a place's photo is only taken while you are still in it (otherwise it is retaken next visit)
    if (q && q.cellKey && this.currentCell?.key !== q.cellKey) this.thumbQueue.shift();
    else if (q && !this.paused && !this.checkingOut && this.fade > 0.97 && this.time >= q.at) {
      this.thumbQueue.shift();
      const v = q.vantage && this.currentCell ? this.findVantage(this.currentCell) : null;
      if (v) {
        // photograph from the vantage, then put the real frame back before the browser shows it
        const cam = this.camera;
        const saved = { p: cam.position.clone(), r: cam.rotation.clone(), fl: this.flashlight.intensity };
        cam.position.set(v.x, 1.55, v.z);
        cam.rotation.set(-0.06, v.yaw, 0, 'YXZ');
        this.flashlight.intensity = 0;
        this.composer.render();
        this.captureThumb(q.key);
        cam.position.copy(saved.p);
        cam.rotation.copy(saved.r);
        this.flashlight.intensity = saved.fl;
        this.composer.render();
      } else this.captureThumb(q.key);
    }
  }

  /** Tests: run the frame loop n times with a fixed step, as if unpaused (takes queued photos). */
  debugRunFrames(n = 30, step = 1 / 30) {
    const was = this.paused;
    this.paused = false;
    for (let k = 0; k < n; k++) this.frame(this.last + step * 1000);
    this.paused = was;
    this.last = performance.now();
  }

  present(alpha, dt) {
    const p = this.player;
    const x = this.prev.x + (p.x - this.prev.x) * alpha;
    const z = this.prev.z + (p.z - this.prev.z) * alpha;
    const eye = this.prev.eye + (p.eye - this.prev.eye) * alpha;
    const bob = this.prev.bob + (p.bob - this.prev.bob) * alpha;
    const t = this.time;
    const speedK = Math.min(1, p.speed / 3.7);
    const bobY = Math.abs(Math.sin(bob)) * 0.035 * (0.4 + speedK);
    const bobX = Math.cos(bob) * 0.02 * (0.4 + speedK);
    // handheld sway: slow layered sines
    const swayY = Math.sin(t * 0.7) * 0.004 + Math.sin(t * 1.9 + 1.3) * 0.002;
    const swayP = Math.sin(t * 0.9 + 0.5) * 0.004 + Math.sin(t * 2.3) * 0.0015;
    const cam = this.camera;
    const sy = Math.sin(p.yaw);
    const cy = Math.cos(p.yaw);
    cam.position.set(x + cy * bobX, eye + bobY - 0.02, z - sy * bobX);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = p.yaw + swayY;
    cam.rotation.x = p.pitch + swayP;
    // roll a touch when strafing
    const side = p.vx * cy - p.vz * sy;
    this.roll = (this.roll || 0) + (-side * 0.012 - (this.roll || 0)) * Math.min(1, dt * 5);
    cam.rotation.z = this.roll + Math.sin(t * 0.5) * 0.003;

    // flashlight
    const target = p.flashlight && p.battery > 0 ? 14 * (0.35 + 0.65 * Math.min(1, p.battery * 4)) : 0;
    this.flashlight.intensity += (target - this.flashlight.intensity) * Math.min(1, dt * 20);

    this.cam.uniforms.uTime.value = t;
    const c = this.checkingOut;
    const fadeTarget = c && (!c.moved || c.t - c.movedAt < 50) ? 0 : 1;
    this.fade += (fadeTarget - this.fade) * Math.min(1, dt * (fadeTarget ? 1.2 : 2.2));
    this.cam.uniforms.uFade.value = this.fade;
    this.audio.setListener(x, eye, z, p.yaw);
    if (this.currentCell) {
      const s = this.currentCell.kind.sounds || {};
      this.audio.setBed(s.hum, 1, this.currentCell.uniforms.uDim.value);
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
    if (opts.flashlight !== undefined) p.flashlight = opts.flashlight;
    this.prev = { x, z, eye: p.eye, bob: p.bob };
    this.world.ensureAround(x, z);
    for (let k = 0; k < 4; k++) this.world.update(100);
    const cell = this.world.cellAt(x, z);
    if (cell !== this.currentCell) this.enterCell(cell);
    for (let k = 0; k < (opts.ticks ?? 1); k++) this.simTick();
    p.vx = p.vz = 0;
    this.roll = 0;
    this.entities.frame(this, 1 / 60, 1); // views exist and are posed even while paused
    this.present(1, 1 / 60);
    if (opts.flashlight !== undefined) this.flashlight.intensity = p.flashlight ? 14 : 0;
    this.mats.update(this.time);
    this.composer.render();
    if (opts.freeze !== false) this.debugFreeze();
    return { cell: cell ? `${cell.cx},${cell.cz} ${cell.kindId}` : null };
  }

  /**
   * Copy the frame just rendered into a fixed overlay canvas so screenshots of a paused or hidden
   * page show exactly it (the live canvas can present a stale frame). Pass false to remove it.
   */
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

  /** Wait (without timers, which hidden tabs throttle) until nearby cells are built. */
  async debugSettle(maxMs = 8000) {
    const yieldNow = () => new Promise((r) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => r();
      ch.port2.postMessage(0);
    });
    const t0 = performance.now();
    this.world.ensureAround(this.player.x, this.player.z);
    while (performance.now() - t0 < maxMs) {
      this.world.update(50);
      if (!this.world.waiting.size && !this.world.buildQueue.length) break;
      await yieldNow();
    }
    return this.world.cells.size;
  }

  /** Run n simulation ticks immediately (tests). */
  debugTicks(n) {
    for (let k = 0; k < n; k++) this.simTick();
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

  /** Plain snapshot of the simulation (what multiplayer would sync). */
  snapshot() {
    const p = this.player;
    return { tick: this.tick, player: { x: p.x, z: p.z, yaw: p.yaw, pitch: p.pitch, crouch: p.crouch, flashlight: p.flashlight } };
  }

  get tickHz() {
    return TICK_HZ;
  }
}
