// Registry of entities. Same idea as place kinds: one module per Hunter or Resident.
//   id, role ('hunter' | 'resident'), name, card
//   hunters:   schedule(seed, tick) -> bool, spawn(ctx) -> state, tick(state, ctx), dimAt(state, d),
//              darkAt(state, x, z) (optional: how much light survives at a point)
//   only one hunter visits at a time; at most one resident stands in a place
//   residents: appearsIn(seed, cell) -> bool, spawn(ctx, cell), tick(state, ctx),
//              interactions(state) -> [...], interact(state, moment)
//   view(game) -> { object, update(state, alpha, light, time), dispose() }   (presentation only)
// Simulation state is a plain object advanced on the shared tick; never use frame time there.

import porter from './porter.js';
import waitingGuest from './waitingGuest.js';
import unlit from './unlit.js';
import maintenanceMan from './maintenanceMan.js';

export const ENTITY_LIST = [porter, unlit, waitingGuest, maintenanceMan];
export const ENTITIES = Object.fromEntries(ENTITY_LIST.map((e) => [e.id, e]));
export const HUNTERS = ENTITY_LIST.filter((e) => e.role === 'hunter');
export const RESIDENTS = ENTITY_LIST.filter((e) => e.role === 'resident');
