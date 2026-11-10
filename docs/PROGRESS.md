# Progress

Phase 1 of docs/PLAN.md, following docs/PHASE1_PROMPT.md. Re-read before each step.

## Status

| Step | State |
| --- | --- |
| 0. Setup (git, repo, ORIGIN, STYLE, test render) | done: github.com/nsankey/backroom-test |
| 1. Engine and feel | done (see below) |
| 2. Room format and generator | done: 5 places, determinism check passes |
| 3. Entities | done: moments API, Night Porter (hunter), Waiting Guest (resident) |
| 4. Player kit | done: flashlight, floor plan, logbook, discoveries, saves + codes |
| 5. Lore | done: lore/fragments.json, one document per place, paper overlay |
| 6. Deploy | next |
| 7. Fill out to 8 / 2 / 2 | - |

## How to run

```
npm install
npm run dev
```

Open http://localhost:5173. Useful URL flags: `?debug` (fps + cell readout), `?seed=N`,
`?fresh` (ignore the save), `?kind=<id>` (force the starting cell's kind), `?autostart`.
In the console, `__game.debugView(x, z, yaw, pitch)` renders one frame from a spot (and freezes
it in an overlay), `await __game.debugSave('name')` writes that frame to `shots/name.jpg` through
a dev-server endpoint (a hidden browser pane can present stale frames, so trust the file), and
`__game.benchmark(60)` returns GPU-synced ms per frame. `__game.forceHunter = 'porter'` brings a
hunter on the next tick; `__game.debugNoHunters = true` keeps them away. Note yaw: `-PI/2` faces +x.

## Architecture (decisions and why)

- **World = infinite grid of 16 m cells ("places").** `src/world/grid.js` decides each cell's kind and
  its doors purely from `(worldSeed, cx, cz)`: a binary-tree maze (every cell links north or west,
  which keeps the infinite grid connected) plus ~38 % extra doors for loops. Door positions are
  hashed per shared edge, so both neighbours agree without talking. Multiplayer later only needs
  the seed.
- **Each place is a 32 x 32 tile plan (0.5 m tiles)** built by a kind's `layout(seed, plan)`.
  Walls, floors, ceilings, soffits, door lintels and baseboards are derived from the tile grid
  (`builder.js shell()`), so kinds only describe zones and props. Doorways are low-ceiling zones,
  which makes lintels automatic.
- **Lighting is baked per vertex in a worker** (`builder.js bake()`): every fixture contributes
  with a down-facing lobe for troffers, line-of-sight occlusion through the tile grid (including
  door lintels), a fake bounce term, wall/floor AO and furniture contact shadows. A second baked
  channel holds "flicker group" light, scaled at runtime by a deterministic flicker uniform.
  Why: dozens of lights per room at 60 fps, with only one real-time light (the flashlight).
- **Generation runs in a Web Worker** (`cell.worker.js`), ~130 ms per cell, off the main thread.
  The main thread only wraps typed arrays in BufferGeometry, at most a few ms per frame.
- **Procedural textures in a second worker** (`textures.worker.js`) on OffscreenCanvas,
  seeded, flipped so v=0 is the bottom. UVs are in metres; materials set the repeat.
- **Materials** are MeshLambert / MeshBasic with an `onBeforeCompile` patch that adds the baked
  light to irradiance (so the flashlight still adds on top) or uses it as emissive colour.
- **Camcorder look** = mild bloom, ACES, then a single display-space shader: barrel lens,
  chromatic fringe, soft blur, YIQ chroma bleed, green-tinted grade with lifted blacks, grain,
  scanlines, vignette, tracking wobble (driven up by hunters later).
- **Simulation** is a fixed 60 Hz tick over plain objects (`game/player.js`), input goes through
  `core/input.js` actions, rendering interpolates. Flicker and moment timers run off the tick.
- **Audio is all synthesized** (`audio/audio.js`): ballast hum with harmonics and a clipped
  buzz, pink-noise HVAC, convolution reverb from generated impulses per room size, footsteps by
  floor surface, HRTF-positioned one-shots.

## Step log

### Step 0
- Git, Node and GitHub CLI were not installed; winget installs stalled at UAC, so portable official
  builds were unpacked to `%USERPROFILE%\.local\tools` and added to the user PATH.
- Wrote docs/ORIGIN.md and docs/STYLE.md from the SEED.
- Test render confirmed in the browser pane.

### Step 1
- Lobby kind with terrazzo, wainscot, acoustic ceiling, troffers, columns, desk, key board,
  pendants, sofas on a rust rug, plants, windows with lit blinds, clock with no hands.
- Look passes: removed bloom haze (bloom was turning the ceiling to fog), darkened the ceiling
  bounce, added contact shadows and tubular chair arms, pendants over the desk.
- Perf: ~4 ms/frame at 1228x921 on the dev machine (GPU-synced benchmark), 1 cell ~6k tris.

### Step 2
- Kind contract in `src/world/kinds/index.js`; kinds: lobby, guestCorridor (The Guest Wing),
  guestRooms (Occupied Rooms), iceVending (Ice & Vending), sleepLab (The Sleep Study).
- Shared layout kit: axis frames, corridor wall slots, vestibules inside doors, lore placement.
- `npm run check:determinism` (tools/check-determinism.mjs) generates 120 cells per kind in Node:
  every boundary door must be reachable around props, and the same (seed, cell) must produce
  identical geometry, lighting, colliders and interactions. It caught Occupied Rooms branches
  running through furnished rooms; rooms now skip footprints a branch crosses.
- Same-seed-same-room: the generator is a pure function of (worldSeed, cx, cz), run identically
  in the worker and in Node; the check compares two runs and prints a world fingerprint.
- Walk test (injected actions): crossing the lobby's north door streams the next place;
  colliding with a column stops exactly at radius.
- Look passes: dimmer sconce/lamp shades, readable blinds, warmer room light, muted vinyl,
  darker stainless.

### Step 3
- **Moments API** (`src/game/moments.js`): kinds register `moments` that get a small ctx
  (`at`, `caption`, `sound`, `after`, `use`, `sit`, `discover`, `pick`, `chance`). Timers count sim
  ticks, so they are deterministic and pause with the game. Interactions (ring the bell, knock,
  watch the TV, sit on the bed, buy from the vending machine, read the chart) are moments.
- **Entity contract** (`src/entities/index.js`): a module has `id`, `role` (hunter / resident),
  `card`, sim functions over plain state (`schedule`, `spawn`, `appearsIn`, `tick`) and a `view`
  that only reads state. `src/game/entities.js` runs them off the shared tick and seed.
- **Hunter: The Night Porter.** Scheduled visits (never before 2.5 min, then a 45 % chance per
  75 s window, from the seed). Telegraphed three ways: the cart's squeaking wheel is audible from
  far off, every place near him browns out (tubes fade and warm faster than the light they throw),
  and the tape's tracking band grows as he closes in. He hears footsteps (running 13 m, walking
  5.5 m, crouching 1.4 m) and sees you in a cone (8 m, 15 m with the flashlight on). Avoidable by
  listening, crouching, killing the flashlight and breaking line of sight. If he reaches you, you
  are "checked out": fade to black, wake in another place, a logbook line. Nothing gory.
