// Entity system: runs hunters and residents on the shared tick, dims the lights around
// hunters, and keeps their views (meshes, loops) in sync each frame.

import { HUNTERS, RESIDENTS, ENTITIES } from '../entities/index.js';
import { CELL } from '../world/constants.js';

let nextId = 1;

export class EntitySystem {
  constructor(game) {
    this.game = game;
    this.states = [];
    this.views = new Map();
    this.spawnedCells = new Set();
    this.light = [0, 0, 0];
    this.lightTick = new Map();
  }

  ctx() {
    const g = this.game;
    return {
      world: g.world,
      player: g.player,
      seed: g.worldSeed,
      tick: g.tick,
      events: this.events || [],
      checkingOut: !!g.checkingOut,
      checkOut: (why) => g.checkOut(why),
      onChase: () => g.audio.play('sting', null, { wet: 0.2 }),
      findOpenSpot: (cell, p) => g.findOpenSpot(cell, p),
    };
  }

  tick(game, actions, events) {
    this.events = events;
    const ctx = this.ctx();
    // the closed mall is empty: nothing hunts there (they walk one floor only), and one that
    // followed you in loses you at the doors
    const inMall = game.currentCell?.kindId === 'fiesta';
    if (inMall) for (const s of this.states.filter((x) => ENTITIES[x.type].role === 'hunter')) this.remove(s);
    // hunters arrive on a schedule
    // (only one at a time: a second one waits for its next window)
    for (const h of inMall ? [] : HUNTERS) {
      if (this.states.some((s) => ENTITIES[s.type].role === 'hunter')) break;
      if (game.debugNoHunters) continue;
      if (h.schedule(game.worldSeed, game.tick) || game.forceHunter === h.id) {
        game.forceHunter = null;
        const s = h.spawn(ctx);
        if (s) this.add(s);
      }
    }
    for (const s of this.states) ENTITIES[s.type].tick(s, ctx);
    for (const s of this.states.filter((x) => x.done)) this.remove(s);

    // brownout: every loaded cell dims toward the nearest hunter's influence
    for (const cell of game.world.cells.values()) {
      let target = 1;
      for (const s of this.states) {
        const mod = ENTITIES[s.type];
        if (!mod.dimAt) continue;
        const nx = Math.max(cell.ox, Math.min(s.x, cell.ox + CELL));
        const nz = Math.max(cell.oz, Math.min(s.z, cell.oz + CELL));
        target = Math.min(target, mod.dimAt(s, Math.hypot(nx - s.x, nz - s.z)));
      }
      const u = cell.uniforms.uDim;
      u.value += (target - u.value) * 0.03;
    }
  }

  cellRemoved(game, cell) {
    for (const s of this.states.filter((x) => x.cellKey === cell.key)) this.remove(s);
    this.spawnedCells.delete(cell.key);
  }

  enterCell(game, cell) {
    this.cellAdded(game, cell);
  }

  cellAdded(game, cell) {
    if (!cell || this.spawnedCells.has(cell.key) || !game.player) return;
    this.spawnedCells.add(cell.key);
    if (game.save.data.meetings[cell.key] || cell.kindId === 'fiesta') return;
    for (const r of RESIDENTS) {
      if (this.states.some((s) => s.type === r.id)) continue;
      if (this.states.some((s) => s.cellKey === cell.key)) break; // one resident per place
      // also consider the neighbours that just streamed in, so he's there when you arrive
      if (r.appearsIn(game.worldSeed, cell)) {
        const s = r.spawn(this.ctx(), cell);
        if (s) this.add(s);
      }
    }
  }

  add(s) {
    s.id = nextId++;
    this.states.push(s);
  }

  remove(s) {
    this.states = this.states.filter((x) => x !== s);
    const v = this.views.get(s.id);
    if (v) {
      this.game.scene.remove(v.object);
      v.dispose();
      this.views.delete(s.id);
    }
    if (s.cellKey && ENTITIES[s.type].role === 'resident' && s.phase !== 'idle') this.game.save.data.meetings[s.cellKey] = true;
  }

  interactions() {
    const out = [];
    for (const s of this.states) {
      const mod = ENTITIES[s.type];
      if (mod.interactions) out.push(...mod.interactions(s));
    }
    return out;
  }

  onInteract(game, near) {
    const s = near.it.entity;
    if (!s) return false;
    ENTITIES[s.type].interact(s, game.moments.ctx(null, { x: s.x, y: 1.5, z: s.z }));
    return true;
  }

  frame(game, dt, alpha) {
    const t = game.time;
    let nearest = Infinity;
    for (const s of this.states) {
      const mod = ENTITIES[s.type];
      let v = this.views.get(s.id);
      if (!v) {
        v = mod.view(game);
        this.views.set(s.id, v);
        game.scene.add(v.object);
      }
      // sample environment light at ~10 Hz
      const last = this.lightTick.get(s.id) || -1;
      if (game.tick - last >= 6 || !v.light) {
        v.light = [...game.world.lightAt(s.x, 1.2, s.z, this.light)];
        const k = this.darkAt(s.x, s.z);
        for (let c = 0; c < 3; c++) v.light[c] *= k;
        this.lightTick.set(s.id, game.tick);
      }
      v.update(s, alpha, v.light, t);
      const p = game.player;
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (mod.role === 'hunter') nearest = Math.min(nearest, d);
      // first clear sight of an occupant goes on the discoveries screen
      if (!game.paused && d < 12 && game.tick % 10 === 0 && !game.save.isDiscovered('entity:' + s.type)) {
        const facing = ((s.x - p.x) * -Math.sin(p.yaw) + (s.z - p.z) * -Math.cos(p.yaw)) / (d || 1);
        if (facing > 0.8 && game.world.lineOfSight(p.x, p.z, s.x, s.z, 1.0)) game.discoverThing('entity:' + s.type, mod.card, undefined, 0.15);
      }
    }
    // the tape warps as a hunter closes in
    const k = nearest === Infinity ? 0 : Math.max(0, Math.min(1, (16 - nearest) / 13));
    const u = game.cam.uniforms;
    u.uTracking.value += (k * 0.9 - u.uTracking.value) * Math.min(1, dt * 3);
    u.uDistort.value += (k * k * 0.6 - u.uDistort.value) * Math.min(1, dt * 3);
  }

  /** Fraction of the environment light that survives at (x, z): hunters that put lights out. */
  darkAt(x, z) {
    let k = 1;
    for (const s of this.states) {
      const mod = ENTITIES[s.type];
      if (mod.darkAt) k = Math.min(k, mod.darkAt(s, x, z));
    }
    return k;
  }

  isHunter(s) {
    return ENTITIES[s.type]?.role === 'hunter';
  }

  clear() {
    for (const s of [...this.states]) this.remove(s);
    this.spawnedCells.clear();
  }
}
