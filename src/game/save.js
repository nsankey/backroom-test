// Saves live in localStorage. A contract is checkpointed in the van before each night (a night
// abandoned halfway is a night not worked). Export/import codes are the same JSON, deflated and
// base64-encoded.

const KEY = 'nightreceivers.save.v1';
const VERSION = 1;
const PREFIX = 'NR1-';

function fresh() {
  return {
    v: VERSION,
    run: null, // the contract in progress, as it stood at the last brief
    records: { nights: 0, paid: 0, banked: 0, contracts: 0 }, // best across contracts
    settings: { sensitivity: 1, volume: 0.9 },
  };
}

export class Save {
  constructor() {
    this.data = this.load() || fresh();
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
      return { ...fresh(), ...d };
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

  /** Store the contract as it stands (called in the van, before a night). */
  checkpoint(run) {
    this.data.run = JSON.parse(JSON.stringify(run));
    this.write();
  }

  /** The contract has ended: keep the records, forget the run. */
  endContract(run) {
    const r = this.data.records;
    r.nights = Math.max(r.nights, run.history.length);
    r.paid = Math.max(r.paid, run.paid);
    r.banked = Math.max(r.banked, run.banked);
    r.contracts++;
    this.data.run = null;
    this.write();
  }

  reset() {
    const settings = this.data.settings;
    this.data = fresh();
    this.data.settings = settings;
    this.write();
  }

  async exportCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(this.data));
    const packed = typeof CompressionStream === 'undefined' ? bytes : await pipe(bytes, new CompressionStream('deflate-raw'));
    return (typeof CompressionStream === 'undefined' ? 'NR0-' : PREFIX) + toB64(packed);
  }

  async importCode(code) {
    try {
      const clean = code.trim().replace(/\s+/g, '');
      let bytes;
      if (clean.startsWith(PREFIX)) bytes = await pipe(fromB64(clean.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
      else if (clean.startsWith('NR0-')) bytes = fromB64(clean.slice(4));
      else return false;
      const d = JSON.parse(new TextDecoder().decode(bytes));
      if (!d || d.v !== VERSION) return false;
      this.data = { ...fresh(), ...d };
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