- **Resident: The Waiting Guest.** Sits in the lobby (sometimes elsewhere) with a suitcase, says a
  few lines when spoken to, gives a hint, then is gone the next time you look away.
- Pathfinding: A* over walkable tiles with a binary heap and a walk cache; spawn tries at most five
  path checks (the earlier version hung the page).
- Bugs fixed on the way: player position exploded when the current cell unloaded during a
  check-out (move() now refuses to resolve against unloaded space); porter wandered off after an
  unreachable random target; the tracking band covered the whole frame (inverted smoothstep).
- Look passes on the porter: faceless head tipped forward, white collar, brass buttons, arms on a
  push bar, tarnished cart with a skirted cloth and cloche; tracking streaks broken into sparks.

### Step 4
- **Flashlight** (F): the only real-time light; battery drains while on and recovers while off.
- **Floor plan** (M / Tab, or from pause): a blueprint drawn from the real tile plans of every place
  you have walked through (each visit stores a 256-byte floor/furniture mask), walls inked where
  floor meets solid, doors left open where the neighbour continues, a red mark for you.
- **Logbook** (L / J, or from pause): every first discovery, overheard hint and event, newest first.
- **Discoveries** (title screen): a card per place kind and per occupant. The thumbnail is rendered
  from the game the first time you find it: places are photographed from the cell's best vantage
  (longest, widest, best-lit view inside the cell), rendered and copied mid-frame and then the
  player's frame is re-rendered, so it never flashes; occupants are captured from your own view
  when you first see them clearly. Places missed by the camera retake on the next visit.
- **Saves**: localStorage, autosaved every 5 s, on pause and on unload. "New tape" starts a new
  world but keeps discoveries and the logbook. **Save codes** (Options): deflated JSON in base64
  (`ML2-...`, ~3 KB after 25 places); thumbnails stay local so codes stay pasteable.
- Look/theme fix found on the way: guest-room thumbnails came out black because branch corridors
  carved by `connectDoors` had no lights. `Plan.fillDarkGaps` now lights any hall tile with no
  fixture within ~4 m, and the determinism check reports "% dark tiles" per kind (was 16-23 % in
  the guest wing and ice/vending, now under 0.3 % everywhere).

### Step 5
- `lore/fragments.json`: authoring rules for future builders at the top (`_rules`), then one
  document per kind id. Each serves one ORIGIN thread in an in-world voice (brochure, housekeeping
  sheet, unmailed postcard, staff memo, observation log), with `[[redactions]]`, never explaining.
- `kit.placeLore` puts a walnut pedestal table with the document just inside the place's first
  door (vestibule carved if needed). E opens a paper overlay (aged paper, ring stain), logs a
  one-line summary, counts toward "documents" on the discoveries screen; the logbook can re-open it.
- `npm run check:determinism` now also fails if any kind lacks a fragment or a placed document,
  and notes bodies over ~120 words.
- Bug fixed: closing the paper with E also reached the game input and picked it up again.

## Known issues
- Pointer lock is unavailable in the automation browser; screenshots use `debugView`.
- Discovering a place costs one ~20-70 ms frame (vantage search + an extra render). Rare.

## Next
- Step 6: GitHub Pages deploy.
