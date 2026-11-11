// Determinism + connectivity check for the site generator (runs in Node, no browser).
//  - every site, many seeds and nights: a finite, connected building with the yard at (0,0)
//  - every kind, forced into many real cells: all boundary doors reachable, enough loot spots
//  - the same (site context, cell) generates byte-identical output twice
//  - a fixed fingerprint for seed 1979 so changes to generation are visible in review
// Usage: node tools/check-determinism.mjs [layoutsPerSite]

import { generateCell } from '../src/world/gen.js';
import { KIND_LIST } from '../src/world/kinds/index.js';
import { SITE_LIST, siteLayout } from '../src/world/site.js';
import { hashStr } from '../src/core/rng.js';

const perSite = Number(process.argv[2] || 12);

function fingerprint(data) {
  let h = 0;
  const mix = (s) => (h = hashStr(h + ':' + s));
  for (const m of data.meshes) {
    mix(m.mat);
    for (const arr of [m.position, m.bakeA, m.bakeB, m.index]) {
      let s = 0;
      for (let k = 0; k < arr.length; k += 7) s = (s * 31 + Math.round(arr[k] * 1000)) | 0;
      mix(arr.length + '/' + s);
    }
  }
  mix(Array.from(data.tiles).join(''));
  mix(JSON.stringify(data.colliders));
  mix(JSON.stringify(data.interactions));
  mix(JSON.stringify(data.lootSpots));
  return (h >>> 0).toString(16);
}

let failures = 0;
const t0 = Date.now();

// 1. site layouts: finite, connected, sized as the writ says
const contexts = [];
for (const site of SITE_LIST) {
  let bad = 0;
  let cells = 0;
  for (let k = 0; k < perSite; k++) {
    const worldSeed = 1000 + k * 7919;
    const night = 1 + (k % 4);
    const L = siteLayout(worldSeed, site.id, night);
    const again = siteLayout(worldSeed + 0, site.id, night);
    if (L !== again) bad++;
    cells += L.cells.size;
    // BFS through doors from the yard
    const seen = new Set(['0,0']);
    const q = ['0,0'];
    while (q.length) {
      const c = L.cells.get(q.shift());
      for (const [d, [dx, dz]] of Object.entries({ N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] })) {
        if (!c.doors[d]) continue;
        const nk = `${c.cx + dx},${c.cz + dz}`;
        if (!L.cells.has(nk)) {
          console.log(`  ${site.id} seed ${worldSeed}: door ${d} of ${c.cx},${c.cz} leads outside the site`);
          bad++;
          continue;
        }
        if (!seen.has(nk)) seen.add(nk), q.push(nk);
      }
    }
    if (seen.size !== L.cells.size) {
      console.log(`  ${site.id} seed ${worldSeed}: ${L.cells.size - seen.size} cells unreachable`);
      bad++;
    }
    const n = L.cells.size - 1;
    if (n < site.cells[0] || n > site.cells[1]) {
      console.log(`  ${site.id} seed ${worldSeed}: ${n} facility cells (writ says ${site.cells.join('-')})`);
      bad++;
    }
    contexts.push({ ctx: { worldSeed, siteId: site.id, night }, L });
  }
  if (bad) failures++;
  console.log(`${bad ? 'FAIL' : 'ok  '} site ${site.id.padEnd(10)} ${perSite} layouts, avg ${(cells / perSite).toFixed(1)} cells`);
}

// 2. kinds: every kind generated in many real cells (natural, and forced into other cells)
for (const kind of KIND_LIST) {
  let notes = 0;
  let ms = 0;
  let tris = 0;
  let dark = 0;
  let loot = 0;
  let n = 0;
  let fewLoot = 0;
  for (let k = 0; k < contexts.length; k++) {
    const { ctx, L } = contexts[k];
    const all = [...L.cells.values()];
    // the yard only ever sits at (0,0); the dock only at (0,-1); other kinds go anywhere inside
    const cell = kind.id === 'yard' ? L.cells.get('0,0') : kind.id === 'dock' ? L.cells.get('0,-1') : all.filter((c) => c.kindId !== 'yard')[k % (all.length - 1)];
    const a = generateCell(ctx, cell.cx, cell.cz, { kindOverride: kind.id }).data;
    n++;
    ms += a.ms;
    tris += a.meshes.reduce((s, m) => s + m.index.length / 3, 0);
    loot += a.lootSpots.length;
    if (kind.id !== 'yard' && a.lootSpots.length < 3) fewLoot++;
    let walk = 0;
    let darkN = 0;
    for (let j = 0; j < 32; j++)
      for (let i = 0; i < 32; i++) {
        const t = j * 32 + i;
        if (!a.tiles[t] || a.blocked[t]) continue;
        walk++;
        const x = (i + 0.5) * 0.5;
        const z = (j + 0.5) * 0.5;
        if (!a.lights.some((l) => l.power > 0 && (l.x - x) ** 2 + (l.z - z) ** 2 < 5 * 5)) darkN++;
      }
    dark += darkN / (walk || 1);
    if (a.notes.length) {
      notes++;
      if (notes <= 3) console.log(`  ${kind.id} ${ctx.siteId} seed ${ctx.worldSeed} cell ${cell.cx},${cell.cz}: ${a.notes.join('; ')}`);
    }
    if (k < 3) {
      const b = generateCell(ctx, cell.cx, cell.cz, { kindOverride: kind.id }).data;
      if (fingerprint(a) !== fingerprint(b)) {
        console.log(`  NON-DETERMINISTIC: ${kind.id} ${ctx.siteId} seed ${ctx.worldSeed} cell ${cell.cx},${cell.cz}`);
        failures++;
      }
    }
  }
  if (notes || fewLoot > n * 0.1) failures++;
  console.log(
    `${notes || fewLoot > n * 0.1 ? 'FAIL' : 'ok  '} ${kind.id.padEnd(10)} ${n} cells, ${notes} with problems, ` +
      `avg ${(ms / n).toFixed(0)} ms, ${Math.round(tris / n)} tris, ${(loot / n).toFixed(1)} loot spots` +
      `${fewLoot ? ` (${fewLoot} with < 3)` : ''}, ${((dark / n) * 100).toFixed(1)}% unlit tiles`,
  );
}

// 3. fingerprint: every cell of the first night of each site, seed 1979
let world = '';
for (const site of SITE_LIST) {
  const ctx = { worldSeed: 1979, siteId: site.id, night: 1 };
  for (const c of siteLayout(1979, site.id, 1).cells.values()) world += fingerprint(generateCell(ctx, c.cx, c.cz).data);
}
console.log(`world fingerprint (seed 1979, night 1, all sites): ${hashStr(world).toString(16)}`);
console.log(`${failures ? 'FAILED' : 'PASSED'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
