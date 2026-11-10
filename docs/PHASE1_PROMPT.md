# Phase 1 prompt

Before you start: replace the SEED line below with your own one-line idea for the world
(or keep the example). Then in Claude Code, from this folder, say:
"Read docs/PLAN.md and docs/PHASE1_PROMPT.md, then carry out the prompt in PHASE1_PROMPT.md."

---

SEED: An abandoned 1970s research hotel where the lights never turned off.

You are building a test game: a first-person liminal-horror exploration game in the browser,
in the spirit of the Backrooms. Original setting and lore, grown from the SEED line above.
Nothing copied from existing Backrooms wikis, games or other people's lore.

Quality bar: it should feel like found footage. Grainy camcorder look, fluorescent hum,
worn carpet, wrong-coloured light. Atmosphere over jump scares. Everything from scratch:
geometry, procedural textures, synthesized audio. No external asset packs.

This phase is SINGLE-PLAYER ONLY, with no servers and no backend calls.
Multiplayer comes in a later phase, so design for it now (rules below).

## Work in steps. Don't start a step until the previous one meets its bar.

0. Setup.
   - git init this folder, add a .gitignore, and create a PUBLIC GitHub repo for it with the
     GitHub CLI (ask me to sign in if needed). Push.
   - From the SEED, write docs/ORIGIN.md (half a page of secret backstory: who made this place,
     why, what went wrong; players never see it directly) and docs/STYLE.md (era, light
     sources, materials, sounds, and three things this game never does).
   - Render one test scene in a browser and screenshot it, to confirm you can see your work.

1. Engine and feel. Three.js + Vite. One room, first-person movement (walk, run, crouch),
   lighting, camcorder filter, ambient hum. Procedural textures generated in a web worker.
   Bar: a screenshot would pass as a still from found footage, at 60 fps on a mid-range laptop.

2. Room format and generator. Every place is a "kind": one self-contained module exporting
   layout(seed), build(scene, rng), interactions, sounds and a discoveries-card entry.
   Build 5 places through it. Rooms connect into an endless graph.
   Bar: the same seed gives an identical room on every reload.

3. Entities. A small moment-scripting API: caption(text, secs), sound(name, pos),
   sit/use prompts, after(secs, fn). Then 1 HUNTER (hostile, telegraphed, avoidable by paying
   attention, never gory) and 1 RESIDENT (harmless, a small scripted moment).

4. Player kit. Flashlight, map, logbook of discoveries, a discoveries screen on the title page
   with a card per kind (thumbnail rendered from the game), saves in localStorage with an
   export/import code.

5. Lore. lore/fragments.json: one found document per place, placed on a prop just inside its
   first door, revealing ORIGIN.md in pieces, never explaining it outright. Put the authoring
   rules for future builders at the top of the file.

6. Deploy. A GitHub Actions workflow that builds and publishes to GitHub Pages on every push
   to main (set the Vite base path for the repo). Confirm the live URL loads.

7. Fill out to 8 places, 2 hunters, 2 residents.

## Multiplayer-ready rules (apply from step 1)

- World generation is fully deterministic from (worldSeed, roomId). No Math.random() in
  world code; use a seeded RNG.
- Simulation is separate from rendering. Player and entity state live in plain serializable
  objects, updated by a fixed-timestep tick.
- All input goes through one input -> action layer, so actions can later come from the network.
- Hunters and residents run off the shared tick and seed, never off frame time or local-only state.
- The client reads an optional multiplayer server URL from an env var (VITE_MP_URL) and runs
  single-player when it is unset.

## How to work

- Keep docs/PROGRESS.md updated after every step: what's done, what's next, known bugs,
  decisions made and why. Re-read it before starting each step.
- After finishing any room or visual change: screenshot it from 3 angles, list the 3 things
  that look most fake, fix them, and repeat once.
- Commit after each step with a clear message.
- Work autonomously. Make reasonable decisions instead of asking me; note them in PROGRESS.md.
  Only stop to ask if you are blocked (for example, a GitHub sign-in).

## Done means

All steps pass their bars, no console errors, 60 fps in every room, the GitHub Pages URL
works, and PROGRESS.md ends with the live URL and a short list of what to improve next.
