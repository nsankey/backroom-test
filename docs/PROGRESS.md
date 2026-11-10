# Progress

Phase 1 of docs/PLAN.md, following docs/PHASE1_PROMPT.md. Re-read before each step.

## Status

| Step | State |
| --- | --- |
| 0. Setup (git, repo, ORIGIN, STYLE, test render) | done locally; GitHub repo waits on `gh auth login` |
| 1. Engine and feel | done (see below) |
| 2. Room format and generator | next |
| 3. Entities | - |
| 4. Player kit | - |
| 5. Lore | - |
| 6. Deploy | - |
| 7. Fill out to 8 / 2 / 2 | - |

## How to run

```
npm install
npm run dev
```

Open http://localhost:5173. Useful URL flags: `?debug` (fps + cell readout), `?seed=N`,
`?fresh` (ignore the save), `?kind=<id>` (force the starting cell's kind), `?autostart`.
In the console, `__game.debugView(x, z, yaw, pitch)` renders one frame from a spot and
`__game.benchmark(60)` returns GPU-synced ms per frame.

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

## Known issues
- Pointer lock is unavailable in the automation browser; screenshots use `debugView`.

## Next
- Step 2: room kinds (guest corridor, guest rooms, ice & vending, sleep lab) and a determinism check.
