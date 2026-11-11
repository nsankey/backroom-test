// Co-op over the crew relay (server/): one browser is the crew chief and runs the Session; the
// others mirror it. Crew send their movement (30 Hz) and intents; the chief applies them, ticks
// the rules, and sends a snapshot of the whole session state with the events since the last
// one (15 Hz). Presentation already eases toward state, so snapshots look smooth enough.

import { MP_URL } from './constants.js';

const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels: no words in room codes
const SNAP_EVERY = 4; // ticks (60 Hz) between snapshots: 15 Hz
const MOVE_EVERY = 2; // ticks between a crew member's movement updates: 30 Hz

export const coopAvailable = () => !!MP_URL;

export function roomCode() {
  let s = '';
  for (let k = 0; k < 4; k++) s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return s;
}

/** Plain session state as sent over the wire (creature paths are the host's business). */
function wire(state) {
  return JSON.stringify(state, (k, v) => (k === 'path' ? undefined : v));
}

/** A socket to the relay for room `code`. Resolves once the relay says hello. */
export function connect(code, { host = false, name = '' } = {}) {
  return new Promise((resolve, reject) => {
    const base = MP_URL.replace(/\/$/, '');
    const url = `${base}/room/${code}${host ? '?role=host' : `?name=${encodeURIComponent(name)}`}`;
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      reject(new Error('relay unreachable'));
      return;
    }
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('relay did not answer'));
    }, 6000);
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('relay unreachable'));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      clearTimeout(timer);
      if (m.t === 'refused') reject(new Error(m.why));
      else if (m.t === 'hello') {
        ws.onmessage = null;
        ws.onerror = null;
        resolve({ ws, pid: m.pid, code });
      }
    };
  });
}

/** The crew chief's side: applies the crew's movement and intents, sends the state. */
export class CoopHost {
  constructor(game, { ws, code }) {
    this.game = game;
    this.ws = ws;
    this.code = code;
    this.host = true;
    this.client = false;
    this.moves = new Map(); // pid -> latest movement
    this.intents = []; // [pid, intent]
    this.out = []; // events since the last snapshot
    this.n = 0;
    ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    ws.onclose = () => {
      this.closed = true;
      game.onCoopEvent?.({ type: 'relayLost' });
    };
  }

  get crew() {
    return Object.keys(this.game.session?.state.players || {}).length;
  }

  receive(m) {
    const g = this.game;
    const s = g.session;
    if (!s) return;
    if (m.t === 'joined') {
      s.addPlayer(m.pid, m.name || `R-${m.pid.slice(1)}`);
      this.welcome(m.pid);
      g.onCoopEvent?.({ type: 'joined', pid: m.pid });
    } else if (m.t === 'left') {
      s.removePlayer(m.pid);
      this.moves.delete(m.pid);
      g.onCoopEvent?.({ type: 'left', pid: m.pid });
    } else if (m.t === 'from') {
      const msg = JSON.parse(m.m);
      if (msg.t === 'move') this.moves.set(m.pid, msg.p);
      else if (msg.t === 'intent') this.intents.push([m.pid, msg.i]);
    }
  }

  welcome(pid) {
    this.send({ to: pid, t: 'welcome', pid, st: '@' });
  }

  /** Before the rules tick: the crew's movement and what they asked to do. */
  beforeTick() {
    const s = this.game.session;
    for (const [pid, p] of this.moves) s.updatePlayer(pid, p);
    const list = this.intents;
    this.intents = [];
    for (const [pid, i] of list) s.applyIntent(pid, i);
  }

  /** After it: events go out with the next snapshot. */
  queue(events) {
    if (events.length) this.out.push(...events);
  }

  afterTick() {
    if (++this.n % SNAP_EVERY !== 0 && !this.urgent()) return;
    this.send({ t: 'snap', st: '@', ev: this.out });
    this.out = [];
  }

  /** Phase changes and deaths go out at once. */
  urgent() {
    return this.out.some((e) => e.type === 'travel' || e.type === 'depart' || e.type === 'death' || e.type === 'doorOpen');
  }

  /** Send now (used when the phase changes outside a tick, e.g. after the manifest). */
  flush() {
    this.send({ t: 'snap', st: '@', ev: this.out });
    this.out = [];
  }

  send(msg) {
    if (this.closed || this.ws.readyState !== 1 || this.crew < 2) return;
    // the state is spliced in as raw JSON so it is serialized once per message
    const json = JSON.stringify(msg).replace('"@"', () => wire(this.game.session.state));
    this.ws.send(json);
  }

  close() {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* gone */
    }
  }
}

/** A crew member's side: sends movement and intents, takes the chief's state. */
export class CoopClient {
  constructor(game, { ws, code, pid }) {
    this.game = game;
    this.ws = ws;
    this.code = code;
    this.pid = pid;
    this.host = false;
    this.client = true;
    this.events = [];
    this.n = 0;
    this.welcomed = null; // resolves with the first state
    this.ready = new Promise((resolve, reject) => {
      this.welcomed = (st) => {
        this.welcomed = null;
        resolve(st);
      };
      this.notWelcome = reject;
    });
    ws.onmessage = (e) => this.receive(JSON.parse(e.data));
    ws.onclose = () => {
      this.closed = true;
      if (this.welcomed) return this.notWelcome(new Error('The crew chief went off the line before you were aboard.'));
      game.onCoopEvent?.({ type: this.hostLeft ? 'hostLeft' : 'relayLost' });
    };
  }

  receive(m) {
    if (m.t === 'hostLeft') {
      this.hostLeft = true;
      return;
    }
    if (m.t === 'welcome') {
      this.welcomed?.(m.st);
      return;
    }
    if (m.t === 'snap') {
      const s = this.game.session;
      if (s) s.state = m.st;
      if (m.ev?.length) this.events.push(...m.ev);
      this.lastSnap = performance.now();
    }
  }

  intent(i) {
    this.send({ t: 'intent', i });
    return true;
  }

  /** Each tick: send where we are; hand back the events that arrived. */
  tick(p) {
    if (++this.n % MOVE_EVERY === 0) this.send({ t: 'move', p: { x: +p.x.toFixed(3), z: +p.z.toFixed(3), yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3), crouch: p.crouch, speed: p.speed, still: p.still || 0 } });
    const ev = this.events;
    this.events = [];
    return ev;
  }

  send(msg) {
    if (!this.closed && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* gone */
    }
  }
}
