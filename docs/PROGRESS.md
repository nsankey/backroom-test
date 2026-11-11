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
| 2. Threats | done: four creatures with tells and counterplay, death and drop, signal-lost cut, notices |
| 3. Tools | done: five tools from the van's stores, a rack in the van, kept or written off at departure |
| 4. Co-op (local) | done: crew relay (Worker + Durable Object per room code) under `wrangler dev`, host-authoritative, up to four. Not deployed. No proximity voice |

## How to run

```
npm install
npx vite --port 5187
```

Open http://localhost:5187. URL flags: `?debug` (fps and cell readout), `?fresh` (wipe the
save), `?seed=N` (seed for a new contract), `?autostart` (skip the title), `?shift=120` (a
shift of 120 real seconds instead of 540).

### Co-op on one machine

```
cd server
npm install
npx wrangler dev          # the crew relay on ws://127.0.0.1:8787
```

With the relay and Vite both running (`.env.development` points `VITE_MP_URL` at the relay),
open two windows on http://localhost:5187. In one, **Take a crew out** (the crew chief: it runs
the rules and saves the contract). It shows a four-letter room code in the HUD. In the other,
type the code and **Join a crew**. Shortcuts: `?host&room=ABCD` and `?join=ABCD`. Up to four
crew. The chief pulls the governor and signs the manifest for everyone. Production builds have
no relay URL, so the published site shows no co-op menu. To put the relay on Cloudflare later:
`npx wrangler deploy` in `server/`, then build with `VITE_MP_URL=wss://<worker host>`.

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

## What is in the buildings

No gore anywhere: a death is the helmet camera turning to look, breaking up, and NO SIGNAL.
The firm's terminal has a NOTICES tab that states every tell and counterplay in-world.

| Creature | Punishes | Tell | Counterplay |
| --- | --- | --- | --- |
| **Hushwarden** (blind, a brass listening horn for a head, grey dust coat) | noise | a tuning-fork drone that carries; a rising whistle when it locks on | crouch, stand still, set things down gently (crouched), make a noise elsewhere |
| **Dimmer** (a coat hung with nobody in it) | darkness | tubes popping in a ring, a pressure hush, the camera breaking up, a travelling patch where the baked light dies | stay under working light and keep moving to the van; it rushes through dark, crawls into light |
| **Stocktaker** (stooped clerk, a hand-tally counter for a head) | taking from its pile | the click of the count every 20 s, chalk tally marks round its post | grab between counts, or swap something onto the pile (it counts pieces, not value); drop the item and it fetches it back |
| **Plus-One** (a receiver with the visor down and a dark tally lamp) | being alone | whistling; the helmet's counter reads PERSONS 2 and a face box finds it | keep moving (it closes only while you stand still), regroup, or get in the van |

Schedule (`src/creatures/index.js`): the Stocktaker is at its post from 21:00; the Hushwarden
starts its rounds at 23:30 / 22:45 / 22:00 by hazard (a second one later on harder writs); the
Dimmer wakes at 01:30 / 01:00 / 00:30. The Plus-One is not scheduled: it comes after 150 / 120
/ 95 seconds alone (not within 6 m of crew, not in the van), after 22:00.

Death: everything carried drops where you fall. In co-op the night goes on for the others and
the firm bills a recovery fee per lost receiver; after the NO SIGNAL card the van's monitor
patches you through to a living crew member's helmet feed until the Strongbox leaves. If the
fees put the ledger below zero, the contract ends (IN DEBT). Solo, the night ends and the contract with it
(NOTICE OF SIGNAL LOSS with the run summary).

## Tools

Requisitioned from the STORES tab of the van terminal during the brief (one of each per crew
member), paid from the ledger, and hung on the rack inside the van. A tool takes a hand slot.
Tools still in the van (or carried by someone aboard) at departure are kept for the next night;
tools left in the building are written off on the manifest.

| Tool | ħ | kg | Use (click) | Note |
| --- | --- | --- | --- | --- |
| **Bull's-eye lamp** | 20 | 1.2 | F toggles a real spotlight beam | 240 s of battery, browns and stutters when low; held on the Dimmer it burns it back into the dark |
| **CO₂ extinguisher** | 45 | 6.5 | a loud blast in a 5 m cone | four blasts; stuns the Hushwarden, Stocktaker and Plus-One for 4 s; the Dimmer does not care; the noise carries |
| **Appraiser's tag gun** | 30 | 0.8 | tags the item you aim at with its valuation | a small beep (noise) |
| **Porter's back frame** | 60 | 3 | worn, not held | two-handed items take one slot; carried weight feels 55 % as heavy above the frame's own 3 kg |
| **The foreman's recorder** | 35 | 1.4 | plays 25 s of tape (hiss, a murmur, footsteps) | a lure for the Hushwarden. The downside: while you carry it, it sometimes starts playing by itself |

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
  intents `slot / take / drop / deposit / lever / writ / noise / buy / lamp / use`. In co-op the host runs it; clients send
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
- **Creatures are session state** (`src/creatures/`): plain objects ticked by `Session.tick(world)`
  on the host, with every random choice hashed from (site seed, creature id, tick). The world
  is passed in only to answer questions (paths, line of sight, light). Players' footsteps and
  set-downs reach them as `noise` intents. Their looks and sounds live in `creatures/views.js`
  and ease toward the state, so 15 Hz co-op snapshots will look smooth.
