// Registry of place kinds. Every kind is a self-contained module with the same contract:
//   id, name, weight
//   layout(seed, plan)    fill the tile plan: zones, props, lights, points, interactions, loot spots
//   build(scene, rng)     add any custom geometry with the SceneBuilder
//   interactions          { type(moment, point) } handlers run on the main thread
//   sounds                { hum, room, ambience }
//   power                 'own' if the facility's brownout never reaches it (the yard)
// Kinds must be pure: no three.js, no DOM, no Math.random().
// Which kinds appear where is decided per site in site.js.

import yard from './yard.js';
import dock from './dock.js';
import racking from './racking.js';
import coldRoom from './coldRoom.js';
import office from './office.js';
import archive from './archive.js';
import plant from './plant.js';
import corridor from './corridor.js';

export const KIND_LIST = [yard, dock, racking, coldRoom, office, archive, plant, corridor];
export const KINDS = Object.fromEntries(KIND_LIST.map((k) => [k.id, k]));
