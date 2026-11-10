# Backroom Test: phase plan

A test game: an endlessly growing, liminal first-person exploration game in the browser,
inspired by Dimension 9 (dimension9.space). It ships single-player first and adds servers
only once people play. Each phase ends at a gate; don't start the next until it passes.

Full plan with roadmap diagram: https://claude.ai/artifact/J8GfkiUuFeAJHr89JEyVLy

## Principles

- Playable at every gate.
- Multiplayer-ready from day one: the world is deterministic from a seed, so multiplayer
  later syncs only players and entities, never rooms.
- Content is modules: every place, Hunter and Resident uses one module contract.
- The agent always sees its own work (browser + screenshots).
- Opus 5.5 by default; Fable 5.2 only for targeted passes. Keep a usage-credit spending cap on.

## Phase 0: Quick setup (about 15 minutes, you)

- Project folder: C:\GameDev\Games\BackroomTest (done).
- Open it in Claude Code with a browser tool and auto-approval for edits/commands in this folder.
- Set a usage-credit spending cap.
- Write your SEED line at the top of docs/PHASE1_PROMPT.md.
- Claude handles git, the GitHub repo, ORIGIN.md and STYLE.md as step 0 of Phase 1.

## Phase 1: Single-player core on GitHub Pages

Prompt: docs/PHASE1_PROMPT.md. Opus 5.5, one long session.
Engine, room module format, 8 places, 2 Hunters, 2 Residents, player kit, lore fragments,
auto-deploy to Pages.
Gate: no console errors, 60 fps everywhere, deploys on push, and someone plays 20+ minutes
without instructions.
Optional: one Fable pass on lighting/materials if the rooms look flat.

## Phase 2: Builder loop via GitHub Actions

docs/BUILDER.md (the contract for adding a kind), a Playwright headless check (boot, jump to a
kind, 3 screenshots, frame time, console errors), the standing "Keeper" directive, and a
nightly Action on your API key that opens a pull request per new kind.
Review the first 10 by hand; auto-merge after 10 clean runs. Keep a kill switch.
Gate: 10 consecutive runs merged with no fixes.

## Phase 3: Multiplayer presence on Cloudflare

Cloudflare Worker + one Durable Object per world (cap 200), position sync at 10-20 Hz with
interpolation, player figures and an online count, silent single-player fallback, basic
abuse protection. You create the Cloudflare account and token once.
Gate: 3 people on different networks meet; 50 bots for 30 minutes without disconnects.

## Phase 4: Proximity voice and scale

Peer-to-peer WebRTC voice with distance falloff, a TURN relay, voice off by default with mute
and report, auto-sharding into worlds of 200. Move hosting to Cloudflare Pages if GitHub
Pages' 100 GB/month bandwidth gets close.
Gate: voice works over a phone hotspot; a 200-bot world is stable for 30 minutes.

## Phase 5: Launch and live operations

Privacy-friendly analytics, error reporting, builder cadence tuned from play data, a feedback
channel, a launch post. Optional Steam build via a desktop wrapper and SteamPipe once the web
version shows players stay.

## Decision points

- After Phase 1: do people play 20+ minutes? If not, fix the feel first.
- After Phase 2: are new kinds actually different? If not, tighten BUILDER.md.
- Before Phase 3: are enough people online at once to meet? If not, wait on multiplayer.

Skip for now: accounts, monetization, mobile controls, a custom engine, server-side generation.
