# Experiments

Each experiment lives on its own branch and isn't merged into `main` unless it says so. One line each:
what it was, where it lives, how it came out.

- **2026-11-11 · Night Receivers** (`salvage`): an original co-op scavenging horror game on the same engine. A crew of debtors clears abandoned facilities by night to pay the Instalment. It has three writs, four creatures with tells and counterplay (Hushwarden, Dimmer, Stocktaker, Plus-One), five tools (one with a downside), and local co-op for up to four through a Cloudflare Worker and Durable Object relay run with `wrangler dev`. The relay is not deployed. Result: a solo quota cycle (three nights, Instalment paid) and a two-window co-op day (join, drive out, bank, manifest, next brief, death and relay) both work. A frame costs about 3 ms (GPU-synced benchmark), solo and as crew, well inside 60 fps; the test pane was hidden, so on-screen 60 fps was not watched. No console errors, and it passes the determinism check. Not done: proximity voice. The audio has not been judged by ear. Log: [PROGRESS.md](PROGRESS.md).
