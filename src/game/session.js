// Session: the authoritative simulation of a contract: the run, tonight's phase and clock, every
// item and where it is, the van door and the departure. Plain serializable state, changed only
// by tick() and applyIntent(pid, intent). In co-op the host runs it and the others mirror it.
// No three.js, no DOM.

import { ITEMS, SLOTS, isLoot, freeSlot, slotsOf } from './items.js';
import { closeNight, bank } from './run.js';
import { shiftMinutes, SHIFT_MIN, LAST_CALL_MIN, overtimeFee } from './clock.js';
import { VAN } from '../world/kinds/yard.js';
import { SITES } from '../world/site.js';
import { inVan } from './van.js';
import { TICK_HZ } from './constants.js';
import { CREATURES, nightSchedule } from '../creatures/index.js';
import { spawnSpot, roll } from '../creatures/common.js';
import { ALONE_LIMIT } from '../creatures/plusOne.js';
import { siteValueK } from './run.js';
import { RNG, hash } from '../core/rng.js';

export const REACH = 2.3;
const LEVER_CONFIRM_TICKS = TICK_HZ * 4;
// how loud things are (0..1), for anything listening
export const LOUD = { setDown: 0.3, thud: 0.75, smash: 1.0 };

export { inVan };

export class Session {
  constructor(run, { solo = true } = {}) {
    this.solo = solo;
    this.state = {
      tick: 0,
      phase: 'brief', // brief -> travel -> night -> report -> brief ... | over
      shiftTick: 0,
      run,
      site: null, // { worldSeed, siteId, night } being worked
      items: [],
      players: {},
      lever: -1, // tick the governor was first pulled
      lastCall: false,
      report: null,
      tonight: { banked: 0, items: [] },
      creatures: [], // plain creature states: { id, type, x, z, yaw, mode, ... }
      schedule: [], // [{ type, at, done }]
      nextId: 1,
      dead: [], // [{ pid, cause }] tonight
    };
    this.events = []; // presentation events since the last drain: { type, ... }
    this.noises = []; // sounds made this tick: { x, z, loud, pid }
    this.tmp = [0, 0, 0];
  }

  /** Something made a sound at (x, z), loudness 0..1. */
  noise(x, z, loud, pid = null) {
    if (this.state.phase === 'night') this.noises.push({ x, z, loud, pid });
  }

  get phase() {
    return this.state.phase;
  }
  get minutes() {
    return shiftMinutes(this.state.shiftTick);
  }
  get doorOpen() {
    return this.state.phase === 'night';
  }

  emit(e) {
    this.events.push(e);
  }

  drain() {
    const e = this.events;
    this.events = [];
    return e;
  }

  addPlayer(pid, name) {
    const v = VAN.inner;
    this.state.players[pid] = { pid, name, x: (v.x0 + v.x1) / 2, z: v.z0 + 1.6, yaw: 0, active: 0, alive: true, crouch: false, speed: 0, still: 0, alone: 0, lamp: false };
    return this.state.players[pid];
  }

  /** Movement is owned by each player's client; the session keeps a copy for rules. */
  updatePlayer(pid, p) {
    const s = this.state.players[pid];
    if (!s || !s.alive) return;
    s.x = p.x;
    s.z = p.z;
    s.yaw = p.yaw;
    s.pitch = p.pitch;
    s.crouch = p.crouch > 0.5;
    s.speed = p.speed;
    s.still = p.still || 0;
  }

  held(pid) {
    return this.state.items.filter((it) => it.holder === pid);
  }

  // ---- intents ---------------------------------------------------------------------------------

  applyIntent(pid, intent) {
    const st = this.state;
    const p = st.players[pid];
    if (!p || !intent) return false;
    switch (intent.type) {
      case 'slot':
        p.active = Math.max(0, Math.min(SLOTS - 1, intent.slot | 0));
        return true;
      case 'take':
        return this.take(p, intent.id);
      case 'drop':
        return this.drop(p, intent);
      case 'deposit':
        return this.deposit(p);
      case 'lever':
        return this.lever(p);
      case 'noise':
        if (!p.alive || Math.hypot(intent.x - p.x, intent.z - p.z) > 3) return false;
        this.noise(intent.x, intent.z, Math.max(0, Math.min(1, intent.loud)), pid);
        return true;
      case 'writ':
        if (st.phase !== 'brief' || !SITES[intent.siteId]) return false;
        st.run.siteId = intent.siteId;
        this.emit({ type: 'writ', siteId: intent.siteId });
        return true;
    }
    return false;
  }

