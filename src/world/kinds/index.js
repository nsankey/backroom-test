// Registry of place kinds. Every kind is a self-contained module with the same contract:
//   id, name, weight
//   layout(seed, plan)    fill the tile plan: zones, props, lights, points, interactions
//   build(scene, rng)     add any custom geometry with the SceneBuilder
//   interactions          { type(moment, point) } handlers run on the main thread
//   sounds                { hum, room, ambience }
//   card                  { title, blurb } for the discoveries screen
// Kinds must be pure: no three.js, no DOM, no Math.random().

import lobby from './lobby.js';

export const KIND_LIST = [lobby];
export const KINDS = Object.fromEntries(KIND_LIST.map((k) => [k.id, k]));
