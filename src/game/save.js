// Saves live in localStorage. Export/import codes are the same JSON, base64-encoded.
// Thumbnails (small JPEGs captured from the game the first time something is discovered) are
// kept under a separate key and are not part of the export code, which stays short enough to paste.

const KEY = 'meridian.save.v1';
const THUMBS = 'meridian.thumbs.v1';
const VERSION = 1;

function fresh(seed) {
  return {
    v: VERSION,
    worldSeed: seed,
    // this tape (reset by "new tape")
    player: null, // { x, z, yaw, flashlight, battery }
    visited: {}, // "cx,cz" -> kindId
    maps: {}, // "cx,cz" -> base64 floor/blocked bitmask for the map
    meetings: {}, // cell keys where a resident has already been met
    checkouts: 0,
    tapeSeconds: 0,
    // kept across tapes
    discovered: {}, // "place:<kind>" | "entity:<id>" | "lore:<kind>" -> { at: playSeconds, count }
    log: [], // [{ key, text, kind }]
    lore: {}, // kindId -> true once read
    playSeconds: 0,
    settings: { sensitivity: 1, volume: 0.9 },
  };
}

const TAPE_FIELDS = ['player', 'visited', 'maps', 'meetings', 'checkouts', 'tapeSeconds'];

export class Save {
  constructor() {
    this.data = this.load() || fresh(this.newSeed());
    this.thumbs = this.loadThumbs();
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

  /** Start a new tape: a new world, but discoveries, the logbook and settings carry over. */
  newTape(seed = this.newSeed()) {
    const keep = this.data;
    this.data = fresh(seed);
    for (const k of Object.keys(keep)) if (!TAPE_FIELDS.includes(k) && k !== 'worldSeed') this.data[k] = keep[k];
    this.write();
  }

  /** Forget everything except settings. */
  reset(seed = this.newSeed()) {
    const settings = this.data.settings;
    this.data = fresh(seed);
    this.data.settings = settings;
    this.thumbs = {};
    this.writeThumbs();
    this.write();
  }

  isDiscovered(key) {
    return !!this.data.discovered[key];
  }

  /** Record a discovery; returns true the first time. */
  markDiscovered(key) {
    const d = this.data.discovered;
    if (d[key]) {
      d[key].count++;
      return false;
    }
    d[key] = { at: Math.round(this.data.playSeconds), count: 1 };
    this.write();
    return true;
  }

  loadThumbs() {
    try {
      return JSON.parse(localStorage.getItem(THUMBS) || '{}') || {};
    } catch {
      return {};
    }
  }

  writeThumbs() {
    try {
      localStorage.setItem(THUMBS, JSON.stringify(this.thumbs));
    } catch {
      /* storage full: thumbnails are optional */
    }
  }

  setThumb(key, dataUrl) {
    this.thumbs[key] = dataUrl;
    this.writeThumbs();
  }

  /** ML2- codes are deflated JSON in base64 (ML1- is plain JSON, still accepted). */
  async exportCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(this.data));
    if (typeof CompressionStream === 'undefined') return 'ML1-' + toB64(bytes);
    const packed = await pipe(bytes, new CompressionStream('deflate-raw'));
    return 'ML2-' + toB64(packed);
  }

  async importCode(code) {
    try {
      const clean = code.trim().replace(/\s+/g, '');
      let bytes;
      if (clean.startsWith('ML2-')) bytes = await pipe(fromB64(clean.slice(4)), new DecompressionStream('deflate-raw'));
      else bytes = fromB64(clean.replace(/^ML1-/, ''));
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

function toB64(bytes) {
  let bin = '';
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
  return btoa(bin);
}

function fromB64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Pack a cell's floor and blocked tiles into a base64 string for the map (2 x 128 bytes). */
export function packCellMask(cell, n) {
  const bytes = new Uint8Array((n * n) / 4);
  const half = (n * n) / 8;
  for (let k = 0; k < n * n; k++) {
    if (cell.tiles[k] !== 0) bytes[k >> 3] |= 1 << (k & 7);
    if (cell.blocked[k] === 1) bytes[half + (k >> 3)] |= 1 << (k & 7);
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function unpackCellMask(str, n) {
  const bin = atob(str);
  const half = (n * n) / 8;
  const floor = new Uint8Array(n * n);
  const blocked = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) {
    floor[k] = (bin.charCodeAt(k >> 3) >> (k & 7)) & 1;
    blocked[k] = (bin.charCodeAt(half + (k >> 3)) >> (k & 7)) & 1;
  }
  return { floor, blocked };
}