  take(p, id) {
    const st = this.state;
    if (!p.alive) return false;
    const it = st.items.find((i) => i.id === id);
    if (!it || it.holder) return false;
    if (Math.hypot(it.x - p.x, it.z - p.z) > REACH) return false;
    const n = ITEMS[it.type].slots;
    const slot = freeSlot(st.items, p.pid, n, p.active);
    if (slot < 0) {
      this.emit({ type: 'full', pid: p.pid, need: n });
      return false;
    }
    it.holder = p.pid;
    it.slot = slot;
    p.active = slot;
    this.emit({ type: 'take', pid: p.pid, id, itemType: it.type, x: it.x, y: it.y, z: it.z });
    return true;
  }

  /** Put down the item in the active slot at (x, y, z), given by the client (in reach). */
  drop(p, { x, y = 0, z, yaw = 0, gentle = false, id = null }) {
    const st = this.state;
    const sl = slotsOf(st.items, p.pid);
    const it = st.items.find((i) => i.id === (id || sl[p.active]));
    if (!it || it.holder !== p.pid) return false;
    if (Math.hypot(x - p.x, z - p.z) > REACH) return false;
    it.holder = null;
    it.x = x;
    it.y = y;
    it.z = z;
    it.yaw = yaw;
    let broke = false;
    if (ITEMS[it.type].fragile && !gentle) {
      it.value = Math.round(it.value * 0.7);
      it.dropped++;
      broke = true;
    }
    const kg = ITEMS[it.type].kg;
    this.noise(x, z, broke ? LOUD.smash : gentle ? LOUD.setDown * 0.5 : kg > 6 ? LOUD.thud : LOUD.setDown, p.pid);
    this.emit({ type: 'drop', pid: p.pid, id: it.id, itemType: it.type, x, y, z, broke, kg });
    return true;
  }

  /** The night safe: everything of value the player carries is banked. */
  deposit(p) {
    const st = this.state;
    if (st.phase !== 'night' || !inVan(p.x, p.z)) return false;
    const mine = this.held(p.pid).filter((i) => isLoot(i.type));
    if (!mine.length) {
      this.emit({ type: 'chuteEmpty', pid: p.pid });
      return false;
    }
    let total = 0;
    for (const it of mine) {
      total += it.value;
      this.bankItem(it);
    }
    st.items = st.items.filter((i) => !mine.includes(i));
    this.emit({ type: 'deposit', pid: p.pid, total, n: mine.length, names: mine.map((i) => ITEMS[i.type].name) });
    return true;
  }

  bankItem(it) {
    const st = this.state;
    bank(st.run, it);
    st.tonight.banked += it.value;
    st.tonight.items.push({ type: it.type, value: it.value, dropped: it.dropped });
  }

  lever(p) {
    const st = this.state;
    if (!inVan(p.x, p.z)) return false;
    if (st.phase === 'brief') {
      st.phase = 'travel';
      this.emit({ type: 'travel', siteId: st.run.siteId });
      return true;
    }
    if (st.phase !== 'night') return false;
    const outside = Object.values(st.players).filter((q) => q.alive && !inVan(q.x, q.z)).length;
    if (st.lever >= 0 && st.tick - st.lever < LEVER_CONFIRM_TICKS) {
      this.depart('lever');
      return true;
    }
    st.lever = st.tick;
    this.emit({ type: 'leverArmed', pid: p.pid, outside });
    return true;
  }

  // ---- the night -------------------------------------------------------------------------------

  /** The site is loaded: spread tonight's salvage and open the door. */
  beginNight(site, items) {
    const st = this.state;
    st.site = site;
    st.items = items;
    st.phase = 'night';
    st.shiftTick = 0;
    st.lever = -1;
    st.lastCall = false;
    st.tonight = { banked: 0, items: [] };
    st.report = null;
    st.creatures = [];
    st.dead = [];
    st.wipeAt = -1;
    st.schedule = this.noCreatures ? [] : nightSchedule(SITES[site.siteId].hazard).map((e) => ({ ...e, done: false }));
    for (const p of Object.values(st.players)) {
      p.alive = true;
      p.alone = 0;
    }
    this.emit({ type: 'doorOpen' });
  }