- **Co-op is the same Session on one machine, mirrored** (`src/game/coop.js`, `server/`). The
  relay holds no game state: per room code, a Durable Object passes crew messages to the chief
  and the chief's to the crew. Crew send movement (30 Hz) and intents; the chief applies them
  before each tick and sends the whole state, minus creature paths, with the events since the
  last one, 15 Hz (about 7 KB, 0.03 ms to build); phase changes and deaths go at once. Crew
  never tick the rules; they load the same sites from the same seeds. In co-op the rules keep
  running behind panels, and a worker timer steps a chief's window that gets no frames.
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

## Step 2 log

- Behaviour checked by driving the session directly: the Hushwarden ignores a still player,
  investigates a smash, locks on to footsteps within 7 m and kills; the Stocktaker's count comes
  up short, it hunts the holder, then fetches the dropped item back to its pile; the Dimmer only
  drifts toward a lit player and kills in the dark; the Plus-One holds back while you move and
  closes while you stand. Solo death runs to the manifest and the NOTICE OF SIGNAL LOSS.
- Fixed: every replan sent creatures back to the centre of their own tile, so slow walkers
  shuffled on the spot (paths now start at the second node).
- Look pass 1: the Stocktaker's head was a flat yellow disc and its legs were pins (darker
  brass drum with a bezel, domed back, plunger and number window; trousers and shoes); figures
  floated (blob shadows); the Stocktaker's pile read as clutter (chalked tally marks round its
  post).
- Look pass 2: the Hushwarden was a pale cone with a toy-yellow horn (dark split coat, belt,
  shoulder cape, aged brass with a verdigris rim); the chalk was bright as snow (fewer, fainter
  marks); the crew figure's head was a small box and its visor read as hair (rounded head,
  shoulders, a wraparound smoked visor with a highlight).
- Cost: creature simulation is under 0.05 ms a tick with five creatures; frame time unchanged
  at about 3 ms.

## Step 3 log

- Rules: `buy` and `use` intents; tool state (charge, tag, play) is plain item state, so co-op
  needs nothing extra. Lamps are a fixed pool of four spotlights in `src/game/toolviews.js` (no
  shader recompiles); unlit models and the auto-exposure add the beam with `addLamp`.
- Behaviour checked: the extinguisher stuns a hunting Hushwarden; the recorder at 22 m drew the
  Hushwarden to within 0.3 m of it; a lamp held on the Dimmer drives it from 5 m to 10 m, then
  it drifts. Fixed: the tape was too quiet to lure anything (louder); a Dimmer cornered by the
  beam froze (it now slips off to any spot further from the light).
- Look pass 1: bought tools were dumped on the van floor (a two-shelf rack); the back frame
  read as a folding chair (a pack frame with straps, back band and load shelf); the held frame
  filled the whole view (it is worn, not drawn in the hands).
- Look pass 2: the extinguisher's cloud read as cotton balls (60 faint puffs that jet, spread
  and settle); the beam had a hard disc edge (wide penumbra); the lamp's lens was dull while on
  (it glows).

## Step 4 log

- Relay: `server/src/index.js`, a Worker routing `/room/CODE` to a `Lobby` Durable Object
  (SQLite-class migration, ready for the free plan). First socket is the chief (p1); crew get
  p2 to p4. It tells the chief who joined and left, and the crew when the chief has gone.
- Checked with two windows (chief in a background tab, crew in front): join in the brief, buy a
  lamp (chief) and take it off the rack (crew), drive out together, the crew's lamp lights,
  take and bank from the crew side, the chief carries one aboard and pulls the governor twice,
  both read the manifest, the crew waits for the chief to sign, both stand in night 2's brief.
  A crew death cuts to NO SIGNAL and then the chief's feed; a full wipe ends the night on both
  screens. The chief's window kept 60 ticks a second with no animation frames.
- Solo check after the change: three nights banking the best 22 items each, Instalment of
  ħ400 paid at the end of night 3, ħ650 due by night 6.
- Session: `solo` is now "one receiver on the contract" (a crew member who drops off the line
  leaves what they carried where they stood). Intents go through `game.intent()`.
- Look pass 1 (the crew figure, three angles): a blank egg for a face (brow, shadowed eyes,
  nose, stubbled jaw); arms hung straight while the salvage floated in front (arms out under
  the load); the head never moved (it follows their camera's pitch).
- Look pass 2: the hard hat glowed white in a dark bay (scuffed, grimy shell); the face was
  busy (no mouth line, smaller eyes); they stood like pins (feet apart at rest, a slight
  shifting of weight).
- Found on the way: the manifest printed "ħNaN was due" when fees put the ledger in debt (now
  IN DEBT).
- The crew hear each other's footfalls (a heel strike placed at the figure, softer crouched).
- Not done: proximity voice.
