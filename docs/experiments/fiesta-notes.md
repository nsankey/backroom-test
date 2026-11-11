# Experiment: the closed mall (Fiesta Mall, Mesa, AZ)

Branch `fiesta-mall`, not merged. A new place kind, `fiesta` (code only; in game it is
**The Closed Mall**), built at true scale from the real building outline. These notes say
which sources told me what, and which parts I guessed or made up.

**How to get there.** In every world there is one mall block in the 50 × 50-cell region around
the start. Its parking lot begins 3 or 4 cells east of the lobby. Walk east through the hotel
and a door opens onto the lot. The block is 21 × 29 cells (336 × 464 m): the building plus a
parking lot around it. Other regions have a mall with a 1-in-4 chance.

## Sources, and what each one told me

| Source | What it gave me | Used for |
|---|---|---|
| OpenStreetMap, way 33295116 (`shop=mall`), fetched through Overpass as of 2022-01-01. Saved with attribution and licence in `data/fiesta/footprint.json` | The exterior outline only. An X about 430 m long on a 45° diagonal, roughly 54,300 m². The four arms include the anchor stores. Small bumps sit in the notches between the arms. No interior, levels or names | The building outline, at true scale (`src/world/fiesta/outline.js`). The bumps place the four entrances |
| OpenStreetMap, way 92173277 | A parking-structure footprint beside the mall | A solid block in the lot (no interior). **Uncertain:** the 2013 site plan below doesn't show it |
| Archived 2013 property site plan (owner's leasing map, via the Wayback Machine). Looked at in the browser, not saved | The streets around the site. One anchor in each of the NW, NE and SW arms and one at the S/SE end. The in-line shop blocks between them | Putting the four "former department store" fronts at the four arm ends |
| Archived shopfiesta.com "Map" page (2011, Wayback) | It had "Lower Level" and "Upper Level" tabs, which confirms two levels. The directory images themselves weren't archived | Nothing beyond "two levels" |
| [Wikipedia](https://en.wikipedia.org/wiki/Fiesta_Mall) | Opened October 1979. The 1989 renovation dropped the orange and brown 1970s scheme and **added skylights**. Entrances were updated in 2004. Closed January 27, 2018. Demolition began July 2023 | The era and the palette (neutral, post-1989, not 70s orange). Skylights over the wells |
| A web-search summary of an undated tenant listing. I couldn't pin it to one page; it was among the malls.com / bestattractions.org results | "Dining was all to be found on the upper level", and guest services on the lower level | Food court on the upper floor; CUSTOMER SERVICE on the lower floor |
| [Phoenix New Times photo gallery](https://www.phoenixnewtimes.com/arts/photos-beloved-fiesta-mall-in-mesa-over-the-years-21006243), captions only | A 1997 photo of "a seating area and elevator"; a 2023 photo of an abandoned restaurant in the food court | An elevator exists and the food court outlived the shops. **Where** both sit is a guess |
| [abandonedphotos.com](https://abandonedphotos.com/arizonas-abandoned-fiesta-mall/), [kennethinthe212](https://www.kennethinthe212.com/2023/07/the-fiestas-over.html), [FOX 10](https://www.fox10phoenix.com/news/fiesta-mall-demolition-animal-advocates-work-to-save-stray-cats-stuck-inside-as-walls-go-down), [Axios](https://www.axios.com/local/phoenix/2023/07/17/fiesta-mall-demolition-mesa-arizona), [KTAR](https://ktar.com/arizona-news/fiesta-mall-in-mesa-closes-for-good-to-be-replaced-with-education-facility) | What the closed building was like, and the timeline of closing and demolition | Mood only: shutters down, litter, nobody. No image or text copied |
| [malls.com](https://www.malls.com/malls/fiesta-mall/), [bestattractions.org](https://bestattractions.org/usa/arizona/fiesta-mall-in-mesa) | General figures (about 150 stores, four or five anchors). The sources disagree on the anchor count | The store count is in that ballpark (84 shops and 12 food stalls on the plan; real shop sizes vary more) |
| [city-data.com](https://City-data.com/articles/Fiesta-Mall-Mesa-Arizona-Shopping-Center.html) | Nothing. The page rate-limited me (HTTP 429) | Not used |

No image, photo, map or directory from any source was downloaded, traced or shipped.
`docs/references/` is gitignored and empty.

## What I guessed (layout)

The outline is real. **Everything inside the walls is a guess** that fits the outline, the
two-level fact and the anchor positions:

- **Concourses**: a cross that follows the arms. The long N–S concourse is 14 m wide; the E–W one
  is narrower. All widths are guesses.
- **Courts and wells**: a centre court where the arms cross, and smaller courts at the west and
  east ends of the E–W concourse. Long open wells run down the middle of the concourses so
  each floor sees the other, with two bridges across. Positions and sizes are mine.
- **Escalators** (three: two in the centre court, one up to the food court), the **elevator** by
  the centre court, the **fountain** in the centre court and the directory **kiosk**: placed
  where a two-level regional mall of 1979 would plausibly have them. None of them is sourced.
- **Food court**: at the south end of the N–S concourse on the upper floor, by the south anchor.
  The sources only say "upper level".
- **Entrances**: four, in the notches where OSM shows bumps. Their real depth is unknown.
- **Heights**: lower ceiling 4.6 m; upper floor at 5.5 m; skylights at 10.6 m.
- **Shops**: widths 6–16 m, generated from the seed. About 30% are vacant.
- **Parking lot**: the stall layout and the pole spacing (26 m) are generic.

## What I invented on purpose

- **No real names.** All 48 shop names and 12 food-stall names are made up and period-plausible
  (`src/world/fiesta/names.js`). The four anchors are blank "former department store" fronts:
  grey panels, a closed grille, and a pale patch where a name used to be. No logos anywhere.
- **The directory** on the kiosk is drawn by the game's own texture code from the game's own
  layout (`mallDirectory` in `src/render/mallTextures.js`). It shows both levels, numbered
  stores, a legend, and the found-document fragment in `lore/fragments.json`.
- **Slightly wrong, on purpose:**
  - The entrance corridors run 41–56 m from the doors to the concourse. Real entrances were
    short vestibules, so these are a little too long.
  - **EVERLIT CANDLES** is the same 3 × 8 m shop, built from the same seed, in three places.
  - The directory lists Everlit Candles three times and puts the red YOU ARE HERE dot inside
    the west department store, which has no way in.
- **Era dressing**: it's night and every light is still on. Shutters are mostly half down;
  some fixtures flicker. The fountain is dry, with coins at the bottom. Papers and cups lie
  on both floors, and leaves have blown in through the propped entry doors. Food court chairs
  are left out, and on the east side someone started stacking them and stopped.
- **The lore fragment** ties the place to the game's "keep the lights on" thread. Its sign line
  says Grand Opening October 1979, which is real; the rest is fiction.

## Deviations from the real building

- **Rotated 45°** so the walls run along the game's grid. In game, −z is the real north-east arm
  and +x is the real south-east.
- The outline is snapped to the 0.5 m tile grid.
- The parking structure is a solid block, not a building you can enter.
- The lot is "outdoors" under a night-sky ceiling 16 m up (the engine has no open sky). Sodium
  poles light it. The asphalt is sun-bleached grey.
- Hotel doors on the block's edge open onto the lot, so the mall stays connected to the rest
  of the world. There are no doors between cells inside the block.
- No hunters or residents go in. A hunter that follows you in loses you at the doors: they walk
  one floor only.
- The anchors have no interiors.

## Engine work (this branch only)

The mall needed two things the engine didn't have, so they live on this branch:

- **Places bigger than a cell.** A mall block shares one plan of the whole building
  (`src/world/fiesta/mall.js`, built once and cached). Each cell cuts out its own 16 m. The
  bake also sees the walls and lights just past the cell edge, so seams don't show. Streaming
  goes from 1 cell to 2 cells around the player while inside the block.
- **Two floors.** A plan can now have an upper floor: its tiles, nav, colliders and baked
  lighting, plus wells you can see down through and escalator ramps. The player has a height
  and a level. Tiles, colliders, interactions, line of sight, footsteps, saves and the map
  all respect the level.

Single-floor places are byte-identical to before: the world fingerprint is unchanged.

## Results

- `node tools/check-determinism.mjs` passes. It now also checks:
  - Every walkable tile on both floors is reachable from the lot: 415,787 tiles, 0 unreachable.
  - A spread of real block cells over two seeds generates without problems, the same twice.
  - The full sweep (`node tools/check-determinism.mjs 4 1`) covers 1,190 block cells, all clean.
- Walked in game with simulated input:
  - The lower N–S concourse end to end (about 200 m).
  - Up the centre-court escalator and back down; height and level change smoothly halfway up.
  - Along the upper walkways to the railings at the wells.
- Frame time in the desktop app's browser pane at 1228 × 921: about 7 ms (about 140 fps) in
  the concourse, upper walkway, centre court and food court; 4.5 ms on the lot.
- Screenshots in `shots/` (gitignored) from the lower concourse, the upper walkway, the food
  court, the lot and an entrance corridor.

### The fake-looking things I fixed

Round 1:
1. The food court tables sat in a perfect grid. Now some tables are gone, the rest are shoved
   about, chairs are missing or knocked over, and some are stacked on tables.
2. The glass balustrades read as a solid teal wall: two layers of tint plus an end face every
   half metre. Now they are a single faint pane.
3. Every shutter baked to a black slab. The grille had only corner vertices, all inside the
   jambs, and a dark texture. It is now subdivided and lighter, and more shutters are half
   down so the lit shops show.

Round 2:
4. The food-stall signs were buried in the wall: stall fronts sit a quarter tile behind the
   wall face. The signs now stand on that face, with a glow.
5. Every floor was spotless after five years shut. Now there is litter, and leaves near the
   entrances.
6. The parking lot was pitch black: black asphalt and weak poles. Now it has pale asphalt
   and sodium pools.

### Not done / known gaps

- Hunters and residents don't use the mall; the entity code is single-floor.
- The anchors, the parking structure and the service corridors behind the shops aren't
  built.
- The lot is only as big as the block margin (about 18 m round the outline's bounding box,
  more in the notches). The real lot was much larger.
