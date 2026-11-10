// Saves live in localStorage. Export/import codes are the same JSON, base64-encoded.

const KEY = 'meridian.save.v1';
const VERSION = 1;

function fresh(seed) {
  return {
    v: VERSION,
    worldSeed: seed,
    player: null,
    discovered: {}, // kindId -> { first: tick, count }
    log: [], // [{ key, text, kind }]
    lore: {}, // kindId -> true once read
    visited: {}, // "cx,cz" -> kindId
    meetings: {}, // entity encounters
    playSeconds: 0,
    settings: { sensitivity: 1, volume: 0.9 },
  };
}

export class Save {
  constructor() {
    this.data = this.load() || fresh(this.newSeed());
  }

  newSeed() {
    // the one place we need fresh randomness: picking a new world seed
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % 1000000;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || d.v !== VERSION) return null;
      return { ...fresh(d.worldSeed), ...d };
    } catch {
      return null;
    }
  }

  write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  reset(seed = this.newSeed()) {
    const settings = this.data.settings;
    this.data = fresh(seed);
    this.data.settings = settings;
    this.write();
  }

  exportCode() {
    const json = JSON.stringify(this.data);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return 'ML1-' + btoa(bin);
  }

  importCode(code) {
    try {
      const body = code.trim().replace(/^ML1-/, '');
      const bin = atob(body);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const d = JSON.parse(new TextDecoder().decode(bytes));
      if (!d || d.v !== VERSION || typeof d.worldSeed !== 'number') return false;
      this.data = { ...fresh(d.worldSeed), ...d };
      this.write();
      return true;
    } catch {
      return false;
    }
  }
}
