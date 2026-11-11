// Registry of creatures and the night's schedule. Each creature module:
//   id, name
//   create(ctx, spot) -> plain state     tick(state, ctx)
// Creatures are simulated by the session (the host's, in co-op) on the shared tick; their
// looks and sounds live in views.js. Danger rises through the night and with the writ's hazard.

import hushwarden from './hushwarden.js';
import dimmer from './dimmer.js';
import stocktaker from './stocktaker.js';
import plusOne from './plusOne.js';

export const CREATURE_LIST = [hushwarden, dimmer, stocktaker, plusOne];
export const CREATURES = Object.fromEntries(CREATURE_LIST.map((c) => [c.id, c]));

/** How the firm's incident log words it (the camera only ever shows the signal going). */
export const CAUSE_TEXT = {
  hushwarden: 'The Hushwarden heard you. Your helmet camera recorded nothing further.',
  dimmer: 'Your helmet camera lost its picture in an unlit bay and did not recover it.',
  stocktaker: 'You were found short in the Stocktaker’s count.',
  plusOne: 'You were working alone, and then you were not. Your camera counted two persons before the signal went.',
};

/**
 * When things arrive tonight, in minutes after 21:00. The Stocktaker is at its post from the
 * start; the Hushwarden starts its rounds later; the Dimmer wakes once the lights start to go;
 * the Plus-One is not scheduled (it comes for whoever has been alone too long).
 */
export function nightSchedule(hazard) {
  const h = Math.max(1, Math.min(3, hazard));
  const out = [{ type: 'stocktaker', at: 0 }];
  out.push({ type: 'hushwarden', at: [0, 150, 105, 60][h] });
  if (h >= 2) out.push({ type: 'hushwarden', at: [0, 0, 270, 210][h] });
  out.push({ type: 'dimmer', at: [0, 270, 240, 210][h] });
  if (h >= 3) out.push({ type: 'stocktaker', at: 0 });
  return out;
}
