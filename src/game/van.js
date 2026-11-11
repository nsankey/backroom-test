// The Strongbox's load space, in world coordinates (the yard is cell 0,0). Nothing from the
// building comes inside it.

import { VAN } from '../world/kinds/yard.js';

export function inVan(x, z) {
  const v = VAN.inner;
  return x > v.x0 && x < v.x1 && z > v.z0 - 0.2 && z < v.z1;
}
