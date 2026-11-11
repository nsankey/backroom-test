# Progress: Night Receivers (the `salvage` experiment)

A co-op scavenging horror game on the Meridian Lodge engine: a crew of debtors working for
Grisholm & Daughters, Receivers and Liquidators, clears the abandoned facilities of the defunct
Halvard Combine one night at a time to pay the Instalment. Premise in docs/ORIGIN.md (secret),
look and sound in docs/STYLE.md. The earlier game's progress log is in git history on `main`.

## Status

| Step | State |
| --- | --- |
| 0. Branch, premise, world | done: finite sites, 8 facility kinds, Halvard textures and props |
| 1. Loop without threats | done: van brief, writs, night clock, loot, carrying, night safe, departure, Instalment, fail screen |
| 2. Threats | not started |
| 3. Tools | not started |
| 4. Co-op (local) | not started |

## How to run

```
npm install
npx vite --port 5187
```

Open http://localhost:5187. URL flags: `?debug` (fps and cell readout), `?fresh` (wipe the
save), `?seed=N` (seed for a new contract), `?autostart` (skip the title), `?shift=120` (a
shift of 120 real seconds instead of 540).

Console hooks (`__game`): `debugView(x, z, yaw, pitch)` renders one frame from a spot and
freezes it in an overlay; `await debugSave('name')` writes that frame to `shots/name.jpg`;
`await debugRun(secs, until)` steps frames by hand (use it when the browser pane is hidden and
animation frames stall); `debugClock('03:59')` jumps the shift clock; `benchmark(60)` returns
GPU-synced ms per frame. `__game.session.applyIntent('p1', {type: 'lever'})` and friends drive
the rules directly. Yaw: 0 faces -z, `-PI/2` faces +x.

## How a night goes

1. **Brief** (20:50, in the van, door time-locked). The terminal lists three writs (cold store,
   records annex, bottling works) with hazard and size. Pull the governor to drive out.
2. **Travel**: the whole site loads (10 to 14 bays of 16 m), salvage is spread from the bays'
   loot spots, the door unlocks at 21:00.
3. **Night**: 21:00 to 04:00 in nine real minutes. Carry salvage back by hand (three slots,
   two-handed items take two, weight slows you and stops you running over 25 kg; fragile items
   lose 30 % if dropped standing, crouch to set them down). Bank it down the night safe. From
   23:00 the generators shed load; after midnight banks of lights trip out for good, cell by
   cell. 03:00 is last call (horn); overtime is charged after it.
4. **Departure**: pull the governor twice, or it leaves by itself at 04:00. Everything aboard is
   banked. Anyone outside is left behind: carried items lost, a recovery fee, a night stood down.
5. **Manifest**, then back to the brief. The Instalment (ħ400, then ×1.5 + 50) falls due every
   three nights. Miss it and the contract is terminated (notice with a run summary).

## Architecture (decisions and why)

- **Finite sites on the old grid generator.** `src/world/site.js` grows a site per
  `(worldSeed, siteId, night)`: the yard at (0,0), the loading dock at (0,-1), a tree of bays to
  the north plus loop doors. Cells outside the site are never generated and collide as solid.
  The yard's seed ignores the site, so it is identical everywhere and stays loaded between nights.
- **The whole site is loaded at once** (`World.setSite`, two cell workers) so loot and, later,
  creatures can simulate site-wide; cells beyond 30 m of the camera are hidden. About 3 ms a
  frame with a full bottling works loaded.
- **Session = the rules, as plain data** (`src/game/session.js`). The run (ledger, Instalment,
  history), the phase, the shift tick, every item (holder, slot, position, value) and each
  player's rule-relevant copy. Changed only by `tick()` and `applyIntent(pid, intent)` with
  intents `slot / take / drop / deposit / lever / writ`. In co-op the host runs it; clients send
  intents. Movement stays client-owned (`stepPlayer`), mirrored into the session each tick.
- **Everything time-based derives from the shift tick**: clock, brownout (`facilityPower`),
  which bays trip and when (`bankTripMin`, hashed from the site seed), last call. Every client
  computes the same lights from the same tick.
- **Loot placement is a pure function** (`spawnLoot`) of the site context and the bays' loot
  spots, so clients could rebuild it; values scale with the writ's hazard and depth.
- **Presentation reads, never writes**: `views.js` (item meshes, the held item, the van door),
  `ui.js` (HUD), `panels.js` (terminal, site plan, manifest, termination, options).
- **Helmet camera** (`src/render/helmetcam.js`): strong barrel distortion with soft corners,
  auto-exposure that hunts (a spring driven by `lightAt` ahead of the player), gain noise that
  rises with exposure, a cold slate toe and orange highlight clipping. `uGlitch` (compression
  smear) is reserved for creatures.
- **Saves**: the run is checkpointed in the van before each night (`nightreceivers.save.v1`).
  A night abandoned halfway is a night not worked. Codes are `NR1-` deflated JSON.

## Step 1 log

- World: three writs; eight kinds (yard with the Strongbox, dock, racking, cold room, typing
  pool, records archive, bottling hall, service corridor); new textures, props and signs.
- Look pass 1: the yard was a black void (added skyglow ambient, a sodium cloud-deck sky dome
  and a work lamp over the van's rear door); the sensor noise formed a visible grid (removed the
  quantisation, decorrelated the colour noise); the typing pool was an empty carpet (cubicle
  footprint was double its real size, so most clusters were rejected near doors).
- Look pass 2: items were flat blobs of colour (baked per-face shading, unlit materials driven
  by the light at their spot); the van body read as a black hole (faded the paint); a lit sliver
  of load floor showed under the van's sides (added valances).
- Economy: a site holds 40 to 50 items, far more than one person can carry out; the first
  Instalment is ħ400.