  /** One tick of the rules. `world` answers spatial questions (paths, sight, light). */
  tick(world = null) {
    const st = this.state;
    st.tick++;
    if (st.phase !== 'night') {
      this.noises.length = 0;
      return;
    }
    st.shiftTick++;
    const min = this.minutes;
    if (!st.lastCall && min >= LAST_CALL_MIN) {
      st.lastCall = true;
      this.emit({ type: 'lastCall' });
    }
    if (st.lever >= 0 && st.tick - st.lever === LEVER_CONFIRM_TICKS) this.emit({ type: 'leverReset' });
    if (world) this.tickCreatures(world, min);
    this.noises.length = 0;
    if (st.phase === 'night' && st.wipeAt >= 0 && st.tick >= st.wipeAt) this.depart('wiped');
    if (st.phase === 'night' && min >= SHIFT_MIN) this.depart('governor');
  }

  // ---- creatures ---------------------------------------------------------------------------------

  creatureCtx(world, min) {
    const st = this.state;
    if (!this._ctx || this._ctx.world !== world) {
      this._ctx = {
        world,
        emit: (e) => this.emit(e),
        kill: (pid, cause, s) => this.kill(pid, cause, s),
        tmp: this.tmp,
      };
    }
    const c = this._ctx;
    c.seed = world.layout?.seed || 0;
    c.tick = st.tick;
    c.min = min;
    c.players = Object.values(st.players);
    c.items = st.items;
    c.noises = this.noises;
    if (c.layout !== world.layout) {
      c.layout = world.layout;
      c.cells = world.layout ? [...world.layout.cells.values()] : [];
    }
    c.hazard = SITES[st.site.siteId].hazard;
    return c;
  }

  tickCreatures(world, min) {
    const st = this.state;
    const ctx = this.creatureCtx(world, min);
    // who has been on their own, and for how long
    const alive = ctx.players.filter((p) => p.alive);
    for (const p of alive) {
      const company = alive.some((q) => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 6);
      if (inVan(p.x, p.z) || company) p.alone = 0;
      else p.alone += 1 / TICK_HZ;
    }
    // arrivals on the night's schedule
    for (const e of st.schedule) {
      if (e.done || min < e.at) continue;
      e.done = true;
      this.spawn(e.type, ctx);
    }
    // the Plus-One comes for whoever has been alone too long (after 22:00)
    if (min > 60 && st.tick % 30 === 0) {
      const limit = ALONE_LIMIT[ctx.hazard] || 150;
      for (const p of alive) {
        if (p.alone < limit || st.creatures.some((c) => c.type === 'plusOne' && c.prey === p.pid)) continue;
        const spot = this.behind(ctx, p);
        if (spot) this.spawn('plusOne', ctx, { ...spot, pid: p.pid });
      }
    }
    for (const s of st.creatures) CREATURES[s.type].tick(s, ctx);
    const gone = st.creatures.filter((s) => s.gone);
    if (gone.length) {
      st.creatures = st.creatures.filter((s) => !s.gone);
      for (const s of gone) this.emit({ type: 'vanish', creature: s.id, creatureType: s.type });
    }
  }

  spawn(type, ctx, spot = null) {
    const st = this.state;
    const s0 = { id: `c${st.nextId++}`, type };
    if (type === 'stocktaker') spot = this.layPile(ctx, s0);
    if (!spot) spot = spawnSpot(ctx, s0, type);
    if (!spot) return null;
    const s = { ...CREATURES[type].create(ctx, spot), ...s0 };
    st.creatures.push(s);
    this.emit({ type: 'arrive', creature: s.id, creatureType: type, x: s.x, z: s.z });
    return s;
  }

