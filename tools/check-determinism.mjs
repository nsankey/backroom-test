// Determinism + connectivity check for the world generator (runs in Node, no browser).
//  - every kind, many seeds: all boundary doors reachable (no "unreachable doors" notes)
//  - the same (seed, cell) generates byte-identical output twice
//  - a fixed fingerprint for seed 1979 so changes to generation are visible in review
// Usage: node tools/check-determinism.mjs [cellsPerKind]

import { generateCell } from '../src/world/gen.js';
import { KIND_LIST } from '../src/world/kinds/index.js';
import { hashStr } from '../src/core/rng.js';
import { readFileSync } from 'node:fs';

const perKind = Number(process.argv[2] || 40);

function fingerprint(data) {
  let h = 0;
  const mix = (s) => (h = hashStr(h + ':' + s));
  for (const m of data.meshes) {
    mix(m.mat);
    for (const arr of [m.position, m.bakeA, m.bakeB, m.index]) {
      // sample every 7th value to keep it quick but sensitive
      let s = 0;
      for (let k = 0; k < arr.length; k += 7) s = (s * 31 + Math.round(arr[k] * 1000)) | 0;
      mix(arr.length + '/' + s);
    }
  }
  mix(Array.from(data.tiles).join(''));
  mix(JSON.stringify(data.colliders));
  mix(JSON.stringify(data.interactions));
  return (h >>> 0).toString(16);
}

let failures = 0;
const t0 = Date.now();
for (const kind of KIND_LIST) {
  let notes = 0;
  let ms = 0;
  let tris = 0;
  let dark = 0;
  for (let k = 0; k < perKind; k++) {
    const seed = 1000 + k * 7919;
    const cx = (k % 7) - 3;
    const cz = Math.floor(k / 7) - 3;
    const a = generateCell(seed, cx, cz, { kindOverride: kind.id }).data;
    ms += a.ms;
    tris += a.meshes.reduce((s, m) => s + m.index.length / 3, 0);
    // "the lights never turned off": share of walkable tiles with no light within 4.5 m
    let walk = 0;
    let darkN = 0;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) {
        const t = j * 32 + i;
        if (!a.tiles[t] || a.blocked[t]) continue;
        walk++;
        const x = (i + 0.5) * 0.5;
        const z = (j + 0.5) * 0.5;
        if (!a.lights.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 4.5 * 4.5)) darkN++;
      }
    dark += darkN / (walk || 1);
    if (a.notes.length) {
      notes++;
      if (notes <= 3) console.log(`  ${kind.id} seed ${seed} cell ${cx},${cz}: ${a.notes.join('; ')}`);
    }
    if (k < 4) {
      const b = generateCell(seed, cx, cz, { kindOverride: kind.id }).data;
      if (fingerprint(a) !== fingerprint(b)) {
        console.log(`  NON-DETERMINISTIC: ${kind.id} seed ${seed} cell ${cx},${cz}`);
        failures++;
      }
    }
  }
  if (notes) failures++;
  console.log(
    `${notes ? 'FAIL' : 'ok  '} ${kind.id.padEnd(14)} ${perKind} cells, ${notes} with problems, ` +
      `avg ${(ms / perKind).toFixed(0)} ms, avg ${Math.round(tris / perKind)} tris, ${((dark / perKind) * 100).toFixed(1)}% dark tiles`,
  );
}

// lore: every kind has exactly one found document, and every kind places its lore stand
const lore = JSON.parse(readFileSync(new URL('../lore/fragments.json', import.meta.url), 'utf8'));
for (const kind of KIND_LIST) {
  const doc = lore.fragments[kind.id];
  const words = doc ? doc.body.split(/\s+/).length : 0;
  const placed = generateCell(1979, 0, 0, { kindOverride: kind.id }).data.interactions.some((i) => i.type === 'readLore');
  if (!doc || !doc.log || !doc.head || !placed) {
    console.log(`  LORE: ${kind.id} ${doc ? '' : 'has no fragment '}${placed ? '' : 'places no document'}`);
    failures++;
  } else if (words > 140) console.log(`  lore note: ${kind.id} body is ${words} words (rule: ~120)`);
}
for (const id of Object.keys(lore.fragments)) if (!KIND_LIST.some((k) => k.id === id)) console.log(`  lore note: fragment for unknown kind ${id}`);

// world fingerprint: a 5 x 5 patch of seed 1979
let world = '';
for (let cz = -2; cz <= 2; cz++) for (let cx = -2; cx <= 2; cx++) world += fingerprint(generateCell(1979, cx, cz).data);
console.log(`world fingerprint (seed 1979, 5x5): ${hashStr(world).toString(16)}`);
console.log(`${failures ? 'FAILED' : 'PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
