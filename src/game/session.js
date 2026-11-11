// Session: the authoritative simulation of a contract: the run, tonight's phase and clock, every
// item and where it is, the van door and the departure. Plain serializable state, changed only
// by tick() and applyIntent(pid, intent). In co-op the host runs it and the others mirror it.
// No three.js, no DOM.

import { ITEMS, SLOTS, isLoot, freeSlot, slotsOf } from './items.js';
import { closeNight, bank } from './run.js';
import { shiftMinutes, SHIFT_MIN, LAST_CALL_MIN, overtimeFee } from './clock.js';
import { VAN } from '../world/kinds/yard.js';
import { SITES } from '../world/site.js';
import { TICK_HZ } from './constants.js';

export const REACH = 2.3;
const LEVER_CONFIRM_TICKS = TICK_HZ * 4;

/** Is a world point inside the Strongbox's load space? (The yard is cell 0,0.) */
export function inVan(x, z) {
  const v = VAN.inner;
  return x > v.x0 && x < v.x1 && z > v.z0 - 0.2 && z < v.z1;
}

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
    };
    this.events = []; // presentation events since the last drain: { type, ... }
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
    this.state.players[pid] = { pid, name, x: (v.x0 + v.x1) / 2, z: v.z0 + 1.6, yaw: 0, active: 0, alive: true, crouch: false, speed: 0 };
    return this.state.players[pid];
  }

  /** Movement is owned by each player's client; the session keeps a copy for rules. */
  updatePlayer(pid, p) {
    const s = this.state.players[pid];
    if (!s) return;
    s.x = p.x;
    s.z = p.z;
    s.yaw = p.yaw;
    s.crouch = p.crouch > 0.5;
    s.speed = p.speed;
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
    this.emit({ type: 'drop', pid: p.pid, id: it.id, itemType: it.type, x, y, z, broke, kg: ITEMS[it.type].kg });
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
    this.emit({ type: 'doorOpen' });
  }

  tick() {
    const st = this.state;
    st.tick++;
    if (st.phase !== 'night') return;
    st.shiftTick++;
    const min = this.minutes;
    if (!st.lastCall && min >= LAST_CALL_MIN) {
      st.lastCall = true;
      this.emit({ type: 'lastCall' });
    }
    if (st.lever >= 0 && st.tick - st.lever === LEVER_CONFIRM_TICKS) this.emit({ type: 'leverReset' });
    if (min >= SHIFT_MIN) this.depart('governor');
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
    const summary = closeNight(st.run, { banked, items, overtime, leftBehind, lost }, { solo: this.solo });
    summary.reason = reason;
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