  /** The Stocktaker's post: a pile of better-than-usual stock in a deep bay. */
  layPile(ctx, s0) {
    const st = this.state;
    const site = SITES[st.site.siteId];
    const base = spawnSpot(ctx, s0, 'pile');
    if (!base) return null;
    const w = ctx.world;
    const rng = new RNG(hash(ctx.seed, s0.id, 'pile'));
    const owned = [];
    for (let k = 0; k < 6 && owned.length < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rng.float(-0.3, 0.3);
      const r = k === 0 ? 0 : rng.float(0.35, 0.65);
      const x = base.x + Math.cos(a) * r;
      const z = base.z + Math.sin(a) * r;
      if (!w.isWalkable(x, z)) continue;
      // the pile is weighted to the heavier, better stock on the writ's list
      const type = rng.weighted(site.loot.map(([t, wt]) => [t, wt * (ITEMS[t].value[1] / 20)]));
      const [v0, v1] = ITEMS[type].value;
      const id = `${s0.id}:${k}`;
      st.items.push({ id, type, value: Math.round(rng.float(v0, v1) * siteValueK(site.id) * 1.4), x: +x.toFixed(3), y: 0, z: +z.toFixed(3), yaw: +rng.float(0, 6.28).toFixed(3), holder: null, slot: 0, dropped: 0 });
      owned.push(id);
    }
    if (!owned.length) return null;
    // it stands a pace off the pile, on the side with room
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const x = base.x + Math.cos(a) * 1.15;
      const z = base.z + Math.sin(a) * 1.15;
      if (w.isWalkable(x, z) && w.isWalkable(x + 0.3, z) && w.isWalkable(x - 0.3, z)) return { x, z, pile: base, owned };
    }
    return { x: base.x + 0.9, z: base.z, pile: base, owned };
  }

  /** A spot a little behind a player, out of their sight, for the Plus-One. */
  behind(ctx, p) {
    const w = ctx.world;
    for (let k = 0; k < 14; k++) {
      const a = p.yaw + Math.PI + (roll(ctx, { id: p.pid }, 'ba' + k) - 0.5) * 2.2;
      const d = 7 + roll(ctx, { id: p.pid }, 'bd' + k) * 6;
      const x = p.x - Math.sin(a) * d;
      const z = p.z - Math.cos(a) * d;
      if (!w.isWalkable(x, z) || inVan(x, z)) continue;
      if (w.lineOfSight(p.x, p.z, x, z, 1.2)) continue;
      if (!w.findPath(x, z, p.x, p.z, 1500)) continue;
      return { x, z };
    }
    return null;
  }

  /** Clocked out: the player drops everything where they fall. */
  kill(pid, cause, creature = null) {
    const st = this.state;
    const p = st.players[pid];
    if (!p || !p.alive || st.phase !== 'night') return;
    p.alive = false;
    st.dead.push({ pid, cause, min: this.minutes });
    let k = 0;
    for (const it of st.items) {
      if (it.holder !== pid) continue;
      const a = k++ * 2.1;
      it.holder = null;
      it.x = +(p.x + Math.cos(a) * 0.35).toFixed(3);
      it.z = +(p.z + Math.sin(a) * 0.35).toFixed(3);
      it.y = 0;
      if (ITEMS[it.type].fragile) {
        it.value = Math.round(it.value * 0.7);
        it.dropped++;
      }
    }
    this.emit({ type: 'death', pid, cause, creature: creature?.id, x: p.x, z: p.z });
    // nobody left: the governor takes the Strongbox home a few seconds later
    if (!Object.values(st.players).some((q) => q.alive)) st.wipeAt = st.tick + 4 * TICK_HZ;
  }

  /** The Strongbox leaves: bank what is aboard, lose what is not, settle the night. */
  depart(reason) {
    const st = this.state;
    if (st.phase !== 'night') return;
    const players = Object.values(st.players);
    const aboard = new Set(players.filter((q) => q.alive && inVan(q.x, q.z)).map((q) => q.pid));
    const leftBehind = players.filter((q) => q.alive && !aboard.has(q.pid)).map((q) => q.pid);
    const lost = [];
    for (const it of st.items) {
      if (!isLoot(it.type)) continue;
      if ((it.holder && aboard.has(it.holder)) || (!it.holder && inVan(it.x, it.z))) this.bankItem(it);
      else if (it.holder) lost.push({ type: it.type, value: it.value });
    }
    const min = this.minutes;
    const overtime = overtimeFee(Math.min(min, SHIFT_MIN));
    const banked = st.tonight.banked;
    const items = st.tonight.items;
    const dead = st.dead.slice();
    const summary = closeNight(st.run, { banked, items, overtime: reason === 'wiped' ? 0 : overtime, leftBehind, lost, dead }, { solo: this.solo });
    summary.reason = reason;
    summary.dead = dead;
    st.creatures = [];
    summary.leftBehind = leftBehind;
    summary.lost = lost;
    summary.departed = min;
    st.report = summary;
    st.items = [];
    st.phase = 'report';
    this.emit({ type: 'depart', reason, leftBehind });
  }

  /** After the report: back in the van for the next night's brief (or the contract is over). */
  toBrief() {
    const st = this.state;
    if (st.run.over) {
      st.phase = 'over';
      return;
    }
    st.phase = 'brief';
    st.shiftTick = 0;
    st.report = null;
    for (const p of Object.values(st.players)) p.alive = true;
  }

  // ---- views for the HUD -------------------------------------------------------------------------

  carried(pid) {
    const items = this.state.items;
    const sl = slotsOf(items, pid);
    return sl.map((id) => (id ? items.find((i) => i.id === id) : null));
  }
}
